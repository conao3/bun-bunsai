import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codeartifactModel from "../../../../test/vendor/aws-models/codeartifact.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codeartifactModel);

const domainPrefix = "domain:" as const;
const repoPrefix = "repo:" as const;
const pkgPrefix = "pkg:" as const;
const pkgVerPrefix = "pkgver:" as const;
const pkgGrpPrefix = "pkggrp:" as const;
const policyPrefix = "policy:" as const;
const tagsPrefix = "tags:" as const;

type StoredDomain = {
  name: string;
  owner: string;
  arn: string;
  status: string;
  createdTime: number;
  encryptionKey: string | undefined;
  repositoryCount: number;
  assetSizeBytes: number;
  s3BucketArn: string;
};

type StoredRepository = {
  name: string;
  domainName: string;
  arn: string;
  description: string | undefined;
  upstreams: string[];
  externalConnections: string[];
  createdTime: number;
};

type StoredPackage = {
  format: string;
  namespace: string | undefined;
  name: string;
  domainName: string;
  repositoryName: string;
  originConfiguration: {
    restrictions: { publish: string; upstream: string };
  };
};

type StoredPackageVersion = {
  format: string;
  namespace: string | undefined;
  packageName: string;
  version: string;
  status: string;
  revision: string;
  domainName: string;
  repositoryName: string;
  publishedTime: number;
  assets: Array<{ name: string; content: string; size: number }>;
};

type StoredPackageGroup = {
  arn: string;
  pattern: string;
  domainName: string;
  description: string | undefined;
  contactInfo: string | undefined;
  originConfiguration: {
    restrictions: Record<string, { restrictionMode: string }>;
  };
  createdTime: number;
};

type StoredPolicy = {
  resourceArn: string;
  revision: string;
  document: string;
};

type StoredTag = {
  key: string;
  value: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const domainKey = (name: string): string => `${domainPrefix}${name}`;
const repoKey = (domain: string, repo: string): string =>
  `${repoPrefix}${domain}:${repo}`;
const pkgKey = (
  domain: string,
  repo: string,
  format: string,
  ns: string | undefined,
  pkg: string,
): string => `${pkgPrefix}${domain}:${repo}:${format}:${ns ?? ""}:${pkg}`;
const pkgVerKey = (
  domain: string,
  repo: string,
  format: string,
  ns: string | undefined,
  pkg: string,
  version: string,
): string =>
  `${pkgVerPrefix}${domain}:${repo}:${format}:${ns ?? ""}:${pkg}:${version}`;
const pkgGrpKey = (domain: string, pattern: string): string =>
  `${pkgGrpPrefix}${domain}:${pattern}`;
const domainPolicyKey = (domain: string): string =>
  `${policyPrefix}domain:${domain}`;
const repoPolicyKey = (domain: string, repo: string): string =>
  `${policyPrefix}repo:${domain}:${repo}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const domainArn = (account: string, region: string, name: string): string =>
  `arn:aws:codeartifact:${region}:${account}:domain/${name}`;

const repoArn = (
  account: string,
  region: string,
  domain: string,
  repo: string,
): string =>
  `arn:aws:codeartifact:${region}:${account}:repository/${domain}/${repo}`;

const pkgGrpArn = (
  account: string,
  region: string,
  domain: string,
  pattern: string,
): string =>
  `arn:aws:codeartifact:${region}:${account}:package-group/${domain}${pattern}`;

const domainView = (domain: StoredDomain): Record<string, unknown> => ({
  name: domain.name,
  owner: domain.owner,
  arn: domain.arn,
  status: domain.status,
  createdTime: new Date(domain.createdTime),
  encryptionKey: domain.encryptionKey,
  repositoryCount: domain.repositoryCount,
  assetSizeBytes: domain.assetSizeBytes,
  s3BucketArn: domain.s3BucketArn,
});

const domainSummary = (domain: StoredDomain): Record<string, unknown> => ({
  name: domain.name,
  owner: domain.owner,
  arn: domain.arn,
  status: domain.status,
  createdTime: new Date(domain.createdTime),
  encryptionKey: domain.encryptionKey,
});

const repoView = (repo: StoredRepository): Record<string, unknown> => ({
  name: repo.name,
  administratorAccount: undefined,
  domainName: repo.domainName,
  domainOwner: undefined,
  arn: repo.arn,
  description: repo.description,
  upstreams: repo.upstreams.map((r) => ({ repositoryName: r })),
  externalConnections: repo.externalConnections.map((ec) => ({
    externalConnectionName: ec,
    packageFormat: "generic",
    status: "Available",
  })),
  createdTime: new Date(repo.createdTime),
});

const repoSummary = (repo: StoredRepository): Record<string, unknown> => ({
  name: repo.name,
  administratorAccount: undefined,
  domainName: repo.domainName,
  domainOwner: undefined,
  arn: repo.arn,
  description: repo.description,
  createdTime: new Date(repo.createdTime),
});

const pkgView = (pkg: StoredPackage): Record<string, unknown> => ({
  format: pkg.format,
  namespace: pkg.namespace,
  name: pkg.name,
  originConfiguration: pkg.originConfiguration,
});

const pkgSummary = (pkg: StoredPackage): Record<string, unknown> => ({
  format: pkg.format,
  namespace: pkg.namespace,
  package: pkg.name,
  originConfiguration: pkg.originConfiguration,
});

const pkgVerView = (pv: StoredPackageVersion): Record<string, unknown> => ({
  format: pv.format,
  namespace: pv.namespace,
  packageName: pv.packageName,
  displayName: pv.packageName,
  version: pv.version,
  summary: undefined,
  homePage: undefined,
  sourceCodeRepository: undefined,
  publishedTime: new Date(pv.publishedTime),
  licenses: [],
  revision: pv.revision,
  status: pv.status,
  origin: { domainEntryPoint: undefined, originType: "INTERNAL" },
});

const pkgVerSummary = (pv: StoredPackageVersion): Record<string, unknown> => ({
  version: pv.version,
  revision: pv.revision,
  status: pv.status,
  origin: { domainEntryPoint: undefined, originType: "INTERNAL" },
});

const pkgGrpView = (grp: StoredPackageGroup): Record<string, unknown> => ({
  arn: grp.arn,
  pattern: grp.pattern,
  domainName: grp.domainName,
  domainOwner: undefined,
  createdTime: new Date(grp.createdTime),
  contactInfo: grp.contactInfo,
  description: grp.description,
  originConfiguration: grp.originConfiguration,
  parent: undefined,
});

const requireDomain = (ctx: ServiceContext, name: string): StoredDomain => {
  const stored = ctx.store.get<StoredDomain>(domainKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Domain ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireRepo = (
  ctx: ServiceContext,
  domain: string,
  repo: string,
): StoredRepository => {
  const stored = ctx.store.get<StoredRepository>(repoKey(domain, repo));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Repository ${repo} in domain ${domain} does not exist.`,
      404,
    );
  }
  return stored;
};

