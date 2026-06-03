import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  AppConfigClient,
  CreateApplicationCommand,
  CreateConfigurationProfileCommand,
  CreateDeploymentStrategyCommand,
  CreateEnvironmentCommand,
  CreateExtensionAssociationCommand,
  CreateExtensionCommand,
  CreateHostedConfigurationVersionCommand,
  DeleteApplicationCommand,
  DeleteConfigurationProfileCommand,
  DeleteDeploymentStrategyCommand,
  DeleteEnvironmentCommand,
  DeleteExtensionAssociationCommand,
  DeleteExtensionCommand,
  DeleteHostedConfigurationVersionCommand,
  GetApplicationCommand,
  GetConfigurationProfileCommand,
  GetDeploymentCommand,
  GetDeploymentStrategyCommand,
  GetEnvironmentCommand,
  GetExtensionAssociationCommand,
  GetExtensionCommand,
  GetHostedConfigurationVersionCommand,
  ListApplicationsCommand,
  ListConfigurationProfilesCommand,
  ListDeploymentStrategiesCommand,
  ListDeploymentsCommand,
  ListEnvironmentsCommand,
  ListExtensionAssociationsCommand,
  ListExtensionsCommand,
  ListHostedConfigurationVersionsCommand,
  ListTagsForResourceCommand,
  StartDeploymentCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApplicationCommand,
  UpdateConfigurationProfileCommand,
  UpdateDeploymentStrategyCommand,
  UpdateEnvironmentCommand,
  UpdateExtensionAssociationCommand,
  UpdateExtensionCommand,
} from "@aws-sdk/client-appconfig";

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

const appconfig = () =>
  new AppConfigClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AppConfig application and environment roundtrip", async () => {
  const client = appconfig();
  const appName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateApplicationCommand({
      Name: appName,
      Description: "bunsai e2e application",
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Name).toBe(appName);
  const applicationId = created.Id ?? "";

  const got = await client.send(
    new GetApplicationCommand({ ApplicationId: applicationId }),
  );
  expect(got.Id).toBe(applicationId);
  expect(got.Name).toBe(appName);
  expect(got.Description).toBe("bunsai e2e application");

  const listed = await client.send(new ListApplicationsCommand({}));
  expect((listed.Items ?? []).map((a) => a.Id)).toContain(applicationId);

  const updated = await client.send(
    new UpdateApplicationCommand({
      ApplicationId: applicationId,
      Description: "updated description",
    }),
  );
  expect(updated.Description).toBe("updated description");
  expect(updated.Name).toBe(appName);

  const envName = `bunsai-env-${Date.now()}`;
  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: envName,
    }),
  );
  expect(env.Id).toBeDefined();
  expect(env.ApplicationId).toBe(applicationId);
  expect(env.Name).toBe(envName);
  expect(env.State).toBe("READY_FOR_DEPLOYMENT");

  const envs = await client.send(
    new ListEnvironmentsCommand({ ApplicationId: applicationId }),
  );
  expect((envs.Items ?? []).map((e) => e.Name)).toContain(envName);

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
  await expect(
    client.send(new GetApplicationCommand({ ApplicationId: applicationId })),
  ).rejects.toThrow();
});

test("AppConfig configuration profile lifecycle", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-cp-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-profile-${ts}`,
      LocationUri: "hosted",
      Type: "AWS.Freeform",
    }),
  );
  expect(profile.Id).toBeDefined();
  expect(profile.ApplicationId).toBe(applicationId);
  expect(profile.LocationUri).toBe("hosted");

  const profileId = profile.Id ?? "";

  const got = await client.send(
    new GetConfigurationProfileCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: profileId,
    }),
  );
  expect(got.Id).toBe(profileId);

  const listed = await client.send(
    new ListConfigurationProfilesCommand({ ApplicationId: applicationId }),
  );
  expect((listed.Items ?? []).map((p) => p.Id)).toContain(profileId);

  const upd = await client.send(
    new UpdateConfigurationProfileCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: profileId,
      Description: "updated",
    }),
  );
  expect(upd.Description).toBe("updated");

  await client.send(
    new DeleteConfigurationProfileCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: profileId,
    }),
  );
  await expect(
    client.send(
      new GetConfigurationProfileCommand({
        ApplicationId: applicationId,
        ConfigurationProfileId: profileId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig deployment strategy lifecycle", async () => {
  const client = appconfig();
  const ts = Date.now();

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-strategy-${ts}`,
      DeploymentDurationInMinutes: 5,
      GrowthFactor: 25,
      ReplicateTo: "NONE",
    }),
  );
  expect(strategy.Id).toBeDefined();
  expect(strategy.DeploymentDurationInMinutes).toBe(5);
  expect(strategy.GrowthFactor).toBe(25);

  const strategyId = strategy.Id ?? "";

  const got = await client.send(
    new GetDeploymentStrategyCommand({ DeploymentStrategyId: strategyId }),
  );
  expect(got.Id).toBe(strategyId);

  const listed = await client.send(new ListDeploymentStrategiesCommand({}));
  expect((listed.Items ?? []).map((s) => s.Id)).toContain(strategyId);

  const upd = await client.send(
    new UpdateDeploymentStrategyCommand({
      DeploymentStrategyId: strategyId,
      Description: "updated strategy",
    }),
  );
  expect(upd.Description).toBe("updated strategy");

  await client.send(
    new DeleteDeploymentStrategyCommand({ DeploymentStrategyId: strategyId }),
  );
  await expect(
    client.send(
      new GetDeploymentStrategyCommand({ DeploymentStrategyId: strategyId }),
    ),
  ).rejects.toThrow();
});

