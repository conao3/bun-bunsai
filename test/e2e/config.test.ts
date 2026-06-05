import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConfigServiceClient,
  DeleteAggregationAuthorizationCommand,
  DeleteConfigRuleCommand,
  DeleteConfigurationAggregatorCommand,
  DeleteConfigurationRecorderCommand,
  DeleteConformancePackCommand,
  DeleteDeliveryChannelCommand,
  DeleteOrganizationConfigRuleCommand,
  DeleteOrganizationConformancePackCommand,
  DeleteRemediationConfigurationCommand,
  DeleteRetentionConfigurationCommand,
  DeleteStoredQueryCommand,
  DeliverConfigSnapshotCommand,
  DescribeAggregationAuthorizationsCommand,
  DescribeComplianceByConfigRuleCommand,
  DescribeConfigRulesCommand,
  DescribeConfigurationAggregatorSourcesStatusCommand,
  DescribeConfigurationAggregatorsCommand,
  DescribeConfigurationRecorderStatusCommand,
  DescribeConfigurationRecordersCommand,
  DescribeConformancePackStatusCommand,
  DescribeConformancePacksCommand,
  DescribeDeliveryChannelStatusCommand,
  DescribeDeliveryChannelsCommand,
  DescribeOrganizationConfigRuleStatusesCommand,
  DescribeOrganizationConfigRulesCommand,
  DescribeOrganizationConformancePackStatusesCommand,
  DescribeOrganizationConformancePacksCommand,
  DescribeRemediationConfigurationsCommand,
  DescribeRetentionConfigurationsCommand,
  GetComplianceSummaryByConfigRuleCommand,
  GetStoredQueryCommand,
  ListStoredQueriesCommand,
  ListTagsForResourceCommand,
  PutAggregationAuthorizationCommand,
  PutConfigRuleCommand,
  PutConfigurationAggregatorCommand,
  PutConfigurationRecorderCommand,
  PutConformancePackCommand,
  PutDeliveryChannelCommand,
  PutOrganizationConfigRuleCommand,
  PutOrganizationConformancePackCommand,
  PutRemediationConfigurationsCommand,
  PutRetentionConfigurationCommand,
  PutStoredQueryCommand,
  StartConfigurationRecorderCommand,
  StopConfigurationRecorderCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-config-service";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const config = () =>
  new ConfigServiceClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("AWS Config rule lifecycle", async () => {
  const client = config();
  const ruleName = "bunsai-e2e-rule";

  await client.send(
    new PutConfigRuleCommand({
      ConfigRule: {
        ConfigRuleName: ruleName,
        Source: { Owner: "AWS", SourceIdentifier: "REQUIRED_TAGS" },
      },
    }),
  );

  const described = await client.send(
    new DescribeConfigRulesCommand({ ConfigRuleNames: [ruleName] }),
  );
  const names = (described.ConfigRules ?? []).map(
    (rule) => rule.ConfigRuleName,
  );
  expect(names).toContain(ruleName);

  await client.send(new DeleteConfigRuleCommand({ ConfigRuleName: ruleName }));

  const afterDelete = await client.send(new DescribeConfigRulesCommand({}));
  const remaining = (afterDelete.ConfigRules ?? []).map(
    (rule) => rule.ConfigRuleName,
  );
  expect(remaining).not.toContain(ruleName);
});

test("AWS Config configuration recorder lifecycle", async () => {
  const client = config();
  const recorderName = "bunsai-e2e-recorder";
  const roleARN = `arn:aws:iam::123456789012:role/config-recorder`;

  await client.send(
    new PutConfigurationRecorderCommand({
      ConfigurationRecorder: { name: recorderName, roleARN },
    }),
  );

  const described = await client.send(
    new DescribeConfigurationRecordersCommand({
      ConfigurationRecorderNames: [recorderName],
    }),
  );
  const names = (described.ConfigurationRecorders ?? []).map(
    (recorder) => recorder.name,
  );
  expect(names).toContain(recorderName);

  const statusResult = await client.send(
    new DescribeConfigurationRecorderStatusCommand({
      ConfigurationRecorderNames: [recorderName],
    }),
  );
  const status = (statusResult.ConfigurationRecordersStatus ?? []).find(
    (s) => s.name === recorderName,
  );
  expect(status).toBeDefined();
  expect(status?.recording).toBe(false);

  await client.send(
    new StartConfigurationRecorderCommand({
      ConfigurationRecorderName: recorderName,
    }),
  );

  const afterStart = await client.send(
    new DescribeConfigurationRecorderStatusCommand({
      ConfigurationRecorderNames: [recorderName],
    }),
  );
  const startedStatus = (afterStart.ConfigurationRecordersStatus ?? []).find(
    (s) => s.name === recorderName,
  );
  expect(startedStatus?.recording).toBe(true);

  await client.send(
    new StopConfigurationRecorderCommand({
      ConfigurationRecorderName: recorderName,
    }),
  );

  await client.send(
    new DeleteConfigurationRecorderCommand({
      ConfigurationRecorderName: recorderName,
    }),
  );

  const afterDelete = await client.send(
    new DescribeConfigurationRecordersCommand({}),
  );
  const remaining = (afterDelete.ConfigurationRecorders ?? []).map(
    (recorder) => recorder.name,
  );
  expect(remaining).not.toContain(recorderName);
});

