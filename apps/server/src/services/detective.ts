import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import detectiveModel from "../../../../test/vendor/aws-models/detective.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(detectiveModel);

const graphPrefix = "graph:" as const;

type StoredGraph = {
  arn: string;
  id: string;
  createdTime: number;
};

type StoredMember = {
  AccountId: string;
  EmailAddress: string;
  GraphArn: string;
  AdministratorId: string;
  Status: string;
  InvitedTime: number;
  UpdatedTime: number;
  InvitationType: string;
  DatasourcePackageIngestStates: Record<string, string>;
};

type StoredOrgAdmin = {
  AccountId: string;
  GraphArn: string;
  DelegationTime: number;
};

type StoredOrgConfig = {
  AutoEnable: boolean;
};

type StoredDatasources = Record<
  string,
  {
    DatasourcePackageIngestState: string;
    LastIngestStateChange: Record<string, { Timestamp: number }>;
  }
>;

type StoredInvestigation = {
  GraphArn: string;
  InvestigationId: string;
  EntityArn: string;
  EntityType: string;
  CreatedTime: number;
  ScopeStartTime: number;
  ScopeEndTime: number;
  Status: string;
  Severity: string;
  State: string;
};

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

const requireTimestamp = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const val = input[field];
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed / 1000;
  }
  throw awsError("ValidationException", `${field} is required.`, 400);
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const hex32 = (): string => {
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
};

const graphKey = (id: string): string => `${graphPrefix}${id}`;

const graphArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:detective:${ctx.region}:${ctx.account}:graph:${id}`;

const graphSummary = (graph: StoredGraph): Record<string, unknown> => ({
  Arn: graph.arn,
  CreatedTime: graph.createdTime,
});

const memberKey = (graphId: string, accountId: string): string =>
  `member:${graphId}:${accountId}`;

const orgAdminKey = (accountId: string): string => `orgadmin:${accountId}`;

const orgConfigKey = (graphId: string): string => `orgconfig:${graphId}`;

const datasourceKey = (graphId: string): string => `datasource:${graphId}`;

const investigationKey = (graphId: string, investigationId: string): string =>
  `investigation:${graphId}:${investigationId}`;

const tagsKey = (arn: string): string => `tags:${arn}`;

const graphIdFromArn = (arn: string): string => {
  const match = arn.match(/:graph:([a-f0-9]+)$/);
  return match ? match[1] : "";
};

const requireGraph = (ctx: ServiceContext, arn: string): StoredGraph => {
  const match = ctx.store
    .list<StoredGraph>()
    .find(
      (entry) => entry.key.startsWith(graphPrefix) && entry.value.arn === arn,
    );
  if (match === undefined) {
    throw awsError("ResourceNotFoundException", `Graph ${arn} not found.`, 404);
  }
  return match.value;
};

const entityTypeFromArn = (arn: string): string =>
  arn.includes(":role/") ? "IAM_ROLE" : "IAM_USER";

const memberDetail = (m: StoredMember): Record<string, unknown> => ({
  AccountId: m.AccountId,
  EmailAddress: m.EmailAddress,
  GraphArn: m.GraphArn,
  AdministratorId: m.AdministratorId,
  Status: m.Status,
  InvitedTime: m.InvitedTime,
  UpdatedTime: m.UpdatedTime,
  InvitationType: m.InvitationType,
  DatasourcePackageIngestStates: m.DatasourcePackageIngestStates,
});

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

const asStringMap = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
};

const defaultDatasources = (): StoredDatasources => ({
  DETECTIVE_CORE: {
    DatasourcePackageIngestState: "STARTED",
    LastIngestStateChange: {
      STARTED: { Timestamp: nowSeconds() },
    },
  },
});

const CreateGraph: OperationHandler = (_input, ctx) => {
  const id = hex32();
  const arn = graphArn(ctx, id);
  const graph: StoredGraph = {
    arn,
    id,
    createdTime: nowSeconds(),
  };
  ctx.store.set(graphKey(id), graph);
  return { GraphArn: arn };
};

const ListGraphs: OperationHandler = (input, ctx) => {
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 200;
  const graphs = ctx.store
    .list<StoredGraph>()
    .filter((entry) => entry.key.startsWith(graphPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.arn < b.arn ? -1 : a.arn > b.arn ? 1 : 0));
  const page = graphs.slice(0, max);
  return { GraphList: page.map(graphSummary) };
};

const DeleteGraph: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GraphArn");
  const match = ctx.store
    .list<StoredGraph>()
    .find(
      (entry) => entry.key.startsWith(graphPrefix) && entry.value.arn === arn,
    );
  if (match === undefined) {
    throw awsError("ResourceNotFoundException", `Graph ${arn} not found.`, 404);
  }
  ctx.store.delete(match.key);
  return {};
};

const CreateMembers: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const accounts = Array.isArray(input["Accounts"])
    ? (input["Accounts"] as Record<string, unknown>[])
    : [];
  const members: Record<string, unknown>[] = [];
  const unprocessed: Record<string, unknown>[] = [];
  const now = nowSeconds();
  for (const account of accounts) {
    const accountId = stringOrUndefined(account["AccountId"]);
    const email = stringOrUndefined(account["EmailAddress"]);
    if (accountId === undefined) {
      continue;
    }
    const key = memberKey(graphId, accountId);
    if (ctx.store.get(key) !== undefined) {
      unprocessed.push({ AccountId: accountId, Reason: "MEMBER_EXISTS" });
      continue;
    }
    const member: StoredMember = {
      AccountId: accountId,
      EmailAddress: email ?? "",
      GraphArn: graphArnValue,
      AdministratorId: ctx.account,
      Status: "INVITED",
      InvitedTime: now,
      UpdatedTime: now,
      InvitationType: "INVITATION",
      DatasourcePackageIngestStates: { DETECTIVE_CORE: "STARTED" },
    };
    ctx.store.set(key, member);
    members.push(memberDetail(member));
  }
  return { Members: members, UnprocessedAccounts: unprocessed };
};

const GetMembers: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const accountIds = asStringArray(input["AccountIds"]);
  const members: Record<string, unknown>[] = [];
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const stored = ctx.store.get<StoredMember>(memberKey(graphId, accountId));
    if (stored === undefined) {
      unprocessed.push({ AccountId: accountId, Reason: "NOT_A_MEMBER" });
    } else {
      members.push(memberDetail(stored));
    }
  }
  return { MemberDetails: members, UnprocessedAccounts: unprocessed };
};

const ListMembers: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const prefix = `member:${graphId}:`;
  const members = ctx.store
    .list<StoredMember>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => memberDetail(entry.value));
  return { MemberDetails: members, NextToken: undefined };
};

const DeleteMembers: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const accountIds = asStringArray(input["AccountIds"]);
  const deleted: string[] = [];
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = memberKey(graphId, accountId);
    if (ctx.store.get(key) === undefined) {
      unprocessed.push({ AccountId: accountId, Reason: "NOT_A_MEMBER" });
    } else {
      ctx.store.delete(key);
      deleted.push(accountId);
    }
  }
  return { AccountIds: deleted, UnprocessedAccounts: unprocessed };
};

const StartMonitoringMember: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const accountId = requireString(input, "AccountId");
  const key = memberKey(graphId, accountId);
  const stored = ctx.store.get<StoredMember>(key);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Member ${accountId} not found.`,
      404,
    );
  }
  ctx.store.set(key, {
    ...stored,
    Status: "ENABLED",
    UpdatedTime: nowSeconds(),
  });
  return {};
};

const DisassociateMembership: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  ctx.store.delete(memberKey(graphId, ctx.account));
  return {};
};

