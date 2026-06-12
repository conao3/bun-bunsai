import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/appmesh.json", { with: { type: "json" } }),
);

const meshPrefix = "mesh:" as const;
const vnPrefix = "vn:" as const;
const vrPrefix = "vr:" as const;
const vsPrefix = "vs:" as const;
const vgPrefix = "vg:" as const;
const routePrefix = "route:" as const;
const gwRoutePrefix = "gwroute:" as const;
const tagsPrefix = "tags:" as const;

type StoredMesh = {
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type StoredVirtualNode = {
  virtualNodeName: string;
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type StoredVirtualRouter = {
  virtualRouterName: string;
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type StoredVirtualService = {
  virtualServiceName: string;
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type StoredVirtualGateway = {
  virtualGatewayName: string;
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type StoredRoute = {
  routeName: string;
  virtualRouterName: string;
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type StoredGatewayRoute = {
  gatewayRouteName: string;
  virtualGatewayName: string;
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  clientToken?: string;
};

type TagRecord = { key: string; value: string };

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asRecordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  limit: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize = typeof limit === "number" && limit > 0 ? limit : 100;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const meshKey = (name: string): string => `${meshPrefix}${name}`;

const vnKey = (meshName: string, name: string): string =>
  `${vnPrefix}${meshName}:${name}`;

const vrKey = (meshName: string, name: string): string =>
  `${vrPrefix}${meshName}:${name}`;

const vsKey = (meshName: string, name: string): string =>
  `${vsPrefix}${meshName}:${name}`;

const vgKey = (meshName: string, name: string): string =>
  `${vgPrefix}${meshName}:${name}`;

const routeKey = (
  meshName: string,
  vrName: string,
  routeName: string,
): string => `${routePrefix}${meshName}:${vrName}:${routeName}`;

const gwRouteKey = (
  meshName: string,
  vgName: string,
  gwRouteName: string,
): string => `${gwRoutePrefix}${meshName}:${vgName}:${gwRouteName}`;

const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const base = (ctx: ServiceContext): string =>
  `arn:aws:appmesh:${ctx.region}:${ctx.account}`;

const meshArn = (ctx: ServiceContext, name: string): string =>
  `${base(ctx)}:mesh/${name}`;

const vnArn = (ctx: ServiceContext, meshName: string, name: string): string =>
  `${base(ctx)}:mesh/${meshName}/virtualNode/${name}`;

const vrArn = (ctx: ServiceContext, meshName: string, name: string): string =>
  `${base(ctx)}:mesh/${meshName}/virtualRouter/${name}`;

const vsArn = (ctx: ServiceContext, meshName: string, name: string): string =>
  `${base(ctx)}:mesh/${meshName}/virtualService/${name}`;

const vgArn = (ctx: ServiceContext, meshName: string, name: string): string =>
  `${base(ctx)}:mesh/${meshName}/virtualGateway/${name}`;

const routeArn = (
  ctx: ServiceContext,
  meshName: string,
  vrName: string,
  routeName: string,
): string =>
  `${base(ctx)}:mesh/${meshName}/virtualRouter/${vrName}/route/${routeName}`;

const gwRouteArn = (
  ctx: ServiceContext,
  meshName: string,
  vgName: string,
  gwRouteName: string,
): string =>
  `${base(ctx)}:mesh/${meshName}/virtualGateway/${vgName}/gatewayRoute/${gwRouteName}`;

const metadata = (r: {
  arn: string;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  uid: string;
  version: number;
}): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  lastUpdatedAt: r.lastUpdatedAt,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  uid: r.uid,
  version: r.version,
});

const meshData = (mesh: StoredMesh): Record<string, unknown> => ({
  meshName: mesh.meshName,
  metadata: metadata(mesh),
  spec: mesh.spec,
  status: { status: "ACTIVE" },
});

const meshRef = (mesh: StoredMesh): Record<string, unknown> => ({
  arn: mesh.arn,
  createdAt: mesh.createdAt,
  lastUpdatedAt: mesh.lastUpdatedAt,
  meshName: mesh.meshName,
  meshOwner: mesh.owner,
  resourceOwner: mesh.owner,
  version: mesh.version,
});

const vnData = (r: StoredVirtualNode): Record<string, unknown> => ({
  meshName: r.meshName,
  metadata: metadata(r),
  spec: r.spec,
  status: { status: "ACTIVE" },
  virtualNodeName: r.virtualNodeName,
});

const vnRef = (r: StoredVirtualNode): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  lastUpdatedAt: r.lastUpdatedAt,
  meshName: r.meshName,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  version: r.version,
  virtualNodeName: r.virtualNodeName,
});

const vrData = (r: StoredVirtualRouter): Record<string, unknown> => ({
  meshName: r.meshName,
  metadata: metadata(r),
  spec: r.spec,
  status: { status: "ACTIVE" },
  virtualRouterName: r.virtualRouterName,
});

const vrRef = (r: StoredVirtualRouter): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  lastUpdatedAt: r.lastUpdatedAt,
  meshName: r.meshName,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  version: r.version,
  virtualRouterName: r.virtualRouterName,
});

