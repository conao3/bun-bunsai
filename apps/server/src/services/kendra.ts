import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import kendraModel from "../../../../test/vendor/aws-models/kendra.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(kendraModel);

type StoredIndex = {
  Id: string;
  Name: string;
  RoleArn: string;
  Edition: string;
  Description: string;
  Status: string;
  CreatedAt: number;
  UpdatedAt: number;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const requireIndex = (ctx: ServiceContext, id: string): StoredIndex => {
  const index = ctx.store.get<StoredIndex>(id);
  if (index === undefined) {
    throw awsError("ResourceNotFoundException", `Index ${id} not found.`, 404);
  }
  return index;
};

const CreateIndex: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const roleArn = requireString(input, "RoleArn");
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const edition =
    typeof input["Edition"] === "string"
      ? (input["Edition"] as string)
      : "ENTERPRISE_EDITION";
  const description =
    typeof input["Description"] === "string"
      ? (input["Description"] as string)
      : "";
  const index: StoredIndex = {
    Id: id,
    Name: name,
    RoleArn: roleArn,
    Edition: edition,
    Description: description,
    Status: "ACTIVE",
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(id, index);
  return { Id: id };
};

const DescribeIndex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const index = requireIndex(ctx, id);
  return {
    Name: index.Name,
    Id: index.Id,
    Edition: index.Edition,
    RoleArn: index.RoleArn,
    Status: index.Status,
    Description: index.Description,
    CreatedAt: index.CreatedAt,
    UpdatedAt: index.UpdatedAt,
  };
};

const ListIndices: OperationHandler = (input, ctx) => {
  const entries = ctx.store.list<StoredIndex>();
  return {
    IndexConfigurationSummaryItems: entries.map((entry) => ({
      Name: entry.value.Name,
      Id: entry.value.Id,
      Edition: entry.value.Edition,
      CreatedAt: entry.value.CreatedAt,
      UpdatedAt: entry.value.UpdatedAt,
      Status: entry.value.Status,
    })),
  };
};

const DeleteIndex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireIndex(ctx, id);
  ctx.store.delete(id);
  return {};
};

const kendra: ServiceDefinition = {
  name: "kendra",
  protocol: "json",
  operations: {
    CreateIndex,
    DescribeIndex,
    ListIndices,
    DeleteIndex,
  },
  model,
} as const;

export default kendra;
