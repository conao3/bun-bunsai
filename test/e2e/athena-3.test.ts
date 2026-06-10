import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AthenaClient,
  BatchGetNamedQueryCommand,
  CreateNamedQueryCommand,
  CreateWorkGroupCommand,
  DeleteWorkGroupCommand,
  GetQueryExecutionCommand,
  GetWorkGroupCommand,
  ListQueryExecutionsCommand,
  ListSessionsCommand,
  ListTagsForResourceCommand,
  ListWorkGroupsCommand,
  StartQueryExecutionCommand,
  StartSessionCommand,
  TerminateSessionCommand,
  UpdateWorkGroupCommand,
} from "@aws-sdk/client-athena";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("athena workgroups with configuration and StartQueryExecution enforcement", () => {
  const athena = () =>
    new AthenaClient({ endpoint, region, credentials, requestHandler });

  test("workgroup with ResultConfiguration OutputLocation is honored by StartQueryExecution", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-wg-cfg-${Date.now()}`;
    const outputLocation = `s3://bunsai-e2e-bucket/${wgName}/`;

    await client.send(
      new CreateWorkGroupCommand({
        Name: wgName,
        Configuration: {
          ResultConfiguration: { OutputLocation: outputLocation },
          EnforceWorkGroupConfiguration: true,
        },
      }),
    );

    const got = await client.send(
      new GetWorkGroupCommand({ WorkGroup: wgName }),
    );
    expect(got.WorkGroup?.Name).toBe(wgName);
    expect(got.WorkGroup?.State).toBe("ENABLED");
    expect(
      (
        got.WorkGroup?.Configuration?.ResultConfiguration as {
          OutputLocation?: string;
        }
      )?.OutputLocation,
    ).toBe(outputLocation);
    expect(got.WorkGroup?.Configuration?.EnforceWorkGroupConfiguration).toBe(
      true,
    );

    const execResult = await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 1",
        WorkGroup: wgName,
        ResultConfiguration: { OutputLocation: "s3://ignored-bucket/ignored/" },
      }),
    );
    const execId = execResult.QueryExecutionId;
    expect(execId).toBeDefined();

    const execDetails = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: execId }),
    );
    expect(
      execDetails.QueryExecution?.ResultConfiguration?.OutputLocation,
    ).toBe(outputLocation);

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  });

  test("UpdateWorkGroup ConfigurationUpdates changes ResultConfiguration and EnforceWorkGroupConfiguration", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-wg-upd-${Date.now()}`;

    await client.send(new CreateWorkGroupCommand({ Name: wgName }));

    await client.send(
      new UpdateWorkGroupCommand({
        WorkGroup: wgName,
        ConfigurationUpdates: {
          EnforceWorkGroupConfiguration: true,
          ResultConfigurationUpdates: {
            OutputLocation: "s3://updated-bucket/results/",
          },
        },
      }),
    );

    const got = await client.send(
      new GetWorkGroupCommand({ WorkGroup: wgName }),
    );
    expect(got.WorkGroup?.Configuration?.EnforceWorkGroupConfiguration).toBe(
      true,
    );
    expect(
      (
        got.WorkGroup?.Configuration?.ResultConfiguration as {
          OutputLocation?: string;
        }
      )?.OutputLocation,
    ).toBe("s3://updated-bucket/results/");

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  });

  test("StartQueryExecution on DISABLED workgroup throws InvalidRequestException", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-wg-dis-${Date.now()}`;

    await client.send(new CreateWorkGroupCommand({ Name: wgName }));
    await client.send(
      new UpdateWorkGroupCommand({ WorkGroup: wgName, State: "DISABLED" }),
    );

    await expect(
      client.send(
        new StartQueryExecutionCommand({
          QueryString: "SELECT 1",
          WorkGroup: wgName,
        }),
      ),
    ).rejects.toThrow();

    await client.send(
      new UpdateWorkGroupCommand({ WorkGroup: wgName, State: "ENABLED" }),
    );
    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  });

  test("BatchGetNamedQuery returns found queries and unprocessed IDs", async () => {
    const client = athena();

    const created = await client.send(
      new CreateNamedQueryCommand({
        Name: "bunsai-batch-query",
        Database: "default",
        QueryString: "SELECT 2",
      }),
    );
    const existingId = created.NamedQueryId!;
    const missingId = crypto.randomUUID();

    const batch = await client.send(
      new BatchGetNamedQueryCommand({
        NamedQueryIds: [existingId, missingId],
      }),
    );

    expect(batch.NamedQueries).toHaveLength(1);
    expect(batch.NamedQueries![0].NamedQueryId).toBe(existingId);
    expect(batch.UnprocessedNamedQueryIds).toHaveLength(1);
    expect(batch.UnprocessedNamedQueryIds![0].NamedQueryId).toBe(missingId);
  });

  test("full fidelity: CreateWorkGroup → CreateNamedQuery → StartQueryExecution honors OutputLocation → DeleteWorkGroup", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-fidelity-${Date.now()}`;
    const outputLocation = `s3://fidelity-bucket/${wgName}/`;

    await client.send(
      new CreateWorkGroupCommand({
        Name: wgName,
        Configuration: {
          ResultConfiguration: { OutputLocation: outputLocation },
          EnforceWorkGroupConfiguration: true,
        },
      }),
    );

    const nqResult = await client.send(
      new CreateNamedQueryCommand({
        Name: "fidelity-query",
        Database: "default",
        QueryString: "SELECT 'fidelity'",
        WorkGroup: wgName,
      }),
    );
    const nqId = nqResult.NamedQueryId!;

    const execResult = await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 'fidelity'",
        WorkGroup: wgName,
      }),
    );
    const execId = execResult.QueryExecutionId!;

    const execDetails = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: execId }),
    );
    expect(
      execDetails.QueryExecution?.ResultConfiguration?.OutputLocation,
    ).toBe(outputLocation);
    expect(execDetails.QueryExecution?.WorkGroup).toBe(wgName);

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));

    const wgAfter = await client
      .send(new GetWorkGroupCommand({ WorkGroup: wgName }))
      .catch((e: unknown) => e);
    expect(wgAfter).toBeInstanceOf(Error);

    void nqId;
  });
});

