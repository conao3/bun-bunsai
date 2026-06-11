import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import bedrockRuntimeModel from "../../../../test/vendor/aws-models/bedrock-runtime.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(bedrockRuntimeModel);

const enc = new TextEncoder();
const dec = new TextDecoder();

const jsonBytes = (value: unknown): Uint8Array =>
  enc.encode(JSON.stringify(value));

const parseBody = (input: Record<string, unknown>): Record<string, unknown> => {
  const raw = input["body"];
  if (raw instanceof Uint8Array && raw.byteLength > 0) {
    try {
      const parsed = JSON.parse(dec.decode(raw));
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
};

const isAnthropicModel = (modelId: string): boolean =>
  modelId.startsWith("anthropic.");

const isTitanModel = (modelId: string): boolean =>
  modelId.startsWith("amazon.titan");

const KNOWN_MODELS = new Set([
  "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "anthropic.claude-3-5-haiku-20241022-v1:0",
  "anthropic.claude-3-opus-20240229-v1:0",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "anthropic.claude-3-haiku-20240307-v1:0",
  "anthropic.claude-instant-v1",
  "anthropic.claude-v2:1",
  "amazon.titan-text-premier-v1:0",
  "amazon.titan-text-express-v1",
  "amazon.titan-text-lite-v1",
  "amazon.titan-embed-text-v1",
  "amazon.titan-embed-text-v2:0",
  "amazon.titan-image-generator-v2:0",
  "meta.llama3-70b-instruct-v1:0",
  "meta.llama3-8b-instruct-v1:0",
]);

const requireKnownModel = (modelId: string): void => {
  if (!KNOWN_MODELS.has(modelId))
    throw awsError(
      "ResourceNotFoundException",
      `The provided model identifier is invalid: ${modelId}`,
      404,
    );
};

const stubTextFromBody = (
  body: Record<string, unknown>,
  modelId: string,
): string => {
  if (isAnthropicModel(modelId)) {
    const messages = body["messages"] as
      | Array<Record<string, unknown>>
      | undefined;
    const lastMsg = messages?.[messages.length - 1];
    const content = lastMsg?.["content"];
    const prompt =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? (((content[0] as Record<string, unknown>)?.["text"] as string) ??
            "")
          : "";
    return `[stub] Echo: ${prompt.slice(0, 80)}`;
  }
  if (isTitanModel(modelId)) {
    const inputText = (body["inputText"] as string) ?? "";
    return `[stub] Echo: ${inputText.slice(0, 80)}`;
  }
  return "[stub] Response";
};

const InvokeModel: OperationHandler = (input, _ctx) => {
  const modelId = input["modelId"] as string;
  requireKnownModel(modelId);

  const body = parseBody(input);
  const outputText = stubTextFromBody(body, modelId);

  if (isAnthropicModel(modelId)) {
    const responseBody = {
      id: "msg_bunsai_stub",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: outputText }],
      model: modelId,
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: outputText.length },
    };
    return {
      body: jsonBytes(responseBody),
      contentType: "application/json",
    };
  }

  if (isTitanModel(modelId)) {
    const responseBody = {
      inputTextTokenCount: 10,
      results: [
        {
          tokenCount: outputText.length,
          outputText,
          completionReason: "FINISH",
        },
      ],
    };
    return {
      body: jsonBytes(responseBody),
      contentType: "application/json",
    };
  }

  const responseBody = {
    generation: outputText,
    stop_reason: "stop",
  };
  return {
    body: jsonBytes(responseBody),
    contentType: "application/json",
  };
};

