import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateApiDestinationCommand,
  CreateConnectionCommand,
  CreateEventBusCommand,
  DeleteEventBusCommand,
  DeleteRuleCommand,
  EventBridgeClient,
  ListTagsForResourceCommand,
  PutRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eb = () =>
  new EventBridgeClient({ endpoint, region, credentials, requestHandler });

test("HIGH-1: PutRule with Tags stores tags atomically", async () => {
  const client = eb();
  const ruleName = "con-2012-rule-with-tags";
  const busName = "default";

  const result = await client.send(
    new PutRuleCommand({
      Name: ruleName,
      EventBusName: busName,
      EventPattern: JSON.stringify({ source: ["test"] }),
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );
  const ruleArn = result.RuleArn!;
  expect(ruleArn).toBeTruthy();

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: ruleArn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("bunsai");

  await client.send(new DeleteRuleCommand({ Name: ruleName, EventBusName: busName }));
});

test("HIGH-2: CreateEventBus with Tags stores tags atomically", async () => {
  const client = eb();
  const busName = "con-2012-bus-with-tags";

  const result = await client.send(
    new CreateEventBusCommand({
      Name: busName,
      Tags: [{ Key: "purpose", Value: "e2e" }],
    }),
  );
  const busArn = result.EventBusArn!;
  expect(busArn).toBeTruthy();

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: busArn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["purpose"]).toBe("e2e");

  await client.send(new DeleteEventBusCommand({ Name: busName }));
});

test("HIGH-3: DeleteRule with targets throws ResourceInUseException", async () => {
  const client = eb();
  const ruleName = "con-2012-rule-in-use";
  const busName = "default";

  await client.send(
    new PutRuleCommand({
      Name: ruleName,
      EventBusName: busName,
      EventPattern: JSON.stringify({ source: ["test"] }),
    }),
  );

  await client.send(
    new PutTargetsCommand({
      Rule: ruleName,
      EventBusName: busName,
      Targets: [{ Id: "target1", Arn: `arn:aws:sqs:${region}:000000000000:test-queue` }],
    }),
  );

  await expect(
    client.send(new DeleteRuleCommand({ Name: ruleName, EventBusName: busName })),
  ).rejects.toMatchObject({ name: "ResourceInUseException" });

  await client.send(
    new RemoveTargetsCommand({
      Rule: ruleName,
      EventBusName: busName,
      Ids: ["target1"],
    }),
  );
  await client.send(new DeleteRuleCommand({ Name: ruleName, EventBusName: busName }));
});

test("HIGH-4: DeleteEventBus with rules throws ResourceInUseException", async () => {
  const client = eb();
  const busName = "con-2012-bus-in-use";

  await client.send(new CreateEventBusCommand({ Name: busName }));

  await client.send(
    new PutRuleCommand({
      Name: "con-2012-bus-rule",
      EventBusName: busName,
      EventPattern: JSON.stringify({ source: ["test"] }),
    }),
  );

  await expect(
    client.send(new DeleteEventBusCommand({ Name: busName })),
  ).rejects.toMatchObject({ name: "ResourceInUseException" });

  await client.send(
    new DeleteRuleCommand({ Name: "con-2012-bus-rule", EventBusName: busName }),
  );
  await client.send(new DeleteEventBusCommand({ Name: busName }));
});

test("HIGH-5: CreateApiDestination with non-existent ConnectionArn throws ResourceNotFoundException", async () => {
  const client = eb();

  await expect(
    client.send(
      new CreateApiDestinationCommand({
        Name: "con-2012-apidest-bad-conn",
        ConnectionArn: `arn:aws:events:${region}:000000000000:connection/non-existent-conn`,
        InvocationEndpoint: "https://example.com/api",
        HttpMethod: "POST",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("HIGH-5: CreateApiDestination with valid ConnectionArn succeeds", async () => {
  const client = eb();
  const connName = "con-2012-conn-for-dest";
  const destName = "con-2012-apidest-valid";

  const conn = await client.send(
    new CreateConnectionCommand({
      Name: connName,
      AuthorizationType: "API_KEY",
      AuthParameters: {
        ApiKeyAuthParameters: { ApiKeyName: "x-api-key", ApiKeyValue: "secret" },
      },
    }),
  );
  const connArn = conn.ConnectionArn!;

  const dest = await client.send(
    new CreateApiDestinationCommand({
      Name: destName,
      ConnectionArn: connArn,
      InvocationEndpoint: "https://example.com/api",
      HttpMethod: "POST",
    }),
  );
  expect(dest.ApiDestinationArn).toBeTruthy();
  expect(dest.ApiDestinationState).toBe("ACTIVE");
});
