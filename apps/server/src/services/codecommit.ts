import { callerArn } from "../core/arn.ts";
import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/codecommit.json", { with: { type: "json" } }),
  { targetPrefix: "CodeCommit_20150413" },
);

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

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10) || 0
      : 0;
  const limit =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : typeof maxResults === "string" && maxResults !== ""
        ? parseInt(maxResults, 10) || items.length
        : items.length;
  const page = items.slice(offset, offset + limit);
  const next =
    offset + limit < items.length ? String(offset + limit) : undefined;
  return { page, nextToken: next };
};

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
  const { page, nextToken } = paginate(
    repositories,
    input["maxResults"],
    input["nextToken"],
  );
  return { repositories: page, nextToken };
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
  if (ctx.store.get<StoredBranch>(branchKey(name, branchName)) !== undefined) {
    throw awsError(
      "BranchNameExistsException",
      `Branch already exists: ${branchName}`,
      400,
    );
  }
  requireCommit(ctx, name, commitId);
  const updated: StoredRepository = {
    ...repository,
    branches: [...repository.branches, branchName],
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
  const sorted = [...repository.branches].sort();
  const { page, nextToken } = paginate(
    sorted,
    input["maxResults"],
    input["nextToken"],
  );
  return { branches: page, nextToken };
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

type ConflictEntry = {
  filePath: string;
  srcSize: number;
  dstSize: number;
  baseSize: number;
};

const computeConflicts = (
  ctx: ServiceContext,
  repoName: string,
  srcRef: string,
  dstRef: string,
  baseRef: string | undefined,
): ConflictEntry[] => {
  const srcFiles = filesForRef(ctx, repoName, srcRef).files;
  const dstFiles = filesForRef(ctx, repoName, dstRef).files;
  const baseFiles =
    baseRef !== undefined ? filesForRef(ctx, repoName, baseRef).files : {};
  const allPaths = new Set([
    ...Object.keys(srcFiles),
    ...Object.keys(dstFiles),
    ...Object.keys(baseFiles),
  ]);
  const conflicts: ConflictEntry[] = [];
  for (const path of allPaths) {
    const srcEntry = srcFiles[path];
    const dstEntry = dstFiles[path];
    const baseEntry = baseFiles[path];
    const srcChanged =
      (srcEntry?.blobId ?? null) !== (baseEntry?.blobId ?? null);
    const dstChanged =
      (dstEntry?.blobId ?? null) !== (baseEntry?.blobId ?? null);
    if (
      srcChanged &&
      dstChanged &&
      (srcEntry?.blobId ?? null) !== (dstEntry?.blobId ?? null)
    ) {
      conflicts.push({
        filePath: path,
        srcSize: srcEntry?.fileSize ?? 0,
        dstSize: dstEntry?.fileSize ?? 0,
        baseSize: baseEntry?.fileSize ?? 0,
      });
    }
  }
  return conflicts;
};

const conflictMetadataFor = (c: ConflictEntry): Record<string, unknown> => ({
  filePath: c.filePath,
  fileSizes: { source: c.srcSize, destination: c.dstSize, base: c.baseSize },
  fileModes: { source: "NORMAL", destination: "NORMAL", base: "NORMAL" },
  objectTypes: { source: "FILE", destination: "FILE", base: "FILE" },
  numberOfConflicts: 1,
  isBinaryFile: { source: false, destination: false, base: false },
  contentConflict: true,
  fileModeConflict: false,
  objectTypeConflict: false,
  mergeOperations: { source: "EDITED", destination: "EDITED" },
});

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

  const conflicts = computeConflicts(ctx, repoName, srcRef, dstRef, baseRef);
  return {
    mergeable: conflicts.length === 0,
    destinationCommitId: dstRef,
    sourceCommitId: srcRef,
    baseCommitId: baseRef,
    conflictMetadataList: conflicts.map(conflictMetadataFor),
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

  const filePath = stringOrUndefined(input["filePath"]) ?? "";
  const conflicts = computeConflicts(ctx, repoName, srcRef, dstRef, baseRef);
  const match = conflicts.find((c) => c.filePath === filePath);

  return {
    conflictMetadata:
      match !== undefined
        ? conflictMetadataFor(match)
        : {
            filePath,
            fileSizes: { source: 0, destination: 0, base: 0 },
            fileModes: {
              source: "NORMAL",
              destination: "NORMAL",
              base: "NORMAL",
            },
            objectTypes: { source: "FILE", destination: "FILE", base: "FILE" },
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

  const allConflicts = computeConflicts(ctx, repoName, srcRef, dstRef, baseRef);
  const conflicts = allConflicts.map((c) => ({
    filePath: c.filePath,
    conflictMetadata: conflictMetadataFor(c),
    mergeHunks: [],
  }));

  return {
    conflicts,
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
  const allTags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const entries = Object.entries(allTags);
  const { page, nextToken } = paginate(
    entries,
    input["maxResults"],
    input["nextToken"],
  );
  return { tags: Object.fromEntries(page), nextToken };
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

type StoredApprovalRuleTemplate = {
  approvalRuleTemplateId: string;
  approvalRuleTemplateName: string;
  approvalRuleTemplateDescription: string | undefined;
  approvalRuleTemplateContent: string;
  ruleContentSha256: string;
  lastModifiedDate: string;
  creationDate: string;
  lastModifiedUser: string;
};

type StoredPullRequest = {
  pullRequestId: string;
  title: string;
  description: string | undefined;
  repositoryName: string;
  sourceReference: string;
  destinationReference: string;
  sourceCommit: string;
  destinationCommit: string;
  mergeBase: string | undefined;
  pullRequestStatus: "OPEN" | "CLOSED";
  authorArn: string;
  creationDate: string;
  lastActivityDate: string;
  clientRequestToken: string | undefined;
  revisionId: string;
  isMerged: boolean;
  mergedBy: string | undefined;
  mergeCommitId: string | undefined;
  mergeOption: string | undefined;
};

type StoredPullRequestApprovalRule = {
  approvalRuleId: string;
  approvalRuleName: string;
  approvalRuleContent: string;
  ruleContentSha256: string;
  creationDate: string;
  lastModifiedDate: string;
  lastModifiedUser: string;
  originatesFrom: string;
};

type StoredComment = {
  commentId: string;
  content: string;
  inReplyTo: string | undefined;
  creationDate: string;
  lastModifiedDate: string;
  authorArn: string;
  deleted: boolean;
  clientRequestToken: string | undefined;
  callerReactions: string[];
  reactions: Record<string, string[]>;
  repositoryName: string | undefined;
  pullRequestId: string | undefined;
  beforeCommitId: string | undefined;
  afterCommitId: string | undefined;
  beforeBlobId: string | undefined;
  afterBlobId: string | undefined;
  filePath: string | undefined;
  filePosition: number | undefined;
  relativeFileVersion: string | undefined;
};

const approvalRuleTemplateKey = (name: string): string => `art/${name}`;
const pullRequestKey = (id: string): string => `pr/${id}`;
const prApprovalRuleKey = (prId: string, ruleName: string): string =>
  `prRule/${prId}/${ruleName}`;
const artAssociationsKey = (templateName: string): string =>
  `artAssoc/${templateName}`;
const commentKey = (id: string): string => `comment/${id}`;
const prApprovalKey = (prId: string, userArn: string): string =>
  `prApproval/${prId}/${userArn}`;
const prOverrideKey = (prId: string): string => `prOverride/${prId}`;

const nextPullRequestId = (ctx: ServiceContext): string => {
  const current = ctx.store.get<number>("counter/pullRequest") ?? 0;
  const next = current + 1;
  ctx.store.set("counter/pullRequest", next);
  return String(next);
};

const stripRefsHeads = (ref: string): string =>
  ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;

const requireApprovalRuleTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredApprovalRuleTemplate => {
  const template = ctx.store.get<StoredApprovalRuleTemplate>(
    approvalRuleTemplateKey(name),
  );
  if (template === undefined) {
    throw awsError(
      "ApprovalRuleTemplateDoesNotExistException",
      `The specified approval rule template does not exist: ${name}`,
      400,
    );
  }
  return template;
};

const requirePullRequest = (
  ctx: ServiceContext,
  id: string,
): StoredPullRequest => {
  const pr = ctx.store.get<StoredPullRequest>(pullRequestKey(id));
  if (pr === undefined) {
    throw awsError(
      "PullRequestDoesNotExistException",
      `The specified pull request does not exist: ${id}`,
      400,
    );
  }
  return pr;
};

const requireComment = (
  ctx: ServiceContext,
  commentId: string,
): StoredComment => {
  const comment = ctx.store.get<StoredComment>(commentKey(commentId));
  if (comment === undefined) {
    throw awsError(
      "CommentDoesNotExistException",
      `The specified comment does not exist: ${commentId}`,
      400,
    );
  }
  return comment;
};

const approvalRuleTemplateView = (
  template: StoredApprovalRuleTemplate,
): Record<string, unknown> => ({
  approvalRuleTemplateId: template.approvalRuleTemplateId,
  approvalRuleTemplateName: template.approvalRuleTemplateName,
  approvalRuleTemplateDescription: template.approvalRuleTemplateDescription,
  approvalRuleTemplateContent: template.approvalRuleTemplateContent,
  ruleContentSha256: template.ruleContentSha256,
  lastModifiedDate: template.lastModifiedDate,
  creationDate: template.creationDate,
  lastModifiedUser: template.lastModifiedUser,
});

const listPrApprovalRules = (
  ctx: ServiceContext,
  prId: string,
): StoredPullRequestApprovalRule[] =>
  ctx.store
    .list<StoredPullRequestApprovalRule>()
    .filter((entry) => entry.key.startsWith(`prRule/${prId}/`))
    .map((entry) => entry.value);

const pullRequestView = (
  pr: StoredPullRequest,
  approvalRules: StoredPullRequestApprovalRule[],
): Record<string, unknown> => ({
  pullRequestId: pr.pullRequestId,
  title: pr.title,
  description: pr.description,
  lastActivityDate: pr.lastActivityDate,
  creationDate: pr.creationDate,
  pullRequestStatus: pr.pullRequestStatus,
  authorArn: pr.authorArn,
  clientRequestToken: pr.clientRequestToken,
  revisionId: pr.revisionId,
  pullRequestTargets: [
    {
      repositoryName: pr.repositoryName,
      sourceReference: pr.sourceReference,
      destinationReference: pr.destinationReference,
      destinationCommit: pr.destinationCommit,
      sourceCommit: pr.sourceCommit,
      mergeBase: pr.mergeBase,
      mergeMetadata: {
        isMerged: pr.isMerged,
        mergedBy: pr.mergedBy,
        mergeCommitId: pr.mergeCommitId,
        mergeOption: pr.mergeOption,
      },
    },
  ],
  approvalRules: approvalRules.map((rule) => ({
    approvalRuleId: rule.approvalRuleId,
    approvalRuleName: rule.approvalRuleName,
    approvalRuleContent: rule.approvalRuleContent,
    ruleContentSha256: rule.ruleContentSha256,
    creationDate: rule.creationDate,
    lastModifiedDate: rule.lastModifiedDate,
    lastModifiedUser: rule.lastModifiedUser,
    originatesFrom: rule.originatesFrom,
  })),
});

const commentView = (comment: StoredComment): Record<string, unknown> => ({
  commentId: comment.commentId,
  content: comment.deleted ? "" : comment.content,
  inReplyTo: comment.inReplyTo,
  creationDate: comment.creationDate,
  lastModifiedDate: comment.lastModifiedDate,
  authorArn: comment.authorArn,
  deleted: comment.deleted,
  clientRequestToken: comment.clientRequestToken,
  callerReactions: comment.callerReactions,
  reactionCounts: Object.fromEntries(
    Object.entries(comment.reactions).map(([emoji, users]) => [
      emoji,
      users.length,
    ]),
  ),
});

const buildComment = (
  ctx: ServiceContext,
  params: {
    content: string;
    inReplyTo: string | undefined;
    clientRequestToken: string | undefined;
    repositoryName: string | undefined;
    pullRequestId: string | undefined;
    beforeCommitId: string | undefined;
    afterCommitId: string | undefined;
    beforeBlobId: string | undefined;
    afterBlobId: string | undefined;
    filePath: string | undefined;
    filePosition: number | undefined;
    relativeFileVersion: string | undefined;
  },
): StoredComment => {
  const now = nowIso();
  const comment: StoredComment = {
    commentId: crypto.randomUUID().replace(/-/g, ""),
    content: params.content,
    inReplyTo: params.inReplyTo,
    creationDate: now,
    lastModifiedDate: now,
    authorArn: callerArn(ctx.account),
    deleted: false,
    clientRequestToken: params.clientRequestToken,
    callerReactions: [],
    reactions: {},
    repositoryName: params.repositoryName,
    pullRequestId: params.pullRequestId,
    beforeCommitId: params.beforeCommitId,
    afterCommitId: params.afterCommitId,
    beforeBlobId: params.beforeBlobId,
    afterBlobId: params.afterBlobId,
    filePath: params.filePath,
    filePosition: params.filePosition,
    relativeFileVersion: params.relativeFileVersion,
  };
  ctx.store.set(commentKey(comment.commentId), comment);
  return comment;
};

const prApprovalRuleView = (
  rule: StoredPullRequestApprovalRule,
): Record<string, unknown> => ({
  approvalRuleId: rule.approvalRuleId,
  approvalRuleName: rule.approvalRuleName,
  approvalRuleContent: rule.approvalRuleContent,
  ruleContentSha256: rule.ruleContentSha256,
  creationDate: rule.creationDate,
  lastModifiedDate: rule.lastModifiedDate,
  lastModifiedUser: rule.lastModifiedUser,
  originatesFrom: rule.originatesFrom,
});

const CreateApprovalRuleTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "approvalRuleTemplateName");
  if (
    ctx.store.get<StoredApprovalRuleTemplate>(approvalRuleTemplateKey(name)) !==
    undefined
  ) {
    throw awsError(
      "ApprovalRuleTemplateNameAlreadyExistsException",
      `An approval rule template with that name already exists: ${name}`,
      400,
    );
  }
  const content = requireString(input, "approvalRuleTemplateContent");
  const now = nowIso();
  const template: StoredApprovalRuleTemplate = {
    approvalRuleTemplateId: crypto.randomUUID(),
    approvalRuleTemplateName: name,
    approvalRuleTemplateDescription: stringOrUndefined(
      input["approvalRuleTemplateDescription"],
    ),
    approvalRuleTemplateContent: content,
    ruleContentSha256: contentHash(content),
    lastModifiedDate: now,
    creationDate: now,
    lastModifiedUser: callerArn(ctx.account),
  };
  ctx.store.set(approvalRuleTemplateKey(name), template);
  return { approvalRuleTemplate: approvalRuleTemplateView(template) };
};

const GetApprovalRuleTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "approvalRuleTemplateName");
  const template = requireApprovalRuleTemplate(ctx, name);
  return { approvalRuleTemplate: approvalRuleTemplateView(template) };
};

const DeleteApprovalRuleTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "approvalRuleTemplateName");
  const template = requireApprovalRuleTemplate(ctx, name);
  ctx.store.delete(approvalRuleTemplateKey(name));
  return { approvalRuleTemplateId: template.approvalRuleTemplateId };
};