const requirePkg = (
  ctx: ServiceContext,
  domain: string,
  repo: string,
  format: string,
  ns: string | undefined,
  pkg: string,
): StoredPackage => {
  const stored = ctx.store.get<StoredPackage>(
    pkgKey(domain, repo, format, ns, pkg),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package ${pkg} does not exist.`,
      404,
    );
  }
  return stored;
};

const requirePkgVer = (
  ctx: ServiceContext,
  domain: string,
  repo: string,
  format: string,
  ns: string | undefined,
  pkg: string,
  version: string,
): StoredPackageVersion => {
  const stored = ctx.store.get<StoredPackageVersion>(
    pkgVerKey(domain, repo, format, ns, pkg, version),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package version ${version} does not exist.`,
      404,
    );
  }
  return stored;
};

const requirePkgGrp = (
  ctx: ServiceContext,
  domain: string,
  pattern: string,
): StoredPackageGroup => {
  const stored = ctx.store.get<StoredPackageGroup>(pkgGrpKey(domain, pattern));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package group ${pattern} does not exist.`,
      404,
    );
  }
  return stored;
};

const listRepos = (ctx: ServiceContext, domain: string): StoredRepository[] =>
  ctx.store
    .list<StoredRepository>()
    .filter(
      (e) => e.key.startsWith(repoPrefix) && e.value.domainName === domain,
    )
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

const listAllRepos = (ctx: ServiceContext): StoredRepository[] =>
  ctx.store
    .list<StoredRepository>()
    .filter((e) => e.key.startsWith(repoPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

const listPkgs = (
  ctx: ServiceContext,
  domain: string,
  repo: string,
): StoredPackage[] =>
  ctx.store
    .list<StoredPackage>()
    .filter(
      (e) =>
        e.key.startsWith(pkgPrefix) &&
        e.value.domainName === domain &&
        e.value.repositoryName === repo,
    )
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

const listPkgVers = (
  ctx: ServiceContext,
  domain: string,
  repo: string,
  format: string,
  ns: string | undefined,
  pkg: string,
): StoredPackageVersion[] =>
  ctx.store
    .list<StoredPackageVersion>()
    .filter(
      (e) =>
        e.key.startsWith(pkgVerPrefix) &&
        e.value.domainName === domain &&
        e.value.repositoryName === repo &&
        e.value.format === format &&
        e.value.namespace === ns &&
        e.value.packageName === pkg,
    )
    .map((e) => e.value)
    .sort((a, b) =>
      a.version < b.version ? -1 : a.version > b.version ? 1 : 0,
    );

const listPkgGrps = (
  ctx: ServiceContext,
  domain: string,
): StoredPackageGroup[] =>
  ctx.store
    .list<StoredPackageGroup>()
    .filter(
      (e) => e.key.startsWith(pkgGrpPrefix) && e.value.domainName === domain,
    )
    .map((e) => e.value)
    .sort((a, b) =>
      a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0,
    );

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const CreateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "domain");
  if (ctx.store.get<StoredDomain>(domainKey(name)) !== undefined) {
    throw awsError("ConflictException", `Domain ${name} already exists.`, 409);
  }
  const domain: StoredDomain = {
    name,
    owner: ctx.account,
    arn: domainArn(ctx.account, ctx.region, name),
    status: "Active",
    createdTime: Date.now(),
    encryptionKey: stringOrUndefined(input["encryptionKey"]),
    repositoryCount: 0,
    assetSizeBytes: 0,
    s3BucketArn: `arn:aws:s3:::bunsai-codeartifact-${name}`,
  };
  ctx.store.set(domainKey(name), domain);
  return { domain: domainView(domain) };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "domain");
  return { domain: domainView(requireDomain(ctx, name)) };
};

const ListDomains: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const domains = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith(domainPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { domains: domains.slice(0, max).map(domainSummary) };
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "domain");
  const domain = requireDomain(ctx, name);
  ctx.store.delete(domainKey(name));
  return { domain: domainView(domain) };
};

const CreateRepository: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  requireDomain(ctx, domain);
  if (ctx.store.get<StoredRepository>(repoKey(domain, repo)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Repository ${repo} already exists.`,
      409,
    );
  }
  const upstreams = Array.isArray(input["upstreams"])
    ? (input["upstreams"] as Array<{ repositoryName?: unknown }>).map((u) =>
        String(u.repositoryName ?? ""),
      )
    : [];
  const stored: StoredRepository = {
    name: repo,
    domainName: domain,
    arn: repoArn(ctx.account, ctx.region, domain, repo),
    description: stringOrUndefined(input["description"]),
    upstreams,
    externalConnections: [],
    createdTime: Date.now(),
  };
  ctx.store.set(repoKey(domain, repo), stored);
  const dom = requireDomain(ctx, domain);
  ctx.store.set(domainKey(domain), {
    ...dom,
    repositoryCount: dom.repositoryCount + 1,
  });
  return { repository: repoView(stored) };
};