const vsData = (r: StoredVirtualService): Record<string, unknown> => ({
  meshName: r.meshName,
  metadata: metadata(r),
  spec: r.spec,
  status: { status: "ACTIVE" },
  virtualServiceName: r.virtualServiceName,
});

const vsRef = (r: StoredVirtualService): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  lastUpdatedAt: r.lastUpdatedAt,
  meshName: r.meshName,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  version: r.version,
  virtualServiceName: r.virtualServiceName,
});

const vgData = (r: StoredVirtualGateway): Record<string, unknown> => ({
  meshName: r.meshName,
  metadata: metadata(r),
  spec: r.spec,
  status: { status: "ACTIVE" },
  virtualGatewayName: r.virtualGatewayName,
});

const vgRef = (r: StoredVirtualGateway): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  lastUpdatedAt: r.lastUpdatedAt,
  meshName: r.meshName,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  version: r.version,
  virtualGatewayName: r.virtualGatewayName,
});

const routeData = (r: StoredRoute): Record<string, unknown> => ({
  meshName: r.meshName,
  metadata: metadata(r),
  routeName: r.routeName,
  spec: r.spec,
  status: { status: "ACTIVE" },
  virtualRouterName: r.virtualRouterName,
});

const routeRef = (r: StoredRoute): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  lastUpdatedAt: r.lastUpdatedAt,
  meshName: r.meshName,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  routeName: r.routeName,
  version: r.version,
  virtualRouterName: r.virtualRouterName,
});

const gwRouteData = (r: StoredGatewayRoute): Record<string, unknown> => ({
  gatewayRouteName: r.gatewayRouteName,
  meshName: r.meshName,
  metadata: metadata(r),
  spec: r.spec,
  status: { status: "ACTIVE" },
  virtualGatewayName: r.virtualGatewayName,
});

const gwRouteRef = (r: StoredGatewayRoute): Record<string, unknown> => ({
  arn: r.arn,
  createdAt: r.createdAt,
  gatewayRouteName: r.gatewayRouteName,
  lastUpdatedAt: r.lastUpdatedAt,
  meshName: r.meshName,
  meshOwner: r.owner,
  resourceOwner: r.owner,
  version: r.version,
  virtualGatewayName: r.virtualGatewayName,
});

