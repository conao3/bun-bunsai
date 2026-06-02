import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateLocationS3Command,
  CreateTaskCommand,
  DataSyncClient,
  DeleteTaskCommand,
  DescribeTaskCommand,
  ListLocationsCommand,
  ListTasksCommand,
  StartTaskExecutionCommand,
} from "@aws-sdk/client-datasync";

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

const client = () => new DataSyncClient({ endpoint, region, credentials });

test("datasync location and task round-trip", async () => {
  const datasync = client();

  const source = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::bunsai-source-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/datasync-source",
      },
      Subdirectory: "/source",
    }),
  );
  const sourceArn = source.LocationArn;
  expect(sourceArn).toContain(":location/loc-");

  const destination = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::bunsai-destination-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/datasync-dest",
      },
      Subdirectory: "/destination",
    }),
  );
  const destinationArn = destination.LocationArn;
  expect(destinationArn).toContain(":location/loc-");

  const listedLocations = await datasync.send(new ListLocationsCommand({}));
  const locationArns = (listedLocations.Locations ?? []).map(
    (entry) => entry.LocationArn,
  );
  expect(locationArns).toContain(sourceArn);
  expect(locationArns).toContain(destinationArn);

  const createdTask = await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: sourceArn,
      DestinationLocationArn: destinationArn,
      Name: "bunsai-e2e-task",
    }),
  );
  const taskArn = createdTask.TaskArn;
  expect(taskArn).toContain(":task/task-");

  const describedTask = await datasync.send(
    new DescribeTaskCommand({ TaskArn: taskArn }),
  );
  expect(describedTask.TaskArn).toBe(taskArn);
  expect(describedTask.Name).toBe("bunsai-e2e-task");
  expect(describedTask.SourceLocationArn).toBe(sourceArn);
  expect(describedTask.DestinationLocationArn).toBe(destinationArn);
  expect(describedTask.Status).toBe("AVAILABLE");

  const listedTasks = await datasync.send(new ListTasksCommand({}));
  const taskArns = (listedTasks.Tasks ?? []).map((entry) => entry.TaskArn);
  expect(taskArns).toContain(taskArn);

  const execution = await datasync.send(
    new StartTaskExecutionCommand({ TaskArn: taskArn }),
  );
  expect(execution.TaskExecutionArn).toContain(`${taskArn}/execution/exec-`);

  const runningTask = await datasync.send(
    new DescribeTaskCommand({ TaskArn: taskArn }),
  );
  expect(runningTask.Status).toBe("RUNNING");
  expect(runningTask.CurrentTaskExecutionArn).toBe(execution.TaskExecutionArn);

  await datasync.send(new DeleteTaskCommand({ TaskArn: taskArn }));

  await expect(
    datasync.send(new DescribeTaskCommand({ TaskArn: taskArn })),
  ).rejects.toThrow();
});
