import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AssociateAccessPolicyCommand,
  AssociateEncryptionConfigCommand,
  AssociateIdentityProviderConfigCommand,
  CreateAccessEntryCommand,
  CreateClusterCommand,
  CreateNodegroupCommand,
  CreatePodIdentityAssociationCommand,
  DeleteAccessEntryCommand,
  DeleteNodegroupCommand,
  DeletePodIdentityAssociationCommand,
  DeregisterClusterCommand,
  DescribeAccessEntryCommand,
  DescribeAddonConfigurationCommand,
  DescribeAddonVersionsCommand,
  DescribeClusterVersionsCommand,
  DescribeIdentityProviderConfigCommand,
  DescribeInsightCommand,
  DescribeInsightsRefreshCommand,
  DescribePodIdentityAssociationCommand,
  DescribeUpdateCommand,
  DisassociateAccessPolicyCommand,
  DisassociateIdentityProviderConfigCommand,
  EKSClient,
  ListAccessEntriesCommand,
  ListAccessPoliciesCommand,
  ListAssociatedAccessPoliciesCommand,
  ListIdentityProviderConfigsCommand,
  ListInsightsCommand,
  ListPodIdentityAssociationsCommand,
  ListTagsForResourceCommand,
  ListUpdatesCommand,
  RegisterClusterCommand,
  StartInsightsRefreshCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAccessEntryCommand,
  UpdateAddonCommand,
  UpdateClusterConfigCommand,
  UpdateClusterVersionCommand,
  UpdateNodegroupConfigCommand,
  UpdateNodegroupVersionCommand,
  UpdatePodIdentityAssociationCommand,
  CreateAddonCommand,
  DeleteAddonCommand,
} from "@aws-sdk/client-eks";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eks = () => new EKSClient({ endpoint, region, credentials });

const createCluster = async (client: EKSClient, name: string) => {
  return client.send(
    new CreateClusterCommand({
      name,
      roleArn: "arn:aws:iam::000000000000:role/eks-role",
      resourcesVpcConfig: { subnetIds: ["subnet-aaaa"] },
    }),
  );
};

test("EKS access entry roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-ae-${Date.now()}`;
  await createCluster(client, clusterName);

  const principalArn = "arn:aws:iam::000000000000:role/test-role";

  const created = await client.send(
    new CreateAccessEntryCommand({
      clusterName,
      principalArn,
      kubernetesGroups: ["system:masters"],
      type: "STANDARD",
    }),
  );
  expect(created.accessEntry?.principalArn).toBe(principalArn);
  expect(created.accessEntry?.clusterName).toBe(clusterName);
  expect(created.accessEntry?.type).toBe("STANDARD");
  expect(created.accessEntry?.kubernetesGroups).toContain("system:masters");

  const described = await client.send(
    new DescribeAccessEntryCommand({ clusterName, principalArn }),
  );
  expect(described.accessEntry?.principalArn).toBe(principalArn);

  const listed = await client.send(
    new ListAccessEntriesCommand({ clusterName }),
  );
  expect(listed.accessEntries ?? []).toContain(principalArn);

  const updated = await client.send(
    new UpdateAccessEntryCommand({
      clusterName,
      principalArn,
      kubernetesGroups: ["system:masters", "developers"],
    }),
  );
  expect(updated.accessEntry?.kubernetesGroups).toContain("developers");

  await client.send(
    new DeleteAccessEntryCommand({ clusterName, principalArn }),
  );

  await expect(
    client.send(new DescribeAccessEntryCommand({ clusterName, principalArn })),
  ).rejects.toThrow();
});

test("EKS access policy association roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-ap-${Date.now()}`;
  await createCluster(client, clusterName);

  const principalArn = "arn:aws:iam::000000000000:role/test-role-ap";
  await client.send(
    new CreateAccessEntryCommand({ clusterName, principalArn }),
  );

  const policyArn =
    "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy";

  const associated = await client.send(
    new AssociateAccessPolicyCommand({
      clusterName,
      principalArn,
      policyArn,
      accessScope: { type: "cluster" },
    }),
  );
  expect(associated.associatedAccessPolicy?.policyArn).toBe(policyArn);
  expect(associated.clusterName).toBe(clusterName);
  expect(associated.principalArn).toBe(principalArn);

  const listed = await client.send(
    new ListAssociatedAccessPoliciesCommand({ clusterName, principalArn }),
  );
  expect(
    listed.associatedAccessPolicies?.some((p) => p.policyArn === policyArn),
  ).toBe(true);

  await client.send(
    new DisassociateAccessPolicyCommand({
      clusterName,
      principalArn,
      policyArn,
    }),
  );

  const listedAfter = await client.send(
    new ListAssociatedAccessPoliciesCommand({ clusterName, principalArn }),
  );
  expect(
    listedAfter.associatedAccessPolicies?.some(
      (p) => p.policyArn === policyArn,
    ),
  ).toBe(false);
});

test("EKS list access policies", async () => {
  const client = eks();
  const result = await client.send(new ListAccessPoliciesCommand({}));
  expect(result.accessPolicies?.length ?? 0).toBeGreaterThan(0);
  expect(
    result.accessPolicies?.some((p) =>
      p.arn?.includes("AmazonEKSClusterAdminPolicy"),
    ),
  ).toBe(true);
});

