import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AccessAnalyzerClient,
  ApplyArchiveRuleCommand,
  CancelPolicyGenerationCommand,
  CheckAccessNotGrantedCommand,
  CheckNoNewAccessCommand,
  CheckNoPublicAccessCommand,
  CreateAccessPreviewCommand,
  CreateAnalyzerCommand,
  CreateArchiveRuleCommand,
  DeleteAnalyzerCommand,
  DeleteArchiveRuleCommand,
  GenerateFindingRecommendationCommand,
  GetAccessPreviewCommand,
  GetAnalyzedResourceCommand,
  GetAnalyzerCommand,
  GetArchiveRuleCommand,
  GetFindingRecommendationCommand,
  GetFindingsStatisticsCommand,
  GetGeneratedPolicyCommand,
  ListAccessPreviewFindingsCommand,
  ListAccessPreviewsCommand,
  ListAnalyzedResourcesCommand,
  ListAnalyzersCommand,
  ListArchiveRulesCommand,
  ListFindingsCommand,
  ListFindingsV2Command,
  ListPolicyGenerationsCommand,
  ListTagsForResourceCommand,
  StartPolicyGenerationCommand,
  StartResourceScanCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAnalyzerCommand,
  UpdateArchiveRuleCommand,
  UpdateFindingsCommand,
  ValidatePolicyCommand,
} from "@aws-sdk/client-accessanalyzer";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

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

const accessanalyzer = () =>
  new AccessAnalyzerClient({ endpoint, region, credentials });

test("AccessAnalyzer analyzer roundtrip", async () => {
  const client = accessanalyzer();
  const name = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  expect(created.arn).toContain(`analyzer/${name}`);

  const got = await client.send(new GetAnalyzerCommand({ analyzerName: name }));
  expect(got.analyzer?.name).toBe(name);
  expect(got.analyzer?.type).toBe("ACCOUNT");
  expect(got.analyzer?.status).toBe("ACTIVE");
  expect(got.analyzer?.arn).toBe(created.arn);

  const listed = await client.send(new ListAnalyzersCommand({}));
  expect((listed.analyzers ?? []).map((a) => a.name)).toContain(name);

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
  await expect(
    client.send(new GetAnalyzerCommand({ analyzerName: name })),
  ).rejects.toThrow();
});

test("AccessAnalyzer archive rule lifecycle", async () => {
  const client = accessanalyzer();
  const name = `bunsai_archive_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  const analyzerArn = created.arn!;

  await client.send(
    new CreateArchiveRuleCommand({
      analyzerName: name,
      ruleName: "rule1",
      filter: { isPublic: { eq: ["false"] } },
    }),
  );

  const got = await client.send(
    new GetArchiveRuleCommand({ analyzerName: name, ruleName: "rule1" }),
  );
  expect(got.archiveRule?.ruleName).toBe("rule1");

  const listed = await client.send(
    new ListArchiveRulesCommand({ analyzerName: name }),
  );
  expect((listed.archiveRules ?? []).map((r) => r.ruleName)).toContain("rule1");

  await client.send(
    new UpdateArchiveRuleCommand({
      analyzerName: name,
      ruleName: "rule1",
      filter: { isPublic: { eq: ["true"] } },
    }),
  );

  await client.send(
    new ApplyArchiveRuleCommand({ analyzerArn, ruleName: "rule1" }),
  );

  await client.send(
    new DeleteArchiveRuleCommand({ analyzerName: name, ruleName: "rule1" }),
  );
  await expect(
    client.send(
      new GetArchiveRuleCommand({ analyzerName: name, ruleName: "rule1" }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});

test("AccessAnalyzer access preview lifecycle", async () => {
  const client = accessanalyzer();
  const name = `bunsai_preview_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  const analyzerArn = created.arn!;

  const preview = await client.send(
    new CreateAccessPreviewCommand({
      analyzerArn,
      configurations: {},
    }),
  );
  expect(preview.id).toBeDefined();
  const previewId = preview.id!;

  const got = await client.send(
    new GetAccessPreviewCommand({ accessPreviewId: previewId, analyzerArn }),
  );
  expect(got.accessPreview?.id).toBe(previewId);
  expect(got.accessPreview?.analyzerArn).toBe(analyzerArn);
  expect(got.accessPreview?.status).toBe("COMPLETED");

  const listed = await client.send(
    new ListAccessPreviewsCommand({ analyzerArn }),
  );
  expect((listed.accessPreviews ?? []).map((p) => p.id)).toContain(previewId);

  const findings = await client.send(
    new ListAccessPreviewFindingsCommand({
      accessPreviewId: previewId,
      analyzerArn,
    }),
  );
  expect(findings.findings).toBeDefined();

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});

