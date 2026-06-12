import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import verifiedpermissionsModel from "../../models/verifiedpermissions.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(verifiedpermissionsModel);

const storePrefix = "ps:" as const;
const policyPrefix = "policy:" as const;
const templatePrefix = "tmpl:" as const;
const idSourcePrefix = "ids:" as const;
const schemaPrefix = "schema:" as const;
const aliasPrefix = "alias:" as const;
const tagPrefix = "tag:" as const;

type ValidationMode = "OFF" | "STRICT";

type StoredPolicyStore = {
  policyStoreId: string;
  arn: string;
  validationSettings: { mode: ValidationMode };
  description?: string;
  deletionProtection?: string;
  createdDate: string;
  lastUpdatedDate: string;
  tags: Record<string, string>;
};

type ParsedCedarPolicy = {
  effect: "permit" | "forbid";
  principal: { entityType: string; entityId: string } | null;
  action: { actionType: string; actionId: string } | null;
  resource: { entityType: string; entityId: string } | null;
};

type StoredPolicy = {
  policyStoreId: string;
  policyId: string;
  policyType: "STATIC" | "TEMPLATE_LINKED";
  definition: Record<string, unknown>;
  createdDate: string;
  lastUpdatedDate: string;
  name?: string;
  parsed: ParsedCedarPolicy | null;
};

type StoredPolicyTemplate = {
  policyStoreId: string;
  policyTemplateId: string;
  statement: string;
  description?: string;
  createdDate: string;
  lastUpdatedDate: string;
  name?: string;
};

type StoredIdentitySource = {
  policyStoreId: string;
  identitySourceId: string;
  configuration: Record<string, unknown>;
  principalEntityType?: string;
  createdDate: string;
  lastUpdatedDate: string;
};

type StoredSchema = {
  policyStoreId: string;
  schema: string;
  createdDate: string;
  lastUpdatedDate: string;
};

type StoredAlias = {
  aliasName: string;
  policyStoreId: string;
  aliasArn: string;
  createdAt: string;
};

const nowIso = (): string => new Date().toISOString();

const nanoid = (): string =>
  Math.random().toString(36).slice(2, 13).toUpperCase().padEnd(11, "0");

const storeArn = (ctx: ServiceContext, storeId: string): string =>
  `arn:aws:verifiedpermissions:${ctx.region ?? "us-east-1"}:${ctx.account ?? "000000000000"}:policy-store/${storeId}`;

const aliasArn = (ctx: ServiceContext, aliasName: string): string =>
  `arn:aws:verifiedpermissions:${ctx.region ?? "us-east-1"}:${ctx.account ?? "000000000000"}:policy-store-alias/${aliasName}`;

const storeKey = (storeId: string): string => `${storePrefix}${storeId}`;
const policyKey = (storeId: string, policyId: string): string =>
  `${policyPrefix}${storeId}:${policyId}`;
const templateKey = (storeId: string, templateId: string): string =>
  `${templatePrefix}${storeId}:${templateId}`;
const idSourceKey = (storeId: string, sourceId: string): string =>
  `${idSourcePrefix}${storeId}:${sourceId}`;
const schemaKey = (storeId: string): string => `${schemaPrefix}${storeId}`;
const aliasKey = (name: string): string => `${aliasPrefix}${name}`;
const tagKey = (arn: string): string => `${tagPrefix}${arn}`;

const ENTITY_PATTERN =
  /^([A-Za-z][A-Za-z0-9_]*(?:::[A-Za-z][A-Za-z0-9_]*)*)::"([^"]*)"$/;

const parseEntityId = (
  s: string,
): { entityType: string; entityId: string } | null => {
  const m = s.trim().match(ENTITY_PATTERN);
  if (!m) return null;
  return { entityType: m[1], entityId: m[2] };
};

const ENTITY_ID_PAT =
  /[A-Za-z][A-Za-z0-9_]*(?:::[A-Za-z][A-Za-z0-9_]*)*::"[^"]*"/;

const CEDAR_FLEX_RE = new RegExp(
  `^\\s*(permit|forbid)\\s*\\(\\s*` +
    `principal(?:\\s*==\\s*(${ENTITY_ID_PAT.source}))?\\s*,\\s*` +
    `action(?:\\s*==\\s*(${ENTITY_ID_PAT.source}))?\\s*,\\s*` +
    `resource(?:\\s*==\\s*(${ENTITY_ID_PAT.source}))?\\s*\\)\\s*;\\s*$`,
);

const parseCedarPolicy = (statement: string): ParsedCedarPolicy | null => {
  const m = statement.trim().match(CEDAR_FLEX_RE);
  if (!m) return null;
  const principal = m[2] ? parseEntityId(m[2]) : null;
  const actionEntity = m[3] ? parseEntityId(m[3]) : null;
  const resource = m[4] ? parseEntityId(m[4]) : null;
  if (m[2] && !principal) return null;
  if (m[3] && !actionEntity) return null;
  if (m[4] && !resource) return null;
  return {
    effect: m[1] as "permit" | "forbid",
    principal,
    action: actionEntity
      ? { actionType: actionEntity.entityType, actionId: actionEntity.entityId }
      : null,
    resource,
  };
};

