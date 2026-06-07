import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateScheduleCommand,
  CreateScheduleGroupCommand,
  DeleteScheduleCommand,
  DeleteScheduleGroupCommand,
  GetScheduleCommand,
  GetScheduleGroupCommand,
  ListScheduleGroupsCommand,
  ListSchedulesCommand,
  ListTagsForResourceCommand,
  SchedulerClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const scheduler = () =>
  new SchedulerClient({ endpoint, region, credentials, requestHandler });

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

test("Scheduler schedule group get and delete", async () => {
  const client = scheduler();
  const groupName = `bunsai-grp-getdel-${Date.now()}`;

  const created = await client.send(
    new CreateScheduleGroupCommand({ Name: groupName }),
  );
  expect(created.ScheduleGroupArn).toContain(`schedule-group/${groupName}`);

  const got = await client.send(
    new GetScheduleGroupCommand({ Name: groupName }),
  );
  expect(got.Name).toBe(groupName);
  expect(got.State).toBe("ACTIVE");
  expect(got.Arn).toContain(`schedule-group/${groupName}`);

  await client.send(new DeleteScheduleGroupCommand({ Name: groupName }));
  await expect(
    client.send(new GetScheduleGroupCommand({ Name: groupName })),
  ).rejects.toThrow();
});

test("Scheduler tag, list tags, and untag roundtrip", async () => {
  const client = scheduler();
  const groupName = `bunsai-grp-tags-${Date.now()}`;

  const created = await client.send(
    new CreateScheduleGroupCommand({ Name: groupName }),
  );
  const resourceArn = created.ScheduleGroupArn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("platform");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  const afterTagMap = Object.fromEntries(
    (afterUntag.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(afterTagMap["env"]).toBeUndefined();
  expect(afterTagMap["team"]).toBe("platform");

  await client.send(new DeleteScheduleGroupCommand({ Name: groupName }));
});

test("Scheduler at() past expression delivers to SQS target", async () => {
  const client = scheduler();
  const sqsClient = new SQSClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });
  const queueName = `bunsai-sched-at-q-${Date.now()}`;
  const scheduleName = `bunsai-sched-at-${Date.now()}`;
  const queueArn = `arn:aws:sqs:${region}:000000000000:${queueName}`;

  const queue = await sqsClient.send(
    new CreateQueueCommand({ QueueName: queueName }),
  );
  const queueUrl = queue.QueueUrl!;

  await client.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      ScheduleExpression: "at(2020-01-01T00:00:00Z)",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: queueArn,
        RoleArn: "arn:aws:iam::000000000000:role/demo",
        Input: '{"hello":"scheduler"}',
      },
    }),
  );

  await Bun.sleep(500);

  const received = await sqsClient.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl }),
  );
  expect(received.Messages).toHaveLength(1);
  const body = JSON.parse(received.Messages![0]!.Body!);
  expect(body.hello).toBe("scheduler");

  await client.send(new DeleteScheduleCommand({ Name: scheduleName }));
  await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
});

test("Scheduler DeleteSchedule cancels pending timer", async () => {
  const client = scheduler();
  const sqsClient = new SQSClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });
  const queueName = `bunsai-sched-cancel-q-${Date.now()}`;
  const scheduleName = `bunsai-sched-cancel-${Date.now()}`;
  const queueArn = `arn:aws:sqs:${region}:000000000000:${queueName}`;

  const queue = await sqsClient.send(
    new CreateQueueCommand({ QueueName: queueName }),
  );
  const queueUrl = queue.QueueUrl!;

  const futureMs = Date.now() + 30_000;
  const futureIso = new Date(futureMs).toISOString().slice(0, 19);
  await client.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      ScheduleExpression: `at(${futureIso})`,
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: queueArn,
        RoleArn: "arn:aws:iam::000000000000:role/demo",
        Input: '{"cancelled":true}',
      },
    }),
  );

  await client.send(new DeleteScheduleCommand({ Name: scheduleName }));

  await Bun.sleep(200);

  const received = await sqsClient.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl }),
  );
  expect(received.Messages ?? []).toHaveLength(0);

  await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
});