const requireMesh = (ctx: ServiceContext, name: string): StoredMesh => {
  const stored = ctx.store.get<StoredMesh>(meshKey(name));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Mesh ${name} does not exist.`, 404);
  }
  return stored;
};

const requireVn = (
  ctx: ServiceContext,
  meshName: string,
  name: string,
): StoredVirtualNode => {
  const stored = ctx.store.get<StoredVirtualNode>(vnKey(meshName, name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Virtual node ${name} in mesh ${meshName} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireVr = (
  ctx: ServiceContext,
  meshName: string,
  name: string,
): StoredVirtualRouter => {
  const stored = ctx.store.get<StoredVirtualRouter>(vrKey(meshName, name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Virtual router ${name} in mesh ${meshName} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireVs = (
  ctx: ServiceContext,
  meshName: string,
  name: string,
): StoredVirtualService => {
  const stored = ctx.store.get<StoredVirtualService>(vsKey(meshName, name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Virtual service ${name} in mesh ${meshName} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireVg = (
  ctx: ServiceContext,
  meshName: string,
  name: string,
): StoredVirtualGateway => {
  const stored = ctx.store.get<StoredVirtualGateway>(vgKey(meshName, name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Virtual gateway ${name} in mesh ${meshName} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireRoute = (
  ctx: ServiceContext,
  meshName: string,
  vrName: string,
  routeName: string,
): StoredRoute => {
  const stored = ctx.store.get<StoredRoute>(
    routeKey(meshName, vrName, routeName),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Route ${routeName} in virtual router ${vrName} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireGwRoute = (
  ctx: ServiceContext,
  meshName: string,
  vgName: string,
  gwRouteName: string,
): StoredGatewayRoute => {
  const stored = ctx.store.get<StoredGatewayRoute>(
    gwRouteKey(meshName, vgName, gwRouteName),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Gateway route ${gwRouteName} in virtual gateway ${vgName} does not exist.`,
      404,
    );
  }
  return stored;
};

const CreateMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredMesh>(meshKey(meshName));
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { mesh: meshData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Mesh ${meshName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const mesh: StoredMesh = {
    meshName,
    arn: meshArn(ctx, meshName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(meshKey(meshName), mesh);
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(mesh.arn), initialTags);
  }
  return { mesh: meshData(mesh) };
};

const DescribeMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  return { mesh: meshData(requireMesh(ctx, meshName)) };
};

const UpdateMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const mesh = requireMesh(ctx, meshName);
  const now = nowSeconds();
  const updated: StoredMesh = {
    ...mesh,
    spec: asRecordOrUndefined(input["spec"]) ?? mesh.spec,
    version: mesh.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(meshKey(meshName), updated);
  return { mesh: meshData(updated) };
};

const ListMeshes: OperationHandler = (input, ctx) => {
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const all = ctx.store
    .list<StoredMesh>()
    .filter((entry) => entry.key.startsWith(meshPrefix))
    .map((entry) => entry.value)
    .filter((m) => meshOwner === undefined || m.owner === meshOwner)
    .sort((a, b) =>
      a.meshName < b.meshName ? -1 : a.meshName > b.meshName ? 1 : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { meshes: items.map(meshRef), nextToken };
};

const DeleteMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const mesh = requireMesh(ctx, meshName);
  const childPrefixes = [
    `${vnPrefix}${meshName}:`,
    `${vrPrefix}${meshName}:`,
    `${vsPrefix}${meshName}:`,
    `${vgPrefix}${meshName}:`,
    `${routePrefix}${meshName}:`,
    `${gwRoutePrefix}${meshName}:`,
  ];
  const hasChildren = ctx.store
    .list()
    .some((e) => childPrefixes.some((p) => e.key.startsWith(p)));
  if (hasChildren) {
    throw awsError(
      "ResourceInUseException",
      `Mesh ${meshName} still has active resources.`,
      409,
    );
  }
  ctx.store.delete(meshKey(meshName));
  ctx.store.delete(tagsKey(mesh.arn));
  return { mesh: meshData(mesh) };
};

const CreateVirtualNode: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const virtualNodeName = requireString(input, "virtualNodeName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredVirtualNode>(
    vnKey(meshName, virtualNodeName),
  );
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { virtualNode: vnData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Virtual node ${virtualNodeName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rec: StoredVirtualNode = {
    virtualNodeName,
    meshName,
    arn: vnArn(ctx, meshName, virtualNodeName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(vnKey(meshName, virtualNodeName), rec);
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(rec.arn), initialTags);
  }
  return { virtualNode: vnData(rec) };
};

const DescribeVirtualNode: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualNodeName = requireString(input, "virtualNodeName");
  return { virtualNode: vnData(requireVn(ctx, meshName, virtualNodeName)) };
};

