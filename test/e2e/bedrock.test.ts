import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BedrockClient,
  GetFoundationModelCommand,
  ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const bedrock = () =>
  new BedrockClient({ endpoint, region, credentials, requestHandler });

const bedrockRuntime = () =>
  new BedrockRuntimeClient({ endpoint, region, credentials, requestHandler });

test("Bedrock: ListFoundationModels returns seeded catalog", async () => {
  const client = bedrock();
  const result = await client.send(new ListFoundationModelsCommand({}));
  expect(result.modelSummaries).toBeDefined();
  expect(result.modelSummaries!.length).toBeGreaterThan(0);

  const modelIds = result.modelSummaries!.map((m) => m.modelId);
  expect(modelIds).toContain("anthropic.claude-3-5-sonnet-20241022-v2:0");
  expect(modelIds).toContain("amazon.titan-text-express-v1");
});

test("Bedrock: GetFoundationModel returns model details", async () => {
  const client = bedrock();
  const result = await client.send(
    new GetFoundationModelCommand({
      modelIdentifier: "anthropic.claude-3-haiku-20240307-v1:0",
    }),
  );
  expect(result.modelDetails).toBeDefined();
  expect(result.modelDetails!.modelId).toBe(
    "anthropic.claude-3-haiku-20240307-v1:0",
  );
  expect(result.modelDetails!.providerName).toBe("Anthropic");
});

test("Bedrock: GetFoundationModel throws for unknown model", async () => {
  const client = bedrock();
  await expect(
    client.send(
      new GetFoundationModelCommand({
        modelIdentifier: "unknown.fake-model-v1",
      }),
    ),
  ).rejects.toThrow();
});

test("BedrockRuntime: InvokeModel with anthropic model returns correct shape", async () => {
  const client = bedrockRuntime();
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 256,
    messages: [{ role: "user", content: "Hello, world!" }],
  };

  const result = await client.send(
    new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      body: new TextEncoder().encode(JSON.stringify(body)),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  expect(result.body).toBeDefined();
  const responseBody = JSON.parse(new TextDecoder().decode(result.body));
  expect(responseBody.type).toBe("message");
  expect(responseBody.role).toBe("assistant");
  expect(Array.isArray(responseBody.content)).toBe(true);
  expect(responseBody.content[0].type).toBe("text");
  expect(typeof responseBody.content[0].text).toBe("string");
  expect(responseBody.usage).toBeDefined();
  expect(typeof responseBody.usage.input_tokens).toBe("number");
  expect(typeof responseBody.usage.output_tokens).toBe("number");
});

test("BedrockRuntime: InvokeModel with titan model returns correct shape", async () => {
  const client = bedrockRuntime();
  const body = {
    inputText: "Tell me about Bun.js",
    textGenerationConfig: { maxTokenCount: 256 },
  };

  const result = await client.send(
    new InvokeModelCommand({
      modelId: "amazon.titan-text-express-v1",
      body: new TextEncoder().encode(JSON.stringify(body)),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  expect(result.body).toBeDefined();
  const responseBody = JSON.parse(new TextDecoder().decode(result.body));
  expect(typeof responseBody.inputTextTokenCount).toBe("number");
  expect(Array.isArray(responseBody.results)).toBe(true);
  expect(typeof responseBody.results[0].outputText).toBe("string");
  expect(responseBody.results[0].completionReason).toBe("FINISH");
});

test("BedrockRuntime: InvokeModel throws for unknown model", async () => {
  const client = bedrockRuntime();
  await expect(
    client.send(
      new InvokeModelCommand({
        modelId: "unknown.fake-model-v99",
        body: new TextEncoder().encode("{}"),
        contentType: "application/json",
      }),
    ),
  ).rejects.toThrow();
});

test("BedrockRuntime: Converse round-trip returns correct shape", async () => {
  const client = bedrockRuntime();
  const result = await client.send(
    new ConverseCommand({
      modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      messages: [
        {
          role: "user",
          content: [{ text: "What is 2 + 2?" }],
        },
      ],
    }),
  );

  expect(result.output).toBeDefined();
  expect(result.output!.message).toBeDefined();
  expect(result.output!.message!.role).toBe("assistant");
  expect(Array.isArray(result.output!.message!.content)).toBe(true);
  expect(typeof result.output!.message!.content![0].text).toBe("string");
  expect(result.stopReason).toBe("end_turn");
  expect(result.usage).toBeDefined();
  expect(typeof result.usage!.inputTokens).toBe("number");
  expect(typeof result.usage!.outputTokens).toBe("number");
  expect(result.metrics).toBeDefined();
});

test("BedrockRuntime: Converse throws for unknown model", async () => {
  const client = bedrockRuntime();
  await expect(
    client.send(
      new ConverseCommand({
        modelId: "unknown.model-xyz",
        messages: [{ role: "user", content: [{ text: "hi" }] }],
      }),
    ),
  ).rejects.toThrow();
});
