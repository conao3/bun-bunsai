import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

test("ELBv2 fidelity bar: LB + TG + listener → targets health round-trip + rule CRUD", async () => {
  const client = elbv2();

  const { LoadBalancers: lbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: "bunsai-fidelity-lb",
      Subnets: ["subnet-aaaa1111"],
      Type: "application",
    }),
  );
  const lbArn = lbs?.[0]?.LoadBalancerArn ?? "";
  expect(lbArn).toContain("loadbalancer/app/");

  const { TargetGroups: tgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: "bunsai-fidelity-tg",
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tgArn = tgs?.[0]?.TargetGroupArn ?? "";
  expect(tgArn).toContain("targetgroup/");

  const { Listeners: listeners } = await client.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const listenerArn = listeners?.[0]?.ListenerArn ?? "";
  expect(listenerArn).toContain("listener/");

  await client.send(
    new RegisterTargetsCommand({
      TargetGroupArn: tgArn,
      Targets: [
        { Id: "i-aaa111", Port: 80 },
        { Id: "i-bbb222", Port: 80 },
      ],
    }),
  );

  const { TargetHealthDescriptions: health } = await client.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(health?.length).toBe(2);
  expect(health?.every((h) => h.TargetHealth?.State === "healthy")).toBe(true);

  await client.send(
    new DeregisterTargetsCommand({
      TargetGroupArn: tgArn,
      Targets: [{ Id: "i-aaa111", Port: 80 }],
    }),
  );

  const { TargetHealthDescriptions: afterDeregister } = await client.send(
    new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
  );
  expect(afterDeregister?.length).toBe(1);
  expect(afterDeregister?.[0]?.Target?.Id).toBe("i-bbb222");

  const { Rules: createdRules } = await client.send(
    new CreateRuleCommand({
      ListenerArn: listenerArn,
      Priority: 5,
      Conditions: [{ Field: "host-header", Values: ["api.example.com"] }],
      Actions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const ruleArn = createdRules?.[0]?.RuleArn ?? "";
  expect(ruleArn).toContain("listener-rule");
  expect(createdRules?.[0]?.Priority).toBe("5");

  const { Rules: listedRules } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  expect(listedRules?.some((r) => r.RuleArn === ruleArn)).toBe(true);

  await client.send(new DeleteRuleCommand({ RuleArn: ruleArn }));
  const { Rules: afterRuleDelete } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  expect(afterRuleDelete?.some((r) => r.RuleArn === ruleArn)).toBe(false);

  await client.send(new DeleteListenerCommand({ ListenerArn: listenerArn }));
  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});

test("ELBv2 target group attributes and health-check fidelity", async () => {
  const client = elbv2();

  const { TargetGroups: tgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: "bunsai-e2e-hc-fidelity-tg",
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tgArn = tgs?.[0]?.TargetGroupArn ?? "";

  const { TargetGroups: modified } = await client.send(
    new ModifyTargetGroupCommand({
      TargetGroupArn: tgArn,
      HealthCheckEnabled: true,
      HealthCheckProtocol: "HTTPS",
      HealthCheckPath: "/healthz",
      HealthCheckPort: "8443",
      HealthCheckIntervalSeconds: 15,
      HealthCheckTimeoutSeconds: 5,
      HealthyThresholdCount: 3,
      UnhealthyThresholdCount: 2,
    }),
  );
  expect(modified?.[0]?.HealthCheckProtocol).toBe("HTTPS");
  expect(modified?.[0]?.HealthCheckPath).toBe("/healthz");
  expect(modified?.[0]?.HealthCheckPort).toBe("8443");
  expect(modified?.[0]?.HealthCheckIntervalSeconds).toBe(15);
  expect(modified?.[0]?.HealthCheckTimeoutSeconds).toBe(5);
  expect(modified?.[0]?.HealthyThresholdCount).toBe(3);
  expect(modified?.[0]?.UnhealthyThresholdCount).toBe(2);

  const { TargetGroups: described } = await client.send(
    new DescribeTargetGroupsCommand({ TargetGroupArns: [tgArn] }),
  );
  expect(described?.[0]?.HealthCheckPath).toBe("/healthz");
  expect(described?.[0]?.HealthCheckIntervalSeconds).toBe(15);

  await client.send(
    new ModifyTargetGroupAttributesCommand({
      TargetGroupArn: tgArn,
      Attributes: [
        { Key: "stickiness.enabled", Value: "true" },
        { Key: "deregistration_delay.timeout_seconds", Value: "120" },
      ],
    }),
  );
  const { Attributes } = await client.send(
    new DescribeTargetGroupAttributesCommand({ TargetGroupArn: tgArn }),
  );
  expect(Attributes?.find((a) => a.Key === "stickiness.enabled")?.Value).toBe(
    "true",
  );
  expect(
    Attributes?.find((a) => a.Key === "deregistration_delay.timeout_seconds")
      ?.Value,
  ).toBe("120");

  let tgNotFoundErr: unknown;
  try {
    await client.send(
      new DescribeTargetGroupsCommand({
        TargetGroupArns: [
          "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/nonexistent/abcdef",
        ],
      }),
    );
  } catch (e) {
    tgNotFoundErr = e;
  }
  expect((tgNotFoundErr as { name?: string })?.name).toBe(
    "TargetGroupNotFoundException",
  );

  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
});

test("ELBv2 listener rule conditions, priority, and errors", async () => {
  const client = elbv2();

  const { LoadBalancers: lbs } = await client.send(
    new CreateLoadBalancerCommand({
      Name: "bunsai-e2e-rule-fidelity-lb",
      Subnets: ["subnet-aabbccdd"],
    }),
  );
  const lbArn = lbs?.[0]?.LoadBalancerArn ?? "";

  const { TargetGroups: tgs } = await client.send(
    new CreateTargetGroupCommand({
      Name: "bunsai-e2e-rule-fidelity-tg",
      Protocol: "HTTP",
      Port: 80,
      VpcId: "vpc-12345678",
      TargetType: "instance",
    }),
  );
  const tgArn = tgs?.[0]?.TargetGroupArn ?? "";

  const { Listeners } = await client.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const listenerArn = Listeners?.[0]?.ListenerArn ?? "";

  const { Rules: r30 } = await client.send(
    new CreateRuleCommand({
      ListenerArn: listenerArn,
      Priority: 30,
      Conditions: [{ Field: "path-pattern", Values: ["/api/*"] }],
      Actions: [{ Type: "forward", TargetGroupArn: tgArn }],
    }),
  );
  const rule30Arn = r30?.[0]?.RuleArn ?? "";
  expect(r30?.[0]?.Priority).toBe("30");
  expect(r30?.[0]?.Conditions?.[0]?.Field).toBe("path-pattern");

  const { Rules: r10 } = await client.send(
    new CreateRuleCommand({
      ListenerArn: listenerArn,
      Priority: 10,
      Conditions: [
        { Field: "host-header", Values: ["api.example.com"] },
        { Field: "path-pattern", Values: ["/v2/*"] },
      ],
      Actions: [
        {
          Type: "fixed-response",
          FixedResponseConfig: {
            StatusCode: "200",
            MessageBody: "ok",
            ContentType: "text/plain",
          },
        },
      ],
    }),
  );
  const rule10Arn = r10?.[0]?.RuleArn ?? "";
  expect(r10?.[0]?.Priority).toBe("10");
  expect(r10?.[0]?.Conditions?.length).toBe(2);

  const { Rules: byPriority } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  const priorities = byPriority?.map((r) => r.Priority) ?? [];
  expect(priorities.indexOf("10")).toBeLessThan(priorities.indexOf("30"));

  await client.send(
    new SetRulePrioritiesCommand({
      RulePriorities: [
        { RuleArn: rule10Arn, Priority: 50 },
        { RuleArn: rule30Arn, Priority: 5 },
      ],
    }),
  );
  const { Rules: reordered } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  const reorderedPriorities = reordered?.map((r) => r.Priority) ?? [];
  expect(reorderedPriorities.indexOf("5")).toBeLessThan(
    reorderedPriorities.indexOf("50"),
  );

  let priorityInUseErr: unknown;
  try {
    await client.send(
      new CreateRuleCommand({
        ListenerArn: listenerArn,
        Priority: 5,
        Conditions: [{ Field: "path-pattern", Values: ["/duplicate/*"] }],
        Actions: [{ Type: "forward", TargetGroupArn: tgArn }],
      }),
    );
  } catch (e) {
    priorityInUseErr = e;
  }
  expect((priorityInUseErr as { name?: string })?.name).toBe(
    "PriorityInUseException",
  );

  let ruleNotFoundErr: unknown;
  try {
    await client.send(
      new DescribeRulesCommand({
        RuleArns: [
          "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener-rule/app/nonexistent/aabbccdd/11223344",
        ],
      }),
    );
  } catch (e) {
    ruleNotFoundErr = e;
  }
  expect((ruleNotFoundErr as { name?: string })?.name).toBe(
    "RuleNotFoundException",
  );

  await client.send(new DeleteRuleCommand({ RuleArn: rule10Arn }));
  await client.send(new DeleteRuleCommand({ RuleArn: rule30Arn }));
  const { Rules: afterDelete } = await client.send(
    new DescribeRulesCommand({ ListenerArn: listenerArn }),
  );
  expect(afterDelete?.some((r) => r.RuleArn === rule10Arn)).toBe(false);
  expect(afterDelete?.some((r) => r.RuleArn === rule30Arn)).toBe(false);

  await client.send(new DeleteListenerCommand({ ListenerArn: listenerArn }));
  await client.send(new DeleteTargetGroupCommand({ TargetGroupArn: tgArn }));
  await client.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: lbArn }));
});
