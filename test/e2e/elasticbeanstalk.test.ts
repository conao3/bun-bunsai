import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AbortEnvironmentUpdateCommand,
  ApplyEnvironmentManagedActionCommand,
  AssociateEnvironmentOperationsRoleCommand,
  CheckDNSAvailabilityCommand,
  ComposeEnvironmentsCommand,
  CreateApplicationCommand,
  CreateApplicationVersionCommand,
  CreateConfigurationTemplateCommand,
  CreateEnvironmentCommand,
  CreatePlatformVersionCommand,
  CreateStorageLocationCommand,
  DeleteApplicationCommand,
  DeleteApplicationVersionCommand,
  DeleteConfigurationTemplateCommand,
  DeleteEnvironmentConfigurationCommand,
  DeletePlatformVersionCommand,
  DescribeAccountAttributesCommand,
  DescribeApplicationVersionsCommand,
  DescribeApplicationsCommand,
  DescribeConfigurationOptionsCommand,
  DescribeConfigurationSettingsCommand,
  DescribeEnvironmentHealthCommand,
  DescribeEnvironmentManagedActionHistoryCommand,
  DescribeEnvironmentManagedActionsCommand,
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
  DescribeEventsCommand,
  DescribeInstancesHealthCommand,
  DescribePlatformVersionCommand,
  DisassociateEnvironmentOperationsRoleCommand,
  ElasticBeanstalkClient,
  ListAvailableSolutionStacksCommand,
  ListPlatformBranchesCommand,
  ListPlatformVersionsCommand,
  ListTagsForResourceCommand,
  RebuildEnvironmentCommand,
  RequestEnvironmentInfoCommand,
  RestartAppServerCommand,
  RetrieveEnvironmentInfoCommand,
  SwapEnvironmentCNAMEsCommand,
  TerminateEnvironmentCommand,
  UpdateApplicationCommand,
  UpdateApplicationResourceLifecycleCommand,
  UpdateApplicationVersionCommand,
  UpdateConfigurationTemplateCommand,
  UpdateEnvironmentCommand,
  UpdateTagsForResourceCommand,
  ValidateConfigurationSettingsCommand,
} from "@aws-sdk/client-elastic-beanstalk";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eb = () =>
  new ElasticBeanstalkClient({ endpoint, region, credentials, requestHandler });

test("Elastic Beanstalk application and environment lifecycle round-trip", async () => {
  const client = eb();
  const applicationName = "bunsai-e2e-app";
  const environmentName = "bunsai-e2e-env";

  const created = await client.send(
    new CreateApplicationCommand({
      ApplicationName: applicationName,
      Description: "bunsai e2e application",
    }),
  );
  expect(created.Application?.ApplicationName).toBe(applicationName);
  expect(created.Application?.Description).toBe("bunsai e2e application");
  expect(created.Application?.ApplicationArn).toContain(applicationName);

  const describedApps = await client.send(
    new DescribeApplicationsCommand({
      ApplicationNames: [applicationName],
    }),
  );
  expect(describedApps.Applications?.length).toBe(1);
  expect(describedApps.Applications?.[0]?.ApplicationName).toBe(
    applicationName,
  );

  const createdEnv = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );
  expect(createdEnv.EnvironmentName).toBe(environmentName);
  expect(createdEnv.ApplicationName).toBe(applicationName);
  expect(createdEnv.Status).toBe("Launching");
  expect(createdEnv.EnvironmentId).toBeDefined();

  const describedEnvs = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      EnvironmentNames: [environmentName],
    }),
  );
  expect(describedEnvs.Environments?.length).toBe(1);
  expect(describedEnvs.Environments?.[0]?.Status).toBe("Ready");

  const terminated = await client.send(
    new TerminateEnvironmentCommand({
      EnvironmentName: environmentName,
    }),
  );
  expect(terminated.Status).toBe("Terminated");

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );

  const afterDelete = await client.send(
    new DescribeApplicationsCommand({
      ApplicationNames: [applicationName],
    }),
  );
  expect(afterDelete.Applications?.length).toBe(0);
});

