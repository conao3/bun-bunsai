import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddListenerCertificatesCommand,
  AddTagsCommand,
  CreateListenerCommand,
  CreateLoadBalancerCommand,
  CreateRuleCommand,
  CreateTargetGroupCommand,
  CreateTrustStoreCommand,
  DeleteListenerCommand,
  DeleteLoadBalancerCommand,
  DeleteRuleCommand,
  DeleteTargetGroupCommand,
  DeleteTrustStoreCommand,
  DeregisterTargetsCommand,
  DescribeAccountLimitsCommand,
  DescribeListenerAttributesCommand,
  DescribeListenerCertificatesCommand,
  DescribeListenersCommand,
  DescribeLoadBalancerAttributesCommand,
  DescribeLoadBalancersCommand,
  DescribeRulesCommand,
  DescribeSSLPoliciesCommand,
  DescribeTagsCommand,
  DescribeTargetGroupAttributesCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  DescribeTrustStoresCommand,
  ElasticLoadBalancingV2Client,
  ModifyListenerAttributesCommand,
  ModifyListenerCommand,
  ModifyLoadBalancerAttributesCommand,
  ModifyRuleCommand,
  ModifyTargetGroupAttributesCommand,
  ModifyTargetGroupCommand,
  RegisterTargetsCommand,
  RemoveListenerCertificatesCommand,
  RemoveTagsCommand,
  SetIpAddressTypeCommand,
  SetRulePrioritiesCommand,
  SetSecurityGroupsCommand,
  SetSubnetsCommand,
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

