import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelTagSyncTaskCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  GetAccountSettingsCommand,
  GetGroupCommand,
  GetGroupConfigurationCommand,
  GetGroupQueryCommand,
  GetTagSyncTaskCommand,
  GetTagsCommand,
  GroupResourcesCommand,
  ListGroupResourcesCommand,
  ListGroupingStatusesCommand,
  ListGroupsCommand,
  ListTagSyncTasksCommand,
  PutGroupConfigurationCommand,
  ResourceGroupsClient,
  SearchResourcesCommand,
  StartTagSyncTaskCommand,
  TagCommand,
  UngroupResourcesCommand,
  UntagCommand,
  UpdateAccountSettingsCommand,
  UpdateGroupCommand,
  UpdateGroupQueryCommand,
} from "@aws-sdk/client-resource-groups";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const resourcegroups = () =>
  new ResourceGroupsClient({ endpoint, region, credentials, requestHandler });

test("ResourceGroups group roundtrip", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateGroupCommand({
      Name: name,
      Description: "created by bunsai e2e",
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [{ Key: "stage", Values: ["test"] }],
        }),
      },
    }),
  );
  expect(created.Group?.Name).toBe(name);
  expect(created.Group?.GroupArn).toContain(`group/${name}`);

  const got = await client.send(new GetGroupCommand({ GroupName: name }));
  expect(got.Group?.Name).toBe(name);
  expect(got.Group?.Description).toBe("created by bunsai e2e");

  const listed = await client.send(new ListGroupsCommand({}));
  expect((listed.GroupIdentifiers ?? []).map((g) => g.GroupName)).toContain(
    name,
  );

  const updated = await client.send(
    new UpdateGroupCommand({
      GroupName: name,
      Description: "updated by bunsai e2e",
    }),
  );
  expect(updated.Group?.Description).toBe("updated by bunsai e2e");

  const afterUpdate = await client.send(
    new GetGroupCommand({ GroupName: name }),
  );
  expect(afterUpdate.Group?.Description).toBe("updated by bunsai e2e");

  const deleted = await client.send(
    new DeleteGroupCommand({ GroupName: name }),
  );
  expect(deleted.Group?.Name).toBe(name);

  await expect(
    client.send(new GetGroupCommand({ GroupName: name })),
  ).rejects.toThrow();
});

