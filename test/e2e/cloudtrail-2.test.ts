import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddTagsCommand,
  CloudTrailClient,
  CreateTrailCommand,
  DeleteTrailCommand,
  GetEventSelectorsCommand,
  ListTagsCommand,
  PutEventSelectorsCommand,
  RemoveTagsCommand,
  UpdateTrailCommand,
} from "@aws-sdk/client-cloudtrail";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4621;
const uiPort = 5721;
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

const cloudtrail = () =>
  new CloudTrailClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("CloudTrail update, event selectors and tags", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail-2";

  const created = await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-bucket-2",
    }),
  );
  const trailArn = created.TrailARN ?? "";
  expect(trailArn).toContain(trailName);

  const updated = await client.send(
    new UpdateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-bucket-updated",
      IsMultiRegionTrail: true,
      EnableLogFileValidation: true,
    }),
  );
  expect(updated.S3BucketName).toBe("bunsai-e2e-bucket-updated");
  expect(updated.IsMultiRegionTrail).toBe(true);
  expect(updated.LogFileValidationEnabled).toBe(true);
  expect(updated.TrailARN).toBe(trailArn);

  const put = await client.send(
    new PutEventSelectorsCommand({
      TrailName: trailName,
      EventSelectors: [
        {
          ReadWriteType: "All",
          IncludeManagementEvents: true,
        },
      ],
    }),
  );
  expect(put.TrailARN).toBe(trailArn);
  expect(put.EventSelectors?.[0]?.ReadWriteType).toBe("All");

  const gotSelectors = await client.send(
    new GetEventSelectorsCommand({ TrailName: trailName }),
  );
  expect(gotSelectors.TrailARN).toBe(trailArn);
  expect(gotSelectors.EventSelectors?.[0]?.IncludeManagementEvents).toBe(true);

  await client.send(
    new AddTagsCommand({
      ResourceId: trailArn,
      TagsList: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsCommand({ ResourceIdList: [trailArn] }),
  );
  const tagList = listed.ResourceTagList?.[0]?.TagsList ?? [];
  expect(tagList.map((tag) => tag.Key).sort()).toEqual(["env", "team"]);

  await client.send(
    new RemoveTagsCommand({
      ResourceId: trailArn,
      TagsList: [{ Key: "env" }],
    }),
  );

  const afterRemove = await client.send(
    new ListTagsCommand({ ResourceIdList: [trailArn] }),
  );
  const remaining = afterRemove.ResourceTagList?.[0]?.TagsList ?? [];
  expect(remaining.map((tag) => tag.Key)).toEqual(["team"]);

  await client.send(new DeleteTrailCommand({ Name: trailName }));
});