const DescribeRepository: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  return { repository: repoView(requireRepo(ctx, domain, repo)) };
};

const DeleteRepository: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const stored = requireRepo(ctx, domain, repo);
  ctx.store.delete(repoKey(domain, repo));
  const dom = ctx.store.get<StoredDomain>(domainKey(domain));
  if (dom !== undefined) {
    ctx.store.set(domainKey(domain), {
      ...dom,
      repositoryCount: Math.max(0, dom.repositoryCount - 1),
    });
  }
  return { repository: repoView(stored) };
};

const UpdateRepository: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const stored = requireRepo(ctx, domain, repo);
  const upstreams = Array.isArray(input["upstreams"])
    ? (input["upstreams"] as Array<{ repositoryName?: unknown }>).map((u) =>
        String(u.repositoryName ?? ""),
      )
    : stored.upstreams;
  const updated: StoredRepository = {
    ...stored,
    description:
      input["description"] !== undefined
        ? stringOrUndefined(input["description"])
        : stored.description,
    upstreams,
  };
  ctx.store.set(repoKey(domain, repo), updated);
  return { repository: repoView(updated) };
};

const ListRepositories: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const repos = listAllRepos(ctx);
  return { repositories: repos.slice(0, max).map(repoSummary) };
};

const ListRepositoriesInDomain: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const repos = listRepos(ctx, domain);
  return { repositories: repos.slice(0, max).map(repoSummary) };
};

const AssociateExternalConnection: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const ec = requireString(input, "externalConnection");
  const stored = requireRepo(ctx, domain, repo);
  if (!stored.externalConnections.includes(ec)) {
    const updated: StoredRepository = {
      ...stored,
      externalConnections: [...stored.externalConnections, ec],
    };
    ctx.store.set(repoKey(domain, repo), updated);
    return { repository: repoView(updated) };
  }
  return { repository: repoView(stored) };
};

const DisassociateExternalConnection: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const ec = requireString(input, "externalConnection");
  const stored = requireRepo(ctx, domain, repo);
  const updated: StoredRepository = {
    ...stored,
    externalConnections: stored.externalConnections.filter((c) => c !== ec),
  };
  ctx.store.set(repoKey(domain, repo), updated);
  return { repository: repoView(updated) };
};

const GetRepositoryEndpoint: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  requireRepo(ctx, domain, repo);
  return {
    repositoryEndpoint: `https://${domain}-${ctx.account}.d.codeartifact.${ctx.region}.amazonaws.com/${format}/${repo}/`,
  };
};

