import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptInboundConnectionCommand,
  AddDataSourceCommand,
  AddTagsCommand,
  AssociatePackageCommand,
  CreateApplicationCommand,
  CreateDomainCommand,
  CreateIndexCommand,
  CreateOutboundConnectionCommand,
  CreatePackageCommand,
  CreateVpcEndpointCommand,
  DeleteApplicationCommand,
  DeleteDataSourceCommand,
  DeleteDomainCommand,
  DeleteIndexCommand,
  DeleteOutboundConnectionCommand,
  DeletePackageCommand,
  DeleteVpcEndpointCommand,
  DescribeDomainsCommand,
  DescribeInboundConnectionsCommand,
  DescribeOutboundConnectionsCommand,
  DescribePackagesCommand,
  DescribeVpcEndpointsCommand,
  GetApplicationCommand,
  GetDataSourceCommand,
  GetIndexCommand,
  ListApplicationsCommand,
  ListDataSourcesCommand,
  ListDomainNamesCommand,
  ListDomainsForPackageCommand,
  ListTagsCommand,
  ListVersionsCommand,
  ListVpcEndpointsCommand,
  OpenSearchClient,
  RemoveTagsCommand,
  UpdateApplicationCommand,
  UpdateDomainConfigCommand,
} from "@aws-sdk/client-opensearch";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const opensearch = () =>
  new OpenSearchClient({ endpoint, region, credentials, requestHandler });

test("OpenSearch domain roundtrip", async () => {
  const client = opensearch();
  const domainName = `bunsai-e2e-${Date.now()}`.slice(0, 28).toLowerCase();

  const created = await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      EngineVersion: "OpenSearch_2.11",
      ClusterConfig: { InstanceType: "t3.small.search", InstanceCount: 1 },
      EBSOptions: { EBSEnabled: true, VolumeType: "gp3", VolumeSize: 10 },
    }),
  );
  expect(created.DomainStatus?.DomainName).toBe(domainName);
  expect(created.DomainStatus?.ARN).toContain(`:domain/${domainName}`);
  expect(created.DomainStatus?.Created).toBe(true);
  expect(created.DomainStatus?.Processing).toBe(false);
  expect(created.DomainStatus?.Endpoint).toBeTruthy();

  const described = await client.send(
    new DescribeDomainsCommand({ DomainNames: [domainName] }),
  );
  expect((described.DomainStatusList ?? []).map((d) => d.DomainName)).toContain(
    domainName,
  );

  const listed = await client.send(new ListDomainNamesCommand({}));
  expect((listed.DomainNames ?? []).map((d) => d.DomainName)).toContain(
    domainName,
  );

  const updated = await client.send(
    new UpdateDomainConfigCommand({
      DomainName: domainName,
      ClusterConfig: { InstanceType: "t3.medium.search", InstanceCount: 2 },
    }),
  );
  expect(
    (updated.DomainConfig?.ClusterConfig?.Options as { InstanceCount?: number })
      ?.InstanceCount,
  ).toBe(2);

  const deleted = await client.send(
    new DeleteDomainCommand({ DomainName: domainName }),
  );
  expect(deleted.DomainStatus?.Deleted).toBe(true);

  await expect(
    client.send(new DescribeDomainsCommand({ DomainNames: [domainName] })),
  ).resolves.toMatchObject({ DomainStatusList: [] });
});

test("OpenSearch application lifecycle", async () => {
  const client = opensearch();

  const created = await client.send(
    new CreateApplicationCommand({ name: "test-app" }),
  );
  expect(created.id).toBeTruthy();
  expect(created.name).toBe("test-app");

  const appId = created.id!;

  const got = await client.send(new GetApplicationCommand({ id: appId }));
  expect(got.id).toBe(appId);
  expect(got.status).toBe("ACTIVE");

  const apps = await client.send(new ListApplicationsCommand({}));
  expect((apps.ApplicationSummaries ?? []).some((a) => a.id === appId)).toBe(
    true,
  );

  const updated = await client.send(
    new UpdateApplicationCommand({ id: appId }),
  );
  expect(updated.id).toBe(appId);

  await client.send(new DeleteApplicationCommand({ id: appId }));
  await expect(
    client.send(new GetApplicationCommand({ id: appId })),
  ).rejects.toThrow();
});

