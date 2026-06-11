import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddThingToThingGroupCommand,
  AttachPolicyCommand,
  AttachThingPrincipalCommand,
  CreateKeysAndCertificateCommand,
  CreatePolicyCommand,
  CreateThingCommand,
  CreateThingGroupCommand,
  CreateThingTypeCommand,
  CreateTopicRuleCommand,
  DeleteCertificateCommand,
  DeletePolicyCommand,
  DeleteThingCommand,
  DeleteTopicRuleCommand,
  DeprecateThingTypeCommand,
  DescribeCertificateCommand,
  DescribeEndpointCommand,
  DescribeThingCommand,
  DescribeThingGroupCommand,
  DescribeThingTypeCommand,
  DetachPolicyCommand,
  DetachThingPrincipalCommand,
  DisableTopicRuleCommand,
  EnableTopicRuleCommand,
  GetPolicyCommand,
  GetTopicRuleCommand,
  IoTClient,
  ListAttachedPoliciesCommand,
  ListCertificatesCommand,
  ListPoliciesCommand,
  ListThingGroupsForThingCommand,
  ListThingPrincipalsCommand,
  ListThingsCommand,
  ListThingsInThingGroupCommand,
  ListTopicRulesCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateCertificateCommand,
  UpdateThingCommand,
} from "@aws-sdk/client-iot";
import {
  IoTDataPlaneClient,
  DeleteThingShadowCommand,
  GetThingShadowCommand,
  ListNamedShadowsForThingCommand,
  UpdateThingShadowCommand,
} from "@aws-sdk/client-iot-data-plane";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iot = () =>
  new IoTClient({ endpoint, region, credentials, requestHandler });

const iotData = () =>
  new IoTDataPlaneClient({ endpoint, region, credentials, requestHandler });

const suffix = () => Date.now().toString(36);

// === Thing CRUD ===

test("IoT thing lifecycle", async () => {
  const client = iot();
  const thingName = `bunsai_e2e_thing_${suffix()}`;

  const created = await client.send(new CreateThingCommand({ thingName }));
  expect(created.thingName).toBe(thingName);
  expect(created.thingArn).toContain(`thing/${thingName}`);

  const described = await client.send(new DescribeThingCommand({ thingName }));
  expect(described.thingName).toBe(thingName);
  expect(described.version).toBe(1);

  await client.send(
    new UpdateThingCommand({
      thingName,
      attributePayload: { attributes: { color: "red" }, merge: true },
    }),
  );

  const updated = await client.send(new DescribeThingCommand({ thingName }));
  expect(updated.attributes?.color).toBe("red");
  expect(updated.version).toBe(2);

  const listed = await client.send(new ListThingsCommand({}));
  expect(listed.things?.some((t) => t.thingName === thingName)).toBe(true);

  await client.send(new DeleteThingCommand({ thingName }));
  const listed2 = await client.send(new ListThingsCommand({}));
  expect(listed2.things?.some((t) => t.thingName === thingName)).toBe(false);
});

// === ThingType ===

test("IoT ThingType lifecycle", async () => {
  const client = iot();
  const thingTypeName = `bunsai_e2e_type_${suffix()}`;

  const created = await client.send(
    new CreateThingTypeCommand({
      thingTypeName,
      thingTypeProperties: { thingTypeDescription: "e2e type" },
    }),
  );
  expect(created.thingTypeName).toBe(thingTypeName);
  expect(created.thingTypeArn).toContain(`thingtype/${thingTypeName}`);

  const described = await client.send(
    new DescribeThingTypeCommand({ thingTypeName }),
  );
  expect(described.thingTypeProperties?.thingTypeDescription).toBe("e2e type");
  expect(described.thingTypeMetadata?.deprecated).toBe(false);

  await client.send(new DeprecateThingTypeCommand({ thingTypeName }));
  const after = await client.send(
    new DescribeThingTypeCommand({ thingTypeName }),
  );
  expect(after.thingTypeMetadata?.deprecated).toBe(true);
});

// === ThingGroup ===

