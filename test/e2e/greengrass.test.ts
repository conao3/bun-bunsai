import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  AssociateRoleToGroupCommand,
  CreateCoreDefinitionCommand,
  CreateCoreDefinitionVersionCommand,
  CreateDeploymentCommand,
  CreateGroupCommand,
  CreateGroupVersionCommand,
  CreateSubscriptionDefinitionCommand,
  CreateSubscriptionDefinitionVersionCommand,
  DeleteCoreDefinitionCommand,
  DeleteGroupCommand,
  GetAssociatedRoleCommand,
  GetCoreDefinitionCommand,
  GetCoreDefinitionVersionCommand,
  GetDeploymentStatusCommand,
  GetGroupCommand,
  GetGroupVersionCommand,
  GreengrassClient,
  ListCoreDefinitionVersionsCommand,
  ListCoreDefinitionsCommand,
  ListDeploymentsCommand,
  ListGroupVersionsCommand,
  ListGroupsCommand,
  ListSubscriptionDefinitionsCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateCoreDefinitionCommand,
} from "@aws-sdk/client-greengrass";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const greengrass = () =>
  new GreengrassClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Greengrass group roundtrip", async () => {
  const client = greengrass();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(new CreateGroupCommand({ Name: name }));
  const groupId = created.Id;
  expect(groupId).toBeDefined();
  expect(created.Name).toBe(name);
  expect(created.Arn).toContain(`groups/${groupId}`);

  const got = await client.send(new GetGroupCommand({ GroupId: groupId }));
  expect(got.Id).toBe(groupId);
  expect(got.Name).toBe(name);

  const listed = await client.send(new ListGroupsCommand({}));
  expect((listed.Groups ?? []).map((g) => g.Id)).toContain(groupId);

  await client.send(new DeleteGroupCommand({ GroupId: groupId }));

  await expect(
    client.send(new GetGroupCommand({ GroupId: groupId })),
  ).rejects.toThrow();
});

test("Greengrass core definition lifecycle", async () => {
  const client = greengrass();

  const def = await client.send(
    new CreateCoreDefinitionCommand({ Name: "test-core-def" }),
  );
  const defId = def.Id!;
  expect(defId).toBeDefined();
  expect(def.Name).toBe("test-core-def");

  const ver = await client.send(
    new CreateCoreDefinitionVersionCommand({
      CoreDefinitionId: defId,
      Cores: [
        {
          CertificateArn: "arn:aws:iot:us-east-1:123456789012:cert/abc",
          Id: "core-1",
          ThingArn: "arn:aws:iot:us-east-1:123456789012:thing/MyCore",
        },
      ],
    }),
  );
  expect(ver.Version).toBeDefined();
  const verId = ver.Version!;

  const gotDef = await client.send(
    new GetCoreDefinitionCommand({ CoreDefinitionId: defId }),
  );
  expect(gotDef.Id).toBe(defId);
  expect(gotDef.LatestVersion).toBe(verId);

  const gotVer = await client.send(
    new GetCoreDefinitionVersionCommand({
      CoreDefinitionId: defId,
      CoreDefinitionVersionId: verId,
    }),
  );
  expect(gotVer.Version).toBe(verId);

  const listedDefs = await client.send(new ListCoreDefinitionsCommand({}));
  expect((listedDefs.Definitions ?? []).map((d) => d.Id)).toContain(defId);

  const listedVers = await client.send(
    new ListCoreDefinitionVersionsCommand({ CoreDefinitionId: defId }),
  );
  expect((listedVers.Versions ?? []).map((v) => v.Version)).toContain(verId);

  await client.send(
    new UpdateCoreDefinitionCommand({
      CoreDefinitionId: defId,
      Name: "updated-core-def",
    }),
  );
  const updated = await client.send(
    new GetCoreDefinitionCommand({ CoreDefinitionId: defId }),
  );
  expect(updated.Name).toBe("updated-core-def");

  await client.send(
    new DeleteCoreDefinitionCommand({ CoreDefinitionId: defId }),
  );
  await expect(
    client.send(new GetCoreDefinitionCommand({ CoreDefinitionId: defId })),
  ).rejects.toThrow();
});

test("Greengrass subscription definition", async () => {
  const client = greengrass();

  const def = await client.send(
    new CreateSubscriptionDefinitionCommand({ Name: "test-sub-def" }),
  );
  const defId = def.Id!;
  expect(defId).toBeDefined();

  await client.send(
    new CreateSubscriptionDefinitionVersionCommand({
      SubscriptionDefinitionId: defId,
      Subscriptions: [
        {
          Id: "sub-1",
          Source: "arn:aws:iot:us-east-1:123456789012:thing/Source",
          Subject: "hello/world",
          Target: "arn:aws:iot:us-east-1:123456789012:thing/Target",
        },
      ],
    }),
  );

  const listed = await client.send(new ListSubscriptionDefinitionsCommand({}));
  expect((listed.Definitions ?? []).map((d) => d.Id)).toContain(defId);
});

test("Greengrass group version + deployment + role association", async () => {
  const client = greengrass();

  const group = await client.send(
    new CreateGroupCommand({ Name: `e2e-group-${Date.now()}` }),
  );
  const groupId = group.Id!;

  const groupVer = await client.send(
    new CreateGroupVersionCommand({ GroupId: groupId }),
  );
  expect(groupVer.Version).toBeDefined();
  const groupVerId = groupVer.Version!;

  const gotVer = await client.send(
    new GetGroupVersionCommand({
      GroupId: groupId,
      GroupVersionId: groupVerId,
    }),
  );
  expect(gotVer.Version).toBe(groupVerId);

  const listedVers = await client.send(
    new ListGroupVersionsCommand({ GroupId: groupId }),
  );
  expect((listedVers.Versions ?? []).map((v) => v.Version)).toContain(
    groupVerId,
  );

  const deploy = await client.send(
    new CreateDeploymentCommand({
      GroupId: groupId,
      GroupVersionId: groupVerId,
      DeploymentType: "NewDeployment",
    }),
  );
  const deployId = deploy.DeploymentId!;
  expect(deployId).toBeDefined();

  const deployStatus = await client.send(
    new GetDeploymentStatusCommand({
      GroupId: groupId,
      DeploymentId: deployId,
    }),
  );
  expect(deployStatus.DeploymentStatus).toBe("InProgress");

  const listedDeploys = await client.send(
    new ListDeploymentsCommand({ GroupId: groupId }),
  );
  expect(
    (listedDeploys.Deployments ?? []).map((d) => d.DeploymentId),
  ).toContain(deployId);

  const roleArn = "arn:aws:iam::123456789012:role/GreengrassRole";
  await client.send(
    new AssociateRoleToGroupCommand({ GroupId: groupId, RoleArn: roleArn }),
  );
  const assocRole = await client.send(
    new GetAssociatedRoleCommand({ GroupId: groupId }),
  );
  expect(assocRole.RoleArn).toBe(roleArn);
});

test("Greengrass tags lifecycle", async () => {
  const client = greengrass();

  const group = await client.send(
    new CreateGroupCommand({ Name: `e2e-tags-${Date.now()}` }),
  );
  const groupArn = group.Arn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: groupArn,
      tags: { env: "test", owner: "bunsai" },
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: groupArn }),
  );
  expect(tags.tags?.env).toBe("test");
  expect(tags.tags?.owner).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceArn: groupArn, TagKeys: ["owner"] }),
  );

  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: groupArn }),
  );
  expect(tagsAfter.tags?.env).toBe("test");
  expect(tagsAfter.tags?.owner).toBeUndefined();
});
