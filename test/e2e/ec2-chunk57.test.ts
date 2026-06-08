import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateNetworkInsightsPathCommand,
  CreateNetworkInterfaceCommand,
  AssignPrivateIpAddressesCommand,
  DescribeInstancesCommand,
  DescribeNetworkInsightsAnalysesCommand,
  DescribeNetworkInterfacesCommand,
  EC2Client,
  MonitorInstancesCommand,
  RunInstancesCommand,
  StartNetworkInsightsAnalysisCommand,
  UnassignPrivateIpAddressesCommand,
  UnmonitorInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("UnmonitorInstances: disables monitoring visible via DescribeInstances", async () => {
  const runRes = await client.send(
    new RunInstancesCommand({ ImageId: "ami-test", MinCount: 1, MaxCount: 1 }),
  );
  const instanceId = runRes.Instances?.[0]?.InstanceId ?? "";
  expect(instanceId.startsWith("i-")).toBe(true);

  await client.send(new MonitorInstancesCommand({ InstanceIds: [instanceId] }));
  const afterMonitor = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
  );
  expect(
    afterMonitor.Reservations?.[0]?.Instances?.[0]?.Monitoring?.State,
  ).toBe("enabled");

  const unmonRes = await client.send(
    new UnmonitorInstancesCommand({ InstanceIds: [instanceId] }),
  );
  expect(unmonRes.InstanceMonitorings).toHaveLength(1);
  expect(unmonRes.InstanceMonitorings?.[0]?.Monitoring?.State).toBe("disabled");

  const afterUnmonitor = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
  );
  expect(
    afterUnmonitor.Reservations?.[0]?.Instances?.[0]?.Monitoring?.State,
  ).toBe("disabled");
});

test("UnassignPrivateIpAddresses: removes secondary IPs visible via DescribeNetworkInterfaces", async () => {
  const createRes = await client.send(
    new CreateNetworkInterfaceCommand({ SubnetId: "subnet-test" }),
  );
  const niId = createRes.NetworkInterface?.NetworkInterfaceId ?? "";
  expect(niId.startsWith("eni-")).toBe(true);

  const assignRes = await client.send(
    new AssignPrivateIpAddressesCommand({
      NetworkInterfaceId: niId,
      SecondaryPrivateIpAddressCount: 2,
    }),
  );
  const assignedIps =
    assignRes.AssignedPrivateIpAddresses?.map(
      (a) => a.PrivateIpAddress ?? "",
    ) ?? [];
  expect(assignedIps).toHaveLength(2);

  const beforeUnassign = await client.send(
    new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [niId] }),
  );
  const beforeNi = beforeUnassign.NetworkInterfaces?.[0];
  const beforeSecondary =
    beforeNi?.PrivateIpAddresses?.filter((p) => !p.Primary) ?? [];
  expect(beforeSecondary).toHaveLength(2);

  await client.send(
    new UnassignPrivateIpAddressesCommand({
      NetworkInterfaceId: niId,
      PrivateIpAddresses: assignedIps,
    }),
  );

  const afterUnassign = await client.send(
    new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [niId] }),
  );
  const afterSecondary =
    afterUnassign.NetworkInterfaces?.[0]?.PrivateIpAddresses?.filter(
      (p) => !p.Primary,
    ) ?? [];
  expect(afterSecondary).toHaveLength(0);
});

test("StartNetworkInsightsAnalysis: analysis retrievable via DescribeNetworkInsightsAnalyses", async () => {
  const pathRes = await client.send(
    new CreateNetworkInsightsPathCommand({
      Source: "eni-source",
      Protocol: "tcp",
    }),
  );
  const pathId = pathRes.NetworkInsightsPath?.NetworkInsightsPathId ?? "";
  expect(pathId.startsWith("nip-")).toBe(true);

  const analysisRes = await client.send(
    new StartNetworkInsightsAnalysisCommand({
      NetworkInsightsPathId: pathId,
      ClientToken: "test-token-1",
    }),
  );
  const analysisId =
    analysisRes.NetworkInsightsAnalysis?.NetworkInsightsAnalysisId ?? "";
  expect(analysisId.startsWith("nia-")).toBe(true);

  const describeRes = await client.send(
    new DescribeNetworkInsightsAnalysesCommand({
      NetworkInsightsAnalysisIds: [analysisId],
    }),
  );
  expect(describeRes.NetworkInsightsAnalyses).toHaveLength(1);
  expect(
    describeRes.NetworkInsightsAnalyses?.[0]?.NetworkInsightsAnalysisId,
  ).toBe(analysisId);
});
