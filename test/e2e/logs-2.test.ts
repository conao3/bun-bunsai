import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  DeleteLogGroupCommand,
  DeleteMetricFilterCommand,
  DeleteRetentionPolicyCommand,
  DescribeLogGroupsCommand,
  DescribeMetricFiltersCommand,
  ListTagsLogGroupCommand,
  PutMetricFilterCommand,
  PutRetentionPolicyCommand,
  TagLogGroupCommand,
  UntagLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e (retention, metric filters, tags)", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials });

  test("put and delete retention policy", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-retention";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    await client.send(
      new PutRetentionPolicyCommand({
        logGroupName: groupName,
        retentionInDays: 14,
      }),
    );

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const group = (described.logGroups ?? []).find(
      (g) => g.logGroupName === groupName,
    );
    expect(group?.retentionInDays).toBe(14);

    await client.send(
      new DeleteRetentionPolicyCommand({ logGroupName: groupName }),
    );

    const afterDelete = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const afterGroup = (afterDelete.logGroups ?? []).find(
      (g) => g.logGroupName === groupName,
    );
    expect(afterGroup?.retentionInDays).toBeUndefined();

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("put, describe and delete metric filters", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-metricfilter";
    const filterName = "bunsai-e2e-filter";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    await client.send(
      new PutMetricFilterCommand({
        logGroupName: groupName,
        filterName,
        filterPattern: "ERROR",
        metricTransformations: [
          {
            metricName: "ErrorCount",
            metricNamespace: "Bunsai/Test",
            metricValue: "1",
            defaultValue: 0,
          },
        ],
      }),
    );

    const described = await client.send(
      new DescribeMetricFiltersCommand({ logGroupName: groupName }),
    );
    const filters = described.metricFilters ?? [];
    expect(filters.map((f) => f.filterName)).toContain(filterName);
    const filter = filters.find((f) => f.filterName === filterName);
    expect(filter?.filterPattern).toBe("ERROR");
    expect(filter?.metricTransformations?.[0]?.metricName).toBe("ErrorCount");
    expect(filter?.metricTransformations?.[0]?.metricNamespace).toBe(
      "Bunsai/Test",
    );
    expect(filter?.metricTransformations?.[0]?.metricValue).toBe("1");

    const byPrefix = await client.send(
      new DescribeMetricFiltersCommand({ filterNamePrefix: "bunsai-e2e" }),
    );
    expect((byPrefix.metricFilters ?? []).map((f) => f.filterName)).toContain(
      filterName,
    );

    await client.send(
      new DeleteMetricFilterCommand({ logGroupName: groupName, filterName }),
    );

    const afterDelete = await client.send(
      new DescribeMetricFiltersCommand({ logGroupName: groupName }),
    );
    expect(
      (afterDelete.metricFilters ?? []).map((f) => f.filterName),
    ).not.toContain(filterName);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("tag, list tags and untag log group", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-tags";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    await client.send(
      new TagLogGroupCommand({
        logGroupName: groupName,
        tags: { env: "test", team: "bunsai" },
      }),
    );

    const listed = await client.send(
      new ListTagsLogGroupCommand({ logGroupName: groupName }),
    );
    expect(listed.tags?.env).toBe("test");
    expect(listed.tags?.team).toBe("bunsai");

    await client.send(
      new UntagLogGroupCommand({ logGroupName: groupName, tags: ["team"] }),
    );

    const afterUntag = await client.send(
      new ListTagsLogGroupCommand({ logGroupName: groupName }),
    );
    expect(afterUntag.tags?.env).toBe("test");
    expect(afterUntag.tags?.team).toBeUndefined();

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("describe metric filters does not surface filters as log groups", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-isolation";
    const filterName = "bunsai-e2e-isolation-filter";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new PutMetricFilterCommand({
        logGroupName: groupName,
        filterName,
        filterPattern: "WARN",
        metricTransformations: [
          {
            metricName: "WarnCount",
            metricNamespace: "Bunsai/Test",
            metricValue: "1",
          },
        ],
      }),
    );

    const described = await client.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: "bunsai-e2e-group-isolation",
      }),
    );
    const names = (described.logGroups ?? []).map((g) => g.logGroupName);
    expect(names).toEqual([groupName]);

    await client.send(
      new DeleteMetricFilterCommand({ logGroupName: groupName, filterName }),
    );
    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
