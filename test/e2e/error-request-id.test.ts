import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetTopicAttributesCommand, SNSClient } from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("error body RequestId matches per-request id", () => {
  test("query-protocol (SNS): error $metadata.requestId is real and not foo-id", async () => {
    const client = new SNSClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    let caught: unknown;
    try {
      await client.send(
        new GetTopicAttributesCommand({
          TopicArn: "arn:aws:sns:us-east-1:000000000000:nonexistent-err-rid",
        }),
      );
    } catch (error) {
      caught = error;
    }
    const err = caught as { $metadata?: { requestId?: string } };
    expect(err.$metadata?.requestId).toBeDefined();
    expect(err.$metadata?.requestId).not.toBe("foo-id");
    expect(typeof err.$metadata?.requestId).toBe("string");
    expect((err.$metadata?.requestId ?? "").length).toBeGreaterThan(0);
  });

  test("json-protocol (DynamoDB): error $metadata.requestId is real and not foo-id", async () => {
    const client = new DynamoDBClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    let caught: unknown;
    try {
      await client.send(
        new DescribeTableCommand({ TableName: "nonexistent-err-rid-table" }),
      );
    } catch (error) {
      caught = error;
    }
    const err = caught as { $metadata?: { requestId?: string } };
    expect(err.$metadata?.requestId).toBeDefined();
    expect(err.$metadata?.requestId).not.toBe("foo-id");
    expect(typeof err.$metadata?.requestId).toBe("string");
    expect((err.$metadata?.requestId ?? "").length).toBeGreaterThan(0);
  });
});