describe("athena fidelity gaps: idempotency, tags, pagination, state filter", () => {
  const athena = () =>
    new AthenaClient({ endpoint, region, credentials, requestHandler });

  test("HIGH-1: StartQueryExecution same ClientRequestToken returns same QueryExecutionId", async () => {
    const client = athena();
    const token = `idempotency-token-${Date.now()}`;

    const first = await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 1",
        ClientRequestToken: token,
      }),
    );
    const second = await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 1",
        ClientRequestToken: token,
      }),
    );
    expect(first.QueryExecutionId).toBeDefined();
    expect(first.QueryExecutionId).toBe(second.QueryExecutionId);
  });

  test("HIGH-1: CreateNamedQuery same ClientRequestToken returns same NamedQueryId", async () => {
    const client = athena();
    const token = `nq-idempotency-${Date.now()}`;

    const first = await client.send(
      new CreateNamedQueryCommand({
        Name: `idem-query-${Date.now()}`,
        Database: "default",
        QueryString: "SELECT 1",
        ClientRequestToken: token,
      }),
    );
    const second = await client.send(
      new CreateNamedQueryCommand({
        Name: `idem-query-different-name`,
        Database: "default",
        QueryString: "SELECT 2",
        ClientRequestToken: token,
      }),
    );
    expect(first.NamedQueryId).toBeDefined();
    expect(first.NamedQueryId).toBe(second.NamedQueryId);
  });

  test("HIGH-2: CreateWorkGroup with Tags → ListTagsForResource returns tags", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-wg-tags-${Date.now()}`;

    await client.send(
      new CreateWorkGroupCommand({
        Name: wgName,
        Tags: [
          { Key: "env", Value: "test" },
          { Key: "team", Value: "bunsai" },
        ],
      }),
    );

    const arn = `arn:aws:athena:${region}:000000000000:workgroup/${wgName}`;
    const tagged = await client.send(
      new ListTagsForResourceCommand({ ResourceARN: arn }),
    );
    expect(tagged.Tags?.find((t) => t.Key === "env")?.Value).toBe("test");
    expect(tagged.Tags?.find((t) => t.Key === "team")?.Value).toBe("bunsai");

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  });

  test("HIGH-3: ListQueryExecutions MaxResults=1 → NextToken round-trip", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-wg-page-${Date.now()}`;

    await client.send(new CreateWorkGroupCommand({ Name: wgName }));

    await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 1",
        WorkGroup: wgName,
      }),
    );
    await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 2",
        WorkGroup: wgName,
      }),
    );
    await client.send(
      new StartQueryExecutionCommand({
        QueryString: "SELECT 3",
        WorkGroup: wgName,
      }),
    );

    const page1 = await client.send(
      new ListQueryExecutionsCommand({ WorkGroup: wgName, MaxResults: 1 }),
    );
    expect(page1.QueryExecutionIds).toHaveLength(1);
    expect(page1.NextToken).toBeDefined();

    const page2 = await client.send(
      new ListQueryExecutionsCommand({
        WorkGroup: wgName,
        MaxResults: 1,
        NextToken: page1.NextToken,
      }),
    );
    expect(page2.QueryExecutionIds).toHaveLength(1);
    expect(page2.QueryExecutionIds![0]).not.toBe(page1.QueryExecutionIds![0]);

    const all = await client.send(
      new ListQueryExecutionsCommand({ WorkGroup: wgName }),
    );
    expect(all.QueryExecutionIds).toHaveLength(3);
    expect(all.NextToken).toBeUndefined();

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  });

  test("HIGH-3: ListWorkGroups MaxResults / NextToken pagination", async () => {
    const client = athena();
    const suffix = Date.now();
    const wgA = `bunsai-e2e-wg-pg-a-${suffix}`;
    const wgB = `bunsai-e2e-wg-pg-b-${suffix}`;

    await client.send(new CreateWorkGroupCommand({ Name: wgA }));
    await client.send(new CreateWorkGroupCommand({ Name: wgB }));

    const page1 = await client.send(
      new ListWorkGroupsCommand({ MaxResults: 1 }),
    );
    expect(page1.WorkGroups).toHaveLength(1);
    expect(page1.NextToken).toBeDefined();

    const page2 = await client.send(
      new ListWorkGroupsCommand({ MaxResults: 1, NextToken: page1.NextToken }),
    );
    expect(page2.WorkGroups).toHaveLength(1);
    expect(page2.WorkGroups![0].Name).not.toBe(page1.WorkGroups![0].Name);

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgA }));
    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgB }));
  });

  test("HIGH-4: ListSessions StateFilter filters by session state", async () => {
    const client = athena();
    const wgName = `bunsai-e2e-wg-sf-${Date.now()}`;

    await client.send(new CreateWorkGroupCommand({ Name: wgName }));

    const s1 = await client.send(
      new StartSessionCommand({
        WorkGroup: wgName,
        EngineConfiguration: { MaxConcurrentDpus: 2 },
      }),
    );
    const s2 = await client.send(
      new StartSessionCommand({
        WorkGroup: wgName,
        EngineConfiguration: { MaxConcurrentDpus: 2 },
      }),
    );
    await client.send(new TerminateSessionCommand({ SessionId: s2.SessionId }));

    const idleSessions = await client.send(
      new ListSessionsCommand({ WorkGroup: wgName, StateFilter: "IDLE" }),
    );
    expect(
      idleSessions.Sessions?.every((s) => s.Status?.State === "IDLE"),
    ).toBe(true);
    expect(
      idleSessions.Sessions?.find((s) => s.SessionId === s1.SessionId),
    ).toBeDefined();
    expect(
      idleSessions.Sessions?.find((s) => s.SessionId === s2.SessionId),
    ).toBeUndefined();

    const terminatedSessions = await client.send(
      new ListSessionsCommand({
        WorkGroup: wgName,
        StateFilter: "TERMINATED",
      }),
    );
    expect(
      terminatedSessions.Sessions?.find((s) => s.SessionId === s2.SessionId),
    ).toBeDefined();

    await client.send(new DeleteWorkGroupCommand({ WorkGroup: wgName }));
  });
});