test("application version CRUD", async () => {
  const client = eb();
  const applicationName = "eb-e2e-version-app";
  const versionLabel = "v1.0.0";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const created = await client.send(
    new CreateApplicationVersionCommand({
      ApplicationName: applicationName,
      VersionLabel: versionLabel,
      Description: "initial version",
      SourceBundle: { S3Bucket: "my-bucket", S3Key: "app.zip" },
    }),
  );
  expect(created.ApplicationVersion?.VersionLabel).toBe(versionLabel);
  expect(created.ApplicationVersion?.ApplicationName).toBe(applicationName);
  expect(created.ApplicationVersion?.Status).toBe("Processing");

  const described = await client.send(
    new DescribeApplicationVersionsCommand({
      ApplicationName: applicationName,
      VersionLabels: [versionLabel],
    }),
  );
  expect(described.ApplicationVersions?.length).toBe(1);
  expect(described.ApplicationVersions?.[0]?.VersionLabel).toBe(versionLabel);

  const updated = await client.send(
    new UpdateApplicationVersionCommand({
      ApplicationName: applicationName,
      VersionLabel: versionLabel,
      Description: "updated version",
    }),
  );
  expect(updated.ApplicationVersion?.Description).toBe("updated version");

  await client.send(
    new DeleteApplicationVersionCommand({
      ApplicationName: applicationName,
      VersionLabel: versionLabel,
    }),
  );

  const afterDelete = await client.send(
    new DescribeApplicationVersionsCommand({
      ApplicationName: applicationName,
      VersionLabels: [versionLabel],
    }),
  );
  expect(afterDelete.ApplicationVersions?.length).toBe(0);

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("configuration template CRUD", async () => {
  const client = eb();
  const applicationName = "eb-e2e-template-app";
  const templateName = "my-template";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const created = await client.send(
    new CreateConfigurationTemplateCommand({
      ApplicationName: applicationName,
      TemplateName: templateName,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
      Description: "my config template",
    }),
  );
  expect(created.TemplateName).toBe(templateName);
  expect(created.ApplicationName).toBe(applicationName);

  const settings = await client.send(
    new DescribeConfigurationSettingsCommand({
      ApplicationName: applicationName,
      TemplateName: templateName,
    }),
  );
  expect(settings.ConfigurationSettings?.length).toBe(1);
  expect(settings.ConfigurationSettings?.[0]?.TemplateName).toBe(templateName);

  const updated = await client.send(
    new UpdateConfigurationTemplateCommand({
      ApplicationName: applicationName,
      TemplateName: templateName,
      Description: "updated template",
    }),
  );
  expect(updated.TemplateName).toBe(templateName);

  await client.send(
    new DeleteConfigurationTemplateCommand({
      ApplicationName: applicationName,
      TemplateName: templateName,
    }),
  );

  const afterDelete = await client.send(
    new DescribeConfigurationSettingsCommand({
      ApplicationName: applicationName,
      TemplateName: templateName,
    }),
  );
  expect(afterDelete.ConfigurationSettings?.length).toBe(0);

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("platform version lifecycle", async () => {
  const client = eb();

  const created = await client.send(
    new CreatePlatformVersionCommand({
      PlatformName: "my-platform",
      PlatformVersion: "1.0.0",
      PlatformDefinitionBundle: {
        S3Bucket: "my-bucket",
        S3Key: "platform.zip",
      },
    }),
  );
  expect(created.PlatformSummary?.PlatformVersion).toBe("1.0.0");
  expect(created.PlatformSummary?.PlatformStatus).toBe("Creating");

  const platformArn = created.PlatformSummary?.PlatformArn;
  expect(platformArn).toBeDefined();

  const described = await client.send(
    new DescribePlatformVersionCommand({ PlatformArn: platformArn }),
  );
  expect(described.PlatformDescription?.PlatformVersion).toBe("1.0.0");

  const deleted = await client.send(
    new DeletePlatformVersionCommand({ PlatformArn: platformArn }),
  );
  expect(deleted.PlatformSummary?.PlatformStatus).toBe("Deleted");
});

test("storage location creation", async () => {
  const client = eb();
  const result = await client.send(new CreateStorageLocationCommand({}));
  expect(result.S3Bucket).toContain("elasticbeanstalk");
});

test("DNS availability check", async () => {
  const client = eb();

  const available = await client.send(
    new CheckDNSAvailabilityCommand({ CNAMEPrefix: "my-unique-prefix-12345" }),
  );
  expect(available.Available).toBe(true);
  expect(available.FullyQualifiedCNAME).toContain("my-unique-prefix-12345");
});

test("account attributes", async () => {
  const client = eb();
  const result = await client.send(new DescribeAccountAttributesCommand({}));
  expect(result.ResourceQuotas?.ApplicationQuota?.Maximum).toBeGreaterThan(0);
  expect(result.ResourceQuotas?.EnvironmentQuota?.Maximum).toBeGreaterThan(0);
});

test("solution stacks listing", async () => {
  const client = eb();
  const result = await client.send(new ListAvailableSolutionStacksCommand({}));
  expect(result.SolutionStacks?.length).toBeGreaterThan(0);
  expect(result.SolutionStackDetails?.length).toBeGreaterThan(0);
});

test("platform versions and branches listing", async () => {
  const client = eb();

  const versions = await client.send(new ListPlatformVersionsCommand({}));
  expect(versions.PlatformSummaryList?.length).toBeGreaterThan(0);

  const branches = await client.send(new ListPlatformBranchesCommand({}));
  expect(branches.PlatformBranchSummaryList?.length).toBeGreaterThan(0);
});

test("tags management", async () => {
  const client = eb();
  const applicationName = "eb-e2e-tags-app";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const app = await client.send(
    new DescribeApplicationsCommand({ ApplicationNames: [applicationName] }),
  );
  const resourceArn = app.Applications?.[0]?.ApplicationArn!;

  await client.send(
    new UpdateTagsForResourceCommand({
      ResourceArn: resourceArn,
      TagsToAdd: [
        { Key: "env", Value: "production" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(tags.ResourceArn).toBe(resourceArn);
  const tagMap = Object.fromEntries(
    (tags.ResourceTags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("production");
  expect(tagMap["team"]).toBe("platform");

  await client.send(
    new UpdateTagsForResourceCommand({
      ResourceArn: resourceArn,
      TagsToRemove: ["team"],
    }),
  );

  const tagsAfterRemove = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  const tagMapAfter = Object.fromEntries(
    (tagsAfterRemove.ResourceTags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMapAfter["env"]).toBe("production");
  expect(tagMapAfter["team"]).toBeUndefined();

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("environment operations", async () => {
  const client = eb();
  const applicationName = "eb-e2e-envops-app";
  const environmentName = "eb-e2e-envops-env";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );
  const createdEnv = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );
  const environmentId = createdEnv.EnvironmentId!;

  await client.send(
    new AbortEnvironmentUpdateCommand({ EnvironmentName: environmentName }),
  );

  await client.send(
    new AssociateEnvironmentOperationsRoleCommand({
      EnvironmentName: environmentName,
      OperationsRole: "arn:aws:iam::123456789012:role/my-ops-role",
    }),
  );

  await client.send(
    new DisassociateEnvironmentOperationsRoleCommand({
      EnvironmentName: environmentName,
    }),
  );

  const health = await client.send(
    new DescribeEnvironmentHealthCommand({
      EnvironmentName: environmentName,
      AttributeNames: ["Status", "Color", "InstancesHealth"],
    }),
  );
  expect(health.EnvironmentName).toBe(environmentName);
  expect(health.Status).toBeDefined();

  const resources = await client.send(
    new DescribeEnvironmentResourcesCommand({ EnvironmentId: environmentId }),
  );
  expect(resources.EnvironmentResources?.EnvironmentName).toBe(environmentName);

  const managedActions = await client.send(
    new DescribeEnvironmentManagedActionsCommand({
      EnvironmentName: environmentName,
    }),
  );
  expect(managedActions.ManagedActions).toBeDefined();

  const managedActionHistory = await client.send(
    new DescribeEnvironmentManagedActionHistoryCommand({
      EnvironmentName: environmentName,
    }),
  );
  expect(managedActionHistory.ManagedActionHistoryItems).toBeDefined();

  const instancesHealth = await client.send(
    new DescribeInstancesHealthCommand({ EnvironmentName: environmentName }),
  );
  expect(instancesHealth.InstanceHealthList).toBeDefined();

  await client.send(
    new RebuildEnvironmentCommand({ EnvironmentName: environmentName }),
  );
  await client.send(
    new RequestEnvironmentInfoCommand({
      EnvironmentName: environmentName,
      InfoType: "tail",
    }),
  );
  await client.send(
    new RestartAppServerCommand({ EnvironmentName: environmentName }),
  );

  const envInfo = await client.send(
    new RetrieveEnvironmentInfoCommand({
      EnvironmentName: environmentName,
      InfoType: "tail",
    }),
  );
  expect(envInfo.EnvironmentInfo?.length).toBeGreaterThan(0);

  const updated = await client.send(
    new UpdateEnvironmentCommand({
      EnvironmentName: environmentName,
      Description: "updated description",
    }),
  );
  expect(updated.Description).toBe("updated description");

  const configOptions = await client.send(
    new DescribeConfigurationOptionsCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
    }),
  );
  expect(configOptions.Options).toBeDefined();

  const events = await client.send(
    new DescribeEventsCommand({ ApplicationName: applicationName }),
  );
  expect(events.Events).toBeDefined();

  const envConfigSettings = await client.send(
    new DescribeConfigurationSettingsCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
    }),
  );
  expect(envConfigSettings.ConfigurationSettings).toBeDefined();

  await client.send(
    new DeleteEnvironmentConfigurationCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
    }),
  );

  const validated = await client.send(
    new ValidateConfigurationSettingsCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      OptionSettings: [],
    }),
  );
  expect(validated.Messages).toBeDefined();

  await client.send(
    new TerminateEnvironmentCommand({ EnvironmentName: environmentName }),
  );

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("CNAME swap between environments", async () => {
  const client = eb();
  const applicationName = "eb-e2e-swap-app";
  const env1Name = "eb-swap-env-1";
  const env2Name = "eb-swap-env-2";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const env1 = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: env1Name,
      CNAMEPrefix: "eb-swap-prefix-1",
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );
  const env2 = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: env2Name,
      CNAMEPrefix: "eb-swap-prefix-2",
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );

  const originalCNAME1 = env1.CNAME;
  const originalCNAME2 = env2.CNAME;

  await client.send(
    new SwapEnvironmentCNAMEsCommand({
      SourceEnvironmentName: env1Name,
      DestinationEnvironmentName: env2Name,
    }),
  );

  const afterSwap = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      EnvironmentNames: [env1Name, env2Name],
    }),
  );

  const env1After = afterSwap.Environments?.find(
    (e) => e.EnvironmentName === env1Name,
  );
  const env2After = afterSwap.Environments?.find(
    (e) => e.EnvironmentName === env2Name,
  );

  expect(env1After?.CNAME).toBe(originalCNAME2);
  expect(env2After?.CNAME).toBe(originalCNAME1);

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("update application and resource lifecycle", async () => {
  const client = eb();
  const applicationName = "eb-e2e-update-app";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const updated = await client.send(
    new UpdateApplicationCommand({
      ApplicationName: applicationName,
      Description: "updated app description",
    }),
  );
  expect(updated.Application?.Description).toBe("updated app description");

  const lifecycle = await client.send(
    new UpdateApplicationResourceLifecycleCommand({
      ApplicationName: applicationName,
      ResourceLifecycleConfig: {
        ServiceRole: "arn:aws:iam::123456789012:role/my-role",
        VersionLifecycleConfig: {
          MaxCountRule: {
            Enabled: true,
            MaxCount: 10,
            DeleteSourceFromS3: false,
          },
        },
      },
    }),
  );
  expect(lifecycle.ApplicationName).toBe(applicationName);
  expect(lifecycle.ResourceLifecycleConfig?.ServiceRole).toBe(
    "arn:aws:iam::123456789012:role/my-role",
  );

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("compose environments", async () => {
  const client = eb();
  const applicationName = "eb-e2e-compose-app";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );
  await client.send(
    new CreateApplicationVersionCommand({
      ApplicationName: applicationName,
      VersionLabel: "v1",
      AutoCreateApplication: false,
    }),
  );
  await client.send(
    new CreateApplicationVersionCommand({
      ApplicationName: applicationName,
      VersionLabel: "v2",
      AutoCreateApplication: false,
    }),
  );

  const composed = await client.send(
    new ComposeEnvironmentsCommand({
      ApplicationName: applicationName,
      VersionLabels: ["v1", "v2"],
    }),
  );
  expect(composed.Environments?.length).toBe(2);

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("environment status lifecycle: Launching→Ready", async () => {
  const client = eb();
  const applicationName = "eb-e2e-lifecycle-app";
  const environmentName = "eb-e2e-lifecycle-env";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const created = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );
  expect(created.Status).toBe("Launching");

  const described = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      EnvironmentNames: [environmentName],
    }),
  );
  expect(described.Environments?.[0]?.Status).toBe("Ready");

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("application version status lifecycle: Processing→Processed", async () => {
  const client = eb();
  const applicationName = "eb-e2e-ver-lifecycle-app";
  const versionLabel = "v1.0.0-lifecycle";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  const created = await client.send(
    new CreateApplicationVersionCommand({
      ApplicationName: applicationName,
      VersionLabel: versionLabel,
    }),
  );
  expect(created.ApplicationVersion?.Status).toBe("Processing");

  const described = await client.send(
    new DescribeApplicationVersionsCommand({
      ApplicationName: applicationName,
      VersionLabels: [versionLabel],
    }),
  );
  expect(described.ApplicationVersions?.[0]?.Status).toBe("Processed");

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("platform version status lifecycle: Creating→Ready", async () => {
  const client = eb();

  const created = await client.send(
    new CreatePlatformVersionCommand({
      PlatformName: "my-platform-lifecycle",
      PlatformVersion: "2.0.0",
      PlatformDefinitionBundle: {
        S3Bucket: "my-bucket",
        S3Key: "platform.zip",
      },
    }),
  );
  expect(created.PlatformSummary?.PlatformStatus).toBe("Creating");

  const platformArn = created.PlatformSummary?.PlatformArn!;
  const described = await client.send(
    new DescribePlatformVersionCommand({ PlatformArn: platformArn }),
  );
  expect(described.PlatformDescription?.PlatformStatus).toBe("Ready");

  await client.send(
    new DeletePlatformVersionCommand({ PlatformArn: platformArn }),
  );
});

test("CreateEnvironment rejects unknown VersionLabel", async () => {
  const client = eb();
  const applicationName = "eb-e2e-ver-validate-app";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );

  await expect(
    client.send(
      new CreateEnvironmentCommand({
        ApplicationName: applicationName,
        EnvironmentName: "eb-e2e-ver-validate-env",
        VersionLabel: "nonexistent-version",
        SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("DescribePlatformVersion throws ResourceNotFoundException for unknown custom ARN", async () => {
  const client = eb();
  const customArn =
    "arn:aws:elasticbeanstalk:us-east-1:123456789012:platform/no-such-platform/9.9.9";

  await expect(
    client.send(new DescribePlatformVersionCommand({ PlatformArn: customArn })),
  ).rejects.toThrow();
});

test("pagination: DescribeEnvironments MaxRecords + NextToken", async () => {
  const client = eb();
  const applicationName = "eb-e2e-pagination-app";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );
  for (const name of ["env-a", "env-b", "env-c"]) {
    await client.send(
      new CreateEnvironmentCommand({
        ApplicationName: applicationName,
        EnvironmentName: name,
        SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
      }),
    );
  }

  const page1 = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      MaxRecords: 2,
    }),
  );
  expect(page1.Environments?.length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      MaxRecords: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.Environments?.length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});

test("apply environment managed action", async () => {
  const client = eb();
  const applicationName = "eb-e2e-managed-app";
  const environmentName = "eb-e2e-managed-env";

  await client.send(
    new CreateApplicationCommand({ ApplicationName: applicationName }),
  );
  await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );

  const result = await client.send(
    new ApplyEnvironmentManagedActionCommand({
      EnvironmentName: environmentName,
      ActionId: "action-001",
    }),
  );
  expect(result.ActionId).toBe("action-001");
  expect(result.Status).toBeDefined();

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );
});
