import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateInternetGatewayCommand,
  CreateIpamCommand,
  CreateIpamPoolCommand,
  CreateIpamScopeCommand,
  CreateKeyPairCommand,
  DeleteInstanceConnectEndpointCommand,
  DeleteInternetGatewayCommand,
  DeleteIpamCommand,
  DeleteIpamPoolCommand,
  DeleteIpamScopeCommand,
  DeleteKeyPairCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk15 delete (instance-connect, internet-gw, ipam family, key-pair) e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create-internet-gateway then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(new CreateInternetGatewayCommand({}));
    const igw = createRes.InternetGateway;
    expect(igw).toBeDefined();
    expect(igw?.InternetGatewayId?.startsWith("igw-")).toBe(true);

    const igwId = igw?.InternetGatewayId ?? "";

    const deleteRes = await client.send(
      new DeleteInternetGatewayCommand({ InternetGatewayId: igwId }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("create-key-pair then delete by name: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateKeyPairCommand({ KeyName: "test-key-chunk15" }),
    );
    expect(createRes.KeyPairId?.startsWith("key-")).toBe(true);
    expect(createRes.KeyName).toBe("test-key-chunk15");

    const deleteRes = await client.send(
      new DeleteKeyPairCommand({ KeyName: "test-key-chunk15" }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("create-key-pair then delete by id: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateKeyPairCommand({ KeyName: "test-key-chunk15-by-id" }),
    );
    const keyPairId = createRes.KeyPairId ?? "";
    expect(keyPairId.startsWith("key-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteKeyPairCommand({ KeyPairId: keyPairId }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("create-ipam then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateIpamCommand({ Description: "test-ipam-chunk15" }),
    );
    const ipam = createRes.Ipam;
    expect(ipam).toBeDefined();
    expect(ipam?.IpamId?.startsWith("ipam-")).toBe(true);
    expect(ipam?.State).toBe("create-complete");
    expect(ipam?.ScopeCount).toBe(2);

    const ipamId = ipam?.IpamId ?? "";

    const deleteRes = await client.send(
      new DeleteIpamCommand({ IpamId: ipamId }),
    );
    const deletedIpam = deleteRes.Ipam;
    expect(deletedIpam?.IpamId).toBe(ipamId);
    expect(deletedIpam?.State).toBe("delete-complete");
  });

  test("create-ipam-scope then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createIpamRes = await client.send(new CreateIpamCommand({}));
    const ipamId = createIpamRes.Ipam?.IpamId ?? "";

    const createScopeRes = await client.send(
      new CreateIpamScopeCommand({ IpamId: ipamId }),
    );
    const scope = createScopeRes.IpamScope;
    expect(scope).toBeDefined();
    expect(scope?.IpamScopeId?.startsWith("ipam-scope-")).toBe(true);

    const scopeId = scope?.IpamScopeId ?? "";

    const deleteRes = await client.send(
      new DeleteIpamScopeCommand({ IpamScopeId: scopeId }),
    );
    const deletedScope = deleteRes.IpamScope;
    expect(deletedScope?.IpamScopeId).toBe(scopeId);
    expect(deletedScope?.State).toBe("delete-complete");
  });

  test("create-ipam-pool then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createIpamRes = await client.send(new CreateIpamCommand({}));
    const ipamPrivateScopeId = createIpamRes.Ipam?.PrivateDefaultScopeId ?? "";

    const createPoolRes = await client.send(
      new CreateIpamPoolCommand({
        IpamScopeId: ipamPrivateScopeId,
        AddressFamily: "ipv4",
      }),
    );
    const pool = createPoolRes.IpamPool;
    expect(pool).toBeDefined();
    expect(pool?.IpamPoolId?.startsWith("ipam-pool-")).toBe(true);
    expect(pool?.State).toBe("create-complete");

    const poolId = pool?.IpamPoolId ?? "";

    const deleteRes = await client.send(
      new DeleteIpamPoolCommand({ IpamPoolId: poolId }),
    );
    const deletedPool = deleteRes.IpamPool;
    expect(deletedPool?.IpamPoolId).toBe(poolId);
    expect(deletedPool?.State).toBe("delete-complete");
  });

  test("delete-instance-connect-endpoint: not found returns error", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteInstanceConnectEndpointCommand({
          InstanceConnectEndpointId: "eice-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });
});
