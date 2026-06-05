import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ActivateOrganizationsAccessCommand,
  ActivateTypeCommand,
  BatchDescribeTypeConfigurationsCommand,
  CancelUpdateStackCommand,
  CloudFormationClient,
  CreateChangeSetCommand,
  CreateGeneratedTemplateCommand,
  CreateStackCommand,
  CreateStackInstancesCommand,
  CreateStackSetCommand,
  DeactivateOrganizationsAccessCommand,
  DeleteChangeSetCommand,
  DeleteGeneratedTemplateCommand,
  DeleteStackInstancesCommand,
  DeleteStackSetCommand,
  DeregisterTypeCommand,
  DescribeAccountLimitsCommand,
  DescribeChangeSetCommand,
  DescribeChangeSetHooksCommand,
  DescribeGeneratedTemplateCommand,
  DescribeOrganizationsAccessCommand,
  DescribeResourceScanCommand,
  DescribeStackDriftDetectionStatusCommand,
  DescribeStackEventsCommand,
  DescribeStackInstanceCommand,
  DescribeStackRefactorCommand,
  DescribeStackResourceDriftsCommand,
  DescribeStackResourcesCommand,
  DescribeStackSetCommand,
  DescribeStackSetOperationCommand,
  DescribeTypeCommand,
  DescribeTypeRegistrationCommand,
  DetectStackDriftCommand,
  DetectStackResourceDriftCommand,
  DetectStackSetDriftCommand,
  EstimateTemplateCostCommand,
  ExecuteChangeSetCommand,
  ExecuteStackRefactorCommand,
  GetGeneratedTemplateCommand,
  GetStackPolicyCommand,
  GetTemplateSummaryCommand,
  ImportStacksToStackSetCommand,
  ListChangeSetsCommand,
  ListExportsCommand,
  ListGeneratedTemplatesCommand,
  ListImportsCommand,
  ListResourceScanResourcesCommand,
  ListResourceScansCommand,
  ListStackInstancesCommand,
  ListStackRefactorActionsCommand,
  ListStackRefactorsCommand,
  ListStackResourcesCommand,
  ListStackSetOperationsCommand,
  ListStackSetsCommand,
  ListTypeVersionsCommand,
  ListTypesCommand,
  RegisterPublisherCommand,
  RegisterTypeCommand,
  RollbackStackCommand,
  SetStackPolicyCommand,
  SetTypeDefaultVersionCommand,
  SignalResourceCommand,
  StartResourceScanCommand,
  UpdateGeneratedTemplateCommand,
  UpdateStackSetCommand,
  UpdateTerminationProtectionCommand,
  ValidateTemplateCommand,
  CreateStackRefactorCommand,
} from "@aws-sdk/client-cloudformation";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Description: "bunsai change set template",
  Parameters: {
    BucketName: { Type: "String", Default: "default-bucket" },
  },
  Resources: {
    Topic: { Type: "AWS::SNS::Topic" },
    Queue: { Type: "AWS::SQS::Queue" },
  },
});

test("CloudFormation change set lifecycle", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-cs-stack";
  const changeSetName = "bunsai-e2e-cs";

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const created = await client.send(
    new CreateChangeSetCommand({
      StackName: stackName,
      ChangeSetName: changeSetName,
      TemplateBody: template,
      Description: "add resources",
    }),
  );
  const changeSetId = created.Id;
  expect(changeSetId).toBeDefined();
  expect(changeSetId).toContain(`:changeSet/${changeSetName}/`);
  expect(created.StackId).toBeDefined();

  const described = await client.send(
    new DescribeChangeSetCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );
  expect(described.ChangeSetName).toBe(changeSetName);
  expect(described.StackName).toBe(stackName);
  expect(described.Status).toBe("CREATE_COMPLETE");
  expect(described.ExecutionStatus).toBe("AVAILABLE");
  const changeTypes = (described.Changes ?? []).map(
    (change) => change.ResourceChange?.LogicalResourceId,
  );
  expect(changeTypes).toContain("Topic");
  expect(changeTypes).toContain("Queue");

  const listed = await client.send(
    new ListChangeSetsCommand({ StackName: stackName }),
  );
  const names = (listed.Summaries ?? []).map((s) => s.ChangeSetName);
  expect(names).toContain(changeSetName);

  await client.send(
    new DeleteChangeSetCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );

  const listedAfter = await client.send(
    new ListChangeSetsCommand({ StackName: stackName }),
  );
  const namesAfter = (listedAfter.Summaries ?? []).map((s) => s.ChangeSetName);
  expect(namesAfter).not.toContain(changeSetName);

  await expect(
    client.send(
      new DescribeChangeSetCommand({
        ChangeSetName: changeSetName,
        StackName: stackName,
      }),
    ),
  ).rejects.toThrow();
});

