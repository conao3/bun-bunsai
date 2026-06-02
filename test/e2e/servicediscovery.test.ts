import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreatePrivateDnsNamespaceCommand,
  CreateServiceCommand,
  GetNamespaceCommand,
  GetServiceCommand,
  ListNamespacesCommand,
  ListServicesCommand,
  RegisterInstanceCommand,
  ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
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

const servicediscovery = () =>
  new ServiceDiscoveryClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("ServiceDiscovery namespace, service and instance lifecycle", async () => {
  const client = servicediscovery();
  const namespaceName = "bunsai-e2e.local";
  const serviceName = "bunsai-e2e-service";

  const createdNamespace = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: namespaceName,
      Vpc: "vpc-0123456789abcdef0",
    }),
  );
  expect(typeof createdNamespace.OperationId).toBe("string");

  const listedNamespaces = await client.send(new ListNamespacesCommand({}));
  const namespaceSummary = (listedNamespaces.Namespaces ?? []).find(
    (ns) => ns.Name === namespaceName,
  );
  expect(namespaceSummary?.Id).toBeDefined();
  const namespaceId = namespaceSummary?.Id ?? "";

  const gotNamespace = await client.send(
    new GetNamespaceCommand({ Id: namespaceId }),
  );
  expect(gotNamespace.Namespace?.Name).toBe(namespaceName);
  expect(gotNamespace.Namespace?.Type).toBe("DNS_PRIVATE");

  const createdService = await client.send(
    new CreateServiceCommand({
      Name: serviceName,
      NamespaceId: namespaceId,
      DnsConfig: {
        DnsRecords: [{ Type: "A", TTL: 60 }],
      },
    }),
  );
  expect(createdService.Service?.Name).toBe(serviceName);
  expect(createdService.Service?.Arn).toContain("service/");
  const serviceId = createdService.Service?.Id ?? "";

  const gotService = await client.send(
    new GetServiceCommand({ Id: serviceId }),
  );
  expect(gotService.Service?.Name).toBe(serviceName);
  expect(gotService.Service?.NamespaceId).toBe(namespaceId);

  const listedServices = await client.send(new ListServicesCommand({}));
  expect((listedServices.Services ?? []).map((svc) => svc.Name)).toContain(
    serviceName,
  );

  const registered = await client.send(
    new RegisterInstanceCommand({
      ServiceId: serviceId,
      InstanceId: "bunsai-e2e-instance",
      Attributes: { AWS_INSTANCE_IPV4: "10.0.0.1" },
    }),
  );
  expect(typeof registered.OperationId).toBe("string");

  const afterRegister = await client.send(
    new GetServiceCommand({ Id: serviceId }),
  );
  expect(afterRegister.Service?.InstanceCount).toBe(1);
});
