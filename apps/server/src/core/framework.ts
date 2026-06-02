import { parseInput, serializeError, serializeOutput } from "./protocol.ts";
import { scopedStore } from "./state.ts";
import type { StateStore } from "./state.ts";
import {
  errorTraitCode,
  resolveInputShape,
  resolveOperation,
  resolveOutputShape,
} from "./shapes.ts";
import type {
  AwsError,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
  ServiceModel,
  StructureShape,
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
  headers?: Record<string, string>;
};

const errorShapeFor = (
  model: ServiceModel,
  operation: string,
  code: string,
): { shape: StructureShape | undefined; wireCode: string } => {
  const op = resolveOperation(model, operation);
  for (const ref of op?.errors ?? []) {
    const shape = model.registry.shapes[ref.shape];
    if (shape === undefined || shape.type !== "structure") continue;
    const trait = errorTraitCode(shape);
    if (ref.shape === code || trait === code)
      return { shape, wireCode: trait ?? ref.shape };
  }
  return { shape: undefined, wireCode: code };
};

export const dispatch = async (
  service: ServiceDefinition,
  req: ParsedRequest,
  store: StateStore,
): Promise<DispatchResult> => {
  const operation = resolveOperationName(service, req);
  const model = service.model;
  const fail = (error: AwsError, op: string): DispatchResult => {
    let serialized;
    if (model === undefined) {
      serialized = serializeError(service.protocol, error);
    } else {
      const err = errorShapeFor(model, op, error.code);
      serialized = serializeError(service.protocol, error, {
        registry: model.registry,
        shape: err.shape,
        code: err.wireCode,
        jsonVersion: model.metadata.jsonVersion,
      });
    }
    return {
      service: service.name,
      operation: op,
      statusCode: serialized.statusCode ?? error.statusCode,
      body: serialized.body,
      contentType: serialized.contentType,
      ...(serialized.headers !== undefined
        ? { headers: serialized.headers }
        : {}),
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
    const op =
      model === undefined ? undefined : resolveOperation(model, operation);
    const input =
      model === undefined
        ? parseInput(req)
        : parseInput(req, {
            registry: model.registry,
            shape: resolveInputShape(model, operation),
            requestUri: op?.http?.requestUri,
          });
    const result = await handler(input, ctx, req);
    const serialized =
      model === undefined
        ? serializeOutput(service.protocol, operation, result)
        : serializeOutput(service.protocol, operation, result, {
            registry: model.registry,
            shape: resolveOutputShape(model, operation),
            resultWrapper: op?.output?.resultWrapper,
            xmlNamespace: model.metadata.xmlNamespace,
            outputShapeName: op?.output?.shape,
            jsonVersion: model.metadata.jsonVersion,
          });
    return {
      service: service.name,
      operation,
      statusCode: serialized.statusCode ?? op?.http?.responseCode ?? 200,
      body: serialized.body,
      contentType: serialized.contentType,
      ...(serialized.headers !== undefined
        ? { headers: serialized.headers }
        : {}),
    };
  } catch (caught) {
    if (isAwsError(caught)) return fail(caught, operation);
    const message = caught instanceof Error ? caught.message : String(caught);
    return fail(awsError("InternalFailure", message, 500), operation);
  }
};
