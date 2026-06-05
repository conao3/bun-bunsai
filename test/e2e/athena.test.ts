import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("athena e2e", () => {
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
