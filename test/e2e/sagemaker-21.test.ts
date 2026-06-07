import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateCodeRepositoryCommand,
  CreateDomainCommand,
  ListClustersCommand,
  ListCodeRepositoriesCommand,
  ListDomainsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("ListClusters empty then CreateCluster → listed", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListClustersCommand({}));
  expect(Array.isArray(empty.ClusterSummaries)).toBe(true);

  await client.send(
    new CreateClusterCommand({
      ClusterName: "bunsai-e2e-cluster-21",
    }),
  );

  const listed = await client.send(new ListClustersCommand({}));
  const found = listed.ClusterSummaries!.find(
    (c) => c.ClusterName === "bunsai-e2e-cluster-21",
  );
  expect(found).toBeDefined();
  expect(found!.ClusterArn).toContain("cluster/bunsai-e2e-cluster-21");
  expect(found!.ClusterStatus).toBe("Creating");
});

test("CreateDomain → ListDomains includes it", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateDomainCommand({
      DomainName: "bunsai-e2e-domain-21",
      AuthMode: "IAM",
      DefaultUserSettings: {},
    }),
  );
  expect(created.DomainId).toBeDefined();

  const listed = await client.send(new ListDomainsCommand({}));
  expect(Array.isArray(listed.Domains)).toBe(true);
  const found = listed.Domains!.find(
    (d) => d.DomainName === "bunsai-e2e-domain-21",
  );
  expect(found).toBeDefined();
  expect(found!.DomainArn).toContain("domain/");
  expect(found!.Status).toBe("InService");
});

test("CreateCodeRepository → ListCodeRepositories includes it", async () => {
  const client = sagemaker();

  await client.send(
    new CreateCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-repo-21",
      GitConfig: { RepositoryUrl: "https://github.com/example/repo" },
    }),
  );

  const listed = await client.send(new ListCodeRepositoriesCommand({}));
  expect(Array.isArray(listed.CodeRepositorySummaryList)).toBe(true);
  const found = listed.CodeRepositorySummaryList!.find(
    (r) => r.CodeRepositoryName === "bunsai-e2e-repo-21",
  );
  expect(found).toBeDefined();
  expect(found!.CodeRepositoryArn).toContain("code-repository/");
});
