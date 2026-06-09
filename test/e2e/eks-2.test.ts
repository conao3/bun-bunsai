import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAddonCommand,
  CreateClusterCommand,
  CreateFargateProfileCommand,
  DeleteAddonCommand,
  DeleteFargateProfileCommand,
  DescribeAddonCommand,
  DescribeFargateProfileCommand,
  EKSClient,
  ListAddonsCommand,
  ListFargateProfilesCommand,
} from "@aws-sdk/client-eks";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eks = () =>
  new EKSClient({ endpoint, region, credentials, requestHandler });

test("EKS fargate profile roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-fp-${Date.now()}`;
  const profileName = `bunsai-profile-${Date.now()}`;

  await client.send(
    new CreateClusterCommand({
      name: clusterName,
      roleArn: "arn:aws:iam::000000000000:role/eks-role",
      resourcesVpcConfig: { subnetIds: ["subnet-aaaa"] },
    }),
  );

  const created = await client.send(
    new CreateFargateProfileCommand({
      clusterName,
      fargateProfileName: profileName,
      podExecutionRoleArn: "arn:aws:iam::000000000000:role/eks-fargate-role",
      subnets: ["subnet-aaaa", "subnet-bbbb"],
      selectors: [{ namespace: "default", labels: { tier: "web" } }],
    }),
  );
  expect(created.fargateProfile?.fargateProfileName).toBe(profileName);
  expect(created.fargateProfile?.clusterName).toBe(clusterName);
  expect(created.fargateProfile?.status).toBe("CREATING");
  expect(created.fargateProfile?.fargateProfileArn).toContain(
    `fargateprofile/${clusterName}/${profileName}`,
  );
  expect(created.fargateProfile?.selectors?.[0]?.namespace).toBe("default");

  const described = await client.send(
    new DescribeFargateProfileCommand({
      clusterName,
      fargateProfileName: profileName,
    }),
  );
  expect(described.fargateProfile?.fargateProfileName).toBe(profileName);
  expect(described.fargateProfile?.podExecutionRoleArn).toBe(
    "arn:aws:iam::000000000000:role/eks-fargate-role",
  );

  const listed = await client.send(
    new ListFargateProfilesCommand({ clusterName }),
  );
  expect(listed.fargateProfileNames ?? []).toContain(profileName);

  const deleted = await client.send(
    new DeleteFargateProfileCommand({
      clusterName,
      fargateProfileName: profileName,
    }),
  );
  expect(deleted.fargateProfile?.status).toBe("DELETING");

  await expect(
    client.send(
      new DescribeFargateProfileCommand({
        clusterName,
        fargateProfileName: profileName,
      }),
    ),
  ).rejects.toThrow();
});

test("EKS addon roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-addon-${Date.now()}`;
  const addonName = "vpc-cni";

  await client.send(
    new CreateClusterCommand({
      name: clusterName,
      roleArn: "arn:aws:iam::000000000000:role/eks-role",
      resourcesVpcConfig: { subnetIds: ["subnet-aaaa"] },
    }),
  );

  const created = await client.send(
    new CreateAddonCommand({
      clusterName,
      addonName,
      addonVersion: "v1.18.1-eksbuild.1",
    }),
  );
  expect(created.addon?.addonName).toBe(addonName);
  expect(created.addon?.clusterName).toBe(clusterName);
  expect(created.addon?.status).toBe("CREATING");
  expect(created.addon?.addonVersion).toBe("v1.18.1-eksbuild.1");
  expect(created.addon?.addonArn).toContain(
    `addon/${clusterName}/${addonName}`,
  );

  const described = await client.send(
    new DescribeAddonCommand({ clusterName, addonName }),
  );
  expect(described.addon?.addonName).toBe(addonName);

  const listed = await client.send(new ListAddonsCommand({ clusterName }));
  expect(listed.addons ?? []).toContain(addonName);

  const deleted = await client.send(
    new DeleteAddonCommand({ clusterName, addonName }),
  );
  expect(deleted.addon?.status).toBe("DELETING");

  await expect(
    client.send(new DescribeAddonCommand({ clusterName, addonName })),
  ).rejects.toThrow();
});
