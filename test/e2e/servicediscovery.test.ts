import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateHttpNamespaceCommand,
  CreatePrivateDnsNamespaceCommand,
  CreatePublicDnsNamespaceCommand,
  CreateServiceCommand,
  DeleteNamespaceCommand,
  DeleteServiceCommand,
  DeleteServiceAttributesCommand,
  DeregisterInstanceCommand,
  DiscoverInstancesCommand,
  DiscoverInstancesRevisionCommand,
  GetInstanceCommand,
  GetInstancesHealthStatusCommand,
  GetNamespaceCommand,
  GetOperationCommand,
  GetServiceAttributesCommand,
  GetServiceCommand,
  ListInstancesCommand,
  ListNamespacesCommand,
  ListOperationsCommand,
  ListServicesCommand,
  ListTagsForResourceCommand,
  RegisterInstanceCommand,
  ServiceDiscoveryClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateHttpNamespaceCommand,
  UpdateInstanceCustomHealthStatusCommand,
  UpdatePrivateDnsNamespaceCommand,
  UpdatePublicDnsNamespaceCommand,
  UpdateServiceAttributesCommand,
  UpdateServiceCommand,
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
    disableHostPrefix: true,
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

test("ServiceDiscovery HTTP and public DNS namespaces", async () => {
  const client = servicediscovery();

  const httpNs = await client.send(
    new CreateHttpNamespaceCommand({ Name: "bunsai-http.example.com" }),
  );
  expect(typeof httpNs.OperationId).toBe("string");

  const pubNs = await client.send(
    new CreatePublicDnsNamespaceCommand({ Name: "bunsai-public.example.com" }),
  );
  expect(typeof pubNs.OperationId).toBe("string");

  const listed = await client.send(new ListNamespacesCommand({}));
  const names = (listed.Namespaces ?? []).map((ns) => ns.Name);
  expect(names).toContain("bunsai-http.example.com");
  expect(names).toContain("bunsai-public.example.com");

  const httpNsEntry = (listed.Namespaces ?? []).find(
    (ns) => ns.Name === "bunsai-http.example.com",
  );
  const pubNsEntry = (listed.Namespaces ?? []).find(
    (ns) => ns.Name === "bunsai-public.example.com",
  );
  expect(httpNsEntry?.Type).toBe("HTTP");
  expect(pubNsEntry?.Type).toBe("DNS_PUBLIC");
});

test("ServiceDiscovery namespace update and delete", async () => {
  const client = servicediscovery();

  const httpNs = await client.send(
    new CreateHttpNamespaceCommand({ Name: "bunsai-update-http.example.com" }),
  );
  const httpOpId = httpNs.OperationId ?? "";

  const ns = await client.send(new ListNamespacesCommand({}));
  const httpNsEntry = (ns.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-update-http.example.com",
  );
  const httpNsId = httpNsEntry?.Id ?? "";

  const updateHttp = await client.send(
    new UpdateHttpNamespaceCommand({
      Id: httpNsId,
      Namespace: { Description: "updated description" },
    }),
  );
  expect(typeof updateHttp.OperationId).toBe("string");

  const gotHttp = await client.send(new GetNamespaceCommand({ Id: httpNsId }));
  expect(gotHttp.Namespace?.Description).toBe("updated description");

  const privNs = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: "bunsai-update-priv.local",
      Vpc: "vpc-aaaa",
    }),
  );
  expect(typeof privNs.OperationId).toBe("string");

  const ns2 = await client.send(new ListNamespacesCommand({}));
  const privNsEntry = (ns2.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-update-priv.local",
  );
  const privNsId = privNsEntry?.Id ?? "";

  const updatePriv = await client.send(
    new UpdatePrivateDnsNamespaceCommand({
      Id: privNsId,
      Namespace: { Description: "priv updated" },
    }),
  );
  expect(typeof updatePriv.OperationId).toBe("string");

  const pubNs = await client.send(
    new CreatePublicDnsNamespaceCommand({
      Name: "bunsai-update-pub.example.com",
    }),
  );
  expect(typeof pubNs.OperationId).toBe("string");

  const ns3 = await client.send(new ListNamespacesCommand({}));
  const pubNsEntry = (ns3.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-update-pub.example.com",
  );
  const pubNsId = pubNsEntry?.Id ?? "";

  const updatePub = await client.send(
    new UpdatePublicDnsNamespaceCommand({
      Id: pubNsId,
      Namespace: { Description: "pub updated" },
    }),
  );
  expect(typeof updatePub.OperationId).toBe("string");

  const deleteOp = await client.send(
    new DeleteNamespaceCommand({ Id: httpNsId }),
  );
  expect(typeof deleteOp.OperationId).toBe("string");

  const opResult = await client.send(
    new GetOperationCommand({ OperationId: httpOpId }),
  );
  expect(opResult.Operation?.Status).toBe("SUCCESS");

  void updatePriv;
  void updatePub;
});

