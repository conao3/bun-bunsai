import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AppStreamClient,
  AssociateAppBlockBuilderAppBlockCommand,
  AssociateApplicationFleetCommand,
  AssociateApplicationToEntitlementCommand,
  AssociateFleetCommand,
  CreateAppBlockBuilderCommand,
  CreateAppBlockCommand,
  CreateApplicationCommand,
  CreateDirectoryConfigCommand,
  CreateEntitlementCommand,
  CreateExportImageTaskCommand,
  CreateFleetCommand,
  CreateImageBuilderCommand,
  CreateImportedImageCommand,
  CreateStackCommand,
  CreateStreamingURLCommand,
  CreateThemeForStackCommand,
  CreateUserCommand,
  DeleteAppBlockBuilderCommand,
  DeleteAppBlockCommand,
  DeleteApplicationCommand,
  DeleteDirectoryConfigCommand,
  DeleteEntitlementCommand,
  DeleteFleetCommand,
  DeleteImageBuilderCommand,
  DeleteStackCommand,
  DeleteThemeForStackCommand,
  DeleteUserCommand,
  DescribeAppBlockBuilderAppBlockAssociationsCommand,
  DescribeAppBlockBuildersCommand,
  DescribeAppBlocksCommand,
  DescribeApplicationsCommand,
  DescribeDirectoryConfigsCommand,
  DescribeEntitlementsCommand,
  DescribeFleetsCommand,
  DescribeImageBuildersCommand,
  DescribeImagesCommand,
  DescribeSessionsCommand,
  DescribeStacksCommand,
  DescribeThemeForStackCommand,
  DescribeUsersCommand,
  DisableUserCommand,
  DisassociateAppBlockBuilderAppBlockCommand,
  DisassociateFleetCommand,
  EnableUserCommand,
  GetExportImageTaskCommand,
  ListExportImageTasksCommand,
  ListTagsForResourceCommand,
  StartFleetCommand,
  StopFleetCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-appstream";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const appstream = () =>
  new AppStreamClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("AppStream fleet and stack lifecycle", async () => {
  const client = appstream();
  const fleetName = "bunsai-e2e-fleet";
  const stackName = "bunsai-e2e-stack";

  const createdFleet = await client.send(
    new CreateFleetCommand({
      Name: fleetName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 2 },
    }),
  );
  expect(createdFleet.Fleet?.Name).toBe(fleetName);
  expect(createdFleet.Fleet?.State).toBe("RUNNING");
  expect(createdFleet.Fleet?.Arn).toContain(fleetName);

  const describedFleets = await client.send(
    new DescribeFleetsCommand({ Names: [fleetName] }),
  );
  expect((describedFleets.Fleets ?? []).some((f) => f.Name === fleetName)).toBe(
    true,
  );

  const createdStack = await client.send(
    new CreateStackCommand({ Name: stackName }),
  );
  expect(createdStack.Stack?.Name).toBe(stackName);
  expect(createdStack.Stack?.Arn).toContain(stackName);

  const describedStacks = await client.send(
    new DescribeStacksCommand({ Names: [stackName] }),
  );
  expect((describedStacks.Stacks ?? []).some((s) => s.Name === stackName)).toBe(
    true,
  );

  await client.send(new DeleteFleetCommand({ Name: fleetName }));
  await client.send(new DeleteStackCommand({ Name: stackName }));

  const afterDelete = await client.send(new DescribeFleetsCommand({}));
  expect((afterDelete.Fleets ?? []).some((f) => f.Name === fleetName)).toBe(
    false,
  );
});

