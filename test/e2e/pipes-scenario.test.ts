import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
import {
  CreatePipeCommand,
  DeletePipeCommand,
  DescribePipeCommand,
  ListPipesCommand,
  ListTagsForResourceCommand,
  PipesClient,
  StartPipeCommand,
  StopPipeCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-pipes";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const pipes = () =>
  new PipesClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });
const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const queueArn = async (queueUrl: string): Promise<string> => {
  const q = sqs();
  const attrs = await q.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["QueueArn"],
    }),
  );
  return attrs.Attributes!.QueueArn!;
};

describe("EventBridge Pipes CRUD", () => {
  test("lifecycle: create → describe → update → delete", async () => {
    const q = sqs();
    const p = pipes();

    const src = await q.send(new CreateQueueCommand({ QueueName: "crud-src" }));
    const tgt = await q.send(new CreateQueueCommand({ QueueName: "crud-tgt" }));
    const srcArn = await queueArn(src.QueueUrl!);
    const tgtArn = await queueArn(tgt.QueueUrl!);

    const created = await p.send(
      new CreatePipeCommand({
        Name: "crud-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/pipes-role",
      }),
    );
    expect(created.Name).toBe("crud-pipe");
    expect(created.CurrentState).toBe("CREATING");
    expect(created.DesiredState).toBe("RUNNING");

    const described = await p.send(
      new DescribePipeCommand({ Name: "crud-pipe" }),
    );
    expect(described.CurrentState).toBe("RUNNING");
    expect(described.Source).toBe(srcArn);
    expect(described.Target).toBe(tgtArn);

    const listed = await p.send(new ListPipesCommand({}));
    expect(listed.Pipes!.some((pp) => pp.Name === "crud-pipe")).toBe(true);

    const deleted = await p.send(new DeletePipeCommand({ Name: "crud-pipe" }));
    expect(deleted.CurrentState).toBe("DELETING");

    const listed2 = await p.send(new ListPipesCommand({}));
    expect(listed2.Pipes!.some((pp) => pp.Name === "crud-pipe")).toBe(false);
  });

  test("conflict: duplicate create throws ConflictException", async () => {
    const q = sqs();
    const p = pipes();

    const src = await q.send(
      new CreateQueueCommand({ QueueName: "conflict-src" }),
    );
    const tgt = await q.send(
      new CreateQueueCommand({ QueueName: "conflict-tgt" }),
    );
    const srcArn = await queueArn(src.QueueUrl!);
    const tgtArn = await queueArn(tgt.QueueUrl!);

    await p.send(
      new CreatePipeCommand({
        Name: "conflict-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/pipes-role",
      }),
    );

    await expect(
      p.send(
        new CreatePipeCommand({
          Name: "conflict-pipe",
          Source: srcArn,
          Target: tgtArn,
          RoleArn: "arn:aws:iam::000000000000:role/pipes-role",
        }),
      ),
    ).rejects.toMatchObject({ name: "ConflictException" });

    await p.send(new DeletePipeCommand({ Name: "conflict-pipe" }));
  });

  test("not found: describe nonexistent pipe throws NotFoundException", async () => {
    const p = pipes();
    await expect(
      p.send(new DescribePipeCommand({ Name: "does-not-exist" })),
    ).rejects.toMatchObject({ name: "NotFoundException" });
  });

  test("tags round-trip", async () => {
    const q = sqs();
    const p = pipes();

    const src = await q.send(new CreateQueueCommand({ QueueName: "tag-src" }));
    const tgt = await q.send(new CreateQueueCommand({ QueueName: "tag-tgt" }));
    const srcArn = await queueArn(src.QueueUrl!);
    const tgtArn = await queueArn(tgt.QueueUrl!);

    const created = await p.send(
      new CreatePipeCommand({
        Name: "tag-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/pipes-role",
        Tags: { env: "test" },
      }),
    );

    const described = await p.send(
      new DescribePipeCommand({ Name: "tag-pipe" }),
    );
    const pipeArn = described.Arn!;
    expect(described.Tags).toMatchObject({ env: "test" });

    await p.send(
      new TagResourceCommand({ resourceArn: pipeArn, tags: { team: "alpha" } }),
    );

    const listed = await p.send(
      new ListTagsForResourceCommand({ resourceArn: pipeArn }),
    );
    expect(listed.tags).toMatchObject({ env: "test", team: "alpha" });

    await p.send(
      new UntagResourceCommand({ resourceArn: pipeArn, tagKeys: ["env"] }),
    );

    const listed2 = await p.send(
      new ListTagsForResourceCommand({ resourceArn: pipeArn }),
    );
    expect(listed2.tags).not.toHaveProperty("env");
    expect(listed2.tags).toMatchObject({ team: "alpha" });

    await p.send(new DeletePipeCommand({ Name: "tag-pipe" }));
  });

  test("ListPipes with Prefix filter", async () => {
    const q = sqs();
    const p = pipes();

    const src = await q.send(
      new CreateQueueCommand({ QueueName: "prefix-src" }),
    );
    const tgt = await q.send(
      new CreateQueueCommand({ QueueName: "prefix-tgt" }),
    );
    const srcArn = await queueArn(src.QueueUrl!);
    const tgtArn = await queueArn(tgt.QueueUrl!);

    await p.send(
      new CreatePipeCommand({
        Name: "prefix-alpha",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
      }),
    );
    await p.send(
      new CreatePipeCommand({
        Name: "prefix-beta",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
      }),
    );
    await p.send(
      new CreatePipeCommand({
        Name: "other-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
      }),
    );

    const filtered = await p.send(
      new ListPipesCommand({ NamePrefix: "prefix-" }),
    );
    const names = filtered.Pipes!.map((pp) => pp.Name);
    expect(names).toContain("prefix-alpha");
    expect(names).toContain("prefix-beta");
    expect(names).not.toContain("other-pipe");

    for (const name of ["prefix-alpha", "prefix-beta", "other-pipe"]) {
      await p.send(new DeletePipeCommand({ Name: name }));
    }
  });
});

