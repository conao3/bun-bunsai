import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ClaimPhoneNumberCommand,
  ConnectClient,
  CreateAgentStatusCommand,
  CreateContactCommand,
  CreateInstanceCommand,
  CreateUserCommand,
  CreateWorkspaceCommand,
  DescribeContactCommand,
  ListWorkspacePagesCommand,
  ListWorkspacesCommand,
  MonitorContactCommand,
  PauseContactCommand,
  PutUserStatusCommand,
  ReleasePhoneNumberCommand,
  ReplicateInstanceCommand,
  ResumeContactCommand,
  ResumeContactRecordingCommand,
  SearchAgentStatusesCommand,
  SearchAvailablePhoneNumbersCommand,
  SearchContactEvaluationsCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({ endpoint, region, credentials, requestHandler });

test("SearchAgentStatuses returns created status; PauseContact/ResumeContact round-trip; missing resource errors", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk19-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptySearch = await client.send(
    new SearchAgentStatusesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptySearch.AgentStatuses)).toBe(true);
  expect(emptySearch.AgentStatuses?.length).toBe(0);

  const created = await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "test-status",
      State: "ENABLED",
    }),
  );
  expect(created.AgentStatusId).toBeTruthy();

  const found = await client.send(
    new SearchAgentStatusesCommand({ InstanceId: instanceId }),
  );
  expect(found.AgentStatuses?.length).toBe(1);
  expect(found.AgentStatuses?.[0]?.AgentStatusId).toBe(created.AgentStatusId);

  const contact = await client.send(
    new CreateContactCommand({
      InstanceId: instanceId,
      Channel: "VOICE",
      InitiationMethod: "OUTBOUND",
    }),
  );
  const contactId = contact.ContactId ?? "";
  expect(contactId).toBeTruthy();

  const beforePause = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(beforePause.Contact?.TotalPauseCount).toBe(0);
  expect(beforePause.Contact?.LastPausedTimestamp).toBeUndefined();

  await client.send(
    new PauseContactCommand({ InstanceId: instanceId, ContactId: contactId }),
  );

  const afterPause = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(afterPause.Contact?.TotalPauseCount).toBe(1);
  expect(afterPause.Contact?.LastPausedTimestamp).toBeInstanceOf(Date);

  await client.send(
    new ResumeContactCommand({ InstanceId: instanceId, ContactId: contactId }),
  );

  const afterResume = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(afterResume.Contact?.LastResumedTimestamp).toBeInstanceOf(Date);

  const user = await client.send(
    new CreateUserCommand({
      InstanceId: instanceId,
      Username: "testuser-chunk19",
      PhoneConfig: { PhoneType: "SOFT_PHONE" },
      SecurityProfileIds: [],
      RoutingProfileId: "routing-profile-1",
    }),
  );
  const userId = user.UserId ?? "";
  expect(userId).toBeTruthy();

  await client.send(
    new PutUserStatusCommand({
      InstanceId: instanceId,
      UserId: userId,
      AgentStatusId: created.AgentStatusId ?? "",
    }),
  );

  const phoneNum = await client.send(
    new ClaimPhoneNumberCommand({
      InstanceId: instanceId,
      PhoneNumber: "+15555550100",
    }),
  );
  const phoneNumberId = phoneNum.PhoneNumberId ?? "";
  expect(phoneNumberId).toBeTruthy();

  await client.send(
    new ReleasePhoneNumberCommand({ PhoneNumberId: phoneNumberId }),
  );

  let released = false;
  try {
    await client.send(
      new ReleasePhoneNumberCommand({ PhoneNumberId: phoneNumberId }),
    );
  } catch (e: unknown) {
    const err = e as { name?: string };
    expect(err.name).toBe("ResourceNotFoundException");
    released = true;
  }
  expect(released).toBe(true);

  const replica = await client.send(
    new ReplicateInstanceCommand({
      InstanceId: instanceId,
      ReplicaRegion: "us-west-2",
      ReplicaAlias: "replica-alias",
    }),
  );
  expect(replica.Id).toBeTruthy();
  expect(replica.Arn).toBeTruthy();

  const monitor = await client.send(
    new MonitorContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      UserId: userId,
    }),
  );
  expect(monitor.ContactId).toBeTruthy();

  const resumeRec = await client.send(
    new ResumeContactRecordingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      InitialContactId: contactId,
    }),
  );
  expect(resumeRec.$metadata.httpStatusCode).toBe(200);

  const workspace = await client.send(
    new CreateWorkspaceCommand({
      InstanceId: instanceId,
      Name: "test-workspace",
    }),
  );
  const workspaceId = workspace.WorkspaceId ?? "";
  expect(workspaceId).toBeTruthy();

  const workspaces = await client.send(
    new ListWorkspacesCommand({ InstanceId: instanceId }),
  );
  expect(workspaces.WorkspaceSummaryList?.length).toBe(1);
  expect(workspaces.WorkspaceSummaryList?.[0]?.Id).toBe(workspaceId);

  const pages = await client.send(
    new ListWorkspacePagesCommand({
      InstanceId: instanceId,
      WorkspaceId: workspaceId,
    }),
  );
  expect(Array.isArray(pages.WorkspacePageList)).toBe(true);

  const available = await client.send(
    new SearchAvailablePhoneNumbersCommand({
      PhoneNumberCountryCode: "US",
      PhoneNumberType: "DID",
    }),
  );
  expect(Array.isArray(available.AvailableNumbersList)).toBe(true);

  const evalSearch = await client.send(
    new SearchContactEvaluationsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(evalSearch.EvaluationSearchSummaryList)).toBe(true);
});
