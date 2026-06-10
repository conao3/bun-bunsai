import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchCreateCustomVocabularyItemCommand,
  BatchDeleteCustomVocabularyItemCommand,
  BuildBotLocaleCommand,
  CreateBotAliasCommand,
  CreateBotCommand,
  CreateBotLocaleCommand,
  CreateBotVersionCommand,
  CreateExportCommand,
  CreateIntentCommand,
  CreateResourcePolicyCommand,
  CreateSlotCommand,
  CreateSlotTypeCommand,
  DeleteBotAliasCommand,
  DeleteBotCommand,
  DescribeBotAliasCommand,
  DescribeBotCommand,
  DescribeBotLocaleCommand,
  DescribeIntentCommand,
  DescribeSlotCommand,
  DescribeSlotTypeCommand,
  LexModelsV2Client,
  ListBotsCommand,
  ListBotAliasesCommand,
  ListBotLocalesCommand,
  ListBuiltInIntentsCommand,
  ListBuiltInSlotTypesCommand,
  ListCustomVocabularyItemsCommand,
  ListExportsCommand,
  ListIntentsCommand,
  ListSlotTypesCommand,
  ListSlotsCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateBotAliasCommand,
  UpdateBotLocaleCommand,
  UpdateIntentCommand,
  UpdateSlotCommand,
  UpdateSlotTypeCommand,
} from "@aws-sdk/client-lex-models-v2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lex = () =>
  new LexModelsV2Client({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Lex v2 bot lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );
  const botId = created.botId;
  expect(botId).toBeDefined();
  expect(created.botName).toBe(botName);
  expect(created.roleArn).toBe("arn:aws:iam::000000000000:role/bunsai-lex");
  expect(created.idleSessionTTLInSeconds).toBe(300);
  expect(created.botStatus).toBe("Creating");

  const described = await client.send(new DescribeBotCommand({ botId }));
  expect(described.botId).toBe(botId);
  expect(described.botName).toBe(botName);
  expect(described.botStatus).toBe("Available");
  expect(described.dataPrivacy?.childDirected).toBe(false);

  const listed = await client.send(new ListBotsCommand({}));
  expect((listed.botSummaries ?? []).map((b) => b.botId)).toContain(botId);

  const deleted = await client.send(new DeleteBotCommand({ botId }));
  expect(deleted.botId).toBe(botId);
  expect(deleted.botStatus).toBe("Deleting");

  const afterDelete = await client.send(new DescribeBotCommand({ botId }));
  expect(afterDelete.botStatus).toBe("Deleting");
});