test("ResourceGroups GetGroupQuery and UpdateGroupQuery", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-query-${Date.now()}`;

  await client.send(
    new CreateGroupCommand({
      Name: name,
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [{ Key: "env", Values: ["prod"] }],
        }),
      },
    }),
  );

  const got = await client.send(new GetGroupQueryCommand({ GroupName: name }));
  expect(got.GroupQuery?.GroupName).toBe(name);
  expect(got.GroupQuery?.ResourceQuery?.Type).toBe("TAG_FILTERS_1_0");

  await client.send(
    new UpdateGroupQueryCommand({
      GroupName: name,
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::EC2::Instance"],
          TagFilters: [{ Key: "env", Values: ["staging"] }],
        }),
      },
    }),
  );

  const updated = await client.send(
    new GetGroupQueryCommand({ GroupName: name }),
  );
  expect(updated.GroupQuery?.ResourceQuery?.Type).toBe("TAG_FILTERS_1_0");

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups GetGroupConfiguration and PutGroupConfiguration", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-cfg-${Date.now()}`;

  await client.send(new CreateGroupCommand({ Name: name }));

  const initial = await client.send(
    new GetGroupConfigurationCommand({ Group: name }),
  );
  expect(initial.GroupConfiguration).toBeDefined();
  expect(initial.GroupConfiguration?.Status).toBe("UPDATE_COMPLETE");

  await client.send(
    new PutGroupConfigurationCommand({
      Group: name,
      Configuration: [{ Type: "AWS::EC2::HostManagement", Parameters: [] }],
    }),
  );

  const afterPut = await client.send(
    new GetGroupConfigurationCommand({ Group: name }),
  );
  expect(
    (afterPut.GroupConfiguration?.Configuration ?? []).length,
  ).toBeGreaterThan(0);
  expect(afterPut.GroupConfiguration?.Configuration?.[0]?.Type).toBe(
    "AWS::EC2::HostManagement",
  );
  expect(afterPut.GroupConfiguration?.Status).toBe("UPDATE_COMPLETE");

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups GroupResources, UngroupResources, ListGroupResources", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-members-${Date.now()}`;

  await client.send(new CreateGroupCommand({ Name: name }));

  const arn1 = "arn:aws:ec2:us-east-1:000000000000:instance/i-0000000000000001";
  const arn2 = "arn:aws:ec2:us-east-1:000000000000:instance/i-0000000000000002";

  const grouped = await client.send(
    new GroupResourcesCommand({ Group: name, ResourceArns: [arn1, arn2] }),
  );
  expect(grouped.Succeeded).toContain(arn1);
  expect(grouped.Succeeded).toContain(arn2);

  const listed = await client.send(
    new ListGroupResourcesCommand({ Group: name }),
  );
  const arns = (listed.ResourceIdentifiers ?? []).map((r) => r.ResourceArn);
  expect(arns).toContain(arn1);
  expect(arns).toContain(arn2);

  const ungrouped = await client.send(
    new UngroupResourcesCommand({ Group: name, ResourceArns: [arn1] }),
  );
  expect(ungrouped.Succeeded).toContain(arn1);

  const afterUngroup = await client.send(
    new ListGroupResourcesCommand({ Group: name }),
  );
  const remainingArns = (afterUngroup.ResourceIdentifiers ?? []).map(
    (r) => r.ResourceArn,
  );
  expect(remainingArns).not.toContain(arn1);
  expect(remainingArns).toContain(arn2);

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups ListGroupResources pagination", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-lgr-page-${Date.now()}`;

  await client.send(new CreateGroupCommand({ Name: name }));

  const arns = Array.from(
    { length: 5 },
    (_, i) =>
      `arn:aws:ec2:us-east-1:000000000000:instance/i-page${String(i).padStart(16, "0")}`,
  );
  await client.send(
    new GroupResourcesCommand({ Group: name, ResourceArns: arns }),
  );

  const page1 = await client.send(
    new ListGroupResourcesCommand({ Group: name, MaxResults: 3 }),
  );
  expect((page1.ResourceIdentifiers ?? []).length).toBe(3);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListGroupResourcesCommand({
      Group: name,
      MaxResults: 3,
      NextToken: page1.NextToken,
    }),
  );
  expect((page2.ResourceIdentifiers ?? []).length).toBe(2);
  expect(page2.NextToken).toBeUndefined();

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups ListGroupingStatuses after GroupResources and UngroupResources", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-grouping-${Date.now()}`;

  await client.send(new CreateGroupCommand({ Name: name }));

  const arn1 = "arn:aws:ec2:us-east-1:000000000000:instance/i-gs000000000001";
  const arn2 = "arn:aws:ec2:us-east-1:000000000000:instance/i-gs000000000002";

  await client.send(
    new GroupResourcesCommand({ Group: name, ResourceArns: [arn1, arn2] }),
  );
  await client.send(
    new UngroupResourcesCommand({ Group: name, ResourceArns: [arn1] }),
  );

  const result = await client.send(
    new ListGroupingStatusesCommand({ Group: name }),
  );
  expect((result.GroupingStatuses ?? []).length).toBe(3);

  const groupActions = (result.GroupingStatuses ?? []).filter(
    (s) => s.Action === "GROUP",
  );
  const ungroupActions = (result.GroupingStatuses ?? []).filter(
    (s) => s.Action === "UNGROUP",
  );
  expect(groupActions.length).toBe(2);
  expect(ungroupActions.length).toBe(1);

  for (const s of result.GroupingStatuses ?? []) {
    expect(s.Status).toBe("SUCCESS");
    expect(s.ResourceArn).toBeDefined();
    expect(s.UpdatedAt).toBeDefined();
  }

  const statusFiltered = await client.send(
    new ListGroupingStatusesCommand({
      Group: name,
      Filters: [{ Name: "status", Values: ["SUCCESS"] }],
    }),
  );
  expect((statusFiltered.GroupingStatuses ?? []).length).toBe(3);

  const arnFiltered = await client.send(
    new ListGroupingStatusesCommand({
      Group: name,
      Filters: [{ Name: "resource-arn", Values: [arn1] }],
    }),
  );
  expect((arnFiltered.GroupingStatuses ?? []).length).toBe(2);

  const page1 = await client.send(
    new ListGroupingStatusesCommand({ Group: name, MaxResults: 2 }),
  );
  expect((page1.GroupingStatuses ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListGroupingStatusesCommand({
      Group: name,
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect((page2.GroupingStatuses ?? []).length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups SearchResources", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-search-${Date.now()}`;

  await client.send(
    new CreateGroupCommand({
      Name: name,
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [{ Key: "env", Values: ["test"] }],
        }),
      },
    }),
  );

  const arn1 = "arn:aws:ec2:us-east-1:000000000000:instance/i-search0000001";
  const arn2 = "arn:aws:s3:us-east-1:000000000000:bucket/search-bucket-001";
  await client.send(
    new GroupResourcesCommand({ Group: name, ResourceArns: [arn1, arn2] }),
  );

  const result = await client.send(
    new SearchResourcesCommand({
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [{ Key: "env", Values: ["test"] }],
        }),
      },
    }),
  );
  expect(result.ResourceIdentifiers).toBeDefined();
  expect(result.QueryErrors).toBeDefined();
  const foundArns = (result.ResourceIdentifiers ?? []).map(
    (r) => r.ResourceArn,
  );
  expect(foundArns).toContain(arn1);
  expect(foundArns).toContain(arn2);

  const page1 = await client.send(
    new SearchResourcesCommand({
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [],
        }),
      },
      MaxResults: 1,
    }),
  );
  expect((page1.ResourceIdentifiers ?? []).length).toBe(1);
  expect(page1.NextToken).toBeDefined();

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups ListGroups filters and pagination", async () => {
  const client = resourcegroups();
  const suffix = `${Date.now()}`;
  const nameOwned = `bunsai-e2e-owned-${suffix}`;
  const nameOther = `bunsai-e2e-other-${suffix}`;

  await client.send(
    new CreateGroupCommand({
      Name: nameOwned,
      Owner: "alice",
      DisplayName: "Alice Group",
    }),
  );
  await client.send(
    new CreateGroupCommand({
      Name: nameOther,
      Owner: "bob",
      DisplayName: "Bob Group",
    }),
  );

  const ownerFiltered = await client.send(
    new ListGroupsCommand({
      Filters: [{ Name: "owner", Values: ["alice"] }],
    }),
  );
  const ownerNames = (ownerFiltered.GroupIdentifiers ?? []).map(
    (g) => g.GroupName,
  );
  expect(ownerNames).toContain(nameOwned);
  expect(ownerNames).not.toContain(nameOther);

  const displayFiltered = await client.send(
    new ListGroupsCommand({
      Filters: [{ Name: "display-name", Values: ["Bob Group"] }],
    }),
  );
  const displayNames = (displayFiltered.GroupIdentifiers ?? []).map(
    (g) => g.GroupName,
  );
  expect(displayNames).toContain(nameOther);
  expect(displayNames).not.toContain(nameOwned);

  const all = await client.send(new ListGroupsCommand({}));
  const allNames = (all.GroupIdentifiers ?? []).map((g) => g.GroupName);
  const totalCount = allNames.filter(
    (n) => n === nameOwned || n === nameOther,
  ).length;
  expect(totalCount).toBe(2);

  if (totalCount >= 2) {
    const page1 = await client.send(new ListGroupsCommand({ MaxResults: 1 }));
    expect((page1.GroupIdentifiers ?? []).length).toBe(1);
  }

  await client.send(new DeleteGroupCommand({ GroupName: nameOwned }));
  await client.send(new DeleteGroupCommand({ GroupName: nameOther }));
});

