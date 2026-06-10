import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CountClosedWorkflowExecutionsCommand,
  CountOpenWorkflowExecutionsCommand,
  CountPendingActivityTasksCommand,
  CountPendingDecisionTasksCommand,
  DeleteActivityTypeCommand,
  DeleteWorkflowTypeCommand,
  DeprecateActivityTypeCommand,
  DeprecateDomainCommand,
  DeprecateWorkflowTypeCommand,
  DescribeActivityTypeCommand,
  DescribeDomainCommand,
  DescribeWorkflowExecutionCommand,
  DescribeWorkflowTypeCommand,
  GetWorkflowExecutionHistoryCommand,
  ListActivityTypesCommand,
  ListClosedWorkflowExecutionsCommand,
  ListDomainsCommand,
  ListOpenWorkflowExecutionsCommand,
  ListTagsForResourceCommand,
  ListWorkflowTypesCommand,
  PollForActivityTaskCommand,
  PollForDecisionTaskCommand,
  RecordActivityTaskHeartbeatCommand,
  RegisterActivityTypeCommand,
  RegisterDomainCommand,
  RegisterWorkflowTypeCommand,
  RequestCancelWorkflowExecutionCommand,
  RespondActivityTaskCanceledCommand,
  RespondActivityTaskCompletedCommand,
  RespondActivityTaskFailedCommand,
  RespondDecisionTaskCompletedCommand,
  SWFClient,
  SignalWorkflowExecutionCommand,
  StartWorkflowExecutionCommand,
  TagResourceCommand,
  TerminateWorkflowExecutionCommand,
  UndeprecateActivityTypeCommand,
  UndeprecateDomainCommand,
  UndeprecateWorkflowTypeCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-swf";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const swf = () =>
  new SWFClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("SWF domain lifecycle", async () => {
  const client = swf();
  const name = "bunsai-e2e-domain";

  await client.send(
    new RegisterDomainCommand({
      name,
      description: "bunsai e2e domain",
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );

  const described = await client.send(new DescribeDomainCommand({ name }));
  expect(described.domainInfo?.name).toBe(name);
  expect(described.domainInfo?.status).toBe("REGISTERED");
  expect(described.domainInfo?.description).toBe("bunsai e2e domain");
  expect(described.configuration?.workflowExecutionRetentionPeriodInDays).toBe(
    "7",
  );

  const listed = await client.send(
    new ListDomainsCommand({ registrationStatus: "REGISTERED" }),
  );
  const names = (listed.domainInfos ?? []).map((d) => d.name);
  expect(names).toContain(name);

  await client.send(new DeprecateDomainCommand({ name }));

  const afterDeprecate = await client.send(new DescribeDomainCommand({ name }));
  expect(afterDeprecate.domainInfo?.status).toBe("DEPRECATED");

  const deprecatedList = await client.send(
    new ListDomainsCommand({ registrationStatus: "DEPRECATED" }),
  );
  const deprecatedNames = (deprecatedList.domainInfos ?? []).map((d) => d.name);
  expect(deprecatedNames).toContain(name);

  await client.send(new UndeprecateDomainCommand({ name }));
  const afterUndeprecate = await client.send(
    new DescribeDomainCommand({ name }),
  );
  expect(afterUndeprecate.domainInfo?.status).toBe("REGISTERED");
});

test("SWF activity type lifecycle", async () => {
  const client = swf();
  const domain = "bunsai-at-domain";
  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );

  await client.send(
    new RegisterActivityTypeCommand({
      domain,
      name: "MyActivity",
      version: "1.0",
      description: "test activity",
      defaultTaskStartToCloseTimeout: "60",
    }),
  );

  const described = await client.send(
    new DescribeActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  expect(described.typeInfo?.activityType?.name).toBe("MyActivity");
  expect(described.typeInfo?.status).toBe("REGISTERED");
  expect(described.configuration?.defaultTaskStartToCloseTimeout).toBe("60");

  const listed = await client.send(
    new ListActivityTypesCommand({ domain, registrationStatus: "REGISTERED" }),
  );
  const names = (listed.typeInfos ?? []).map((t) => t.activityType?.name);
  expect(names).toContain("MyActivity");

  await client.send(
    new DeprecateActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  const afterDeprecate = await client.send(
    new DescribeActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  expect(afterDeprecate.typeInfo?.status).toBe("DEPRECATED");

  await client.send(
    new UndeprecateActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  const afterUndeprecate = await client.send(
    new DescribeActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  expect(afterUndeprecate.typeInfo?.status).toBe("REGISTERED");

  await client.send(
    new DeprecateActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  await client.send(
    new DeleteActivityTypeCommand({
      domain,
      activityType: { name: "MyActivity", version: "1.0" },
    }),
  );
  const afterDelete = await client.send(
    new ListActivityTypesCommand({ domain, registrationStatus: "DEPRECATED" }),
  );
  const namesAfterDelete = (afterDelete.typeInfos ?? []).map(
    (t) => t.activityType?.name,
  );
  expect(namesAfterDelete).not.toContain("MyActivity");
});

test("SWF workflow type lifecycle", async () => {
  const client = swf();
  const domain = "bunsai-wt-domain";
  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );

  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "MyWorkflow",
      version: "1.0",
      description: "test workflow",
      defaultTaskStartToCloseTimeout: "30",
      defaultExecutionStartToCloseTimeout: "300",
      defaultChildPolicy: "TERMINATE",
    }),
  );

  const described = await client.send(
    new DescribeWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  expect(described.typeInfo?.workflowType?.name).toBe("MyWorkflow");
  expect(described.typeInfo?.status).toBe("REGISTERED");
  expect(described.configuration?.defaultChildPolicy).toBe("TERMINATE");

  const listed = await client.send(
    new ListWorkflowTypesCommand({ domain, registrationStatus: "REGISTERED" }),
  );
  const names = (listed.typeInfos ?? []).map((t) => t.workflowType?.name);
  expect(names).toContain("MyWorkflow");

  await client.send(
    new DeprecateWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  const afterDeprecate = await client.send(
    new DescribeWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  expect(afterDeprecate.typeInfo?.status).toBe("DEPRECATED");

  await client.send(
    new UndeprecateWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  const afterUndeprecate = await client.send(
    new DescribeWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  expect(afterUndeprecate.typeInfo?.status).toBe("REGISTERED");

  await client.send(
    new DeprecateWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  await client.send(
    new DeleteWorkflowTypeCommand({
      domain,
      workflowType: { name: "MyWorkflow", version: "1.0" },
    }),
  );
  const afterDelete = await client.send(
    new ListWorkflowTypesCommand({ domain, registrationStatus: "DEPRECATED" }),
  );
  const namesAfterDelete = (afterDelete.typeInfos ?? []).map(
    (t) => t.workflowType?.name,
  );
  expect(namesAfterDelete).not.toContain("MyWorkflow");
});

test("SWF workflow execution lifecycle with decision and activity tasks", async () => {
  const client = swf();
  const domain = "bunsai-exec-domain";
  const taskList = { name: "main" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "MyFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );
  await client.send(
    new RegisterActivityTypeCommand({
      domain,
      name: "MyTask",
      version: "1.0",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-1",
      workflowType: { name: "MyFlow", version: "1.0" },
      taskList,
      input: "start-input",
      tagList: ["e2e", "test"],
    }),
  );
  expect(started.runId).toBeTruthy();
  const runId = started.runId!;

  const described = await client.send(
    new DescribeWorkflowExecutionCommand({
      domain,
      execution: { workflowId: "wf-1", runId },
    }),
  );
  expect(described.executionInfo?.executionStatus).toBe("OPEN");
  expect(described.executionInfo?.tagList).toContain("e2e");

  const openCount = await client.send(
    new CountOpenWorkflowExecutionsCommand({
      domain,
      startTimeFilter: { oldestDate: new Date(0) },
    }),
  );
  expect(openCount.count).toBeGreaterThan(0);

  const openList = await client.send(
    new ListOpenWorkflowExecutionsCommand({
      domain,
      startTimeFilter: { oldestDate: new Date(0) },
    }),
  );
  const runIds = (openList.executionInfos ?? []).map((e) => e.execution?.runId);
  expect(runIds).toContain(runId);

  const pendingDecisions = await client.send(
    new CountPendingDecisionTasksCommand({ domain, taskList }),
  );
  expect(pendingDecisions.count).toBeGreaterThan(0);

  const decisionTask = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  expect(decisionTask.taskToken).toBeTruthy();
  expect(decisionTask.workflowExecution?.workflowId).toBe("wf-1");
  expect(decisionTask.events?.length).toBeGreaterThan(0);

  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: decisionTask.taskToken!,
      decisions: [
        {
          decisionType: "ScheduleActivityTask",
          scheduleActivityTaskDecisionAttributes: {
            activityType: { name: "MyTask", version: "1.0" },
            activityId: "act-1",
            input: "activity-input",
            taskList,
          },
        },
      ],
    }),
  );

  const pendingActivities = await client.send(
    new CountPendingActivityTasksCommand({ domain, taskList }),
  );
  expect(pendingActivities.count).toBeGreaterThan(0);

  const activityTask = await client.send(
    new PollForActivityTaskCommand({ domain, taskList }),
  );
  expect(activityTask.taskToken).toBeTruthy();
  expect(activityTask.activityId).toBe("act-1");
  expect(activityTask.input).toBe("activity-input");

  const heartbeat = await client.send(
    new RecordActivityTaskHeartbeatCommand({
      taskToken: activityTask.taskToken!,
    }),
  );
  expect(heartbeat.cancelRequested).toBe(false);

  await client.send(
    new RespondActivityTaskCompletedCommand({
      taskToken: activityTask.taskToken!,
      result: "activity-result",
    }),
  );

  const history = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-1", runId },
    }),
  );
  const eventTypes = (history.events ?? []).map((e) => e.eventType);
  expect(eventTypes).toContain("WorkflowExecutionStarted");
  expect(eventTypes).toContain("DecisionTaskScheduled");
  expect(eventTypes).toContain("ActivityTaskScheduled");
  expect(eventTypes).toContain("ActivityTaskCompleted");
});

test("SWF workflow execution terminate and signal", async () => {
  const client = swf();
  const domain = "bunsai-term-domain";

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "TermFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-term-1",
      workflowType: { name: "TermFlow", version: "1.0" },
    }),
  );
  const runId = started.runId!;

  await client.send(
    new SignalWorkflowExecutionCommand({
      domain,
      workflowId: "wf-term-1",
      signalName: "my-signal",
      input: "signal-data",
    }),
  );

  await client.send(
    new RequestCancelWorkflowExecutionCommand({
      domain,
      workflowId: "wf-term-1",
    }),
  );

  const described = await client.send(
    new DescribeWorkflowExecutionCommand({
      domain,
      execution: { workflowId: "wf-term-1", runId },
    }),
  );
  expect(described.executionInfo?.cancelRequested).toBe(true);

  await client.send(
    new TerminateWorkflowExecutionCommand({
      domain,
      workflowId: "wf-term-1",
      reason: "e2e test",
    }),
  );

  const afterTerminate = await client.send(
    new DescribeWorkflowExecutionCommand({
      domain,
      execution: { workflowId: "wf-term-1", runId },
    }),
  );
  expect(afterTerminate.executionInfo?.executionStatus).toBe("CLOSED");
  expect(afterTerminate.executionInfo?.closeStatus).toBe("TERMINATED");

  const closedCount = await client.send(
    new CountClosedWorkflowExecutionsCommand({ domain }),
  );
  expect(closedCount.count).toBeGreaterThan(0);

  const closedList = await client.send(
    new ListClosedWorkflowExecutionsCommand({ domain }),
  );
  const closedRunIds = (closedList.executionInfos ?? []).map(
    (e) => e.execution?.runId,
  );
  expect(closedRunIds).toContain(runId);
});

test("SWF activity task failed and canceled", async () => {
  const client = swf();
  const domain = "bunsai-fail-domain";
  const taskList = { name: "fail-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "FailFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );
  await client.send(
    new RegisterActivityTypeCommand({
      domain,
      name: "FailTask",
      version: "1.0",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-fail-1",
      workflowType: { name: "FailFlow", version: "1.0" },
      taskList,
    }),
  );
  const runId = started.runId!;

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: dt.taskToken!,
      decisions: [
        {
          decisionType: "ScheduleActivityTask",
          scheduleActivityTaskDecisionAttributes: {
            activityType: { name: "FailTask", version: "1.0" },
            activityId: "fail-act-1",
            taskList,
          },
        },
      ],
    }),
  );

  const at = await client.send(
    new PollForActivityTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondActivityTaskFailedCommand({
      taskToken: at.taskToken!,
      reason: "test failure",
      details: "detail info",
    }),
  );

  const history = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-fail-1", runId },
    }),
  );
  const types = (history.events ?? []).map((e) => e.eventType);
  expect(types).toContain("ActivityTaskFailed");

  const dt2 = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: dt2.taskToken!,
      decisions: [
        {
          decisionType: "ScheduleActivityTask",
          scheduleActivityTaskDecisionAttributes: {
            activityType: { name: "FailTask", version: "1.0" },
            activityId: "cancel-act-1",
            taskList,
          },
        },
      ],
    }),
  );

  const at2 = await client.send(
    new PollForActivityTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondActivityTaskCanceledCommand({
      taskToken: at2.taskToken!,
      details: "canceled detail",
    }),
  );

  const history2 = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-fail-1", runId },
    }),
  );
  const types2 = (history2.events ?? []).map((e) => e.eventType);
  expect(types2).toContain("ActivityTaskCanceled");
});

