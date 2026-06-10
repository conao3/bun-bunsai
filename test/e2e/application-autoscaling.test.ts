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
  ListTagsForResourceCommand,
  PutScalingPolicyCommand,
  PutScheduledActionCommand,
  RegisterScalableTargetCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-application-auto-scaling";

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

test("DescribeScalingActivities returns empty list", async () => {
  const aas = client();
  const ns = "ecs";

  const result = await aas.send(
    new DescribeScalingActivitiesCommand({ ServiceNamespace: ns }),
  );
  expect(result.ScalingActivities).toHaveLength(0);
});
