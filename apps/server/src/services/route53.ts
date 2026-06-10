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

type AliasTarget = {
  HostedZoneId: string;
  DNSName: string;
  EvaluateTargetHealth: boolean;
};

type GeoLocation = {
  ContinentCode?: string;
  CountryCode?: string;
  SubdivisionCode?: string;
};

type ResourceRecordSet = {
  Name: string;
  Type: string;
  TTL?: number;
  ResourceRecords?: ResourceRecord[];
  AliasTarget?: AliasTarget;
  SetIdentifier?: string;
  Weight?: number;
  Failover?: string;
  GeoLocation?: GeoLocation;
  Region?: string;
  MultiValueAnswer?: boolean;
  HealthCheckId?: string;
};

type HostedZone = {
  id: string;
  name: string;
  callerReference: string;
  comment?: string;
  privateZone: boolean;
  recordSets: ResourceRecordSet[];
  delegationSetId?: string;
};

type HealthCheck = {
  id: string;
  callerReference: string;
  version: number;
  config: Record<string, unknown>;
};

type TrafficPolicy = {
  id: string;
  name: string;
  document: string;
  type: string;
  comment?: string;
  latestVersion: number;
};

type TrafficPolicyVersion = {
  id: string;
  version: number;
  document: string;
  type: string;
  comment?: string;
};

type TrafficPolicyInstance = {
  id: string;
  hostedZoneId: string;
  name: string;
  ttl: number;
  state: string;
  message: string;
  trafficPolicyId: string;
  trafficPolicyType: string;
  trafficPolicyVersion: number;
};

type ReusableDelegationSet = {
  id: string;
  callerReference: string;
  nameServers: string[];
};

type CidrCollection = {
  id: string;
  name: string;
  version: number;
  arn: string;
  locations: Record<string, string[]>;
};

type QueryLoggingConfig = {
  id: string;
  hostedZoneId: string;
  cloudWatchLogsLogGroupArn: string;
};

type KeySigningKey = {
  name: string;
  kmsArn: string;
  status: string;
  createdDate: number;
  lastModifiedDate: number;
};

type VPC = {
  VPCRegion: string;
  VPCId: string;
};

const apiPrefix = "/2013-04-01/hostedzone";
const healthPrefix = "/2013-04-01/healthcheck";
const healthKeyPrefix = "hc-";
const tpPrefix = "tp-";
const tpvPrefix = "tpv-";
const tpiPrefix = "tpi-";
const rdsPrefix = "rds-";
const cidrPrefix = "cidr-";
const qlcPrefix = "qlc-";
const kskPrefix = "ksk-";
const tagPrefix = "tag-";
const vpcAssocPrefix = "vpcassoc-";
const vpcAuthPrefix = "vpcauth-";
const dnssecPrefix = "dnssec-";

const generateId = (): string => {
  let out = "Z";
  for (let i = 0; i < 14; i += 1) {
    out += "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[
      Math.floor(Math.random() * 36)
    ];
  }
  return out;
};

