import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddAttachmentsToSetCommand,
  AddCommunicationToCaseCommand,
  CreateCaseCommand,
  DescribeAttachmentCommand,
  DescribeCasesCommand,
  DescribeCommunicationsCommand,
  DescribeCreateCaseOptionsCommand,
  DescribeServicesCommand,
  DescribeSeverityLevelsCommand,
  DescribeSupportedLanguagesCommand,
  DescribeTrustedAdvisorCheckRefreshStatusesCommand,
  DescribeTrustedAdvisorCheckResultCommand,
  DescribeTrustedAdvisorCheckSummariesCommand,
  DescribeTrustedAdvisorChecksCommand,
  RefreshTrustedAdvisorCheckCommand,
  ResolveCaseCommand,
  SupportClient,
} from "@aws-sdk/client-support";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const support = (): SupportClient =>
  new SupportClient({ endpoint, region, credentials, requestHandler });

test("Support case roundtrip with attachments and communications", async () => {
  const client = support();

  const setResp = await client.send(
    new AddAttachmentsToSetCommand({
      attachments: [
        { fileName: "log.txt", data: new TextEncoder().encode("hello world") },
      ],
    }),
  );
  expect(setResp.attachmentSetId).toBeDefined();
  expect(setResp.expiryTime).toBeDefined();
  const setId = setResp.attachmentSetId as string;

  const created = await client.send(
    new CreateCaseCommand({
      subject: "bunsai e2e",
      communicationBody: "initial body",
      serviceCode: "general-info",
      severityCode: "low",
      categoryCode: "other",
      language: "en",
      issueType: "technical",
      attachmentSetId: setId,
    }),
  );
  expect(created.caseId).toBeDefined();
  const caseId = created.caseId as string;

  const set2Resp = await client.send(
    new AddAttachmentsToSetCommand({
      attachments: [
        { fileName: "extra.txt", data: new TextEncoder().encode("extra") },
      ],
    }),
  );
  const set2Id = set2Resp.attachmentSetId as string;

  const addComm = await client.send(
    new AddCommunicationToCaseCommand({
      caseId,
      communicationBody: "follow up",
      attachmentSetId: set2Id,
    }),
  );
  expect(addComm.result).toBe(true);

  const described = await client.send(
    new DescribeCasesCommand({ caseIdList: [caseId] }),
  );
  expect(described.cases?.length).toBe(1);
  expect(described.cases?.[0]?.caseId).toBe(caseId);
  expect(described.cases?.[0]?.status).toBe("opened");

  const comms = await client.send(
    new DescribeCommunicationsCommand({ caseId }),
  );
  expect(comms.communications?.length).toBe(2);
  const attachmentId =
    comms.communications?.[0]?.attachmentSet?.[0]?.attachmentId;
  expect(typeof attachmentId).toBe("string");

  const attachment = await client.send(
    new DescribeAttachmentCommand({ attachmentId: attachmentId as string }),
  );
  expect(attachment.attachment?.fileName).toBe("log.txt");

  const resolved = await client.send(new ResolveCaseCommand({ caseId }));
  expect(resolved.finalCaseStatus).toBe("resolved");

  const afterResolve = await client.send(
    new DescribeCasesCommand({ caseIdList: [caseId] }),
  );
  expect(afterResolve.cases?.length ?? 0).toBe(0);

  const includeResolved = await client.send(
    new DescribeCasesCommand({
      caseIdList: [caseId],
      includeResolvedCases: true,
    }),
  );
  expect(includeResolved.cases?.[0]?.status).toBe("resolved");
});

test("Support metadata operations return canned shapes", async () => {
  const client = support();

  const services = await client.send(new DescribeServicesCommand({}));
  expect(services.services?.length).toBeGreaterThan(0);
  expect(services.services?.[0]?.code).toBeDefined();

  const severities = await client.send(new DescribeSeverityLevelsCommand({}));
  expect(severities.severityLevels?.length).toBeGreaterThan(0);

  const languages = await client.send(
    new DescribeSupportedLanguagesCommand({
      issueType: "technical",
      serviceCode: "general-info",
      categoryCode: "other",
    }),
  );
  expect(languages.supportedLanguages?.length).toBeGreaterThan(0);

  const createOpts = await client.send(
    new DescribeCreateCaseOptionsCommand({
      issueType: "technical",
      serviceCode: "general-info",
      language: "en",
      categoryCode: "other",
    }),
  );
  expect(createOpts.languageAvailability).toBe("available");
  expect(createOpts.communicationTypes?.length).toBeGreaterThan(0);
});

test("Support Trusted Advisor stub operations return valid shapes", async () => {
  const client = support();

  const checks = await client.send(
    new DescribeTrustedAdvisorChecksCommand({ language: "en" }),
  );
  expect(Array.isArray(checks.checks)).toBe(true);

  const refresh = await client.send(
    new RefreshTrustedAdvisorCheckCommand({ checkId: "abc" }),
  );
  expect(refresh.status?.checkId).toBe("abc");

  const statuses = await client.send(
    new DescribeTrustedAdvisorCheckRefreshStatusesCommand({
      checkIds: ["abc"],
    }),
  );
  expect(statuses.statuses?.length).toBe(1);

  const summaries = await client.send(
    new DescribeTrustedAdvisorCheckSummariesCommand({ checkIds: ["abc"] }),
  );
  expect(summaries.summaries?.length).toBe(1);

  const result = await client.send(
    new DescribeTrustedAdvisorCheckResultCommand({ checkId: "abc" }),
  );
  expect(result.result?.checkId).toBe("abc");
});
