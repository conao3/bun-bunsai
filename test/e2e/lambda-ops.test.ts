import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddPermissionCommand,
  CreateAliasCommand,
  CreateFunctionCommand,
  GetAliasCommand,
  GetFunctionConfigurationCommand,
  GetPolicyCommand,
  LambdaClient,
  ListAliasesCommand,
  ListTagsCommand,
  PublishVersionCommand,
  RemovePermissionCommand,
  TagResourceCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";

const awsPort = 4576;
const uiPort = 5676;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const lambda = () => new LambdaClient({ endpoint, region, credentials });

const createFn = async (
  client: LambdaClient,
  name: string,
): Promise<string> => {
  const created = await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: { ZipFile: new TextEncoder().encode("PK fake zip") },
    }),
  );
  return created.FunctionArn ?? "";
};

test("Lambda GetFunctionConfiguration and UpdateFunctionConfiguration", async () => {
  const client = lambda();
  const name = "bunsai-ops-config";
  await createFn(client, name);

  const cfg = await client.send(
    new GetFunctionConfigurationCommand({ FunctionName: name }),
  );
  expect(cfg.FunctionName).toBe(name);
  expect(cfg.Timeout).toBe(3);
  expect(cfg.MemorySize).toBe(128);

  const updated = await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: name,
      Timeout: 30,
      MemorySize: 256,
      Description: "updated config",
    }),
  );
  expect(updated.Timeout).toBe(30);
  expect(updated.MemorySize).toBe(256);
  expect(updated.Description).toBe("updated config");
  expect(updated.RevisionId).not.toBe(cfg.RevisionId);
});

test("Lambda PublishVersion increments version", async () => {
  const client = lambda();
  const name = "bunsai-ops-publish";
  await createFn(client, name);

  const v1 = await client.send(
    new PublishVersionCommand({ FunctionName: name, Description: "v1" }),
  );
  expect(v1.Version).toBe("1");
  expect(v1.FunctionArn).toContain(`:function:${name}:1`);

  const v2 = await client.send(
    new PublishVersionCommand({ FunctionName: name }),
  );
  expect(v2.Version).toBe("2");
});

test("Lambda alias lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-alias";
  await createFn(client, name);

  const created = await client.send(
    new CreateAliasCommand({
      FunctionName: name,
      Name: "prod",
      FunctionVersion: "1",
      Description: "production alias",
    }),
  );
  expect(created.Name).toBe("prod");
  expect(created.FunctionVersion).toBe("1");
  expect(created.AliasArn).toContain(`:function:${name}:prod`);

  const got = await client.send(
    new GetAliasCommand({ FunctionName: name, Name: "prod" }),
  );
  expect(got.Name).toBe("prod");
  expect(got.Description).toBe("production alias");

  await client.send(
    new CreateAliasCommand({
      FunctionName: name,
      Name: "staging",
      FunctionVersion: "$LATEST",
    }),
  );

  const listed = await client.send(
    new ListAliasesCommand({ FunctionName: name }),
  );
  const names = (listed.Aliases ?? []).map((a) => a.Name);
  expect(names).toContain("prod");
  expect(names).toContain("staging");

  await expect(
    client.send(new GetAliasCommand({ FunctionName: name, Name: "missing" })),
  ).rejects.toThrow();
});

test("Lambda permission policy lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-policy";
  await createFn(client, name);

  const added = await client.send(
    new AddPermissionCommand({
      FunctionName: name,
      StatementId: "s3-invoke",
      Action: "lambda:InvokeFunction",
      Principal: "s3.amazonaws.com",
    }),
  );
  expect(added.Statement).toBeDefined();
  const statement = JSON.parse(added.Statement ?? "{}");
  expect(statement.Sid).toBe("s3-invoke");

  const policy = await client.send(
    new GetPolicyCommand({ FunctionName: name }),
  );
  const parsed = JSON.parse(policy.Policy ?? "{}");
  const sids = (parsed.Statement ?? []).map((s: { Sid: string }) => s.Sid);
  expect(sids).toContain("s3-invoke");

  const removed = await client.send(
    new RemovePermissionCommand({
      FunctionName: name,
      StatementId: "s3-invoke",
    }),
  );
  expect(removed.$metadata.httpStatusCode).toBe(204);

  await expect(
    client.send(new GetPolicyCommand({ FunctionName: name })),
  ).rejects.toThrow();
});

test("Lambda TagResource and ListTags", async () => {
  const client = lambda();
  const name = "bunsai-ops-tags";
  const arn = await createFn(client, name);

  await client.send(
    new TagResourceCommand({
      Resource: arn,
      Tags: { env: "test", team: "bunsai" },
    }),
  );

  const listed = await client.send(new ListTagsCommand({ Resource: arn }));
  expect(listed.Tags?.env).toBe("test");
  expect(listed.Tags?.team).toBe("bunsai");
});
