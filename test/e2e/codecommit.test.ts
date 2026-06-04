import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchGetCommitsCommand,
  BatchGetRepositoriesCommand,
  CodeCommitClient,
  CreateBranchCommand,
  CreateRepositoryCommand,
  DeleteBranchCommand,
  DeleteFileCommand,
  DeleteRepositoryCommand,
  GetBlobCommand,
  GetBranchCommand,
  GetCommitCommand,
  GetDifferencesCommand,
  GetFileCommand,
  GetFolderCommand,
  GetMergeOptionsCommand,
  GetRepositoryCommand,
  GetRepositoryTriggersCommand,
  ListBranchesCommand,
  ListRepositoriesCommand,
  ListTagsForResourceCommand,
  MergeBranchesByThreeWayCommand,
  PutFileCommand,
  PutRepositoryTriggersCommand,
  TagResourceCommand,
  TestRepositoryTriggersCommand,
  UntagResourceCommand,
  UpdateDefaultBranchCommand,
  UpdateRepositoryDescriptionCommand,
  UpdateRepositoryEncryptionKeyCommand,
  UpdateRepositoryNameCommand,
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

test("CodeCommit lifecycle: branches, files, merges, triggers, tags", async () => {
  const client = codecommit();
  const repoName = "bunsai-lifecycle-repo";

  const created = await client.send(
    new CreateRepositoryCommand({ repositoryName: repoName }),
  );
  expect(created.repositoryMetadata?.repositoryName).toBe(repoName);

  const put1 = await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "main",
      filePath: "README.md",
      fileContent: Buffer.from("# Hello").toString("base64"),
      commitMessage: "initial commit",
    }),
  );
  expect(put1.commitId).toBeTruthy();
  expect(put1.blobId).toBeTruthy();

  const branch = await client.send(
    new GetBranchCommand({ repositoryName: repoName, branchName: "main" }),
  );
  expect(branch.branch?.commitId).toBe(put1.commitId);

  const fileResult = await client.send(
    new GetFileCommand({
      repositoryName: repoName,
      filePath: "README.md",
      commitSpecifier: "main",
    }),
  );
  expect(fileResult.filePath).toBe("README.md");
  expect(fileResult.blobId).toBe(put1.blobId);

  const blobResult = await client.send(
    new GetBlobCommand({ repositoryName: repoName, blobId: put1.blobId! }),
  );
  expect(blobResult.content).toBeTruthy();

  await client.send(
    new CreateBranchCommand({
      repositoryName: repoName,
      branchName: "feature",
      commitId: put1.commitId!,
    }),
  );

  const put2 = await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "feature",
      filePath: "feature.txt",
      fileContent: Buffer.from("feature content").toString("base64"),
    }),
  );
  expect(put2.commitId).toBeTruthy();

  const commitResult = await client.send(
    new GetCommitCommand({
      repositoryName: repoName,
      commitId: put2.commitId!,
    }),
  );
  expect(commitResult.commit?.treeId).toBeTruthy();

  const folderResult = await client.send(
    new GetFolderCommand({
      repositoryName: repoName,
      commitSpecifier: put2.commitId,
      folderPath: "/",
    }),
  );
  expect((folderResult.files ?? []).length).toBeGreaterThan(0);

  const diffsResult = await client.send(
    new GetDifferencesCommand({
      repositoryName: repoName,
      afterCommitSpecifier: put2.commitId!,
      beforeCommitSpecifier: put1.commitId!,
    }),
  );
  expect((diffsResult.differences ?? []).length).toBe(1);
  expect(diffsResult.differences?.[0].changeType).toBe("A");

  const mergeOptionsResult = await client.send(
    new GetMergeOptionsCommand({
      repositoryName: repoName,
      sourceCommitSpecifier: "feature",
      destinationCommitSpecifier: "main",
    }),
  );
  expect((mergeOptionsResult.mergeOptions ?? []).length).toBeGreaterThan(0);

  const merged = await client.send(
    new MergeBranchesByThreeWayCommand({
      repositoryName: repoName,
      sourceCommitSpecifier: "feature",
      destinationCommitSpecifier: "main",
      targetBranch: "main",
    }),
  );
  expect(merged.commitId).toBeTruthy();

  const batchCommitsResult = await client.send(
    new BatchGetCommitsCommand({
      repositoryName: repoName,
      commitIds: [put1.commitId!, put2.commitId!, merged.commitId!],
    }),
  );
  expect((batchCommitsResult.commits ?? []).length).toBe(3);

  const deletedBranch = await client.send(
    new DeleteBranchCommand({
      repositoryName: repoName,
      branchName: "feature",
    }),
  );
  expect(deletedBranch.deletedBranch?.branchName).toBe("feature");

  const put3 = await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "main",
      filePath: "src/app.ts",
      fileContent: Buffer.from("export {}").toString("base64"),
      parentCommitId: merged.commitId,
    }),
  );
  await client.send(
    new DeleteFileCommand({
      repositoryName: repoName,
      branchName: "main",
      filePath: "src/app.ts",
      parentCommitId: put3.commitId!,
    }),
  );

  await client.send(
    new PutRepositoryTriggersCommand({
      repositoryName: repoName,
      triggers: [
        {
          name: "my-trigger",
          destinationArn:
            "arn:aws:lambda:us-east-1:123456789012:function:my-fn",
          events: ["all"],
          branches: [],
        },
      ],
    }),
  );
  const triggersResult = await client.send(
    new GetRepositoryTriggersCommand({ repositoryName: repoName }),
  );
  expect((triggersResult.triggers ?? []).length).toBe(1);
  expect(triggersResult.triggers?.[0].name).toBe("my-trigger");

  const testedResult = await client.send(
    new TestRepositoryTriggersCommand({
      repositoryName: repoName,
      triggers: [
        {
          name: "my-trigger",
          destinationArn:
            "arn:aws:lambda:us-east-1:123456789012:function:my-fn",
          events: ["all"],
          branches: [],
        },
      ],
    }),
  );
  expect((testedResult.successfulExecutions ?? []).includes("my-trigger")).toBe(
    true,
  );

  const repoArn = created.repositoryMetadata!.Arn!;
  await client.send(
    new TagResourceCommand({ resourceArn: repoArn, tags: { env: "test" } }),
  );
  const tagsResult = await client.send(
    new ListTagsForResourceCommand({ resourceArn: repoArn }),
  );
  expect(tagsResult.tags?.env).toBe("test");
  await client.send(
    new UntagResourceCommand({ resourceArn: repoArn, tagKeys: ["env"] }),
  );
  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ resourceArn: repoArn }),
  );
  expect(Object.keys(tagsAfter.tags ?? {}).includes("env")).toBe(false);

  const batchRepos = await client.send(
    new BatchGetRepositoriesCommand({
      repositoryNames: [repoName, "nonexistent-xyz"],
    }),
  );
  expect((batchRepos.repositories ?? []).length).toBe(1);
  expect(
    (batchRepos.repositoriesNotFound ?? []).includes("nonexistent-xyz"),
  ).toBe(true);

  await client.send(
    new UpdateDefaultBranchCommand({
      repositoryName: repoName,
      defaultBranchName: "main",
    }),
  );

  await client.send(
    new UpdateRepositoryEncryptionKeyCommand({
      repositoryName: repoName,
      kmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/test-key",
    }),
  );

  await client.send(
    new UpdateRepositoryNameCommand({
      oldName: repoName,
      newName: `${repoName}-renamed`,
    }),
  );
  const renamedRepo = await client.send(
    new GetRepositoryCommand({ repositoryName: `${repoName}-renamed` }),
  );
  expect(renamedRepo.repositoryMetadata?.repositoryName).toBe(
    `${repoName}-renamed`,
  );

  await client.send(
    new DeleteRepositoryCommand({ repositoryName: `${repoName}-renamed` }),
  );
});