const DescribePackage: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  return { package: pkgView(requirePkg(ctx, domain, repo, format, ns, pkg)) };
};

const DeletePackage: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  const stored = requirePkg(ctx, domain, repo, format, ns, pkg);
  ctx.store.delete(pkgKey(domain, repo, format, ns, pkg));
  return { deletedPackage: pkgSummary(stored) };
};

const ListPackages: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  requireRepo(ctx, domain, repo);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const pkgs = listPkgs(ctx, domain, repo);
  return { packages: pkgs.slice(0, max).map(pkgSummary) };
};

const PutPackageOriginConfiguration: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  const restrictions = (input["restrictions"] as Record<string, unknown>) ?? {};
  const existing = ctx.store.get<StoredPackage>(
    pkgKey(domain, repo, format, ns, pkg),
  );
  const stored: StoredPackage = existing ?? {
    format,
    namespace: ns,
    name: pkg,
    domainName: domain,
    repositoryName: repo,
    originConfiguration: {
      restrictions: { publish: "ALLOW", upstream: "ALLOW" },
    },
  };
  const updated: StoredPackage = {
    ...stored,
    originConfiguration: {
      restrictions: {
        publish:
          stringOrUndefined(
            (restrictions as Record<string, unknown>)["publish"],
          ) ?? stored.originConfiguration.restrictions.publish,
        upstream:
          stringOrUndefined(
            (restrictions as Record<string, unknown>)["upstream"],
          ) ?? stored.originConfiguration.restrictions.upstream,
      },
    },
  };
  ctx.store.set(pkgKey(domain, repo, format, ns, pkg), updated);
  return { originConfiguration: updated.originConfiguration };
};

const DescribePackageVersion: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const version = requireString(input, "packageVersion");
  const ns = stringOrUndefined(input["namespace"]);
  return {
    packageVersion: pkgVerView(
      requirePkgVer(ctx, domain, repo, format, ns, pkg, version),
    ),
  };
};

const DeletePackageVersions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  const versions = Array.isArray(input["versions"])
    ? (input["versions"] as string[])
    : [];
  const successfulVersions: Record<string, unknown> = {};
  for (const v of versions) {
    const key = pkgVerKey(domain, repo, format, ns, pkg, v);
    if (ctx.store.get<StoredPackageVersion>(key) !== undefined) {
      ctx.store.delete(key);
      successfulVersions[v] = { revision: "deleted", status: "Deleted" };
    }
  }
  return { successfulVersions, failedVersions: {} };
};

const DisposePackageVersions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  const versions = Array.isArray(input["versions"])
    ? (input["versions"] as string[])
    : [];
  const successfulVersions: Record<string, unknown> = {};
  for (const v of versions) {
    const key = pkgVerKey(domain, repo, format, ns, pkg, v);
    const pv = ctx.store.get<StoredPackageVersion>(key);
    if (pv !== undefined) {
      const updated: StoredPackageVersion = { ...pv, status: "Disposed" };
      ctx.store.set(key, updated);
      successfulVersions[v] = { revision: pv.revision, status: "Disposed" };
    }
  }
  return { successfulVersions, failedVersions: {} };
};

const CopyPackageVersions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const srcRepo = requireString(input, "sourceRepository");
  const dstRepo = requireString(input, "destinationRepository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  requireRepo(ctx, domain, srcRepo);
  requireRepo(ctx, domain, dstRepo);
  const versions = Array.isArray(input["versions"])
    ? (input["versions"] as string[])
    : [];
  const successfulVersions: Record<string, unknown> = {};
  for (const v of versions) {
    const srcKey = pkgVerKey(domain, srcRepo, format, ns, pkg, v);
    const pv = ctx.store.get<StoredPackageVersion>(srcKey);
    if (pv !== undefined) {
      const dstKey = pkgVerKey(domain, dstRepo, format, ns, pkg, v);
      ctx.store.set(dstKey, { ...pv, repositoryName: dstRepo });
      successfulVersions[v] = { revision: pv.revision, status: pv.status };
      const dstPkgKey = pkgKey(domain, dstRepo, format, ns, pkg);
      if (ctx.store.get<StoredPackage>(dstPkgKey) === undefined) {
        ctx.store.set(dstPkgKey, {
          format,
          namespace: ns,
          name: pkg,
          domainName: domain,
          repositoryName: dstRepo,
          originConfiguration: {
            restrictions: { publish: "ALLOW", upstream: "ALLOW" },
          },
        });
      }
    }
  }
  return { successfulVersions, failedVersions: {} };
};

