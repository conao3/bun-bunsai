import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AnalyzeDocumentCommand,
  BlockType,
  ConflictException,
  CreateAdapterCommand,
  CreateAdapterVersionCommand,
  DeleteAdapterCommand,
  DeleteAdapterVersionCommand,
  DetectDocumentTextCommand,
  GetAdapterVersionCommand,
  GetDocumentAnalysisCommand,
  GetDocumentTextDetectionCommand,
  GetExpenseAnalysisCommand,
  GetLendingAnalysisCommand,
  IdempotentParameterMismatchException,
  InvalidJobIdException,
  InvalidParameterException,
  InvalidS3ObjectException,
  ListAdaptersCommand,
  ListAdapterVersionsCommand,
  ListTagsForResourceCommand,
  ResourceNotFoundException,
  StartDocumentAnalysisCommand,
  StartDocumentTextDetectionCommand,
  StartExpenseAnalysisCommand,
  StartLendingAnalysisCommand,
  TagResourceCommand,
  TextractClient,
  UntagResourceCommand,
  UpdateAdapterCommand,
} from "@aws-sdk/client-textract";
import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textract = () =>
  new TextractClient({ endpoint, region, credentials, requestHandler });

const s3 = () =>
  new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });

const ensureBucket = async (client: S3Client, bucket: string) => {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch {
    // bucket already exists
  }
};

test("DetectDocumentText: sync round-trip with Bytes", async () => {
  const client = textract();
  const result = await client.send(
    new DetectDocumentTextCommand({
      Document: { Bytes: new Uint8Array([1, 2, 3]) },
    }),
  );
  expect(result.DocumentMetadata?.Pages).toBe(1);
  expect(Array.isArray(result.Blocks)).toBe(true);
  expect(result.Blocks!.length).toBeGreaterThan(0);
  const page = result.Blocks!.find((b) => b.BlockType === BlockType.PAGE);
  expect(page).toBeDefined();
  expect(page?.Confidence).toBe(99);
  const line = result.Blocks!.find((b) => b.BlockType === BlockType.LINE);
  expect(line?.Text).toBe("Hello World");
  const words = result.Blocks!.filter((b) => b.BlockType === BlockType.WORD);
  expect(words.length).toBe(2);
  expect(words[0]?.Geometry?.BoundingBox).toBeDefined();
});

test("AnalyzeDocument: sync round-trip with FeatureTypes", async () => {
  const client = textract();
  const result = await client.send(
    new AnalyzeDocumentCommand({
      Document: { Bytes: new Uint8Array([1, 2, 3]) },
      FeatureTypes: ["TABLES", "FORMS"],
    }),
  );
  expect(result.DocumentMetadata?.Pages).toBe(1);
  expect(Array.isArray(result.Blocks)).toBe(true);
  expect(result.Blocks!.length).toBeGreaterThan(0);
});

test("AnalyzeDocument: missing FeatureTypes throws InvalidParameterException", async () => {
  const client = textract();
  await expect(
    client.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: new Uint8Array([1, 2, 3]) },
        FeatureTypes: [],
      }),
    ),
  ).rejects.toBeInstanceOf(InvalidParameterException);
});

test("DetectDocumentText: S3Object — real object succeeds", async () => {
  const s3Client = s3();
  const bucket = "textract-e2e-bucket";
  const key = "sample.jpg";

  await ensureBucket(s3Client, bucket);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array([0xff, 0xd8]),
    }),
  );

  const client = textract();
  const result = await client.send(
    new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: bucket, Name: key } },
    }),
  );
  expect(result.DocumentMetadata?.Pages).toBe(1);
  expect(result.Blocks!.length).toBeGreaterThan(0);
});

test("DetectDocumentText: S3Object — missing object throws InvalidS3ObjectException", async () => {
  const client = textract();
  await expect(
    client.send(
      new DetectDocumentTextCommand({
        Document: {
          S3Object: { Bucket: "textract-missing-bucket", Name: "nope.jpg" },
        },
      }),
    ),
  ).rejects.toBeInstanceOf(InvalidS3ObjectException);
});

