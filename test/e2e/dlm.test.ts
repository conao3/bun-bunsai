import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const dlm = () =>
  new DLMClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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

test("DLM GetLifecyclePolicies: PolicyType field in summary", async () => {
  const client = dlm();

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "policy type test",
      State: "ENABLED",
      PolicyDetails: {
        PolicyType: "EBS_SNAPSHOT_MANAGEMENT",
        ResourceTypes: ["VOLUME"],
        TargetTags: [{ Key: "env", Value: "staging" }],
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

  const listed = await client.send(
    new GetLifecyclePoliciesCommand({ PolicyIds: [policyId] }),
  );
  const summary = (listed.Policies ?? []).find((p) => p.PolicyId === policyId);
  expect(summary?.PolicyType).toBe("EBS_SNAPSHOT_MANAGEMENT");
  expect(summary?.DefaultPolicy).toBe(false);

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: policyId }));
});

test("DLM GetLifecyclePolicies: State filter", async () => {
  const client = dlm();

  const enabled = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "enabled policy",
      State: "ENABLED",
      PolicyDetails: {
        ResourceTypes: ["VOLUME"],
        TargetTags: [{ Key: "tier", Value: "state-filter-test" }],
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
  const disabled = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "disabled policy",
      State: "DISABLED",
      PolicyDetails: {
        ResourceTypes: ["VOLUME"],
        TargetTags: [{ Key: "tier", Value: "state-filter-test" }],
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

  const enabledId = enabled.PolicyId ?? "";
  const disabledId = disabled.PolicyId ?? "";

  const onlyEnabled = await client.send(
    new GetLifecyclePoliciesCommand({ State: "ENABLED" }),
  );
  const enabledIds = (onlyEnabled.Policies ?? []).map((p) => p.PolicyId);
  expect(enabledIds).toContain(enabledId);
  expect(enabledIds).not.toContain(disabledId);

  const onlyDisabled = await client.send(
    new GetLifecyclePoliciesCommand({ State: "DISABLED" }),
  );
  const disabledIds = (onlyDisabled.Policies ?? []).map((p) => p.PolicyId);
  expect(disabledIds).not.toContain(enabledId);
  expect(disabledIds).toContain(disabledId);

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: enabledId }));
  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: disabledId }));
});

test("DLM TagResource: ResourceNotFoundException for missing policy ARN", async () => {
  const client = dlm();

  const fakeArn =
    "arn:aws:dlm:us-east-1:000000000000:policy/policy-nonexistent";

  await expect(
    client.send(
      new TagResourceCommand({
        ResourceArn: fakeArn,
        Tags: { key: "value" },
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new UntagResourceCommand({
        ResourceArn: fakeArn,
        TagKeys: ["key"],
      }),
    ),
  ).rejects.toThrow();
});

test("DLM CreateLifecyclePolicy: creation tags appear in ListTagsForResource", async () => {
  const client = dlm();

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "creation tags test",
      State: "ENABLED",
      Tags: { project: "bunsai", owner: "platform" },
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

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: policyArn }),
  );
  expect(tags.Tags?.project).toBe("bunsai");
  expect(tags.Tags?.owner).toBe("platform");

  await client.send(
    new TagResourceCommand({
      ResourceArn: policyArn,
      Tags: { extra: "tag" },
    }),
  );
  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: policyArn }),
  );
  expect(tagsAfter.Tags?.project).toBe("bunsai");
  expect(tagsAfter.Tags?.extra).toBe("tag");

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: policyId }));
});

test("DLM DeleteLifecyclePolicy: clears tags", async () => {
  const client = dlm();

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      ExecutionRoleArn:
        "arn:aws:iam::000000000000:role/AWSDataLifecycleManagerDefaultRole",
      Description: "delete clears tags",
      State: "ENABLED",
      Tags: { project: "test" },
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
  const policyArn =
    (await client.send(new GetLifecyclePolicyCommand({ PolicyId: policyId })))
      .Policy?.PolicyArn ?? "";

  await client.send(new DeleteLifecyclePolicyCommand({ PolicyId: policyId }));

  await expect(
    client.send(new ListTagsForResourceCommand({ ResourceArn: policyArn })),
  ).rejects.toThrow();
});
