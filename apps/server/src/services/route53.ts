import type {
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import route53Model from "../../../../test/vendor/aws-models/route53.json" with { type: "json" };

const model = loadServiceModel(route53Model);

type ResourceRecord = {
  Value: string;
};

type ResourceRecordSet = {
  Name: string;
  Type: string;
  TTL?: number;
  ResourceRecords?: ResourceRecord[];
};

type HostedZone = {
  id: string;
  name: string;
  callerReference: string;
  comment?: string;
  privateZone: boolean;
  recordSets: ResourceRecordSet[];
};

type HealthCheck = {
  id: string;
  callerReference: string;
  version: number;
  config: Record<string, unknown>;
};

const apiPrefix = "/2013-04-01/hostedzone";
const countPath = "/2013-04-01/hostedzonecount";
const healthPrefix = "/2013-04-01/healthcheck";
const healthKeyPrefix = "hc-";

const zoneIdFromPath = (path: string): string | undefined => {
  if (!path.startsWith(apiPrefix)) return undefined;
  const rest = path.slice(apiPrefix.length);
  if (rest === "" || rest === "/") return undefined;
  const trimmed = rest.startsWith("/") ? rest.slice(1) : rest;
  const segment = trimmed.split("/")[0];
  if (segment === "") return undefined;
  return decodeURIComponent(segment);
};

const stripPrefix = (raw: unknown): string | undefined => {
  if (typeof raw !== "string" || raw === "") return undefined;
  const slash = raw.lastIndexOf("/");
  return slash === -1 ? raw : raw.slice(slash + 1);
};

const generateId = (): string => {
  let out = "Z";
  for (let i = 0; i < 14; i += 1) {
    out += "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[
      Math.floor(Math.random() * 36)
    ];
  }
  return out;
};

const nameServers = [
  "ns-1.bunsai-dns.org",
  "ns-2.bunsai-dns.co.uk",
  "ns-3.bunsai-dns.com",
  "ns-4.bunsai-dns.net",
] as const;

const getZone = (ctx: ServiceContext, id: string): HostedZone => {
  const zone = ctx.store.get<HostedZone>(id);
  if (zone === undefined) {
    throw awsError(
      "NoSuchHostedZone",
      `No hosted zone found with ID: ${id}`,
      404,
    );
  }
  return zone;
};

const recordSetKey = (set: ResourceRecordSet): string =>
  `${set.Name.toLowerCase()}|${set.Type}`;

const toRecordSet = (raw: unknown): ResourceRecordSet => {
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  const name = typeof record["Name"] === "string" ? record["Name"] : "";
  const type = typeof record["Type"] === "string" ? record["Type"] : "";
  const rawTtl = record["TTL"];
  const rawRecords = record["ResourceRecords"];
  const resourceRecords = Array.isArray(rawRecords)
    ? rawRecords.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null) return [];
        const value = (entry as Record<string, unknown>)["Value"];
        if (typeof value !== "string") return [];
        return [{ Value: value }];
      })
    : undefined;
  const set: ResourceRecordSet = { Name: name, Type: type };
  if (typeof rawTtl === "number") set.TTL = rawTtl;
  else if (typeof rawTtl === "string" && rawTtl !== "")
    set.TTL = Number(rawTtl);
  if (resourceRecords !== undefined) set.ResourceRecords = resourceRecords;
  return set;
};

const changeInfo = (id: string) => ({
  Id: `/change/${id}`,
  Status: "INSYNC",
  SubmittedAt: Math.floor(Date.now() / 1000),
});

const hostedZoneView = (zone: HostedZone) => ({
  Id: `/hostedzone/${zone.id}`,
  Name: zone.name,
  CallerReference: zone.callerReference,
  Config: {
    Comment: zone.comment,
    PrivateZone: zone.privateZone,
  },
  ResourceRecordSetCount: zone.recordSets.length,
});

const listZones = (ctx: ServiceContext): HostedZone[] =>
  ctx.store
    .list<HostedZone>()
    .filter((entry) => !entry.key.startsWith(healthKeyPrefix))
    .map((entry) => entry.value);

