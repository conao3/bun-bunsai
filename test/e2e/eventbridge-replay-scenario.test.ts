import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateArchiveCommand,
  CreateEventBusCommand,
  DeleteArchiveCommand,
  DescribeArchiveCommand,
  DescribeReplayCommand,
  EventBridgeClient,
  ListReplaysCommand,
  PutEventsCommand,
  PutRuleCommand,
  PutTargetsCommand,
  StartReplayCommand,
} from "@aws-sdk/client-eventbridge";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eb = () =>
  new EventBridgeClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });

const queueArnOf = async (q: SQSClient, url: string): Promise<string> => {
  const attrs = await q.send(
    new GetQueueAttributesCommand({
      QueueUrl: url,
      AttributeNames: ["QueueArn"],
    }),
  );
  return attrs.Attributes?.QueueArn as string;
};

test("EventBridge archive + replay scenario", async () => {
  const client = eb();
  const q = sqs();
  const busName = "replay-scenario-bus";
  const archiveName = "replay-scenario-archive";
  const replayName = "replay-scenario-replay";

  const busRes = await client.send(
    new CreateEventBusCommand({ Name: busName }),
  );
  const busArn = busRes.EventBusArn!;

  const queueUrl = (
    await q.send(new CreateQueueCommand({ QueueName: "replay-scenario-q" }))
  ).QueueUrl as string;
  const queueArn = await queueArnOf(q, queueUrl);

  await client.send(
    new PutRuleCommand({
      Name: "replay-scenario-rule",
      EventBusName: busName,
      EventPattern: JSON.stringify({ source: ["myapp.replay"] }),
    }),
  );
  await client.send(
    new PutTargetsCommand({
      Rule: "replay-scenario-rule",
      EventBusName: busName,
      Targets: [{ Id: "t1", Arn: queueArn }],
    }),
  );

  const archiveRes = await client.send(
    new CreateArchiveCommand({
      ArchiveName: archiveName,
      EventSourceArn: busArn,
      EventPattern: JSON.stringify({ source: ["myapp.replay"] }),
    }),
  );
  expect(archiveRes.State).toBe("ENABLED");
  expect(archiveRes.ArchiveArn).toContain(`archive/${archiveName}`);

  const nowMs = Date.now();
  await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: busName,
          Source: "myapp.replay",
          DetailType: "TestEvent",
          Detail: JSON.stringify({ msg: "event1" }),
        },
        {
          EventBusName: busName,
          Source: "myapp.replay",
          DetailType: "TestEvent",
          Detail: JSON.stringify({ msg: "event2" }),
        },
      ],
    }),
  );

  const recv1 = await q.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10 }),
  );
  expect(recv1.Messages).toHaveLength(2);
  for (const msg of recv1.Messages!) {
    const event = JSON.parse(msg.Body!);
    expect(event["replay-name"]).toBeUndefined();
  }

  const desc0 = await client.send(
    new DescribeArchiveCommand({ ArchiveName: archiveName }),
  );
  expect(desc0.EventCount).toBe(2);

  const started = await client.send(
    new StartReplayCommand({
      ReplayName: replayName,
      EventSourceArn: archiveRes.ArchiveArn,
      EventStartTime: new Date(nowMs - 3600000),
      EventEndTime: new Date(nowMs + 60000),
      Destination: { Arn: busArn },
    }),
  );
  expect(started.State).toBe("STARTING");
  expect(started.ReplayArn).toContain(`replay/${replayName}`);

  const recv2 = await q.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10 }),
  );
  expect(recv2.Messages).toHaveLength(2);
  for (const msg of recv2.Messages!) {
    const event = JSON.parse(msg.Body!);
    expect(event["replay-name"]).toBe(replayName);
  }

  const replayDesc = await client.send(
    new DescribeReplayCommand({ ReplayName: replayName }),
  );
  expect(replayDesc.State).toBe("COMPLETED");
  expect(replayDesc.ReplayName).toBe(replayName);
  expect(replayDesc.EventSourceArn).toBe(archiveRes.ArchiveArn);

  const listed = await client.send(
    new ListReplaysCommand({ NamePrefix: "replay-scenario" }),
  );
  expect((listed.Replays ?? []).some((r) => r.ReplayName === replayName)).toBe(
    true,
  );

  await client.send(new DeleteArchiveCommand({ ArchiveName: archiveName }));

  await expect(
    client.send(new DescribeArchiveCommand({ ArchiveName: archiveName })),
  ).rejects.toThrow();
});
