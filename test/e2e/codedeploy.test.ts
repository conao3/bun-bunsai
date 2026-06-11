import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetApplicationsCommand,
  BatchGetDeploymentGroupsCommand,
  BatchGetDeploymentsCommand,
  CodeDeployClient,
  CreateApplicationCommand,
  CreateDeploymentCommand,
  CreateDeploymentConfigCommand,
  CreateDeploymentGroupCommand,
  DeleteApplicationCommand,
  DeleteDeploymentConfigCommand,
  DeleteDeploymentGroupCommand,
  GetApplicationCommand,
  GetDeploymentCommand,
  GetDeploymentConfigCommand,
  GetDeploymentGroupCommand,
  ListApplicationsCommand,
  ListDeploymentConfigsCommand,
  ListDeploymentGroupsCommand,
  ListDeploymentsCommand,
  ListTagsForResourceCommand,
  StopDeploymentCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApplicationCommand,
  UpdateDeploymentGroupCommand,
} from "@aws-sdk/client-codedeploy";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const codedeploy = () =>
  new CodeDeployClient({ endpoint, region, credentials, requestHandler });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("CodeDeploy application lifecycle", async () => {
  const client = codedeploy();
  const appName = "bunsai-e2e-app";

  const created = await client.send(
    new CreateApplicationCommand({
      applicationName: appName,
      computePlatform: "Server",
    }),
  );
  expect(created.applicationId).toBeDefined();

  const got = await client.send(
    new GetApplicationCommand({ applicationName: appName }),
  );
  expect(got.application?.applicationName).toBe(appName);
  expect(got.application?.computePlatform).toBe("Server");

  const listed = await client.send(new ListApplicationsCommand({}));
  expect(listed.applications).toContain(appName);

  await client.send(
    new TagResourceCommand({
      ResourceArn: `arn:aws:codedeploy:${region}:000000000000:application:${appName}`,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const tags = await client.send(
    new ListTagsForResourceCommand({
      ResourceArn: `arn:aws:codedeploy:${region}:000000000000:application:${appName}`,
    }),
  );
  expect(tags.Tags).toEqual(
    expect.arrayContaining([{ Key: "env", Value: "test" }]),
  );

  await client.send(
    new UntagResourceCommand({
      ResourceArn: `arn:aws:codedeploy:${region}:000000000000:application:${appName}`,
      TagKeys: ["env"],
    }),
  );
  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({
      ResourceArn: `arn:aws:codedeploy:${region}:000000000000:application:${appName}`,
    }),
  );
  expect(tagsAfter.Tags?.find((t) => t.Key === "env")).toBeUndefined();

  await client.send(
    new UpdateApplicationCommand({
      applicationName: appName,
      newApplicationName: `${appName}-renamed`,
    }),
  );
  const gotRenamed = await client.send(
    new GetApplicationCommand({ applicationName: `${appName}-renamed` }),
  );
  expect(gotRenamed.application?.applicationName).toBe(`${appName}-renamed`);

  await client.send(
    new DeleteApplicationCommand({ applicationName: `${appName}-renamed` }),
  );
  const listedAfterDelete = await client.send(new ListApplicationsCommand({}));
  expect(listedAfterDelete.applications).not.toContain(`${appName}-renamed`);
});

test("CodeDeploy deployment group lifecycle", async () => {
  const client = codedeploy();
  const appName = "bunsai-e2e-app-dg";
  const groupName = "bunsai-e2e-group";
  const roleArn = "arn:aws:iam::000000000000:role/CodeDeployRole";

  await client.send(new CreateApplicationCommand({ applicationName: appName }));

  const created = await client.send(
    new CreateDeploymentGroupCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
      serviceRoleArn: roleArn,
      deploymentConfigName: "CodeDeployDefault.AllAtOnce",
    }),
  );
  expect(created.deploymentGroupId).toBeDefined();

  const got = await client.send(
    new GetDeploymentGroupCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
    }),
  );
  expect(got.deploymentGroupInfo?.deploymentGroupName).toBe(groupName);
  expect(got.deploymentGroupInfo?.serviceRoleArn).toBe(roleArn);

  const listed = await client.send(
    new ListDeploymentGroupsCommand({ applicationName: appName }),
  );
  expect(listed.deploymentGroups).toContain(groupName);

  await client.send(
    new UpdateDeploymentGroupCommand({
      applicationName: appName,
      currentDeploymentGroupName: groupName,
      deploymentConfigName: "CodeDeployDefault.HalfAtATime",
    }),
  );
  const gotUpdated = await client.send(
    new GetDeploymentGroupCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
    }),
  );
  expect(gotUpdated.deploymentGroupInfo?.deploymentConfigName).toBe(
    "CodeDeployDefault.HalfAtATime",
  );

  const batch = await client.send(
    new BatchGetDeploymentGroupsCommand({
      applicationName: appName,
      deploymentGroupNames: [groupName],
    }),
  );
  expect(batch.deploymentGroupsInfo).toHaveLength(1);
  expect(batch.deploymentGroupsInfo?.[0]?.deploymentGroupName).toBe(groupName);

  await client.send(
    new DeleteDeploymentGroupCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
    }),
  );
  const listedAfterDelete = await client.send(
    new ListDeploymentGroupsCommand({ applicationName: appName }),
  );
  expect(listedAfterDelete.deploymentGroups).not.toContain(groupName);

  await client.send(new DeleteApplicationCommand({ applicationName: appName }));
});

