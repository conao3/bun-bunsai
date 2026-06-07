import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateRoutingProfileCommand,
  CreateUserCommand,
  SearchQuickConnectsCommand,
  SearchResourceTagsCommand,
  SearchRoutingProfilesCommand,
  SearchSecurityProfilesCommand,
  SearchTestCasesCommand,
  SearchUserHierarchyGroupsCommand,
  SearchUsersCommand,
  SearchViewsCommand,
  SearchVocabulariesCommand,
  SearchWorkspaceAssociationsCommand,
  SearchWorkspacesCommand,
  SendChatIntegrationEventCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("search ops chunk21: create-then-find and empty-result assertions", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk21-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyUsers = await client.send(
    new SearchUsersCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyUsers.Users)).toBe(true);
  expect(emptyUsers.Users?.length).toBe(0);

  const createdUser = await client.send(
    new CreateUserCommand({
      InstanceId: instanceId,
      Username: "testuser-chunk21",
      PhoneConfig: { PhoneType: "SOFT_PHONE" },
      SecurityProfileIds: [],
      RoutingProfileId: "routing-profile-1",
    }),
  );
  expect(createdUser.UserId).toBeTruthy();

  const foundUsers = await client.send(
    new SearchUsersCommand({ InstanceId: instanceId }),
  );
  expect(foundUsers.Users?.length).toBe(1);
  expect(foundUsers.Users?.[0]?.Id).toBe(createdUser.UserId);
  expect(foundUsers.ApproximateTotalCount).toBe(1);

  const emptyProfiles = await client.send(
    new SearchRoutingProfilesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyProfiles.RoutingProfiles)).toBe(true);
  expect(emptyProfiles.RoutingProfiles?.length).toBe(0);

  const createdProfile = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "test-routing-profile-chunk21",
      Description: "e2e test",
      DefaultOutboundQueueId: "queue-1",
      MediaConcurrencies: [],
    }),
  );
  expect(createdProfile.RoutingProfileId).toBeTruthy();

  const foundProfiles = await client.send(
    new SearchRoutingProfilesCommand({ InstanceId: instanceId }),
  );
  expect(foundProfiles.RoutingProfiles?.length).toBe(1);
  expect(foundProfiles.RoutingProfiles?.[0]?.RoutingProfileId).toBe(
    createdProfile.RoutingProfileId,
  );
  expect(foundProfiles.ApproximateTotalCount).toBe(1);

  const emptyQC = await client.send(
    new SearchQuickConnectsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyQC.QuickConnects)).toBe(true);

  const emptySP = await client.send(
    new SearchSecurityProfilesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptySP.SecurityProfiles)).toBe(true);

  const emptyTC = await client.send(
    new SearchTestCasesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyTC.TestCases)).toBe(true);

  const emptyUHG = await client.send(
    new SearchUserHierarchyGroupsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyUHG.UserHierarchyGroups)).toBe(true);

  const emptyViews = await client.send(
    new SearchViewsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyViews.Views)).toBe(true);

  const emptyVocab = await client.send(
    new SearchVocabulariesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyVocab.VocabularySummaryList)).toBe(true);

  const emptyWSA = await client.send(
    new SearchWorkspaceAssociationsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyWSA.WorkspaceAssociations)).toBe(true);

  const emptyWS = await client.send(
    new SearchWorkspacesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyWS.Workspaces)).toBe(true);

  const emptyTags = await client.send(
    new SearchResourceTagsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyTags.Tags)).toBe(true);

  const chatEvent = await client.send(
    new SendChatIntegrationEventCommand({
      SourceId: "source-123",
      DestinationId: "dest-123",
      Event: { Type: "MESSAGE" },
    }),
  );
  expect(chatEvent.InitialContactId).toBeTruthy();
});
