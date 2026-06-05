import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateGlueIdentityCenterConfigurationCommand,
  CreateIntegrationResourcePropertyCommand,
  CreateMLTransformCommand,
  CreateRegistryCommand,
  DeleteGlueIdentityCenterConfigurationCommand,
  GetGlueIdentityCenterConfigurationCommand,
  GetIntegrationResourcePropertyCommand,
  GetMLTaskRunCommand,
  GetMLTaskRunsCommand,
  GetMLTransformCommand,
  GetMLTransformsCommand,
  GetMappingCommand,
  GetPlanCommand,
  GetRegistryCommand,
  GetResourcePoliciesCommand,
  GetResourcePolicyCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const awsPort = 4946;
const uiPort = 5946;
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

describe("glue chunk-10 ops e2e", () => {
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

  const glue = () => new GlueClient({ endpoint, region, credentials });

  test("ml-transform create -> get -> list lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateMLTransformCommand({
        Name: "e2e_ml_transform_chunk10",
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        InputRecordTables: [{ DatabaseName: "mydb", TableName: "mytable" }],
        Parameters: {
          TransformType: "FIND_MATCHES",
          FindMatchesParameters: {
            PrimaryKeyColumnName: "id",
          },
        },
        GlueVersion: "2.0",
        NumberOfWorkers: 2,
        WorkerType: "G.1X",
      }),
    );
    expect(typeof created.TransformId).toBe("string");

    const transformId = created.TransformId!;

    const got = await client.send(
      new GetMLTransformCommand({ TransformId: transformId }),
    );
    expect(got.TransformId).toBe(transformId);
    expect(got.Status).toBe("READY");
    expect(got.Role).toBe("arn:aws:iam::123456789012:role/GlueRole");
    expect(got.GlueVersion).toBe("2.0");
    expect(got.NumberOfWorkers).toBe(2);

    await expect(
      client.send(new GetMLTransformCommand({ TransformId: "no-such-id" })),
    ).rejects.toThrow();

    const list = await client.send(new GetMLTransformsCommand({}));
    expect(Array.isArray(list.Transforms)).toBe(true);
    const found = list.Transforms?.find((t) => t.TransformId === transformId);
    expect(found).toBeDefined();

    const taskRuns = await client.send(
      new GetMLTaskRunsCommand({ TransformId: transformId }),
    );
    expect(Array.isArray(taskRuns.TaskRuns)).toBe(true);
    expect(taskRuns.TaskRuns?.length).toBe(0);

    const taskRun = await client.send(
      new GetMLTaskRunCommand({
        TransformId: transformId,
        TaskRunId: "task-run-123",
      }),
    );
    expect(taskRun.TransformId).toBe(transformId);
    expect(taskRun.TaskRunId).toBe("task-run-123");
    expect(taskRun.Status).toBe("SUCCEEDED");
  });

  test("registry create -> get lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateRegistryCommand({
        RegistryName: "e2e_registry_chunk10",
        Description: "test registry",
      }),
    );

    const got = await client.send(
      new GetRegistryCommand({
        RegistryId: { RegistryName: "e2e_registry_chunk10" },
      }),
    );
    expect(got.RegistryName).toBe("e2e_registry_chunk10");
    expect(got.Status).toBe("AVAILABLE");
    expect(typeof got.RegistryArn).toBe("string");

    await expect(
      client.send(
        new GetRegistryCommand({
          RegistryId: { RegistryName: "no_such_registry" },
        }),
      ),
    ).rejects.toThrow();
  });

  test("GetGlueIdentityCenterConfiguration create -> get -> delete lifecycle", async () => {
    const client = glue();

    await expect(
      client.send(new GetGlueIdentityCenterConfigurationCommand({})),
    ).rejects.toThrow();

    await client.send(
      new CreateGlueIdentityCenterConfigurationCommand({
        InstanceArn: "arn:aws:sso:::instance/ssoins-abc123",
      }),
    );

    const got = await client.send(
      new GetGlueIdentityCenterConfigurationCommand({}),
    );
    expect(typeof got.ApplicationArn).toBe("string");
    expect(typeof got.InstanceArn).toBe("string");

    await client.send(new DeleteGlueIdentityCenterConfigurationCommand({}));
    await expect(
      client.send(new GetGlueIdentityCenterConfigurationCommand({})),
    ).rejects.toThrow();
  });

  test("IntegrationResourceProperty create -> get lifecycle", async () => {
    const client = glue();

    const resourceArn = "arn:aws:rds:us-east-1:123456789012:db:e2e-chunk10-db";
    await client.send(
      new CreateIntegrationResourcePropertyCommand({
        ResourceArn: resourceArn,
        TargetProcessingProperties: {
          RoleArn: "arn:aws:iam::123456789012:role/GlueRole",
        },
      }),
    );

    const got = await client.send(
      new GetIntegrationResourcePropertyCommand({ ResourceArn: resourceArn }),
    );
    expect(got.ResourceArn).toBe(resourceArn);
    expect(typeof got.ResourcePropertyArn).toBe("string");

    await expect(
      client.send(
        new GetIntegrationResourcePropertyCommand({
          ResourceArn: "arn:aws:rds:us-east-1:123456789012:db:no-such-db",
        }),
      ),
    ).rejects.toThrow();
  });

  test("GetMapping returns empty mapping list", async () => {
    const client = glue();

    const result = await client.send(
      new GetMappingCommand({
        Source: { DatabaseName: "sourcedb", TableName: "srctable" },
      }),
    );
    expect(Array.isArray(result.Mapping)).toBe(true);
  });

  test("GetPlan returns Python script", async () => {
    const client = glue();

    const result = await client.send(
      new GetPlanCommand({
        Mapping: [],
        Source: { DatabaseName: "sourcedb", TableName: "srctable" },
      }),
    );
    expect(typeof result.PythonScript).toBe("string");
  });

  test("GetResourcePolicies returns empty list", async () => {
    const client = glue();
    const result = await client.send(new GetResourcePoliciesCommand({}));
    expect(Array.isArray(result.GetResourcePoliciesResponseList)).toBe(true);
  });

  test("GetResourcePolicy returns synthetic policy", async () => {
    const client = glue();
    const result = await client.send(new GetResourcePolicyCommand({}));
    expect(typeof result.PolicyInJson).toBe("string");
    const parsed = JSON.parse(result.PolicyInJson!);
    expect(parsed.Version).toBe("2012-10-17");
  });
});
