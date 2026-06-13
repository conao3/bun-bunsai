import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () =>
    import("../../models/resourcegroupstaggingapi.json", {
      with: { type: "json" },
    }),
);

const resourcePrefix = "resource:" as const;

type StoredResource = {
  ResourceARN: string;
  ResourceType: string;
  Tags: Record<string, string>;
};

const resourceKey = (arn: string): string => `${resourcePrefix}${arn}`;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const resourceTypeFromArn = (arn: string): string => {
  const parts = arn.split(":");
  if (parts.length < 6) return "";
  const service = parts[2] ?? "";
  const tail = parts.slice(5).join(":");
  const resourceTypePart = tail.includes("/")
    ? tail.split("/")[0]
    : tail.includes(":")
      ? tail.split(":")[0]
      : tail;
  return `${service}:${resourceTypePart}`;
};

const matchesResourceTypeFilter = (arn: string, filter: string): boolean => {
  const parts = arn.split(":");
  if (parts.length < 6) return false;
  const service = parts[2] ?? "";
  if (!filter.includes(":")) {
    return service === filter;
  }
  return resourceTypeFromArn(arn) === filter;
};

const matchesTagFilter = (
  resource: StoredResource,
  filter: Record<string, unknown>,
): boolean => {
  const key = stringOrUndefined(filter["Key"]);
  if (key === undefined) return true;
  if (!(key in resource.Tags)) return false;
  const values = stringList(filter["Values"]);
  if (values.length === 0) return true;
  return values.includes(resource.Tags[key] ?? "");
};

const tagListView = (
  tags: Record<string, string>,
): Array<{ Key: string; Value: string }> =>
  Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));

const encodeToken = (offset: number): string => btoa(String(offset));