test("Async TextDetection: start → IN_PROGRESS → SUCCEEDED", async () => {
  const client = textract();
  const started = await client.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: { Bucket: "textract-e2e-bucket", Name: "sample.jpg" },
      },
    }),
  );
  expect(typeof started.JobId).toBe("string");
  expect(started.JobId!.length).toBeGreaterThan(0);

  const got = await client.send(
    new GetDocumentTextDetectionCommand({ JobId: started.JobId! }),
  );
  expect(got.JobStatus).toBe("SUCCEEDED");
  expect(got.DocumentMetadata?.Pages).toBe(1);
  expect(Array.isArray(got.Blocks)).toBe(true);
  expect(got.Blocks!.length).toBeGreaterThan(0);
});

test("Async DocumentAnalysis: start → SUCCEEDED with FeatureTypes", async () => {
  const client = textract();
  const started = await client.send(
    new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: { Bucket: "textract-e2e-bucket", Name: "sample.jpg" },
      },
      FeatureTypes: ["TABLES"],
    }),
  );
  expect(typeof started.JobId).toBe("string");

  const got = await client.send(
    new GetDocumentAnalysisCommand({ JobId: started.JobId! }),
  );
  expect(got.JobStatus).toBe("SUCCEEDED");
  expect(got.Blocks!.length).toBeGreaterThan(0);
});

test("GetDocumentTextDetection: unknown JobId throws InvalidJobIdException", async () => {
  const client = textract();
  await expect(
    client.send(
      new GetDocumentTextDetectionCommand({ JobId: "no-such-job-id" }),
    ),
  ).rejects.toBeInstanceOf(InvalidJobIdException);
});

test("GetDocumentAnalysis: unknown JobId throws InvalidJobIdException", async () => {
  const client = textract();
  await expect(
    client.send(new GetDocumentAnalysisCommand({ JobId: "no-such-job-id" })),
  ).rejects.toBeInstanceOf(InvalidJobIdException);
});

test("TXT-1: StartDocumentTextDetection idempotency — same token → same JobId", async () => {
  const client = textract();
  const token = `idem-txt-detection-${Date.now()}`;
  const params = {
    DocumentLocation: {
      S3Object: { Bucket: "textract-e2e-bucket", Name: "sample.jpg" },
    },
    ClientRequestToken: token,
  };
  const r1 = await client.send(new StartDocumentTextDetectionCommand(params));
  const r2 = await client.send(new StartDocumentTextDetectionCommand(params));
  expect(r1.JobId).toBe(r2.JobId);
});

test("TXT-1: CreateAdapter idempotency — same token + different AdapterName throws IdempotentParameterMismatchException", async () => {
  const client = textract();
  const token = `idem-adapter-${Date.now()}`;
  await client.send(
    new CreateAdapterCommand({
      AdapterName: "idem-adapter-a",
      FeatureTypes: ["QUERIES"],
      ClientRequestToken: token,
    }),
  );
  await expect(
    client.send(
      new CreateAdapterCommand({
        AdapterName: "idem-adapter-b",
        FeatureTypes: ["QUERIES"],
        ClientRequestToken: token,
      }),
    ),
  ).rejects.toBeInstanceOf(IdempotentParameterMismatchException);
});

test("TXT-2: TagResource on nonexistent ARN throws ResourceNotFoundException", async () => {
  const client = textract();
  await expect(
    client.send(
      new TagResourceCommand({
        ResourceARN:
          "arn:aws:textract:us-east-1:000000000000:adapter/no-such-adapter",
        Tags: { env: "test" },
      }),
    ),
  ).rejects.toBeInstanceOf(ResourceNotFoundException);
});

