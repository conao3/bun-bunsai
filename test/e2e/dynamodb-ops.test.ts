import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTimeToLiveCommand,
  DynamoDBClient,
  GetItemCommand,
  ListTagsOfResourceCommand,
  PutItemCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateItemCommand,
  UpdateTableCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("DynamoDB ops deep-dive e2e", () => {
  const ddb = () =>
    new DynamoDBClient({ endpoint, region, credentials, requestHandler });
  const table = "bunsai-e2e-ddb-ops";

  test("update table, ttl, tags, update expressions", async () => {
    const client = ddb();

    const created = await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );
    const arn = created.TableDescription?.TableArn ?? "";
    expect(arn).toContain(`table/${table}`);

    const updatedTable = await client.send(
      new UpdateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "gsipk", AttributeType: "S" }],
      }),
    );
    const definitions =
      updatedTable.TableDescription?.AttributeDefinitions ?? [];
    const definitionNames = definitions.map(
      (definition) => definition.AttributeName,
    );
    expect(definitionNames).toContain("pk");
    expect(definitionNames).toContain("gsipk");

    const initialTtl = await client.send(
      new DescribeTimeToLiveCommand({ TableName: table }),
    );
    expect(initialTtl.TimeToLiveDescription?.TimeToLiveStatus).toBe("DISABLED");

    const enabledTtl = await client.send(
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "expiresAt" },
      }),
    );
    expect(enabledTtl.TimeToLiveSpecification?.Enabled).toBe(true);
    expect(enabledTtl.TimeToLiveSpecification?.AttributeName).toBe("expiresAt");

    const describedTtl = await client.send(
      new DescribeTimeToLiveCommand({ TableName: table }),
    );
    expect(describedTtl.TimeToLiveDescription?.TimeToLiveStatus).toBe(
      "ENABLED",
    );
    expect(describedTtl.TimeToLiveDescription?.AttributeName).toBe("expiresAt");

    await client.send(
      new TagResourceCommand({
        ResourceArn: arn,
        Tags: [
          { Key: "env", Value: "test" },
          { Key: "team", Value: "core" },
        ],
      }),
    );

    const tagged = await client.send(
      new ListTagsOfResourceCommand({ ResourceArn: arn }),
    );
    const tagMap = new Map(
      (tagged.Tags ?? []).map((tag) => [tag.Key, tag.Value]),
    );
    expect(tagMap.get("env")).toBe("test");
    expect(tagMap.get("team")).toBe("core");

    await client.send(
      new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["team"] }),
    );
    const afterUntag = await client.send(
      new ListTagsOfResourceCommand({ ResourceArn: arn }),
    );
    const remaining = (afterUntag.Tags ?? []).map((tag) => tag.Key);
    expect(remaining).toContain("env");
    expect(remaining).not.toContain("team");

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "item1" }, count: { N: "1" }, tags: { SS: ["a"] } },
      }),
    );

    const setResult = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "item1" } },
        UpdateExpression: "SET label = :label",
        ExpressionAttributeValues: { ":label": { S: "hello" } },
        ReturnValues: "ALL_NEW",
      }),
    );
    expect(setResult.Attributes?.label?.S).toBe("hello");

    const addResult = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "item1" } },
        UpdateExpression: "ADD #c :delta",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":delta": { N: "4" } },
        ReturnValues: "ALL_NEW",
      }),
    );
    expect(addResult.Attributes?.count?.N).toBe("5");

    const removeResult = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "item1" } },
        UpdateExpression: "REMOVE label",
        ReturnValues: "ALL_NEW",
      }),
    );
    expect(removeResult.Attributes?.label).toBeUndefined();

    const addSetResult = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "item1" } },
        UpdateExpression: "ADD tags :more",
        ExpressionAttributeValues: { ":more": { SS: ["b", "c"] } },
        ReturnValues: "ALL_NEW",
      }),
    );
    expect([...(addSetResult.Attributes?.tags?.SS ?? [])].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);

    const stored = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "item1" } } }),
    );
    expect(stored.Item?.count?.N).toBe("5");
    expect(stored.Item?.label).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
