import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ActivateEventSourceCommand,
  CancelReplayCommand,
  CreateApiDestinationCommand,
  CreateArchiveCommand,
  CreateConnectionCommand,
  CreateEndpointCommand,
  CreateEventBusCommand,
  CreatePartnerEventSourceCommand,
  DeactivateEventSourceCommand,
  DeauthorizeConnectionCommand,
  DeleteApiDestinationCommand,
  DeleteArchiveCommand,
  DeleteConnectionCommand,
  DeleteEndpointCommand,
  DeleteEventBusCommand,
  DeletePartnerEventSourceCommand,
  DescribeApiDestinationCommand,
  DescribeArchiveCommand,
  DescribeConnectionCommand,
  DescribeEndpointCommand,
  DescribeEventBusCommand,
  DescribeEventSourceCommand,
  DescribePartnerEventSourceCommand,
  DescribeReplayCommand,
  DescribeRuleCommand,
  DisableRuleCommand,
  EnableRuleCommand,
  EventBridgeClient,
  ListApiDestinationsCommand,
  ListArchivesCommand,
  ListConnectionsCommand,
  ListEndpointsCommand,
  ListEventBusesCommand,
  ListEventSourcesCommand,
  ListPartnerEventSourceAccountsCommand,
  ListPartnerEventSourcesCommand,
  ListReplaysCommand,
  ListRuleNamesByTargetCommand,
  ListTagsForResourceCommand,
  PutEventsCommand,
  PutPartnerEventsCommand,
  PutPermissionCommand,
  PutRuleCommand,
  PutTargetsCommand,
  RemovePermissionCommand,
  StartReplayCommand,
  TagResourceCommand,
  TestEventPatternCommand,
  UntagResourceCommand,
  UpdateApiDestinationCommand,
  UpdateArchiveCommand,
  UpdateConnectionCommand,
  UpdateEndpointCommand,
  UpdateEventBusCommand,
} from "@aws-sdk/client-eventbridge";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eb = () =>
  new EventBridgeClient({ endpoint, region, credentials, requestHandler });