test("IoT ThingGroup + membership", async () => {
  const client = iot();
  const groupName = `bunsai_e2e_group_${suffix()}`;
  const thingName = `bunsai_e2e_gtest_${suffix()}`;

  await client.send(new CreateThingGroupCommand({ thingGroupName: groupName }));
  await client.send(new CreateThingCommand({ thingName }));

  const described = await client.send(
    new DescribeThingGroupCommand({ thingGroupName: groupName }),
  );
  expect(described.thingGroupName).toBe(groupName);

  await client.send(
    new AddThingToThingGroupCommand({ thingGroupName: groupName, thingName }),
  );

  const inGroup = await client.send(
    new ListThingsInThingGroupCommand({ thingGroupName: groupName }),
  );
  expect(inGroup.things).toContain(thingName);

  const groups = await client.send(
    new ListThingGroupsForThingCommand({ thingName }),
  );
  expect(groups.thingGroups?.some((g) => g.groupName === groupName)).toBe(true);
});

// === Registry roundtrip: thing + cert + policy ===

test("IoT registry roundtrip: thing + cert + policy", async () => {
  const client = iot();
  const thingName = `bunsai_e2e_reg_${suffix()}`;
  const policyName = `bunsai_e2e_pol_${suffix()}`;

  await client.send(new CreateThingCommand({ thingName }));

  const cert = await client.send(
    new CreateKeysAndCertificateCommand({ setAsActive: true }),
  );
  expect(cert.certificateArn).toContain("cert/");
  expect(cert.certificatePem).toContain("-----BEGIN CERTIFICATE-----");
  expect(cert.keyPair?.PrivateKey).toContain("-----BEGIN RSA PRIVATE KEY-----");

  const certId = cert.certificateId!;
  const certArn = cert.certificateArn!;

  const described = await client.send(
    new DescribeCertificateCommand({ certificateId: certId }),
  );
  expect(described.certificateDescription?.status).toBe("ACTIVE");

  const policy = await client.send(
    new CreatePolicyCommand({
      policyName,
      policyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  expect(policy.policyArn).toContain(`policy/${policyName}`);

  await client.send(new AttachPolicyCommand({ policyName, target: certArn }));

  await client.send(
    new AttachThingPrincipalCommand({ thingName, principal: certArn }),
  );

  const attached = await client.send(
    new ListAttachedPoliciesCommand({ target: certArn }),
  );
  expect(attached.policies?.some((p) => p.policyName === policyName)).toBe(
    true,
  );

  const principals = await client.send(
    new ListThingPrincipalsCommand({ thingName }),
  );
  expect(principals.principals).toContain(certArn);

  // delete guard: cert with attached policy cannot be deleted
  await expect(
    client.send(new DeleteCertificateCommand({ certificateId: certId })),
  ).rejects.toThrow();

  // delete guard: policy with attachments cannot be deleted
  await expect(
    client.send(new DeletePolicyCommand({ policyName })),
  ).rejects.toThrow();

  // detach then cleanup
  await client.send(new DetachPolicyCommand({ policyName, target: certArn }));
  await client.send(
    new DetachThingPrincipalCommand({ thingName, principal: certArn }),
  );
  await client.send(
    new UpdateCertificateCommand({
      certificateId: certId,
      newStatus: "INACTIVE",
    }),
  );
  await client.send(new DeleteCertificateCommand({ certificateId: certId }));

  const certs = await client.send(new ListCertificatesCommand({}));
  expect(certs.certificates?.some((c) => c.certificateId === certId)).toBe(
    false,
  );

  await client.send(new DeletePolicyCommand({ policyName }));
  const policies = await client.send(new ListPoliciesCommand({}));
  expect(policies.policies?.some((p) => p.policyName === policyName)).toBe(
    false,
  );
});

// === Certificate list ===

test("IoT ListCertificates", async () => {
  const client = iot();
  const c = await client.send(new CreateKeysAndCertificateCommand({}));
  const list = await client.send(new ListCertificatesCommand({}));
  expect(
    list.certificates?.some((x) => x.certificateId === c.certificateId),
  ).toBe(true);
});

// === Policy operations ===

test("IoT GetPolicy", async () => {
  const client = iot();
  const policyName = `bunsai_e2e_gp_${suffix()}`;
  await client.send(
    new CreatePolicyCommand({
      policyName,
      policyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  const got = await client.send(new GetPolicyCommand({ policyName }));
  expect(got.policyName).toBe(policyName);
  expect(got.defaultVersionId).toBe("1");
});

// === TopicRule ===

test("IoT TopicRule lifecycle", async () => {
  const client = iot();
  const ruleName = `bunsai_e2e_rule_${suffix()}`;

  await client.send(
    new CreateTopicRuleCommand({
      ruleName,
      topicRulePayload: {
        sql: "SELECT * FROM 'topic/test'",
        actions: [],
      },
    }),
  );

  const got = await client.send(new GetTopicRuleCommand({ ruleName }));
  expect(got.rule?.ruleName).toBe(ruleName);
  expect(got.rule?.ruleDisabled).toBe(false);

  const listed = await client.send(new ListTopicRulesCommand({}));
  expect(listed.rules?.some((r) => r.ruleName === ruleName)).toBe(true);

  await client.send(new DisableTopicRuleCommand({ ruleName }));
  const disabled = await client.send(new GetTopicRuleCommand({ ruleName }));
  expect(disabled.rule?.ruleDisabled).toBe(true);

  await client.send(new EnableTopicRuleCommand({ ruleName }));
  const enabled = await client.send(new GetTopicRuleCommand({ ruleName }));
  expect(enabled.rule?.ruleDisabled).toBe(false);

  await client.send(new DeleteTopicRuleCommand({ ruleName }));
});

// === DescribeEndpoint ===

test("IoT DescribeEndpoint", async () => {
  const client = iot();
  const res = await client.send(new DescribeEndpointCommand({}));
  expect(res.endpointAddress).toMatch(/\.iot\.us-east-1\.amazonaws\.com$/);
});

// === Tags ===

test("IoT tags", async () => {
  const client = iot();
  const thingName = `bunsai_e2e_tags_${suffix()}`;
  await client.send(new CreateThingCommand({ thingName }));

  const thingArn = `arn:aws:iot:us-east-1:000000000000:thing/${thingName}`;

  await client.send(
    new TagResourceCommand({
      resourceArn: thingArn,
      tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );

  await client.send(
    new UntagResourceCommand({ resourceArn: thingArn, tagKeys: ["owner"] }),
  );
});

// === Shadow: update → get with delta + version ===

test("IoT shadow: update → get with delta and version", async () => {
  const client = iotData();
  const thingName = `bunsai_e2e_shadow_${suffix()}`;

  const update1 = await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(
        JSON.stringify({
          state: { desired: { temp: 25, humidity: 60 } },
        }),
      ),
    }),
  );
  const doc1 = JSON.parse(new TextDecoder().decode(update1.payload));
  expect(doc1.version).toBe(1);
  expect(doc1.state.desired.temp).toBe(25);

  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(
        JSON.stringify({
          state: { reported: { temp: 20 } },
        }),
      ),
    }),
  );

  const get = await client.send(new GetThingShadowCommand({ thingName }));
  const doc = JSON.parse(new TextDecoder().decode(get.payload));
  expect(doc.version).toBe(2);
  expect(doc.state.desired.temp).toBe(25);
  expect(doc.state.reported.temp).toBe(20);
  expect(doc.state.delta?.temp).toBe(25);
  expect(doc.state.delta?.humidity).toBe(60);

  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(
        JSON.stringify({
          state: { reported: { temp: 25, humidity: 60 } },
        }),
      ),
    }),
  );

  const get2 = await client.send(new GetThingShadowCommand({ thingName }));
  const doc2 = JSON.parse(new TextDecoder().decode(get2.payload));
  expect(doc2.state.delta).toBeUndefined();
});

// === Named shadows ===

test("IoT named shadows", async () => {
  const client = iotData();
  const thingName = `bunsai_e2e_named_${suffix()}`;
  const shadowName = "config";

  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      shadowName,
      payload: new TextEncoder().encode(
        JSON.stringify({ state: { desired: { mode: "auto" } } }),
      ),
    }),
  );

  const got = await client.send(
    new GetThingShadowCommand({ thingName, shadowName }),
  );
  const doc = JSON.parse(new TextDecoder().decode(got.payload));
  expect(doc.state.desired.mode).toBe("auto");
  expect(doc.version).toBe(1);

  const list = await client.send(
    new ListNamedShadowsForThingCommand({ thingName }),
  );
  expect(list.results).toContain(shadowName);

  await client.send(new DeleteThingShadowCommand({ thingName, shadowName }));

  await expect(
    client.send(new GetThingShadowCommand({ thingName, shadowName })),
  ).rejects.toThrow();
});

// === Shadow delete guard: not found ===

test("IoT shadow delete non-existent throws", async () => {
  const client = iotData();
  await expect(
    client.send(
      new DeleteThingShadowCommand({
        thingName: `no_such_thing_${suffix()}`,
      }),
    ),
  ).rejects.toThrow();
});
