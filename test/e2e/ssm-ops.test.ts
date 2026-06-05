import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsToResourceCommand,
  GetParameterHistoryCommand,
  LabelParameterVersionCommand,
  ListTagsForResourceCommand,
  PutParameterCommand,
  RemoveTagsFromResourceCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ssm ops e2e", () => {
  const ssm = () =>
    new SSMClient({ endpoint, region, credentials, requestHandler });

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
