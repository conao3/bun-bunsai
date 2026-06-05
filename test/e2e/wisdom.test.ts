import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAssistantAssociationCommand,
  CreateAssistantCommand,
  CreateContentCommand,
  CreateKnowledgeBaseCommand,
  CreateQuickResponseCommand,
  CreateSessionCommand,
  DeleteAssistantCommand,
  DeleteKnowledgeBaseCommand,
  GetAssistantCommand,
  GetContentCommand,
  GetKnowledgeBaseCommand,
  GetQuickResponseCommand,
  GetRecommendationsCommand,
  GetSessionCommand,
  ListAssistantAssociationsCommand,
  ListAssistantsCommand,
  ListContentsCommand,
  ListImportJobsCommand,
  ListKnowledgeBasesCommand,
  ListQuickResponsesCommand,
  ListTagsForResourceCommand,
  NotifyRecommendationsReceivedCommand,
  QueryAssistantCommand,
  RemoveKnowledgeBaseTemplateUriCommand,
  SearchContentCommand,
  SearchQuickResponsesCommand,
  SearchSessionsCommand,
  StartContentUploadCommand,
  StartImportJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateKnowledgeBaseTemplateUriCommand,
  UpdateQuickResponseCommand,
  WisdomClient,
} from "@aws-sdk/client-wisdom";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const wisdom = () =>
  new WisdomClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Wisdom knowledge base create, get, list and delete lifecycle", async () => {
  const client = wisdom();
  const name = "bunsai-e2e-knowledge-base";

  const created = await client.send(
    new CreateKnowledgeBaseCommand({
      name,
      knowledgeBaseType: "CUSTOM",
    }),
  );
  const knowledgeBaseId = created.knowledgeBase?.knowledgeBaseId;
  expect(knowledgeBaseId).toBeDefined();
  expect(created.knowledgeBase?.name).toBe(name);
  expect(created.knowledgeBase?.knowledgeBaseType).toBe("CUSTOM");
  expect(created.knowledgeBase?.knowledgeBaseArn).toContain("knowledge-base/");
  expect(created.knowledgeBase?.status).toBe("ACTIVE");

  const fetched = await client.send(
    new GetKnowledgeBaseCommand({ knowledgeBaseId }),
  );
  expect(fetched.knowledgeBase?.knowledgeBaseId).toBe(knowledgeBaseId);
  expect(fetched.knowledgeBase?.name).toBe(name);

  const listed = await client.send(new ListKnowledgeBasesCommand({}));
  const ids = (listed.knowledgeBaseSummaries ?? []).map(
    (summary) => summary.knowledgeBaseId,
  );
  expect(ids).toContain(knowledgeBaseId);

  await client.send(new DeleteKnowledgeBaseCommand({ knowledgeBaseId }));
  const afterDelete = await client.send(new ListKnowledgeBasesCommand({}));
  const afterIds = (afterDelete.knowledgeBaseSummaries ?? []).map(
    (summary) => summary.knowledgeBaseId,
  );
  expect(afterIds).not.toContain(knowledgeBaseId);
});

test("Wisdom assistant lifecycle", async () => {
  const client = wisdom();

  const created = await client.send(
    new CreateAssistantCommand({ name: "bunsai-e2e-assistant", type: "AGENT" }),
  );
  const assistantId = created.assistant?.assistantId;
  expect(assistantId).toBeDefined();
  expect(created.assistant?.name).toBe("bunsai-e2e-assistant");
  expect(created.assistant?.type).toBe("AGENT");
  expect(created.assistant?.status).toBe("ACTIVE");
  expect(created.assistant?.assistantArn).toContain("assistant/");

  const fetched = await client.send(new GetAssistantCommand({ assistantId }));
  expect(fetched.assistant?.assistantId).toBe(assistantId);

  const listed = await client.send(new ListAssistantsCommand({}));
  expect((listed.assistantSummaries ?? []).map((s) => s.assistantId)).toContain(
    assistantId,
  );

  await client.send(new DeleteAssistantCommand({ assistantId }));
  const afterDelete = await client.send(new ListAssistantsCommand({}));
  expect(
    (afterDelete.assistantSummaries ?? []).map((s) => s.assistantId),
  ).not.toContain(assistantId);
});

