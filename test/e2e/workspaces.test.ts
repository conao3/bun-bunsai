import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateTagsCommand,
  CreateWorkspacesCommand,
  DescribeTagsCommand,
  DescribeWorkspacesCommand,
  TerminateWorkspacesCommand,
  WorkSpacesClient,
} from "@aws-sdk/client-workspaces";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const workspaces = () =>
  new WorkSpacesClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("WorkSpaces lifecycle", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        {
          DirectoryId: "d-1234567890",
          UserName: "bunsai-user",
          BundleId: "wsb-bunsai01",
        },
      ],
    }),
  );
  expect(created.FailedRequests?.length).toBe(0);
  const workspaceId = created.PendingRequests?.[0]?.WorkspaceId;
  expect(workspaceId).toBeDefined();
  expect(created.PendingRequests?.[0]?.State).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeWorkspacesCommand({
      WorkspaceIds: [workspaceId as string],
    }),
  );
  expect(described.Workspaces?.[0]?.WorkspaceId).toBe(workspaceId);
  expect(described.Workspaces?.[0]?.State).toBe("AVAILABLE");

  await client.send(
    new CreateTagsCommand({
      ResourceId: workspaceId as string,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const tags = await client.send(
    new DescribeTagsCommand({ ResourceId: workspaceId as string }),
  );
  expect(tags.TagList?.some((tag) => tag.Key === "env")).toBe(true);

  const terminated = await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [{ WorkspaceId: workspaceId as string }],
    }),
  );
  expect(terminated.FailedRequests?.length).toBe(0);

  const afterTerminate = await client.send(new DescribeWorkspacesCommand({}));
  expect(
    (afterTerminate.Workspaces ?? []).some(
      (w) => w.WorkspaceId === workspaceId,
    ),
  ).toBe(false);
});