const substituteTemplateBindings = (
  statement: string,
  principal?: { entityType: string; entityId: string },
  resource?: { entityType: string; entityId: string },
): string => {
  let result = statement;
  if (principal) {
    result = result.replace(
      /\?principal/g,
      `${principal.entityType}::"${principal.entityId}"`,
    );
  }
  if (resource) {
    result = result.replace(
      /\?resource/g,
      `${resource.entityType}::"${resource.entityId}"`,
    );
  }
  return result;
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
  if (!record) return out;
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const v = stringOrUndefined(input[field]);
  if (v === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return v;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const simpleHash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(16);
};

const cltokPrefix = "cltok:" as const;
const clientTokenKey = (op: string, token: string): string =>
  `${cltokPrefix}${op}:${token}`;

type IdempotencyEntry = { paramsHash: string; output: Record<string, unknown> };

const applyClientToken = (
  ctx: ServiceContext,
  op: string,
  clientToken: string | undefined,
  hashableParams: unknown,
  create: () => Record<string, unknown>,
): Record<string, unknown> => {
  if (!clientToken) return create();
  const paramsHash = simpleHash(JSON.stringify(hashableParams));
  const key = clientTokenKey(op, clientToken);
  const existing = ctx.store.get<IdempotencyEntry>(key);
  if (existing) {
    if (existing.paramsHash !== paramsHash) {
      throw awsError(
        "ConflictException",
        "A different resource was already created with this client token.",
        409,
      );
    }
    return existing.output;
  }
  const output = create();
  ctx.store.set(key, { paramsHash, output });
  return output;
};

const parseResourceArnSuffix = (
  arn: string,
): { type: "store" | "alias"; id: string } | null => {
  const colonIdx = arn.lastIndexOf(":");
  if (colonIdx < 0) return null;
  const suffix = arn.slice(colonIdx + 1);
  if (suffix.startsWith("policy-store-alias/")) {
    return { type: "alias", id: suffix.slice("policy-store-alias/".length) };
  }
  if (suffix.startsWith("policy-store/")) {
    return { type: "store", id: suffix.slice("policy-store/".length) };
  }
  return null;
};

const decodeToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const n = parseInt(token, 10);
  return isNaN(n) ? 0 : n;
};

const encodeToken = (offset: number): string => String(offset);

const resolveStoreId = (ctx: ServiceContext, raw: string): string => {
  if (raw.startsWith("policy-store-alias/")) {
    const aliasName = raw.slice("policy-store-alias/".length);
    const alias = ctx.store.get<StoredAlias>(aliasKey(aliasName));
    if (!alias) {
      throw awsError(
        "ResourceNotFoundException",
        `Alias ${aliasName} not found.`,
        404,
      );
    }
    return alias.policyStoreId;
  }
  return raw;
};

