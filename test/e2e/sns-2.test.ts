import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreatePlatformApplicationCommand,
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  GetEndpointAttributesCommand,
  ListEndpointsByPlatformApplicationCommand,
  SetEndpointAttributesCommand,
  SNSClient,
} from "@aws-sdk/client-sns";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () => new SNSClient({ endpoint, region, credentials });

test("SNS platform endpoint lifecycle", async () => {
  const client = sns();

  const app = await client.send(
    new CreatePlatformApplicationCommand({
      Name: "bunsai-e2e-app",
      Platform: "GCM",
      Attributes: { PlatformCredential: "secret" },
    }),
  );
  const platformApplicationArn = app.PlatformApplicationArn;
  expect(platformApplicationArn).toBeDefined();

  const created = await client.send(
    new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformApplicationArn,
      Token: "device-token-1",
      CustomUserData: "user-1",
    }),
  );
  const endpointArn = created.EndpointArn;
  expect(endpointArn).toBeDefined();

  const idempotent = await client.send(
    new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformApplicationArn,
      Token: "device-token-1",
    }),
  );
  expect(idempotent.EndpointArn).toBe(endpointArn);

  const initial = await client.send(
    new GetEndpointAttributesCommand({ EndpointArn: endpointArn }),
  );
  expect(initial.Attributes?.Token).toBe("device-token-1");
  expect(initial.Attributes?.Enabled).toBe("true");
  expect(initial.Attributes?.CustomUserData).toBe("user-1");

  await client.send(
    new SetEndpointAttributesCommand({
      EndpointArn: endpointArn,
      Attributes: { Enabled: "false" },
    }),
  );

  const afterSet = await client.send(
    new GetEndpointAttributesCommand({ EndpointArn: endpointArn }),
  );
  expect(afterSet.Attributes?.Enabled).toBe("false");
  expect(afterSet.Attributes?.Token).toBe("device-token-1");

  const listed = await client.send(
    new ListEndpointsByPlatformApplicationCommand({
      PlatformApplicationArn: platformApplicationArn,
    }),
  );
  const arns = (listed.Endpoints ?? []).map((e) => e.EndpointArn);
  expect(arns).toContain(endpointArn);

  await client.send(new DeleteEndpointCommand({ EndpointArn: endpointArn }));

  const afterDelete = await client.send(
    new ListEndpointsByPlatformApplicationCommand({
      PlatformApplicationArn: platformApplicationArn,
    }),
  );
  const remaining = (afterDelete.Endpoints ?? []).map((e) => e.EndpointArn);
  expect(remaining).not.toContain(endpointArn);
});
