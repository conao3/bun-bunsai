import { awsError } from "../core/framework.ts";
import { callerArn as iamCallerArn } from "../core/arn.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/ssm-incidents.json", { with: { type: "json" } }),
);

const responsePlanPrefix = "response-plan:" as const;
const incidentPrefix = "incident:" as const;
const timelinePrefix = "timeline:" as const;
const replicationSetPrefix = "replication-set:" as const;
const policyPrefix = "policy:" as const;
const tagsPrefix = "tags:" as const;

type StoredResponsePlan = {
  arn: string;
  name: string;
  displayName: string | undefined;
  incidentTemplate: Record<string, unknown>;
  chatChannel: Record<string, unknown> | undefined;
  engagements: unknown[];
  actions: unknown[];
  integrations: unknown[];
};

type StoredRelatedItem = {
  identifier: Record<string, unknown>;
  generatedId?: string;
  title?: string;
};

type StoredIncidentRecord = {
  arn: string;
  title: string;
  status: string;
  impact: number;
  creationTime: number;
  lastModifiedTime: number;
  lastModifiedBy: string;
  dedupeString: string;
  incidentRecordSource: Record<string, unknown>;
  chatChannel: Record<string, unknown> | undefined;
  notificationTargets: unknown[];
  summary: string | undefined;
  resolvedTime: number | undefined;
  automationExecutions: unknown[];
  relatedItems: StoredRelatedItem[];
};

type StoredTimelineEvent = {
  eventId: string;
  incidentRecordArn: string;
  eventData: string;
  eventTime: number;
  eventType: string;
  eventUpdatedTime: number;
  eventReferences: unknown[];
};

type StoredReplicationSet = {
  arn: string;
  createdBy: string;
  createdTime: number;
  deletionProtected: boolean;
  lastModifiedBy: string;
  lastModifiedTime: number;
  regionMap: Record<string, unknown>;
  status: string;
};

