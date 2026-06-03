import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import directconnectModel from "../../../../test/vendor/aws-models/directconnect.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(directconnectModel);

type StoredConnection = {
  ownerAccount: string;
  connectionId: string;
  connectionName: string;
  connectionState: string;
  region: string;
  location: string;
  bandwidth: string;
  providerName?: string;
  jumboFrameCapable: boolean;
  hasLogicalRedundancy: string;
  macSecCapable: boolean;
};

const connectionKey = (id: string): string => `connection/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "DirectConnectClientException",
      `The value for ${key} is not valid.`,
      400,
    );
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const randomHex = (length: number): string => {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const requireConnection = (
  ctx: ServiceContext,
  connectionId: string,
): StoredConnection => {
  const connection = ctx.store.get<StoredConnection>(
    connectionKey(connectionId),
  );
  if (connection === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Connection with ID ${connectionId} not found.`,
      400,
    );
  }
  return connection;
};

const CreateConnection: OperationHandler = (input, ctx) => {
  const location = requireString(input, "location");
  const bandwidth = requireString(input, "bandwidth");
  const connectionName = requireString(input, "connectionName");
  const connectionId = `dxcon-${randomHex(8)}`;
  const connection: StoredConnection = {
    ownerAccount: ctx.account,
    connectionId,
    connectionName,
    connectionState: "available",
    region: ctx.region,
    location,
    bandwidth,
    providerName: optionalString(input, "providerName"),
    jumboFrameCapable: false,
    hasLogicalRedundancy: "unknown",
    macSecCapable: false,
  };
  ctx.store.set(connectionKey(connectionId), connection);
  return connection;
};

const DescribeConnections: OperationHandler = (input, ctx) => {
  const connectionId = optionalString(input, "connectionId");
  if (connectionId !== undefined) {
    const connection = requireConnection(ctx, connectionId);
    return { connections: [connection] };
  }
  const connections = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith("connection/"))
    .map((entry) => entry.value);
  return { connections };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const connection = requireConnection(ctx, connectionId);
  const deleted: StoredConnection = {
    ...connection,
    connectionState: "deleted",
  };
  ctx.store.delete(connectionKey(connectionId));
  return deleted;
};

const directconnect = {
  name: "directconnect",
  protocol: "json",
  operations: {
    CreateConnection,
    DescribeConnections,
    DeleteConnection,
  },
  model,
} as const satisfies ServiceDefinition;

export default directconnect;
