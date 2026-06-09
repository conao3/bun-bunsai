import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCampaignCommand,
  CreateDatasetCommand,
  CreateDatasetGroupCommand,
  CreateDatasetImportJobCommand,
  CreateEventTrackerCommand,
  CreateFilterCommand,
  CreateRecommenderCommand,
  CreateSchemaCommand,
  CreateSolutionCommand,
  CreateSolutionVersionCommand,
  DescribeSchemaCommand,
  DeleteCampaignCommand,
  DeleteDatasetGroupCommand,
  DeleteSchemaCommand,
  DescribeCampaignCommand,
  DescribeDatasetGroupCommand,
  DescribeDatasetImportJobCommand,
  DescribeEventTrackerCommand,
  DescribeFilterCommand,
  DescribeRecommenderCommand,
  DescribeSolutionCommand,
  DescribeSolutionVersionCommand,
  ListCampaignsCommand,
  ListDatasetGroupsCommand,
  ListEventTrackersCommand,
  ListFiltersCommand,
  ListRecommendersCommand,
  ListSchemasCommand,
  ListSolutionsCommand,
  ListTagsForResourceCommand,
  PersonalizeClient,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-personalize";
import type { TagResourceCommandInput } from "@aws-sdk/client-personalize";

const advanceToActive = async (
  getStatus: () => Promise<string | undefined>,
): Promise<string> => {
  let status = "";
  for (let i = 0; i < 3; i++) {
    status = (await getStatus()) ?? "";
    if (status === "ACTIVE" || status === "INACTIVE") break;
  }
  return status;
};

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const personalize = () =>
  new PersonalizeClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Personalize schema lifecycle", async () => {
  const client = personalize();
  const name = "bunsai-e2e-personalize";
  const schema = JSON.stringify({
    type: "record",
    name: "Interactions",
    namespace: "com.amazonaws.personalize.schema",
    fields: [
      { name: "USER_ID", type: "string" },
      { name: "ITEM_ID", type: "string" },
      { name: "TIMESTAMP", type: "long" },
    ],
    version: "1.0",
  });

  const created = await client.send(new CreateSchemaCommand({ name, schema }));
  expect(created.schemaArn).toContain(name);
  const arn = created.schemaArn ?? "";

  const described = await client.send(
    new DescribeSchemaCommand({ schemaArn: arn }),
  );
  expect(described.schema?.name).toBe(name);
  expect(described.schema?.schemaArn).toBe(arn);
  expect(described.schema?.schema).toBe(schema);

  const listed = await client.send(new ListSchemasCommand({}));
  expect((listed.schemas ?? []).some((s) => s.schemaArn === arn)).toBe(true);

  await client.send(new DeleteSchemaCommand({ schemaArn: arn }));

  const afterDelete = await client.send(new ListSchemasCommand({}));
  expect((afterDelete.schemas ?? []).some((s) => s.schemaArn === arn)).toBe(
    false,
  );
});

test("Personalize dataset-group lifecycle", async () => {
  const client = personalize();
  const name = "bunsai-e2e-dsg";

  const created = await client.send(
    new CreateDatasetGroupCommand({ name, domain: "ECOMMERCE" }),
  );
  expect(created.datasetGroupArn).toContain(name);
  const arn = created.datasetGroupArn ?? "";
  expect(created.domain).toBe("ECOMMERCE");

  const described = await client.send(
    new DescribeDatasetGroupCommand({ datasetGroupArn: arn }),
  );
  expect(described.datasetGroup?.name).toBe(name);
  expect(described.datasetGroup?.datasetGroupArn).toBe(arn);
  expect(described.datasetGroup?.status).toBe("CREATE IN_PROGRESS");
  const dsgStatus = await advanceToActive(() =>
    client
      .send(new DescribeDatasetGroupCommand({ datasetGroupArn: arn }))
      .then((r) => r.datasetGroup?.status),
  );
  expect(dsgStatus).toBe("ACTIVE");

  const listed = await client.send(new ListDatasetGroupsCommand({}));
  expect(
    (listed.datasetGroups ?? []).some((g) => g.datasetGroupArn === arn),
  ).toBe(true);

  await client.send(new DeleteDatasetGroupCommand({ datasetGroupArn: arn }));

  const afterDelete = await client.send(new ListDatasetGroupsCommand({}));
  expect(
    (afterDelete.datasetGroups ?? []).some((g) => g.datasetGroupArn === arn),
  ).toBe(false);
});