test("CodeDeploy deployment lifecycle and stop guard", async () => {
  const client = codedeploy();
  const appName = "bunsai-e2e-app-dep";
  const groupName = "bunsai-e2e-group-dep";
  const roleArn = "arn:aws:iam::000000000000:role/CodeDeployRole";

  await client.send(new CreateApplicationCommand({ applicationName: appName }));
  await client.send(
    new CreateDeploymentGroupCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
      serviceRoleArn: roleArn,
    }),
  );

  const dep = await client.send(
    new CreateDeploymentCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
      description: "e2e test deployment",
    }),
  );
  expect(dep.deploymentId).toMatch(/^d-/);
  const deploymentId = dep.deploymentId!;

  const gotCreated = await client.send(
    new GetDeploymentCommand({ deploymentId }),
  );
  expect(gotCreated.deploymentInfo?.status).toBe("Created");

  await sleep(1500);
  const gotInProgress = await client.send(
    new GetDeploymentCommand({ deploymentId }),
  );
  expect(gotInProgress.deploymentInfo?.status).toBe("InProgress");

  const stopResult = await client.send(
    new StopDeploymentCommand({ deploymentId }),
  );
  expect(stopResult.status).toBe("Succeeded");

  const gotStopped = await client.send(
    new GetDeploymentCommand({ deploymentId }),
  );
  expect(gotStopped.deploymentInfo?.status).toBe("Stopped");

  await expect(
    client.send(new StopDeploymentCommand({ deploymentId })),
  ).rejects.toThrow();

  const dep2 = await client.send(
    new CreateDeploymentCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
    }),
  );
  const deploymentId2 = dep2.deploymentId!;

  await sleep(6000);
  const gotSucceeded = await client.send(
    new GetDeploymentCommand({ deploymentId: deploymentId2 }),
  );
  expect(gotSucceeded.deploymentInfo?.status).toBe("Succeeded");

  await expect(
    client.send(new StopDeploymentCommand({ deploymentId: deploymentId2 })),
  ).rejects.toThrow();

  const listed = await client.send(
    new ListDeploymentsCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
    }),
  );
  expect(listed.deployments).toContain(deploymentId);
  expect(listed.deployments).toContain(deploymentId2);

  const batch = await client.send(
    new BatchGetDeploymentsCommand({
      deploymentIds: [deploymentId, deploymentId2],
    }),
  );
  expect(batch.deploymentsInfo).toHaveLength(2);

  await client.send(
    new DeleteDeploymentGroupCommand({
      applicationName: appName,
      deploymentGroupName: groupName,
    }),
  );
  await client.send(new DeleteApplicationCommand({ applicationName: appName }));
}, 30000);

test("CodeDeploy deployment config", async () => {
  const client = codedeploy();
  const configName = "bunsai-e2e-config";

  const listed = await client.send(new ListDeploymentConfigsCommand({}));
  expect(listed.deploymentConfigsList).toContain("CodeDeployDefault.AllAtOnce");
  expect(listed.deploymentConfigsList).toContain(
    "CodeDeployDefault.OneAtATime",
  );
  expect(listed.deploymentConfigsList).toContain(
    "CodeDeployDefault.HalfAtATime",
  );

  const got = await client.send(
    new GetDeploymentConfigCommand({
      deploymentConfigName: "CodeDeployDefault.AllAtOnce",
    }),
  );
  expect(got.deploymentConfigInfo?.deploymentConfigName).toBe(
    "CodeDeployDefault.AllAtOnce",
  );

  const created = await client.send(
    new CreateDeploymentConfigCommand({
      deploymentConfigName: configName,
      minimumHealthyHosts: { type: "HOST_COUNT", value: 1 },
      computePlatform: "Server",
    }),
  );
  expect(created.deploymentConfigId).toBeDefined();

  const gotCustom = await client.send(
    new GetDeploymentConfigCommand({ deploymentConfigName: configName }),
  );
  expect(gotCustom.deploymentConfigInfo?.deploymentConfigName).toBe(configName);

  await client.send(
    new DeleteDeploymentConfigCommand({ deploymentConfigName: configName }),
  );

  const listedAfter = await client.send(new ListDeploymentConfigsCommand({}));
  expect(listedAfter.deploymentConfigsList).not.toContain(configName);
});

test("CodeDeploy batch get applications", async () => {
  const client = codedeploy();
  const apps = ["bunsai-e2e-batch-1", "bunsai-e2e-batch-2"];

  for (const name of apps) {
    await client.send(new CreateApplicationCommand({ applicationName: name }));
  }

  const batch = await client.send(
    new BatchGetApplicationsCommand({ applicationNames: apps }),
  );
  expect(batch.applicationsInfo).toHaveLength(2);
  const names = batch.applicationsInfo!.map((a) => a.applicationName);
  expect(names).toContain("bunsai-e2e-batch-1");
  expect(names).toContain("bunsai-e2e-batch-2");

  for (const name of apps) {
    await client.send(new DeleteApplicationCommand({ applicationName: name }));
  }
});