const AcceptInvitation: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const key = memberKey(graphId, ctx.account);
  const stored = ctx.store.get<StoredMember>(key);
  if (stored !== undefined) {
    ctx.store.set(key, {
      ...stored,
      Status: "ENABLED",
      UpdatedTime: nowSeconds(),
    });
  }
  return {};
};

const RejectInvitation: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  ctx.store.delete(memberKey(graphId, ctx.account));
  return {};
};

const ListInvitations: OperationHandler = (_input, ctx) => {
  const invitations = ctx.store
    .list<StoredMember>()
    .filter(
      (entry) =>
        entry.key.startsWith("member:") &&
        entry.value.AccountId === ctx.account &&
        entry.value.Status === "INVITED",
    )
    .map((entry) => memberDetail(entry.value));
  return { Invitations: invitations, NextToken: undefined };
};

const EnableOrganizationAdminAccount: OperationHandler = (input, ctx) => {
  const accountId = requireString(input, "AccountId");
  const graphs = ctx.store
    .list<StoredGraph>()
    .filter((entry) => entry.key.startsWith(graphPrefix))
    .map((entry) => entry.value);
  const firstGraphArn = graphs.length > 0 ? graphs[0].arn : "";
  const admin: StoredOrgAdmin = {
    AccountId: accountId,
    GraphArn: firstGraphArn,
    DelegationTime: nowSeconds(),
  };
  ctx.store.set(orgAdminKey(accountId), admin);
  return {};
};

const DisableOrganizationAdminAccount: OperationHandler = (_input, ctx) => {
  const admins = ctx.store
    .list<StoredOrgAdmin>()
    .filter((entry) => entry.key.startsWith("orgadmin:"));
  for (const admin of admins) {
    ctx.store.delete(admin.key);
  }
  return {};
};

const ListOrganizationAdminAccounts: OperationHandler = (_input, ctx) => {
  const admins = ctx.store
    .list<StoredOrgAdmin>()
    .filter((entry) => entry.key.startsWith("orgadmin:"))
    .map((entry) => ({
      AccountId: entry.value.AccountId,
      GraphArn: entry.value.GraphArn,
      DelegationTime: entry.value.DelegationTime,
    }));
  return { Administrators: admins, NextToken: undefined };
};

const DescribeOrganizationConfiguration: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const stored = ctx.store.get<StoredOrgConfig>(orgConfigKey(graphId));
  return { AutoEnable: stored?.AutoEnable ?? false };
};

const UpdateOrganizationConfiguration: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const autoEnable = input["AutoEnable"] === true;
  const config: StoredOrgConfig = { AutoEnable: autoEnable };
  ctx.store.set(orgConfigKey(graphId), config);
  return {};
};

const ListDatasourcePackages: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const stored =
    ctx.store.get<StoredDatasources>(datasourceKey(graphId)) ??
    defaultDatasources();
  return { DatasourcePackages: stored, NextToken: undefined };
};

const UpdateDatasourcePackages: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const packages = asStringArray(input["DatasourcePackages"]);
  const existing =
    ctx.store.get<StoredDatasources>(datasourceKey(graphId)) ??
    defaultDatasources();
  const now = nowSeconds();
  const updated: StoredDatasources = { ...existing };
  for (const pkg of packages) {
    updated[pkg] = {
      DatasourcePackageIngestState: "STARTED",
      LastIngestStateChange: { STARTED: { Timestamp: now } },
    };
  }
  ctx.store.set(datasourceKey(graphId), updated);
  return {};
};

const BatchGetGraphMemberDatasources: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const accountIds = asStringArray(input["AccountIds"]);
  const datasources =
    ctx.store.get<StoredDatasources>(datasourceKey(graphId)) ??
    defaultDatasources();
  const memberDatasources: Record<string, unknown>[] = [];
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const stored = ctx.store.get<StoredMember>(memberKey(graphId, accountId));
    if (stored === undefined) {
      unprocessed.push({ AccountId: accountId, Reason: "NOT_A_MEMBER" });
    } else {
      memberDatasources.push({
        AccountId: accountId,
        GraphArn: graphArnValue,
        DatasourcePackageIngestHistory: datasources,
      });
    }
  }
  return {
    MemberDatasources: memberDatasources,
    UnprocessedAccounts: unprocessed,
  };
};

