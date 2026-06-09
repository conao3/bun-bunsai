import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsCommand,
  CancelQueryCommand,
  CloudTrailClient,
  CreateChannelCommand,
  CreateDashboardCommand,
  CreateEventDataStoreCommand,
  CreateTrailCommand,
  DeleteChannelCommand,
  DeleteDashboardCommand,
  DeleteEventDataStoreCommand,
  DeleteResourcePolicyCommand,
  DeleteTrailCommand,
  DeregisterOrganizationDelegatedAdminCommand,
  DescribeQueryCommand,
  DisableFederationCommand,
  EnableFederationCommand,
  GetChannelCommand,
  GetDashboardCommand,
  GetEventConfigurationCommand,
  GetEventDataStoreCommand,
  GetEventSelectorsCommand,
  GenerateQueryCommand,
  GetImportCommand,
  GetInsightSelectorsCommand,
  GetQueryResultsCommand,
  GetTrailStatusCommand,
  GetResourcePolicyCommand,
  ListChannelsCommand,
  ListDashboardsCommand,
  ListEventDataStoresCommand,
  ListImportFailuresCommand,
  ListImportsCommand,
  ListInsightsMetricDataCommand,
  ListPublicKeysCommand,
  ListQueriesCommand,
  ListTagsCommand,
  LookupEventsCommand,
  PutEventConfigurationCommand,
  PutEventSelectorsCommand,
  PutInsightSelectorsCommand,
  PutResourcePolicyCommand,
  RegisterOrganizationDelegatedAdminCommand,
  RemoveTagsCommand,
  RestoreEventDataStoreCommand,
  SearchSampleQueriesCommand,
  StartDashboardRefreshCommand,
  StartEventDataStoreIngestionCommand,
  StartImportCommand,
  StartLoggingCommand,
  StartQueryCommand,
  StopEventDataStoreIngestionCommand,
  StopImportCommand,
  StopLoggingCommand,
  UpdateChannelCommand,
  UpdateDashboardCommand,
  UpdateEventDataStoreCommand,
  UpdateTrailCommand,
} from "@aws-sdk/client-cloudtrail";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudtrail = () =>
  new CloudTrailClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("CloudTrail update, event selectors and tags", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail-2";

  const created = await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-bucket-2",
    }),
  );
  const trailArn = created.TrailARN ?? "";
  expect(trailArn).toContain(trailName);

  const updated = await client.send(
    new UpdateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-bucket-updated",
      IsMultiRegionTrail: true,
      EnableLogFileValidation: true,
    }),
  );
  expect(updated.S3BucketName).toBe("bunsai-e2e-bucket-updated");
  expect(updated.IsMultiRegionTrail).toBe(true);
  expect(updated.LogFileValidationEnabled).toBe(true);
  expect(updated.TrailARN).toBe(trailArn);

  const put = await client.send(
    new PutEventSelectorsCommand({
      TrailName: trailName,
      EventSelectors: [
        {
          ReadWriteType: "All",
          IncludeManagementEvents: true,
        },
      ],
    }),
  );
  expect(put.TrailARN).toBe(trailArn);
  expect(put.EventSelectors?.[0]?.ReadWriteType).toBe("All");

  const gotSelectors = await client.send(
    new GetEventSelectorsCommand({ TrailName: trailName }),
  );
  expect(gotSelectors.TrailARN).toBe(trailArn);
  expect(gotSelectors.EventSelectors?.[0]?.IncludeManagementEvents).toBe(true);

  await client.send(
    new AddTagsCommand({
      ResourceId: trailArn,
      TagsList: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsCommand({ ResourceIdList: [trailArn] }),
  );
  const tagList = listed.ResourceTagList?.[0]?.TagsList ?? [];
  expect(tagList.map((tag) => tag.Key).sort()).toEqual(["env", "team"]);

  await client.send(
    new RemoveTagsCommand({
      ResourceId: trailArn,
      TagsList: [{ Key: "env" }],
    }),
  );

  const afterRemove = await client.send(
    new ListTagsCommand({ ResourceIdList: [trailArn] }),
  );
  const remaining = afterRemove.ResourceTagList?.[0]?.TagsList ?? [];
  expect(remaining.map((tag) => tag.Key)).toEqual(["team"]);

  await client.send(new DeleteTrailCommand({ Name: trailName }));
});