test("Lex v2 bot alias lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-alias-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  const aliasCreated = await client.send(
    new CreateBotAliasCommand({
      botId,
      botAliasName: "test-alias",
      description: "e2e alias",
    }),
  );
  const botAliasId = aliasCreated.botAliasId;
  expect(botAliasId).toBeDefined();
  expect(aliasCreated.botAliasName).toBe("test-alias");
  expect(aliasCreated.botAliasStatus).toBe("Creating");

  const aliasDescribed = await client.send(
    new DescribeBotAliasCommand({ botId, botAliasId }),
  );
  expect(aliasDescribed.botAliasId).toBe(botAliasId);
  expect(aliasDescribed.description).toBe("e2e alias");

  const updatedAlias = await client.send(
    new UpdateBotAliasCommand({
      botId,
      botAliasId,
      botAliasName: "test-alias-updated",
    }),
  );
  expect(updatedAlias.botAliasName).toBe("test-alias-updated");

  const aliasList = await client.send(new ListBotAliasesCommand({ botId }));
  expect(
    (aliasList.botAliasSummaries ?? []).map((a) => a.botAliasId),
  ).toContain(botAliasId);

  await client.send(new DeleteBotAliasCommand({ botId, botAliasId }));
  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 bot locale + build lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-locale-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  const localeCreated = await client.send(
    new CreateBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      nluIntentConfidenceThreshold: 0.4,
    }),
  );
  expect(localeCreated.localeId).toBe("en_US");
  expect(localeCreated.botLocaleStatus).toBe("Creating");

  const localeDescribed = await client.send(
    new DescribeBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
    }),
  );
  expect(localeDescribed.nluIntentConfidenceThreshold).toBe(0.4);

  const updated = await client.send(
    new UpdateBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      nluIntentConfidenceThreshold: 0.7,
    }),
  );
  expect(updated.nluIntentConfidenceThreshold).toBe(0.7);

  const built = await client.send(
    new BuildBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
    }),
  );
  expect(built.botLocaleStatus).toBe("Building");

  const builtDescribed = await client.send(
    new DescribeBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
    }),
  );
  expect(builtDescribed.botLocaleStatus).toBe("Built");

  const locales = await client.send(
    new ListBotLocalesCommand({ botId, botVersion: "DRAFT" }),
  );
  expect((locales.botLocaleSummaries ?? []).map((l) => l.localeId)).toContain(
    "en_US",
  );

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 bot version lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-ver-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  const versionCreated = await client.send(
    new CreateBotVersionCommand({
      botId,
      description: "v1",
      botVersionLocaleSpecification: { en_US: { sourceBotVersion: "DRAFT" } },
    }),
  );
  const botVersion = versionCreated.botVersion;
  expect(botVersion).toBeDefined();
  expect(versionCreated.botStatus).toBe("Available");

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 intent lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-intent-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  await client.send(
    new CreateBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      nluIntentConfidenceThreshold: 0.4,
    }),
  );

  const intentCreated = await client.send(
    new CreateIntentCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentName: "OrderIntent",
      description: "Place an order",
    }),
  );
  const intentId = intentCreated.intentId;
  expect(intentId).toBeDefined();
  expect(intentCreated.intentName).toBe("OrderIntent");

  const intentDescribed = await client.send(
    new DescribeIntentCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentId,
    }),
  );
  expect(intentDescribed.description).toBe("Place an order");

  const intentUpdated = await client.send(
    new UpdateIntentCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentId,
      intentName: "OrderIntent",
      description: "Updated",
    }),
  );
  expect(intentUpdated.description).toBe("Updated");

  const intentList = await client.send(
    new ListIntentsCommand({ botId, botVersion: "DRAFT", localeId: "en_US" }),
  );
  expect((intentList.intentSummaries ?? []).map((i) => i.intentId)).toContain(
    intentId,
  );

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 slot and slot type lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-slot-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  await client.send(
    new CreateBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      nluIntentConfidenceThreshold: 0.4,
    }),
  );

  const stCreated = await client.send(
    new CreateSlotTypeCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      slotTypeName: "ProductType",
    }),
  );
  const slotTypeId = stCreated.slotTypeId;
  expect(slotTypeId).toBeDefined();

  const stDescribed = await client.send(
    new DescribeSlotTypeCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      slotTypeId,
    }),
  );
  expect(stDescribed.slotTypeName).toBe("ProductType");

  await client.send(
    new UpdateSlotTypeCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      slotTypeId,
      slotTypeName: "ProductTypeV2",
    }),
  );

  const stList = await client.send(
    new ListSlotTypesCommand({ botId, botVersion: "DRAFT", localeId: "en_US" }),
  );
  expect((stList.slotTypeSummaries ?? []).map((s) => s.slotTypeId)).toContain(
    slotTypeId,
  );

  const { intentId } = await client.send(
    new CreateIntentCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentName: "SlotTestIntent",
    }),
  );

  const slotCreated = await client.send(
    new CreateSlotCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentId,
      slotName: "ProductSlot",
      slotTypeId,
      valueElicitationSetting: { slotConstraint: "Required" },
    }),
  );
  const slotId = slotCreated.slotId;
  expect(slotId).toBeDefined();

  const slotDescribed = await client.send(
    new DescribeSlotCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentId,
      slotId,
    }),
  );
  expect(slotDescribed.slotName).toBe("ProductSlot");

  await client.send(
    new UpdateSlotCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentId,
      slotId,
      slotName: "ProductSlotV2",
      valueElicitationSetting: { slotConstraint: "Required" },
    }),
  );

  const slotList = await client.send(
    new ListSlotsCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      intentId,
    }),
  );
  expect((slotList.slotSummaries ?? []).map((s) => s.slotId)).toContain(slotId);

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 custom vocabulary batch lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-vocab-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  await client.send(
    new CreateBotLocaleCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      nluIntentConfidenceThreshold: 0.4,
    }),
  );

  const batchCreated = await client.send(
    new BatchCreateCustomVocabularyItemCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      customVocabularyItemList: [
        { phrase: "bunsai", weight: 1 },
        { phrase: "lexv2", weight: 2 },
      ],
    }),
  );
  expect(batchCreated.resources).toHaveLength(2);

  const listed = await client.send(
    new ListCustomVocabularyItemsCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
    }),
  );
  expect((listed.customVocabularyItems ?? []).map((i) => i.phrase)).toContain(
    "bunsai",
  );

  const itemId = batchCreated.resources![0].itemId!;
  await client.send(
    new BatchDeleteCustomVocabularyItemCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
      customVocabularyItemList: [{ itemId }],
    }),
  );

  const afterDelete = await client.send(
    new ListCustomVocabularyItemsCommand({
      botId,
      botVersion: "DRAFT",
      localeId: "en_US",
    }),
  );
  expect(
    (afterDelete.customVocabularyItems ?? []).map((i) => i.itemId),
  ).not.toContain(itemId);

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 export lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-export-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );

  const exported = await client.send(
    new CreateExportCommand({
      resourceSpecification: {
        botExportSpecification: { botId, botVersion: "DRAFT" },
      },
      fileFormat: "LexJson",
    }),
  );
  const exportId = exported.exportId;
  expect(exportId).toBeDefined();
  expect(exported.exportStatus).toBe("InProgress");

  const exportsList = await client.send(new ListExportsCommand({}));
  expect((exportsList.exportSummaries ?? []).map((e) => e.exportId)).toContain(
    exportId,
  );

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 resource policy lifecycle", async () => {
  const client = lex();
  const resourceArn = `arn:aws:lex:us-east-1:000000000000:bot:e2ebot`;

  const created = await client.send(
    new CreateResourcePolicyCommand({
      resourceArn,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "lex.amazonaws.com" },
            Action: "lex:RecognizeText",
            Resource: resourceArn,
          },
        ],
      }),
    }),
  );
  expect(created.resourceArn).toBe(resourceArn);
  expect(created.revisionId).toBeDefined();
});

