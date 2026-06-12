import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFrontClient,
  CreateAnycastIpListCommand,
  GetAnycastIpListCommand,
  ListAnycastIpListsCommand,
  UpdateAnycastIpListCommand,
  DeleteAnycastIpListCommand,
  CreateConnectionGroupCommand,
  GetConnectionGroupCommand,
  ListConnectionGroupsCommand,
  UpdateConnectionGroupCommand,
  DeleteConnectionGroupCommand,
  CreateConnectionFunctionCommand,
  GetConnectionFunctionCommand,
  DescribeConnectionFunctionCommand,
  ListConnectionFunctionsCommand,
  UpdateConnectionFunctionCommand,
  PublishConnectionFunctionCommand,
  TestConnectionFunctionCommand,
  DeleteConnectionFunctionCommand,
  CreateContinuousDeploymentPolicyCommand,
  GetContinuousDeploymentPolicyCommand,
  GetContinuousDeploymentPolicyConfigCommand,
  ListContinuousDeploymentPoliciesCommand,
  UpdateContinuousDeploymentPolicyCommand,
  DeleteContinuousDeploymentPolicyCommand,
  CreateDistributionTenantCommand,
  GetDistributionTenantCommand,
  ListDistributionTenantsCommand,
  UpdateDistributionTenantCommand,
  DeleteDistributionTenantCommand,
  CreateDistributionCommand,
  CreateFieldLevelEncryptionProfileCommand,
  GetFieldLevelEncryptionProfileCommand,
  GetFieldLevelEncryptionProfileConfigCommand,
  ListFieldLevelEncryptionProfilesCommand,
  UpdateFieldLevelEncryptionProfileCommand,
  DeleteFieldLevelEncryptionProfileCommand,
  CreateFieldLevelEncryptionConfigCommand,
  GetFieldLevelEncryptionCommand,
  GetFieldLevelEncryptionConfigCommand,
  ListFieldLevelEncryptionConfigsCommand,
  UpdateFieldLevelEncryptionConfigCommand,
  DeleteFieldLevelEncryptionConfigCommand,
  CreateKeyGroupCommand,
  GetKeyGroupCommand,
  GetKeyGroupConfigCommand,
  ListKeyGroupsCommand,
  UpdateKeyGroupCommand,
  DeleteKeyGroupCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-cloudfront";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudfront = () =>
  new CloudFrontClient({ endpoint, region, credentials, requestHandler });

test("AnycastIpList lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateAnycastIpListCommand({ Name: "test-list", IpCount: 3 }),
  );
  const id = created.AnycastIpList?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();
  expect(created.AnycastIpList?.Name).toBe("test-list");

  const got = await client.send(new GetAnycastIpListCommand({ Id: id! }));
  expect(got.AnycastIpList?.Id).toBe(id);

  const list = await client.send(new ListAnycastIpListsCommand({}));
  expect(list.AnycastIpLists?.Items?.some((i) => i.Id === id)).toBe(true);

  const updated = await client.send(
    new UpdateAnycastIpListCommand({ Id: id!, IfMatch: got.ETag }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteAnycastIpListCommand({ Id: id!, IfMatch: updated.ETag }),
  );
});

test("ConnectionGroup lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateConnectionGroupCommand({ Name: "test-cg" }),
  );
  const id = created.ConnectionGroup?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetConnectionGroupCommand({ Identifier: id! }),
  );
  expect(got.ConnectionGroup?.Id).toBe(id);

  const list = await client.send(new ListConnectionGroupsCommand({}));
  expect(list.ConnectionGroups?.some((i) => i.Id === id)).toBe(true);

  const updated = await client.send(
    new UpdateConnectionGroupCommand({
      Id: id!,
      IfMatch: got.ETag!,
      Ipv6Enabled: false,
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteConnectionGroupCommand({ Id: id!, IfMatch: updated.ETag }),
  );
});