test("CloudTrail EventDataStore lifecycle", async () => {
  const client = cloudtrail();
  const edsName = "bunsai-e2e-eds";

  const created = await client.send(
    new CreateEventDataStoreCommand({
      Name: edsName,
      MultiRegionEnabled: true,
      TerminationProtectionEnabled: false,
    }),
  );
  expect(created.Name).toBe(edsName);
  expect(created.EventDataStoreArn).toContain("eventdatastore");
  const edsArn = created.EventDataStoreArn ?? "";

  const got = await client.send(
    new GetEventDataStoreCommand({ EventDataStore: edsArn }),
  );
  expect(got.Name).toBe(edsName);
  expect(got.MultiRegionEnabled).toBe(true);

  const listed = await client.send(new ListEventDataStoresCommand({}));
  expect((listed.EventDataStores ?? []).map((eds) => eds.Name)).toContain(
    edsName,
  );

  const updated = await client.send(
    new UpdateEventDataStoreCommand({
      EventDataStore: edsArn,
      Name: edsName + "-updated",
      RetentionPeriod: 90,
    }),
  );
  expect(updated.Name).toBe(edsName + "-updated");
  expect(updated.RetentionPeriod).toBe(90);

  await client.send(
    new StartEventDataStoreIngestionCommand({ EventDataStore: edsArn }),
  );
  await client.send(
    new StopEventDataStoreIngestionCommand({ EventDataStore: edsArn }),
  );
  const stoppedEds = await client.send(
    new GetEventDataStoreCommand({ EventDataStore: edsArn }),
  );
  expect(stoppedEds.Status).toBe("STOPPED_INGESTION");

  const enabledFed = await client.send(
    new EnableFederationCommand({
      EventDataStore: edsArn,
      FederationRoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  expect(enabledFed.FederationStatus).toBe("ENABLED");

  const disabledFed = await client.send(
    new DisableFederationCommand({ EventDataStore: edsArn }),
  );
  expect(disabledFed.FederationStatus).toBe("DISABLED");

  const restored = await client.send(
    new RestoreEventDataStoreCommand({ EventDataStore: edsArn }),
  );
  expect(restored.Status).toBe("ENABLED");

  await client.send(
    new DeleteEventDataStoreCommand({ EventDataStore: edsArn }),
  );
  const afterDelete = await client.send(
    new GetEventDataStoreCommand({ EventDataStore: edsArn }),
  );
  expect(afterDelete.Status).toBe("PENDING_DELETION");
});

test("CloudTrail Channel lifecycle", async () => {
  const client = cloudtrail();

  const created = await client.send(
    new CreateChannelCommand({
      Name: "bunsai-e2e-channel",
      Source: "Custom",
      Destinations: [
        {
          Type: "EVENT_DATA_STORE",
          Location:
            "arn:aws:cloudtrail:us-east-1:123456789012:eventdatastore/test",
        },
      ],
    }),
  );
  expect(created.Name).toBe("bunsai-e2e-channel");
  const channelArn = created.ChannelArn ?? "";
  expect(channelArn).toContain("channel");

  const got = await client.send(new GetChannelCommand({ Channel: channelArn }));
  expect(got.Name).toBe("bunsai-e2e-channel");
  expect(got.Source).toBe("Custom");

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Channels ?? []).map((ch) => ch.ChannelArn)).toContain(
    channelArn,
  );

  const updated = await client.send(
    new UpdateChannelCommand({
      Channel: channelArn,
      Name: "bunsai-e2e-channel-updated",
    }),
  );
  expect(updated.Name).toBe("bunsai-e2e-channel-updated");

  await client.send(new DeleteChannelCommand({ Channel: channelArn }));
  const afterDelete = await client.send(new ListChannelsCommand({}));
  expect((afterDelete.Channels ?? []).map((ch) => ch.ChannelArn)).not.toContain(
    channelArn,
  );
});

test("CloudTrail Dashboard lifecycle", async () => {
  const client = cloudtrail();

  const created = await client.send(
    new CreateDashboardCommand({
      Name: "bunsai-e2e-dashboard",
      TerminationProtectionEnabled: false,
    }),
  );
  expect(created.Name).toBe("bunsai-e2e-dashboard");
  const dashboardArn = created.DashboardArn ?? "";

  const got = await client.send(
    new GetDashboardCommand({ DashboardId: dashboardArn }),
  );
  expect(got.DashboardArn).toBe(dashboardArn);

  const listed = await client.send(new ListDashboardsCommand({}));
  expect((listed.Dashboards ?? []).map((d) => d.DashboardArn)).toContain(
    dashboardArn,
  );

  const updated = await client.send(
    new UpdateDashboardCommand({
      DashboardId: dashboardArn,
      TerminationProtectionEnabled: false,
    }),
  );
  expect(updated.DashboardArn).toBe(dashboardArn);

  const refreshed = await client.send(
    new StartDashboardRefreshCommand({ DashboardId: dashboardArn }),
  );
  expect(refreshed.RefreshId).toBeDefined();

  await client.send(new DeleteDashboardCommand({ DashboardId: dashboardArn }));
  const afterDelete = await client.send(new ListDashboardsCommand({}));
  expect(
    (afterDelete.Dashboards ?? []).map((d) => d.DashboardArn),
  ).not.toContain(dashboardArn);
});

test("CloudTrail Query lifecycle", async () => {
  const client = cloudtrail();
  const edsName = "bunsai-e2e-eds-query";

  const eds = await client.send(
    new CreateEventDataStoreCommand({
      Name: edsName,
      TerminationProtectionEnabled: false,
    }),
  );
  const edsArn = eds.EventDataStoreArn ?? "";

  const started = await client.send(
    new StartQueryCommand({ QueryStatement: "SELECT * FROM events LIMIT 10" }),
  );
  expect(started.QueryId).toBeDefined();
  const queryId = started.QueryId ?? "";

  const described = await client.send(
    new DescribeQueryCommand({ QueryId: queryId }),
  );
  expect(described.QueryId).toBe(queryId);

  const results = await client.send(
    new GetQueryResultsCommand({ QueryId: queryId }),
  );
  expect(results.QueryStatus).toBe("FINISHED");
  expect(results.QueryResultRows).toEqual([]);

  const queries = await client.send(
    new ListQueriesCommand({ EventDataStore: edsArn }),
  );
  expect((queries.Queries ?? []).map((q) => q.QueryId)).toContain(queryId);

  const generated = await client.send(
    new GenerateQueryCommand({
      EventDataStores: [edsArn],
      Prompt: "Show me all login events",
    }),
  );
  expect(generated.QueryStatement).toContain("SELECT");

  const searchResults = await client.send(
    new SearchSampleQueriesCommand({ SearchPhrase: "login" }),
  );
  expect(searchResults.SearchResults).toEqual([]);

  const cancelQueryId =
    (
      await client.send(
        new StartQueryCommand({ QueryStatement: "SELECT * FROM events" }),
      )
    ).QueryId ?? "";
  const cancelled = await client.send(
    new CancelQueryCommand({ QueryId: cancelQueryId }),
  );
  expect(cancelled.QueryStatus).toBe("CANCELLED");

  await client.send(
    new DeleteEventDataStoreCommand({ EventDataStore: edsArn }),
  );
});

test("CloudTrail Import lifecycle", async () => {
  const client = cloudtrail();
  const edsName = "bunsai-e2e-eds-import";

  const eds = await client.send(
    new CreateEventDataStoreCommand({
      Name: edsName,
      TerminationProtectionEnabled: false,
    }),
  );
  const edsArn = eds.EventDataStoreArn ?? "";

  const started = await client.send(
    new StartImportCommand({
      Destinations: [edsArn],
      ImportSource: {
        S3: {
          S3LocationUri: "s3://bunsai-test-bucket/",
          S3BucketRegion: "us-east-1",
          S3BucketAccessRoleArn: "arn:aws:iam::123456789012:role/test-role",
        },
      },
    }),
  );
  expect(started.ImportId).toBeDefined();
  const importId = started.ImportId ?? "";

  const got = await client.send(new GetImportCommand({ ImportId: importId }));
  expect(got.ImportId).toBe(importId);
  expect(got.ImportStatus).toBe("IN_PROGRESS");

  const listed = await client.send(new ListImportsCommand({}));
  expect((listed.Imports ?? []).map((imp) => imp.ImportId)).toContain(importId);

  const failures = await client.send(
    new ListImportFailuresCommand({ ImportId: importId }),
  );
  expect(failures.Failures).toEqual([]);

  const stopped = await client.send(
    new StopImportCommand({ ImportId: importId }),
  );
  expect(stopped.ImportStatus).toBe("STOPPED");

  await client.send(
    new DeleteEventDataStoreCommand({ EventDataStore: edsArn }),
  );
});

test("CloudTrail InsightSelectors", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail-insights";

  await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-insights-bucket",
    }),
  );

  await client.send(
    new PutInsightSelectorsCommand({
      TrailName: trailName,
      InsightSelectors: [{ InsightType: "ApiCallRateInsight" }],
    }),
  );

  const got = await client.send(
    new GetInsightSelectorsCommand({ TrailName: trailName }),
  );
  expect(got.InsightSelectors?.[0]?.InsightType).toBe("ApiCallRateInsight");

  await client.send(new DeleteTrailCommand({ Name: trailName }));
});

