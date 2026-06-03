import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import accessanalyzerModel from "../../../../test/vendor/aws-models/accessanalyzer.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(accessanalyzerModel);

const analyzerPrefix = "analyzer:" as const;
const archiveRulePrefix = "archiveRule:" as const;
const accessPreviewPrefix = "accessPreview:" as const;
const findingPrefix = "finding:" as const;
const policyGenPrefix = "policyGen:" as const;
const tagPrefix = "tag:" as const;

type StoredAnalyzer = {
  arn: string;
  name: string;
  type: string;
  createdAt: number;
  status: string;
  tags: Record<string, string>;
  configuration?: Record<string, unknown>;
};

type StoredArchiveRule = {
  analyzerArn: string;
  ruleName: string;
  filter: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

type StoredAccessPreview = {
  id: string;
  analyzerArn: string;
  configurations: Record<string, unknown>;
  createdAt: number;
  status: string;
};

type StoredFinding = {
  id: string;
  analyzerArn: string;
  resourceType: string;
  condition: Record<string, string>;
  createdAt: number;
  analyzedAt: number;
  updatedAt: number;
  status: string;
  resourceOwnerAccount: string;
  resource?: string;
  isPublic?: boolean;
  principal?: Record<string, string>;
  action?: string[];
};

type StoredPolicyGeneration = {
  jobId: string;
  principalArn: string;
  status: string;
  startedOn: number;
  completedOn?: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

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

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const analyzerKey = (name: string): string => `${analyzerPrefix}${name}`;

const analyzerArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:access-analyzer:${ctx.region}:${ctx.account}:analyzer/${name}`;

const analyzerNameFromArn = (arn: string): string => {
  const parts = arn.split("/");
  return parts[parts.length - 1] ?? arn;
};

const analyzerSummary = (
  analyzer: StoredAnalyzer,
): Record<string, unknown> => ({
  arn: analyzer.arn,
  name: analyzer.name,
  type: analyzer.type,
  createdAt: analyzer.createdAt,
  status: analyzer.status,
  tags: analyzer.tags,
});

const requireAnalyzer = (ctx: ServiceContext, name: string): StoredAnalyzer => {
  const analyzer = ctx.store.get<StoredAnalyzer>(analyzerKey(name));
  if (analyzer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Analyzer ${name} not found.`,
      404,
    );
  }
  return analyzer;
};

const requireAnalyzerByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredAnalyzer => {
  const name = analyzerNameFromArn(arn);
  return requireAnalyzer(ctx, name);
};

const archiveRuleKey = (analyzerArn: string, ruleName: string): string =>
  `${archiveRulePrefix}${analyzerArn}:${ruleName}`;

const archiveRuleSummary = (
  rule: StoredArchiveRule,
): Record<string, unknown> => ({
  ruleName: rule.ruleName,
  filter: rule.filter,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt,
});

const accessPreviewKey = (id: string): string => `${accessPreviewPrefix}${id}`;

const findingKey = (analyzerArn: string, id: string): string =>
  `${findingPrefix}${analyzerArn}:${id}`;

const policyGenKey = (jobId: string): string => `${policyGenPrefix}${jobId}`;

const tagKey = (resourceArn: string): string => `${tagPrefix}${resourceArn}`;

const findingSummary = (f: StoredFinding): Record<string, unknown> => ({
  id: f.id,
  resourceType: f.resourceType,
  condition: f.condition,
  createdAt: f.createdAt,
  analyzedAt: f.analyzedAt,
  updatedAt: f.updatedAt,
  status: f.status,
  resourceOwnerAccount: f.resourceOwnerAccount,
  ...(f.resource !== undefined ? { resource: f.resource } : {}),
  ...(f.isPublic !== undefined ? { isPublic: f.isPublic } : {}),
  ...(f.principal !== undefined ? { principal: f.principal } : {}),
  ...(f.action !== undefined ? { action: f.action } : {}),
});

const findingSummaryV2 = (f: StoredFinding): Record<string, unknown> => ({
  id: f.id,
  resourceType: f.resourceType,
  createdAt: f.createdAt,
  analyzedAt: f.analyzedAt,
  updatedAt: f.updatedAt,
  status: f.status,
  resourceOwnerAccount: f.resourceOwnerAccount,
  findingType: "ExternalAccess",
  ...(f.resource !== undefined ? { resource: f.resource } : {}),
});

const CreateAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const type = requireString(input, "type");
  if (ctx.store.get<StoredAnalyzer>(analyzerKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Analyzer ${name} already exists.`,
      409,
    );
  }
  const arn = analyzerArn(ctx, name);
  const analyzer: StoredAnalyzer = {
    arn,
    name,
    type,
    createdAt: nowSeconds(),
    status: "ACTIVE",
    tags: stringMapFrom(input["tags"]),
  };
  ctx.store.set(analyzerKey(name), analyzer);
  return { arn };
};

const GetAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  return { analyzer: analyzerSummary(analyzer) };
};

const ListAnalyzers: OperationHandler = (input, ctx) => {
  const type = stringOrUndefined(input["type"]);
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 100;
  const analyzers = ctx.store
    .list<StoredAnalyzer>()
    .filter((entry) => entry.key.startsWith(analyzerPrefix))
    .map((entry) => entry.value)
    .filter((analyzer) => type === undefined || analyzer.type === type)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const page = analyzers.slice(0, max);
  return { analyzers: page.map(analyzerSummary) };
};

const DeleteAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  requireAnalyzer(ctx, name);
  ctx.store.delete(analyzerKey(name));
  return {};
};

const UpdateAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  const configuration = asRecord(input["configuration"]);
  if (configuration !== undefined) {
    ctx.store.set(analyzerKey(name), { ...analyzer, configuration });
  }
  return { configuration: configuration ?? analyzer.configuration ?? {} };
};

const CreateArchiveRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  const ruleName = requireString(input, "ruleName");
  const filter = asRecord(input["filter"]) ?? {};
  const key = archiveRuleKey(analyzer.arn, ruleName);
  if (ctx.store.get<StoredArchiveRule>(key) !== undefined) {
    throw awsError(
      "ConflictException",
      `Archive rule ${ruleName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rule: StoredArchiveRule = {
    analyzerArn: analyzer.arn,
    ruleName,
    filter,
    createdAt: now,
    updatedAt: now,
  };
  ctx.store.set(key, rule);
  return {};
};

const GetArchiveRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  const ruleName = requireString(input, "ruleName");
  const key = archiveRuleKey(analyzer.arn, ruleName);
  const rule = ctx.store.get<StoredArchiveRule>(key);
  if (rule === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Archive rule ${ruleName} not found.`,
      404,
    );
  }
  return { archiveRule: archiveRuleSummary(rule) };
};

const ListArchiveRules: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  const prefix = archiveRuleKey(analyzer.arn, "");
  const rules = ctx.store
    .list<StoredArchiveRule>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.ruleName < b.ruleName ? -1 : a.ruleName > b.ruleName ? 1 : 0,
    );
  return { archiveRules: rules.map(archiveRuleSummary) };
};

const UpdateArchiveRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  const ruleName = requireString(input, "ruleName");
  const key = archiveRuleKey(analyzer.arn, ruleName);
  const rule = ctx.store.get<StoredArchiveRule>(key);
  if (rule === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Archive rule ${ruleName} not found.`,
      404,
    );
  }
  const filter = asRecord(input["filter"]) ?? rule.filter;
  ctx.store.set(key, { ...rule, filter, updatedAt: nowSeconds() });
  return {};
};

const DeleteArchiveRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = requireAnalyzer(ctx, name);
  const ruleName = requireString(input, "ruleName");
  const key = archiveRuleKey(analyzer.arn, ruleName);
  if (ctx.store.get<StoredArchiveRule>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Archive rule ${ruleName} not found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ApplyArchiveRule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  return {};
};

const CreateAccessPreview: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const id = crypto.randomUUID();
  const preview: StoredAccessPreview = {
    id,
    analyzerArn: arn,
    configurations: asRecord(input["configurations"]) ?? {},
    createdAt: nowSeconds(),
    status: "COMPLETED",
  };
  ctx.store.set(accessPreviewKey(id), preview);
  return { id };
};

