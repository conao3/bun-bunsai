import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateArchiveCommand,
  CreateEventBusCommand,
  DeleteArchiveCommand,
  DeleteEventBusCommand,
  DescribeArchiveCommand,
  DescribeEventBusCommand,
  EventBridgeClient,
  ListArchivesCommand,
  ListEventBusesCommand,
} from "@aws-sdk/client-eventbridge";

const awsPort = 4842;
const uiPort = 5842;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

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

const eb = () => new EventBridgeClient({ endpoint, region, credentials });

test("EventBridge event bus lifecycle", async () => {
  const client = eb();
  const busName = "bunsai-e2e-bus";

  const created = await client.send(
    new CreateEventBusCommand({
      Name: busName,
      Description: "bunsai e2e bus",
    }),
  );
  expect(created.EventBusArn).toContain(`event-bus/${busName}`);

  const described = await client.send(
    new DescribeEventBusCommand({ Name: busName }),
  );
  expect(described.Name).toBe(busName);
  expect(described.Arn).toContain(`event-bus/${busName}`);
  expect(described.Description).toBe("bunsai e2e bus");

  const listed = await client.send(new ListEventBusesCommand({}));
  expect((listed.EventBuses ?? []).some((bus) => bus.Name === busName)).toBe(
    true,
  );

  const prefixed = await client.send(
    new ListEventBusesCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect((prefixed.EventBuses ?? []).some((bus) => bus.Name === busName)).toBe(
    true,
  );

  await client.send(new DeleteEventBusCommand({ Name: busName }));

  await expect(
    client.send(new DescribeEventBusCommand({ Name: busName })),
  ).rejects.toThrow();
});

test("EventBridge archive lifecycle", async () => {
  const client = eb();
  const archiveName = "bunsai-e2e-archive";
  const eventSourceArn = `arn:aws:events:${region}:000000000000:event-bus/default`;

  const created = await client.send(
    new CreateArchiveCommand({
      ArchiveName: archiveName,
      EventSourceArn: eventSourceArn,
      Description: "bunsai e2e archive",
      RetentionDays: 7,
    }),
  );
  expect(created.ArchiveArn).toContain(`archive/${archiveName}`);
  expect(created.State).toBe("ENABLED");

  const described = await client.send(
    new DescribeArchiveCommand({ ArchiveName: archiveName }),
  );
  expect(described.ArchiveName).toBe(archiveName);
  expect(described.EventSourceArn).toBe(eventSourceArn);
  expect(described.RetentionDays).toBe(7);

  const listed = await client.send(
    new ListArchivesCommand({ NamePrefix: "bunsai-e2e" }),
  );
  expect(
    (listed.Archives ?? []).some(
      (archive) => archive.ArchiveName === archiveName,
    ),
  ).toBe(true);

  await client.send(new DeleteArchiveCommand({ ArchiveName: archiveName }));

  await expect(
    client.send(new DescribeArchiveCommand({ ArchiveName: archiveName })),
  ).rejects.toThrow();
});
