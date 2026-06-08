import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreatePlatformApplicationCommand,
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  GetEndpointAttributesCommand,
  GetSMSAttributesCommand,
  ListEndpointsByPlatformApplicationCommand,
  PublishCommand,
  SetSMSAttributesCommand,
  SNSClient,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });

test("SNS platform app → endpoint → publish → delete fidelity bar", async () => {
  const client = sns();

  const app = await client.send(
    new CreatePlatformApplicationCommand({
      Name: "platform-fidelity-app",
      Platform: "GCM",
      Attributes: { PlatformCredential: "gcm-key" },
    }),
  );
  const platformApplicationArn = app.PlatformApplicationArn;
  expect(platformApplicationArn).toBeDefined();
  expect(platformApplicationArn).toContain("app/GCM/platform-fidelity-app");

  const ep = await client.send(
    new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformApplicationArn,
      Token: "device-token-fidelity",
      CustomUserData: "fidelity-user",
    }),
  );
  const endpointArn = ep.EndpointArn;
  expect(endpointArn).toBeDefined();

  const listed = await client.send(
    new ListEndpointsByPlatformApplicationCommand({
      PlatformApplicationArn: platformApplicationArn,
    }),
  );
  const arns = (listed.Endpoints ?? []).map((e) => e.EndpointArn);
  expect(arns).toContain(endpointArn);

  const published = await client.send(
    new PublishCommand({
      TargetArn: endpointArn,
      Message: "push notification message",
    }),
  );
  expect(published.MessageId).toBeDefined();
  expect(typeof published.MessageId).toBe("string");
  expect((published.MessageId ?? "").length).toBeGreaterThan(0);

  await client.send(new DeleteEndpointCommand({ EndpointArn: endpointArn }));

  const afterDelete = await client.send(
    new ListEndpointsByPlatformApplicationCommand({
      PlatformApplicationArn: platformApplicationArn,
    }),
  );
  const remaining = (afterDelete.Endpoints ?? []).map((e) => e.EndpointArn);
  expect(remaining).not.toContain(endpointArn);

  await expect(
    client.send(new GetEndpointAttributesCommand({ EndpointArn: endpointArn })),
  ).rejects.toThrow();
});

test("SNS Publish with PhoneNumber records message", async () => {
  const client = sns();

  const result = await client.send(
    new PublishCommand({
      PhoneNumber: "+15550001234",
      Message: "sms text message",
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
      },
    }),
  );
  expect(result.MessageId).toBeDefined();
  expect(typeof result.MessageId).toBe("string");
  expect((result.MessageId ?? "").length).toBeGreaterThan(0);
});

test("SNS SetSMSAttributes / GetSMSAttributes round-trip", async () => {
  const client = sns();

  await client.send(
    new SetSMSAttributesCommand({
      attributes: {
        DefaultSMSType: "Promotional",
        DefaultSenderID: "PlatformTest",
        MonthlySpendLimit: "10",
      },
    }),
  );

  const result = await client.send(new GetSMSAttributesCommand({}));
  expect(result.attributes?.DefaultSMSType).toBe("Promotional");
  expect(result.attributes?.DefaultSenderID).toBe("PlatformTest");
  expect(result.attributes?.MonthlySpendLimit).toBe("10");
});
