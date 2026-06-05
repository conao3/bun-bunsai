import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ArchiveFindingsCommand,
  CreateDetectorCommand,
  CreateFilterCommand,
  CreateIPSetCommand,
  CreateMalwareProtectionPlanCommand,
  CreateMembersCommand,
  CreatePublishingDestinationCommand,
  CreateSampleFindingsCommand,
  CreateThreatIntelSetCommand,
  DeleteDetectorCommand,
  DeleteFilterCommand,
  DeleteIPSetCommand,
  DeleteMalwareProtectionPlanCommand,
  DeleteMembersCommand,
  DeletePublishingDestinationCommand,
  DeleteThreatIntelSetCommand,
  DescribePublishingDestinationCommand,
  GetDetectorCommand,
  GetFilterCommand,
  GetFindingsCommand,
  GetIPSetCommand,
  GetMalwareProtectionPlanCommand,
  GetThreatIntelSetCommand,
  GuardDutyClient,
  ListDetectorsCommand,
  ListFiltersCommand,
  ListFindingsCommand,
  ListIPSetsCommand,
  ListMalwareProtectionPlansCommand,
  ListMembersCommand,
  ListPublishingDestinationsCommand,
  ListTagsForResourceCommand,
  ListThreatIntelSetsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDetectorCommand,
  UpdateFilterCommand,
  UpdateIPSetCommand,
  UpdateThreatIntelSetCommand,
} from "@aws-sdk/client-guardduty";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const guardduty = () =>
  new GuardDutyClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("GuardDuty detector lifecycle", async () => {
  const client = guardduty();

  const created = await client.send(
    new CreateDetectorCommand({
      Enable: true,
      FindingPublishingFrequency: "ONE_HOUR",
    }),
  );
  expect(created.DetectorId).toBeDefined();
  const detectorId = created.DetectorId as string;

  const got = await client.send(
    new GetDetectorCommand({ DetectorId: detectorId }),
  );
  expect(got.Status).toBe("ENABLED");
  expect(got.FindingPublishingFrequency).toBe("ONE_HOUR");
  expect(got.ServiceRole).toBeDefined();

  const listed = await client.send(new ListDetectorsCommand({}));
  expect(listed.DetectorIds).toContain(detectorId);

  await client.send(
    new UpdateDetectorCommand({
      DetectorId: detectorId,
      Enable: false,
      FindingPublishingFrequency: "SIX_HOURS",
    }),
  );

  const updated = await client.send(
    new GetDetectorCommand({ DetectorId: detectorId }),
  );
  expect(updated.Status).toBe("DISABLED");
  expect(updated.FindingPublishingFrequency).toBe("SIX_HOURS");

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));

  const afterDelete = await client.send(new ListDetectorsCommand({}));
  expect(afterDelete.DetectorIds ?? []).not.toContain(detectorId);
});

test("GuardDuty filter lifecycle", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;

  const { Name } = await client.send(
    new CreateFilterCommand({
      DetectorId: detectorId,
      Name: "test-filter",
      Action: "NOOP",
      FindingCriteria: { Criterion: {} },
      Rank: 1,
    }),
  );
  expect(Name).toBe("test-filter");

  const got = await client.send(
    new GetFilterCommand({ DetectorId: detectorId, FilterName: "test-filter" }),
  );
  expect(got.Name).toBe("test-filter");
  expect(got.Action).toBe("NOOP");

  const listed = await client.send(
    new ListFiltersCommand({ DetectorId: detectorId }),
  );
  expect(listed.FilterNames).toContain("test-filter");

  await client.send(
    new UpdateFilterCommand({
      DetectorId: detectorId,
      FilterName: "test-filter",
      Action: "ARCHIVE",
    }),
  );

  const afterUpdate = await client.send(
    new GetFilterCommand({ DetectorId: detectorId, FilterName: "test-filter" }),
  );
  expect(afterUpdate.Action).toBe("ARCHIVE");

  await client.send(
    new DeleteFilterCommand({
      DetectorId: detectorId,
      FilterName: "test-filter",
    }),
  );

  const afterDelete = await client.send(
    new ListFiltersCommand({ DetectorId: detectorId }),
  );
  expect(afterDelete.FilterNames ?? []).not.toContain("test-filter");

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});

