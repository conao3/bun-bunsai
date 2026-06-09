import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAddonCommand,
  CreateClusterCommand,
  CreateFargateProfileCommand,
  CreateNodegroupCommand,
  DeleteAddonCommand,
  DeleteFargateProfileCommand,
  DescribeAddonCommand,
  DescribeClusterCommand,
  DescribeFargateProfileCommand,
  DescribeInsightsRefreshCommand,
  DescribeNodegroupCommand,
  EKSClient,
  ListAccessEntriesCommand,
  ListAddonsCommand,
  ListClustersCommand,
  ListFargateProfilesCommand,
  ListInsightsCommand,
  ListNodegroupsCommand,
  StartInsightsRefreshCommand,
  UpdateClusterVersionCommand,
  UpdateNodegroupVersionCommand,
  CreateAccessEntryCommand,
  DescribeInsightCommand,
} from "@aws-sdk/client-eks";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eks = () =>
  new EKSClient({ endpoint, region, credentials, requestHandler });

const makeCluster = (client: EKSClient, name: string) =>
  client.send(
    new CreateClusterCommand({
      name,
      roleArn: "arn:aws:iam::000000000000:role/eks-role",
      resourcesVpcConfig: { subnetIds: ["subnet-aaaa"] },
    }),
  );

test("EKS cluster CREATING→ACTIVE lifecycle", async () => {
  const client = eks();
  const clusterName = `bunsai-lc-${Date.now()}`;

  const created = await makeCluster(client, clusterName);
  expect(created.cluster?.status).toBe("CREATING");

  const described = await client.send(
    new DescribeClusterCommand({ name: clusterName }),
  );
  expect(described.cluster?.status).toBe("ACTIVE");

  const described2 = await client.send(
    new DescribeClusterCommand({ name: clusterName }),
  );
  expect(described2.cluster?.status).toBe("ACTIVE");
});

test("EKS nodegroup CREATING→ACTIVE lifecycle", async () => {
  const client = eks();
  const clusterName = `bunsai-ng-lc-${Date.now()}`;
  await makeCluster(client, clusterName);

  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const ngName = `ng-lc-${Date.now()}`;
  const created = await client.send(
    new CreateNodegroupCommand({
      clusterName,
      nodegroupName: ngName,
      nodeRole: "arn:aws:iam::000000000000:role/eks-node-role",
      subnets: ["subnet-aaaa"],
    }),
  );
  expect(created.nodegroup?.status).toBe("CREATING");

  const described = await client.send(
    new DescribeNodegroupCommand({ clusterName, nodegroupName: ngName }),
  );
  expect(described.nodegroup?.status).toBe("ACTIVE");
});

test("EKS cluster update→UPDATING transition", async () => {
  const client = eks();
  const clusterName = `bunsai-upd-${Date.now()}`;
  await makeCluster(client, clusterName);

  await client.send(new DescribeClusterCommand({ name: clusterName }));

  await client.send(
    new UpdateClusterVersionCommand({ name: clusterName, version: "1.32" }),
  );

  const updating = await client.send(
    new DescribeClusterCommand({ name: clusterName }),
  );
  expect(updating.cluster?.status).toBe("UPDATING");

  const active = await client.send(
    new DescribeClusterCommand({ name: clusterName }),
  );
  expect(active.cluster?.status).toBe("ACTIVE");
  expect(active.cluster?.version).toBe("1.32");
});

