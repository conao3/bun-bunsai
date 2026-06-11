import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchDeleteImageCommand,
  BatchGetImageCommand,
  CreateRepositoryCommand,
  DeleteRepositoryCommand,
  DescribeImagesCommand,
  DescribeRepositoriesCommand,
  ECRClient,
  GetRepositoryPolicyCommand,
  ListImagesCommand,
  PutImageCommand,
  PutImageTagMutabilityCommand,
  SetRepositoryPolicyCommand,
} from "@aws-sdk/client-ecr";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ECR image registry workflow scenario", () => {
  const ecr = () =>
    new ECRClient({ endpoint, region, credentials, requestHandler });

  test("image registry lifecycle: push, multi-tag, policy, delete guard", async () => {
    const client = ecr();
    const repoName = "bunsai-scenario-ecr";
    const manifest =
      '{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json","config":{"mediaType":"application/vnd.docker.container.image.v1+json","size":100,"digest":"sha256:abc"},"layers":[]}';

    const created = await client.send(
      new CreateRepositoryCommand({ repositoryName: repoName }),
    );
    expect(created.repository?.repositoryArn).toContain(repoName);
    expect(created.repository?.repositoryUri).toContain("dkr.ecr");
    expect(created.repository?.repositoryName).toBe(repoName);

    const putV1 = await client.send(
      new PutImageCommand({
        repositoryName: repoName,
        imageManifest: manifest,
        imageTag: "v1",
      }),
    );
    expect(putV1.image?.imageId?.imageTag).toBe("v1");
    expect(putV1.image?.imageId?.imageDigest).toMatch(/^sha256:/);
    const digest = putV1.image?.imageId?.imageDigest as string;

    const descAfterV1 = await client.send(
      new DescribeImagesCommand({ repositoryName: repoName }),
    );
    expect(descAfterV1.imageDetails).toHaveLength(1);
    const detail = descAfterV1.imageDetails?.[0];
    expect(detail?.imageDigest).toBe(digest);
    expect(detail?.imageTags).toContain("v1");
    expect(detail?.imageSizeInBytes).toBeGreaterThan(0);
    expect(detail?.imagePushedAt).toBeDefined();

    const batchGet = await client.send(
      new BatchGetImageCommand({
        repositoryName: repoName,
        imageIds: [{ imageTag: "v1" }],
      }),
    );
    expect(batchGet.images).toHaveLength(1);
    expect(batchGet.images?.[0]?.imageManifest).toBe(manifest);
    expect(batchGet.failures ?? []).toHaveLength(0);

    const batchGetMissing = await client.send(
      new BatchGetImageCommand({
        repositoryName: repoName,
        imageIds: [{ imageTag: "nonexistent" }],
      }),
    );
    expect(batchGetMissing.images ?? []).toHaveLength(0);
    expect(batchGetMissing.failures?.[0]?.failureCode).toBe("ImageNotFound");

    const listed = await client.send(
      new ListImagesCommand({ repositoryName: repoName }),
    );
    const listDigests = (listed.imageIds ?? []).map((id) => id.imageDigest);
    const listTags = (listed.imageIds ?? []).map((id) => id.imageTag);
    expect(listDigests).toContain(digest);
    expect(listTags).toContain("v1");

    const putLatest = await client.send(
      new PutImageCommand({
        repositoryName: repoName,
        imageManifest: manifest,
        imageTag: "latest",
      }),
    );
    expect(putLatest.image?.imageId?.imageDigest).toBe(digest);
    expect(putLatest.image?.imageId?.imageTag).toBe("latest");

    const descMultiTag = await client.send(
      new DescribeImagesCommand({ repositoryName: repoName }),
    );
    expect(descMultiTag.imageDetails).toHaveLength(1);
    const multiDetail = descMultiTag.imageDetails?.[0];
    expect(multiDetail?.imageDigest).toBe(digest);
    expect(multiDetail?.imageTags).toContain("v1");
    expect(multiDetail?.imageTags).toContain("latest");
    expect(multiDetail?.imageTags).toHaveLength(2);

    await expect(
      client.send(
        new PutImageCommand({
          repositoryName: repoName,
          imageManifest: manifest,
          imageTag: "v1",
        }),
      ),
    ).rejects.toMatchObject({ name: "ImageAlreadyExistsException" });

    const batchDel = await client.send(
      new BatchDeleteImageCommand({
        repositoryName: repoName,
        imageIds: [{ imageTag: "latest" }],
      }),
    );
    expect(batchDel.imageIds).toHaveLength(1);
    expect(batchDel.failures ?? []).toHaveLength(0);

    const descAfterDel = await client.send(
      new DescribeImagesCommand({ repositoryName: repoName }),
    );
    expect(descAfterDel.imageDetails).toHaveLength(1);
    expect(descAfterDel.imageDetails?.[0]?.imageTags).toContain("v1");
    expect(descAfterDel.imageDetails?.[0]?.imageTags).not.toContain("latest");

    const policy = '{"Version":"2012-10-17","Statement":[]}';
    const setPolicy = await client.send(
      new SetRepositoryPolicyCommand({
        repositoryName: repoName,
        policyText: policy,
      }),
    );
    expect(setPolicy.policyText).toBe(policy);

    const getPolicy = await client.send(
      new GetRepositoryPolicyCommand({ repositoryName: repoName }),
    );
    expect(getPolicy.policyText).toBe(policy);

    await expect(
      client.send(
        new DeleteRepositoryCommand({ repositoryName: repoName, force: false }),
      ),
    ).rejects.toMatchObject({ name: "RepositoryNotEmptyException" });

    const deleted = await client.send(
      new DeleteRepositoryCommand({ repositoryName: repoName, force: true }),
    );
    expect(deleted.repository?.repositoryName).toBe(repoName);

    await expect(
      client.send(
        new DescribeRepositoriesCommand({ repositoryNames: [repoName] }),
      ),
    ).rejects.toMatchObject({ name: "RepositoryNotFoundException" });
  });

  test("PutImageTagMutability IMMUTABLE blocks tag reuse", async () => {
    const client = ecr();
    const repoName = "bunsai-scenario-ecr-immutable";

    await client.send(
      new CreateRepositoryCommand({ repositoryName: repoName }),
    );

    const manifest1 =
      '{"schemaVersion":2,"config":{"digest":"sha256:aaa"},"layers":[]}';
    await client.send(
      new PutImageCommand({
        repositoryName: repoName,
        imageManifest: manifest1,
        imageTag: "stable",
      }),
    );

    await client.send(
      new PutImageTagMutabilityCommand({
        repositoryName: repoName,
        imageTagMutability: "IMMUTABLE",
      }),
    );

    const manifest2 =
      '{"schemaVersion":2,"config":{"digest":"sha256:bbb"},"layers":[]}';
    await expect(
      client.send(
        new PutImageCommand({
          repositoryName: repoName,
          imageManifest: manifest2,
          imageTag: "stable",
        }),
      ),
    ).rejects.toMatchObject({ name: "ImageTagAlreadyExistsException" });

    await client.send(
      new DeleteRepositoryCommand({ repositoryName: repoName, force: true }),
    );
  });
});