test("Lex v2 tags lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-tags-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );
  const resourceARN = `arn:aws:lex:us-east-1:000000000000:bot/${botId}`;

  await client.send(
    new TagResourceCommand({
      resourceARN,
      tags: { env: "test", team: "platform" },
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ resourceARN }),
  );
  expect(tags.tags?.env).toBe("test");
  expect(tags.tags?.team).toBe("platform");

  await client.send(
    new UntagResourceCommand({ resourceARN, tagKeys: ["team"] }),
  );

  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ resourceARN }),
  );
  expect(tagsAfter.tags?.env).toBe("test");
  expect(tagsAfter.tags?.team).toBeUndefined();

  await client.send(new DeleteBotCommand({ botId }));
});

test("Lex v2 built-in intents and slot types", async () => {
  const client = lex();

  const intents = await client.send(
    new ListBuiltInIntentsCommand({ localeId: "en_US" }),
  );
  expect((intents.builtInIntentSummaries ?? []).length).toBeGreaterThan(0);

  const slotTypes = await client.send(
    new ListBuiltInSlotTypesCommand({ localeId: "en_US" }),
  );
  expect((slotTypes.builtInSlotTypeSummaries ?? []).length).toBeGreaterThan(0);
});

test("Lex v2 async status: CreateBot Creating→Available + DeleteBot Deleting", async () => {
  const client = lex();
  const botName = `bunsai-async-${Date.now()}`;

  const created = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );
  expect(created.botStatus).toBe("Creating");

  const described = await client.send(
    new DescribeBotCommand({ botId: created.botId }),
  );
  expect(described.botStatus).toBe("Available");

  const deleted = await client.send(
    new DeleteBotCommand({ botId: created.botId }),
  );
  expect(deleted.botStatus).toBe("Deleting");

  const afterDelete = await client.send(
    new DescribeBotCommand({ botId: created.botId }),
  );
  expect(afterDelete.botStatus).toBe("Deleting");
});

test("Lex v2 ListBots pagination", async () => {
  const client = lex();
  const prefix = `bunsai-page-${Date.now()}`;
  const createdIds: string[] = [];

  for (let i = 0; i < 3; i += 1) {
    const r = await client.send(
      new CreateBotCommand({
        botName: `${prefix}-${i}`,
        roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
        dataPrivacy: { childDirected: false },
        idleSessionTTLInSeconds: 300,
      }),
    );
    createdIds.push(r.botId!);
  }

  const page1 = await client.send(new ListBotsCommand({ maxResults: 2 }));
  expect((page1.botSummaries ?? []).length).toBeGreaterThanOrEqual(2);

  if (page1.nextToken !== undefined) {
    const page2 = await client.send(
      new ListBotsCommand({ nextToken: page1.nextToken }),
    );
    expect((page2.botSummaries ?? []).length).toBeGreaterThanOrEqual(1);
    const allIds = [
      ...(page1.botSummaries ?? []).map((b) => b.botId),
      ...(page2.botSummaries ?? []).map((b) => b.botId),
    ];
    for (const id of createdIds) {
      expect(allIds).toContain(id);
    }
  }
});

