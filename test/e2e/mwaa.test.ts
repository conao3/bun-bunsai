import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateCliTokenCommand,
  CreateEnvironmentCommand,
  CreateWebLoginTokenCommand,
  DeleteEnvironmentCommand,
  GetEnvironmentCommand,
  InvokeRestApiCommand,
  ListEnvironmentsCommand,
  ListTagsForResourceCommand,
  PublishMetricsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateEnvironmentCommand,
  MWAAClient,
} from "@aws-sdk/client-mwaa";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const mwaa = () =>
  new MWAAClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MWAA environment roundtrip", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111", "subnet-22222222"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );
  expect(created.Arn).toContain(`environment/${name}`);

  const got = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(got.Environment?.Name).toBe(name);
  expect(got.Environment?.Status).toBe("AVAILABLE");
  expect(got.Environment?.Arn).toBe(created.Arn);
  expect(got.Environment?.DagS3Path).toBe("dags");
  expect(got.Environment?.SourceBucketArn).toBe(`arn:aws:s3:::${name}-bucket`);
  expect(got.Environment?.NetworkConfiguration?.SubnetIds).toEqual([
    "subnet-11111111",
    "subnet-22222222",
  ]);

  const listed = await client.send(new ListEnvironmentsCommand({}));
  expect(listed.Environments ?? []).toContain(name);

  await client.send(new DeleteEnvironmentCommand({ Name: name }));

  await expect(
    client.send(new GetEnvironmentCommand({ Name: name })),
  ).rejects.toThrow();
});

test("MWAA UpdateEnvironment", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-update-${Date.now()}`;

  await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );

  const updated = await client.send(
    new UpdateEnvironmentCommand({
      Name: name,
      MaxWorkers: 5,
      DagS3Path: "dags/updated",
    }),
  );
  expect(updated.Arn).toContain(`environment/${name}`);

  const got = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(got.Environment?.MaxWorkers).toBe(5);
  expect(got.Environment?.DagS3Path).toBe("dags/updated");

  await expect(
    client.send(new UpdateEnvironmentCommand({ Name: "nonexistent-env-xyz" })),
  ).rejects.toThrow();

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});

test("MWAA CreateCliToken", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-cli-${Date.now()}`;

  await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );

  const token = await client.send(new CreateCliTokenCommand({ Name: name }));
  expect(typeof token.CliToken).toBe("string");
  expect(token.CliToken).toBeTruthy();
  expect(typeof token.WebServerHostname).toBe("string");
  expect(token.WebServerHostname).toContain(name);

  await expect(
    client.send(new CreateCliTokenCommand({ Name: "nonexistent-env-xyz" })),
  ).rejects.toThrow();

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});

test("MWAA CreateWebLoginToken", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-web-${Date.now()}`;

  await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );

  const token = await client.send(
    new CreateWebLoginTokenCommand({ Name: name }),
  );
  expect(typeof token.WebToken).toBe("string");
  expect(token.WebToken).toBeTruthy();
  expect(typeof token.WebServerHostname).toBe("string");
  expect(token.WebServerHostname).toContain(name);

  await expect(
    client.send(
      new CreateWebLoginTokenCommand({ Name: "nonexistent-env-xyz" }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});

test("MWAA InvokeRestApi", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-restapi-${Date.now()}`;

  await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );

  const result = await client.send(
    new InvokeRestApiCommand({
      Name: name,
      Path: "/dags",
      Method: "GET",
    }),
  );
  expect(result.RestApiStatusCode).toBe(200);

  await expect(
    client.send(
      new InvokeRestApiCommand({
        Name: "nonexistent-env-xyz",
        Path: "/dags",
        Method: "GET",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});

test("MWAA PublishMetrics", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-metrics-${Date.now()}`;

  await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );

  await expect(
    client.send(
      new PublishMetricsCommand({
        EnvironmentName: name,
        MetricData: [{ MetricName: "test-metric", Timestamp: new Date() }],
      }),
    ),
  ).resolves.toBeDefined();

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});

test("MWAA tag operations", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-tags-${Date.now()}`;

  const created = await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );
  const arn = created.Arn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: { Env: "staging", Team: "platform" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.Tags).toEqual({ Env: "staging", Team: "platform" });

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, tagKeys: ["Team"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(after.Tags).toEqual({ Env: "staging" });
  expect(after.Tags).not.toHaveProperty("Team");

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});