test("configuration aggregator lifecycle", async () => {
  const client = config();
  const aggregatorName = "bunsai-e2e-aggregator";

  await client.send(
    new PutConfigurationAggregatorCommand({
      ConfigurationAggregatorName: aggregatorName,
      AccountAggregationSources: [
        { AccountIds: ["123456789012"], AllAwsRegions: true },
      ],
    }),
  );

  const described = await client.send(
    new DescribeConfigurationAggregatorsCommand({
      ConfigurationAggregatorNames: [aggregatorName],
    }),
  );
  const names = (described.ConfigurationAggregators ?? []).map(
    (a) => a.ConfigurationAggregatorName,
  );
  expect(names).toContain(aggregatorName);

  const sourcesStatus = await client.send(
    new DescribeConfigurationAggregatorSourcesStatusCommand({
      ConfigurationAggregatorName: aggregatorName,
    }),
  );
  expect(sourcesStatus.AggregatedSourceStatusList).toBeDefined();

  await client.send(
    new DeleteConfigurationAggregatorCommand({
      ConfigurationAggregatorName: aggregatorName,
    }),
  );

  const afterDelete = await client.send(
    new DescribeConfigurationAggregatorsCommand({}),
  );
  const remaining = (afterDelete.ConfigurationAggregators ?? []).map(
    (a) => a.ConfigurationAggregatorName,
  );
  expect(remaining).not.toContain(aggregatorName);
});

test("conformance pack lifecycle", async () => {
  const client = config();
  const packName = "bunsai-e2e-conformance-pack";

  const putResult = await client.send(
    new PutConformancePackCommand({
      ConformancePackName: packName,
      TemplateBody: "{}",
      DeliveryS3Bucket: "my-bucket",
    }),
  );
  expect(putResult.ConformancePackArn).toContain(packName);

  const described = await client.send(
    new DescribeConformancePacksCommand({
      ConformancePackNames: [packName],
    }),
  );
  expect(
    (described.ConformancePackDetails ?? []).map((p) => p.ConformancePackName),
  ).toContain(packName);

  const statusResult = await client.send(
    new DescribeConformancePackStatusCommand({
      ConformancePackNames: [packName],
    }),
  );
  const packStatus = (statusResult.ConformancePackStatusDetails ?? []).find(
    (s) => s.ConformancePackName === packName,
  );
  expect(packStatus?.ConformancePackState).toBe("CREATE_COMPLETE");

  await client.send(
    new DeleteConformancePackCommand({ ConformancePackName: packName }),
  );
});

test("delivery channel lifecycle", async () => {
  const client = config();
  const channelName = "bunsai-e2e-channel";

  await client.send(
    new PutDeliveryChannelCommand({
      DeliveryChannel: { name: channelName, s3BucketName: "my-bucket" },
    }),
  );

  const described = await client.send(
    new DescribeDeliveryChannelsCommand({
      DeliveryChannelNames: [channelName],
    }),
  );
  expect((described.DeliveryChannels ?? []).map((c) => c.name)).toContain(
    channelName,
  );

  const statusResult = await client.send(
    new DescribeDeliveryChannelStatusCommand({
      DeliveryChannelNames: [channelName],
    }),
  );
  expect(
    (statusResult.DeliveryChannelsStatus ?? []).map((s) => s.name),
  ).toContain(channelName);

  const snapshotResult = await client.send(
    new DeliverConfigSnapshotCommand({ deliveryChannelName: channelName }),
  );
  expect(snapshotResult.configSnapshotId).toBeDefined();

  await client.send(
    new DeleteDeliveryChannelCommand({ DeliveryChannelName: channelName }),
  );
});

