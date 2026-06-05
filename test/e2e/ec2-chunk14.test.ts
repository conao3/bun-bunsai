import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDhcpOptionsCommand,
  CreateFlowLogsCommand,
  DeleteDhcpOptionsCommand,
  DeleteFlowLogsCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk14 delete (dhcp-options, flow-logs) e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create-dhcp-options then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateDhcpOptionsCommand({
        DhcpConfigurations: [
          { Key: "domain-name", Values: ["example.com"] },
          { Key: "domain-name-servers", Values: ["8.8.8.8", "8.8.4.4"] },
        ],
      }),
    );

    const opts = createRes.DhcpOptions;
    expect(opts).toBeDefined();
    expect(opts?.DhcpOptionsId?.startsWith("dopt-")).toBe(true);
    expect(opts?.OwnerId).toBeDefined();
    expect(opts?.DhcpConfigurations?.length).toBe(2);

    const dhcpId = opts?.DhcpOptionsId ?? "";

    const deleteRes = await client.send(
      new DeleteDhcpOptionsCommand({ DhcpOptionsId: dhcpId }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("create-flow-logs then delete: lifecycle succeeds with per-item results", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateFlowLogsCommand({
        ResourceIds: ["vpc-12345678"],
        ResourceType: "VPC",
        TrafficType: "ALL",
        LogGroupName: "/aws/vpc/flow-logs",
      }),
    );

    expect(createRes.FlowLogIds).toBeDefined();
    expect(createRes.FlowLogIds?.length).toBeGreaterThan(0);
    expect(createRes.FlowLogIds?.[0]?.startsWith("fl-")).toBe(true);
    expect(createRes.Unsuccessful?.length).toBe(0);

    const flowLogId = createRes.FlowLogIds?.[0] ?? "";

    const deleteRes = await client.send(
      new DeleteFlowLogsCommand({ FlowLogIds: [flowLogId] }),
    );
    expect(deleteRes.Unsuccessful?.length).toBe(0);
  });
});