const UpdateApprovalRuleTemplateContent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "approvalRuleTemplateName");
  const template = requireApprovalRuleTemplate(ctx, name);
  const newContent = requireString(input, "newRuleContent");
  const updated: StoredApprovalRuleTemplate = {
    ...template,
    approvalRuleTemplateContent: newContent,
    ruleContentSha256: contentHash(newContent),
    lastModifiedDate: nowIso(),
  };
  ctx.store.set(approvalRuleTemplateKey(name), updated);
  return { approvalRuleTemplate: approvalRuleTemplateView(updated) };
};

const UpdateApprovalRuleTemplateDescription: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "approvalRuleTemplateName");
  const template = requireApprovalRuleTemplate(ctx, name);
  const updated: StoredApprovalRuleTemplate = {
    ...template,
    approvalRuleTemplateDescription: stringOrUndefined(
      input["approvalRuleTemplateDescription"],
    ),
    lastModifiedDate: nowIso(),
  };
  ctx.store.set(approvalRuleTemplateKey(name), updated);
  return { approvalRuleTemplate: approvalRuleTemplateView(updated) };
};

const UpdateApprovalRuleTemplateName: OperationHandler = (input, ctx) => {
  const oldName = requireString(input, "oldApprovalRuleTemplateName");
  const newName = requireString(input, "newApprovalRuleTemplateName");
  const template = requireApprovalRuleTemplate(ctx, oldName);
  if (
    ctx.store.get<StoredApprovalRuleTemplate>(
      approvalRuleTemplateKey(newName),
    ) !== undefined
  ) {
    throw awsError(
      "ApprovalRuleTemplateNameAlreadyExistsException",
      `An approval rule template with that name already exists: ${newName}`,
      400,
    );
  }
  const updated: StoredApprovalRuleTemplate = {
    ...template,
    approvalRuleTemplateName: newName,
    lastModifiedDate: nowIso(),
  };
  ctx.store.set(approvalRuleTemplateKey(newName), updated);
  ctx.store.delete(approvalRuleTemplateKey(oldName));
  const associations =
    ctx.store.get<string[]>(artAssociationsKey(oldName)) ?? [];
  if (associations.length > 0) {
    ctx.store.set(artAssociationsKey(newName), associations);
    ctx.store.delete(artAssociationsKey(oldName));
  }
  return { approvalRuleTemplate: approvalRuleTemplateView(updated) };
};