const Converse: OperationHandler = (input, _ctx) => {
  const modelId = input["modelId"] as string;
  requireKnownModel(modelId);

  const messages = input["messages"] as
    | Array<Record<string, unknown>>
    | undefined;
  const lastMsg = messages?.[messages.length - 1];
  const content = lastMsg?.["content"];
  const promptText =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? (((content[0] as Record<string, unknown>)?.["text"] as string) ?? "")
        : "";

  const outputText = `[stub] Echo: ${promptText.slice(0, 80)}`;

  return {
    output: {
      message: {
        role: "assistant",
        content: [{ text: outputText }],
      },
    },
    stopReason: "end_turn",
    usage: {
      inputTokens: 10,
      outputTokens: outputText.length,
      totalTokens: 10 + outputText.length,
    },
    metrics: { latencyMs: 1 },
  };
};

const CountTokens: OperationHandler = (input, _ctx) => {
  const modelId = input["modelId"] as string;
  requireKnownModel(modelId);

  const messages = input["messages"] as Array<unknown> | undefined;
  const count = JSON.stringify(messages ?? {}).length;
  return { inputTokenCount: Math.ceil(count / 4) };
};

const streamingNotSupported: OperationHandler = () => {
  throw awsError(
    "ValidationException",
    "Streaming operations are not supported by this stub implementation",
    400,
  );
};

const InvokeModelWithResponseStream: OperationHandler = streamingNotSupported;
const ConverseStream: OperationHandler = streamingNotSupported;
const InvokeModelWithBidirectionalStream: OperationHandler =
  streamingNotSupported;

const ApplyGuardrail: OperationHandler = (input, _ctx) => ({
  usage: {
    topicPolicyUnitsProcessed: 0,
    contentPolicyUnitsProcessed: 0,
    wordPolicyUnitsProcessed: 0,
    sensitiveInformationPolicyUnitsProcessed: 0,
    sensitiveInformationPolicyFreeUnitsProcessed: 0,
    contextualGroundingPolicyUnitsProcessed: 0,
  },
  action: "NONE",
  outputs: [],
  assessments: [],
});

const asyncInvokePrefix = "asyncinvoke:" as const;

const StartAsyncInvoke: OperationHandler = (input, ctx) => {
  const id = `arn:aws:bedrock:${ctx.region}:${ctx.account}:async-invoke/${Date.now()}`;
  ctx.store.set(`${asyncInvokePrefix}${id}`, {
    invocationArn: id,
    modelId: input["modelId"],
    status: "InProgress",
    submitTime: Math.floor(Date.now() / 1000),
  });
  return { invocationArn: id };
};

const GetAsyncInvoke: OperationHandler = (input, ctx) => {
  const arn = input["invocationArn"] as string;
  const inv = ctx.store.get(`${asyncInvokePrefix}${arn}`);
  if (inv === undefined)
    throw awsError(
      "ResourceNotFoundException",
      "Async invocation not found",
      404,
    );
  return inv as Record<string, unknown>;
};

const ListAsyncInvokes: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith(asyncInvokePrefix))
    .map((e) => e.value);
  return { asyncInvokeSummaries: all };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((p) => p !== "");

const bedrockRuntime = {
  name: "bedrock",
  protocol: "rest-json" as const,
  matches: (req: ParsedRequest): boolean => req.path.startsWith("/model/"),
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;
    const [p0, , p2] = parts;

    if (p0 === "model" && m === "POST") {
      if (p2 === "invoke") return "InvokeModel";
      if (p2 === "converse") return "Converse";
      if (p2 === "converse-stream") return "ConverseStream";
      if (p2 === "invoke-with-response-stream")
        return "InvokeModelWithResponseStream";
      if (p2 === "invoke-with-bidirectional-stream")
        return "InvokeModelWithBidirectionalStream";
      if (p2 === "count-tokens") return "CountTokens";
    }

    return undefined;
  },
  operations: {
    InvokeModel,
    Converse,
    ConverseStream,
    InvokeModelWithResponseStream,
    InvokeModelWithBidirectionalStream,
    CountTokens,
    ApplyGuardrail,
    StartAsyncInvoke,
    GetAsyncInvoke,
    ListAsyncInvokes,
  },
  model,
} as const satisfies ServiceDefinition;

export default bedrockRuntime;