test("retention configuration lifecycle", async () => {
  const client = config();

  const putResult = await client.send(
    new PutRetentionConfigurationCommand({ RetentionPeriodInDays: 30 }),
  );
  expect(putResult.RetentionConfiguration?.RetentionPeriodInDays).toBe(30);

  const described = await client.send(
    new DescribeRetentionConfigurationsCommand({}),
  );
  const configs = described.RetentionConfigurations ?? [];
  expect(configs.length).toBeGreaterThan(0);
  expect(configs[0]?.RetentionPeriodInDays).toBe(30);

  await client.send(
    new DeleteRetentionConfigurationCommand({
      RetentionConfigurationName: "default",
    }),
  );

  const afterDelete = await client.send(
    new DescribeRetentionConfigurationsCommand({}),
  );
  expect((afterDelete.RetentionConfigurations ?? []).length).toBe(0);
});

test("stored query lifecycle", async () => {
  const client = config();
  const queryName = "bunsai-e2e-query";

  const putResult = await client.send(
    new PutStoredQueryCommand({
      StoredQuery: {
        QueryName: queryName,
        Expression:
          "SELECT resourceId WHERE resourceType = 'AWS::EC2::Instance'",
      },
    }),
  );
  expect(putResult.QueryArn).toContain(queryName);

  const getResult = await client.send(
    new GetStoredQueryCommand({ QueryName: queryName }),
  );
  expect(getResult.StoredQuery?.QueryName).toBe(queryName);

  const listResult = await client.send(new ListStoredQueriesCommand({}));
  const queryNames = (listResult.StoredQueryMetadata ?? []).map(
    (q) => q.QueryName,
  );
  expect(queryNames).toContain(queryName);

  await client.send(new DeleteStoredQueryCommand({ QueryName: queryName }));

  const afterDelete = await client.send(new ListStoredQueriesCommand({}));
  const remaining = (afterDelete.StoredQueryMetadata ?? []).map(
    (q) => q.QueryName,
  );
  expect(remaining).not.toContain(queryName);
});

test("aggregation authorization lifecycle", async () => {
  const client = config();
  const authAccountId = "111111111111";
  const authRegion = "eu-west-1";

  const putResult = await client.send(
    new PutAggregationAuthorizationCommand({
      AuthorizedAccountId: authAccountId,
      AuthorizedAwsRegion: authRegion,
    }),
  );
  expect(putResult.AggregationAuthorization?.AuthorizedAccountId).toBe(
    authAccountId,
  );

  const described = await client.send(
    new DescribeAggregationAuthorizationsCommand({}),
  );
  const found = (described.AggregationAuthorizations ?? []).find(
    (a) =>
      a.AuthorizedAccountId === authAccountId &&
      a.AuthorizedAwsRegion === authRegion,
  );
  expect(found).toBeDefined();

  await client.send(
    new DeleteAggregationAuthorizationCommand({
      AuthorizedAccountId: authAccountId,
      AuthorizedAwsRegion: authRegion,
    }),
  );
});

test("remediation configuration lifecycle", async () => {
  const client = config();
  const ruleName = "bunsai-e2e-remediation-rule";

  await client.send(
    new PutConfigRuleCommand({
      ConfigRule: {
        ConfigRuleName: ruleName,
        Source: { Owner: "AWS", SourceIdentifier: "REQUIRED_TAGS" },
      },
    }),
  );

  await client.send(
    new PutRemediationConfigurationsCommand({
      RemediationConfigurations: [
        {
          ConfigRuleName: ruleName,
          TargetType: "SSM_DOCUMENT",
          TargetId: "AWS-EnableS3BucketEncryption",
        },
      ],
    }),
  );

  const described = await client.send(
    new DescribeRemediationConfigurationsCommand({
      ConfigRuleNames: [ruleName],
    }),
  );
  const configs = described.RemediationConfigurations ?? [];
  expect(configs.length).toBeGreaterThan(0);
  expect(configs[0]?.ConfigRuleName).toBe(ruleName);

  await client.send(
    new DeleteRemediationConfigurationCommand({ ConfigRuleName: ruleName }),
  );

  await client.send(new DeleteConfigRuleCommand({ ConfigRuleName: ruleName }));
});