test("ELBv2 rules round-trip", async () => {
  const client = elbv2();
  const lbName = "bunsai-e2e-rules-lb";
  const tgName = "bunsai-e2e-rules-tg";

  const { LoadBalancers: lbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: lbName,
      Subnets: ["subnet-aaaa1111"],
      Type: "application",
    }),
  );
  const lbArn = lbs?.[0]?.LoadBalancerArn ?? "";

  const { TargetGroups: tgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: tgName,
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tgArn = tgs?.[0]?.TargetGroupArn ?? "";

  const { Listeners: listeners } = await client.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const listenerArn = listeners?.[0]?.ListenerArn ?? "";

  const { Rules: created } = await client.send(
    new CreateRuleCommand({
      ListenerArn: listenerArn,
      Priority: 10,
      Conditions: [{ Field: "path-pattern", Values: ["/api/*"] }],
      Actions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const rule = created?.[0];
  expect(rule?.RuleArn).toContain("listener-rule");
  expect(rule?.Priority).toBe("10");
  expect(rule?.IsDefault).toBe(false);
  const ruleArn = rule?.RuleArn ?? "";

  const { Rules: described } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  expect(described?.some((r) => r.RuleArn === ruleArn)).toBe(true);

  const { Rules: modified } = await client.send(
    new ModifyRuleCommand({
      RuleArn: ruleArn,
      Conditions: [{ Field: "path-pattern", Values: ["/v2/*"] }],
    }),
  );
  expect(modified?.[0]?.Conditions?.[0]?.Values?.[0]).toBe("/v2/*");

  await client.send(
    new SetRulePrioritiesCommand({
      RulePriorities: [{ RuleArn: ruleArn, Priority: 20 }],
    }),
  );
  const { Rules: afterPriority } = await client.send(
    new DescribeRulesCommand({ RuleArns: [ruleArn] }),
  );
  expect(afterPriority?.[0]?.Priority).toBe("20");

  await client.send(new DeleteRuleCommand({ RuleArn: ruleArn }));
  const { Rules: afterDelete } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  expect(afterDelete?.some((r) => r.RuleArn === ruleArn)).toBe(false);

  await client.send(new DeleteListenerCommand({ ListenerArn: listenerArn }));
  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});

test("ELBv2 targets round-trip", async () => {
  const client = elbv2();
  const tgName = "bunsai-e2e-targets-tg";

  const { TargetGroups: tgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: tgName,
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tgArn = tgs?.[0]?.TargetGroupArn ?? "";

  await client.send(
    new RegisterTargetsCommand({
      TargetGroupArn: tgArn,
      Targets: [{ Id: "i-1234567890abcdef0", Port: 80 }],
    }),
  );

  const { TargetHealthDescriptions: health } = await client.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(health?.length).toBe(1);
  expect(health?.[0]?.Target?.Id).toBe("i-1234567890abcdef0");
  expect(health?.[0]?.TargetHealth?.State).toBe("healthy");

  await client.send(
    new DeregisterTargetsCommand({
      TargetGroupArn: tgArn,
      Targets: [{ Id: "i-1234567890abcdef0", Port: 80 }],
    }),
  );

  const { TargetHealthDescriptions: afterDeregister } = await client.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(afterDeregister?.length).toBe(0);

  const { Attributes: tgAttrs } = await client.send(
    new DescribeTargetGroupAttributesCommand({ TargetGroupArn: tgArn }),
  );
  expect(Array.isArray(tgAttrs)).toBe(true);

  await client.send(
    new ModifyTargetGroupAttributesCommand({
      TargetGroupArn: tgArn,
      Attributes: [
        { Key: "deregistration_delay.timeout_seconds", Value: "60" },
      ],
    }),
  );
  const { Attributes: afterModify } = await client.send(
    new DescribeTargetGroupAttributesCommand({ TargetGroupArn: tgArn }),
  );
  expect(
    afterModify?.find((a) => a.Key === "deregistration_delay.timeout_seconds")
      ?.Value,
  ).toBe("60");

  const { TargetGroups: modifiedTg } = await client.send(
    new ModifyTargetGroupCommand({
      TargetGroupArn: tgArn,
      HealthCheckEnabled: true,
    }),
  );
  expect(modifiedTg?.[0]?.HealthCheckEnabled).toBe(true);

  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
});

test("ELBv2 load balancer attributes and mutations", async () => {
  const client = elbv2();
  const lbName = "bunsai-e2e-attrs-lb";

  const { LoadBalancers: lbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: lbName,
      Subnets: ["subnet-aaaa1111"],
      Type: "application",
    }),
  );
  const lbArn = lbs?.[0]?.LoadBalancerArn ?? "";

  const { Attributes: attrs } = await client.send(
    new DescribeLoadBalancerAttributesCommand({ LoadBalancerArn: lbArn }),
  );
  expect(Array.isArray(attrs)).toBe(true);

  const { Attributes: modified } = await client.send(
    new ModifyLoadBalancerAttributesCommand({
      LoadBalancerArn: lbArn,
      Attributes: [{ Key: "idle_timeout.timeout_seconds", Value: "120" }],
    }),
  );
  expect(
    modified?.find((a) => a.Key === "idle_timeout.timeout_seconds")?.Value,
  ).toBe("120");

  const { IpAddressType } = await client.send(
    new SetIpAddressTypeCommand({
      LoadBalancerArn: lbArn,
      IpAddressType: "dualstack",
    }),
  );
  expect(IpAddressType).toBe("dualstack");

  const { SecurityGroupIds } = await client.send(
    new SetSecurityGroupsCommand({
      LoadBalancerArn: lbArn,
      SecurityGroups: ["sg-11111111", "sg-22222222"],
    }),
  );
  expect(SecurityGroupIds?.length).toBe(2);

  const { AvailabilityZones } = await client.send(
    new SetSubnetsCommand({
      LoadBalancerArn: lbArn,
      Subnets: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(Array.isArray(AvailabilityZones)).toBe(true);

  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});

test("ELBv2 listener attributes and certificates", async () => {
  const client = elbv2();
  const lbName = "bunsai-e2e-listattrs-lb";
  const tgName = "bunsai-e2e-listattrs-tg";

  const { LoadBalancers: lbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: lbName,
      Subnets: ["subnet-aaaa1111"],
      Type: "application",
    }),
  );
  const lbArn = lbs?.[0]?.LoadBalancerArn ?? "";

  const { TargetGroups: tgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: tgName,
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tgArn = tgs?.[0]?.TargetGroupArn ?? "";

  const { Listeners: listeners } = await client.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const listenerArn = listeners?.[0]?.ListenerArn ?? "";

  const { Attributes: listenerAttrs } = await client.send(
    new DescribeListenerAttributesCommand({ ListenerArn: listenerArn }),
  );
  expect(Array.isArray(listenerAttrs)).toBe(true);

  const { Attributes: modifiedAttrs } = await client.send(
    new ModifyListenerAttributesCommand({
      ListenerArn: listenerArn,
      Attributes: [{ Key: "tcp.idle_timeout.seconds", Value: "400" }],
    }),
  );
  expect(
    modifiedAttrs?.find((a) => a.Key === "tcp.idle_timeout.seconds")?.Value,
  ).toBe("400");

  const certArn = "arn:aws:acm:us-east-1:123456789012:certificate/test-cert";
  await client.send(
    new AddListenerCertificatesCommand({
      ListenerArn: listenerArn,
      Certificates: [{ CertificateArn: certArn }],
    }),
  );

  const { Certificates: certs } = await client.send(
    new DescribeListenerCertificatesCommand({ ListenerArn: listenerArn }),
  );
  expect(certs?.some((c) => c.CertificateArn === certArn)).toBe(true);

  await client.send(
    new RemoveListenerCertificatesCommand({
      ListenerArn: listenerArn,
      Certificates: [{ CertificateArn: certArn }],
    }),
  );
  const { Certificates: afterRemove } = await client.send(
    new DescribeListenerCertificatesCommand({ ListenerArn: listenerArn }),
  );
  expect(afterRemove?.some((c) => c.CertificateArn === certArn)).toBe(false);

  const { Listeners: modifiedListeners } = await client.send(
    new ModifyListenerCommand({
      ListenerArn: listenerArn,
      Port: 8080,
    }),
  );
  expect(modifiedListeners?.[0]?.Port).toBe(8080);

  await client.send(new DeleteListenerCommand({ ListenerArn: listenerArn }));

  const { Listeners: afterListenerDelete } = await client.send(
    new DescribeListenersCommand({ LoadBalancerArn: lbArn }),
  );
  expect(afterListenerDelete?.some((l) => l.ListenerArn === listenerArn)).toBe(
    false,
  );

  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});

test("ELBv2 tags round-trip", async () => {
  const client = elbv2();
  const lbName = "bunsai-e2e-tags-lb";

  const { LoadBalancers: lbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: lbName,
      Subnets: ["subnet-aaaa1111"],
      Type: "application",
    }),
  );
  const lbArn = lbs?.[0]?.LoadBalancerArn ?? "";

  await client.send(
    new AddTagsCommand({
      ResourceArns: [lbArn],
      Tags: [
        { Key: "Environment", Value: "test" },
        { Key: "Owner", Value: "bunsai" },
      ],
    }),
  );

  const { TagDescriptions } = await client.send(
    new DescribeTagsCommand({ ResourceArns: [lbArn] }),
  );
  const tags = TagDescriptions?.[0]?.Tags;
  expect(tags?.find((t) => t.Key === "Environment")?.Value).toBe("test");
  expect(tags?.find((t) => t.Key === "Owner")?.Value).toBe("bunsai");

  await client.send(
    new RemoveTagsCommand({
      ResourceArns: [lbArn],
      TagKeys: ["Owner"],
    }),
  );

  const { TagDescriptions: afterRemove } = await client.send(
    new DescribeTagsCommand({ ResourceArns: [lbArn] }),
  );
  const afterTags = afterRemove?.[0]?.Tags;
  expect(afterTags?.some((t) => t.Key === "Owner")).toBe(false);
  expect(afterTags?.find((t) => t.Key === "Environment")?.Value).toBe("test");

  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});

test("ELBv2 trust stores round-trip", async () => {
  const client = elbv2();
  const tsName = "bunsai-e2e-trust-store";

  const { TrustStores: created } = await client.send(
    new CreateTrustStoreCommand({
      Name: tsName,
      CaCertificatesBundleS3Bucket: "my-bucket",
      CaCertificatesBundleS3Key: "certs/bundle.pem",
    }),
  );
  const ts = created?.[0];
  expect(ts?.Name).toBe(tsName);
  expect(ts?.TrustStoreArn).toContain("truststore/");
  expect(ts?.Status).toBe("ACTIVE");
  const tsArn = ts?.TrustStoreArn ?? "";

  const { TrustStores: described } = await client.send(
    new DescribeTrustStoresCommand({ TrustStoreArns: [tsArn] }),
  );
  expect(described?.[0]?.TrustStoreArn).toBe(tsArn);

  const { TrustStores: byName } = await client.send(
    new DescribeTrustStoresCommand({ Names: [tsName] }),
  );
  expect(byName?.[0]?.TrustStoreArn).toBe(tsArn);

  await client.send(new DeleteTrustStoreCommand({ TrustStoreArn: tsArn }));

  const { TrustStores: afterDelete } = await client.send(
    new DescribeTrustStoresCommand({}),
  );
  expect(afterDelete?.some((t) => t.TrustStoreArn === tsArn)).toBe(false);
});

test("ELBv2 SSL policies and account limits", async () => {
  const client = elbv2();

  const { SslPolicies } = await client.send(new DescribeSSLPoliciesCommand({}));
  expect(Array.isArray(SslPolicies)).toBe(true);
  expect(SslPolicies?.length).toBeGreaterThan(0);
  expect(SslPolicies?.[0]?.Name).toBeTruthy();

  const { Limits } = await client.send(new DescribeAccountLimitsCommand({}));
  expect(Array.isArray(Limits)).toBe(true);
  expect(Limits?.length).toBeGreaterThan(0);
  expect(Limits?.[0]?.Name).toBeTruthy();
  expect(Limits?.[0]?.Max).toBeTruthy();
});
