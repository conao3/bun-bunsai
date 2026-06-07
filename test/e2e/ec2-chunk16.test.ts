import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateLaunchTemplateCommand,
  CreateLaunchTemplateVersionCommand,
  CreateLocalGatewayRouteCommand,
  CreateLocalGatewayRouteTableCommand,
  CreateManagedPrefixListCommand,
  CreateNetworkAclCommand,
  CreateNetworkAclEntryCommand,
  CreateNetworkInsightsAccessScopeCommand,
  DeleteLaunchTemplateCommand,
  DeleteLaunchTemplateVersionsCommand,
  DeleteLocalGatewayRouteCommand,
  DeleteLocalGatewayRouteTableCommand,
  DeleteManagedPrefixListCommand,
  DeleteNetworkAclCommand,
  DeleteNetworkAclEntryCommand,
  DeleteNetworkInsightsAccessScopeCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk16 delete (launch-template, local-gateway, prefix-list, network-acl) e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create launch-template then delete by id: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateLaunchTemplateCommand({
        LaunchTemplateName: "test-lt-chunk16",
        LaunchTemplateData: { ImageId: "ami-test" },
      }),
    );
    const lt = createRes.LaunchTemplate;
    expect(lt).toBeDefined();
    expect(lt?.LaunchTemplateId?.startsWith("lt-")).toBe(true);
    expect(lt?.LaunchTemplateName).toBe("test-lt-chunk16");
    expect(lt?.DefaultVersionNumber).toBe(1);

    const ltId = lt?.LaunchTemplateId ?? "";

    const deleteRes = await client.send(
      new DeleteLaunchTemplateCommand({ LaunchTemplateId: ltId }),
    );
    expect(deleteRes.LaunchTemplate?.LaunchTemplateId).toBe(ltId);
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("delete non-existent launch template: throws InvalidLaunchTemplateId.NotFound", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteLaunchTemplateCommand({
          LaunchTemplateId: "lt-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });

  test("create launch-template versions then delete specific versions", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateLaunchTemplateCommand({
        LaunchTemplateName: "test-lt-versions-chunk16",
        LaunchTemplateData: { ImageId: "ami-test" },
      }),
    );
    const ltId = createRes.LaunchTemplate?.LaunchTemplateId ?? "";

    await client.send(
      new CreateLaunchTemplateVersionCommand({
        LaunchTemplateId: ltId,
        LaunchTemplateData: { ImageId: "ami-test-v2" },
      }),
    );

    const deleteVersionsRes = await client.send(
      new DeleteLaunchTemplateVersionsCommand({
        LaunchTemplateId: ltId,
        Versions: ["1", "2"],
      }),
    );
    expect(
      deleteVersionsRes.SuccessfullyDeletedLaunchTemplateVersions,
    ).toHaveLength(2);
    expect(
      deleteVersionsRes.UnsuccessfullyDeletedLaunchTemplateVersions,
    ).toHaveLength(0);

    const deleteVersionsRes2 = await client.send(
      new DeleteLaunchTemplateVersionsCommand({
        LaunchTemplateId: ltId,
        Versions: ["99"],
      }),
    );
    expect(
      deleteVersionsRes2.SuccessfullyDeletedLaunchTemplateVersions,
    ).toHaveLength(0);
    expect(
      deleteVersionsRes2.UnsuccessfullyDeletedLaunchTemplateVersions,
    ).toHaveLength(1);
  });

  test("create local-gateway-route-table then route then delete both", async () => {
    const client = ec2();

    const createRtbRes = await client.send(
      new CreateLocalGatewayRouteTableCommand({
        LocalGatewayId: "lgw-test",
      }),
    );
    const rtb = createRtbRes.LocalGatewayRouteTable;
    expect(rtb?.LocalGatewayRouteTableId?.startsWith("lgw-rtb-")).toBe(true);
    const rtbId = rtb?.LocalGatewayRouteTableId ?? "";

    await client.send(
      new CreateLocalGatewayRouteCommand({
        LocalGatewayRouteTableId: rtbId,
        DestinationCidrBlock: "10.0.0.0/24",
      }),
    );

    const deleteRouteRes = await client.send(
      new DeleteLocalGatewayRouteCommand({
        LocalGatewayRouteTableId: rtbId,
        DestinationCidrBlock: "10.0.0.0/24",
      }),
    );
    expect(deleteRouteRes.Route?.DestinationCidrBlock).toBe("10.0.0.0/24");

    const deleteRtbRes = await client.send(
      new DeleteLocalGatewayRouteTableCommand({
        LocalGatewayRouteTableId: rtbId,
      }),
    );
    expect(deleteRtbRes.LocalGatewayRouteTable?.LocalGatewayRouteTableId).toBe(
      rtbId,
    );
  });

  test("delete non-existent local-gateway-route-table: throws", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteLocalGatewayRouteTableCommand({
          LocalGatewayRouteTableId: "lgw-rtb-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });

  test("create managed-prefix-list then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateManagedPrefixListCommand({
        PrefixListName: "test-pl-chunk16",
        AddressFamily: "IPv4",
        MaxEntries: 5,
      }),
    );
    const pl = createRes.PrefixList;
    expect(pl?.PrefixListId?.startsWith("pl-")).toBe(true);
    expect(pl?.State).toBe("create-complete");
    const plId = pl?.PrefixListId ?? "";

    const deleteRes = await client.send(
      new DeleteManagedPrefixListCommand({ PrefixListId: plId }),
    );
    expect(deleteRes.PrefixList?.PrefixListId).toBe(plId);
    expect(deleteRes.PrefixList?.State).toBe("delete-complete");
  });

  test("delete non-existent managed-prefix-list: throws", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteManagedPrefixListCommand({ PrefixListId: "pl-nonexistent" }),
      ),
    ).rejects.toThrow();
  });

  test("create network-acl then add entry then delete entry then delete acl", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateNetworkAclCommand({ VpcId: "vpc-test" }),
    );
    const acl = createRes.NetworkAcl;
    expect(acl?.NetworkAclId?.startsWith("acl-")).toBe(true);
    const aclId = acl?.NetworkAclId ?? "";

    await client.send(
      new CreateNetworkAclEntryCommand({
        NetworkAclId: aclId,
        RuleNumber: 100,
        Protocol: "-1",
        RuleAction: "allow",
        Egress: false,
        CidrBlock: "0.0.0.0/0",
      }),
    );

    const deleteEntryRes = await client.send(
      new DeleteNetworkAclEntryCommand({
        NetworkAclId: aclId,
        RuleNumber: 100,
        Egress: false,
      }),
    );
    expect(deleteEntryRes.$metadata.httpStatusCode).toBe(200);

    const deleteAclRes = await client.send(
      new DeleteNetworkAclCommand({ NetworkAclId: aclId }),
    );
    expect(deleteAclRes.$metadata.httpStatusCode).toBe(200);
  });

  test("delete non-existent network-acl: throws", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteNetworkAclCommand({ NetworkAclId: "acl-nonexistent" }),
      ),
    ).rejects.toThrow();
  });

  test("create network-insights-access-scope then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateNetworkInsightsAccessScopeCommand({}),
    );
    const scope = createRes.NetworkInsightsAccessScope;
    expect(scope?.NetworkInsightsAccessScopeId?.startsWith("nis-")).toBe(true);
    const scopeId = scope?.NetworkInsightsAccessScopeId ?? "";

    const deleteRes = await client.send(
      new DeleteNetworkInsightsAccessScopeCommand({
        NetworkInsightsAccessScopeId: scopeId,
      }),
    );
    expect(deleteRes.NetworkInsightsAccessScopeId).toBe(scopeId);
  });

  test("delete non-existent network-insights-access-scope: throws", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteNetworkInsightsAccessScopeCommand({
          NetworkInsightsAccessScopeId: "nis-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });
});
