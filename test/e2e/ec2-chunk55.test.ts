import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeReservedInstancesCommand,
  EC2Client,
  PurchaseReservedInstancesOfferingCommand,
  RebootInstancesCommand,
  RegisterImageCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("RegisterImage: image visible via DescribeImages", async () => {
  const regRes = await client.send(
    new RegisterImageCommand({ Name: "test-ami-chunk55" }),
  );
  const imageId = regRes.ImageId ?? "";
  expect(imageId.startsWith("ami-")).toBe(true);

  const descRes = await client.send(
    new DescribeImagesCommand({ ImageIds: [imageId] }),
  );
  expect(descRes.Images?.length).toBe(1);
  expect(descRes.Images?.[0]?.ImageId).toBe(imageId);
  expect(descRes.Images?.[0]?.Name).toBe("test-ami-chunk55");
  expect(descRes.Images?.[0]?.State).toBe("available");
});

test("RebootInstances: instance stays running after reboot", async () => {
  const runRes = await client.send(
    new RunInstancesCommand({ ImageId: "ami-test", MinCount: 1, MaxCount: 1 }),
  );
  const instanceId = runRes.Instances?.[0]?.InstanceId ?? "";
  expect(instanceId.startsWith("i-")).toBe(true);

  await client.send(new RebootInstancesCommand({ InstanceIds: [instanceId] }));

  await Bun.sleep(1100);
  const descRes = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
  );
  const instance = descRes.Reservations?.[0]?.Instances?.[0];
  expect(instance?.InstanceId).toBe(instanceId);
  expect(instance?.State?.Name).toBe("running");
});

test("PurchaseReservedInstancesOffering: reservation visible via DescribeReservedInstances", async () => {
  const purchaseRes = await client.send(
    new PurchaseReservedInstancesOfferingCommand({
      ReservedInstancesOfferingId: "ri-offering-test",
      InstanceCount: 2,
    }),
  );
  const riId = purchaseRes.ReservedInstancesId ?? "";
  expect(riId.startsWith("ri-")).toBe(true);

  const descRes = await client.send(new DescribeReservedInstancesCommand({}));
  const found = descRes.ReservedInstances?.find(
    (r) => r.ReservedInstancesId === riId,
  );
  expect(found).toBeDefined();
  expect(found?.InstanceCount).toBe(2);
  expect(found?.State).toBe("active");
});