const ListApprovalRuleTemplates: OperationHandler = (input, ctx) => {
  const templateNames = ctx.store
    .list<StoredApprovalRuleTemplate>()
    .filter((entry) => entry.key.startsWith("art/"))
    .map((entry) => entry.value.approvalRuleTemplateName);
  const { page, nextToken } = paginate(
    templateNames,
    input["maxResults"],
    input["nextToken"],
  );
  return { approvalRuleTemplateNames: page, nextToken };
};

const AssociateApprovalRuleTemplateWithRepository: OperationHandler = (
  input,
  ctx,
) => {
  const templateName = requireString(input, "approvalRuleTemplateName");
  const repoName = requireString(input, "repositoryName");
  requireApprovalRuleTemplate(ctx, templateName);
  requireRepository(ctx, repoName);
  const current =
    ctx.store.get<string[]>(artAssociationsKey(templateName)) ?? [];
  if (!current.includes(repoName)) {
    ctx.store.set(artAssociationsKey(templateName), [...current, repoName]);
  }
  return {};
};

const BatchAssociateApprovalRuleTemplateWithRepositories: OperationHandler = (
  input,
  ctx,
) => {
  const templateName = requireString(input, "approvalRuleTemplateName");
  requireApprovalRuleTemplate(ctx, templateName);
  const rawRepos = input["repositoryNames"];
  if (!Array.isArray(rawRepos)) {
    throw awsError(
      "InvalidRepositoryNameException",
      "repositoryNames is required.",
      400,
    );
  }
  const associatedRepositoryNames: string[] = [];
  const errors: Record<string, unknown>[] = [];
  const current =
    ctx.store.get<string[]>(artAssociationsKey(templateName)) ?? [];
  const updated = [...current];
  for (const rawName of rawRepos) {
    const name = String(rawName);
    const repo = ctx.store.get<StoredRepository>(repositoryKey(name));
    if (repo === undefined) {
      errors.push({
        repositoryName: name,
        errorCode: "RepositoryDoesNotExistException",
        errorMessage: `Repository does not exist: ${name}`,
      });
    } else {
      if (!updated.includes(name)) updated.push(name);
      associatedRepositoryNames.push(name);
    }
  }
  ctx.store.set(artAssociationsKey(templateName), updated);
  return { associatedRepositoryNames, errors };
};

