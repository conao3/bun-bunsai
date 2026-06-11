import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AnalyzeDocumentCommand,
  BlockType,
  CreateAdapterCommand,
  CreateAdapterVersionCommand,
  DeleteAdapterCommand,
  DetectDocumentTextCommand,
  GetDocumentAnalysisCommand,
  GetDocumentTextDetectionCommand,
  InvalidJobIdException,
  InvalidS3ObjectException,
  ListAdaptersCommand,
  StartDocumentAnalysisCommand,
  StartDocumentTextDetectionCommand,
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

test("DetectDocumentText: S3Object — real object succeeds", async () => {
  const s3Client = s3();
  const bucket = "textract-e2e-bucket";
  const key = "sample.jpg";

  await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
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

test("Adapter CRUD lifecycle", async () => {
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
          Bucket: "textract-e2e-bucket",
          Name: "manifest.json",
        },
      },
      OutputConfig: { S3Bucket: "textract-e2e-bucket" },
    }),
  );
  expect(av.AdapterId).toBe(adapterId);
  expect(typeof av.AdapterVersion).toBe("string");

  const adapterArn = `arn:aws:textract:us-east-1:000000000000:adapter/${adapterId}`;
  await client.send(
    new UntagResourceCommand({
      ResourceARN: adapterArn,
      TagKeys: ["env"],
    }),
  );

  await client.send(new DeleteAdapterCommand({ AdapterId: adapterId }));

  const listed2 = await client.send(new ListAdaptersCommand({}));
  expect(listed2.Adapters?.some((a) => a.AdapterId === adapterId)).toBe(false);
});