test("AppStream app-block and app-block-builder lifecycle", async () => {
  const client = appstream();
  const appBlockName = "e2e-appblock";
  const builderName = "e2e-abbuilder";

  const createdBlock = await client.send(
    new CreateAppBlockCommand({
      Name: appBlockName,
      SourceS3Location: { S3Bucket: "test-bucket" },
    }),
  );
  expect(createdBlock.AppBlock?.Name).toBe(appBlockName);
  expect(createdBlock.AppBlock?.Arn).toContain(appBlockName);

  const createdBuilder = await client.send(
    new CreateAppBlockBuilderCommand({
      Name: builderName,
      Platform: "WINDOWS_SERVER_2019",
      InstanceType: "stream.standard.medium",
      VpcConfig: {},
    }),
  );
  expect(createdBuilder.AppBlockBuilder?.Name).toBe(builderName);
  expect(createdBuilder.AppBlockBuilder?.State).toBe("RUNNING");

  const appBlockArn = createdBlock.AppBlock!.Arn!;
  await client.send(
    new AssociateAppBlockBuilderAppBlockCommand({
      AppBlockBuilderName: builderName,
      AppBlockArn: appBlockArn,
    }),
  );
  const assocs = await client.send(
    new DescribeAppBlockBuilderAppBlockAssociationsCommand({
      AppBlockBuilderName: builderName,
    }),
  );
  expect(
    (assocs.AppBlockBuilderAppBlockAssociations ?? []).some(
      (a) => a.AppBlockArn === appBlockArn,
    ),
  ).toBe(true);

  await client.send(
    new DisassociateAppBlockBuilderAppBlockCommand({
      AppBlockBuilderName: builderName,
      AppBlockArn: appBlockArn,
    }),
  );

  const described = await client.send(
    new DescribeAppBlockBuildersCommand({ Names: [builderName] }),
  );
  expect(
    (described.AppBlockBuilders ?? []).some((b) => b.Name === builderName),
  ).toBe(true);

  await client.send(new DeleteAppBlockBuilderCommand({ Name: builderName }));
  await client.send(new DeleteAppBlockCommand({ Name: appBlockName }));

  const afterDelete = await client.send(new DescribeAppBlocksCommand({}));
  expect(
    (afterDelete.AppBlocks ?? []).some((b) => b.Name === appBlockName),
  ).toBe(false);
});

test("AppStream application lifecycle", async () => {
  const client = appstream();
  const blockName = "e2e-app-block";
  const appName = "e2e-application";

  const block = await client.send(
    new CreateAppBlockCommand({
      Name: blockName,
      SourceS3Location: { S3Bucket: "test-bucket" },
    }),
  );
  const blockArn = block.AppBlock!.Arn!;

  const created = await client.send(
    new CreateApplicationCommand({
      Name: appName,
      AppBlockArn: blockArn,
      IconS3Location: { S3Bucket: "test-bucket", S3Key: "icon.png" },
      LaunchPath: "/app/run",
      Platforms: ["WINDOWS_SERVER_2019"],
      InstanceFamilies: ["GENERAL_PURPOSE"],
    }),
  );
  expect(created.Application?.Name).toBe(appName);
  expect(created.Application?.AppBlockArn).toBe(blockArn);

  const described = await client.send(new DescribeApplicationsCommand({}));
  expect((described.Applications ?? []).some((a) => a.Name === appName)).toBe(
    true,
  );

  await client.send(new DeleteApplicationCommand({ Name: appName }));
  await client.send(new DeleteAppBlockCommand({ Name: blockName }));
});

test("AppStream image-builder lifecycle", async () => {
  const client = appstream();
  const builderName = "e2e-img-builder";

  const created = await client.send(
    new CreateImageBuilderCommand({
      Name: builderName,
      InstanceType: "stream.standard.medium",
    }),
  );
  expect(created.ImageBuilder?.Name).toBe(builderName);
  expect(created.ImageBuilder?.State).toBe("RUNNING");

  const described = await client.send(
    new DescribeImageBuildersCommand({ Names: [builderName] }),
  );
  expect(
    (described.ImageBuilders ?? []).some((b) => b.Name === builderName),
  ).toBe(true);

  await client.send(new DeleteImageBuilderCommand({ Name: builderName }));

  const afterDelete = await client.send(new DescribeImageBuildersCommand({}));
  expect(
    (afterDelete.ImageBuilders ?? []).some((b) => b.Name === builderName),
  ).toBe(false);
});