const generateUUID = (): string => {
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

const generateHealthCheckId = generateUUID;

const nameServers = [
  "ns-1.bunsai-dns.org",
  "ns-2.bunsai-dns.co.uk",
  "ns-3.bunsai-dns.com",
  "ns-4.bunsai-dns.net",
] as const;

const stripPrefix = (raw: unknown): string | undefined => {
  if (typeof raw !== "string" || raw === "") return undefined;
  const slash = raw.lastIndexOf("/");
  return slash === -1 ? raw : raw.slice(slash + 1);
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
    .filter(
      (entry) =>
        !entry.key.startsWith(healthKeyPrefix) &&
        !entry.key.startsWith(tpPrefix) &&
        !entry.key.startsWith(tpvPrefix) &&
        !entry.key.startsWith(tpiPrefix) &&
        !entry.key.startsWith(rdsPrefix) &&
        !entry.key.startsWith(cidrPrefix) &&
        !entry.key.startsWith(qlcPrefix) &&
        !entry.key.startsWith(kskPrefix) &&
        !entry.key.startsWith(tagPrefix) &&
        !entry.key.startsWith(vpcAssocPrefix) &&
        !entry.key.startsWith(vpcAuthPrefix) &&
        !entry.key.startsWith(dnssecPrefix),
    )
    .map((entry) => entry.value);

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
  `${set.Name.toLowerCase()}|${set.Type}|${set.SetIdentifier ?? ""}`;

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
  const rawAlias = record["AliasTarget"];
  const aliasRec =
    typeof rawAlias === "object" && rawAlias !== null
      ? (rawAlias as Record<string, unknown>)
      : undefined;
  const aliasTarget: AliasTarget | undefined = aliasRec
    ? {
        HostedZoneId:
          typeof aliasRec["HostedZoneId"] === "string"
            ? aliasRec["HostedZoneId"]
            : "",
        DNSName:
          typeof aliasRec["DNSName"] === "string" ? aliasRec["DNSName"] : "",
        EvaluateTargetHealth: aliasRec["EvaluateTargetHealth"] === true,
      }
    : undefined;
  const rawGeo = record["GeoLocation"];
  const geoRec =
    typeof rawGeo === "object" && rawGeo !== null
      ? (rawGeo as Record<string, unknown>)
      : undefined;
  const geoLocation: GeoLocation | undefined = geoRec
    ? {
        ...(typeof geoRec["ContinentCode"] === "string"
          ? { ContinentCode: geoRec["ContinentCode"] }
          : {}),
        ...(typeof geoRec["CountryCode"] === "string"
          ? { CountryCode: geoRec["CountryCode"] }
          : {}),
        ...(typeof geoRec["SubdivisionCode"] === "string"
          ? { SubdivisionCode: geoRec["SubdivisionCode"] }
          : {}),
      }
    : undefined;
  const set: ResourceRecordSet = { Name: name, Type: type };
  if (typeof rawTtl === "number") set.TTL = rawTtl;
  else if (typeof rawTtl === "string" && rawTtl !== "")
    set.TTL = Number(rawTtl);
  if (resourceRecords !== undefined) set.ResourceRecords = resourceRecords;
  if (aliasTarget !== undefined) set.AliasTarget = aliasTarget;
  if (typeof record["SetIdentifier"] === "string")
    set.SetIdentifier = record["SetIdentifier"];
  if (typeof record["Weight"] === "number") set.Weight = record["Weight"];
  else if (typeof record["Weight"] === "string" && record["Weight"] !== "")
    set.Weight = Number(record["Weight"]);
  if (typeof record["Failover"] === "string") set.Failover = record["Failover"];
  if (geoLocation !== undefined) set.GeoLocation = geoLocation;
  if (typeof record["Region"] === "string") set.Region = record["Region"];
  if (typeof record["MultiValueAnswer"] === "boolean")
    set.MultiValueAnswer = record["MultiValueAnswer"];
  if (typeof record["HealthCheckId"] === "string")
    set.HealthCheckId = record["HealthCheckId"];
  return set;
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

const getTrafficPolicy = (ctx: ServiceContext, id: string): TrafficPolicy => {
  const tp = ctx.store.get<TrafficPolicy>(`${tpPrefix}${id}`);
  if (tp === undefined) {
    throw awsError(
      "NoSuchTrafficPolicy",
      `No traffic policy found with ID: ${id}`,
      404,
    );
  }
  return tp;
};

const getTrafficPolicyVersion = (
  ctx: ServiceContext,
  id: string,
  version: number,
): TrafficPolicyVersion => {
  const tpv = ctx.store.get<TrafficPolicyVersion>(
    `${tpvPrefix}${id}-${version}`,
  );
  if (tpv === undefined) {
    throw awsError(
      "NoSuchTrafficPolicy",
      `No traffic policy found with ID: ${id} version: ${version}`,
      404,
    );
  }
  return tpv;
};

const trafficPolicyView = (tpv: TrafficPolicyVersion) => ({
  Id: tpv.id,
  Version: tpv.version,
  Name: tpv.id,
  Type: tpv.type,
  Document: tpv.document,
  Comment: tpv.comment,
});

const getTrafficPolicyInstance = (
  ctx: ServiceContext,
  id: string,
): TrafficPolicyInstance => {
  const tpi = ctx.store.get<TrafficPolicyInstance>(`${tpiPrefix}${id}`);
  if (tpi === undefined) {
    throw awsError(
      "NoSuchTrafficPolicyInstance",
      `No traffic policy instance found with ID: ${id}`,
      404,
    );
  }
  return tpi;
};

const trafficPolicyInstanceView = (tpi: TrafficPolicyInstance) => ({
  Id: tpi.id,
  HostedZoneId: tpi.hostedZoneId,
  Name: tpi.name,
  TTL: tpi.ttl,
  State: tpi.state,
  Message: tpi.message,
  TrafficPolicyId: tpi.trafficPolicyId,
  TrafficPolicyType: tpi.trafficPolicyType,
  TrafficPolicyVersion: tpi.trafficPolicyVersion,
});

const getReusableDelegationSet = (
  ctx: ServiceContext,
  id: string,
): ReusableDelegationSet => {
  const rds = ctx.store.get<ReusableDelegationSet>(`${rdsPrefix}${id}`);
  if (rds === undefined) {
    throw awsError(
      "NoSuchDelegationSet",
      `No delegation set found with ID: ${id}`,
      404,
    );
  }
  return rds;
};

const delegationSetView = (rds: ReusableDelegationSet) => ({
  Id: `/delegationset/${rds.id}`,
  CallerReference: rds.callerReference,
  NameServers: rds.nameServers,
});

const getCidrCollection = (ctx: ServiceContext, id: string): CidrCollection => {
  const cidr = ctx.store.get<CidrCollection>(`${cidrPrefix}${id}`);
  if (cidr === undefined) {
    throw awsError(
      "NoSuchCidrCollectionException",
      `No CIDR collection found with ID: ${id}`,
      404,
    );
  }
  return cidr;
};

const cidrCollectionView = (c: CidrCollection) => ({
  Arn: c.arn,
  Id: c.id,
  Name: c.name,
  Version: c.version,
});

const getQueryLoggingConfig = (
  ctx: ServiceContext,
  id: string,
): QueryLoggingConfig => {
  const qlc = ctx.store.get<QueryLoggingConfig>(`${qlcPrefix}${id}`);
  if (qlc === undefined) {
    throw awsError(
      "NoSuchQueryLoggingConfig",
      `No query logging config found with ID: ${id}`,
      404,
    );
  }
  return qlc;
};

const queryLoggingConfigView = (q: QueryLoggingConfig) => ({
  Id: q.id,
  HostedZoneId: q.hostedZoneId,
  CloudWatchLogsLogGroupArn: q.cloudWatchLogsLogGroupArn,
});

const getKeySigningKey = (
  ctx: ServiceContext,
  hostedZoneId: string,
  name: string,
): KeySigningKey => {
  const ksk = ctx.store.get<KeySigningKey>(
    `${kskPrefix}${hostedZoneId}-${name}`,
  );
  if (ksk === undefined) {
    throw awsError(
      "NoSuchKeySigningKey",
      `No key signing key found with name: ${name}`,
      404,
    );
  }
  return ksk;
};

const keySigningKeyView = (ksk: KeySigningKey) => ({
  Name: ksk.name,
  KmsArn: ksk.kmsArn,
  Flag: 257,
  SigningAlgorithmMnemonic: "ECDSAP256SHA256",
  SigningAlgorithmType: 13,
  DigestAlgorithmMnemonic: "SHA-256",
  DigestAlgorithmType: 2,
  KeyTag: 12345,
  DigestValue: "digest-placeholder",
  PublicKey: "public-key-placeholder",
  DSRecord: "ds-record-placeholder",
  DNSKEYRecord: "dnskey-record-placeholder",
  Status: ksk.status,
  StatusMessage: "",
  CreatedDate: ksk.createdDate,
  LastModifiedDate: ksk.lastModifiedDate,
});

const getTags = (
  ctx: ServiceContext,
  type: string,
  id: string,
): Record<string, string> =>
  ctx.store.get<Record<string, string>>(`${tagPrefix}${type}-${id}`) ?? {};

const geoLocations = [
  { ContinentCode: "AF", ContinentName: "Africa" },
  { ContinentCode: "AN", ContinentName: "Antarctica" },
  { ContinentCode: "AS", ContinentName: "Asia" },
  { ContinentCode: "EU", ContinentName: "Europe" },
  { ContinentCode: "OC", ContinentName: "Oceania" },
  { ContinentCode: "NA", ContinentName: "North America" },
  { ContinentCode: "SA", ContinentName: "South America" },
] as const;

const route53: ServiceDefinition = {
  name: "route53",
  protocol: "rest-xml",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const p = req.path.replace(/\/$/, "");
    const m = req.method;

    if (p === "/2013-04-01/checkeripranges")
      return m === "GET" ? "GetCheckerIpRanges" : undefined;
    if (p === "/2013-04-01/geolocation")
      return m === "GET" ? "GetGeoLocation" : undefined;
    if (p === "/2013-04-01/geolocations")
      return m === "GET" ? "ListGeoLocations" : undefined;
    if (p === "/2013-04-01/testdnsanswer")
      return m === "GET" ? "TestDNSAnswer" : undefined;
    if (p === "/2013-04-01/trafficpolicyinstancecount")
      return m === "GET" ? "GetTrafficPolicyInstanceCount" : undefined;
    if (p === "/2013-04-01/trafficpolicyinstances/hostedzone")
      return m === "GET" ? "ListTrafficPolicyInstancesByHostedZone" : undefined;
    if (p === "/2013-04-01/trafficpolicyinstances/trafficpolicy")
      return m === "GET" ? "ListTrafficPolicyInstancesByPolicy" : undefined;
    if (p === "/2013-04-01/trafficpolicyinstances")
      return m === "GET" ? "ListTrafficPolicyInstances" : undefined;
    if (p === "/2013-04-01/trafficpolicies")
      return m === "GET" ? "ListTrafficPolicies" : undefined;

    if (p === "/2013-04-01/healthcheckcount")
      return m === "GET" ? "GetHealthCheckCount" : undefined;
    if (p === "/2013-04-01/hostedzonecount")
      return m === "GET" ? "GetHostedZoneCount" : undefined;
    if (p === "/2013-04-01/hostedzonesbyname")
      return m === "GET" ? "ListHostedZonesByName" : undefined;
    if (p === "/2013-04-01/hostedzonesbyvpc")
      return m === "GET" ? "ListHostedZonesByVPC" : undefined;

    if (p.startsWith("/2013-04-01/hostedzonelimit/"))
      return m === "GET" ? "GetHostedZoneLimit" : undefined;
    if (p.startsWith("/2013-04-01/reusabledelegationsetlimit/"))
      return m === "GET" ? "GetReusableDelegationSetLimit" : undefined;
    if (p.startsWith("/2013-04-01/accountlimit/"))
      return m === "GET" ? "GetAccountLimit" : undefined;
    if (p.startsWith("/2013-04-01/change/"))
      return m === "GET" ? "GetChange" : undefined;

    if (p.startsWith("/2013-04-01/healthcheck")) {
      const rest = p.slice("/2013-04-01/healthcheck".length);
      if (rest === "") {
        if (m === "POST") return "CreateHealthCheck";
        if (m === "GET") return "ListHealthChecks";
        return undefined;
      }
      const parts = rest.slice(1).split("/");
      if (parts.length === 1) {
        if (m === "GET") return "GetHealthCheck";
        if (m === "DELETE") return "DeleteHealthCheck";
        if (m === "POST") return "UpdateHealthCheck";
        return undefined;
      }
      if (parts[1] === "lastfailurereason" && m === "GET")
        return "GetHealthCheckLastFailureReason";
      if (parts[1] === "status" && m === "GET") return "GetHealthCheckStatus";
      return undefined;
    }

    if (p.startsWith("/2013-04-01/hostedzone")) {
      const rest = p.slice("/2013-04-01/hostedzone".length);
      if (rest === "") {
        if (m === "POST") return "CreateHostedZone";
        if (m === "GET") return "ListHostedZones";
        return undefined;
      }
      const parts = rest.slice(1).split("/");
      if (parts.length === 1) {
        if (m === "GET") return "GetHostedZone";
        if (m === "DELETE") return "DeleteHostedZone";
        if (m === "POST") return "UpdateHostedZoneComment";
        return undefined;
      }
      const sub = parts[1];
      if (sub === "rrset") {
        if (m === "POST") return "ChangeResourceRecordSets";
        if (m === "GET") return "ListResourceRecordSets";
        return undefined;
      }
      if (sub === "associatevpc")
        return m === "POST" ? "AssociateVPCWithHostedZone" : undefined;
      if (sub === "disassociatevpc")
        return m === "POST" ? "DisassociateVPCFromHostedZone" : undefined;
      if (sub === "authorizevpcassociation") {
        if (m === "POST") return "CreateVPCAssociationAuthorization";
        if (m === "GET") return "ListVPCAssociationAuthorizations";
        return undefined;
      }
      if (sub === "deauthorizevpcassociation")
        return m === "POST" ? "DeleteVPCAssociationAuthorization" : undefined;
      if (sub === "dnssec") return m === "GET" ? "GetDNSSEC" : undefined;
      if (sub === "enable-dnssec")
        return m === "POST" ? "EnableHostedZoneDNSSEC" : undefined;
      if (sub === "disable-dnssec")
        return m === "POST" ? "DisableHostedZoneDNSSEC" : undefined;
      if (sub === "features")
        return m === "POST" ? "UpdateHostedZoneFeatures" : undefined;
      return undefined;
    }

    if (p.startsWith("/2013-04-01/trafficpolicyinstance")) {
      const rest = p.slice("/2013-04-01/trafficpolicyinstance".length);
      if (rest === "") {
        return m === "POST" ? "CreateTrafficPolicyInstance" : undefined;
      }
      if (m === "GET") return "GetTrafficPolicyInstance";
      if (m === "DELETE") return "DeleteTrafficPolicyInstance";
      if (m === "POST") return "UpdateTrafficPolicyInstance";
      return undefined;
    }

    if (p.startsWith("/2013-04-01/trafficpolicies/")) {
      return m === "GET" ? "ListTrafficPolicyVersions" : undefined;
    }

    if (p.startsWith("/2013-04-01/trafficpolicy")) {
      const rest = p.slice("/2013-04-01/trafficpolicy".length);
      if (rest === "") {
        return m === "POST" ? "CreateTrafficPolicy" : undefined;
      }
      const parts = rest.slice(1).split("/");
      if (parts.length === 1) {
        return m === "POST" ? "CreateTrafficPolicyVersion" : undefined;
      }
      if (parts.length >= 2) {
        if (m === "GET") return "GetTrafficPolicy";
        if (m === "DELETE") return "DeleteTrafficPolicy";
        if (m === "POST") return "UpdateTrafficPolicyComment";
        return undefined;
      }
      return undefined;
    }

    if (p.startsWith("/2013-04-01/delegationset")) {
      const rest = p.slice("/2013-04-01/delegationset".length);
      if (rest === "") {
        if (m === "POST") return "CreateReusableDelegationSet";
        if (m === "GET") return "ListReusableDelegationSets";
        return undefined;
      }
      if (m === "GET") return "GetReusableDelegationSet";
      if (m === "DELETE") return "DeleteReusableDelegationSet";
      return undefined;
    }

    if (p.startsWith("/2013-04-01/cidrcollection")) {
      const rest = p.slice("/2013-04-01/cidrcollection".length);
      if (rest === "") {
        if (m === "POST") return "CreateCidrCollection";
        if (m === "GET") return "ListCidrCollections";
        return undefined;
      }
      const parts = rest.slice(1).split("/");
      if (parts.length === 1) {
        if (m === "GET") return "ListCidrLocations";
        if (m === "POST") return "ChangeCidrCollection";
        if (m === "DELETE") return "DeleteCidrCollection";
        return undefined;
      }
      if (parts.length === 2 && parts[1] === "cidrblocks") {
        return m === "GET" ? "ListCidrBlocks" : undefined;
      }
      return undefined;
    }

    if (p.startsWith("/2013-04-01/queryloggingconfig")) {
      const rest = p.slice("/2013-04-01/queryloggingconfig".length);
      if (rest === "") {
        if (m === "POST") return "CreateQueryLoggingConfig";
        if (m === "GET") return "ListQueryLoggingConfigs";
        return undefined;
      }
      if (m === "GET") return "GetQueryLoggingConfig";
      if (m === "DELETE") return "DeleteQueryLoggingConfig";
      return undefined;
    }

    if (p.startsWith("/2013-04-01/keysigningkey")) {
      const rest = p.slice("/2013-04-01/keysigningkey".length);
      if (rest === "") {
        return m === "POST" ? "CreateKeySigningKey" : undefined;
      }
      const parts = rest.slice(1).split("/");
      if (parts.length === 2) {
        return m === "DELETE" ? "DeleteKeySigningKey" : undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "activate")
          return m === "POST" ? "ActivateKeySigningKey" : undefined;
        if (parts[2] === "deactivate")
          return m === "POST" ? "DeactivateKeySigningKey" : undefined;
      }
      return undefined;
    }

    if (p.startsWith("/2013-04-01/tags/")) {
      const rest = p.slice("/2013-04-01/tags/".length);
      const parts = rest.split("/");
      if (parts.length === 1) {
        return m === "POST" ? "ListTagsForResources" : undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "ListTagsForResource";
        if (m === "POST") return "ChangeTagsForResource";
        return undefined;
      }
      return undefined;
    }

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
      const existing = listZones(ctx).find(
        (z) => z.callerReference === callerReference,
      );
      if (existing !== undefined) {
        return {
          HostedZone: hostedZoneView(existing),
          ChangeInfo: changeInfo(existing.id),
          DelegationSet: { NameServers: [...nameServers] },
          Location: `https://route53.amazonaws.com${apiPrefix}/${existing.id}`,
        };
      }
      const rawDelegationSetId = input["DelegationSetId"];
      const delegationSetId = stripPrefix(rawDelegationSetId);
      const delegationSet =
        delegationSetId !== undefined
          ? getReusableDelegationSet(ctx, delegationSetId)
          : undefined;
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
            ResourceRecords: (delegationSet?.nameServers ?? nameServers).map(
              (ns) => ({ Value: ns }),
            ),
          },
          {
            Name: name.endsWith(".") ? name : `${name}.`,
            Type: "SOA",
            TTL: 900,
            ResourceRecords: [
              {
                Value: `${(delegationSet?.nameServers ?? nameServers)[0]}. hostmaster.bunsai. 1 7200 900 1209600 86400`,
              },
            ],
          },
        ],
        delegationSetId,
      };
      ctx.store.set<HostedZone>(id, zone);
      return {
        HostedZone: hostedZoneView(zone),
        ChangeInfo: changeInfo(id),
        DelegationSet: {
          NameServers: delegationSet?.nameServers ?? [...nameServers],
          ...(delegationSet !== undefined
            ? { Id: `/delegationset/${delegationSet.id}` }
            : {}),
        },
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
    ListHostedZones: (input, ctx) => {
      let zones = listZones(ctx);
      const filterDelegationSetId = stripPrefix(input["DelegationSetId"]);
      if (filterDelegationSetId !== undefined) {
        getReusableDelegationSet(ctx, filterDelegationSetId);
        zones = zones.filter((z) => z.delegationSetId === filterDelegationSetId);
      }
      const hostedZoneType = input["HostedZoneType"];
      if (hostedZoneType === "PrivateHostedZone") {
        zones = zones.filter((z) => z.privateZone);
      }
      const marker = typeof input["Marker"] === "string" ? input["Marker"] : "";
      const maxItemsRaw = input["MaxItems"];
      const maxItems =
        typeof maxItemsRaw === "number"
          ? Math.max(1, maxItemsRaw)
          : typeof maxItemsRaw === "string" && maxItemsRaw !== ""
            ? Math.max(1, parseInt(maxItemsRaw, 10) || 100)
            : 100;
      const startIndex =
        marker === ""
          ? 0
          : zones.findIndex((z) => z.id === marker);
      const sliced =
        startIndex === -1 ? [] : zones.slice(startIndex, startIndex + maxItems);
      const isTruncated =
        startIndex !== -1 && startIndex + maxItems < zones.length;
      const nextMarker = isTruncated
        ? zones[startIndex + maxItems]?.id
        : undefined;
      const result: Record<string, unknown> = {
        HostedZones: sliced.map((zone) => hostedZoneView(zone)),
        Marker: marker,
        IsTruncated: isTruncated,
        MaxItems: String(maxItems),
      };
      if (nextMarker !== undefined) {
        result["NextMarker"] = nextMarker;
      }
      return result;
    },
    DeleteHostedZone: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const zone = getZone(ctx, id);
      if (zone.recordSets.length > 2) {
        throw awsError(
          "HostedZoneNotEmpty",
          "The hosted zone contains resource records that must be deleted before the zone itself can be deleted.",
          400,
        );
      }
      ctx.store.delete(id);
      return { ChangeInfo: changeInfo(id) };
    },
    UpdateHostedZoneComment: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const zone = getZone(ctx, id);
      const comment = input["Comment"];
      const updated: HostedZone = {
        ...zone,
        comment: typeof comment === "string" ? comment : zone.comment,
      };
      ctx.store.set<HostedZone>(id, updated);
      return { HostedZone: hostedZoneView(updated) };
    },
    UpdateHostedZoneFeatures: (input, ctx) => {
      const id = stripPrefix(input["HostedZoneId"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      getZone(ctx, id);
      return {};
    },
    GetHostedZoneCount: (_input, ctx) => ({
      HostedZoneCount: listZones(ctx).length,
    }),
    GetHostedZoneLimit: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      const type = input["Type"];
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      return {
        Limit: { Type: type, Value: 10000 },
        Count: 0,
      };
    },
    ListHostedZonesByName: (_input, ctx) => {
      const zones = listZones(ctx);
      const sorted = [...zones].sort((a, b) => a.name.localeCompare(b.name));
      return {
        HostedZones: sorted.map((zone) => hostedZoneView(zone)),
        DNSName: "",
        HostedZoneId: "",
        IsTruncated: false,
        NextDNSName: "",
        NextHostedZoneId: "",
        MaxItems: "100",
      };
    },
    ListHostedZonesByVPC: (_input, ctx) => {
      const zones = listZones(ctx);
      return {
        HostedZoneSummaries: zones.map((zone) => ({
          HostedZoneId: `/hostedzone/${zone.id}`,
          Name: zone.name,
          Owner: { OwningAccount: ctx.account },
        })),
        MaxItems: "100",
        NextToken: "",
      };
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
      const parsedChanges = changes
        .filter((c) => typeof c === "object" && c !== null)
        .map((c) => {
          const record = c as Record<string, unknown>;
          return {
            action: record["Action"],
            set: toRecordSet(record["ResourceRecordSet"]),
          };
        });
      const existingKeys = new Set(zone.recordSets.map(recordSetKey));
      for (const { action, set } of parsedChanges) {
        const key = recordSetKey(set);
        if (action === "CREATE" && existingKeys.has(key)) {
          throw awsError(
            "InvalidChangeBatch",
            `[RRSet of type ${set.Type} with DNS name ${set.Name} is not permitted because a conflicting resource record set already exists]`,
            400,
          );
        }
        if (action === "DELETE" && !existingKeys.has(key)) {
          throw awsError(
            "InvalidChangeBatch",
            `[Tried to delete resource record set ${set.Name} but it was not found]`,
            400,
          );
        }
      }
      let recordSets = zone.recordSets;
      for (const { action, set } of parsedChanges) {
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
      const sorted = [...zone.recordSets].sort((a, b) => {
        if (a.Name < b.Name) return -1;
        if (a.Name > b.Name) return 1;
        if (a.Type < b.Type) return -1;
        if (a.Type > b.Type) return 1;
        const ai = a.SetIdentifier ?? "";
        const bi = b.SetIdentifier ?? "";
        return ai < bi ? -1 : ai > bi ? 1 : 0;
      });
      const startName =
        typeof input["StartRecordName"] === "string"
          ? input["StartRecordName"]
          : undefined;
      const startType =
        typeof input["StartRecordType"] === "string"
          ? input["StartRecordType"]
          : undefined;
      const startIdentifier =
        typeof input["StartRecordIdentifier"] === "string"
          ? input["StartRecordIdentifier"]
          : undefined;
      const maxItems =
        input["MaxItems"] !== undefined
          ? Math.min(Math.max(1, Number(input["MaxItems"])), 300)
          : 300;
      let startIdx = 0;
      if (startName !== undefined) {
        const normalizedStart = startName.endsWith(".")
          ? startName
          : `${startName}.`;
        startIdx = sorted.findIndex((s) => {
          if (s.Name < normalizedStart) return false;
          if (s.Name > normalizedStart) return true;
          if (startType === undefined) return true;
          if (s.Type < startType) return false;
          if (s.Type > startType) return true;
          if (startIdentifier === undefined) return true;
          return (s.SetIdentifier ?? "") >= startIdentifier;
        });
        if (startIdx === -1) startIdx = sorted.length;
      }
      const page = sorted.slice(startIdx, startIdx + maxItems);
      const isTruncated = startIdx + maxItems < sorted.length;
      const toView = (set: (typeof sorted)[0]) => ({
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
        ...(set.AliasTarget !== undefined
          ? { AliasTarget: set.AliasTarget }
          : {}),
        ...(set.SetIdentifier !== undefined
          ? { SetIdentifier: set.SetIdentifier }
          : {}),
        ...(set.Weight !== undefined ? { Weight: set.Weight } : {}),
        ...(set.Failover !== undefined ? { Failover: set.Failover } : {}),
        ...(set.GeoLocation !== undefined
          ? { GeoLocation: set.GeoLocation }
          : {}),
        ...(set.Region !== undefined ? { Region: set.Region } : {}),
        ...(set.MultiValueAnswer !== undefined
          ? { MultiValueAnswer: set.MultiValueAnswer }
          : {}),
        ...(set.HealthCheckId !== undefined
          ? { HealthCheckId: set.HealthCheckId }
          : {}),
      });
      const next = isTruncated ? sorted[startIdx + maxItems] : undefined;
      return {
        ResourceRecordSets: page.map(toView),
        IsTruncated: isTruncated,
        MaxItems: String(maxItems),
        ...(next !== undefined
          ? {
              NextRecordName: next.Name,
              NextRecordType: next.Type,
              ...(next.SetIdentifier !== undefined
                ? { NextRecordIdentifier: next.SetIdentifier }
                : {}),
            }
          : {}),
      };
    },
    AssociateVPCWithHostedZone: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      const vpcRaw = input["VPC"];
      const vpcRec = (
        typeof vpcRaw === "object" && vpcRaw !== null ? vpcRaw : {}
      ) as Record<string, unknown>;
      const vpc: VPC = {
        VPCRegion:
          typeof vpcRec["VPCRegion"] === "string" ? vpcRec["VPCRegion"] : "",
        VPCId: typeof vpcRec["VPCId"] === "string" ? vpcRec["VPCId"] : "",
      };
      const existing = ctx.store.get<VPC[]>(`${vpcAssocPrefix}${id}`) ?? [];
      if (!existing.find((v) => v.VPCId === vpc.VPCId)) {
        ctx.store.set<VPC[]>(`${vpcAssocPrefix}${id}`, [...existing, vpc]);
      }
      return { ChangeInfo: changeInfo(id) };
    },
    DisassociateVPCFromHostedZone: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      const vpcRaw = input["VPC"];
      const vpcRec = (
        typeof vpcRaw === "object" && vpcRaw !== null ? vpcRaw : {}
      ) as Record<string, unknown>;
      const vpcId = typeof vpcRec["VPCId"] === "string" ? vpcRec["VPCId"] : "";
      const existing = ctx.store.get<VPC[]>(`${vpcAssocPrefix}${id}`) ?? [];
      ctx.store.set<VPC[]>(
        `${vpcAssocPrefix}${id}`,
        existing.filter((v) => v.VPCId !== vpcId),
      );
      return { ChangeInfo: changeInfo(id) };
    },
    CreateVPCAssociationAuthorization: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      const vpcRaw = input["VPC"];
      const vpcRec = (
        typeof vpcRaw === "object" && vpcRaw !== null ? vpcRaw : {}
      ) as Record<string, unknown>;
      const vpc: VPC = {
        VPCRegion:
          typeof vpcRec["VPCRegion"] === "string" ? vpcRec["VPCRegion"] : "",
        VPCId: typeof vpcRec["VPCId"] === "string" ? vpcRec["VPCId"] : "",
      };
      const existing = ctx.store.get<VPC[]>(`${vpcAuthPrefix}${id}`) ?? [];
      if (!existing.find((v) => v.VPCId === vpc.VPCId)) {
        ctx.store.set<VPC[]>(`${vpcAuthPrefix}${id}`, [...existing, vpc]);
      }
      return {
        HostedZoneId: `/hostedzone/${id}`,
        VPC: vpc,
      };
    },
    DeleteVPCAssociationAuthorization: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      const vpcRaw = input["VPC"];
      const vpcRec = (
        typeof vpcRaw === "object" && vpcRaw !== null ? vpcRaw : {}
      ) as Record<string, unknown>;
      const vpcId = typeof vpcRec["VPCId"] === "string" ? vpcRec["VPCId"] : "";
      const existing = ctx.store.get<VPC[]>(`${vpcAuthPrefix}${id}`) ?? [];
      ctx.store.set<VPC[]>(
        `${vpcAuthPrefix}${id}`,
        existing.filter((v) => v.VPCId !== vpcId),
      );
      return {};
    },
    ListVPCAssociationAuthorizations: (input, ctx) => {
      const id = stripPrefix(input["HostedZoneId"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      getZone(ctx, id);
      const vpcs = ctx.store.get<VPC[]>(`${vpcAuthPrefix}${id}`) ?? [];
      return {
        HostedZoneId: `/hostedzone/${id}`,
        NextToken: "",
        VPCs: vpcs,
      };
    },
    EnableHostedZoneDNSSEC: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      ctx.store.set<{ enabled: boolean }>(`${dnssecPrefix}${id}`, {
        enabled: true,
      });
      return { ChangeInfo: changeInfo(id) };
    },
    DisableHostedZoneDNSSEC: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      ctx.store.set<{ enabled: boolean }>(`${dnssecPrefix}${id}`, {
        enabled: false,
      });
      return { ChangeInfo: changeInfo(id) };
    },
    GetDNSSEC: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getZone(ctx, id);
      const dnssec = ctx.store.get<{ enabled: boolean }>(
        `${dnssecPrefix}${id}`,
      );
      const enabled = dnssec?.enabled ?? false;
      const ksks = ctx.store
        .list<KeySigningKey>()
        .filter((e) => e.key.startsWith(`${kskPrefix}${id}-`))
        .map((e) => keySigningKeyView(e.value));
      return {
        Status: {
          ServeSignature: enabled ? "SIGNING" : "NOT_SIGNING",
          StatusMessage: "",
        },
        KeySigningKeys: ksks,
      };
    },
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
        return {
          HealthCheck: healthCheckView(existing.value),
          Location: `https://route53.amazonaws.com${healthPrefix}/${existing.value.id}`,
        };
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
    UpdateHealthCheck: (input, ctx) => {
      const id = input["HealthCheckId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "HealthCheckId is required", 400);
      }
      const check = getHealthCheck(ctx, id);
      const fields: (keyof Record<string, unknown>)[] = [
        "IPAddress",
        "Port",
        "ResourcePath",
        "FullyQualifiedDomainName",
        "SearchString",
        "FailureThreshold",
        "Inverted",
        "Disabled",
        "HealthThreshold",
        "EnableSNI",
        "InsufficientDataHealthStatus",
      ];
      const updatedConfig = { ...check.config };
      for (const field of fields) {
        if (input[field] !== undefined) updatedConfig[field] = input[field];
      }
      const updated: HealthCheck = {
        ...check,
        version: check.version + 1,
        config: updatedConfig,
      };
      ctx.store.set<HealthCheck>(`${healthKeyPrefix}${id}`, updated);
      return { HealthCheck: healthCheckView(updated) };
    },
    GetHealthCheckCount: (_input, ctx) => ({
      HealthCheckCount: ctx.store
        .list<HealthCheck>()
        .filter((e) => e.key.startsWith(healthKeyPrefix)).length,
    }),
    GetHealthCheckStatus: (input, ctx) => {
      const id = input["HealthCheckId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "HealthCheckId is required", 400);
      }
      getHealthCheck(ctx, id);
      return {
        HealthCheckObservations: [
          {
            Region: "us-east-1",
            IPAddress: "1.2.3.4",
            StatusReport: {
              Status: "Success: HTTP Status Code 200, OK",
              CheckedTime: Math.floor(Date.now() / 1000),
            },
          },
        ],
      };
    },
    GetHealthCheckLastFailureReason: (input, ctx) => {
      const id = input["HealthCheckId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "HealthCheckId is required", 400);
      }
      getHealthCheck(ctx, id);
      return { HealthCheckObservations: [] };
    },
    CreateKeySigningKey: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      getZone(ctx, hostedZoneId);
      const name = input["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      const kmsArn = input["KeyManagementServiceArn"];
      const now = Math.floor(Date.now() / 1000);
      const ksk: KeySigningKey = {
        name,
        kmsArn: typeof kmsArn === "string" ? kmsArn : "",
        status: "INACTIVE",
        createdDate: now,
        lastModifiedDate: now,
      };
      ctx.store.set<KeySigningKey>(`${kskPrefix}${hostedZoneId}-${name}`, ksk);
      return {
        ChangeInfo: changeInfo(generateUUID()),
        KeySigningKey: keySigningKeyView(ksk),
        Location: `https://route53.amazonaws.com/2013-04-01/keysigningkey/${hostedZoneId}/${name}`,
      };
    },
    ActivateKeySigningKey: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      const name = input["Name"];
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      const ksk = getKeySigningKey(ctx, hostedZoneId, name);
      const now = Math.floor(Date.now() / 1000);
      const updated: KeySigningKey = {
        ...ksk,
        status: "ACTIVE",
        lastModifiedDate: now,
      };
      ctx.store.set<KeySigningKey>(
        `${kskPrefix}${hostedZoneId}-${name}`,
        updated,
      );
      return { ChangeInfo: changeInfo(generateUUID()) };
    },
    DeactivateKeySigningKey: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      const name = input["Name"];
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      const ksk = getKeySigningKey(ctx, hostedZoneId, name);
      const now = Math.floor(Date.now() / 1000);
      const updated: KeySigningKey = {
        ...ksk,
        status: "INACTIVE",
        lastModifiedDate: now,
      };
      ctx.store.set<KeySigningKey>(
        `${kskPrefix}${hostedZoneId}-${name}`,
        updated,
      );
      return { ChangeInfo: changeInfo(generateUUID()) };
    },
    DeleteKeySigningKey: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      const name = input["Name"];
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      getKeySigningKey(ctx, hostedZoneId, name);
      ctx.store.delete(`${kskPrefix}${hostedZoneId}-${name}`);
      return { ChangeInfo: changeInfo(generateUUID()) };
    },
    CreateTrafficPolicy: (input, ctx) => {
      const name = input["Name"];
      const document = input["Document"];
      const type = input["Type"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      if (typeof document !== "string" || document === "") {
        throw awsError(
          "InvalidTrafficPolicyDocument",
          "Document is required",
          400,
        );
      }
      const id = generateUUID();
      const comment =
        typeof input["Comment"] === "string" ? input["Comment"] : undefined;
      const tp: TrafficPolicy = {
        id,
        name,
        document,
        type: typeof type === "string" ? type : "A",
        comment,
        latestVersion: 1,
      };
      ctx.store.set<TrafficPolicy>(`${tpPrefix}${id}`, tp);
      const tpv: TrafficPolicyVersion = {
        id,
        version: 1,
        document,
        type: tp.type,
        comment,
      };
      ctx.store.set<TrafficPolicyVersion>(`${tpvPrefix}${id}-1`, tpv);
      return {
        TrafficPolicy: { ...trafficPolicyView(tpv), Name: name },
        Location: `https://route53.amazonaws.com/2013-04-01/trafficpolicy/${id}/1`,
      };
    },
    GetTrafficPolicy: (input, ctx) => {
      const id = input["Id"];
      const version = Number(input["Version"]);
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const tp = getTrafficPolicy(ctx, id);
      const tpv = getTrafficPolicyVersion(ctx, id, version);
      return { TrafficPolicy: { ...trafficPolicyView(tpv), Name: tp.name } };
    },
    CreateTrafficPolicyVersion: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const tp = getTrafficPolicy(ctx, id);
      const document = input["Document"];
      if (typeof document !== "string" || document === "") {
        throw awsError(
          "InvalidTrafficPolicyDocument",
          "Document is required",
          400,
        );
      }
      const comment =
        typeof input["Comment"] === "string" ? input["Comment"] : undefined;
      const newVersion = tp.latestVersion + 1;
      const tpv: TrafficPolicyVersion = {
        id,
        version: newVersion,
        document,
        type: tp.type,
        comment,
      };
      ctx.store.set<TrafficPolicyVersion>(
        `${tpvPrefix}${id}-${newVersion}`,
        tpv,
      );
      ctx.store.set<TrafficPolicy>(`${tpPrefix}${id}`, {
        ...tp,
        latestVersion: newVersion,
        document,
      });
      return {
        TrafficPolicy: { ...trafficPolicyView(tpv), Name: tp.name },
        Location: `https://route53.amazonaws.com/2013-04-01/trafficpolicy/${id}/${newVersion}`,
      };
    },
    UpdateTrafficPolicyComment: (input, ctx) => {
      const id = input["Id"];
      const version = Number(input["Version"]);
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const tp = getTrafficPolicy(ctx, id);
      const tpv = getTrafficPolicyVersion(ctx, id, version);
      const comment =
        typeof input["Comment"] === "string" ? input["Comment"] : undefined;
      const updated: TrafficPolicyVersion = { ...tpv, comment };
      ctx.store.set<TrafficPolicyVersion>(
        `${tpvPrefix}${id}-${version}`,
        updated,
      );
      return {
        TrafficPolicy: { ...trafficPolicyView(updated), Name: tp.name },
      };
    },
    DeleteTrafficPolicy: (input, ctx) => {
      const id = input["Id"];
      const version = Number(input["Version"]);
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getTrafficPolicy(ctx, id);
      getTrafficPolicyVersion(ctx, id, version);
      ctx.store.delete(`${tpvPrefix}${id}-${version}`);
      const remaining = ctx.store
        .list<TrafficPolicyVersion>()
        .filter((e) => e.key.startsWith(`${tpvPrefix}${id}-`));
      if (remaining.length === 0) {
        ctx.store.delete(`${tpPrefix}${id}`);
      }
      return {};
    },
    ListTrafficPolicies: (_input, ctx) => {
      const policies = ctx.store
        .list<TrafficPolicy>()
        .filter((e) => e.key.startsWith(tpPrefix))
        .map((e) => e.value);
      return {
        TrafficPolicySummaries: policies.map((tp) => ({
          Id: tp.id,
          Name: tp.name,
          Type: tp.type,
          LatestVersion: tp.latestVersion,
          TrafficPolicyCount: tp.latestVersion,
        })),
        IsTruncated: false,
        TrafficPolicyIdMarker: "",
        MaxItems: "100",
      };
    },
    ListTrafficPolicyVersions: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const tp = getTrafficPolicy(ctx, id);
      const versions = ctx.store
        .list<TrafficPolicyVersion>()
        .filter((e) => e.key.startsWith(`${tpvPrefix}${id}-`))
        .map((e) => e.value)
        .sort((a, b) => a.version - b.version);
      return {
        TrafficPolicies: versions.map((tpv) => ({
          ...trafficPolicyView(tpv),
          Name: tp.name,
        })),
        IsTruncated: false,
        TrafficPolicyVersionMarker: "",
        MaxItems: "100",
      };
    },
    CreateTrafficPolicyInstance: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      getZone(ctx, hostedZoneId);
      const name = input["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      const ttl = Number(input["TTL"]);
      const trafficPolicyId = input["TrafficPolicyId"];
      const trafficPolicyVersion = Number(input["TrafficPolicyVersion"]);
      if (typeof trafficPolicyId !== "string" || trafficPolicyId === "") {
        throw awsError("InvalidInput", "TrafficPolicyId is required", 400);
      }
      if (
        !Number.isInteger(trafficPolicyVersion) ||
        trafficPolicyVersion < 1 ||
        trafficPolicyVersion > 1000
      ) {
        throw awsError(
          "InvalidInput",
          "TrafficPolicyVersion must be between 1 and 1000",
          400,
        );
      }
      const tp = getTrafficPolicy(ctx, trafficPolicyId);
      getTrafficPolicyVersion(ctx, tp.id, trafficPolicyVersion);
      const id = generateUUID();
      const tpi: TrafficPolicyInstance = {
        id,
        hostedZoneId,
        name: name.endsWith(".") ? name : `${name}.`,
        ttl,
        state: "Applied",
        message: "",
        trafficPolicyId,
        trafficPolicyType: tp.type,
        trafficPolicyVersion,
      };
      ctx.store.set<TrafficPolicyInstance>(`${tpiPrefix}${id}`, tpi);
      return {
        TrafficPolicyInstance: trafficPolicyInstanceView(tpi),
        Location: `https://route53.amazonaws.com/2013-04-01/trafficpolicyinstance/${id}`,
      };
    },
    GetTrafficPolicyInstance: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const tpi = getTrafficPolicyInstance(ctx, id);
      return { TrafficPolicyInstance: trafficPolicyInstanceView(tpi) };
    },
    UpdateTrafficPolicyInstance: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const tpi = getTrafficPolicyInstance(ctx, id);
      const ttl = input["TTL"] !== undefined ? Number(input["TTL"]) : tpi.ttl;
      const trafficPolicyId =
        typeof input["TrafficPolicyId"] === "string"
          ? input["TrafficPolicyId"]
          : tpi.trafficPolicyId;
      const trafficPolicyVersion =
        input["TrafficPolicyVersion"] !== undefined
          ? Number(input["TrafficPolicyVersion"])
          : tpi.trafficPolicyVersion;
      const tp = getTrafficPolicy(ctx, trafficPolicyId);
      const updated: TrafficPolicyInstance = {
        ...tpi,
        ttl,
        trafficPolicyId,
        trafficPolicyType: tp.type,
        trafficPolicyVersion,
      };
      ctx.store.set<TrafficPolicyInstance>(`${tpiPrefix}${id}`, updated);
      return { TrafficPolicyInstance: trafficPolicyInstanceView(updated) };
    },
    DeleteTrafficPolicyInstance: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getTrafficPolicyInstance(ctx, id);
      ctx.store.delete(`${tpiPrefix}${id}`);
      return {};
    },
    ListTrafficPolicyInstances: (_input, ctx) => {
      const instances = ctx.store
        .list<TrafficPolicyInstance>()
        .filter((e) => e.key.startsWith(tpiPrefix))
        .map((e) => e.value);
      return {
        TrafficPolicyInstances: instances.map(trafficPolicyInstanceView),
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    ListTrafficPolicyInstancesByHostedZone: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      const instances = ctx.store
        .list<TrafficPolicyInstance>()
        .filter(
          (e) =>
            e.key.startsWith(tpiPrefix) &&
            e.value.hostedZoneId === hostedZoneId,
        )
        .map((e) => e.value);
      return {
        TrafficPolicyInstances: instances.map(trafficPolicyInstanceView),
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    ListTrafficPolicyInstancesByPolicy: (input, ctx) => {
      const trafficPolicyId = input["TrafficPolicyId"];
      if (typeof trafficPolicyId !== "string" || trafficPolicyId === "") {
        throw awsError("InvalidInput", "TrafficPolicyId is required", 400);
      }
      const instances = ctx.store
        .list<TrafficPolicyInstance>()
        .filter(
          (e) =>
            e.key.startsWith(tpiPrefix) &&
            e.value.trafficPolicyId === trafficPolicyId,
        )
        .map((e) => e.value);
      return {
        TrafficPolicyInstances: instances.map(trafficPolicyInstanceView),
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    GetTrafficPolicyInstanceCount: (_input, ctx) => ({
      TrafficPolicyInstanceCount: ctx.store
        .list<TrafficPolicyInstance>()
        .filter((e) => e.key.startsWith(tpiPrefix)).length,
    }),
    CreateReusableDelegationSet: (input, ctx) => {
      const callerReference = input["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidInput", "CallerReference is required", 400);
      }
      const existing = ctx.store
        .list<ReusableDelegationSet>()
        .find(
          (e) =>
            e.key.startsWith(rdsPrefix) &&
            e.value.callerReference === callerReference,
        );
      if (existing !== undefined) {
        return {
          DelegationSet: delegationSetView(existing.value),
          Location: `https://route53.amazonaws.com/2013-04-01/delegationset/${existing.value.id}`,
        };
      }
      const id = generateId();
      const rds: ReusableDelegationSet = {
        id,
        callerReference,
        nameServers: [...nameServers],
      };
      ctx.store.set<ReusableDelegationSet>(`${rdsPrefix}${id}`, rds);
      return {
        DelegationSet: delegationSetView(rds),
        Location: `https://route53.amazonaws.com/2013-04-01/delegationset/${id}`,
      };
    },
    GetReusableDelegationSet: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const rds = getReusableDelegationSet(ctx, id);
      return { DelegationSet: delegationSetView(rds) };
    },
    ListReusableDelegationSets: (_input, ctx) => {
      const sets = ctx.store
        .list<ReusableDelegationSet>()
        .filter((e) => e.key.startsWith(rdsPrefix))
        .map((e) => e.value);
      return {
        DelegationSets: sets.map(delegationSetView),
        Marker: "",
        IsTruncated: false,
        MaxItems: "100",
      };
    },
    DeleteReusableDelegationSet: (input, ctx) => {
      const id = stripPrefix(input["Id"]);
      if (id === undefined) {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getReusableDelegationSet(ctx, id);
      ctx.store.delete(`${rdsPrefix}${id}`);
      return {};
    },
    GetReusableDelegationSetLimit: (input, ctx) => {
      const id = stripPrefix(input["DelegationSetId"]);
      const type = input["Type"];
      if (id === undefined) {
        throw awsError("InvalidInput", "DelegationSetId is required", 400);
      }
      getReusableDelegationSet(ctx, id);
      return {
        Limit: { Type: type, Value: 100 },
        Count: 0,
      };
    },
    CreateCidrCollection: (input, ctx) => {
      const name = input["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidInput", "Name is required", 400);
      }
      const id = generateUUID();
      const arn = `arn:aws:route53:::cidrcollection/${id}`;
      const cidr: CidrCollection = {
        id,
        name,
        version: 1,
        arn,
        locations: {},
      };
      ctx.store.set<CidrCollection>(`${cidrPrefix}${id}`, cidr);
      return {
        Collection: cidrCollectionView(cidr),
        Location: `https://route53.amazonaws.com/2013-04-01/cidrcollection/${id}`,
      };
    },
    ChangeCidrCollection: (input, ctx) => {
      const id = input["CidrCollectionId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "CidrCollectionId is required", 400);
      }
      const cidr = getCidrCollection(ctx, id);
      const rawChanges = input["Changes"];
      const changes = Array.isArray(rawChanges) ? rawChanges : [];
      const locations = { ...cidr.locations };
      for (const change of changes) {
        if (typeof change !== "object" || change === null) continue;
        const c = change as Record<string, unknown>;
        const locationName =
          typeof c["LocationName"] === "string" ? c["LocationName"] : "";
        const action = c["Action"];
        const rawCidrs = c["CidrList"];
        const cidrs = Array.isArray(rawCidrs)
          ? rawCidrs.filter((x): x is string => typeof x === "string")
          : [];
        if (action === "DELETE_IF_EXISTS") {
          delete locations[locationName];
        } else {
          locations[locationName] = cidrs;
        }
      }
      const updated: CidrCollection = {
        ...cidr,
        locations,
        version: cidr.version + 1,
      };
      ctx.store.set<CidrCollection>(`${cidrPrefix}${id}`, updated);
      return {};
    },
    DeleteCidrCollection: (input, ctx) => {
      const id = input["CidrCollectionId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "CidrCollectionId is required", 400);
      }
      getCidrCollection(ctx, id);
      ctx.store.delete(`${cidrPrefix}${id}`);
      return {};
    },
    ListCidrCollections: (_input, ctx) => {
      const collections = ctx.store
        .list<CidrCollection>()
        .filter((e) => e.key.startsWith(cidrPrefix))
        .map((e) => e.value);
      return {
        NextToken: "",
        CidrCollections: collections.map(cidrCollectionView),
      };
    },
    ListCidrLocations: (input, ctx) => {
      const id = input["CollectionId"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "CollectionId is required", 400);
      }
      const cidr = getCidrCollection(ctx, id);
      return {
        NextToken: "",
        CidrLocations: Object.keys(cidr.locations).map((loc) => ({
          LocationName: loc,
        })),
      };
    },
    ListCidrBlocks: (input, ctx) => {
      const id = input["CollectionId"];
      const locationName = input["LocationName"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "CollectionId is required", 400);
      }
      const cidr = getCidrCollection(ctx, id);
      let blocks: { CidrBlock: string; LocationName: string }[] = [];
      if (typeof locationName === "string" && locationName !== "") {
        const cidrs = cidr.locations[locationName] ?? [];
        blocks = cidrs.map((b) => ({
          CidrBlock: b,
          LocationName: locationName,
        }));
      } else {
        for (const [loc, cidrs] of Object.entries(cidr.locations)) {
          for (const b of cidrs) {
            blocks.push({ CidrBlock: b, LocationName: loc });
          }
        }
      }
      return { NextToken: "", CidrBlocks: blocks };
    },
    CreateQueryLoggingConfig: (input, ctx) => {
      const hostedZoneId = stripPrefix(input["HostedZoneId"]);
      if (hostedZoneId === undefined) {
        throw awsError("InvalidInput", "HostedZoneId is required", 400);
      }
      getZone(ctx, hostedZoneId);
      const arn = input["CloudWatchLogsLogGroupArn"];
      if (typeof arn !== "string" || arn === "") {
        throw awsError(
          "InvalidInput",
          "CloudWatchLogsLogGroupArn is required",
          400,
        );
      }
      const id = generateUUID();
      const qlc: QueryLoggingConfig = {
        id,
        hostedZoneId,
        cloudWatchLogsLogGroupArn: arn,
      };
      ctx.store.set<QueryLoggingConfig>(`${qlcPrefix}${id}`, qlc);
      return {
        QueryLoggingConfig: queryLoggingConfigView(qlc),
        Location: `https://route53.amazonaws.com/2013-04-01/queryloggingconfig/${id}`,
      };
    },
    GetQueryLoggingConfig: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      const qlc = getQueryLoggingConfig(ctx, id);
      return { QueryLoggingConfig: queryLoggingConfigView(qlc) };
    },
    ListQueryLoggingConfigs: (_input, ctx) => {
      const configs = ctx.store
        .list<QueryLoggingConfig>()
        .filter((e) => e.key.startsWith(qlcPrefix))
        .map((e) => e.value);
      return {
        QueryLoggingConfigs: configs.map(queryLoggingConfigView),
        NextToken: "",
      };
    },
    DeleteQueryLoggingConfig: (input, ctx) => {
      const id = input["Id"];
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "Id is required", 400);
      }
      getQueryLoggingConfig(ctx, id);
      ctx.store.delete(`${qlcPrefix}${id}`);
      return {};
    },
    ChangeTagsForResource: (input, ctx) => {
      const type = input["ResourceType"];
      const id = input["ResourceId"];
      if (typeof type !== "string" || type === "") {
        throw awsError("InvalidInput", "ResourceType is required", 400);
      }
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "ResourceId is required", 400);
      }
      const tags = getTags(ctx, type, id);
      const addRaw = input["AddTags"];
      if (Array.isArray(addRaw)) {
        for (const tag of addRaw) {
          if (typeof tag !== "object" || tag === null) continue;
          const t = tag as Record<string, unknown>;
          const key = typeof t["Key"] === "string" ? t["Key"] : "";
          const value = typeof t["Value"] === "string" ? t["Value"] : "";
          if (key !== "") tags[key] = value;
        }
      }
      const removeRaw = input["RemoveTagKeys"];
      if (Array.isArray(removeRaw)) {
        for (const key of removeRaw) {
          if (typeof key === "string") delete tags[key];
        }
      }
      ctx.store.set<Record<string, string>>(`${tagPrefix}${type}-${id}`, tags);
      return {};
    },
    ListTagsForResource: (input, ctx) => {
      const type = input["ResourceType"];
      const id = input["ResourceId"];
      if (typeof type !== "string" || type === "") {
        throw awsError("InvalidInput", "ResourceType is required", 400);
      }
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidInput", "ResourceId is required", 400);
      }
      const tags = getTags(ctx, type, id);
      return {
        ResourceTagSet: {
          ResourceType: type,
          ResourceId: id,
          Tags: Object.entries(tags).map(([k, v]) => ({ Key: k, Value: v })),
        },
      };
    },
    ListTagsForResources: (input, ctx) => {
      const type = input["ResourceType"];
      const rawIds = input["ResourceIds"];
      if (typeof type !== "string" || type === "") {
        throw awsError("InvalidInput", "ResourceType is required", 400);
      }
      const ids = Array.isArray(rawIds)
        ? rawIds.filter((x): x is string => typeof x === "string")
        : [];
      return {
        ResourceTagSets: ids.map((id) => {
          const tags = getTags(ctx, type, id);
          return {
            ResourceType: type,
            ResourceId: id,
            Tags: Object.entries(tags).map(([k, v]) => ({ Key: k, Value: v })),
          };
        }),
      };
    },
    GetAccountLimit: (input) => {
      const type = input["Type"];
      const limits: Record<string, number> = {
        MAX_HEALTH_CHECKS_BY_OWNER: 200,
        MAX_HOSTED_ZONES_BY_OWNER: 500,
        MAX_REUSABLE_DELEGATION_SETS_BY_OWNER: 100,
        MAX_TRAFFIC_POLICIES_BY_OWNER: 50,
        MAX_TRAFFIC_POLICY_INSTANCES_BY_OWNER: 5,
      };
      const value = typeof type === "string" ? (limits[type] ?? 100) : 100;
      return {
        Limit: { Type: type, Value: value },
        Count: 0,
      };
    },
    GetChange: (input) => {
      const id = input["Id"];
      const cleanId =
        typeof id === "string" ? id.replace(/^\/change\//, "") : String(id);
      return {
        ChangeInfo: {
          Id: `/change/${cleanId}`,
          Status: "INSYNC",
          SubmittedAt: Math.floor(Date.now() / 1000),
        },
      };
    },
    GetCheckerIpRanges: () => ({
      CheckerIpRanges: ["15.177.0.0/18", "54.183.255.128/26", "54.228.16.0/26"],
    }),
    GetGeoLocation: (input) => {
      const continentCode = input["ContinentCode"];
      const countryCode = input["CountryCode"];
      if (typeof continentCode === "string" && continentCode !== "") {
        const geo = geoLocations.find((g) => g.ContinentCode === continentCode);
        if (geo === undefined) {
          throw awsError(
            "NoSuchGeoLocation",
            `No geo location for continent: ${continentCode}`,
            404,
          );
        }
        return { GeoLocationDetails: geo };
      }
      if (typeof countryCode === "string" && countryCode !== "") {
        return {
          GeoLocationDetails: {
            CountryCode: countryCode,
            CountryName: countryCode,
          },
        };
      }
      return {
        GeoLocationDetails: {
          ContinentCode: "NA",
          ContinentName: "North America",
        },
      };
    },
    ListGeoLocations: () => ({
      GeoLocationDetailsList: [...geoLocations],
      IsTruncated: false,
      MaxItems: "100",
    }),
    TestDNSAnswer: (input) => {
      const recordName = input["RecordName"];
      const recordType = input["RecordType"];
      return {
        Nameserver: nameServers[0],
        RecordName: typeof recordName === "string" ? recordName : "",
        RecordType: typeof recordType === "string" ? recordType : "A",
        RecordData: ["192.0.2.1"],
        ResponseCode: "NOERROR",
        Protocol: "UDP",
      };
    },
  },
  model,
};

export default route53;
