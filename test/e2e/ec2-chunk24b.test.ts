import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCustomerGatewayCommand,
  CreateDhcpOptionsCommand,
  CreateEgressOnlyInternetGatewayCommand,
  CreateFleetCommand,
  CreateVpcCommand,
  DescribeConversionTasksCommand,
  DescribeCustomerGatewaysCommand,
  DescribeDeclarativePoliciesReportsCommand,
  DescribeDhcpOptionsCommand,
  DescribeEgressOnlyInternetGatewaysCommand,
  DescribeElasticGpusCommand,
  DescribeExportImageTasksCommand,
  DescribeExportTasksCommand,
  DescribeFastLaunchImagesCommand,
  DescribeFastSnapshotRestoresCommand,
  DescribeFleetHistoryCommand,
  DescribeFleetInstancesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk24b describe conversion-tasks/customer-gw/dhcp/egress-igw/export-tasks/fleet e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeConversionTasks: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeConversionTasksCommand({}));
    expect(res.ConversionTasks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateCustomerGateway then DescribeCustomerGateways: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateCustomerGatewayCommand({
        Type: "ipsec.1",
        IpAddress: "203.0.113.1",
        BgpAsn: 65001,
      }),
    );
    const cgwId = created.CustomerGateway?.CustomerGatewayId;
    expect(typeof cgwId).toBe("string");
    expect(cgwId?.startsWith("cgw-")).toBe(true);

    const listed = await client.send(
      new DescribeCustomerGatewaysCommand({
        CustomerGatewayIds: [cgwId!],
      }),
    );
    expect(listed.CustomerGateways).toHaveLength(1);
    expect(listed.CustomerGateways![0].CustomerGatewayId).toBe(cgwId);
    expect(listed.CustomerGateways![0].Type).toBe("ipsec.1");
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeDeclarativePoliciesReports: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeDeclarativePoliciesReportsCommand({}),
    );
    expect(res.Reports).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateDhcpOptions then DescribeDhcpOptions: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateDhcpOptionsCommand({
        DhcpConfigurations: [{ Key: "domain-name", Values: ["example.com"] }],
      }),
    );
    const doptId = created.DhcpOptions?.DhcpOptionsId;
    expect(typeof doptId).toBe("string");
    expect(doptId?.startsWith("dopt-")).toBe(true);

    const listed = await client.send(
      new DescribeDhcpOptionsCommand({
        DhcpOptionsIds: [doptId!],
      }),
    );
    expect(listed.DhcpOptions).toHaveLength(1);
    expect(listed.DhcpOptions![0].DhcpOptionsId).toBe(doptId);
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateEgressOnlyInternetGateway then DescribeEgressOnlyInternetGateways: round-trip", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId!;

    const created = await client.send(
      new CreateEgressOnlyInternetGatewayCommand({ VpcId: vpcId }),
    );
    const eigwId =
      created.EgressOnlyInternetGateway?.EgressOnlyInternetGatewayId;
    expect(typeof eigwId).toBe("string");
    expect(eigwId?.startsWith("eigw-")).toBe(true);

    const listed = await client.send(
      new DescribeEgressOnlyInternetGatewaysCommand({
        EgressOnlyInternetGatewayIds: [eigwId!],
      }),
    );
    expect(listed.EgressOnlyInternetGateways).toHaveLength(1);
    expect(
      listed.EgressOnlyInternetGateways![0].EgressOnlyInternetGatewayId,
    ).toBe(eigwId);
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeElasticGpus: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeElasticGpusCommand({}));
    expect(res.ElasticGpuSet).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeExportImageTasks: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeExportImageTasksCommand({}));
    expect(res.ExportImageTasks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeExportTasks: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeExportTasksCommand({}));
    expect(res.ExportTasks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeFastLaunchImages: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeFastLaunchImagesCommand({}));
    expect(res.FastLaunchImages).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeFastSnapshotRestores: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeFastSnapshotRestoresCommand({}));
    expect(res.FastSnapshotRestores).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateFleet then DescribeFleetInstances and DescribeFleetHistory: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateFleetCommand({
        LaunchTemplateConfigs: [
          {
            LaunchTemplateSpecification: {
              LaunchTemplateName: "test-lt",
              Version: "1",
            },
          },
        ],
        TargetCapacitySpecification: {
          TotalTargetCapacity: 1,
          DefaultTargetCapacityType: "on-demand",
        },
      }),
    );
    const fleetId = created.FleetId;
    expect(typeof fleetId).toBe("string");
    expect(fleetId?.startsWith("fleet-")).toBe(true);

    const instances = await client.send(
      new DescribeFleetInstancesCommand({ FleetId: fleetId! }),
    );
    expect(instances.FleetId).toBe(fleetId);
    expect(instances.ActiveInstances).toEqual([]);
    expect(instances.$metadata.httpStatusCode).toBe(200);

    const history = await client.send(
      new DescribeFleetHistoryCommand({
        FleetId: fleetId!,
        StartTime: new Date(0),
      }),
    );
    expect(history.FleetId).toBe(fleetId);
    expect(history.HistoryRecords).toEqual([]);
    expect(history.$metadata.httpStatusCode).toBe(200);
  });
});
