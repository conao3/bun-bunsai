import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  UpdateTableCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("DynamoDB CON-2209 ProvisionedThroughput parity", () => {
  const ddb = () =>
    new DynamoDBClient({ endpoint, region, credentials, requestHandler });

  test("PROVISIONED: CreateTable(5,5) -> DescribeTable returns 5/5", async () => {
    const client = ddb();
    const TableName = "con2209-provisioned";

    await client.send(
      new CreateTableCommand({
        TableName,
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    const described = await client.send(
      new DescribeTableCommand({ TableName }),
    );
    expect(described.Table?.ProvisionedThroughput?.ReadCapacityUnits).toBe(5);
    expect(described.Table?.ProvisionedThroughput?.WriteCapacityUnits).toBe(5);
    expect(described.Table?.ProvisionedThroughput?.NumberOfDecreasesToday).toBe(
      0,
    );

    await client.send(new DeleteTableCommand({ TableName }));
  });

  test("UpdateTable(10,10) -> DescribeTable returns 10/10", async () => {
    const client = ddb();
    const TableName = "con2209-update";

    await client.send(
      new CreateTableCommand({
        TableName,
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    await client.send(
      new UpdateTableCommand({
        TableName,
        ProvisionedThroughput: {
          ReadCapacityUnits: 10,
          WriteCapacityUnits: 10,
        },
      }),
    );

    const described = await client.send(
      new DescribeTableCommand({ TableName }),
    );
    expect(described.Table?.ProvisionedThroughput?.ReadCapacityUnits).toBe(10);
    expect(described.Table?.ProvisionedThroughput?.WriteCapacityUnits).toBe(10);

    await client.send(new DeleteTableCommand({ TableName }));
  });

  test("PAY_PER_REQUEST -> ProvisionedThroughput 0/0 + BillingModeSummary", async () => {
    const client = ddb();
    const TableName = "con2209-ppr";

    await client.send(
      new CreateTableCommand({
        TableName,
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );

    const described = await client.send(
      new DescribeTableCommand({ TableName }),
    );
    expect(described.Table?.ProvisionedThroughput?.ReadCapacityUnits).toBe(0);
    expect(described.Table?.ProvisionedThroughput?.WriteCapacityUnits).toBe(0);
    expect(described.Table?.BillingModeSummary?.BillingMode).toBe(
      "PAY_PER_REQUEST",
    );

    await client.send(new DeleteTableCommand({ TableName }));
  });
});