const requireStore = (
  ctx: ServiceContext,
  rawId: string,
): StoredPolicyStore => {
  const storeId = resolveStoreId(ctx, rawId);
  const store = ctx.store.get<StoredPolicyStore>(storeKey(storeId));
  if (!store) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyStore ${storeId} not found.`,
      404,
    );
  }
  return store;
};

const storeSummary = (s: StoredPolicyStore): Record<string, unknown> => ({
  policyStoreId: s.policyStoreId,
  arn: s.arn,
  validationSettings: s.validationSettings,
  ...(s.description !== undefined ? { description: s.description } : {}),
  ...(s.deletionProtection !== undefined
    ? { deletionProtection: s.deletionProtection }
    : {}),
  createdDate: s.createdDate,
  lastUpdatedDate: s.lastUpdatedDate,
});

const policySummary = (p: StoredPolicy): Record<string, unknown> => {
  const def = asRecord(p.definition);
  const staticDef = asRecord(def?.["static"]);
  const tlDef = asRecord(def?.["templateLinked"]);

  const out: Record<string, unknown> = {
    policyStoreId: p.policyStoreId,
    policyId: p.policyId,
    policyType: p.policyType,
    createdDate: p.createdDate,
    lastUpdatedDate: p.lastUpdatedDate,
  };

  if (p.name) out["name"] = p.name;

  const parsed = p.parsed;
  if (parsed) {
    if (parsed.principal)
      out["principal"] = {
        entityType: parsed.principal.entityType,
        entityId: parsed.principal.entityId,
      };
    if (parsed.action)
      out["actions"] = [
        {
          actionType: parsed.action.actionType,
          actionId: parsed.action.actionId,
        },
      ];
    if (parsed.resource)
      out["resource"] = {
        entityType: parsed.resource.entityType,
        entityId: parsed.resource.entityId,
      };
    out["effect"] = parsed.effect === "permit" ? "Permit" : "Forbid";
  }

  if (staticDef) {
    out["definition"] = {
      static: { description: staticDef["description"] ?? "" },
    };
  } else if (tlDef) {
    out["definition"] = {
      templateLinked: {
        policyTemplateId: tlDef["policyTemplateId"] ?? "",
        principal: tlDef["principal"],
        resource: tlDef["resource"],
      },
    };
  }

  return out;
};

const policyDetail = (p: StoredPolicy): Record<string, unknown> => {
  const out = policySummary(p);
  const def = asRecord(p.definition);
  const staticDef = asRecord(def?.["static"]);
  if (staticDef) {
    out["definition"] = { static: staticDef };
  }
  return out;
};

type AuthRequest = {
  principal?: { entityType: string; entityId: string };
  action?: { actionType: string; actionId: string };
  resource?: { entityType: string; entityId: string };
};

const evaluateAuthorization = (
  ctx: ServiceContext,
  storeId: string,
  req: AuthRequest,
): {
  decision: "ALLOW" | "DENY";
  determiningPolicies: Array<{ policyId: string }>;
  errors: unknown[];
} => {
  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((e) => e.key.startsWith(`${policyPrefix}${storeId}:`))
    .map((e) => e.value);

  const forbids: string[] = [];
  const permits: string[] = [];

  for (const policy of policies) {
    const p = policy.parsed;
    if (!p) continue;

    const principalMatch =
      !req.principal ||
      !p.principal ||
      (p.principal.entityType === req.principal.entityType &&
        p.principal.entityId === req.principal.entityId);
    const actionMatch =
      !req.action ||
      !p.action ||
      (p.action.actionType === req.action.actionType &&
        p.action.actionId === req.action.actionId);
    const resourceMatch =
      !req.resource ||
      !p.resource ||
      (p.resource.entityType === req.resource.entityType &&
        p.resource.entityId === req.resource.entityId);

    if (principalMatch && actionMatch && resourceMatch) {
      if (p.effect === "forbid") {
        forbids.push(policy.policyId);
      } else {
        permits.push(policy.policyId);
      }
    }
  }

  if (forbids.length > 0) {
    return {
      decision: "DENY",
      determiningPolicies: forbids.map((id) => ({ policyId: id })),
      errors: [],
    };
  }
  if (permits.length > 0) {
    return {
      decision: "ALLOW",
      determiningPolicies: permits.map((id) => ({ policyId: id })),
      errors: [],
    };
  }
  return { decision: "DENY", determiningPolicies: [], errors: [] };
};

const parseEntityIdentifier = (
  value: unknown,
): { entityType: string; entityId: string } | undefined => {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const entityType = stringOrUndefined(rec["entityType"]);
  const entityId = stringOrUndefined(rec["entityId"]);
  if (!entityType || entityId === undefined) return undefined;
  return { entityType, entityId: entityId as string };
};

const parseActionIdentifier = (
  value: unknown,
): { actionType: string; actionId: string } | undefined => {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const actionType = stringOrUndefined(rec["actionType"]);
  const actionId = stringOrUndefined(rec["actionId"]);
  if (!actionType || actionId === undefined) return undefined;
  return { actionType, actionId: actionId as string };
};

const CreatePolicyStore: OperationHandler = (input, ctx) => {
  const validationSettings = asRecord(input["validationSettings"]) ?? {
    mode: "OFF",
  };
  const mode = (stringOrUndefined(validationSettings["mode"]) ??
    "OFF") as ValidationMode;
  const description = stringOrUndefined(input["description"]);
  const deletionProtection = stringOrUndefined(input["deletionProtection"]);
  const tags = stringMapFrom(input["tags"]);
  const clientToken = stringOrUndefined(input["clientToken"]);

  return applyClientToken(
    ctx,
    "CreatePolicyStore",
    clientToken,
    { validationSettings: { mode }, description, deletionProtection, tags },
    () => {
      const policyStoreId = `PS${nanoid()}`;
      const now = nowIso();
      const arn = storeArn(ctx, policyStoreId);

      const store: StoredPolicyStore = {
        policyStoreId,
        arn,
        validationSettings: { mode },
        ...(description !== undefined ? { description } : {}),
        ...(deletionProtection !== undefined ? { deletionProtection } : {}),
        createdDate: now,
        lastUpdatedDate: now,
        tags,
      };

      ctx.store.set(storeKey(policyStoreId), store);
      ctx.store.set(tagKey(arn), tags);

      return { policyStoreId, arn, createdDate: now, lastUpdatedDate: now };
    },
  );
};

const GetPolicyStore: OperationHandler = (input, ctx) => {
  const rawId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawId);
  const result: Record<string, unknown> = storeSummary(store);
  if (input["tags"] === true) {
    result["tags"] = store.tags;
  }
  return result;
};

const UpdatePolicyStore: OperationHandler = (input, ctx) => {
  const rawId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawId);
  const validationSettings = asRecord(input["validationSettings"]);
  const mode = validationSettings
    ? ((stringOrUndefined(validationSettings["mode"]) ??
        store.validationSettings.mode) as ValidationMode)
    : store.validationSettings.mode;
  const description =
    "description" in input
      ? stringOrUndefined(input["description"])
      : store.description;
  const deletionProtection =
    "deletionProtection" in input
      ? stringOrUndefined(input["deletionProtection"])
      : store.deletionProtection;
  const now = nowIso();

  const updated: StoredPolicyStore = {
    ...store,
    validationSettings: { mode },
    ...(description !== undefined ? { description } : {}),
    ...(deletionProtection !== undefined ? { deletionProtection } : {}),
    lastUpdatedDate: now,
  };

  ctx.store.set(storeKey(store.policyStoreId), updated);

  return {
    policyStoreId: store.policyStoreId,
    arn: store.arn,
    createdDate: store.createdDate,
    lastUpdatedDate: now,
  };
};

const DeletePolicyStore: OperationHandler = (input, ctx) => {
  const storeId = requireString(input, "policyStoreId");
  const store = ctx.store.get<StoredPolicyStore>(storeKey(storeId));
  if (!store) return {};
  if (store.deletionProtection === "ENABLED") {
    throw awsError(
      "InvalidStateException",
      "The policy store can't be deleted because deletion protection is enabled.",
      400,
    );
  }
  const childPrefixes = [
    `${policyPrefix}${storeId}:`,
    `${templatePrefix}${storeId}:`,
    `${idSourcePrefix}${storeId}:`,
  ];
  const keysToDelete: string[] = [];
  for (const entry of ctx.store.list()) {
    if (childPrefixes.some((p) => entry.key.startsWith(p))) {
      keysToDelete.push(entry.key);
    }
  }
  for (const k of keysToDelete) ctx.store.delete(k);
  ctx.store.delete(schemaKey(storeId));
  const aliasKeys: string[] = [];
  for (const entry of ctx.store.list<StoredAlias>()) {
    if (
      entry.key.startsWith(aliasPrefix) &&
      entry.value.policyStoreId === storeId
    ) {
      aliasKeys.push(entry.key);
    }
  }
  for (const k of aliasKeys) ctx.store.delete(k);
  ctx.store.delete(storeKey(storeId));
  ctx.store.delete(tagKey(store.arn));
  return {};
};

const ListPolicyStores: OperationHandler = (input, ctx) => {
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 50;
  const offset = decodeToken(input["nextToken"]);
  const all = ctx.store
    .list<StoredPolicyStore>()
    .filter((e) => e.key.startsWith(storePrefix))
    .map((e) => e.value)
    .sort((a, b) => a.policyStoreId.localeCompare(b.policyStoreId));
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    policyStores: page.map((s) => ({
      policyStoreId: s.policyStoreId,
      arn: s.arn,
      createdDate: s.createdDate,
      lastUpdatedDate: s.lastUpdatedDate,
      ...(s.description !== undefined ? { description: s.description } : {}),
      validationSettings: s.validationSettings,
    })),
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const CreatePolicy: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;
  const clientToken = stringOrUndefined(input["clientToken"]);

  const definition = asRecord(input["definition"]);
  if (!definition) {
    throw awsError("ValidationException", "definition is required.", 400);
  }

  const name = stringOrUndefined(input["name"]);

  if (name) {
    const existing = ctx.store
      .list<StoredPolicy>()
      .find(
        (e) =>
          e.key.startsWith(`${policyPrefix}${storeId}:`) &&
          e.value.name === name,
      );
    if (existing) {
      throw awsError(
        "ConflictException",
        `Policy with name ${name} already exists.`,
        409,
      );
    }
  }

  const staticDef = asRecord(definition["static"]);
  const tlDef = asRecord(definition["templateLinked"]);

  let policyType: "STATIC" | "TEMPLATE_LINKED" = "STATIC";
  let parsed: ParsedCedarPolicy | null = null;

  if (staticDef) {
    policyType = "STATIC";
    const statement = stringOrUndefined(staticDef["statement"]);
    if (statement) {
      parsed = parseCedarPolicy(statement);
    }
  } else if (tlDef) {
    policyType = "TEMPLATE_LINKED";
    const templateId = stringOrUndefined(tlDef["policyTemplateId"]);
    if (templateId) {
      const tmpl = ctx.store.get<StoredPolicyTemplate>(
        templateKey(storeId, templateId),
      );
      if (!tmpl) {
        throw awsError(
          "ResourceNotFoundException",
          `PolicyTemplate ${templateId} not found.`,
          404,
        );
      }
      const principalBinding = parseEntityIdentifier(tlDef["principal"]);
      const resourceBinding = parseEntityIdentifier(tlDef["resource"]);
      const substituted = substituteTemplateBindings(
        tmpl.statement,
        principalBinding,
        resourceBinding,
      );
      parsed = parseCedarPolicy(substituted);
    }
  } else {
    throw awsError(
      "ValidationException",
      "definition must contain static or templateLinked.",
      400,
    );
  }

  return applyClientToken(
    ctx,
    "CreatePolicy",
    clientToken,
    { storeId, definition, name },
    () => {
      const policyId = `SP${nanoid()}`;
      const now = nowIso();

      const policy: StoredPolicy = {
        policyStoreId: storeId,
        policyId,
        policyType,
        definition,
        createdDate: now,
        lastUpdatedDate: now,
        ...(name !== undefined ? { name } : {}),
        parsed,
      };

      ctx.store.set(policyKey(storeId, policyId), policy);

      const out: Record<string, unknown> = {
        policyStoreId: storeId,
        policyId,
        policyType,
        createdDate: now,
        lastUpdatedDate: now,
      };

      if (parsed) {
        if (parsed.principal)
          out["principal"] = {
            entityType: parsed.principal.entityType,
            entityId: parsed.principal.entityId,
          };
        if (parsed.action)
          out["actions"] = [
            {
              actionType: parsed.action.actionType,
              actionId: parsed.action.actionId,
            },
          ];
        if (parsed.resource)
          out["resource"] = {
            entityType: parsed.resource.entityType,
            entityId: parsed.resource.entityId,
          };
        out["effect"] = parsed.effect === "permit" ? "Permit" : "Forbid";
      }

      return out;
    },
  );
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const policyId = requireString(input, "policyId");
  const policy = ctx.store.get<StoredPolicy>(
    policyKey(store.policyStoreId, policyId),
  );
  if (!policy) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy ${policyId} not found.`,
      404,
    );
  }
  return policyDetail(policy);
};