test("OpenSearch package create/associate/list/delete lifecycle", async () => {
  const client = opensearch();
  const domainName = `pkg-domain-${Date.now()}`.slice(0, 28).toLowerCase();

  await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      EngineVersion: "OpenSearch_2.11",
    }),
  );

  const pkg = await client.send(
    new CreatePackageCommand({
      PackageName: "test-dictionary",
      PackageType: "TXT-DICTIONARY",
      PackageSource: {
        S3BucketName: "my-bucket",
        S3Key: "dict.txt",
      },
    }),
  );
  expect(pkg.PackageDetails?.PackageID).toBeTruthy();
  const packageId = pkg.PackageDetails!.PackageID!;

  const assoc = await client.send(
    new AssociatePackageCommand({
      PackageID: packageId,
      DomainName: domainName,
    }),
  );
  expect(assoc.DomainPackageDetails?.DomainPackageStatus).toBe("ACTIVE");

  const domains = await client.send(
    new ListDomainsForPackageCommand({ PackageID: packageId }),
  );
  expect(
    (domains.DomainPackageDetailsList ?? []).some(
      (d) => d.DomainName === domainName,
    ),
  ).toBe(true);

  await client.send(new DeletePackageCommand({ PackageID: packageId }));

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));
});

test("OpenSearch VPC endpoint lifecycle", async () => {
  const client = opensearch();
  const domainName = `vpc-domain-${Date.now()}`.slice(0, 28).toLowerCase();

  await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      EngineVersion: "OpenSearch_2.11",
    }),
  );

  const domainArn = `arn:aws:es:us-east-1:000000000000:domain/${domainName}`;

  const ep = await client.send(
    new CreateVpcEndpointCommand({
      DomainArn: domainArn,
      VpcOptions: { SubnetIds: ["subnet-123"], SecurityGroupIds: ["sg-456"] },
    }),
  );
  expect(ep.VpcEndpoint?.VpcEndpointId).toBeTruthy();
  expect(ep.VpcEndpoint?.Status).toBe("CREATING");
  const vpcEndpointId = ep.VpcEndpoint!.VpcEndpointId!;

  const listed = await client.send(new ListVpcEndpointsCommand({}));
  expect(
    (listed.VpcEndpointSummaryList ?? []).some(
      (e) => e.VpcEndpointId === vpcEndpointId,
    ),
  ).toBe(true);

  const described = await client.send(
    new DescribeVpcEndpointsCommand({ VpcEndpointIds: [vpcEndpointId] }),
  );
  expect(described.VpcEndpoints?.[0]?.Status).toBe("ACTIVE");

  await client.send(
    new DeleteVpcEndpointCommand({ VpcEndpointId: vpcEndpointId }),
  );

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));
});

test("OpenSearch inbound/outbound connection lifecycle", async () => {
  const client = opensearch();

  const conn = await client.send(
    new CreateOutboundConnectionCommand({
      LocalDomainInfo: {
        AWSDomainInformation: {
          DomainName: "local-domain",
          OwnerId: "000000000000",
          Region: "us-east-1",
        },
      },
      RemoteDomainInfo: {
        AWSDomainInformation: {
          DomainName: "remote-domain",
          OwnerId: "111111111111",
          Region: "us-west-2",
        },
      },
      ConnectionAlias: "test-connection",
    }),
  );
  expect(conn.ConnectionId).toBeTruthy();
  const connectionId = conn.ConnectionId!;

  const outbounds = await client.send(
    new DescribeOutboundConnectionsCommand({}),
  );
  expect(
    (outbounds.Connections ?? []).some((c) => c.ConnectionId === connectionId),
  ).toBe(true);

  const inbounds = await client.send(new DescribeInboundConnectionsCommand({}));
  expect((inbounds.Connections ?? []).length).toBeGreaterThan(0);
  const inboundConnectionId = inbounds.Connections![0]!.ConnectionId!;

  const accepted = await client.send(
    new AcceptInboundConnectionCommand({ ConnectionId: inboundConnectionId }),
  );
  expect(accepted.Connection?.ConnectionStatus?.StatusCode).toBe("ACTIVE");

  await client.send(
    new DeleteOutboundConnectionCommand({ ConnectionId: connectionId }),
  );
});

