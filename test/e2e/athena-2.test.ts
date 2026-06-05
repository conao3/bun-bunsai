import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AthenaClient,
  CancelCapacityReservationCommand,
  CreateCapacityReservationCommand,
  CreateDataCatalogCommand,
  CreateNamedQueryCommand,
  CreateNotebookCommand,
  CreatePreparedStatementCommand,
  CreateWorkGroupCommand,
  DeleteCapacityReservationCommand,
  DeleteDataCatalogCommand,
  DeleteNamedQueryCommand,
  DeleteNotebookCommand,
  DeletePreparedStatementCommand,
  DeleteWorkGroupCommand,
  ExportNotebookCommand,
  GetCapacityReservationCommand,
  GetDataCatalogCommand,
  GetNamedQueryCommand,
  GetNotebookMetadataCommand,
  GetPreparedStatementCommand,
  GetSessionStatusCommand,
  GetWorkGroupCommand,
  ListDataCatalogsCommand,
  ListNamedQueriesCommand,
  ListNotebookMetadataCommand,
  ListPreparedStatementsCommand,
  ListTagsForResourceCommand,
  StartCalculationExecutionCommand,
  StartSessionCommand,
  TagResourceCommand,
  TerminateSessionCommand,
  UntagResourceCommand,
  UpdateWorkGroupCommand,
} from "@aws-sdk/client-athena";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("athena data catalogs and named queries e2e", () => {
  const athena = () =>
    new AthenaClient({ endpoint, region, credentials, requestHandler });

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
    expect(listed.NamedQueryIds ?? []).toContain(id ?? "");

    const deleted = await client.send(
      new DeleteNamedQueryCommand({ NamedQueryId: id }),
    );
    expect(deleted).toBeDefined();

    const afterList = await client.send(
      new ListNamedQueriesCommand({ WorkGroup: workGroup }),
    );
    expect(afterList.NamedQueryIds ?? []).not.toContain(id);
  });

  test("workgroup lifecycle: create, get, update, delete", async () => {
    const client = athena();
    const name = `bunsai-e2e-wg-${Date.now()}`;
    await client.send(
      new CreateWorkGroupCommand({ Name: name, Description: "initial" }),
    );

    const got = await client.send(new GetWorkGroupCommand({ WorkGroup: name }));
    expect(got.WorkGroup?.Name).toBe(name);
    expect(got.WorkGroup?.Description).toBe("initial");
    expect(got.WorkGroup?.State).toBe("ENABLED");

    await client.send(
      new UpdateWorkGroupCommand({
        WorkGroup: name,
        Description: "updated",
        State: "DISABLED",
      }),
    );
    const afterUpdate = await client.send(
      new GetWorkGroupCommand({ WorkGroup: name }),
    );
    expect(afterUpdate.WorkGroup?.Description).toBe("updated");
    expect(afterUpdate.WorkGroup?.State).toBe("DISABLED");

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: name }));
  });

  test("prepared statement lifecycle: create, get, list, update, delete", async () => {
    const client = athena();
    const wg = `bunsai-e2e-ps-wg-${Date.now()}`;
    await client.send(new CreateWorkGroupCommand({ Name: wg }));

    await client.send(
      new CreatePreparedStatementCommand({
        StatementName: "my_stmt",
        WorkGroup: wg,
        QueryStatement: "SELECT ?",
        Description: "test stmt",
      }),
    );

    const got = await client.send(
      new GetPreparedStatementCommand({
        StatementName: "my_stmt",
        WorkGroup: wg,
      }),
    );
    expect(got.PreparedStatement?.StatementName).toBe("my_stmt");
    expect(got.PreparedStatement?.QueryStatement).toBe("SELECT ?");

    const listed = await client.send(
      new ListPreparedStatementsCommand({ WorkGroup: wg }),
    );
    const names = (listed.PreparedStatements ?? []).map((s) => s.StatementName);
    expect(names).toContain("my_stmt");

    await client.send(
      new DeletePreparedStatementCommand({
        StatementName: "my_stmt",
        WorkGroup: wg,
      }),
    );
    const afterList = await client.send(
      new ListPreparedStatementsCommand({ WorkGroup: wg }),
    );
    expect(
      (afterList.PreparedStatements ?? []).map((s) => s.StatementName),
    ).not.toContain("my_stmt");
  });

  test("notebook lifecycle: create, get, list, export, delete", async () => {
    const client = athena();
    const wg = `bunsai-e2e-nb-wg-${Date.now()}`;
    await client.send(new CreateWorkGroupCommand({ Name: wg }));

    const created = await client.send(
      new CreateNotebookCommand({ WorkGroup: wg, Name: "my-notebook" }),
    );
    const notebookId = created.NotebookId;
    expect(notebookId).toBeDefined();

    const got = await client.send(
      new GetNotebookMetadataCommand({ NotebookId: notebookId }),
    );
    expect(got.NotebookMetadata?.Name).toBe("my-notebook");
    expect(got.NotebookMetadata?.WorkGroup).toBe(wg);

    const listed = await client.send(
      new ListNotebookMetadataCommand({ WorkGroup: wg }),
    );
    const ids = (listed.NotebookMetadataList ?? []).map((n) => n.NotebookId);
    expect(ids).toContain(notebookId);

    const exported = await client.send(
      new ExportNotebookCommand({ NotebookId: notebookId }),
    );
    expect(exported.NotebookMetadata?.NotebookId).toBe(notebookId);

    await client.send(new DeleteNotebookCommand({ NotebookId: notebookId }));
    const afterList = await client.send(
      new ListNotebookMetadataCommand({ WorkGroup: wg }),
    );
    expect(
      (afterList.NotebookMetadataList ?? []).map((n) => n.NotebookId),
    ).not.toContain(notebookId);
  });

  test("session and calculation execution lifecycle", async () => {
    const client = athena();
    const wg = `bunsai-e2e-sess-wg-${Date.now()}`;
    await client.send(new CreateWorkGroupCommand({ Name: wg }));

    const sessResult = await client.send(
      new StartSessionCommand({
        WorkGroup: wg,
        EngineConfiguration: { MaxConcurrentDpus: 2 },
      }),
    );
    const sessionId = sessResult.SessionId;
    expect(sessionId).toBeDefined();

    const status = await client.send(
      new GetSessionStatusCommand({ SessionId: sessionId }),
    );
    expect(status.Status?.State).toBe("IDLE");

    const calcResult = await client.send(
      new StartCalculationExecutionCommand({
        SessionId: sessionId,
        CodeBlock: "print('hello')",
      }),
    );
    const calcId = calcResult.CalculationExecutionId;
    expect(calcId).toBeDefined();
    expect(calcResult.State).toBe("COMPLETED");

    await client.send(new TerminateSessionCommand({ SessionId: sessionId }));
    const afterStatus = await client.send(
      new GetSessionStatusCommand({ SessionId: sessionId }),
    );
    expect(afterStatus.Status?.State).toBe("TERMINATED");
  });

  test("capacity reservation lifecycle and tags", async () => {
    const client = athena();
    const name = `bunsai-e2e-cr-${Date.now()}`;
    await client.send(
      new CreateCapacityReservationCommand({ Name: name, TargetDpus: 24 }),
    );

    const got = await client.send(
      new GetCapacityReservationCommand({ Name: name }),
    );
    expect(got.CapacityReservation?.Name).toBe(name);
    expect(got.CapacityReservation?.Status).toBe("ACTIVE");
    expect(got.CapacityReservation?.TargetDpus).toBe(24);

    await client.send(new CancelCapacityReservationCommand({ Name: name }));
    const afterCancel = await client.send(
      new GetCapacityReservationCommand({ Name: name }),
    );
    expect(afterCancel.CapacityReservation?.Status).toBe("CANCELLED");

    const arn = `arn:aws:athena:us-east-1:000000000000:capacity-reservation/${name}`;
    await client.send(
      new TagResourceCommand({
        ResourceARN: arn,
        Tags: [{ Key: "env", Value: "test" }],
      }),
    );
    const tagged = await client.send(
      new ListTagsForResourceCommand({ ResourceARN: arn }),
    );
    expect((tagged.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe(
      "test",
    );

    await client.send(
      new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["env"] }),
    );
    const untagged = await client.send(
      new ListTagsForResourceCommand({ ResourceARN: arn }),
    );
    expect((untagged.Tags ?? []).find((t) => t.Key === "env")).toBeUndefined();

    await client.send(new DeleteCapacityReservationCommand({ Name: name }));
  });
});
