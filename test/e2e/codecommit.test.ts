import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CodeCommitClient,
  CreateBranchCommand,
  CreateRepositoryCommand,
  DeleteRepositoryCommand,
  GetRepositoryCommand,
  ListBranchesCommand,
  ListRepositoriesCommand,
  UpdateRepositoryDescriptionCommand,
} from "@aws-sdk/client-codecommit";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const codecommit = () =>
  new CodeCommitClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("CodeCommit repository and branch lifecycle", async () => {
  const client = codecommit();
  const name = "bunsai-e2e-repo";

  const created = await client.send(
    new CreateRepositoryCommand({
      repositoryName: name,
      repositoryDescription: "bunsai e2e repository",
    }),
  );
  expect(created.repositoryMetadata?.repositoryName).toBe(name);
  expect(created.repositoryMetadata?.Arn).toContain(name);
  expect(created.repositoryMetadata?.cloneUrlHttp).toContain(name);

  const fetched = await client.send(
    new GetRepositoryCommand({ repositoryName: name }),
  );
  expect(fetched.repositoryMetadata?.repositoryDescription).toBe(
    "bunsai e2e repository",
  );

  const listed = await client.send(new ListRepositoriesCommand({}));
  expect(
    (listed.repositories ?? []).some((entry) => entry.repositoryName === name),
  ).toBe(true);

  await client.send(
    new UpdateRepositoryDescriptionCommand({
      repositoryName: name,
      repositoryDescription: "updated description",
    }),
  );
  const afterUpdate = await client.send(
    new GetRepositoryCommand({ repositoryName: name }),
  );
  expect(afterUpdate.repositoryMetadata?.repositoryDescription).toBe(
    "updated description",
  );

  await client.send(
    new CreateBranchCommand({
      repositoryName: name,
      branchName: "feature",
      commitId: "0000000000000000000000000000000000000000",
    }),
  );
  const branches = await client.send(
    new ListBranchesCommand({ repositoryName: name }),
  );
  expect(branches.branches ?? []).toContain("feature");

  const deleted = await client.send(
    new DeleteRepositoryCommand({ repositoryName: name }),
  );
  expect(deleted.repositoryId).toBe(created.repositoryMetadata?.repositoryId);
});
