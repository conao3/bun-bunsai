import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const createTable = async (
  client: DynamoDBClient,
  table: string,
): Promise<void> => {
  await client.send(
    new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }),
  );
};

const fetchItem = async (
  client: DynamoDBClient,
  table: string,
  pk: string,
): Promise<Record<string, unknown>> => {
  const out = await client.send(
    new GetItemCommand({
      TableName: table,
      Key: { pk: { S: pk } },
      ConsistentRead: true,
    }),
  );
  return out.Item ?? {};
};

describe("DynamoDB UpdateExpression deep features", () => {
  test("SET +/-, if_not_exists, list_append", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-update-rich";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k1" },
          counter: { N: "1.5" },
          list: { L: [{ S: "a" }] },
        },
      }),
    );

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression:
          "SET counter = counter + :inc, owner = if_not_exists(#o, :default), list = list_append(list, :more)",
        ExpressionAttributeNames: { "#o": "owner" },
        ExpressionAttributeValues: {
          ":inc": { N: "0.5" },
          ":default": { S: "alice" },
          ":more": { L: [{ S: "b" }, { S: "c" }] },
        },
      }),
    );

    const after = await fetchItem(client, table, "k1");
    expect(after["counter"]).toEqual({ N: "2" });
    expect(after["owner"]).toEqual({ S: "alice" });
    expect(after["list"]).toEqual({ L: [{ S: "a" }, { S: "b" }, { S: "c" }] });

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET counter = counter - :step",
        ExpressionAttributeValues: { ":step": { N: "0.1" } },
      }),
    );

    const decremented = await fetchItem(client, table, "k1");
    expect(decremented["counter"]).toEqual({ N: "1.9" });

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET owner = if_not_exists(owner, :ignored)",
        ExpressionAttributeValues: { ":ignored": { S: "ignored" } },
      }),
    );
    const ownerStable = await fetchItem(client, table, "k1");
    expect(ownerStable["owner"]).toEqual({ S: "alice" });

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("ADD NS / DELETE NS and REMOVE list[index]", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-update-sets";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k1" },
          nums: { NS: ["1", "2", "3"] },
          stale: { NS: ["10", "20"] },
          tags: { L: [{ S: "x" }, { S: "y" }, { S: "z" }] },
        },
      }),
    );

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "ADD nums :add DELETE stale :del REMOVE tags[1]",
        ExpressionAttributeValues: {
          ":add": { NS: ["4", "5"] },
          ":del": { NS: ["10"] },
        },
      }),
    );

    const after = await fetchItem(client, table, "k1");
    const nums = ((after["nums"] as Record<string, string[]>)?.NS ?? [])
      .slice()
      .sort((a: string, b: string) => Number(a) - Number(b));
    expect(nums).toEqual(["1", "2", "3", "4", "5"]);
    const remainingStale = (after["stale"] as Record<string, string[]>)?.NS;
    expect(remainingStale).toEqual(["20"]);
    expect(after["tags"]).toEqual({ L: [{ S: "x" }, { S: "z" }] });

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("nested document path SET via #alias and list_append on missing list", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-update-nested";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k1" },
          profile: { M: { name: { S: "old" } } },
        },
      }),
    );

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET #p.#n = :new",
        ExpressionAttributeNames: { "#p": "profile", "#n": "name" },
        ExpressionAttributeValues: { ":new": { S: "new" } },
      }),
    );

    const after = await fetchItem(client, table, "k1");
    expect(
      (
        after["profile"] as Record<
          string,
          Record<string, Record<string, string>>
        >
      )?.M?.name?.S,
    ).toBe("new");

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET tags = if_not_exists(tags, :empty)",
        ExpressionAttributeValues: { ":empty": { L: [{ S: "init" }] } },
      }),
    );
    const initialised = await fetchItem(client, table, "k1");
    expect(initialised["tags"]).toEqual({ L: [{ S: "init" }] });

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("snapshot-of-original semantics: SET a = b, b = :v", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-update-snapshot";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, a: { S: "A" }, b: { S: "B" } },
      }),
    );

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET a = b, b = :v",
        ExpressionAttributeValues: { ":v": { S: "NEW" } },
      }),
    );

    const after = await fetchItem(client, table, "k1");
    expect(after["a"]).toEqual({ S: "B" });
    expect(after["b"]).toEqual({ S: "NEW" });

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