test("EKS pod identity association roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-pi-${Date.now()}`;
  await createCluster(client, clusterName);

  const created = await client.send(
    new CreatePodIdentityAssociationCommand({
      clusterName,
      namespace: "default",
      serviceAccount: "my-sa",
      roleArn: "arn:aws:iam::000000000000:role/pod-role",
    }),
  );
  expect(created.association?.namespace).toBe("default");
  expect(created.association?.serviceAccount).toBe("my-sa");
  expect(created.association?.roleArn).toBe(
    "arn:aws:iam::000000000000:role/pod-role",
  );
  const associationId = created.association?.associationId ?? "";
  expect(associationId).toBeTruthy();

  const described = await client.send(
    new DescribePodIdentityAssociationCommand({ clusterName, associationId }),
  );
  expect(described.association?.associationId).toBe(associationId);

  const listed = await client.send(
    new ListPodIdentityAssociationsCommand({ clusterName }),
  );
  expect(
    listed.associations?.some((a) => a.associationId === associationId),
  ).toBe(true);

  const updated = await client.send(
    new UpdatePodIdentityAssociationCommand({
      clusterName,
      associationId,
      roleArn: "arn:aws:iam::000000000000:role/pod-role-updated",
    }),
  );
  expect(updated.association?.roleArn).toBe(
    "arn:aws:iam::000000000000:role/pod-role-updated",
  );

  const deleted = await client.send(
    new DeletePodIdentityAssociationCommand({ clusterName, associationId }),
  );
  expect(deleted.association?.associationId).toBe(associationId);

  await expect(
    client.send(
      new DescribePodIdentityAssociationCommand({ clusterName, associationId }),
    ),
  ).rejects.toThrow();
});

test("EKS identity provider config roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-idp-${Date.now()}`;
  await createCluster(client, clusterName);

  const associated = await client.send(
    new AssociateIdentityProviderConfigCommand({
      clusterName,
      oidc: {
        identityProviderConfigName: "my-oidc",
        issuerUrl: "https://example.com",
        clientId: "my-client-id",
      },
    }),
  );
  expect(associated.update?.type).toBe("AssociateIdentityProviderConfig");

  const listed = await client.send(
    new ListIdentityProviderConfigsCommand({ clusterName }),
  );
  expect(
    listed.identityProviderConfigs?.some((c) => c.name === "my-oidc"),
  ).toBe(true);

  const described = await client.send(
    new DescribeIdentityProviderConfigCommand({
      clusterName,
      identityProviderConfig: { type: "oidc", name: "my-oidc" },
    }),
  );
  expect(
    described.identityProviderConfig?.oidc?.identityProviderConfigName,
  ).toBe("my-oidc");

  const disassociated = await client.send(
    new DisassociateIdentityProviderConfigCommand({
      clusterName,
      identityProviderConfig: { type: "oidc", name: "my-oidc" },
    }),
  );
  expect(disassociated.update?.type).toBe("DisassociateIdentityProviderConfig");

  const listedAfter = await client.send(
    new ListIdentityProviderConfigsCommand({ clusterName }),
  );
  expect(
    listedAfter.identityProviderConfigs?.some((c) => c.name === "my-oidc"),
  ).toBe(false);
});

test("EKS update operations with update tracking", async () => {
  const client = eks();
  const clusterName = `bunsai-upd-${Date.now()}`;
  await createCluster(client, clusterName);

  const versionUpdate = await client.send(
    new UpdateClusterVersionCommand({
      name: clusterName,
      version: "1.30",
    }),
  );
  expect(versionUpdate.update?.type).toBe("VersionUpdate");
  const versionUpdateId = versionUpdate.update?.id ?? "";

  const configUpdate = await client.send(
    new UpdateClusterConfigCommand({ name: clusterName }),
  );
  expect(configUpdate.update?.type).toBe("ConfigUpdate");

  const encryptionUpdate = await client.send(
    new AssociateEncryptionConfigCommand({
      clusterName,
      encryptionConfig: [
        {
          resources: ["secrets"],
          provider: { keyArn: "arn:aws:kms:us-east-1:000000000000:key/test" },
        },
      ],
    }),
  );
  expect(encryptionUpdate.update?.type).toBe("AssociateEncryptionConfig");

  const described = await client.send(
    new DescribeUpdateCommand({ name: clusterName, updateId: versionUpdateId }),
  );
  expect(described.update?.id).toBe(versionUpdateId);
  expect(described.update?.status).toBe("Successful");

  const listedUpdates = await client.send(
    new ListUpdatesCommand({ name: clusterName }),
  );
  expect(listedUpdates.updateIds ?? []).toContain(versionUpdateId);
});

