import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchCheckLayerAvailabilityCommand,
  BatchDeleteImageCommand,
  BatchGetImageCommand,
  BatchGetRepositoryScanningConfigurationCommand,
  CompleteLayerUploadCommand,
  CreatePullThroughCacheRuleCommand,
  CreateRepositoryCommand,
  CreateRepositoryCreationTemplateCommand,
  DeleteLifecyclePolicyCommand,
  DeletePullThroughCacheRuleCommand,
  DeleteRegistryPolicyCommand,
  DeleteRepositoryCommand,
  DeleteRepositoryCreationTemplateCommand,
  DeleteRepositoryPolicyCommand,
  DeleteSigningConfigurationCommand,
  DeregisterPullTimeUpdateExclusionCommand,
  DescribeImageReplicationStatusCommand,
  DescribeImageScanFindingsCommand,
  DescribeImageSigningStatusCommand,
  DescribeImagesCommand,
  DescribePullThroughCacheRulesCommand,
  DescribeRegistryCommand,
  DescribeRepositoriesCommand,
  DescribeRepositoryCreationTemplatesCommand,
  ECRClient,
  GetAccountSettingCommand,
  GetAuthorizationTokenCommand,
  GetDownloadUrlForLayerCommand,
  GetLifecyclePolicyCommand,
  GetLifecyclePolicyPreviewCommand,
  GetRegistryPolicyCommand,
  GetRegistryScanningConfigurationCommand,
  GetRepositoryPolicyCommand,
  GetSigningConfigurationCommand,
  InitiateLayerUploadCommand,
  ListImageReferrersCommand,
  ListImagesCommand,
  ListPullTimeUpdateExclusionsCommand,
  ListTagsForResourceCommand,
  PutAccountSettingCommand,
  PutImageCommand,
  PutImageScanningConfigurationCommand,
  PutImageTagMutabilityCommand,
  PutLifecyclePolicyCommand,
  PutRegistryPolicyCommand,
  PutRegistryScanningConfigurationCommand,
  PutReplicationConfigurationCommand,
  PutSigningConfigurationCommand,
  RegisterPullTimeUpdateExclusionCommand,
  SetRepositoryPolicyCommand,
  StartImageScanCommand,
  StartLifecyclePolicyPreviewCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateImageStorageClassCommand,
  UpdatePullThroughCacheRuleCommand,
  UpdateRepositoryCreationTemplateCommand,
  UploadLayerPartCommand,
  ValidatePullThroughCacheRuleCommand,
} from "@aws-sdk/client-ecr";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("ecr e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const ecr = () => new ECRClient({ endpoint, region, credentials });

  test("create, describe, list and delete repository", async () => {
    const client = ecr();
    const name = "bunsai-e2e-repo";

    const created = await client.send(
      new CreateRepositoryCommand({ repositoryName: name }),
    );
    expect(created.repository?.repositoryName).toBe(name);
    expect(created.repository?.repositoryArn).toContain(name);
    expect(created.repository?.repositoryUri).toContain(name);
    expect(created.repository?.repositoryUri).toContain("dkr.ecr");

    const described = await client.send(
      new DescribeRepositoriesCommand({ repositoryNames: [name] }),
    );
    const names = (described.repositories ?? []).map((r) => r.repositoryName);
    expect(names).toContain(name);

    const listed = await client.send(
      new ListImagesCommand({ repositoryName: name }),
    );
    expect(listed.imageIds ?? []).toEqual([]);

    const deleted = await client.send(
      new DeleteRepositoryCommand({ repositoryName: name }),
    );
    expect(deleted.repository?.repositoryName).toBe(name);

    await expect(
      client.send(new DescribeRepositoriesCommand({ repositoryNames: [name] })),
    ).rejects.toThrow();
  });

  test("get authorization token", async () => {
    const client = ecr();
    const result = await client.send(new GetAuthorizationTokenCommand({}));
    const data = (result.authorizationData ?? [])[0];
    expect(data?.authorizationToken).toBeDefined();
    expect(data?.proxyEndpoint).toContain("dkr.ecr");
  });

  test("batch get image returns failures for missing image", async () => {
    const client = ecr();
    const name = "bunsai-e2e-batch";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const result = await client.send(
      new BatchGetImageCommand({
        repositoryName: name,
        imageIds: [{ imageTag: "latest" }],
      }),
    );
    expect(result.images ?? []).toEqual([]);
    expect((result.failures ?? [])[0]?.failureCode).toBe("ImageNotFound");

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("put image, describe images, batch delete image", async () => {
    const client = ecr();
    const name = "bunsai-e2e-putimage";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const manifest =
      '{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json"}';
    const putResult = await client.send(
      new PutImageCommand({
        repositoryName: name,
        imageManifest: manifest,
        imageTag: "v1",
      }),
    );
    expect(putResult.image?.imageId?.imageTag).toBe("v1");
    expect(putResult.image?.imageId?.imageDigest).toBeDefined();
    const digest = putResult.image?.imageId?.imageDigest as string;

    const descResult = await client.send(
      new DescribeImagesCommand({ repositoryName: name }),
    );
    expect(descResult.imageDetails).toHaveLength(1);
    expect(descResult.imageDetails?.[0]?.imageTags).toContain("v1");
    expect(descResult.imageDetails?.[0]?.imageDigest).toBe(digest);

    const deleteResult = await client.send(
      new BatchDeleteImageCommand({
        repositoryName: name,
        imageIds: [{ imageTag: "v1" }],
      }),
    );
    expect(deleteResult.imageIds).toHaveLength(1);
    expect(deleteResult.failures ?? []).toHaveLength(0);

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("layer upload: initiate, upload part, complete, check availability, get download url", async () => {
    const client = ecr();
    const name = "bunsai-e2e-layers";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const initResult = await client.send(
      new InitiateLayerUploadCommand({ repositoryName: name }),
    );
    expect(initResult.uploadId).toBeDefined();
    expect(initResult.partSize).toBeGreaterThan(0);
    const uploadId = initResult.uploadId as string;

    const layerData = new Uint8Array([1, 2, 3, 4, 5]);
    const uploadResult = await client.send(
      new UploadLayerPartCommand({
        repositoryName: name,
        uploadId,
        partFirstByte: 0,
        partLastByte: 4,
        layerPartBlob: layerData,
      }),
    );
    expect(uploadResult.lastByteReceived).toBe(4);

    const layerDigest = "sha256:" + "a".repeat(64);
    const completeResult = await client.send(
      new CompleteLayerUploadCommand({
        repositoryName: name,
        uploadId,
        layerDigests: [layerDigest],
      }),
    );
    expect(completeResult.layerDigest).toBe(layerDigest);

    const checkResult = await client.send(
      new BatchCheckLayerAvailabilityCommand({
        repositoryName: name,
        layerDigests: [layerDigest, "sha256:" + "b".repeat(64)],
      }),
    );
    expect(checkResult.layers).toHaveLength(1);
    expect(checkResult.layers?.[0]?.layerAvailability).toBe("AVAILABLE");
    expect(checkResult.failures).toHaveLength(1);
    expect(checkResult.failures?.[0]?.failureCode).toBe("MissingLayerDigest");

    const urlResult = await client.send(
      new GetDownloadUrlForLayerCommand({
        repositoryName: name,
        layerDigest,
      }),
    );
    expect(urlResult.downloadUrl).toContain("s3.amazonaws.com");
    expect(urlResult.layerDigest).toBe(layerDigest);

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("lifecycle policy: put, get, start preview, get preview, delete", async () => {
    const client = ecr();
    const name = "bunsai-e2e-lifecycle";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const policy =
      '{"rules":[{"rulePriority":1,"action":{"type":"expire"},"selection":{"tagStatus":"untagged","countType":"sinceImagePushed","countUnit":"days","countNumber":30}}]}';

    const putResult = await client.send(
      new PutLifecyclePolicyCommand({
        repositoryName: name,
        lifecyclePolicyText: policy,
      }),
    );
    expect(putResult.lifecyclePolicyText).toBe(policy);

    const getResult = await client.send(
      new GetLifecyclePolicyCommand({ repositoryName: name }),
    );
    expect(getResult.lifecyclePolicyText).toBe(policy);

    const previewResult = await client.send(
      new StartLifecyclePolicyPreviewCommand({ repositoryName: name }),
    );
    expect(previewResult.status).toBeDefined();

    const previewGetResult = await client.send(
      new GetLifecyclePolicyPreviewCommand({ repositoryName: name }),
    );
    expect(previewGetResult.status).toBeDefined();

    const deleteResult = await client.send(
      new DeleteLifecyclePolicyCommand({ repositoryName: name }),
    );
    expect(deleteResult.lifecyclePolicyText).toBe(policy);

    await expect(
      client.send(new GetLifecyclePolicyCommand({ repositoryName: name })),
    ).rejects.toThrow();

    await client.send(new DeleteRepositoryCommand({ repositoryName: name }));
  });

  test("repository policy: set, get, delete", async () => {
    const client = ecr();
    const name = "bunsai-e2e-repopolicy";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const policy = '{"Version":"2012-10-17","Statement":[]}';

    const setResult = await client.send(
      new SetRepositoryPolicyCommand({
        repositoryName: name,
        policyText: policy,
      }),
    );
    expect(setResult.policyText).toBe(policy);

    const getResult = await client.send(
      new GetRepositoryPolicyCommand({ repositoryName: name }),
    );
    expect(getResult.policyText).toBe(policy);

    const deleteResult = await client.send(
      new DeleteRepositoryPolicyCommand({ repositoryName: name }),
    );
    expect(deleteResult.policyText).toBe(policy);

    await expect(
      client.send(new GetRepositoryPolicyCommand({ repositoryName: name })),
    ).rejects.toThrow();

    await client.send(new DeleteRepositoryCommand({ repositoryName: name }));
  });

  test("registry policy: put, get, delete", async () => {
    const client = ecr();
    const policy = '{"Version":"2012-10-17","Statement":[]}';

    const putResult = await client.send(
      new PutRegistryPolicyCommand({ policyText: policy }),
    );
    expect(putResult.policyText).toBe(policy);
    expect(putResult.registryId).toBeDefined();

    const getResult = await client.send(new GetRegistryPolicyCommand({}));
    expect(getResult.policyText).toBe(policy);

    await client.send(new DeleteRegistryPolicyCommand({}));

    await expect(
      client.send(new GetRegistryPolicyCommand({})),
    ).rejects.toThrow();
  });

  test("describe registry and replication configuration", async () => {
    const client = ecr();

    const descResult = await client.send(new DescribeRegistryCommand({}));
    expect(descResult.registryId).toBeDefined();
    expect(descResult.replicationConfiguration).toBeDefined();

    const putResult = await client.send(
      new PutReplicationConfigurationCommand({
        replicationConfiguration: { rules: [] },
      }),
    );
    expect(putResult.replicationConfiguration?.rules).toEqual([]);
  });

  test("image tag mutability", async () => {
    const client = ecr();
    const name = "bunsai-e2e-mutability";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const result = await client.send(
      new PutImageTagMutabilityCommand({
        repositoryName: name,
        imageTagMutability: "IMMUTABLE",
      }),
    );
    expect(result.imageTagMutability).toBe("IMMUTABLE");
    expect(result.repositoryName).toBe(name);

    await client.send(new DeleteRepositoryCommand({ repositoryName: name }));
  });

  test("pull-through cache rule: create, describe, update, validate, delete", async () => {
    const client = ecr();
    const prefix = "bunsai-e2e-ptcr";
    const upstreamUrl = "public.ecr.aws";

    const createResult = await client.send(
      new CreatePullThroughCacheRuleCommand({
        ecrRepositoryPrefix: prefix,
        upstreamRegistryUrl: upstreamUrl,
      }),
    );
    expect(createResult.ecrRepositoryPrefix).toBe(prefix);
    expect(createResult.upstreamRegistryUrl).toBe(upstreamUrl);

    const descResult = await client.send(
      new DescribePullThroughCacheRulesCommand({}),
    );
    const found = (descResult.pullThroughCacheRules ?? []).find(
      (r) => r.ecrRepositoryPrefix === prefix,
    );
    expect(found).toBeDefined();

    const updateResult = await client.send(
      new UpdatePullThroughCacheRuleCommand({
        ecrRepositoryPrefix: prefix,
      }),
    );
    expect(updateResult.ecrRepositoryPrefix).toBe(prefix);

    const validateResult = await client.send(
      new ValidatePullThroughCacheRuleCommand({
        ecrRepositoryPrefix: prefix,
      }),
    );
    expect(validateResult.isValid).toBe(true);

    const deleteResult = await client.send(
      new DeletePullThroughCacheRuleCommand({
        ecrRepositoryPrefix: prefix,
      }),
    );
    expect(deleteResult.ecrRepositoryPrefix).toBe(prefix);
  });

  test("repository creation template: create, describe, update, delete", async () => {
    const client = ecr();
    const prefix = "bunsai-e2e-template";

    const createResult = await client.send(
      new CreateRepositoryCreationTemplateCommand({
        prefix,
        appliedFor: ["REPLICATION"],
        description: "test template",
      }),
    );
    expect(createResult.repositoryCreationTemplate?.prefix).toBe(prefix);

    const descResult = await client.send(
      new DescribeRepositoryCreationTemplatesCommand({}),
    );
    const found = (descResult.repositoryCreationTemplates ?? []).find(
      (t) => t.prefix === prefix,
    );
    expect(found).toBeDefined();

    const updateResult = await client.send(
      new UpdateRepositoryCreationTemplateCommand({
        prefix,
        description: "updated description",
        appliedFor: ["PULL_THROUGH_CACHE"],
      }),
    );
    expect(updateResult.repositoryCreationTemplate?.prefix).toBe(prefix);

    const deleteResult = await client.send(
      new DeleteRepositoryCreationTemplateCommand({ prefix }),
    );
    expect(deleteResult.repositoryCreationTemplate?.prefix).toBe(prefix);
  });

  test("tag resource, list tags, untag resource", async () => {
    const client = ecr();
    const name = "bunsai-e2e-tags";
    const created = await client.send(
      new CreateRepositoryCommand({ repositoryName: name }),
    );
    const arn = created.repository?.repositoryArn as string;

    await client.send(
      new TagResourceCommand({
        resourceArn: arn,
        tags: [
          { Key: "env", Value: "test" },
          { Key: "team", Value: "platform" },
        ],
      }),
    );

    const listResult = await client.send(
      new ListTagsForResourceCommand({ resourceArn: arn }),
    );
    const keys = (listResult.tags ?? []).map((t) => t.Key);
    expect(keys).toContain("env");
    expect(keys).toContain("team");

    await client.send(
      new UntagResourceCommand({ resourceArn: arn, tagKeys: ["team"] }),
    );

    const listResult2 = await client.send(
      new ListTagsForResourceCommand({ resourceArn: arn }),
    );
    const keys2 = (listResult2.tags ?? []).map((t) => t.Key);
    expect(keys2).toContain("env");
    expect(keys2).not.toContain("team");

    await client.send(new DeleteRepositoryCommand({ repositoryName: name }));
  });

  test("image scanning: put config, start scan, describe findings, batch get scanning config", async () => {
    const client = ecr();
    const name = "bunsai-e2e-scanning";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const scanCfgResult = await client.send(
      new PutImageScanningConfigurationCommand({
        repositoryName: name,
        imageScanningConfiguration: { scanOnPush: true },
      }),
    );
    expect(scanCfgResult.imageScanningConfiguration?.scanOnPush).toBe(true);

    const manifest = '{"schemaVersion":2}';
    const putResult = await client.send(
      new PutImageCommand({
        repositoryName: name,
        imageManifest: manifest,
        imageTag: "scan-test",
      }),
    );
    const imageId = {
      imageTag: "scan-test",
      imageDigest: putResult.image?.imageId?.imageDigest,
    };

    const scanResult = await client.send(
      new StartImageScanCommand({ repositoryName: name, imageId }),
    );
    expect(scanResult.imageScanStatus).toBeDefined();

    const findingsResult = await client.send(
      new DescribeImageScanFindingsCommand({ repositoryName: name, imageId }),
    );
    expect(findingsResult.imageScanStatus?.status).toBeDefined();

    const batchResult = await client.send(
      new BatchGetRepositoryScanningConfigurationCommand({
        repositoryNames: [name],
      }),
    );
    expect(batchResult.scanningConfigurations).toHaveLength(1);

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("registry scanning configuration: put and get", async () => {
    const client = ecr();

    await client.send(
      new PutRegistryScanningConfigurationCommand({
        scanType: "BASIC",
        rules: [],
      }),
    );

    const getResult = await client.send(
      new GetRegistryScanningConfigurationCommand({}),
    );
    expect(getResult.scanningConfiguration?.scanType).toBe("BASIC");
    expect(getResult.registryId).toBeDefined();
  });

  test("signing configuration: put, get, delete", async () => {
    const client = ecr();

    const putResult = await client.send(
      new PutSigningConfigurationCommand({
        signingConfiguration: { rules: [] },
      }),
    );
    expect(putResult.signingConfiguration).toBeDefined();

    const getResult = await client.send(new GetSigningConfigurationCommand({}));
    expect(getResult.registryId).toBeDefined();
    expect(getResult.signingConfiguration).toBeDefined();

    await client.send(new DeleteSigningConfigurationCommand({}));
  });

  test("account settings: put and get", async () => {
    const client = ecr();

    const putResult = await client.send(
      new PutAccountSettingCommand({
        name: "BASIC_SCAN_TYPE_VERSION",
        value: "AWS_NATIVE",
      }),
    );
    expect(putResult.name).toBe("BASIC_SCAN_TYPE_VERSION");
    expect(putResult.value).toBe("AWS_NATIVE");

    const getResult = await client.send(
      new GetAccountSettingCommand({ name: "BASIC_SCAN_TYPE_VERSION" }),
    );
    expect(getResult.value).toBe("AWS_NATIVE");
  });

  test("pull time update exclusions: register, list, deregister", async () => {
    const client = ecr();
    const principalArn = "arn:aws:iam::123456789012:role/test-role";

    const registerResult = await client.send(
      new RegisterPullTimeUpdateExclusionCommand({ principalArn }),
    );
    expect(registerResult.principalArn).toBe(principalArn);
    expect(registerResult.createdAt).toBeDefined();

    const listResult = await client.send(
      new ListPullTimeUpdateExclusionsCommand({}),
    );
    expect(listResult.pullTimeUpdateExclusions).toContain(principalArn);

    await client.send(
      new DeregisterPullTimeUpdateExclusionCommand({ principalArn }),
    );

    const listResult2 = await client.send(
      new ListPullTimeUpdateExclusionsCommand({}),
    );
    expect(listResult2.pullTimeUpdateExclusions ?? []).not.toContain(
      principalArn,
    );
  });

  test("list image referrers returns empty list", async () => {
    const client = ecr();
    const name = "bunsai-e2e-referrers";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const manifest = '{"schemaVersion":2}';
    const putResult = await client.send(
      new PutImageCommand({
        repositoryName: name,
        imageManifest: manifest,
        imageTag: "base",
      }),
    );
    const digest = putResult.image?.imageId?.imageDigest as string;

    const result = await client.send(
      new ListImageReferrersCommand({
        repositoryName: name,
        subjectId: { imageDigest: digest },
      }),
    );
    expect(result.referrers ?? []).toEqual([]);

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("describe image replication status returns empty list", async () => {
    const client = ecr();
    const name = "bunsai-e2e-replication";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const manifest = '{"schemaVersion":2}';
    const putResult = await client.send(
      new PutImageCommand({
        repositoryName: name,
        imageManifest: manifest,
        imageTag: "rep-test",
      }),
    );

    const result = await client.send(
      new DescribeImageReplicationStatusCommand({
        repositoryName: name,
        imageId: { imageTag: "rep-test" },
      }),
    );
    expect(result.replicationStatuses ?? []).toEqual([]);

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("update image storage class", async () => {
    const client = ecr();
    const name = "bunsai-e2e-storage";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const manifest = '{"schemaVersion":2}';
    await client.send(
      new PutImageCommand({
        repositoryName: name,
        imageManifest: manifest,
        imageTag: "storage-test",
      }),
    );

    const result = await client.send(
      new UpdateImageStorageClassCommand({
        repositoryName: name,
        imageId: { imageTag: "storage-test" },
        targetStorageClass: "STANDARD",
      }),
    );
    expect(result.repositoryName).toBe(name);
    expect(result.imageStatus).toBeDefined();

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });

  test("describe image signing status returns empty list", async () => {
    const client = ecr();
    const name = "bunsai-e2e-signing";
    await client.send(new CreateRepositoryCommand({ repositoryName: name }));

    const manifest = '{"schemaVersion":2}';
    await client.send(
      new PutImageCommand({
        repositoryName: name,
        imageManifest: manifest,
        imageTag: "sign-test",
      }),
    );

    const result = await client.send(
      new DescribeImageSigningStatusCommand({
        repositoryName: name,
        imageId: { imageTag: "sign-test" },
      }),
    );
    expect(result.signingStatuses ?? []).toEqual([]);

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: name, force: true }),
    );
  });
});
