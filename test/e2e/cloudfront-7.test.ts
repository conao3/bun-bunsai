import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFrontClient,
  CreateFunctionCommand,
  DescribeFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionCommand,
  PublishFunctionCommand,
  TestFunctionCommand,
  ListFunctionsCommand,
  DeleteFunctionCommand,
  CreateKeyValueStoreCommand,
  DescribeKeyValueStoreCommand,
  UpdateKeyValueStoreCommand,
  ListKeyValueStoresCommand,
  DeleteKeyValueStoreCommand,
  CreateOriginRequestPolicyCommand,
  GetOriginRequestPolicyCommand,
  GetOriginRequestPolicyConfigCommand,
  ListOriginRequestPoliciesCommand,
  UpdateOriginRequestPolicyCommand,
  DeleteOriginRequestPolicyCommand,
  CreateRealtimeLogConfigCommand,
  GetRealtimeLogConfigCommand,
  UpdateRealtimeLogConfigCommand,
  ListRealtimeLogConfigsCommand,
  DeleteRealtimeLogConfigCommand,
  CreateResponseHeadersPolicyCommand,
  GetResponseHeadersPolicyCommand,
  GetResponseHeadersPolicyConfigCommand,
  ListResponseHeadersPoliciesCommand,
  UpdateResponseHeadersPolicyCommand,
  DeleteResponseHeadersPolicyCommand,
  CreateStreamingDistributionCommand,
  GetStreamingDistributionCommand,
  GetStreamingDistributionConfigCommand,
  ListStreamingDistributionsCommand,
  UpdateStreamingDistributionCommand,
  DeleteStreamingDistributionCommand,
  CreateTrustStoreCommand,
  GetTrustStoreCommand,
  ListTrustStoresCommand,
  UpdateTrustStoreCommand,
  DeleteTrustStoreCommand,
  CreateVpcOriginCommand,
  GetVpcOriginCommand,
  ListVpcOriginsCommand,
  UpdateVpcOriginCommand,
  DeleteVpcOriginCommand,
  PutResourcePolicyCommand,
  GetResourcePolicyCommand,
  DeleteResourcePolicyCommand,
  FunctionRuntime,
} from "@aws-sdk/client-cloudfront";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudfront = () =>
  new CloudFrontClient({ endpoint, region, credentials, requestHandler });

test("Function lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateFunctionCommand({
      Name: "test-fn",
      FunctionConfig: {
        Comment: "test",
        Runtime: FunctionRuntime.cloudfront_js_2_0,
      },
      FunctionCode: Buffer.from("function handler(e){return e;}"),
    }),
  );
  const name = created.FunctionSummary?.Name;
  expect(name).toBe("test-fn");
  expect(created.ETag).toBeTruthy();

  const described = await client.send(
    new DescribeFunctionCommand({ Name: name! }),
  );
  expect(described.FunctionSummary?.Name).toBe(name);
  expect(described.ETag).toBeTruthy();

  await client.send(new GetFunctionCommand({ Name: name! }));

  const list = await client.send(new ListFunctionsCommand({}));
  expect(list.FunctionList?.Items?.some((i) => i.Name === name)).toBe(true);

  const updated = await client.send(
    new UpdateFunctionCommand({
      Name: name!,
      IfMatch: described.ETag!,
      FunctionConfig: {
        Comment: "updated",
        Runtime: FunctionRuntime.cloudfront_js_2_0,
      },
      FunctionCode: Buffer.from("function handler(e){return e;}"),
    }),
  );
  expect(updated.ETag).not.toBe(described.ETag);

  const published = await client.send(
    new PublishFunctionCommand({ Name: name!, IfMatch: updated.ETag! }),
  );
  expect(published.FunctionSummary?.FunctionMetadata?.Stage).toBe("LIVE");

  await client.send(
    new TestFunctionCommand({
      Name: name!,
      IfMatch: published.ETag ?? updated.ETag!,
      Stage: "LIVE",
      EventObject: Buffer.from("{}"),
    }),
  );

  await client.send(
    new DeleteFunctionCommand({
      Name: name!,
      IfMatch: published.ETag ?? updated.ETag!,
    }),
  );
});

