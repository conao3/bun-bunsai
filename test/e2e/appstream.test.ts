import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AppStreamClient,
  AssociateAppBlockBuilderAppBlockCommand,
  CreateAppBlockBuilderCommand,
  CreateAppBlockCommand,
  CreateApplicationCommand,
  CreateDirectoryConfigCommand,
  CreateEntitlementCommand,
  CreateFleetCommand,
  CreateImageBuilderCommand,
  CreateStackCommand,
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
  DescribeStacksCommand,
  DescribeThemeForStackCommand,
  DescribeUsersCommand,
  DisableUserCommand,
  DisassociateAppBlockBuilderAppBlockCommand,
  EnableUserCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-appstream";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const appstream = () =>
  new AppStreamClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
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
