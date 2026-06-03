import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AthenaClient,
  CreateDataCatalogCommand,
  CreateNamedQueryCommand,
  DeleteDataCatalogCommand,
  DeleteNamedQueryCommand,
  GetDataCatalogCommand,
  GetNamedQueryCommand,
  ListDataCatalogsCommand,
  ListNamedQueriesCommand,
} from "@aws-sdk/client-athena";

const awsPort = 4831;
const uiPort = 5831;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("athena data catalogs and named queries e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const athena = () => new AthenaClient({ endpoint, region, credentials });

  test("create, get, list and delete a data catalog", async () => {
    const client = athena();
    const name = `bunsai-e2e-dc-${Date.now()}`;
    await client.send(
      new CreateDataCatalogCommand({
        Name: name,
        Type: "HIVE",
        Description: "bunsai-e2e-catalog",
      }),
    );

    const got = await client.send(new GetDataCatalogCommand({ Name: name }));
    expect(got.DataCatalog?.Name).toBe(name);
    expect(got.DataCatalog?.Type).toBe("HIVE");
    expect(got.DataCatalog?.Description).toBe("bunsai-e2e-catalog");

    const listed = await client.send(new ListDataCatalogsCommand({}));
    const names = (listed.DataCatalogsSummary ?? []).map((c) => c.CatalogName);
    expect(names).toContain(name);

    const deleted = await client.send(
      new DeleteDataCatalogCommand({ Name: name }),
    );
    expect(deleted).toBeDefined();

    const afterList = await client.send(new ListDataCatalogsCommand({}));
    const afterNames = (afterList.DataCatalogsSummary ?? []).map(
      (c) => c.CatalogName,
    );
    expect(afterNames).not.toContain(name);
  });

  test("create, get, list and delete a named query", async () => {
    const client = athena();
    const workGroup = `bunsai-e2e-nq-wg-${Date.now()}`;
    const created = await client.send(
      new CreateNamedQueryCommand({
        Name: "bunsai-e2e-named-query",
        Database: "default",
        QueryString: "SELECT 1",
        WorkGroup: workGroup,
      }),
    );
    const id = created.NamedQueryId;
    expect(id).toBeDefined();

    const got = await client.send(
      new GetNamedQueryCommand({ NamedQueryId: id }),
    );
    expect(got.NamedQuery?.NamedQueryId).toBe(id ?? "");
    expect(got.NamedQuery?.Name).toBe("bunsai-e2e-named-query");
    expect(got.NamedQuery?.Database).toBe("default");
    expect(got.NamedQuery?.QueryString).toBe("SELECT 1");
    expect(got.NamedQuery?.WorkGroup).toBe(workGroup);

    const listed = await client.send(
      new ListNamedQueriesCommand({ WorkGroup: workGroup }),
    );
    expect(listed.NamedQueryIds ?? []).toContain(id);

    const deleted = await client.send(
      new DeleteNamedQueryCommand({ NamedQueryId: id }),
    );
    expect(deleted).toBeDefined();

    const afterList = await client.send(
      new ListNamedQueriesCommand({ WorkGroup: workGroup }),
    );
    expect(afterList.NamedQueryIds ?? []).not.toContain(id);
  });
});
