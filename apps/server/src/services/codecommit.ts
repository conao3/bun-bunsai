import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codecommitModel from "../../../../test/vendor/aws-models/codecommit.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codecommitModel);

type StoredRepository = {
  accountId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryDescription: string | undefined;
  defaultBranch: string | undefined;
  lastModifiedDate: number;
  creationDate: number;
  cloneUrlHttp: string;
  cloneUrlSsh: string;
  Arn: string;
  kmsKeyId: string | undefined;
  branches: string[];
};

type StoredBranch = {
  repositoryName: string;
  branchName: string;
  commitId: string;
};

type StoredUserInfo = {
  name: string | undefined;
  email: string | undefined;
  date: string;
};

type StoredFileEntry = {
  absolutePath: string;
  fileMode: string;
  blobId: string;
  fileSize: number;
};

type StoredTree = {
  treeId: string;
  files: Record<string, StoredFileEntry>;
};

type StoredCommit = {
  commitId: string;
  message: string;
  parentCommitIds: string[];
  treeId: string;
  author: StoredUserInfo;
  committer: StoredUserInfo;
  additionalData: string | undefined;
};

type StoredTrigger = {
  name: string;
  destinationArn: string;
  customData: string | undefined;
  branches: string[];
  events: string[];
};

const repositoryKey = (name: string): string => `repository/${name}`;
const branchKey = (repoName: string, branchName: string): string =>
  `branch/${repoName}/${branchName}`;
const commitKey = (repoName: string, commitId: string): string =>
  `commit/${repoName}/${commitId}`;
const treeKey = (repoName: string, treeId: string): string =>
  `tree/${repoName}/${treeId}`;
const blobKey = (repoName: string, blobId: string): string =>
  `blob/${repoName}/${blobId}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const triggersKey = (repoName: string): string => `triggers/${repoName}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidRepositoryNameException",
      `${key} is required.`,
      400,
    );
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const repositoryArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codecommit:${ctx.region}:${ctx.account}:${name}`;

const cloneUrlHttp = (ctx: ServiceContext, name: string): string =>
  `https://git-codecommit.${ctx.region}.amazonaws.com/v1/repos/${name}`;

const cloneUrlSsh = (ctx: ServiceContext, name: string): string =>
  `ssh://git-codecommit.${ctx.region}.amazonaws.com/v1/repos/${name}`;

const listRepositories = (ctx: ServiceContext): StoredRepository[] =>
  ctx.store
    .list<StoredRepository>()
    .filter((entry) => entry.key.startsWith("repository/"))
    .map((entry) => entry.value);

const repositoryView = (
  repository: StoredRepository,
): Record<string, unknown> => ({
  accountId: repository.accountId,
  repositoryId: repository.repositoryId,
  repositoryName: repository.repositoryName,
  repositoryDescription: repository.repositoryDescription,
  defaultBranch: repository.defaultBranch,
  lastModifiedDate: repository.lastModifiedDate,
  creationDate: repository.creationDate,
  cloneUrlHttp: repository.cloneUrlHttp,
  cloneUrlSsh: repository.cloneUrlSsh,
  Arn: repository.Arn,
  kmsKeyId: repository.kmsKeyId,
});

const requireRepository = (
  ctx: ServiceContext,
  name: string,
): StoredRepository => {
  const repository = ctx.store.get<StoredRepository>(repositoryKey(name));
  if (repository === undefined) {
    throw awsError(
      "RepositoryDoesNotExistException",
      `The specified repository does not exist: ${name}`,
      400,
    );
  }
  return repository;
};

const requireBranch = (
  ctx: ServiceContext,
  repoName: string,
  branchName: string,
): StoredBranch => {
  const branch = ctx.store.get<StoredBranch>(branchKey(repoName, branchName));
  if (branch === undefined) {
    throw awsError(
      "BranchDoesNotExistException",
      `Branch does not exist: ${branchName}`,
      400,
    );
  }
  return branch;
};

const requireCommit = (
  ctx: ServiceContext,
  repoName: string,
  commitId: string,
): StoredCommit => {
  const commit = ctx.store.get<StoredCommit>(commitKey(repoName, commitId));
  if (commit === undefined) {
    throw awsError(
      "CommitDoesNotExistException",
      `The specified commit does not exist: ${commitId}`,
      400,
    );
  }
  return commit;
};

const getTree = (
  ctx: ServiceContext,
  repoName: string,
  treeId: string,
): StoredTree =>
  ctx.store.get<StoredTree>(treeKey(repoName, treeId)) ?? {
    treeId,
    files: {},
  };

const contentHash = (s: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= s.charCodeAt(s.length - 1 - i);
    h2 = Math.imul(h2, 0x9e3779b1);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return (p1 + p2 + p1 + p2 + p1).slice(0, 40);
};

const computeTreeId = (files: Record<string, StoredFileEntry>): string =>
  contentHash(
    Object.keys(files)
      .sort()
      .map((k) => `${k}:${files[k].blobId}`)
      .join(";"),
  );

const nowIso = (): string => new Date().toISOString();

const defaultUserInfo = (input: Record<string, unknown>): StoredUserInfo => ({
  name: stringOrUndefined(input["name"]),
  email: stringOrUndefined(input["email"]),
  date: nowIso(),
});

