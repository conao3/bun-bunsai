import { describe, expect, test } from "bun:test";
import {
  CreateTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteTransactionCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { startApp } from "./harness.ts";

const { endpoint, requestHandler } = startApp();
const client = () =>
  new DynamoDBClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler,
  });

const makeTable = async (c: DynamoDBClient, table: string): Promise<void> => {
  await c.send(
    new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }),
  );
};

describe("dynamodb PartiQL hardening (c7)", () => {
  test("UPDATE SET counter = counter + ? matches UpdateExpression twin", async () => {
    const c = client();
    const expr = "c7h-twin-expr";
    const partiql = "c7h-twin-partiql";
    await makeTable(c, expr);
    await makeTable(c, partiql);
    for (const table of [expr, partiql]) {
      await c.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "x" }, counter: { N: "10" } },
        }),
      );
    }
    await c.send(
      new UpdateItemCommand({
        TableName: expr,
        Key: { pk: { S: "x" } },
        UpdateExpression: "SET counter = counter + :inc",
        ExpressionAttributeValues: { ":inc": { N: "5" } },
      }),
    );
    await c.send(
      new ExecuteStatementCommand({
        Statement: `UPDATE "${partiql}" SET counter = counter + ? WHERE pk = ?`,
        Parameters: [{ N: "5" }, { S: "x" }],
      }),
    );
    const exprItem = await c.send(
      new GetItemCommand({ TableName: expr, Key: { pk: { S: "x" } } }),
    );
    const partiqlItem = await c.send(
      new GetItemCommand({ TableName: partiql, Key: { pk: { S: "x" } } }),
    );
    expect(exprItem.Item?.counter?.N).toBe("15");
    expect(partiqlItem.Item?.counter?.N).toBe("15");
  });

  test("UPDATE SET a = a - ? subtracts arithmetically", async () => {
    const c = client();
    const table = "c7h-subtract";
    await makeTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "x" }, n: { N: "10" } },
      }),
    );
    await c.send(
      new ExecuteStatementCommand({
        Statement: `UPDATE "${table}" SET n = n - ? WHERE pk = ?`,
        Parameters: [{ N: "3" }, { S: "x" }],
      }),
    );
    const after = await c.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "x" } } }),
    );
    expect(after.Item?.n?.N).toBe("7");
  });

  test("SELECT WHERE status = 'active' resolves string literals", async () => {
    const c = client();
    const table = "c7h-strlit";
    await makeTable(c, table);
    for (const [pk, status] of [
      ["a", "active"],
      ["b", "inactive"],
    ]) {
      await c.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: pk }, status: { S: status } },
        }),
      );
    }
    const resp = await c.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE status = 'active'`,
      }),
    );
    expect((resp.Items ?? []).map((it) => it.pk?.S)).toEqual(["a"]);
  });

  test("SELECT WHERE n > 20 resolves numeric literals", async () => {
    const c = client();
    const table = "c7h-numlit";
    await makeTable(c, table);
    for (const [pk, n] of [
      ["a", "10"],
      ["b", "30"],
    ]) {
      await c.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: pk }, n: { N: n } },
        }),
      );
    }
    const resp = await c.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE n > 20`,
      }),
    );
    expect((resp.Items ?? []).map((it) => it.pk?.S)).toEqual(["b"]);
  });

  test("INSERT on existing primary key throws DuplicateItemException and preserves the original", async () => {
    const c = client();
    const table = "c7h-dup";
    await makeTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "d" }, v: { N: "1" } },
      }),
    );
    let err: unknown;
    try {
      await c.send(
        new ExecuteStatementCommand({
          Statement: `INSERT INTO "${table}" VALUE {'pk': ?, 'v': ?}`,
          Parameters: [{ S: "d" }, { N: "2" }],
        }),
      );
    } catch (e) {
      err = e;
    }
    const after = await c.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "d" } } }),
    );
    expect((err as Error)?.name).toBe("DuplicateItemException");
    expect(after.Item?.v?.N).toBe("1");
  });

  test("INSERT accepts inline nested map, list, bool, and number literals", async () => {
    const c = client();
    const table = "c7h-inline";
    await makeTable(c, table);
    await c.send(
      new ExecuteStatementCommand({
        Statement: `INSERT INTO "${table}" VALUE {'pk':'n1','meta':{'inner':'deep'},'tags':['t1','t2'],'flag':true,'num':42}`,
      }),
    );
    const got = await c.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "n1" } } }),
    );
    expect(got.Item?.meta?.M?.inner?.S).toBe("deep");
    expect(got.Item?.tags?.L?.length).toBe(2);
    expect(got.Item?.flag?.BOOL).toBe(true);
    expect(got.Item?.num?.N).toBe("42");
  });

  test("ExecuteTransaction rolls back earlier statements when a later one fails", async () => {
    const c = client();
    const table = "c7h-txn";
    await makeTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, v: { N: "1" } },
      }),
    );
    let err: unknown;
    try {
      await c.send(
        new ExecuteTransactionCommand({
          TransactStatements: [
            {
              Statement: `UPDATE "${table}" SET v = ? WHERE pk = ?`,
              Parameters: [{ N: "100" }, { S: "k1" }],
            },
            {
              Statement: `UPDATE "c7h-missing-table" SET v = ? WHERE pk = ?`,
              Parameters: [{ N: "5" }, { S: "zz" }],
            },
          ],
        }),
      );
    } catch (e) {
      err = e;
    }
    const after = await c.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "k1" } } }),
    );
    expect((err as Error)?.name).toBe("ResourceNotFoundException");
    expect(after.Item?.v?.N).toBe("1");
  });
});
