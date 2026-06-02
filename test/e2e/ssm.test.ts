import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeleteParameterCommand,
  DescribeParametersCommand,
  GetParameterCommand,
  GetParametersByPathCommand,
  GetParametersCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";

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

describe("ssm e2e", () => {
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

  const ssm = () => new SSMClient({ endpoint, region, credentials });

  test("Parameter lifecycle round-trips through the real SDK", async () => {
    const client = ssm();
    const name = "/bunsai/e2e/param";
    const value = "bunsai-e2e-value";

    const put = await client.send(
      new PutParameterCommand({ Name: name, Value: value, Type: "String" }),
    );
    expect(put.Version).toBe(1);

    const got = await client.send(new GetParameterCommand({ Name: name }));
    expect(got.Parameter?.Name).toBe(name);
    expect(got.Parameter?.Value).toBe(value);
    expect(got.Parameter?.Type).toBe("String");
    expect(got.Parameter?.Version).toBe(1);

    const updated = await client.send(
      new PutParameterCommand({
        Name: name,
        Value: "v2",
        Type: "String",
        Overwrite: true,
      }),
    );
    expect(updated.Version).toBe(2);

    const second = "/bunsai/e2e/other";
    await client.send(
      new PutParameterCommand({ Name: second, Value: "x", Type: "String" }),
    );

    const batch = await client.send(
      new GetParametersCommand({ Names: [name, second, "/bunsai/missing"] }),
    );
    const batchNames = (batch.Parameters ?? []).map((p) => p.Name).sort();
    expect(batchNames).toEqual([second, name].sort());
    expect(batch.InvalidParameters).toContain("/bunsai/missing");

    const byPath = await client.send(
      new GetParametersByPathCommand({ Path: "/bunsai/e2e", Recursive: true }),
    );
    const pathNames = (byPath.Parameters ?? []).map((p) => p.Name).sort();
    expect(pathNames).toEqual([second, name].sort());

    const described = await client.send(new DescribeParametersCommand({}));
    const describedNames = (described.Parameters ?? []).map((p) => p.Name);
    expect(describedNames).toContain(name);
    expect(describedNames).toContain(second);

    await client.send(new DeleteParameterCommand({ Name: name }));
    await expect(
      client.send(new GetParameterCommand({ Name: name })),
    ).rejects.toThrow();

    await client.send(new DeleteParameterCommand({ Name: second }));
  });
});
