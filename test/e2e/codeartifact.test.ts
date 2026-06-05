import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CodeartifactClient,
  CreateDomainCommand,
  DeleteDomainCommand,
  DescribeDomainCommand,
  ListDomainsCommand,
  CreateRepositoryCommand,
  DescribeRepositoryCommand,
  DeleteRepositoryCommand,
  ListRepositoriesInDomainCommand,
  UpdateRepositoryCommand,
  AssociateExternalConnectionCommand,
  DisassociateExternalConnectionCommand,
  GetRepositoryEndpointCommand,
  PublishPackageVersionCommand,
  DescribePackageCommand,
  DescribePackageVersionCommand,
  ListPackagesCommand,
  ListPackageVersionsCommand,
  DeletePackageVersionsCommand,
  CreatePackageGroupCommand,
  DescribePackageGroupCommand,
  DeletePackageGroupCommand,
  ListPackageGroupsCommand,
  UpdatePackageGroupCommand,
  PutDomainPermissionsPolicyCommand,
  GetDomainPermissionsPolicyCommand,
  DeleteDomainPermissionsPolicyCommand,
  PutRepositoryPermissionsPolicyCommand,
  GetRepositoryPermissionsPolicyCommand,
  DeleteRepositoryPermissionsPolicyCommand,
  TagResourceCommand,
  UntagResourceCommand,
  ListTagsForResourceCommand,
  GetAuthorizationTokenCommand,
} from "@aws-sdk/client-codeartifact";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const codeartifact = () =>
  new CodeartifactClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("CodeArtifact domain roundtrip", async () => {
  const client = codeartifact();
  const domainName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDomainCommand({ domain: domainName }),
  );
  expect(created.domain?.name).toBe(domainName);
  expect(created.domain?.arn).toBeDefined();
  expect(created.domain?.status).toBe("Active");

  const described = await client.send(
    new DescribeDomainCommand({ domain: domainName }),
  );
  expect(described.domain?.name).toBe(domainName);
  expect(described.domain?.status).toBe("Active");

  const listed = await client.send(new ListDomainsCommand({}));
  expect((listed.domains ?? []).map((d) => d.name)).toContain(domainName);

  await client.send(new DeleteDomainCommand({ domain: domainName }));

  await expect(
    client.send(new DescribeDomainCommand({ domain: domainName })),
  ).rejects.toThrow();
});

test("CodeArtifact repository lifecycle", async () => {
  const client = codeartifact();
  const ts = Date.now();
  const domainName = `e2e-repo-dom-${ts}`;
  const repoName = `e2e-repo-${ts}`;

  await client.send(new CreateDomainCommand({ domain: domainName }));

  const created = await client.send(
    new CreateRepositoryCommand({ domain: domainName, repository: repoName }),
  );
  expect(created.repository?.name).toBe(repoName);
  expect(created.repository?.domainName).toBe(domainName);
  expect(created.repository?.arn).toBeDefined();

  const described = await client.send(
    new DescribeRepositoryCommand({
      domain: domainName,
      repository: repoName,
    }),
  );
  expect(described.repository?.name).toBe(repoName);

  const updated = await client.send(
    new UpdateRepositoryCommand({
      domain: domainName,
      repository: repoName,
      description: "updated description",
    }),
  );
  expect(updated.repository?.description).toBe("updated description");

  const listed = await client.send(
    new ListRepositoriesInDomainCommand({ domain: domainName }),
  );
  expect((listed.repositories ?? []).map((r) => r.name)).toContain(repoName);

  const withEc = await client.send(
    new AssociateExternalConnectionCommand({
      domain: domainName,
      repository: repoName,
      externalConnection: "public:npmjs",
    }),
  );
  expect(
    withEc.repository?.externalConnections?.some(
      (ec) => ec.externalConnectionName === "public:npmjs",
    ),
  ).toBe(true);

  const withoutEc = await client.send(
    new DisassociateExternalConnectionCommand({
      domain: domainName,
      repository: repoName,
      externalConnection: "public:npmjs",
    }),
  );
  expect(
    (withoutEc.repository?.externalConnections ?? []).some(
      (ec) => ec.externalConnectionName === "public:npmjs",
    ),
  ).toBe(false);

  const endpoint = await client.send(
    new GetRepositoryEndpointCommand({
      domain: domainName,
      repository: repoName,
      format: "npm",
    }),
  );
  expect(endpoint.repositoryEndpoint).toContain(domainName);

  await client.send(
    new DeleteRepositoryCommand({ domain: domainName, repository: repoName }),
  );

  await client.send(new DeleteDomainCommand({ domain: domainName }));
});

