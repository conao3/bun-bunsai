import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  IoTClient,
  CreateThingCommand,
  CreateJobCommand,
} from "@aws-sdk/client-iot";
import {
  CloudTrailClient,
  CreateTrailCommand,
  StartLoggingCommand,
  LookupEventsCommand,
} from "@aws-sdk/client-cloudtrail";
import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const app = startApp();
const { endpoint, requestHandler } = app;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const iot = new IoTClient({ endpoint, region, credentials, requestHandler });
const cloudtrail = new CloudTrailClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});
const sqs = new SQSClient({ endpoint, region, credentials, requestHandler });

const listResources = async (service: string): Promise<{ key: string }[]> => {
  const res = await app.uiFetch(`/__bunsai/resources?service=${service}`);
  return (await res.json()) as { key: string }[];
};

test("internal store keys are hidden from the management resources API", async () => {
  await iot.send(new CreateThingCommand({ thingName: "hidden-test-thing" }));
  await iot.send(
    new CreateJobCommand({
      jobId: "hidden-test-job",
      targets: ["arn:aws:iot:us-east-1:000000000000:thing/hidden-test-thing"],
      document: "{}",
    }),
  );
  await cloudtrail.send(
    new CreateTrailCommand({ Name: "hidden-test-trail", S3BucketName: "b" }),
  );
  await cloudtrail.send(new StartLoggingCommand({ Name: "hidden-test-trail" }));
  await sqs.send(new CreateQueueCommand({ QueueName: "hidden-test-queue" }));

  const iotKeys = (await listResources("iot")).map((r) => r.key);
  expect(iotKeys).toContain("thing:hidden-test-thing");
  expect(iotKeys.some((k) => k.startsWith("_"))).toBe(false);
  expect(iotKeys).not.toContain("allThings");
  expect(iotKeys).not.toContain("allJobs");

  const trailKeys = (await listResources("cloudtrail")).map((r) => r.key);
  expect(trailKeys).toContain("trail/hidden-test-trail");
  expect(trailKeys.some((k) => k.startsWith("_"))).toBe(false);

  const lookup = await cloudtrail.send(
    new LookupEventsCommand({
      LookupAttributes: [
        { AttributeKey: "EventName", AttributeValue: "CreateQueue" },
      ],
    }),
  );
  expect((lookup.Events ?? []).some((e) => e.EventName === "CreateQueue")).toBe(
    true,
  );
});
