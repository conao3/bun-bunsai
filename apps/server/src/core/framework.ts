import { parseInput, serializeError, serializeOutput } from "./protocol.ts";
import { scopedStore } from "./state.ts";
import type { StateStore } from "./state.ts";
import type {
  AwsError,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "./types.ts";

export const awsError = (
  code: string,
  message: string,
  statusCode = 400,
): AwsError => ({ __awsError: true, code, message, statusCode });

const isAwsError = (value: unknown): value is AwsError =>
  typeof value === "object" &&
  value !== null &&
  (value as { __awsError?: unknown }).__awsError === true;

export const resolveOperationName = (
  service: ServiceDefinition,
  req: ParsedRequest,
): string | undefined => {
  if (service.resolveOperation !== undefined) {
    return service.resolveOperation(req);
  }
  if (req.target !== undefined) {
    const parts = req.target.split(".");
    return parts[parts.length - 1];
  }
  if (req.protocol === "query") {
    const input = parseInput(req);
    const action = input["Action"];
    if (typeof action === "string") return action;
  }
  return undefined;
};

export type DispatchResult = {
  service: string;
  operation: string;
  statusCode: number;
  body: string;
  contentType: string;
};

export const dispatch = async (
  service: ServiceDefinition,
  req: ParsedRequest,
  store: StateStore,
): Promise<DispatchResult> => {
  const operation = resolveOperationName(service, req);
  const fail = (error: AwsError, op: string): DispatchResult => {
    const serialized = serializeError(service.protocol, error);
    return {
      service: service.name,
      operation: op,
      statusCode: error.statusCode,
      body: serialized.body,
      contentType: serialized.contentType,
    };
  };

  if (operation === undefined) {
    return fail(
      awsError("InvalidAction", "Unable to resolve operation", 400),
      "Unknown",
    );
  }

  const handler = service.operations[operation];
  if (handler === undefined) {
    return fail(
      awsError(
        "InvalidAction",
        `Operation ${operation} is not implemented for ${service.name}`,
        400,
      ),
      operation,
    );
  }

  const ctx: ServiceContext = {
    store: scopedStore(store, {
      account: req.account,
      region: req.region,
      service: service.name,
    }),
    account: req.account,
    region: req.region,
  };

  try {
    const input = parseInput(req);
    const result = await handler(input, ctx, req);
    const serialized = serializeOutput(service.protocol, operation, result);
    return {
      service: service.name,
      operation,
      statusCode: 200,
      body: serialized.body,
      contentType: serialized.contentType,
    };
  } catch (caught) {
    if (isAwsError(caught)) return fail(caught, operation);
    const message = caught instanceof Error ? caught.message : String(caught);
    return fail(awsError("InternalFailure", message, 500), operation);
  }
};