test("CodeArtifact package + package-version lifecycle", async () => {
  const client = codeartifact();
  const ts = Date.now();
  const domainName = `e2e-pkg-dom-${ts}`;
  const repoName = `e2e-pkg-repo-${ts}`;

  await client.send(new CreateDomainCommand({ domain: domainName }));
  await client.send(
    new CreateRepositoryCommand({ domain: domainName, repository: repoName }),
  );

  const published = await client.send(
    new PublishPackageVersionCommand({
      domain: domainName,
      repository: repoName,
      format: "generic",
      namespace: "myns",
      package: "mypkg",
      packageVersion: "1.0.0",
      assetName: "mypkg-1.0.0.tar.gz",
      assetContent: new TextEncoder().encode("hello"),
      assetSHA256:
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    }),
  );
  expect(published.version).toBe("1.0.0");
  expect(published.status).toBe("Published");

  const pkg = await client.send(
    new DescribePackageCommand({
      domain: domainName,
      repository: repoName,
      format: "generic",
      namespace: "myns",
      package: "mypkg",
    }),
  );
  expect(pkg.package?.name).toBe("mypkg");

  const pkgVer = await client.send(
    new DescribePackageVersionCommand({
      domain: domainName,
      repository: repoName,
      format: "generic",
      namespace: "myns",
      package: "mypkg",
      packageVersion: "1.0.0",
    }),
  );
  expect(pkgVer.packageVersion?.version).toBe("1.0.0");
  expect(pkgVer.packageVersion?.status).toBe("Published");

  const pkgs = await client.send(
    new ListPackagesCommand({ domain: domainName, repository: repoName }),
  );
  expect((pkgs.packages ?? []).some((p) => p.package === "mypkg")).toBe(true);

  const vers = await client.send(
    new ListPackageVersionsCommand({
      domain: domainName,
      repository: repoName,
      format: "generic",
      namespace: "myns",
      package: "mypkg",
    }),
  );
  expect((vers.versions ?? []).some((v) => v.version === "1.0.0")).toBe(true);

  await client.send(
    new DeletePackageVersionsCommand({
      domain: domainName,
      repository: repoName,
      format: "generic",
      namespace: "myns",
      package: "mypkg",
      versions: ["1.0.0"],
    }),
  );

  await client.send(
    new DeleteRepositoryCommand({ domain: domainName, repository: repoName }),
  );
  await client.send(new DeleteDomainCommand({ domain: domainName }));
});

test("CodeArtifact package-group lifecycle", async () => {
  const client = codeartifact();
  const ts = Date.now();
  const domainName = `e2e-grp-dom-${ts}`;
  const pattern = "/myns/*";

  await client.send(new CreateDomainCommand({ domain: domainName }));

  const created = await client.send(
    new CreatePackageGroupCommand({
      domain: domainName,
      packageGroup: pattern,
      description: "test group",
    }),
  );
  expect(created.packageGroup?.pattern).toBe(pattern);

  const described = await client.send(
    new DescribePackageGroupCommand({
      domain: domainName,
      packageGroup: pattern,
    }),
  );
  expect(described.packageGroup?.pattern).toBe(pattern);

  const updated = await client.send(
    new UpdatePackageGroupCommand({
      domain: domainName,
      packageGroup: pattern,
      description: "updated",
    }),
  );
  expect(updated.packageGroup?.description).toBe("updated");

  const listed = await client.send(
    new ListPackageGroupsCommand({ domain: domainName }),
  );
  expect((listed.packageGroups ?? []).some((g) => g.pattern === pattern)).toBe(
    true,
  );

  await client.send(
    new DeletePackageGroupCommand({
      domain: domainName,
      packageGroup: pattern,
    }),
  );

  await client.send(new DeleteDomainCommand({ domain: domainName }));
});