test("Personalize dataset + import-job lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-ds" }),
      )
    ).datasetGroupArn ?? "";

  const schemaArn =
    (
      await client.send(
        new CreateSchemaCommand({
          name: "bunsai-e2e-schema-ds",
          schema: JSON.stringify({
            type: "record",
            name: "Interactions",
            namespace: "com.amazonaws.personalize.schema",
            fields: [
              { name: "USER_ID", type: "string" },
              { name: "ITEM_ID", type: "string" },
              { name: "TIMESTAMP", type: "long" },
            ],
            version: "1.0",
          }),
        }),
      )
    ).schemaArn ?? "";

  const dsCreated = await client.send(
    new CreateDatasetCommand({
      name: "bunsai-e2e-ds",
      schemaArn,
      datasetGroupArn: dsgArn,
      datasetType: "Interactions",
    }),
  );
  expect(dsCreated.datasetArn).toContain("bunsai-e2e-ds");
  const dsArn = dsCreated.datasetArn ?? "";

  const importJobCreated = await client.send(
    new CreateDatasetImportJobCommand({
      jobName: "bunsai-e2e-import",
      datasetArn: dsArn,
      dataSource: { dataLocation: "s3://bucket/key" },
      roleArn: "arn:aws:iam::000000000000:role/test",
    }),
  );
  expect(importJobCreated.datasetImportJobArn).toBeDefined();
  const importJobArn = importJobCreated.datasetImportJobArn ?? "";

  const described = await client.send(
    new DescribeDatasetImportJobCommand({ datasetImportJobArn: importJobArn }),
  );
  expect(described.datasetImportJob?.jobName).toBe("bunsai-e2e-import");
  expect(described.datasetImportJob?.datasetArn).toBe(dsArn);
  expect(described.datasetImportJob?.status).toBe("CREATE IN_PROGRESS");
  const importStatus = await advanceToActive(() =>
    client
      .send(
        new DescribeDatasetImportJobCommand({
          datasetImportJobArn: importJobArn,
        }),
      )
      .then((r) => r.datasetImportJob?.status),
  );
  expect(importStatus).toBe("ACTIVE");
});

test("Personalize solution + solution-version lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-sol" }),
      )
    ).datasetGroupArn ?? "";

  const solCreated = await client.send(
    new CreateSolutionCommand({
      name: "bunsai-e2e-sol",
      datasetGroupArn: dsgArn,
      recipeArn: "arn:aws:personalize:::recipe/aws-user-personalization",
    }),
  );
  expect(solCreated.solutionArn).toContain("bunsai-e2e-sol");
  const solArn = solCreated.solutionArn ?? "";

  const solDescribed = await client.send(
    new DescribeSolutionCommand({ solutionArn: solArn }),
  );
  expect(solDescribed.solution?.name).toBe("bunsai-e2e-sol");
  expect(solDescribed.solution?.datasetGroupArn).toBe(dsgArn);

  const listedSols = await client.send(
    new ListSolutionsCommand({ datasetGroupArn: dsgArn }),
  );
  expect(
    (listedSols.solutions ?? []).some((s) => s.solutionArn === solArn),
  ).toBe(true);

  const svCreated = await client.send(
    new CreateSolutionVersionCommand({ solutionArn: solArn }),
  );
  expect(svCreated.solutionVersionArn).toBeDefined();
  const svArn = svCreated.solutionVersionArn ?? "";

  const svDescribed = await client.send(
    new DescribeSolutionVersionCommand({ solutionVersionArn: svArn }),
  );
  expect(svDescribed.solutionVersion?.solutionArn).toBe(solArn);
  expect(svDescribed.solutionVersion?.status).toBe("CREATE IN_PROGRESS");
  const svStatus = await advanceToActive(() =>
    client
      .send(new DescribeSolutionVersionCommand({ solutionVersionArn: svArn }))
      .then((r) => r.solutionVersion?.status),
  );
  expect(svStatus).toBe("ACTIVE");
});