test("SWF complete workflow execution via decision", async () => {
  const client = swf();
  const domain = "bunsai-complete-domain";
  const taskList = { name: "complete-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "CompleteFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-complete-1",
      workflowType: { name: "CompleteFlow", version: "1.0" },
      taskList,
    }),
  );
  const runId = started.runId!;

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: dt.taskToken!,
      decisions: [
        {
          decisionType: "CompleteWorkflowExecution",
          completeWorkflowExecutionDecisionAttributes: {
            result: "done",
          },
        },
      ],
    }),
  );

  const described = await client.send(
    new DescribeWorkflowExecutionCommand({
      domain,
      execution: { workflowId: "wf-complete-1", runId },
    }),
  );
  expect(described.executionInfo?.executionStatus).toBe("CLOSED");
  expect(described.executionInfo?.closeStatus).toBe("COMPLETED");
});

test("SWF tags lifecycle", async () => {
  const client = swf();
  const domain = "bunsai-tag-domain";

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );

  const described = await client.send(
    new DescribeDomainCommand({ name: domain }),
  );
  const resourceArn = described.domainInfo?.arn!;

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "swf" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  const tagMap = Object.fromEntries(
    (listed.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("swf");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  const keys = (afterUntag.tags ?? []).map((t) => t.key);
  expect(keys).not.toContain("env");
  expect(keys).toContain("team");
});

test("SWF poll returns empty when no tasks queued", async () => {
  const client = swf();
  const domain = "bunsai-empty-domain";
  const taskList = { name: "empty-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  expect(dt.taskToken).toBe("");

  const at = await client.send(
    new PollForActivityTaskCommand({ domain, taskList }),
  );
  expect(at.taskToken).toBe("");
});

test("SWF PollForDecisionTask creates DecisionTaskStarted history event", async () => {
  const client = swf();
  const domain = "bunsai-dts-domain";
  const taskList = { name: "dts-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "DtsFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-dts-1",
      workflowType: { name: "DtsFlow", version: "1.0" },
      taskList,
    }),
  );
  const runId = started.runId!;

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  expect(dt.taskToken).toBeTruthy();
  expect(dt.startedEventId).toBeGreaterThan(0);

  const history = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-dts-1", runId },
    }),
  );
  const eventTypes = (history.events ?? []).map((e) => e.eventType);
  expect(eventTypes).toContain("DecisionTaskStarted");

  const startedEvent = (history.events ?? []).find(
    (e) => e.eventType === "DecisionTaskStarted",
  );
  expect(startedEvent?.eventId).toBe(dt.startedEventId);
});