type StoredResourcePolicy = {
  policyId: string;
  resourceArn: string;
  policyDocument: string;
  ramResourceShareRegion: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

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

const requireRecord = (
  input: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const value = recordOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const decodeToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const n = parseInt(token, 10);
  return isNaN(n) ? 0 : n;
};

const encodeToken = (offset: number): string => String(offset);

const matchesCondition = (
  fieldValue: unknown,
  condition: Record<string, unknown>,
): boolean => {
  if ("after" in condition && typeof condition.after === "number") {
    if (typeof fieldValue !== "number" || fieldValue <= condition.after)
      return false;
  }
  if ("before" in condition && typeof condition.before === "number") {
    if (typeof fieldValue !== "number" || fieldValue >= condition.before)
      return false;
  }
  if ("equals" in condition) {
    const eq = recordOrUndefined(condition.equals);
    if (eq !== undefined) {
      if ("integerValues" in eq && Array.isArray(eq.integerValues)) {
        if (!(eq.integerValues as unknown[]).includes(fieldValue)) return false;
      } else if ("stringValues" in eq && Array.isArray(eq.stringValues)) {
        if (!(eq.stringValues as unknown[]).includes(fieldValue)) return false;
      }
    }
  }
  return true;
};

const matchesIncidentFilters = (
  rec: StoredIncidentRecord,
  filters: unknown[],
): boolean => {
  for (const f of filters) {
    const filter = recordOrUndefined(f);
    if (filter === undefined) continue;
    const key = typeof filter.key === "string" ? filter.key : undefined;
    const condition = recordOrUndefined(filter.condition);
    if (key === undefined || condition === undefined) continue;
    let fieldValue: unknown;
    switch (key) {
      case "creationTime":
        fieldValue = rec.creationTime;
        break;
      case "impact":
        fieldValue = rec.impact;
        break;
      case "status":
        fieldValue = rec.status;
        break;
      case "createdBy":
        fieldValue = rec.incidentRecordSource.createdBy;
        break;
    }
    if (!matchesCondition(fieldValue, condition)) return false;
  }
  return true;
};

const matchesTimelineFilters = (
  event: StoredTimelineEvent,
  filters: unknown[],
): boolean => {
  for (const f of filters) {
    const filter = recordOrUndefined(f);
    if (filter === undefined) continue;
    const key = typeof filter.key === "string" ? filter.key : undefined;
    const condition = recordOrUndefined(filter.condition);
    if (key === undefined || condition === undefined) continue;
    let fieldValue: unknown;
    switch (key) {
      case "eventTime":
        fieldValue = event.eventTime;
        break;
      case "eventType":
        fieldValue = event.eventType;
        break;
      case "eventReference": {
        const eq = recordOrUndefined(condition.equals);
        if (
          eq !== undefined &&
          "stringValues" in eq &&
          Array.isArray(eq.stringValues)
        ) {
          const refs = JSON.stringify(event.eventReferences);
          if (!(eq.stringValues as string[]).some((v) => refs.includes(v)))
            return false;
        }
        continue;
      }
    }
    if (!matchesCondition(fieldValue, condition)) return false;
  }
  return true;
};

const responsePlanKey = (arn: string): string => `${responsePlanPrefix}${arn}`;
const incidentKey = (arn: string): string => `${incidentPrefix}${arn}`;
const timelineKey = (incidentArn: string, eventId: string): string =>
  `${timelinePrefix}${incidentArn}:${eventId}`;
const replicationSetKey = (arn: string): string =>
  `${replicationSetPrefix}${arn}`;
const policyKey = (resourceArn: string, policyId: string): string =>
  `${policyPrefix}${resourceArn}:${policyId}`;
const tagsKey = (resourceArn: string): string => `${tagsPrefix}${resourceArn}`;

const buildArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:ssm-incidents::${ctx.account}:response-plan/${name}`;

const buildIncidentArn = (
  ctx: ServiceContext,
  planName: string,
  id: string,
): string =>
  `arn:aws:ssm-incidents::${ctx.account}:incident-record/${planName}/${id}`;

const buildReplicationSetArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ssm-incidents::${ctx.account}:replication-set/${id}`;

const summaryView = (plan: StoredResponsePlan): Record<string, unknown> => ({
  arn: plan.arn,
  name: plan.name,
  displayName: plan.displayName,
});

const incidentSummaryView = (
  rec: StoredIncidentRecord,
): Record<string, unknown> => ({
  arn: rec.arn,
  creationTime: rec.creationTime,
  impact: rec.impact,
  incidentRecordSource: rec.incidentRecordSource,
  resolvedTime: rec.resolvedTime,
  status: rec.status,
  title: rec.title,
});

const requireIncident = (
  ctx: ServiceContext,
  arn: string,
): StoredIncidentRecord => {
  const rec = ctx.store.get<StoredIncidentRecord>(incidentKey(arn));
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Incident record ${arn} not found.`,
      404,
    );
  }
  return rec;
};

const requireReplicationSet = (
  ctx: ServiceContext,
  arn: string,
): StoredReplicationSet => {
  const rs = ctx.store.get<StoredReplicationSet>(replicationSetKey(arn));
  if (rs === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Replication set ${arn} not found.`,
      404,
    );
  }
  return rs;
};

const CreateResponsePlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const incidentTemplate = requireRecord(input, "incidentTemplate");
  const arn = buildArn(ctx, name);
  const existing = ctx.store.get<StoredResponsePlan>(responsePlanKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "ConflictException",
      `Response plan ${name} already exists.`,
      409,
    );
  }
  const plan: StoredResponsePlan = {
    arn,
    name,
    displayName: stringOrUndefined(input.displayName),
    incidentTemplate,
    chatChannel: recordOrUndefined(input.chatChannel),
    engagements: arrayOrEmpty(input.engagements),
    actions: arrayOrEmpty(input.actions),
    integrations: arrayOrEmpty(input.integrations),
  };
  ctx.store.set(responsePlanKey(arn), plan);
  const tags = recordOrUndefined(input.tags) ?? {};
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return { arn };
};