test("EKS nodegroup update operations", async () => {
  const client = eks();
  const clusterName = `bunsai-ngupd-${Date.now()}`;
  const nodegroupName = `ng-${Date.now()}`;
  await createCluster(client, clusterName);

  await client.send(
    new CreateNodegroupCommand({
      clusterName,
      nodegroupName,
      nodeRole: "arn:aws:iam::000000000000:role/eks-node-role",
      subnets: ["subnet-aaaa"],
    }),
  );

  const configResult = await client.send(
    new UpdateNodegroupConfigCommand({
      clusterName,
      nodegroupName,
      scalingConfig: { minSize: 1, maxSize: 5, desiredSize: 3 },
    }),
  );
  expect(configResult.update?.type).toBe("ConfigUpdate");

  const versionResult = await client.send(
    new UpdateNodegroupVersionCommand({
      clusterName,
      nodegroupName,
      version: "1.30",
    }),
  );
  expect(versionResult.update?.type).toBe("VersionUpdate");

  const listedUpdates = await client.send(
    new ListUpdatesCommand({ name: clusterName, nodegroupName }),
  );
  expect(listedUpdates.updateIds?.length ?? 0).toBeGreaterThanOrEqual(2);

  await client.send(new DeleteNodegroupCommand({ clusterName, nodegroupName }));
});

test("EKS addon update operation", async () => {
  const client = eks();
  const clusterName = `bunsai-addup-${Date.now()}`;
  const addonName = "coredns";
  await createCluster(client, clusterName);

  await client.send(
    new CreateAddonCommand({
      clusterName,
      addonName,
      addonVersion: "v1.11.1-eksbuild.1",
    }),
  );

  const result = await client.send(
    new UpdateAddonCommand({
      clusterName,
      addonName,
      addonVersion: "v1.11.3-eksbuild.1",
    }),
  );
  expect(result.update?.type).toBe("AddonUpdate");

  const listedUpdates = await client.send(
    new ListUpdatesCommand({ name: clusterName, addonName }),
  );
  expect(listedUpdates.updateIds?.length ?? 0).toBeGreaterThanOrEqual(1);

  await client.send(new DeleteAddonCommand({ clusterName, addonName }));
});

test("EKS register and deregister cluster", async () => {
  const client = eks();
  const clusterName = `bunsai-reg-${Date.now()}`;

  const registered = await client.send(
    new RegisterClusterCommand({
      name: clusterName,
      connectorConfig: {
        roleArn: "arn:aws:iam::000000000000:role/eks-connector-role",
        provider: "OTHER",
      },
    }),
  );
  expect(registered.cluster?.name).toBe(clusterName);
  expect(registered.cluster?.status).toBe("PENDING");
  expect(registered.cluster?.connectorConfig?.provider).toBe("OTHER");

  const deregistered = await client.send(
    new DeregisterClusterCommand({ name: clusterName }),
  );
  expect(deregistered.cluster?.status).toBe("DELETING");
});

test("EKS describe addon versions and configuration", async () => {
  const client = eks();

  const versions = await client.send(new DescribeAddonVersionsCommand({}));
  expect(versions.addons?.length ?? 0).toBeGreaterThan(0);
  expect(versions.addons?.some((a) => a.addonName === "vpc-cni")).toBe(true);

  const config = await client.send(
    new DescribeAddonConfigurationCommand({
      addonName: "vpc-cni",
      addonVersion: "v1.18.1-eksbuild.1",
    }),
  );
  expect(config.addonName).toBe("vpc-cni");
  expect(config.addonVersion).toBe("v1.18.1-eksbuild.1");
  expect(config.configurationSchema).toBeDefined();
});

test("EKS describe cluster versions", async () => {
  const client = eks();
  const result = await client.send(new DescribeClusterVersionsCommand({}));
  expect(result.clusterVersions?.length ?? 0).toBeGreaterThan(0);
  expect(result.clusterVersions?.some((v) => v.clusterVersion === "1.31")).toBe(
    true,
  );
});

test("EKS insights operations", async () => {
  const client = eks();
  const clusterName = `bunsai-ins-${Date.now()}`;
  await createCluster(client, clusterName);

  const refresh = await client.send(
    new StartInsightsRefreshCommand({ clusterName }),
  );
  expect(refresh.status).toBe("IN_PROGRESS");

  const describeRefresh = await client.send(
    new DescribeInsightsRefreshCommand({ clusterName }),
  );
  expect(describeRefresh.status).toBe("COMPLETED");

  const listed = await client.send(new ListInsightsCommand({ clusterName }));
  expect(listed.insights?.length ?? 0).toBeGreaterThan(0);

  const insightId = listed.insights?.[0]?.id ?? "";
  expect(insightId).toBeTruthy();

  const described = await client.send(
    new DescribeInsightCommand({ clusterName, id: insightId }),
  );
  expect(described.insight?.id).toBe(insightId);
});

test("EKS tag and untag resource", async () => {
  const client = eks();
  const clusterName = `bunsai-tag-${Date.now()}`;
  const created = await createCluster(client, clusterName);
  const resourceArn = created.cluster?.arn ?? "";
  expect(resourceArn).toBeTruthy();

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "platform" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.team).toBe("platform");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["team"] }),
  );

  const listedAfter = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listedAfter.tags?.env).toBe("test");
  expect(listedAfter.tags?.team).toBeUndefined();
});