const BatchGetMembershipDatasources: OperationHandler = (input, ctx) => {
  const graphArns = asStringArray(input["GraphArns"]);
  const membershipDatasources: Record<string, unknown>[] = [];
  const unprocessed: Record<string, unknown>[] = [];
  for (const arn of graphArns) {
    const match = ctx.store
      .list<StoredGraph>()
      .find(
        (entry) => entry.key.startsWith(graphPrefix) && entry.value.arn === arn,
      );
    if (match === undefined) {
      unprocessed.push({ GraphArn: arn, Reason: "GRAPH_NOT_FOUND" });
    } else {
      const graphId = graphIdFromArn(arn);
      const datasources =
        ctx.store.get<StoredDatasources>(datasourceKey(graphId)) ??
        defaultDatasources();
      membershipDatasources.push({
        AccountId: ctx.account,
        GraphArn: arn,
        DatasourcePackageIngestHistory: datasources,
      });
    }
  }
  return {
    MembershipDatasources: membershipDatasources,
    UnprocessedGraphs: unprocessed,
  };
};

const StartInvestigation: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const entityArn = requireString(input, "EntityArn");
  const scopeStartTime = requireTimestamp(input, "ScopeStartTime");
  const scopeEndTime = requireTimestamp(input, "ScopeEndTime");
  const investigationId = hex32();
  const investigation: StoredInvestigation = {
    GraphArn: graphArnValue,
    InvestigationId: investigationId,
    EntityArn: entityArn,
    EntityType: entityTypeFromArn(entityArn),
    CreatedTime: nowSeconds(),
    ScopeStartTime: scopeStartTime,
    ScopeEndTime: scopeEndTime,
    Status: "RUNNING",
    Severity: "INFORMATIONAL",
    State: "ACTIVE",
  };
  ctx.store.set(investigationKey(graphId, investigationId), investigation);
  return { InvestigationId: investigationId };
};

const GetInvestigation: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const investigationId = requireString(input, "InvestigationId");
  const stored = ctx.store.get<StoredInvestigation>(
    investigationKey(graphId, investigationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Investigation ${investigationId} not found.`,
      404,
    );
  }
  return {
    GraphArn: stored.GraphArn,
    InvestigationId: stored.InvestigationId,
    EntityArn: stored.EntityArn,
    EntityType: stored.EntityType,
    CreatedTime: stored.CreatedTime,
    ScopeStartTime: stored.ScopeStartTime,
    ScopeEndTime: stored.ScopeEndTime,
    Status: stored.Status,
    Severity: stored.Severity,
    State: stored.State,
  };
};

const ListInvestigations: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const prefix = `investigation:${graphId}:`;
  const investigations = ctx.store
    .list<StoredInvestigation>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      InvestigationId: entry.value.InvestigationId,
      Severity: entry.value.Severity,
      Status: entry.value.Status,
      State: entry.value.State,
      CreatedTime: entry.value.CreatedTime,
      EntityArn: entry.value.EntityArn,
      EntityType: entry.value.EntityType,
    }));
  return { InvestigationDetails: investigations, NextToken: undefined };
};

const UpdateInvestigationState: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const investigationId = requireString(input, "InvestigationId");
  const state = requireString(input, "State");
  const key = investigationKey(graphId, investigationId);
  const stored = ctx.store.get<StoredInvestigation>(key);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Investigation ${investigationId} not found.`,
      404,
    );
  }
  ctx.store.set(key, { ...stored, State: state });
  return {};
};