const UpdateVirtualNode: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualNodeName = requireString(input, "virtualNodeName");
  const rec = requireVn(ctx, meshName, virtualNodeName);
  const now = nowSeconds();
  const updated: StoredVirtualNode = {
    ...rec,
    spec: asRecordOrUndefined(input["spec"]) ?? rec.spec,
    version: rec.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(vnKey(meshName, virtualNodeName), updated);
  return { virtualNode: vnData(updated) };
};

const ListVirtualNodes: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const prefix = `${vnPrefix}${meshName}:`;
  const all = ctx.store
    .list<StoredVirtualNode>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((r) => meshOwner === undefined || r.owner === meshOwner)
    .sort((a, b) =>
      a.virtualNodeName < b.virtualNodeName
        ? -1
        : a.virtualNodeName > b.virtualNodeName
          ? 1
          : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { virtualNodes: items.map(vnRef), nextToken };
};

const DeleteVirtualNode: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualNodeName = requireString(input, "virtualNodeName");
  const rec = requireVn(ctx, meshName, virtualNodeName);
  const vsStorePrefix = `${vsPrefix}${meshName}:`;
  const inUse = ctx.store
    .list<StoredVirtualService>()
    .filter((e) => e.key.startsWith(vsStorePrefix))
    .some((e) => {
      const provider = asRecordOrUndefined(e.value.spec["provider"]);
      const vnRef =
        provider !== undefined
          ? asRecordOrUndefined(provider["virtualNode"])
          : undefined;
      return (
        vnRef !== undefined &&
        stringOrUndefined(vnRef["virtualNodeName"]) === virtualNodeName
      );
    });
  if (inUse) {
    throw awsError(
      "ResourceInUseException",
      `Virtual node ${virtualNodeName} is referenced by a virtual service.`,
      409,
    );
  }
  ctx.store.delete(vnKey(meshName, virtualNodeName));
  ctx.store.delete(tagsKey(rec.arn));
  return { virtualNode: vnData(rec) };
};

const CreateVirtualRouter: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const virtualRouterName = requireString(input, "virtualRouterName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredVirtualRouter>(
    vrKey(meshName, virtualRouterName),
  );
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { virtualRouter: vrData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Virtual router ${virtualRouterName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rec: StoredVirtualRouter = {
    virtualRouterName,
    meshName,
    arn: vrArn(ctx, meshName, virtualRouterName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(vrKey(meshName, virtualRouterName), rec);
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(rec.arn), initialTags);
  }
  return { virtualRouter: vrData(rec) };
};

const DescribeVirtualRouter: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  return {
    virtualRouter: vrData(requireVr(ctx, meshName, virtualRouterName)),
  };
};

const UpdateVirtualRouter: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  const rec = requireVr(ctx, meshName, virtualRouterName);
  const now = nowSeconds();
  const updated: StoredVirtualRouter = {
    ...rec,
    spec: asRecordOrUndefined(input["spec"]) ?? rec.spec,
    version: rec.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(vrKey(meshName, virtualRouterName), updated);
  return { virtualRouter: vrData(updated) };
};

const ListVirtualRouters: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const prefix = `${vrPrefix}${meshName}:`;
  const all = ctx.store
    .list<StoredVirtualRouter>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((r) => meshOwner === undefined || r.owner === meshOwner)
    .sort((a, b) =>
      a.virtualRouterName < b.virtualRouterName
        ? -1
        : a.virtualRouterName > b.virtualRouterName
          ? 1
          : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { virtualRouters: items.map(vrRef), nextToken };
};