test("SWF PollForActivityTask creates ActivityTaskStarted history event", async () => {
  const client = swf();
  const domain = "bunsai-ats-domain";
  const taskList = { name: "ats-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "AtsFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );
  await client.send(
    new RegisterActivityTypeCommand({
      domain,
      name: "AtsTask",
      version: "1.0",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-ats-1",
      workflowType: { name: "AtsFlow", version: "1.0" },
      taskList,
    }),
  );
  const runId = started.runId!;

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: dt.taskToken!,
      decisions: [
        {
          decisionType: "ScheduleActivityTask",
          scheduleActivityTaskDecisionAttributes: {
            activityType: { name: "AtsTask", version: "1.0" },
            activityId: "ats-act-1",
            taskList,
          },
        },
      ],
    }),
  );

  const at = await client.send(
    new PollForActivityTaskCommand({ domain, taskList }),
  );
  expect(at.taskToken).toBeTruthy();
  expect(at.startedEventId).toBeGreaterThan(0);

  const history = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-ats-1", runId },
    }),
  );
  const eventTypes = (history.events ?? []).map((e) => e.eventType);
  expect(eventTypes).toContain("ActivityTaskStarted");

  const startedEvent = (history.events ?? []).find(
    (e) => e.eventType === "ActivityTaskStarted",
  );
  expect(startedEvent?.eventId).toBe(at.startedEventId);
});