const UpdatePackageVersionsStatus: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  const targetStatus = requireString(input, "targetStatus");
  const versions = Array.isArray(input["versions"])
    ? (input["versions"] as string[])
    : [];
  const successfulVersions: Record<string, unknown> = {};
  for (const v of versions) {
    const key = pkgVerKey(domain, repo, format, ns, pkg, v);
    const pv = ctx.store.get<StoredPackageVersion>(key);
    if (pv !== undefined) {
      ctx.store.set(key, { ...pv, status: targetStatus });
      successfulVersions[v] = { revision: pv.revision, status: targetStatus };
    }
  }
  return { successfulVersions, failedVersions: {} };
};

const ListPackageVersions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  requireRepo(ctx, domain, repo);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const pvs = listPkgVers(ctx, domain, repo, format, ns, pkg);
  return {
    defaultDisplayVersion: pvs[pvs.length - 1]?.version,
    format,
    namespace: ns,
    package: pkg,
    versions: pvs.slice(0, max).map(pkgVerSummary),
  };
};

const ListPackageVersionAssets: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const version = requireString(input, "packageVersion");
  const ns = stringOrUndefined(input["namespace"]);
  const pv = requirePkgVer(ctx, domain, repo, format, ns, pkg, version);
  const assets = pv.assets.map((a) => ({
    name: a.name,
    size: a.size,
    hashes: {
      SHA256:
        "0000000000000000000000000000000000000000000000000000000000000000",
    },
  }));
  return {
    format,
    namespace: ns,
    package: pkg,
    version,
    versionRevision: pv.revision,
    assets,
  };
};

const ListPackageVersionDependencies: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const version = requireString(input, "packageVersion");
  const ns = stringOrUndefined(input["namespace"]);
  const pv = requirePkgVer(ctx, domain, repo, format, ns, pkg, version);
  return {
    format,
    namespace: ns,
    package: pkg,
    version,
    versionRevision: pv.revision,
    dependencies: [],
  };
};

const GetPackageVersionAsset: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const version = requireString(input, "packageVersion");
  const assetName = requireString(input, "asset");
  const ns = stringOrUndefined(input["namespace"]);
  const pv = requirePkgVer(ctx, domain, repo, format, ns, pkg, version);
  const asset = pv.assets.find((a) => a.name === assetName);
  if (asset === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Asset ${assetName} not found.`,
      404,
    );
  }
  return {
    asset: asset.content,
    assetName: asset.name,
    packageVersion: version,
    packageVersionRevision: pv.revision,
  };
};

const GetPackageVersionReadme: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const version = requireString(input, "packageVersion");
  const ns = stringOrUndefined(input["namespace"]);
  const pv = requirePkgVer(ctx, domain, repo, format, ns, pkg, version);
  return {
    format,
    namespace: ns,
    package: pkg,
    version,
    versionRevision: pv.revision,
    readme: `# ${pkg} ${version}\n`,
  };
};

const PublishPackageVersion: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const version = requireString(input, "packageVersion");
  const assetName = requireString(input, "assetName");
  const ns = stringOrUndefined(input["namespace"]);
  requireRepo(ctx, domain, repo);
  const revision = `${Date.now()}`;
  const content =
    typeof input["assetContent"] === "string" ? input["assetContent"] : "";
  const assetSize = content.length;
  const key = pkgVerKey(domain, repo, format, ns, pkg, version);
  const existing = ctx.store.get<StoredPackageVersion>(key);
  const updated: StoredPackageVersion = existing
    ? {
        ...existing,
        assets: [
          ...existing.assets.filter((a) => a.name !== assetName),
          { name: assetName, content, size: assetSize },
        ],
      }
    : {
        format,
        namespace: ns,
        packageName: pkg,
        version,
        status: "Published",
        revision,
        domainName: domain,
        repositoryName: repo,
        publishedTime: Date.now(),
        assets: [{ name: assetName, content, size: assetSize }],
      };
  ctx.store.set(key, updated);
  const pkgStoreKey = pkgKey(domain, repo, format, ns, pkg);
  if (ctx.store.get<StoredPackage>(pkgStoreKey) === undefined) {
    ctx.store.set(pkgStoreKey, {
      format,
      namespace: ns,
      name: pkg,
      domainName: domain,
      repositoryName: repo,
      originConfiguration: {
        restrictions: { publish: "ALLOW", upstream: "ALLOW" },
      },
    });
  }
  return {
    format,
    namespace: ns,
    package: pkg,
    version,
    versionRevision: updated.revision,
    status: updated.status,
    asset: {
      name: assetName,
      size: assetSize,
      hashes: {
        SHA256:
          "0000000000000000000000000000000000000000000000000000000000000000",
      },
    },
  };
};

const CreatePackageGroup: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  requireDomain(ctx, domain);
  if (
    ctx.store.get<StoredPackageGroup>(pkgGrpKey(domain, pattern)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      `Package group ${pattern} already exists.`,
      409,
    );
  }
  const grp: StoredPackageGroup = {
    arn: pkgGrpArn(ctx.account, ctx.region, domain, pattern),
    pattern,
    domainName: domain,
    description: stringOrUndefined(input["description"]),
    contactInfo: stringOrUndefined(input["contactInfo"]),
    originConfiguration: { restrictions: {} },
    createdTime: Date.now(),
  };
  ctx.store.set(pkgGrpKey(domain, pattern), grp);
  return { packageGroup: pkgGrpView(grp) };
};

