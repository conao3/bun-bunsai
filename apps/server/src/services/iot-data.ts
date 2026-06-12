import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/iot-data.json", { with: { type: "json" } }),
);

type ShadowState = {
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
};

type StoredShadow = {
  thingName: string;
  shadowName: string;
  state: ShadowState;
  metadata: {
    desired: Record<string, unknown>;
    reported: Record<string, unknown>;
  };
  version: number;
  timestamp: number;
};

type RetainedMessage = {
  topic: string;
  payload: Uint8Array | null;
  qos: number;
  lastModifiedTime: number;
};

const shadowKey = (thingName: string, shadowName: string) =>
  `shadow:${thingName}:${shadowName}`;
const namedShadowListKey = (thingName: string) => `namedShadows:${thingName}`;
const retainedKey = (topic: string) => `retained:${topic}`;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const nowMs = () => Date.now();

const decodePayload = (payload: unknown): Record<string, unknown> | null => {
  if (payload instanceof Uint8Array) {
    const text = new TextDecoder().decode(payload);
    if (text.trim() === "") return null;
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof payload === "string") {
    if (payload.trim() === "") return null;
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>;
  }
  return null;
};

const encodePayload = (obj: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(obj));

const deepDelta = (
  desired: Record<string, unknown>,
  reported: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const delta: Record<string, unknown> = {};
  for (const key of Object.keys(desired)) {
    const d = desired[key];
    const r = reported[key];
    if (
      typeof d === "object" &&
      d !== null &&
      !Array.isArray(d) &&
      typeof r === "object" &&
      r !== null &&
      !Array.isArray(r)
    ) {
      const sub = deepDelta(
        d as Record<string, unknown>,
        r as Record<string, unknown>,
      );
      if (sub !== undefined) delta[key] = sub;
    } else if (JSON.stringify(d) !== JSON.stringify(r)) {
      delta[key] = d;
    }
  }
  return Object.keys(delta).length > 0 ? delta : undefined;
};

const mergeMetadata = (
  prev: Record<string, unknown>,
  updates: Record<string, unknown>,
  timestamp: number,
): Record<string, unknown> => {
  const result = { ...prev };
  for (const [k, v] of Object.entries(updates)) {
    if (v === null) {
      delete result[k];
    } else if (typeof v === "object" && !Array.isArray(v)) {
      const prevChild =
        typeof result[k] === "object" && result[k] !== null
          ? (result[k] as Record<string, unknown>)
          : {};
      result[k] = mergeMetadata(
        prevChild,
        v as Record<string, unknown>,
        timestamp,
      );
    } else {
      result[k] = { timestamp };
    }
  }
  return result;
};

const buildShadowDoc = (stored: StoredShadow): Record<string, unknown> => {
  const delta = deepDelta(stored.state.desired, stored.state.reported);
  const state: Record<string, unknown> = {
    desired: stored.state.desired,
    reported: stored.state.reported,
  };
  if (delta !== undefined) state["delta"] = delta;
  return {
    state,
    metadata: stored.metadata,
    version: stored.version,
    timestamp: stored.timestamp,
  };
};

const paginateList = <T>(
  items: T[],
  nextToken?: string,
  pageSize = 25,
): { items: T[]; nextToken?: string } => {
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString(), 10)
    : 0;
  const page = items.slice(start, start + pageSize);
  const token =
    start + pageSize < items.length
      ? Buffer.from(String(start + pageSize)).toString("base64")
      : undefined;
  return { items: page, nextToken: token };
};

const GetThingShadow: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = data["thingName"] as string;
  const shadowName = (data["shadowName"] as string | undefined) ?? "";
  const stored = ctx.store.get<StoredShadow>(shadowKey(thingName, shadowName));
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `No shadow exists with name: ${shadowName || "(classic)"}`,
      404,
    );
  }
  return { payload: encodePayload(buildShadowDoc(stored)) };
};