test("OpenSearch data source lifecycle", async () => {
  const client = opensearch();
  const domainName = `ds-domain-${Date.now()}`.slice(0, 28).toLowerCase();

  await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      EngineVersion: "OpenSearch_2.11",
    }),
  );

  await client.send(
    new AddDataSourceCommand({
      DomainName: domainName,
      Name: "my-s3-source",
      DataSourceType: {
        S3GlueDataCatalog: {
          RoleArn: "arn:aws:iam::000000000000:role/os-role",
        },
      },
      Description: "My S3 data source",
    }),
  );

  const got = await client.send(
    new GetDataSourceCommand({ DomainName: domainName, Name: "my-s3-source" }),
  );
  expect(got.Name).toBe("my-s3-source");
  expect(got.Status).toBe("ACTIVE");

  const sources = await client.send(
    new ListDataSourcesCommand({ DomainName: domainName }),
  );
  expect(
    (sources.DataSources ?? []).some((s) => s.Name === "my-s3-source"),
  ).toBe(true);

  await client.send(
    new DeleteDataSourceCommand({
      DomainName: domainName,
      Name: "my-s3-source",
    }),
  );

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));
});

test("OpenSearch index lifecycle", async () => {
  const client = opensearch();
  const domainName = `idx-domain-${Date.now()}`.slice(0, 28).toLowerCase();

  await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      EngineVersion: "OpenSearch_2.11",
    }),
  );

  await client.send(
    new CreateIndexCommand({
      DomainName: domainName,
      IndexName: "my-index",
      IndexSchema: {},
    }),
  );

  const got = await client.send(
    new GetIndexCommand({ DomainName: domainName, IndexName: "my-index" }),
  );
  expect(got.IndexSchema).toBeDefined();

  await client.send(
    new DeleteIndexCommand({ DomainName: domainName, IndexName: "my-index" }),
  );

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));
});