const DescribePackageGroup: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  return { packageGroup: pkgGrpView(requirePkgGrp(ctx, domain, pattern)) };
};

const DeletePackageGroup: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  const grp = requirePkgGrp(ctx, domain, pattern);
  ctx.store.delete(pkgGrpKey(domain, pattern));
  return { packageGroup: pkgGrpView(grp) };
};

const UpdatePackageGroup: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  const grp = requirePkgGrp(ctx, domain, pattern);
  const updated: StoredPackageGroup = {
    ...grp,
    description:
      input["description"] !== undefined
        ? stringOrUndefined(input["description"])
        : grp.description,
    contactInfo:
      input["contactInfo"] !== undefined
        ? stringOrUndefined(input["contactInfo"])
        : grp.contactInfo,
  };
  ctx.store.set(pkgGrpKey(domain, pattern), updated);
  return { packageGroup: pkgGrpView(updated) };
};

const UpdatePackageGroupOriginConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  const grp = requirePkgGrp(ctx, domain, pattern);
  const restrictions = (input["restrictions"] as Record<string, unknown>) ?? {};
  const mergedRestrictions: Record<string, { restrictionMode: string }> = {
    ...grp.originConfiguration.restrictions,
  };
  for (const [k, v] of Object.entries(restrictions)) {
    if (typeof v === "object" && v !== null && "restrictionMode" in v) {
      mergedRestrictions[k] = {
        restrictionMode: String(
          (v as Record<string, unknown>)["restrictionMode"],
        ),
      };
    }
  }
  const updated: StoredPackageGroup = {
    ...grp,
    originConfiguration: { restrictions: mergedRestrictions },
  };
  ctx.store.set(pkgGrpKey(domain, pattern), updated);
  return { packageGroup: pkgGrpView(updated) };
};

const ListPackageGroups: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const grps = listPkgGrps(ctx, domain);
  return { packageGroups: grps.slice(0, max).map(pkgGrpView) };
};

const ListSubPackageGroups: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const parentPattern = requireString(input, "packageGroup");
  requirePkgGrp(ctx, domain, parentPattern);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const grps = listPkgGrps(ctx, domain).filter(
    (g) => g.pattern !== parentPattern && g.pattern.startsWith(parentPattern),
  );
  return { packageGroups: grps.slice(0, max).map(pkgGrpView) };
};

const GetAssociatedPackageGroup: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const format = requireString(input, "format");
  const pkg = requireString(input, "package");
  const ns = stringOrUndefined(input["namespace"]);
  requireDomain(ctx, domain);
  const grps = listPkgGrps(ctx, domain);
  const pkgPath = ns ? `${format}/${ns}/${pkg}` : `${format}/${pkg}`;
  const matching = grps
    .filter((g) => {
      const pat = g.pattern.startsWith("$") ? g.pattern.slice(1) : g.pattern;
      return pkgPath.startsWith(pat.replace(/^\//, ""));
    })
    .sort((a, b) => b.pattern.length - a.pattern.length);
  if (matching.length === 0) {
    return { packageGroup: undefined, associationType: undefined };
  }
  return {
    packageGroup: pkgGrpView(matching[0]),
    associationType: "STRONG",
  };
};

const ListAssociatedPackages: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  requirePkgGrp(ctx, domain, pattern);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  return { packages: [], nextToken: undefined };
  void max;
};

const ListAllowedRepositoriesForGroup: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const pattern = requireString(input, "packageGroup");
  requirePkgGrp(ctx, domain, pattern);
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  return { allowedRepositories: [], nextToken: undefined };
  void max;
};

const GetAuthorizationToken: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const expiration = new Date(Date.now() + 12 * 3600 * 1000);
  return {
    authorizationToken: `token-${domain}-${ctx.account}-${ctx.region}`,
    expiration,
  };
};

const GetDomainPermissionsPolicy: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const policy = ctx.store.get<StoredPolicy>(domainPolicyKey(domain));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for domain ${domain}.`,
      404,
    );
  }
  return {
    policy: {
      resourceArn: policy.resourceArn,
      revision: policy.revision,
      document: policy.document,
    },
  };
};

const PutDomainPermissionsPolicy: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const policyDocument = requireString(input, "policyDocument");
  requireDomain(ctx, domain);
  const arn = domainArn(ctx.account, ctx.region, domain);
  const policy: StoredPolicy = {
    resourceArn: arn,
    revision: `${Date.now()}`,
    document: policyDocument,
  };
  ctx.store.set(domainPolicyKey(domain), policy);
  return {
    policy: {
      resourceArn: policy.resourceArn,
      revision: policy.revision,
      document: policy.document,
    },
  };
};

const DeleteDomainPermissionsPolicy: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const policy = ctx.store.get<StoredPolicy>(domainPolicyKey(domain));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for domain ${domain}.`,
      404,
    );
  }
  ctx.store.delete(domainPolicyKey(domain));
  return {
    policy: {
      resourceArn: policy.resourceArn,
      revision: policy.revision,
      document: policy.document,
    },
  };
};

