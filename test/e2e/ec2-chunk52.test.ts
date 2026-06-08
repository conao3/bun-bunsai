import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTransitGatewayCommand,
  CreateVerifiedAccessInstanceCommand,
  DescribeTransitGatewaysCommand,
  DescribeVerifiedAccessInstanceLoggingConfigurationsCommand,
  DescribeVerifiedAccessInstancesCommand,
  EC2Client,
  ModifyTransitGatewayCommand,
  ModifyVerifiedAccessInstanceCommand,
  ModifyVerifiedAccessInstanceLoggingConfigurationCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ModifyVerifiedAccessInstance reflects in DescribeVerifiedAccessInstances", async () => {
  const created = await client.send(
    new CreateVerifiedAccessInstanceCommand({
      Description: "original description",
    }),
  );
  const instanceId =
    created.VerifiedAccessInstance?.VerifiedAccessInstanceId ?? "";
  expect(instanceId).toBeTruthy();
  expect(created.VerifiedAccessInstance?.Description).toBe(
    "original description",
  );

  const modified = await client.send(
    new ModifyVerifiedAccessInstanceCommand({
      VerifiedAccessInstanceId: instanceId,
      Description: "updated description",
    }),
  );
  expect(modified.VerifiedAccessInstance?.Description).toBe(
    "updated description",
  );

  const described = await client.send(
    new DescribeVerifiedAccessInstancesCommand({
      VerifiedAccessInstanceIds: [instanceId],
    }),
  );
  expect(described.VerifiedAccessInstances).toHaveLength(1);
  expect(described.VerifiedAccessInstances?.[0]?.Description).toBe(
    "updated description",
  );
});

test("ModifyVerifiedAccessInstanceLoggingConfiguration reflects in DescribeVerifiedAccessInstanceLoggingConfigurations", async () => {
  const created = await client.send(
    new CreateVerifiedAccessInstanceCommand({ Description: "log-test" }),
  );
  const instanceId =
    created.VerifiedAccessInstance?.VerifiedAccessInstanceId ?? "";
  expect(instanceId).toBeTruthy();

  const before = await client.send(
    new DescribeVerifiedAccessInstanceLoggingConfigurationsCommand({
      VerifiedAccessInstanceIds: [instanceId],
    }),
  );
  expect(before.LoggingConfigurations?.[0]?.AccessLogs?.S3?.Enabled).toBe(
    false,
  );

  await client.send(
    new ModifyVerifiedAccessInstanceLoggingConfigurationCommand({
      VerifiedAccessInstanceId: instanceId,
      AccessLogs: {
        S3: { Enabled: true },
        CloudWatchLogs: { Enabled: false },
        KinesisDataFirehose: { Enabled: false },
        LogVersion: "ocsf-1.0",
        IncludeTrustContext: true,
      },
    }),
  );

  const after = await client.send(
    new DescribeVerifiedAccessInstanceLoggingConfigurationsCommand({
      VerifiedAccessInstanceIds: [instanceId],
    }),
  );
  expect(after.LoggingConfigurations?.[0]?.AccessLogs?.S3?.Enabled).toBe(true);
  expect(after.LoggingConfigurations?.[0]?.AccessLogs?.LogVersion).toBe(
    "ocsf-1.0",
  );
});

test("ModifyTransitGateway reflects in DescribeTransitGateways", async () => {
  const created = await client.send(
    new CreateTransitGatewayCommand({ Description: "tgw original" }),
  );
  const tgwId = created.TransitGateway?.TransitGatewayId ?? "";
  expect(tgwId).toBeTruthy();
  expect(created.TransitGateway?.Description).toBe("tgw original");

  const modified = await client.send(
    new ModifyTransitGatewayCommand({
      TransitGatewayId: tgwId,
      Description: "tgw updated",
      Options: { DnsSupport: "disable" },
    }),
  );
  expect(modified.TransitGateway?.Description).toBe("tgw updated");
  expect(modified.TransitGateway?.Options?.DnsSupport).toBe("disable");

  const described = await client.send(
    new DescribeTransitGatewaysCommand({ TransitGatewayIds: [tgwId] }),
  );
  expect(described.TransitGateways).toHaveLength(1);
  expect(described.TransitGateways?.[0]?.Description).toBe("tgw updated");
  expect(described.TransitGateways?.[0]?.Options?.DnsSupport).toBe("disable");
});
