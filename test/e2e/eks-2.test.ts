import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4673;
const uiPort = 5673;
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

const eks = () => new EKSClient({ endpoint, region, credentials });

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
  expect(created.fargateProfile?.status).toBe("ACTIVE");
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
  expect(created.addon?.status).toBe("ACTIVE");
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