test("EKS nodegroup update→UPDATING transition", async () => {
  const client = eks();
  const clusterName = `bunsai-ng-upd-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const ngName = `ng-upd-${Date.now()}`;
  await client.send(
    new CreateNodegroupCommand({
      clusterName,
      nodegroupName: ngName,
      nodeRole: "arn:aws:iam::000000000000:role/eks-node-role",
      subnets: ["subnet-aaaa"],
    }),
  );
  await client.send(
    new DescribeNodegroupCommand({ clusterName, nodegroupName: ngName }),
  );

  await client.send(
    new UpdateNodegroupVersionCommand({
      clusterName,
      nodegroupName: ngName,
      version: "1.32",
    }),
  );

  const updating = await client.send(
    new DescribeNodegroupCommand({ clusterName, nodegroupName: ngName }),
  );
  expect(updating.nodegroup?.status).toBe("UPDATING");

  const active = await client.send(
    new DescribeNodegroupCommand({ clusterName, nodegroupName: ngName }),
  );
  expect(active.nodegroup?.status).toBe("ACTIVE");
});

test("EKS ListClusters pagination", async () => {
  const client = eks();
  const prefix = `bunsai-pg-${Date.now()}`;
  const names = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];
  for (const name of names) {
    await makeCluster(client, name);
    await client.send(new DescribeClusterCommand({ name }));
  }

  const page1 = await client.send(new ListClustersCommand({ maxResults: 2 }));
  expect(page1.clusters?.length).toBeGreaterThanOrEqual(1);

  const page1Names = page1.clusters ?? [];
  const testNames = page1Names.filter((n) => n.startsWith(prefix));
  if (page1.nextToken !== undefined && testNames.length < names.length) {
    const page2 = await client.send(
      new ListClustersCommand({ nextToken: page1.nextToken }),
    );
    const combined = [...(page1.clusters ?? []), ...(page2.clusters ?? [])];
    for (const name of names) {
      expect(combined).toContain(name);
    }
  } else {
    for (const name of names) {
      const allPages = await client.send(new ListClustersCommand({}));
      expect(allPages.clusters ?? []).toContain(name);
    }
  }
});

test("EKS ListNodegroups pagination", async () => {
  const client = eks();
  const clusterName = `bunsai-ng-pg-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const prefix = `ng-pg-${Date.now()}`;
  for (const suffix of ["a", "b", "c"]) {
    const ngName = `${prefix}-${suffix}`;
    await client.send(
      new CreateNodegroupCommand({
        clusterName,
        nodegroupName: ngName,
        nodeRole: "arn:aws:iam::000000000000:role/eks-node-role",
        subnets: ["subnet-aaaa"],
      }),
    );
  }

  const page1 = await client.send(
    new ListNodegroupsCommand({ clusterName, maxResults: 2 }),
  );
  expect((page1.nodegroups ?? []).length).toBeLessThanOrEqual(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListNodegroupsCommand({ clusterName, nextToken: page1.nextToken }),
  );
  const allNgs = [...(page1.nodegroups ?? []), ...(page2.nodegroups ?? [])];
  for (const suffix of ["a", "b", "c"]) {
    expect(allNgs).toContain(`${prefix}-${suffix}`);
  }
});

test("EKS ListAddons pagination", async () => {
  const client = eks();
  const clusterName = `bunsai-addon-pg-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const addonNames = ["aws-ebs-csi-driver", "coredns", "vpc-cni"];
  for (const addonName of addonNames) {
    await client.send(new CreateAddonCommand({ clusterName, addonName }));
  }

  const page1 = await client.send(
    new ListAddonsCommand({ clusterName, maxResults: 2 }),
  );
  expect((page1.addons ?? []).length).toBeLessThanOrEqual(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListAddonsCommand({ clusterName, nextToken: page1.nextToken }),
  );
  const all = [...(page1.addons ?? []), ...(page2.addons ?? [])];
  for (const addonName of addonNames) {
    expect(all).toContain(addonName);
  }

  for (const addonName of addonNames) {
    await client.send(new DeleteAddonCommand({ clusterName, addonName }));
  }
});

test("EKS ListFargateProfiles pagination", async () => {
  const client = eks();
  const clusterName = `bunsai-fp-pg-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const prefix = `fp-pg-${Date.now()}`;
  const profileNames = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];
  for (const name of profileNames) {
    await client.send(
      new CreateFargateProfileCommand({
        clusterName,
        fargateProfileName: name,
        podExecutionRoleArn: "arn:aws:iam::000000000000:role/fargate-role",
        subnets: ["subnet-aaaa"],
      }),
    );
  }

  const page1 = await client.send(
    new ListFargateProfilesCommand({ clusterName, maxResults: 2 }),
  );
  expect((page1.fargateProfileNames ?? []).length).toBeLessThanOrEqual(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListFargateProfilesCommand({
      clusterName,
      nextToken: page1.nextToken,
    }),
  );
  const all = [
    ...(page1.fargateProfileNames ?? []),
    ...(page2.fargateProfileNames ?? []),
  ];
  for (const name of profileNames) {
    expect(all).toContain(name);
  }

  for (const name of profileNames) {
    await client.send(
      new DeleteFargateProfileCommand({
        clusterName,
        fargateProfileName: name,
      }),
    );
  }
});

