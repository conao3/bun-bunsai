import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchDeleteDocumentCommand,
  BatchDeleteFeaturedResultsSetCommand,
  BatchGetDocumentStatusCommand,
  BatchPutDocumentCommand,
  CreateAccessControlConfigurationCommand,
  CreateDataSourceCommand,
  CreateExperienceCommand,
  CreateFaqCommand,
  CreateFeaturedResultsSetCommand,
  CreateIndexCommand,
  CreateQuerySuggestionsBlockListCommand,
  CreateThesaurusCommand,
  DeleteAccessControlConfigurationCommand,
  DeleteDataSourceCommand,
  DeleteExperienceCommand,
  DeleteFaqCommand,
  DeleteIndexCommand,
  DeleteQuerySuggestionsBlockListCommand,
  DeleteThesaurusCommand,
  DescribeAccessControlConfigurationCommand,
  DescribeDataSourceCommand,
  DescribeExperienceCommand,
  DescribeFaqCommand,
  DescribeFeaturedResultsSetCommand,
  DescribeIndexCommand,
  DescribeQuerySuggestionsBlockListCommand,
  DescribeThesaurusCommand,
  KendraClient,
  ListAccessControlConfigurationsCommand,
  ListDataSourcesCommand,
  ListExperiencesCommand,
  ListFaqsCommand,
  ListFeaturedResultsSetsCommand,
  ListIndicesCommand,
  ListQuerySuggestionsBlockListsCommand,
  ListTagsForResourceCommand,
  ListThesauriCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-kendra";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const kendra = () =>
  new KendraClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Kendra index lifecycle", async () => {
  const client = kendra();

  const created = await client.send(
    new CreateIndexCommand({
      Name: "bunsai-e2e-index",
      RoleArn: "arn:aws:iam::000000000000:role/bunsai-kendra",
    }),
  );
  const id = created.Id;
  expect(typeof id).toBe("string");

  const described = await client.send(new DescribeIndexCommand({ Id: id }));
  expect(described.Name).toBe("bunsai-e2e-index");
  expect(described.Status).toBe("ACTIVE");
  expect(described.Id).toBe(id);

  const listed = await client.send(new ListIndicesCommand({}));
  expect(
    (listed.IndexConfigurationSummaryItems ?? []).some((i) => i.Id === id),
  ).toBe(true);

  await client.send(new DeleteIndexCommand({ Id: id }));

  const afterDelete = await client.send(new ListIndicesCommand({}));
  expect(
    (afterDelete.IndexConfigurationSummaryItems ?? []).some((i) => i.Id === id),
  ).toBe(false);
});