test("CloudTrail ResourcePolicy CRUD", async () => {
  const client = cloudtrail();
  const edsName = "bunsai-e2e-eds-policy";

  const eds = await client.send(
    new CreateEventDataStoreCommand({
      Name: edsName,
      TerminationProtectionEnabled: false,
    }),
  );
  const edsArn = eds.EventDataStoreArn ?? "";

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: "cloudtrail:*",
        Resource: edsArn,
      },
    ],
  });

  const put = await client.send(
    new PutResourcePolicyCommand({
      ResourceArn: edsArn,
      ResourcePolicy: policy,
    }),
  );
  expect(put.ResourceArn).toBe(edsArn);
  expect(put.ResourcePolicy).toBe(policy);

  const got = await client.send(
    new GetResourcePolicyCommand({ ResourceArn: edsArn }),
  );
  expect(got.ResourcePolicy).toBe(policy);

  await client.send(new DeleteResourcePolicyCommand({ ResourceArn: edsArn }));
  const afterDelete = await client.send(
    new GetResourcePolicyCommand({ ResourceArn: edsArn }),
  );
  expect(afterDelete.ResourcePolicy).toBeUndefined();

  await client.send(
    new DeleteEventDataStoreCommand({ EventDataStore: edsArn }),
  );
});

test("CloudTrail EventConfiguration", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail-evtconfig";

  await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-evtconfig-bucket",
    }),
  );

  const put = await client.send(
    new PutEventConfigurationCommand({
      TrailName: trailName,
      MaxEventSize: "Standard",
    }),
  );
  expect(put.MaxEventSize).toBe("Standard");

  const got = await client.send(
    new GetEventConfigurationCommand({ TrailName: trailName }),
  );
  expect(got.MaxEventSize).toBe("Standard");

  await client.send(new DeleteTrailCommand({ Name: trailName }));
});

