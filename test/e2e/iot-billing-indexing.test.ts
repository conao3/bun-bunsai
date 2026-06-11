import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddThingToBillingGroupCommand,
  CreateBillingGroupCommand,
  CreateDynamicThingGroupCommand,
  CreateFleetMetricCommand,
  CreateThingCommand,
  DeleteBillingGroupCommand,
  DeleteDynamicThingGroupCommand,
  DeleteFleetMetricCommand,
  DescribeBillingGroupCommand,
  DescribeFleetMetricCommand,
  DescribeIndexCommand,
  DescribeThingRegistrationTaskCommand,
  GetBucketsAggregationCommand,
  GetCardinalityCommand,
  GetIndexingConfigurationCommand,
  GetPercentilesCommand,
  GetStatisticsCommand,
  IoTClient,
  ListBillingGroupsCommand,
  ListFleetMetricsCommand,
  ListIndicesCommand,
  ListThingRegistrationTasksCommand,
  ListThingsInBillingGroupCommand,
  RemoveThingFromBillingGroupCommand,
  SearchIndexCommand,
  StartThingRegistrationTaskCommand,
  StopThingRegistrationTaskCommand,
  UpdateBillingGroupCommand,
  UpdateDynamicThingGroupCommand,
  UpdateFleetMetricCommand,
  UpdateIndexingConfigurationCommand,
} from "@aws-sdk/client-iot";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iot = () =>
  new IoTClient({ endpoint, region, credentials, requestHandler });

const suffix = () => Date.now().toString(36);

test("billing group lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const groupName = `bg_e2e_${sfx}`;
  const thingName = `bg_thing_e2e_${sfx}`;

  await client.send(new CreateThingCommand({ thingName }));

  const created = await client.send(
    new CreateBillingGroupCommand({
      billingGroupName: groupName,
      billingGroupProperties: { billingGroupDescription: "e2e test group" },
    }),
  );
  expect(created.billingGroupName).toBe(groupName);
  expect(created.billingGroupArn).toContain(`billinggroup/${groupName}`);
  expect(created.billingGroupId).toBeTruthy();

  const described = await client.send(
    new DescribeBillingGroupCommand({ billingGroupName: groupName }),
  );
  expect(described.billingGroupName).toBe(groupName);
  expect(described.version).toBe(1);
  expect(described.billingGroupProperties?.billingGroupDescription).toBe(
    "e2e test group",
  );

  const listed = await client.send(new ListBillingGroupsCommand({}));
  expect(listed.billingGroups?.some((g) => g.groupName === groupName)).toBe(
    true,
  );

  const updated = await client.send(
    new UpdateBillingGroupCommand({
      billingGroupName: groupName,
      billingGroupProperties: { billingGroupDescription: "updated desc" },
    }),
  );
  expect(updated.version).toBe(2);

  await client.send(
    new AddThingToBillingGroupCommand({
      billingGroupName: groupName,
      thingName,
    }),
  );

  const members = await client.send(
    new ListThingsInBillingGroupCommand({ billingGroupName: groupName }),
  );
  expect(members.things).toContain(thingName);

  await client.send(
    new RemoveThingFromBillingGroupCommand({
      billingGroupName: groupName,
      thingName,
    }),
  );

  const afterRemove = await client.send(
    new ListThingsInBillingGroupCommand({ billingGroupName: groupName }),
  );
  expect(afterRemove.things ?? []).not.toContain(thingName);

  await client.send(
    new DeleteBillingGroupCommand({ billingGroupName: groupName }),
  );

  const afterDelete = await client.send(new ListBillingGroupsCommand({}));
  expect(
    afterDelete.billingGroups?.some((g) => g.groupName === groupName),
  ).toBe(false);
});

test("dynamic thing group lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const groupName = `dtg_e2e_${sfx}`;

  const created = await client.send(
    new CreateDynamicThingGroupCommand({
      thingGroupName: groupName,
      queryString: `thingName:${sfx}*`,
    }),
  );
  expect(created.thingGroupName).toBe(groupName);
  expect(created.queryString).toBe(`thingName:${sfx}*`);

  const updated = await client.send(
    new UpdateDynamicThingGroupCommand({
      thingGroupName: groupName,
      thingGroupProperties: {},
      queryString: `thingName:updated_${sfx}*`,
    }),
  );
  expect(updated.version).toBe(2);

  await client.send(
    new DeleteDynamicThingGroupCommand({ thingGroupName: groupName }),
  );
});