const UpdatePolicy: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const policyId = requireString(input, "policyId");
  const existing = ctx.store.get<StoredPolicy>(
    policyKey(store.policyStoreId, policyId),
  );
  if (!existing) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy ${policyId} not found.`,
      404,
    );
  }

  const newName =
    "name" in input ? stringOrUndefined(input["name"]) : existing.name;
  const newDefinition = asRecord(input["definition"]) ?? existing.definition;

  const staticDef = asRecord(newDefinition["static"]);
  let parsed: ParsedCedarPolicy | null = existing.parsed;
  if (staticDef) {
    const statement = stringOrUndefined(staticDef["statement"]);
    if (statement) {
      parsed = parseCedarPolicy(statement);
    }
  }

  const now = nowIso();
  const updated: StoredPolicy = {
    ...existing,
    definition: newDefinition,
    lastUpdatedDate: now,
    ...(newName !== undefined ? { name: newName } : {}),
    parsed,
  };

  ctx.store.set(policyKey(store.policyStoreId, policyId), updated);

  const out: Record<string, unknown> = {
    policyStoreId: store.policyStoreId,
    policyId,
    policyType: updated.policyType,
    createdDate: existing.createdDate,
    lastUpdatedDate: now,
  };

  if (parsed) {
    if (parsed.principal)
      out["principal"] = {
        entityType: parsed.principal.entityType,
        entityId: parsed.principal.entityId,
      };
    if (parsed.action)
      out["actions"] = [
        {
          actionType: parsed.action.actionType,
          actionId: parsed.action.actionId,
        },
      ];
    if (parsed.resource)
      out["resource"] = {
        entityType: parsed.resource.entityType,
        entityId: parsed.resource.entityId,
      };
    out["effect"] = parsed.effect === "permit" ? "Permit" : "Forbid";
  }

  return out;
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const policyId = requireString(input, "policyId");
  const policy = ctx.store.get<StoredPolicy>(
    policyKey(store.policyStoreId, policyId),
  );
  if (!policy) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy ${policyId} not found.`,
      404,
    );
  }
  ctx.store.delete(policyKey(store.policyStoreId, policyId));
  return {};
};

