import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateHoursOfOperationCommand,
  CreateInstanceCommand,
  DescribeHoursOfOperationCommand,
  DescribeInstanceAttributeCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateHoursOfOperationCommand,
  UpdateInstanceAttributeCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("chunk24: HoursOfOperation create → update → describe reflects update; TagResource → UntagResource → tags omitted; UpdateInstanceAttribute → DescribeInstanceAttribute reflects update", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk24-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const hooRes = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "original-name",
      TimeZone: "America/New_York",
      Config: [],
    }),
  );
  const hooId = hooRes.HoursOfOperationId ?? "";
  expect(hooId).toBeTruthy();

  const describeBefore = await client.send(
    new DescribeHoursOfOperationCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
    }),
  );
  expect(describeBefore.HoursOfOperation?.Name).toBe("original-name");

  await client.send(
    new UpdateHoursOfOperationCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
      Name: "updated-name",
      TimeZone: "America/Los_Angeles",
    }),
  );

  const describeAfter = await client.send(
    new DescribeHoursOfOperationCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
    }),
  );
  expect(describeAfter.HoursOfOperation?.Name).toBe("updated-name");

  const resourceArn = `arn:aws:connect:${region}:000000000000:instance/${instanceId}`;

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "connect" },
    }),
  );

  const tagsAfterTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(tagsAfterTag.tags?.["env"]).toBe("test");
  expect(tagsAfterTag.tags?.["team"]).toBe("connect");

  await client.send(
    new UntagResourceCommand({
      resourceArn,
      tagKeys: ["team"],
    }),
  );

  const tagsAfterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(tagsAfterUntag.tags?.["env"]).toBe("test");
  expect(tagsAfterUntag.tags?.["team"]).toBeUndefined();

  await client.send(
    new UpdateInstanceAttributeCommand({
      InstanceId: instanceId,
      AttributeType: "INBOUND_CALLS",
      Value: "false",
    }),
  );

  const attrRes = await client.send(
    new DescribeInstanceAttributeCommand({
      InstanceId: instanceId,
      AttributeType: "INBOUND_CALLS",
    }),
  );
  expect(attrRes.Attribute?.Value).toBe("false");
});