test("SWF ListWorkflowExecutions pagination with maximumPageSize", async () => {
  const client = swf();
  const domain = "bunsai-page-domain";

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "PageFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );

  for (let i = 0; i < 3; i++) {
    await client.send(
      new StartWorkflowExecutionCommand({
        domain,
        workflowId: `wf-page-${i}`,
        workflowType: { name: "PageFlow", version: "1.0" },
      }),
    );
  }

  const page1 = await client.send(
    new ListOpenWorkflowExecutionsCommand({
      domain,
      startTimeFilter: { oldestDate: new Date(0) },
      maximumPageSize: 2,
    }),
  );
  expect((page1.executionInfos ?? []).length).toBe(2);
  expect(page1.nextPageToken).toBeTruthy();

  const page2 = await client.send(
    new ListOpenWorkflowExecutionsCommand({
      domain,
      startTimeFilter: { oldestDate: new Date(0) },
      maximumPageSize: 2,
      nextPageToken: page1.nextPageToken,
    }),
  );
  expect((page2.executionInfos ?? []).length).toBeGreaterThanOrEqual(1);

  const allIds = [
    ...(page1.executionInfos ?? []).map((e) => e.execution?.workflowId),
    ...(page2.executionInfos ?? []).map((e) => e.execution?.workflowId),
  ];
  for (let i = 0; i < 3; i++) {
    expect(allIds).toContain(`wf-page-${i}`);
  }
});