const ListPolicies: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;
  const max =
    typeof input["maxResults"] === "number"
      ? Math.min(input["maxResults"] as number, 50)
      : 10;
  const offset = decodeToken(input["nextToken"]);
  const filter = asRecord(input["filter"]);

  let all = ctx.store
    .list<StoredPolicy>()
    .filter((e) => e.key.startsWith(`${policyPrefix}${storeId}:`))
    .map((e) => e.value);

  if (filter) {
    const policyType = stringOrUndefined(filter["policyType"]);
    if (policyType) {
      all = all.filter((p) => p.policyType === policyType);
    }

    const filterPrincipal = asRecord(filter["principal"]);
    if (filterPrincipal) {
      if (filterPrincipal["unspecified"] === true) {
        all = all.filter((p) => !p.parsed?.principal);
      } else {
        const principalType = stringOrUndefined(filterPrincipal["entityType"]);
        const principalId = stringOrUndefined(filterPrincipal["entityId"]);
        if (principalType !== undefined || principalId !== undefined) {
          all = all.filter((p) => {
            const pp = p.parsed?.principal;
            return (
              pp &&
              pp.entityType === principalType &&
              pp.entityId === principalId
            );
          });
        }
      }
    }

    const filterResource = asRecord(filter["resource"]);
    if (filterResource) {
      if (filterResource["unspecified"] === true) {
        all = all.filter((p) => !p.parsed?.resource);
      } else {
        const resourceType = stringOrUndefined(filterResource["entityType"]);
        const resourceId = stringOrUndefined(filterResource["entityId"]);
        if (resourceType !== undefined || resourceId !== undefined) {
          all = all.filter((p) => {
            const pr = p.parsed?.resource;
            return (
              pr && pr.entityType === resourceType && pr.entityId === resourceId
            );
          });
        }
      }
    }

    const filterTemplateId = stringOrUndefined(filter["policyTemplateId"]);
    if (filterTemplateId) {
      all = all.filter((p) => {
        const def = asRecord(p.definition);
        const tl = asRecord(def?.["templateLinked"]);
        return (
          tl && stringOrUndefined(tl["policyTemplateId"]) === filterTemplateId
        );
      });
    }
  }

  all.sort((a, b) => a.policyId.localeCompare(b.policyId));
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    policies: page.map(policySummary),
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const BatchGetPolicy: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["requests"])
    ? (input["requests"] as unknown[])
    : [];

  const results: unknown[] = [];
  const errors: unknown[] = [];

  for (const req of requests) {
    const r = asRecord(req);
    if (!r) continue;
    const policyStoreId = stringOrUndefined(r["policyStoreId"]);
    const policyId = stringOrUndefined(r["policyId"]);
    if (!policyStoreId || !policyId) continue;

    try {
      const store = ctx.store.get<StoredPolicyStore>(storeKey(policyStoreId));
      if (!store) {
        errors.push({
          policyStoreId,
          policyId,
          code: "POLICY_STORE_NOT_FOUND",
          message: `PolicyStore ${policyStoreId} not found.`,
        });
        continue;
      }
      const policy = ctx.store.get<StoredPolicy>(
        policyKey(policyStoreId, policyId),
      );
      if (!policy) {
        errors.push({
          policyStoreId,
          policyId,
          code: "POLICY_NOT_FOUND",
          message: `Policy ${policyId} not found.`,
        });
        continue;
      }
      results.push(policyDetail(policy));
    } catch {
      errors.push({
        policyStoreId,
        policyId,
        code: "INTERNAL_FAILURE",
        message: "Internal error.",
      });
    }
  }

  return { results, errors };
};

const CreatePolicyTemplate: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;
  const statement = requireString(input, "statement");
  const description = stringOrUndefined(input["description"]);
  const name = stringOrUndefined(input["name"]);
  const clientToken = stringOrUndefined(input["clientToken"]);

  return applyClientToken(
    ctx,
    "CreatePolicyTemplate",
    clientToken,
    { storeId, statement, description, name },
    () => {
      const policyTemplateId = `PT${nanoid()}`;
      const now = nowIso();

      const tmpl: StoredPolicyTemplate = {
        policyStoreId: storeId,
        policyTemplateId,
        statement,
        ...(description !== undefined ? { description } : {}),
        createdDate: now,
        lastUpdatedDate: now,
        ...(name !== undefined ? { name } : {}),
      };

      ctx.store.set(templateKey(storeId, policyTemplateId), tmpl);

      return {
        policyStoreId: storeId,
        policyTemplateId,
        createdDate: now,
        lastUpdatedDate: now,
      };
    },
  );
};

