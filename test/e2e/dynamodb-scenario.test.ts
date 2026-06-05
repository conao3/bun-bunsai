import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConditionalCheckFailedException,
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  TransactionCanceledException,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

describe("DynamoDB end-to-end scenario", () => {
  test("inventory + orders workflow exercises every task-goal-003 acceptance bullet", async () => {
    const client = ddb();
    const products = "bunsai-e2e-ddb-scenario-products";
    const orders = "bunsai-e2e-ddb-scenario-orders";

    await client.send(
      new CreateTableCommand({
        TableName: products,
        AttributeDefinitions: [{ AttributeName: "sku", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "sku", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );
    await client.send(
      new CreateTableCommand({
        TableName: orders,
        AttributeDefinitions: [
          { AttributeName: "customerId", AttributeType: "S" },
          { AttributeName: "createdAt", AttributeType: "N" },
        ],
        KeySchema: [
          { AttributeName: "customerId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    const seedProducts: ReadonlyArray<
      readonly [string, number, number, string, ReadonlyArray<string>]
    > = [
      ["A", 100, 25.5, "active", ["sale", "new"]],
      ["B", 0, 9.99, "active", ["sale"]],
      ["C", 50, 9999.99, "active", ["premium"]],
      ["D", 30, 19.95, "archived", []],
    ];
    for (const [sku, stock, price, status, tags] of seedProducts) {
      await client.send(
        new PutItemCommand({
          TableName: products,
          Item: {
            sku: { S: sku },
            stock: { N: String(stock) },
            price: { N: String(price) },
            status: { S: status },
            tags: tags.length === 0 ? { L: [] } : { SS: tags as string[] },
          },
          ConditionExpression: "attribute_not_exists(sku)",
        }),
      );
    }

    let conflict: unknown;
    try {
      await client.send(
        new PutItemCommand({
          TableName: products,
          Item: { sku: { S: "A" }, stock: { N: "0" } },
          ConditionExpression: "attribute_not_exists(sku)",
        }),
      );
    } catch (caught) {
      conflict = caught;
    }
    expect(conflict).toBeInstanceOf(ConditionalCheckFailedException);

    const reservation = await client.send(
      new UpdateItemCommand({
        TableName: products,
        Key: { sku: { S: "A" } },
        UpdateExpression:
          "SET stock = stock - :amt, history = list_append(if_not_exists(history, :empty), :entry)",
        ConditionExpression: "stock >= :amt",
        ExpressionAttributeValues: {
          ":amt": { N: "2" },
          ":empty": { L: [] },
          ":entry": { L: [{ S: "reserved:2" }] },
        },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    expect(reservation.Attributes?.stock?.N).toBe("98");
    expect(reservation.Attributes?.history).toBeDefined();

    let oversell: unknown;
    try {
      await client.send(
        new UpdateItemCommand({
          TableName: products,
          Key: { sku: { S: "B" } },
          UpdateExpression: "SET stock = stock - :amt",
          ConditionExpression: "stock >= :amt",
          ExpressionAttributeValues: { ":amt": { N: "1" } },
        }),
      );
    } catch (caught) {
      oversell = caught;
    }
    expect(oversell).toBeInstanceOf(ConditionalCheckFailedException);

    await client.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: products,
              Key: { sku: { S: "C" } },
              UpdateExpression: "SET stock = stock - :amt",
              ConditionExpression: "stock >= :amt",
              ExpressionAttributeValues: { ":amt": { N: "1" } },
            },
          },
          {
            Put: {
              TableName: orders,
              Item: {
                customerId: { S: "cust-1" },
                createdAt: { N: "1700000001" },
                sku: { S: "C" },
                amount: { N: "1" },
                totalPrice: { N: "9999.99" },
              },
              ConditionExpression: "attribute_not_exists(customerId)",
            },
          },
        ],
      }),
    );

    let txFail: unknown;
    try {
      await client.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              Update: {
                TableName: products,
                Key: { sku: { S: "B" } },
                UpdateExpression: "SET stock = stock - :amt",
                ConditionExpression: "stock >= :amt",
                ExpressionAttributeValues: { ":amt": { N: "5" } },
                ReturnValuesOnConditionCheckFailure: "ALL_OLD",
              },
            },
            {
              Put: {
                TableName: orders,
                Item: {
                  customerId: { S: "cust-2" },
                  createdAt: { N: "1700000002" },
                  sku: { S: "B" },
                  amount: { N: "5" },
                },
              },
            },
          ],
        }),
      );
    } catch (caught) {
      txFail = caught;
    }
    expect(txFail).toBeInstanceOf(TransactionCanceledException);
    const cancellation = txFail as TransactionCanceledException;
    expect(cancellation.CancellationReasons?.length).toBe(2);
    expect(cancellation.CancellationReasons?.[0]?.Code).toBe(
      "ConditionalCheckFailed",
    );
    expect(cancellation.CancellationReasons?.[0]?.Item?.stock?.N).toBe("0");
    expect(cancellation.CancellationReasons?.[1]?.Code).toBe("None");

    const noOrphan = await client.send(
      new GetItemCommand({
        TableName: orders,
        Key: {
          customerId: { S: "cust-2" },
          createdAt: { N: "1700000002" },
        },
        ConsistentRead: true,
      }),
    );
    expect(noOrphan.Item).toBeUndefined();

    for (let i = 0; i < 5; i++) {
      await client.send(
        new PutItemCommand({
          TableName: orders,
          Item: {
            customerId: { S: "cust-1" },
            createdAt: { N: String(1700000010 + i) },
            sku: { S: "A" },
            amount: { N: "1" },
          },
        }),
      );
    }
    const customerOrders = await client.send(
      new QueryCommand({
        TableName: orders,
        KeyConditionExpression:
          "customerId = :id AND createdAt BETWEEN :start AND :end",
        ProjectionExpression: "createdAt, sku",
        ExpressionAttributeValues: {
          ":id": { S: "cust-1" },
          ":start": { N: "1700000010" },
          ":end": { N: "1700000013" },
        },
      }),
    );
    const customerOrderTimes = (customerOrders.Items ?? []).map(
      (it) => it.createdAt?.N ?? "",
    );
    expect(customerOrderTimes).toEqual([
      "1700000010",
      "1700000011",
      "1700000012",
      "1700000013",
    ]);
    for (const item of customerOrders.Items ?? []) {
      expect(item.amount).toBeUndefined();
    }

    const reversed = await client.send(
      new QueryCommand({
        TableName: orders,
        KeyConditionExpression: "customerId = :id",
        ExpressionAttributeValues: { ":id": { S: "cust-1" } },
        ScanIndexForward: false,
        Limit: 2,
      }),
    );
    expect((reversed.Items ?? []).map((it) => it.createdAt?.N ?? "")).toEqual([
      "1700000014",
      "1700000013",
    ]);
    expect(reversed.LastEvaluatedKey?.createdAt?.N).toBe("1700000013");

    const filterScan = await client.send(
      new ScanCommand({
        TableName: products,
        FilterExpression:
          "(#s = :active AND price BETWEEN :lo AND :hi) OR contains(tags, :hot)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":active": { S: "active" },
          ":lo": { N: "10" },
          ":hi": { N: "10000" },
          ":hot": { S: "new" },
        },
      }),
    );
    const filterPks = (filterScan.Items ?? [])
      .map((it) => it.sku?.S ?? "")
      .sort();
    expect(filterPks).toEqual(["A", "C"]);

    const partiqlPick = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${products}" WHERE status = ? AND price < ?`,
        Parameters: [{ S: "active" }, { N: "30" }],
      }),
    );
    const partiqlSkus = (partiqlPick.Items ?? [])
      .map((it) => it.sku?.S ?? "")
      .sort();
    expect(partiqlSkus).toEqual(["A", "B"]);

    await client.send(new DeleteTableCommand({ TableName: products }));
    await client.send(new DeleteTableCommand({ TableName: orders }));
  }, 20_000);
});
