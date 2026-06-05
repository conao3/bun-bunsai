import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateApprovalRuleTemplateWithRepositoryCommand,
  BatchGetCommitsCommand,
  BatchGetRepositoriesCommand,
  CodeCommitClient,
  CreateApprovalRuleTemplateCommand,
  CreateBranchCommand,
  CreatePullRequestApprovalRuleCommand,
  CreatePullRequestCommand,
  CreateRepositoryCommand,
  DeleteApprovalRuleTemplateCommand,
  DeleteBranchCommand,
  DeleteCommentContentCommand,
  DeleteFileCommand,
  DeleteRepositoryCommand,
  GetApprovalRuleTemplateCommand,
  GetBlobCommand,
  GetBranchCommand,
  GetCommentCommand,
  GetCommentReactionsCommand,
  GetCommitCommand,
  GetDifferencesCommand,
  GetFileCommand,
  GetFolderCommand,
  GetMergeOptionsCommand,
  GetPullRequestApprovalStatesCommand,
  GetPullRequestCommand,
  GetRepositoryCommand,
  GetRepositoryTriggersCommand,
  ListApprovalRuleTemplatesCommand,
  ListAssociatedApprovalRuleTemplatesForRepositoryCommand,
  ListBranchesCommand,
  ListPullRequestsCommand,
  ListRepositoriesCommand,
  ListTagsForResourceCommand,
  MergeBranchesByThreeWayCommand,
  MergePullRequestByFastForwardCommand,
  PostCommentForPullRequestCommand,
  PostCommentReplyCommand,
  PutCommentReactionCommand,
  PutFileCommand,
  PutRepositoryTriggersCommand,
  TagResourceCommand,
  TestRepositoryTriggersCommand,
  UntagResourceCommand,
  UpdateApprovalRuleTemplateNameCommand,
  UpdateCommentCommand,
  UpdateDefaultBranchCommand,
  UpdatePullRequestTitleCommand,
  UpdateRepositoryDescriptionCommand,
  UpdateRepositoryEncryptionKeyCommand,
  UpdateRepositoryNameCommand,
} from "@aws-sdk/client-codecommit";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const codecommit = () =>
  new CodeCommitClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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
      fileContent: Buffer.from("# Hello"),
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
      fileContent: Buffer.from("feature content"),
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
      fileContent: Buffer.from("export {}"),
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

test("CodeCommit approval-rule-template lifecycle", async () => {
  const client = codecommit();
  const templateName = "art-e2e-template";
  const repoName = "art-e2e-repo";

  await client.send(new CreateRepositoryCommand({ repositoryName: repoName }));

  const created = await client.send(
    new CreateApprovalRuleTemplateCommand({
      approvalRuleTemplateName: templateName,
      approvalRuleTemplateContent: '{"Version":"2018-11-08","Statements":[]}',
      approvalRuleTemplateDescription: "e2e template",
    }),
  );
  expect(created.approvalRuleTemplate?.approvalRuleTemplateName).toBe(
    templateName,
  );
  expect(created.approvalRuleTemplate?.approvalRuleTemplateId).toBeTruthy();

  const fetched = await client.send(
    new GetApprovalRuleTemplateCommand({
      approvalRuleTemplateName: templateName,
    }),
  );
  expect(fetched.approvalRuleTemplate?.approvalRuleTemplateDescription).toBe(
    "e2e template",
  );

  const listed = await client.send(new ListApprovalRuleTemplatesCommand({}));
  expect((listed.approvalRuleTemplateNames ?? []).includes(templateName)).toBe(
    true,
  );

  await client.send(
    new AssociateApprovalRuleTemplateWithRepositoryCommand({
      approvalRuleTemplateName: templateName,
      repositoryName: repoName,
    }),
  );
  const assocList = await client.send(
    new ListAssociatedApprovalRuleTemplatesForRepositoryCommand({
      repositoryName: repoName,
    }),
  );
  expect(
    (assocList.approvalRuleTemplateNames ?? []).includes(templateName),
  ).toBe(true);

  const renamed = await client.send(
    new UpdateApprovalRuleTemplateNameCommand({
      oldApprovalRuleTemplateName: templateName,
      newApprovalRuleTemplateName: `${templateName}-v2`,
    }),
  );
  expect(renamed.approvalRuleTemplate?.approvalRuleTemplateName).toBe(
    `${templateName}-v2`,
  );

  await client.send(
    new DeleteApprovalRuleTemplateCommand({
      approvalRuleTemplateName: `${templateName}-v2`,
    }),
  );
  await client.send(new DeleteRepositoryCommand({ repositoryName: repoName }));
});

