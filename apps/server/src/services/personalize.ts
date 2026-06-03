import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import personalizeModel from "../../../../test/vendor/aws-models/personalize.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(personalizeModel);

const schemaPrefix = "schema:" as const;

type StoredSchema = {
  name: string;
  schemaArn: string;
  schema: string;
  domain: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidInputException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const schemaKey = (arn: string): string => `${schemaPrefix}${arn}`;

const schemaArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:personalize:${ctx.region}:${ctx.account}:schema/${name}`;

const schemaView = (stored: StoredSchema): Record<string, unknown> => ({
  name: stored.name,
  schemaArn: stored.schemaArn,
  schema: stored.schema,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
  domain: stored.domain,
});

const schemaSummaryView = (stored: StoredSchema): Record<string, unknown> => ({
  name: stored.name,
  schemaArn: stored.schemaArn,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
  domain: stored.domain,
});

const requireSchema = (ctx: ServiceContext, arn: string): StoredSchema => {
  const stored = ctx.store.get<StoredSchema>(schemaKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      404,
    );
  }
  return stored;
};

const CreateSchema: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const schema = requireString(input, "schema");
  const arn = schemaArn(ctx, name);
  if (ctx.store.get<StoredSchema>(schemaKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Schema already exists: ${arn}`,
      400,
    );
  }
  const now = nowSeconds();
  const stored: StoredSchema = {
    name,
    schemaArn: arn,
    schema,
    domain: stringOrUndefined(input["domain"]),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(schemaKey(arn), stored);
  return { schemaArn: arn };
};

const DescribeSchema: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "schemaArn");
  return { schema: schemaView(requireSchema(ctx, arn)) };
};

const ListSchemas: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const schemas = ctx.store
    .list<StoredSchema>()
    .filter((entry) => entry.key.startsWith(schemaPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  return { schemas: schemas.slice(0, max).map(schemaSummaryView) };
};

const DeleteSchema: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "schemaArn");
  requireSchema(ctx, arn);
  ctx.store.delete(schemaKey(arn));
  return {};
};

const personalize = {
  name: "personalize",
  protocol: "json",
  operations: {
    CreateSchema,
    DescribeSchema,
    ListSchemas,
    DeleteSchema,
  },
  model,
} as const satisfies ServiceDefinition;

export default personalize;
