import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateGroupCommand,
  DeleteGroupCommand,
  GetGroupCommand,
  ListGroupsCommand,
  ResourceGroupsClient,
  UpdateGroupCommand,
} from "@aws-sdk/client-resource-groups";

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

const resourcegroups = () =>
  new ResourceGroupsClient({ endpoint, region, credentials });

test("ResourceGroups group roundtrip", async () => {
  const client = resourcegroups();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateGroupCommand({
      Name: name,
      Description: "created by bunsai e2e",
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [{ Key: "stage", Values: ["test"] }],
        }),
      },
    }),
  );
  expect(created.Group?.Name).toBe(name);
  expect(created.Group?.GroupArn).toContain(`group/${name}`);

  const got = await client.send(new GetGroupCommand({ GroupName: name }));
  expect(got.Group?.Name).toBe(name);
  expect(got.Group?.Description).toBe("created by bunsai e2e");

  const listed = await client.send(new ListGroupsCommand({}));
  expect((listed.GroupIdentifiers ?? []).map((g) => g.GroupName)).toContain(
    name,
  );

  const updated = await client.send(
    new UpdateGroupCommand({
      GroupName: name,
      Description: "updated by bunsai e2e",
    }),
  );
  expect(updated.Group?.Description).toBe("updated by bunsai e2e");

  const afterUpdate = await client.send(
    new GetGroupCommand({ GroupName: name }),
  );
  expect(afterUpdate.Group?.Description).toBe("updated by bunsai e2e");

  const deleted = await client.send(
    new DeleteGroupCommand({ GroupName: name }),
  );
  expect(deleted.Group?.Name).toBe(name);

  await expect(
    client.send(new GetGroupCommand({ GroupName: name })),
  ).rejects.toThrow();
});
