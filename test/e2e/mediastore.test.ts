import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateContainerCommand,
  DeleteContainerCommand,
  DeleteContainerPolicyCommand,
  DeleteCorsPolicyCommand,
  DeleteLifecyclePolicyCommand,
  DeleteMetricPolicyCommand,
  DescribeContainerCommand,
  GetContainerPolicyCommand,
  GetCorsPolicyCommand,
  GetLifecyclePolicyCommand,
  GetMetricPolicyCommand,
  ListContainersCommand,
  ListTagsForResourceCommand,
  MediaStoreClient,
  PutContainerPolicyCommand,
  PutCorsPolicyCommand,
  PutLifecyclePolicyCommand,
  PutMetricPolicyCommand,
  StartAccessLoggingCommand,
  StopAccessLoggingCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-mediastore";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const mediastore = () =>
  new MediaStoreClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaStore container lifecycle", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-container";

  const created = await client.send(
    new CreateContainerCommand({ ContainerName: name }),
  );
  expect(created.Container?.Name).toBe(name);
  expect(created.Container?.Status).toBe("ACTIVE");
  expect(created.Container?.ARN).toContain(name);
  expect(created.Container?.Endpoint).toContain(name);

  const described = await client.send(
    new DescribeContainerCommand({ ContainerName: name }),
  );
  expect(described.Container?.Name).toBe(name);
  expect(described.Container?.Status).toBe("ACTIVE");

  const listed = await client.send(new ListContainersCommand({}));
  expect((listed.Containers ?? []).some((c) => c.Name === name)).toBe(true);

  await client.send(new DeleteContainerCommand({ ContainerName: name }));

  const afterDelete = await client.send(new ListContainersCommand({}));
  expect((afterDelete.Containers ?? []).some((c) => c.Name === name)).toBe(
    false,
  );
});

test("MediaStore container policy operations", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-policy-container";
  await client.send(new CreateContainerCommand({ ContainerName: name }));

  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  await client.send(
    new PutContainerPolicyCommand({ ContainerName: name, Policy: policy }),
  );

  const got = await client.send(
    new GetContainerPolicyCommand({ ContainerName: name }),
  );
  expect(got.Policy).toBe(policy);

  await client.send(new DeleteContainerPolicyCommand({ ContainerName: name }));

  await expect(
    client.send(new GetContainerPolicyCommand({ ContainerName: name })),
  ).rejects.toThrow();

  await client.send(new DeleteContainerCommand({ ContainerName: name }));
});

test("MediaStore CORS policy operations", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-cors-container";
  await client.send(new CreateContainerCommand({ ContainerName: name }));

  const corsPolicy = [
    {
      AllowedOrigins: ["https://example.com"],
      AllowedMethods: ["GET" as const],
      AllowedHeaders: ["*"],
      MaxAgeSeconds: 3000,
    },
  ];

  await client.send(
    new PutCorsPolicyCommand({ ContainerName: name, CorsPolicy: corsPolicy }),
  );

  const got = await client.send(
    new GetCorsPolicyCommand({ ContainerName: name }),
  );
  expect(got.CorsPolicy).toHaveLength(1);
  expect(got.CorsPolicy?.[0].AllowedOrigins).toEqual(["https://example.com"]);

  await client.send(new DeleteCorsPolicyCommand({ ContainerName: name }));

  await expect(
    client.send(new GetCorsPolicyCommand({ ContainerName: name })),
  ).rejects.toThrow();

  await client.send(new DeleteContainerCommand({ ContainerName: name }));
});

test("MediaStore lifecycle policy operations", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-lifecycle-container";
  await client.send(new CreateContainerCommand({ ContainerName: name }));

  const lifecyclePolicy = JSON.stringify({
    rules: [
      {
        definition: {
          path: [{ prefix: "/assets/" }],
          days_since_create: [{ numeric: [">=", 30] }],
        },
        action: "EXPIRE",
      },
    ],
  });

  await client.send(
    new PutLifecyclePolicyCommand({
      ContainerName: name,
      LifecyclePolicy: lifecyclePolicy,
    }),
  );

  const got = await client.send(
    new GetLifecyclePolicyCommand({ ContainerName: name }),
  );
  expect(got.LifecyclePolicy).toBe(lifecyclePolicy);

  await client.send(new DeleteLifecyclePolicyCommand({ ContainerName: name }));

  await expect(
    client.send(new GetLifecyclePolicyCommand({ ContainerName: name })),
  ).rejects.toThrow();

  await client.send(new DeleteContainerCommand({ ContainerName: name }));
});

test("MediaStore metric policy operations", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-metric-container";
  await client.send(new CreateContainerCommand({ ContainerName: name }));

  const metricPolicy = {
    ContainerLevelMetrics: "ENABLED" as const,
  };

  await client.send(
    new PutMetricPolicyCommand({
      ContainerName: name,
      MetricPolicy: metricPolicy,
    }),
  );

  const got = await client.send(
    new GetMetricPolicyCommand({ ContainerName: name }),
  );
  expect(got.MetricPolicy?.ContainerLevelMetrics).toBe("ENABLED");

  await client.send(new DeleteMetricPolicyCommand({ ContainerName: name }));

  await expect(
    client.send(new GetMetricPolicyCommand({ ContainerName: name })),
  ).rejects.toThrow();

  await client.send(new DeleteContainerCommand({ ContainerName: name }));
});

test("MediaStore access logging operations", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-logging-container";
  await client.send(new CreateContainerCommand({ ContainerName: name }));

  const beforeStart = await client.send(
    new DescribeContainerCommand({ ContainerName: name }),
  );
  expect(beforeStart.Container?.AccessLoggingEnabled).toBe(false);

  await client.send(new StartAccessLoggingCommand({ ContainerName: name }));

  const afterStart = await client.send(
    new DescribeContainerCommand({ ContainerName: name }),
  );
  expect(afterStart.Container?.AccessLoggingEnabled).toBe(true);

  await client.send(new StopAccessLoggingCommand({ ContainerName: name }));

  const afterStop = await client.send(
    new DescribeContainerCommand({ ContainerName: name }),
  );
  expect(afterStop.Container?.AccessLoggingEnabled).toBe(false);

  await client.send(new DeleteContainerCommand({ ContainerName: name }));
});

test("MediaStore tagging operations", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-tag-container";
  const created = await client.send(
    new CreateContainerCommand({ ContainerName: name }),
  );
  const arn = created.Container?.ARN ?? "";

  await client.send(
    new TagResourceCommand({
      Resource: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ Resource: arn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["project"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ Resource: arn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ Resource: arn }),
  );
  const afterMap = Object.fromEntries(
    (afterUntag.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(afterMap["env"]).toBeUndefined();
  expect(afterMap["project"]).toBe("bunsai");

  await client.send(new DeleteContainerCommand({ ContainerName: name }));
});
