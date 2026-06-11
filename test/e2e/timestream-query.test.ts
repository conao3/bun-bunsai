import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDatabaseCommand,
  CreateTableCommand,
  DeleteDatabaseCommand,
  TagResourceCommand,
  TimestreamWriteClient,
  UntagResourceCommand,
  WriteRecordsCommand,
  type _Record,
} from "@aws-sdk/client-timestream-write";
import {
  CancelQueryCommand,
  CreateScheduledQueryCommand,
  DeleteScheduledQueryCommand,
  DescribeAccountSettingsCommand,
  DescribeScheduledQueryCommand,
  ExecuteScheduledQueryCommand,
  ListScheduledQueriesCommand,
  ListTagsForResourceCommand,
  PrepareQueryCommand,
  QueryCommand,
  S3EncryptionOption,
  TimestreamQueryClient,
  UpdateAccountSettingsCommand,
  UpdateScheduledQueryCommand,
} from "@aws-sdk/client-timestream-query";

const { requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const writeClient = () =>
  new TimestreamWriteClient({ region, credentials, requestHandler });

const queryClient = () =>
  new TimestreamQueryClient({ region, credentials, requestHandler });

const scheduledQueryInput = (name: string) => ({
  Name: name,
  QueryString: `SELECT * FROM "db"."table"`,
  ScheduleConfiguration: { ScheduleExpression: "rate(1 hour)" },
  NotificationConfiguration: {
    SnsConfiguration: { TopicArn: "arn:aws:sns:us-east-1:000000000000:test" },
  },
  ScheduledQueryExecutionRoleArn: "arn:aws:iam::000000000000:role/test-role",
  ErrorReportConfiguration: {
    S3Configuration: {
      BucketName: "test-bucket",
      EncryptionOption: S3EncryptionOption.SSE_S3,
    },
  },
});

test("Timestream ScheduledQuery lifecycle", async () => {
  const qc = queryClient();
  const name = "e2e-sq-lifecycle";

  const created = await qc.send(
    new CreateScheduledQueryCommand(scheduledQueryInput(name)),
  );
  const arn = created.Arn ?? "";
  expect(arn).toContain("scheduled-query");
  expect(arn).toContain(name);

  const described = await qc.send(
    new DescribeScheduledQueryCommand({ ScheduledQueryArn: arn }),
  );
  expect(described.ScheduledQuery?.Name).toBe(name);
  expect(described.ScheduledQuery?.State).toBe("ENABLED");
  expect(described.ScheduledQuery?.Arn).toBe(arn);

  await qc.send(
    new UpdateScheduledQueryCommand({
      ScheduledQueryArn: arn,
      State: "DISABLED",
    }),
  );
  const afterUpdate = await qc.send(
    new DescribeScheduledQueryCommand({ ScheduledQueryArn: arn }),
  );
  expect(afterUpdate.ScheduledQuery?.State).toBe("DISABLED");

  const listed = await qc.send(new ListScheduledQueriesCommand({}));
  expect(
    (listed.ScheduledQueries ?? []).some((sq) => sq.Arn === arn),
  ).toBeTrue();

  await qc.send(
    new ExecuteScheduledQueryCommand({
      ScheduledQueryArn: arn,
      InvocationTime: new Date(),
    }),
  );

  await qc.send(new DeleteScheduledQueryCommand({ ScheduledQueryArn: arn }));

  await expect(
    qc.send(new DescribeScheduledQueryCommand({ ScheduledQueryArn: arn })),
  ).rejects.toThrow();

  await expect(
    qc.send(new DeleteScheduledQueryCommand({ ScheduledQueryArn: arn })),
  ).rejects.toThrow();
});

test("Timestream ScheduledQuery ConflictException on duplicate name", async () => {
  const qc = queryClient();
  const name = "e2e-sq-conflict";

  const created = await qc.send(
    new CreateScheduledQueryCommand(scheduledQueryInput(name)),
  );
  const arn = created.Arn ?? "";

  await expect(
    qc.send(new CreateScheduledQueryCommand(scheduledQueryInput(name))),
  ).rejects.toThrow();

  await qc.send(new DeleteScheduledQueryCommand({ ScheduledQueryArn: arn }));
});

test("Timestream ScheduledQuery ClientToken idempotency", async () => {
  const qc = queryClient();
  const name = "e2e-sq-idempotent";
  const clientToken = "idempotency-token-" + crypto.randomUUID();

  const first = await qc.send(
    new CreateScheduledQueryCommand({
      ...scheduledQueryInput(name),
      ClientToken: clientToken,
    }),
  );
  const second = await qc.send(
    new CreateScheduledQueryCommand({
      ...scheduledQueryInput(name),
      ClientToken: clientToken,
    }),
  );
  expect(first.Arn).toBe(second.Arn);

  await qc.send(
    new DeleteScheduledQueryCommand({ ScheduledQueryArn: first.Arn ?? "" }),
  );
});

test("Timestream ScheduledQuery tags round-trip", async () => {
  const qc = queryClient();
  const wc = writeClient();
  const name = "e2e-sq-tags";

  const created = await qc.send(
    new CreateScheduledQueryCommand({
      ...scheduledQueryInput(name),
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const arn = created.Arn ?? "";

  const initialTags = await qc.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(
    (initialTags.Tags ?? []).some((t) => t.Key === "env" && t.Value === "test"),
  ).toBeTrue();

  await wc.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [{ Key: "project", Value: "bunsai" }],
    }),
  );
  const afterTag = await qc.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect((afterTag.Tags ?? []).some((t) => t.Key === "project")).toBeTrue();
  expect((afterTag.Tags ?? []).some((t) => t.Key === "env")).toBeTrue();

  await wc.send(
    new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["env"] }),
  );
  const afterUntag = await qc.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "env")).toBeFalse();
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "project")).toBeTrue();

  await qc.send(new DeleteScheduledQueryCommand({ ScheduledQueryArn: arn }));
});

