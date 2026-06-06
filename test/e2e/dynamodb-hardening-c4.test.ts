import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const client = (): DynamoDBClient =>
  new DynamoDBClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler,
  });

let counter = 0;
const uniqueName = (p: string): string => `${p}_${Date.now()}_${counter++}`;

const makeTable = async (c: DynamoDBClient, name: string): Promise<void> => {
  await c.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
};

describe("C4 Scan Segment / TotalSegments validation", () => {
  test("valid Segment=0/TotalSegments=1 returns items", async () => {
    const c = client();
    const t = uniqueName("c4seg");
    await makeTable(c, t);
    for (let n = 1; n <= 3; n++) {
      await c.send(
        new PutItemCommand({ TableName: t, Item: { pk: { S: String(n) } } }),
      );
    }
    const r = await c.send(
      new ScanCommand({ TableName: t, Segment: 0, TotalSegments: 1 }),
    );
    expect(r.Count).toBe(3);
  });

  test("Segment without TotalSegments throws ValidationException", async () => {
    const c = client();
    const t = uniqueName("c4seg");
    await makeTable(c, t);
    await c.send(
      new PutItemCommand({ TableName: t, Item: { pk: { S: "1" } } }),
    );
    await expect(
      c.send(new ScanCommand({ TableName: t, Segment: 0 })),
    ).rejects.toMatchObject({ name: "ValidationException" });
  });

  test("Segment >= TotalSegments throws ValidationException", async () => {
    const c = client();
    const t = uniqueName("c4seg");
    await makeTable(c, t);
    await c.send(
      new PutItemCommand({ TableName: t, Item: { pk: { S: "1" } } }),
    );
    await expect(
      c.send(new ScanCommand({ TableName: t, Segment: 2, TotalSegments: 2 })),
    ).rejects.toMatchObject({ name: "ValidationException" });
  });
});
