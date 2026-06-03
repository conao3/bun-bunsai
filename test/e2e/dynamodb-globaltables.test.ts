import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchExecuteStatementCommand,
  CreateGlobalTableCommand,
  CreateTableCommand,
  DeleteResourcePolicyCommand,
  DeleteTableCommand,
  DescribeContributorInsightsCommand,
  DescribeEndpointsCommand,
  DescribeExportCommand,
  DescribeGlobalTableCommand,
  DescribeGlobalTableSettingsCommand,
  DescribeImportCommand,
  DescribeKinesisStreamingDestinationCommand,
  DescribeLimitsCommand,
  DescribeTableReplicaAutoScalingCommand,
  DisableKinesisStreamingDestinationCommand,
  DynamoDBClient,
  EnableKinesisStreamingDestinationCommand,
  ExecuteStatementCommand,
  ExecuteTransactionCommand,
  ExportTableToPointInTimeCommand,
  GetResourcePolicyCommand,
  ImportTableCommand,
  ListContributorInsightsCommand,
  ListExportsCommand,
  ListGlobalTablesCommand,
  ListImportsCommand,
  PutItemCommand,
  PutResourcePolicyCommand,
  RestoreTableFromBackupCommand,
  RestoreTableToPointInTimeCommand,
  UpdateContributorInsightsCommand,
  UpdateGlobalTableCommand,
  UpdateGlobalTableSettingsCommand,
  UpdateKinesisStreamingDestinationCommand,
  UpdateTableReplicaAutoScalingCommand,
  CreateBackupCommand,
} from "@aws-sdk/client-dynamodb";