const authorUserInfo = (input: Record<string, unknown>): StoredUserInfo => ({
  name: stringOrUndefined(input["authorName"]),
  email: stringOrUndefined(input["email"]),
  date: nowIso(),
});

const systemUser = (): StoredUserInfo => ({
  name: "System",
  email: "system@bunsai",
  date: nowIso(),
});

const buildAndStoreTree = (
  ctx: ServiceContext,
  repoName: string,
  files: Record<string, StoredFileEntry>,
): StoredTree => {
  const treeId = computeTreeId(files);
  const tree: StoredTree = { treeId, files };
  ctx.store.set(treeKey(repoName, treeId), tree);
  return tree;
};

const makeCommit = (
  ctx: ServiceContext,
  repoName: string,
  params: {
    message: string;
    parentCommitIds: string[];
    files: Record<string, StoredFileEntry>;
    author: StoredUserInfo;
    committer: StoredUserInfo;
    additionalData?: string;
  },
): StoredCommit => {
  const tree = buildAndStoreTree(ctx, repoName, params.files);
  const commitId = crypto.randomUUID().replace(/-/g, "");
  const commit: StoredCommit = {
    commitId,
    message: params.message,
    parentCommitIds: params.parentCommitIds,
    treeId: tree.treeId,
    author: params.author,
    committer: params.committer,
    additionalData: params.additionalData,
  };
  ctx.store.set(commitKey(repoName, commitId), commit);
  return commit;
};

const updateBranchHead = (
  ctx: ServiceContext,
  repo: StoredRepository,
  branchName: string,
  commitId: string,
): void => {
  const branch: StoredBranch = {
    repositoryName: repo.repositoryName,
    branchName,
    commitId,
  };
  ctx.store.set(branchKey(repo.repositoryName, branchName), branch);
  const branches = repo.branches.includes(branchName)
    ? repo.branches
    : [...repo.branches, branchName];
  const updated: StoredRepository = {
    ...repo,
    branches,
    defaultBranch: repo.defaultBranch ?? branchName,
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(repo.repositoryName), updated);
};

const resolveRef = (
  ctx: ServiceContext,
  repoName: string,
  ref: string,
): string => {
  const branch = ctx.store.get<StoredBranch>(branchKey(repoName, ref));
  return branch !== undefined ? branch.commitId : ref;
};

const filesForRef = (
  ctx: ServiceContext,
  repoName: string,
  ref: string,
): { commitId: string; files: Record<string, StoredFileEntry> } => {
  const commitId = resolveRef(ctx, repoName, ref);
  const commit = ctx.store.get<StoredCommit>(commitKey(repoName, commitId));
  if (commit === undefined) return { commitId, files: {} };
  const tree = getTree(ctx, repoName, commit.treeId);
  return { commitId, files: tree.files };
};

const commitView = (commit: StoredCommit): Record<string, unknown> => ({
  commitId: commit.commitId,
  message: commit.message,
  parents: commit.parentCommitIds,
  treeId: commit.treeId,
  author: {
    name: commit.author.name,
    email: commit.author.email,
    date: commit.author.date,
  },
  committer: {
    name: commit.committer.name,
    email: commit.committer.email,
    date: commit.committer.date,
  },
  additionalData: commit.additionalData,
});

const folderView = (
  commitId: string,
  folderPath: string,
  treeId: string,
  files: Record<string, StoredFileEntry>,
): Record<string, unknown> => {
  const normalized =
    folderPath === "/" || folderPath === ""
      ? ""
      : folderPath.replace(/\/$/, "");

  const subFolderSet = new Set<string>();
  const fileEntries: Record<string, unknown>[] = [];

  for (const [path, fileEntry] of Object.entries(files)) {
    const isInFolder =
      normalized === "" ? true : path.startsWith(`${normalized}/`);
    if (!isInFolder) continue;
    const relativePart =
      normalized === "" ? path : path.slice(normalized.length + 1);
    const slashIdx = relativePart.indexOf("/");
    if (slashIdx === -1) {
      fileEntries.push({
        blobId: fileEntry.blobId,
        absolutePath: fileEntry.absolutePath,
        relativePath: relativePart,
        fileMode: fileEntry.fileMode,
        fileSize: fileEntry.fileSize,
      });
    } else {
      const subFolderName = relativePart.slice(0, slashIdx);
      const subFolderAbs =
        normalized === "" ? subFolderName : `${normalized}/${subFolderName}`;
      subFolderSet.add(subFolderAbs);
    }
  }

  const subFolders = Array.from(subFolderSet).map((sf) => {
    const rel = normalized === "" ? sf : sf.slice(normalized.length + 1);
    return {
      treeId: contentHash(`subfolder:${treeId}:${sf}`),
      absolutePath: sf,
      relativePath: rel,
    };
  });

  return {
    commitId,
    folderPath: normalized || "/",
    treeId,
    subFolders,
    files: fileEntries,
    symbolicLinks: [],
    subModules: [],
  };
};