describe("EventBridge Pipes delivery: SQS → SQS", () => {
  test("SendMessage to source queue delivers to target queue", async () => {
    const q = sqs();
    const p = pipes();

    const srcQ = await q.send(
      new CreateQueueCommand({ QueueName: "delivery-src" }),
    );
    const tgtQ = await q.send(
      new CreateQueueCommand({ QueueName: "delivery-tgt" }),
    );
    const srcArn = await queueArn(srcQ.QueueUrl!);
    const tgtArn = await queueArn(tgtQ.QueueUrl!);

    await p.send(
      new CreatePipeCommand({
        Name: "delivery-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
      }),
    );
    await p.send(new DescribePipeCommand({ Name: "delivery-pipe" }));

    await q.send(
      new SendMessageCommand({
        QueueUrl: srcQ.QueueUrl!,
        MessageBody: "hello-pipe",
      }),
    );

    const received = await q.send(
      new ReceiveMessageCommand({
        QueueUrl: tgtQ.QueueUrl!,
        MaxNumberOfMessages: 1,
      }),
    );
    expect(received.Messages).toHaveLength(1);
    expect(received.Messages![0]!.Body).toBe("hello-pipe");

    await p.send(new DeletePipeCommand({ Name: "delivery-pipe" }));
  });
});

describe("EventBridge Pipes delivery: filter", () => {
  test("matching filter delivers; non-matching filter drops", async () => {
    const q = sqs();
    const p = pipes();

    const srcQ = await q.send(
      new CreateQueueCommand({ QueueName: "filter-src" }),
    );
    const tgtQ = await q.send(
      new CreateQueueCommand({ QueueName: "filter-tgt" }),
    );
    const srcArn = await queueArn(srcQ.QueueUrl!);
    const tgtArn = await queueArn(tgtQ.QueueUrl!);

    const filterPattern = JSON.stringify({ body: '{"type":["order"]}' });

    await p.send(
      new CreatePipeCommand({
        Name: "filter-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
        SourceParameters: {
          FilterCriteria: {
            Filters: [{ Pattern: '{"body":{"type":["order"]}}' }],
          },
        },
      }),
    );
    await p.send(new DescribePipeCommand({ Name: "filter-pipe" }));

    await q.send(
      new SendMessageCommand({
        QueueUrl: srcQ.QueueUrl!,
        MessageBody: JSON.stringify({ type: "payment" }),
      }),
    );
    const noMatch = await q.send(
      new ReceiveMessageCommand({
        QueueUrl: tgtQ.QueueUrl!,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      }),
    );
    expect(noMatch.Messages ?? []).toHaveLength(0);

    await q.send(
      new SendMessageCommand({
        QueueUrl: srcQ.QueueUrl!,
        MessageBody: JSON.stringify({ type: "order" }),
      }),
    );
    const match = await q.send(
      new ReceiveMessageCommand({
        QueueUrl: tgtQ.QueueUrl!,
        MaxNumberOfMessages: 1,
      }),
    );
    expect(match.Messages).toHaveLength(1);

    await p.send(new DeletePipeCommand({ Name: "filter-pipe" }));
  });
});