const DisassociateApprovalRuleTemplateFromRepository: OperationHandler = (
  input,
  ctx,
) => {
  const templateName = requireString(input, "approvalRuleTemplateName");
  const repoName = requireString(input, "repositoryName");
  requireApprovalRuleTemplate(ctx, templateName);
  requireRepository(ctx, repoName);
  const current =
    ctx.store.get<string[]>(artAssociationsKey(templateName)) ?? [];
  ctx.store.set(
    artAssociationsKey(templateName),
    current.filter((r) => r !== repoName),
  );
  return {};
};

const BatchDisassociateApprovalRuleTemplateFromRepositories: OperationHandler =
  (input, ctx) => {
    const templateName = requireString(input, "approvalRuleTemplateName");
    requireApprovalRuleTemplate(ctx, templateName);
    const rawRepos = input["repositoryNames"];
    if (!Array.isArray(rawRepos)) {
      throw awsError(
        "InvalidRepositoryNameException",
        "repositoryNames is required.",
        400,
      );
    }
    const disassociatedRepositoryNames: string[] = [];
    const errors: Record<string, unknown>[] = [];
    const current =
      ctx.store.get<string[]>(artAssociationsKey(templateName)) ?? [];
    const toRemove = new Set<string>();
    for (const rawName of rawRepos) {
      const name = String(rawName);
      const repo = ctx.store.get<StoredRepository>(repositoryKey(name));
      if (repo === undefined) {
        errors.push({
          repositoryName: name,
          errorCode: "RepositoryDoesNotExistException",
          errorMessage: `Repository does not exist: ${name}`,
        });
      } else {
        toRemove.add(name);
        disassociatedRepositoryNames.push(name);
      }
    }
    ctx.store.set(
      artAssociationsKey(templateName),
      current.filter((r) => !toRemove.has(r)),
    );
    return { disassociatedRepositoryNames, errors };
  };

const ListAssociatedApprovalRuleTemplatesForRepository: OperationHandler = (
  input,
  ctx,
) => {
  const repoName = requireString(input, "repositoryName");
  requireRepository(ctx, repoName);
  const approvalRuleTemplateNames = ctx.store
    .list<string[]>()
    .filter((entry) => entry.key.startsWith("artAssoc/"))
    .filter((entry) => entry.value.includes(repoName))
    .map((entry) => entry.key.slice("artAssoc/".length));
  return { approvalRuleTemplateNames, nextToken: undefined };
};

const ListRepositoriesForApprovalRuleTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const templateName = requireString(input, "approvalRuleTemplateName");
  requireApprovalRuleTemplate(ctx, templateName);
  const repositoryNames =
    ctx.store.get<string[]>(artAssociationsKey(templateName)) ?? [];
  return { repositoryNames, nextToken: undefined };
};