test("EKS ListAccessEntries pagination", async () => {
  const client = eks();
  const clusterName = `bunsai-ae-pg-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const arns = [
    "arn:aws:iam::000000000000:role/role-a",
    "arn:aws:iam::000000000000:role/role-b",
    "arn:aws:iam::000000000000:role/role-c",
  ];
  for (const principalArn of arns) {
    await client.send(
      new CreateAccessEntryCommand({ clusterName, principalArn }),
    );
  }

  const page1 = await client.send(
    new ListAccessEntriesCommand({ clusterName, maxResults: 2 }),
  );
  expect((page1.accessEntries ?? []).length).toBeLessThanOrEqual(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListAccessEntriesCommand({
      clusterName,
      nextToken: page1.nextToken,
    }),
  );
  const all = [...(page1.accessEntries ?? []), ...(page2.accessEntries ?? [])];
  for (const arn of arns) {
    expect(all).toContain(arn);
  }
});

test("EKS insights refresh state tracking", async () => {
  const client = eks();
  const clusterName = `bunsai-ins2-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const refresh = await client.send(
    new StartInsightsRefreshCommand({ clusterName }),
  );
  expect(refresh.status).toBe("IN_PROGRESS");

  const described = await client.send(
    new DescribeInsightsRefreshCommand({ clusterName }),
  );
  expect(described.status).toBe("COMPLETED");

  const described2 = await client.send(
    new DescribeInsightsRefreshCommand({ clusterName }),
  );
  expect(described2.status).toBe("COMPLETED");
});

test("EKS ListInsights stable IDs for DescribeInsight", async () => {
  const client = eks();
  const clusterName = `bunsai-ins3-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const listed1 = await client.send(new ListInsightsCommand({ clusterName }));
  expect(listed1.insights?.length ?? 0).toBeGreaterThan(0);

  const id = listed1.insights?.[0]?.id ?? "";
  expect(id).toBeTruthy();

  const listed2 = await client.send(new ListInsightsCommand({ clusterName }));
  expect(listed2.insights?.[0]?.id).toBe(id);

  const described = await client.send(
    new DescribeInsightCommand({ clusterName, id }),
  );
  expect(described.insight?.id).toBe(id);
});

test("EKS addon health reflects status", async () => {
  const client = eks();
  const clusterName = `bunsai-health-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const created = await client.send(
    new CreateAddonCommand({ clusterName, addonName: "coredns" }),
  );
  expect(created.addon?.status).toBe("CREATING");
  expect(
    (created.addon?.health as Record<string, unknown> | undefined)?.issues,
  ).toBeDefined();

  const described = await client.send(
    new DescribeAddonCommand({ clusterName, addonName: "coredns" }),
  );
  expect(described.addon?.status).toBe("ACTIVE");
  expect(
    (
      (described.addon?.health as Record<string, unknown> | undefined)
        ?.issues as unknown[]
    )?.length,
  ).toBe(0);

  await client.send(
    new DeleteAddonCommand({ clusterName, addonName: "coredns" }),
  );
});

test("EKS fargate profile health reflects status", async () => {
  const client = eks();
  const clusterName = `bunsai-fp-health-${Date.now()}`;
  await makeCluster(client, clusterName);
  await client.send(new DescribeClusterCommand({ name: clusterName }));

  const profileName = `fp-health-${Date.now()}`;
  const created = await client.send(
    new CreateFargateProfileCommand({
      clusterName,
      fargateProfileName: profileName,
      podExecutionRoleArn: "arn:aws:iam::000000000000:role/fargate-role",
      subnets: ["subnet-aaaa"],
    }),
  );
  expect(created.fargateProfile?.status).toBe("CREATING");
  expect(
    (created.fargateProfile?.health as Record<string, unknown> | undefined)
      ?.issues,
  ).toBeDefined();

  const described = await client.send(
    new DescribeFargateProfileCommand({
      clusterName,
      fargateProfileName: profileName,
    }),
  );
  expect(described.fargateProfile?.status).toBe("ACTIVE");
  expect(
    (
      (described.fargateProfile?.health as Record<string, unknown> | undefined)
        ?.issues as unknown[]
    )?.length,
  ).toBe(0);

  await client.send(
    new DeleteFargateProfileCommand({
      clusterName,
      fargateProfileName: profileName,
    }),
  );
});