test("AppStream directory-config lifecycle", async () => {
  const client = appstream();
  const dirName = "corp.example.com";

  const created = await client.send(
    new CreateDirectoryConfigCommand({
      DirectoryName: dirName,
      OrganizationalUnitDistinguishedNames: [
        "OU=AppStream,DC=corp,DC=example,DC=com",
      ],
    }),
  );
  expect(created.DirectoryConfig?.DirectoryName).toBe(dirName);

  const described = await client.send(
    new DescribeDirectoryConfigsCommand({ DirectoryNames: [dirName] }),
  );
  expect(
    (described.DirectoryConfigs ?? []).some((d) => d.DirectoryName === dirName),
  ).toBe(true);

  await client.send(
    new DeleteDirectoryConfigCommand({ DirectoryName: dirName }),
  );
});

test("AppStream entitlement lifecycle", async () => {
  const client = appstream();
  const stackName = "e2e-entitlement-stack";
  const entitlementName = "e2e-entitlement";

  await client.send(new CreateStackCommand({ Name: stackName }));

  const created = await client.send(
    new CreateEntitlementCommand({
      Name: entitlementName,
      StackName: stackName,
      AppVisibility: "ALL",
      Attributes: [{ Name: "saml:sub_type", Value: "persistent" }],
    }),
  );
  expect(created.Entitlement?.Name).toBe(entitlementName);
  expect(created.Entitlement?.StackName).toBe(stackName);

  const described = await client.send(
    new DescribeEntitlementsCommand({ StackName: stackName }),
  );
  expect(
    (described.Entitlements ?? []).some((e) => e.Name === entitlementName),
  ).toBe(true);

  await client.send(
    new DeleteEntitlementCommand({
      Name: entitlementName,
      StackName: stackName,
    }),
  );
  await client.send(new DeleteStackCommand({ Name: stackName }));
});

test("AppStream user lifecycle", async () => {
  const client = appstream();
  const userName = "e2e-user@example.com";
  const authType = "USERPOOL";

  await client.send(
    new CreateUserCommand({ UserName: userName, AuthenticationType: authType }),
  );

  const described = await client.send(
    new DescribeUsersCommand({ AuthenticationType: authType }),
  );
  const user = (described.Users ?? []).find((u) => u.UserName === userName);
  expect(user).toBeDefined();
  expect(user?.Enabled).toBe(true);

  await client.send(
    new DisableUserCommand({
      UserName: userName,
      AuthenticationType: authType,
    }),
  );
  const afterDisable = await client.send(
    new DescribeUsersCommand({ AuthenticationType: authType }),
  );
  expect(
    (afterDisable.Users ?? []).find((u) => u.UserName === userName)?.Enabled,
  ).toBe(false);

  await client.send(
    new EnableUserCommand({ UserName: userName, AuthenticationType: authType }),
  );
  await client.send(
    new DeleteUserCommand({ UserName: userName, AuthenticationType: authType }),
  );
});

test("AppStream theme lifecycle", async () => {
  const client = appstream();
  const stackName = "e2e-theme-stack";

  await client.send(new CreateStackCommand({ Name: stackName }));

  const created = await client.send(
    new CreateThemeForStackCommand({
      StackName: stackName,
      TitleText: "My App",
      ThemeStyling: "BLUE",
      OrganizationLogoS3Location: { S3Bucket: "test-bucket" },
      FaviconS3Location: { S3Bucket: "test-bucket" },
    }),
  );
  expect(created.Theme?.StackName).toBe(stackName);
  expect(created.Theme?.State).toBe("ENABLED");

  const described = await client.send(
    new DescribeThemeForStackCommand({ StackName: stackName }),
  );
  expect(described.Theme?.StackName).toBe(stackName);

  await client.send(new DeleteThemeForStackCommand({ StackName: stackName }));
  await client.send(new DeleteStackCommand({ Name: stackName }));
});

test("AppStream tag lifecycle", async () => {
  const client = appstream();
  const stackName = "e2e-tag-stack";

  const stack = await client.send(new CreateStackCommand({ Name: stackName }));
  const stackArn = stack.Stack!.Arn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: stackArn,
      Tags: { env: "test", project: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: stackArn }),
  );
  expect(listed.Tags?.env).toBe("test");
  expect(listed.Tags?.project).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceArn: stackArn, TagKeys: ["env"] }),
  );
  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: stackArn }),
  );
  expect(afterUntag.Tags?.env).toBeUndefined();

  await client.send(new DeleteStackCommand({ Name: stackName }));
});

