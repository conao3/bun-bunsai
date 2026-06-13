import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/es.json", { with: { type: "json" } }),
);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

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

const optionStatus = (now: string): Record<string, unknown> => ({
  CreationDate: now,
  UpdateDate: now,
  UpdateVersion: 1,
  State: "Active",
  PendingDeletion: false,
});

const buildDomainConfig = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const now = new Date().toISOString();
  const status = optionStatus(now);
  const version = stringOrUndefined(input["ElasticsearchVersion"]) ?? "7.10";
  return {
    ElasticsearchVersion: { Options: version, Status: status },
    ElasticsearchClusterConfig: {
      Options: input["ElasticsearchClusterConfig"] ?? {
        InstanceType: "m4.large.elasticsearch",
        InstanceCount: 1,
        DedicatedMasterEnabled: false,
        ZoneAwarenessEnabled: false,
      },
      Status: status,
    },
    EBSOptions: {
      Options: input["EBSOptions"] ?? {
        EBSEnabled: true,
        VolumeType: "gp2",
        VolumeSize: 10,
      },
      Status: status,
    },
    AccessPolicies: {
      Options: stringOrUndefined(input["AccessPolicies"]) ?? "",
      Status: status,
    },
    SnapshotOptions: {
      Options: input["SnapshotOptions"] ?? { AutomatedSnapshotStartHour: 0 },
      Status: status,
    },
  };
};

const UpdateElasticsearchDomainConfig: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const key = `domain:${domainName}`;
  const existing = ctx.store.get<Record<string, unknown>>(key) ?? {};
  const merged = { ...existing, ...input };
  ctx.store.set(key, merged);
  return { DomainConfig: buildDomainConfig(merged) };
};

const es = {
  name: "es",
  protocol: "rest-json",
  matches: (req: ParsedRequest): boolean => req.path.startsWith("/2015-01-01/"),
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = req.path.split("/").filter((p) => p !== "");
    if (parts[0] !== "2015-01-01") return undefined;
    if (
      parts[1] === "es" &&
      parts[2] === "domain" &&
      parts.length === 5 &&
      parts[4] === "config" &&
      req.method === "POST"
    ) {
      return "UpdateElasticsearchDomainConfig";
    }
    return undefined;
  },
  operations: {
    UpdateElasticsearchDomainConfig,
  },
  model,
} as const satisfies ServiceDefinition;

export default es;
