import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateSchemaCommand,
  DeleteSchemaCommand,
  DescribeSchemaCommand,
  ListSchemasCommand,
  PersonalizeClient,
} from "@aws-sdk/client-personalize";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
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

const personalize = () =>
  new PersonalizeClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Personalize schema lifecycle", async () => {
  const client = personalize();
  const name = "bunsai-e2e-personalize";
  const schema = JSON.stringify({
    type: "record",
    name: "Interactions",
    namespace: "com.amazonaws.personalize.schema",
    fields: [
      { name: "USER_ID", type: "string" },
      { name: "ITEM_ID", type: "string" },
      { name: "TIMESTAMP", type: "long" },
    ],
    version: "1.0",
  });

  const created = await client.send(new CreateSchemaCommand({ name, schema }));
  expect(created.schemaArn).toContain(name);
  const arn = created.schemaArn ?? "";

  const described = await client.send(
    new DescribeSchemaCommand({ schemaArn: arn }),
  );
  expect(described.schema?.name).toBe(name);
  expect(described.schema?.schemaArn).toBe(arn);
  expect(described.schema?.schema).toBe(schema);

  const listed = await client.send(new ListSchemasCommand({}));
  expect((listed.schemas ?? []).some((s) => s.schemaArn === arn)).toBe(true);

  await client.send(new DeleteSchemaCommand({ schemaArn: arn }));

  const afterDelete = await client.send(new ListSchemasCommand({}));
  expect((afterDelete.schemas ?? []).some((s) => s.schemaArn === arn)).toBe(
    false,
  );
});