test("CloudFormation ValidateTemplate", async () => {
  const client = cfn();

  const validated = await client.send(
    new ValidateTemplateCommand({ TemplateBody: template }),
  );
  expect(validated.Description).toBe("bunsai change set template");
  const paramKeys = (validated.Parameters ?? []).map((p) => p.ParameterKey);
  expect(paramKeys).toContain("BucketName");
  const bucketParam = (validated.Parameters ?? []).find(
    (p) => p.ParameterKey === "BucketName",
  );
  expect(bucketParam?.DefaultValue).toBe("default-bucket");
});

test("CloudFormation stack resources", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-resource-stack";

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const listed = await client.send(
    new ListStackResourcesCommand({ StackName: stackName }),
  );
  const logicalIds = (listed.StackResourceSummaries ?? []).map(
    (r) => r.LogicalResourceId,
  );
  expect(logicalIds).toContain("Topic");
  expect(logicalIds).toContain("Queue");
  const topicSummary = (listed.StackResourceSummaries ?? []).find(
    (r) => r.LogicalResourceId === "Topic",
  );
  expect(topicSummary?.ResourceType).toBe("AWS::SNS::Topic");
  expect(topicSummary?.ResourceStatus).toBe("CREATE_COMPLETE");

  const described = await client.send(
    new DescribeStackResourcesCommand({ StackName: stackName }),
  );
  const describedIds = (described.StackResources ?? []).map(
    (r) => r.LogicalResourceId,
  );
  expect(describedIds).toContain("Topic");
  expect(describedIds).toContain("Queue");

  const filtered = await client.send(
    new DescribeStackResourcesCommand({
      StackName: stackName,
      LogicalResourceId: "Topic",
    }),
  );
  expect(filtered.StackResources?.length).toBe(1);
  expect(filtered.StackResources?.[0]?.LogicalResourceId).toBe("Topic");
  expect(filtered.StackResources?.[0]?.StackName).toBe(stackName);
});

