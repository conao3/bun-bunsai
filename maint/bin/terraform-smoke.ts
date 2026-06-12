import {
  GetQueueUrlCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  DescribeTableCommand,
  PutItemCommand,
  GetItemCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  DescribeLogGroupsCommand,
  CloudWatchLogsClient,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  PutEventsCommand,
  EventBridgeClient,
} from "@aws-sdk/client-eventbridge";
import {
  InvokeCommand,
  GetFunctionCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { resolve } from "path";

const tfCheck = Bun.spawnSync(["terraform", "version"], {
  stdout: "pipe",
  stderr: "pipe",
});
if (tfCheck.exitCode !== 0) {
  console.error(
    "error: terraform binary not found in PATH. Install terraform before running this script.",
  );
  process.exit(1);
}

const tmpServer = Bun.serve({ port: 0, fetch: () => new Response("ok") });
const port = tmpServer.port;
await tmpServer.stop();

const serverProc = Bun.spawn(["bun", "apps/server/src/index.ts"], {
  env: { ...process.env, BUNSAI_PORT: String(port) },
  stdout: "pipe",
  stderr: "pipe",
});

async function waitReady(p: number, ms = 15000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://localhost:${p}/`);
      return;
    } catch {
      await Bun.sleep(200);
    }
  }
  throw new Error(`bunsai did not become ready on port ${p} within ${ms}ms`);
}

let exitCode = 0;

try {
  await waitReady(port);

  const projectRoot = resolve(import.meta.dir, "../..");
  const tfDir = resolve(projectRoot, "test/terraform");
  const tfEnv = { ...process.env, TF_VAR_bunsai_port: String(port) };

  function tf(args: string[]): void {
    const result = Bun.spawnSync(["terraform", ...args], {
      cwd: tfDir,
      env: tfEnv,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `terraform ${args[0]} exited with code ${result.exitCode}`,
      );
    }
  }

  tf(["init", "-input=false"]);
  tf(["apply", "-auto-approve"]);

  const endpoint = `http://localhost:${port}`;
  const region = "us-east-1";
  const credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  } as const;

  const sqs = new SQSClient({ endpoint, region, credentials });
  const logs = new CloudWatchLogsClient({ endpoint, region, credentials });
  const events = new EventBridgeClient({ endpoint, region, credentials });
  const lambda = new LambdaClient({ endpoint, region, credentials });
  const queueResult = await sqs.send(
    new GetQueueUrlCommand({ QueueName: "tf-smoke-queue" }),
  );
  const queueUrl = queueResult.QueueUrl!;
  await sqs.send(
    new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "hello-sqs" }),
  );
  const sqsMsg = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 1 }),
  );
  if (!sqsMsg.Messages?.length)
    throw new Error("SQS read-after-write: no messages received");
  console.log("✓ SQS queue verified");

  const ddb = new DynamoDBClient({ endpoint, region, credentials });
  await ddb.send(new DescribeTableCommand({ TableName: "tf-smoke-table" }));
  await ddb.send(
    new PutItemCommand({
      TableName: "tf-smoke-table",
      Item: { pk: { S: "smoke-key" } },
    }),
  );
  const ddbGet = await ddb.send(
    new GetItemCommand({
      TableName: "tf-smoke-table",
      Key: { pk: { S: "smoke-key" } },
    }),
  );
  if (ddbGet.Item?.pk?.S !== "smoke-key")
    throw new Error("DynamoDB read-after-write mismatch");
  console.log("✓ DynamoDB table verified");

  const sns = new SNSClient({ endpoint, region, credentials });
  await sns.send(
    new PublishCommand({
      TopicArn: "arn:aws:sns:us-east-1:000000000000:tf-smoke-topic",
      Message: "hello-sns",
    }),
  );
  const snsMsg = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10 }),
  );
  if (!snsMsg.Messages?.some((m) => (m.Body ?? "").includes("hello-sns")))
    throw new Error("SNS→SQS delivery: published message not received");
  console.log("✓ SNS topic + SQS subscription verified");

  const logGroupsResult = await logs.send(
    new DescribeLogGroupsCommand({
      logGroupNamePrefix: "/aws/lambda/tf-smoke-fn",
    }),
  );
  if (
    !logGroupsResult.logGroups?.some(
      (g) => g.logGroupName === "/aws/lambda/tf-smoke-fn",
    )
  )
    throw new Error("CloudWatch log group not found");
  console.log("✓ CloudWatch log group verified");

  const purgeResult = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10 }),
  );
  const beforeEventCount = purgeResult.Messages?.length ?? 0;

  await events.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "smoke.test",
          DetailType: "SmokeTest",
          Detail: JSON.stringify({ msg: "hello-events" }),
        },
      ],
    }),
  );
  const eventsMsg = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10 }),
  );
  const afterEventCount = eventsMsg.Messages?.length ?? 0;
  if (afterEventCount <= beforeEventCount)
    throw new Error(
      "EventBridge→SQS delivery: no new messages after PutEvents",
    );
  console.log("✓ EventBridge rule → SQS target verified");

  const invokeResult = await lambda.send(
    new InvokeCommand({
      FunctionName: "tf-smoke-fn",
      Payload: JSON.stringify({ ping: true }),
    }),
  );
  if (invokeResult.StatusCode !== 200)
    throw new Error(
      `Lambda invoke: expected 200, got ${invokeResult.StatusCode}`,
    );
  const invokePayload = JSON.parse(
    Buffer.from(invokeResult.Payload!).toString(),
  ) as { statusCode: number; body: string };
  if (invokePayload.statusCode !== 200)
    throw new Error(
      `Lambda invoke payload statusCode: expected 200, got ${invokePayload.statusCode}`,
    );
  console.log("✓ Lambda function invoked successfully");

  tf(["destroy", "-auto-approve"]);

  let sqsGone = false;
  try {
    await sqs.send(new GetQueueUrlCommand({ QueueName: "tf-smoke-queue" }));
  } catch {
    sqsGone = true;
  }
  if (!sqsGone) throw new Error("SQS queue still exists after destroy");
  console.log("✓ SQS queue gone after destroy");

  let ddbGone = false;
  try {
    await ddb.send(new DescribeTableCommand({ TableName: "tf-smoke-table" }));
  } catch {
    ddbGone = true;
  }
  if (!ddbGone) throw new Error("DynamoDB table still exists after destroy");
  console.log("✓ DynamoDB table gone after destroy");

  let logGroupGone = false;
  try {
    const r = await logs.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: "/aws/lambda/tf-smoke-fn",
      }),
    );
    if (!r.logGroups?.some((g) => g.logGroupName === "/aws/lambda/tf-smoke-fn"))
      logGroupGone = true;
  } catch {
    logGroupGone = true;
  }
  if (!logGroupGone)
    throw new Error("CloudWatch log group still exists after destroy");
  console.log("✓ CloudWatch log group gone after destroy");

  let lambdaGone = false;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: "tf-smoke-fn" }));
  } catch {
    lambdaGone = true;
  }
  if (!lambdaGone)
    throw new Error("Lambda function still exists after destroy");
  console.log("✓ Lambda function gone after destroy");

  console.log("terraform-smoke: all checks passed");
} catch (err) {
  console.error("terraform-smoke FAILED:", err);
  exitCode = 1;
} finally {
  serverProc.kill();
  await serverProc.exited;
}

process.exit(exitCode);