test("ServiceDiscovery service update, delete and attributes", async () => {
  const client = servicediscovery();

  const nsRes = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: "bunsai-svc-attr.local",
      Vpc: "vpc-bbbb",
    }),
  );
  expect(typeof nsRes.OperationId).toBe("string");

  const nsList = await client.send(new ListNamespacesCommand({}));
  const nsEntry = (nsList.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-svc-attr.local",
  );
  const nsId = nsEntry?.Id ?? "";

  const svcRes = await client.send(
    new CreateServiceCommand({
      Name: "bunsai-attr-service",
      NamespaceId: nsId,
    }),
  );
  const svcId = svcRes.Service?.Id ?? "";

  const updateSvc = await client.send(
    new UpdateServiceCommand({
      Id: svcId,
      Service: { Description: "updated service" },
    }),
  );
  expect(typeof updateSvc.OperationId).toBe("string");

  const gotSvc = await client.send(new GetServiceCommand({ Id: svcId }));
  expect(gotSvc.Service?.Description).toBe("updated service");

  await client.send(
    new UpdateServiceAttributesCommand({
      ServiceId: svcId,
      Attributes: { env: "prod", version: "1.0" },
    }),
  );

  const attrs = await client.send(
    new GetServiceAttributesCommand({ ServiceId: svcId }),
  );
  expect(attrs.ServiceAttributes?.Attributes?.env).toBe("prod");
  expect(attrs.ServiceAttributes?.Attributes?.version).toBe("1.0");

  await client.send(
    new DeleteServiceAttributesCommand({
      ServiceId: svcId,
      Attributes: ["version"],
    }),
  );

  const attrsAfter = await client.send(
    new GetServiceAttributesCommand({ ServiceId: svcId }),
  );
  expect(attrsAfter.ServiceAttributes?.Attributes?.env).toBe("prod");
  expect(attrsAfter.ServiceAttributes?.Attributes?.version).toBeUndefined();

  const svcRes2 = await client.send(
    new CreateServiceCommand({
      Name: "bunsai-delete-service",
      NamespaceId: nsId,
    }),
  );
  const delSvcId = svcRes2.Service?.Id ?? "";

  await client.send(new DeleteServiceCommand({ Id: delSvcId }));

  const svcList = await client.send(new ListServicesCommand({}));
  expect((svcList.Services ?? []).map((s) => s.Id)).not.toContain(delSvcId);
});

test("ServiceDiscovery instance operations", async () => {
  const client = servicediscovery();

  const nsRes = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: "bunsai-inst-ops.local",
      Vpc: "vpc-cccc",
    }),
  );
  const nsList = await client.send(new ListNamespacesCommand({}));
  const nsEntry = (nsList.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-inst-ops.local",
  );
  const nsId = nsEntry?.Id ?? "";

  const svcRes = await client.send(
    new CreateServiceCommand({
      Name: "bunsai-inst-service",
      NamespaceId: nsId,
    }),
  );
  const svcId = svcRes.Service?.Id ?? "";

  await client.send(
    new RegisterInstanceCommand({
      ServiceId: svcId,
      InstanceId: "inst-1",
      Attributes: { AWS_INSTANCE_IPV4: "10.0.1.1" },
    }),
  );
  await client.send(
    new RegisterInstanceCommand({
      ServiceId: svcId,
      InstanceId: "inst-2",
      Attributes: { AWS_INSTANCE_IPV4: "10.0.1.2" },
    }),
  );

  const getInstance = await client.send(
    new GetInstanceCommand({ ServiceId: svcId, InstanceId: "inst-1" }),
  );
  expect(getInstance.Instance?.Id).toBe("inst-1");
  expect(
    (getInstance.Instance?.Attributes as Record<string, string> | undefined)
      ?.AWS_INSTANCE_IPV4,
  ).toBe("10.0.1.1");

  const listInst = await client.send(
    new ListInstancesCommand({ ServiceId: svcId }),
  );
  expect((listInst.Instances ?? []).map((i) => i.Id)).toContain("inst-1");
  expect((listInst.Instances ?? []).map((i) => i.Id)).toContain("inst-2");

  const healthStatus = await client.send(
    new GetInstancesHealthStatusCommand({ ServiceId: svcId }),
  );
  expect(healthStatus.Status?.["inst-1"]).toBe("HEALTHY");

  await client.send(
    new UpdateInstanceCustomHealthStatusCommand({
      ServiceId: svcId,
      InstanceId: "inst-1",
      Status: "UNHEALTHY",
    }),
  );

  const healthAfter = await client.send(
    new GetInstancesHealthStatusCommand({ ServiceId: svcId }),
  );
  expect(healthAfter.Status?.["inst-1"]).toBe("UNHEALTHY");

  const deregOp = await client.send(
    new DeregisterInstanceCommand({ ServiceId: svcId, InstanceId: "inst-2" }),
  );
  expect(typeof deregOp.OperationId).toBe("string");

  const svcAfter = await client.send(new GetServiceCommand({ Id: svcId }));
  expect(svcAfter.Service?.InstanceCount).toBe(1);

  void nsRes;
});

