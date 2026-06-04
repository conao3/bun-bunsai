import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  APIGatewayClient,
  CreateDomainNameAccessAssociationCommand,
  CreateDomainNameCommand,
  CreateVpcLinkCommand,
  DeleteDomainNameAccessAssociationCommand,
  DeleteDomainNameCommand,
  DeleteVpcLinkCommand,
  GetDomainNameAccessAssociationsCommand,
  GetDomainNameCommand,
  GetDomainNamesCommand,
  GetVpcLinkCommand,
  GetVpcLinksCommand,
  RejectDomainNameAccessAssociationCommand,
  UpdateDomainNameCommand,
} from "@aws-sdk/client-api-gateway";

const awsPort = 4796;
const uiPort = 5796;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

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

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials });

test("API Gateway domain-name lifecycle", async () => {
  const client = apigateway();

  const created = await client.send(
    new CreateDomainNameCommand({
      domainName: "api.example.com",
      regionalCertificateArn:
        "arn:aws:acm:us-east-1:123456789012:certificate/abc123",
      securityPolicy: "TLS_1_2",
    }),
  );
  expect(created.domainName).toBe("api.example.com");
  expect(created.domainNameStatus).toBe("AVAILABLE");
  expect(created.domainNameArn).toBeDefined();
  expect(created.regionalDomainName).toBeDefined();
  expect(created.securityPolicy).toBe("TLS_1_2");

  const got = await client.send(
    new GetDomainNameCommand({ domainName: "api.example.com" }),
  );
  expect(got.domainName).toBe("api.example.com");
  expect(got.regionalCertificateArn).toBe(
    "arn:aws:acm:us-east-1:123456789012:certificate/abc123",
  );

  const listed = await client.send(new GetDomainNamesCommand({}));
  expect((listed.items ?? []).map((d) => d.domainName)).toContain(
    "api.example.com",
  );

  const updated = await client.send(
    new UpdateDomainNameCommand({
      domainName: "api.example.com",
      patchOperations: [
        { op: "replace", path: "/securityPolicy", value: "TLS_1_0" },
      ],
    }),
  );
  expect(updated.securityPolicy).toBe("TLS_1_0");

  await client.send(
    new DeleteDomainNameCommand({ domainName: "api.example.com" }),
  );
  const afterDelete = await client.send(new GetDomainNamesCommand({}));
  expect((afterDelete.items ?? []).map((d) => d.domainName)).not.toContain(
    "api.example.com",
  );
});

test("API Gateway domain-name-access-association lifecycle", async () => {
  const client = apigateway();

  const dn = await client.send(
    new CreateDomainNameCommand({ domainName: "private.example.com" }),
  );
  const domainNameArn = dn.domainNameArn as string;

  const created = await client.send(
    new CreateDomainNameAccessAssociationCommand({
      domainNameArn,
      accessAssociationSourceType: "VPCE",
      accessAssociationSource: "vpce-0123456789abcdef0",
    }),
  );
  expect(created.domainNameAccessAssociationArn).toBeDefined();
  expect(created.domainNameArn).toBe(domainNameArn);
  expect(created.accessAssociationSourceType).toBe("VPCE");
  const assocArn = created.domainNameAccessAssociationArn as string;

  const listed = await client.send(
    new GetDomainNameAccessAssociationsCommand({}),
  );
  expect(
    (listed.items ?? []).map((a) => a.domainNameAccessAssociationArn),
  ).toContain(assocArn);

  const rejected = await client.send(
    new RejectDomainNameAccessAssociationCommand({
      domainNameAccessAssociationArn: assocArn,
      domainNameArn,
    }),
  );
  expect(rejected).toBeDefined();

  const afterReject = await client.send(
    new GetDomainNameAccessAssociationsCommand({}),
  );
  expect(
    (afterReject.items ?? []).map((a) => a.domainNameAccessAssociationArn),
  ).not.toContain(assocArn);

  const created2 = await client.send(
    new CreateDomainNameAccessAssociationCommand({
      domainNameArn,
      accessAssociationSourceType: "VPCE",
      accessAssociationSource: "vpce-0000000000000001",
    }),
  );
  const assocArn2 = created2.domainNameAccessAssociationArn as string;

  await client.send(
    new DeleteDomainNameAccessAssociationCommand({
      domainNameAccessAssociationArn: assocArn2,
    }),
  );
  const afterDelete = await client.send(
    new GetDomainNameAccessAssociationsCommand({}),
  );
  expect(
    (afterDelete.items ?? []).map((a) => a.domainNameAccessAssociationArn),
  ).not.toContain(assocArn2);
});

test("API Gateway vpc-link lifecycle", async () => {
  const client = apigateway();

  const created = await client.send(
    new CreateVpcLinkCommand({
      name: "bunsai-vpc-link",
      description: "e2e test vpc link",
      targetArns: [
        "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/my-nlb/abc123",
      ],
    }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe("bunsai-vpc-link");
  expect(created.status).toBe("AVAILABLE");
  expect(created.targetArns).toHaveLength(1);
  const vpcLinkId = created.id as string;

  const got = await client.send(new GetVpcLinkCommand({ vpcLinkId }));
  expect(got.id).toBe(vpcLinkId);
  expect(got.description).toBe("e2e test vpc link");

  const listed = await client.send(new GetVpcLinksCommand({}));
  expect((listed.items ?? []).map((v) => v.id)).toContain(vpcLinkId);

  await client.send(new DeleteVpcLinkCommand({ vpcLinkId }));
  const afterDelete = await client.send(new GetVpcLinksCommand({}));
  expect((afterDelete.items ?? []).map((v) => v.id)).not.toContain(vpcLinkId);
});