test("Kendra data-source lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "ds-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const { Id: dsId } = await client.send(
    new CreateDataSourceCommand({
      IndexId: indexId!,
      Name: "my-ds",
      Type: "S3",
    }),
  );
  expect(typeof dsId).toBe("string");

  const described = await client.send(
    new DescribeDataSourceCommand({ IndexId: indexId!, Id: dsId! }),
  );
  expect(described.Name).toBe("my-ds");
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListDataSourcesCommand({ IndexId: indexId! }),
  );
  expect((listed.SummaryItems ?? []).some((s) => s.Id === dsId)).toBe(true);

  await client.send(
    new DeleteDataSourceCommand({ IndexId: indexId!, Id: dsId! }),
  );

  const after = await client.send(
    new ListDataSourcesCommand({ IndexId: indexId! }),
  );
  expect((after.SummaryItems ?? []).some((s) => s.Id === dsId)).toBe(false);

  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra FAQ lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "faq-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const { Id: faqId } = await client.send(
    new CreateFaqCommand({
      IndexId: indexId!,
      Name: "my-faq",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
      S3Path: { Bucket: "my-bucket", Key: "faq.csv" },
    }),
  );
  expect(typeof faqId).toBe("string");

  const described = await client.send(
    new DescribeFaqCommand({ IndexId: indexId!, Id: faqId! }),
  );
  expect(described.Name).toBe("my-faq");
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(new ListFaqsCommand({ IndexId: indexId! }));
  expect((listed.FaqSummaryItems ?? []).some((f) => f.Id === faqId)).toBe(true);

  await client.send(new DeleteFaqCommand({ IndexId: indexId!, Id: faqId! }));
  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra experience lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "exp-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const { Id: expId } = await client.send(
    new CreateExperienceCommand({
      IndexId: indexId!,
      Name: "my-exp",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );
  expect(typeof expId).toBe("string");

  const described = await client.send(
    new DescribeExperienceCommand({ IndexId: indexId!, Id: expId! }),
  );
  expect(described.Name).toBe("my-exp");
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListExperiencesCommand({ IndexId: indexId! }),
  );
  expect((listed.SummaryItems ?? []).some((e) => e.Id === expId)).toBe(true);

  await client.send(
    new DeleteExperienceCommand({ IndexId: indexId!, Id: expId! }),
  );
  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra thesaurus lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "thes-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const { Id: thesId } = await client.send(
    new CreateThesaurusCommand({
      IndexId: indexId!,
      Name: "my-thesaurus",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
      SourceS3Path: { Bucket: "my-bucket", Key: "thes.csv" },
    }),
  );
  expect(typeof thesId).toBe("string");

  const described = await client.send(
    new DescribeThesaurusCommand({ IndexId: indexId!, Id: thesId! }),
  );
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListThesauriCommand({ IndexId: indexId! }),
  );
  expect(
    (listed.ThesaurusSummaryItems ?? []).some((t) => t.Id === thesId),
  ).toBe(true);

  await client.send(
    new DeleteThesaurusCommand({ IndexId: indexId!, Id: thesId! }),
  );
  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra access-control-config lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "acc-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const { Id: accId } = await client.send(
    new CreateAccessControlConfigurationCommand({
      IndexId: indexId!,
      Name: "my-acc",
    }),
  );
  expect(typeof accId).toBe("string");

  const described = await client.send(
    new DescribeAccessControlConfigurationCommand({
      IndexId: indexId!,
      Id: accId!,
    }),
  );
  expect(described.Name).toBe("my-acc");

  const listed = await client.send(
    new ListAccessControlConfigurationsCommand({ IndexId: indexId! }),
  );
  expect(
    (listed.AccessControlConfigurations ?? []).some((a) => a.Id === accId),
  ).toBe(true);

  await client.send(
    new DeleteAccessControlConfigurationCommand({
      IndexId: indexId!,
      Id: accId!,
    }),
  );
  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra query-suggestions-block-list lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "qsbl-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const { Id: qsblId } = await client.send(
    new CreateQuerySuggestionsBlockListCommand({
      IndexId: indexId!,
      Name: "my-blocklist",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
      SourceS3Path: { Bucket: "my-bucket", Key: "blocklist.txt" },
    }),
  );
  expect(typeof qsblId).toBe("string");

  const described = await client.send(
    new DescribeQuerySuggestionsBlockListCommand({
      IndexId: indexId!,
      Id: qsblId!,
    }),
  );
  expect(described.Name).toBe("my-blocklist");
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListQuerySuggestionsBlockListsCommand({ IndexId: indexId! }),
  );
  expect(
    (listed.BlockListSummaryItems ?? []).some((b) => b.Id === qsblId),
  ).toBe(true);

  await client.send(
    new DeleteQuerySuggestionsBlockListCommand({
      IndexId: indexId!,
      Id: qsblId!,
    }),
  );
  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra tags lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "tag-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const arn = `arn:aws:kendra:${region}:000000000000:index/${indexId!}`;

  await client.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect((listed.Tags ?? []).some((t) => t.Key === "env")).toBe(true);

  await client.send(
    new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "env")).toBe(false);

  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra featured-results-set lifecycle", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "frs-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const created = await client.send(
    new CreateFeaturedResultsSetCommand({
      IndexId: indexId!,
      FeaturedResultsSetName: "my-frs",
      QueryTexts: ["what is kendra"],
    }),
  );
  const frsId = created.FeaturedResultsSet?.FeaturedResultsSetId;
  expect(typeof frsId).toBe("string");

  const described = await client.send(
    new DescribeFeaturedResultsSetCommand({
      IndexId: indexId!,
      FeaturedResultsSetId: frsId!,
    }),
  );
  expect(described.FeaturedResultsSetName).toBe("my-frs");
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListFeaturedResultsSetsCommand({ IndexId: indexId! }),
  );
  expect(
    (listed.FeaturedResultsSetSummaryItems ?? []).some(
      (f) => f.FeaturedResultsSetId === frsId,
    ),
  ).toBe(true);

  await client.send(
    new BatchDeleteFeaturedResultsSetCommand({
      IndexId: indexId!,
      FeaturedResultsSetIds: [frsId!],
    }),
  );

  const afterDelete = await client.send(
    new ListFeaturedResultsSetsCommand({ IndexId: indexId! }),
  );
  expect(
    (afterDelete.FeaturedResultsSetSummaryItems ?? []).some(
      (f) => f.FeaturedResultsSetId === frsId,
    ),
  ).toBe(false);

  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra document store round-trip", async () => {
  const client = kendra();

  const { Id: indexId } = await client.send(
    new CreateIndexCommand({
      Name: "doc-test-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );

  const putResult = await client.send(
    new BatchPutDocumentCommand({
      IndexId: indexId!,
      Documents: [
        { Id: "doc-1", Title: "Test Doc", ContentType: "PLAIN_TEXT" },
        { Id: "doc-2", Title: "Another Doc", ContentType: "PLAIN_TEXT" },
      ],
    }),
  );
  expect((putResult.FailedDocuments ?? []).length).toBe(0);

  const statusAfterPut = await client.send(
    new BatchGetDocumentStatusCommand({
      IndexId: indexId!,
      DocumentInfoList: [
        { DocumentId: "doc-1" },
        { DocumentId: "doc-2" },
        { DocumentId: "doc-missing" },
      ],
    }),
  );
  const statuses = statusAfterPut.DocumentStatusList ?? [];
  expect(statuses.find((s) => s.DocumentId === "doc-1")?.DocumentStatus).toBe(
    "INDEXED",
  );
  expect(statuses.find((s) => s.DocumentId === "doc-2")?.DocumentStatus).toBe(
    "INDEXED",
  );
  expect(
    statuses.find((s) => s.DocumentId === "doc-missing")?.DocumentStatus,
  ).toBe("NOT_FOUND");

  await client.send(
    new BatchDeleteDocumentCommand({
      IndexId: indexId!,
      DocumentIdList: ["doc-1"],
    }),
  );

  const statusAfterDelete = await client.send(
    new BatchGetDocumentStatusCommand({
      IndexId: indexId!,
      DocumentInfoList: [{ DocumentId: "doc-1" }, { DocumentId: "doc-2" }],
    }),
  );
  const statusesAfter = statusAfterDelete.DocumentStatusList ?? [];
  expect(
    statusesAfter.find((s) => s.DocumentId === "doc-1")?.DocumentStatus,
  ).toBe("NOT_FOUND");
  expect(
    statusesAfter.find((s) => s.DocumentId === "doc-2")?.DocumentStatus,
  ).toBe("INDEXED");

  await client.send(new DeleteIndexCommand({ Id: indexId! }));
});

test("Kendra ListIndices pagination", async () => {
  const client = kendra();

  const indexIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { Id } = await client.send(
      new CreateIndexCommand({
        Name: `paginate-index-${i}`,
        RoleArn: "arn:aws:iam::000000000000:role/kendra",
      }),
    );
    indexIds.push(Id!);
  }

  const page1 = await client.send(new ListIndicesCommand({ MaxResults: 2 }));
  expect((page1.IndexConfigurationSummaryItems ?? []).length).toBe(2);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new ListIndicesCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect(
    (page2.IndexConfigurationSummaryItems ?? []).length,
  ).toBeGreaterThanOrEqual(1);

  for (const id of indexIds) {
    await client.send(new DeleteIndexCommand({ Id: id }));
  }
});

