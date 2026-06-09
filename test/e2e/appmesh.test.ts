import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AppMeshClient,
  CreateGatewayRouteCommand,
  CreateMeshCommand,
  CreateRouteCommand,
  CreateVirtualGatewayCommand,
  CreateVirtualNodeCommand,
  CreateVirtualRouterCommand,
  CreateVirtualServiceCommand,
  DeleteGatewayRouteCommand,
  DeleteMeshCommand,
  DeleteRouteCommand,
  DeleteVirtualGatewayCommand,
  DeleteVirtualNodeCommand,
  DeleteVirtualRouterCommand,
  DeleteVirtualServiceCommand,
  DescribeGatewayRouteCommand,
  DescribeMeshCommand,
  DescribeRouteCommand,
  DescribeVirtualGatewayCommand,
  DescribeVirtualNodeCommand,
  DescribeVirtualRouterCommand,
  DescribeVirtualServiceCommand,
  ListGatewayRoutesCommand,
  ListMeshesCommand,
  ListRoutesCommand,
  ListTagsForResourceCommand,
  ListVirtualGatewaysCommand,
  ListVirtualNodesCommand,
  ListVirtualRoutersCommand,
  ListVirtualServicesCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateGatewayRouteCommand,
  UpdateMeshCommand,
  UpdateRouteCommand,
  UpdateVirtualGatewayCommand,
  UpdateVirtualNodeCommand,
  UpdateVirtualRouterCommand,
  UpdateVirtualServiceCommand,
} from "@aws-sdk/client-app-mesh";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const appmesh = () =>
  new AppMeshClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("AppMesh mesh roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(new CreateMeshCommand({ meshName }));
  expect(created.mesh?.meshName).toBe(meshName);
  expect(created.mesh?.metadata?.arn).toBeDefined();
  expect(created.mesh?.status?.status).toBe("ACTIVE");

  const got = await client.send(new DescribeMeshCommand({ meshName }));
  expect(got.mesh?.meshName).toBe(meshName);
  expect(got.mesh?.metadata?.arn).toBe(created.mesh?.metadata?.arn);

  const listed = await client.send(new ListMeshesCommand({}));
  expect((listed.meshes ?? []).map((m) => m.meshName)).toContain(meshName);

  const updated = await client.send(new UpdateMeshCommand({ meshName }));
  expect(updated.mesh?.meshName).toBe(meshName);
  expect(updated.mesh?.metadata?.version).toBe(2);

  await client.send(new DeleteMeshCommand({ meshName }));
  await expect(
    client.send(new DescribeMeshCommand({ meshName })),
  ).rejects.toThrow();
});

