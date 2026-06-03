import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddTagsToResourceCommand,
  GetParameterHistoryCommand,
  LabelParameterVersionCommand,
  ListTagsForResourceCommand,
  PutParameterCommand,
  RemoveTagsFromResourceCommand,
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

describe("ssm ops e2e", () => {
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

  test("resource tagging round-trips through the real SDK", async () => {
    const client = ssm();
    const name = "/bunsai/ops/tagged";

    await client.send(
      new PutParameterCommand({ Name: name, Value: "v1", Type: "String" }),
    );

    await client.send(
      new AddTagsToResourceCommand({
        ResourceType: "Parameter",
        ResourceId: name,
        Tags: [
          { Key: "Owner", Value: "DbAdmin" },
          { Key: "Stack", Value: "Production" },
        ],
      }),
    );

    const listed = await client.send(
      new ListTagsForResourceCommand({
        ResourceType: "Parameter",
        ResourceId: name,
      }),
    );
    const tagMap = Object.fromEntries(
      (listed.TagList ?? []).map((tag) => [tag.Key, tag.Value]),
    );
    expect(tagMap["Owner"]).toBe("DbAdmin");
    expect(tagMap["Stack"]).toBe("Production");

    await client.send(
      new RemoveTagsFromResourceCommand({
        ResourceType: "Parameter",
        ResourceId: name,
        TagKeys: ["Stack"],
      }),
    );

    const afterRemove = await client.send(
      new ListTagsForResourceCommand({
        ResourceType: "Parameter",
        ResourceId: name,
      }),
    );
    const remainingKeys = (afterRemove.TagList ?? []).map((tag) => tag.Key);
    expect(remainingKeys).toContain("Owner");
    expect(remainingKeys).not.toContain("Stack");
  });

  test("parameter history and labels round-trip through the real SDK", async () => {
    const client = ssm();
    const name = "/bunsai/ops/history";

    await client.send(
      new PutParameterCommand({ Name: name, Value: "v1", Type: "String" }),
    );
    await client.send(
      new PutParameterCommand({
        Name: name,
        Value: "v2",
        Type: "String",
        Overwrite: true,
      }),
    );
    await client.send(
      new PutParameterCommand({
        Name: name,
        Value: "v3",
        Type: "String",
        Overwrite: true,
      }),
    );

    const labeled = await client.send(
      new LabelParameterVersionCommand({
        Name: name,
        ParameterVersion: 2,
        Labels: ["Stable"],
      }),
    );
    expect(labeled.ParameterVersion).toBe(2);
    expect(labeled.InvalidLabels ?? []).toHaveLength(0);

    const invalid = await client.send(
      new LabelParameterVersionCommand({
        Name: name,
        Labels: ["123bad"],
      }),
    );
    expect(invalid.InvalidLabels).toContain("123bad");

    const history = await client.send(
      new GetParameterHistoryCommand({ Name: name }),
    );
    const versions = (history.Parameters ?? []).map((p) => p.Version).sort();
    expect(versions).toEqual([1, 2, 3]);
    const values = (history.Parameters ?? []).map((p) => p.Value).sort();
    expect(values).toEqual(["v1", "v2", "v3"].sort());

    const labelledEntry = (history.Parameters ?? []).find(
      (p) => p.Version === 2,
    );
    expect(labelledEntry?.Labels).toContain("Stable");
  });
});
