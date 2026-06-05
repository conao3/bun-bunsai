import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetIncidentFindingsCommand,
  CreateReplicationSetCommand,
  CreateResponsePlanCommand,
  CreateTimelineEventCommand,
  DeleteIncidentRecordCommand,
  DeleteReplicationSetCommand,
  DeleteResourcePolicyCommand,
  DeleteResponsePlanCommand,
  DeleteTimelineEventCommand,
  GetIncidentRecordCommand,
  GetReplicationSetCommand,
  GetResourcePoliciesCommand,
  GetResponsePlanCommand,
  GetTimelineEventCommand,
  ListIncidentFindingsCommand,
  ListIncidentRecordsCommand,
  ListRelatedItemsCommand,
  ListReplicationSetsCommand,
  ListResponsePlansCommand,
  ListTagsForResourceCommand,
  ListTimelineEventsCommand,
  PutResourcePolicyCommand,
  SSMIncidentsClient,
  StartIncidentCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDeletionProtectionCommand,
  UpdateIncidentRecordCommand,
  UpdateRelatedItemsCommand,
  UpdateReplicationSetCommand,
  UpdateResponsePlanCommand,
  UpdateTimelineEventCommand,
} from "@aws-sdk/client-ssm-incidents";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const incidents = () =>
  new SSMIncidentsClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("SSMIncidents response plan roundtrip", async () => {
  const client = incidents();
  const planName = `bunsaie2e${Date.now()}`;

  const created = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      displayName: "bunsai e2e response plan",
      incidentTemplate: {
        title: "bunsai incident",
        impact: 3,
      },
    }),
  );
  expect(created.arn).toBeDefined();
  const arn = created.arn ?? "";

  const got = await client.send(new GetResponsePlanCommand({ arn }));
  expect(got.arn).toBe(arn);
  expect(got.name).toBe(planName);
  expect(got.displayName).toBe("bunsai e2e response plan");
  expect(got.incidentTemplate?.title).toBe("bunsai incident");
  expect(got.incidentTemplate?.impact).toBe(3);

  const listed = await client.send(new ListResponsePlansCommand({}));
  expect((listed.responsePlanSummaries ?? []).map((s) => s.arn)).toContain(arn);

  await client.send(new DeleteResponsePlanCommand({ arn }));

  await expect(
    client.send(new GetResponsePlanCommand({ arn })),
  ).rejects.toThrow();
});

test("SSMIncidents UpdateResponsePlan", async () => {
  const client = incidents();
  const planName = `bunsaie2e-urp-${Date.now()}`;

  const created = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "original", impact: 3 },
    }),
  );
  const arn = created.arn ?? "";

  await client.send(
    new UpdateResponsePlanCommand({ arn, displayName: "updated display" }),
  );

  const got = await client.send(new GetResponsePlanCommand({ arn }));
  expect(got.displayName).toBe("updated display");

  await client.send(new DeleteResponsePlanCommand({ arn }));
});

test("SSMIncidents incident record lifecycle", async () => {
  const client = incidents();
  const planName = `bunsaie2e-inc-${Date.now()}`;

  const plan = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "test incident", impact: 2 },
    }),
  );
  const planArn = plan.arn ?? "";

  const started = await client.send(
    new StartIncidentCommand({ responsePlanArn: planArn }),
  );
  expect(started.incidentRecordArn).toBeDefined();
  const incArn = started.incidentRecordArn ?? "";

  const got = await client.send(new GetIncidentRecordCommand({ arn: incArn }));
  expect(got.incidentRecord?.arn).toBe(incArn);
  expect(got.incidentRecord?.status).toBe("OPEN");
  expect(got.incidentRecord?.title).toBe("test incident");

  await client.send(
    new UpdateIncidentRecordCommand({
      arn: incArn,
      title: "updated title",
      summary: "test summary",
    }),
  );

  const updated = await client.send(
    new GetIncidentRecordCommand({ arn: incArn }),
  );
  expect(updated.incidentRecord?.title).toBe("updated title");
  expect(updated.incidentRecord?.summary).toBe("test summary");

  const listed = await client.send(new ListIncidentRecordsCommand({}));
  expect((listed.incidentRecordSummaries ?? []).map((s) => s.arn)).toContain(
    incArn,
  );

  await client.send(new DeleteIncidentRecordCommand({ arn: incArn }));

  await expect(
    client.send(new GetIncidentRecordCommand({ arn: incArn })),
  ).rejects.toThrow();

  await client.send(new DeleteResponsePlanCommand({ arn: planArn }));
});

