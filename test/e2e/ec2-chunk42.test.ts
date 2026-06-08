import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCapacityReservationCommand,
  CreateCoipPoolCommand,
  EC2Client,
  GetAssociatedEnclaveCertificateIamRolesCommand,
  GetCapacityManagerAttributesCommand,
  GetCapacityReservationUsageCommand,
  GetCoipPoolUsageCommand,
  GetConsoleOutputCommand,
  GetConsoleScreenshotCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("GetConsoleOutput and GetConsoleScreenshot for existing instance", async () => {
  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-00000001",
      InstanceType: "t3.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId;
  expect(instanceId).toBeDefined();
  expect(instanceId!.startsWith("i-")).toBe(true);

  const consoleOut = await client.send(
    new GetConsoleOutputCommand({ InstanceId: instanceId! }),
  );
  expect(consoleOut.InstanceId).toBe(instanceId);
  expect(typeof consoleOut.Output).toBe("string");
  expect(consoleOut.Output!.length).toBeGreaterThan(0);
  expect(consoleOut.Timestamp).toBeDefined();

  const screenshot = await client.send(
    new GetConsoleScreenshotCommand({ InstanceId: instanceId! }),
  );
  expect(screenshot.InstanceId).toBe(instanceId);
  expect(typeof screenshot.ImageData).toBe("string");
  expect(screenshot.ImageData!.length).toBeGreaterThan(0);
});

test("GetConsoleOutput on missing instance throws not-found error", async () => {
  await expect(
    client.send(new GetConsoleOutputCommand({ InstanceId: "i-nonexistent" })),
  ).rejects.toThrow();
});

test("GetCapacityReservationUsage returns reservation details", async () => {
  const created = await client.send(
    new CreateCapacityReservationCommand({
      InstanceType: "t3.small",
      InstancePlatform: "Linux/UNIX",
      InstanceCount: 5,
      AvailabilityZone: `${region}a`,
    }),
  );
  const reservationId = created.CapacityReservation?.CapacityReservationId;
  expect(reservationId).toBeDefined();

  const usage = await client.send(
    new GetCapacityReservationUsageCommand({
      CapacityReservationId: reservationId!,
    }),
  );
  expect(usage.CapacityReservationId).toBe(reservationId);
  expect(usage.InstanceType).toBe("t3.small");
  expect(usage.TotalInstanceCount).toBe(5);
  expect(usage.AvailableInstanceCount).toBe(5);
  expect(usage.State).toBe("active");
  expect(Array.isArray(usage.InstanceUsages)).toBe(true);
});

test("GetCapacityReservationUsage on missing reservation throws not-found", async () => {
  await expect(
    client.send(
      new GetCapacityReservationUsageCommand({
        CapacityReservationId: "cr-nonexistent",
      }),
    ),
  ).rejects.toThrow();
});

test("GetCoipPoolUsage returns pool info", async () => {
  const created = await client.send(
    new CreateCoipPoolCommand({ LocalGatewayRouteTableId: "lgw-rtb-test" }),
  );
  const poolId = created.CoipPool?.PoolId;
  expect(poolId).toBeDefined();

  const usage = await client.send(
    new GetCoipPoolUsageCommand({ PoolId: poolId! }),
  );
  expect(usage.CoipPoolId).toBe(poolId);
  expect(Array.isArray(usage.CoipAddressUsages)).toBe(true);
  expect(usage.LocalGatewayRouteTableId).toBe("lgw-rtb-test");
});

test("GetAssociatedEnclaveCertificateIamRoles returns empty list", async () => {
  const res = await client.send(
    new GetAssociatedEnclaveCertificateIamRolesCommand({
      CertificateArn:
        "arn:aws:acm:us-east-1:123456789012:certificate/test-cert",
    }),
  );
  expect(Array.isArray(res.AssociatedRoles)).toBe(true);
  expect(res.AssociatedRoles!.length).toBe(0);
});

test("GetCapacityManagerAttributes returns synthetic attributes", async () => {
  const res = await client.send(new GetCapacityManagerAttributesCommand({}));
  expect(typeof res.CapacityManagerStatus).toBe("string");
  expect(typeof res.DataExportCount).toBe("number");
});
