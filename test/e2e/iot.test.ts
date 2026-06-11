import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddThingToThingGroupCommand,
  AttachPolicyCommand,
  AttachPrincipalPolicyCommand,
  AttachThingPrincipalCommand,
  CreateKeysAndCertificateCommand,
  CreatePolicyCommand,
  CreatePolicyVersionCommand,
  CreateThingCommand,
  CreateThingGroupCommand,
  CreateThingTypeCommand,
  CreateTopicRuleCommand,
  DeleteCertificateCommand,
  DeletePolicyCommand,
  DeletePolicyVersionCommand,
  DeleteThingCommand,
  DeleteThingGroupCommand,
  DeleteTopicRuleCommand,
  DeprecateThingTypeCommand,
  DescribeCertificateCommand,
  DescribeEndpointCommand,
  DescribeThingCommand,
  DescribeThingGroupCommand,
  DescribeThingTypeCommand,
  DetachPolicyCommand,
  DetachPrincipalPolicyCommand,
  DetachThingPrincipalCommand,
  DisableTopicRuleCommand,
  EnableTopicRuleCommand,
  GetPolicyCommand,
  GetPolicyVersionCommand,
  GetTopicRuleCommand,
  IoTClient,
  ListAttachedPoliciesCommand,
  ListCertificatesCommand,
  ListPoliciesCommand,
  ListPolicyVersionsCommand,
  ListThingGroupsForThingCommand,
  ListThingPrincipalsCommand,
  ListThingsCommand,
  ListThingsInThingGroupCommand,
  ListTopicRulesCommand,
  SetDefaultPolicyVersionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateCertificateCommand,
  UpdateThingCommand,
} from "@aws-sdk/client-iot";
import {
  IoTDataPlaneClient,
  DeleteConnectionCommand,
  DeleteThingShadowCommand,
  GetConnectionCommand,
  GetRetainedMessageCommand,
  GetThingShadowCommand,
  ListNamedShadowsForThingCommand,
  ListRetainedMessagesCommand,
  ListSubscriptionsCommand,
  PublishCommand,
  SendDirectMessageCommand,
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

// === IOT-02: CreateThing duplicate returns 409 ===

test("IOT-02: CreateThing duplicate throws ResourceAlreadyExistsException", async () => {
  const client = iot();
  const thingName = `bunsai_e2e_dup_${suffix()}`;
  await client.send(new CreateThingCommand({ thingName }));
  await expect(
    client.send(new CreateThingCommand({ thingName })),
  ).rejects.toMatchObject({ name: "ResourceAlreadyExistsException" });
});

// === IOT-03: DeleteCertificate ACTIVE guard ===

test("IOT-03: DeleteCertificate on ACTIVE cert throws CertificateStateException", async () => {
  const client = iot();
  const cert = await client.send(
    new CreateKeysAndCertificateCommand({ setAsActive: true }),
  );
  const certId = cert.certificateId!;
  await expect(
    client.send(new DeleteCertificateCommand({ certificateId: certId })),
  ).rejects.toMatchObject({ name: "CertificateStateException" });
  await client.send(
    new UpdateCertificateCommand({
      certificateId: certId,
      newStatus: "INACTIVE",
    }),
  );
  await client.send(new DeleteCertificateCommand({ certificateId: certId }));
  const list = await client.send(new ListCertificatesCommand({}));
  expect(list.certificates?.some((c) => c.certificateId === certId)).toBe(
    false,
  );
});

// === IOT-04: DeleteThing with principal attached ===

test("IOT-04: DeleteThing with attached principal throws, cleans group membership after detach", async () => {
  const client = iot();
  const thingName = `bunsai_e2e_del_${suffix()}`;
  const groupName = `bunsai_e2e_delg_${suffix()}`;
  const policyName = `bunsai_e2e_delpol_${suffix()}`;
  const cert = await client.send(new CreateKeysAndCertificateCommand({}));
  const certArn = cert.certificateArn!;
  const certId = cert.certificateId!;
  await client.send(new CreateThingCommand({ thingName }));
  await client.send(new CreateThingGroupCommand({ thingGroupName: groupName }));
  await client.send(
    new AttachThingPrincipalCommand({ thingName, principal: certArn }),
  );
  await expect(
    client.send(new DeleteThingCommand({ thingName })),
  ).rejects.toMatchObject({ name: "InvalidRequestException" });
  await client.send(
    new DetachThingPrincipalCommand({ thingName, principal: certArn }),
  );
  await client.send(
    new AddThingToThingGroupCommand({ thingGroupName: groupName, thingName }),
  );
  await client.send(new DeleteThingCommand({ thingName }));
  const inGroup = await client.send(
    new ListThingsInThingGroupCommand({ thingGroupName: groupName }),
  );
  expect(inGroup.things).not.toContain(thingName);
  await client.send(
    new UpdateCertificateCommand({
      certificateId: certId,
      newStatus: "INACTIVE",
    }),
  );
  await client.send(new DeleteCertificateCommand({ certificateId: certId }));
  await client.send(
    new CreatePolicyCommand({
      policyName,
      policyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  await client.send(new DeleteThingGroupCommand({ thingGroupName: groupName }));
  await client.send(new DeletePolicyCommand({ policyName }));
});

// === IOT-01: Policy versions lifecycle ===

test("IOT-01: Policy versions lifecycle + legacy AttachPrincipalPolicy", async () => {
  const client = iot();
  const policyName = `bunsai_e2e_polv_${suffix()}`;
  const cert = await client.send(
    new CreateKeysAndCertificateCommand({ setAsActive: false }),
  );
  const certArn = cert.certificateArn!;
  const certId = cert.certificateId!;
  await client.send(
    new CreatePolicyCommand({
      policyName,
      policyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  const v2 = await client.send(
    new CreatePolicyVersionCommand({
      policyName,
      policyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
      }),
      setAsDefault: false,
    }),
  );
  expect(v2.policyVersionId).toBe("2");
  const got = await client.send(
    new GetPolicyVersionCommand({ policyName, policyVersionId: "2" }),
  );
  expect(got.policyVersionId).toBe("2");
  expect(got.isDefaultVersion).toBe(false);
  const list = await client.send(new ListPolicyVersionsCommand({ policyName }));
  expect(list.policyVersions?.length).toBe(2);
  await client.send(
    new SetDefaultPolicyVersionCommand({ policyName, policyVersionId: "2" }),
  );
  const policy = await client.send(new GetPolicyCommand({ policyName }));
  expect(policy.defaultVersionId).toBe("2");
  await client.send(
    new DeletePolicyVersionCommand({ policyName, policyVersionId: "1" }),
  );
  const list2 = await client.send(
    new ListPolicyVersionsCommand({ policyName }),
  );
  expect(list2.policyVersions?.length).toBe(1);
  await client.send(
    new AttachPrincipalPolicyCommand({ policyName, principal: certArn }),
  );
  await client.send(
    new DetachPrincipalPolicyCommand({ policyName, principal: certArn }),
  );
  await client.send(new DeleteCertificateCommand({ certificateId: certId }));
  await client.send(new DeletePolicyCommand({ policyName }));
});

// === IOT-05: VersionConflictException ===

test("IOT-05: UpdateThing with wrong expectedVersion throws VersionConflictException", async () => {
  const client = iot();
  const thingName = `bunsai_e2e_ver_${suffix()}`;
  await client.send(new CreateThingCommand({ thingName }));
  await expect(
    client.send(
      new UpdateThingCommand({
        thingName,
        expectedVersion: 99,
        attributePayload: { attributes: {} },
      }),
    ),
  ).rejects.toMatchObject({ name: "VersionConflictException" });
  await client.send(new DeleteThingCommand({ thingName }));
});

// === IOT-07: maxResults pagination ===

test("IOT-07: maxResults limits ListThings page size", async () => {
  const client = iot();
  const prefix = `bunsai_e2e_page_${suffix()}`;
  const names = Array.from({ length: 3 }, (_, i) => `${prefix}_${i}`);
  for (const n of names)
    await client.send(new CreateThingCommand({ thingName: n }));
  const page = await client.send(new ListThingsCommand({ maxResults: 2 }));
  expect(page.things?.length ?? 0).toBeLessThanOrEqual(2);
  for (const n of names)
    await client.send(new DeleteThingCommand({ thingName: n }));
});

// === IOT-08: ListThings filters ===

test("IOT-08: ListThings thingTypeName filter", async () => {
  const client = iot();
  const s = suffix();
  const typeName = `bunsai_e2e_ftype_${s}`;
  const thingA = `bunsai_e2e_fa_${s}`;
  const thingB = `bunsai_e2e_fb_${s}`;
  await client.send(new CreateThingTypeCommand({ thingTypeName: typeName }));
  await client.send(
    new CreateThingCommand({ thingName: thingA, thingTypeName: typeName }),
  );
  await client.send(new CreateThingCommand({ thingName: thingB }));
  const filtered = await client.send(
    new ListThingsCommand({ thingTypeName: typeName }),
  );
  expect(filtered.things?.some((t) => t.thingName === thingA)).toBe(true);
  expect(filtered.things?.some((t) => t.thingName === thingB)).toBe(false);
  await client.send(new DeleteThingCommand({ thingName: thingA }));
  await client.send(new DeleteThingCommand({ thingName: thingB }));
});

// === IOTDATA-001/002: Publish retain + GetRetainedMessage + ListRetainedMessages ===

test("IOTDATA-001/002: retained message lifecycle via Publish/Get/List", async () => {
  const client = iotData();
  const topic = `bunsai/e2e/retained/${suffix()}`;

  await client.send(
    new PublishCommand({
      topic,
      retain: true,
      qos: 1,
      payload: new TextEncoder().encode("hello"),
    }),
  );

  const got = await client.send(new GetRetainedMessageCommand({ topic }));
  expect(got.topic).toBe(topic);
  expect(new TextDecoder().decode(got.payload as Uint8Array)).toBe("hello");
  expect(got.qos).toBe(1);

  const list = await client.send(new ListRetainedMessagesCommand({}));
  expect(list.retainedTopics?.some((r) => r.topic === topic)).toBe(true);

  await client.send(
    new PublishCommand({ topic, retain: true, payload: new Uint8Array(0) }),
  );

  await expect(
    client.send(new GetRetainedMessageCommand({ topic })),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  const list2 = await client.send(new ListRetainedMessagesCommand({}));
  expect(list2.retainedTopics?.some((r) => r.topic === topic)).toBe(false);
});

// === IOTDATA-002: Publish invalid qos rejected ===

test("IOTDATA-002: Publish with qos=2 is rejected", async () => {
  const client = iotData();
  await expect(
    client.send(
      new PublishCommand({
        topic: `bunsai/e2e/qos/${suffix()}`,
        qos: 2 as unknown as 0 | 1,
        payload: new TextEncoder().encode("x"),
      }),
    ),
  ).rejects.toThrow();
});

// === IOTDATA-003: UpdateThingShadow version conflict ===

test("IOTDATA-003: UpdateThingShadow version conflict throws ConflictException", async () => {
  const client = iotData();
  const thingName = `bunsai_e2e_ver_${suffix()}`;

  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(
        JSON.stringify({ state: { desired: { x: 1 } } }),
      ),
    }),
  );
  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(
        JSON.stringify({ state: { desired: { x: 2 } } }),
      ),
    }),
  );

  await expect(
    client.send(
      new UpdateThingShadowCommand({
        thingName,
        payload: new TextEncoder().encode(
          JSON.stringify({ state: { desired: { x: 3 } }, version: 1 }),
        ),
      }),
    ),
  ).rejects.toMatchObject({ name: "ConflictException" });

  const got = await client.send(new GetThingShadowCommand({ thingName }));
  const doc = JSON.parse(new TextDecoder().decode(got.payload as Uint8Array));
  expect(doc.version).toBe(2);
});