const generateHealthCheckId = (): string => {
  let out = "";
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
      continue;
    }
    out += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  }
  return out;
};

const getHealthCheck = (ctx: ServiceContext, id: string): HealthCheck => {
  const check = ctx.store.get<HealthCheck>(`${healthKeyPrefix}${id}`);
  if (check === undefined) {
    throw awsError(
      "NoSuchHealthCheck",
      `No health check exists with ID ${id}`,
      404,
    );
  }
  return check;
};

const healthCheckView = (check: HealthCheck) => ({
  Id: check.id,
  CallerReference: check.callerReference,
  HealthCheckVersion: check.version,
  HealthCheckConfig: check.config,
});

const route53: ServiceDefinition = {
  name: "route53",
  protocol: "rest-xml",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.path.replace(/\/$/, "") === countPath) {
      if (req.method === "GET") return "GetHostedZoneCount";
      return undefined;
    }
    if (req.path.startsWith(healthPrefix)) {
      const rest = req.path.slice(healthPrefix.length).replace(/\/$/, "");
      const isCollection = rest === "";
      if (isCollection) {
        if (req.method === "POST") return "CreateHealthCheck";
        if (req.method === "GET") return "ListHealthChecks";
        return undefined;
      }
      if (req.method === "GET") return "GetHealthCheck";
      if (req.method === "DELETE") return "DeleteHealthCheck";
      return undefined;
    }
    if (!req.path.startsWith(apiPrefix)) return undefined;
    const rest = req.path.slice(apiPrefix.length).replace(/\/$/, "");
    const isCollection = rest === "";
    const hasRrset = rest.endsWith("/rrset");
    if (isCollection) {
      if (req.method === "POST") return "CreateHostedZone";
      if (req.method === "GET") return "ListHostedZones";
      return undefined;
    }
    if (hasRrset) {
      if (req.method === "POST") return "ChangeResourceRecordSets";
      if (req.method === "GET") return "ListResourceRecordSets";
      return undefined;
    }
    if (req.method === "GET") return "GetHostedZone";
    if (req.method === "DELETE") return "DeleteHostedZone";
    return undefined;
  },
  operations: {
    CreateHostedZone: (input, ctx) => {
      const name = input["Name"];
      const callerReference = input["CallerReference"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidDomainName", "Name is required", 400);
      }
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidInput", "CallerReference is required", 400);
      }
      const config = input["HostedZoneConfig"];
      const configRecord = (
        typeof config === "object" && config !== null ? config : {}
      ) as Record<string, unknown>;
      const id = generateId();
      const zone: HostedZone = {
        id,
        name: name.endsWith(".") ? name : `${name}.`,
        callerReference,
        comment:
          typeof configRecord["Comment"] === "string"
            ? configRecord["Comment"]
            : undefined,
        privateZone: configRecord["PrivateZone"] === true,
        recordSets: [
          {
            Name: name.endsWith(".") ? name : `${name}.`,
            Type: "NS",
            TTL: 172800,
            ResourceRecords: nameServers.map((ns) => ({ Value: ns })),
          },
          {
            Name: name.endsWith(".") ? name : `${name}.`,
            Type: "SOA",
            TTL: 900,
            ResourceRecords: [
              {
                Value: `${nameServers[0]}. hostmaster.bunsai. 1 7200 900 1209600 86400`,
              },
            ],
          },
        ],
      };
      ctx.store.set<HostedZone>(id, zone);
      return {
        HostedZone: hostedZoneView(zone),
        ChangeInfo: changeInfo(id),
        DelegationSet: { NameServers: [...nameServers] },
        Location: `https://route53.amazonaws.com${apiPrefix}/${id}`,
      };
    },
    GetHostedZone: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const zone = getZone(ctx, id);
      return {
        HostedZone: hostedZoneView(zone),
        DelegationSet: { NameServers: [...nameServers] },
      };
    },
    ListHostedZones: (_input, ctx) => {
      const zones = listZones(ctx);
      return {
        HostedZones: zones.map((zone) => hostedZoneView(zone)),
        Marker: "",
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    DeleteHostedZone: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      ctx.store.delete(id);
      return { ChangeInfo: changeInfo(id) };
    },
    ChangeResourceRecordSets: (input, ctx) => {
      const id = stripPrefix(input["HostedZoneId"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      const zone = getZone(ctx, id);
      const batch = input["ChangeBatch"];
      const batchRecord = (
        typeof batch === "object" && batch !== null ? batch : {}
      ) as Record<string, unknown>;
      const rawChanges = batchRecord["Changes"];
      const changes = Array.isArray(rawChanges) ? rawChanges : [];
      let recordSets = zone.recordSets;
      for (const change of changes) {
        if (typeof change !== "object" || change === null) continue;
        const record = change as Record<string, unknown>;
        const action = record["Action"];
        const set = toRecordSet(record["ResourceRecordSet"]);
        const key = recordSetKey(set);
        const without = recordSets.filter((s) => recordSetKey(s) !== key);
        if (action === "DELETE") {
          recordSets = without;
        } else if (action === "CREATE" || action === "UPSERT") {
          recordSets = [...without, set];
        }
      }
      ctx.store.set<HostedZone>(id, { ...zone, recordSets });
      return { ChangeInfo: changeInfo(id) };
    },
    ListResourceRecordSets: (input, ctx) => {
      const id = stripPrefix(input["HostedZoneId"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      const zone = getZone(ctx, id);
      const sorted = [...zone.recordSets].sort((a, b) =>
        a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : a.Type < b.Type ? -1 : 1,
      );
      return {
        ResourceRecordSets: sorted.map((set) => ({
          Name: set.Name,
          Type: set.Type,
          ...(set.TTL !== undefined ? { TTL: set.TTL } : {}),
          ...(set.ResourceRecords !== undefined
            ? {
                ResourceRecords: set.ResourceRecords.map((r) => ({
                  Value: r.Value,
                })),
              }
            : {}),
        })),
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    GetHostedZoneCount: (_input, ctx) => ({
      HostedZoneCount: listZones(ctx).length,
    }),
    CreateHealthCheck: (input, ctx) => {
      const callerReference = input["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidInput", "CallerReference is required", 400);
      }
      const rawConfig = input["HealthCheckConfig"];
      if (typeof rawConfig !== "object" || rawConfig === null) {
        throw awsError("InvalidInput", "HealthCheckConfig is required", 400);
      }
      const config = rawConfig as Record<string, unknown>;
      if (typeof config["Type"] !== "string" || config["Type"] === "") {
        throw awsError(
          "InvalidInput",
          "HealthCheckConfig.Type is required",
          400,
        );
      }
      const existing = ctx.store
        .list<HealthCheck>()
        .filter((entry) => entry.key.startsWith(healthKeyPrefix))
        .find((entry) => entry.value.callerReference === callerReference);
      if (existing !== undefined) {
        throw awsError(
          "HealthCheckAlreadyExists",
          `A health check with CallerReference ${callerReference} already exists`,
          409,
        );
      }
      const id = generateHealthCheckId();
      const check: HealthCheck = {
        id,
        callerReference,
        version: 1,
        config,
      };
      ctx.store.set<HealthCheck>(`${healthKeyPrefix}${id}`, check);
      return {
        HealthCheck: healthCheckView(check),
        Location: `https://route53.amazonaws.com${healthPrefix}/${id}`,
      };
    },
    GetHealthCheck: (input, ctx) => {
      const id = input["HealthCheckId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "HealthCheckId is required", 400);
      }
      const check = getHealthCheck(ctx, id);
      return { HealthCheck: healthCheckView(check) };
    },
    ListHealthChecks: (_input, ctx) => {
      const checks = ctx.store
        .list<HealthCheck>()
        .filter((entry) => entry.key.startsWith(healthKeyPrefix))
        .map((entry) => entry.value);
      return {
        HealthChecks: checks.map((check) => healthCheckView(check)),
        Marker: "",
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    DeleteHealthCheck: (input, ctx) => {
      const id = input["HealthCheckId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "HealthCheckId is required", 400);
      }
      getHealthCheck(ctx, id);
      ctx.store.delete(`${healthKeyPrefix}${id}`);
      return {};
    },
  },
  model,
};

export default route53;