test("AppConfig environment get/update/delete", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-env-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-env-${ts}`,
    }),
  );
  const environmentId = env.Id ?? "";

  const got = await client.send(
    new GetEnvironmentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
    }),
  );
  expect(got.Id).toBe(environmentId);
  expect(got.State).toBe("READY_FOR_DEPLOYMENT");

  const upd = await client.send(
    new UpdateEnvironmentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      Description: "updated env",
    }),
  );
  expect(upd.Description).toBe("updated env");

  await client.send(
    new DeleteEnvironmentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
    }),
  );
  await expect(
    client.send(
      new GetEnvironmentCommand({
        ApplicationId: applicationId,
        EnvironmentId: environmentId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig deployment lifecycle", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-dep-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-env-dep-${ts}`,
    }),
  );
  const environmentId = env.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-cp-dep-${ts}`,
      LocationUri: "hosted",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-strat-dep-${ts}`,
      DeploymentDurationInMinutes: 0,
      GrowthFactor: 100,
      ReplicateTo: "NONE",
    }),
  );
  const deploymentStrategyId = strategy.Id ?? "";

  const dep = await client.send(
    new StartDeploymentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      DeploymentStrategyId: deploymentStrategyId,
      ConfigurationProfileId: configurationProfileId,
      ConfigurationVersion: "1",
    }),
  );
  expect(dep.DeploymentNumber).toBe(1);
  expect(dep.State).toBe("COMPLETE");

  const got = await client.send(
    new GetDeploymentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      DeploymentNumber: 1,
    }),
  );
  expect(got.DeploymentNumber).toBe(1);
  expect(got.ConfigurationVersion).toBe("1");

  const listed = await client.send(
    new ListDeploymentsCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
    }),
  );
  expect((listed.Items ?? []).length).toBeGreaterThan(0);

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
  await client.send(
    new DeleteDeploymentStrategyCommand({
      DeploymentStrategyId: deploymentStrategyId,
    }),
  );
});

test("AppConfig extension and association lifecycle", async () => {
  const client = appconfig();
  const ts = Date.now();

  const ext = await client.send(
    new CreateExtensionCommand({
      Name: `e2e-ext-${ts}`,
      Actions: {},
    }),
  );
  expect(ext.Id).toBeDefined();
  expect(ext.VersionNumber).toBe(1);
  const extensionId = ext.Id ?? "";

  const gotExt = await client.send(
    new GetExtensionCommand({ ExtensionIdentifier: extensionId }),
  );
  expect(gotExt.Id).toBe(extensionId);

  const listedExt = await client.send(new ListExtensionsCommand({}));
  expect((listedExt.Items ?? []).map((e) => e.Id)).toContain(extensionId);

  const updExt = await client.send(
    new UpdateExtensionCommand({
      ExtensionIdentifier: extensionId,
      Description: "updated ext",
    }),
  );
  expect(updExt.Description).toBe("updated ext");
  expect(updExt.VersionNumber).toBe(2);

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-ext-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const assoc = await client.send(
    new CreateExtensionAssociationCommand({
      ExtensionIdentifier: extensionId,
      ResourceIdentifier: applicationId,
    }),
  );
  expect(assoc.Id).toBeDefined();
  const assocId = assoc.Id ?? "";

  const gotAssoc = await client.send(
    new GetExtensionAssociationCommand({ ExtensionAssociationId: assocId }),
  );
  expect(gotAssoc.Id).toBe(assocId);

  const listedAssoc = await client.send(
    new ListExtensionAssociationsCommand({}),
  );
  expect((listedAssoc.Items ?? []).map((a) => a.Id)).toContain(assocId);

  const updAssoc = await client.send(
    new UpdateExtensionAssociationCommand({ ExtensionAssociationId: assocId }),
  );
  expect(updAssoc.Id).toBe(assocId);

  await client.send(
    new DeleteExtensionAssociationCommand({ ExtensionAssociationId: assocId }),
  );
  await expect(
    client.send(
      new GetExtensionAssociationCommand({ ExtensionAssociationId: assocId }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteExtensionCommand({ ExtensionIdentifier: extensionId }),
  );
  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig hosted configuration version lifecycle", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-hcv-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-cp-hcv-${ts}`,
      LocationUri: "hosted",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  const hcv = await client.send(
    new CreateHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      Content: Buffer.from(JSON.stringify({ enabled: true })),
      ContentType: "application/json",
    }),
  );
  expect(hcv.VersionNumber).toBe(1);
  expect(hcv.ApplicationId).toBe(applicationId);

  const got = await client.send(
    new GetHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      VersionNumber: 1,
    }),
  );
  expect(got.VersionNumber).toBe(1);
  expect(got.ContentType).toContain("application/json");

  const listed = await client.send(
    new ListHostedConfigurationVersionsCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
    }),
  );
  expect((listed.Items ?? []).length).toBe(1);

  await client.send(
    new DeleteHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      VersionNumber: 1,
    }),
  );
  await expect(
    client.send(
      new GetHostedConfigurationVersionCommand({
        ApplicationId: applicationId,
        ConfigurationProfileId: configurationProfileId,
        VersionNumber: 1,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig tags lifecycle", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-tags-${ts}` }),
  );
  const applicationId = app.Id ?? "";
  const resourceArn = `arn:aws:appconfig:${region}:000000000000:application/${applicationId}`;

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: { env: "test", project: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(listed.Tags?.env).toBe("test");
  expect(listed.Tags?.project).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env"],
    }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(after.Tags?.env).toBeUndefined();
  expect(after.Tags?.project).toBe("bunsai");

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});
