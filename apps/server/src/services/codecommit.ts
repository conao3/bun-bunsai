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

const repositoryKey = (name: string): string => `repository/${name}`;

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
  requireString(input, "commitId");
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
  return {};
};

const ListBranches: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  return { branches: [...repository.branches].sort() };
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
  },
  model,
} as const satisfies ServiceDefinition;

export default codecommit;