test("organization config rule lifecycle", async () => {
  const client = config();
  const orgRuleName = "bunsai-e2e-org-rule";

  const putResult = await client.send(
    new PutOrganizationConfigRuleCommand({
      OrganizationConfigRuleName: orgRuleName,
      OrganizationManagedRuleMetadata: {
        RuleIdentifier: "REQUIRED_TAGS",
      },
    }),
  );
  expect(putResult.OrganizationConfigRuleArn).toContain(orgRuleName);

  const described = await client.send(
    new DescribeOrganizationConfigRulesCommand({
      OrganizationConfigRuleNames: [orgRuleName],
    }),
  );
  expect(
    (described.OrganizationConfigRules ?? []).map(
      (r) => r.OrganizationConfigRuleName,
    ),
  ).toContain(orgRuleName);

  const statuses = await client.send(
    new DescribeOrganizationConfigRuleStatusesCommand({
      OrganizationConfigRuleNames: [orgRuleName],
    }),
  );
  const ruleStatus = (statuses.OrganizationConfigRuleStatuses ?? []).find(
    (s) => s.OrganizationConfigRuleName === orgRuleName,
  );
  expect(ruleStatus?.OrganizationRuleStatus).toBe("CREATE_SUCCESSFUL");

  await client.send(
    new DeleteOrganizationConfigRuleCommand({
      OrganizationConfigRuleName: orgRuleName,
    }),
  );
});

test("organization conformance pack lifecycle", async () => {
  const client = config();
  const packName = "bunsai-e2e-org-pack";

  const putResult = await client.send(
    new PutOrganizationConformancePackCommand({
      OrganizationConformancePackName: packName,
      TemplateBody: "{}",
      DeliveryS3Bucket: "my-bucket",
    }),
  );
  expect(putResult.OrganizationConformancePackArn).toContain(packName);

  const described = await client.send(
    new DescribeOrganizationConformancePacksCommand({
      OrganizationConformancePackNames: [packName],
    }),
  );
  expect(
    (described.OrganizationConformancePacks ?? []).map(
      (p) => p.OrganizationConformancePackName,
    ),
  ).toContain(packName);

  const statuses = await client.send(
    new DescribeOrganizationConformancePackStatusesCommand({
      OrganizationConformancePackNames: [packName],
    }),
  );
  const packStatus = (statuses.OrganizationConformancePackStatuses ?? []).find(
    (s) => s.OrganizationConformancePackName === packName,
  );
  expect(packStatus?.Status).toBe("CREATE_SUCCESSFUL");

  await client.send(
    new DeleteOrganizationConformancePackCommand({
      OrganizationConformancePackName: packName,
    }),
  );
});

test("compliance query returns shaped data", async () => {
  const client = config();
  const ruleName = "bunsai-e2e-compliance-rule";

  await client.send(
    new PutConfigRuleCommand({
      ConfigRule: {
        ConfigRuleName: ruleName,
        Source: { Owner: "AWS", SourceIdentifier: "REQUIRED_TAGS" },
      },
    }),
  );

  const compliance = await client.send(
    new DescribeComplianceByConfigRuleCommand({
      ConfigRuleNames: [ruleName],
    }),
  );
  const found = (compliance.ComplianceByConfigRules ?? []).find(
    (c) => c.ConfigRuleName === ruleName,
  );
  expect(found?.Compliance?.ComplianceType).toBe("COMPLIANT");

  const summary = await client.send(
    new GetComplianceSummaryByConfigRuleCommand({}),
  );
  expect(summary.ComplianceSummary).toBeDefined();

  await client.send(new DeleteConfigRuleCommand({ ConfigRuleName: ruleName }));
});

test("tag resource lifecycle", async () => {
  const client = config();
  const ruleName = "bunsai-e2e-tag-rule";

  await client.send(
    new PutConfigRuleCommand({
      ConfigRule: {
        ConfigRuleName: ruleName,
        Source: { Owner: "AWS", SourceIdentifier: "REQUIRED_TAGS" },
      },
    }),
  );

  const described = await client.send(
    new DescribeConfigRulesCommand({ ConfigRuleNames: [ruleName] }),
  );
  const ruleArn = described.ConfigRules?.[0]?.ConfigRuleArn ?? "";
  expect(ruleArn).not.toBe("");

  await client.send(
    new TagResourceCommand({
      ResourceArn: ruleArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: ruleArn }),
  );
  const tagMap = Object.fromEntries(
    (tags.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");

  await client.send(
    new UntagResourceCommand({ ResourceArn: ruleArn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: ruleArn }),
  );
  expect(afterUntag.Tags?.find((t) => t.Key === "env")).toBeUndefined();

  await client.send(new DeleteConfigRuleCommand({ ConfigRuleName: ruleName }));
});