test("AccessAnalyzer findings operations", async () => {
  const client = accessanalyzer();
  const name = `bunsai_finding_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  const analyzerArn = created.arn!;

  const listed = await client.send(new ListFindingsCommand({ analyzerArn }));
  expect(listed.findings).toBeDefined();

  const listedV2 = await client.send(
    new ListFindingsV2Command({ analyzerArn }),
  );
  expect(listedV2.findings).toBeDefined();

  await client.send(
    new UpdateFindingsCommand({ analyzerArn, status: "ARCHIVED", ids: [] }),
  );

  const stats = await client.send(
    new GetFindingsStatisticsCommand({ analyzerArn }),
  );
  expect(stats.findingsStatistics).toBeDefined();

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});

test("AccessAnalyzer analyzed resource", async () => {
  const client = accessanalyzer();
  const name = `bunsai_resource_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  const analyzerArn = created.arn!;

  const res = await client.send(
    new GetAnalyzedResourceCommand({
      analyzerArn,
      resourceArn: `arn:aws:s3:::test-bucket`,
    }),
  );
  expect(res.resource?.resourceArn).toBe(`arn:aws:s3:::test-bucket`);
  expect(res.resource?.isPublic).toBe(false);

  const listed = await client.send(
    new ListAnalyzedResourcesCommand({ analyzerArn }),
  );
  expect(listed.analyzedResources).toBeDefined();

  await client.send(
    new StartResourceScanCommand({
      analyzerArn,
      resourceArn: `arn:aws:s3:::test-bucket`,
    }),
  );

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});

test("AccessAnalyzer policy generation lifecycle", async () => {
  const client = accessanalyzer();

  const principalArn = `arn:aws:iam::000000000000:role/test-role`;

  const started = await client.send(
    new StartPolicyGenerationCommand({
      policyGenerationDetails: { principalArn },
    }),
  );
  expect(started.jobId).toBeDefined();
  const jobId = started.jobId!;

  const got = await client.send(new GetGeneratedPolicyCommand({ jobId }));
  expect(got.jobDetails?.jobId).toBe(jobId);
  expect(got.generatedPolicyResult).toBeDefined();

  const listed = await client.send(new ListPolicyGenerationsCommand({}));
  expect((listed.policyGenerations ?? []).map((g) => g.jobId)).toContain(jobId);

  await client.send(new CancelPolicyGenerationCommand({ jobId }));
});

test("AccessAnalyzer check policy operations", async () => {
  const client = accessanalyzer();

  const policyDocument = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
  });

  const notGranted = await client.send(
    new CheckAccessNotGrantedCommand({
      policyDocument,
      access: [],
      policyType: "IDENTITY_POLICY",
    }),
  );
  expect(notGranted.result).toBe("PASS");

  const noNewAccess = await client.send(
    new CheckNoNewAccessCommand({
      newPolicyDocument: policyDocument,
      existingPolicyDocument: policyDocument,
      policyType: "IDENTITY_POLICY",
    }),
  );
  expect(noNewAccess.result).toBe("PASS");

  const noPublic = await client.send(
    new CheckNoPublicAccessCommand({
      policyDocument,
      resourceType: "AWS::S3::Bucket",
    }),
  );
  expect(noPublic.result).toBe("PASS");
});

test("AccessAnalyzer validate policy", async () => {
  const client = accessanalyzer();

  const policyDocument = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
  });

  const result = await client.send(
    new ValidatePolicyCommand({
      policyDocument,
      policyType: "IDENTITY_POLICY",
    }),
  );
  expect(result.findings).toBeDefined();
});

test("AccessAnalyzer tags lifecycle", async () => {
  const client = accessanalyzer();
  const name = `bunsai_tags_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  const resourceArn = created.arn!;

  await client.send(
    new TagResourceCommand({ resourceArn, tags: { env: "test", team: "ops" } }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.team).toBe("ops");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["team"] }),
  );

  const listedAfter = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listedAfter.tags?.env).toBe("test");
  expect(listedAfter.tags?.team).toBeUndefined();

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});

test("AccessAnalyzer update analyzer", async () => {
  const client = accessanalyzer();
  const name = `bunsai_update_${Date.now()}`;

  await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );

  const result = await client.send(
    new UpdateAnalyzerCommand({ analyzerName: name, configuration: {} }),
  );
  expect(result.configuration).toBeDefined();

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});

test("AccessAnalyzer finding recommendation", async () => {
  const client = accessanalyzer();
  const name = `bunsai_rec_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  const analyzerArn = created.arn!;
  const id = `finding-${Date.now()}`;

  await client.send(
    new GenerateFindingRecommendationCommand({ analyzerArn, id }),
  );

  const rec = await client.send(
    new GetFindingRecommendationCommand({ analyzerArn, id }),
  );
  expect(rec.status).toBeDefined();
  expect(rec.resourceArn).toBeDefined();

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
});