test("TXT-2: ListTagsForResource on nonexistent ARN throws ResourceNotFoundException", async () => {
  const client = textract();
  await expect(
    client.send(
      new ListTagsForResourceCommand({
        ResourceARN:
          "arn:aws:textract:us-east-1:000000000000:adapter/no-such-adapter",
      }),
    ),
  ).rejects.toBeInstanceOf(ResourceNotFoundException);
});

test("TXT-2: UntagResource on invalid ARN (no adapter/) throws ResourceNotFoundException", async () => {
  const client = textract();
  await expect(
    client.send(
      new UntagResourceCommand({
        ResourceARN: "arn:aws:textract:us-east-1:000000000000:job/some-job",
        TagKeys: ["env"],
      }),
    ),
  ).rejects.toBeInstanceOf(ResourceNotFoundException);
});

test("TXT-4: DeleteAdapter throws ConflictException when versions exist", async () => {
  const s3Client = s3();
  const bucket = "textract-e2e-bucket";
  await ensureBucket(s3Client, bucket);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "manifest.json",
      Body: new Uint8Array([0x7b, 0x7d]),
    }),
  );

  const client = textract();
  const created = await client.send(
    new CreateAdapterCommand({
      AdapterName: "conflict-test-adapter",
      FeatureTypes: ["QUERIES"],
    }),
  );
  const adapterId = created.AdapterId!;

  await client.send(
    new CreateAdapterVersionCommand({
      AdapterId: adapterId,
      DatasetConfig: {
        ManifestS3Object: { Bucket: bucket, Name: "manifest.json" },
      },
      OutputConfig: { S3Bucket: bucket },
    }),
  );

  await expect(
    client.send(new DeleteAdapterCommand({ AdapterId: adapterId })),
  ).rejects.toBeInstanceOf(ConflictException);
});

test("Adapter CRUD lifecycle", async () => {
  const s3Client = s3();
  const bucket = "textract-e2e-bucket";
  await ensureBucket(s3Client, bucket);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "sample.jpg",
      Body: new Uint8Array([0xff, 0xd8]),
    }),
  );
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "manifest.json",
      Body: new Uint8Array([0x7b, 0x7d]),
    }),
  );

  const client = textract();

  const created = await client.send(
    new CreateAdapterCommand({
      AdapterName: "my-adapter",
      FeatureTypes: ["QUERIES"],
      Description: "test adapter",
    }),
  );
  expect(typeof created.AdapterId).toBe("string");
  const adapterId = created.AdapterId!;

  const updated = await client.send(
    new UpdateAdapterCommand({
      AdapterId: adapterId,
      AdapterName: "my-adapter-v2",
    }),
  );
  expect(updated.AdapterName).toBe("my-adapter-v2");

  const listed = await client.send(new ListAdaptersCommand({}));
  expect(listed.Adapters?.some((a) => a.AdapterId === adapterId)).toBe(true);

  const av = await client.send(
    new CreateAdapterVersionCommand({
      AdapterId: adapterId,
      DatasetConfig: {
        ManifestS3Object: {
          Bucket: bucket,
          Name: "manifest.json",
        },
      },
      OutputConfig: { S3Bucket: bucket },
    }),
  );
  expect(av.AdapterId).toBe(adapterId);
  expect(typeof av.AdapterVersion).toBe("string");
  const adapterVersion = av.AdapterVersion!;

  const adapterArn = `arn:aws:textract:us-east-1:000000000000:adapter/${adapterId}`;
  await client.send(
    new UntagResourceCommand({
      ResourceARN: adapterArn,
      TagKeys: ["env"],
    }),
  );

  const gotVersion = await client.send(
    new GetAdapterVersionCommand({
      AdapterId: adapterId,
      AdapterVersion: adapterVersion,
    }),
  );
  expect(gotVersion.Status).toBe("ACTIVE");
  expect(gotVersion.DatasetConfig?.ManifestS3Object?.Bucket).toBe(bucket);

  const listedVersions = await client.send(
    new ListAdapterVersionsCommand({ AdapterId: adapterId }),
  );
  expect(
    listedVersions.AdapterVersions?.some(
      (v) => v.AdapterVersion === adapterVersion,
    ),
  ).toBe(true);

  await client.send(
    new DeleteAdapterVersionCommand({
      AdapterId: adapterId,
      AdapterVersion: adapterVersion,
    }),
  );

  await client.send(new DeleteAdapterCommand({ AdapterId: adapterId }));

  const listed2 = await client.send(new ListAdaptersCommand({}));
  expect(listed2.Adapters?.some((a) => a.AdapterId === adapterId)).toBe(false);

  const listedVersions2 = await client.send(
    new ListAdapterVersionsCommand({ AdapterId: adapterId }),
  );
  expect(listedVersions2.AdapterVersions?.length ?? 0).toBe(0);
});