test("KeyValueStore lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateKeyValueStoreCommand({ Name: "my-kvs", Comment: "test store" }),
  );
  const name = created.KeyValueStore?.Name;
  expect(name).toBe("my-kvs");
  expect(created.ETag).toBeTruthy();

  const described = await client.send(
    new DescribeKeyValueStoreCommand({ Name: name! }),
  );
  expect(described.KeyValueStore?.Name).toBe(name);

  const list = await client.send(new ListKeyValueStoresCommand({}));
  expect(list.KeyValueStoreList?.Items?.some((i) => i.Name === name)).toBe(
    true,
  );

  const updated = await client.send(
    new UpdateKeyValueStoreCommand({
      Name: name!,
      Comment: "updated comment",
      IfMatch: described.ETag!,
    }),
  );
  expect(updated.ETag).not.toBe(described.ETag);

  await client.send(
    new DeleteKeyValueStoreCommand({ Name: name!, IfMatch: updated.ETag! }),
  );
});

test("OriginRequestPolicy lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateOriginRequestPolicyCommand({
      OriginRequestPolicyConfig: {
        Name: "test-orpolicy",
        HeadersConfig: { HeaderBehavior: "none" },
        CookiesConfig: { CookieBehavior: "none" },
        QueryStringsConfig: { QueryStringBehavior: "none" },
      },
    }),
  );
  const id = created.OriginRequestPolicy?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(new GetOriginRequestPolicyCommand({ Id: id! }));
  expect(got.OriginRequestPolicy?.Id).toBe(id);

  await client.send(new GetOriginRequestPolicyConfigCommand({ Id: id! }));

  const list = await client.send(new ListOriginRequestPoliciesCommand({}));
  expect(
    list.OriginRequestPolicyList?.Items?.some(
      (i) => i.OriginRequestPolicy?.Id === id,
    ),
  ).toBe(true);

  const updated = await client.send(
    new UpdateOriginRequestPolicyCommand({
      Id: id!,
      IfMatch: got.ETag!,
      OriginRequestPolicyConfig: {
        Name: "test-orpolicy-updated",
        HeadersConfig: { HeaderBehavior: "none" },
        CookiesConfig: { CookieBehavior: "none" },
        QueryStringsConfig: { QueryStringBehavior: "none" },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteOriginRequestPolicyCommand({ Id: id!, IfMatch: updated.ETag! }),
  );
});

test("RealtimeLogConfig lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateRealtimeLogConfigCommand({
      Name: "test-rtlog",
      SamplingRate: 50,
      Fields: ["timestamp", "c-ip"],
      EndPoints: [
        {
          StreamType: "Kinesis",
          KinesisStreamConfig: {
            RoleARN: "arn:aws:iam::123456789012:role/test",
            StreamARN: "arn:aws:kinesis:us-east-1:123456789012:stream/test",
          },
        },
      ],
    }),
  );
  const name = created.RealtimeLogConfig?.Name;
  expect(name).toBe("test-rtlog");

  const got = await client.send(
    new GetRealtimeLogConfigCommand({ Name: name! }),
  );
  expect(got.RealtimeLogConfig?.Name).toBe(name);

  const list = await client.send(new ListRealtimeLogConfigsCommand({}));
  expect(list.RealtimeLogConfigs?.Items?.some((i) => i.Name === name)).toBe(
    true,
  );

  await client.send(
    new UpdateRealtimeLogConfigCommand({
      Name: name!,
      SamplingRate: 75,
      Fields: ["timestamp"],
      EndPoints: [],
    }),
  );

  await client.send(new DeleteRealtimeLogConfigCommand({ Name: name! }));
});

