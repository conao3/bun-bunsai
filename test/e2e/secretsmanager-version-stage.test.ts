import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

test("VersionStage AWSPREVIOUS after PutSecretValue", async () => {
  const client = sm();
  const name = "vs-test-put";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value-v1" }),
  );
  expect(created.VersionId).toBeDefined();

  const put = await client.send(
    new PutSecretValueCommand({ SecretId: name, SecretString: "value-v2" }),
  );
  expect(put.VersionId).not.toBe(created.VersionId);
  expect(put.VersionStages).toContain("AWSCURRENT");

  const current = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(current.SecretString).toBe("value-v2");
  expect(current.VersionStages).toContain("AWSCURRENT");

  const currentByStage = await client.send(
    new GetSecretValueCommand({ SecretId: name, VersionStage: "AWSCURRENT" }),
  );
  expect(currentByStage.SecretString).toBe("value-v2");

  const previous = await client.send(
    new GetSecretValueCommand({ SecretId: name, VersionStage: "AWSPREVIOUS" }),
  );
  expect(previous.SecretString).toBe("value-v1");
  expect(previous.VersionStages).toContain("AWSPREVIOUS");

  const byVersionId = await client.send(
    new GetSecretValueCommand({
      SecretId: name,
      VersionId: created.VersionId,
    }),
  );
  expect(byVersionId.SecretString).toBe("value-v1");
});

test("VersionStage AWSPREVIOUS after UpdateSecret", async () => {
  const client = sm();
  const name = "vs-test-update";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value-u1" }),
  );
  expect(created.VersionId).toBeDefined();

  await client.send(
    new UpdateSecretCommand({ SecretId: name, SecretString: "value-u2" }),
  );

  const current = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(current.SecretString).toBe("value-u2");

  const previous = await client.send(
    new GetSecretValueCommand({ SecretId: name, VersionStage: "AWSPREVIOUS" }),
  );
  expect(previous.SecretString).toBe("value-u1");
  expect(previous.VersionStages).toContain("AWSPREVIOUS");
});
