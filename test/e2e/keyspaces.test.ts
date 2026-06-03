import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateKeyspaceCommand,
  CreateTableCommand,
  DeleteKeyspaceCommand,
  DeleteTableCommand,
  GetKeyspaceCommand,
  GetTableCommand,
  KeyspacesClient,
  ListKeyspacesCommand,
  ListTablesCommand,
} from "@aws-sdk/client-keyspaces";
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

const keyspaces = () =>
  new KeyspacesClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Keyspaces keyspace and table lifecycle", async () => {
  const client = keyspaces();
  const ks = "bunsai_e2e_ks";
  const tbl = "bunsai_e2e_tbl";

  const createdKs = await client.send(
    new CreateKeyspaceCommand({ keyspaceName: ks }),
  );
  expect(createdKs.resourceArn).toContain(ks);

  const fetchedKs = await client.send(
    new GetKeyspaceCommand({ keyspaceName: ks }),
  );
  expect(fetchedKs.keyspaceName).toBe(ks);

  const listedKs = await client.send(new ListKeyspacesCommand({}));
  expect((listedKs.keyspaces ?? []).some((k) => k.keyspaceName === ks)).toBe(
    true,
  );

  await client.send(
    new CreateTableCommand({
      keyspaceName: ks,
      tableName: tbl,
      schemaDefinition: {
        allColumns: [{ name: "id", type: "text" }],
        partitionKeys: [{ name: "id" }],
      },
    }),
  );
  const fetchedTbl = await client.send(
    new GetTableCommand({ keyspaceName: ks, tableName: tbl }),
  );
  expect(fetchedTbl.tableName).toBe(tbl);
  expect(fetchedTbl.status).toBe("ACTIVE");

  const listedTbl = await client.send(
    new ListTablesCommand({ keyspaceName: ks }),
  );
  expect((listedTbl.tables ?? []).some((t) => t.tableName === tbl)).toBe(true);

  await client.send(
    new DeleteTableCommand({ keyspaceName: ks, tableName: tbl }),
  );
  await client.send(new DeleteKeyspaceCommand({ keyspaceName: ks }));
});
