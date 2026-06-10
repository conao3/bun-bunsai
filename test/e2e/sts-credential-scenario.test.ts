import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { CreateRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import {
  CreateBucketCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  ListQueuesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  AssumeRoleCommand,
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
  STSClient,
} from "@aws-sdk/client-sts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const federationHandler = {
  handle(req: Parameters<typeof requestHandler.handle>[0]) {
    const headers = req.headers.authorization
      ? req.headers
      : {
          ...req.headers,
          authorization:
            "AWS4-HMAC-SHA256 Credential=test/20260101/us-east-1/sts/aws4_request, SignedHeaders=host, Signature=0000000000000000000000000000000000000000000000000000000000000000",
        };
    return requestHandler.handle({ ...req, headers });
  },
  updateHttpClientConfig: () => {},
  httpHandlerConfigs: () => ({}) as Record<string, never>,
} as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });
const sts = () =>
  new STSClient({ endpoint, region, credentials, requestHandler });
const stsF = () =>
  new STSClient({
    endpoint,
    region,
    credentials,
    requestHandler: federationHandler,
  });

test("IAM CreateRole → AssumeRole → S3/SQS ops with temp creds visible in same account", async () => {
  const roleResp = await iam().send(
    new CreateRoleCommand({
      RoleName: "sts-scenario-same-acct-role",
      AssumeRolePolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
    }),
  );
  const roleArn = roleResp.Role?.Arn ?? "";
  expect(roleArn).toBe(
    "arn:aws:iam::000000000000:role/sts-scenario-same-acct-role",
  );

  const assumed = await sts().send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "scenario-same-acct-session",
    }),
  );
  expect(assumed.Credentials?.AccessKeyId).toMatch(/^ASIA/);
  expect(assumed.Credentials?.SecretAccessKey).toBeDefined();
  expect(assumed.Credentials?.SessionToken).toBeDefined();
  expect(assumed.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(assumed.Credentials?.Expiration?.getTime() ?? 0).toBeGreaterThan(
    Date.now(),
  );

  const tempCreds = {
    accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
    secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
    sessionToken: assumed.Credentials?.SessionToken ?? "",
  };

  const s3Temp = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });
  const s3Orig = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials,
  });
  const sqsTemp = new SQSClient({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });
  const sqsOrig = new SQSClient({
    endpoint,
    region,
    requestHandler,
    credentials,
  });

  await s3Temp.send(
    new CreateBucketCommand({ Bucket: "sts-scenario-same-acct-bucket" }),
  );
  const s3FromTemp = await s3Temp.send(new ListBucketsCommand({}));
  expect(
    s3FromTemp.Buckets?.some((b) => b.Name === "sts-scenario-same-acct-bucket"),
  ).toBe(true);
  const s3FromOrig = await s3Orig.send(new ListBucketsCommand({}));
  expect(
    s3FromOrig.Buckets?.some((b) => b.Name === "sts-scenario-same-acct-bucket"),
  ).toBe(true);

  await sqsTemp.send(
    new CreateQueueCommand({ QueueName: "sts-scenario-same-acct-queue" }),
  );
  const sqsFromTemp = await sqsTemp.send(new ListQueuesCommand({}));
  expect(
    sqsFromTemp.QueueUrls?.some((u) =>
      u.includes("sts-scenario-same-acct-queue"),
    ),
  ).toBe(true);
  const sqsFromOrig = await sqsOrig.send(new ListQueuesCommand({}));
  expect(
    sqsFromOrig.QueueUrls?.some((u) =>
      u.includes("sts-scenario-same-acct-queue"),
    ),
  ).toBe(true);
});

test("AssumeRole temp creds: GetCallerIdentity reflects assumed-role ARN", async () => {
  const assumed = await sts().send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::000000000000:role/scenario-caller-id-role",
      RoleSessionName: "caller-id-session",
    }),
  );
  const tempSts = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
      secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
      sessionToken: assumed.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await tempSts.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("000000000000");
  expect(identity.Arn).toBe(
    "arn:aws:sts::000000000000:assumed-role/scenario-caller-id-role/caller-id-session",
  );
  expect(identity.UserId).toContain("caller-id-session");
});