test("Timestream Query pagination via NextToken", async () => {
  const wc = writeClient();
  const qc = queryClient();
  const dbName = "e2e-query-page-db";
  const tableName = "e2e-query-page-table";

  await wc.send(new CreateDatabaseCommand({ DatabaseName: dbName }));
  await wc.send(
    new CreateTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );

  const now = Date.now();
  const records: _Record[] = Array.from({ length: 5 }, (_, i) => ({
    Dimensions: [{ Name: "host", Value: `server${i}` }],
    MeasureName: "cpu",
    MeasureValue: String(i * 10),
    MeasureValueType: "DOUBLE",
    Time: String(now + i),
    TimeUnit: "MILLISECONDS",
  }));
  await wc.send(
    new WriteRecordsCommand({
      DatabaseName: dbName,
      TableName: tableName,
      Records: records,
    }),
  );

  const page1 = await qc.send(
    new QueryCommand({
      QueryString: `SELECT * FROM "${dbName}"."${tableName}"`,
      MaxRows: 3,
    }),
  );
  expect(page1.Rows?.length).toBe(3);
  expect(page1.NextToken).toBeTruthy();

  const page2 = await qc.send(
    new QueryCommand({
      QueryString: `SELECT * FROM "${dbName}"."${tableName}"`,
      MaxRows: 3,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.Rows?.length).toBe(2);
  expect(page2.NextToken).toBeUndefined();

  const allIds = [...(page1.Rows ?? []), ...(page2.Rows ?? [])];
  expect(allIds.length).toBe(5);

  expect(page1.QueryId).toBe(page2.QueryId);

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});

test("Timestream Query on nonexistent table throws", async () => {
  const qc = queryClient();

  await expect(
    qc.send(
      new QueryCommand({
        QueryString: `SELECT * FROM "ghost-db"."ghost-table"`,
      }),
    ),
  ).rejects.toThrow();
});

test("Timestream Query ClientToken idempotency", async () => {
  const wc = writeClient();
  const qc = queryClient();
  const dbName = "e2e-query-token-db";
  const tableName = "e2e-query-token-table";

  await wc.send(new CreateDatabaseCommand({ DatabaseName: dbName }));
  await wc.send(
    new CreateTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );

  const now = Date.now();
  await wc.send(
    new WriteRecordsCommand({
      DatabaseName: dbName,
      TableName: tableName,
      Records: [
        {
          Dimensions: [{ Name: "host", Value: "srv1" }],
          MeasureName: "cpu",
          MeasureValue: "50",
          MeasureValueType: "DOUBLE",
          Time: String(now),
          TimeUnit: "MILLISECONDS",
        },
      ],
    }),
  );

  const qs = `SELECT * FROM "${dbName}"."${tableName}"`;
  const token = "client-token-" + crypto.randomUUID();

  const first = await qc.send(
    new QueryCommand({ QueryString: qs, ClientToken: token }),
  );
  const second = await qc.send(
    new QueryCommand({ QueryString: qs, ClientToken: token }),
  );
  expect(first.QueryId).toBe(second.QueryId);

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});

test("Timestream AccountSettings persist via UpdateAccountSettings", async () => {
  const qc = queryClient();

  const initial = await qc.send(new DescribeAccountSettingsCommand({}));
  expect(initial.MaxQueryTCU).toBeDefined();

  const updated = await qc.send(
    new UpdateAccountSettingsCommand({
      MaxQueryTCU: 2000,
      QueryPricingModel: "COMPUTE_UNITS",
    }),
  );
  expect(updated.MaxQueryTCU).toBe(2000);
  expect(updated.QueryPricingModel).toBe("COMPUTE_UNITS");

  const described = await qc.send(new DescribeAccountSettingsCommand({}));
  expect(described.MaxQueryTCU).toBe(2000);
  expect(described.QueryPricingModel).toBe("COMPUTE_UNITS");
});

test("Timestream CancelQuery requires QueryId", async () => {
  const qc = queryClient();

  await expect(
    qc.send(new CancelQueryCommand({ QueryId: "" })),
  ).rejects.toThrow();
});

test("Timestream PrepareQuery returns schema columns without _pq", async () => {
  const wc = writeClient();
  const qc = queryClient();
  const dbName = "e2e-prepare-db";
  const tableName = "e2e-prepare-table";

  await wc.send(new CreateDatabaseCommand({ DatabaseName: dbName }));
  await wc.send(
    new CreateTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );

  const now = Date.now();
  await wc.send(
    new WriteRecordsCommand({
      DatabaseName: dbName,
      TableName: tableName,
      Records: [
        {
          Dimensions: [{ Name: "region", Value: "us-east-1" }],
          MeasureName: "latency",
          MeasureValue: "100",
          MeasureValueType: "DOUBLE",
          Time: String(now),
          TimeUnit: "MILLISECONDS",
        },
      ],
    }),
  );

  const qs = `SELECT * FROM "${dbName}"."${tableName}"`;
  const prepared = await qc.send(new PrepareQueryCommand({ QueryString: qs }));

  expect(prepared.QueryString).toBe(qs);
  expect(prepared.Columns).toBeDefined();
  expect(prepared.Columns!.some((c) => c.Name === "time")).toBeTrue();
  expect(prepared.Columns!.some((c) => c.Name === "region")).toBeTrue();

  const asAny = prepared as unknown as Record<string, unknown>;
  expect(asAny["_pq"]).toBeUndefined();

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});

test("Timestream ScheduledQuery UpdateScheduledQuery unknown ARN throws", async () => {
  const qc = queryClient();
  const unknownArn =
    "arn:aws:timestream:us-east-1:000000000000:scheduled-query/nonexistent-abc12345";

  await expect(
    qc.send(
      new UpdateScheduledQueryCommand({
        ScheduledQueryArn: unknownArn,
        State: "DISABLED",
      }),
    ),
  ).rejects.toThrow();
});
