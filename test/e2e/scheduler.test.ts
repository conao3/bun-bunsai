import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateScheduleCommand,
  CreateScheduleGroupCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ListScheduleGroupsCommand,
  ListSchedulesCommand,
  SchedulerClient,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";

const awsPort = 4566;
const uiPort = 5666;
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

const scheduler = () => new SchedulerClient({ endpoint, region, credentials });

test("Scheduler schedule and schedule group roundtrip", async () => {
  const client = scheduler();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateScheduleCommand({
      Name: name,
      ScheduleExpression: "rate(5 minutes)",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: "arn:aws:lambda:us-east-1:000000000000:function:demo",
        RoleArn: "arn:aws:iam::000000000000:role/demo",
      },
    }),
  );
  expect(created.ScheduleArn).toContain(`schedule/default/${name}`);

  const got = await client.send(new GetScheduleCommand({ Name: name }));
  expect(got.Name).toBe(name);
  expect(got.GroupName).toBe("default");
  expect(got.ScheduleExpression).toBe("rate(5 minutes)");
  expect(got.State).toBe("ENABLED");
  expect(got.Target?.Arn).toBe(
    "arn:aws:lambda:us-east-1:000000000000:function:demo",
  );

  const listed = await client.send(new ListSchedulesCommand({}));
  expect((listed.Schedules ?? []).map((s) => s.Name)).toContain(name);

  const updated = await client.send(
    new UpdateScheduleCommand({
      Name: name,
      ScheduleExpression: "rate(10 minutes)",
      State: "DISABLED",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: "arn:aws:lambda:us-east-1:000000000000:function:demo",
        RoleArn: "arn:aws:iam::000000000000:role/demo",
      },
    }),
  );
  expect(updated.ScheduleArn).toBe(created.ScheduleArn);

  const afterUpdate = await client.send(new GetScheduleCommand({ Name: name }));
  expect(afterUpdate.ScheduleExpression).toBe("rate(10 minutes)");
  expect(afterUpdate.State).toBe("DISABLED");

  const groupName = `bunsai-grp-${Date.now()}`;
  const group = await client.send(
    new CreateScheduleGroupCommand({ Name: groupName }),
  );
  expect(group.ScheduleGroupArn).toContain(`schedule-group/${groupName}`);

  const groups = await client.send(new ListScheduleGroupsCommand({}));
  expect((groups.ScheduleGroups ?? []).map((g) => g.Name)).toContain(groupName);

  await client.send(new DeleteScheduleCommand({ Name: name }));
  await expect(
    client.send(new GetScheduleCommand({ Name: name })),
  ).rejects.toThrow();
});