test("Kendra ClientToken idempotency", async () => {
  const client = kendra();
  const token = `idem-token-${Date.now()}`;

  const first = await client.send(
    new CreateIndexCommand({
      Name: "idem-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
      ClientToken: token,
    }),
  );
  const second = await client.send(
    new CreateIndexCommand({
      Name: "idem-index-2",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
      ClientToken: token,
    }),
  );
  expect(first.Id).toBe(second.Id);

  await client.send(new DeleteIndexCommand({ Id: first.Id! }));
});

test("Kendra tag round-trip", async () => {
  const client = kendra();

  const { Id: id } = await client.send(
    new CreateIndexCommand({
      Name: "tag-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const arn = `arn:aws:kendra:us-east-1:000000000000:index/${id}`;

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(listed.Tags).toEqual([{ Key: "env", Value: "test" }]);

  await client.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [{ Key: "team", Value: "qa" }],
    }),
  );
  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(after.Tags?.find((t) => t.Key === "team")?.Value).toBe("qa");

  await client.send(new DeleteIndexCommand({ Id: id! }));

  const afterDelete = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(afterDelete.Tags ?? []).toEqual([]);
});

test("Kendra DELETING lifecycle", async () => {
  const client = kendra();

  const { Id: id } = await client.send(
    new CreateIndexCommand({
      Name: "delete-lifecycle-index",
      RoleArn: "arn:aws:iam::000000000000:role/kendra",
    }),
  );
  await client.send(new DescribeIndexCommand({ Id: id }));

  await client.send(new DeleteIndexCommand({ Id: id! }));

  const deleting = await client.send(new DescribeIndexCommand({ Id: id! }));
  expect(deleting.Status).toBe("DELETING");

  await expect(
    client.send(new DescribeIndexCommand({ Id: id! })),
  ).rejects.toThrow();

  const listed = await client.send(new ListIndicesCommand({}));
  expect(
    (listed.IndexConfigurationSummaryItems ?? []).some((i) => i.Id === id),
  ).toBe(false);
});
