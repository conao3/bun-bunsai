import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateAppCommand,
  CreateAppImageConfigCommand,
  CreateDomainCommand,
  CreateSpaceCommand,
  CreateUserProfileCommand,
  DeleteAppCommand,
  DeleteAppImageConfigCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4907;
const uiPort = 5907;
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

const sagemaker = () =>
  new SageMakerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("SageMaker domain → user-profile → app lifecycle", async () => {
  const client = sagemaker();
  const domainName = "bunsai-e2e-domain";
  const userProfileName = "bunsai-e2e-user";
  const spaceName = "bunsai-e2e-space";
  const appName = "default";
  const appType = "JupyterServer";

  const createdDomain = await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      AuthMode: "IAM",
      DefaultUserSettings: {},
      SubnetIds: ["subnet-12345678"],
      VpcId: "vpc-12345678",
    }),
  );
  expect(createdDomain.DomainArn).toContain("domain/");
  expect(createdDomain.DomainId).toBeDefined();
  expect(createdDomain.Url).toContain("sagemaker.aws");

  const domainId = createdDomain.DomainId!;

  const createdUserProfile = await client.send(
    new CreateUserProfileCommand({
      DomainId: domainId,
      UserProfileName: userProfileName,
    }),
  );
  expect(createdUserProfile.UserProfileArn).toContain(
    `user-profile/${domainId}/${userProfileName}`,
  );

  const createdSpace = await client.send(
    new CreateSpaceCommand({
      DomainId: domainId,
      SpaceName: spaceName,
    }),
  );
  expect(createdSpace.SpaceArn).toContain(`space/${domainId}/${spaceName}`);

  const createdApp = await client.send(
    new CreateAppCommand({
      DomainId: domainId,
      UserProfileName: userProfileName,
      AppType: appType,
      AppName: appName,
    }),
  );
  expect(createdApp.AppArn).toContain(`app/${domainId}`);
  expect(createdApp.AppArn).toContain(appType);
  expect(createdApp.AppArn).toContain(appName);

  await client.send(
    new DeleteAppCommand({
      DomainId: domainId,
      UserProfileName: userProfileName,
      AppType: appType,
      AppName: appName,
    }),
  );

  const createdImageConfig = await client.send(
    new CreateAppImageConfigCommand({
      AppImageConfigName: "bunsai-e2e-image-config",
    }),
  );
  expect(createdImageConfig.AppImageConfigArn).toContain(
    "app-image-config/bunsai-e2e-image-config",
  );

  await client.send(
    new DeleteAppImageConfigCommand({
      AppImageConfigName: "bunsai-e2e-image-config",
    }),
  );
});