test("Wisdom assistant association lifecycle", async () => {
  const client = wisdom();

  const kb = await client.send(
    new CreateKnowledgeBaseCommand({
      name: "bunsai-e2e-kb-for-assoc",
      knowledgeBaseType: "CUSTOM",
    }),
  );
  const knowledgeBaseId = kb.knowledgeBase?.knowledgeBaseId!;

  const asst = await client.send(
    new CreateAssistantCommand({
      name: "bunsai-e2e-asst-for-assoc",
      type: "AGENT",
    }),
  );
  const assistantId = asst.assistant?.assistantId!;

  const assoc = await client.send(
    new CreateAssistantAssociationCommand({
      assistantId,
      associationType: "KNOWLEDGE_BASE",
      association: { knowledgeBaseId },
    }),
  );
  const assistantAssociationId =
    assoc.assistantAssociation?.assistantAssociationId;
  expect(assistantAssociationId).toBeDefined();
  expect(assoc.assistantAssociation?.associationType).toBe("KNOWLEDGE_BASE");
  expect(
    assoc.assistantAssociation?.associationData?.knowledgeBaseAssociation
      ?.knowledgeBaseId,
  ).toBe(knowledgeBaseId);

  const listed = await client.send(
    new ListAssistantAssociationsCommand({ assistantId }),
  );
  expect(
    (listed.assistantAssociationSummaries ?? []).map(
      (s) => s.assistantAssociationId,
    ),
  ).toContain(assistantAssociationId);
});

test("Wisdom content lifecycle", async () => {
  const client = wisdom();

  const kb = await client.send(
    new CreateKnowledgeBaseCommand({
      name: "bunsai-e2e-kb-for-content",
      knowledgeBaseType: "CUSTOM",
    }),
  );
  const knowledgeBaseId = kb.knowledgeBase?.knowledgeBaseId!;

  const upload = await client.send(
    new StartContentUploadCommand({
      knowledgeBaseId,
      contentType: "text/plain",
    }),
  );
  expect(upload.uploadId).toBeDefined();
  expect(upload.url).toBeDefined();
  expect(upload.urlExpiry).toBeDefined();
  expect(upload.headersToInclude).toBeDefined();

  const content = await client.send(
    new CreateContentCommand({
      knowledgeBaseId,
      name: "bunsai-e2e-content",
      uploadId: upload.uploadId!,
    }),
  );
  const contentId = content.content?.contentId;
  expect(contentId).toBeDefined();
  expect(content.content?.name).toBe("bunsai-e2e-content");
  expect(content.content?.contentArn).toContain("content/");
  expect(content.content?.url).toBeDefined();
  expect(content.content?.urlExpiry).toBeDefined();

  const fetched = await client.send(
    new GetContentCommand({ knowledgeBaseId, contentId }),
  );
  expect(fetched.content?.contentId).toBe(contentId);

  const listed = await client.send(
    new ListContentsCommand({ knowledgeBaseId }),
  );
  expect((listed.contentSummaries ?? []).map((s) => s.contentId)).toContain(
    contentId,
  );

  const searched = await client.send(
    new SearchContentCommand({
      knowledgeBaseId,
      searchExpression: {
        filters: [
          { field: "NAME", operator: "EQUALS", value: "bunsai-e2e-content" },
        ],
      },
    }),
  );
  expect(searched.contentSummaries).toBeDefined();
});

test("Wisdom quick response lifecycle", async () => {
  const client = wisdom();

  const kb = await client.send(
    new CreateKnowledgeBaseCommand({
      name: "bunsai-e2e-kb-for-qr",
      knowledgeBaseType: "QUICK_RESPONSES",
    }),
  );
  const knowledgeBaseId = kb.knowledgeBase?.knowledgeBaseId!;

  const created = await client.send(
    new CreateQuickResponseCommand({
      knowledgeBaseId,
      name: "bunsai-e2e-qr",
      content: { plainText: "Hello, how can I help?" },
    }),
  );
  const quickResponseId = created.quickResponse?.quickResponseId;
  expect(quickResponseId).toBeDefined();
  expect(created.quickResponse?.name).toBe("bunsai-e2e-qr");
  expect(created.quickResponse?.quickResponseArn).toContain("quick-response/");
  expect(created.quickResponse?.contentType).toBeDefined();
  expect(created.quickResponse?.status).toBeDefined();
  expect(created.quickResponse?.createdTime).toBeDefined();
  expect(created.quickResponse?.lastModifiedTime).toBeDefined();

  const fetched = await client.send(
    new GetQuickResponseCommand({ knowledgeBaseId, quickResponseId }),
  );
  expect(fetched.quickResponse?.quickResponseId).toBe(quickResponseId);

  const updated = await client.send(
    new UpdateQuickResponseCommand({
      knowledgeBaseId,
      quickResponseId,
      name: "bunsai-e2e-qr-updated",
    }),
  );
  expect(updated.quickResponse?.name).toBe("bunsai-e2e-qr-updated");

  const listed = await client.send(
    new ListQuickResponsesCommand({ knowledgeBaseId }),
  );
  expect(
    (listed.quickResponseSummaries ?? []).map((s) => s.quickResponseId),
  ).toContain(quickResponseId);

  const searched = await client.send(
    new SearchQuickResponsesCommand({
      knowledgeBaseId,
      searchExpression: {
        queries: [{ name: "name", values: ["bunsai"], operator: "CONTAINS" }],
      },
    }),
  );
  expect(searched.results).toBeDefined();
});