const GetRepositoryPermissionsPolicy: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  requireRepo(ctx, domain, repo);
  const policy = ctx.store.get<StoredPolicy>(repoPolicyKey(domain, repo));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for repository ${repo}.`,
      404,
    );
  }
  return {
    policy: {
      resourceArn: policy.resourceArn,
      revision: policy.revision,
      document: policy.document,
    },
  };
};

const PutRepositoryPermissionsPolicy: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  const policyDocument = requireString(input, "policyDocument");
  requireRepo(ctx, domain, repo);
  const arn = repoArn(ctx.account, ctx.region, domain, repo);
  const policy: StoredPolicy = {
    resourceArn: arn,
    revision: `${Date.now()}`,
    document: policyDocument,
  };
  ctx.store.set(repoPolicyKey(domain, repo), policy);
  return {
    policy: {
      resourceArn: policy.resourceArn,
      revision: policy.revision,
      document: policy.document,
    },
  };
};

const DeleteRepositoryPermissionsPolicy: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  const repo = requireString(input, "repository");
  requireRepo(ctx, domain, repo);
  const policy = ctx.store.get<StoredPolicy>(repoPolicyKey(domain, repo));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for repository ${repo}.`,
      404,
    );
  }
  ctx.store.delete(repoPolicyKey(domain, repo));
  return {
    policy: {
      resourceArn: policy.resourceArn,
      revision: policy.revision,
      document: policy.document,
    },
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<StoredTag[]>(tagsKey(resourceArn)) ?? [];
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = Array.isArray(input["tags"])
    ? (input["tags"] as Array<{ key?: unknown; value?: unknown }>)
    : [];
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceArn)) ?? [];
  const merged = [...existing];
  for (const t of newTags) {
    const key = stringOrUndefined(t.key);
    const value = stringOrUndefined(t.value);
    if (key === undefined) continue;
    const idx = merged.findIndex((e) => e.key === key);
    if (idx >= 0) {
      merged[idx] = { key, value: value ?? "" };
    } else {
      merged.push({ key, value: value ?? "" });
    }
  }
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceArn)) ?? [];
  ctx.store.set(
    tagsKey(resourceArn),
    existing.filter((t) => !tagKeys.includes(t.key)),
  );
  return {};
};