const GetPolicyTemplate: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const templateId = requireString(input, "policyTemplateId");
  const tmpl = ctx.store.get<StoredPolicyTemplate>(
    templateKey(store.policyStoreId, templateId),
  );
  if (!tmpl) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyTemplate ${templateId} not found.`,
      404,
    );
  }
  return {
    policyStoreId: tmpl.policyStoreId,
    policyTemplateId: tmpl.policyTemplateId,
    statement: tmpl.statement,
    ...(tmpl.description !== undefined
      ? { description: tmpl.description }
      : {}),
    createdDate: tmpl.createdDate,
    lastUpdatedDate: tmpl.lastUpdatedDate,
    ...(tmpl.name !== undefined ? { name: tmpl.name } : {}),
  };
};

const UpdatePolicyTemplate: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const templateId = requireString(input, "policyTemplateId");
  const existing = ctx.store.get<StoredPolicyTemplate>(
    templateKey(store.policyStoreId, templateId),
  );
  if (!existing) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyTemplate ${templateId} not found.`,
      404,
    );
  }

  const statement = stringOrUndefined(input["statement"]) ?? existing.statement;
  const description =
    "description" in input
      ? stringOrUndefined(input["description"])
      : existing.description;
  const now = nowIso();

  const updated: StoredPolicyTemplate = {
    ...existing,
    statement,
    ...(description !== undefined ? { description } : {}),
    lastUpdatedDate: now,
  };

  ctx.store.set(templateKey(store.policyStoreId, templateId), updated);

  return {
    policyStoreId: store.policyStoreId,
    policyTemplateId: templateId,
    createdDate: existing.createdDate,
    lastUpdatedDate: now,
  };
};