const ListIndicators: OperationHandler = (input, ctx) => {
  const graphArnValue = requireString(input, "GraphArn");
  requireGraph(ctx, graphArnValue);
  const graphId = graphIdFromArn(graphArnValue);
  const investigationId = requireString(input, "InvestigationId");
  const stored = ctx.store.get<StoredInvestigation>(
    investigationKey(graphId, investigationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Investigation ${investigationId} not found.`,
      404,
    );
  }
  return {
    GraphArn: graphArnValue,
    InvestigationId: investigationId,
    NextToken: undefined,
    Indicators: [],
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = asStringMap(input["Tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = asStringArray(input["TagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!tagKeys.includes(k)) updated[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const detective = {
  name: "detective",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.method === "GET" && req.path.startsWith("/tags/"))
      return "ListTagsForResource";
    if (req.method === "POST" && req.path.startsWith("/tags/"))
      return "TagResource";
    if (req.method === "DELETE" && req.path.startsWith("/tags/"))
      return "UntagResource";
    if (req.method === "PUT" && req.path === "/invitation")
      return "AcceptInvitation";
    if (req.method !== "POST") return undefined;
    if (req.path === "/graph") return "CreateGraph";
    if (req.path === "/graphs/list") return "ListGraphs";
    if (req.path === "/graph/removal") return "DeleteGraph";
    if (req.path === "/graph/members") return "CreateMembers";
    if (req.path === "/graph/members/get") return "GetMembers";
    if (req.path === "/graph/members/list") return "ListMembers";
    if (req.path === "/graph/members/removal") return "DeleteMembers";
    if (req.path === "/graph/member/monitoringstate")
      return "StartMonitoringMember";
    if (req.path === "/membership/removal") return "DisassociateMembership";
    if (req.path === "/invitation/removal") return "RejectInvitation";
    if (req.path === "/invitations/list") return "ListInvitations";
    if (req.path === "/orgs/enableAdminAccount")
      return "EnableOrganizationAdminAccount";
    if (req.path === "/orgs/disableAdminAccount")
      return "DisableOrganizationAdminAccount";
    if (req.path === "/orgs/adminAccountslist")
      return "ListOrganizationAdminAccounts";
    if (req.path === "/orgs/describeOrganizationConfiguration")
      return "DescribeOrganizationConfiguration";
    if (req.path === "/orgs/updateOrganizationConfiguration")
      return "UpdateOrganizationConfiguration";
    if (req.path === "/graph/datasources/list") return "ListDatasourcePackages";
    if (req.path === "/graph/datasources/update")
      return "UpdateDatasourcePackages";
    if (req.path === "/graph/datasources/get")
      return "BatchGetGraphMemberDatasources";
    if (req.path === "/membership/datasources/get")
      return "BatchGetMembershipDatasources";
    if (req.path === "/investigations/startInvestigation")
      return "StartInvestigation";
    if (req.path === "/investigations/getInvestigation")
      return "GetInvestigation";
    if (req.path === "/investigations/listInvestigations")
      return "ListInvestigations";
    if (req.path === "/investigations/updateInvestigationState")
      return "UpdateInvestigationState";
    if (req.path === "/investigations/listIndicators") return "ListIndicators";
    return undefined;
  },
  operations: {
    CreateGraph,
    ListGraphs,
    DeleteGraph,
    CreateMembers,
    GetMembers,
    ListMembers,
    DeleteMembers,
    StartMonitoringMember,
    DisassociateMembership,
    AcceptInvitation,
    RejectInvitation,
    ListInvitations,
    EnableOrganizationAdminAccount,
    DisableOrganizationAdminAccount,
    ListOrganizationAdminAccounts,
    DescribeOrganizationConfiguration,
    UpdateOrganizationConfiguration,
    ListDatasourcePackages,
    UpdateDatasourcePackages,
    BatchGetGraphMemberDatasources,
    BatchGetMembershipDatasources,
    StartInvestigation,
    GetInvestigation,
    ListInvestigations,
    UpdateInvestigationState,
    ListIndicators,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default detective;
