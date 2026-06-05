import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateCustomEntityTypeCommand,
  CreateDataQualityRulesetCommand,
  CreateDevEndpointCommand,
  GetCustomEntityTypeCommand,
  GetDataCatalogEncryptionSettingsCommand,
  GetDataQualityRulesetCommand,
  GetDataflowGraphCommand,
  GetDevEndpointCommand,
  GetDevEndpointsCommand,
  GetEntityRecordsCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue chunk-9 ops e2e", () => {
  const glue = () => new GlueClient({ endpoint, region, credentials });

  test("data quality ruleset create -> get lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateDataQualityRulesetCommand({
        Name: "e2e_dq_ruleset_chunk9",
        Ruleset: 'Rules = [ColumnExists "col1"]',
        Description: "test ruleset",
      }),
    );
    expect(created.Name).toBe("e2e_dq_ruleset_chunk9");

    const got = await client.send(
      new GetDataQualityRulesetCommand({ Name: "e2e_dq_ruleset_chunk9" }),
    );
    expect(got.Name).toBe("e2e_dq_ruleset_chunk9");
    expect(got.Ruleset).toBe('Rules = [ColumnExists "col1"]');
    expect(got.Description).toBe("test ruleset");
    expect(got.CreatedOn).toBeDefined();

    await expect(
      client.send(
        new GetDataQualityRulesetCommand({ Name: "no_such_ruleset" }),
      ),
    ).rejects.toThrow();
  });

  test("custom entity type create -> get lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateCustomEntityTypeCommand({
        Name: "e2e_entity_chunk9",
        RegexString: "\\d{3}-\\d{4}",
        ContextWords: ["phone"],
      }),
    );

    const got = await client.send(
      new GetCustomEntityTypeCommand({ Name: "e2e_entity_chunk9" }),
    );
    expect(got.Name).toBe("e2e_entity_chunk9");
    expect(got.RegexString).toBe("\\d{3}-\\d{4}");
    expect(got.ContextWords).toEqual(["phone"]);

    await expect(
      client.send(new GetCustomEntityTypeCommand({ Name: "no_such_entity" })),
    ).rejects.toThrow();
  });

  test("dev endpoint create -> get -> list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateDevEndpointCommand({
        EndpointName: "e2e_dev_ep_chunk9",
        RoleArn: "arn:aws:iam::123456789012:role/GlueRole",
        GlueVersion: "3.0",
        NumberOfWorkers: 2,
        WorkerType: "G.1X",
      }),
    );

    const got = await client.send(
      new GetDevEndpointCommand({ EndpointName: "e2e_dev_ep_chunk9" }),
    );
    expect(got.DevEndpoint?.EndpointName).toBe("e2e_dev_ep_chunk9");
    expect(got.DevEndpoint?.Status).toBe("READY");
    expect(got.DevEndpoint?.GlueVersion).toBe("3.0");

    await expect(
      client.send(new GetDevEndpointCommand({ EndpointName: "no_such_ep" })),
    ).rejects.toThrow();

    const list = await client.send(new GetDevEndpointsCommand({}));
    expect(Array.isArray(list.DevEndpoints)).toBe(true);
    const found = list.DevEndpoints?.find(
      (ep) => ep.EndpointName === "e2e_dev_ep_chunk9",
    );
    expect(found).toBeDefined();
  });

  test("GetDataCatalogEncryptionSettings returns synthetic output", async () => {
    const client = glue();
    const result = await client.send(
      new GetDataCatalogEncryptionSettingsCommand({}),
    );
    expect(result.DataCatalogEncryptionSettings).toBeDefined();
    expect(
      result.DataCatalogEncryptionSettings?.EncryptionAtRest
        ?.CatalogEncryptionMode,
    ).toBe("DISABLED");
  });

  test("GetDataflowGraph returns empty DAG", async () => {
    const client = glue();
    const result = await client.send(new GetDataflowGraphCommand({}));
    expect(Array.isArray(result.DagNodes)).toBe(true);
    expect(Array.isArray(result.DagEdges)).toBe(true);
  });

  test("GetEntityRecords returns empty records list", async () => {
    const client = glue();
    const result = await client.send(
      new GetEntityRecordsCommand({
        ConnectionName: "e2e_conn_chunk9",
        EntityName: "Customer",
        DataStoreApiVersion: "v1",
        Limit: 10,
      }),
    );
    expect(Array.isArray(result.Records)).toBe(true);
  });
});
