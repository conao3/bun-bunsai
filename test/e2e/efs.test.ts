import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateFileSystemCommand,
  CreateMountTargetCommand,
  DeleteFileSystemCommand,
  DescribeFileSystemsCommand,
  DescribeMountTargetsCommand,
  EFSClient,
  PutLifecycleConfigurationCommand,
} from "@aws-sdk/client-efs";

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

const efs = () => new EFSClient({ endpoint, region, credentials });

test("EFS file system, mount target and lifecycle roundtrip", async () => {
  const client = efs();
  const creationToken = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateFileSystemCommand({
      CreationToken: creationToken,
      Tags: [{ Key: "Name", Value: "bunsai-e2e" }],
    }),
  );
  expect(created.FileSystemId).toMatch(/^fs-/);
  expect(created.CreationToken).toBe(creationToken);
  expect(created.LifeCycleState).toBe("available");
  expect(created.Name).toBe("bunsai-e2e");
  const fileSystemId = created.FileSystemId as string;

  const described = await client.send(
    new DescribeFileSystemsCommand({ FileSystemId: fileSystemId }),
  );
  const fileSystems = described.FileSystems ?? [];
  expect(fileSystems.map((fs) => fs.FileSystemId)).toContain(fileSystemId);

  const mountTarget = await client.send(
    new CreateMountTargetCommand({
      FileSystemId: fileSystemId,
      SubnetId: "subnet-0123456789abcdef0",
    }),
  );
  expect(mountTarget.MountTargetId).toMatch(/^fsmt-/);
  expect(mountTarget.FileSystemId).toBe(fileSystemId);
  expect(mountTarget.LifeCycleState).toBe("available");
  const mountTargetId = mountTarget.MountTargetId as string;

  const mountTargets = await client.send(
    new DescribeMountTargetsCommand({ FileSystemId: fileSystemId }),
  );
  expect(
    (mountTargets.MountTargets ?? []).map((mt) => mt.MountTargetId),
  ).toContain(mountTargetId);

  const lifecycle = await client.send(
    new PutLifecycleConfigurationCommand({
      FileSystemId: fileSystemId,
      LifecyclePolicies: [{ TransitionToIA: "AFTER_30_DAYS" }],
    }),
  );
  expect((lifecycle.LifecyclePolicies ?? [])[0]?.TransitionToIA).toBe(
    "AFTER_30_DAYS",
  );

  await expect(
    client.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId })),
  ).rejects.toThrow();

  const deletable = await client.send(
    new CreateFileSystemCommand({ CreationToken: `${creationToken}-aux` }),
  );
  const deletableId = deletable.FileSystemId as string;
  await client.send(new DeleteFileSystemCommand({ FileSystemId: deletableId }));

  const afterDelete = await client.send(
    new DescribeFileSystemsCommand({ FileSystemId: deletableId }),
  );
  expect(afterDelete.FileSystems ?? []).toHaveLength(0);
  void mountTargetId;
});
