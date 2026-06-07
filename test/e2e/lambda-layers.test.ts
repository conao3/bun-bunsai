import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CreateFunctionCommand,
  InvokeCommand,
  LambdaClient,
  PublishLayerVersionCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const invokeJson = async (
  client: LambdaClient,
  name: string,
  payload: unknown,
): Promise<Record<string, unknown>> => {
  const res = await client.send(
    new InvokeCommand({
      FunctionName: name,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
  return {
    StatusCode: res.StatusCode,
    FunctionError: res.FunctionError,
    payload: JSON.parse(new TextDecoder().decode(res.Payload)),
  };
};

describe("Lambda layer integration", () => {
  test("layer module is available in handler via NODE_PATH", async () => {
    const client = lambda();

    const layerZip = makeZip({
      "nodejs/node_modules/helper/index.js":
        "exports.greet = (name) => 'hello ' + name;",
    });

    const published = await client.send(
      new PublishLayerVersionCommand({
        LayerName: "test-helper-layer",
        Content: { ZipFile: layerZip },
        CompatibleRuntimes: ["nodejs20.x"],
      }),
    );
    expect(published.Version).toBe(1);
    const layerArn = published.LayerVersionArn!;
    expect(layerArn).toContain(":layer:test-helper-layer:1");

    await client.send(
      new CreateFunctionCommand({
        FunctionName: "fn-with-layer",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js":
              "const helper = require('helper'); exports.handler = async (e) => ({ message: helper.greet(e.name) });",
          }),
        },
        Layers: [layerArn],
      }),
    );

    const r = await invokeJson(client, "fn-with-layer", { name: "world" });
    expect(r.StatusCode).toBe(200);
    expect(r.FunctionError).toBeUndefined();
    expect(r.payload).toEqual({ message: "hello world" });
  });

  test("handler fails to require layer module when no layers attached", async () => {
    const client = lambda();

    await client.send(
      new CreateFunctionCommand({
        FunctionName: "fn-without-layer",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js":
              "const helper = require('helper'); exports.handler = async (e) => ({ message: helper.greet(e.name) });",
          }),
        },
      }),
    );

    const r = await invokeJson(client, "fn-without-layer", { name: "world" });
    expect(r.StatusCode).toBe(200);
    expect(r.FunctionError).toBe("Unhandled");
  });

  test("CreateFunction with missing layer version throws ResourceNotFoundException", async () => {
    const client = lambda();

    const badArn =
      "arn:aws:lambda:us-east-1:000000000000:layer:nonexistent-layer:99";
    const err = await client
      .send(
        new CreateFunctionCommand({
          FunctionName: "fn-bad-layer",
          Runtime: "nodejs20.x",
          Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
          Handler: "index.handler",
          Code: {
            ZipFile: makeZip({ "index.js": "exports.handler = () => {}" }),
          },
          Layers: [badArn],
        }),
      )
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe("ResourceNotFoundException");
  });

  test("UpdateFunctionConfiguration with missing layer throws ResourceNotFoundException", async () => {
    const client = lambda();

    await client.send(
      new CreateFunctionCommand({
        FunctionName: "fn-update-bad-layer",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({ "index.js": "exports.handler = () => {}" }),
        },
      }),
    );

    const badArn =
      "arn:aws:lambda:us-east-1:000000000000:layer:missing-layer:5";
    const err = await client
      .send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: "fn-update-bad-layer",
          Layers: [badArn],
        }),
      )
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe("ResourceNotFoundException");
  });

  test("Layers field is returned in function configuration", async () => {
    const client = lambda();

    const layerZip = makeZip({
      "nodejs/node_modules/my-constants/index.js": "exports.val = 42;",
    });

    const pub = await client.send(
      new PublishLayerVersionCommand({
        LayerName: "test-constants-layer",
        Content: { ZipFile: layerZip },
      }),
    );
    const layerArn = pub.LayerVersionArn!;

    const fn = await client.send(
      new CreateFunctionCommand({
        FunctionName: "fn-layer-config",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js":
              "const u = require('my-constants'); exports.handler = async () => ({ val: u.val });",
          }),
        },
        Layers: [layerArn],
      }),
    );
    expect(fn.Layers).toEqual([{ Arn: layerArn }]);

    const r = await invokeJson(client, "fn-layer-config", {});
    expect(r.FunctionError).toBeUndefined();
    expect(r.payload).toEqual({ val: 42 });
  });
});
