import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachSecurityProfileCommand,
  CancelAuditMitigationActionsTaskCommand,
  CancelAuditTaskCommand,
  CancelDetectMitigationActionsTaskCommand,
  CreateAuditSuppressionCommand,
  CreateCustomMetricCommand,
  CreateDimensionCommand,
  CreateMitigationActionCommand,
  CreateScheduledAuditCommand,
  CreateSecurityProfileCommand,
  DeleteAccountAuditConfigurationCommand,
  DeleteAuditSuppressionCommand,
  DeleteCustomMetricCommand,
  DeleteDimensionCommand,
  DeleteMitigationActionCommand,
  DeleteScheduledAuditCommand,
  DeleteSecurityProfileCommand,
  DescribeAccountAuditConfigurationCommand,
  DescribeAuditSuppressionCommand,
  DescribeCustomMetricCommand,
  DescribeDimensionCommand,
  DescribeMitigationActionCommand,
  DescribeScheduledAuditCommand,
  DescribeSecurityProfileCommand,
  DetachSecurityProfileCommand,
  GetBehaviorModelTrainingSummariesCommand,
  IoTClient,
  ListActiveViolationsCommand,
  ListAuditMitigationActionsExecutionsCommand,
  ListAuditMitigationActionsTasksCommand,
  ListAuditSuppressions as _ListAuditSuppressions,
  ListAuditSuppressionsCommand,
  ListAuditTasksCommand,
  ListCustomMetricsCommand,
  ListDetectMitigationActionsExecutionsCommand,
  ListDetectMitigationActionsTasksCommand,
  ListDimensionsCommand,
  ListMitigationActionsCommand,
  ListScheduledAuditsCommand,
  ListSecurityProfilesCommand,
  ListSecurityProfilesForTargetCommand,
  ListTargetsForSecurityProfileCommand,
  ListViolationEventsCommand,
  StartAuditMitigationActionsTaskCommand,
  StartDetectMitigationActionsTaskCommand,
  StartOnDemandAuditTaskCommand,
  UpdateAccountAuditConfigurationCommand,
  UpdateAuditSuppressionCommand,
  UpdateCustomMetricCommand,
  UpdateDimensionCommand,
  UpdateMitigationActionCommand,
  UpdateScheduledAuditCommand,
  UpdateSecurityProfileCommand,
  ValidateSecurityProfileBehaviorsCommand,
} from "@aws-sdk/client-iot";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iot = () =>
  new IoTClient({ endpoint, region, credentials, requestHandler });

const suffix = () => Date.now().toString(36);

test("AccountAuditConfiguration lifecycle", async () => {
  const client = iot();

  await client.send(
    new UpdateAccountAuditConfigurationCommand({
      roleArn: `arn:aws:iam::${account}:role/AuditRole`,
      auditCheckConfigurations: {
        DEVICE_CERTIFICATE_EXPIRING_CHECK: { enabled: true },
      },
    }),
  );

  const described = await client.send(
    new DescribeAccountAuditConfigurationCommand({}),
  );
  expect(described.roleArn).toContain("AuditRole");

  await client.send(new DeleteAccountAuditConfigurationCommand({}));
  const afterDelete = await client.send(
    new DescribeAccountAuditConfigurationCommand({}),
  );
  expect(afterDelete.roleArn).toBeUndefined();
});

test("AuditTask lifecycle", async () => {
  const client = iot();

  const started = await client.send(
    new StartOnDemandAuditTaskCommand({
      targetCheckNames: ["DEVICE_CERTIFICATE_EXPIRING_CHECK"],
    }),
  );
  expect(started.taskId).toBeTruthy();
  const taskId = started.taskId!;

  const listed = await client.send(
    new ListAuditTasksCommand({ startTime: new Date(0), endTime: new Date() }),
  );
  expect(listed.tasks?.some((t) => t.taskId === taskId)).toBe(true);

  await client.send(new CancelAuditTaskCommand({ taskId }));
});

test("AuditSuppression lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const checkName = "DEVICE_CERTIFICATE_EXPIRING_CHECK";
  const resourceIdentifier = { deviceCertificateId: `cert-${sfx}` };

  await client.send(
    new CreateAuditSuppressionCommand({
      checkName,
      resourceIdentifier,
      suppressIndefinitely: true,
    }),
  );

  const described = await client.send(
    new DescribeAuditSuppressionCommand({ checkName, resourceIdentifier }),
  );
  expect(described.checkName).toBe(checkName);
  expect(described.suppressIndefinitely).toBe(true);

  await client.send(
    new UpdateAuditSuppressionCommand({
      checkName,
      resourceIdentifier,
      suppressIndefinitely: false,
    }),
  );
  const afterUpdate = await client.send(
    new DescribeAuditSuppressionCommand({ checkName, resourceIdentifier }),
  );
  expect(afterUpdate.suppressIndefinitely).toBe(false);

  const listed = await client.send(new ListAuditSuppressionsCommand({}));
  expect(listed.suppressions?.some((s) => s.checkName === checkName)).toBe(
    true,
  );

  await client.send(
    new DeleteAuditSuppressionCommand({ checkName, resourceIdentifier }),
  );
});