test("TXT-3: CreateAdapterVersion without DatasetConfig throws", async () => {
  const client = textract();
  const created = await client.send(
    new CreateAdapterCommand({
      AdapterName: "dataset-test-adapter",
      FeatureTypes: ["QUERIES"],
    }),
  );
  const adapterId = created.AdapterId!;
  await expect(
    client.send(
      new CreateAdapterVersionCommand({
        AdapterId: adapterId,
        OutputConfig: { S3Bucket: "textract-e2e-bucket" },
      } as Parameters<typeof client.send>[0]["input"] as never),
    ),
  ).rejects.toThrow();
});

test("TXT-7: Adapter version lifecycle — CREATION_IN_PROGRESS → ACTIVE on first Get", async () => {
  const s3Client = s3();
  const bucket = "textract-e2e-bucket";
  await ensureBucket(s3Client, bucket);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "manifest.json",
      Body: new Uint8Array([0x7b, 0x7d]),
    }),
  );

  const client = textract();
  const created = await client.send(
    new CreateAdapterCommand({
      AdapterName: "lifecycle-test-adapter",
      FeatureTypes: ["QUERIES"],
    }),
  );
  const adapterId = created.AdapterId!;

  const av = await client.send(
    new CreateAdapterVersionCommand({
      AdapterId: adapterId,
      DatasetConfig: {
        ManifestS3Object: { Bucket: bucket, Name: "manifest.json" },
      },
      OutputConfig: { S3Bucket: bucket },
    }),
  );
  const adapterVersion = av.AdapterVersion!;
  expect(typeof adapterVersion).toBe("string");
  expect(Number(adapterVersion)).toBeGreaterThan(0);

  const got = await client.send(
    new GetAdapterVersionCommand({
      AdapterId: adapterId,
      AdapterVersion: adapterVersion,
    }),
  );
  expect(got.Status).toBe("ACTIVE");
});

test("TXT-8: GetExpenseAnalysis paginates actual ExpenseDocuments", async () => {
  const client = textract();
  const started = await client.send(
    new StartExpenseAnalysisCommand({
      DocumentLocation: {
        S3Object: { Bucket: "textract-e2e-bucket", Name: "sample.jpg" },
      },
    }),
  );
  const jobId = started.JobId!;

  const page1 = await client.send(
    new GetExpenseAnalysisCommand({ JobId: jobId, MaxResults: 1 }),
  );
  expect(page1.ExpenseDocuments?.length).toBe(1);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new GetExpenseAnalysisCommand({
      JobId: jobId,
      MaxResults: 1,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.ExpenseDocuments?.length).toBe(1);
});

test("TXT-8: GetLendingAnalysis paginates actual Results", async () => {
  const client = textract();
  const started = await client.send(
    new StartLendingAnalysisCommand({
      DocumentLocation: {
        S3Object: { Bucket: "textract-e2e-bucket", Name: "sample.jpg" },
      },
    }),
  );
  const jobId = started.JobId!;

  const page1 = await client.send(
    new GetLendingAnalysisCommand({ JobId: jobId, MaxResults: 1 }),
  );
  expect(page1.Results?.length).toBe(1);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new GetLendingAnalysisCommand({
      JobId: jobId,
      MaxResults: 1,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.Results?.length).toBe(1);
});