const CreatePullRequest: OperationHandler = (input, ctx) => {
  const title = requireString(input, "title");
  const rawTargets = input["targets"];
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    throw awsError("InvalidTargetsException", "targets is required.", 400);
  }
  const target = rawTargets[0] as Record<string, unknown>;
  const repoName = requireString(target, "repositoryName");
  const sourceReference = requireString(target, "sourceReference");
  const destinationReference =
    stringOrUndefined(target["destinationReference"]) ?? "main";

  requireRepository(ctx, repoName);

  const sourceCommit = resolveRef(
    ctx,
    repoName,
    stripRefsHeads(sourceReference),
  );
  requireCommit(ctx, repoName, sourceCommit);
  const destinationCommit = resolveRef(
    ctx,
    repoName,
    stripRefsHeads(destinationReference),
  );
  requireCommit(ctx, repoName, destinationCommit);
  const mergeBase = getMergeBase(
    ctx,
    repoName,
    sourceCommit,
    destinationCommit,
  );

  const now = nowIso();
  const pr: StoredPullRequest = {
    pullRequestId: nextPullRequestId(ctx),
    title,
    description: stringOrUndefined(input["description"]),
    repositoryName: repoName,
    sourceReference,
    destinationReference,
    sourceCommit,
    destinationCommit,
    mergeBase,
    pullRequestStatus: "OPEN",
    authorArn: callerArn(ctx.account),
    creationDate: now,
    lastActivityDate: now,
    clientRequestToken: stringOrUndefined(input["clientRequestToken"]),
    revisionId: crypto.randomUUID().replace(/-/g, ""),
    isMerged: false,
    mergedBy: undefined,
    mergeCommitId: undefined,
    mergeOption: undefined,
  };
  ctx.store.set(pullRequestKey(pr.pullRequestId), pr);
  return { pullRequest: pullRequestView(pr, []) };
};

const GetPullRequest: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const pr = requirePullRequest(ctx, prId);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(pr, rules) };
};

const ListPullRequests: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  requireRepository(ctx, repoName);
  const statusFilter = stringOrUndefined(input["pullRequestStatus"]);
  const all = ctx.store
    .list<StoredPullRequest>()
    .filter((entry) => entry.key.startsWith("pr/"))
    .map((entry) => entry.value)
    .filter((pr) => pr.repositoryName === repoName)
    .filter(
      (pr) =>
        statusFilter === undefined || pr.pullRequestStatus === statusFilter,
    )
    .map((pr) => pr.pullRequestId);
  const { page, nextToken } = paginate(
    all,
    input["maxResults"],
    input["nextToken"],
  );
  return { pullRequestIds: page, nextToken };
};

const UpdatePullRequestDescription: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const pr = requirePullRequest(ctx, prId);
  const updated: StoredPullRequest = {
    ...pr,
    description: stringOrUndefined(input["description"]),
    lastActivityDate: nowIso(),
  };
  ctx.store.set(pullRequestKey(prId), updated);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(updated, rules) };
};

const UpdatePullRequestStatus: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const pr = requirePullRequest(ctx, prId);
  const newStatus = requireString(input, "pullRequestStatus");
  if (newStatus !== "OPEN" && newStatus !== "CLOSED") {
    throw awsError(
      "InvalidPullRequestStatusException",
      `Invalid pull request status: ${newStatus}`,
      400,
    );
  }
  const updated: StoredPullRequest = {
    ...pr,
    pullRequestStatus: newStatus as "OPEN" | "CLOSED",
    lastActivityDate: nowIso(),
  };
  ctx.store.set(pullRequestKey(prId), updated);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(updated, rules) };
};

const UpdatePullRequestTitle: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const pr = requirePullRequest(ctx, prId);
  const title = requireString(input, "title");
  const updated: StoredPullRequest = {
    ...pr,
    title,
    lastActivityDate: nowIso(),
  };
  ctx.store.set(pullRequestKey(prId), updated);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(updated, rules) };
};

const MergePullRequestByFastForward: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const repoName = requireString(input, "repositoryName");
  const pr = requirePullRequest(ctx, prId);
  if (pr.pullRequestStatus !== "OPEN") {
    throw awsError(
      "PullRequestAlreadyMergedException",
      "The pull request has already been merged.",
      400,
    );
  }
  const repo = requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, stripRefsHeads(pr.sourceReference));
  const dstBranch = stripRefsHeads(pr.destinationReference);
  updateBranchHead(ctx, repo, dstBranch, srcRef);

  const now = nowIso();
  const updated: StoredPullRequest = {
    ...pr,
    pullRequestStatus: "CLOSED",
    isMerged: true,
    mergedBy: callerArn(ctx.account),
    mergeCommitId: srcRef,
    mergeOption: "FAST_FORWARD_MERGE",
    lastActivityDate: now,
  };
  ctx.store.set(pullRequestKey(prId), updated);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(updated, rules) };
};

const MergePullRequestBySquash: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const repoName = requireString(input, "repositoryName");
  const pr = requirePullRequest(ctx, prId);
  if (pr.pullRequestStatus !== "OPEN") {
    throw awsError(
      "PullRequestAlreadyMergedException",
      "The pull request has already been merged.",
      400,
    );
  }
  const repo = requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, stripRefsHeads(pr.sourceReference));
  const dstRef = resolveRef(
    ctx,
    repoName,
    stripRefsHeads(pr.destinationReference),
  );
  const srcFiles = filesForRef(ctx, repoName, srcRef).files;
  const dstFiles = filesForRef(ctx, repoName, dstRef).files;
  const mergedFiles = { ...dstFiles, ...srcFiles };

  const userInfo = systemUser();
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ?? `Squash merge: ${pr.title}`,
    parentCommitIds: [dstRef],
    files: mergedFiles,
    author: userInfo,
    committer: userInfo,
  });

  const dstBranch = stripRefsHeads(pr.destinationReference);
  updateBranchHead(ctx, repo, dstBranch, commit.commitId);

  const now = nowIso();
  const updated: StoredPullRequest = {
    ...pr,
    pullRequestStatus: "CLOSED",
    isMerged: true,
    mergedBy: callerArn(ctx.account),
    mergeCommitId: commit.commitId,
    mergeOption: "SQUASH_MERGE",
    lastActivityDate: now,
  };
  ctx.store.set(pullRequestKey(prId), updated);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(updated, rules) };
};

