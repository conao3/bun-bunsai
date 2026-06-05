import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

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
