import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateIpamCommand,
  CreateIpamResourceDiscoveryCommand,
  CreateIpamScopeCommand,
  CreateLaunchTemplateCommand,
  CreateLaunchTemplateVersionCommand,
  CreateLocalGatewayRouteTableCommand,
  DescribeIpamResourceDiscoveriesCommand,
  DescribeIpamResourceDiscoveryAssociationsCommand,
  DescribeIpamScopesCommand,
  DescribeIpamsCommand,
  DescribeIpv6PoolsCommand,
  DescribeLaunchTemplateVersionsCommand,
  DescribeLaunchTemplatesCommand,
  DescribeLocalGatewayRouteTableVirtualInterfaceGroupAssociationsCommand,
  DescribeLocalGatewayRouteTableVpcAssociationsCommand,
  DescribeLocalGatewayRouteTablesCommand,
  DescribeLocalGatewayVirtualInterfaceGroupsCommand,
  DescribeLocalGatewayVirtualInterfacesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk28 describe ipam/launch-template/local-gateway e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeIpams: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(new DescribeIpamsCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.Ipams).toEqual([]);

    const created = await client.send(
      new CreateIpamCommand({ Description: "test-ipam" }),
    );
    const ipamId = created.Ipam!.IpamId!;
    expect(ipamId.startsWith("ipam-")).toBe(true);

    const res = await client.send(
      new DescribeIpamsCommand({ IpamIds: [ipamId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Ipams).toHaveLength(1);
    expect(res.Ipams![0].IpamId).toBe(ipamId);
    expect(res.Ipams![0].Description).toBe("test-ipam");
  });

  test("DescribeIpamScopes: includes scopes created with IPAM", async () => {
    const client = ec2();
    const created = await client.send(new CreateIpamCommand({}));
    const ipamId = created.Ipam!.IpamId!;
    const publicScopeId = created.Ipam!.PublicDefaultScopeId!;

    const res = await client.send(
      new DescribeIpamScopesCommand({ IpamScopeIds: [publicScopeId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamScopes).toHaveLength(1);
    expect(res.IpamScopes![0].IpamScopeId).toBe(publicScopeId);
    expect(res.IpamScopes![0].IpamArn).toContain(ipamId);
    expect(res.IpamScopes![0].IpamScopeType).toBe("public");
  });

  test("DescribeIpamResourceDiscoveries: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(
      new DescribeIpamResourceDiscoveriesCommand({}),
    );
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.IpamResourceDiscoveries).toEqual([]);

    const created = await client.send(
      new CreateIpamResourceDiscoveryCommand({ Description: "test-rd" }),
    );
    const rdId = created.IpamResourceDiscovery!.IpamResourceDiscoveryId!;

    const res = await client.send(
      new DescribeIpamResourceDiscoveriesCommand({
        IpamResourceDiscoveryIds: [rdId],
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamResourceDiscoveries).toHaveLength(1);
    expect(res.IpamResourceDiscoveries![0].IpamResourceDiscoveryId).toBe(rdId);
  });

  test("DescribeIpamResourceDiscoveryAssociations: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeIpamResourceDiscoveryAssociationsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.IpamResourceDiscoveryAssociations)).toBe(true);
  });

  test("DescribeIpv6Pools: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeIpv6PoolsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Ipv6Pools).toEqual([]);
  });

  test("DescribeLaunchTemplates: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(new DescribeLaunchTemplatesCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.LaunchTemplates).toEqual([]);

    const created = await client.send(
      new CreateLaunchTemplateCommand({
        LaunchTemplateName: "my-template",
        LaunchTemplateData: { ImageId: "ami-12345678" },
      }),
    );
    const ltId = created.LaunchTemplate!.LaunchTemplateId!;
    expect(ltId.startsWith("lt-")).toBe(true);

    const res = await client.send(
      new DescribeLaunchTemplatesCommand({ LaunchTemplateIds: [ltId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.LaunchTemplates).toHaveLength(1);
    expect(res.LaunchTemplates![0].LaunchTemplateId).toBe(ltId);
    expect(res.LaunchTemplates![0].LaunchTemplateName).toBe("my-template");
  });

  test("DescribeLaunchTemplateVersions: returns version 1 after create", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateLaunchTemplateCommand({
        LaunchTemplateName: "my-template-v",
        LaunchTemplateData: { ImageId: "ami-11111111" },
      }),
    );
    const ltId = created.LaunchTemplate!.LaunchTemplateId!;

    await client.send(
      new CreateLaunchTemplateVersionCommand({
        LaunchTemplateId: ltId,
        LaunchTemplateData: { ImageId: "ami-22222222" },
      }),
    );

    const res = await client.send(
      new DescribeLaunchTemplateVersionsCommand({ LaunchTemplateId: ltId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.LaunchTemplateVersions!.length).toBe(2);
    const versionNums = res.LaunchTemplateVersions!.map((v) => v.VersionNumber);
    expect(versionNums).toContain(1);
    expect(versionNums).toContain(2);
  });

  test("DescribeLocalGatewayRouteTables: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeLocalGatewayRouteTablesCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.LocalGatewayRouteTables)).toBe(true);
  });

  test("DescribeLocalGatewayRouteTableVirtualInterfaceGroupAssociations: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeLocalGatewayRouteTableVirtualInterfaceGroupAssociationsCommand(
        {},
      ),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(
      Array.isArray(
        res.LocalGatewayRouteTableVirtualInterfaceGroupAssociations,
      ),
    ).toBe(true);
  });

  test("DescribeLocalGatewayRouteTableVpcAssociations: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeLocalGatewayRouteTableVpcAssociationsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.LocalGatewayRouteTableVpcAssociations)).toBe(true);
  });

  test("DescribeLocalGatewayVirtualInterfaceGroups: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeLocalGatewayVirtualInterfaceGroupsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.LocalGatewayVirtualInterfaceGroups)).toBe(true);
  });

  test("DescribeLocalGatewayVirtualInterfaces: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeLocalGatewayVirtualInterfacesCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.LocalGatewayVirtualInterfaces)).toBe(true);
  });

  test("DescribeIpamScopes: includes scope created via CreateIpamScope", async () => {
    const client = ec2();
    const ipam = await client.send(new CreateIpamCommand({}));
    const ipamId = ipam.Ipam!.IpamId!;

    const scope = await client.send(
      new CreateIpamScopeCommand({
        IpamId: ipamId,
        Description: "extra-scope",
      }),
    );
    const scopeId = scope.IpamScope!.IpamScopeId!;

    const res = await client.send(
      new DescribeIpamScopesCommand({ IpamScopeIds: [scopeId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamScopes).toHaveLength(1);
    expect(res.IpamScopes![0].Description).toBe("extra-scope");
    expect(res.IpamScopes![0].IsDefault).toBe(false);
  });
});