const MergePullRequestByThreeWay: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const repoName = requireString(input, "repositoryName");
  const pr = requirePullRequest(ctx, prId);
  if (pr.pullRequestStatus !== "OPEN") {
    throw awsError(
      "PullRequestAlreadyMergedException",
      "The pull request has already been merged.",
      400,
    );
  }
  const repo = requireRepository(ctx, repoName);

  const srcRef = resolveRef(ctx, repoName, stripRefsHeads(pr.sourceReference));
  const dstRef = resolveRef(
    ctx,
    repoName,
    stripRefsHeads(pr.destinationReference),
  );
  const srcFiles = filesForRef(ctx, repoName, srcRef).files;
  const dstFiles = filesForRef(ctx, repoName, dstRef).files;
  const mergedFiles = { ...dstFiles, ...srcFiles };

  const userInfo = systemUser();
  const commit = makeCommit(ctx, repoName, {
    message:
      stringOrUndefined(input["commitMessage"]) ??
      `Merge pull request: ${pr.title}`,
    parentCommitIds: [dstRef, srcRef],
    files: mergedFiles,
    author: userInfo,
    committer: userInfo,
  });

  const dstBranch = stripRefsHeads(pr.destinationReference);
  updateBranchHead(ctx, repo, dstBranch, commit.commitId);

  const now = nowIso();
  const updated: StoredPullRequest = {
    ...pr,
    pullRequestStatus: "CLOSED",
    isMerged: true,
    mergedBy: callerArn(ctx.account),
    mergeCommitId: commit.commitId,
    mergeOption: "THREE_WAY_MERGE",
    lastActivityDate: now,
  };
  ctx.store.set(pullRequestKey(prId), updated);
  const rules = listPrApprovalRules(ctx, prId);
  return { pullRequest: pullRequestView(updated, rules) };
};

const CreatePullRequestApprovalRule: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requirePullRequest(ctx, prId);
  const ruleName = requireString(input, "approvalRuleName");
  const ruleContent = requireString(input, "approvalRuleContent");
  const now = nowIso();
  const rule: StoredPullRequestApprovalRule = {
    approvalRuleId: crypto.randomUUID(),
    approvalRuleName: ruleName,
    approvalRuleContent: ruleContent,
    ruleContentSha256: contentHash(ruleContent),
    creationDate: now,
    lastModifiedDate: now,
    lastModifiedUser: callerArn(ctx.account),
    originatesFrom: "TEMPLATE_ASSOCIATION",
  };
  ctx.store.set(prApprovalRuleKey(prId, ruleName), rule);
  return { approvalRule: prApprovalRuleView(rule) };
};

const DeletePullRequestApprovalRule: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requirePullRequest(ctx, prId);
  const ruleName = requireString(input, "approvalRuleName");
  const rule = ctx.store.get<StoredPullRequestApprovalRule>(
    prApprovalRuleKey(prId, ruleName),
  );
  ctx.store.delete(prApprovalRuleKey(prId, ruleName));
  return { approvalRuleId: rule?.approvalRuleId ?? "" };
};

const UpdatePullRequestApprovalRuleContent: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requirePullRequest(ctx, prId);
  const ruleName = requireString(input, "approvalRuleName");
  const existing = ctx.store.get<StoredPullRequestApprovalRule>(
    prApprovalRuleKey(prId, ruleName),
  );
  if (existing === undefined) {
    throw awsError(
      "ApprovalRuleDoesNotExistException",
      `The specified approval rule does not exist: ${ruleName}`,
      400,
    );
  }
  const newContent = requireString(input, "newRuleContent");
  const updated: StoredPullRequestApprovalRule = {
    ...existing,
    approvalRuleContent: newContent,
    ruleContentSha256: contentHash(newContent),
    lastModifiedDate: nowIso(),
  };
  ctx.store.set(prApprovalRuleKey(prId, ruleName), updated);
  return { approvalRule: prApprovalRuleView(updated) };
};

const GetPullRequestApprovalStates: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requireString(input, "revisionId");
  requirePullRequest(ctx, prId);
  const approvals = ctx.store
    .list<{ userArn: string; approvalState: string }>()
    .filter((entry) => entry.key.startsWith(`prApproval/${prId}/`))
    .map((entry) => ({
      userArn: entry.value.userArn,
      approvalState: entry.value.approvalState,
    }));
  return { approvals };
};

const UpdatePullRequestApprovalState: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requireString(input, "revisionId");
  const approvalState = requireString(input, "approvalState");
  requirePullRequest(ctx, prId);
  const userArn = callerArn(ctx.account);
  ctx.store.set(prApprovalKey(prId, userArn), { userArn, approvalState });
  return {};
};

const GetPullRequestOverrideState: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requireString(input, "revisionId");
  requirePullRequest(ctx, prId);
  const override = ctx.store.get<{
    overridden: boolean;
    overrider: string;
  }>(prOverrideKey(prId));
  return {
    overridden: override?.overridden ?? false,
    overrider: override?.overrider ?? "",
  };
};

const OverridePullRequestApprovalRules: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requireString(input, "revisionId");
  const overrideStatus = requireString(input, "overrideStatus");
  requirePullRequest(ctx, prId);
  ctx.store.set(prOverrideKey(prId), {
    overridden: overrideStatus === "OVERRIDE",
    overrider: callerArn(ctx.account),
  });
  return {};
};

const EvaluatePullRequestApprovalRules: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requireString(input, "revisionId");
  requirePullRequest(ctx, prId);
  const rules = listPrApprovalRules(ctx, prId);
  const override = ctx.store.get<{ overridden: boolean }>(prOverrideKey(prId));
  const approved = override?.overridden === true || rules.length === 0;
  return {
    evaluation: {
      approved,
      overridden: override?.overridden ?? false,
      approvalRulesSatisfied: approved
        ? rules.map((r) => r.approvalRuleName)
        : [],
      approvalRulesNotSatisfied: approved
        ? []
        : rules.map((r) => r.approvalRuleName),
    },
  };
};