const GetResponsePlan: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const plan = ctx.store.get<StoredResponsePlan>(responsePlanKey(arn));
  if (plan === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Response plan not found.`,
      404,
    );
  }
  return {
    arn: plan.arn,
    name: plan.name,
    displayName: plan.displayName,
    incidentTemplate: plan.incidentTemplate,
    chatChannel: plan.chatChannel,
    engagements: plan.engagements,
    actions: plan.actions,
    integrations: plan.integrations,
  };
};

const ListResponsePlans: OperationHandler = (input, ctx) => {
  const max =
    typeof input.maxResults === "number" ? (input.maxResults as number) : 100;
  const offset = decodeToken(input.nextToken);
  const all = ctx.store
    .list<StoredResponsePlan>()
    .filter((entry) => entry.key.startsWith(responsePlanPrefix))
    .map((entry) => summaryView(entry.value));
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    responsePlanSummaries: page,
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const DeleteResponsePlan: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  ctx.store.delete(responsePlanKey(arn));
  return {};
};

const UpdateResponsePlan: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const plan = ctx.store.get<StoredResponsePlan>(responsePlanKey(arn));
  if (plan === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Response plan not found.`,
      404,
    );
  }
  const updated: StoredResponsePlan = {
    ...plan,
    displayName:
      "displayName" in input
        ? stringOrUndefined(input.displayName)
        : plan.displayName,
    chatChannel:
      "chatChannel" in input
        ? recordOrUndefined(input.chatChannel)
        : plan.chatChannel,
    engagements:
      "engagements" in input
        ? arrayOrEmpty(input.engagements)
        : plan.engagements,
    actions: "actions" in input ? arrayOrEmpty(input.actions) : plan.actions,
    integrations:
      "integrations" in input
        ? arrayOrEmpty(input.integrations)
        : plan.integrations,
    incidentTemplate: {
      ...plan.incidentTemplate,
      ...(typeof input.incidentTemplateTitle === "string"
        ? { title: input.incidentTemplateTitle }
        : {}),
      ...(typeof input.incidentTemplateImpact === "number"
        ? { impact: input.incidentTemplateImpact }
        : {}),
      ...(typeof input.incidentTemplateSummary === "string"
        ? { summary: input.incidentTemplateSummary }
        : {}),
      ...(typeof input.incidentTemplateDedupeString === "string"
        ? { dedupeString: input.incidentTemplateDedupeString }
        : {}),
    },
  };
  ctx.store.set(responsePlanKey(arn), updated);
  return {};
};