test("AppStream GetExportImageTask with TaskId and not-found error", async () => {
  const client = appstream();
  const imageName = "e2e-export-image";
  const amiName = "e2e-ami";

  await client.send(
    new CreateStackCommand({ Name: "e2e-export-stack-placeholder" }),
  );

  const created = await client.send(
    new CreateExportImageTaskCommand({
      ImageName: imageName,
      AmiName: amiName,
      IamRoleArn: "arn:aws:iam::123456789012:role/AppStreamExportRole",
    }),
  );
  const taskId = created.ExportImageTask?.TaskId;
  expect(taskId).toBeDefined();

  const fetched = await client.send(
    new GetExportImageTaskCommand({ TaskId: taskId }),
  );
  expect(fetched.ExportImageTask?.TaskId).toBe(taskId);
  expect(fetched.ExportImageTask?.AmiName).toBe(amiName);

  const notFound = client.send(
    new GetExportImageTaskCommand({ TaskId: "nonexistent-task-id" }),
  );
  await expect(notFound).rejects.toThrow();

  const listed = await client.send(new ListExportImageTasksCommand({}));
  expect((listed.ExportImageTasks ?? []).some((t) => t.TaskId === taskId)).toBe(
    true,
  );

  const filteredByState = await client.send(
    new ListExportImageTasksCommand({
      Filters: [{ Name: "State", Values: ["ACTIVE"] }],
    }),
  );
  expect(
    (filteredByState.ExportImageTasks ?? []).some((t) => t.TaskId === taskId),
  ).toBe(true);

  await client.send(
    new DeleteStackCommand({ Name: "e2e-export-stack-placeholder" }),
  );
});