const getMergeBase = (
  ctx: ServiceContext,
  repoName: string,
  commitId1: string,
  commitId2: string,
): string | undefined => {
  const ancestors = new Set<string>();
  const queue1 = [commitId1];
  while (queue1.length > 0) {
    const cid = queue1.shift()!;
    if (ancestors.has(cid)) continue;
    ancestors.add(cid);
    const c = ctx.store.get<StoredCommit>(commitKey(repoName, cid));
    if (c !== undefined) queue1.push(...c.parentCommitIds);
  }
  const queue2 = [commitId2];
  const visited = new Set<string>();
  while (queue2.length > 0) {
    const cid = queue2.shift()!;
    if (visited.has(cid)) continue;
    visited.add(cid);
    if (ancestors.has(cid)) return cid;
    const c = ctx.store.get<StoredCommit>(commitKey(repoName, cid));
    if (c !== undefined) queue2.push(...c.parentCommitIds);
  }
  return undefined;
};

const storeBlobAndEntry = (
  ctx: ServiceContext,
  repoName: string,
  filePath: string,
  fileContent: string,
  fileMode: string,
): StoredFileEntry => {
  const blobId = contentHash(`blob:${repoName}:${filePath}:${fileContent}`);
  let fileSize = 0;
  try {
    fileSize = atob(fileContent).length;
  } catch {
    fileSize = fileContent.length;
  }
  ctx.store.set(blobKey(repoName, blobId), { content: fileContent });
  return { absolutePath: filePath, fileMode, blobId, fileSize };
};

const CreateRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  if (ctx.store.get<StoredRepository>(repositoryKey(name)) !== undefined) {
    throw awsError(
      "RepositoryNameExistsException",
      `Repository already exists: ${name}`,
      400,
    );
  }
  const now = Date.now();
  const repository: StoredRepository = {
    accountId: ctx.account,
    repositoryId: crypto.randomUUID(),
    repositoryName: name,
    repositoryDescription: stringOrUndefined(input["repositoryDescription"]),
    defaultBranch: undefined,
    lastModifiedDate: now,
    creationDate: now,
    cloneUrlHttp: cloneUrlHttp(ctx, name),
    cloneUrlSsh: cloneUrlSsh(ctx, name),
    Arn: repositoryArn(ctx, name),
    kmsKeyId: stringOrUndefined(input["kmsKeyId"]),
    branches: [],
  };
  ctx.store.set(repositoryKey(name), repository);
  const rawTags = input["tags"];
  if (
    typeof rawTags === "object" &&
    rawTags !== null &&
    !Array.isArray(rawTags)
  ) {
    ctx.store.set(tagsKey(repository.Arn), rawTags as Record<string, string>);
  }
  return { repositoryMetadata: repositoryView(repository) };
};

const GetRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  return { repositoryMetadata: repositoryView(repository) };
};

const ListRepositories: OperationHandler = (input, ctx) => {
  const order = stringOrUndefined(input["order"]) ?? "ascending";
  const repositories = listRepositories(ctx)
    .sort((left, right) =>
      order === "descending"
        ? right.repositoryName.localeCompare(left.repositoryName)
        : left.repositoryName.localeCompare(right.repositoryName),
    )
    .map((repository) => ({
      repositoryName: repository.repositoryName,
      repositoryId: repository.repositoryId,
    }));
  return { repositories };
};

const DeleteRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = ctx.store.get<StoredRepository>(repositoryKey(name));
  ctx.store.delete(repositoryKey(name));
  return repository === undefined
    ? {}
    : { repositoryId: repository.repositoryId };
};

const UpdateRepositoryDescription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const updated: StoredRepository = {
    ...repository,
    repositoryDescription: stringOrUndefined(input["repositoryDescription"]),
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(name), updated);
  return {};
};

const CreateBranch: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const branchName = requireString(input, "branchName");
  const commitId = requireString(input, "commitId");
  const repository = requireRepository(ctx, name);
  const branches = repository.branches.includes(branchName)
    ? repository.branches
    : [...repository.branches, branchName];
  const updated: StoredRepository = {
    ...repository,
    branches,
    defaultBranch: repository.defaultBranch ?? branchName,
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(name), updated);
  const branch: StoredBranch = { repositoryName: name, branchName, commitId };
  ctx.store.set(branchKey(name, branchName), branch);
  return {};
};

const ListBranches: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  return { branches: [...repository.branches].sort() };
};

const BatchGetRepositories: OperationHandler = (input, ctx) => {
  const rawNames = input["repositoryNames"];
  if (!Array.isArray(rawNames)) {
    throw awsError(
      "InvalidRepositoryNameException",
      "repositoryNames is required.",
      400,
    );
  }
  const repositories: Record<string, unknown>[] = [];
  const repositoriesNotFound: string[] = [];
  for (const rawName of rawNames) {
    const name = String(rawName);
    const repo = ctx.store.get<StoredRepository>(repositoryKey(name));
    if (repo === undefined) {
      repositoriesNotFound.push(name);
    } else {
      repositories.push(repositoryView(repo));
    }
  }
  return { repositories, repositoriesNotFound };
};

const GetBranch: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const branchName = requireString(input, "branchName");
  requireRepository(ctx, repoName);
  const branch = requireBranch(ctx, repoName, branchName);
  return {
    branch: {
      branchName: branch.branchName,
      commitId: branch.commitId,
    },
  };
};

