import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateIpamCommand,
  CreateIpamPoolCommand,
  CreateIpamScopeCommand,
  CreateLaunchTemplateCommand,
  CreateLaunchTemplateVersionCommand,
  CreateLocalGatewayRouteCommand,
  CreateLocalGatewayRouteTableCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const awsPort = 4582;
const uiPort = 5682;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("ec2 chunk4 create e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const ec2 = () => new EC2Client({ endpoint, region, credentials });

  test("create-ipam: creates ipam with default scopes", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateIpamCommand({ Description: "test-ipam" }),
    );
    const ipam = result.Ipam;
    expect(ipam?.IpamId?.startsWith("ipam-")).toBe(true);
    expect(ipam?.State).toBe("create-complete");
    expect(ipam?.ScopeCount).toBe(2);
    expect(ipam?.PublicDefaultScopeId?.startsWith("ipam-scope-")).toBe(true);
    expect(ipam?.PrivateDefaultScopeId?.startsWith("ipam-scope-")).toBe(true);
    expect(ipam?.Description).toBe("test-ipam");
    expect(ipam?.OwnerId).toBeTruthy();
    expect(ipam?.IpamArn).toContain("ipam/");
  });

  test("create-ipam-scope: creates additional scope on existing ipam", async () => {
    const client = ec2();
    const ipamRes = await client.send(new CreateIpamCommand({}));
    const ipamId = ipamRes.Ipam?.IpamId ?? "";
    expect(ipamId.startsWith("ipam-")).toBe(true);

    const scopeRes = await client.send(
      new CreateIpamScopeCommand({
        IpamId: ipamId,
        Description: "extra-private-scope",
      }),
    );
    const scope = scopeRes.IpamScope;
    expect(scope?.IpamScopeId?.startsWith("ipam-scope-")).toBe(true);
    expect(scope?.IpamArn).toBe(ipamRes.Ipam?.IpamArn);
    expect(scope?.State).toBe("create-complete");
    expect(scope?.IpamScopeType).toBe("private");
    expect(scope?.IsDefault).toBe(false);
    expect(scope?.Description).toBe("extra-private-scope");
  });

  test("create-ipam-pool: creates pool under scope", async () => {
    const client = ec2();
    const ipamRes = await client.send(new CreateIpamCommand({}));
    const ipam = ipamRes.Ipam;
    const privateScopeId = ipam?.PrivateDefaultScopeId ?? "";

    const poolRes = await client.send(
      new CreateIpamPoolCommand({
        IpamScopeId: privateScopeId,
        AddressFamily: "ipv4",
        Description: "test-pool",
      }),
    );
    const pool = poolRes.IpamPool;
    expect(pool?.IpamPoolId?.startsWith("ipam-pool-")).toBe(true);
    expect(pool?.IpamScopeArn).toContain(privateScopeId);
    expect(pool?.AddressFamily).toBe("ipv4");
    expect(pool?.State).toBe("create-complete");
    expect(pool?.Description).toBe("test-pool");
    expect(pool?.IpamPoolArn).toContain("ipam-pool/");
  });

  test("create-launch-template: creates template and returns id", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateLaunchTemplateCommand({
        LaunchTemplateName: "test-lt",
        VersionDescription: "initial",
        LaunchTemplateData: {
          ImageId: "ami-12345678",
          InstanceType: "t3.micro",
        },
      }),
    );
    const lt = result.LaunchTemplate;
    expect(lt?.LaunchTemplateId?.startsWith("lt-")).toBe(true);
    expect(lt?.LaunchTemplateName).toBe("test-lt");
    expect(lt?.DefaultVersionNumber).toBe(1);
    expect(lt?.LatestVersionNumber).toBe(1);
    expect(lt?.CreateTime).toBeTruthy();
    expect(lt?.CreatedBy).toContain("iam");
  });

  test("create-launch-template-version: creates new version", async () => {
    const client = ec2();
    const ltRes = await client.send(
      new CreateLaunchTemplateCommand({
        LaunchTemplateName: "test-lt-v2",
        LaunchTemplateData: { InstanceType: "t3.micro" },
      }),
    );
    const ltId = ltRes.LaunchTemplate?.LaunchTemplateId ?? "";
    expect(ltId.startsWith("lt-")).toBe(true);

    const vRes = await client.send(
      new CreateLaunchTemplateVersionCommand({
        LaunchTemplateId: ltId,
        VersionDescription: "v2-desc",
        LaunchTemplateData: { InstanceType: "t3.small" },
      }),
    );
    const ver = vRes.LaunchTemplateVersion;
    expect(ver?.LaunchTemplateId).toBe(ltId);
    expect(ver?.VersionNumber).toBe(2);
    expect(ver?.VersionDescription).toBe("v2-desc");
    expect(ver?.DefaultVersion).toBe(false);
  });

  test("create-local-gateway-route-table: creates route table", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateLocalGatewayRouteTableCommand({
        LocalGatewayId: "lgw-0abcdef1234567890",
      }),
    );
    const rtb = result.LocalGatewayRouteTable;
    expect(rtb?.LocalGatewayRouteTableId?.startsWith("lgw-rtb-")).toBe(true);
    expect(rtb?.LocalGatewayId).toBe("lgw-0abcdef1234567890");
    expect(rtb?.State).toBe("available");
    expect(rtb?.LocalGatewayRouteTableArn).toContain(
      "local-gateway-route-table",
    );
  });

  test("create-local-gateway-route: creates route in table", async () => {
    const client = ec2();
    const rtbRes = await client.send(
      new CreateLocalGatewayRouteTableCommand({
        LocalGatewayId: "lgw-0abcdef1234567890",
      }),
    );
    const rtbId = rtbRes.LocalGatewayRouteTable?.LocalGatewayRouteTableId ?? "";

    const routeRes = await client.send(
      new CreateLocalGatewayRouteCommand({
        LocalGatewayRouteTableId: rtbId,
        DestinationCidrBlock: "10.0.0.0/24",
        LocalGatewayVirtualInterfaceGroupId: "lgw-vif-grp-0123456789abcdef0",
      }),
    );
    const route = routeRes.Route;
    expect(route?.DestinationCidrBlock).toBe("10.0.0.0/24");
    expect(route?.LocalGatewayRouteTableId).toBe(rtbId);
    expect(route?.State).toBe("active");
    expect(route?.Type).toBe("static");
    expect(route?.LocalGatewayVirtualInterfaceGroupId).toBe(
      "lgw-vif-grp-0123456789abcdef0",
    );
  });
});