test("SWF ListDomains pagination", async () => {
  const client = swf();

  for (let i = 0; i < 3; i++) {
    await client.send(
      new RegisterDomainCommand({
        name: `bunsai-pagdomain-${i}`,
        workflowExecutionRetentionPeriodInDays: "7",
      }),
    );
  }

  const page1 = await client.send(
    new ListDomainsCommand({
      registrationStatus: "REGISTERED",
      maximumPageSize: 2,
    }),
  );
  expect((page1.domainInfos ?? []).length).toBe(2);
  expect(page1.nextPageToken).toBeTruthy();

  const page2 = await client.send(
    new ListDomainsCommand({
      registrationStatus: "REGISTERED",
      maximumPageSize: 2,
      nextPageToken: page1.nextPageToken,
    }),
  );
  expect((page2.domainInfos ?? []).length).toBeGreaterThanOrEqual(1);
});

test("SWF RespondDecisionTaskCompleted ScheduleActivityTaskFailed for deprecated type", async () => {
  const client = swf();
  const domain = "bunsai-satf-domain";
  const taskList = { name: "satf-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "SatfFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );
  await client.send(
    new RegisterActivityTypeCommand({
      domain,
      name: "SatfTask",
      version: "1.0",
    }),
  );
  await client.send(
    new DeprecateActivityTypeCommand({
      domain,
      activityType: { name: "SatfTask", version: "1.0" },
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-satf-1",
      workflowType: { name: "SatfFlow", version: "1.0" },
      taskList,
    }),
  );
  const runId = started.runId!;

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: dt.taskToken!,
      decisions: [
        {
          decisionType: "ScheduleActivityTask",
          scheduleActivityTaskDecisionAttributes: {
            activityType: { name: "SatfTask", version: "1.0" },
            activityId: "satf-act-1",
            taskList,
          },
        },
      ],
    }),
  );

  const history = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-satf-1", runId },
    }),
  );
  const eventTypes = (history.events ?? []).map((e) => e.eventType);
  expect(eventTypes).toContain("ScheduleActivityTaskFailed");
  expect(eventTypes).not.toContain("ActivityTaskScheduled");
});