const DeleteBranch: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const branchName = requireString(input, "branchName");
  const repo = requireRepository(ctx, repoName);
  const branch = ctx.store.get<StoredBranch>(branchKey(repoName, branchName));
  ctx.store.delete(branchKey(repoName, branchName));
  const updated: StoredRepository = {
    ...repo,
    branches: repo.branches.filter((b) => b !== branchName),
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(repoName), updated);
  if (branch === undefined) return {};
  return {
    deletedBranch: {
      branchName: branch.branchName,
      commitId: branch.commitId,
    },
  };
};

const GetCommit: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const commitId = requireString(input, "commitId");
  requireRepository(ctx, repoName);
  const commit = requireCommit(ctx, repoName, commitId);
  return { commit: commitView(commit) };
};

const BatchGetCommits: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  requireRepository(ctx, repoName);
  const rawIds = input["commitIds"];
  if (!Array.isArray(rawIds)) {
    throw awsError(
      "InvalidCommitIdsListException",
      "commitIds is required.",
      400,
    );
  }
  const commits: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const rawId of rawIds) {
    const cid = String(rawId);
    const commit = ctx.store.get<StoredCommit>(commitKey(repoName, cid));
    if (commit === undefined) {
      errors.push({
        commitId: cid,
        errorCode: "CommitDoesNotExistException",
        errorMessage: `The specified commit does not exist: ${cid}`,
      });
    } else {
      commits.push(commitView(commit));
    }
  }
  return { commits, errors };
};

const GetBlob: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const blobId = requireString(input, "blobId");
  requireRepository(ctx, repoName);
  const blob = ctx.store.get<{ content: string }>(blobKey(repoName, blobId));
  if (blob === undefined) {
    throw awsError(
      "BlobIdDoesNotExistException",
      `Blob does not exist: ${blobId}`,
      400,
    );
  }
  return { content: blob.content };
};

const GetFile: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const filePath = requireString(input, "filePath");
  const repo = requireRepository(ctx, repoName);

  const rawRef = stringOrUndefined(input["commitSpecifier"]);
  let ref: string;
  if (rawRef !== undefined) {
    ref = rawRef;
  } else {
    if (repo.defaultBranch === undefined) {
      throw awsError(
        "CommitDoesNotExistException",
        "No commits in this repository.",
        400,
      );
    }
    ref = repo.defaultBranch;
  }

  const { commitId, files } = filesForRef(ctx, repoName, ref);
  const fileEntry = files[filePath];
  if (fileEntry === undefined) {
    throw awsError(
      "FileDoesNotExistException",
      `File does not exist: ${filePath}`,
      400,
    );
  }

  const blob = ctx.store.get<{ content: string }>(
    blobKey(repoName, fileEntry.blobId),
  );
  return {
    commitId,
    blobId: fileEntry.blobId,
    filePath: fileEntry.absolutePath,
    fileMode: fileEntry.fileMode,
    fileContent: blob?.content ?? "",
    fileSize: fileEntry.fileSize,
  };
};

const GetFolder: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const folderPath = stringOrUndefined(input["folderPath"]) ?? "/";
  const repo = requireRepository(ctx, repoName);

  const rawRef = stringOrUndefined(input["commitSpecifier"]);
  let commitId: string;
  let files: Record<string, StoredFileEntry>;
  let treeId: string;

  if (rawRef !== undefined) {
    const result = filesForRef(ctx, repoName, rawRef);
    commitId = result.commitId;
    files = result.files;
    const commit = ctx.store.get<StoredCommit>(commitKey(repoName, commitId));
    treeId = commit?.treeId ?? contentHash(`${repoName}:${commitId}`);
  } else if (repo.defaultBranch !== undefined) {
    const result = filesForRef(ctx, repoName, repo.defaultBranch);
    commitId = result.commitId;
    files = result.files;
    const commit = ctx.store.get<StoredCommit>(commitKey(repoName, commitId));
    treeId = commit?.treeId ?? contentHash(`${repoName}:${commitId}`);
  } else {
    commitId = "";
    files = {};
    treeId = contentHash(`${repoName}:empty`);
  }

  return folderView(commitId, folderPath, treeId, files);
};

