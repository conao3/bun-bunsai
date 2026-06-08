import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CreateAliasCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  DeleteAliasCommand,
  DeleteFunctionUrlConfigCommand,
  GetAliasCommand,
  GetFunctionUrlConfigCommand,
  InvokeCommand,
  LambdaClient,
  ListAliasesCommand,
  ListVersionsByFunctionCommand,
  PublishVersionCommand,
  UpdateAliasCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionUrlConfigCommand,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

describe("Lambda versions and aliases round-trip", () => {
  test("publish → list → alias CRUD → invoke via alias", async () => {
    const client = lambda();
    const fnName = "fn-ver-alias-rt";

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

    const listed = await client.send(
      new ListVersionsByFunctionCommand({ FunctionName: fnName }),
    );
    const versions = (listed.Versions ?? []).map((v) => v.Version);
    expect(versions).toContain("$LATEST");
    expect(versions).toContain("1");

    await client.send(
      new UpdateFunctionCodeCommand({
        FunctionName: fnName,
        ZipFile: makeZip({
          "index.js": "exports.handler = async () => 'v2';",
        }),
      }),
    );

    const aliasCreated = await client.send(
      new CreateAliasCommand({
        FunctionName: fnName,
        Name: "stable",
        FunctionVersion: "1",
        Description: "points to v1",
      }),
    );
    expect(aliasCreated.FunctionVersion).toBe("1");

    const aliasGot = await client.send(
      new GetAliasCommand({ FunctionName: fnName, Name: "stable" }),
    );
    expect(aliasGot.Description).toBe("points to v1");

    const aliasUpdated = await client.send(
      new UpdateAliasCommand({
        FunctionName: fnName,
        Name: "stable",
        Description: "updated",
      }),
    );
    expect(aliasUpdated.Description).toBe("updated");

    const aliasesList = await client.send(
      new ListAliasesCommand({ FunctionName: fnName }),
    );
    expect((aliasesList.Aliases ?? []).map((a) => a.Name)).toContain("stable");

    const byAlias = await client.send(
      new InvokeCommand({
        FunctionName: fnName,
        Qualifier: "stable",
        Payload: new TextEncoder().encode("{}"),
      }),
    );
    expect(JSON.parse(new TextDecoder().decode(byAlias.Payload))).toBe("v1");

    await client.send(
      new DeleteAliasCommand({ FunctionName: fnName, Name: "stable" }),
    );
    await expect(
      client.send(
        new GetAliasCommand({ FunctionName: fnName, Name: "stable" }),
      ),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  });
});

describe("Lambda function URL config round-trip", () => {
  test("create → get → update → delete", async () => {
    const client = lambda();
    const fnName = "fn-urlcfg-rt";

    await client.send(
      new CreateFunctionCommand({
        FunctionName: fnName,
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: { ZipFile: new TextEncoder().encode("PK fake zip") },
      }),
    );

    const created = await client.send(
      new CreateFunctionUrlConfigCommand({
        FunctionName: fnName,
        AuthType: "NONE",
      }),
    );
    expect(created.FunctionUrl).toContain("lambda-url");
    expect(created.AuthType).toBe("NONE");

    const got = await client.send(
      new GetFunctionUrlConfigCommand({ FunctionName: fnName }),
    );
    expect(got.FunctionUrl).toBe(created.FunctionUrl);

    const updated = await client.send(
      new UpdateFunctionUrlConfigCommand({
        FunctionName: fnName,
        AuthType: "AWS_IAM",
      }),
    );
    expect(updated.AuthType).toBe("AWS_IAM");

    await client.send(
      new DeleteFunctionUrlConfigCommand({ FunctionName: fnName }),
    );
    await expect(
      client.send(new GetFunctionUrlConfigCommand({ FunctionName: fnName })),
    ).rejects.toThrow();
  });
});