test("AppStream DescribeSessions persistent sessions and pagination", async () => {
  const client = appstream();
  const stackName = "e2e-sessions-stack";
  const fleetName = "e2e-sessions-fleet";

  await client.send(new CreateStackCommand({ Name: stackName }));
  await client.send(
    new CreateFleetCommand({
      Name: fleetName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 2 },
    }),
  );

  await client.send(
    new CreateStreamingURLCommand({
      StackName: stackName,
      FleetName: fleetName,
      UserId: "user-a",
    }),
  );
  await client.send(
    new CreateStreamingURLCommand({
      StackName: stackName,
      FleetName: fleetName,
      UserId: "user-b",
    }),
  );
  await client.send(
    new CreateStreamingURLCommand({
      StackName: stackName,
      FleetName: fleetName,
      UserId: "user-c",
    }),
  );

  const allSessions = await client.send(
    new DescribeSessionsCommand({ StackName: stackName, FleetName: fleetName }),
  );
  expect((allSessions.Sessions ?? []).length).toBe(3);

  const page1 = await client.send(
    new DescribeSessionsCommand({
      StackName: stackName,
      FleetName: fleetName,
      Limit: 2,
    }),
  );
  expect((page1.Sessions ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new DescribeSessionsCommand({
      StackName: stackName,
      FleetName: fleetName,
      Limit: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect((page2.Sessions ?? []).length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  const userFiltered = await client.send(
    new DescribeSessionsCommand({
      StackName: stackName,
      FleetName: fleetName,
      UserId: "user-a",
    }),
  );
  expect((userFiltered.Sessions ?? []).length).toBe(1);
  expect(userFiltered.Sessions?.[0]?.UserId).toBe("user-a");

  const instanceId = allSessions.Sessions?.[0]?.InstanceId;
  expect(instanceId).toBeDefined();
  const instanceFiltered = await client.send(
    new DescribeSessionsCommand({
      StackName: stackName,
      FleetName: fleetName,
      InstanceId: instanceId,
    }),
  );
  expect((instanceFiltered.Sessions ?? []).length).toBe(1);

  await client.send(new DeleteFleetCommand({ Name: fleetName }));
  await client.send(new DeleteStackCommand({ Name: stackName }));
});

test("AppStream DeleteFleet ResourceInUseException when associated with stack", async () => {
  const client = appstream();
  const fleetName = "e2e-inuse-fleet";
  const stackName = "e2e-inuse-stack";

  await client.send(
    new CreateFleetCommand({
      Name: fleetName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 1 },
    }),
  );
  await client.send(new CreateStackCommand({ Name: stackName }));
  await client.send(
    new AssociateFleetCommand({ FleetName: fleetName, StackName: stackName }),
  );

  await expect(
    client.send(new DeleteFleetCommand({ Name: fleetName })),
  ).rejects.toMatchObject({ name: "ResourceInUseException" });

  await client.send(
    new DisassociateFleetCommand({
      FleetName: fleetName,
      StackName: stackName,
    }),
  );
  await client.send(new DeleteFleetCommand({ Name: fleetName }));
  await client.send(new DeleteStackCommand({ Name: stackName }));
});

test("AppStream multi-account fleet isolation", async () => {
  const client1 = new AppStreamClient({
    endpoint,
    region,
    credentials: {
      accessKeyId: "ASIA111111111111",
      secretAccessKey: "secret1",
    },
    requestHandler,
  });
  const client2 = new AppStreamClient({
    endpoint,
    region,
    credentials: {
      accessKeyId: "ASIA222222222222",
      secretAccessKey: "secret2",
    },
    requestHandler,
  });

  const sharedName = "e2e-isolation-fleet";
  await client1.send(
    new CreateFleetCommand({
      Name: sharedName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 1 },
    }),
  );
  await client2.send(
    new CreateFleetCommand({
      Name: sharedName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 1 },
    }),
  );

  const fleets1 = await client1.send(
    new DescribeFleetsCommand({ Names: [sharedName] }),
  );
  expect((fleets1.Fleets ?? []).length).toBe(1);
  expect(fleets1.Fleets?.[0]?.Arn).toContain("111111111111");

  const fleets2 = await client2.send(
    new DescribeFleetsCommand({ Names: [sharedName] }),
  );
  expect((fleets2.Fleets ?? []).length).toBe(1);
  expect(fleets2.Fleets?.[0]?.Arn).toContain("222222222222");

  await client1.send(new DeleteFleetCommand({ Name: sharedName }));
  await client2.send(new DeleteFleetCommand({ Name: sharedName }));
});

test("AppStream DescribeImages pagination with MaxResults and NextToken", async () => {
  const client = appstream();

  await client.send(
    new CreateImportedImageCommand({ Name: "e2e-img-1" }),
  );
  await client.send(
    new CreateImportedImageCommand({ Name: "e2e-img-2" }),
  );
  await client.send(
    new CreateImportedImageCommand({ Name: "e2e-img-3" }),
  );

  const page1 = await client.send(
    new DescribeImagesCommand({
      Names: ["e2e-img-1", "e2e-img-2", "e2e-img-3"],
      MaxResults: 2,
    }),
  );
  expect((page1.Images ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new DescribeImagesCommand({
      Names: ["e2e-img-1", "e2e-img-2", "e2e-img-3"],
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect((page2.Images ?? []).length).toBe(1);
  expect(page2.NextToken).toBeUndefined();
});

test("AppStream StopFleet on already-STOPPED raises OperationNotPermittedException", async () => {
  const client = appstream();
  const fleetName = "e2e-stop-guard-fleet";

  await client.send(
    new CreateFleetCommand({
      Name: fleetName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 1 },
    }),
  );

  await client.send(new StopFleetCommand({ Name: fleetName }));

  await expect(
    client.send(new StopFleetCommand({ Name: fleetName })),
  ).rejects.toMatchObject({ name: "OperationNotPermittedException" });

  await client.send(new StartFleetCommand({ Name: fleetName }));
  await client.send(new DeleteFleetCommand({ Name: fleetName }));
});

test("AppStream TagResource against bogus ARN raises ResourceNotFoundException", async () => {
  const client = appstream();
  const bogusArn =
    "arn:aws:appstream:us-east-1:123456789012:fleet/nonexistent-fleet";

  await expect(
    client.send(
      new TagResourceCommand({ ResourceArn: bogusArn, Tags: { key: "val" } }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  await expect(
    client.send(new ListTagsForResourceCommand({ ResourceArn: bogusArn })),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});
