import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new DynamoDBClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

const table = "expr-edge";

const put = (item: Record<string, unknown>, extra?: Record<string, unknown>) =>
  client.send(
    new PutItemCommand({
      TableName: table,
      Item: item as never,
      ...(extra ?? {}),
    }),
  );

const get = async (pk: string) =>
  (
    await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: pk } } }),
    )
  ).Item;

test("setup table", async () => {
  await client.send(
    new CreateTableCommand({
      TableName: table,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
    }),
  );
  expect(await get("nope")).toBeUndefined();
});

test("ConditionExpression functions", async () => {
  await put({ pk: { S: "c1" }, n: { N: "5" }, s: { S: "hello" } });

  expect(
    put(
      { pk: { S: "c1" }, fresh: { S: "y" } },
      { ConditionExpression: "attribute_not_exists(pk)" },
    ),
  ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });

  const full = {
    pk: { S: "c1" },
    n: { N: "6" },
    s: { S: "hello world" },
    tags: { SS: ["a", "b"] },
  };

  await put(full, {
    ConditionExpression: "attribute_type(n, :t)",
    ExpressionAttributeValues: { ":t": { S: "N" } },
  });

  await put(full, {
    ConditionExpression: "begins_with(s, :p)",
    ExpressionAttributeValues: { ":p": { S: "hello" } },
  });

  await put(full, {
    ConditionExpression: "contains(s, :sub)",
    ExpressionAttributeValues: { ":sub": { S: "wor" } },
  });

  await put(full, {
    ConditionExpression: "contains(tags, :el)",
    ExpressionAttributeValues: { ":el": { S: "b" } },
  });

  await put(full, {
    ConditionExpression: "size(s) > :len",
    ExpressionAttributeValues: { ":len": { N: "3" } },
  });
});

test("ConditionExpression operators and precedence", async () => {
  await put({ pk: { S: "c2" }, a: { N: "1" }, b: { N: "2" }, c: { N: "3" } });

  await put(
    { pk: { S: "c2" }, a: { N: "1" }, b: { N: "2" }, c: { N: "3" } },
    {
      ConditionExpression: "a = :zero OR b = :two AND c = :three",
      ExpressionAttributeValues: {
        ":zero": { N: "0" },
        ":two": { N: "2" },
        ":three": { N: "3" },
      },
    },
  );

  expect(
    put(
      { pk: { S: "c2" } },
      {
        ConditionExpression: "(a = :zero OR b = :two) AND c = :nine",
        ExpressionAttributeValues: {
          ":zero": { N: "0" },
          ":two": { N: "2" },
          ":nine": { N: "9" },
        },
      },
    ),
  ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });

  await put(
    { pk: { S: "c2" }, a: { N: "1" } },
    {
      ConditionExpression: "a IN (:x, :y)",
      ExpressionAttributeValues: { ":x": { N: "1" }, ":y": { N: "5" } },
    },
  );

  await put(
    { pk: { S: "c2" }, a: { N: "1" } },
    {
      ConditionExpression: "a BETWEEN :lo AND :hi",
      ExpressionAttributeValues: { ":lo": { N: "0" }, ":hi": { N: "2" } },
    },
  );
});

test("UpdateExpression nested paths, list ops and functions", async () => {
  await put({
    pk: { S: "u1" },
    doc: { M: { items: { L: [{ N: "1" }, { N: "2" }] } } },
    nums: { L: [{ N: "10" }, { N: "20" }, { N: "30" }] },
  });

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u1" } },
      UpdateExpression: "SET doc.however = :v, doc.items[0] = :n",
      ExpressionAttributeValues: { ":v": { S: "x" }, ":n": { N: "99" } },
    }),
  );
  let item = await get("u1");
  expect(item?.doc?.M?.items?.L?.[0]?.N).toBe("99");
  expect(item?.doc?.M?.however?.S).toBe("x");

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u1" } },
      UpdateExpression: "SET counter = if_not_exists(counter, :d)",
      ExpressionAttributeValues: { ":d": { N: "0" } },
    }),
  );
  item = await get("u1");
  expect(item?.counter?.N).toBe("0");

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u1" } },
      UpdateExpression: "SET nums = list_append(nums, :more)",
      ExpressionAttributeValues: { ":more": { L: [{ N: "40" }] } },
    }),
  );
  item = await get("u1");
  expect(item?.nums?.L?.map((v) => v.N)).toEqual(["10", "20", "30", "40"]);

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u1" } },
      UpdateExpression: "SET nums = list_append(:front, nums)",
      ExpressionAttributeValues: { ":front": { L: [{ N: "0" }] } },
    }),
  );
  item = await get("u1");
  expect(item?.nums?.L?.[0]?.N).toBe("0");

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u1" } },
      UpdateExpression: "REMOVE nums[1]",
    }),
  );
  item = await get("u1");
  expect(item?.nums?.L?.map((v) => v.N)).toEqual(["0", "20", "30", "40"]);
});

test("UpdateExpression ADD and DELETE", async () => {
  await put({
    pk: { S: "u2" },
    score: { N: "10" },
    tags: { SS: ["a", "b"] },
  });

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u2" } },
      UpdateExpression: "ADD score :inc, tags :more",
      ExpressionAttributeValues: {
        ":inc": { N: "5" },
        ":more": { SS: ["c"] },
      },
    }),
  );
  let item = await get("u2");
  expect(item?.score?.N).toBe("15");
  expect(item?.tags?.SS?.toSorted()).toEqual(["a", "b", "c"]);

  await client.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: "u2" } },
      UpdateExpression: "DELETE tags :rm",
      ExpressionAttributeValues: { ":rm": { SS: ["a"] } },
    }),
  );
  item = await get("u2");
  expect(item?.tags?.SS?.toSorted()).toEqual(["b", "c"]);
});

test("expression validation errors", async () => {
  await put({ pk: { S: "e1" }, x: { N: "1" } });

  expect(
    client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "e1" } },
        UpdateExpression: "SET x = :v REMOVE x",
        ExpressionAttributeValues: { ":v": { N: "2" } },
      }),
    ),
  ).rejects.toMatchObject({ name: "ValidationException" });

  expect(
    client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "e1" } },
        UpdateExpression: "SET x = :v",
        ExpressionAttributeValues: { ":v": { N: "2" }, ":unused": { N: "9" } },
      }),
    ),
  ).rejects.toMatchObject({ name: "ValidationException" });
});
