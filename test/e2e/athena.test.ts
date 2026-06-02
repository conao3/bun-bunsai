import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AthenaClient,
  CreateWorkGroupCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  ListQueryExecutionsCommand,
  ListWorkGroupsCommand,
  StartQueryExecutionCommand,
  StopQueryExecutionCommand,
} from "@aws-sdk/client-athena";

const awsPort = 4566;
const uiPort = 5666;
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

describe("athena e2e", () => {
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

  test("start, get, list and stop a query execution", async () => {
    const client = athena();
    const started = await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 1",
        WorkGroup: "primary",
      }),
    );
    const id = started.QueryExecutionId;
    expect(id).toBeDefined();

    const got = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: id }),
    );
    expect(got.QueryExecution?.QueryExecutionId).toBe(id ?? "");
    expect(got.QueryExecution?.Query).toBe("SELECT 1");
    expect(got.QueryExecution?.Status?.State).toBe("SUCCEEDED");

    const listed = await client.send(
      new ListQueryExecutionsCommand({ WorkGroup: "primary" }),
    );
    expect(listed.QueryExecutionIds ?? []).toContain(id);

    const results = await client.send(
      new GetQueryResultsCommand({ QueryExecutionId: id }),
    );
    expect(results.ResultSet).toBeDefined();
    expect(results.ResultSet?.Rows ?? []).toEqual([]);

    const stopped = await client.send(
      new StopQueryExecutionCommand({ QueryExecutionId: id }),
    );
    expect(stopped).toBeDefined();

    const afterStop = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: id }),
    );
    expect(afterStop.QueryExecution?.Status?.State).toBe("CANCELLED");
  });

  test("create and list work groups", async () => {
    const client = athena();
    const name = `bunsai-e2e-${Date.now()}`;
    await client.send(
      new CreateWorkGroupCommand({ Name: name, Description: "bunsai-e2e-wg" }),
    );

    const listed = await client.send(new ListWorkGroupsCommand({}));
    const names = (listed.WorkGroups ?? []).map((w) => w.Name);
    expect(names).toContain(name);
  });
});