test("Personalize campaign lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-cmp" }),
      )
    ).datasetGroupArn ?? "";

  const solArn =
    (
      await client.send(
        new CreateSolutionCommand({
          name: "bunsai-e2e-sol-cmp",
          datasetGroupArn: dsgArn,
        }),
      )
    ).solutionArn ?? "";

  const svArn =
    (
      await client.send(
        new CreateSolutionVersionCommand({ solutionArn: solArn }),
      )
    ).solutionVersionArn ?? "";

  const cmpCreated = await client.send(
    new CreateCampaignCommand({
      name: "bunsai-e2e-campaign",
      solutionVersionArn: svArn,
      minProvisionedTPS: 1,
    }),
  );
  expect(cmpCreated.campaignArn).toContain("bunsai-e2e-campaign");
  const cmpArn = cmpCreated.campaignArn ?? "";

  const described = await client.send(
    new DescribeCampaignCommand({ campaignArn: cmpArn }),
  );
  expect(described.campaign?.name).toBe("bunsai-e2e-campaign");
  expect(described.campaign?.solutionVersionArn).toBe(svArn);
  expect(described.campaign?.minProvisionedTPS).toBe(1);

  const listed = await client.send(new ListCampaignsCommand({}));
  expect((listed.campaigns ?? []).some((c) => c.campaignArn === cmpArn)).toBe(
    true,
  );

  await client.send(new DeleteCampaignCommand({ campaignArn: cmpArn }));

  const afterDelete = await client.send(new ListCampaignsCommand({}));
  expect(
    (afterDelete.campaigns ?? []).some((c) => c.campaignArn === cmpArn),
  ).toBe(false);
});

test("Personalize recommender lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({
          name: "bunsai-e2e-dsg-rec",
          domain: "ECOMMERCE",
        }),
      )
    ).datasetGroupArn ?? "";

  const recCreated = await client.send(
    new CreateRecommenderCommand({
      name: "bunsai-e2e-rec",
      datasetGroupArn: dsgArn,
      recipeArn: "arn:aws:personalize:::recipe/aws-ecomm-recommended-for-you",
    }),
  );
  expect(recCreated.recommenderArn).toContain("bunsai-e2e-rec");
  const recArn = recCreated.recommenderArn ?? "";

  const described = await client.send(
    new DescribeRecommenderCommand({ recommenderArn: recArn }),
  );
  expect(described.recommender?.name).toBe("bunsai-e2e-rec");
  expect(described.recommender?.datasetGroupArn).toBe(dsgArn);

  const listed = await client.send(
    new ListRecommendersCommand({ datasetGroupArn: dsgArn }),
  );
  expect(
    (listed.recommenders ?? []).some((r) => r.recommenderArn === recArn),
  ).toBe(true);
});

test("Personalize event-tracker lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-et" }),
      )
    ).datasetGroupArn ?? "";

  const etCreated = await client.send(
    new CreateEventTrackerCommand({
      name: "bunsai-e2e-et",
      datasetGroupArn: dsgArn,
    }),
  );
  expect(etCreated.eventTrackerArn).toContain("bunsai-e2e-et");
  expect(etCreated.trackingId).toBeDefined();
  const etArn = etCreated.eventTrackerArn ?? "";

  const described = await client.send(
    new DescribeEventTrackerCommand({ eventTrackerArn: etArn }),
  );
  expect(described.eventTracker?.name).toBe("bunsai-e2e-et");
  expect(described.eventTracker?.datasetGroupArn).toBe(dsgArn);
  expect(described.eventTracker?.trackingId).toBe(etCreated.trackingId);

  const listed = await client.send(
    new ListEventTrackersCommand({ datasetGroupArn: dsgArn }),
  );
  expect(
    (listed.eventTrackers ?? []).some((e) => e.eventTrackerArn === etArn),
  ).toBe(true);
});

test("Personalize filter lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-flt" }),
      )
    ).datasetGroupArn ?? "";

  const fltCreated = await client.send(
    new CreateFilterCommand({
      name: "bunsai-e2e-flt",
      datasetGroupArn: dsgArn,
      filterExpression:
        'EXCLUDE itemId WHERE INTERACTIONS.event_type = "click"',
    }),
  );
  expect(fltCreated.filterArn).toContain("bunsai-e2e-flt");
  const fltArn = fltCreated.filterArn ?? "";

  const described = await client.send(
    new DescribeFilterCommand({ filterArn: fltArn }),
  );
  expect(described.filter?.name).toBe("bunsai-e2e-flt");
  expect(described.filter?.filterExpression).toContain("click");

  const listed = await client.send(
    new ListFiltersCommand({ datasetGroupArn: dsgArn }),
  );
  expect((listed.Filters ?? []).some((f) => f.filterArn === fltArn)).toBe(true);
});