test("MitigationAction lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const actionName = `bunsai_e2e_action_${sfx}`;

  const created = await client.send(
    new CreateMitigationActionCommand({
      actionName,
      roleArn: `arn:aws:iam::${account}:role/MitigationRole`,
      actionParams: {
        updateDeviceCertificateParams: { action: "DEACTIVATE" },
      },
    }),
  );
  expect(created.actionArn).toContain(actionName);

  const described = await client.send(
    new DescribeMitigationActionCommand({ actionName }),
  );
  expect(described.actionName).toBe(actionName);
  expect(described.roleArn).toContain("MitigationRole");

  await client.send(
    new UpdateMitigationActionCommand({
      actionName,
      roleArn: `arn:aws:iam::${account}:role/MitigationRole2`,
      actionParams: {
        updateDeviceCertificateParams: { action: "DEACTIVATE" },
      },
    }),
  );

  const listed = await client.send(new ListMitigationActionsCommand({}));
  expect(
    listed.actionIdentifiers?.some((a) => a.actionName === actionName),
  ).toBe(true);

  const sfx2 = suffix();
  const taskId = `task-${sfx2}`;
  const auditTaskStarted = await client.send(
    new StartOnDemandAuditTaskCommand({
      targetCheckNames: ["DEVICE_CERTIFICATE_EXPIRING_CHECK"],
    }),
  );
  const auditTaskStarted2 = await client.send(
    new StartAuditMitigationActionsTaskCommand({
      taskId,
      target: { auditTaskId: auditTaskStarted.taskId! },
      auditCheckToActionsMapping: {
        DEVICE_CERTIFICATE_EXPIRING_CHECK: [actionName],
      },
    }),
  );
  expect(auditTaskStarted2.taskId).toBe(taskId);

  const listedTasks = await client.send(
    new ListAuditMitigationActionsTasksCommand({
      startTime: new Date(0),
      endTime: new Date(),
    }),
  );
  expect(listedTasks.tasks?.some((t) => t.taskId === taskId)).toBe(true);

  const executions = await client.send(
    new ListAuditMitigationActionsExecutionsCommand({
      taskId,
      findingId: "finding-placeholder",
    }),
  );
  expect(executions.actionsExecutions).toBeDefined();

  await client.send(new CancelAuditMitigationActionsTaskCommand({ taskId }));

  await client.send(new DeleteMitigationActionCommand({ actionName }));
});

test("ScheduledAudit lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const scheduledAuditName = `bunsai_e2e_audit_${sfx}`;

  const created = await client.send(
    new CreateScheduledAuditCommand({
      scheduledAuditName,
      frequency: "WEEKLY",
      dayOfWeek: "MON",
      targetCheckNames: ["DEVICE_CERTIFICATE_EXPIRING_CHECK"],
    }),
  );
  expect(created.scheduledAuditArn).toContain(scheduledAuditName);

  const described = await client.send(
    new DescribeScheduledAuditCommand({ scheduledAuditName }),
  );
  expect(described.scheduledAuditName).toBe(scheduledAuditName);
  expect(described.frequency as string).toBe("WEEKLY");

  await client.send(
    new UpdateScheduledAuditCommand({
      scheduledAuditName,
      frequency: "DAILY",
      targetCheckNames: ["DEVICE_CERTIFICATE_EXPIRING_CHECK"],
    }),
  );
  const afterUpdate = await client.send(
    new DescribeScheduledAuditCommand({ scheduledAuditName }),
  );
  expect(afterUpdate.frequency as string).toBe("DAILY");

  const listed = await client.send(new ListScheduledAuditsCommand({}));
  expect(
    listed.scheduledAudits?.some(
      (a) => a.scheduledAuditName === scheduledAuditName,
    ),
  ).toBe(true);

  await client.send(new DeleteScheduledAuditCommand({ scheduledAuditName }));
});

