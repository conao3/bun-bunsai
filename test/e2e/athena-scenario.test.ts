import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AthenaClient,
  CreateNamedQueryCommand,
  CreateWorkGroupCommand,
  DeleteNamedQueryCommand,
  DeleteWorkGroupCommand,
  GetNamedQueryCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  GetWorkGroupCommand,
  ListNamedQueriesCommand,
  ListQueryExecutionsCommand,
  StartQueryExecutionCommand,
  StopQueryExecutionCommand,
} from "@aws-sdk/client-athena";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = new AthenaClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("Athena workflow: workgroup setup → query polling to SUCCEEDED → results → named query → cancel → teardown", async () => {
  const wgName = "bunsai-scenario-athena-wg";
  const outputLocation = `s3://bunsai-scenario-bucket/${wgName}/`;

  await client.send(
    new CreateWorkGroupCommand({
      Name: wgName,
      Configuration: {
        ResultConfiguration: { OutputLocation: outputLocation },
      },
    }),
  );

  const wg = await client.send(new GetWorkGroupCommand({ WorkGroup: wgName }));
  expect(wg.WorkGroup?.Name).toBe(wgName);
  expect(wg.WorkGroup?.State).toBe("ENABLED");

  const exec1 = await client.send(
    new StartQueryExecutionCommand({
      QueryString: "SELECT 1",
      WorkGroup: wgName,
    }),
  );
  const execId1 = exec1.QueryExecutionId as string;
  expect(execId1).toBeDefined();

  let finalExec1;
  let state1 = "";
  while (state1 !== "SUCCEEDED") {
    const res = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: execId1 }),
    );
    state1 = res.QueryExecution?.Status?.State ?? "";
    finalExec1 = res.QueryExecution;
  }
  expect(state1).toBe("SUCCEEDED");
  expect(finalExec1?.Status?.CompletionDateTime).toBeDefined();

  const results = await client.send(
    new GetQueryResultsCommand({ QueryExecutionId: execId1 }),
  );
  expect(results.UpdateCount).toBe(0);
  expect(
    results.ResultSet?.ResultSetMetadata?.ColumnInfo?.length ?? 0,
  ).toBeGreaterThan(0);

  const nqResult = await client.send(
    new CreateNamedQueryCommand({
      Name: "bunsai-scenario-saved-query",
      Database: "default",
      QueryString: "SELECT 1",
      WorkGroup: wgName,
    }),
  );
  const nqId = nqResult.NamedQueryId as string;
  expect(nqId).toBeDefined();

  const nq = await client.send(
    new GetNamedQueryCommand({ NamedQueryId: nqId }),
  );
  expect(nq.NamedQuery?.Name).toBe("bunsai-scenario-saved-query");
  expect(nq.NamedQuery?.Database).toBe("default");
  expect(nq.NamedQuery?.QueryString).toBe("SELECT 1");
  expect(nq.NamedQuery?.WorkGroup).toBe(wgName);

  const listedNq = await client.send(
    new ListNamedQueriesCommand({ WorkGroup: wgName }),
  );
  expect(listedNq.NamedQueryIds ?? []).toContain(nqId);

  const exec2 = await client.send(
    new StartQueryExecutionCommand({
      QueryString: "SELECT 2",
      WorkGroup: wgName,
    }),
  );
  const execId2 = exec2.QueryExecutionId as string;
  expect(execId2).toBeDefined();

  await client.send(
    new StopQueryExecutionCommand({ QueryExecutionId: execId2 }),
  );

  const cancelledExec = await client.send(
    new GetQueryExecutionCommand({ QueryExecutionId: execId2 }),
  );
  expect(cancelledExec.QueryExecution?.Status?.State).toBe("CANCELLED");

  const listed = await client.send(
    new ListQueryExecutionsCommand({ WorkGroup: wgName }),
  );
  const execIds = listed.QueryExecutionIds ?? [];
  expect(execIds).toContain(execId1);
  expect(execIds).toContain(execId2);

  await client.send(new DeleteNamedQueryCommand({ NamedQueryId: nqId }));
  await expect(
    client.send(new GetNamedQueryCommand({ NamedQueryId: nqId })),
  ).rejects.toThrow();

  await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  await expect(
    client.send(new GetWorkGroupCommand({ WorkGroup: wgName })),
  ).rejects.toThrow();
});