test("CodeCommit pull-request lifecycle", async () => {
  const client = codecommit();
  const repoName = "pr-e2e-repo";

  await client.send(new CreateRepositoryCommand({ repositoryName: repoName }));
  const put = await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "main",
      filePath: "README.md",
      fileContent: Buffer.from("hello"),
      commitMessage: "init",
    }),
  );
  await client.send(
    new CreateBranchCommand({
      repositoryName: repoName,
      branchName: "feature",
      commitId: put.commitId!,
    }),
  );
  await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "feature",
      filePath: "feat.md",
      fileContent: Buffer.from("feature"),
      commitMessage: "feat",
    }),
  );

  const pr = await client.send(
    new CreatePullRequestCommand({
      title: "My PR",
      targets: [
        {
          repositoryName: repoName,
          sourceReference: "feature",
          destinationReference: "main",
        },
      ],
    }),
  );
  const prId = pr.pullRequest?.pullRequestId!;
  expect(pr.pullRequest?.title).toBe("My PR");
  expect(pr.pullRequest?.pullRequestStatus).toBe("OPEN");

  const fetched = await client.send(
    new GetPullRequestCommand({ pullRequestId: prId }),
  );
  expect(fetched.pullRequest?.pullRequestId).toBe(prId);

  const listed = await client.send(
    new ListPullRequestsCommand({ repositoryName: repoName }),
  );
  expect((listed.pullRequestIds ?? []).includes(prId)).toBe(true);

  const updated = await client.send(
    new UpdatePullRequestTitleCommand({
      pullRequestId: prId,
      title: "Updated PR",
    }),
  );
  expect(updated.pullRequest?.title).toBe("Updated PR");

  const rule = await client.send(
    new CreatePullRequestApprovalRuleCommand({
      pullRequestId: prId,
      approvalRuleName: "required-approval",
      approvalRuleContent: '{"Version":"2018-11-08","Statements":[]}',
    }),
  );
  expect(rule.approvalRule?.approvalRuleName).toBe("required-approval");

  const states = await client.send(
    new GetPullRequestApprovalStatesCommand({
      pullRequestId: prId,
      revisionId: fetched.pullRequest?.revisionId!,
    }),
  );
  expect(states.approvals).toBeDefined();

  const merged = await client.send(
    new MergePullRequestByFastForwardCommand({
      pullRequestId: prId,
      repositoryName: repoName,
    }),
  );
  expect(merged.pullRequest?.pullRequestStatus).toBe("CLOSED");

  await client.send(new DeleteRepositoryCommand({ repositoryName: repoName }));
});

test("CodeCommit comment lifecycle", async () => {
  const client = codecommit();
  const repoName = "comment-e2e-repo";

  await client.send(new CreateRepositoryCommand({ repositoryName: repoName }));
  const put = await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "main",
      filePath: "README.md",
      fileContent: Buffer.from("hello"),
      commitMessage: "init",
    }),
  );
  await client.send(
    new CreateBranchCommand({
      repositoryName: repoName,
      branchName: "feature",
      commitId: put.commitId!,
    }),
  );
  await client.send(
    new PutFileCommand({
      repositoryName: repoName,
      branchName: "feature",
      filePath: "feat.md",
      fileContent: Buffer.from("feature"),
      commitMessage: "feat",
    }),
  );

  const pr = await client.send(
    new CreatePullRequestCommand({
      title: "Comment PR",
      targets: [
        {
          repositoryName: repoName,
          sourceReference: "feature",
          destinationReference: "main",
        },
      ],
    }),
  );
  const prId = pr.pullRequest?.pullRequestId!;
  const targets = pr.pullRequest?.pullRequestTargets ?? [];
  const beforeCommit = targets[0]?.destinationCommit ?? put.commitId!;
  const afterCommit = targets[0]?.sourceCommit ?? put.commitId!;

  const posted = await client.send(
    new PostCommentForPullRequestCommand({
      pullRequestId: prId,
      repositoryName: repoName,
      beforeCommitId: beforeCommit,
      afterCommitId: afterCommit,
      content: "looks good",
    }),
  );
  const commentId = posted.comment?.commentId!;
  expect(posted.comment?.content).toBe("looks good");

  const fetched = await client.send(new GetCommentCommand({ commentId }));
  expect(fetched.comment?.content).toBe("looks good");

  const updated = await client.send(
    new UpdateCommentCommand({ commentId, content: "updated comment" }),
  );
  expect(updated.comment?.content).toBe("updated comment");

  const reply = await client.send(
    new PostCommentReplyCommand({
      inReplyTo: commentId,
      content: "reply here",
    }),
  );
  expect(reply.comment?.content).toBe("reply here");

  await client.send(
    new PutCommentReactionCommand({ commentId, reactionValue: ":thumbsup:" }),
  );
  const reactions = await client.send(
    new GetCommentReactionsCommand({ commentId }),
  );
  expect((reactions.reactionsForComment ?? []).length).toBeGreaterThan(0);

  await client.send(new DeleteCommentContentCommand({ commentId }));
  const deleted = await client.send(new GetCommentCommand({ commentId }));
  expect(deleted.comment?.deleted).toBe(true);

  await client.send(new DeleteRepositoryCommand({ repositoryName: repoName }));
});
