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
  StartQueryExecutionCommand,
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