describe("EventBridge Pipes delivery: Lambda target", () => {
  test("SendMessage to source triggers Lambda function", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunsai-pipes-"));
    const marker = join(dir, "out.json");

    const q = sqs();
    const p = pipes();
    const l = lambda();

    const srcQ = await q.send(
      new CreateQueueCommand({ QueueName: "lambda-src" }),
    );
    const srcArn = await queueArn(srcQ.QueueUrl!);

    await l.send(
      new CreateFunctionCommand({
        FunctionName: "pipe-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );

    const fnArn = `arn:aws:lambda:${region}:000000000000:function:pipe-fn`;

    await p.send(
      new CreatePipeCommand({
        Name: "lambda-pipe",
        Source: srcArn,
        Target: fnArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
      }),
    );
    await p.send(new DescribePipeCommand({ Name: "lambda-pipe" }));

    await q.send(
      new SendMessageCommand({
        QueueUrl: srcQ.QueueUrl!,
        MessageBody: "invoke-lambda",
      }),
    );

    const event = JSON.parse(readFileSync(marker, "utf8"));
    expect(event.Records).toBeDefined();
    expect(event.Records[0].body).toBe("invoke-lambda");

    await p.send(new DeletePipeCommand({ Name: "lambda-pipe" }));
  });
});

describe("EventBridge Pipes: Stop/Start lifecycle", () => {
  test("Stop prevents delivery; Start resumes delivery", async () => {
    const q = sqs();
    const p = pipes();

    const srcQ = await q.send(
      new CreateQueueCommand({ QueueName: "stop-src" }),
    );
    const tgtQ = await q.send(
      new CreateQueueCommand({ QueueName: "stop-tgt" }),
    );
    const srcArn = await queueArn(srcQ.QueueUrl!);
    const tgtArn = await queueArn(tgtQ.QueueUrl!);

    await p.send(
      new CreatePipeCommand({
        Name: "stop-pipe",
        Source: srcArn,
        Target: tgtArn,
        RoleArn: "arn:aws:iam::000000000000:role/r",
      }),
    );
    await p.send(new DescribePipeCommand({ Name: "stop-pipe" }));

    const stopped = await p.send(new StopPipeCommand({ Name: "stop-pipe" }));
    expect(stopped.CurrentState).toBe("STOPPING");

    const afterStop = await p.send(
      new DescribePipeCommand({ Name: "stop-pipe" }),
    );
    expect(afterStop.CurrentState).toBe("STOPPED");

    await q.send(
      new SendMessageCommand({
        QueueUrl: srcQ.QueueUrl!,
        MessageBody: "while-stopped",
      }),
    );
    const notDelivered = await q.send(
      new ReceiveMessageCommand({
        QueueUrl: tgtQ.QueueUrl!,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
      }),
    );
    expect(notDelivered.Messages ?? []).toHaveLength(0);

    const started = await p.send(new StartPipeCommand({ Name: "stop-pipe" }));
    expect(started.CurrentState).toBe("STARTING");
    const afterStart = await p.send(
      new DescribePipeCommand({ Name: "stop-pipe" }),
    );
    expect(afterStart.CurrentState).toBe("RUNNING");

    await q.send(
      new SendMessageCommand({
        QueueUrl: srcQ.QueueUrl!,
        MessageBody: "after-restart",
      }),
    );
    const delivered = await q.send(
      new ReceiveMessageCommand({
        QueueUrl: tgtQ.QueueUrl!,
        MaxNumberOfMessages: 1,
      }),
    );
    expect(delivered.Messages).toHaveLength(1);
    expect(delivered.Messages![0]!.Body).toBe("after-restart");

    await p.send(new DeletePipeCommand({ Name: "stop-pipe" }));
  });
});