const UpdateThingShadow: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = data["thingName"] as string;
  const shadowName = (data["shadowName"] as string | undefined) ?? "";
  const update = decodePayload(data["payload"]);

  if (update === null || !("state" in update)) {
    throw awsError(
      "InvalidRequestException",
      "Invalid shadow document: missing or invalid JSON with 'state' member",
      400,
    );
  }

  const now = nowSeconds();
  const existing = ctx.store.get<StoredShadow>(
    shadowKey(thingName, shadowName),
  );

  const requestVersion = update["version"];
  if (
    typeof requestVersion === "number" &&
    existing !== undefined &&
    existing.version !== requestVersion
  ) {
    throw awsError("ConflictException", "Version conflict", 409);
  }

  const updateState = update["state"] as Partial<ShadowState> | undefined;

  const prevDesired = existing?.state.desired ?? {};
  const prevReported = existing?.state.reported ?? {};
  const prevMetaDesired =
    (existing?.metadata.desired as Record<string, unknown>) ?? {};
  const prevMetaReported =
    (existing?.metadata.reported as Record<string, unknown>) ?? {};

  const newDesired: Record<string, unknown> = { ...prevDesired };
  const newReported: Record<string, unknown> = { ...prevReported };

  let newMetaDesired: Record<string, unknown> = { ...prevMetaDesired };
  let newMetaReported: Record<string, unknown> = { ...prevMetaReported };

  if (updateState?.desired !== undefined) {
    for (const [k, v] of Object.entries(updateState.desired)) {
      if (v === null) {
        delete newDesired[k];
      } else {
        newDesired[k] = v;
      }
    }
    newMetaDesired = mergeMetadata(prevMetaDesired, updateState.desired, now);
  }

  if (updateState?.reported !== undefined) {
    for (const [k, v] of Object.entries(updateState.reported)) {
      if (v === null) {
        delete newReported[k];
      } else {
        newReported[k] = v;
      }
    }
    newMetaReported = mergeMetadata(
      prevMetaReported,
      updateState.reported,
      now,
    );
  }

  const newVersion = (existing?.version ?? 0) + 1;
  const stored: StoredShadow = {
    thingName,
    shadowName,
    state: { desired: newDesired, reported: newReported },
    metadata: { desired: newMetaDesired, reported: newMetaReported },
    version: newVersion,
    timestamp: now,
  };
  ctx.store.set(shadowKey(thingName, shadowName), stored);

  if (shadowName !== "") {
    const list: string[] =
      ctx.store.get<string[]>(namedShadowListKey(thingName)) ?? [];
    if (!list.includes(shadowName)) {
      ctx.store.set(namedShadowListKey(thingName), [...list, shadowName]);
    }
  }

  return { payload: encodePayload(buildShadowDoc(stored)) };
};

const DeleteThingShadow: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = data["thingName"] as string;
  const shadowName = (data["shadowName"] as string | undefined) ?? "";
  const stored = ctx.store.get<StoredShadow>(shadowKey(thingName, shadowName));
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `No shadow exists with name: ${shadowName || "(classic)"}`,
      404,
    );
  }
  ctx.store.delete(shadowKey(thingName, shadowName));
  if (shadowName !== "") {
    const list: string[] =
      ctx.store.get<string[]>(namedShadowListKey(thingName)) ?? [];
    const filtered = list.filter((n) => n !== shadowName);
    if (filtered.length === 0) {
      ctx.store.delete(namedShadowListKey(thingName));
    } else {
      ctx.store.set(namedShadowListKey(thingName), filtered);
    }
  }
  return {
    payload: encodePayload({
      version: stored.version + 1,
      timestamp: nowSeconds(),
    }),
  };
};

const ListNamedShadowsForThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = data["thingName"] as string;
  const nextToken = data["nextToken"] as string | undefined;
  const pageSize = typeof data["pageSize"] === "number" ? data["pageSize"] : 25;
  const allResults: string[] =
    ctx.store.get<string[]>(namedShadowListKey(thingName)) ?? [];
  const { items: results, nextToken: token } = paginateList(
    allResults,
    nextToken,
    pageSize,
  );
  const response: Record<string, unknown> = {
    results,
    timestamp: nowSeconds(),
  };
  if (token !== undefined) response["nextToken"] = token;
  return response;
};

const Publish: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const topic = data["topic"] as string;
  const qos = data["qos"] !== undefined ? Number(data["qos"]) : 0;
  const retain = data["retain"] === true || data["retain"] === "true";
  const payload = data["payload"];

  if (qos !== 0 && qos !== 1) {
    throw awsError("InvalidRequestException", "QoS must be 0 or 1", 400);
  }

  if (retain) {
    const isEmpty =
      payload === undefined ||
      payload === null ||
      (payload instanceof Uint8Array && payload.length === 0) ||
      payload === "";

    if (isEmpty) {
      ctx.store.delete(retainedKey(topic));
    } else {
      const payloadBytes =
        payload instanceof Uint8Array
          ? payload
          : new TextEncoder().encode(String(payload));
      const msg: RetainedMessage = {
        topic,
        payload: payloadBytes,
        qos,
        lastModifiedTime: nowMs(),
      };
      ctx.store.set(retainedKey(topic), msg);
    }
  }

  return {};
};