test("SSMIncidents incident findings (stub)", async () => {
  const client = incidents();
  const planName = `bunsaie2e-findings-${Date.now()}`;

  const plan = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "findings test", impact: 3 },
    }),
  );
  const planArn = plan.arn ?? "";
  const started = await client.send(
    new StartIncidentCommand({ responsePlanArn: planArn }),
  );
  const incArn = started.incidentRecordArn ?? "";

  const listed = await client.send(
    new ListIncidentFindingsCommand({ incidentRecordArn: incArn }),
  );
  expect(listed.findings).toEqual([]);

  const batched = await client.send(
    new BatchGetIncidentFindingsCommand({
      incidentRecordArn: incArn,
      findingIds: [],
    }),
  );
  expect(batched.findings).toEqual([]);
  expect(batched.errors).toEqual([]);

  await client.send(new DeleteIncidentRecordCommand({ arn: incArn }));
  await client.send(new DeleteResponsePlanCommand({ arn: planArn }));
});

test("SSMIncidents timeline event lifecycle", async () => {
  const client = incidents();
  const planName = `bunsaie2e-tl-${Date.now()}`;

  const plan = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "timeline test", impact: 3 },
    }),
  );
  const planArn = plan.arn ?? "";
  const started = await client.send(
    new StartIncidentCommand({ responsePlanArn: planArn }),
  );
  const incArn = started.incidentRecordArn ?? "";

  const created = await client.send(
    new CreateTimelineEventCommand({
      incidentRecordArn: incArn,
      eventData: JSON.stringify({ message: "test event" }),
      eventTime: new Date(),
      eventType: "Custom Event",
    }),
  );
  expect(created.eventId).toBeDefined();
  expect(created.incidentRecordArn).toBe(incArn);
  const eventId = created.eventId ?? "";

  const got = await client.send(
    new GetTimelineEventCommand({ incidentRecordArn: incArn, eventId }),
  );
  expect(got.event?.eventId).toBe(eventId);
  expect(got.event?.incidentRecordArn).toBe(incArn);
  expect(got.event?.eventType).toBe("Custom Event");

  await client.send(
    new UpdateTimelineEventCommand({
      incidentRecordArn: incArn,
      eventId,
      eventType: "Updated Event",
    }),
  );

  const updated = await client.send(
    new GetTimelineEventCommand({ incidentRecordArn: incArn, eventId }),
  );
  expect(updated.event?.eventType).toBe("Updated Event");

  const listed = await client.send(
    new ListTimelineEventsCommand({ incidentRecordArn: incArn }),
  );
  expect((listed.eventSummaries ?? []).map((e) => e.eventId)).toContain(
    eventId,
  );

  await client.send(
    new DeleteTimelineEventCommand({ incidentRecordArn: incArn, eventId }),
  );

  await expect(
    client.send(
      new GetTimelineEventCommand({ incidentRecordArn: incArn, eventId }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteIncidentRecordCommand({ arn: incArn }));
  await client.send(new DeleteResponsePlanCommand({ arn: planArn }));
});