test("ConnectionFunction lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateConnectionFunctionCommand({
      Name: "test-cf",
      ConnectionFunctionCode: Buffer.from("function handler() {}"),
      ConnectionFunctionConfig: {
        Comment: "test",
        Runtime: "cloudfront-js-2.0" as const,
      },
    }),
  );
  const id = created.ConnectionFunctionSummary?.Id ?? "";
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetConnectionFunctionCommand({ Identifier: id }),
  );
  expect(got.ETag).toBeTruthy();

  const described = await client.send(
    new DescribeConnectionFunctionCommand({ Identifier: id }),
  );
  expect(described.ConnectionFunctionSummary?.Id).toBe(id);

  const list = await client.send(new ListConnectionFunctionsCommand({}));
  expect((list.ConnectionFunctions?.length ?? 0) > 0).toBe(true);

  const updated = await client.send(
    new UpdateConnectionFunctionCommand({
      Id: id,
      IfMatch: got.ETag,
      ConnectionFunctionCode: Buffer.from("function handler2() {}"),
      ConnectionFunctionConfig: {
        Comment: "updated",
        Runtime: "cloudfront-js-2.0" as const,
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new PublishConnectionFunctionCommand({ Id: id, IfMatch: updated.ETag }),
  );

  await client.send(
    new TestConnectionFunctionCommand({
      Id: id,
      IfMatch: updated.ETag,
      Stage: "DEVELOPMENT",
      ConnectionObject: Buffer.from("{}"),
    }),
  );

  const deleteGet = await client.send(
    new DescribeConnectionFunctionCommand({ Identifier: id }),
  );
  await client.send(
    new DeleteConnectionFunctionCommand({ Id: id, IfMatch: deleteGet.ETag }),
  );
});

test("ContinuousDeploymentPolicy lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateContinuousDeploymentPolicyCommand({
      ContinuousDeploymentPolicyConfig: {
        Enabled: true,
        StagingDistributionDnsNames: { Quantity: 0, Items: [] },
      },
    }),
  );
  const id = created.ContinuousDeploymentPolicy?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetContinuousDeploymentPolicyCommand({ Id: id! }),
  );
  expect(got.ContinuousDeploymentPolicy?.Id).toBe(id);

  const gotConfig = await client.send(
    new GetContinuousDeploymentPolicyConfigCommand({ Id: id! }),
  );
  expect(gotConfig.ContinuousDeploymentPolicyConfig).toBeTruthy();

  const list = await client.send(
    new ListContinuousDeploymentPoliciesCommand({}),
  );
  expect(
    list.ContinuousDeploymentPolicyList?.Items?.some(
      (i) => i.ContinuousDeploymentPolicy?.Id === id,
    ),
  ).toBe(true);

  const updated = await client.send(
    new UpdateContinuousDeploymentPolicyCommand({
      Id: id!,
      IfMatch: got.ETag,
      ContinuousDeploymentPolicyConfig: {
        Enabled: false,
        StagingDistributionDnsNames: { Quantity: 0, Items: [] },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteContinuousDeploymentPolicyCommand({
      Id: id!,
      IfMatch: updated.ETag,
    }),
  );
});

test("DistributionTenant lifecycle", async () => {
  const client = cloudfront();

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: `tenant-test-${Date.now()}`,
        Comment: "tenant test",
        Enabled: true,
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: "origin-1",
              DomainName: "example.com",
              CustomOriginConfig: {
                HTTPPort: 80,
                HTTPSPort: 443,
                OriginProtocolPolicy: "https-only",
              },
            },
          ],
        },
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: "redirect-to-https",
          CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
          TargetOriginId: "origin-1",
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: "none" },
          },
          MinTTL: 0,
        },
      },
    }),
  );
  const distId = dist.Distribution?.Id!;

  const created = await client.send(
    new CreateDistributionTenantCommand({
      DistributionId: distId,
      Name: "test-tenant",
      Domains: [{ Domain: "tenant.example.com" }],
    }),
  );
  const id = created.DistributionTenant?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetDistributionTenantCommand({ Identifier: id! }),
  );
  expect(got.DistributionTenant?.Id).toBe(id);

  const list = await client.send(
    new ListDistributionTenantsCommand({
      AssociationFilter: { DistributionId: distId },
    }),
  );
  expect(list.DistributionTenantList?.some((i) => i.Id === id)).toBe(true);

  const updated = await client.send(
    new UpdateDistributionTenantCommand({
      Id: id!,
      IfMatch: got.ETag,
      Domains: [{ Domain: "tenant2.example.com" }],
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteDistributionTenantCommand({ Id: id!, IfMatch: updated.ETag }),
  );
});

