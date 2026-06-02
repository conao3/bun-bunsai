import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateBackupCommand,
  CreateFileSystemCommand,
  DeleteFileSystemCommand,
  DescribeBackupsCommand,
  DescribeFileSystemsCommand,
  FSxClient,
} from "@aws-sdk/client-fsx";

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

const client = () => new FSxClient({ endpoint, region, credentials });

test("fsx file system and backup round-trip", async () => {
  const fsx = client();

  const created = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileSystemId = created.FileSystem?.FileSystemId;
  expect(fileSystemId).toMatch(/^fs-[0-9a-f]{16}$/);
  expect(created.FileSystem?.Lifecycle).toBe("AVAILABLE");
  expect(created.FileSystem?.DNSName).toContain(fileSystemId);
  expect(created.FileSystem?.ResourceARN).toContain(
    `:file-system/${fileSystemId}`,
  );

  const described = await fsx.send(
    new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
  );
  const ids = (described.FileSystems ?? []).map((entry) => entry.FileSystemId);
  expect(ids).toContain(fileSystemId);

  const createdBackup = await fsx.send(
    new CreateBackupCommand({ FileSystemId: fileSystemId }),
  );
  const backupId = createdBackup.Backup?.BackupId;
  expect(backupId).toMatch(/^backup-[0-9a-f]{16}$/);
  expect(createdBackup.Backup?.Lifecycle).toBe("AVAILABLE");
  expect(createdBackup.Backup?.FileSystem?.FileSystemId).toBe(fileSystemId);

  const describedBackups = await fsx.send(
    new DescribeBackupsCommand({ BackupIds: [backupId ?? ""] }),
  );
  const backupIds = (describedBackups.Backups ?? []).map(
    (entry) => entry.BackupId,
  );
  expect(backupIds).toContain(backupId);

  const deleted = await fsx.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
  expect(deleted.FileSystemId).toBe(fileSystemId);

  await expect(
    fsx.send(
      new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
    ),
  ).resolves.toBeDefined();
});
