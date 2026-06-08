import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CancelRotateSecretCommand,
  CreateSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  RotateSecretCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

test("RotateSecret without lambda advances version stages", async () => {
  const client = sm();
  const name = "rotation-no-lambda";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "v1-value" }),
  );
  const v1Id = created.VersionId!;

  const rotated = await client.send(
    new RotateSecretCommand({ SecretId: name }),
  );
  expect(rotated.VersionId).toBeDefined();
  expect(rotated.VersionId).not.toBe(v1Id);

  const current = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(current.VersionId).toBe(rotated.VersionId);
  expect(current.VersionStages).toContain("AWSCURRENT");

  const previous = await client.send(
    new GetSecretValueCommand({ SecretId: name, VersionStage: "AWSPREVIOUS" }),
  );
  expect(previous.VersionId).toBe(v1Id);
  expect(previous.VersionStages).toContain("AWSPREVIOUS");

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.RotationEnabled).toBe(true);
  expect(described.LastRotatedDate).toBeDefined();
  expect(described.RotationLambdaARN).toBeUndefined();
});

test("RotateSecret with lambda invokes all 4 steps", async () => {
  const lc = lambda();
  await lc.send(
    new CreateFunctionCommand({
      FunctionName: "sm-rotation-fn",
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js": "exports.handler = async () => ({ ok: true });",
        }),
      },
    }),
  );

  const lambdaArn = `arn:aws:lambda:${region}:000000000000:function:sm-rotation-fn`;
  const client = sm();
  const name = "rotation-with-lambda";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "original" }),
  );
  const v1Id = created.VersionId!;

  const rotated = await client.send(
    new RotateSecretCommand({ SecretId: name, RotationLambdaARN: lambdaArn }),
  );
  expect(rotated.VersionId).not.toBe(v1Id);

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.RotationEnabled).toBe(true);
  expect(described.RotationLambdaARN).toBe(lambdaArn);
  expect(described.LastRotatedDate).toBeDefined();
});

test("CancelRotateSecret clears AWSPENDING", async () => {
  const client = sm();
  const name = "rotation-cancel";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );

  await client.send(new RotateSecretCommand({ SecretId: name }));

  const cancelled = await client.send(
    new CancelRotateSecretCommand({ SecretId: name }),
  );
  expect(cancelled.ARN).toBeDefined();
  expect(cancelled.Name).toBe(name);

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.RotationEnabled).toBe(false);
  const stages = Object.values(described.VersionIdsToStages ?? {}).flat();
  expect(stages).not.toContain("AWSPENDING");
});
