import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ListTagsForResourceCommand,
  S3ControlClient,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-s3-control";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const accountId = "000000000000";

const client = (): S3ControlClient =>
  new S3ControlClient({ endpoint, region, credentials, requestHandler });

test("S3 Control TagResource/ListTagsForResource/UntagResource roundtrip", async () => {
  const s3c = client();
  const arn = `arn:aws:s3:${region}:${accountId}:accesspoint/bunsai-e2e`;

  const listBefore = await s3c.send(
    new ListTagsForResourceCommand({ AccountId: accountId, ResourceArn: arn }),
  );
  expect(listBefore.Tags ?? []).toEqual([]);

  await s3c.send(
    new TagResourceCommand({
      AccountId: accountId,
      ResourceArn: arn,
      Tags: [
        { Key: "env", Value: "dev" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const listAfter = await s3c.send(
    new ListTagsForResourceCommand({ AccountId: accountId, ResourceArn: arn }),
  );
  const after = (listAfter.Tags ?? [])
    .slice()
    .sort((a, b) => (a.Key ?? "").localeCompare(b.Key ?? ""));
  expect(after).toEqual([
    { Key: "env", Value: "dev" },
    { Key: "team", Value: "platform" },
  ]);

  await s3c.send(
    new UntagResourceCommand({
      AccountId: accountId,
      ResourceArn: arn,
      TagKeys: ["env"],
    }),
  );

  const listFinal = await s3c.send(
    new ListTagsForResourceCommand({ AccountId: accountId, ResourceArn: arn }),
  );
  expect(listFinal.Tags ?? []).toEqual([{ Key: "team", Value: "platform" }]);
});
