import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CreateAliasCommand,
  CreateFunctionCommand,
  InvokeCommand,
  LambdaClient,
  PublishVersionCommand,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const invokeJson = async (
  client: LambdaClient,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<{
  statusCode: number | undefined;
  payload: unknown;
  error: string | undefined;
}> => {
  const res = await client.send(
    new InvokeCommand({
      FunctionName: name,
      Payload: new TextEncoder().encode("{}"),
      ...extra,
    }),
  );
  return {
    statusCode: res.StatusCode,
    error: res.FunctionError,
    payload: JSON.parse(new TextDecoder().decode(res.Payload)),
  };
};

describe("Lambda version/alias isolation", () => {
  test("Qualifier resolves version snapshot, alias, and $LATEST correctly", async () => {
    const client = lambda();
    const fnName = "fn-version-isolation";

    await client.send(
      new CreateFunctionCommand({
        FunctionName: fnName,
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js": "exports.handler = async () => 'v1';",
          }),
        },
      }),
    );

    const published = await client.send(
      new PublishVersionCommand({ FunctionName: fnName }),
    );
    expect(published.Version).toBe("1");

    await client.send(
      new CreateAliasCommand({
        FunctionName: fnName,
        Name: "prod",
        FunctionVersion: "1",
      }),
    );

    await client.send(
      new UpdateFunctionCodeCommand({
        FunctionName: fnName,
        ZipFile: makeZip({
          "index.js": "exports.handler = async () => 'v2';",
        }),
      }),
    );

    const latest = await invokeJson(client, fnName);
    expect(latest.statusCode).toBe(200);
    expect(latest.error).toBeUndefined();
    expect(latest.payload).toBe("v2");

    const byVersion = await invokeJson(client, fnName, { Qualifier: "1" });
    expect(byVersion.statusCode).toBe(200);
    expect(byVersion.error).toBeUndefined();
    expect(byVersion.payload).toBe("v1");

    const byAlias = await invokeJson(client, fnName, { Qualifier: "prod" });
    expect(byAlias.statusCode).toBe(200);
    expect(byAlias.error).toBeUndefined();
    expect(byAlias.payload).toBe("v1");

    const byLatestQualifier = await invokeJson(client, fnName, {
      Qualifier: "$LATEST",
    });
    expect(byLatestQualifier.statusCode).toBe(200);
    expect(byLatestQualifier.payload).toBe("v2");
  });

  test("invoke missing alias returns ResourceNotFoundException", async () => {
    const client = lambda();
    const fnName = "fn-missing-alias";

    await client.send(
      new CreateFunctionCommand({
        FunctionName: fnName,
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js": "exports.handler = async () => 'ok';",
          }),
        },
      }),
    );

    await expect(
      client.send(
        new InvokeCommand({
          FunctionName: fnName,
          Qualifier: "nonexistent-alias",
          Payload: new TextEncoder().encode("{}"),
        }),
      ),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  });
});
