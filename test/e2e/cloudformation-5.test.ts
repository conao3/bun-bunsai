import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStackResourcesCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });

const s3 = () =>
  new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });

const bucketName = "cfn-s3-lifecycle-bucket";

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    MyBucket: {
      Type: "AWS::S3::Bucket",
      Properties: { BucketName: bucketName },
    },
  },
});

test("CloudFormation S3 bucket lifecycle: create → describe → use → delete", async () => {
  const cfnClient = cfn();
  const s3Client = s3();
  const stackName = "cfn-s3-lifecycle-stack";

  const created = await cfnClient.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );
  expect(created.StackId).toBeDefined();
  expect(created.StackId).toContain(`:stack/${stackName}/`);

  const described = await cfnClient.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  expect(described.Stacks?.length).toBe(1);
  expect(described.Stacks?.[0]?.StackStatus).toBe("CREATE_COMPLETE");
  expect(described.Stacks?.[0]?.StackName).toBe(stackName);

  const resources = await cfnClient.send(
    new DescribeStackResourcesCommand({ StackName: stackName }),
  );
  expect(resources.StackResources?.length).toBe(1);
  const bucketResource = resources.StackResources?.[0];
  expect(bucketResource?.LogicalResourceId).toBe("MyBucket");
  expect(bucketResource?.ResourceType).toBe("AWS::S3::Bucket");
  expect(bucketResource?.PhysicalResourceId).toBe(bucketName);
  expect(bucketResource?.ResourceStatus).toBe("CREATE_COMPLETE");

  const head = await s3Client.send(
    new HeadBucketCommand({ Bucket: bucketName }),
  );
  expect(head.$metadata.httpStatusCode).toBe(200);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: "test-key",
      Body: "hello-from-cfn",
    }),
  );

  const got = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: "test-key" }),
  );
  const body = await got.Body?.transformToString();
  expect(body).toBe("hello-from-cfn");

  await cfnClient.send(new DeleteStackCommand({ StackName: stackName }));

  await expect(
    s3Client.send(new HeadBucketCommand({ Bucket: bucketName })),
  ).rejects.toThrow();
});
