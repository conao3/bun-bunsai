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
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

test("RotateSecret with lambda invokes all 4 steps in order with correct payloads", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "sm-rotation-steps-"));
  try {
    const lc = lambda();
    const client = sm();

    await lc.send(
      new CreateFunctionCommand({
        FunctionName: "sm-rotation-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Environment: { Variables: { STEP_RECORD_DIR: tmpDir } },
        Code: {
          ZipFile: makeZip({
            "index.js": [
              'const fs = require("fs");',
              "exports.handler = async (event) => {",
              "  const dir = process.env.STEP_RECORD_DIR;",
              "  if (dir) fs.appendFileSync(dir + '/steps.ndjson', JSON.stringify(event) + '\\n');",
              "};",
            ].join("\n"),
          }),
        },
      }),
    );

    const lambdaArn = `arn:aws:lambda:${region}:000000000000:function:sm-rotation-fn`;
    const name = "rotation-with-lambda";

    const created = await client.send(
      new CreateSecretCommand({ Name: name, SecretString: "original" }),
    );
    const v1Id = created.VersionId!;

    const rotated = await client.send(
      new RotateSecretCommand({ SecretId: name, RotationLambdaARN: lambdaArn }),
    );
    expect(rotated.VersionId).not.toBe(v1Id);

    const recorded = readFileSync(join(tmpDir, "steps.ndjson"), "utf-8");
    const events = recorded
      .trim()
      .split("\n")
      .map(
        (l) =>
          JSON.parse(l) as {
            Step: string;
            SecretId: string;
            ClientRequestToken: string;
          },
      );

    expect(events.map((e) => e.Step)).toEqual([
      "createSecret",
      "setSecret",
      "testSecret",
      "finishSecret",
    ]);

    for (const e of events) {
      expect(e.SecretId).toBeDefined();
      expect(e.ClientRequestToken).toBe(rotated.VersionId);
    }

    const current = await client.send(
      new GetSecretValueCommand({ SecretId: name }),
    );
    expect(current.VersionId).toBe(rotated.VersionId);
    expect(current.VersionStages).toContain("AWSCURRENT");

    const previous = await client.send(
      new GetSecretValueCommand({
        SecretId: name,
        VersionStage: "AWSPREVIOUS",
      }),
    );
    expect(previous.VersionId).toBe(v1Id);

    const described = await client.send(
      new DescribeSecretCommand({ SecretId: name }),
    );
    expect(described.RotationEnabled).toBe(true);
    expect(described.RotationLambdaARN).toBe(lambdaArn);
    expect(described.LastRotatedDate).toBeDefined();
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("RotateSecret with lambda that throws at testSecret preserves AWSCURRENT", async () => {
  const lc = lambda();
  const client = sm();

  await lc.send(
    new CreateFunctionCommand({
      FunctionName: "sm-rotation-fail-fn",
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js": [
            "exports.handler = async (event) => {",
            "  if (event.Step === 'testSecret') throw new Error('testSecret intentionally failed');",
            "};",
          ].join("\n"),
        }),
      },
    }),
  );

  const lambdaArn = `arn:aws:lambda:${region}:000000000000:function:sm-rotation-fail-fn`;
  const name = "rotation-fail-at-testSecret";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "original-value" }),
  );
  const v1Id = created.VersionId!;

  await expect(
    client.send(
      new RotateSecretCommand({ SecretId: name, RotationLambdaARN: lambdaArn }),
    ),
  ).rejects.toBeDefined();

  const current = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(current.VersionId).toBe(v1Id);
  expect(current.VersionStages).toContain("AWSCURRENT");
  expect(current.SecretString).toBe("original-value");

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  const versions = Object.entries(described.VersionIdsToStages ?? {});
  const currentVersions = versions.filter(([, stages]) =>
    stages.includes("AWSCURRENT"),
  );
  expect(currentVersions).toHaveLength(1);
  expect(currentVersions[0][0]).toBe(v1Id);
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