test("SSMIncidents related items", async () => {
  const client = incidents();
  const planName = `bunsaie2e-ri-${Date.now()}`;

  const plan = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "related items test", impact: 3 },
    }),
  );
  const planArn = plan.arn ?? "";
  const started = await client.send(
    new StartIncidentCommand({ responsePlanArn: planArn }),
  );
  const incArn = started.incidentRecordArn ?? "";

  const empty = await client.send(
    new ListRelatedItemsCommand({ incidentRecordArn: incArn }),
  );
  expect(empty.relatedItems).toEqual([]);

  await client.send(
    new UpdateRelatedItemsCommand({
      incidentRecordArn: incArn,
      relatedItemsUpdate: {
        itemToAdd: {
          identifier: {
            type: "OTHER",
            value: { url: "https://example.com" },
          },
          title: "related item",
        },
      },
    }),
  );

  const listed = await client.send(
    new ListRelatedItemsCommand({ incidentRecordArn: incArn }),
  );
  expect(listed.relatedItems?.length).toBeGreaterThan(0);

  await client.send(new DeleteIncidentRecordCommand({ arn: incArn }));
  await client.send(new DeleteResponsePlanCommand({ arn: planArn }));
});

test("SSMIncidents replication set lifecycle", async () => {
  const client = incidents();

  const created = await client.send(
    new CreateReplicationSetCommand({
      regions: { "us-east-1": {} },
    }),
  );
  expect(created.arn).toBeDefined();
  const arn = created.arn ?? "";

  const got = await client.send(new GetReplicationSetCommand({ arn }));
  expect(got.replicationSet?.arn).toBe(arn);
  expect(got.replicationSet?.status).toBe("ACTIVE");
  expect(got.replicationSet?.deletionProtected).toBe(false);

  const listed = await client.send(new ListReplicationSetsCommand({}));
  expect(listed.replicationSetArns).toContain(arn);

  await client.send(
    new UpdateDeletionProtectionCommand({ arn, deletionProtected: true }),
  );
  const protected_ = await client.send(new GetReplicationSetCommand({ arn }));
  expect(protected_.replicationSet?.deletionProtected).toBe(true);

  await client.send(
    new UpdateReplicationSetCommand({
      arn,
      actions: [{ addRegionAction: { regionName: "us-west-2" } }],
    }),
  );
  const withRegion = await client.send(new GetReplicationSetCommand({ arn }));
  expect(withRegion.replicationSet?.regionMap).toHaveProperty("us-west-2");

  await client.send(new DeleteReplicationSetCommand({ arn }));

  const listedAfter = await client.send(new ListReplicationSetsCommand({}));
  expect(listedAfter.replicationSetArns ?? []).not.toContain(arn);
});

test("SSMIncidents resource policy lifecycle", async () => {
  const client = incidents();
  const planName = `bunsaie2e-rp-${Date.now()}`;

  const plan = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "policy test", impact: 3 },
    }),
  );
  const resourceArn = plan.arn ?? "";

  const put = await client.send(
    new PutResourcePolicyCommand({
      resourceArn,
      policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  expect(put.policyId).toBeDefined();
  const policyId = put.policyId ?? "";

  const got = await client.send(
    new GetResourcePoliciesCommand({ resourceArn }),
  );
  expect(got.resourcePolicies?.map((p) => p.policyId)).toContain(policyId);

  await client.send(new DeleteResourcePolicyCommand({ resourceArn, policyId }));

  const after = await client.send(
    new GetResourcePoliciesCommand({ resourceArn }),
  );
  expect(after.resourcePolicies?.map((p) => p.policyId) ?? []).not.toContain(
    policyId,
  );

  await client.send(new DeleteResponsePlanCommand({ arn: resourceArn }));
});

test("SSMIncidents tags lifecycle", async () => {
  const client = incidents();
  const planName = `bunsaie2e-tags-${Date.now()}`;

  const plan = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      incidentTemplate: { title: "tags test", impact: 3 },
    }),
  );
  const resourceArn = plan.arn ?? "";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.team).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["team"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(after.tags?.env).toBe("test");
  expect(after.tags?.team).toBeUndefined();

  await client.send(new DeleteResponsePlanCommand({ arn: resourceArn }));
});
