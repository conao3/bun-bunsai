import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import appmeshModel from "../../../../test/vendor/aws-models/appmesh.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(appmeshModel);

const meshPrefix = "mesh:" as const;

type StoredMesh = {
  meshName: string;
  arn: string;
  uid: string;
  version: number;
  createdAt: number;
  lastUpdatedAt: number;
  owner: string;
  spec: Record<string, unknown>;
  tags: unknown[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const meshArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appmesh:${ctx.region}:${ctx.account}:mesh/${name}`;

const meshData = (mesh: StoredMesh): Record<string, unknown> => ({
  meshName: mesh.meshName,
  metadata: {
    arn: mesh.arn,
    createdAt: mesh.createdAt,
    lastUpdatedAt: mesh.lastUpdatedAt,
    meshOwner: mesh.owner,
    resourceOwner: mesh.owner,
    uid: mesh.uid,
    version: mesh.version,
  },
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

const requireMesh = (ctx: ServiceContext, name: string): StoredMesh => {
  const stored = ctx.store.get<StoredMesh>(meshKey(name));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Mesh ${name} does not exist.`, 404);
  }
  return stored;
};

const CreateMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  if (ctx.store.get<StoredMesh>(meshKey(meshName)) !== undefined) {
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
    tags: arrayOrEmpty(input["tags"]),
  };
  ctx.store.set(meshKey(meshName), mesh);
  return { mesh: meshData(mesh) };
};

const DescribeMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  return { mesh: meshData(requireMesh(ctx, meshName)) };
};

const ListMeshes: OperationHandler = (input, ctx) => {
  const limit = numberOrUndefined(input["limit"]) ?? 100;
  const meshes = ctx.store
    .list<StoredMesh>()
    .filter((entry) => entry.key.startsWith(meshPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.meshName < b.meshName ? -1 : a.meshName > b.meshName ? 1 : 0,
    );
  return { meshes: meshes.slice(0, limit).map(meshRef) };
};

const DeleteMesh: OperationHandler = (input, ctx) => {
  const meshName = requireString(input, "meshName");
  const mesh = requireMesh(ctx, meshName);
  ctx.store.delete(meshKey(meshName));
  return { mesh: meshData(mesh) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const appmesh = {
  name: "appmesh",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v20190125" || parts[1] !== "meshes") return undefined;
    if (parts.length === 2) {
      if (req.method === "PUT") return "CreateMesh";
      if (req.method === "GET") return "ListMeshes";
      return undefined;
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "DescribeMesh";
      if (req.method === "DELETE") return "DeleteMesh";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateMesh,
    DescribeMesh,
    ListMeshes,
    DeleteMesh,
  },
  model,
} as const satisfies ServiceDefinition;

export default appmesh;