test("CodeArtifact permissions policy lifecycle", async () => {
  const client = codeartifact();
  const ts = Date.now();
  const domainName = `e2e-pol-dom-${ts}`;
  const repoName = `e2e-pol-repo-${ts}`;
  const policyDoc = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  await client.send(new CreateDomainCommand({ domain: domainName }));
  await client.send(
    new CreateRepositoryCommand({ domain: domainName, repository: repoName }),
  );

  const putDom = await client.send(
    new PutDomainPermissionsPolicyCommand({
      domain: domainName,
      policyDocument: policyDoc,
    }),
  );
  expect(putDom.policy?.document).toBe(policyDoc);

  const getDom = await client.send(
    new GetDomainPermissionsPolicyCommand({ domain: domainName }),
  );
  expect(getDom.policy?.document).toBe(policyDoc);

  await client.send(
    new DeleteDomainPermissionsPolicyCommand({ domain: domainName }),
  );

  const putRepo = await client.send(
    new PutRepositoryPermissionsPolicyCommand({
      domain: domainName,
      repository: repoName,
      policyDocument: policyDoc,
    }),
  );
  expect(putRepo.policy?.document).toBe(policyDoc);

  const getRepo = await client.send(
    new GetRepositoryPermissionsPolicyCommand({
      domain: domainName,
      repository: repoName,
    }),
  );
  expect(getRepo.policy?.document).toBe(policyDoc);

  await client.send(
    new DeleteRepositoryPermissionsPolicyCommand({
      domain: domainName,
      repository: repoName,
    }),
  );

  await client.send(
    new DeleteRepositoryCommand({ domain: domainName, repository: repoName }),
  );
  await client.send(new DeleteDomainCommand({ domain: domainName }));
});

test("CodeArtifact tags lifecycle", async () => {
  const client = codeartifact();
  const ts = Date.now();
  const domainName = `e2e-tag-dom-${ts}`;

  const domCreated = await client.send(
    new CreateDomainCommand({ domain: domainName }),
  );
  const arn = domCreated.domain?.arn ?? "";

  await client.send(
    new TagResourceCommand({
      resourceArn: arn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "platform" },
      ],
    }),
  );

  const tagged = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  const tagMap = Object.fromEntries(
    (tagged.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("platform");

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["team"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  const afterMap = Object.fromEntries(
    (afterUntag.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(afterMap["env"]).toBe("test");
  expect(afterMap["team"]).toBeUndefined();

  await client.send(new DeleteDomainCommand({ domain: domainName }));
});

test("CodeArtifact auth token and endpoint", async () => {
  const client = codeartifact();
  const ts = Date.now();
  const domainName = `e2e-auth-dom-${ts}`;
  const repoName = `e2e-auth-repo-${ts}`;

  await client.send(new CreateDomainCommand({ domain: domainName }));
  await client.send(
    new CreateRepositoryCommand({ domain: domainName, repository: repoName }),
  );

  const token = await client.send(
    new GetAuthorizationTokenCommand({ domain: domainName }),
  );
  expect(token.authorizationToken).toBeDefined();
  expect(token.expiration).toBeDefined();

  await client.send(
    new DeleteRepositoryCommand({ domain: domainName, repository: repoName }),
  );
  await client.send(new DeleteDomainCommand({ domain: domainName }));
});
