import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  DeleteLogStreamCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  PutLogEventsCommand,
  PutDestinationCommand,
  DescribeDestinationsCommand,
  DeleteDestinationCommand,
  PutSubscriptionFilterCommand,
  DescribeSubscriptionFiltersCommand,
  DeleteSubscriptionFilterCommand,
  PutDeliveryDestinationCommand,
  PutDeliverySourceCommand,
  CreateDeliveryCommand,
  DescribeDeliveriesCommand,
  DeleteDeliveryCommand,
  DeleteDeliverySourceCommand,
  DeleteDeliveryDestinationCommand,
  CreateExportTaskCommand,
  DescribeExportTasksCommand,
  CreateLogAnomalyDetectorCommand,
  GetLogAnomalyDetectorCommand,
  DeleteLogAnomalyDetectorCommand,
  PutQueryDefinitionCommand,
  DescribeQueryDefinitionsCommand,
  DeleteQueryDefinitionCommand,
  PutAccountPolicyCommand,
  DescribeAccountPoliciesCommand,
  DeleteAccountPolicyCommand,
  TagResourceCommand,
  ListTagsForResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type { AnomalyDetectorStatus } from "@aws-sdk/client-cloudwatch-logs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });

  test("create, describe and delete log groups", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-lifecycle";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const names = (described.logGroups ?? []).map((g) => g.logGroupName);
    expect(names).toContain(groupName);
    const group = (described.logGroups ?? []).find(
      (g) => g.logGroupName === groupName,
    );
    expect(group?.arn).toContain(groupName);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));

    const afterDelete = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const afterNames = (afterDelete.logGroups ?? []).map((g) => g.logGroupName);
    expect(afterNames).not.toContain(groupName);
  });

  test("put and get log events round-trip", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-events";
    const streamName = "bunsai-e2e-stream";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const baseTime = Date.now();
    const put = await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: baseTime, message: "first message" },
          { timestamp: baseTime + 1000, message: "second message" },
        ],
      }),
    );
    expect(put.nextSequenceToken).toBeDefined();

    const got = await client.send(
      new GetLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );
    const messages = (got.events ?? []).map((e) => e.message);
    expect(messages).toEqual(["first message", "second message"]);
    expect(got.events?.[0]?.timestamp).toBe(baseTime);
    expect(got.nextForwardToken).toBeDefined();

    const streams = await client.send(
      new DescribeLogStreamsCommand({ logGroupName: groupName }),
    );
    const streamNames = (streams.logStreams ?? []).map((s) => s.logStreamName);
    expect(streamNames).toContain(streamName);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("filter log events by stream and pattern", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-filter";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "stream-a",
      }),
    );
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "stream-b",
      }),
    );

    const baseTime = Date.now();
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "stream-a",
        logEvents: [{ timestamp: baseTime, message: "alpha error here" }],
      }),
    );
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "stream-b",
        logEvents: [{ timestamp: baseTime + 500, message: "beta ok here" }],
      }),
    );

    const filtered = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "error",
      }),
    );
    const filteredMessages = (filtered.events ?? []).map((e) => e.message);
    expect(filteredMessages).toEqual(["alpha error here"]);
    expect(filtered.events?.[0]?.logStreamName).toBe("stream-a");
    expect(filtered.events?.[0]?.eventId).toBeDefined();

    const byStream = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        logStreamNames: ["stream-b"],
      }),
    );
    const byStreamMessages = (byStream.events ?? []).map((e) => e.message);
    expect(byStreamMessages).toEqual(["beta ok here"]);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("delete log stream", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-delstream";
    const streamName = "bunsai-e2e-stream-del";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const before = await client.send(
      new DescribeLogStreamsCommand({ logGroupName: groupName }),
    );
    expect(before.logStreams?.map((s) => s.logStreamName)).toContain(
      streamName,
    );

    await client.send(
      new DeleteLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const after = await client.send(
      new DescribeLogStreamsCommand({ logGroupName: groupName }),
    );
    expect(after.logStreams?.map((s) => s.logStreamName)).not.toContain(
      streamName,
    );

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("destination put, describe, delete", async () => {
    const client = logs();
    const destName = "bunsai-e2e-dest";

    await client.send(
      new PutDestinationCommand({
        destinationName: destName,
        targetArn:
          "arn:aws:kinesis:us-east-1:123456789012:stream/bunsai-stream",
        roleArn: "arn:aws:iam::123456789012:role/bunsai-role",
      }),
    );

    const described = await client.send(
      new DescribeDestinationsCommand({
        DestinationNamePrefix: destName,
      }),
    );
    expect(described.destinations?.map((d) => d.destinationName)).toContain(
      destName,
    );
    expect(described.destinations?.[0]?.arn).toContain(destName);

    await client.send(
      new DeleteDestinationCommand({ destinationName: destName }),
    );

    const afterDelete = await client.send(
      new DescribeDestinationsCommand({
        DestinationNamePrefix: destName,
      }),
    );
    expect(
      afterDelete.destinations?.map((d) => d.destinationName),
    ).not.toContain(destName);
  });

  test("subscription filter put and describe", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-subfilter";
    const filterName = "bunsai-e2e-filter";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    await client.send(
      new PutSubscriptionFilterCommand({
        logGroupName: groupName,
        filterName,
        filterPattern: "ERROR",
        destinationArn:
          "arn:aws:kinesis:us-east-1:123456789012:stream/bunsai-stream",
      }),
    );

    const described = await client.send(
      new DescribeSubscriptionFiltersCommand({ logGroupName: groupName }),
    );
    expect(described.subscriptionFilters?.map((f) => f.filterName)).toContain(
      filterName,
    );
    expect(described.subscriptionFilters?.[0]?.filterPattern).toBe("ERROR");

    await client.send(
      new DeleteSubscriptionFilterCommand({
        logGroupName: groupName,
        filterName,
      }),
    );

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("delivery destination, source, and delivery lifecycle", async () => {
    const client = logs();
    const dstName = "bunsai-e2e-delivery-dst";
    const srcName = "bunsai-e2e-delivery-src";

    await client.send(
      new PutDeliveryDestinationCommand({
        name: dstName,
        deliveryDestinationConfiguration: {
          destinationResourceArn: "arn:aws:s3:::bunsai-bucket",
        },
      }),
    );

    await client.send(
      new PutDeliverySourceCommand({
        name: srcName,
        resourceArn: "arn:aws:lambda:us-east-1:123456789012:function:bunsai-fn",
        logType: "APPLICATION_LOGS",
      }),
    );

    const created = await client.send(
      new CreateDeliveryCommand({
        deliverySourceName: srcName,
        deliveryDestinationArn: `arn:aws:logs:us-east-1:123456789012:delivery-destination:${dstName}`,
      }),
    );
    expect(created.delivery?.id).toBeDefined();

    const listed = await client.send(new DescribeDeliveriesCommand({}));
    expect(listed.deliveries?.map((d) => d.deliverySourceName)).toContain(
      srcName,
    );

    await client.send(new DeleteDeliveryCommand({ id: created.delivery!.id! }));
    await client.send(new DeleteDeliverySourceCommand({ name: srcName }));
    await client.send(new DeleteDeliveryDestinationCommand({ name: dstName }));
  });

  test("export task create and describe", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-export";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const result = await client.send(
      new CreateExportTaskCommand({
        logGroupName: groupName,
        from: Date.now() - 3600_000,
        to: Date.now(),
        destination: "bunsai-export-bucket",
      }),
    );
    expect(result.taskId).toBeDefined();

    const described = await client.send(
      new DescribeExportTasksCommand({ taskId: result.taskId }),
    );
    expect(described.exportTasks?.map((t) => t.taskId)).toContain(
      result.taskId,
    );

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("log anomaly detector lifecycle", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-anomaly";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const group = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const groupArn = group.logGroups?.[0]?.arn ?? "";

    const created = await client.send(
      new CreateLogAnomalyDetectorCommand({
        logGroupArnList: [groupArn],
        evaluationFrequency: "FIFTEEN_MIN",
      }),
    );
    expect(created.anomalyDetectorArn).toBeDefined();

    const got = await client.send(
      new GetLogAnomalyDetectorCommand({
        anomalyDetectorArn: created.anomalyDetectorArn!,
      }),
    );
    expect(got.anomalyDetectorStatus).toBe("ACTIVE" as AnomalyDetectorStatus);

    await client.send(
      new DeleteLogAnomalyDetectorCommand({
        anomalyDetectorArn: created.anomalyDetectorArn!,
      }),
    );

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("query definition put, describe, delete", async () => {
    const client = logs();
    const queryName = "bunsai-e2e-query-def";

    const put = await client.send(
      new PutQueryDefinitionCommand({
        name: queryName,
        queryString: "fields @timestamp | sort @timestamp desc | limit 20",
      }),
    );
    expect(put.queryDefinitionId).toBeDefined();

    const described = await client.send(
      new DescribeQueryDefinitionsCommand({
        queryDefinitionNamePrefix: queryName,
      }),
    );
    expect(described.queryDefinitions?.map((d) => d.name)).toContain(queryName);

    await client.send(
      new DeleteQueryDefinitionCommand({
        queryDefinitionId: put.queryDefinitionId!,
      }),
    );
  });

  test("account policy put, describe, delete", async () => {
    const client = logs();
    const policyName = "bunsai-e2e-account-policy";

    await client.send(
      new PutAccountPolicyCommand({
        policyName,
        policyDocument: JSON.stringify({ Version: "2012-10-17" }),
        policyType: "DATA_PROTECTION_POLICY",
        scope: "ALL",
      }),
    );

    const described = await client.send(
      new DescribeAccountPoliciesCommand({
        policyType: "DATA_PROTECTION_POLICY",
      }),
    );
    expect(described.accountPolicies?.map((p) => p.policyName)).toContain(
      policyName,
    );

    await client.send(
      new DeleteAccountPolicyCommand({
        policyName,
        policyType: "DATA_PROTECTION_POLICY",
      }),
    );
  });

  test("tag resource lifecycle", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-tags";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const group = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const arn = group.logGroups?.[0]?.arn ?? "";

    await client.send(
      new TagResourceCommand({
        resourceArn: arn,
        tags: { Environment: "test", Team: "bunsai" },
      }),
    );

    const listed = await client.send(
      new ListTagsForResourceCommand({ resourceArn: arn }),
    );
    expect(listed.tags?.["Environment"]).toBe("test");
    expect(listed.tags?.["Team"]).toBe("bunsai");

    await client.send(
      new UntagResourceCommand({
        resourceArn: arn,
        tagKeys: ["Team"],
      }),
    );

    const afterUntag = await client.send(
      new ListTagsForResourceCommand({ resourceArn: arn }),
    );
    expect(afterUntag.tags?.["Environment"]).toBe("test");
    expect(afterUntag.tags?.["Team"]).toBeUndefined();

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
