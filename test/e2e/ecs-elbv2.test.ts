import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateServiceCommand,
  DeleteServiceCommand,
  ECSClient,
  RegisterTaskDefinitionCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import {
  CreateTargetGroupCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
} from "@aws-sdk/client-elastic-load-balancing-v2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ecs = () =>
  new ECSClient({ endpoint, region, credentials, requestHandler });
const elbv2 = () =>
  new ElasticLoadBalancingV2Client({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("ECS CreateService registers tasks as elbv2 targets", async () => {
  const ecsClient = ecs();
  const elbClient = elbv2();
  const clusterName = "ecs-elbv2-cluster";
  const family = "ecs-elbv2-family";
  const serviceName = "ecs-elbv2-service";

  await ecsClient.send(new CreateClusterCommand({ clusterName }));

  await ecsClient.send(
    new RegisterTaskDefinitionCommand({
      family,
      containerDefinitions: [
        { name: "app", image: "nginx:latest", memory: 128 },
      ],
    }),
  );

  const { TargetGroups: createdTgs } = await elbClient.send(
    new CreateTargetGroupCommand({
      Name: "ecs-elbv2-tg",
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-test",
      TargetType: "ip",
    }),
  );
  const tgArn = createdTgs?.[0]?.TargetGroupArn ?? "";
  expect(tgArn).toBeTruthy();

  const createdSvc = await ecsClient.send(
    new CreateServiceCommand({
      cluster: clusterName,
      serviceName,
      taskDefinition: family,
      desiredCount: 2,
      loadBalancers: [
        { targetGroupArn: tgArn, containerName: "app", containerPort: 80 },
      ],
    }),
  );
  expect(createdSvc.service?.desiredCount).toBe(2);

  const { TargetHealthDescriptions: health1 } = await elbClient.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(health1?.length).toBe(2);
  expect(health1?.every((h) => h.TargetHealth?.State === "healthy")).toBe(true);

  const updatedSvc = await ecsClient.send(
    new UpdateServiceCommand({
      cluster: clusterName,
      service: serviceName,
      desiredCount: 1,
    }),
  );
  expect(updatedSvc.service?.desiredCount).toBe(1);

  const { TargetHealthDescriptions: health2 } = await elbClient.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(health2?.length).toBe(1);

  await ecsClient.send(
    new DeleteServiceCommand({ cluster: clusterName, service: serviceName }),
  );

  const { TargetHealthDescriptions: health3 } = await elbClient.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(health3?.length).toBe(0);
});

test("ECS CreateService with non-existent targetGroupArn returns TargetGroupNotFound", async () => {
  const ecsClient = ecs();
  const clusterName = "ecs-elbv2-err-cluster";
  const family = "ecs-elbv2-err-family";

  await ecsClient.send(new CreateClusterCommand({ clusterName }));
  await ecsClient.send(
    new RegisterTaskDefinitionCommand({
      family,
      containerDefinitions: [
        { name: "app", image: "nginx:latest", memory: 128 },
      ],
    }),
  );

  await expect(
    ecsClient.send(
      new CreateServiceCommand({
        cluster: clusterName,
        serviceName: "err-svc",
        taskDefinition: family,
        desiredCount: 1,
        loadBalancers: [
          {
            targetGroupArn:
              "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/nonexistent/abc123",
            containerName: "app",
            containerPort: 80,
          },
        ],
      }),
    ),
  ).rejects.toMatchObject({ name: "TargetGroupNotFound" });
});
