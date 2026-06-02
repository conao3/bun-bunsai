import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDeliveryStreamCommand,
  DeleteDeliveryStreamCommand,
  DescribeDeliveryStreamCommand,
  FirehoseClient,
  ListDeliveryStreamsCommand,
  PutRecordBatchCommand,
  PutRecordCommand,
} from "@aws-sdk/client-firehose";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("firehose e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const firehose = () => new FirehoseClient({ endpoint, region, credentials });

  test("create, describe, list, put and delete a delivery stream", async () => {
    const client = firehose();
    const name = `bunsai-e2e-${Date.now()}`;

    const created = await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(created.DeliveryStreamARN).toContain(name);

    const described = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(described.DeliveryStreamDescription?.DeliveryStreamName).toBe(name);
    expect(described.DeliveryStreamDescription?.DeliveryStreamStatus).toBe(
      "ACTIVE",
    );
    expect(described.DeliveryStreamDescription?.DeliveryStreamType).toBe(
      "DirectPut",
    );

    const listed = await client.send(new ListDeliveryStreamsCommand({}));
    expect(listed.DeliveryStreamNames ?? []).toContain(name);

    const put = await client.send(
      new PutRecordCommand({
        DeliveryStreamName: name,
        Record: { Data: new TextEncoder().encode("hello") },
      }),
    );
    expect(put.RecordId).toBeDefined();

    const batch = await client.send(
      new PutRecordBatchCommand({
        DeliveryStreamName: name,
        Records: [
          { Data: new TextEncoder().encode("a") },
          { Data: new TextEncoder().encode("b") },
        ],
      }),
    );
    expect(batch.FailedPutCount).toBe(0);
    expect((batch.RequestResponses ?? []).length).toBe(2);
    expect(batch.RequestResponses?.[0]?.RecordId).toBeDefined();

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    const afterDelete = await client.send(new ListDeliveryStreamsCommand({}));
    expect(afterDelete.DeliveryStreamNames ?? []).not.toContain(name);
  });
});
