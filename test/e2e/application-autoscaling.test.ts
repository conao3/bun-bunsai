import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ApplicationAutoScalingClient,
  DeleteScalingPolicyCommand,
  DeleteScheduledActionCommand,
  DeregisterScalableTargetCommand,
  DescribeScalableTargetsCommand,
  DescribeScalingActivitiesCommand,
  DescribeScalingPoliciesCommand,
  DescribeScheduledActionsCommand,
  GetPredictiveScalingForecastCommand,
  ListTagsForResourceCommand,
  PutScalingPolicyCommand,
  PutScheduledActionCommand,
  RegisterScalableTargetCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-application-auto-scaling";
import type { GetPredictiveScalingForecastCommandInput } from "@aws-sdk/client-application-auto-scaling";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new ApplicationAutoScalingClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Scalable target lifecycle", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/my-cluster/my-service";
  const dimension = "ecs:service:DesiredCount";

  const registerResult = await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );
  expect(registerResult.ScalableTargetARN).toContain("arn:aws:");

  const describeResult = await aas.send(
    new DescribeScalableTargetsCommand({
      ServiceNamespace: ns,
    }),
  );
  expect(describeResult.ScalableTargets).toHaveLength(1);
  const target = describeResult.ScalableTargets![0]!;
  expect(target.ResourceId).toBe(resourceId);
  expect(target.ScalableDimension).toBe(dimension);
  expect(target.MinCapacity).toBe(1);
  expect(target.MaxCapacity).toBe(10);

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 2,
      MaxCapacity: 20,
    }),
  );

  const updated = await aas.send(
    new DescribeScalableTargetsCommand({
      ServiceNamespace: ns,
      ResourceIds: [resourceId],
      ScalableDimension: dimension,
    }),
  );
  expect(updated.ScalableTargets![0]!.MinCapacity).toBe(2);
  expect(updated.ScalableTargets![0]!.MaxCapacity).toBe(20);

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );

  const afterDeregister = await aas.send(
    new DescribeScalableTargetsCommand({ ServiceNamespace: ns }),
  );
  expect(afterDeregister.ScalableTargets).toHaveLength(0);
});

