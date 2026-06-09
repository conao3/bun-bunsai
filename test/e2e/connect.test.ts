import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  DescribeInstanceCommand,
  ListInstancesCommand,
  ClaimPhoneNumberCommand,
  AssociatePhoneNumberContactFlowCommand,
  BatchAssociateAnalyticsDataSetCommand,
  BatchDisassociateAnalyticsDataSetCommand,
  CreateAgentStatusCommand,
  CreateContactFlowCommand,
  CreateQueueCommand,
  CreateHoursOfOperationCommand,
  CreateRoutingProfileCommand,
  CreateSecurityProfileCommand,
  DescribeAgentStatusCommand,
  DescribeContactFlowCommand,
  DescribeHoursOfOperationCommand,
  CreateContactCommand,
  DescribeContactCommand,
  CreateEmailAddressCommand,
  DescribeEmailAddressCommand,
  CreateEvaluationFormCommand,
  DescribeEvaluationFormCommand,
  UpdateAgentStatusCommand,
  UpdateContactFlowContentCommand,
  UpdateContactFlowNameCommand,
  DeleteContactFlowCommand,
  DeleteHoursOfOperationCommand,
  DeleteEmailAddressCommand,
  DeleteEvaluationFormCommand,
  CreateUserCommand,
  CreateViewCommand,
  CreateViewVersionCommand,
  DescribeQueueCommand,
  DescribeRoutingProfileCommand,
  ListQueuesCommand,
  TagResourceCommand,
  UntagResourceCommand,
  ListTagsForResourceCommand,
  CreateRuleCommand,
  DeleteRuleCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Connect instance roundtrip", async () => {
  const client = connect();
  const alias = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: alias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
  const instanceId = created.Id ?? "";

  const described = await client.send(
    new DescribeInstanceCommand({ InstanceId: instanceId }),
  );
  expect(described.Instance?.Id).toBe(instanceId);
  expect(described.Instance?.IdentityManagementType).toBe("CONNECT_MANAGED");
  expect(described.Instance?.InstanceAlias).toBe(alias);
  expect(described.Instance?.InboundCallsEnabled).toBe(true);
  expect(described.Instance?.OutboundCallsEnabled).toBe(false);

  const listed = await client.send(new ListInstancesCommand({}));
  expect((listed.InstanceSummaryList ?? []).map((i) => i.Id)).toContain(
    instanceId,
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
  await expect(
    client.send(new DescribeInstanceCommand({ InstanceId: instanceId })),
  ).rejects.toThrow();
});