test("CloudFormation stack-set + instances + operation lifecycle", async () => {
  const client = cfn();
  const stackSetName = "bunsai-e2e-stackset";

  const created = await client.send(
    new CreateStackSetCommand({
      StackSetName: stackSetName,
      Description: "e2e test stack set",
      TemplateBody: template,
    }),
  );
  expect(created.StackSetId).toBeDefined();
  expect(created.StackSetId).toContain(`:stackset/${stackSetName}:`);

  const described = await client.send(
    new DescribeStackSetCommand({ StackSetName: stackSetName }),
  );
  expect(described.StackSet?.StackSetName).toBe(stackSetName);
  expect(described.StackSet?.Description).toBe("e2e test stack set");
  expect(described.StackSet?.Status).toBe("ACTIVE");

  const listed = await client.send(new ListStackSetsCommand({}));
  const names = (listed.Summaries ?? []).map((s) => s.StackSetName);
  expect(names).toContain(stackSetName);

  const instCreated = await client.send(
    new CreateStackInstancesCommand({
      StackSetName: stackSetName,
      Accounts: ["123456789012"],
      Regions: ["us-east-1"],
    }),
  );
  expect(instCreated.OperationId).toBeDefined();

  const instances = await client.send(
    new ListStackInstancesCommand({ StackSetName: stackSetName }),
  );
  expect((instances.Summaries ?? []).length).toBeGreaterThan(0);
  expect(instances.Summaries?.[0]?.Region).toBe("us-east-1");

  const instance = await client.send(
    new DescribeStackInstanceCommand({
      StackSetName: stackSetName,
      StackInstanceAccount: "123456789012",
      StackInstanceRegion: "us-east-1",
    }),
  );
  expect(instance.StackInstance?.Status).toBe("CURRENT");

  const ops = await client.send(
    new ListStackSetOperationsCommand({ StackSetName: stackSetName }),
  );
  expect((ops.Summaries ?? []).length).toBeGreaterThan(0);

  const opId = ops.Summaries?.[0]?.OperationId ?? "";
  const opDetail = await client.send(
    new DescribeStackSetOperationCommand({
      StackSetName: stackSetName,
      OperationId: opId,
    }),
  );
  expect(opDetail.StackSetOperation?.Status).toBe("SUCCEEDED");

  const updateOpResult = await client.send(
    new UpdateStackSetCommand({
      StackSetName: stackSetName,
      Description: "updated",
    }),
  );
  expect(updateOpResult.OperationId).toBeDefined();

  const drift = await client.send(
    new DetectStackSetDriftCommand({ StackSetName: stackSetName }),
  );
  expect(drift.OperationId).toBeDefined();

  const importResult = await client.send(
    new ImportStacksToStackSetCommand({ StackSetName: stackSetName }),
  );
  expect(importResult.OperationId).toBeDefined();

  const delInst = await client.send(
    new DeleteStackInstancesCommand({
      StackSetName: stackSetName,
      Accounts: ["123456789012"],
      Regions: ["us-east-1"],
      RetainStacks: false,
    }),
  );
  expect(delInst.OperationId).toBeDefined();

  await client.send(new DeleteStackSetCommand({ StackSetName: stackSetName }));

  await expect(
    client.send(new DescribeStackSetCommand({ StackSetName: stackSetName })),
  ).rejects.toThrow();
});

test("CloudFormation generated template lifecycle", async () => {
  const client = cfn();
  const gtName = "bunsai-e2e-gt";

  const created = await client.send(
    new CreateGeneratedTemplateCommand({ GeneratedTemplateName: gtName }),
  );
  expect(created.GeneratedTemplateId).toBeDefined();

  const described = await client.send(
    new DescribeGeneratedTemplateCommand({ GeneratedTemplateName: gtName }),
  );
  expect(described.GeneratedTemplateName).toBe(gtName);
  expect(described.Status).toBe("COMPLETE");

  const listed = await client.send(new ListGeneratedTemplatesCommand({}));
  const names = (listed.Summaries ?? []).map((s) => s.GeneratedTemplateName);
  expect(names).toContain(gtName);

  const got = await client.send(
    new GetGeneratedTemplateCommand({ GeneratedTemplateName: gtName }),
  );
  expect(got.Status).toBe("COMPLETE");

  await client.send(
    new UpdateGeneratedTemplateCommand({ GeneratedTemplateName: gtName }),
  );

  await client.send(
    new DeleteGeneratedTemplateCommand({ GeneratedTemplateName: gtName }),
  );

  await expect(
    client.send(
      new DescribeGeneratedTemplateCommand({ GeneratedTemplateName: gtName }),
    ),
  ).rejects.toThrow();
});

test("CloudFormation register type + versions + deregister", async () => {
  const client = cfn();
  const typeName = "BunsaiE2E::Test::Resource";

  const registered = await client.send(
    new RegisterTypeCommand({
      TypeName: typeName,
      Type: "RESOURCE",
      SchemaHandlerPackage: "s3://bucket/schema.zip",
    }),
  );
  expect(registered.RegistrationToken).toBeDefined();

  const regDetail = await client.send(
    new DescribeTypeRegistrationCommand({
      RegistrationToken: registered.RegistrationToken!,
    }),
  );
  expect(regDetail.ProgressStatus).toBe("COMPLETE");

  const described = await client.send(
    new DescribeTypeCommand({ TypeName: typeName, Type: "RESOURCE" }),
  );
  expect(described.TypeName).toBe(typeName);
  expect(described.DeprecatedStatus).toBe("LIVE");

  const allTypes = await client.send(new ListTypesCommand({}));
  const typeNames = (allTypes.TypeSummaries ?? []).map((t) => t.TypeName);
  expect(typeNames).toContain(typeName);

  const versions = await client.send(
    new ListTypeVersionsCommand({ TypeName: typeName, Type: "RESOURCE" }),
  );
  expect((versions.TypeVersionSummaries ?? []).length).toBeGreaterThan(0);

  await client.send(
    new SetTypeDefaultVersionCommand({
      TypeName: typeName,
      Type: "RESOURCE",
      VersionId: "00000001",
    }),
  );

  await client.send(
    new DeregisterTypeCommand({ TypeName: typeName, Type: "RESOURCE" }),
  );

  await expect(
    client.send(
      new DescribeTypeCommand({ TypeName: typeName, Type: "RESOURCE" }),
    ),
  ).rejects.toThrow();
});

