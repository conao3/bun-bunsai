import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DescribeReportCreationCommand,
  GetComplianceSummaryCommand,
  GetResourcesCommand,
  GetTagKeysCommand,
  GetTagValuesCommand,
  ResourceGroupsTaggingAPIClient,
  StartReportCreationCommand,
  TagResourcesCommand,
  UntagResourcesCommand,
} from "@aws-sdk/client-resource-groups-tagging-api";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new ResourceGroupsTaggingAPIClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const arnA = "arn:aws:ec2:us-east-1:000000000000:instance/i-tag00000000001";
const arnB = "arn:aws:s3:::bunsai-tag-bucket-001";

test("ResourceGroupsTaggingAPI TagResources, GetResources, UntagResources roundtrip", async () => {
  const c = client();

  const tagged = await c.send(
    new TagResourcesCommand({
      ResourceARNList: [arnA, arnB],
      Tags: { env: "test", owner: "bunsai" },
    }),
  );
  expect(tagged.FailedResourcesMap).toBeDefined();

  const all = await c.send(new GetResourcesCommand({}));
  const arns = (all.ResourceTagMappingList ?? []).map((r) => r.ResourceARN);
  expect(arns).toContain(arnA);
  expect(arns).toContain(arnB);

  const filtered = await c.send(
    new GetResourcesCommand({
      TagFilters: [{ Key: "env", Values: ["test"] }],
    }),
  );
  const filteredArns = (filtered.ResourceTagMappingList ?? []).map(
    (r) => r.ResourceARN,
  );
  expect(filteredArns).toContain(arnA);
  expect(filteredArns).toContain(arnB);

  const typeFiltered = await c.send(
    new GetResourcesCommand({ ResourceTypeFilters: ["ec2:instance"] }),
  );
  const typeArns = (typeFiltered.ResourceTagMappingList ?? []).map(
    (r) => r.ResourceARN,
  );
  expect(typeArns).toContain(arnA);
  expect(typeArns).not.toContain(arnB);

  const arnListFiltered = await c.send(
    new GetResourcesCommand({ ResourceARNList: [arnA] }),
  );
  const arnListArns = (arnListFiltered.ResourceTagMappingList ?? []).map(
    (r) => r.ResourceARN,
  );
  expect(arnListArns).toEqual([arnA]);

  const untagged = await c.send(
    new UntagResourcesCommand({
      ResourceARNList: [arnA, arnB],
      TagKeys: ["owner"],
    }),
  );
  expect(untagged.FailedResourcesMap).toBeDefined();

  const after = await c.send(
    new GetResourcesCommand({
      TagFilters: [{ Key: "owner" }],
    }),
  );
  expect((after.ResourceTagMappingList ?? []).length).toBe(0);
});

test("ResourceGroupsTaggingAPI GetTagKeys and GetTagValues", async () => {
  const c = client();
  const arn = "arn:aws:lambda:us-east-1:000000000000:function:tagkeys-fn";
  await c.send(
    new TagResourcesCommand({
      ResourceARNList: [arn],
      Tags: { project: "bunsai", stage: "dev" },
    }),
  );

  const keys = await c.send(new GetTagKeysCommand({}));
  expect(keys.TagKeys ?? []).toContain("project");
  expect(keys.TagKeys ?? []).toContain("stage");

  const values = await c.send(new GetTagValuesCommand({ Key: "project" }));
  expect(values.TagValues ?? []).toContain("bunsai");
});

test("ResourceGroupsTaggingAPI StartReportCreation and DescribeReportCreation", async () => {
  const c = client();
  await c.send(new StartReportCreationCommand({ S3Bucket: "report-bucket" }));
  const desc = await c.send(new DescribeReportCreationCommand({}));
  expect(desc.Status).toBe("SUCCEEDED");
  expect(desc.S3Location).toContain("report-bucket");
});

test("ResourceGroupsTaggingAPI GetComplianceSummary returns valid shape", async () => {
  const c = client();
  const result = await c.send(new GetComplianceSummaryCommand({}));
  expect(Array.isArray(result.SummaryList)).toBe(true);
});