test("GuardDuty IP set lifecycle", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;

  const { IpSetId } = await client.send(
    new CreateIPSetCommand({
      DetectorId: detectorId,
      Name: "test-ipset",
      Format: "TXT",
      Location: "https://s3.amazonaws.com/mybucket/myobject",
      Activate: true,
    }),
  );
  expect(IpSetId).toBeDefined();
  const ipSetId = IpSetId as string;

  const got = await client.send(
    new GetIPSetCommand({ DetectorId: detectorId, IpSetId: ipSetId }),
  );
  expect(got.Name).toBe("test-ipset");
  expect(got.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListIPSetsCommand({ DetectorId: detectorId }),
  );
  expect(listed.IpSetIds).toContain(ipSetId);

  await client.send(
    new UpdateIPSetCommand({
      DetectorId: detectorId,
      IpSetId: ipSetId,
      Activate: false,
    }),
  );

  const afterUpdate = await client.send(
    new GetIPSetCommand({ DetectorId: detectorId, IpSetId: ipSetId }),
  );
  expect(afterUpdate.Status).toBe("INACTIVE");

  await client.send(
    new DeleteIPSetCommand({ DetectorId: detectorId, IpSetId: ipSetId }),
  );

  const afterDelete = await client.send(
    new ListIPSetsCommand({ DetectorId: detectorId }),
  );
  expect(afterDelete.IpSetIds ?? []).not.toContain(ipSetId);

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});

test("GuardDuty threat intel set lifecycle", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;

  const { ThreatIntelSetId } = await client.send(
    new CreateThreatIntelSetCommand({
      DetectorId: detectorId,
      Name: "test-tis",
      Format: "TXT",
      Location: "https://s3.amazonaws.com/mybucket/myobject",
      Activate: true,
    }),
  );
  expect(ThreatIntelSetId).toBeDefined();
  const tisId = ThreatIntelSetId as string;

  const got = await client.send(
    new GetThreatIntelSetCommand({
      DetectorId: detectorId,
      ThreatIntelSetId: tisId,
    }),
  );
  expect(got.Name).toBe("test-tis");
  expect(got.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListThreatIntelSetsCommand({ DetectorId: detectorId }),
  );
  expect(listed.ThreatIntelSetIds).toContain(tisId);

  await client.send(
    new UpdateThreatIntelSetCommand({
      DetectorId: detectorId,
      ThreatIntelSetId: tisId,
      Activate: false,
    }),
  );

  const afterUpdate = await client.send(
    new GetThreatIntelSetCommand({
      DetectorId: detectorId,
      ThreatIntelSetId: tisId,
    }),
  );
  expect(afterUpdate.Status).toBe("INACTIVE");

  await client.send(
    new DeleteThreatIntelSetCommand({
      DetectorId: detectorId,
      ThreatIntelSetId: tisId,
    }),
  );

  const afterDelete = await client.send(
    new ListThreatIntelSetsCommand({ DetectorId: detectorId }),
  );
  expect(afterDelete.ThreatIntelSetIds ?? []).not.toContain(tisId);

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});

test("GuardDuty members create/list/delete", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;

  await client.send(
    new CreateMembersCommand({
      DetectorId: detectorId,
      AccountDetails: [
        { AccountId: "111122223333", Email: "member@example.com" },
      ],
    }),
  );

  const listed = await client.send(
    new ListMembersCommand({ DetectorId: detectorId }),
  );
  const memberIds = (listed.Members ?? []).map((m) => m.AccountId);
  expect(memberIds).toContain("111122223333");

  await client.send(
    new DeleteMembersCommand({
      DetectorId: detectorId,
      AccountIds: ["111122223333"],
    }),
  );

  const afterDelete = await client.send(
    new ListMembersCommand({ DetectorId: detectorId }),
  );
  const afterIds = (afterDelete.Members ?? []).map((m) => m.AccountId);
  expect(afterIds).not.toContain("111122223333");

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});