test("AppMesh virtual node roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;
  const virtualNodeName = `node-${Date.now()}`;

  await client.send(new CreateMeshCommand({ meshName }));

  const created = await client.send(
    new CreateVirtualNodeCommand({
      meshName,
      virtualNodeName,
      spec: { listeners: [] },
    }),
  );
  expect(created.virtualNode?.virtualNodeName).toBe(virtualNodeName);
  expect(created.virtualNode?.meshName).toBe(meshName);
  expect(created.virtualNode?.metadata?.arn).toBeDefined();
  expect(created.virtualNode?.status?.status).toBe("ACTIVE");

  const got = await client.send(
    new DescribeVirtualNodeCommand({ meshName, virtualNodeName }),
  );
  expect(got.virtualNode?.virtualNodeName).toBe(virtualNodeName);

  const listed = await client.send(new ListVirtualNodesCommand({ meshName }));
  expect((listed.virtualNodes ?? []).map((n) => n.virtualNodeName)).toContain(
    virtualNodeName,
  );

  const upd = await client.send(
    new UpdateVirtualNodeCommand({
      meshName,
      virtualNodeName,
      spec: { listeners: [] },
    }),
  );
  expect(upd.virtualNode?.metadata?.version).toBe(2);

  await client.send(
    new DeleteVirtualNodeCommand({ meshName, virtualNodeName }),
  );
  await expect(
    client.send(new DescribeVirtualNodeCommand({ meshName, virtualNodeName })),
  ).rejects.toThrow();

  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh virtual router and route roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;
  const virtualRouterName = `router-${Date.now()}`;
  const routeName = `route-${Date.now()}`;

  await client.send(new CreateMeshCommand({ meshName }));

  const createdVr = await client.send(
    new CreateVirtualRouterCommand({
      meshName,
      virtualRouterName,
      spec: { listeners: [{ portMapping: { port: 8080, protocol: "http" } }] },
    }),
  );
  expect(createdVr.virtualRouter?.virtualRouterName).toBe(virtualRouterName);
  expect(createdVr.virtualRouter?.metadata?.arn).toBeDefined();

  const gotVr = await client.send(
    new DescribeVirtualRouterCommand({ meshName, virtualRouterName }),
  );
  expect(gotVr.virtualRouter?.virtualRouterName).toBe(virtualRouterName);

  const listedVr = await client.send(
    new ListVirtualRoutersCommand({ meshName }),
  );
  expect(
    (listedVr.virtualRouters ?? []).map((r) => r.virtualRouterName),
  ).toContain(virtualRouterName);

  await client.send(
    new UpdateVirtualRouterCommand({
      meshName,
      virtualRouterName,
      spec: { listeners: [] },
    }),
  );

  const createdRoute = await client.send(
    new CreateRouteCommand({
      meshName,
      virtualRouterName,
      routeName,
      spec: {
        httpRoute: {
          match: { prefix: "/" },
          action: { weightedTargets: [] },
        },
      },
    }),
  );
  expect(createdRoute.route?.routeName).toBe(routeName);
  expect(createdRoute.route?.virtualRouterName).toBe(virtualRouterName);
  expect(createdRoute.route?.metadata?.arn).toBeDefined();

  const gotRoute = await client.send(
    new DescribeRouteCommand({ meshName, virtualRouterName, routeName }),
  );
  expect(gotRoute.route?.routeName).toBe(routeName);

  const listedRoutes = await client.send(
    new ListRoutesCommand({ meshName, virtualRouterName }),
  );
  expect((listedRoutes.routes ?? []).map((r) => r.routeName)).toContain(
    routeName,
  );

  await client.send(
    new UpdateRouteCommand({
      meshName,
      virtualRouterName,
      routeName,
      spec: {
        httpRoute: {
          match: { prefix: "/" },
          action: { weightedTargets: [] },
        },
      },
    }),
  );

  await client.send(
    new DeleteRouteCommand({ meshName, virtualRouterName, routeName }),
  );
  await expect(
    client.send(
      new DescribeRouteCommand({ meshName, virtualRouterName, routeName }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteVirtualRouterCommand({ meshName, virtualRouterName }),
  );
  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh virtual service roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;
  const virtualServiceName = `svc-${Date.now()}.local`;

  await client.send(new CreateMeshCommand({ meshName }));

  const created = await client.send(
    new CreateVirtualServiceCommand({
      meshName,
      virtualServiceName,
      spec: {},
    }),
  );
  expect(created.virtualService?.virtualServiceName).toBe(virtualServiceName);
  expect(created.virtualService?.metadata?.arn).toBeDefined();

  const got = await client.send(
    new DescribeVirtualServiceCommand({ meshName, virtualServiceName }),
  );
  expect(got.virtualService?.virtualServiceName).toBe(virtualServiceName);

  const listed = await client.send(
    new ListVirtualServicesCommand({ meshName }),
  );
  expect(
    (listed.virtualServices ?? []).map((s) => s.virtualServiceName),
  ).toContain(virtualServiceName);

  await client.send(
    new UpdateVirtualServiceCommand({
      meshName,
      virtualServiceName,
      spec: {},
    }),
  );

  await client.send(
    new DeleteVirtualServiceCommand({ meshName, virtualServiceName }),
  );
  await expect(
    client.send(
      new DescribeVirtualServiceCommand({ meshName, virtualServiceName }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh virtual gateway and gateway route roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;
  const virtualGatewayName = `gw-${Date.now()}`;
  const gatewayRouteName = `gwroute-${Date.now()}`;

  await client.send(new CreateMeshCommand({ meshName }));

  const createdVg = await client.send(
    new CreateVirtualGatewayCommand({
      meshName,
      virtualGatewayName,
      spec: {
        listeners: [{ portMapping: { port: 8080, protocol: "http" } }],
      },
    }),
  );
  expect(createdVg.virtualGateway?.virtualGatewayName).toBe(virtualGatewayName);
  expect(createdVg.virtualGateway?.metadata?.arn).toBeDefined();

  const gotVg = await client.send(
    new DescribeVirtualGatewayCommand({ meshName, virtualGatewayName }),
  );
  expect(gotVg.virtualGateway?.virtualGatewayName).toBe(virtualGatewayName);

  const listedVg = await client.send(
    new ListVirtualGatewaysCommand({ meshName }),
  );
  expect(
    (listedVg.virtualGateways ?? []).map((g) => g.virtualGatewayName),
  ).toContain(virtualGatewayName);

  await client.send(
    new UpdateVirtualGatewayCommand({
      meshName,
      virtualGatewayName,
      spec: {
        listeners: [{ portMapping: { port: 8080, protocol: "http" } }],
      },
    }),
  );

  const createdGwRoute = await client.send(
    new CreateGatewayRouteCommand({
      meshName,
      virtualGatewayName,
      gatewayRouteName,
      spec: {
        httpRoute: {
          match: { prefix: "/" },
          action: { target: { virtualService: { virtualServiceName: "svc" } } },
        },
      },
    }),
  );
  expect(createdGwRoute.gatewayRoute?.gatewayRouteName).toBe(gatewayRouteName);
  expect(createdGwRoute.gatewayRoute?.virtualGatewayName).toBe(
    virtualGatewayName,
  );
  expect(createdGwRoute.gatewayRoute?.metadata?.arn).toBeDefined();

  const gotGwRoute = await client.send(
    new DescribeGatewayRouteCommand({
      meshName,
      virtualGatewayName,
      gatewayRouteName,
    }),
  );
  expect(gotGwRoute.gatewayRoute?.gatewayRouteName).toBe(gatewayRouteName);

  const listedGwRoutes = await client.send(
    new ListGatewayRoutesCommand({ meshName, virtualGatewayName }),
  );
  expect(
    (listedGwRoutes.gatewayRoutes ?? []).map((r) => r.gatewayRouteName),
  ).toContain(gatewayRouteName);

  await client.send(
    new UpdateGatewayRouteCommand({
      meshName,
      virtualGatewayName,
      gatewayRouteName,
      spec: {
        httpRoute: {
          match: { prefix: "/" },
          action: { target: { virtualService: { virtualServiceName: "svc" } } },
        },
      },
    }),
  );

  await client.send(
    new DeleteGatewayRouteCommand({
      meshName,
      virtualGatewayName,
      gatewayRouteName,
    }),
  );
  await expect(
    client.send(
      new DescribeGatewayRouteCommand({
        meshName,
        virtualGatewayName,
        gatewayRouteName,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteVirtualGatewayCommand({ meshName, virtualGatewayName }),
  );
  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh tags roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(new CreateMeshCommand({ meshName }));
  const resourceArn = created.mesh?.metadata?.arn ?? "";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "platform" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.find((t) => t.key === "env")?.value).toBe("test");
  expect(listed.tags?.find((t) => t.key === "team")?.value).toBe("platform");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["team"] }),
  );
  const listed2 = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed2.tags?.find((t) => t.key === "team")).toBeUndefined();
  expect(listed2.tags?.find((t) => t.key === "env")?.value).toBe("test");

  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh list pagination", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;
  await client.send(new CreateMeshCommand({ meshName }));

  const names = ["alpha", "beta", "gamma"];
  for (const virtualNodeName of names) {
    await client.send(
      new CreateVirtualNodeCommand({
        meshName,
        virtualNodeName,
        spec: { listeners: [] },
      }),
    );
  }

  const page1 = await client.send(
    new ListVirtualNodesCommand({ meshName, limit: 2 }),
  );
  expect(page1.virtualNodes?.length).toBe(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListVirtualNodesCommand({
      meshName,
      limit: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect(page2.virtualNodes?.length).toBe(1);
  expect(page2.nextToken).toBeUndefined();

  const allNames = [
    ...(page1.virtualNodes ?? []),
    ...(page2.virtualNodes ?? []),
  ].map((n) => n.virtualNodeName);
  expect(allNames.sort()).toEqual(names.sort());

  for (const virtualNodeName of names) {
    await client.send(
      new DeleteVirtualNodeCommand({ meshName, virtualNodeName }),
    );
  }
  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh partial spec update preserves spec", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;

  await client.send(
    new CreateMeshCommand({
      meshName,
      spec: { egressFilter: { type: "DROP_ALL" } },
    }),
  );

  const upd = await client.send(new UpdateMeshCommand({ meshName }));
  expect(
    (upd.mesh?.spec as Record<string, unknown> | undefined)?.egressFilter,
  ).toBeDefined();

  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh delete clears tags", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(new CreateMeshCommand({ meshName }));
  const resourceArn = created.mesh?.metadata?.arn ?? "";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: [{ key: "env", value: "test" }],
    }),
  );
  const beforeDelete = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(beforeDelete.tags?.find((t) => t.key === "env")?.value).toBe("test");

  await client.send(new DeleteMeshCommand({ meshName }));

  const recreated = await client.send(new CreateMeshCommand({ meshName }));
  const newArn = recreated.mesh?.metadata?.arn ?? "";
  expect(newArn).toBe(resourceArn);

  const afterRecreate = await client.send(
    new ListTagsForResourceCommand({ resourceArn: newArn }),
  );
  expect(afterRecreate.tags?.find((t) => t.key === "env")).toBeUndefined();

  await client.send(new DeleteMeshCommand({ meshName }));
});

test("AppMesh CreateMesh tags initialized in storage", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateMeshCommand({
      meshName,
      tags: [{ key: "env", value: "prod" }],
    }),
  );
  const resourceArn = created.mesh?.metadata?.arn ?? "";

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.find((t) => t.key === "env")?.value).toBe("prod");

  await client.send(new DeleteMeshCommand({ meshName }));
});
