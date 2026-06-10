import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CreateAliasCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  GetAliasCommand,
  GetFunctionUrlConfigCommand,
  InvokeCommand,
  LambdaClient,
  ListAliasesCommand,
  ListVersionsByFunctionCommand,
  PublishVersionCommand,
  UpdateAliasCommand,
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
  qualifier?: string,
): Promise<unknown> => {
  const res = await client.send(
    new InvokeCommand({
      FunctionName: name,
      Payload: new TextEncoder().encode("{}"),
      ...(qualifier !== undefined ? { Qualifier: qualifier } : {}),
    }),
  );
  return JSON.parse(new TextDecoder().decode(res.Payload));
};

test("Lambda blue/green deployment scenario: versions, aliases, and function URL", async () => {
  const client = lambda();
  const fnName = "fn-versioning-scenario";

  await client.send(
    new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js": `exports.handler = async () => ({ marker: "v1" });`,
        }),
      },
    }),
  );

  const v1Published = await client.send(
    new PublishVersionCommand({ FunctionName: fnName }),
  );
  expect(v1Published.Version).toBe("1");

  await client.send(
    new UpdateFunctionCodeCommand({
      FunctionName: fnName,
      ZipFile: makeZip({
        "index.js": `exports.handler = async () => ({ marker: "v2" });`,
      }),
    }),
  );

  const v2Published = await client.send(
    new PublishVersionCommand({ FunctionName: fnName }),
  );
  expect(v2Published.Version).toBe("2");

  await client.send(
    new CreateAliasCommand({
      FunctionName: fnName,
      Name: "live",
      FunctionVersion: "1",
    }),
  );

  const byLive = await invokeJson(client, fnName, "live");
  expect((byLive as { marker: string }).marker).toBe("v1");

  const byVersion1 = await invokeJson(client, fnName, "1");
  expect((byVersion1 as { marker: string }).marker).toBe("v1");

  const byVersion2 = await invokeJson(client, fnName, "2");
  expect((byVersion2 as { marker: string }).marker).toBe("v2");

  const byLatest = await invokeJson(client, fnName);
  expect((byLatest as { marker: string }).marker).toBe("v2");

  await client.send(
    new UpdateAliasCommand({
      FunctionName: fnName,
      Name: "live",
      FunctionVersion: "2",
    }),
  );

  const byLiveAfterSwitch = await invokeJson(client, fnName, "live");
  expect((byLiveAfterSwitch as { marker: string }).marker).toBe("v2");

  const versions = await client.send(
    new ListVersionsByFunctionCommand({ FunctionName: fnName }),
  );
  const versionNums = (versions.Versions ?? []).map((v) => v.Version);
  expect(versionNums).toContain("$LATEST");
  expect(versionNums).toContain("1");
  expect(versionNums).toContain("2");

  const alias = await client.send(
    new GetAliasCommand({ FunctionName: fnName, Name: "live" }),
  );
  expect(alias.Name).toBe("live");
  expect(alias.FunctionVersion).toBe("2");

  const aliases = await client.send(
    new ListAliasesCommand({ FunctionName: fnName }),
  );
  expect((aliases.Aliases ?? []).map((a) => a.Name)).toContain("live");

  const urlConfig = await client.send(
    new CreateFunctionUrlConfigCommand({
      FunctionName: fnName,
      AuthType: "NONE",
    }),
  );
  expect(urlConfig.FunctionUrl).toBeDefined();

  const gotUrlConfig = await client.send(
    new GetFunctionUrlConfigCommand({ FunctionName: fnName }),
  );
  expect(gotUrlConfig.FunctionUrl).toBe(urlConfig.FunctionUrl);
});