test("SWF GetWorkflowExecutionHistory pagination", async () => {
  const client = swf();
  const domain = "bunsai-hist-domain";
  const taskList = { name: "hist-list" };

  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({
      domain,
      name: "HistFlow",
      version: "1.0",
      defaultChildPolicy: "TERMINATE",
    }),
  );

  const started = await client.send(
    new StartWorkflowExecutionCommand({
      domain,
      workflowId: "wf-hist-1",
      workflowType: { name: "HistFlow", version: "1.0" },
      taskList,
    }),
  );
  const runId = started.runId!;

  const dt = await client.send(
    new PollForDecisionTaskCommand({ domain, taskList }),
  );
  await client.send(
    new RespondDecisionTaskCompletedCommand({
      taskToken: dt.taskToken!,
      decisions: [
        {
          decisionType: "CompleteWorkflowExecution",
          completeWorkflowExecutionDecisionAttributes: { result: "done" },
        },
      ],
    }),
  );

  const page1 = await client.send(
    new GetWorkflowExecutionHistoryCommand({
      domain,
      execution: { workflowId: "wf-hist-1", runId },
      maximumPageSize: 2,
    }),
  );
  expect((page1.events ?? []).length).toBe(2);
  expect(page1.nextPageToken).toBeTruthy();

  const allEvents = [...(page1.events ?? [])];
  let token = page1.nextPageToken;
  while (token) {
    const page = await client.send(
      new GetWorkflowExecutionHistoryCommand({
        domain,
        execution: { workflowId: "wf-hist-1", runId },
        maximumPageSize: 2,
        nextPageToken: token,
      }),
    );
    allEvents.push(...(page.events ?? []));
    token = page.nextPageToken;
  }

  const allTypes = allEvents.map((e) => e.eventType);
  expect(allTypes).toContain("WorkflowExecutionStarted");
  expect(allTypes).toContain("DecisionTaskStarted");
  expect(allTypes).toContain("WorkflowExecutionCompleted");
});

test("SWF reverseOrder on ListActivityTypes", async () => {
  const client = swf();
  const domain = "bunsai-ro-at-domain";
  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  for (const name of ["Alpha", "Beta", "Gamma"]) {
    await client.send(
      new RegisterActivityTypeCommand({ domain, name, version: "1.0" }),
    );
  }
  const asc = await client.send(
    new ListActivityTypesCommand({ domain, registrationStatus: "REGISTERED" }),
  );
  const ascNames = (asc.typeInfos ?? []).map((t) => t.activityType?.name);
  expect(ascNames).toEqual(["Alpha", "Beta", "Gamma"]);

  const desc = await client.send(
    new ListActivityTypesCommand({
      domain,
      registrationStatus: "REGISTERED",
      reverseOrder: true,
    }),
  );
  const descNames = (desc.typeInfos ?? []).map((t) => t.activityType?.name);
  expect(descNames).toEqual(["Gamma", "Beta", "Alpha"]);
});