test("GuardDuty publishing destination lifecycle", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;

  const { DestinationId } = await client.send(
    new CreatePublishingDestinationCommand({
      DetectorId: detectorId,
      DestinationType: "S3",
      DestinationProperties: {
        DestinationArn: "arn:aws:s3:::mybucket",
        KmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/mykey",
      },
    }),
  );
  expect(DestinationId).toBeDefined();
  const destId = DestinationId as string;

  const described = await client.send(
    new DescribePublishingDestinationCommand({
      DetectorId: detectorId,
      DestinationId: destId,
    }),
  );
  expect(described.DestinationType).toBe("S3");
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListPublishingDestinationsCommand({ DetectorId: detectorId }),
  );
  const destIds = (listed.Destinations ?? []).map((d) => d.DestinationId);
  expect(destIds).toContain(destId);

  await client.send(
    new DeletePublishingDestinationCommand({
      DetectorId: detectorId,
      DestinationId: destId,
    }),
  );

  const afterDelete = await client.send(
    new ListPublishingDestinationsCommand({ DetectorId: detectorId }),
  );
  const afterIds = (afterDelete.Destinations ?? []).map((d) => d.DestinationId);
  expect(afterIds).not.toContain(destId);

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});

test("GuardDuty malware protection plan lifecycle", async () => {
  const client = guardduty();

  const { MalwareProtectionPlanId } = await client.send(
    new CreateMalwareProtectionPlanCommand({
      Role: "arn:aws:iam::123456789012:role/GuardDutyMalwareProtectionRole",
      ProtectedResource: {
        S3Bucket: { BucketName: "mybucket" },
      },
    }),
  );
  expect(MalwareProtectionPlanId).toBeDefined();
  const planId = MalwareProtectionPlanId as string;

  const got = await client.send(
    new GetMalwareProtectionPlanCommand({
      MalwareProtectionPlanId: planId,
    }),
  );
  expect(got.Role).toContain("GuardDutyMalwareProtectionRole");
  expect(got.Status).toBe("ACTIVE");

  const listed = await client.send(new ListMalwareProtectionPlansCommand({}));
  const planIds = (listed.MalwareProtectionPlans ?? []).map(
    (p) => p.MalwareProtectionPlanId,
  );
  expect(planIds).toContain(planId);

  await client.send(
    new DeleteMalwareProtectionPlanCommand({
      MalwareProtectionPlanId: planId,
    }),
  );

  const afterDelete = await client.send(
    new ListMalwareProtectionPlansCommand({}),
  );
  const afterIds = (afterDelete.MalwareProtectionPlans ?? []).map(
    (p) => p.MalwareProtectionPlanId,
  );
  expect(afterIds).not.toContain(planId);
});

test("GuardDuty findings get and archive", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;

  await client.send(
    new CreateSampleFindingsCommand({
      DetectorId: detectorId,
      FindingTypes: ["Recon:EC2/PortProbeUnprotectedPort"],
    }),
  );

  const listed = await client.send(
    new ListFindingsCommand({ DetectorId: detectorId }),
  );
  expect(listed.FindingIds).toBeDefined();
  expect((listed.FindingIds ?? []).length).toBeGreaterThan(0);

  const findingIds = listed.FindingIds as string[];
  const got = await client.send(
    new GetFindingsCommand({ DetectorId: detectorId, FindingIds: findingIds }),
  );
  expect(got.Findings).toBeDefined();
  expect((got.Findings ?? []).length).toBeGreaterThan(0);

  await client.send(
    new ArchiveFindingsCommand({
      DetectorId: detectorId,
      FindingIds: findingIds,
    }),
  );

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});

test("GuardDuty tags lifecycle", async () => {
  const client = guardduty();
  const { DetectorId } = await client.send(
    new CreateDetectorCommand({ Enable: true }),
  );
  const detectorId = DetectorId as string;
  const resourceArn = `arn:aws:guardduty:us-east-1:123456789012:detector/${detectorId}`;

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: { env: "test", team: "security" },
    }),
  );

  const got = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(got.Tags?.["env"]).toBe("test");
  expect(got.Tags?.["team"]).toBe("security");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: ["team"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(afterUntag.Tags?.["env"]).toBe("test");
  expect(afterUntag.Tags?.["team"]).toBeUndefined();

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));
});