test("FieldLevelEncryptionProfile lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateFieldLevelEncryptionProfileCommand({
      FieldLevelEncryptionProfileConfig: {
        Name: "test-flep",
        CallerReference: `flep-test-${Date.now()}`,
        EncryptionEntities: { Quantity: 0, Items: [] },
      },
    }),
  );
  const id = created.FieldLevelEncryptionProfile?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetFieldLevelEncryptionProfileCommand({ Id: id! }),
  );
  expect(got.FieldLevelEncryptionProfile?.Id).toBe(id);

  const gotConfig = await client.send(
    new GetFieldLevelEncryptionProfileConfigCommand({ Id: id! }),
  );
  expect(gotConfig.FieldLevelEncryptionProfileConfig).toBeTruthy();

  const list = await client.send(
    new ListFieldLevelEncryptionProfilesCommand({}),
  );
  expect(
    list.FieldLevelEncryptionProfileList?.Items?.some((i) => i.Id === id),
  ).toBe(true);

  const updated = await client.send(
    new UpdateFieldLevelEncryptionProfileCommand({
      Id: id!,
      IfMatch: got.ETag,
      FieldLevelEncryptionProfileConfig: {
        Name: "test-flep-updated",
        CallerReference: `flep-test-${Date.now()}`,
        EncryptionEntities: { Quantity: 0, Items: [] },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteFieldLevelEncryptionProfileCommand({
      Id: id!,
      IfMatch: updated.ETag,
    }),
  );
});

test("FieldLevelEncryptionConfig lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateFieldLevelEncryptionConfigCommand({
      FieldLevelEncryptionConfig: {
        CallerReference: `fle-test-${Date.now()}`,
        QueryArgProfileConfig: { ForwardWhenQueryArgProfileIsUnknown: true },
        ContentTypeProfileConfig: { ForwardWhenContentTypeIsUnknown: true },
      },
    }),
  );
  const id = created.FieldLevelEncryption?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetFieldLevelEncryptionCommand({ Id: id! }),
  );
  expect(got.FieldLevelEncryption?.Id).toBe(id);

  const gotConfig = await client.send(
    new GetFieldLevelEncryptionConfigCommand({ Id: id! }),
  );
  expect(gotConfig.FieldLevelEncryptionConfig).toBeTruthy();

  const list = await client.send(
    new ListFieldLevelEncryptionConfigsCommand({}),
  );
  expect(list.FieldLevelEncryptionList?.Items?.some((i) => i.Id === id)).toBe(
    true,
  );

  const updated = await client.send(
    new UpdateFieldLevelEncryptionConfigCommand({
      Id: id!,
      IfMatch: got.ETag,
      FieldLevelEncryptionConfig: {
        CallerReference: `fle-test-updated-${Date.now()}`,
        QueryArgProfileConfig: { ForwardWhenQueryArgProfileIsUnknown: false },
        ContentTypeProfileConfig: { ForwardWhenContentTypeIsUnknown: false },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteFieldLevelEncryptionConfigCommand({
      Id: id!,
      IfMatch: updated.ETag,
    }),
  );
});

test("KeyGroup lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateKeyGroupCommand({
      KeyGroupConfig: {
        Name: "test-kg",
        Items: ["key1"],
      },
    }),
  );
  const id = created.KeyGroup?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(new GetKeyGroupCommand({ Id: id! }));
  expect(got.KeyGroup?.Id).toBe(id);

  const gotConfig = await client.send(
    new GetKeyGroupConfigCommand({ Id: id! }),
  );
  expect(gotConfig.KeyGroupConfig).toBeTruthy();

  const list = await client.send(new ListKeyGroupsCommand({}));
  expect(list.KeyGroupList?.Items?.some((i) => i.KeyGroup?.Id === id)).toBe(
    true,
  );

  const updated = await client.send(
    new UpdateKeyGroupCommand({
      Id: id!,
      IfMatch: got.ETag,
      KeyGroupConfig: { Name: "test-kg-updated", Items: ["key1", "key2"] },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteKeyGroupCommand({ Id: id!, IfMatch: updated.ETag }),
  );
});

test("TagResource lifecycle", async () => {
  const client = cloudfront();

  const resource = "arn:aws:cloudfront::123456789012:distribution/TEST123";

  await client.send(
    new TagResourceCommand({
      Resource: resource,
      Tags: {
        Items: [
          { Key: "env", Value: "test" },
          { Key: "app", Value: "myapp" },
        ],
      },
    }),
  );

  const list = await client.send(
    new ListTagsForResourceCommand({ Resource: resource }),
  );
  expect(
    list.Tags?.Items?.some((t) => t.Key === "env" && t.Value === "test"),
  ).toBe(true);
  expect(
    list.Tags?.Items?.some((t) => t.Key === "app" && t.Value === "myapp"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({
      Resource: resource,
      TagKeys: { Items: ["app"] },
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ Resource: resource }),
  );
  expect(afterUntag.Tags?.Items?.some((t) => t.Key === "env")).toBe(true);
  expect(afterUntag.Tags?.Items?.some((t) => t.Key === "app")).toBe(false);
});