test("CloudTrail synthetic read-only operations", async () => {
  const client = cloudtrail();

  const publicKeys = await client.send(new ListPublicKeysCommand({}));
  expect(publicKeys.PublicKeyList).toEqual([]);

  const events = await client.send(new LookupEventsCommand({}));
  expect(events.Events).toEqual([]);

  const metricData = await client.send(
    new ListInsightsMetricDataCommand({
      EventSource: "ec2.amazonaws.com",
      EventName: "RunInstances",
      InsightType: "ApiCallRateInsight",
    }),
  );
  expect(metricData.Timestamps).toEqual([]);
  expect(metricData.Values).toEqual([]);

  const searchResults = await client.send(
    new SearchSampleQueriesCommand({ SearchPhrase: "security" }),
  );
  expect(searchResults.SearchResults).toEqual([]);
});

test("CloudTrail organization delegated admin", async () => {
  const client = cloudtrail();

  await expect(
    client.send(
      new RegisterOrganizationDelegatedAdminCommand({
        MemberAccountId: "123456789012",
      }),
    ),
  ).resolves.toBeDefined();

  await expect(
    client.send(
      new DeregisterOrganizationDelegatedAdminCommand({
        DelegatedAdminAccountId: "123456789012",
      }),
    ),
  ).resolves.toBeDefined();
});

