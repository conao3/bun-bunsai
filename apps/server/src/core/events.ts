import { parseArn, resourceName } from "./arn.ts";
import type { ScopedStore, ServiceContext } from "./types.ts";

export type Delivery = {
  body: string;
  event: unknown;
  messageAttributes?: Record<string, unknown>;
  subject?: string;
};

export type TargetDeliverer = (
  store: ScopedStore,
  resource: string,
  delivery: Delivery,
  ctx: ServiceContext,
) => void | Promise<void>;

export type EventSourceConsumer = (
  ctx: ServiceContext,
  sourceArn: string,
  records: unknown[],
) => boolean | Promise<boolean>;

export type TaskInvokeResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; cause: string };

export type TaskInvoker = (
  ctx: ServiceContext,
  functionArn: string,
  payload: unknown,
) => Promise<TaskInvokeResult>;

const targets = new Map<string, TargetDeliverer>();
const eventSources: EventSourceConsumer[] = [];
const taskInvokers = new Map<string, TaskInvoker>();

export const registerTarget = (
  service: string,
  deliverer: TargetDeliverer,
): void => {
  targets.set(service, deliverer);
};

export const registerEventSource = (consumer: EventSourceConsumer): void => {
  eventSources.push(consumer);
};

export const deliverToArn = async (
  ctx: ServiceContext,
  arn: string,
  delivery: Delivery,
): Promise<boolean> => {
  const parsed = parseArn(arn);
  if (parsed === undefined) return false;
  const deliverer = targets.get(parsed.service);
  if (deliverer === undefined) return false;
  const store = ctx.storeFor(parsed.service);
  await deliverer(store, resourceName(parsed.resource), delivery, ctx);
  return true;
};

export const registerTaskInvoker = (
  service: string,
  invoker: TaskInvoker,
): void => {
  taskInvokers.set(service, invoker);
};

export const invokeTaskResource = async (
  ctx: ServiceContext,
  functionArn: string,
  payload: unknown,
): Promise<TaskInvokeResult> => {
  const parsed = parseArn(functionArn);
  const service = parsed?.service;
  const invoker = service !== undefined ? taskInvokers.get(service) : undefined;
  if (invoker === undefined) {
    return {
      ok: false,
      error: "States.Runtime",
      cause: `No task invoker for: ${functionArn}`,
    };
  }
  return invoker(ctx, functionArn, payload);
};

export const notifyEventSource = async (
  ctx: ServiceContext,
  sourceArn: string,
  records: unknown[],
): Promise<boolean> => {
  let consumed = false;
  for (const consumer of eventSources) {
    if (await consumer(ctx, sourceArn, records)) consumed = true;
  }
  return consumed;
};