test("CloudFormation execute change set + stack policy + termination protection", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-exec-cs";
  const changeSetName = "bunsai-e2e-exec-cs-changeset";

  await client.send(
    new CreateChangeSetCommand({
      StackName: stackName,
      ChangeSetName: changeSetName,
      TemplateBody: template,
    }),
  );

  const csDetail = await client.send(
    new DescribeChangeSetCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );
  expect(csDetail.ExecutionStatus).toBe("AVAILABLE");

  const hooks = await client.send(
    new DescribeChangeSetHooksCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );
  expect(hooks.ChangeSetName).toBe(changeSetName);
  expect(String(hooks.Status)).toBe("PLANNING_COMPLETE");

  await client.send(
    new ExecuteChangeSetCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );

  const stackPolicy = JSON.stringify({
    Statement: [{ Effect: "Allow", Action: "Update:*", Resource: "*" }],
  });
  await client.send(
    new SetStackPolicyCommand({
      StackName: stackName,
      StackPolicyBody: stackPolicy,
    }),
  );

  const gotPolicy = await client.send(
    new GetStackPolicyCommand({ StackName: stackName }),
  );
  expect(gotPolicy.StackPolicyBody).toBe(stackPolicy);

  const termProt = await client.send(
    new UpdateTerminationProtectionCommand({
      StackName: stackName,
      EnableTerminationProtection: true,
    }),
  );
  expect(termProt.StackId).toBeDefined();
});

test("CloudFormation drift detection", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-drift-stack";

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const driftResult = await client.send(
    new DetectStackDriftCommand({ StackName: stackName }),
  );
  expect(driftResult.StackDriftDetectionId).toBeDefined();

  const driftStatus = await client.send(
    new DescribeStackDriftDetectionStatusCommand({
      StackDriftDetectionId: driftResult.StackDriftDetectionId!,
    }),
  );
  expect(driftStatus.DetectionStatus).toBe("DETECTION_COMPLETE");

  const resourceDrift = await client.send(
    new DetectStackResourceDriftCommand({
      StackName: stackName,
      LogicalResourceId: "Topic",
    }),
  );
  expect(resourceDrift.StackResourceDrift?.StackResourceDriftStatus).toBe(
    "IN_SYNC",
  );

  const drifts = await client.send(
    new DescribeStackResourceDriftsCommand({ StackName: stackName }),
  );
  expect(drifts.StackResourceDrifts).toBeDefined();

  const events = await client.send(
    new DescribeStackEventsCommand({ StackName: stackName }),
  );
  expect((events.StackEvents ?? []).length).toBeGreaterThan(0);
  expect(events.StackEvents?.[0]?.StackName).toBe(stackName);
});

test("CloudFormation exports + imports + account limits + cost estimate", async () => {
  const client = cfn();

  const exports_ = await client.send(new ListExportsCommand({}));
  expect(exports_.Exports).toBeDefined();

  const imports = await client.send(
    new ListImportsCommand({ ExportName: "test" }),
  );
  expect(imports.Imports).toBeDefined();

  const limits = await client.send(new DescribeAccountLimitsCommand({}));
  const limitNames = (limits.AccountLimits ?? []).map((l) => l.Name);
  expect(limitNames).toContain("StackLimit");

  const costTemplate = JSON.stringify({
    Resources: { Q: { Type: "AWS::SQS::Queue" } },
  });
  const cost = await client.send(
    new EstimateTemplateCostCommand({ TemplateBody: costTemplate }),
  );
  expect(cost.Url).toBeDefined();

  const summary = await client.send(
    new GetTemplateSummaryCommand({ TemplateBody: template }),
  );
  expect(summary.Description).toBe("bunsai change set template");
  const paramKeys = (summary.Parameters ?? []).map((p) => p.ParameterKey);
  expect(paramKeys).toContain("BucketName");
});