test("CloudTrail query status lifecycle and DescribeQuery validation", async () => {
  const client = cloudtrail();

  const started = await client.send(
    new StartQueryCommand({ QueryStatement: "SELECT * FROM events LIMIT 5" }),
  );
  expect(started.QueryId).toBeDefined();
  const queryId = started.QueryId ?? "";

  const described = await client.send(
    new DescribeQueryCommand({ QueryId: queryId }),
  );
  expect(described.QueryId).toBe(queryId);
  expect(described.QueryStatus).toBe("QUEUED");
  expect(described.QueryStatistics?.ExecutionTimeInMillis).toBe(0);

  const results = await client.send(
    new GetQueryResultsCommand({ QueryId: queryId }),
  );
  expect(results.QueryStatus).toBe("FINISHED");

  const describedAfter = await client.send(
    new DescribeQueryCommand({ QueryId: queryId }),
  );
  expect(describedAfter.QueryStatus).toBe("FINISHED");
  expect(describedAfter.QueryStatistics?.ExecutionTimeInMillis).toBe(100);

  await expect(
    client.send(new DescribeQueryCommand({ QueryId: "nonexistent-query-id" })),
  ).rejects.toThrow();

  await expect(
    client.send(new DescribeQueryCommand({ QueryId: "" })),
  ).rejects.toThrow();
});

test("CloudTrail GetTrailStatus delivery timestamps", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail-status-detail";

  await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-status-bucket",
    }),
  );

  const beforeLogging = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(beforeLogging.IsLogging).toBe(false);
  expect(beforeLogging.LatestDeliveryTime).toBeUndefined();
  expect(beforeLogging.LatestDigestDeliveryTime).toBeUndefined();

  await client.send(new StartLoggingCommand({ Name: trailName }));
  const afterLogging = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(afterLogging.IsLogging).toBe(true);
  expect(afterLogging.LatestDeliveryTime).toBeInstanceOf(Date);
  expect(afterLogging.LatestDigestDeliveryTime).toBeInstanceOf(Date);
  expect(typeof afterLogging.LatestDeliveryAttemptTime).toBe("string");
  expect(afterLogging.LatestDeliveryAttemptSucceeded).toBe("Success");

  await client.send(new StopLoggingCommand({ Name: trailName }));
  await client.send(new DeleteTrailCommand({ Name: trailName }));
});

test("CloudTrail StartImport rejects terminal import restart", async () => {
  const client = cloudtrail();
  const edsName = "bunsai-e2e-eds-import-restart";

  const eds = await client.send(
    new CreateEventDataStoreCommand({
      Name: edsName,
      TerminationProtectionEnabled: false,
    }),
  );
  const edsArn = eds.EventDataStoreArn ?? "";

  const started = await client.send(
    new StartImportCommand({
      Destinations: [edsArn],
      ImportSource: {
        S3: {
          S3LocationUri: "s3://bunsai-restart-bucket/",
          S3BucketRegion: "us-east-1",
          S3BucketAccessRoleArn: "arn:aws:iam::123456789012:role/test-role",
        },
      },
    }),
  );
  const importId = started.ImportId ?? "";

  await client.send(new StopImportCommand({ ImportId: importId }));

  await expect(
    client.send(new StartImportCommand({ ImportId: importId })),
  ).rejects.toThrow();

  await client.send(
    new DeleteEventDataStoreCommand({ EventDataStore: edsArn }),
  );
});