test("Scaling policy CRUD", async () => {
  const aas = client();
  const ns = "dynamodb";
  const resourceId = "table/my-table";
  const dimension = "dynamodb:table:ReadCapacityUnits";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 5,
      MaxCapacity: 100,
    }),
  );

  const putResult = await aas.send(
    new PutScalingPolicyCommand({
      PolicyName: "my-scale-out-policy",
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      PolicyType: "TargetTrackingScaling",
      TargetTrackingScalingPolicyConfiguration: {
        TargetValue: 70.0,
        PredefinedMetricSpecification: {
          PredefinedMetricType: "DynamoDBReadCapacityUtilization",
        },
      },
    }),
  );
  expect(putResult.PolicyARN).toContain("arn:aws:");

  const descPolicies = await aas.send(
    new DescribeScalingPoliciesCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
  expect(descPolicies.ScalingPolicies).toHaveLength(1);
  expect(descPolicies.ScalingPolicies![0]!.PolicyName).toBe(
    "my-scale-out-policy",
  );
  expect(descPolicies.ScalingPolicies![0]!.PolicyType).toBe(
    "TargetTrackingScaling",
  );

  await aas.send(
    new DeleteScalingPolicyCommand({
      PolicyName: "my-scale-out-policy",
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );

  const afterDelete = await aas.send(
    new DescribeScalingPoliciesCommand({ ServiceNamespace: ns }),
  );
  expect(afterDelete.ScalingPolicies).toHaveLength(0);

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("Scheduled action CRUD", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/prod-cluster/api-service";
  const dimension = "ecs:service:DesiredCount";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );

  await aas.send(
    new PutScheduledActionCommand({
      ServiceNamespace: ns,
      ScheduledActionName: "scale-up-morning",
      ResourceId: resourceId,
      ScalableDimension: dimension,
      Schedule: "cron(0 8 * * ? *)",
      ScalableTargetAction: { MinCapacity: 5, MaxCapacity: 10 },
    }),
  );

  const descActions = await aas.send(
    new DescribeScheduledActionsCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
    }),
  );
  expect(descActions.ScheduledActions).toHaveLength(1);
  const action = descActions.ScheduledActions![0]!;
  expect(action.ScheduledActionName).toBe("scale-up-morning");
  expect(action.Schedule).toBe("cron(0 8 * * ? *)");

  await aas.send(
    new DeleteScheduledActionCommand({
      ServiceNamespace: ns,
      ScheduledActionName: "scale-up-morning",
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );

  const afterDelete = await aas.send(
    new DescribeScheduledActionsCommand({ ServiceNamespace: ns }),
  );
  expect(afterDelete.ScheduledActions).toHaveLength(0);

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("Unregistered target raises ObjectNotFoundException", async () => {
  const aas = client();

  await expect(
    aas.send(
      new PutScalingPolicyCommand({
        PolicyName: "ghost-policy",
        ServiceNamespace: "ecs",
        ResourceId: "service/ghost-cluster/ghost-service",
        ScalableDimension: "ecs:service:DesiredCount",
        PolicyType: "StepScaling",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    aas.send(
      new PutScheduledActionCommand({
        ServiceNamespace: "ecs",
        ScheduledActionName: "ghost-action",
        ResourceId: "service/ghost-cluster/ghost-service",
        ScalableDimension: "ecs:service:DesiredCount",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    aas.send(
      new DeregisterScalableTargetCommand({
        ServiceNamespace: "ecs",
        ResourceId: "service/ghost-cluster/ghost-service",
        ScalableDimension: "ecs:service:DesiredCount",
      }),
    ),
  ).rejects.toThrow();
});

test("Tags round-trip", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/tag-cluster/tag-service";
  const dimension = "ecs:service:DesiredCount";

  const registerResult = await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 5,
      Tags: { env: "prod", owner: "team-a" },
    }),
  );
  const arn = registerResult.ScalableTargetARN!;

  const listResult = await aas.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(listResult.Tags).toMatchObject({ env: "prod", owner: "team-a" });

  await aas.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: { "cost-center": "12345" },
    }),
  );

  const afterTag = await aas.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(afterTag.Tags!["cost-center"]).toBe("12345");
  expect(afterTag.Tags!["env"]).toBe("prod");

  await aas.send(
    new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["owner"] }),
  );

  const afterUntag = await aas.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(afterUntag.Tags!["owner"]).toBeUndefined();
  expect(afterUntag.Tags!["env"]).toBe("prod");

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("Deregister cascades policies and scheduled actions", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/cascade-cluster/cascade-service";
  const dimension = "ecs:service:DesiredCount";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );

  await aas.send(
    new PutScalingPolicyCommand({
      PolicyName: "cascade-policy",
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      PolicyType: "StepScaling",
      StepScalingPolicyConfiguration: { AdjustmentType: "ChangeInCapacity" },
    }),
  );

  await aas.send(
    new PutScheduledActionCommand({
      ServiceNamespace: ns,
      ScheduledActionName: "cascade-action",
      ResourceId: resourceId,
      ScalableDimension: dimension,
      Schedule: "rate(1 hour)",
    }),
  );

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );

  const policies = await aas.send(
    new DescribeScalingPoliciesCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
    }),
  );
  expect(policies.ScalingPolicies).toHaveLength(0);

  const actions = await aas.send(
    new DescribeScheduledActionsCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
    }),
  );
  expect(actions.ScheduledActions).toHaveLength(0);
});

test("DescribeScalingActivities returns empty list for fresh namespace", async () => {
  const aas = client();
  const ns = "kafka";

  const result = await aas.send(
    new DescribeScalingActivitiesCommand({ ServiceNamespace: ns }),
  );
  expect(result.ScalingActivities).toHaveLength(0);
});

test("AAS-01: Tag ops on unknown ARN raise ResourceNotFoundException", async () => {
  const aas = client();
  const fakeArn =
    "arn:aws:application-autoscaling:us-east-1:123456789012:scalable-target/doesnotexist";

  await expect(
    aas.send(new ListTagsForResourceCommand({ ResourceARN: fakeArn })),
  ).rejects.toThrow();

  await expect(
    aas.send(
      new TagResourceCommand({ ResourceARN: fakeArn, Tags: { env: "test" } }),
    ),
  ).rejects.toThrow();

  await expect(
    aas.send(
      new UntagResourceCommand({ ResourceARN: fakeArn, TagKeys: ["env"] }),
    ),
  ).rejects.toThrow();
});

test("AAS-02: RegisterScalableTarget requires MinCapacity and MaxCapacity for new target", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/aas02-cluster/aas02-service";
  const dimension = "ecs:service:DesiredCount";

  await expect(
    aas.send(
      new RegisterScalableTargetCommand({
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
      }),
    ),
  ).rejects.toThrow();

  await expect(
    aas.send(
      new RegisterScalableTargetCommand({
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
        MinCapacity: 10,
        MaxCapacity: 5,
      }),
    ),
  ).rejects.toThrow();
});

