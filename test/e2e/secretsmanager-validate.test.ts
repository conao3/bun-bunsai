import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSecretCommand,
  ListSecretsCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

test("invalid enum value returns ValidationException", async () => {
  const client = sm();
  let caught: unknown;
  try {
    await client.send(
      new ListSecretsCommand({ SortOrder: "invalid" as "asc" }),
    );
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeDefined();
  const err = caught as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  expect(err.$metadata?.httpStatusCode).toBe(400);
  expect(err.name).toBe("ValidationException");
});

test("out-of-range numeric returns ValidationException", async () => {
  const client = sm();
  let caught: unknown;
  try {
    await client.send(new ListSecretsCommand({ MaxResults: 0 }));
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeDefined();
  const err = caught as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  expect(err.$metadata?.httpStatusCode).toBe(400);
  expect(err.name).toBe("ValidationException");
});

test("MaxResults above max returns ValidationException", async () => {
  const client = sm();
  let caught: unknown;
  try {
    await client.send(new ListSecretsCommand({ MaxResults: 101 }));
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeDefined();
  const err = caught as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  expect(err.$metadata?.httpStatusCode).toBe(400);
  expect(err.name).toBe("ValidationException");
});

test("valid enum and range values pass", async () => {
  const client = sm();
  const name = "bunsai-validate-e2e-secret";
  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );
  const result = await client.send(
    new ListSecretsCommand({ SortOrder: "asc", MaxResults: 10 }),
  );
  expect(result.SecretList).toBeDefined();
  const names = (result.SecretList ?? []).map((s) => s.Name);
  expect(names).toContain(name);
});

test("missing required field still returns correct error", async () => {
  const client = sm();
  let caught: unknown;
  try {
    await client.send(new CreateSecretCommand({} as { Name: string }));
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeDefined();
  const err = caught as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  expect(err.$metadata?.httpStatusCode).toBe(400);
  expect(err.name).toBe("ValidationException");
});
