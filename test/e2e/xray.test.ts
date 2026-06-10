import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetTracesCommand,
  CreateGroupCommand,
  CreateSamplingRuleCommand,
  DeleteGroupCommand,
  DeleteSamplingRuleCommand,
  GetGroupCommand,
  GetGroupsCommand,
  GetSamplingRulesCommand,
  GetSamplingTargetsCommand,
  GetTraceSummariesCommand,
  ListTagsForResourceCommand,
  PutTelemetryRecordsCommand,
  PutTraceSegmentsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateGroupCommand,
  UpdateSamplingRuleCommand,
  XRayClient,
} from "@aws-sdk/client-xray";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const xray = () =>
  new XRayClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const makeSegment = (
  traceId: string,
  id: string,
  name: string,
  startTime: number,
) =>
  JSON.stringify({
    trace_id: traceId,
    id,
    name,
    start_time: startTime,
    end_time: startTime + 0.5,
    in_progress: false,
  });

test("XRay trace lifecycle: PutTraceSegments → GetTraceSummaries → BatchGetTraces", async () => {
  const client = xray();
  const now = Math.floor(Date.now() / 1000);
  const traceId = `1-${now.toString(16).padStart(8, "0")}-000000000000000000000001`;
  const segId = "0000000000000001";

  const put = await client.send(
    new PutTraceSegmentsCommand({
      TraceSegmentDocuments: [
        makeSegment(traceId, segId, "my-service", now - 5),
      ],
    }),
  );
  expect(put.UnprocessedTraceSegments).toHaveLength(0);

  const summaries = await client.send(
    new GetTraceSummariesCommand({
      StartTime: new Date((now - 60) * 1000),
      EndTime: new Date((now + 60) * 1000),
    }),
  );
  expect(summaries.TraceSummaries).toBeDefined();
  const found = summaries.TraceSummaries!.find((s) => s.Id === traceId);
  expect(found).toBeDefined();
  expect(found!.Id).toBe(traceId);

  const batch = await client.send(
    new BatchGetTracesCommand({ TraceIds: [traceId] }),
  );
  expect(batch.Traces).toHaveLength(1);
  expect(batch.Traces![0].Id).toBe(traceId);
  expect(batch.Traces![0].Segments).toHaveLength(1);
  expect(batch.Traces![0].Segments![0].Id).toBe(segId);

  const missing = await client.send(
    new BatchGetTracesCommand({
      TraceIds: ["1-00000000-000000000000000000000999"],
    }),
  );
  expect(missing.UnprocessedTraceIds).toHaveLength(1);
});

test("XRay PutTraceSegments: invalid document goes to UnprocessedTraceSegments", async () => {
  const client = xray();
  const result = await client.send(
    new PutTraceSegmentsCommand({
      TraceSegmentDocuments: ["not-valid-json{{{"],
    }),
  );
  expect(result.UnprocessedTraceSegments).toHaveLength(1);
  expect(result.UnprocessedTraceSegments![0].ErrorCode).toBe("InvalidDocument");
});

test("XRay PutTelemetryRecords accepts without error", async () => {
  const client = xray();
  await expect(
    client.send(
      new PutTelemetryRecordsCommand({
        TelemetryRecords: [
          {
            Timestamp: new Date(),
            SegmentsReceivedCount: 1,
            SegmentsSentCount: 1,
            SegmentsSpilloverCount: 0,
            SegmentsRejectedCount: 0,
          },
        ],
      }),
    ),
  ).resolves.toBeDefined();
});