const codeartifact = {
  name: "codeartifact",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1") return undefined;
    const len = parts.length;
    const m = req.method;

    if (len === 2) {
      switch (parts[1]) {
        case "domain":
          if (m === "POST") return "CreateDomain";
          if (m === "GET") return "DescribeDomain";
          if (m === "DELETE") return "DeleteDomain";
          return undefined;
        case "domains":
          if (m === "POST") return "ListDomains";
          return undefined;
        case "repository":
          if (m === "POST") return "CreateRepository";
          if (m === "GET") return "DescribeRepository";
          if (m === "DELETE") return "DeleteRepository";
          if (m === "PUT") return "UpdateRepository";
          return undefined;
        case "repositories":
          if (m === "POST") return "ListRepositories";
          return undefined;
        case "package":
          if (m === "GET") return "DescribePackage";
          if (m === "DELETE") return "DeletePackage";
          if (m === "POST") return "PutPackageOriginConfiguration";
          return undefined;
        case "packages":
          if (m === "POST") return "ListPackages";
          return undefined;
        case "package-group":
          if (m === "POST") return "CreatePackageGroup";
          if (m === "GET") return "DescribePackageGroup";
          if (m === "DELETE") return "DeletePackageGroup";
          if (m === "PUT") return "UpdatePackageGroup";
          return undefined;
        case "package-groups":
          if (m === "POST") return "ListPackageGroups";
          return undefined;
        case "package-group-allowed-repositories":
          if (m === "GET") return "ListAllowedRepositoriesForGroup";
          return undefined;
        case "package-group-origin-configuration":
          if (m === "PUT") return "UpdatePackageGroupOriginConfiguration";
          return undefined;
        case "get-associated-package-group":
          if (m === "GET") return "GetAssociatedPackageGroup";
          return undefined;
        case "list-associated-packages":
          if (m === "GET") return "ListAssociatedPackages";
          return undefined;
        case "authorization-token":
          if (m === "POST") return "GetAuthorizationToken";
          return undefined;
        case "tags":
          if (m === "POST") return "ListTagsForResource";
          return undefined;
        case "tag":
          if (m === "POST") return "TagResource";
          return undefined;
        case "untag":
          if (m === "POST") return "UntagResource";
          return undefined;
      }
      return undefined;
    }

    if (len === 3) {
      if (parts[1] === "domain" && parts[2] === "repositories") {
        if (m === "POST") return "ListRepositoriesInDomain";
        return undefined;
      }
      if (parts[1] === "repository" && parts[2] === "external-connection") {
        if (m === "POST") return "AssociateExternalConnection";
        if (m === "DELETE") return "DisassociateExternalConnection";
        return undefined;
      }
      if (parts[1] === "repository" && parts[2] === "endpoint") {
        if (m === "GET") return "GetRepositoryEndpoint";
        return undefined;
      }
      if (parts[1] === "package" && parts[2] === "version") {
        if (m === "GET") return "DescribePackageVersion";
        return undefined;
      }
      if (parts[1] === "package" && parts[2] === "versions") {
        if (m === "POST") return "ListPackageVersions";
        return undefined;
      }
      if (parts[1] === "package-groups" && parts[2] === "sub-groups") {
        if (m === "POST") return "ListSubPackageGroups";
        return undefined;
      }
      return undefined;
    }

    if (len === 4) {
      if (
        parts[1] === "domain" &&
        parts[2] === "permissions" &&
        parts[3] === "policy"
      ) {
        if (m === "GET") return "GetDomainPermissionsPolicy";
        if (m === "PUT") return "PutDomainPermissionsPolicy";
        if (m === "DELETE") return "DeleteDomainPermissionsPolicy";
        return undefined;
      }
      if (
        parts[1] === "repository" &&
        parts[2] === "permissions" &&
        parts[3] === "policy"
      ) {
        if (m === "GET") return "GetRepositoryPermissionsPolicy";
        if (m === "PUT") return "PutRepositoryPermissionsPolicy";
        return undefined;
      }
      if (
        parts[1] === "repository" &&
        parts[2] === "permissions" &&
        parts[3] === "policies"
      ) {
        if (m === "DELETE") return "DeleteRepositoryPermissionsPolicy";
        return undefined;
      }
      if (parts[1] === "package" && parts[2] === "version") {
        switch (parts[3]) {
          case "asset":
            if (m === "GET") return "GetPackageVersionAsset";
            return undefined;
          case "readme":
            if (m === "GET") return "GetPackageVersionReadme";
            return undefined;
          case "assets":
            if (m === "POST") return "ListPackageVersionAssets";
            return undefined;
          case "dependencies":
            if (m === "POST") return "ListPackageVersionDependencies";
            return undefined;
          case "publish":
            if (m === "POST") return "PublishPackageVersion";
            return undefined;
        }
        return undefined;
      }
      if (parts[1] === "package" && parts[2] === "versions") {
        switch (parts[3]) {
          case "copy":
            if (m === "POST") return "CopyPackageVersions";
            return undefined;
          case "delete":
            if (m === "POST") return "DeletePackageVersions";
            return undefined;
          case "dispose":
            if (m === "POST") return "DisposePackageVersions";
            return undefined;
          case "update_status":
            if (m === "POST") return "UpdatePackageVersionsStatus";
            return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateDomain,
    DescribeDomain,
    ListDomains,
    DeleteDomain,
    CreateRepository,
    DescribeRepository,
    DeleteRepository,
    UpdateRepository,
    ListRepositories,
    ListRepositoriesInDomain,
    AssociateExternalConnection,
    DisassociateExternalConnection,
    GetRepositoryEndpoint,
    DescribePackage,
    DeletePackage,
    ListPackages,
    PutPackageOriginConfiguration,
    DescribePackageVersion,
    DeletePackageVersions,
    DisposePackageVersions,
    CopyPackageVersions,
    UpdatePackageVersionsStatus,
    ListPackageVersions,
    ListPackageVersionAssets,
    ListPackageVersionDependencies,
    GetPackageVersionAsset,
    GetPackageVersionReadme,
    PublishPackageVersion,
    CreatePackageGroup,
    DescribePackageGroup,
    DeletePackageGroup,
    UpdatePackageGroup,
    UpdatePackageGroupOriginConfiguration,
    ListPackageGroups,
    ListSubPackageGroups,
    GetAssociatedPackageGroup,
    ListAssociatedPackages,
    ListAllowedRepositoriesForGroup,
    GetAuthorizationToken,
    GetDomainPermissionsPolicy,
    PutDomainPermissionsPolicy,
    DeleteDomainPermissionsPolicy,
    GetRepositoryPermissionsPolicy,
    PutRepositoryPermissionsPolicy,
    DeleteRepositoryPermissionsPolicy,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default codeartifact;