test("AssumeRole cross-account: S3/SQS resources scoped to role account, not original", async () => {
  const assumed = await sts().send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::999988887777:role/cross-acct-scenario-role",
      RoleSessionName: "cross-acct-scenario-session",
    }),
  );
  expect(assumed.Credentials?.AccessKeyId).toMatch(/^ASIA999988887777/);

  const tempCreds = {
    accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
    secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
    sessionToken: assumed.Credentials?.SessionToken ?? "",
  };
  const s3Temp = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });
  const s3Orig = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials,
  });
  const sqsTemp = new SQSClient({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });
  const sqsOrig = new SQSClient({
    endpoint,
    region,
    requestHandler,
    credentials,
  });

  await s3Temp.send(
    new CreateBucketCommand({ Bucket: "sts-scenario-cross-acct-bucket" }),
  );
  const s3FromTemp = await s3Temp.send(new ListBucketsCommand({}));
  expect(
    s3FromTemp.Buckets?.some(
      (b) => b.Name === "sts-scenario-cross-acct-bucket",
    ),
  ).toBe(true);
  const s3FromOrig = await s3Orig.send(new ListBucketsCommand({}));
  expect(
    s3FromOrig.Buckets?.some(
      (b) => b.Name === "sts-scenario-cross-acct-bucket",
    ),
  ).toBe(false);

  await sqsTemp.send(
    new CreateQueueCommand({ QueueName: "sts-scenario-cross-acct-queue" }),
  );
  const sqsFromTemp = await sqsTemp.send(new ListQueuesCommand({}));
  expect(
    sqsFromTemp.QueueUrls?.some((u) =>
      u.includes("sts-scenario-cross-acct-queue"),
    ),
  ).toBe(true);
  const sqsFromOrig = await sqsOrig.send(new ListQueuesCommand({}));
  expect(
    sqsFromOrig.QueueUrls?.some((u) =>
      u.includes("sts-scenario-cross-acct-queue"),
    ),
  ).toBe(false);
});

test("AssumeRoleWithWebIdentity temp creds used for S3 and SQS calls", async () => {
  const assumed = await stsF().send(
    new AssumeRoleWithWebIdentityCommand({
      RoleArn: "arn:aws:iam::777766665555:role/webid-scenario-role",
      RoleSessionName: "webid-scenario-session",
      WebIdentityToken: "eyJhbGciOiJSUzI1NiJ9.dummy.webid-scenario",
    }),
  );
  expect(assumed.Credentials?.AccessKeyId).toMatch(/^ASIA/);
  expect(assumed.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(assumed.Credentials?.Expiration?.getTime() ?? 0).toBeGreaterThan(
    Date.now(),
  );
  expect(assumed.AssumedRoleUser?.Arn).toContain(
    "arn:aws:sts::777766665555:assumed-role/webid-scenario-role/webid-scenario-session",
  );

  const tempCreds = {
    accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
    secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
    sessionToken: assumed.Credentials?.SessionToken ?? "",
  };
  const s3Temp = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });
  const sqsTemp = new SQSClient({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });

  await s3Temp.send(
    new CreateBucketCommand({ Bucket: "sts-scenario-webid-bucket" }),
  );
  const listBuckets = await s3Temp.send(new ListBucketsCommand({}));
  expect(
    listBuckets.Buckets?.some((b) => b.Name === "sts-scenario-webid-bucket"),
  ).toBe(true);

  await sqsTemp.send(
    new CreateQueueCommand({ QueueName: "sts-scenario-webid-queue" }),
  );
  const listQueues = await sqsTemp.send(new ListQueuesCommand({}));
  expect(
    listQueues.QueueUrls?.some((u) => u.includes("sts-scenario-webid-queue")),
  ).toBe(true);
});