const awsPort = 4577;
const uiPort = 5677;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("DynamoDB global-table and extended ops e2e", () => {
  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const ddb = () => new DynamoDBClient({ endpoint, region, credentials });
  const table = "bunsai-e2e-ddb-globaltables";

  test("DescribeLimits returns static values", async () => {
    const client = ddb();
    const res = await client.send(new DescribeLimitsCommand({}));
    expect(res.AccountMaxReadCapacityUnits).toBeGreaterThan(0);
    expect(res.AccountMaxWriteCapacityUnits).toBeGreaterThan(0);
    expect(res.TableMaxReadCapacityUnits).toBeGreaterThan(0);
    expect(res.TableMaxWriteCapacityUnits).toBeGreaterThan(0);
  });

  test("DescribeEndpoints returns endpoints", async () => {
    const client = ddb();
    const res = await client.send(new DescribeEndpointsCommand({}));
    expect(res.Endpoints).toBeDefined();
    expect(res.Endpoints!.length).toBeGreaterThan(0);
    expect(res.Endpoints![0].Address).toContain("dynamodb");
  });

  test("global table lifecycle", async () => {
    const client = ddb();

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const created = await client.send(
      new CreateGlobalTableCommand({
        GlobalTableName: table,
        ReplicationGroup: [{ RegionName: "us-east-1" }],
      }),
    );
    expect(created.GlobalTableDescription?.GlobalTableName).toBe(table);
    expect(created.GlobalTableDescription?.GlobalTableStatus).toBe("ACTIVE");

    const described = await client.send(
      new DescribeGlobalTableCommand({ GlobalTableName: table }),
    );
    expect(described.GlobalTableDescription?.GlobalTableName).toBe(table);

    const settings = await client.send(
      new DescribeGlobalTableSettingsCommand({ GlobalTableName: table }),
    );
    expect(settings.GlobalTableName).toBe(table);
    expect(settings.ReplicaSettings).toBeDefined();

    const updated = await client.send(
      new UpdateGlobalTableCommand({
        GlobalTableName: table,
        ReplicaUpdates: [{ Create: { RegionName: "eu-west-1" } }],
      }),
    );
    expect(
      updated.GlobalTableDescription?.ReplicationGroup?.some(
        (r) => r.RegionName === "eu-west-1",
      ),
    ).toBe(true);

    const settingsUpdate = await client.send(
      new UpdateGlobalTableSettingsCommand({
        GlobalTableName: table,
        GlobalTableProvisionedWriteCapacityUnits: 10,
      }),
    );
    expect(settingsUpdate.GlobalTableName).toBe(table);

    const listed = await client.send(new ListGlobalTablesCommand({}));
    expect(listed.GlobalTables?.some((t) => t.GlobalTableName === table)).toBe(
      true,
    );

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("export and import lifecycle", async () => {
    const client = ddb();
    const exportTable = `${table}-export`;

    await client.send(
      new CreateTableCommand({
        TableName: exportTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const tArn = `arn:aws:dynamodb:${region}:000000000000:table/${exportTable}`;

    const exported = await client.send(
      new ExportTableToPointInTimeCommand({
        TableArn: tArn,
        S3Bucket: "my-bucket",
        ExportFormat: "DYNAMODB_JSON",
      }),
    );
    expect(exported.ExportDescription?.ExportStatus).toBe("COMPLETED");
    const exportArn = exported.ExportDescription?.ExportArn;
    expect(exportArn).toBeDefined();

    const described = await client.send(
      new DescribeExportCommand({ ExportArn: exportArn! }),
    );
    expect(described.ExportDescription?.ExportArn).toBe(exportArn);

    const listed = await client.send(
      new ListExportsCommand({ TableArn: tArn }),
    );
    expect(listed.ExportSummaries?.some((e) => e.ExportArn === exportArn)).toBe(
      true,
    );

    const imported = await client.send(
      new ImportTableCommand({
        S3BucketSource: { S3Bucket: "my-bucket" },
        InputFormat: "DYNAMODB_JSON",
        TableCreationParameters: {
          TableName: `${exportTable}-restored`,
          AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
          KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      }),
    );
    expect(imported.ImportTableDescription?.ImportStatus).toBe("COMPLETED");
    const importArn = imported.ImportTableDescription?.ImportArn;
    expect(importArn).toBeDefined();

    const describedImport = await client.send(
      new DescribeImportCommand({ ImportArn: importArn! }),
    );
    expect(describedImport.ImportTableDescription?.ImportArn).toBe(importArn);

    const listedImports = await client.send(
      new ListImportsCommand({ TableArn: tArn }),
    );
    expect(listedImports.ImportSummaryList).toBeDefined();

    await client.send(new DeleteTableCommand({ TableName: exportTable }));
    await client.send(
      new DeleteTableCommand({ TableName: `${exportTable}-restored` }),
    );
  });

  test("kinesis streaming destination lifecycle", async () => {
    const client = ddb();
    const kinesisTable = `${table}-kinesis`;

    await client.send(
      new CreateTableCommand({
        TableName: kinesisTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const streamArn = "arn:aws:kinesis:us-east-1:000000000000:stream/my-stream";

    const enabled = await client.send(
      new EnableKinesisStreamingDestinationCommand({
        TableName: kinesisTable,
        StreamArn: streamArn,
      }),
    );
    expect(enabled.TableName).toBe(kinesisTable);
    expect(enabled.StreamArn).toBe(streamArn);

    const described = await client.send(
      new DescribeKinesisStreamingDestinationCommand({
        TableName: kinesisTable,
      }),
    );
    expect(described.TableName).toBe(kinesisTable);
    expect(
      described.KinesisDataStreamDestinations?.some(
        (d) => d.StreamArn === streamArn,
      ),
    ).toBe(true);

    const updated = await client.send(
      new UpdateKinesisStreamingDestinationCommand({
        TableName: kinesisTable,
        StreamArn: streamArn,
        UpdateKinesisStreamingConfiguration: {
          ApproximateCreationDateTimePrecision: "MILLISECOND",
        },
      }),
    );
    expect(updated.TableName).toBe(kinesisTable);

    const disabled = await client.send(
      new DisableKinesisStreamingDestinationCommand({
        TableName: kinesisTable,
        StreamArn: streamArn,
      }),
    );
    expect(disabled.TableName).toBe(kinesisTable);

    await client.send(new DeleteTableCommand({ TableName: kinesisTable }));
  });

  test("contributor insights lifecycle", async () => {
    const client = ddb();
    const ciTable = `${table}-ci`;

    await client.send(
      new CreateTableCommand({
        TableName: ciTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const described = await client.send(
      new DescribeContributorInsightsCommand({ TableName: ciTable }),
    );
    expect(described.TableName).toBe(ciTable);
    expect(described.ContributorInsightsStatus).toBeDefined();

    const updated = await client.send(
      new UpdateContributorInsightsCommand({
        TableName: ciTable,
        ContributorInsightsAction: "ENABLE",
      }),
    );
    expect(updated.TableName).toBe(ciTable);
    expect(updated.ContributorInsightsStatus).toBe("ENABLED");

    const listed = await client.send(
      new ListContributorInsightsCommand({ TableName: ciTable }),
    );
    expect(listed.ContributorInsightsSummaries).toBeDefined();

    await client.send(new DeleteTableCommand({ TableName: ciTable }));
  });

  test("resource policy lifecycle", async () => {
    const client = ddb();
    const rpTable = `${table}-rp`;

    await client.send(
      new CreateTableCommand({
        TableName: rpTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const resourceArn = `arn:aws:dynamodb:${region}:000000000000:table/${rpTable}`;
    const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

    const put = await client.send(
      new PutResourcePolicyCommand({
        ResourceArn: resourceArn,
        Policy: policy,
      }),
    );
    expect(put.RevisionId).toBeDefined();

    const got = await client.send(
      new GetResourcePolicyCommand({ ResourceArn: resourceArn }),
    );
    expect(got.Policy).toBe(policy);
    expect(got.RevisionId).toBe(put.RevisionId);

    const deleted = await client.send(
      new DeleteResourcePolicyCommand({ ResourceArn: resourceArn }),
    );
    expect(deleted.RevisionId).toBeDefined();

    await client.send(new DeleteTableCommand({ TableName: rpTable }));
  });

  test("restore table from backup", async () => {
    const client = ddb();
    const backupSrc = `${table}-backup-src`;
    const backupDst = `${table}-backup-dst`;

    await client.send(
      new CreateTableCommand({
        TableName: backupSrc,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const backup = await client.send(
      new CreateBackupCommand({
        TableName: backupSrc,
        BackupName: "test-backup",
      }),
    );
    const backupArn = backup.BackupDetails?.BackupArn;
    expect(backupArn).toBeDefined();

    const restored = await client.send(
      new RestoreTableFromBackupCommand({
        TargetTableName: backupDst,
        BackupArn: backupArn!,
      }),
    );
    expect(restored.TableDescription?.TableName).toBe(backupDst);

    await client.send(new DeleteTableCommand({ TableName: backupSrc }));
    await client.send(new DeleteTableCommand({ TableName: backupDst }));
  });

  test("restore table to point in time", async () => {
    const client = ddb();
    const pitSrc = `${table}-pit-src`;
    const pitDst = `${table}-pit-dst`;

    await client.send(
      new CreateTableCommand({
        TableName: pitSrc,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const restored = await client.send(
      new RestoreTableToPointInTimeCommand({
        SourceTableName: pitSrc,
        TargetTableName: pitDst,
      }),
    );
    expect(restored.TableDescription?.TableName).toBe(pitDst);

    await client.send(new DeleteTableCommand({ TableName: pitSrc }));
    await client.send(new DeleteTableCommand({ TableName: pitDst }));
  });

  test("auto scaling describe and update", async () => {
    const client = ddb();
    const asTable = `${table}-as`;

    await client.send(
      new CreateTableCommand({
        TableName: asTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const described = await client.send(
      new DescribeTableReplicaAutoScalingCommand({ TableName: asTable }),
    );
    expect(described.TableAutoScalingDescription?.TableName).toBe(asTable);

    const updated = await client.send(
      new UpdateTableReplicaAutoScalingCommand({
        TableName: asTable,
        ProvisionedWriteCapacityAutoScalingUpdate: {
          AutoScalingDisabled: true,
        },
      }),
    );
    expect(updated.TableAutoScalingDescription?.TableName).toBe(asTable);

    await client.send(new DeleteTableCommand({ TableName: asTable }));
  });

  test("PartiQL ExecuteStatement SELECT/INSERT/UPDATE/DELETE", async () => {
    const client = ddb();
    const partiTable = `${table}-partiql`;

    await client.send(
      new CreateTableCommand({
        TableName: partiTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    await client.send(
      new ExecuteStatementCommand({
        Statement: `INSERT INTO "${partiTable}" VALUE {'pk': ?, 'val': ?}`,
        Parameters: [{ S: "row1" }, { S: "hello" }],
      }),
    );

    const selected = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${partiTable}" WHERE pk = ?`,
        Parameters: [{ S: "row1" }],
      }),
    );
    expect(selected.Items).toBeDefined();
    expect(selected.Items!.length).toBeGreaterThan(0);
    expect(selected.Items![0]["pk"]?.S).toBe("row1");

    await client.send(
      new ExecuteStatementCommand({
        Statement: `UPDATE "${partiTable}" SET val = ? WHERE pk = ?`,
        Parameters: [{ S: "world" }, { S: "row1" }],
      }),
    );

    const afterUpdate = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${partiTable}" WHERE pk = ?`,
        Parameters: [{ S: "row1" }],
      }),
    );
    expect(afterUpdate.Items![0]["val"]?.S).toBe("world");

    await client.send(
      new ExecuteStatementCommand({
        Statement: `DELETE FROM "${partiTable}" WHERE pk = ?`,
        Parameters: [{ S: "row1" }],
      }),
    );

    const afterDelete = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${partiTable}"`,
      }),
    );
    expect(afterDelete.Items?.length ?? 0).toBe(0);

    await client.send(new DeleteTableCommand({ TableName: partiTable }));
  });

  test("BatchExecuteStatement", async () => {
    const client = ddb();
    const batchTable = `${table}-batch-partiql`;

    await client.send(
      new CreateTableCommand({
        TableName: batchTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    await client.send(
      new PutItemCommand({
        TableName: batchTable,
        Item: { pk: { S: "a" }, v: { S: "1" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: batchTable,
        Item: { pk: { S: "b" }, v: { S: "2" } },
      }),
    );

    const batch = await client.send(
      new BatchExecuteStatementCommand({
        Statements: [
          {
            Statement: `SELECT * FROM "${batchTable}" WHERE pk = ?`,
            Parameters: [{ S: "a" }],
          },
          {
            Statement: `SELECT * FROM "${batchTable}" WHERE pk = ?`,
            Parameters: [{ S: "b" }],
          },
        ],
      }),
    );
    expect(batch.Responses).toBeDefined();
    expect(batch.Responses!.length).toBe(2);

    await client.send(new DeleteTableCommand({ TableName: batchTable }));
  });

  test("ExecuteTransaction", async () => {
    const client = ddb();
    const txTable = `${table}-tx-partiql`;

    await client.send(
      new CreateTableCommand({
        TableName: txTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    await client.send(
      new ExecuteTransactionCommand({
        TransactStatements: [
          {
            Statement: `INSERT INTO "${txTable}" VALUE {'pk': ?, 'v': ?}`,
            Parameters: [{ S: "tx1" }, { N: "10" }],
          },
          {
            Statement: `INSERT INTO "${txTable}" VALUE {'pk': ?, 'v': ?}`,
            Parameters: [{ S: "tx2" }, { N: "20" }],
          },
        ],
      }),
    );

    const check = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${txTable}"`,
      }),
    );
    expect(check.Items?.length).toBe(2);

    await client.send(new DeleteTableCommand({ TableName: txTable }));
  });
});