test("ServiceDiscovery discover instances", async () => {
  const client = servicediscovery();

  const nsRes = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: "bunsai-discover.local",
      Vpc: "vpc-dddd",
    }),
  );
  const nsList = await client.send(new ListNamespacesCommand({}));
  const nsEntry = (nsList.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-discover.local",
  );
  const nsId = nsEntry?.Id ?? "";

  const svcRes = await client.send(
    new CreateServiceCommand({
      Name: "bunsai-discover-service",
      NamespaceId: nsId,
    }),
  );
  const svcId = svcRes.Service?.Id ?? "";

  await client.send(
    new RegisterInstanceCommand({
      ServiceId: svcId,
      InstanceId: "disc-inst-1",
      Attributes: { AWS_INSTANCE_IPV4: "10.0.2.1" },
    }),
  );

  const discovered = await client.send(
    new DiscoverInstancesCommand({
      NamespaceName: "bunsai-discover.local",
      ServiceName: "bunsai-discover-service",
    }),
  );
  expect((discovered.Instances ?? []).map((i) => i.InstanceId)).toContain(
    "disc-inst-1",
  );

  const revision = await client.send(
    new DiscoverInstancesRevisionCommand({
      NamespaceName: "bunsai-discover.local",
      ServiceName: "bunsai-discover-service",
    }),
  );
  expect(typeof revision.InstancesRevision).toBe("number");

  void nsRes;
});

test("ServiceDiscovery operation tracking", async () => {
  const client = servicediscovery();

  const nsRes = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: "bunsai-ops.local",
      Vpc: "vpc-eeee",
    }),
  );
  const opId = nsRes.OperationId ?? "";

  const getOp = await client.send(
    new GetOperationCommand({ OperationId: opId }),
  );
  expect(getOp.Operation?.Id).toBe(opId);
  expect(getOp.Operation?.Status).toBe("SUCCESS");
  expect(getOp.Operation?.Type).toBe("CREATE_NAMESPACE");

  const listOps = await client.send(new ListOperationsCommand({}));
  expect((listOps.Operations ?? []).map((o) => o.Id)).toContain(opId);
});

test("ServiceDiscovery tag operations", async () => {
  const client = servicediscovery();

  const nsRes = await client.send(
    new CreatePrivateDnsNamespaceCommand({
      Name: "bunsai-tags.local",
      Vpc: "vpc-ffff",
    }),
  );
  const nsList = await client.send(new ListNamespacesCommand({}));
  const nsEntry = (nsList.Namespaces ?? []).find(
    (n) => n.Name === "bunsai-tags.local",
  );
  const nsArn = nsEntry?.Arn ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceARN: nsArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: nsArn }),
  );
  const tagMap = Object.fromEntries(
    (tags.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap.env).toBe("test");
  expect(tagMap.team).toBe("platform");

  await client.send(
    new UntagResourceCommand({ ResourceARN: nsArn, TagKeys: ["team"] }),
  );

  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: nsArn }),
  );
  const tagMapAfter = Object.fromEntries(
    (tagsAfter.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMapAfter.env).toBe("test");
  expect(tagMapAfter.team).toBeUndefined();

  void nsRes;
});
