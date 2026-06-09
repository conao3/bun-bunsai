import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const mwaa = () =>
  new MWAAClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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

  const creating = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(creating.Environment?.Status).toBe("CREATING");

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

  const deleting = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(deleting.Environment?.Status).toBe("DELETING");

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

  await client.send(new GetEnvironmentCommand({ Name: name }));

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
  expect(got.Environment?.Status).toBe("AVAILABLE");

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

test("MWAA lifecycle and unified tags", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-lifecycle-${Date.now()}`;

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
      Tags: { Env: "prod", Team: "data" },
    }),
  );
  const arn = created.Arn!;

  const creating = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(creating.Environment?.Status).toBe("CREATING");

  const got = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(got.Environment?.Status).toBe("AVAILABLE");
  expect(got.Environment?.Tags).toEqual({ Env: "prod", Team: "data" });

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(tags.Tags).toEqual({ Env: "prod", Team: "data" });

  await client.send(
    new UpdateEnvironmentCommand({ Name: name, MaxWorkers: 3 }),
  );
  const afterUpdate = await client.send(
    new GetEnvironmentCommand({ Name: name }),
  );
  expect(afterUpdate.Environment?.Status).toBe("AVAILABLE");
  expect(afterUpdate.Environment?.Tags).toEqual({ Env: "prod", Team: "data" });

  await client.send(new DeleteEnvironmentCommand({ Name: name }));

  const deleting = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(deleting.Environment?.Status).toBe("DELETING");

  await expect(
    client.send(new GetEnvironmentCommand({ Name: name })),
  ).rejects.toThrow();
});

test("MWAA ListEnvironments pagination", async () => {
  const client = mwaa();
  const ts = Date.now();
  const names = Array.from(
    { length: 5 },
    (_, i) => `bunsai-e2e-page-${ts}-${i}`,
  );

  for (const n of names) {
    await client.send(
      new CreateEnvironmentCommand({
        Name: n,
        DagS3Path: "dags",
        ExecutionRoleArn: `arn:aws:iam::000000000000:role/${n}-exec`,
        SourceBucketArn: `arn:aws:s3:::${n}-bucket`,
        NetworkConfiguration: {
          SubnetIds: ["subnet-11111111"],
          SecurityGroupIds: ["sg-11111111"],
        },
      }),
    );
  }

  const page1 = await client.send(
    new ListEnvironmentsCommand({ MaxResults: 2 }),
  );
  expect((page1.Environments ?? []).length).toBeLessThanOrEqual(2);
  expect(page1.NextToken).toBeDefined();

  const allCollected: string[] = [];
  let token: string | undefined;
  do {
    const resp = await client.send(
      new ListEnvironmentsCommand({ MaxResults: 2, NextToken: token }),
    );
    allCollected.push(...(resp.Environments ?? []));
    token = resp.NextToken;
  } while (token !== undefined);

  for (const n of names) {
    expect(allCollected).toContain(n);
  }

  for (const n of names) {
    await client.send(new DeleteEnvironmentCommand({ Name: n }));
  }
});

test("MWAA field persistence", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-fields-${Date.now()}`;

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
      AirflowConfigurationOptions: { "core.parallelism": "128" },
      PluginsS3Path: "plugins.zip",
      RequirementsS3Path: "requirements.txt",
    }),
  );

  const got = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(got.Environment?.AirflowConfigurationOptions).toEqual({
    "core.parallelism": "128",
  });
  expect(got.Environment?.PluginsS3Path).toBe("plugins.zip");
  expect(got.Environment?.RequirementsS3Path).toBe("requirements.txt");

  await client.send(
    new UpdateEnvironmentCommand({
      Name: name,
      RequirementsS3Path: "requirements-v2.txt",
    }),
  );

  const afterUpdate = await client.send(
    new GetEnvironmentCommand({ Name: name }),
  );
  expect(afterUpdate.Environment?.RequirementsS3Path).toBe(
    "requirements-v2.txt",
  );
  expect(afterUpdate.Environment?.PluginsS3Path).toBe("plugins.zip");

  await client.send(new DeleteEnvironmentCommand({ Name: name }));
});

test("MWAA fidelity: lifecycle, tag ARN validation, pagination bounds", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-fidelity-${Date.now()}`;

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

  const creating = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(creating.Environment?.Status).toBe("CREATING");

  const available = await client.send(
    new GetEnvironmentCommand({ Name: name }),
  );
  expect(available.Environment?.Status).toBe("AVAILABLE");

  await client.send(new DeleteEnvironmentCommand({ Name: name }));

  const deleting = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(deleting.Environment?.Status).toBe("DELETING");

  await expect(
    client.send(new GetEnvironmentCommand({ Name: name })),
  ).rejects.toThrow();

  const bogusArn = `arn:aws:airflow:us-east-1:000000000000:environment/nonexistent-bogus`;
  await expect(
    client.send(
      new TagResourceCommand({ ResourceArn: bogusArn, Tags: { k: "v" } }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(new ListTagsForResourceCommand({ ResourceArn: bogusArn })),
  ).rejects.toThrow();

  await expect(
    client.send(new ListEnvironmentsCommand({ MaxResults: 100 })),
  ).rejects.toThrow();
});