test("OpenSearch tags add/list/remove lifecycle", async () => {
  const client = opensearch();
  const arn = "arn:aws:es:us-east-1:000000000000:domain/tag-test-domain";

  await client.send(
    new AddTagsCommand({
      ARN: arn,
      TagList: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const listed = await client.send(new ListTagsCommand({ ARN: arn }));
  const tagMap = Object.fromEntries(
    (listed.TagList ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("platform");

  await client.send(new RemoveTagsCommand({ ARN: arn, TagKeys: ["team"] }));

  const afterRemove = await client.send(new ListTagsCommand({ ARN: arn }));
  const afterMap = Object.fromEntries(
    (afterRemove.TagList ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(afterMap["env"]).toBe("test");
  expect(afterMap["team"]).toBeUndefined();
});

test("OpenSearch ResourceNotFoundException returns 404", async () => {
  const client = opensearch();
  try {
    await client.send(
      new DeleteDomainCommand({ DomainName: "nonexistent-domain-404-test" }),
    );
    expect.unreachable("should have thrown");
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    expect(e.name).toBe("ResourceNotFoundException");
    expect(e.$metadata?.httpStatusCode).toBe(404);
  }
});

test("OpenSearch VpcEndpoint lifecycle", async () => {
  const client = opensearch();
  const domainName = `vpc-domain-${Date.now()}`.slice(0, 28).toLowerCase();

  const created = await client.send(
    new CreateDomainCommand({ DomainName: domainName }),
  );
  const domainArn = created.DomainStatus!.ARN!;

  try {
    await client.send(
      new CreateVpcEndpointCommand({
        DomainArn: "arn:aws:es:us-east-1:000000000000:domain/nonexistent",
        VpcOptions: { SubnetIds: ["subnet-aaa"] },
      }),
    );
    expect.unreachable("should have thrown for missing domain");
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    expect(e.name).toBe("ResourceNotFoundException");
    expect(e.$metadata?.httpStatusCode).toBe(404);
  }

  const vpcCreated = await client.send(
    new CreateVpcEndpointCommand({
      DomainArn: domainArn,
      VpcOptions: { SubnetIds: ["subnet-aaa"] },
    }),
  );
  expect(vpcCreated.VpcEndpoint?.Status).toBe("CREATING");

  const vpcId = vpcCreated.VpcEndpoint!.VpcEndpointId!;

  const described = await client.send(
    new DescribeVpcEndpointsCommand({ VpcEndpointIds: [vpcId] }),
  );
  expect(described.VpcEndpoints?.[0]?.Status).toBe("ACTIVE");

  const deleted = await client.send(
    new DeleteVpcEndpointCommand({ VpcEndpointId: vpcId }),
  );
  expect(deleted.VpcEndpointSummary?.Status).toBe("DELETING");

  const afterDelete = await client.send(
    new DescribeVpcEndpointsCommand({ VpcEndpointIds: [vpcId] }),
  );
  expect(afterDelete.VpcEndpoints?.[0]?.Status).toBe("DELETING");

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));
});

test("OpenSearch ListVersions pagination", async () => {
  const client = opensearch();

  const page1 = await client.send(new ListVersionsCommand({ MaxResults: 2 }));
  expect(page1.Versions).toHaveLength(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListVersionsCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect(page2.Versions).toHaveLength(2);
  expect(page2.NextToken).toBeDefined();

  const page3 = await client.send(
    new ListVersionsCommand({ MaxResults: 2, NextToken: page2.NextToken }),
  );
  expect(page3.Versions).toHaveLength(1);
  expect(page3.NextToken).toBeUndefined();
});

test("OpenSearch DescribePackages filters", async () => {
  const client = opensearch();

  await client.send(
    new CreatePackageCommand({
      PackageName: "filter-pkg-1",
      PackageType: "TXT-DICTIONARY",
      PackageSource: {
        S3BucketName: "my-bucket",
        S3Key: "filter-pkg-1.txt",
      },
    }),
  );
  await client.send(
    new CreatePackageCommand({
      PackageName: "filter-pkg-2",
      PackageType: "ZIP-PLUGIN",
      PackageSource: {
        S3BucketName: "my-bucket",
        S3Key: "filter-pkg-2.zip",
      },
    }),
  );

  const byType = await client.send(
    new DescribePackagesCommand({
      Filters: [{ Name: "PackageType", Value: ["TXT-DICTIONARY"] }],
    }),
  );
  expect(
    (byType.PackageDetailsList ?? []).every(
      (p) => p.PackageType === "TXT-DICTIONARY",
    ),
  ).toBe(true);
  expect(
    (byType.PackageDetailsList ?? []).some(
      (p) => p.PackageName === "filter-pkg-1",
    ),
  ).toBe(true);

  const byName = await client.send(
    new DescribePackagesCommand({
      Filters: [{ Name: "PackageName", Value: ["filter-pkg-2"] }],
    }),
  );
  expect(byName.PackageDetailsList).toHaveLength(1);
  expect(byName.PackageDetailsList?.[0]?.PackageName).toBe("filter-pkg-2");
});

test("OpenSearch index status lifecycle", async () => {
  const client = opensearch();
  const domainName = `idx-status-${Date.now()}`.slice(0, 28).toLowerCase();

  await client.send(new CreateDomainCommand({ DomainName: domainName }));

  const created = await client.send(
    new CreateIndexCommand({
      DomainName: domainName,
      IndexName: "status-idx",
      IndexSchema: { fields: [{ name: "id", type: "keyword" }] },
    }),
  );
  expect(created.Status).toBe("CREATED");

  const got = await client.send(
    new GetIndexCommand({ DomainName: domainName, IndexName: "status-idx" }),
  );
  expect(got.IndexSchema).toBeDefined();

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));
});

test("OpenSearch tag round-trip: CreateDomain with TagList, ListTags, DeleteDomain cleanup", async () => {
  const client = opensearch();
  const domainName = `tag-rt-${Date.now()}`.slice(0, 28).toLowerCase();

  const created = await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      TagList: [
        { Key: "Env", Value: "test" },
        { Key: "Owner", Value: "bunsai" },
      ],
    }),
  );
  const arn = created.DomainStatus!.ARN!;

  const tags = await client.send(new ListTagsCommand({ ARN: arn }));
  expect(tags.TagList).toHaveLength(2);
  expect(tags.TagList?.find((t) => t.Key === "Env")?.Value).toBe("test");
  expect(tags.TagList?.find((t) => t.Key === "Owner")?.Value).toBe("bunsai");

  await client.send(new DeleteDomainCommand({ DomainName: domainName }));

  const afterDelete = await client.send(new ListTagsCommand({ ARN: arn }));
  expect(afterDelete.TagList).toHaveLength(0);
});

test("OpenSearch CreateApplication clientToken idempotency and tagList", async () => {
  const client = opensearch();
  const token = `tok-${Date.now()}`;

  const first = await client.send(
    new CreateApplicationCommand({
      name: "idempotent-app",
      clientToken: token,
      tagList: [{ Key: "Project", Value: "bunsai" }],
    }),
  );
  expect(first.id).toBeTruthy();
  expect(first.tagList).toHaveLength(1);
  expect(first.tagList?.[0]?.Key).toBe("Project");

  const second = await client.send(
    new CreateApplicationCommand({
      name: "idempotent-app",
      clientToken: token,
    }),
  );
  expect(second.id).toBe(first.id);

  await client.send(new DeleteApplicationCommand({ id: first.id! }));

  const thirdAfterDelete = await client.send(
    new CreateApplicationCommand({
      name: "new-app",
      clientToken: token,
    }),
  );
  expect(thirdAfterDelete.id).toBeTruthy();
  expect(thirdAfterDelete.id).not.toBe(first.id);

  await client.send(new DeleteApplicationCommand({ id: thirdAfterDelete.id! }));
});

test("OpenSearch CreateOutboundConnection returns VALIDATING status", async () => {
  const client = opensearch();

  const conn = await client.send(
    new CreateOutboundConnectionCommand({
      LocalDomainInfo: {
        AWSDomainInformation: {
          DomainName: "local-validating",
          OwnerId: "000000000000",
          Region: "us-east-1",
        },
      },
      RemoteDomainInfo: {
        AWSDomainInformation: {
          DomainName: "remote-validating",
          OwnerId: "111111111111",
          Region: "us-west-2",
        },
      },
      ConnectionAlias: "validating-conn",
    }),
  );
  expect(conn.ConnectionStatus?.StatusCode).toBe("VALIDATING");

  const described = await client.send(
    new DescribeOutboundConnectionsCommand({
      Filters: [{ Name: "connection-id", Values: [conn.ConnectionId!] }],
    }),
  );
  expect(described.Connections?.[0]?.ConnectionStatus?.StatusCode).toBe(
    "PENDING_ACCEPTANCE",
  );

  await client.send(
    new DeleteOutboundConnectionCommand({ ConnectionId: conn.ConnectionId! }),
  );
});