const PutFile: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const branchName = requireString(input, "branchName");
  const filePath = requireString(input, "filePath");
  const rawContent = input["fileContent"];
  if (typeof rawContent !== "string") {
    throw awsError(
      "InvalidFileContentException",
      "fileContent is required.",
      400,
    );
  }

  const repo = requireRepository(ctx, repoName);

  let parentFiles: Record<string, StoredFileEntry> = {};
  let parentCommitIds: string[] = [];

  const existingBranch = ctx.store.get<StoredBranch>(
    branchKey(repoName, branchName),
  );
  if (existingBranch !== undefined) {
    const parentCommit = ctx.store.get<StoredCommit>(
      commitKey(repoName, existingBranch.commitId),
    );
    if (parentCommit !== undefined) {
      parentFiles = { ...getTree(ctx, repoName, parentCommit.treeId).files };
      parentCommitIds = [existingBranch.commitId];
    }
  }

  const specifiedParent = stringOrUndefined(input["parentCommitId"]);
  if (
    specifiedParent !== undefined &&
    existingBranch !== undefined &&
    existingBranch.commitId !== specifiedParent
  ) {
    throw awsError(
      "ParentCommitIdOutdatedException",
      "The specified parent commit is out of date.",
      400,
    );
  }

  const fileMode = stringOrUndefined(input["fileMode"]) ?? "NORMAL";
  const fileEntry = storeBlobAndEntry(
    ctx,
    repoName,
    filePath,
    rawContent,
    fileMode,
  );
  const newFiles: Record<string, StoredFileEntry> = {
    ...parentFiles,
    [filePath]: fileEntry,
  };

  const userInfo = defaultUserInfo(input);
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ?? `Put file: ${filePath}`,
    parentCommitIds,
    files: newFiles,
    author: userInfo,
    committer: userInfo,
  });

  updateBranchHead(ctx, repo, branchName, commit.commitId);

  return {
    blobId: fileEntry.blobId,
    commitId: commit.commitId,
    treeId: commit.treeId,
  };
};

const DeleteFile: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const branchName = requireString(input, "branchName");
  const filePath = requireString(input, "filePath");
  const parentCommitId = requireString(input, "parentCommitId");

  const repo = requireRepository(ctx, repoName);
  const branch = requireBranch(ctx, repoName, branchName);
  const parentCommit = requireCommit(ctx, repoName, branch.commitId);

  if (branch.commitId !== parentCommitId) {
    throw awsError(
      "ParentCommitIdOutdatedException",
      "The specified parent commit is out of date.",
      400,
    );
  }

  const parentTree = getTree(ctx, repoName, parentCommit.treeId);
  const fileEntry = parentTree.files[filePath];
  if (fileEntry === undefined) {
    throw awsError(
      "FileDoesNotExistException",
      `File does not exist: ${filePath}`,
      400,
    );
  }

  const newFiles = { ...parentTree.files };
  delete newFiles[filePath];

  const userInfo = defaultUserInfo(input);
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ?? `Delete file: ${filePath}`,
    parentCommitIds: [parentCommitId],
    files: newFiles,
    author: userInfo,
    committer: userInfo,
  });

  updateBranchHead(ctx, repo, branchName, commit.commitId);

  return {
    blobId: fileEntry.blobId,
    commitId: commit.commitId,
    treeId: commit.treeId,
    filePath,
  };
};

const CreateCommit: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const branchName = requireString(input, "branchName");

  const repo = requireRepository(ctx, repoName);

  let parentFiles: Record<string, StoredFileEntry> = {};
  let parentCommitIds: string[] = [];

  const existingBranch = ctx.store.get<StoredBranch>(
    branchKey(repoName, branchName),
  );
  if (existingBranch !== undefined) {
    const parentCommit = ctx.store.get<StoredCommit>(
      commitKey(repoName, existingBranch.commitId),
    );
    if (parentCommit !== undefined) {
      parentFiles = { ...getTree(ctx, repoName, parentCommit.treeId).files };
      parentCommitIds = [existingBranch.commitId];
    }
  }

  const newFiles = { ...parentFiles };

  const rawPutFiles = input["putFiles"];
  if (Array.isArray(rawPutFiles)) {
    for (const rawEntry of rawPutFiles) {
      const entry = rawEntry as Record<string, unknown>;
      const path = requireString(entry, "filePath");
      const fileContent = String(entry["fileContent"] ?? "");
      const fileMode = stringOrUndefined(entry["fileMode"]) ?? "NORMAL";
      newFiles[path] = storeBlobAndEntry(
        ctx,
        repoName,
        path,
        fileContent,
        fileMode,
      );
    }
  }

  const rawDeleteFiles = input["deleteFiles"];
  if (Array.isArray(rawDeleteFiles)) {
    for (const rawEntry of rawDeleteFiles) {
      const entry = rawEntry as Record<string, unknown>;
      const path = String(entry["filePath"] ?? "");
      if (path !== "") delete newFiles[path];
    }
  }

  const rawSetModes = input["setFileModes"];
  if (Array.isArray(rawSetModes)) {
    for (const rawEntry of rawSetModes) {
      const entry = rawEntry as Record<string, unknown>;
      const path = String(entry["filePath"] ?? "");
      const mode = String(entry["fileMode"] ?? "NORMAL");
      if (newFiles[path] !== undefined) {
        newFiles[path] = { ...newFiles[path], fileMode: mode };
      }
    }
  }

  const userInfo = authorUserInfo(input);
  const commit = makeCommit(ctx, repoName, {
    message: stringOrUndefined(input["commitMessage"]) ?? "Create commit",
    parentCommitIds,
    files: newFiles,
    author: userInfo,
    committer: userInfo,
  });

  updateBranchHead(ctx, repo, branchName, commit.commitId);

  const filesAdded = Array.isArray(rawPutFiles)
    ? (rawPutFiles as Record<string, unknown>[]).map((e) => ({
        absolutePath: String(e["filePath"] ?? ""),
        blobId: contentHash(
          `blob:${repoName}:${String(e["filePath"] ?? "")}:${String(e["fileContent"] ?? "")}`,
        ),
        fileMode: stringOrUndefined(e["fileMode"]) ?? "NORMAL",
      }))
    : [];

  const filesDeleted = Array.isArray(rawDeleteFiles)
    ? (rawDeleteFiles as Record<string, unknown>[]).map((e) => ({
        absolutePath: String(e["filePath"] ?? ""),
      }))
    : [];

  return {
    commitId: commit.commitId,
    treeId: commit.treeId,
    filesAdded,
    filesUpdated: [],
    filesDeleted,
  };
};

