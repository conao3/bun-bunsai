import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudTrailClient,
  CreateTrailCommand,
  DeleteTrailCommand,
  DescribeTrailsCommand,
  GetTrailCommand,
  GetTrailStatusCommand,
  ListTrailsCommand,
  StartLoggingCommand,
  StopLoggingCommand,
} from "@aws-sdk/client-cloudtrail";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudtrail = () =>
  new CloudTrailClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("CloudTrail trail lifecycle and logging status", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail";

  const created = await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-bucket",
      IsMultiRegionTrail: true,
    }),
  );
  expect(created.Name).toBe(trailName);
  expect(created.S3BucketName).toBe("bunsai-e2e-bucket");
  expect(created.TrailARN).toContain(trailName);
  expect(created.IsMultiRegionTrail).toBe(true);

  const got = await client.send(new GetTrailCommand({ Name: trailName }));
  expect(got.Trail?.Name).toBe(trailName);
  expect(got.Trail?.HomeRegion).toBe(region);

  const listed = await client.send(new ListTrailsCommand({}));
  expect((listed.Trails ?? []).map((trail) => trail.Name)).toContain(trailName);

  const described = await client.send(
    new DescribeTrailsCommand({ trailNameList: [trailName] }),
  );
  expect((described.trailList ?? []).map((trail) => trail.Name)).toContain(
    trailName,
  );

  const beforeLogging = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(beforeLogging.IsLogging).toBe(false);

  await client.send(new StartLoggingCommand({ Name: trailName }));
  const logging = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(logging.IsLogging).toBe(true);

  await client.send(new StopLoggingCommand({ Name: trailName }));
  const stopped = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(stopped.IsLogging).toBe(false);

  await client.send(new DeleteTrailCommand({ Name: trailName }));
  const afterDelete = await client.send(new ListTrailsCommand({}));
  expect((afterDelete.Trails ?? []).map((trail) => trail.Name)).not.toContain(
    trailName,
  );
});