test("ClaimPhoneNumber and AssociatePhoneNumberContactFlow", async () => {
  const client = connect();

  const instanceAlias = `bunsai-e2e-phone-${Date.now()}`;
  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: instanceAlias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const claimed = await client.send(
    new ClaimPhoneNumberCommand({
      PhoneNumber: "+12065551234",
      InstanceId: instanceId,
    }),
  );
  expect(claimed.PhoneNumberId).toBeDefined();
  expect(claimed.PhoneNumberArn).toBeDefined();
  expect(claimed.PhoneNumberArn).toContain("phone-number");

  const phoneNumberId = claimed.PhoneNumberId ?? "";
  const fakeContactFlowId = crypto.randomUUID();

  await expect(
    client.send(
      new AssociatePhoneNumberContactFlowCommand({
        PhoneNumberId: phoneNumberId,
        InstanceId: instanceId,
        ContactFlowId: fakeContactFlowId,
      }),
    ),
  ).resolves.toBeDefined();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("BatchAssociateAnalyticsDataSet and BatchDisassociateAnalyticsDataSet", async () => {
  const client = connect();

  const instanceAlias = `bunsai-e2e-analytics-${Date.now()}`;
  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: instanceAlias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const dataSetIds = [crypto.randomUUID(), crypto.randomUUID()];

  const associated = await client.send(
    new BatchAssociateAnalyticsDataSetCommand({
      InstanceId: instanceId,
      DataSetIds: dataSetIds,
    }),
  );
  expect(associated.Created).toHaveLength(2);
  expect(associated.Created?.map((c) => c.DataSetId)).toContain(dataSetIds[0]);
  expect(associated.Errors).toHaveLength(0);

  const disassociated = await client.send(
    new BatchDisassociateAnalyticsDataSetCommand({
      InstanceId: instanceId,
      DataSetIds: dataSetIds,
    }),
  );
  expect(disassociated.Deleted).toContain(dataSetIds[0]);
  expect(disassociated.Deleted).toContain(dataSetIds[1]);
  expect(disassociated.Errors).toHaveLength(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateAgentStatus", async () => {
  const client = connect();

  const instanceAlias = `bunsai-e2e-agentstatus-${Date.now()}`;
  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: instanceAlias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const created = await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "On Break",
      State: "ENABLED",
    }),
  );
  expect(created.AgentStatusId).toBeDefined();
  expect(created.AgentStatusARN).toBeDefined();
  expect(created.AgentStatusARN).toContain(instanceId);
  expect(created.AgentStatusARN).toContain("agent-state");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateContactFlow", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-cf-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const created = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "TestFlow",
      Type: "CONTACT_FLOW",
      Content: '{"Version":"2019-10-30","StartAction":"id1","Actions":[]}',
    }),
  );
  expect(created.ContactFlowId).toBeDefined();
  expect(created.ContactFlowArn).toContain(instanceId);
  expect(created.ContactFlowArn).toContain("contact-flow");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateQueue and CreateHoursOfOperation", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-q-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const hoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "24x7",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  expect(hoo.HoursOfOperationId).toBeDefined();
  expect(hoo.HoursOfOperationArn).toContain(instanceId);

  const queue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "SupportQueue",
      HoursOfOperationId: hoo.HoursOfOperationId ?? "",
    }),
  );
  expect(queue.QueueId).toBeDefined();
  expect(queue.QueueArn).toContain(instanceId);
  expect(queue.QueueArn).toContain("queue");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateRoutingProfile and CreateSecurityProfile", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-rp-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const queue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "DefaultQueue",
      HoursOfOperationId: "00000000-0000-0000-0000-000000000000",
    }),
  );
  const queueId = queue.QueueId ?? "";

  const rp = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "DefaultRP",
      Description: "Default routing profile",
      DefaultOutboundQueueId: queueId,
      MediaConcurrencies: [{ Channel: "VOICE", Concurrency: 1 }],
    }),
  );
  expect(rp.RoutingProfileId).toBeDefined();
  expect(rp.RoutingProfileArn).toContain(instanceId);
  expect(rp.RoutingProfileArn).toContain("routing-profile");

  const sp = await client.send(
    new CreateSecurityProfileCommand({
      InstanceId: instanceId,
      SecurityProfileName: "ReadOnly",
    }),
  );
  expect(sp.SecurityProfileId).toBeDefined();
  expect(sp.SecurityProfileArn).toContain(instanceId);
  expect(sp.SecurityProfileArn).toContain("security-profile");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("Describe operations — agent status, contact flow, hours of operation, contact, email address, evaluation form", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-desc-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const agentStatus = await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "On Lunch",
      State: "ENABLED",
    }),
  );
  const agentStatusId = agentStatus.AgentStatusId ?? "";

  const describedAgent = await client.send(
    new DescribeAgentStatusCommand({
      InstanceId: instanceId,
      AgentStatusId: agentStatusId,
    }),
  );
  expect(describedAgent.AgentStatus?.AgentStatusId).toBe(agentStatusId);
  expect(describedAgent.AgentStatus?.Name).toBe("On Lunch");
  expect(describedAgent.AgentStatus?.State).toBe("ENABLED");

  const hoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "Weekdays",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  const hooId = hoo.HoursOfOperationId ?? "";

  const describedHoo = await client.send(
    new DescribeHoursOfOperationCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
    }),
  );
  expect(describedHoo.HoursOfOperation?.HoursOfOperationId).toBe(hooId);
  expect(describedHoo.HoursOfOperation?.Name).toBe("Weekdays");

  const cf = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "MainFlow",
      Type: "CONTACT_FLOW",
      Content: '{"Version":"2019-10-30","StartAction":"s1","Actions":[]}',
    }),
  );
  const cfId = cf.ContactFlowId ?? "";

  const describedCf = await client.send(
    new DescribeContactFlowCommand({
      InstanceId: instanceId,
      ContactFlowId: cfId,
    }),
  );
  expect(describedCf.ContactFlow?.Id).toBe(cfId);
  expect(describedCf.ContactFlow?.Name).toBe("MainFlow");
  expect(describedCf.ContactFlow?.Type).toBe("CONTACT_FLOW");

  const contact = await client.send(
    new CreateContactCommand({
      InstanceId: instanceId,
      Channel: "CHAT",
      InitiationMethod: "OUTBOUND",
    }),
  );
  const contactId = contact.ContactId ?? "";

  const describedContact = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(describedContact.Contact?.Id).toBe(contactId);

  const email = await client.send(
    new CreateEmailAddressCommand({
      InstanceId: instanceId,
      EmailAddress: "support@example.com",
      DisplayName: "Support",
    }),
  );
  const emailId = email.EmailAddressId ?? "";

  const describedEmail = await client.send(
    new DescribeEmailAddressCommand({
      InstanceId: instanceId,
      EmailAddressId: emailId,
    }),
  );
  expect(describedEmail.EmailAddressId).toBe(emailId);
  expect(describedEmail.EmailAddress).toBe("support@example.com");

  const evalForm = await client.send(
    new CreateEvaluationFormCommand({
      InstanceId: instanceId,
      Title: "QA Form",
      Items: [],
    }),
  );
  const evalFormId = evalForm.EvaluationFormId ?? "";

  const describedEvalForm = await client.send(
    new DescribeEvaluationFormCommand({
      InstanceId: instanceId,
      EvaluationFormId: evalFormId,
    }),
  );
  expect(describedEvalForm.EvaluationForm?.EvaluationFormId).toBe(evalFormId);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("UpdateAgentStatus — create then update name and state", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-upd-as-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const created = await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "On Break",
      State: "ENABLED",
    }),
  );
  expect(created.AgentStatusId).toBeDefined();
  const agentStatusId = created.AgentStatusId ?? "";

  const described = await client.send(
    new DescribeAgentStatusCommand({
      InstanceId: instanceId,
      AgentStatusId: agentStatusId,
    }),
  );
  expect(described.AgentStatus?.Name).toBe("On Break");
  expect(described.AgentStatus?.State).toBe("ENABLED");

  await client.send(
    new UpdateAgentStatusCommand({
      InstanceId: instanceId,
      AgentStatusId: agentStatusId,
      Name: "Available",
      State: "DISABLED",
    }),
  );

  const updatedDesc = await client.send(
    new DescribeAgentStatusCommand({
      InstanceId: instanceId,
      AgentStatusId: agentStatusId,
    }),
  );
  expect(updatedDesc.AgentStatus?.Name).toBe("Available");
  expect(updatedDesc.AgentStatus?.State).toBe("DISABLED");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("UpdateContactFlowContent and UpdateContactFlowName — create then update", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-upd-cf-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const created = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "OriginalFlow",
      Type: "CONTACT_FLOW",
      Content: '{"Version":"2019-10-30","StartAction":"s1","Actions":[]}',
    }),
  );
  expect(created.ContactFlowId).toBeDefined();
  const contactFlowId = created.ContactFlowId ?? "";

  const described = await client.send(
    new DescribeContactFlowCommand({
      InstanceId: instanceId,
      ContactFlowId: contactFlowId,
    }),
  );
  expect(described.ContactFlow?.Name).toBe("OriginalFlow");

  await client.send(
    new UpdateContactFlowContentCommand({
      InstanceId: instanceId,
      ContactFlowId: contactFlowId,
      Content: '{"Version":"2019-10-30","StartAction":"s2","Actions":[]}',
    }),
  );

  await client.send(
    new UpdateContactFlowNameCommand({
      InstanceId: instanceId,
      ContactFlowId: contactFlowId,
      Name: "RenamedFlow",
    }),
  );

  const updatedDesc = await client.send(
    new DescribeContactFlowCommand({
      InstanceId: instanceId,
      ContactFlowId: contactFlowId,
    }),
  );
  expect(updatedDesc.ContactFlow?.Name).toBe("RenamedFlow");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("Delete operations — contact-flow create then delete", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-del-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const hoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "DeleteableHOO",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  const hooId = hoo.HoursOfOperationId ?? "";
  expect(hooId).toBeDefined();

  await client.send(
    new DeleteHoursOfOperationCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
    }),
  );
  await expect(
    client.send(
      new DescribeHoursOfOperationCommand({
        InstanceId: instanceId,
        HoursOfOperationId: hooId,
      }),
    ),
  ).rejects.toThrow();

  const email = await client.send(
    new CreateEmailAddressCommand({
      InstanceId: instanceId,
      EmailAddress: "del@example.com",
      DisplayName: "Delete Test",
    }),
  );
  const emailId = email.EmailAddressId ?? "";
  expect(emailId).toBeDefined();

  await client.send(
    new DeleteEmailAddressCommand({
      InstanceId: instanceId,
      EmailAddressId: emailId,
    }),
  );
  await expect(
    client.send(
      new DescribeEmailAddressCommand({
        InstanceId: instanceId,
        EmailAddressId: emailId,
      }),
    ),
  ).rejects.toThrow();

  const evalForm = await client.send(
    new CreateEvaluationFormCommand({
      InstanceId: instanceId,
      Title: "DeleteableForm",
      Items: [],
    }),
  );
  const evalFormId = evalForm.EvaluationFormId ?? "";
  expect(evalFormId).toBeDefined();

  await client.send(
    new DeleteEvaluationFormCommand({
      InstanceId: instanceId,
      EvaluationFormId: evalFormId,
    }),
  );
  await expect(
    client.send(
      new DescribeEvaluationFormCommand({
        InstanceId: instanceId,
        EvaluationFormId: evalFormId,
      }),
    ),
  ).rejects.toThrow();

  const cf = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "DeleteableFlow",
      Type: "CONTACT_FLOW",
      Content: '{"Version":"2019-10-30","StartAction":"s1","Actions":[]}',
    }),
  );
  const cfId = cf.ContactFlowId ?? "";
  expect(cfId).toBeDefined();
  expect(cf.ContactFlowArn).toContain(instanceId);

  await client.send(
    new DeleteContactFlowCommand({
      InstanceId: instanceId,
      ContactFlowId: cfId,
    }),
  );
  await expect(
    client.send(
      new DescribeContactFlowCommand({
        InstanceId: instanceId,
        ContactFlowId: cfId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateUser — user lifecycle", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-user-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const created = await client.send(
    new CreateUserCommand({
      InstanceId: instanceId,
      Username: "john.doe",
      SecurityProfileIds: [crypto.randomUUID()],
      RoutingProfileId: crypto.randomUUID(),
      PhoneConfig: { PhoneType: "SOFT_PHONE" },
    }),
  );
  expect(created.UserId).toBeDefined();
  expect(created.UserArn).toBeDefined();
  expect(created.UserArn).toContain(instanceId);
  expect(created.UserArn).toContain("agent");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateView and CreateViewVersion — view lifecycle", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-view-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const createdView = await client.send(
    new CreateViewCommand({
      InstanceId: instanceId,
      Name: "MyView",
      Status: "SAVED",
      Content: { Template: "{}" },
    }),
  );
  expect(createdView.View?.Id).toBeDefined();
  expect(createdView.View?.Arn).toContain(instanceId);
  expect(createdView.View?.Arn).toContain("view");
  expect(createdView.View?.Name).toBe("MyView");
  expect(createdView.View?.Status).toBe("SAVED");
  const viewId = createdView.View?.Id ?? "";

  const createdVersion = await client.send(
    new CreateViewVersionCommand({
      InstanceId: instanceId,
      ViewId: viewId,
      VersionDescription: "v1",
    }),
  );
  expect(createdVersion.View?.Id).toBe(viewId);
  expect(createdVersion.View?.Version).toBe(1);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("instance lifecycle CREATION_IN_PROGRESS → ACTIVE", async () => {
  const client = connect();

  const created = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-lifecycle-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = created.Id ?? "";

  const first = await client.send(
    new DescribeInstanceCommand({ InstanceId: instanceId }),
  );
  expect(first.Instance?.InstanceStatus).toBe("CREATION_IN_PROGRESS");

  const second = await client.send(
    new DescribeInstanceCommand({ InstanceId: instanceId }),
  );
  expect(second.Instance?.InstanceStatus).toBe("ACTIVE");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("Create* Tags + Describe* returns Tags + DeleteQueue clears tags + ListQueues pagination", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-tags-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";

  const dummyHoO = "00000000-0000-0000-0000-000000000001";

  const q1 = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "queue-one",
      HoursOfOperationId: dummyHoO,
      Tags: { env: "test", tier: "1" },
    }),
  );
  expect(q1.QueueId).toBeDefined();
  expect(q1.QueueArn).toBeDefined();
  const queueId = q1.QueueId!;
  const queueArn = q1.QueueArn!;

  const q2 = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "queue-two",
      HoursOfOperationId: dummyHoO,
    }),
  );
  expect(q2.QueueId).toBeDefined();

  const rp = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "rp-one",
      Description: "test routing profile",
      DefaultOutboundQueueId: queueId,
      MediaConcurrencies: [],
      Tags: { rp: "yes" },
    }),
  );
  expect(rp.RoutingProfileId).toBeDefined();

  const descQ = await client.send(
    new DescribeQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
  );
  expect(descQ.Queue?.Tags).toEqual({ env: "test", tier: "1" });

  const descRp = await client.send(
    new DescribeRoutingProfileCommand({
      InstanceId: instanceId,
      RoutingProfileId: rp.RoutingProfileId ?? "",
    }),
  );
  expect(descRp.RoutingProfile?.Tags).toEqual({ rp: "yes" });

  const list1 = await client.send(
    new ListQueuesCommand({ InstanceId: instanceId, MaxResults: 1 }),
  );
  expect(list1.QueueSummaryList?.length).toBe(1);
  expect(list1.NextToken).toBeDefined();

  const list2 = await client.send(
    new ListQueuesCommand({
      InstanceId: instanceId,
      NextToken: list1.NextToken,
    }),
  );
  expect(list2.QueueSummaryList?.length).toBe(1);
  expect(list2.NextToken).toBeUndefined();

  await client.send(
    new TagResourceCommand({
      resourceArn: queueArn,
      tags: { extra: "val" },
    }),
  );
  const afterTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: queueArn }),
  );
  expect(afterTag.tags?.["extra"]).toBe("val");
  expect(afterTag.tags?.["env"]).toBe("test");

  await client.send(
    new UntagResourceCommand({
      resourceArn: queueArn,
      tagKeys: ["extra"],
    }),
  );
  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: queueArn }),
  );
  expect(afterUntag.tags?.["extra"]).toBeUndefined();
  expect(afterUntag.tags?.["env"]).toBe("test");

  await client.send(
    new DeleteQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
  );
  const afterDelete = await client.send(
    new ListTagsForResourceCommand({ resourceArn: queueArn }),
  );
  expect(Object.keys(afterDelete.tags ?? {}).length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("DeleteRule second call raises ResourceNotFoundException", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-delrule-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";

  const rule = await client.send(
    new CreateRuleCommand({
      InstanceId: instanceId,
      Name: "test-rule",
      TriggerEventSource: { EventSourceName: "OnContactEvaluationSubmit" },
      Function: "TRUE",
      Actions: [],
      PublishStatus: "DRAFT",
    }),
  );
  expect(rule.RuleId).toBeDefined();
  const ruleId = rule.RuleId ?? "";

  await client.send(
    new DeleteRuleCommand({ InstanceId: instanceId, RuleId: ruleId }),
  );

  await expect(
    client.send(
      new DeleteRuleCommand({ InstanceId: instanceId, RuleId: ruleId }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