test("SecurityProfile lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const securityProfileName = `bunsai_e2e_profile_${sfx}`;
  const targetArn = `arn:aws:iot:${region}:${account}:all/registered-things`;

  const created = await client.send(
    new CreateSecurityProfileCommand({
      securityProfileName,
      securityProfileDescription: "e2e test profile",
      behaviors: [
        {
          name: "check-msg-count",
          metric: "aws:num-messages-sent",
          criteria: {
            comparisonOperator: "less-than",
            value: { count: 100 },
            consecutiveDatapointsToAlarm: 1,
            consecutiveDatapointsToClear: 1,
          },
        },
      ],
    }),
  );
  expect(created.securityProfileArn).toContain(securityProfileName);

  const described = await client.send(
    new DescribeSecurityProfileCommand({ securityProfileName }),
  );
  expect(described.securityProfileName).toBe(securityProfileName);

  await client.send(
    new UpdateSecurityProfileCommand({
      securityProfileName,
      securityProfileDescription: "updated description",
    }),
  );

  const listed = await client.send(new ListSecurityProfilesCommand({}));
  expect(
    listed.securityProfileIdentifiers?.some(
      (p) => p.name === securityProfileName,
    ),
  ).toBe(true);

  await client.send(
    new AttachSecurityProfileCommand({
      securityProfileName,
      securityProfileTargetArn: targetArn,
    }),
  );

  const targets = await client.send(
    new ListTargetsForSecurityProfileCommand({ securityProfileName }),
  );
  expect(targets.securityProfileTargets?.some((t) => t.arn === targetArn)).toBe(
    true,
  );

  const forTarget = await client.send(
    new ListSecurityProfilesForTargetCommand({
      securityProfileTargetArn: targetArn,
    }),
  );
  expect(
    forTarget.securityProfileTargetMappings?.some(
      (m) => m.securityProfileIdentifier?.name === securityProfileName,
    ),
  ).toBe(true);

  await client.send(
    new DetachSecurityProfileCommand({
      securityProfileName,
      securityProfileTargetArn: targetArn,
    }),
  );

  const validate = await client.send(
    new ValidateSecurityProfileBehaviorsCommand({
      behaviors: [{ name: "check-msg-count", metric: "aws:num-messages-sent" }],
    }),
  );
  expect(validate.valid).toBe(true);

  await client.send(new DeleteSecurityProfileCommand({ securityProfileName }));
});

test("CustomMetric lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const metricName = `bunsai_e2e_metric_${sfx}`;

  const created = await client.send(
    new CreateCustomMetricCommand({
      metricName,
      metricType: "ip-address-list",
      clientRequestToken: sfx,
    }),
  );
  expect(created.metricArn).toContain(metricName);

  const described = await client.send(
    new DescribeCustomMetricCommand({ metricName }),
  );
  expect(described.metricName).toBe(metricName);
  expect(described.metricType as string).toBe("ip-address-list");

  await client.send(
    new UpdateCustomMetricCommand({
      metricName,
      displayName: "Updated Display Name",
    }),
  );

  const listed = await client.send(new ListCustomMetricsCommand({}));
  expect(listed.metricNames?.includes(metricName)).toBe(true);

  await client.send(new DeleteCustomMetricCommand({ metricName }));
});

test("Dimension lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const name = `bunsai_e2e_dim_${sfx}`;

  const created = await client.send(
    new CreateDimensionCommand({
      name,
      type: "TOPIC_FILTER",
      stringValues: ["device/+/data"],
      clientRequestToken: sfx,
    }),
  );
  expect(created.arn).toContain(name);

  const described = await client.send(new DescribeDimensionCommand({ name }));
  expect(described.name).toBe(name);
  expect(described.type as string).toBe("TOPIC_FILTER");

  await client.send(
    new UpdateDimensionCommand({
      name,
      stringValues: ["device/+/data", "device/+/status"],
    }),
  );
  const afterUpdate = await client.send(new DescribeDimensionCommand({ name }));
  expect(afterUpdate.stringValues?.length).toBe(2);

  const listed = await client.send(new ListDimensionsCommand({}));
  expect(listed.dimensionNames?.includes(name)).toBe(true);

  await client.send(new DeleteDimensionCommand({ name }));
});

test("Detect lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const taskId = `detect-task-${sfx}`;

  const started = await client.send(
    new StartDetectMitigationActionsTaskCommand({
      taskId,
      target: { violationIds: ["violation-1"] },
      actions: ["DeactivateCertificate"],
      clientRequestToken: sfx,
    }),
  );
  expect(started.taskId).toBe(taskId);

  const listed = await client.send(
    new ListDetectMitigationActionsTasksCommand({
      startTime: new Date(0),
      endTime: new Date(),
    }),
  );
  expect(listed.tasks?.some((t) => t.taskId === taskId)).toBe(true);

  const executions = await client.send(
    new ListDetectMitigationActionsExecutionsCommand({ taskId }),
  );
  expect(executions.actionsExecutions).toBeDefined();

  await client.send(new CancelDetectMitigationActionsTaskCommand({ taskId }));

  const violations = await client.send(new ListActiveViolationsCommand({}));
  expect(violations.activeViolations).toBeDefined();

  const violationEvents = await client.send(
    new ListViolationEventsCommand({
      startTime: new Date(0),
      endTime: new Date(),
    }),
  );
  expect(violationEvents.violationEvents).toBeDefined();

  const summaries = await client.send(
    new GetBehaviorModelTrainingSummariesCommand({}),
  );
  expect(summaries.summaries).toBeDefined();
});