const GetAccessPreview: OperationHandler = (input, ctx) => {
  const id = requireString(input, "accessPreviewId");
  const preview = ctx.store.get<StoredAccessPreview>(accessPreviewKey(id));
  if (preview === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Access preview ${id} not found.`,
      404,
    );
  }
  return {
    accessPreview: {
      id: preview.id,
      analyzerArn: preview.analyzerArn,
      configurations: preview.configurations,
      createdAt: preview.createdAt,
      status: preview.status,
    },
  };
};

const ListAccessPreviews: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const previews = ctx.store
    .list<StoredAccessPreview>()
    .filter((e) => e.key.startsWith(accessPreviewPrefix))
    .map((e) => e.value)
    .filter((p) => p.analyzerArn === arn)
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    accessPreviews: previews.map((p) => ({
      id: p.id,
      analyzerArn: p.analyzerArn,
      createdAt: p.createdAt,
      status: p.status,
    })),
  };
};

const ListAccessPreviewFindings: OperationHandler = (input, ctx) => {
  const id = requireString(input, "accessPreviewId");
  const preview = ctx.store.get<StoredAccessPreview>(accessPreviewKey(id));
  if (preview === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Access preview ${id} not found.`,
      404,
    );
  }
  return { findings: [] };
};

const GetAnalyzedResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const resourceArn = requireString(input, "resourceArn");
  const now = nowSeconds();
  return {
    resource: {
      resourceArn,
      resourceType: "AWS::S3::Bucket",
      createdAt: now,
      analyzedAt: now,
      updatedAt: now,
      isPublic: false,
      resourceOwnerAccount: ctx.account,
    },
  };
};

const ListAnalyzedResources: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  return { analyzedResources: [] };
};

const GetFinding: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const id = requireString(input, "id");
  const key = findingKey(arn, id);
  const finding = ctx.store.get<StoredFinding>(key);
  if (finding === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Finding ${id} not found.`,
      404,
    );
  }
  return { finding: findingSummary(finding) };
};

const GetFindingV2: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const id = requireString(input, "id");
  const key = findingKey(arn, id);
  const finding = ctx.store.get<StoredFinding>(key);
  if (finding === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Finding ${id} not found.`,
      404,
    );
  }
  return {
    analyzedAt: finding.analyzedAt,
    createdAt: finding.createdAt,
    id: finding.id,
    resourceType: finding.resourceType,
    resourceOwnerAccount: finding.resourceOwnerAccount,
    status: finding.status,
    updatedAt: finding.updatedAt,
    findingDetails: [],
    findingType: "ExternalAccess",
  };
};

const ListFindings: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const prefix = findingKey(arn, "");
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 100;
  const findings = ctx.store
    .list<StoredFinding>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
  return { findings: findings.map(findingSummary) };
};

const ListFindingsV2: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const prefix = findingKey(arn, "");
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 100;
  const findings = ctx.store
    .list<StoredFinding>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
  return { findings: findings.map(findingSummaryV2) };
};

const UpdateFindings: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const status = stringOrUndefined(input["status"]);
  const ids = Array.isArray(input["ids"]) ? (input["ids"] as string[]) : [];
  if (status !== undefined) {
    for (const id of ids) {
      const key = findingKey(arn, id);
      const finding = ctx.store.get<StoredFinding>(key);
      if (finding !== undefined) {
        ctx.store.set(key, { ...finding, status, updatedAt: nowSeconds() });
      }
    }
  }
  return {};
};

const GetFindingsStatistics: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  return {
    findingsStatistics: [],
  };
};

const GenerateFindingRecommendation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  return {};
};

const GetFindingRecommendation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  const id = requireString(input, "id");
  const now = nowSeconds();
  return {
    startedAt: now,
    completedAt: now,
    resourceArn: `arn:aws:s3:::example-bucket`,
    recommendationType: "UnusedPermission",
    status: "SUCCEEDED",
    recommendedSteps: [],
  };
};

const StartPolicyGeneration: OperationHandler = (input, ctx) => {
  const policyGenerationDetails = asRecord(input["policyGenerationDetails"]);
  const principalArn =
    stringOrUndefined(policyGenerationDetails?.["principalArn"] as unknown) ??
    "arn:aws:iam::000000000000:role/unknown";
  const jobId = crypto.randomUUID();
  const now = nowSeconds();
  const gen: StoredPolicyGeneration = {
    jobId,
    principalArn,
    status: "SUCCEEDED",
    startedOn: now,
    completedOn: now,
  };
  ctx.store.set(policyGenKey(jobId), gen);
  return { jobId };
};

