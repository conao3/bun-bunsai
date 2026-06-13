import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "./types.ts";
import { nodeViaBunAdapter } from "./adapters/node-via-bun.ts";

const adapters: RuntimeAdapter[] = [nodeViaBunAdapter];

const probeCache: Map<string, ProbeResult> = new Map();

const probeWithCache = async (
  adapter: RuntimeAdapter,
): Promise<ProbeResult> => {
  const cached = probeCache.get(adapter.id);
  if (cached !== undefined) return cached;
  const result = await adapter.probeHost();
  probeCache.set(adapter.id, result);
  return result;
};

export const findAdapter = (
  runtime: string | undefined,
): RuntimeAdapter | undefined => adapters.find((a) => a.matches(runtime));

export const listAdapters = (): readonly RuntimeAdapter[] => adapters;

export const probeAdapter = (adapter: RuntimeAdapter): Promise<ProbeResult> =>
  probeWithCache(adapter);

export const executeHandler = async (
  args: ExecuteArgs,
): Promise<LambdaExecution> => {
  const adapter = findAdapter(args.runtime);
  if (adapter === undefined)
    return { kind: "unsupported_runtime", runtime: args.runtime };
  const probe = await probeWithCache(adapter);
  if (!probe.ok)
    return {
      kind: "host_runtime_missing",
      runtime: args.runtime ?? "unknown",
      reason: probe.reason,
    };
  return adapter.execute(args);
};
