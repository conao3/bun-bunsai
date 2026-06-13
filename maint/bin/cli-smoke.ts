const cliCheck = Bun.spawnSync(["aws", "--version"], {
  stdout: "pipe",
  stderr: "pipe",
});
if (cliCheck.exitCode !== 0) {
  console.error(
    "error: aws CLI not found in PATH. Install AWS CLI v2 before running this script.",
  );
  process.exit(1);
}

const tmpServer = Bun.serve({ port: 0, fetch: () => new Response("ok") });
const port = tmpServer.port;
await tmpServer.stop();

const serverProc = Bun.spawn(["bun", "apps/server/src/index.ts"], {
  env: {
    ...process.env,
    BUNSAI_PORT: String(port),
  },
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

const endpoint = `http://localhost:${port}`;
const awsEnv = {
  ...process.env,
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  AWS_DEFAULT_REGION: "us-east-1",
  AWS_PAGER: "",
};

function awsCli(args: string[]): string {
  const result = Bun.spawnSync(["aws", "--endpoint-url", endpoint, ...args], {
    env: awsEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `aws ${args.join(" ")} exited with ${result.exitCode}: ${result.stderr.toString().slice(0, 500)}`,
    );
  }
  return result.stdout.toString();
}

let exitCode = 0;

try {
  await waitReady(port);

  const identity = JSON.parse(awsCli(["sts", "get-caller-identity"])) as {
    Account?: string;
  };
  if (identity.Account !== "000000000000")
    throw new Error(`unexpected sts account: ${identity.Account}`);
  console.log("✓ sts get-caller-identity");

  awsCli(["s3api", "create-bucket", "--bucket", "cli-smoke-bucket"]);
  await Bun.write("/tmp/cli-smoke-payload.txt", "hello-cli");
  awsCli([
    "s3api",
    "put-object",
    "--bucket",
    "cli-smoke-bucket",
    "--key",
    "greeting.txt",
    "--body",
    "/tmp/cli-smoke-payload.txt",
  ]);
  awsCli([
    "s3api",
    "get-object",
    "--bucket",
    "cli-smoke-bucket",
    "--key",
    "greeting.txt",
    "/tmp/cli-smoke-out.txt",
  ]);
  const body = await Bun.file("/tmp/cli-smoke-out.txt").text();
  if (body !== "hello-cli") throw new Error(`s3 body mismatch: ${body}`);
  console.log("✓ s3api create-bucket / put-object / get-object");

  const queue = JSON.parse(
    awsCli(["sqs", "create-queue", "--queue-name", "cli-smoke-queue"]),
  ) as { QueueUrl?: string };
  const queueUrl = queue.QueueUrl ?? "";
  awsCli([
    "sqs",
    "send-message",
    "--queue-url",
    queueUrl,
    "--message-body",
    "hello-sqs",
  ]);
  const received = JSON.parse(
    awsCli(["sqs", "receive-message", "--queue-url", queueUrl]),
  ) as { Messages?: { Body?: string }[] };
  if (received.Messages?.[0]?.Body !== "hello-sqs")
    throw new Error("sqs message body mismatch");
  console.log("✓ sqs create-queue / send-message / receive-message");

  awsCli([
    "dynamodb",
    "create-table",
    "--table-name",
    "cli-smoke-table",
    "--billing-mode",
    "PAY_PER_REQUEST",
    "--attribute-definitions",
    "AttributeName=pk,AttributeType=S",
    "--key-schema",
    "AttributeName=pk,KeyType=HASH",
  ]);
  awsCli([
    "dynamodb",
    "put-item",
    "--table-name",
    "cli-smoke-table",
    "--item",
    '{"pk":{"S":"k1"},"v":{"N":"42"}}',
  ]);
  const item = JSON.parse(
    awsCli([
      "dynamodb",
      "get-item",
      "--table-name",
      "cli-smoke-table",
      "--key",
      '{"pk":{"S":"k1"}}',
    ]),
  ) as { Item?: { v?: { N?: string } } };
  if (item.Item?.v?.N !== "42") throw new Error("dynamodb item mismatch");
  console.log("✓ dynamodb create-table / put-item / get-item");

  console.log("cli-smoke: all checks passed");
} catch (err) {
  console.error("cli-smoke FAILED:", err);
  exitCode = 1;
} finally {
  serverProc.kill();
  await serverProc.exited;
}

process.exit(exitCode);
