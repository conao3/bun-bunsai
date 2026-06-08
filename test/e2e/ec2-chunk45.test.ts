import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateManagedPrefixListCommand,
  CreateRouteServerCommand,
  CreateSecurityGroupCommand,
  CreateVpcCommand,
  EC2Client,
  GetManagedPrefixListAssociationsCommand,
  GetManagedPrefixListEntriesCommand,
  GetManagedResourceVisibilityCommand,
  GetPasswordDataCommand,
  GetReservedInstancesExchangeQuoteCommand,
  GetRouteServerAssociationsCommand,
  GetRouteServerPropagationsCommand,
  GetRouteServerRoutingDatabaseCommand,
  GetSecurityGroupsForVpcCommand,
  GetSpotPlacementScoresCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("CreateManagedPrefixList with entries → GetManagedPrefixListEntries returns them", async () => {
  const create = await client.send(
    new CreateManagedPrefixListCommand({
      PrefixListName: "my-pl",
      MaxEntries: 10,
      AddressFamily: "IPv4",
      Entries: [
        { Cidr: "10.0.0.0/8", Description: "private" },
        { Cidr: "192.168.0.0/16" },
      ],
    }),
  );
  const plId = create.PrefixList?.PrefixListId;
  expect(plId).toBeDefined();

  const entries = await client.send(
    new GetManagedPrefixListEntriesCommand({ PrefixListId: plId! }),
  );
  expect(Array.isArray(entries.Entries)).toBe(true);
  expect(entries.Entries!.length).toBe(2);
  expect(entries.Entries!.some((e) => e.Cidr === "10.0.0.0/8")).toBe(true);
  expect(entries.Entries!.some((e) => e.Cidr === "192.168.0.0/16")).toBe(true);

  const assocs = await client.send(
    new GetManagedPrefixListAssociationsCommand({ PrefixListId: plId! }),
  );
  expect(Array.isArray(assocs.PrefixListAssociations)).toBe(true);
  expect(assocs.PrefixListAssociations!.length).toBe(0);
});

test("CreateSecurityGroup in VPC → GetSecurityGroupsForVpc includes it", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId;
  expect(vpcId).toBeDefined();

  await client.send(
    new CreateSecurityGroupCommand({
      GroupName: "chunk45-sg",
      Description: "test sg",
      VpcId: vpcId!,
    }),
  );

  const result = await client.send(
    new GetSecurityGroupsForVpcCommand({ VpcId: vpcId! }),
  );
  expect(Array.isArray(result.SecurityGroupForVpcs)).toBe(true);
  expect(result.SecurityGroupForVpcs!.length).toBeGreaterThan(0);
  expect(
    result.SecurityGroupForVpcs!.some((sg) => sg.GroupName === "chunk45-sg"),
  ).toBe(true);
});

test("GetSecurityGroupsForVpc returns empty list for unknown VPC", async () => {
  const result = await client.send(
    new GetSecurityGroupsForVpcCommand({ VpcId: "vpc-nonexistent" }),
  );
  expect(Array.isArray(result.SecurityGroupForVpcs)).toBe(true);
  expect(result.SecurityGroupForVpcs!.length).toBe(0);
});

test("RunInstances → GetPasswordData returns synthetic data", async () => {
  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-chunk45",
      InstanceType: "t3.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId;
  expect(instanceId).toBeDefined();

  const pwd = await client.send(
    new GetPasswordDataCommand({ InstanceId: instanceId! }),
  );
  expect(pwd.InstanceId).toBe(instanceId);
  expect(typeof pwd.PasswordData).toBe("string");
  expect(pwd.PasswordData!.length).toBeGreaterThan(0);
});

test("GetManagedResourceVisibility returns visibility settings", async () => {
  const result = await client.send(new GetManagedResourceVisibilityCommand({}));
  expect(result.Visibility).toBeDefined();
});

test("GetReservedInstancesExchangeQuote returns synthetic quote", async () => {
  const result = await client.send(
    new GetReservedInstancesExchangeQuoteCommand({
      ReservedInstanceIds: ["ri-00000000"],
    }),
  );
  expect(result.IsValidExchange).toBe(true);
  expect(result.CurrencyCode).toBe("USD");
});

test("CreateRouteServer → GetRouteServerAssociations, GetRouteServerPropagations, GetRouteServerRoutingDatabase", async () => {
  const server = await client.send(
    new CreateRouteServerCommand({ AmazonSideAsn: 64512 }),
  );
  const rsId = server.RouteServer?.RouteServerId;
  expect(rsId).toBeDefined();

  const assocs = await client.send(
    new GetRouteServerAssociationsCommand({ RouteServerId: rsId! }),
  );
  expect(Array.isArray(assocs.RouteServerAssociations)).toBe(true);
  expect(assocs.RouteServerAssociations!.length).toBe(0);

  const props = await client.send(
    new GetRouteServerPropagationsCommand({ RouteServerId: rsId! }),
  );
  expect(Array.isArray(props.RouteServerPropagations)).toBe(true);
  expect(props.RouteServerPropagations!.length).toBe(0);

  const db = await client.send(
    new GetRouteServerRoutingDatabaseCommand({ RouteServerId: rsId! }),
  );
  expect(Array.isArray(db.Routes)).toBe(true);
  expect(db.Routes!.length).toBe(0);
});

test("GetSpotPlacementScores returns scores", async () => {
  const result = await client.send(
    new GetSpotPlacementScoresCommand({ TargetCapacity: 10 }),
  );
  expect(Array.isArray(result.SpotPlacementScores)).toBe(true);
  expect(result.SpotPlacementScores!.length).toBeGreaterThan(0);
});
