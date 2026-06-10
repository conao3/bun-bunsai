import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  DescribeMetricFiltersCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  ListTagsForResourceCommand,
  PutLogEventsCommand,
  PutMetricFilterCommand,
  TagLogGroupCommand,
  TagResourceCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e (HIGH gaps — CON-2049)", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });

  test("HIGH-1: CreateLogGroup stores tags, kmsKeyId, logGroupClass", async () => {
    const client = logs();
    const groupName = "bunsai-logs5-high1-group";

    await client.send(
      new CreateLogGroupCommand({
        logGroupName: groupName,
        tags: { env: "dev", team: "bunsai" },
        kmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/test-key",
        logGroupClass: "INFREQUENT_ACCESS",
      }),
    );

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const group = described.logGroups?.[0];
    expect(group?.logGroupClass).toBe("INFREQUENT_ACCESS");
    expect(group?.kmsKeyId).toBe(
      "arn:aws:kms:us-east-1:123456789012:key/test-key",
    );

    const arn = group?.arn ?? "";
    const listed = await client.send(
      new ListTagsForResourceCommand({ resourceArn: arn }),
    );
    expect(listed.tags?.["env"]).toBe("dev");
    expect(listed.tags?.["team"]).toBe("bunsai");

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("HIGH-2: DeleteLogGroup rejects when deletionProtectionEnabled=true", async () => {
    const client = logs();
    const groupName = "bunsai-logs5-high2-group";

    await client.send(
      new CreateLogGroupCommand({
        logGroupName: groupName,
        deletionProtectionEnabled: true,
      }),
    );

    await expect(
      client.send(new DeleteLogGroupCommand({ logGroupName: groupName })),
    ).rejects.toThrow();

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    expect(described.logGroups).toHaveLength(1);
  });

  test("HIGH-3: DeleteLogGroup cascades metric filters and tags", async () => {
    const client = logs();
    const groupName = "bunsai-logs5-high3-group";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const arn = described.logGroups?.[0]?.arn ?? "";

    await client.send(
      new PutMetricFilterCommand({
        logGroupName: groupName,
        filterName: "test-filter",
        filterPattern: "ERROR",
        metricTransformations: [
          {
            metricName: "ErrorCount",
            metricNamespace: "Test",
            metricValue: "1",
          },
        ],
      }),
    );

    await client.send(
      new TagResourceCommand({
        resourceArn: arn,
        tags: { stage: "test" },
      }),
    );

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const filters = await client.send(
      new DescribeMetricFiltersCommand({ logGroupName: groupName }),
    );
    expect(filters.metricFilters).toHaveLength(0);

    const described2 = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const newArn = described2.logGroups?.[0]?.arn ?? "";
    const tags = await client.send(
      new ListTagsForResourceCommand({ resourceArn: newArn }),
    );
    expect(Object.keys(tags.tags ?? {})).toHaveLength(0);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("HIGH-4: TagResource throws ResourceNotFoundException for non-existent group", async () => {
    const client = logs();
    const fakeArn =
      "arn:aws:logs:us-east-1:000000000000:log-group:nonexistent-group:*";

    await expect(
      client.send(
        new TagResourceCommand({
          resourceArn: fakeArn,
          tags: { foo: "bar" },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      client.send(new ListTagsForResourceCommand({ resourceArn: fakeArn })),
    ).rejects.toThrow();
  });

  test("HIGH-4: TagLogGroup and ListTagsForResource converge on same tags", async () => {
    const client = logs();
    const groupName = "bunsai-logs5-high4-group";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const arn = described.logGroups?.[0]?.arn ?? "";

    await client.send(
      new TagLogGroupCommand({
        logGroupName: groupName,
        tags: { source: "legacy" },
      }),
    );

    const viaNew = await client.send(
      new ListTagsForResourceCommand({ resourceArn: arn }),
    );
    expect(viaNew.tags?.["source"]).toBe("legacy");

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("HIGH-5: logGroupIdentifier accepted in FilterLogEvents and DescribeLogStreams", async () => {
    const client = logs();
    const groupName = "bunsai-logs5-high5-group";
    const streamName = "bunsai-logs5-high5-stream";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [{ timestamp: Date.now(), message: "hello from high5" }],
      }),
    );

    const filtered = await client.send(
      new FilterLogEventsCommand({ logGroupIdentifier: groupName }),
    );
    expect(filtered.events?.some((e) => e.message?.includes("high5"))).toBe(
      true,
    );

    const streams = await client.send(
      new DescribeLogStreamsCommand({ logGroupIdentifier: groupName }),
    );
    expect(
      streams.logStreams?.some((s) => s.logStreamName === streamName),
    ).toBe(true);

    const events = await client.send(
      new GetLogEventsCommand({
        logGroupIdentifier: groupName,
        logStreamName: streamName,
      }),
    );
    expect(events.events?.some((e) => e.message?.includes("high5"))).toBe(true);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