test("ResponseHeadersPolicy lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateResponseHeadersPolicyCommand({
      ResponseHeadersPolicyConfig: {
        Name: "test-rhpolicy",
        CorsConfig: {
          AccessControlAllowOrigins: { Quantity: 1, Items: ["*"] },
          AccessControlAllowHeaders: { Quantity: 0, Items: [] },
          AccessControlAllowMethods: { Quantity: 1, Items: ["GET"] },
          AccessControlAllowCredentials: false,
          OriginOverride: false,
        },
      },
    }),
  );
  const id = created.ResponseHeadersPolicy?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetResponseHeadersPolicyCommand({ Id: id! }),
  );
  expect(got.ResponseHeadersPolicy?.Id).toBe(id);

  await client.send(new GetResponseHeadersPolicyConfigCommand({ Id: id! }));

  const list = await client.send(new ListResponseHeadersPoliciesCommand({}));
  expect(
    list.ResponseHeadersPolicyList?.Items?.some(
      (i) => i.ResponseHeadersPolicy?.Id === id,
    ),
  ).toBe(true);

  const updated = await client.send(
    new UpdateResponseHeadersPolicyCommand({
      Id: id!,
      IfMatch: got.ETag!,
      ResponseHeadersPolicyConfig: {
        Name: "test-rhpolicy-updated",
        CorsConfig: {
          AccessControlAllowOrigins: { Quantity: 1, Items: ["*"] },
          AccessControlAllowHeaders: { Quantity: 0, Items: [] },
          AccessControlAllowMethods: { Quantity: 1, Items: ["GET"] },
          AccessControlAllowCredentials: false,
          OriginOverride: false,
        },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteResponseHeadersPolicyCommand({ Id: id!, IfMatch: updated.ETag! }),
  );
});

test("StreamingDistribution lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateStreamingDistributionCommand({
      StreamingDistributionConfig: {
        CallerReference: "test-ref-1",
        S3Origin: {
          DomainName: "bucket.s3.amazonaws.com",
          OriginAccessIdentity: "",
        },
        Comment: "test",
        Enabled: true,
        TrustedSigners: { Enabled: false, Quantity: 0 },
      },
    }),
  );
  const id = created.StreamingDistribution?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(
    new GetStreamingDistributionCommand({ Id: id! }),
  );
  expect(got.StreamingDistribution?.Id).toBe(id);

  await client.send(new GetStreamingDistributionConfigCommand({ Id: id! }));

  const list = await client.send(new ListStreamingDistributionsCommand({}));
  expect(list.StreamingDistributionList?.Items?.some((i) => i.Id === id)).toBe(
    true,
  );

  const updated = await client.send(
    new UpdateStreamingDistributionCommand({
      Id: id!,
      IfMatch: got.ETag!,
      StreamingDistributionConfig: {
        CallerReference: "test-ref-1",
        S3Origin: {
          DomainName: "bucket.s3.amazonaws.com",
          OriginAccessIdentity: "",
        },
        Comment: "updated",
        Enabled: false,
        TrustedSigners: { Enabled: false, Quantity: 0 },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteStreamingDistributionCommand({ Id: id!, IfMatch: updated.ETag! }),
  );
});

test("TrustStore lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateTrustStoreCommand({
      Name: "test-truststore",
      CaCertificatesBundleSource: {
        S3BucketSource: {
          S3Region: "us-east-1",
          S3Bucket: "my-bucket",
          S3Key: "ca-bundle.pem",
        },
      },
    }),
  );
  const id = created.TrustStore?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(new GetTrustStoreCommand({ Identifier: id! }));
  expect(got.TrustStore?.Id).toBe(id);

  const list = await client.send(new ListTrustStoresCommand({}));
  expect(list.TrustStoreList?.some((i) => i.Id === id)).toBe(true);

  const updated = await client.send(
    new UpdateTrustStoreCommand({
      Id: id!,
      IfMatch: got.ETag!,
      CaCertificatesBundleSource: {
        S3BucketSource: {
          S3Region: "us-east-1",
          S3Bucket: "my-bucket",
          S3Key: "ca-bundle-v2.pem",
        },
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteTrustStoreCommand({ Id: id!, IfMatch: updated.ETag! }),
  );
});

test("VpcOrigin lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateVpcOriginCommand({
      VpcOriginEndpointConfig: {
        Name: "test-vpc-origin",
        Arn: "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/abc",
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: "https-only",
      },
    }),
  );
  const id = created.VpcOrigin?.Id;
  expect(id).toBeTruthy();
  expect(created.ETag).toBeTruthy();

  const got = await client.send(new GetVpcOriginCommand({ Id: id! }));
  expect(got.VpcOrigin?.Id).toBe(id);

  const list = await client.send(new ListVpcOriginsCommand({}));
  expect(list.VpcOriginList?.Items?.some((i) => i.Id === id)).toBe(true);

  const updated = await client.send(
    new UpdateVpcOriginCommand({
      Id: id!,
      IfMatch: got.ETag!,
      VpcOriginEndpointConfig: {
        Name: "test-vpc-origin-updated",
        Arn: "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/abc",
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: "http-only",
      },
    }),
  );
  expect(updated.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteVpcOriginCommand({ Id: id!, IfMatch: updated.ETag! }),
  );
});

test("ResourcePolicy lifecycle", async () => {
  const client = cloudfront();
  const resourceArn = "arn:aws:cloudfront::123456789012:distribution/ETEST123";

  const put = await client.send(
    new PutResourcePolicyCommand({
      ResourceArn: resourceArn,
      PolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  expect(put.ResourceArn).toBe(resourceArn);

  const got = await client.send(
    new GetResourcePolicyCommand({ ResourceArn: resourceArn }),
  );
  expect(got.ResourceArn).toBe(resourceArn);
  expect(got.PolicyDocument).toBeTruthy();

  await client.send(
    new DeleteResourcePolicyCommand({ ResourceArn: resourceArn }),
  );
});