// === IOTDATA-004: UpdateThingShadow invalid payload ===

test("IOTDATA-004: UpdateThingShadow missing state throws InvalidRequestException", async () => {
  const client = iotData();
  const thingName = `bunsai_e2e_inv_${suffix()}`;

  await expect(
    client.send(
      new UpdateThingShadowCommand({
        thingName,
        payload: new TextEncoder().encode(JSON.stringify({ desired: {} })),
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidRequestException" });
});

// === IOTDATA-005: ListNamedShadowsForThing pagination ===

test("IOTDATA-005: ListNamedShadowsForThing pagination", async () => {
  const client = iotData();
  const thingName = `bunsai_e2e_pag_${suffix()}`;
  const shadows = ["alpha", "beta", "gamma", "delta", "epsilon"];

  for (const name of shadows) {
    await client.send(
      new UpdateThingShadowCommand({
        thingName,
        shadowName: name,
        payload: new TextEncoder().encode(
          JSON.stringify({ state: { desired: { v: 1 } } }),
        ),
      }),
    );
  }

  const page1 = await client.send(
    new ListNamedShadowsForThingCommand({ thingName, pageSize: 3 }),
  );
  expect(page1.results?.length).toBe(3);
  expect(page1.nextToken).toBeTruthy();

  const page2 = await client.send(
    new ListNamedShadowsForThingCommand({
      thingName,
      pageSize: 3,
      nextToken: page1.nextToken,
    }),
  );
  expect(page2.results?.length).toBe(2);
  expect(page2.nextToken).toBeUndefined();

  const all = [...(page1.results ?? []), ...(page2.results ?? [])];
  expect(all.sort()).toEqual(shadows.sort());
});

// === IOTDATA-006: DeleteThingShadow store.delete (no ghost keys) ===

test("IOTDATA-006: DeleteThingShadow cleans named shadow list", async () => {
  const client = iotData();
  const thingName = `bunsai_e2e_del_${suffix()}`;

  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      shadowName: "only",
      payload: new TextEncoder().encode(
        JSON.stringify({ state: { desired: { v: 1 } } }),
      ),
    }),
  );
  await client.send(
    new DeleteThingShadowCommand({ thingName, shadowName: "only" }),
  );

  const list = await client.send(
    new ListNamedShadowsForThingCommand({ thingName }),
  );
  expect(list.results?.length ?? 0).toBe(0);
});

// === IOTDATA-001: GetConnection / DeleteConnection / ListSubscriptions / SendDirectMessage ===

test("IOTDATA-001: GetConnection, DeleteConnection, ListSubscriptions, SendDirectMessage smoke", async () => {
  const client = iotData();
  const clientId = `bunsai-e2e-${suffix()}`;
  const topic = `bunsai/e2e/msg/${suffix()}`;

  const conn = await client.send(new GetConnectionCommand({ clientId }));
  expect(typeof conn.connected).toBe("boolean");

  await client.send(new DeleteConnectionCommand({ clientId }));

  const subs = await client.send(new ListSubscriptionsCommand({ clientId }));
  expect(Array.isArray(subs.subscriptions)).toBe(true);

  await client.send(
    new SendDirectMessageCommand({
      clientId,
      topic,
      payload: new TextEncoder().encode("direct"),
    }),
  );
});
