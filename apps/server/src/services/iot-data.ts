import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import iotDataModel from "../../../../test/vendor/aws-models/iot-data.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(iotDataModel);

type ShadowState = {
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
};

type ShadowMetadataEntry = { timestamp: number };

type StoredShadow = {
  thingName: string;
  shadowName: string;
  state: ShadowState;
  metadata: {
    desired: Record<string, ShadowMetadataEntry>;
    reported: Record<string, ShadowMetadataEntry>;
  };
  version: number;
  timestamp: number;
};

const shadowKey = (thingName: string, shadowName: string) =>
  `shadow:${thingName}:${shadowName}`;
const namedShadowListKey = (thingName: string) => `namedShadows:${thingName}`;

const nowSeconds = () => Math.floor(Date.now() / 1000);

const decodePayload = (payload: unknown): Record<string, unknown> => {
  if (payload instanceof Uint8Array) {
    const text = new TextDecoder().decode(payload);
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>;
  }
  return {};
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
  const updateState = update["state"] as Partial<ShadowState> | undefined;
  const now = nowSeconds();
  const existing = ctx.store.get<StoredShadow>(
    shadowKey(thingName, shadowName),
  );

  const prevDesired = existing?.state.desired ?? {};
  const prevReported = existing?.state.reported ?? {};
  const prevMetaDesired = existing?.metadata.desired ?? {};
  const prevMetaReported = existing?.metadata.reported ?? {};

  const newDesired: Record<string, unknown> = { ...prevDesired };
  const newReported: Record<string, unknown> = { ...prevReported };
  const newMetaDesired: Record<string, ShadowMetadataEntry> = {
    ...prevMetaDesired,
  };
  const newMetaReported: Record<string, ShadowMetadataEntry> = {
    ...prevMetaReported,
  };

  if (updateState?.desired !== undefined) {
    for (const [k, v] of Object.entries(updateState.desired)) {
      if (v === null) {
        delete newDesired[k];
        delete newMetaDesired[k];
      } else {
        newDesired[k] = v;
        newMetaDesired[k] = { timestamp: now };
      }
    }
  }

  if (updateState?.reported !== undefined) {
    for (const [k, v] of Object.entries(updateState.reported)) {
      if (v === null) {
        delete newReported[k];
        delete newMetaReported[k];
      } else {
        newReported[k] = v;
        newMetaReported[k] = { timestamp: now };
      }
    }
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
  ctx.store.set(shadowKey(thingName, shadowName), undefined);
  if (shadowName !== "") {
    const list: string[] =
      ctx.store.get<string[]>(namedShadowListKey(thingName)) ?? [];
    ctx.store.set(
      namedShadowListKey(thingName),
      list.filter((n) => n !== shadowName),
    );
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
  const results: string[] =
    ctx.store.get<string[]>(namedShadowListKey(thingName)) ?? [];
  return {
    results,
    timestamp: nowSeconds(),
  };
};

const Publish: OperationHandler = (input) => {
  void input;
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

    return undefined;
  },
  operations: {
    GetThingShadow,
    UpdateThingShadow,
    DeleteThingShadow,
    ListNamedShadowsForThing,
    Publish,
  },
  model,
} as const satisfies ServiceDefinition;