const DeleteVirtualRouter: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  const rec = requireVr(ctx, meshName, virtualRouterName);
  const routeStorePrefix = `${routePrefix}${meshName}:${virtualRouterName}:`;
  if (ctx.store.list().some((e) => e.key.startsWith(routeStorePrefix))) {
    throw awsError(
      "ResourceInUseException",
      `Virtual router ${virtualRouterName} still has active routes.`,
      409,
    );
  }
  ctx.store.delete(vrKey(meshName, virtualRouterName));
  ctx.store.delete(tagsKey(rec.arn));
  return { virtualRouter: vrData(rec) };
};

const CreateRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const virtualRouterName = requireString(input, "virtualRouterName");
  requireVr(ctx, meshName, virtualRouterName);
  const routeName = requireString(input, "routeName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredRoute>(
    routeKey(meshName, virtualRouterName, routeName),
  );
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { route: routeData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Route ${routeName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rec: StoredRoute = {
    routeName,
    virtualRouterName,
    meshName,
    arn: routeArn(ctx, meshName, virtualRouterName, routeName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(routeKey(meshName, virtualRouterName, routeName), rec);
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(rec.arn), initialTags);
  }
  return { route: routeData(rec) };
};

const DescribeRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  const routeName = requireString(input, "routeName");
  return {
    route: routeData(requireRoute(ctx, meshName, virtualRouterName, routeName)),
  };
};

const UpdateRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  const routeName = requireString(input, "routeName");
  const rec = requireRoute(ctx, meshName, virtualRouterName, routeName);
  const now = nowSeconds();
  const updated: StoredRoute = {
    ...rec,
    spec: asRecordOrUndefined(input["spec"]) ?? rec.spec,
    version: rec.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(routeKey(meshName, virtualRouterName, routeName), updated);
  return { route: routeData(updated) };
};

const ListRoutes: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  requireMesh(ctx, meshName);
  requireVr(ctx, meshName, virtualRouterName);
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const prefix = `${routePrefix}${meshName}:${virtualRouterName}:`;
  const all = ctx.store
    .list<StoredRoute>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((r) => meshOwner === undefined || r.owner === meshOwner)
    .sort((a, b) =>
      a.routeName < b.routeName ? -1 : a.routeName > b.routeName ? 1 : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { routes: items.map(routeRef), nextToken };
};

const DeleteRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualRouterName = requireString(input, "virtualRouterName");
  const routeName = requireString(input, "routeName");
  const rec = requireRoute(ctx, meshName, virtualRouterName, routeName);
  ctx.store.delete(routeKey(meshName, virtualRouterName, routeName));
  ctx.store.delete(tagsKey(rec.arn));
  return { route: routeData(rec) };
};

const CreateVirtualService: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const virtualServiceName = requireString(input, "virtualServiceName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredVirtualService>(
    vsKey(meshName, virtualServiceName),
  );
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { virtualService: vsData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Virtual service ${virtualServiceName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rec: StoredVirtualService = {
    virtualServiceName,
    meshName,
    arn: vsArn(ctx, meshName, virtualServiceName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(vsKey(meshName, virtualServiceName), rec);
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(rec.arn), initialTags);
  }
  return { virtualService: vsData(rec) };
};

const DescribeVirtualService: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualServiceName = requireString(input, "virtualServiceName");
  return {
    virtualService: vsData(requireVs(ctx, meshName, virtualServiceName)),
  };
};

const UpdateVirtualService: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualServiceName = requireString(input, "virtualServiceName");
  const rec = requireVs(ctx, meshName, virtualServiceName);
  const now = nowSeconds();
  const updated: StoredVirtualService = {
    ...rec,
    spec: asRecordOrUndefined(input["spec"]) ?? rec.spec,
    version: rec.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(vsKey(meshName, virtualServiceName), updated);
  return { virtualService: vsData(updated) };
};

