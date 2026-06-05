import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssumeRoleCommand,
  GetFederationTokenCommand,
  GetSessionTokenCommand,
  STSClient,
} from "@aws-sdk/client-sts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sts = () =>
  new STSClient({ endpoint, region, credentials, requestHandler });

test("STS AssumeRole returns Credentials and AssumedRoleUser", async () => {
  const client = sts();
  const out = await client.send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::000000000000:role/bunsai-e2e",
      RoleSessionName: "bunsai-e2e-session",
    }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(out.AssumedRoleUser?.Arn).toContain(
    "assumed-role/bunsai-e2e/bunsai-e2e-session",
  );
  expect(out.AssumedRoleUser?.AssumedRoleId).toContain("bunsai-e2e-session");
});

test("STS GetSessionToken returns Credentials", async () => {
  const client = sts();
  const out = await client.send(
    new GetSessionTokenCommand({ DurationSeconds: 3600 }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
});

test("STS GetFederationToken returns Credentials and FederatedUser", async () => {
  const client = sts();
  const out = await client.send(
    new GetFederationTokenCommand({ Name: "bunsai-e2e-user" }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.FederatedUser?.Arn).toContain("federated-user/bunsai-e2e-user");
  expect(out.FederatedUser?.FederatedUserId).toContain("bunsai-e2e-user");
});