const GetDifferences: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const afterCommitSpecifier = requireString(input, "afterCommitSpecifier");
  requireRepository(ctx, repoName);

  const { files: afterFiles } = filesForRef(
    ctx,
    repoName,
    afterCommitSpecifier,
  );

  let beforeFiles: Record<string, StoredFileEntry> = {};
  const beforeCommitSpecifier = stringOrUndefined(
    input["beforeCommitSpecifier"],
  );
  if (beforeCommitSpecifier !== undefined) {
    beforeFiles = filesForRef(ctx, repoName, beforeCommitSpecifier).files;
  }

  const differences: Record<string, unknown>[] = [];
  const allPaths = new Set([
    ...Object.keys(beforeFiles),
    ...Object.keys(afterFiles),
  ]);

  for (const path of allPaths) {
    const before = beforeFiles[path];
    const after = afterFiles[path];
    if (before === undefined && after !== undefined) {
      differences.push({
        afterBlob: { blobId: after.blobId, path, mode: after.fileMode },
        changeType: "A",
      });
    } else if (before !== undefined && after === undefined) {
      differences.push({
        beforeBlob: { blobId: before.blobId, path, mode: before.fileMode },
        changeType: "D",
      });
    } else if (
      before !== undefined &&
      after !== undefined &&
      before.blobId !== after.blobId
    ) {
      differences.push({
        beforeBlob: { blobId: before.blobId, path, mode: before.fileMode },
        afterBlob: { blobId: after.blobId, path, mode: after.fileMode },
        changeType: "M",
      });
    }
  }

  return { differences, NextToken: undefined };
};

const ListFileCommitHistory: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const filePath = requireString(input, "filePath");
  requireRepository(ctx, repoName);

  const allCommits = ctx.store
    .list<StoredCommit>()
    .filter((entry) => entry.key.startsWith(`commit/${repoName}/`))
    .map((entry) => entry.value);

  const revisionDag: Record<string, unknown>[] = [];
  for (const commit of allCommits) {
    const tree = getTree(ctx, repoName, commit.treeId);
    const fileEntry = tree.files[filePath];
    if (fileEntry !== undefined) {
      revisionDag.push({
        commit: commitView(commit),
        blobId: fileEntry.blobId,
        path: filePath,
        revisionChildren: [],
      });
    }
  }

  return { revisionDag, nextToken: undefined };
};

const GetMergeCommit: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );
  requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);
  const baseRef = getMergeBase(ctx, repoName, srcRef, dstRef);

  return {
    sourceCommitId: srcRef,
    destinationCommitId: dstRef,
    baseCommitId: baseRef,
    mergedCommitId: dstRef,
  };
};

const GetMergeConflicts: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );
  requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);
  const baseRef = getMergeBase(ctx, repoName, srcRef, dstRef);

  return {
    mergeable: true,
    destinationCommitId: dstRef,
    sourceCommitId: srcRef,
    baseCommitId: baseRef,
    conflictMetadataList: [],
    nextToken: undefined,
  };
};

const GetMergeOptions: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );
  requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);
  const baseRef = getMergeBase(ctx, repoName, srcRef, dstRef);

  return {
    mergeOptions: [
      "FAST_FORWARD_MERGE",
      "SQUASH_MERGE",
      "THREE_WAY_MERGE",
    ] as const,
    sourceCommitId: srcRef,
    destinationCommitId: dstRef,
    baseCommitId: baseRef,
  };
};

const DescribeMergeConflicts: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );
  requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);
  const baseRef = getMergeBase(ctx, repoName, srcRef, dstRef);

  return {
    conflictMetadata: {
      filePath: stringOrUndefined(input["filePath"]) ?? "",
      fileSizes: { source: 0, destination: 0, base: 0 },
      fileModes: { source: "NORMAL", destination: "NORMAL", base: "NORMAL" },
      objectTypes: {
        source: "FILE",
        destination: "FILE",
        base: "FILE",
      },
      numberOfConflicts: 0,
      isBinaryFile: { source: false, destination: false, base: false },
      contentConflict: false,
      fileModeConflict: false,
      objectTypeConflict: false,
      mergeOperations: { source: "NONE", destination: "NONE" },
    },
    mergeHunks: [],
    destinationCommitId: dstRef,
    sourceCommitId: srcRef,
    baseCommitId: baseRef,
    nextToken: undefined,
  };
};

const BatchDescribeMergeConflicts: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );
  requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);
  const baseRef = getMergeBase(ctx, repoName, srcRef, dstRef);

  return {
    conflicts: [],
    destinationCommitId: dstRef,
    sourceCommitId: srcRef,
    baseCommitId: baseRef,
    errors: [],
    nextToken: undefined,
  };
};