const ListVirtualServices: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const prefix = `${vsPrefix}${meshName}:`;
  const all = ctx.store
    .list<StoredVirtualService>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((r) => meshOwner === undefined || r.owner === meshOwner)
    .sort((a, b) =>
      a.virtualServiceName < b.virtualServiceName
        ? -1
        : a.virtualServiceName > b.virtualServiceName
          ? 1
          : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { virtualServices: items.map(vsRef), nextToken };
};

const DeleteVirtualService: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualServiceName = requireString(input, "virtualServiceName");
  const rec = requireVs(ctx, meshName, virtualServiceName);
  ctx.store.delete(vsKey(meshName, virtualServiceName));
  ctx.store.delete(tagsKey(rec.arn));
  return { virtualService: vsData(rec) };
};

const CreateVirtualGateway: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredVirtualGateway>(
    vgKey(meshName, virtualGatewayName),
  );
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { virtualGateway: vgData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Virtual gateway ${virtualGatewayName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rec: StoredVirtualGateway = {
    virtualGatewayName,
    meshName,
    arn: vgArn(ctx, meshName, virtualGatewayName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(vgKey(meshName, virtualGatewayName), rec);
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(rec.arn), initialTags);
  }
  return { virtualGateway: vgData(rec) };
};

const DescribeVirtualGateway: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  return {
    virtualGateway: vgData(requireVg(ctx, meshName, virtualGatewayName)),
  };
};

const UpdateVirtualGateway: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  const rec = requireVg(ctx, meshName, virtualGatewayName);
  const now = nowSeconds();
  const updated: StoredVirtualGateway = {
    ...rec,
    spec: asRecordOrUndefined(input["spec"]) ?? rec.spec,
    version: rec.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(vgKey(meshName, virtualGatewayName), updated);
  return { virtualGateway: vgData(updated) };
};

const ListVirtualGateways: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const prefix = `${vgPrefix}${meshName}:`;
  const all = ctx.store
    .list<StoredVirtualGateway>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((r) => meshOwner === undefined || r.owner === meshOwner)
    .sort((a, b) =>
      a.virtualGatewayName < b.virtualGatewayName
        ? -1
        : a.virtualGatewayName > b.virtualGatewayName
          ? 1
          : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { virtualGateways: items.map(vgRef), nextToken };
};

const DeleteVirtualGateway: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  const rec = requireVg(ctx, meshName, virtualGatewayName);
  const gwRouteStorePrefix = `${gwRoutePrefix}${meshName}:${virtualGatewayName}:`;
  if (ctx.store.list().some((e) => e.key.startsWith(gwRouteStorePrefix))) {
    throw awsError(
      "ResourceInUseException",
      `Virtual gateway ${virtualGatewayName} still has active gateway routes.`,
      409,
    );
  }
  ctx.store.delete(vgKey(meshName, virtualGatewayName));
  ctx.store.delete(tagsKey(rec.arn));
  return { virtualGateway: vgData(rec) };
};

const CreateGatewayRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  requireMesh(ctx, meshName);
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  requireVg(ctx, meshName, virtualGatewayName);
  const gatewayRouteName = requireString(input, "gatewayRouteName");
  const clientToken = stringOrUndefined(input["clientToken"]);
  const existing = ctx.store.get<StoredGatewayRoute>(
    gwRouteKey(meshName, virtualGatewayName, gatewayRouteName),
  );
  if (existing !== undefined) {
    if (clientToken !== undefined && clientToken === existing.clientToken) {
      return { gatewayRoute: gwRouteData(existing) };
    }
    throw awsError(
      "ConflictException",
      `Gateway route ${gatewayRouteName} already exists.`,
      409,
    );
  }
  const now = nowSeconds();
  const rec: StoredGatewayRoute = {
    gatewayRouteName,
    virtualGatewayName,
    meshName,
    arn: gwRouteArn(ctx, meshName, virtualGatewayName, gatewayRouteName),
    uid: crypto.randomUUID(),
    version: 1,
    createdAt: now,
    lastUpdatedAt: now,
    owner: ctx.account,
    spec: asRecord(input["spec"]),
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(
    gwRouteKey(meshName, virtualGatewayName, gatewayRouteName),
    rec,
  );
  const initialTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  if (initialTags.length > 0) {
    ctx.store.set(tagsKey(rec.arn), initialTags);
  }
  return { gatewayRoute: gwRouteData(rec) };
};

const DescribeGatewayRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  const gatewayRouteName = requireString(input, "gatewayRouteName");
  return {
    gatewayRoute: gwRouteData(
      requireGwRoute(ctx, meshName, virtualGatewayName, gatewayRouteName),
    ),
  };
};

const UpdateGatewayRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  const gatewayRouteName = requireString(input, "gatewayRouteName");
  const rec = requireGwRoute(
    ctx,
    meshName,
    virtualGatewayName,
    gatewayRouteName,
  );
  const now = nowSeconds();
  const updated: StoredGatewayRoute = {
    ...rec,
    spec: asRecordOrUndefined(input["spec"]) ?? rec.spec,
    version: rec.version + 1,
    lastUpdatedAt: now,
  };
  ctx.store.set(
    gwRouteKey(meshName, virtualGatewayName, gatewayRouteName),
    updated,
  );
  return { gatewayRoute: gwRouteData(updated) };
};

const ListGatewayRoutes: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  requireMesh(ctx, meshName);
  requireVg(ctx, meshName, virtualGatewayName);
  const meshOwner = stringOrUndefined(input["meshOwner"]);
  const prefix = `${gwRoutePrefix}${meshName}:${virtualGatewayName}:`;
  const all = ctx.store
    .list<StoredGatewayRoute>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((r) => meshOwner === undefined || r.owner === meshOwner)
    .sort((a, b) =>
      a.gatewayRouteName < b.gatewayRouteName
        ? -1
        : a.gatewayRouteName > b.gatewayRouteName
          ? 1
          : 0,
    );
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["limit"],
  );
  return { gatewayRoutes: items.map(gwRouteRef), nextToken };
};

