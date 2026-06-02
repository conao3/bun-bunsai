import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateListenerCommand,
  CreateLoadBalancerCommand,
  CreateTargetGroupCommand,
  DeleteLoadBalancerCommand,
  DeleteTargetGroupCommand,
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  ElasticLoadBalancingV2Client,
} from "@aws-sdk/client-elastic-load-balancing-v2";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const elbv2 = () =>
  new ElasticLoadBalancingV2Client({ endpoint, region, credentials });

test("ELBv2 load balancer / target group / listener round-trip", async () => {
  const client = elbv2();
  const lbName = "bunsai-e2e-lb";
  const tgName = "bunsai-e2e-tg";

  const createdLb = await client.send(
    new CreateLoadBalancerCommand({
      Name: lbName,
      Subnets: ["subnet-aaaa1111", "subnet-bbbb2222"],
      Scheme: "internet-facing",
      Type: "application",
    }),
  );
  const lb = createdLb.LoadBalancers?.[0];
  expect(lb?.LoadBalancerName).toBe(lbName);
  expect(lb?.LoadBalancerArn).toContain("loadbalancer/app/");
  expect(lb?.State?.Code).toBe("active");
  expect(lb?.DNSName).toContain(lbName);
  const lbArn = lb?.LoadBalancerArn ?? "";

  const describedLb = await client.send(
    new DescribeLoadBalancersCommand({ LoadBalancerArns: [lbArn] }),
  );
  expect(describedLb.LoadBalancers?.length).toBe(1);
  expect(describedLb.LoadBalancers?.[0]?.LoadBalancerName).toBe(lbName);

  const describedByName = await client.send(
    new DescribeLoadBalancersCommand({ Names: [lbName] }),
  );
  expect(describedByName.LoadBalancers?.[0]?.LoadBalancerArn).toBe(lbArn);

  const createdTg = await client.send(
    new CreateTargetGroupCommand({
      Name: tgName,
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tg = createdTg.TargetGroups?.[0];
  expect(tg?.TargetGroupName).toBe(tgName);
  expect(tg?.TargetGroupArn).toContain("targetgroup/");
  expect(tg?.Protocol).toBe("HTTP");
  expect(tg?.Port).toBe(80);
  const tgArn = tg?.TargetGroupArn ?? "";

  const describedTg = await client.send(
    new DescribeTargetGroupsCommand({ TargetGroupArns: [tgArn] }),
  );
  expect(describedTg.TargetGroups?.length).toBe(1);
  expect(describedTg.TargetGroups?.[0]?.TargetGroupName).toBe(tgName);

  const createdListener = await client.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const listener = createdListener.Listeners?.[0];
  expect(listener?.LoadBalancerArn).toBe(lbArn);
  expect(listener?.Port).toBe(80);
  expect(listener?.Protocol).toBe("HTTP");
  expect(listener?.DefaultActions?.[0]?.TargetGroupArn).toBe(tgArn);
  const listenerArn = listener?.ListenerArn ?? "";

  const describedListeners = await client.send(
    new DescribeListenersCommand({ LoadBalancerArn: lbArn }),
  );
  expect(describedListeners.Listeners?.length).toBe(1);
  expect(describedListeners.Listeners?.[0]?.ListenerArn).toBe(listenerArn);

  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));

  const remaining = await client.send(new DescribeLoadBalancersCommand({}));
  expect(
    remaining.LoadBalancers?.some((entry) => entry.LoadBalancerArn === lbArn),
  ).toBe(false);
});
