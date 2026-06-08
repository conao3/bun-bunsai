import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateIpamCommand,
  CreateIpamPrefixListResolverCommand,
  CreateLaunchTemplateCommand,
  EC2Client,
  GetIpamDiscoveredAccountsCommand,
  GetIpamPoolAllocationsCommand,
  GetIpamPoolCidrsCommand,
  GetIpamPrefixListResolverRulesCommand,
  GetIpamPrefixListResolverVersionsCommand,
  GetIpamResourceCidrsCommand,
  GetLaunchTemplateDataCommand,
  ProvisionIpamPoolCidrCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ProvisionIpamPoolCidr → GetIpamPoolCidrs includes it", async () => {
  const poolId = "ipam-pool-test1234";

  const provision = await client.send(
    new ProvisionIpamPoolCidrCommand({
      IpamPoolId: poolId,
      Cidr: "10.1.0.0/16",
    }),
  );
  expect(provision.IpamPoolCidr?.Cidr).toBe("10.1.0.0/16");
  expect(provision.IpamPoolCidr?.State).toBe("provisioned");

  const getCidrs = await client.send(
    new GetIpamPoolCidrsCommand({ IpamPoolId: poolId }),
  );
  expect(Array.isArray(getCidrs.IpamPoolCidrs)).toBe(true);
  expect(getCidrs.IpamPoolCidrs!.length).toBe(1);
  expect(getCidrs.IpamPoolCidrs![0]?.Cidr).toBe("10.1.0.0/16");
  expect(getCidrs.IpamPoolCidrs![0]?.State).toBe("provisioned");
});

test("GetIpamPoolAllocations returns empty list", async () => {
  const res = await client.send(
    new GetIpamPoolAllocationsCommand({ IpamPoolId: "ipam-pool-any" }),
  );
  expect(Array.isArray(res.IpamPoolAllocations)).toBe(true);
  expect(res.IpamPoolAllocations!.length).toBe(0);
});

test("CreateLaunchTemplate → RunInstances → GetLaunchTemplateData returns instance data", async () => {
  await client.send(
    new CreateLaunchTemplateCommand({
      LaunchTemplateName: "my-template",
      LaunchTemplateData: {
        ImageId: "ami-chunk44test",
        InstanceType: "t3.micro",
      },
    }),
  );

  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-chunk44test",
      InstanceType: "t3.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId;
  expect(instanceId).toBeDefined();

  const data = await client.send(
    new GetLaunchTemplateDataCommand({ InstanceId: instanceId! }),
  );
  expect(data.LaunchTemplateData?.ImageId).toBe("ami-chunk44test");
  expect(data.LaunchTemplateData?.InstanceType).toBe("t3.micro");
});

test("GetLaunchTemplateData throws for missing instance", async () => {
  await expect(
    client.send(
      new GetLaunchTemplateDataCommand({ InstanceId: "i-nonexistent" }),
    ),
  ).rejects.toThrow();
});

test("GetIpamDiscoveredAccounts returns empty list", async () => {
  const res = await client.send(
    new GetIpamDiscoveredAccountsCommand({
      IpamResourceDiscoveryId: "ipam-res-disco-00000000",
      DiscoveryRegion: region,
    }),
  );
  expect(Array.isArray(res.IpamDiscoveredAccounts)).toBe(true);
  expect(res.IpamDiscoveredAccounts!.length).toBe(0);
});

test("GetIpamResourceCidrs throws for missing scope", async () => {
  await expect(
    client.send(
      new GetIpamResourceCidrsCommand({
        IpamScopeId: "ipam-scope-nonexistent",
      }),
    ),
  ).rejects.toThrow();
});

test("GetIpamResourceCidrs returns empty list for valid scope", async () => {
  const ipam = await client.send(new CreateIpamCommand({}));
  const scopeId = ipam.Ipam?.PrivateDefaultScopeId;
  expect(scopeId).toBeDefined();

  const res = await client.send(
    new GetIpamResourceCidrsCommand({ IpamScopeId: scopeId! }),
  );
  expect(Array.isArray(res.IpamResourceCidrs)).toBe(true);
  expect(res.IpamResourceCidrs!.length).toBe(0);
});

test("CreateIpamPool → GetIpamPrefixListResolver ops", async () => {
  const ipam = await client.send(new CreateIpamCommand({}));
  const ipamId = ipam.Ipam?.IpamId;
  expect(ipamId).toBeDefined();

  const resolver = await client.send(
    new CreateIpamPrefixListResolverCommand({
      IpamId: ipamId!,
      AddressFamily: "ipv4",
    }),
  );
  const resolverId = resolver.IpamPrefixListResolver?.IpamPrefixListResolverId;
  expect(resolverId).toBeDefined();

  const rules = await client.send(
    new GetIpamPrefixListResolverRulesCommand({
      IpamPrefixListResolverId: resolverId!,
    }),
  );
  expect(Array.isArray(rules.Rules)).toBe(true);
  expect(rules.Rules!.length).toBe(0);

  const versions = await client.send(
    new GetIpamPrefixListResolverVersionsCommand({
      IpamPrefixListResolverId: resolverId!,
    }),
  );
  expect(Array.isArray(versions.IpamPrefixListResolverVersions)).toBe(true);
  expect(versions.IpamPrefixListResolverVersions!.length).toBeGreaterThan(0);
});