const decodeToken = (token: string | undefined): number => {
  if (token === undefined) return 0;
  try {
    const n = parseInt(atob(token), 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
};

const allResources = (ctx: ServiceContext): StoredResource[] =>
  ctx.store
    .list<StoredResource>()
    .filter((entry) => entry.key.startsWith(resourcePrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.ResourceARN < b.ResourceARN
        ? -1
        : a.ResourceARN > b.ResourceARN
          ? 1
          : 0,
    );

const requireResource = (
  ctx: ServiceContext,
  arn: string,
): StoredResource | undefined =>
  ctx.store.get<StoredResource>(resourceKey(arn));

const upsertResource = (
  ctx: ServiceContext,
  arn: string,
  tags: Record<string, string>,
): StoredResource => {
  const existing = requireResource(ctx, arn);
  const merged: StoredResource = {
    ResourceARN: arn,
    ResourceType: existing?.ResourceType ?? resourceTypeFromArn(arn),
    Tags: { ...(existing?.Tags ?? {}), ...tags },
  };
  ctx.store.set(resourceKey(arn), merged);
  return merged;
};

const GetResources: OperationHandler = (input, ctx) => {
  const tagFilters = Array.isArray(input["TagFilters"])
    ? (input["TagFilters"] as unknown[]).map(asRecord)
    : [];
  const resourceTypeFilters = stringList(input["ResourceTypeFilters"]);
  const includeComplianceDetails = input["IncludeComplianceDetails"] === true;
  const excludeCompliantResources = input["ExcludeCompliantResources"] === true;
  const tagKeysOnly = input["TagKeysOnly"] === true;
  const resourceArnList = stringList(input["ResourceARNList"]);
  const max = numberOrUndefined(input["ResourcesPerPage"]) ?? 50;
  const startIdx = decodeToken(stringOrUndefined(input["PaginationToken"]));

  let resources = allResources(ctx);
  if (resourceArnList.length > 0) {
    const set = new Set(resourceArnList);
    resources = resources.filter((r) => set.has(r.ResourceARN));
  }
  if (resourceTypeFilters.length > 0) {
    resources = resources.filter((r) =>
      resourceTypeFilters.some((f) =>
        matchesResourceTypeFilter(r.ResourceARN, f),
      ),
    );
  }
  if (tagFilters.length > 0) {
    resources = resources.filter((r) =>
      tagFilters.every((f) => matchesTagFilter(r, f)),
    );
  }

  const page = resources.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < resources.length;
  const responseToken = hasMore ? encodeToken(startIdx + max) : "";

  const mapped = page.map((r) => {
    const tagList = tagListView(r.Tags).map(({ Key, Value }) =>
      tagKeysOnly ? { Key } : { Key, Value },
    );
    const base: Record<string, unknown> = {
      ResourceARN: r.ResourceARN,
      Tags: tagList,
    };
    if (includeComplianceDetails) {
      base["ComplianceDetails"] = {
        NoncompliantKeys: [],
        KeysWithNoncompliantValues: [],
        ComplianceStatus: true,
      };
    }
    return base;
  });

  const filtered = excludeCompliantResources
    ? mapped.filter(() => false)
    : mapped;

  return {
    PaginationToken: responseToken,
    ResourceTagMappingList: filtered,
  };
};

const TagResources: OperationHandler = (input, ctx) => {
  const arns = stringList(input["ResourceARNList"]);
  if (arns.length === 0) {
    throw awsError(
      "InvalidParameterException",
      "ResourceARNList is required.",
      400,
    );
  }
  const tagsInput = asRecord(input["Tags"]) as Record<string, unknown>;
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(tagsInput)) {
    if (typeof v === "string") tags[k] = v;
  }
  for (const arn of arns) {
    upsertResource(ctx, arn, tags);
  }
  return { FailedResourcesMap: {} };
};

const UntagResources: OperationHandler = (input, ctx) => {
  const arns = stringList(input["ResourceARNList"]);
  if (arns.length === 0) {
    throw awsError(
      "InvalidParameterException",
      "ResourceARNList is required.",
      400,
    );
  }
  const keys = stringList(input["TagKeys"]);
  for (const arn of arns) {
    const existing = requireResource(ctx, arn);
    if (existing === undefined) continue;
    const nextTags = { ...existing.Tags };
    for (const k of keys) delete nextTags[k];
    ctx.store.set(resourceKey(arn), { ...existing, Tags: nextTags });
  }
  return { FailedResourcesMap: {} };
};

const GetTagKeys: OperationHandler = (input, ctx) => {
  const startIdx = decodeToken(stringOrUndefined(input["PaginationToken"]));
  const keys = new Set<string>();
  for (const r of allResources(ctx)) {
    for (const k of Object.keys(r.Tags)) keys.add(k);
  }
  const sorted = [...keys].sort();
  const max = 100;
  const page = sorted.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < sorted.length;
  return {
    PaginationToken: hasMore ? encodeToken(startIdx + max) : "",
    TagKeys: page,
  };
};

const GetTagValues: OperationHandler = (input, ctx) => {
  const key = stringOrUndefined(input["Key"]);
  if (key === undefined) {
    throw awsError("InvalidParameterException", "Key is required.", 400);
  }
  const startIdx = decodeToken(stringOrUndefined(input["PaginationToken"]));
  const values = new Set<string>();
  for (const r of allResources(ctx)) {
    const v = r.Tags[key];
    if (v !== undefined) values.add(v);
  }
  const sorted = [...values].sort();
  const max = 100;
  const page = sorted.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < sorted.length;
  return {
    PaginationToken: hasMore ? encodeToken(startIdx + max) : "",
    TagValues: page,
  };
};

const reportStateKey = "report:state" as const;

type ReportState = {
  Status: string;
  S3Location: string;
  StartDate: string;
};

const StartReportCreation: OperationHandler = (input, ctx) => {
  const bucket = stringOrUndefined(input["S3Bucket"]);
  if (bucket === undefined) {
    throw awsError("InvalidParameterException", "S3Bucket is required.", 400);
  }
  const state: ReportState = {
    Status: "SUCCEEDED",
    S3Location: `s3://${bucket}/report.csv`,
    StartDate: new Date().toISOString(),
  };
  ctx.store.set(reportStateKey, state);
  return {};
};

const DescribeReportCreation: OperationHandler = (_input, ctx) => {
  const state = ctx.store.get<ReportState>(reportStateKey);
  if (state === undefined) {
    return { Status: "NO_REPORT", S3Location: "", ErrorMessage: "" };
  }
  return {
    Status: state.Status,
    S3Location: state.S3Location,
    ErrorMessage: "",
  };
};

const GetComplianceSummary: OperationHandler = (input, ctx) => {
  const targetIds = stringList(input["TargetIdFilters"]);
  const regions = stringList(input["RegionFilters"]);
  const resourceTypes = stringList(input["ResourceTypeFilters"]);
  const groupBy = stringList(input["GroupBy"]);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const startIdx = decodeToken(stringOrUndefined(input["PaginationToken"]));

  const total = allResources(ctx).length;
  const summary: Record<string, unknown> = {
    LastUpdated: new Date().toISOString(),
    NonCompliantResources: 0,
    TargetId: targetIds[0] ?? ctx.account,
    TargetIdType: "ACCOUNT",
    Region: regions[0] ?? ctx.region,
    ResourceType: resourceTypes[0] ?? "",
  };
  if (groupBy.length > 0) {
    summary["GroupBy"] = groupBy;
  }

  const all = [summary];
  const page = all.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < all.length && total >= 0;
  return {
    SummaryList: page,
    PaginationToken: hasMore ? encodeToken(startIdx + max) : "",
  };
};

const ListRequiredTags: OperationHandler = (input, _ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const startIdx = decodeToken(stringOrUndefined(input["PaginationToken"]));
  const all: Array<Record<string, unknown>> = [];
  const page = all.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < all.length;
  return {
    RequiredTags: page,
    PaginationToken: hasMore ? encodeToken(startIdx + max) : "",
  };
};

const resourcegroupstaggingapi = {
  name: "tagging",
  protocol: "json",
  operations: {
    DescribeReportCreation,
    GetComplianceSummary,
    GetResources,
    GetTagKeys,
    GetTagValues,
    ListRequiredTags,
    StartReportCreation,
    TagResources,
    UntagResources,
  },
  model,
} as const satisfies ServiceDefinition;

export default resourcegroupstaggingapi;