const MergeBranchesByFastForward: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );

  const repo = requireRepository(ctx, repoName);
  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);
  void dstRef;

  const targetBranch =
    stringOrUndefined(input["targetBranch"]) ?? destinationCommitSpecifier;
  updateBranchHead(ctx, repo, targetBranch, srcRef);

  const commit = ctx.store.get<StoredCommit>(commitKey(repoName, srcRef));
  return {
    commitId: srcRef,
    treeId: commit?.treeId ?? contentHash(`${repoName}:${srcRef}`),
  };
};

const MergeBranchesBySquash: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );

  const repo = requireRepository(ctx, repoName);
  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);

  const srcFiles = filesForRef(ctx, repoName, srcRef).files;
  const dstFiles = filesForRef(ctx, repoName, dstRef).files;
  const mergedFiles = { ...dstFiles, ...srcFiles };

  const userInfo = authorUserInfo(input);
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ??
      `Squash merge ${sourceCommitSpecifier} into ${destinationCommitSpecifier}`,
    parentCommitIds: [dstRef],
    files: mergedFiles,
    author: userInfo,
    committer: userInfo,
  });

  const targetBranch =
    stringOrUndefined(input["targetBranch"]) ?? destinationCommitSpecifier;
  updateBranchHead(ctx, repo, targetBranch, commit.commitId);

  return { commitId: commit.commitId, treeId: commit.treeId };
};

const MergeBranchesByThreeWay: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );

  const repo = requireRepository(ctx, repoName);
  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);

  const srcFiles = filesForRef(ctx, repoName, srcRef).files;
  const dstFiles = filesForRef(ctx, repoName, dstRef).files;
  const mergedFiles = { ...dstFiles, ...srcFiles };

  const userInfo = authorUserInfo(input);
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ??
      `Merge ${sourceCommitSpecifier} into ${destinationCommitSpecifier}`,
    parentCommitIds: [dstRef, srcRef],
    files: mergedFiles,
    author: userInfo,
    committer: userInfo,
  });

  const targetBranch =
    stringOrUndefined(input["targetBranch"]) ?? destinationCommitSpecifier;
  updateBranchHead(ctx, repo, targetBranch, commit.commitId);

  return { commitId: commit.commitId, treeId: commit.treeId };
};

const CreateUnreferencedMergeCommit: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const sourceCommitSpecifier = requireString(input, "sourceCommitSpecifier");
  const destinationCommitSpecifier = requireString(
    input,
    "destinationCommitSpecifier",
  );
  requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, sourceCommitSpecifier);
  const dstRef = resolveRef(ctx, repoName, destinationCommitSpecifier);

  const srcFiles = filesForRef(ctx, repoName, srcRef).files;
  const dstFiles = filesForRef(ctx, repoName, dstRef).files;
  const mergedFiles = { ...dstFiles, ...srcFiles };

  const userInfo = systemUser();
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ?? "Unreferenced merge commit",
    parentCommitIds: [dstRef, srcRef],
    files: mergedFiles,
    author: userInfo,
    committer: userInfo,
  });

  return { commitId: commit.commitId, treeId: commit.treeId };
};

const PutRepositoryTriggers: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  requireRepository(ctx, repoName);
  const rawTriggers = input["triggers"];
  if (!Array.isArray(rawTriggers)) {
    throw awsError("InvalidTriggerException", "triggers is required.", 400);
  }
  const triggers: StoredTrigger[] = rawTriggers.map((rawTrigger) => {
    const t = rawTrigger as Record<string, unknown>;
    return {
      name: requireString(t, "name"),
      destinationArn: requireString(t, "destinationArn"),
      customData: stringOrUndefined(t["customData"]),
      branches: Array.isArray(t["branches"]) ? (t["branches"] as string[]) : [],
      events: Array.isArray(t["events"]) ? (t["events"] as string[]) : [],
    };
  });
  ctx.store.set(triggersKey(repoName), triggers);
  const configurationId = contentHash(
    `triggers:${repoName}:${JSON.stringify(triggers)}`,
  );
  return { configurationId };
};

const GetRepositoryTriggers: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  requireRepository(ctx, repoName);
  const triggers = ctx.store.get<StoredTrigger[]>(triggersKey(repoName)) ?? [];
  const configurationId = contentHash(
    `triggers:${repoName}:${JSON.stringify(triggers)}`,
  );
  return {
    configurationId,
    triggers: triggers.map((t) => ({
      name: t.name,
      destinationArn: t.destinationArn,
      customData: t.customData,
      branches: t.branches,
      events: t.events,
    })),
  };
};