const DescribePullRequestEvents: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const pr = requirePullRequest(ctx, prId);
  const events: Record<string, unknown>[] = [
    {
      pullRequestId: prId,
      eventDate: pr.creationDate,
      pullRequestEventType: "PULL_REQUEST_CREATED",
      actorArn: pr.authorArn,
      pullRequestCreatedEventMetadata: {
        repositoryName: pr.repositoryName,
        sourceCommitId: pr.sourceCommit,
        destinationCommitId: pr.destinationCommit,
        mergeBase: pr.mergeBase,
      },
    },
  ];
  if (pr.isMerged) {
    events.push({
      pullRequestId: prId,
      eventDate: pr.lastActivityDate,
      pullRequestEventType: "PULL_REQUEST_MERGE_STATE_CHANGED",
      actorArn: pr.mergedBy ?? pr.authorArn,
      pullRequestMergedStateChangedEventMetadata: {
        repositoryName: pr.repositoryName,
        destinationReference: pr.destinationReference,
        mergeMetadata: {
          isMerged: true,
          mergedBy: pr.mergedBy,
          mergeCommitId: pr.mergeCommitId,
          mergeOption: pr.mergeOption,
        },
      },
    });
  }
  return { pullRequestEvents: events, nextToken: undefined };
};

const PostCommentForPullRequest: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  const repoName = requireString(input, "repositoryName");
  const beforeCommitId = requireString(input, "beforeCommitId");
  const afterCommitId = requireString(input, "afterCommitId");
  const content = requireString(input, "content");
  requirePullRequest(ctx, prId);
  requireRepository(ctx, repoName);

  const rawLocation = input["location"] as Record<string, unknown> | undefined;
  const filePath =
    rawLocation !== undefined
      ? stringOrUndefined(rawLocation["filePath"])
      : undefined;
  const filePosition =
    rawLocation !== undefined && typeof rawLocation["filePosition"] === "number"
      ? rawLocation["filePosition"]
      : undefined;
  const relativeFileVersion =
    rawLocation !== undefined
      ? stringOrUndefined(rawLocation["relativeFileVersion"])
      : undefined;

  const beforeBlobId =
    filePath !== undefined
      ? filesForRef(ctx, repoName, beforeCommitId).files[filePath]?.blobId
      : undefined;
  const afterBlobId =
    filePath !== undefined
      ? filesForRef(ctx, repoName, afterCommitId).files[filePath]?.blobId
      : undefined;

  const comment = buildComment(ctx, {
    content,
    inReplyTo: undefined,
    clientRequestToken: stringOrUndefined(input["clientRequestToken"]),
    repositoryName: repoName,
    pullRequestId: prId,
    beforeCommitId,
    afterCommitId,
    beforeBlobId,
    afterBlobId,
    filePath,
    filePosition,
    relativeFileVersion,
  });

  return {
    repositoryName: repoName,
    pullRequestId: prId,
    beforeCommitId,
    afterCommitId,
    location: rawLocation,
    comment: commentView(comment),
  };
};

const PostCommentForComparedCommit: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const afterCommitId = requireString(input, "afterCommitId");
  const content = requireString(input, "content");
  requireRepository(ctx, repoName);

  const beforeCommitId = stringOrUndefined(input["beforeCommitId"]);
  const rawLocation = input["location"] as Record<string, unknown> | undefined;
  const filePath =
    rawLocation !== undefined
      ? stringOrUndefined(rawLocation["filePath"])
      : undefined;
  const filePosition =
    rawLocation !== undefined && typeof rawLocation["filePosition"] === "number"
      ? rawLocation["filePosition"]
      : undefined;
  const relativeFileVersion =
    rawLocation !== undefined
      ? stringOrUndefined(rawLocation["relativeFileVersion"])
      : undefined;

  const beforeBlobId =
    filePath !== undefined && beforeCommitId !== undefined
      ? filesForRef(ctx, repoName, beforeCommitId).files[filePath]?.blobId
      : undefined;
  const afterBlobId =
    filePath !== undefined
      ? filesForRef(ctx, repoName, afterCommitId).files[filePath]?.blobId
      : undefined;

  const comment = buildComment(ctx, {
    content,
    inReplyTo: undefined,
    clientRequestToken: stringOrUndefined(input["clientRequestToken"]),
    repositoryName: repoName,
    pullRequestId: undefined,
    beforeCommitId,
    afterCommitId,
    beforeBlobId,
    afterBlobId,
    filePath,
    filePosition,
    relativeFileVersion,
  });

  return {
    repositoryName: repoName,
    beforeCommitId,
    afterCommitId,
    blobId: afterBlobId,
    location: rawLocation,
    comment: commentView(comment),
  };
};

const PostCommentReply: OperationHandler = (input, ctx) => {
  const inReplyTo = requireString(input, "inReplyTo");
  const content = requireString(input, "content");
  const parent = requireComment(ctx, inReplyTo);

  const comment = buildComment(ctx, {
    content,
    inReplyTo,
    clientRequestToken: stringOrUndefined(input["clientRequestToken"]),
    repositoryName: parent.repositoryName,
    pullRequestId: parent.pullRequestId,
    beforeCommitId: parent.beforeCommitId,
    afterCommitId: parent.afterCommitId,
    beforeBlobId: parent.beforeBlobId,
    afterBlobId: parent.afterBlobId,
    filePath: parent.filePath,
    filePosition: parent.filePosition,
    relativeFileVersion: parent.relativeFileVersion,
  });

  return { comment: commentView(comment) };
};

const GetComment: OperationHandler = (input, ctx) => {
  const commentId = requireString(input, "commentId");
  const comment = requireComment(ctx, commentId);
  return { comment: commentView(comment) };
};

