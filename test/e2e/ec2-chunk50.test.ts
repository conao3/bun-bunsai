import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateIpamCommand,
  CreateIpamPoolCommand,
  CreateLaunchTemplateCommand,
  CreateLaunchTemplateVersionCommand,
  CreateManagedPrefixListCommand,
  DescribeIpamPoolsCommand,
  DescribeIpamsCommand,
  DescribeLaunchTemplatesCommand,
  DescribeManagedPrefixListsCommand,
  EC2Client,
  GetManagedPrefixListEntriesCommand,
  ModifyIpamCommand,
  ModifyIpamPoolCommand,
  ModifyLaunchTemplateCommand,
  ModifyManagedPrefixListCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ModifyIpam updates Description reflected in DescribeIpams", async () => {
  const created = await client.send(new CreateIpamCommand({}));
  const ipamId = created.Ipam?.IpamId ?? "";
  expect(ipamId.startsWith("ipam-")).toBe(true);

  const modified = await client.send(
    new ModifyIpamCommand({ IpamId: ipamId, Description: "updated-ipam" }),
  );
  expect(modified.Ipam?.Description).toBe("updated-ipam");

  const described = await client.send(
    new DescribeIpamsCommand({ IpamIds: [ipamId] }),
  );
  expect(described.Ipams?.[0]?.Description).toBe("updated-ipam");
});

test("ModifyIpam throws InvalidIpamId.NotFound for missing ipam", async () => {
  await expect(
    client.send(new ModifyIpamCommand({ IpamId: "ipam-nonexistent" })),
  ).rejects.toMatchObject({ name: "InvalidIpamId.NotFound" });
});

test("ModifyIpamPool updates Description reflected in DescribeIpamPools", async () => {
  const ipam = await client.send(new CreateIpamCommand({}));
  const privateScopeId = ipam.Ipam?.PrivateDefaultScopeId ?? "";

  const pool = await client.send(
    new CreateIpamPoolCommand({
      IpamScopeId: privateScopeId,
      AddressFamily: "ipv4",
      Description: "original",
    }),
  );
  const poolId = pool.IpamPool?.IpamPoolId ?? "";
  expect(poolId.startsWith("ipam-pool-")).toBe(true);

  const modified = await client.send(
    new ModifyIpamPoolCommand({ IpamPoolId: poolId, Description: "updated" }),
  );
  expect(modified.IpamPool?.Description).toBe("updated");

  const described = await client.send(
    new DescribeIpamPoolsCommand({ IpamPoolIds: [poolId] }),
  );
  expect(described.IpamPools?.[0]?.Description).toBe("updated");
});

test("ModifyIpamPool throws InvalidIpamPoolId.NotFound for missing pool", async () => {
  await expect(
    client.send(
      new ModifyIpamPoolCommand({ IpamPoolId: "ipam-pool-nonexistent" }),
    ),
  ).rejects.toMatchObject({ name: "InvalidIpamPoolId.NotFound" });
});

test("ModifyLaunchTemplate changes DefaultVersion reflected in DescribeLaunchTemplates", async () => {
  const created = await client.send(
    new CreateLaunchTemplateCommand({
      LaunchTemplateName: "modify-lt-test",
      LaunchTemplateData: { ImageId: "ami-test" },
    }),
  );
  const ltId = created.LaunchTemplate?.LaunchTemplateId ?? "";
  expect(ltId.startsWith("lt-")).toBe(true);

  await client.send(
    new CreateLaunchTemplateVersionCommand({
      LaunchTemplateId: ltId,
      LaunchTemplateData: { ImageId: "ami-test-v2" },
    }),
  );

  const modified = await client.send(
    new ModifyLaunchTemplateCommand({
      LaunchTemplateId: ltId,
      DefaultVersion: "2",
    }),
  );
  expect(modified.LaunchTemplate?.DefaultVersionNumber).toBe(2);

  const described = await client.send(
    new DescribeLaunchTemplatesCommand({ LaunchTemplateIds: [ltId] }),
  );
  expect(described.LaunchTemplates?.[0]?.DefaultVersionNumber).toBe(2);
});

test("ModifyLaunchTemplate throws InvalidLaunchTemplateId.NotFound for missing template", async () => {
  await expect(
    client.send(
      new ModifyLaunchTemplateCommand({
        LaunchTemplateId: "lt-nonexistent",
        DefaultVersion: "1",
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidLaunchTemplateId.NotFound" });
});

test("ModifyManagedPrefixList adds entries reflected in GetManagedPrefixListEntries", async () => {
  const created = await client.send(
    new CreateManagedPrefixListCommand({
      PrefixListName: "modify-pl-test",
      AddressFamily: "IPv4",
      MaxEntries: 10,
      Entries: [{ Cidr: "10.0.0.0/8" }],
    }),
  );
  const plId = created.PrefixList?.PrefixListId ?? "";
  expect(plId.startsWith("pl-")).toBe(true);

  const modified = await client.send(
    new ModifyManagedPrefixListCommand({
      PrefixListId: plId,
      CurrentVersion: 1,
      AddEntries: [{ Cidr: "192.168.0.0/16", Description: "private" }],
      RemoveEntries: [{ Cidr: "10.0.0.0/8" }],
    }),
  );
  expect(modified.PrefixList?.Version).toBe(2);
  expect(modified.PrefixList?.State).toBe("modify-complete");

  const entries = await client.send(
    new GetManagedPrefixListEntriesCommand({ PrefixListId: plId }),
  );
  const cidrs = entries.Entries?.map((e) => e.Cidr) ?? [];
  expect(cidrs).toContain("192.168.0.0/16");
  expect(cidrs).not.toContain("10.0.0.0/8");

  const described = await client.send(
    new DescribeManagedPrefixListsCommand({ PrefixListIds: [plId] }),
  );
  expect(described.PrefixLists?.[0]?.Version).toBe(2);
});

test("ModifyManagedPrefixList throws InvalidPrefixListID.NotFound for missing list", async () => {
  await expect(
    client.send(
      new ModifyManagedPrefixListCommand({
        PrefixListId: "pl-nonexistent",
        CurrentVersion: 1,
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidPrefixListID.NotFound" });
});
