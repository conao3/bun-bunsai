import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  ListTagsOfResourceCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

describe("DynamoDB CON-2024 fidelity fixes", () => {
  test("CreateTable returns CREATING then ACTIVE lifecycle", async () => {
    const client = ddb();
    const table = "bunsai-con2024-lifecycle";

    const created = await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );
    expect(created.TableDescription?.TableStatus).toBe("CREATING");

    const immediate = await client.send(
      new DescribeTableCommand({ TableName: table }),
    );
    expect(immediate.Table?.TableStatus).toBe("CREATING");

    await Bun.sleep(50);

    const later = await client.send(
      new DescribeTableCommand({ TableName: table }),
    );
    expect(later.Table?.TableStatus).toBe("ACTIVE");
  });

  test("CreateTable with Tags → ListTagsOfResource round-trip", async () => {
    const client = ddb();
    const table = "bunsai-con2024-tags";

    const arn = `arn:aws:dynamodb:${region}:000000000000:table/${table}`;

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        Tags: [
          { Key: "env", Value: "test" },
          { Key: "owner", Value: "con2024" },
        ],
      }),
    );

    const listed = await client.send(
      new ListTagsOfResourceCommand({ ResourceArn: arn }),
    );
    const tags = listed.Tags ?? [];
    const tagMap = Object.fromEntries(tags.map((t) => [t.Key, t.Value]));
    expect(tagMap["env"]).toBe("test");
    expect(tagMap["owner"]).toBe("con2024");
  });

  test("TransactWriteItems ClientRequestToken idempotency", async () => {
    const client = ddb();
    const table = "bunsai-con2024-idempotency";

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const token = "idempotent-token-abc123";

    await client.send(
      new TransactWriteItemsCommand({
        ClientRequestToken: token,
        TransactItems: [
          {
            Put: {
              TableName: table,
              Item: { pk: { S: "item-1" }, val: { N: "1" } },
            },
          },
        ],
      }),
    );

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "item-1" }, val: { N: "999" } },
      }),
    );

    await client.send(
      new TransactWriteItemsCommand({
        ClientRequestToken: token,
        TransactItems: [
          {
            Put: {
              TableName: table,
              Item: { pk: { S: "item-1" }, val: { N: "1" } },
            },
          },
        ],
      }),
    );

    const { Item } = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "item-1" } },
      }),
    );
    expect(Item?.val?.N).toBe("999");
  });
});