test("fleet metric lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const metricName = `fm_e2e_${sfx}`;

  const created = await client.send(
    new CreateFleetMetricCommand({
      metricName,
      queryString: "*",
      aggregationType: { name: "Statistics", values: [] },
      period: 60,
      aggregationField: "registry.version",
    }),
  );
  expect(created.metricName).toBe(metricName);
  expect(created.metricArn).toContain(`fleetmetric/${metricName}`);

  const described = await client.send(
    new DescribeFleetMetricCommand({ metricName }),
  );
  expect(described.metricName).toBe(metricName);
  expect(described.period).toBe(60);

  const listed = await client.send(new ListFleetMetricsCommand({}));
  expect(listed.fleetMetrics?.some((m) => m.metricName === metricName)).toBe(
    true,
  );

  await client.send(
    new UpdateFleetMetricCommand({
      metricName,
      indexName: "AWS_Things",
      period: 120,
    }),
  );

  const afterUpdate = await client.send(
    new DescribeFleetMetricCommand({ metricName }),
  );
  expect(afterUpdate.period).toBe(120);

  await client.send(new DeleteFleetMetricCommand({ metricName }));

  const afterDelete = await client.send(new ListFleetMetricsCommand({}));
  expect(
    afterDelete.fleetMetrics?.some((m) => m.metricName === metricName),
  ).toBe(false);
});

test("fleet indexing and search", async () => {
  const client = iot();
  const sfx = suffix();
  const thingName = `idx_thing_e2e_${sfx}`;

  await client.send(new CreateThingCommand({ thingName }));

  const indices = await client.send(new ListIndicesCommand({}));
  expect(indices.indexNames).toContain("AWS_Things");

  const idx = await client.send(
    new DescribeIndexCommand({ indexName: "AWS_Things" }),
  );
  expect(idx.indexName).toBe("AWS_Things");
  expect(idx.indexStatus as string).toBe("ACTIVE");

  const config = await client.send(new GetIndexingConfigurationCommand({}));
  expect(config.thingIndexingConfiguration).toBeTruthy();

  await client.send(
    new UpdateIndexingConfigurationCommand({
      thingIndexingConfiguration: { thingIndexingMode: "REGISTRY" },
    }),
  );

  const afterUpdate = await client.send(
    new GetIndexingConfigurationCommand({}),
  );
  expect(
    (afterUpdate.thingIndexingConfiguration as Record<string, unknown>)
      ?.thingIndexingMode,
  ).toBe("REGISTRY");

  const searchResult = await client.send(
    new SearchIndexCommand({ queryString: `thingName:${thingName}` }),
  );
  expect(searchResult.things?.some((t) => t.thingName === thingName)).toBe(
    true,
  );

  const stats = await client.send(
    new GetStatisticsCommand({ queryString: "*" }),
  );
  expect((stats.statistics?.count ?? 0) >= 1).toBe(true);

  const cardinality = await client.send(
    new GetCardinalityCommand({ queryString: "*" }),
  );
  expect((cardinality.cardinality ?? 0) >= 1).toBe(true);

  const percentiles = await client.send(
    new GetPercentilesCommand({ queryString: "*" }),
  );
  expect(percentiles.percentiles).toBeDefined();

  const buckets = await client.send(
    new GetBucketsAggregationCommand({
      queryString: "*",
      aggregationField: "registry.version",
      bucketsAggregationType: { termsAggregation: { maxBuckets: 10 } },
    }),
  );
  expect((buckets.totalCount ?? 0) >= 1).toBe(true);
});

test("thing registration task lifecycle", async () => {
  const client = iot();

  const started = await client.send(
    new StartThingRegistrationTaskCommand({
      templateBody: '{"Parameters":{},"Resources":{}}',
      inputFileBucket: "e2e-bucket",
      inputFileKey: "e2e-input.json",
      roleArn: "arn:aws:iam::000000000000:role/e2e-role",
    }),
  );
  expect(started.taskId).toBeTruthy();
  const taskId = started.taskId!;

  const described = await client.send(
    new DescribeThingRegistrationTaskCommand({ taskId }),
  );
  expect(described.taskId).toBe(taskId);
  expect(described.status as string).toBe("Completed");

  const listed = await client.send(new ListThingRegistrationTasksCommand({}));
  expect(listed.taskIds).toContain(taskId);

  await client.send(new StopThingRegistrationTaskCommand({ taskId }));

  const afterStop = await client.send(
    new DescribeThingRegistrationTaskCommand({ taskId }),
  );
  expect(afterStop.status as string).toBe("Cancelled");
});
