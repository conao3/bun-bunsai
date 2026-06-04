import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
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
} from "@aws-sdk/client-connect";

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

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
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
