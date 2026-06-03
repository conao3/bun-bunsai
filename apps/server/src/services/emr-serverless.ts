import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import emrServerlessModel from "../../../../test/vendor/aws-models/emr-serverless.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(emrServerlessModel);

const applicationPrefix = "application:" as const;

type StoredApplication = {
  applicationId: string;
  name: string | undefined;
  arn: string;
  releaseLabel: string;
  type: string;
  state: string;
  stateDetails: string;
  createdAt: number;
  updatedAt: number;
  architecture: string;
  tags: Record<string, unknown>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const applicationKey = (id: string): string => `${applicationPrefix}${id}`;

const newId = (): string =>
  `00${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 16);

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireApplication = (
  ctx: ServiceContext,
  id: string,
): StoredApplication => {
  const stored = ctx.store.get<StoredApplication>(applicationKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application ${id} does not exist.`,
      404,
    );
  }
  return stored;
};

const applicationView = (
  application: StoredApplication,
): Record<string, unknown> => ({
  applicationId: application.applicationId,
  name: application.name,
  arn: application.arn,
  releaseLabel: application.releaseLabel,
  type: application.type,
  state: application.state,
  stateDetails: application.stateDetails,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
  architecture: application.architecture,
  tags: application.tags,
});

const applicationSummary = (
  application: StoredApplication,
): Record<string, unknown> => ({
  id: application.applicationId,
  name: application.name,
  arn: application.arn,
  releaseLabel: application.releaseLabel,
  type: application.type,
  state: application.state,
  stateDetails: application.stateDetails,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
  architecture: application.architecture,
});

const CreateApplication: OperationHandler = (input, ctx) => {
  const releaseLabel = requireString(input, "releaseLabel");
  const type = requireString(input, "type");
  const id = newId();
  const now = nowSeconds();
  const arn = `arn:aws:emr-serverless:${ctx.region}:${ctx.account}:/applications/${id}`;
  const application: StoredApplication = {
    applicationId: id,
    name: stringOrUndefined(input["name"]),
    arn,
    releaseLabel,
    type,
    state: "CREATED",
    stateDetails: "",
    createdAt: now,
    updatedAt: now,
    architecture: stringOrUndefined(input["architecture"]) ?? "X86_64",
    tags: recordOrEmpty(input["tags"]),
  };
  ctx.store.set(applicationKey(id), application);
  return {
    applicationId: application.applicationId,
    name: application.name,
    arn: application.arn,
  };
};

const GetApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  return { application: applicationView(requireApplication(ctx, id)) };
};

const ListApplications: OperationHandler = (_input, ctx) => {
  const applications = ctx.store
    .list<StoredApplication>()
    .filter((entry) => entry.key.startsWith(applicationPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.applicationId < b.applicationId
        ? -1
        : a.applicationId > b.applicationId
          ? 1
          : 0,
    );
  return { applications: applications.map(applicationSummary) };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  requireApplication(ctx, id);
  ctx.store.delete(applicationKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const emrServerless = {
  name: "emr-serverless",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "applications") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateApplication";
      if (req.method === "GET") return "ListApplications";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetApplication";
      if (req.method === "DELETE") return "DeleteApplication";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateApplication,
    GetApplication,
    ListApplications,
    DeleteApplication,
  },
  model,
} as const satisfies ServiceDefinition;

export default emrServerless;
