import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateLifecyclePolicyCommand,
  DeleteLifecyclePolicyCommand,
  DLMClient,
  GetLifecyclePoliciesCommand,
  GetLifecyclePolicyCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateLifecyclePolicyCommand,
} from "@aws-sdk/client-dlm";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const dlm = () =>
  new DLMClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("DLM lifecycle policy roundtrip", async () => {
  const client = dlm();

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "bunsai e2e policy",
      State: "ENABLED",
      PolicyDetails: {
        ResourceTypes: ["VOLUME"],
        TargetTags: [{ Key: "env", Value: "test" }],
        Schedules: [
          {
            Name: "daily",
            CreateRule: { Interval: 24, IntervalUnit: "HOURS" },
            RetainRule: { Count: 7 },
          },
        ],
      },
    }),
  );
  expect(created.PolicyId).toBeDefined();
  const policyId = created.PolicyId ?? "";

  const got = await client.send(
    new GetLifecyclePolicyCommand({ PolicyId: policyId }),
  );
  expect(got.Policy?.PolicyId).toBe(policyId);
  expect(got.Policy?.Description).toBe("bunsai e2e policy");
  expect(got.Policy?.State).toBe("ENABLED");

  const listed = await client.send(new GetLifecyclePoliciesCommand({}));
  expect((listed.Policies ?? []).map((p) => p.PolicyId)).toContain(policyId);

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: policyId }));
  await expect(
    client.send(new GetLifecyclePolicyCommand({ PolicyId: policyId })),
  ).rejects.toThrow();
});

test("DLM UpdateLifecyclePolicy", async () => {
  const client = dlm();

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "original description",
      State: "ENABLED",
      PolicyDetails: {
        ResourceTypes: ["VOLUME"],
        TargetTags: [{ Key: "env", Value: "test" }],
        Schedules: [
          {
            Name: "daily",
            CreateRule: { Interval: 24, IntervalUnit: "HOURS" },
            RetainRule: { Count: 7 },
          },
        ],
      },
    }),
  );
  const policyId = created.PolicyId ?? "";

  await client.send(
    new UpdateLifecyclePolicyCommand({
      PolicyId: policyId,
      Description: "updated description",
      State: "DISABLED",
    }),
  );

  const got = await client.send(
    new GetLifecyclePolicyCommand({ PolicyId: policyId }),
  );
  expect(got.Policy?.Description).toBe("updated description");
  expect(got.Policy?.State).toBe("DISABLED");

  await expect(
    client.send(
      new UpdateLifecyclePolicyCommand({
        PolicyId: "policy-nonexistent",
        Description: "should fail",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: policyId }));
});

test("DLM TagResource, UntagResource, ListTagsForResource", async () => {
  const client = dlm();

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "tag test policy",
      State: "ENABLED",
      PolicyDetails: {
        ResourceTypes: ["VOLUME"],
        TargetTags: [{ Key: "env", Value: "test" }],
        Schedules: [
          {
            Name: "daily",
            CreateRule: { Interval: 24, IntervalUnit: "HOURS" },
            RetainRule: { Count: 7 },
          },
        ],
      },
    }),
  );
  const policyId = created.PolicyId ?? "";

  const got = await client.send(
    new GetLifecyclePolicyCommand({ PolicyId: policyId }),
  );
  const policyArn = got.Policy?.PolicyArn ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceArn: policyArn,
      Tags: { team: "platform", env: "prod" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: policyArn }),
  );
  expect(listed.Tags?.team).toBe("platform");
  expect(listed.Tags?.env).toBe("prod");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: policyArn,
      TagKeys: ["env"],
    }),
  );

  const listedAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: policyArn }),
  );
  expect(listedAfter.Tags?.team).toBe("platform");
  expect(listedAfter.Tags?.env).toBeUndefined();

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: policyId }));
});