const StartIncident: OperationHandler = (input, ctx) => {
  const responsePlanArn = requireString(input, "responsePlanArn");
  const plan = ctx.store.get<StoredResponsePlan>(
    responsePlanKey(responsePlanArn),
  );
  if (plan === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Response plan ${responsePlanArn} not found.`,
      404,
    );
  }
  const incidentId = crypto.randomUUID();
  const planName = responsePlanArn.split("/").pop() ?? plan.name;
  const arn = buildIncidentArn(ctx, planName, incidentId);
  const now = nowSeconds();
  const title =
    stringOrUndefined(input.title) ??
    (typeof plan.incidentTemplate.title === "string"
      ? plan.incidentTemplate.title
      : "Untitled Incident");
  const impact =
    typeof input.impact === "number"
      ? input.impact
      : typeof plan.incidentTemplate.impact === "number"
        ? plan.incidentTemplate.impact
        : 3;
  const triggerDetails = recordOrUndefined(input.triggerDetails);
  const callerArn = iamCallerArn(ctx.account);
  const rec: StoredIncidentRecord = {
    arn,
    title,
    status: "OPEN",
    impact,
    creationTime: now,
    lastModifiedTime: now,
    lastModifiedBy: callerArn,
    dedupeString: crypto.randomUUID(),
    incidentRecordSource: {
      createdBy: callerArn,
      source: triggerDetails?.source ?? "manual",
      invokedBy: callerArn,
      resourceArn: responsePlanArn,
    },
    chatChannel: undefined,
    notificationTargets: [],
    summary: undefined,
    resolvedTime: undefined,
    automationExecutions: [],
    relatedItems: arrayOrEmpty(input.relatedItems) as StoredRelatedItem[],
  };
  ctx.store.set(incidentKey(arn), rec);
  return { incidentRecordArn: arn };
};

const GetIncidentRecord: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const rec = requireIncident(ctx, arn);
  return { incidentRecord: rec };
};

const validIncidentStatuses: ReadonlySet<string> = new Set([
  "OPEN",
  "RESOLVED",
]);

const UpdateIncidentRecord: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const rec = requireIncident(ctx, arn);
  const now = nowSeconds();
  const newStatus = stringOrUndefined(input.status as unknown);
  if (newStatus !== undefined && !validIncidentStatuses.has(newStatus)) {
    throw awsError(
      "ValidationException",
      `status must be one of OPEN, RESOLVED.`,
      400,
    );
  }
  const updated: StoredIncidentRecord = {
    ...rec,
    lastModifiedTime: now,
    title: stringOrUndefined(input.title as unknown) ?? rec.title,
    impact: typeof input.impact === "number" ? input.impact : rec.impact,
    status: newStatus ?? rec.status,
    summary:
      "summary" in input
        ? stringOrUndefined(input.summary as unknown)
        : rec.summary,
    chatChannel:
      "chatChannel" in input
        ? recordOrUndefined(input.chatChannel)
        : rec.chatChannel,
    notificationTargets:
      "notificationTargets" in input
        ? arrayOrEmpty(input.notificationTargets)
        : rec.notificationTargets,
    resolvedTime:
      newStatus === "RESOLVED" && rec.resolvedTime === undefined
        ? now
        : rec.resolvedTime,
  };
  ctx.store.set(incidentKey(arn), updated);
  return {};
};

const DeleteIncidentRecord: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  ctx.store.delete(incidentKey(arn));
  return {};
};

const ListIncidentRecords: OperationHandler = (input, ctx) => {
  const filters = Array.isArray(input.filters) ? input.filters : [];
  const max =
    typeof input.maxResults === "number" ? (input.maxResults as number) : 100;
  const offset = decodeToken(input.nextToken);
  const all = ctx.store
    .list<StoredIncidentRecord>()
    .filter((entry) => entry.key.startsWith(incidentPrefix))
    .map((entry) => entry.value)
    .filter((rec) => matchesIncidentFilters(rec, filters));
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    incidentRecordSummaries: page.map(incidentSummaryView),
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const ListIncidentFindings: OperationHandler = (input, _ctx) => {
  requireString(input, "incidentRecordArn");
  return { findings: [] };
};

const BatchGetIncidentFindings: OperationHandler = (input, _ctx) => {
  requireString(input, "incidentRecordArn");
  return { errors: [], findings: [] };
};

const CreateTimelineEvent: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  requireIncident(ctx, incidentRecordArn);
  const eventData = requireString(input, "eventData");
  const eventType = requireString(input, "eventType");
  if (input.eventTime === undefined || input.eventTime === null) {
    throw awsError("ValidationException", "eventTime is required.", 400);
  }
  const eventTime =
    typeof input.eventTime === "number" ? input.eventTime : nowSeconds();
  const eventId = crypto.randomUUID();
  const now = nowSeconds();
  const event: StoredTimelineEvent = {
    eventId,
    incidentRecordArn,
    eventData,
    eventTime,
    eventType,
    eventUpdatedTime: now,
    eventReferences: arrayOrEmpty(input.eventReferences),
  };
  ctx.store.set(timelineKey(incidentRecordArn, eventId), event);
  return { eventId, incidentRecordArn };
};

const GetTimelineEvent: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  const eventId = requireString(input, "eventId");
  const event = ctx.store.get<StoredTimelineEvent>(
    timelineKey(incidentRecordArn, eventId),
  );
  if (event === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Timeline event ${eventId} not found.`,
      404,
    );
  }
  return { event };
};