test("Personalize campaign CREATE PENDING→ACTIVE lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-lc" }),
      )
    ).datasetGroupArn ?? "";

  const solArn =
    (
      await client.send(
        new CreateSolutionCommand({
          name: "bunsai-e2e-sol-lc",
          datasetGroupArn: dsgArn,
        }),
      )
    ).solutionArn ?? "";

  const svArn =
    (
      await client.send(
        new CreateSolutionVersionCommand({ solutionArn: solArn }),
      )
    ).solutionVersionArn ?? "";

  const { campaignArn } = await client.send(
    new CreateCampaignCommand({
      name: "bunsai-e2e-cmp-lc",
      solutionVersionArn: svArn,
    }),
  );
  expect(campaignArn).toContain("bunsai-e2e-cmp-lc");
  const cmpArn = campaignArn ?? "";

  const listed = await client.send(new ListCampaignsCommand({}));
  const pendingCmp = (listed.campaigns ?? []).find(
    (c) => c.campaignArn === cmpArn,
  );
  expect(pendingCmp?.status).toBe("CREATE PENDING");

  const described1 = await client.send(
    new DescribeCampaignCommand({ campaignArn: cmpArn }),
  );
  expect(described1.campaign?.status).toBe("CREATE IN_PROGRESS");

  const described2 = await client.send(
    new DescribeCampaignCommand({ campaignArn: cmpArn }),
  );
  expect(described2.campaign?.status).toBe("ACTIVE");
});

test("Personalize ListCampaigns nextToken pagination", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({ name: "bunsai-e2e-dsg-pg" }),
      )
    ).datasetGroupArn ?? "";

  const solArn =
    (
      await client.send(
        new CreateSolutionCommand({
          name: "bunsai-e2e-sol-pg",
          datasetGroupArn: dsgArn,
        }),
      )
    ).solutionArn ?? "";

  const svArn =
    (
      await client.send(
        new CreateSolutionVersionCommand({ solutionArn: solArn }),
      )
    ).solutionVersionArn ?? "";

  for (const suffix of ["a", "b", "c"]) {
    await client.send(
      new CreateCampaignCommand({
        name: `bunsai-e2e-cmp-pg-${suffix}`,
        solutionVersionArn: svArn,
      }),
    );
  }

  const page1 = await client.send(
    new ListCampaignsCommand({
      solutionArn: solArn,
      maxResults: 2,
    }),
  );
  expect((page1.campaigns ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListCampaignsCommand({
      solutionArn: solArn,
      maxResults: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect((page2.campaigns ?? []).length).toBe(1);
  expect(page2.nextToken).toBeUndefined();
});

test("Personalize CreateCampaign missing-ref ResourceNotFoundException", async () => {
  const client = personalize();

  await expect(
    client.send(
      new CreateCampaignCommand({
        name: "bunsai-e2e-cmp-noref",
        solutionVersionArn:
          "arn:aws:personalize:us-east-1:000000000000:solution-version/nonexistent",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("Personalize tags lifecycle", async () => {
  const client = personalize();

  const dsgArn =
    (
      await client.send(
        new CreateDatasetGroupCommand({
          name: "bunsai-e2e-dsg-tags",
          tags: [{ tagKey: "env", tagValue: "test" }],
        }),
      )
    ).datasetGroupArn ?? "";

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: dsgArn }),
  );
  expect((listed.tags as Record<string, string> | undefined)?.["env"]).toBe(
    "test",
  );

  await client.send(
    new TagResourceCommand({
      resourceArn: dsgArn,
      tags: { project: "bunsai" } as unknown as TagResourceCommandInput["tags"],
    }),
  );

  const afterTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: dsgArn }),
  );
  expect((afterTag.tags as Record<string, string> | undefined)?.["env"]).toBe(
    "test",
  );
  expect(
    (afterTag.tags as Record<string, string> | undefined)?.["project"],
  ).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ resourceArn: dsgArn, tagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: dsgArn }),
  );
  expect(
    (afterUntag.tags as Record<string, string> | undefined)?.["env"],
  ).toBeUndefined();
  expect(
    (afterUntag.tags as Record<string, string> | undefined)?.["project"],
  ).toBe("bunsai");
});