const GetRetainedMessage: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const topic = data["topic"] as string;
  const msg = ctx.store.get<RetainedMessage>(retainedKey(topic));
  if (!msg) {
    throw awsError(
      "ResourceNotFoundException",
      `No retained message found for topic: ${topic}`,
      404,
    );
  }
  return {
    topic: msg.topic,
    payload: msg.payload,
    qos: msg.qos,
    lastModifiedTime: msg.lastModifiedTime,
  };
};

const ListRetainedMessages: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = data["nextToken"] as string | undefined;
  const maxResults =
    typeof data["maxResults"] === "number" ? data["maxResults"] : 25;

  const allTopics = ctx.store
    .list<RetainedMessage>()
    .filter((e) => e.key.startsWith("retained:"))
    .map((e) => e.key.slice("retained:".length))
    .sort();

  const { items: topics, nextToken: token } = paginateList(
    allTopics,
    nextToken,
    maxResults,
  );

  const retainedTopics = topics.map((t) => {
    const msg = ctx.store.get<RetainedMessage>(retainedKey(t));
    return {
      topic: t,
      qos: msg?.qos ?? 0,
      lastModifiedTime: msg?.lastModifiedTime ?? 0,
    };
  });

  const response: Record<string, unknown> = { retainedTopics };
  if (token !== undefined) response["nextToken"] = token;
  return response;
};

const GetConnection: OperationHandler = (input, _ctx) => {
  const data = input as Record<string, unknown>;
  const clientId = data["clientId"] as string;
  if (!clientId) {
    throw awsError("InvalidRequestException", "clientId is required", 400);
  }
  return {
    connected: false,
    thingName: undefined,
    cleanSession: true,
  };
};

const DeleteConnection: OperationHandler = (input, _ctx) => {
  const data = input as Record<string, unknown>;
  const clientId = data["clientId"] as string;
  if (!clientId) {
    throw awsError("InvalidRequestException", "clientId is required", 400);
  }
  return {};
};

const ListSubscriptions: OperationHandler = (input, _ctx) => {
  const data = input as Record<string, unknown>;
  const clientId = data["clientId"] as string;
  if (!clientId) {
    throw awsError("InvalidRequestException", "clientId is required", 400);
  }
  return { subscriptions: [] };
};

const SendDirectMessage: OperationHandler = (input, _ctx) => {
  const data = input as Record<string, unknown>;
  const clientId = data["clientId"] as string;
  if (!clientId) {
    throw awsError("InvalidRequestException", "clientId is required", 400);
  }
  return {};
};

export default {
  name: "iotdata",
  protocol: "rest-json" as const,
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/^\//, "");
    const parts = path.split("/");

    if (parts[0] === "things" && parts.length === 3 && parts[2] === "shadow") {
      if (req.method === "GET") return "GetThingShadow";
      if (req.method === "POST") return "UpdateThingShadow";
      if (req.method === "DELETE") return "DeleteThingShadow";
      return undefined;
    }

    if (
      parts[0] === "api" &&
      parts[1] === "things" &&
      parts[2] === "shadow" &&
      parts[3] === "ListNamedShadowsForThing"
    ) {
      if (req.method === "GET") return "ListNamedShadowsForThing";
      return undefined;
    }

    if (parts[0] === "topics") {
      if (req.method === "POST") return "Publish";
      return undefined;
    }

    if (parts[0] === "retainedMessage") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListRetainedMessages";
        return undefined;
      }
      if (parts.length >= 2) {
        if (req.method === "GET") return "GetRetainedMessage";
        return undefined;
      }
    }

    if (parts[0] === "connections") {
      if (parts.length === 2) {
        if (req.method === "GET") return "GetConnection";
        if (req.method === "DELETE") return "DeleteConnection";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "subscriptions") {
        if (req.method === "GET") return "ListSubscriptions";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "messages") {
        if (req.method === "POST") return "SendDirectMessage";
        return undefined;
      }
    }

    return undefined;
  },
  operations: {
    GetThingShadow,
    UpdateThingShadow,
    DeleteThingShadow,
    ListNamedShadowsForThing,
    Publish,
    GetRetainedMessage,
    ListRetainedMessages,
    GetConnection,
    DeleteConnection,
    ListSubscriptions,
    SendDirectMessage,
  },
  model,
} as const satisfies ServiceDefinition;
