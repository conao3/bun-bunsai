import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateActivityCommand,
  DeleteActivityCommand,
  DescribeActivityCommand,
  ListActivitiesCommand,
  ListTagsForResourceCommand,
  SFNClient,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

test("Step Functions activity lifecycle", async () => {
  const client = sfn();
  const activityName = "bunsai-e2e-activity";

  const created = await client.send(
    new CreateActivityCommand({ name: activityName }),
  );
  expect(created.activityArn).toContain(`activity:${activityName}`);
  expect(created.creationDate).toBeInstanceOf(Date);
  const activityArn = created.activityArn ?? "";

  const described = await client.send(
    new DescribeActivityCommand({ activityArn }),
  );
  expect(described.activityArn).toBe(activityArn);
  expect(described.name).toBe(activityName);
  expect(described.creationDate).toBeInstanceOf(Date);

  const listed = await client.send(new ListActivitiesCommand({}));
  const arns = (listed.activities ?? []).map((a) => a.activityArn);
  expect(arns).toContain(activityArn);

  await client.send(new DeleteActivityCommand({ activityArn }));

  await expect(
    client.send(new DescribeActivityCommand({ activityArn })),
  ).rejects.toThrow();
});

test("Step Functions resource tagging", async () => {
  const client = sfn();
  const activityName = "bunsai-e2e-tagged-activity";

  const created = await client.send(
    new CreateActivityCommand({
      name: activityName,
      tags: [{ key: "env", value: "test" }],
    }),
  );
  const activityArn = created.activityArn ?? "";

  const initial = await client.send(
    new ListTagsForResourceCommand({ resourceArn: activityArn }),
  );
  const initialMap = Object.fromEntries(
    (initial.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(initialMap["env"]).toBe("test");

  await client.send(
    new TagResourceCommand({
      resourceArn: activityArn,
      tags: [
        { key: "team", value: "bunsai" },
        { key: "env", value: "prod" },
      ],
    }),
  );

  const afterTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: activityArn }),
  );
  const afterTagMap = Object.fromEntries(
    (afterTag.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(afterTagMap["team"]).toBe("bunsai");
  expect(afterTagMap["env"]).toBe("prod");

  await client.send(
    new UntagResourceCommand({
      resourceArn: activityArn,
      tagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: activityArn }),
  );
  const afterUntagMap = Object.fromEntries(
    (afterUntag.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(afterUntagMap["env"]).toBeUndefined();
  expect(afterUntagMap["team"]).toBe("bunsai");

  await client.send(new DeleteActivityCommand({ activityArn }));
});
