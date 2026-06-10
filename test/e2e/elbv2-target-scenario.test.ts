import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateListenerCommand,
  CreateLoadBalancerCommand,
  CreateTargetGroupCommand,
  DeleteListenerCommand,
  DeleteLoadBalancerCommand,
  DeleteTargetGroupCommand,
  DeregisterTargetsCommand,
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeRulesCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
  RegisterTargetsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const elbv2 = () =>
  new ElasticLoadBalancingV2Client({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("ELBv2 target lifecycle: register, health, listener forward, deregister", async () => {
  const client = elbv2();

  // Step 1: CreateLoadBalancer → provisioning, next Describe → active (tier-22 spec)
  const { LoadBalancers: createdLbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: "scenario-target-lb",
      Subnets: ["subnet-aaa111", "subnet-bbb222"],
      Type: "application",
      Scheme: "internet-facing",
    }),
  );
  const lb = createdLbs?.[0];
  expect(lb?.State?.Code).toBe("provisioning");
  const lbArn = lb?.LoadBalancerArn ?? "";

  const { LoadBalancers: describedLbs } = await client.send(
    new DescribeLoadBalancersCommand({ LoadBalancerArns: [lbArn] }),
  );
  expect(describedLbs?.[0]?.State?.Code).toBe("active");

  // Step 2: CreateTargetGroup → RegisterTargets (instance + ip) → DescribeTargetHealth
  // Gap: initial → healthy transition not implemented; targets report healthy immediately
  const { TargetGroups: createdTgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: "scenario-target-tg",
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-scenario",
      TargetType: "ip",
    }),
  );
  const tg = createdTgs?.[0];
  expect(tg?.TargetGroupName).toBe("scenario-target-tg");
  const tgArn = tg?.TargetGroupArn ?? "";

  await client.send(
    new RegisterTargetsCommand({
      TargetGroupArn: tgArn,
      Targets: [
        { Id: "10.0.1.10", Port: 80 },
        { Id: "10.0.2.20", Port: 8080 },
      ],
    }),
  );

  const { TargetHealthDescriptions: health } = await client.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(health?.length).toBe(2);
  const registeredIds = health?.map((h) => h.Target?.Id) ?? [];
  expect(registeredIds).toContain("10.0.1.10");
  expect(registeredIds).toContain("10.0.2.20");
  expect(health?.every((h) => h.TargetHealth?.State === "healthy")).toBe(true);

  // Step 5: DescribeTargetHealth with Targets filter (specific target only)
  const { TargetHealthDescriptions: filtered } = await client.send(
    new DescribeTargetHealthCommand({
      TargetGroupArn: tgArn,
      Targets: [{ Id: "10.0.1.10", Port: 80 }],
    }),
  );
  expect(filtered?.length).toBe(1);
  expect(filtered?.[0]?.Target?.Id).toBe("10.0.1.10");
  expect(filtered?.[0]?.Target?.Port).toBe(80);
  expect(filtered?.[0]?.TargetHealth?.State).toBe("healthy");

  // Step 3: CreateListener (default forward → TG) → DescribeListeners + IsDefault rule assert
  const { Listeners: createdListeners } = await client.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const listener = createdListeners?.[0];
  expect(listener?.LoadBalancerArn).toBe(lbArn);
  expect(listener?.Protocol).toBe("HTTP");
  expect(listener?.Port).toBe(80);
  expect(listener?.DefaultActions?.[0]?.TargetGroupArn).toBe(tgArn);
  const listenerArn = listener?.ListenerArn ?? "";

  const { Listeners: describedListeners } = await client.send(
    new DescribeListenersCommand({ LoadBalancerArn: lbArn }),
  );
  expect(describedListeners?.length).toBe(1);
  expect(describedListeners?.[0]?.ListenerArn).toBe(listenerArn);

  const { Rules: defaultRules } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  const defaultRule = defaultRules?.find((r) => r.IsDefault);
  expect(defaultRule).toBeDefined();
  expect(defaultRule?.Priority).toBe("default");
  expect(defaultRule?.Actions?.[0]?.TargetGroupArn).toBe(tgArn);

  // Step 6: TG deletion with active listener forward → ResourceInUse (tier-22 regression)
  let tgInUseErr: unknown;
  try {
    await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  } catch (e) {
    tgInUseErr = e;
  }
  expect((tgInUseErr as { name?: string })?.name).toBe(
    "ResourceInUseException",
  );

  // Step 4: DeregisterTargets → removed from list
  // Gap: draining state not implemented; targets are removed immediately without draining period
  await client.send(
    new DeregisterTargetsCommand({
      TargetGroupArn: tgArn,
      Targets: [
        { Id: "10.0.1.10", Port: 80 },
        { Id: "10.0.2.20", Port: 8080 },
      ],
    }),
  );

  const { TargetHealthDescriptions: afterDeregister } = await client.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(afterDeregister?.length).toBe(0);

  // Cleanup
  await client.send(new DeleteListenerCommand({ ListenerArn: listenerArn }));
  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});
