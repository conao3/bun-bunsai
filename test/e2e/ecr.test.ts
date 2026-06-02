import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchGetImageCommand,
  CreateRepositoryCommand,
  DeleteRepositoryCommand,
  DescribeRepositoriesCommand,
  ECRClient,
  GetAuthorizationTokenCommand,
  ListImagesCommand,
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
});
