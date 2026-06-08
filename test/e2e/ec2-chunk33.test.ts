import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTrafficMirrorFilterCommand,
  CreateTransitGatewayCommand,
  CreateTransitGatewayRouteTableCommand,
  DescribeTrafficMirrorFiltersCommand,
  DescribeTrafficMirrorSessionsCommand,
  DescribeTrafficMirrorTargetsCommand,
  DescribeTransitGatewayRouteTablesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk33 describe traffic-mirror + transit-gateway family e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeTrafficMirrorFilters empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeTrafficMirrorFiltersCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.TrafficMirrorFilters)).toBe(true);
  });

  test("CreateTrafficMirrorFilter then DescribeTrafficMirrorFilters includes it", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateTrafficMirrorFilterCommand({ Description: "chunk33-filter" }),
    );
    const filterId = created.TrafficMirrorFilter!.TrafficMirrorFilterId!;
    expect(filterId.startsWith("tmf-")).toBe(true);

    const all = await client.send(new DescribeTrafficMirrorFiltersCommand({}));
    expect(all.$metadata.httpStatusCode).toBe(200);
    const found = all.TrafficMirrorFilters!.find(
      (f) => f.TrafficMirrorFilterId === filterId,
    );
    expect(found).toBeDefined();
    expect(found!.Description).toBe("chunk33-filter");

    const byId = await client.send(
      new DescribeTrafficMirrorFiltersCommand({
        TrafficMirrorFilterIds: [filterId],
      }),
    );
    expect(byId.TrafficMirrorFilters).toHaveLength(1);
    expect(byId.TrafficMirrorFilters![0].TrafficMirrorFilterId).toBe(filterId);
  });

  test("DescribeTrafficMirrorSessions returns list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeTrafficMirrorSessionsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.TrafficMirrorSessions)).toBe(true);
  });

  test("DescribeTrafficMirrorTargets returns list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeTrafficMirrorTargetsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.TrafficMirrorTargets)).toBe(true);
  });

  test("CreateTransitGatewayRouteTable then DescribeTransitGatewayRouteTables includes it", async () => {
    const client = ec2();

    const tgw = await client.send(
      new CreateTransitGatewayCommand({ Description: "chunk33-tgw" }),
    );
    const tgwId = tgw.TransitGateway!.TransitGatewayId!;
    expect(tgwId.startsWith("tgw-")).toBe(true);

    const rtb = await client.send(
      new CreateTransitGatewayRouteTableCommand({
        TransitGatewayId: tgwId,
      }),
    );
    const rtbId = rtb.TransitGatewayRouteTable!.TransitGatewayRouteTableId!;
    expect(rtbId.startsWith("tgw-rtb-")).toBe(true);

    const all = await client.send(
      new DescribeTransitGatewayRouteTablesCommand({}),
    );
    expect(all.$metadata.httpStatusCode).toBe(200);
    const found = all.TransitGatewayRouteTables!.find(
      (t) => t.TransitGatewayRouteTableId === rtbId,
    );
    expect(found).toBeDefined();
    expect(found!.TransitGatewayId).toBe(tgwId);

    const byId = await client.send(
      new DescribeTransitGatewayRouteTablesCommand({
        TransitGatewayRouteTableIds: [rtbId],
      }),
    );
    expect(byId.TransitGatewayRouteTables!.length).toBeGreaterThanOrEqual(1);
    const foundById = byId.TransitGatewayRouteTables!.find(
      (t) => t.TransitGatewayRouteTableId === rtbId,
    );
    expect(foundById).toBeDefined();
  });
});