const TestRepositoryTriggers: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  requireRepository(ctx, repoName);
  const rawTriggers = input["triggers"];
  if (!Array.isArray(rawTriggers)) {
    throw awsError("InvalidTriggerException", "triggers is required.", 400);
  }
  const successfulExecutions = (rawTriggers as Record<string, unknown>[]).map(
    (t) => String(t["name"] ?? ""),
  );
  return { successfulExecutions, failedExecutions: [] };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const rawTags = input["tags"];
  if (
    typeof rawTags !== "object" ||
    rawTags === null ||
    Array.isArray(rawTags)
  ) {
    throw awsError("InvalidTagsMapException", "tags is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const merged = { ...existing, ...(rawTags as Record<string, string>) };
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const rawKeys = input["tagKeys"];
  if (!Array.isArray(rawKeys)) {
    throw awsError("InvalidTagsMapException", "tagKeys is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const removal = new Set(rawKeys.filter((k) => typeof k === "string"));
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!removal.has(k)) filtered[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { tags, nextToken: undefined };
};

const UpdateDefaultBranch: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const defaultBranchName = requireString(input, "defaultBranchName");
  const repo = requireRepository(ctx, repoName);
  if (!repo.branches.includes(defaultBranchName)) {
    throw awsError(
      "BranchDoesNotExistException",
      `Branch does not exist: ${defaultBranchName}`,
      400,
    );
  }
  const updated: StoredRepository = {
    ...repo,
    defaultBranch: defaultBranchName,
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(repoName), updated);
  return {};
};

const UpdateRepositoryEncryptionKey: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const kmsKeyId = requireString(input, "kmsKeyId");
  const repo = requireRepository(ctx, repoName);
  const updated: StoredRepository = {
    ...repo,
    kmsKeyId,
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(repoName), updated);
  return {
    repositoryId: repo.repositoryId,
    kmsKeyId,
    originalKmsKeyId: repo.kmsKeyId ?? "alias/aws/codecommit",
  };
};

const UpdateRepositoryName: OperationHandler = (input, ctx) => {
  const oldName = requireString(input, "oldName");
  const newName = requireString(input, "newName");
  const repo = requireRepository(ctx, oldName);

  if (ctx.store.get<StoredRepository>(repositoryKey(newName)) !== undefined) {
    throw awsError(
      "RepositoryNameExistsException",
      `Repository already exists: ${newName}`,
      400,
    );
  }

  const newRepo: StoredRepository = {
    ...repo,
    repositoryName: newName,
    cloneUrlHttp: cloneUrlHttp(ctx, newName),
    cloneUrlSsh: cloneUrlSsh(ctx, newName),
    Arn: repositoryArn(ctx, newName),
    lastModifiedDate: Date.now(),
  };
  ctx.store.set(repositoryKey(newName), newRepo);
  ctx.store.delete(repositoryKey(oldName));

  const allEntries = ctx.store.list();
  const migratePrefixes = [
    {
      oldPrefix: `branch/${oldName}/`,
      newPrefix: `branch/${newName}/`,
      transform: (v: unknown) => ({
        ...(v as StoredBranch),
        repositoryName: newName,
      }),
    },
    {
      oldPrefix: `commit/${oldName}/`,
      newPrefix: `commit/${newName}/`,
      transform: (v: unknown) => v,
    },
    {
      oldPrefix: `tree/${oldName}/`,
      newPrefix: `tree/${newName}/`,
      transform: (v: unknown) => v,
    },
    {
      oldPrefix: `blob/${oldName}/`,
      newPrefix: `blob/${newName}/`,
      transform: (v: unknown) => v,
    },
  ];

  for (const entry of allEntries) {
    for (const { oldPrefix, newPrefix, transform } of migratePrefixes) {
      if (entry.key.startsWith(oldPrefix)) {
        const suffix = entry.key.slice(oldPrefix.length);
        ctx.store.set(`${newPrefix}${suffix}`, transform(entry.value));
        ctx.store.delete(entry.key);
        break;
      }
    }
    if (entry.key === triggersKey(oldName)) {
      ctx.store.set(triggersKey(newName), entry.value);
      ctx.store.delete(entry.key);
    }
  }

  const oldTags = ctx.store.get<Record<string, string>>(tagsKey(repo.Arn));
  if (oldTags !== undefined) {
    ctx.store.set(tagsKey(newRepo.Arn), oldTags);
    ctx.store.delete(tagsKey(repo.Arn));
  }

  return {};
};

const codecommit = {
  name: "codecommit",
  protocol: "json",
  operations: {
    CreateRepository,
    GetRepository,
    ListRepositories,
    DeleteRepository,
    UpdateRepositoryDescription,
    CreateBranch,
    ListBranches,
    BatchGetRepositories,
    GetBranch,
    DeleteBranch,
    GetCommit,
    BatchGetCommits,
    GetBlob,
    GetFile,
    GetFolder,
    PutFile,
    DeleteFile,
    CreateCommit,
    GetDifferences,
    ListFileCommitHistory,
    GetMergeCommit,
    GetMergeConflicts,
    GetMergeOptions,
    DescribeMergeConflicts,
    BatchDescribeMergeConflicts,
    MergeBranchesByFastForward,
    MergeBranchesBySquash,
    MergeBranchesByThreeWay,
    CreateUnreferencedMergeCommit,
    PutRepositoryTriggers,
    GetRepositoryTriggers,
    TestRepositoryTriggers,
    TagResource,
    UntagResource,
    ListTagsForResource,
    UpdateDefaultBranch,
    UpdateRepositoryEncryptionKey,
    UpdateRepositoryName,
  },
  model,
} as const satisfies ServiceDefinition;

export default codecommit;
