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
  StartReplayCommand,
} from "@aws-sdk/client-eventbridge";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eb = () =>
  new EventBridgeClient({ endpoint, region, credentials, requestHandler });

test("EventBridge archive+replay fidelity round-trip", async () => {
  const client = eb();
  const busName = "archive-replay-bus";
  const archiveName = "archive-replay-archive";
  const replayName = "archive-replay-replay";

  const createdBus = await client.send(
    new CreateEventBusCommand({ Name: busName }),
  );
  const busArn = createdBus.EventBusArn!;

  const created = await client.send(
    new CreateArchiveCommand({
      ArchiveName: archiveName,
      EventSourceArn: busArn,
      EventPattern: JSON.stringify({ source: ["archive.source"] }),
      RetentionDays: 7,
    }),
  );
  expect(created.ArchiveArn).toContain(`archive/${archiveName}`);
  expect(created.State).toBe("ENABLED");

  const described0 = await client.send(
    new DescribeArchiveCommand({ ArchiveName: archiveName }),
  );
  expect(described0.EventCount).toBe(0);

  await client.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "archive.source",
          DetailType: "ArchiveTest",
          Detail: JSON.stringify({ payload: "captured" }),
          EventBusName: busName,
        },
        {
          Source: "other.source",
          DetailType: "OtherEvent",
          Detail: JSON.stringify({ payload: "not-captured" }),
          EventBusName: busName,
        },
      ],
    }),
  );

  const described1 = await client.send(
    new DescribeArchiveCommand({ ArchiveName: archiveName }),
  );
  expect(described1.EventCount).toBe(1);

  const archiveArn = created.ArchiveArn!;
  const nowMs = Date.now();
  const started = await client.send(
    new StartReplayCommand({
      ReplayName: replayName,
      EventSourceArn: archiveArn,
      EventStartTime: new Date(nowMs - 3600000),
      EventEndTime: new Date(nowMs + 60000),
      Destination: { Arn: busArn },
    }),
  );
  expect(started.ReplayArn).toContain(`replay/${replayName}`);
  expect(started.State).toBe("STARTING");

  const described2 = await client.send(
    new DescribeReplayCommand({ ReplayName: replayName }),
  );
  expect(described2.ReplayName).toBe(replayName);
  expect(described2.State).toBe("COMPLETED");
  expect(described2.EventSourceArn).toBe(archiveArn);

  const listed = await client.send(
    new ListReplaysCommand({ NamePrefix: "archive-replay" }),
  );
  expect((listed.Replays ?? []).some((r) => r.ReplayName === replayName)).toBe(
    true,
  );

  await client.send(new DeleteArchiveCommand({ ArchiveName: archiveName }));

  await expect(
    client.send(new DescribeArchiveCommand({ ArchiveName: archiveName })),
  ).rejects.toThrow();

  await expect(
    client.send(new DeleteArchiveCommand({ ArchiveName: archiveName })),
  ).rejects.toThrow();
});