const UpdateTimelineEvent: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  const eventId = requireString(input, "eventId");
  const key = timelineKey(incidentRecordArn, eventId);
  const event = ctx.store.get<StoredTimelineEvent>(key);
  if (event === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Timeline event ${eventId} not found.`,
      404,
    );
  }
  const now = nowSeconds();
  const updated: StoredTimelineEvent = {
    ...event,
    eventUpdatedTime: now,
    eventData: stringOrUndefined(input.eventData as unknown) ?? event.eventData,
    eventType: stringOrUndefined(input.eventType as unknown) ?? event.eventType,
    eventTime:
      typeof input.eventTime === "number" ? input.eventTime : event.eventTime,
    eventReferences:
      "eventReferences" in input
        ? arrayOrEmpty(input.eventReferences)
        : event.eventReferences,
  };
  ctx.store.set(key, updated);
  return {};
};

const DeleteTimelineEvent: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  const eventId = requireString(input, "eventId");
  ctx.store.delete(timelineKey(incidentRecordArn, eventId));
  return {};
};

const ListTimelineEvents: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  const prefix = `${timelinePrefix}${incidentRecordArn}:`;
  const filters = Array.isArray(input.filters) ? input.filters : [];
  const max =
    typeof input.maxResults === "number" ? (input.maxResults as number) : 100;
  const offset = decodeToken(input.nextToken);
  const sortOrder =
    typeof input.sortOrder === "string" ? input.sortOrder : "ASCENDING";
  const all = ctx.store
    .list<StoredTimelineEvent>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter((e) => matchesTimelineFilters(e, filters))
    .sort((a, b) => {
      const diff = a.eventTime - b.eventTime;
      return sortOrder === "DESCENDING" ? -diff : diff;
    });
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  const eventSummaries = page.map((e) => ({
    eventId: e.eventId,
    eventTime: e.eventTime,
    eventType: e.eventType,
    eventUpdatedTime: e.eventUpdatedTime,
    incidentRecordArn: e.incidentRecordArn,
    eventReferences: e.eventReferences,
  }));
  return {
    eventSummaries,
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const ListRelatedItems: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  const rec = requireIncident(ctx, incidentRecordArn);
  return { relatedItems: rec.relatedItems };
};

const UpdateRelatedItems: OperationHandler = (input, ctx) => {
  const incidentRecordArn = requireString(input, "incidentRecordArn");
  const rec = requireIncident(ctx, incidentRecordArn);
  const update = recordOrUndefined(input.relatedItemsUpdate);
  if (update === undefined) {
    throw awsError(
      "ValidationException",
      "relatedItemsUpdate is required.",
      400,
    );
  }
  let items = [...rec.relatedItems];
  if (update.itemToAdd !== undefined) {
    const toAdd = recordOrUndefined(update.itemToAdd);
    if (toAdd !== undefined) {
      items.push({
        identifier: (recordOrUndefined(toAdd.identifier) ?? {}) as Record<
          string,
          unknown
        >,
        generatedId: crypto.randomUUID(),
        title: stringOrUndefined(toAdd.title),
      });
    }
  }
  if (update.itemToRemove !== undefined) {
    const toRemove = recordOrUndefined(update.itemToRemove);
    if (toRemove !== undefined) {
      items = items.filter(
        (item) => JSON.stringify(item.identifier) !== JSON.stringify(toRemove),
      );
    }
  }
  ctx.store.set(incidentKey(incidentRecordArn), {
    ...rec,
    relatedItems: items,
  });
  return {};
};

const CreateReplicationSet: OperationHandler = (input, ctx) => {
  const regions = recordOrUndefined(input.regions);
  if (regions === undefined) {
    throw awsError("ValidationException", "regions is required.", 400);
  }
  const id = crypto.randomUUID();
  const arn = buildReplicationSetArn(ctx, id);
  const now = nowSeconds();
  const callerArn = iamCallerArn(ctx.account);
  const regionMap: Record<string, unknown> = {};
  for (const regionName of Object.keys(regions)) {
    regionMap[regionName] = {
      status: "ACTIVE",
      statusUpdateDateTime: now,
    };
  }
  const tags = recordOrUndefined(input.tags) ?? {};
  const rs: StoredReplicationSet = {
    arn,
    createdBy: callerArn,
    createdTime: now,
    deletionProtected: false,
    lastModifiedBy: callerArn,
    lastModifiedTime: now,
    regionMap,
    status: "ACTIVE",
  };
  ctx.store.set(replicationSetKey(arn), rs);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return { arn };
};

const GetReplicationSet: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const rs = requireReplicationSet(ctx, arn);
  return { replicationSet: rs };
};

const UpdateReplicationSet: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const rs = requireReplicationSet(ctx, arn);
  const actions = arrayOrEmpty(input.actions);
  const now = nowSeconds();
  const callerArn = iamCallerArn(ctx.account);
  const regionMap = { ...rs.regionMap } as Record<string, unknown>;
  for (const action of actions) {
    const a = recordOrUndefined(action);
    if (a === undefined) continue;
    if (a.addRegionAction !== undefined) {
      const add = recordOrUndefined(a.addRegionAction);
      if (add !== undefined && typeof add.regionName === "string") {
        regionMap[add.regionName] = {
          status: "ACTIVE",
          statusUpdateDateTime: now,
        };
      }
    }
    if (a.deleteRegionAction !== undefined) {
      const del = recordOrUndefined(a.deleteRegionAction);
      if (del !== undefined && typeof del.regionName === "string") {
        if (rs.deletionProtected) {
          throw awsError(
            "ConflictException",
            `Replication set ${arn} is deletion protected.`,
            409,
          );
        }
        if (Object.keys(regionMap).length <= 1) {
          throw awsError(
            "ConflictException",
            `Cannot delete the last region from a replication set.`,
            409,
          );
        }
        delete regionMap[del.regionName];
      }
    }
  }
  ctx.store.set(replicationSetKey(arn), {
    ...rs,
    regionMap,
    lastModifiedTime: now,
    lastModifiedBy: callerArn,
  });
  return {};
};

const DeleteReplicationSet: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  ctx.store.delete(replicationSetKey(arn));
  return {};
};

const ListReplicationSets: OperationHandler = (input, ctx) => {
  const max =
    typeof input.maxResults === "number" ? (input.maxResults as number) : 100;
  const offset = decodeToken(input.nextToken);
  const all = ctx.store
    .list<StoredReplicationSet>()
    .filter((entry) => entry.key.startsWith(replicationSetPrefix))
    .map((entry) => entry.value.arn);
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    replicationSetArns: page,
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const UpdateDeletionProtection: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const rs = requireReplicationSet(ctx, arn);
  const deletionProtected = input.deletionProtected;
  if (typeof deletionProtected !== "boolean") {
    throw awsError(
      "ValidationException",
      "deletionProtected is required.",
      400,
    );
  }
  const now = nowSeconds();
  ctx.store.set(replicationSetKey(arn), {
    ...rs,
    deletionProtected,
    lastModifiedTime: now,
  });
  return {};
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const policy = requireString(input, "policy");
  const policyId = crypto.randomUUID();
  const stored: StoredResourcePolicy = {
    policyId,
    resourceArn,
    policyDocument: policy,
    ramResourceShareRegion: ctx.region,
  };
  ctx.store.set(policyKey(resourceArn, policyId), stored);
  return { policyId };
};

const GetResourcePolicies: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const prefix = `${policyPrefix}${resourceArn}:`;
  const resourcePolicies = ctx.store
    .list<StoredResourcePolicy>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      policyDocument: entry.value.policyDocument,
      policyId: entry.value.policyId,
      ramResourceShareRegion: entry.value.ramResourceShareRegion,
    }));
  return { resourcePolicies };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const polId = requireString(input, "policyId");
  const key = policyKey(resourceArn, polId);
  if (ctx.store.get<StoredResourcePolicy>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource policy ${polId} not found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = recordOrUndefined(input.tags);
  if (tags === undefined) {
    throw awsError("ValidationException", "tags is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  for (const [k, v] of Object.entries(tags)) {
    if (typeof v === "string") existing[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input.tagKeys)
    ? (input.tagKeys as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  for (const k of tagKeys) {
    delete existing[k];
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { tags };
};

const ssmIncidents = {
  name: "ssm-incidents",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.path === "/createResponsePlan" && req.method === "POST") {
      return "CreateResponsePlan";
    }
    if (req.path === "/getResponsePlan" && req.method === "GET") {
      return "GetResponsePlan";
    }
    if (req.path === "/listResponsePlans" && req.method === "POST") {
      return "ListResponsePlans";
    }
    if (req.path === "/deleteResponsePlan" && req.method === "POST") {
      return "DeleteResponsePlan";
    }
    if (req.path === "/updateResponsePlan" && req.method === "POST") {
      return "UpdateResponsePlan";
    }
    if (req.path === "/startIncident" && req.method === "POST") {
      return "StartIncident";
    }
    if (req.path === "/getIncidentRecord" && req.method === "GET") {
      return "GetIncidentRecord";
    }
    if (req.path === "/updateIncidentRecord" && req.method === "POST") {
      return "UpdateIncidentRecord";
    }
    if (req.path === "/deleteIncidentRecord" && req.method === "POST") {
      return "DeleteIncidentRecord";
    }
    if (req.path === "/listIncidentRecords" && req.method === "POST") {
      return "ListIncidentRecords";
    }
    if (req.path === "/listIncidentFindings" && req.method === "POST") {
      return "ListIncidentFindings";
    }
    if (req.path === "/batchGetIncidentFindings" && req.method === "POST") {
      return "BatchGetIncidentFindings";
    }
    if (req.path === "/createTimelineEvent" && req.method === "POST") {
      return "CreateTimelineEvent";
    }
    if (req.path === "/getTimelineEvent" && req.method === "GET") {
      return "GetTimelineEvent";
    }
    if (req.path === "/updateTimelineEvent" && req.method === "POST") {
      return "UpdateTimelineEvent";
    }
    if (req.path === "/deleteTimelineEvent" && req.method === "POST") {
      return "DeleteTimelineEvent";
    }
    if (req.path === "/listTimelineEvents" && req.method === "POST") {
      return "ListTimelineEvents";
    }
    if (req.path === "/listRelatedItems" && req.method === "POST") {
      return "ListRelatedItems";
    }
    if (req.path === "/updateRelatedItems" && req.method === "POST") {
      return "UpdateRelatedItems";
    }
    if (req.path === "/createReplicationSet" && req.method === "POST") {
      return "CreateReplicationSet";
    }
    if (req.path === "/getReplicationSet" && req.method === "GET") {
      return "GetReplicationSet";
    }
    if (req.path === "/updateReplicationSet" && req.method === "POST") {
      return "UpdateReplicationSet";
    }
    if (req.path === "/deleteReplicationSet" && req.method === "POST") {
      return "DeleteReplicationSet";
    }
    if (req.path === "/listReplicationSets" && req.method === "POST") {
      return "ListReplicationSets";
    }
    if (req.path === "/updateDeletionProtection" && req.method === "POST") {
      return "UpdateDeletionProtection";
    }
    if (req.path === "/putResourcePolicy" && req.method === "POST") {
      return "PutResourcePolicy";
    }
    if (req.path === "/getResourcePolicies" && req.method === "POST") {
      return "GetResourcePolicies";
    }
    if (req.path === "/deleteResourcePolicy" && req.method === "POST") {
      return "DeleteResourcePolicy";
    }
    if (req.path.startsWith("/tags/")) {
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      if (req.method === "GET") return "ListTagsForResource";
    }
    return undefined;
  },
  operations: {
    CreateResponsePlan,
    GetResponsePlan,
    ListResponsePlans,
    DeleteResponsePlan,
    UpdateResponsePlan,
    StartIncident,
    GetIncidentRecord,
    UpdateIncidentRecord,
    DeleteIncidentRecord,
    ListIncidentRecords,
    ListIncidentFindings,
    BatchGetIncidentFindings,
    CreateTimelineEvent,
    GetTimelineEvent,
    UpdateTimelineEvent,
    DeleteTimelineEvent,
    ListTimelineEvents,
    ListRelatedItems,
    UpdateRelatedItems,
    CreateReplicationSet,
    GetReplicationSet,
    UpdateReplicationSet,
    DeleteReplicationSet,
    ListReplicationSets,
    UpdateDeletionProtection,
    PutResourcePolicy,
    GetResourcePolicies,
    DeleteResourcePolicy,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default ssmIncidents;