test("ResourceGroups GetTags, Tag, Untag", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-tags-${Date.now()}`;

  const created = await client.send(
    new CreateGroupCommand({
      Name: name,
      Tags: { env: "test", owner: "bunsai" },
    }),
  );
  const groupArn = created.Group?.GroupArn ?? "";
  expect(groupArn).toContain(`group/${name}`);

  const gotTags = await client.send(new GetTagsCommand({ Arn: groupArn }));
  expect(gotTags.Tags?.["env"]).toBe("test");
  expect(gotTags.Tags?.["owner"]).toBe("bunsai");

  const tagged = await client.send(
    new TagCommand({ Arn: groupArn, Tags: { stage: "prod" } }),
  );
  expect(tagged.Tags?.["stage"]).toBe("prod");
  expect(tagged.Tags?.["env"]).toBe("test");

  const untagged = await client.send(
    new UntagCommand({ Arn: groupArn, Keys: ["owner"] }),
  );
  expect(untagged.Keys).toContain("owner");

  const afterUntag = await client.send(new GetTagsCommand({ Arn: groupArn }));
  expect(afterUntag.Tags?.["owner"]).toBeUndefined();
  expect(afterUntag.Tags?.["env"]).toBe("test");
  expect(afterUntag.Tags?.["stage"]).toBe("prod");

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});

test("ResourceGroups GetAccountSettings and UpdateAccountSettings", async () => {
  const client = resourcegroups();

  const initial = await client.send(new GetAccountSettingsCommand({}));
  expect(initial.AccountSettings).toBeDefined();

  const updated = await client.send(
    new UpdateAccountSettingsCommand({
      GroupLifecycleEventsDesiredStatus: "ACTIVE",
    }),
  );
  expect(updated.AccountSettings?.GroupLifecycleEventsDesiredStatus).toBe(
    "ACTIVE",
  );

  const afterUpdate = await client.send(new GetAccountSettingsCommand({}));
  expect(afterUpdate.AccountSettings?.GroupLifecycleEventsDesiredStatus).toBe(
    "ACTIVE",
  );

  await client.send(
    new UpdateAccountSettingsCommand({
      GroupLifecycleEventsDesiredStatus: "INACTIVE",
    }),
  );
});

test("ResourceGroups StartTagSyncTask, GetTagSyncTask, ListTagSyncTasks, CancelTagSyncTask", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-tagsync-${Date.now()}`;

  await client.send(new CreateGroupCommand({ Name: name }));

  const started = await client.send(
    new StartTagSyncTaskCommand({
      Group: name,
      TagKey: "env",
      TagValue: "test",
      RoleArn: "arn:aws:iam::000000000000:role/test-role",
    }),
  );
  expect(started.TaskArn).toContain("tag-sync-task");
  expect(started.GroupName).toBe(name);
  const taskArn = started.TaskArn ?? "";

  const got = await client.send(
    new GetTagSyncTaskCommand({ TaskArn: taskArn }),
  );
  expect(got.TaskArn).toBe(taskArn);
  expect(got.GroupName).toBe(name);
  expect(got.Status).toBe("ACTIVE");
  expect(got.TagKey).toBe("env");

  const listed = await client.send(new ListTagSyncTasksCommand({}));
  const arns = (listed.TagSyncTasks ?? []).map((t) => t.TaskArn);
  expect(arns).toContain(taskArn);

  const groupArn = started.GroupArn ?? "";
  const filteredByArn = await client.send(
    new ListTagSyncTasksCommand({
      Filters: [{ GroupArn: groupArn }],
    }),
  );
  const filteredArns = (filteredByArn.TagSyncTasks ?? []).map((t) => t.TaskArn);
  expect(filteredArns).toContain(taskArn);

  const filteredByName = await client.send(
    new ListTagSyncTasksCommand({
      Filters: [{ GroupName: name }],
    }),
  );
  expect((filteredByName.TagSyncTasks ?? []).map((t) => t.TaskArn)).toContain(
    taskArn,
  );

  await client.send(new CancelTagSyncTaskCommand({ TaskArn: taskArn }));

  const afterCancel = await client.send(
    new GetTagSyncTaskCommand({ TaskArn: taskArn }),
  );
  expect(String(afterCancel.Status)).toBe("CANCELLED");

  await client.send(new DeleteGroupCommand({ GroupName: name }));
});