test("Wisdom session lifecycle", async () => {
  const client = wisdom();

  const asst = await client.send(
    new CreateAssistantCommand({
      name: "bunsai-e2e-asst-for-session",
      type: "AGENT",
    }),
  );
  const assistantId = asst.assistant?.assistantId!;

  const session = await client.send(
    new CreateSessionCommand({
      assistantId,
      name: "bunsai-e2e-session",
    }),
  );
  const sessionId = session.session?.sessionId;
  expect(sessionId).toBeDefined();
  expect(session.session?.name).toBe("bunsai-e2e-session");
  expect(session.session?.sessionArn).toContain("session/");

  const fetched = await client.send(
    new GetSessionCommand({ assistantId, sessionId }),
  );
  expect(fetched.session?.sessionId).toBe(sessionId);

  const searched = await client.send(
    new SearchSessionsCommand({
      assistantId,
      searchExpression: {
        filters: [
          { field: "NAME", operator: "EQUALS", value: "bunsai-e2e-session" },
        ],
      },
    }),
  );
  expect((searched.sessionSummaries ?? []).map((s) => s.sessionId)).toContain(
    sessionId,
  );

  const recs = await client.send(
    new GetRecommendationsCommand({ assistantId, sessionId }),
  );
  expect(recs.recommendations).toBeDefined();

  const notified = await client.send(
    new NotifyRecommendationsReceivedCommand({
      assistantId,
      sessionId,
      recommendationIds: ["rec-1"],
    }),
  );
  expect(notified.recommendationIds).toBeDefined();

  const queried = await client.send(
    new QueryAssistantCommand({ assistantId, queryText: "help" }),
  );
  expect(queried.results).toBeDefined();
});

test("Wisdom import job lifecycle", async () => {
  const client = wisdom();

  const kb = await client.send(
    new CreateKnowledgeBaseCommand({
      name: "bunsai-e2e-kb-for-import",
      knowledgeBaseType: "QUICK_RESPONSES",
    }),
  );
  const knowledgeBaseId = kb.knowledgeBase?.knowledgeBaseId!;

  const job = await client.send(
    new StartImportJobCommand({
      knowledgeBaseId,
      importJobType: "QUICK_RESPONSES",
      uploadId: "test-upload-id",
    }),
  );
  const importJobId = job.importJob?.importJobId;
  expect(importJobId).toBeDefined();
  expect(job.importJob?.importJobType).toBe("QUICK_RESPONSES");
  expect(job.importJob?.status).toBeDefined();
  expect(job.importJob?.createdTime).toBeDefined();
  expect(job.importJob?.lastModifiedTime).toBeDefined();
  expect(job.importJob?.url).toBeDefined();
  expect(job.importJob?.urlExpiry).toBeDefined();

  const listed = await client.send(
    new ListImportJobsCommand({ knowledgeBaseId }),
  );
  expect((listed.importJobSummaries ?? []).map((s) => s.importJobId)).toContain(
    importJobId,
  );
});

test("Wisdom tag operations", async () => {
  const client = wisdom();

  const kb = await client.send(
    new CreateKnowledgeBaseCommand({
      name: "bunsai-e2e-kb-for-tags",
      knowledgeBaseType: "CUSTOM",
    }),
  );
  const resourceArn = kb.knowledgeBase?.knowledgeBaseArn!;

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.["env"]).toBe("test");
  expect(listed.tags?.["team"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["team"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(afterUntag.tags?.["env"]).toBe("test");
  expect(afterUntag.tags?.["team"]).toBeUndefined();

  await client.send(
    new UpdateKnowledgeBaseTemplateUriCommand({
      knowledgeBaseId: kb.knowledgeBase?.knowledgeBaseId!,
      templateUri: "https://example.com/template",
    }),
  );

  await client.send(
    new RemoveKnowledgeBaseTemplateUriCommand({
      knowledgeBaseId: kb.knowledgeBase?.knowledgeBaseId!,
    }),
  );
});