const CancelPolicyGeneration: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const key = policyGenKey(jobId);
  const gen = ctx.store.get<StoredPolicyGeneration>(key);
  if (gen !== undefined) {
    ctx.store.set(key, { ...gen, status: "CANCELED" });
  }
  return {};
};

const GetGeneratedPolicy: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const key = policyGenKey(jobId);
  const gen = ctx.store.get<StoredPolicyGeneration>(key);
  const now = nowSeconds();
  const principalArn =
    gen?.principalArn ?? "arn:aws:iam::000000000000:role/unknown";
  const status = gen?.status ?? "SUCCEEDED";
  const startedOn = gen?.startedOn ?? now;
  return {
    jobDetails: {
      jobId,
      status,
      startedOn,
      ...(gen?.completedOn !== undefined
        ? { completedOn: gen.completedOn }
        : {}),
    },
    generatedPolicyResult: {
      properties: {
        principalArn,
        isComplete: true,
        cloudTrailProperties: {},
      },
      generatedPolicies: [],
    },
  };
};

const ListPolicyGenerations: OperationHandler = (input, ctx) => {
  const principalArn = stringOrUndefined(input["principalArn"]);
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 100;
  const gens = ctx.store
    .list<StoredPolicyGeneration>()
    .filter((e) => e.key.startsWith(policyGenPrefix))
    .map((e) => e.value)
    .filter(
      (g) => principalArn === undefined || g.principalArn === principalArn,
    )
    .sort((a, b) => b.startedOn - a.startedOn)
    .slice(0, max);
  return {
    policyGenerations: gens.map((g) => ({
      jobId: g.jobId,
      principalArn: g.principalArn,
      status: g.status,
      startedOn: g.startedOn,
      ...(g.completedOn !== undefined ? { completedOn: g.completedOn } : {}),
    })),
  };
};

const CheckAccessNotGranted: OperationHandler = () => ({
  result: "PASS",
  message: "The specified access is not granted.",
  reasons: [],
});

const CheckNoNewAccess: OperationHandler = () => ({
  result: "PASS",
  message: "No new access.",
  reasons: [],
});

const CheckNoPublicAccess: OperationHandler = () => ({
  result: "PASS",
  message: "No public access.",
  reasons: [],
});

const ValidatePolicy: OperationHandler = () => ({
  findings: [],
});

const StartResourceScan: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "analyzerArn");
  requireAnalyzerByArn(ctx, arn);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = stringMapFrom(input["tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  ctx.store.set(tagKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  for (const k of tagKeys) {
    delete existing[k];
  }
  ctx.store.set(tagKey(resourceArn), existing);
  return {};
};

const CreateServiceLinkedAnalyzer: OperationHandler = (input, ctx) => {
  const type = requireString(input, "type");
  const name = `ServiceLinkedAnalyzer-${type}`;
  const arn = analyzerArn(ctx, name);
  if (ctx.store.get<StoredAnalyzer>(analyzerKey(name)) === undefined) {
    const analyzer: StoredAnalyzer = {
      arn,
      name,
      type,
      createdAt: nowSeconds(),
      status: "ACTIVE",
      tags: {},
    };
    ctx.store.set(analyzerKey(name), analyzer);
  }
  return { arn };
};

const DeleteServiceLinkedAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  requireAnalyzer(ctx, name);
  ctx.store.delete(analyzerKey(name));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const accessanalyzer = {
  name: "access-analyzer",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;

    if (parts[0] === "analyzer") {
      if (parts.length === 1) {
        if (m === "PUT") return "CreateAnalyzer";
        if (m === "GET") return "ListAnalyzers";
        return undefined;
      }
      if (parts[1] === "findings" && parts[2] === "statistics") {
        if (m === "POST") return "GetFindingsStatistics";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetAnalyzer";
        if (m === "DELETE") return "DeleteAnalyzer";
        if (m === "PUT") return "UpdateAnalyzer";
        return undefined;
      }
      if (parts[2] === "archive-rule") {
        if (parts.length === 3) {
          if (m === "GET") return "ListArchiveRules";
          if (m === "PUT") return "CreateArchiveRule";
          return undefined;
        }
        if (parts.length === 4) {
          if (m === "GET") return "GetArchiveRule";
          if (m === "DELETE") return "DeleteArchiveRule";
          if (m === "PUT") return "UpdateArchiveRule";
          return undefined;
        }
      }
      return undefined;
    }

    if (parts[0] === "archive-rule" && parts.length === 1) {
      if (m === "PUT") return "ApplyArchiveRule";
      return undefined;
    }

    if (parts[0] === "access-preview") {
      if (parts.length === 1) {
        if (m === "PUT") return "CreateAccessPreview";
        if (m === "GET") return "ListAccessPreviews";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetAccessPreview";
        if (m === "POST") return "ListAccessPreviewFindings";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "analyzed-resource" && parts.length === 1) {
      if (m === "GET") return "GetAnalyzedResource";
      if (m === "POST") return "ListAnalyzedResources";
      return undefined;
    }

    if (parts[0] === "finding") {
      if (parts.length === 1) {
        if (m === "POST") return "ListFindings";
        if (m === "PUT") return "UpdateFindings";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetFinding";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "findingv2") {
      if (parts.length === 1) {
        if (m === "POST") return "ListFindingsV2";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetFindingV2";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policy") {
      if (parts[1] === "check-access-not-granted") {
        if (m === "POST") return "CheckAccessNotGranted";
        return undefined;
      }
      if (parts[1] === "check-no-new-access") {
        if (m === "POST") return "CheckNoNewAccess";
        return undefined;
      }
      if (parts[1] === "check-no-public-access") {
        if (m === "POST") return "CheckNoPublicAccess";
        return undefined;
      }
      if (parts[1] === "generation") {
        if (parts.length === 2) {
          if (m === "PUT") return "StartPolicyGeneration";
          if (m === "GET") return "ListPolicyGenerations";
          return undefined;
        }
        if (parts.length === 3) {
          if (m === "GET") return "GetGeneratedPolicy";
          if (m === "PUT") return "CancelPolicyGeneration";
          return undefined;
        }
        return undefined;
      }
      if (parts[1] === "validation") {
        if (m === "POST") return "ValidatePolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "recommendation" && parts.length === 2) {
      if (m === "GET") return "GetFindingRecommendation";
      if (m === "POST") return "GenerateFindingRecommendation";
      return undefined;
    }

    if (parts[0] === "resource" && parts[1] === "scan") {
      if (m === "POST") return "StartResourceScan";
      return undefined;
    }

    if (parts[0] === "service-linked-analyzer") {
      if (parts.length === 1) {
        if (m === "PUT") return "CreateServiceLinkedAnalyzer";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "DELETE") return "DeleteServiceLinkedAnalyzer";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "tags" && parts.length === 2) {
      if (m === "GET") return "ListTagsForResource";
      if (m === "POST") return "TagResource";
      if (m === "DELETE") return "UntagResource";
      return undefined;
    }

    return undefined;
  },
  operations: {
    ApplyArchiveRule,
    CancelPolicyGeneration,
    CheckAccessNotGranted,
    CheckNoNewAccess,
    CheckNoPublicAccess,
    CreateAccessPreview,
    CreateAnalyzer,
    CreateArchiveRule,
    CreateServiceLinkedAnalyzer,
    DeleteAnalyzer,
    DeleteArchiveRule,
    DeleteServiceLinkedAnalyzer,
    GenerateFindingRecommendation,
    GetAccessPreview,
    GetAnalyzedResource,
    GetAnalyzer,
    GetArchiveRule,
    GetFinding,
    GetFindingRecommendation,
    GetFindingV2,
    GetFindingsStatistics,
    GetGeneratedPolicy,
    ListAccessPreviewFindings,
    ListAccessPreviews,
    ListAnalyzedResources,
    ListAnalyzers,
    ListArchiveRules,
    ListFindings,
    ListFindingsV2,
    ListPolicyGenerations,
    ListTagsForResource,
    StartPolicyGeneration,
    StartResourceScan,
    TagResource,
    UntagResource,
    UpdateAnalyzer,
    UpdateArchiveRule,
    UpdateFindings,
    ValidatePolicy,
  },
  model,
} as const satisfies ServiceDefinition;

export default accessanalyzer;