const GetCommentsForPullRequest: OperationHandler = (input, ctx) => {
  const prId = requireString(input, "pullRequestId");
  requirePullRequest(ctx, prId);

  const allComments = ctx.store
    .list<StoredComment>()
    .filter((entry) => entry.key.startsWith("comment/"))
    .map((entry) => entry.value);

  const rootComments = allComments.filter(
    (c) => c.pullRequestId === prId && c.inReplyTo === undefined,
  );

  const commentsForPullRequest = rootComments.map((c) => ({
    repositoryName: c.repositoryName,
    pullRequestId: c.pullRequestId,
    beforeCommitId: c.beforeCommitId,
    afterCommitId: c.afterCommitId,
    beforeBlobId: c.beforeBlobId,
    afterBlobId: c.afterBlobId,
    location:
      c.filePath !== undefined
        ? {
            filePath: c.filePath,
            filePosition: c.filePosition,
            relativeFileVersion: c.relativeFileVersion,
          }
        : undefined,
    comments: [
      commentView(c),
      ...allComments
        .filter((r) => r.inReplyTo === c.commentId)
        .map((r) => commentView(r)),
    ],
  }));

  return { commentsForPullRequest, nextToken: undefined };
};

const GetCommentsForComparedCommit: OperationHandler = (input, ctx) => {
  const repoName = requireString(input, "repositoryName");
  const afterCommitId = requireString(input, "afterCommitId");
  requireRepository(ctx, repoName);

  const allComments = ctx.store
    .list<StoredComment>()
    .filter((entry) => entry.key.startsWith("comment/"))
    .map((entry) => entry.value);

  const rootComments = allComments.filter(
    (c) =>
      c.repositoryName === repoName &&
      c.afterCommitId === afterCommitId &&
      c.inReplyTo === undefined,
  );

  const commentsForComparedCommit = rootComments.map((c) => ({
    repositoryName: c.repositoryName,
    beforeCommitId: c.beforeCommitId,
    afterCommitId: c.afterCommitId,
    beforeBlobId: c.beforeBlobId,
    afterBlobId: c.afterBlobId,
    location:
      c.filePath !== undefined
        ? {
            filePath: c.filePath,
            filePosition: c.filePosition,
            relativeFileVersion: c.relativeFileVersion,
          }
        : undefined,
    comments: [
      commentView(c),
      ...allComments
        .filter((r) => r.inReplyTo === c.commentId)
        .map((r) => commentView(r)),
    ],
  }));

  return { commentsForComparedCommit, nextToken: undefined };
};

const UpdateComment: OperationHandler = (input, ctx) => {
  const commentId = requireString(input, "commentId");
  const content = requireString(input, "content");
  const comment = requireComment(ctx, commentId);
  if (comment.deleted) {
    throw awsError(
      "CommentDeletedException",
      "The comment has been deleted.",
      400,
    );
  }
  const updated: StoredComment = {
    ...comment,
    content,
    lastModifiedDate: nowIso(),
  };
  ctx.store.set(commentKey(commentId), updated);
  return { comment: commentView(updated) };
};

const DeleteCommentContent: OperationHandler = (input, ctx) => {
  const commentId = requireString(input, "commentId");
  const comment = requireComment(ctx, commentId);
  const updated: StoredComment = {
    ...comment,
    content: "",
    deleted: true,
    lastModifiedDate: nowIso(),
  };
  ctx.store.set(commentKey(commentId), updated);
  return { comment: commentView(updated) };
};

const GetCommentReactions: OperationHandler = (input, ctx) => {
  const commentId = requireString(input, "commentId");
  const comment = requireComment(ctx, commentId);
  const reactionsForComment = Object.entries(comment.reactions).map(
    ([emoji, users]) => ({
      reaction: { emoji, shortCode: emoji, unicode: emoji },
      reactionUsers: users,
      reactionsFromDeletedUsersCount: 0,
    }),
  );
  return { reactionsForComment, nextToken: undefined };
};

const PutCommentReaction: OperationHandler = (input, ctx) => {
  const commentId = requireString(input, "commentId");
  const reactionValue = requireString(input, "reactionValue");
  const comment = requireComment(ctx, commentId);
  const userArn = callerArn(ctx.account);
  const existing = comment.reactions[reactionValue] ?? [];
  const updated: StoredComment = {
    ...comment,
    reactions: {
      ...comment.reactions,
      [reactionValue]: existing.includes(userArn)
        ? existing
        : [...existing, userArn],
    },
    callerReactions: comment.callerReactions.includes(reactionValue)
      ? comment.callerReactions
      : [...comment.callerReactions, reactionValue],
  };
  ctx.store.set(commentKey(commentId), updated);
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
    CreateApprovalRuleTemplate,
    GetApprovalRuleTemplate,
    DeleteApprovalRuleTemplate,
    UpdateApprovalRuleTemplateContent,
    UpdateApprovalRuleTemplateDescription,
    UpdateApprovalRuleTemplateName,
    ListApprovalRuleTemplates,
    AssociateApprovalRuleTemplateWithRepository,
    BatchAssociateApprovalRuleTemplateWithRepositories,
    DisassociateApprovalRuleTemplateFromRepository,
    BatchDisassociateApprovalRuleTemplateFromRepositories,
    ListAssociatedApprovalRuleTemplatesForRepository,
    ListRepositoriesForApprovalRuleTemplate,
    CreatePullRequest,
    GetPullRequest,
    ListPullRequests,
    UpdatePullRequestDescription,
    UpdatePullRequestStatus,
    UpdatePullRequestTitle,
    MergePullRequestByFastForward,
    MergePullRequestBySquash,
    MergePullRequestByThreeWay,
    CreatePullRequestApprovalRule,
    DeletePullRequestApprovalRule,
    UpdatePullRequestApprovalRuleContent,
    GetPullRequestApprovalStates,
    UpdatePullRequestApprovalState,
    GetPullRequestOverrideState,
    OverridePullRequestApprovalRules,
    EvaluatePullRequestApprovalRules,
    DescribePullRequestEvents,
    PostCommentForPullRequest,
    PostCommentForComparedCommit,
    PostCommentReply,
    GetComment,
    GetCommentsForPullRequest,
    GetCommentsForComparedCommit,
    UpdateComment,
    DeleteCommentContent,
    GetCommentReactions,
    PutCommentReaction,
  },
  model,
} as const satisfies ServiceDefinition;

export default codecommit;
