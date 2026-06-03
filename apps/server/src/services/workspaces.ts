import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import workspacesModel from "../../../../test/vendor/aws-models/workspaces.json" with { type: "json" };
import type { OperationHandler, ServiceDefinition } from "../core/types.ts";

const model = loadServiceModel(workspacesModel);

type StoredTag = {
  Key: string;
  Value: string | undefined;
};

type StoredWorkspace = {
  WorkspaceId: string;
  DirectoryId: string;
  UserName: string;
  BundleId: string;
  State: string;
  IpAddress: string;
  ComputerName: string;
  SubnetId: string;
  Tags: StoredTag[];
};

const workspaceKey = (id: string): string => `workspace/${id}`;
const tagsKey = (resourceId: string): string => `tags/${resourceId}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const toTagList = (value: unknown): StoredTag[] =>
  Array.isArray(value)
    ? (value as unknown[])
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .map((entry) => ({
          Key: typeof entry["Key"] === "string" ? entry["Key"] : "",
          Value: stringOrUndefined(entry["Value"]),
        }))
        .filter((tag) => tag.Key !== "")
    : [];

const CreateWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["Workspaces"])
    ? (input["Workspaces"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  if (requests.length === 0) {
    throw awsError("ValidationException", "Workspaces is required.", 400);
  }
  const pending = requests.map((request) => {
    const directoryId = requireString(request, "DirectoryId");
    const userName = requireString(request, "UserName");
    const bundleId = requireString(request, "BundleId");
    const id = `ws-${crypto.randomUUID().slice(0, 9)}`;
    const workspace: StoredWorkspace = {
      WorkspaceId: id,
      DirectoryId: directoryId,
      UserName: userName,
      BundleId: bundleId,
      State: "AVAILABLE",
      IpAddress: "10.0.0.10",
      ComputerName: `WSAMZN-${id.slice(3, 11).toUpperCase()}`,
      SubnetId: `subnet-${crypto.randomUUID().slice(0, 8)}`,
      Tags: toTagList(request["Tags"]),
    };
    ctx.store.set(workspaceKey(id), workspace);
    return workspace;
  });
  return { FailedRequests: [], PendingRequests: pending };
};

const DescribeWorkspaces: OperationHandler = (input, ctx) => {
  const ids = Array.isArray(input["WorkspaceIds"])
    ? (input["WorkspaceIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const directoryId = stringOrUndefined(input["DirectoryId"]);
  const userName = stringOrUndefined(input["UserName"]);
  const bundleId = stringOrUndefined(input["BundleId"]);
  const workspaces = ctx.store
    .list<StoredWorkspace>()
    .filter((entry) => entry.key.startsWith("workspace/"))
    .map((entry) => entry.value)
    .filter(
      (workspace) => ids === undefined || ids.includes(workspace.WorkspaceId),
    )
    .filter(
      (workspace) =>
        directoryId === undefined || workspace.DirectoryId === directoryId,
    )
    .filter(
      (workspace) => userName === undefined || workspace.UserName === userName,
    )
    .filter(
      (workspace) => bundleId === undefined || workspace.BundleId === bundleId,
    );
  return { Workspaces: workspaces };
};

const TerminateWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["TerminateWorkspaceRequests"])
    ? (input["TerminateWorkspaceRequests"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  if (requests.length === 0) {
    throw awsError(
      "ValidationException",
      "TerminateWorkspaceRequests is required.",
      400,
    );
  }
  for (const request of requests) {
    const id = requireString(request, "WorkspaceId");
    ctx.store.delete(workspaceKey(id));
  }
  return { FailedRequests: [] };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tags = toTagList(input["Tags"]);
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  const merged = [
    ...existing.filter((tag) => !tags.some((next) => next.Key === tag.Key)),
    ...tags,
  ];
  ctx.store.set(tagsKey(resourceId), merged);
  const workspace = ctx.store.get<StoredWorkspace>(workspaceKey(resourceId));
  if (workspace !== undefined) {
    ctx.store.set(workspaceKey(resourceId), { ...workspace, Tags: merged });
  }
  return {};
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tags = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  return { TagList: tags };
};

const workspaces = {
  name: "workspaces",
  protocol: "json",
  operations: {
    CreateWorkspaces,
    DescribeWorkspaces,
    TerminateWorkspaces,
    CreateTags,
    DescribeTags,
  },
  model,
} as const satisfies ServiceDefinition;

export default workspaces;