test("AAS-03: PutScalingPolicy requires config matching PolicyType", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/aas03-cluster/aas03-service";
  const dimension = "ecs:service:DesiredCount";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );

  await expect(
    aas.send(
      new PutScalingPolicyCommand({
        PolicyName: "missing-config-policy",
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
        PolicyType: "StepScaling",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    aas.send(
      new PutScalingPolicyCommand({
        PolicyName: "missing-config-policy",
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
        PolicyType: "TargetTrackingScaling",
      }),
    ),
  ).rejects.toThrow();

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("AAS-04: GetPredictiveScalingForecast validates required fields", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/aas04-cluster/aas04-service";
  const dimension = "ecs:service:DesiredCount";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );

  await expect(
    aas.send(
      new GetPredictiveScalingForecastCommand({
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
        PolicyName: "my-policy",
      } as unknown as GetPredictiveScalingForecastCommandInput),
    ),
  ).rejects.toThrow();

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("AAS-05: Scaling activities recorded on capacity change", async () => {
  const aas = client();
  const ns = "lambda";
  const resourceId = "function:aas05-fn:PROVISIONED_CONCURRENCY";
  const dimension = "lambda:function:ProvisionedConcurrency";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 5,
    }),
  );

  let activities = await aas.send(
    new DescribeScalingActivitiesCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
    }),
  );
  expect(activities.ScalingActivities).toHaveLength(0);

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 2,
      MaxCapacity: 10,
    }),
  );

  activities = await aas.send(
    new DescribeScalingActivitiesCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
    }),
  );
  expect(activities.ScalingActivities!.length).toBeGreaterThan(0);
  expect(activities.ScalingActivities![0]!.StatusCode).toBe("Successful");

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("AAS-06: DescribeScalingPolicies page size default/max 10", async () => {
  const aas = client();
  const ns = "rds";
  const dimension = "rds:cluster:ReadReplicaCount";

  for (let i = 0; i < 3; i++) {
    const resourceId = `cluster:aas06-cluster-${i}`;
    await aas.send(
      new RegisterScalableTargetCommand({
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
        MinCapacity: 1,
        MaxCapacity: 5,
      }),
    );
    await aas.send(
      new PutScalingPolicyCommand({
        PolicyName: `policy-${i}`,
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
        PolicyType: "TargetTrackingScaling",
        TargetTrackingScalingPolicyConfiguration: { TargetValue: 70.0 },
      }),
    );
  }

  await expect(
    aas.send(
      new DescribeScalingPoliciesCommand({
        ServiceNamespace: ns,
        MaxResults: 11,
      }),
    ),
  ).rejects.toThrow();

  const result = await aas.send(
    new DescribeScalingPoliciesCommand({ ServiceNamespace: ns }),
  );
  expect(result.ScalingPolicies!.length).toBeLessThanOrEqual(10);

  for (let i = 0; i < 3; i++) {
    const resourceId = `cluster:aas06-cluster-${i}`;
    await aas.send(
      new DeregisterScalableTargetCommand({
        ServiceNamespace: ns,
        ResourceId: resourceId,
        ScalableDimension: dimension,
      }),
    );
  }
});

test("AAS-07: SuspendedState materialized and merged correctly", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/aas07-cluster/aas07-service";
  const dimension = "ecs:service:DesiredCount";

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );

  const initial = await aas.send(
    new DescribeScalableTargetsCommand({ ServiceNamespace: ns }),
  );
  const initialTarget = initial.ScalableTargets!.find(
    (t) => t.ResourceId === resourceId,
  )!;
  expect(initialTarget.SuspendedState?.DynamicScalingInSuspended).toBe(false);
  expect(initialTarget.SuspendedState?.DynamicScalingOutSuspended).toBe(false);
  expect(initialTarget.SuspendedState?.ScheduledScalingSuspended).toBe(false);

  await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
      SuspendedState: { DynamicScalingInSuspended: true },
    }),
  );

  const updated = await aas.send(
    new DescribeScalableTargetsCommand({ ServiceNamespace: ns }),
  );
  const updatedTarget = updated.ScalableTargets!.find(
    (t) => t.ResourceId === resourceId,
  )!;
  expect(updatedTarget.SuspendedState?.DynamicScalingInSuspended).toBe(true);
  expect(updatedTarget.SuspendedState?.DynamicScalingOutSuspended).toBe(false);
  expect(updatedTarget.SuspendedState?.ScheduledScalingSuspended).toBe(false);

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});

test("AAS-08: ScalableTargetARN uses opaque format", async () => {
  const aas = client();
  const ns = "ecs";
  const resourceId = "service/aas08-cluster/aas08-service";
  const dimension = "ecs:service:DesiredCount";

  const result = await aas.send(
    new RegisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      MinCapacity: 1,
      MaxCapacity: 10,
    }),
  );

  const arn = result.ScalableTargetARN!;
  expect(arn).toMatch(
    /^arn:aws:application-autoscaling:[^:]+:\d+:scalable-target\/[a-f0-9]+$/,
  );
  expect(arn).not.toContain(ns);
  expect(arn).not.toContain(resourceId);
  expect(arn).not.toContain(dimension);

  await aas.send(
    new DeregisterScalableTargetCommand({
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
    }),
  );
});