test("CloudFormation stack rollback + cancel", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-rollback-stack";

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  await client.send(new CancelUpdateStackCommand({ StackName: stackName }));

  await client.send(new RollbackStackCommand({ StackName: stackName }));

  const signalResult = client.send(
    new SignalResourceCommand({
      StackName: stackName,
      LogicalResourceId: "Topic",
      UniqueId: "signal-id",
      Status: "SUCCESS",
    }),
  );
  await expect(signalResult).resolves.toBeDefined();
});

test("CloudFormation resource scan lifecycle", async () => {
  const client = cfn();

  const started = await client.send(new StartResourceScanCommand({}));
  expect(started.ResourceScanId).toBeDefined();

  const described = await client.send(
    new DescribeResourceScanCommand({
      ResourceScanId: started.ResourceScanId!,
    }),
  );
  expect(described.Status).toBe("COMPLETE");
  expect(described.PercentageCompleted).toBe(100);

  const scans = await client.send(new ListResourceScansCommand({}));
  const scanIds = (scans.ResourceScanSummaries ?? []).map(
    (s) => s.ResourceScanId,
  );
  expect(scanIds).toContain(started.ResourceScanId);

  const resources = await client.send(
    new ListResourceScanResourcesCommand({
      ResourceScanId: started.ResourceScanId!,
    }),
  );
  expect(resources.Resources).toBeDefined();
});

test("CloudFormation stack refactor lifecycle", async () => {
  const client = cfn();

  const created = await client.send(
    new CreateStackRefactorCommand({
      Description: "e2e refactor",
      StackDefinitions: [],
    }),
  );
  expect(created.StackRefactorId).toBeDefined();

  const described = await client.send(
    new DescribeStackRefactorCommand({
      StackRefactorId: created.StackRefactorId!,
    }),
  );
  expect(described.Status).toBe("CREATE_COMPLETE");

  const refactors = await client.send(new ListStackRefactorsCommand({}));
  const ids = (refactors.StackRefactorSummaries ?? []).map(
    (s) => s.StackRefactorId,
  );
  expect(ids).toContain(created.StackRefactorId);

  const actions = await client.send(
    new ListStackRefactorActionsCommand({
      StackRefactorId: created.StackRefactorId!,
    }),
  );
  expect(actions.StackRefactorActions).toBeDefined();

  await client.send(
    new ExecuteStackRefactorCommand({
      StackRefactorId: created.StackRefactorId!,
    }),
  );

  const afterExecute = await client.send(
    new DescribeStackRefactorCommand({
      StackRefactorId: created.StackRefactorId!,
    }),
  );
  expect(String(afterExecute.Status)).toBe("EXECUTE_COMPLETE");
});

test("CloudFormation publisher + organizations access", async () => {
  const client = cfn();

  const pub = await client.send(new RegisterPublisherCommand({}));
  expect(pub.PublisherId).toBeDefined();

  await client.send(new ActivateOrganizationsAccessCommand({}));

  const orgAccess = await client.send(
    new DescribeOrganizationsAccessCommand({}),
  );
  expect(orgAccess.Status).toBe("ENABLED");

  await client.send(new DeactivateOrganizationsAccessCommand({}));

  const typeResult = await client.send(
    new ActivateTypeCommand({
      TypeName: "BunsaiE2E::Activated::Resource",
      Type: "RESOURCE",
      PublisherId: pub.PublisherId,
    }),
  );
  expect(typeResult.Arn).toBeDefined();

  const batch = await client.send(
    new BatchDescribeTypeConfigurationsCommand({
      TypeConfigurationIdentifiers: [],
    }),
  );
  expect(batch.TypeConfigurations).toBeDefined();
});