const DeletePolicyTemplate: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const templateId = requireString(input, "policyTemplateId");
  const tmpl = ctx.store.get<StoredPolicyTemplate>(
    templateKey(store.policyStoreId, templateId),
  );
  if (!tmpl) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyTemplate ${templateId} not found.`,
      404,
    );
  }
  ctx.store.delete(templateKey(store.policyStoreId, templateId));
  return {};
};

const ListPolicyTemplates: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 50;
  const offset = decodeToken(input["nextToken"]);

  const all = ctx.store
    .list<StoredPolicyTemplate>()
    .filter((e) => e.key.startsWith(`${templatePrefix}${storeId}:`))
    .map((e) => e.value)
    .sort((a, b) => a.policyTemplateId.localeCompare(b.policyTemplateId));

  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    policyTemplates: page.map((t) => ({
      policyStoreId: t.policyStoreId,
      policyTemplateId: t.policyTemplateId,
      ...(t.description !== undefined ? { description: t.description } : {}),
      createdDate: t.createdDate,
      lastUpdatedDate: t.lastUpdatedDate,
    })),
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const CreateIdentitySource: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;
  const configuration = asRecord(input["configuration"]) ?? {};
  const principalEntityType = stringOrUndefined(input["principalEntityType"]);
  const clientToken = stringOrUndefined(input["clientToken"]);

  return applyClientToken(
    ctx,
    "CreateIdentitySource",
    clientToken,
    { storeId, configuration, principalEntityType },
    () => {
      const identitySourceId = `IS${nanoid()}`;
      const now = nowIso();

      const source: StoredIdentitySource = {
        policyStoreId: storeId,
        identitySourceId,
        configuration,
        ...(principalEntityType !== undefined ? { principalEntityType } : {}),
        createdDate: now,
        lastUpdatedDate: now,
      };

      ctx.store.set(idSourceKey(storeId, identitySourceId), source);

      return {
        createdDate: now,
        identitySourceId,
        lastUpdatedDate: now,
        policyStoreId: storeId,
      };
    },
  );
};

const GetIdentitySource: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const sourceId = requireString(input, "identitySourceId");
  const source = ctx.store.get<StoredIdentitySource>(
    idSourceKey(store.policyStoreId, sourceId),
  );
  if (!source) {
    throw awsError(
      "ResourceNotFoundException",
      `IdentitySource ${sourceId} not found.`,
      404,
    );
  }
  return {
    policyStoreId: source.policyStoreId,
    identitySourceId: source.identitySourceId,
    configuration: source.configuration,
    ...(source.principalEntityType !== undefined
      ? { principalEntityType: source.principalEntityType }
      : {}),
    createdDate: source.createdDate,
    lastUpdatedDate: source.lastUpdatedDate,
  };
};

const UpdateIdentitySource: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const sourceId = requireString(input, "identitySourceId");
  const existing = ctx.store.get<StoredIdentitySource>(
    idSourceKey(store.policyStoreId, sourceId),
  );
  if (!existing) {
    throw awsError(
      "ResourceNotFoundException",
      `IdentitySource ${sourceId} not found.`,
      404,
    );
  }

  const configuration =
    asRecord(input["updateConfiguration"]) ?? existing.configuration;
  const principalEntityType =
    stringOrUndefined(input["principalEntityType"]) ??
    existing.principalEntityType;
  const now = nowIso();

  const updated: StoredIdentitySource = {
    ...existing,
    configuration,
    ...(principalEntityType !== undefined ? { principalEntityType } : {}),
    lastUpdatedDate: now,
  };

  ctx.store.set(idSourceKey(store.policyStoreId, sourceId), updated);

  return {
    createdDate: existing.createdDate,
    identitySourceId: sourceId,
    lastUpdatedDate: now,
    policyStoreId: store.policyStoreId,
  };
};

const DeleteIdentitySource: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const sourceId = requireString(input, "identitySourceId");
  const source = ctx.store.get<StoredIdentitySource>(
    idSourceKey(store.policyStoreId, sourceId),
  );
  if (!source) {
    throw awsError(
      "ResourceNotFoundException",
      `IdentitySource ${sourceId} not found.`,
      404,
    );
  }
  ctx.store.delete(idSourceKey(store.policyStoreId, sourceId));
  return {};
};

const ListIdentitySources: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 50;
  const offset = decodeToken(input["nextToken"]);

  const all = ctx.store
    .list<StoredIdentitySource>()
    .filter((e) => e.key.startsWith(`${idSourcePrefix}${storeId}:`))
    .map((e) => e.value)
    .sort((a, b) => a.identitySourceId.localeCompare(b.identitySourceId));

  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    identitySources: page.map((s) => ({
      policyStoreId: s.policyStoreId,
      identitySourceId: s.identitySourceId,
      createdDate: s.createdDate,
      lastUpdatedDate: s.lastUpdatedDate,
      ...(s.principalEntityType !== undefined
        ? { principalEntityType: s.principalEntityType }
        : {}),
    })),
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const GetSchema: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const schema = ctx.store.get<StoredSchema>(schemaKey(store.policyStoreId));
  if (!schema) {
    throw awsError(
      "ResourceNotFoundException",
      `Schema for policy store ${store.policyStoreId} not found.`,
      404,
    );
  }
  return {
    policyStoreId: schema.policyStoreId,
    schema: schema.schema,
    createdDate: schema.createdDate,
    lastUpdatedDate: schema.lastUpdatedDate,
    namespaces: [],
  };
};

const PutSchema: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const definition = asRecord(input["definition"]);
  if (!definition) {
    throw awsError("ValidationException", "definition is required.", 400);
  }
  const cedarJson = asRecord(definition["cedarJson"]);
  const schemaStr = cedarJson
    ? JSON.stringify(cedarJson)
    : (stringOrUndefined(definition["cedarJson"]) ?? "{}");

  const now = nowIso();
  const existing = ctx.store.get<StoredSchema>(schemaKey(store.policyStoreId));

  const schema: StoredSchema = {
    policyStoreId: store.policyStoreId,
    schema: schemaStr,
    createdDate: existing?.createdDate ?? now,
    lastUpdatedDate: now,
  };

  ctx.store.set(schemaKey(store.policyStoreId), schema);

  return {
    policyStoreId: store.policyStoreId,
    namespaces: [],
    createdDate: schema.createdDate,
    lastUpdatedDate: now,
  };
};

const CreatePolicyStoreAlias: OperationHandler = (input, ctx) => {
  const aliasName = requireString(input, "aliasName");
  const policyStoreId = requireString(input, "policyStoreId");

  requireStore(ctx, policyStoreId);

  const existing = ctx.store.get<StoredAlias>(aliasKey(aliasName));
  if (existing) {
    throw awsError(
      "ConflictException",
      `Alias ${aliasName} already exists.`,
      409,
    );
  }

  const now = nowIso();
  const arn = aliasArn(ctx, aliasName);

  const alias: StoredAlias = {
    aliasName,
    policyStoreId,
    aliasArn: arn,
    createdAt: now,
  };

  ctx.store.set(aliasKey(aliasName), alias);

  return { aliasName, policyStoreId, aliasArn: arn, createdAt: now };
};

const GetPolicyStoreAlias: OperationHandler = (input, ctx) => {
  const aliasName = requireString(input, "aliasName");
  const alias = ctx.store.get<StoredAlias>(aliasKey(aliasName));
  if (!alias) {
    throw awsError(
      "ResourceNotFoundException",
      `Alias ${aliasName} not found.`,
      404,
    );
  }
  return {
    aliasName: alias.aliasName,
    policyStoreId: alias.policyStoreId,
    aliasArn: alias.aliasArn,
    createdAt: alias.createdAt,
    state: "Active",
  };
};

const DeletePolicyStoreAlias: OperationHandler = (input, ctx) => {
  const aliasName = requireString(input, "aliasName");
  const alias = ctx.store.get<StoredAlias>(aliasKey(aliasName));
  if (!alias) {
    throw awsError(
      "ResourceNotFoundException",
      `Alias ${aliasName} not found.`,
      404,
    );
  }
  ctx.store.delete(aliasKey(aliasName));
  return {};
};

const ListPolicyStoreAliases: OperationHandler = (input, ctx) => {
  const filter = asRecord(input["filter"]);
  const filterStoreId = filter
    ? stringOrUndefined(filter["policyStoreId"])
    : undefined;
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 50;
  const offset = decodeToken(input["nextToken"]);

  let all = ctx.store
    .list<StoredAlias>()
    .filter((e) => e.key.startsWith(aliasPrefix))
    .map((e) => e.value);

  if (filterStoreId) {
    all = all.filter((a) => a.policyStoreId === filterStoreId);
  }

  all.sort((a, b) => a.aliasName.localeCompare(b.aliasName));
  const page = all.slice(offset, offset + max);
  const nextOffset = offset + page.length;
  return {
    policyStoreAliases: page.map((a) => ({
      aliasName: a.aliasName,
      policyStoreId: a.policyStoreId,
      aliasArn: a.aliasArn,
      createdAt: a.createdAt,
      state: "Active",
    })),
    ...(nextOffset < all.length ? { nextToken: encodeToken(nextOffset) } : {}),
  };
};

const IsAuthorized: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);

  const principal = parseEntityIdentifier(input["principal"]);
  const action = parseActionIdentifier(input["action"]);
  const resource = parseEntityIdentifier(input["resource"]);

  const result = evaluateAuthorization(ctx, store.policyStoreId, {
    principal,
    action,
    resource,
  });

  return {
    decision: result.decision,
    determiningPolicies: result.determiningPolicies,
    errors: result.errors,
  };
};

const BatchIsAuthorized: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);

  const requests = Array.isArray(input["requests"])
    ? (input["requests"] as unknown[])
    : [];

  const results = requests.map((req) => {
    const r = asRecord(req) ?? {};
    const principal = parseEntityIdentifier(r["principal"]);
    const action = parseActionIdentifier(r["action"]);
    const resource = parseEntityIdentifier(r["resource"]);

    const result = evaluateAuthorization(ctx, store.policyStoreId, {
      principal,
      action,
      resource,
    });

    return {
      request: req,
      decision: result.decision,
      determiningPolicies: result.determiningPolicies,
      errors: result.errors,
    };
  });

  return { results };
};

const resolveTokenPrincipal = (
  ctx: ServiceContext,
  storeId: string,
  token: string | undefined,
): { entityType: string; entityId: string } | undefined => {
  if (!token) return undefined;
  const claims = decodeJwtPayload(token);
  const sub = claims ? stringOrUndefined(claims["sub"]) : undefined;
  if (!sub) return undefined;
  const idSourceEntry = ctx.store
    .list<StoredIdentitySource>()
    .find((e) => e.key.startsWith(`${idSourcePrefix}${storeId}:`));
  const principalEntityType =
    idSourceEntry?.value.principalEntityType ?? "CognitoUser";
  return { entityType: principalEntityType, entityId: sub };
};

const IsAuthorizedWithToken: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;

  const token =
    stringOrUndefined(input["identityToken"]) ??
    stringOrUndefined(input["accessToken"]);
  const principal = resolveTokenPrincipal(ctx, storeId, token);
  const action = parseActionIdentifier(input["action"]);
  const resource = parseEntityIdentifier(input["resource"]);

  const result = evaluateAuthorization(ctx, storeId, {
    principal,
    action,
    resource,
  });

  return {
    decision: result.decision,
    determiningPolicies: result.determiningPolicies,
    errors: result.errors,
    ...(principal ? { principal } : {}),
  };
};

const BatchIsAuthorizedWithToken: OperationHandler = (input, ctx) => {
  const rawStoreId = requireString(input, "policyStoreId");
  const store = requireStore(ctx, rawStoreId);
  const storeId = store.policyStoreId;

  const token =
    stringOrUndefined(input["identityToken"]) ??
    stringOrUndefined(input["accessToken"]);
  const principal = resolveTokenPrincipal(ctx, storeId, token);

  const requests = Array.isArray(input["requests"])
    ? (input["requests"] as unknown[])
    : [];

  const results = requests.map((req) => {
    const r = asRecord(req) ?? {};
    const action = parseActionIdentifier(r["action"]);
    const resource = parseEntityIdentifier(r["resource"]);

    const result = evaluateAuthorization(ctx, storeId, {
      principal,
      action,
      resource,
    });

    return {
      request: req,
      decision: result.decision,
      determiningPolicies: result.determiningPolicies,
      errors: result.errors,
    };
  });

  return { results };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = stringMapFrom(input["tags"]);

  const arnParsed = parseResourceArnSuffix(resourceArn);
  if (!arnParsed) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }

  if (arnParsed.type === "store") {
    const store = ctx.store.get<StoredPolicyStore>(storeKey(arnParsed.id));
    if (!store) {
      throw awsError(
        "ResourceNotFoundException",
        `Resource ${resourceArn} not found.`,
        404,
      );
    }
    const existing =
      ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
    ctx.store.set(tagKey(resourceArn), { ...existing, ...newTags });
    ctx.store.set(storeKey(arnParsed.id), {
      ...store,
      tags: { ...store.tags, ...newTags },
    });
  } else {
    const alias = ctx.store.get<StoredAlias>(aliasKey(arnParsed.id));
    if (!alias) {
      throw awsError(
        "ResourceNotFoundException",
        `Resource ${resourceArn} not found.`,
        404,
      );
    }
    const existing =
      ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
    ctx.store.set(tagKey(resourceArn), { ...existing, ...newTags });
  }

  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];

  const arnParsed = parseResourceArnSuffix(resourceArn);
  if (!arnParsed) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }

  if (arnParsed.type === "store") {
    const store = ctx.store.get<StoredPolicyStore>(storeKey(arnParsed.id));
    if (!store) {
      throw awsError(
        "ResourceNotFoundException",
        `Resource ${resourceArn} not found.`,
        404,
      );
    }
    const existing =
      ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
    const updated = { ...existing };
    for (const k of tagKeys) delete updated[k];
    ctx.store.set(tagKey(resourceArn), updated);
    const storeTags = { ...store.tags };
    for (const k of tagKeys) delete storeTags[k];
    ctx.store.set(storeKey(arnParsed.id), { ...store, tags: storeTags });
  } else {
    const alias = ctx.store.get<StoredAlias>(aliasKey(arnParsed.id));
    if (!alias) {
      throw awsError(
        "ResourceNotFoundException",
        `Resource ${resourceArn} not found.`,
        404,
      );
    }
    const existing =
      ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
    const updated = { ...existing };
    for (const k of tagKeys) delete updated[k];
    ctx.store.set(tagKey(resourceArn), updated);
  }

  return {};
};

const verifiedpermissions = {
  name: "verifiedpermissions",
  protocol: "json",
  operations: {
    BatchGetPolicy,
    BatchIsAuthorized,
    BatchIsAuthorizedWithToken,
    CreateIdentitySource,
    CreatePolicy,
    CreatePolicyStore,
    CreatePolicyStoreAlias,
    CreatePolicyTemplate,
    DeleteIdentitySource,
    DeletePolicy,
    DeletePolicyStore,
    DeletePolicyStoreAlias,
    DeletePolicyTemplate,
    GetIdentitySource,
    GetPolicy,
    GetPolicyStore,
    GetPolicyStoreAlias,
    GetPolicyTemplate,
    GetSchema,
    IsAuthorized,
    IsAuthorizedWithToken,
    ListIdentitySources,
    ListPolicies,
    ListPolicyStoreAliases,
    ListPolicyStores,
    ListPolicyTemplates,
    ListTagsForResource,
    PutSchema,
    TagResource,
    UntagResource,
    UpdateIdentitySource,
    UpdatePolicy,
    UpdatePolicyStore,
    UpdatePolicyTemplate,
  },
  model,
} as const satisfies ServiceDefinition;

export default verifiedpermissions;