test("SWF reverseOrder on ListWorkflowTypes", async () => {
  const client = swf();
  const domain = "bunsai-ro-wt-domain";
  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  for (const name of ["Alpha", "Beta", "Gamma"]) {
    await client.send(
      new RegisterWorkflowTypeCommand({ domain, name, version: "1.0" }),
    );
  }
  const asc = await client.send(
    new ListWorkflowTypesCommand({ domain, registrationStatus: "REGISTERED" }),
  );
  const ascNames = (asc.typeInfos ?? []).map((t) => t.workflowType?.name);
  expect(ascNames).toEqual(["Alpha", "Beta", "Gamma"]);

  const desc = await client.send(
    new ListWorkflowTypesCommand({
      domain,
      registrationStatus: "REGISTERED",
      reverseOrder: true,
    }),
  );
  const descNames = (desc.typeInfos ?? []).map((t) => t.workflowType?.name);
  expect(descNames).toEqual(["Gamma", "Beta", "Alpha"]);
});

test("SWF reverseOrder on ListDomains", async () => {
  const client = swf();
  for (const name of ["bunsai-ro-d-alpha", "bunsai-ro-d-beta", "bunsai-ro-d-gamma"]) {
    await client.send(
      new RegisterDomainCommand({
        name,
        workflowExecutionRetentionPeriodInDays: "7",
      }),
    );
  }
  const asc = await client.send(
    new ListDomainsCommand({ registrationStatus: "REGISTERED" }),
  );
  const ascNames = (asc.domainInfos ?? []).map((d) => d.name);
  const ascFiltered = ascNames.filter((n) => n?.startsWith("bunsai-ro-d-"));
  expect(ascFiltered).toEqual([
    "bunsai-ro-d-alpha",
    "bunsai-ro-d-beta",
    "bunsai-ro-d-gamma",
  ]);

  const desc = await client.send(
    new ListDomainsCommand({ registrationStatus: "REGISTERED", reverseOrder: true }),
  );
  const descNames = (desc.domainInfos ?? []).map((d) => d.name);
  const descFiltered = descNames.filter((n) => n?.startsWith("bunsai-ro-d-"));
  expect(descFiltered).toEqual([
    "bunsai-ro-d-gamma",
    "bunsai-ro-d-beta",
    "bunsai-ro-d-alpha",
  ]);
});

test("SWF TypeNotDeprecatedFault on DeleteActivityType", async () => {
  const client = swf();
  const domain = "bunsai-tnd-at-domain";
  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterActivityTypeCommand({ domain, name: "MyAct", version: "1.0" }),
  );
  await expect(
    client.send(
      new DeleteActivityTypeCommand({
        domain,
        activityType: { name: "MyAct", version: "1.0" },
      }),
    ),
  ).rejects.toMatchObject({ name: "TypeNotDeprecatedFault" });
});

test("SWF TypeNotDeprecatedFault on DeleteWorkflowType", async () => {
  const client = swf();
  const domain = "bunsai-tnd-wt-domain";
  await client.send(
    new RegisterDomainCommand({
      name: domain,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(
    new RegisterWorkflowTypeCommand({ domain, name: "MyWf", version: "1.0" }),
  );
  await expect(
    client.send(
      new DeleteWorkflowTypeCommand({
        domain,
        workflowType: { name: "MyWf", version: "1.0" },
      }),
    ),
  ).rejects.toMatchObject({ name: "TypeNotDeprecatedFault" });
});

test("SWF DomainDeprecatedFault on double DeprecateDomain", async () => {
  const client = swf();
  const name = "bunsai-dd-domain";
  await client.send(
    new RegisterDomainCommand({
      name,
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );
  await client.send(new DeprecateDomainCommand({ name }));
  await expect(
    client.send(new DeprecateDomainCommand({ name })),
  ).rejects.toMatchObject({ name: "DomainDeprecatedFault" });
});