test("Lex v2 CreateBot botTags and testBotAliasTags", async () => {
  const client = lex();
  const botName = `bunsai-tags-create-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
      botTags: { env: "e2e", owner: "test" },
      testBotAliasTags: { stage: "test" },
    }),
  );
  const botArn = `arn:aws:lex:us-east-1:000000000000:bot/${botId}`;
  const botTagsResult = await client.send(
    new ListTagsForResourceCommand({ resourceARN: botArn }),
  );
  expect(botTagsResult.tags?.env).toBe("e2e");
  expect(botTagsResult.tags?.owner).toBe("test");

  const testAliasArn = `${botArn}/botaliases/TSTALIASID`;
  const testAliasTagsResult = await client.send(
    new ListTagsForResourceCommand({ resourceARN: testAliasArn }),
  );
  expect(testAliasTagsResult.tags?.stage).toBe("test");

  await client.send(
    new DeleteBotCommand({ botId, skipResourceInUseCheck: true }),
  );
});

test("Lex v2 DeleteBot skipResourceInUseCheck", async () => {
  const client = lex();
  const botName = `bunsai-inuse-${Date.now()}`;
  const { botId } = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );
  const { botAliasId } = await client.send(
    new CreateBotAliasCommand({ botId, botAliasName: "inuse-alias" }),
  );

  let threw = false;
  try {
    await client.send(new DeleteBotCommand({ botId }));
  } catch (err) {
    threw = true;
    expect((err as Error).name).toBe("ConflictException");
  }
  expect(threw).toBe(true);

  const deleted = await client.send(
    new DeleteBotCommand({ botId, skipResourceInUseCheck: true }),
  );
  expect(deleted.botId).toBe(botId);
  expect(deleted.botStatus).toBe("Deleting");

  await client.send(new DeleteBotAliasCommand({ botId, botAliasId }));
});

test("Lex v2 ListBots filters and sortBy", async () => {
  const client = lex();
  const prefix = `bunsai-filter-${Date.now()}`;
  const botAId = (
    await client.send(
      new CreateBotCommand({
        botName: `${prefix}-alpha`,
        roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
        dataPrivacy: { childDirected: false },
        idleSessionTTLInSeconds: 300,
      }),
    )
  ).botId!;
  const botBId = (
    await client.send(
      new CreateBotCommand({
        botName: `${prefix}-beta`,
        roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
        dataPrivacy: { childDirected: false },
        idleSessionTTLInSeconds: 300,
      }),
    )
  ).botId!;

  const filterEq = await client.send(
    new ListBotsCommand({
      filters: [
        { name: "BotName", values: [`${prefix}-alpha`], operator: "EQ" },
      ],
    }),
  );
  const eqIds = (filterEq.botSummaries ?? []).map((b) => b.botId);
  expect(eqIds).toContain(botAId);
  expect(eqIds).not.toContain(botBId);

  const filterCo = await client.send(
    new ListBotsCommand({
      filters: [{ name: "BotName", values: [prefix], operator: "CO" }],
    }),
  );
  const coIds = (filterCo.botSummaries ?? []).map((b) => b.botId);
  expect(coIds).toContain(botAId);
  expect(coIds).toContain(botBId);

  const sorted = await client.send(
    new ListBotsCommand({
      filters: [{ name: "BotName", values: [prefix], operator: "CO" }],
      sortBy: { attribute: "BotName", order: "Ascending" },
    }),
  );
  const names = (sorted.botSummaries ?? []).map((b) => b.botName ?? "");
  expect(names.indexOf(`${prefix}-alpha`)).toBeLessThan(
    names.indexOf(`${prefix}-beta`),
  );

  const sortedDesc = await client.send(
    new ListBotsCommand({
      filters: [{ name: "BotName", values: [prefix], operator: "CO" }],
      sortBy: { attribute: "BotName", order: "Descending" },
    }),
  );
  const namesDesc = (sortedDesc.botSummaries ?? []).map((b) => b.botName ?? "");
  expect(namesDesc.indexOf(`${prefix}-beta`)).toBeLessThan(
    namesDesc.indexOf(`${prefix}-alpha`),
  );

  await client.send(new DeleteBotCommand({ botId: botAId }));
  await client.send(new DeleteBotCommand({ botId: botBId }));
});