test("EventBridge event bus lifecycle", async () => {
  const client = eb();
  const busName = "bunsai-e2e-bus";

  const created = await client.send(
    new CreateEventBusCommand({
      Name: busName,
      Description: "bunsai e2e bus",
    }),
  );
  expect(created.EventBusArn).toContain(`event-bus/${busName}`);

  const described = await client.send(
    new DescribeEventBusCommand({ Name: busName }),
  );
  expect(described.Name).toBe(busName);
  expect(described.Arn).toContain(`event-bus/${busName}`);
  expect(described.Description).toBe("bunsai e2e bus");

  const listed = await client.send(new ListEventBusesCommand({}));
  expect((listed.EventBuses ?? []).some((bus) => bus.Name === busName)).toBe(
    true,
  );

  const prefixed = await client.send(
    new ListEventBusesCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect((prefixed.EventBuses ?? []).some((bus) => bus.Name === busName)).toBe(
    true,
  );

  await client.send(new DeleteEventBusCommand({ Name: busName }));

  await expect(
    client.send(new DescribeEventBusCommand({ Name: busName })),
  ).rejects.toThrow();
});

test("EventBridge archive lifecycle", async () => {
  const client = eb();
  const archiveName = "bunsai-e2e-archive";
  const eventSourceArn = `arn:aws:events:${region}:000000000000:event-bus/default`;

  const created = await client.send(
    new CreateArchiveCommand({
      ArchiveName: archiveName,
      EventSourceArn: eventSourceArn,
      Description: "bunsai e2e archive",
      RetentionDays: 7,
    }),
  );
  expect(created.ArchiveArn).toContain(`archive/${archiveName}`);
  expect(created.State).toBe("ENABLED");

  const described = await client.send(
    new DescribeArchiveCommand({ ArchiveName: archiveName }),
  );
  expect(described.ArchiveName).toBe(archiveName);
  expect(described.EventSourceArn).toBe(eventSourceArn);
  expect(described.RetentionDays).toBe(7);

  const listed = await client.send(
    new ListArchivesCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect(
    (listed.Archives ?? []).some(
      (archive) => archive.ArchiveName === archiveName,
    ),
  ).toBe(true);

  await client.send(new DeleteArchiveCommand({ ArchiveName: archiveName }));

  await expect(
    client.send(new DescribeArchiveCommand({ ArchiveName: archiveName })),
  ).rejects.toThrow();
});

test("EventBridge rule enable/disable and ListRuleNamesByTarget", async () => {
  const client = eb();
  const ruleName = "bunsai-e2e-rule-toggle";
  const targetArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-toggle-queue`;

  await client.send(
    new PutRuleCommand({
      Name: ruleName,
      ScheduleExpression: "rate(1 minute)",
      State: "ENABLED",
    }),
  );

  await client.send(
    new PutTargetsCommand({
      Rule: ruleName,
      Targets: [{ Id: "t1", Arn: targetArn }],
    }),
  );

  await client.send(new DisableRuleCommand({ Name: ruleName }));
  const disabled = await client.send(
    new DescribeRuleCommand({ Name: ruleName }),
  );
  expect(disabled.State).toBe("DISABLED");

  await client.send(new EnableRuleCommand({ Name: ruleName }));
  const enabled = await client.send(
    new DescribeRuleCommand({ Name: ruleName }),
  );
  expect(enabled.State).toBe("ENABLED");

  const byTarget = await client.send(
    new ListRuleNamesByTargetCommand({ TargetArn: targetArn }),
  );
  expect((byTarget.RuleNames ?? []).includes(ruleName)).toBe(true);
});

test("EventBridge TestEventPattern", async () => {
  const client = eb();

  const matched = await client.send(
    new TestEventPatternCommand({
      EventPattern: JSON.stringify({ source: ["bunsai.test"] }),
      Event: JSON.stringify({
        source: "bunsai.test",
        "detail-type": "Test",
        detail: {},
      }),
    }),
  );
  expect(matched.Result).toBe(true);
});

test("EventBridge connection lifecycle", async () => {
  const client = eb();
  const connName = "bunsai-e2e-conn";

  const created = await client.send(
    new CreateConnectionCommand({
      Name: connName,
      AuthorizationType: "BASIC",
      AuthParameters: {
        BasicAuthParameters: { Username: "user", Password: "pass" },
      },
      Description: "e2e connection",
    }),
  );
  expect(created.ConnectionArn).toContain(`connection/${connName}`);
  expect(created.ConnectionState).toBe("AUTHORIZED");

  const described = await client.send(
    new DescribeConnectionCommand({ Name: connName }),
  );
  expect(described.Name).toBe(connName);
  expect(described.Description).toBe("e2e connection");
  expect(described.AuthorizationType).toBe("BASIC");

  await client.send(
    new UpdateConnectionCommand({
      Name: connName,
      Description: "updated connection",
    }),
  );
  const updated = await client.send(
    new DescribeConnectionCommand({ Name: connName }),
  );
  expect(updated.Description).toBe("updated connection");

  const listed = await client.send(
    new ListConnectionsCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect((listed.Connections ?? []).some((c) => c.Name === connName)).toBe(
    true,
  );

  const deauth = await client.send(
    new DeauthorizeConnectionCommand({ Name: connName }),
  );
  expect(deauth.ConnectionState).toBe("DEAUTHORIZED");

  await client.send(new DeleteConnectionCommand({ Name: connName }));

  await expect(
    client.send(new DescribeConnectionCommand({ Name: connName })),
  ).rejects.toThrow();
});

test("EventBridge API destination lifecycle", async () => {
  const client = eb();
  const connName = "bunsai-e2e-conn-for-dest";
  const destName = "bunsai-e2e-dest";

  const conn = await client.send(
    new CreateConnectionCommand({
      Name: connName,
      AuthorizationType: "BASIC",
      AuthParameters: {
        BasicAuthParameters: { Username: "user", Password: "pass" },
      },
    }),
  );

  const created = await client.send(
    new CreateApiDestinationCommand({
      Name: destName,
      ConnectionArn: conn.ConnectionArn!,
      InvocationEndpoint: "https://example.com/webhook",
      HttpMethod: "POST",
      Description: "e2e destination",
      InvocationRateLimitPerSecond: 10,
    }),
  );
  expect(created.ApiDestinationArn).toContain(`api-destination/${destName}`);
  expect(created.ApiDestinationState).toBe("ACTIVE");

  const described = await client.send(
    new DescribeApiDestinationCommand({ Name: destName }),
  );
  expect(described.Name).toBe(destName);
  expect(described.Description).toBe("e2e destination");
  expect(described.HttpMethod).toBe("POST");
  expect(described.InvocationRateLimitPerSecond).toBe(10);

  await client.send(
    new UpdateApiDestinationCommand({
      Name: destName,
      InvocationRateLimitPerSecond: 20,
    }),
  );
  const updated = await client.send(
    new DescribeApiDestinationCommand({ Name: destName }),
  );
  expect(updated.InvocationRateLimitPerSecond).toBe(20);

  const listed = await client.send(
    new ListApiDestinationsCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect((listed.ApiDestinations ?? []).some((d) => d.Name === destName)).toBe(
    true,
  );

  await client.send(new DeleteApiDestinationCommand({ Name: destName }));
  await client.send(new DeleteConnectionCommand({ Name: connName }));

  await expect(
    client.send(new DescribeApiDestinationCommand({ Name: destName })),
  ).rejects.toThrow();
});

test("EventBridge endpoint lifecycle", async () => {
  const client = eb();
  const epName = "bunsai-e2e-endpoint";
  const busArn = `arn:aws:events:${region}:000000000000:event-bus/default`;
  const bus2Arn = `arn:aws:events:us-west-2:000000000000:event-bus/default`;

  const created = await client.send(
    new CreateEndpointCommand({
      Name: epName,
      RoutingConfig: {
        FailoverConfig: {
          Primary: { HealthCheck: busArn },
          Secondary: { Route: "us-west-2" },
        },
      },
      EventBuses: [{ EventBusArn: busArn }, { EventBusArn: bus2Arn }],
      Description: "e2e endpoint",
    }),
  );
  expect(created.Arn).toContain(`endpoint/${epName}`);
  expect(created.State).toBe("ACTIVE");

  const described = await client.send(
    new DescribeEndpointCommand({ Name: epName }),
  );
  expect(described.Name).toBe(epName);
  expect(described.Description).toBe("e2e endpoint");
  expect(described.EndpointId).toBeDefined();
  expect(described.EndpointUrl).toBeDefined();

  await client.send(
    new UpdateEndpointCommand({
      Name: epName,
      Description: "updated endpoint",
    }),
  );
  const updated = await client.send(
    new DescribeEndpointCommand({ Name: epName }),
  );
  expect(updated.Description).toBe("updated endpoint");

  const listed = await client.send(
    new ListEndpointsCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect((listed.Endpoints ?? []).some((e) => e.Name === epName)).toBe(true);

  await client.send(new DeleteEndpointCommand({ Name: epName }));

  await expect(
    client.send(new DescribeEndpointCommand({ Name: epName })),
  ).rejects.toThrow();
});

test("EventBridge UpdateEventBus", async () => {
  const client = eb();

  const result = await client.send(
    new UpdateEventBusCommand({
      Name: "default",
      Description: "updated default bus",
    }),
  );
  expect(result.Name).toBe("default");
  expect(result.Description).toBe("updated default bus");
});

test("EventBridge PutPermission and RemovePermission", async () => {
  const client = eb();

  await client.send(
    new PutPermissionCommand({
      EventBusName: "default",
      StatementId: "bunsai-e2e-stmt",
      Action: "events:PutEvents",
      Principal: "000000000001",
    }),
  );

  const described = await client.send(
    new DescribeEventBusCommand({ Name: "default" }),
  );
  expect(described.Policy).toContain("bunsai-e2e-stmt");

  await client.send(
    new RemovePermissionCommand({
      EventBusName: "default",
      StatementId: "bunsai-e2e-stmt",
    }),
  );
});

test("EventBridge PutPartnerEvents", async () => {
  const client = eb();

  const result = await client.send(
    new PutPartnerEventsCommand({
      Entries: [
        {
          Source: "aws.partner/bunsai.test/stream",
          DetailType: "TestEvent",
          Detail: JSON.stringify({ value: 1 }),
        },
      ],
    }),
  );
  expect(result.FailedEntryCount).toBe(0);
  expect(result.Entries).toHaveLength(1);
});

test("EventBridge partner event source and event source lifecycle", async () => {
  const client = eb();
  const sourceName = "aws.partner/bunsai.test/bunsai-e2e-stream";
  const account = "000000000000";

  const created = await client.send(
    new CreatePartnerEventSourceCommand({
      Name: sourceName,
      Account: account,
    }),
  );
  expect(created.EventSourceArn).toContain(sourceName);

  const describedPartner = await client.send(
    new DescribePartnerEventSourceCommand({ Name: sourceName }),
  );
  expect(describedPartner.Name).toBe(sourceName);
  expect(describedPartner.Arn).toBeDefined();

  const listedPartner = await client.send(
    new ListPartnerEventSourcesCommand({
      NamePrefix: "aws.partner/bunsai.test",
    }),
  );
  expect(
    (listedPartner.PartnerEventSources ?? []).some(
      (s) => s.Name === sourceName,
    ),
  ).toBe(true);

  const accounts = await client.send(
    new ListPartnerEventSourceAccountsCommand({ EventSourceName: sourceName }),
  );
  expect(
    (accounts.PartnerEventSourceAccounts ?? []).some(
      (a) => a.Account === account,
    ),
  ).toBe(true);

  const describedSrc = await client.send(
    new DescribeEventSourceCommand({ Name: sourceName }),
  );
  expect(describedSrc.Name).toBe(sourceName);
  expect(describedSrc.State).toBe("PENDING");

  await client.send(new ActivateEventSourceCommand({ Name: sourceName }));
  const activated = await client.send(
    new DescribeEventSourceCommand({ Name: sourceName }),
  );
  expect(activated.State).toBe("ACTIVE");

  await client.send(new DeactivateEventSourceCommand({ Name: sourceName }));
  const deactivated = await client.send(
    new DescribeEventSourceCommand({ Name: sourceName }),
  );
  expect(deactivated.State).toBe("PENDING");

  const listedSrc = await client.send(
    new ListEventSourcesCommand({ NamePrefix: "aws.partner/bunsai.test" }),
  );
  expect(
    (listedSrc.EventSources ?? []).some((s) => s.Name === sourceName),
  ).toBe(true);

  await client.send(
    new DeletePartnerEventSourceCommand({
      Name: sourceName,
      Account: account,
    }),
  );
});

test("EventBridge archive update", async () => {
  const client = eb();
  const archiveName = "bunsai-e2e-update-archive";
  const eventSourceArn = `arn:aws:events:${region}:000000000000:event-bus/default`;

  await client.send(
    new CreateArchiveCommand({
      ArchiveName: archiveName,
      EventSourceArn: eventSourceArn,
      RetentionDays: 7,
    }),
  );

  const updateResult = await client.send(
    new UpdateArchiveCommand({
      ArchiveName: archiveName,
      Description: "updated archive",
      RetentionDays: 14,
    }),
  );
  expect(updateResult.ArchiveArn).toContain(`archive/${archiveName}`);

  const described = await client.send(
    new DescribeArchiveCommand({ ArchiveName: archiveName }),
  );
  expect(described.Description).toBe("updated archive");
  expect(described.RetentionDays).toBe(14);

  await client.send(new DeleteArchiveCommand({ ArchiveName: archiveName }));
});

test("EventBridge replay lifecycle", async () => {
  const client = eb();
  const archiveName = "bunsai-e2e-replay-archive";
  const replayName = "bunsai-e2e-replay";
  const eventSourceArn = `arn:aws:events:${region}:000000000000:event-bus/default`;

  await client.send(
    new CreateArchiveCommand({
      ArchiveName: archiveName,
      EventSourceArn: eventSourceArn,
      RetentionDays: 1,
    }),
  );

  const archiveArn = `arn:aws:events:${region}:000000000000:archive/${archiveName}`;

  const started = await client.send(
    new StartReplayCommand({
      ReplayName: replayName,
      Description: "e2e replay",
      EventSourceArn: archiveArn,
      EventStartTime: new Date(Date.now() - 3600000),
      EventEndTime: new Date(),
      Destination: { Arn: eventSourceArn },
    }),
  );
  expect(started.ReplayArn).toContain(`replay/${replayName}`);
  expect(started.State).toBe("STARTING");

  const described = await client.send(
    new DescribeReplayCommand({ ReplayName: replayName }),
  );
  expect(described.ReplayName).toBe(replayName);
  expect(described.Description).toBe("e2e replay");

  const listed = await client.send(
    new ListReplaysCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect((listed.Replays ?? []).some((r) => r.ReplayName === replayName)).toBe(
    true,
  );

  const cancelled = await client.send(
    new CancelReplayCommand({ ReplayName: replayName }),
  );
  expect(cancelled.State).toBe("CANCELLED");

  await client.send(new DeleteArchiveCommand({ ArchiveName: archiveName }));
});

test("EventBridge tags lifecycle", async () => {
  const client = eb();
  const busName = "bunsai-e2e-tags-bus";

  const created = await client.send(
    new CreateEventBusCommand({ Name: busName }),
  );
  const arn = created.EventBusArn!;

  await client.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["owner"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["env"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  const afterKeys = (after.Tags ?? []).map((t) => t.Key);
  expect(afterKeys).not.toContain("env");
  expect(afterKeys).toContain("owner");

  await client.send(new DeleteEventBusCommand({ Name: busName }));
});

test("EventBridge PutEvents", async () => {
  const client = eb();

  const result = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "bunsai.e2e",
          DetailType: "test",
          Detail: JSON.stringify({ value: 42 }),
        },
      ],
    }),
  );
  expect(result.FailedEntryCount).toBe(0);
  expect(result.Entries).toHaveLength(1);
  expect(result.Entries![0].EventId).toBeDefined();
});
