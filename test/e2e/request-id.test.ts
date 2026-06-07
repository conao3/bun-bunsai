import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("x-amzn-RequestId e2e", () => {
  test("DynamoDB responses include unique requestId", async () => {
    const client = new DynamoDBClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const table = "bunsai-e2e-request-id-ddb";

    const create = await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
      }),
    );
    const id1 = create.$metadata.requestId;
    expect(typeof id1).toBe("string");
    expect(id1!.length).toBeGreaterThan(0);

    const list = await client.send(new ListTablesCommand({}));
    const id2 = list.$metadata.requestId;
    expect(typeof id2).toBe("string");
    expect(id2!.length).toBeGreaterThan(0);

    expect(id1).not.toBe(id2);

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("S3 responses include unique requestId", async () => {
    const client = new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
    const bucket = "bunsai-e2e-request-id-s3";

    const create = await client.send(
      new CreateBucketCommand({ Bucket: bucket }),
    );
    const id1 = create.$metadata.requestId;
    expect(typeof id1).toBe("string");
    expect(id1!.length).toBeGreaterThan(0);

    const list = await client.send(new ListBucketsCommand({}));
    const id2 = list.$metadata.requestId;
    expect(typeof id2).toBe("string");
    expect(id2!.length).toBeGreaterThan(0);

    expect(id1).not.toBe(id2);

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });
});