test("XRay SamplingRule CRUD", async () => {
  const client = xray();

  const created = await client.send(
    new CreateSamplingRuleCommand({
      SamplingRule: {
        RuleName: "test-rule",
        ResourceARN: "*",
        Priority: 9000,
        FixedRate: 0.05,
        ReservoirSize: 5,
        ServiceName: "my-service",
        ServiceType: "*",
        Host: "*",
        HTTPMethod: "*",
        URLPath: "*",
        Version: 1,
      },
    }),
  );
  expect(created.SamplingRuleRecord?.SamplingRule?.RuleName).toBe("test-rule");
  expect(created.SamplingRuleRecord?.SamplingRule?.FixedRate).toBe(0.05);
  const ruleArn = created.SamplingRuleRecord?.SamplingRule?.RuleARN!;

  const listed = await client.send(new GetSamplingRulesCommand({}));
  const rule = listed.SamplingRuleRecords?.find(
    (r) => r.SamplingRule?.RuleName === "test-rule",
  );
  expect(rule).toBeDefined();

  const targets = await client.send(
    new GetSamplingTargetsCommand({
      SamplingStatisticsDocuments: [
        {
          RuleName: "test-rule",
          ClientID: "test-client",
          Timestamp: new Date(),
          RequestCount: 10,
          SampledCount: 1,
          BorrowCount: 0,
        },
      ],
    }),
  );
  expect(targets.SamplingTargetDocuments).toHaveLength(1);
  expect(targets.SamplingTargetDocuments![0].RuleName).toBe("test-rule");

  const updated = await client.send(
    new UpdateSamplingRuleCommand({
      SamplingRuleUpdate: {
        RuleName: "test-rule",
        FixedRate: 0.1,
      },
    }),
  );
  expect(updated.SamplingRuleRecord?.SamplingRule?.FixedRate).toBe(0.1);

  await client.send(
    new TagResourceCommand({
      ResourceARN: ruleArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const tagList = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: ruleArn }),
  );
  expect(tagList.Tags).toContainEqual({ Key: "env", Value: "test" });

  await client.send(
    new UntagResourceCommand({ ResourceARN: ruleArn, TagKeys: ["env"] }),
  );
  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: ruleArn }),
  );
  expect(afterUntag.Tags?.find((t) => t.Key === "env")).toBeUndefined();

  const deleted = await client.send(
    new DeleteSamplingRuleCommand({ RuleName: "test-rule" }),
  );
  expect(deleted.SamplingRuleRecord?.SamplingRule?.RuleName).toBe("test-rule");

  const afterDelete = await client.send(new GetSamplingRulesCommand({}));
  expect(
    afterDelete.SamplingRuleRecords?.find(
      (r) => r.SamplingRule?.RuleName === "test-rule",
    ),
  ).toBeUndefined();
});

test("XRay Group CRUD", async () => {
  const client = xray();

  const created = await client.send(
    new CreateGroupCommand({
      GroupName: "test-group",
      FilterExpression: 'service("my-service")',
      InsightsConfiguration: {
        InsightsEnabled: false,
        NotificationsEnabled: false,
      },
    }),
  );
  expect(created.Group?.GroupName).toBe("test-group");
  const groupArn = created.Group?.GroupARN!;

  const got = await client.send(
    new GetGroupCommand({ GroupName: "test-group" }),
  );
  expect(got.Group?.GroupName).toBe("test-group");
  expect(got.Group?.FilterExpression).toBe('service("my-service")');

  const listed = await client.send(new GetGroupsCommand({}));
  expect(
    listed.Groups?.find((g) => g.GroupName === "test-group"),
  ).toBeDefined();

  const updated = await client.send(
    new UpdateGroupCommand({
      GroupName: "test-group",
      FilterExpression: 'service("updated-service")',
    }),
  );
  expect(updated.Group?.FilterExpression).toBe('service("updated-service")');

  await client.send(
    new TagResourceCommand({
      ResourceARN: groupArn,
      Tags: [{ Key: "project", Value: "x" }],
    }),
  );
  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: groupArn }),
  );
  expect(tags.Tags).toContainEqual({ Key: "project", Value: "x" });

  await client.send(new DeleteGroupCommand({ GroupName: "test-group" }));

  await expect(
    client.send(new GetGroupCommand({ GroupName: "test-group" })),
  ).rejects.toThrow();
});