const DeleteGatewayRoute: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const virtualGatewayName = requireString(input, "virtualGatewayName");
  const gatewayRouteName = requireString(input, "gatewayRouteName");
  const rec = requireGwRoute(
    ctx,
    meshName,
    virtualGatewayName,
    gatewayRouteName,
  );
  ctx.store.delete(gwRouteKey(meshName, virtualGatewayName, gatewayRouteName));
  ctx.store.delete(tagsKey(rec.arn));
  return { gatewayRoute: gwRouteData(rec) };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<TagRecord[]>(tagsKey(resourceArn)) ?? [];
  const { items, nextToken } = paginateList(
    tags,
    input["nextToken"],
    input["limit"],
  );
  return { tags: items, nextToken };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = arrayOrEmpty(input["tags"]) as TagRecord[];
  const existing = ctx.store.get<TagRecord[]>(tagsKey(resourceArn)) ?? [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.key === tag.key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = arrayOrEmpty(input["tagKeys"]) as string[];
  const existing = ctx.store.get<TagRecord[]>(tagsKey(resourceArn)) ?? [];
  const filtered = existing.filter((t) => !tagKeys.includes(t.key));
  ctx.store.set(tagsKey(resourceArn), filtered);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const appmesh = {
  name: "appmesh",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;

    if (parts[0] !== "v20190125") return undefined;

    if (parts.length === 2) {
      if (parts[1] === "tags" && m === "GET") return "ListTagsForResource";
      if (parts[1] === "tag" && m === "PUT") return "TagResource";
      if (parts[1] === "untag" && m === "PUT") return "UntagResource";
    }

    if (parts[1] !== "meshes") return undefined;

    if (parts.length === 2) {
      if (m === "PUT") return "CreateMesh";
      if (m === "GET") return "ListMeshes";
      return undefined;
    }
    if (parts.length === 3) {
      if (m === "GET") return "DescribeMesh";
      if (m === "PUT") return "UpdateMesh";
      if (m === "DELETE") return "DeleteMesh";
      return undefined;
    }
    if (parts.length === 4) {
      switch (parts[3]) {
        case "virtualNodes":
          if (m === "PUT") return "CreateVirtualNode";
          if (m === "GET") return "ListVirtualNodes";
          return undefined;
        case "virtualRouters":
          if (m === "PUT") return "CreateVirtualRouter";
          if (m === "GET") return "ListVirtualRouters";
          return undefined;
        case "virtualServices":
          if (m === "PUT") return "CreateVirtualService";
          if (m === "GET") return "ListVirtualServices";
          return undefined;
        case "virtualGateways":
          if (m === "PUT") return "CreateVirtualGateway";
          if (m === "GET") return "ListVirtualGateways";
          return undefined;
      }
      return undefined;
    }
    if (parts.length === 5) {
      switch (parts[3]) {
        case "virtualNodes":
          if (m === "GET") return "DescribeVirtualNode";
          if (m === "PUT") return "UpdateVirtualNode";
          if (m === "DELETE") return "DeleteVirtualNode";
          return undefined;
        case "virtualRouters":
          if (m === "GET") return "DescribeVirtualRouter";
          if (m === "PUT") return "UpdateVirtualRouter";
          if (m === "DELETE") return "DeleteVirtualRouter";
          return undefined;
        case "virtualServices":
          if (m === "GET") return "DescribeVirtualService";
          if (m === "PUT") return "UpdateVirtualService";
          if (m === "DELETE") return "DeleteVirtualService";
          return undefined;
        case "virtualGateways":
          if (m === "GET") return "DescribeVirtualGateway";
          if (m === "PUT") return "UpdateVirtualGateway";
          if (m === "DELETE") return "DeleteVirtualGateway";
          return undefined;
      }
      return undefined;
    }
    if (parts.length === 6) {
      if (parts[3] === "virtualRouter" && parts[5] === "routes") {
        if (m === "PUT") return "CreateRoute";
        if (m === "GET") return "ListRoutes";
        return undefined;
      }
      if (parts[3] === "virtualGateway" && parts[5] === "gatewayRoutes") {
        if (m === "PUT") return "CreateGatewayRoute";
        if (m === "GET") return "ListGatewayRoutes";
        return undefined;
      }
      return undefined;
    }
    if (parts.length === 7) {
      if (parts[3] === "virtualRouter" && parts[5] === "routes") {
        if (m === "GET") return "DescribeRoute";
        if (m === "PUT") return "UpdateRoute";
        if (m === "DELETE") return "DeleteRoute";
        return undefined;
      }
      if (parts[3] === "virtualGateway" && parts[5] === "gatewayRoutes") {
        if (m === "GET") return "DescribeGatewayRoute";
        if (m === "PUT") return "UpdateGatewayRoute";
        if (m === "DELETE") return "DeleteGatewayRoute";
        return undefined;
      }
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateMesh,
    DescribeMesh,
    UpdateMesh,
    ListMeshes,
    DeleteMesh,
    CreateVirtualNode,
    DescribeVirtualNode,
    UpdateVirtualNode,
    ListVirtualNodes,
    DeleteVirtualNode,
    CreateVirtualRouter,
    DescribeVirtualRouter,
    UpdateVirtualRouter,
    ListVirtualRouters,
    DeleteVirtualRouter,
    CreateRoute,
    DescribeRoute,
    UpdateRoute,
    ListRoutes,
    DeleteRoute,
    CreateVirtualService,
    DescribeVirtualService,
    UpdateVirtualService,
    ListVirtualServices,
    DeleteVirtualService,
    CreateVirtualGateway,
    DescribeVirtualGateway,
    UpdateVirtualGateway,
    ListVirtualGateways,
    DeleteVirtualGateway,
    CreateGatewayRoute,
    DescribeGatewayRoute,
    UpdateGatewayRoute,
    ListGatewayRoutes,
    DeleteGatewayRoute,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default appmesh;
