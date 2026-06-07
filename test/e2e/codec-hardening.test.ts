import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { CreateRouteServerCommand, EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("codec hardening: empty required string and long precision", () => {
  test("SendMessage with empty MessageBody succeeds (no 400)", async () => {
    const sqs = new SQSClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const q = await sqs.send(
      new CreateQueueCommand({ QueueName: "codec-hardening-empty-body" }),
    );
    const queueUrl = q.QueueUrl ?? "";
    expect(queueUrl).toBeTruthy();

    const sent = await sqs.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "" }),
    );
    expect(sent.$metadata.httpStatusCode).toBe(200);
    expect(sent.MessageId).toBeDefined();

    const recv = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(recv.Messages?.length).toBe(1);
    expect(recv.Messages?.[0]?.Body).toBe("");

    await sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("SendMessage with non-empty MessageBody still succeeds", async () => {
    const sqs = new SQSClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const q = await sqs.send(
      new CreateQueueCommand({ QueueName: "codec-hardening-nonempty-body" }),
    );
    const queueUrl = q.QueueUrl ?? "";

    const sent = await sqs.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "hello" }),
    );
    expect(sent.$metadata.httpStatusCode).toBe(200);
    expect(sent.MessageId).toBeDefined();

    await sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("CreateRouteServer with safe-range AmazonSideAsn (long) roundtrips", async () => {
    const ec2 = new EC2Client({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const res = await ec2.send(
      new CreateRouteServerCommand({ AmazonSideAsn: 64512 }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.RouteServer?.AmazonSideAsn).toBe(64512);
    expect(res.RouteServer?.RouteServerId).toBeDefined();
  });
});
