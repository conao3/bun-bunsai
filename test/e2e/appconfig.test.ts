import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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
  GetConfigurationCommand,
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
  StopDeploymentCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApplicationCommand,
  UpdateConfigurationProfileCommand,
  UpdateDeploymentStrategyCommand,
  UpdateEnvironmentCommand,
  UpdateExtensionAssociationCommand,
  UpdateExtensionCommand,
  ValidateConfigurationCommand,
} from "@aws-sdk/client-appconfig";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const appconfig = () =>
  new AppConfigClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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

test("AppConfig GetConfiguration returns deployed content", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-gc-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-env-gc-${ts}`,
    }),
  );
  const environmentId = env.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-cp-gc-${ts}`,
      LocationUri: "hosted",
      Type: "AWS.Freeform",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-strat-gc-${ts}`,
      DeploymentDurationInMinutes: 0,
      GrowthFactor: 100,
      ReplicateTo: "NONE",
    }),
  );
  const deploymentStrategyId = strategy.Id ?? "";

  const configContent = JSON.stringify({ feature: "enabled", value: 42 });
  const hcv = await client.send(
    new CreateHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      Content: Buffer.from(configContent),
      ContentType: "application/json",
      VersionLabel: "v1.0",
    }),
  );
  expect(hcv.VersionNumber).toBe(1);
  expect(hcv.VersionLabel).toBe("v1.0");

  const dep = await client.send(
    new StartDeploymentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      DeploymentStrategyId: deploymentStrategyId,
      ConfigurationProfileId: configurationProfileId,
      ConfigurationVersion: "1",
    }),
  );
  expect(dep.State).toBe("COMPLETE");
  expect(dep.VersionLabel).toBe("v1.0");

  const config = await client.send(
    new GetConfigurationCommand({
      Application: applicationId,
      Environment: environmentId,
      Configuration: configurationProfileId,
      ClientId: "e2e-client",
    }),
  );
  expect(config.ConfigurationVersion).toBe("1");
  expect(config.ContentType).toBe("application/json");
  const body = config.Content
    ? Buffer.from(config.Content).toString("utf8")
    : "";
  expect(JSON.parse(body)).toEqual({ feature: "enabled", value: 42 });

  const unchanged = await client.send(
    new GetConfigurationCommand({
      Application: applicationId,
      Environment: environmentId,
      Configuration: configurationProfileId,
      ClientId: "e2e-client",
      ClientConfigurationVersion: "1",
    }),
  );
  expect(unchanged.ConfigurationVersion).toBe("1");
  expect(unchanged.Content).toBeDefined();
  const unchangedBody = unchanged.Content
    ? Buffer.from(unchanged.Content).toString("utf8")
    : "";
  expect(unchangedBody).toBe("");

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
  await client.send(
    new DeleteDeploymentStrategyCommand({
      DeploymentStrategyId: deploymentStrategyId,
    }),
  );
});

test("AppConfig List operations NextToken pagination", async () => {
  const client = appconfig();
  const ts = Date.now();

  const appIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await client.send(
      new CreateApplicationCommand({ Name: `e2e-page-app-${ts}-${i}` }),
    );
    appIds.push(a.Id ?? "");
  }

  const page1 = await client.send(
    new ListApplicationsCommand({ MaxResults: 2 }),
  );
  const page1Ids = (page1.Items ?? []).map((a) => a.Id);
  const hasCreatedApps = appIds.some((id) => page1Ids.includes(id));
  expect(hasCreatedApps).toBe(true);

  if (page1.NextToken) {
    const page2 = await client.send(
      new ListApplicationsCommand({
        MaxResults: 2,
        NextToken: page1.NextToken,
      }),
    );
    expect(Array.isArray(page2.Items)).toBe(true);
  }

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-page-parent-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const envIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const e = await client.send(
      new CreateEnvironmentCommand({
        ApplicationId: applicationId,
        Name: `e2e-page-env-${ts}-${i}`,
      }),
    );
    envIds.push(e.Id ?? "");
  }

  const envPage1 = await client.send(
    new ListEnvironmentsCommand({
      ApplicationId: applicationId,
      MaxResults: 2,
    }),
  );
  expect((envPage1.Items ?? []).length).toBe(2);
  expect(envPage1.NextToken).toBeDefined();

  const envPage2 = await client.send(
    new ListEnvironmentsCommand({
      ApplicationId: applicationId,
      MaxResults: 2,
      NextToken: envPage1.NextToken,
    }),
  );
  expect((envPage2.Items ?? []).length).toBe(1);
  expect(envPage2.NextToken).toBeUndefined();

  for (const id of appIds) {
    await client.send(new DeleteApplicationCommand({ ApplicationId: id }));
  }
  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig StopDeployment AllowRevert and terminal-state rejection", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-stop-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-env-stop-${ts}`,
    }),
  );
  const environmentId = env.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-cp-stop-${ts}`,
      LocationUri: "hosted",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-strat-stop-${ts}`,
      DeploymentDurationInMinutes: 0,
      GrowthFactor: 100,
      ReplicateTo: "NONE",
    }),
  );
  const deploymentStrategyId = strategy.Id ?? "";

  await client.send(
    new StartDeploymentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      DeploymentStrategyId: deploymentStrategyId,
      ConfigurationProfileId: configurationProfileId,
      ConfigurationVersion: "1",
    }),
  );

  const stopped = await client.send(
    new StopDeploymentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      DeploymentNumber: 1,
      AllowRevert: true,
    }),
  );
  expect(stopped.State).toBe("REVERTED");

  await expect(
    client.send(
      new StopDeploymentCommand({
        ApplicationId: applicationId,
        EnvironmentId: environmentId,
        DeploymentNumber: 1,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
  await client.send(
    new DeleteDeploymentStrategyCommand({
      DeploymentStrategyId: deploymentStrategyId,
    }),
  );
});

test("AppConfig ValidateConfiguration against profile validators", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-app-val-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-cp-val-${ts}`,
      LocationUri: "hosted",
      Validators: [{ Type: "JSON_SCHEMA", Content: '{"type":"object"}' }],
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  await client.send(
    new CreateHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      Content: Buffer.from('{"key":"value"}'),
      ContentType: "application/json",
    }),
  );

  await expect(
    client.send(
      new ValidateConfigurationCommand({
        ApplicationId: applicationId,
        ConfigurationProfileId: configurationProfileId,
        ConfigurationVersion: "1",
      }),
    ),
  ).resolves.toBeDefined();

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig UpdateDeploymentStrategy updates non-immutable fields", async () => {
  const client = appconfig();
  const ts = Date.now();

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-strat-upd-${ts}`,
      DeploymentDurationInMinutes: 5,
      GrowthFactor: 25,
      ReplicateTo: "NONE",
    }),
  );
  const strategyId = strategy.Id ?? "";
  expect(strategy.Name).toBe(`e2e-strat-upd-${ts}`);

  const updated = await client.send(
    new UpdateDeploymentStrategyCommand({
      DeploymentStrategyId: strategyId,
      Description: "updated description",
      DeploymentDurationInMinutes: 10,
      GrowthFactor: 50,
    }),
  );
  expect(updated.Name).toBe(`e2e-strat-upd-${ts}`);
  expect(updated.Description).toBe("updated description");
  expect(updated.DeploymentDurationInMinutes).toBe(10);
  expect(updated.GrowthFactor).toBe(50);
  expect(updated.ReplicateTo).toBe("NONE");

  await client.send(
    new DeleteDeploymentStrategyCommand({ DeploymentStrategyId: strategyId }),
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

test("AppConfig Create with Tags round-trip", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({
      Name: `e2e-tags-create-app-${ts}`,
      Tags: { tier: "gold", owner: "bunsai" },
    }),
  );
  const applicationId = app.Id ?? "";
  const appArn = `arn:aws:appconfig:${region}:000000000000:application/${applicationId}`;
  const appTags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: appArn }),
  );
  expect(appTags.Tags?.tier).toBe("gold");
  expect(appTags.Tags?.owner).toBe("bunsai");

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-tags-env-${ts}`,
      Tags: { env: "staging" },
    }),
  );
  const envId = env.Id ?? "";
  const envArn = `arn:aws:appconfig:${region}:000000000000:application/${applicationId}/environment/${envId}`;
  const envTags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: envArn }),
  );
  expect(envTags.Tags?.env).toBe("staging");

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-tags-cp-${ts}`,
      LocationUri: "hosted",
      Tags: { profile: "main" },
    }),
  );
  const profileId = profile.Id ?? "";
  const profileArn = `arn:aws:appconfig:${region}:000000000000:application/${applicationId}/configurationprofile/${profileId}`;
  const profileTags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: profileArn }),
  );
  expect(profileTags.Tags?.profile).toBe("main");

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-tags-strat-${ts}`,
      DeploymentDurationInMinutes: 0,
      GrowthFactor: 100,
      ReplicateTo: "NONE",
      Tags: { strategy: "fast" },
    }),
  );
  const strategyId = strategy.Id ?? "";
  const stratArn = `arn:aws:appconfig:${region}:000000000000:deploymentstrategy/${strategyId}`;
  const stratTags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: stratArn }),
  );
  expect(stratTags.Tags?.strategy).toBe("fast");

  const ext = await client.send(
    new CreateExtensionCommand({
      Name: `e2e-tags-ext-${ts}`,
      Actions: {},
      Tags: { ext: "yes" },
    }),
  );
  const extId = ext.Id ?? "";
  const extArn = ext.Arn ?? "";
  const extTags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: extArn }),
  );
  expect(extTags.Tags?.ext).toBe("yes");

  const assoc = await client.send(
    new CreateExtensionAssociationCommand({
      ExtensionIdentifier: extId,
      ResourceIdentifier: appArn,
      Tags: { assoc: "bound" },
    }),
  );
  const assocArn = assoc.Arn ?? "";
  const assocTags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: assocArn }),
  );
  expect(assocTags.Tags?.assoc).toBe("bound");

  await client.send(
    new DeleteExtensionAssociationCommand({
      ExtensionAssociationId: assoc.Id ?? "",
    }),
  );
  await client.send(new DeleteExtensionCommand({ ExtensionIdentifier: extId }));
  await client.send(
    new DeleteDeploymentStrategyCommand({ DeploymentStrategyId: strategyId }),
  );
  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig Delete cleans up tags", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({
      Name: `e2e-tags-del-app-${ts}`,
      Tags: { leak: "yes" },
    }),
  );
  const applicationId = app.Id ?? "";
  const appArn = `arn:aws:appconfig:${region}:000000000000:application/${applicationId}`;

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );

  const app2 = await client.send(
    new CreateApplicationCommand({ Name: `e2e-tags-del-app2-${ts}` }),
  );
  const applicationId2 = app2.Id ?? "";
  const app2Arn = `arn:aws:appconfig:${region}:000000000000:application/${applicationId2}`;

  expect(applicationId2).not.toBe(applicationId);
  expect(app2Arn).not.toBe(appArn);

  const tags2 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: app2Arn }),
  );
  expect(tags2.Tags?.leak).toBeUndefined();

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId2 }),
  );
});

test("AppConfig pagination: extensions, associations, versions, deployments", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-page2-app-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-page2-env-${ts}`,
    }),
  );
  const environmentId = env.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-page2-cp-${ts}`,
      LocationUri: "hosted",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-page2-strat-${ts}`,
      DeploymentDurationInMinutes: 0,
      GrowthFactor: 100,
      ReplicateTo: "NONE",
    }),
  );
  const deploymentStrategyId = strategy.Id ?? "";

  const extIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const e = await client.send(
      new CreateExtensionCommand({
        Name: `e2e-page2-ext-${ts}-${i}`,
        Actions: {},
      }),
    );
    extIds.push(e.Id ?? "");
  }

  const extPage1 = await client.send(
    new ListExtensionsCommand({ MaxResults: 2 }),
  );
  expect(extPage1.NextToken).toBeDefined();
  if (extPage1.NextToken) {
    const extPage2 = await client.send(
      new ListExtensionsCommand({
        MaxResults: 2,
        NextToken: extPage1.NextToken,
      }),
    );
    expect(Array.isArray(extPage2.Items)).toBe(true);
  }

  const assocIds: string[] = [];
  for (const extId of extIds) {
    const a = await client.send(
      new CreateExtensionAssociationCommand({
        ExtensionIdentifier: extId,
        ResourceIdentifier: applicationId,
      }),
    );
    assocIds.push(a.Id ?? "");
  }

  const assocPage1 = await client.send(
    new ListExtensionAssociationsCommand({ MaxResults: 2 }),
  );
  expect(assocPage1.NextToken).toBeDefined();
  if (assocPage1.NextToken) {
    const assocPage2 = await client.send(
      new ListExtensionAssociationsCommand({
        MaxResults: 2,
        NextToken: assocPage1.NextToken,
      }),
    );
    expect(Array.isArray(assocPage2.Items)).toBe(true);
  }

  for (let i = 0; i < 3; i++) {
    await client.send(
      new CreateHostedConfigurationVersionCommand({
        ApplicationId: applicationId,
        ConfigurationProfileId: configurationProfileId,
        Content: Buffer.from(`v${i + 1}`),
        ContentType: "text/plain",
      }),
    );
  }

  const hcvPage1 = await client.send(
    new ListHostedConfigurationVersionsCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      MaxResults: 2,
    }),
  );
  expect((hcvPage1.Items ?? []).length).toBe(2);
  expect(hcvPage1.NextToken).toBeDefined();
  const hcvPage2 = await client.send(
    new ListHostedConfigurationVersionsCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      MaxResults: 2,
      NextToken: hcvPage1.NextToken,
    }),
  );
  expect((hcvPage2.Items ?? []).length).toBe(1);
  expect(hcvPage2.NextToken).toBeUndefined();

  for (let i = 0; i < 3; i++) {
    await client.send(
      new StartDeploymentCommand({
        ApplicationId: applicationId,
        EnvironmentId: environmentId,
        DeploymentStrategyId: deploymentStrategyId,
        ConfigurationProfileId: configurationProfileId,
        ConfigurationVersion: String(i + 1),
      }),
    );
  }

  const depPage1 = await client.send(
    new ListDeploymentsCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      MaxResults: 2,
    }),
  );
  expect((depPage1.Items ?? []).length).toBe(2);
  expect(depPage1.NextToken).toBeDefined();
  const depPage2 = await client.send(
    new ListDeploymentsCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      MaxResults: 2,
      NextToken: depPage1.NextToken,
    }),
  );
  expect((depPage2.Items ?? []).length).toBe(1);
  expect(depPage2.NextToken).toBeUndefined();

  for (const assocId of assocIds) {
    await client.send(
      new DeleteExtensionAssociationCommand({
        ExtensionAssociationId: assocId,
      }),
    );
  }
  for (const extId of extIds) {
    await client.send(
      new DeleteExtensionCommand({ ExtensionIdentifier: extId }),
    );
  }
  await client.send(
    new DeleteDeploymentStrategyCommand({
      DeploymentStrategyId: deploymentStrategyId,
    }),
  );
  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig in-use guards: ConflictException on delete", async () => {
  const client = appconfig();
  const ts = Date.now();

  const ext = await client.send(
    new CreateExtensionCommand({
      Name: `e2e-guard-ext-${ts}`,
      Actions: {},
    }),
  );
  const extId = ext.Id ?? "";

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-guard-app-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const assoc = await client.send(
    new CreateExtensionAssociationCommand({
      ExtensionIdentifier: extId,
      ResourceIdentifier: applicationId,
    }),
  );
  const assocId = assoc.Id ?? "";

  await expect(
    client.send(new DeleteExtensionCommand({ ExtensionIdentifier: extId })),
  ).rejects.toThrow();

  await client.send(
    new DeleteExtensionAssociationCommand({ ExtensionAssociationId: assocId }),
  );
  await client.send(new DeleteExtensionCommand({ ExtensionIdentifier: extId }));

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-guard-cp-${ts}`,
      LocationUri: "hosted",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: `e2e-guard-env-${ts}`,
    }),
  );
  const environmentId = env.Id ?? "";

  const strategy = await client.send(
    new CreateDeploymentStrategyCommand({
      Name: `e2e-guard-strat-${ts}`,
      DeploymentDurationInMinutes: 0,
      GrowthFactor: 100,
      ReplicateTo: "NONE",
    }),
  );
  const deploymentStrategyId = strategy.Id ?? "";

  await client.send(
    new CreateHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      Content: Buffer.from("config"),
      ContentType: "text/plain",
    }),
  );

  await client.send(
    new StartDeploymentCommand({
      ApplicationId: applicationId,
      EnvironmentId: environmentId,
      DeploymentStrategyId: deploymentStrategyId,
      ConfigurationProfileId: configurationProfileId,
      ConfigurationVersion: "1",
    }),
  );

  await expect(
    client.send(
      new DeleteHostedConfigurationVersionCommand({
        ApplicationId: applicationId,
        ConfigurationProfileId: configurationProfileId,
        VersionNumber: 1,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteDeploymentStrategyCommand({
      DeploymentStrategyId: deploymentStrategyId,
    }),
  );
  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});

test("AppConfig LatestVersionNumber optimistic lock", async () => {
  const client = appconfig();
  const ts = Date.now();

  const app = await client.send(
    new CreateApplicationCommand({ Name: `e2e-optlock-app-${ts}` }),
  );
  const applicationId = app.Id ?? "";

  const profile = await client.send(
    new CreateConfigurationProfileCommand({
      ApplicationId: applicationId,
      Name: `e2e-optlock-cp-${ts}`,
      LocationUri: "hosted",
    }),
  );
  const configurationProfileId = profile.Id ?? "";

  await client.send(
    new CreateHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      Content: Buffer.from("v1"),
      ContentType: "text/plain",
    }),
  );

  await expect(
    client.send(
      new CreateHostedConfigurationVersionCommand({
        ApplicationId: applicationId,
        ConfigurationProfileId: configurationProfileId,
        Content: Buffer.from("v2"),
        ContentType: "text/plain",
        LatestVersionNumber: 99,
      }),
    ),
  ).rejects.toThrow();

  const v2 = await client.send(
    new CreateHostedConfigurationVersionCommand({
      ApplicationId: applicationId,
      ConfigurationProfileId: configurationProfileId,
      Content: Buffer.from("v2-correct"),
      ContentType: "text/plain",
      LatestVersionNumber: 1,
    }),
  );
  expect(v2.VersionNumber).toBe(2);

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
});
