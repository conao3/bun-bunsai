import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDomainCommand,
  CreateExperimentCommand,
  CreatePipelineCommand,
  CreateProjectCommand,
  CreateSpaceCommand,
  CreateTrialCommand,
  CreateUserProfileCommand,
  CreateWorkforceCommand,
  CreateWorkteamCommand,
  DescribePipelineCommand,
  DescribeProjectCommand,
  DescribeSpaceCommand,
  DescribeTrialCommand,
  DescribeUserProfileCommand,
  DescribeWorkforceCommand,
  DescribeWorkteamCommand,
  SageMakerClient,
  UpdatePipelineCommand,
  UpdateProjectCommand,
  UpdateSpaceCommand,
  UpdateTrialCommand,
  UpdateUserProfileCommand,
  UpdateWorkforceCommand,
  UpdateWorkteamCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("UpdateProject → DescribeProject reflects update", async () => {
  const client = sagemaker();
  const name = `proj-chunk30-${Date.now()}`;

  const created = await client.send(
    new CreateProjectCommand({
      ProjectName: name,
      ProjectDescription: "original description",
      ServiceCatalogProvisioningDetails: {
        ProductId: "prod-original",
      },
    }),
  );
  expect(created.ProjectArn).toContain("project");

  const updated = await client.send(
    new UpdateProjectCommand({
      ProjectName: name,
      ProjectDescription: "updated description",
    }),
  );
  expect(updated.ProjectArn).toContain("project");

  const described = await client.send(
    new DescribeProjectCommand({ ProjectName: name }),
  );
  expect(described.ProjectName).toBe(name);
  expect(described.ProjectDescription).toBe("updated description");
});

test("UpdateTrial → DescribeTrial reflects update", async () => {
  const client = sagemaker();
  const expName = `exp-chunk30-${Date.now()}`;
  const trialName = `trial-chunk30-${Date.now()}`;

  await client.send(new CreateExperimentCommand({ ExperimentName: expName }));

  const created = await client.send(
    new CreateTrialCommand({
      TrialName: trialName,
      ExperimentName: expName,
      DisplayName: "original-display",
    }),
  );
  expect(created.TrialArn).toContain("experiment-trial");

  const updated = await client.send(
    new UpdateTrialCommand({
      TrialName: trialName,
      DisplayName: "updated-display",
    }),
  );
  expect(updated.TrialArn).toContain("experiment-trial");

  const described = await client.send(
    new DescribeTrialCommand({ TrialName: trialName }),
  );
  expect(described.TrialName).toBe(trialName);
  expect(described.DisplayName).toBe("updated-display");
  expect(described.ExperimentName).toBe(expName);
});

test("UpdatePipeline → DescribePipeline reflects update", async () => {
  const client = sagemaker();
  const name = `pipe-chunk30-${Date.now()}`;

  const created = await client.send(
    new CreatePipelineCommand({
      PipelineName: name,
      PipelineDefinition: '{"Version":"2020-12-01","Steps":[]}',
      RoleArn: "arn:aws:iam::123456789012:role/original-role",
    }),
  );
  expect(created.PipelineArn).toContain("pipeline");

  const updated = await client.send(
    new UpdatePipelineCommand({
      PipelineName: name,
      PipelineDescription: "updated-desc",
      RoleArn: "arn:aws:iam::123456789012:role/updated-role",
    }),
  );
  expect(updated.PipelineArn).toContain("pipeline");

  const described = await client.send(
    new DescribePipelineCommand({ PipelineName: name }),
  );
  expect(described.PipelineName).toBe(name);
  expect(described.PipelineDescription).toBe("updated-desc");
  expect(described.RoleArn).toBe("arn:aws:iam::123456789012:role/updated-role");
});

test("UpdateSpace → DescribeSpace reflects update", async () => {
  const client = sagemaker();
  const spaceName = `space-chunk30-${Date.now()}`;

  const domain = await client.send(
    new CreateDomainCommand({
      DomainName: `domain-chunk30-${Date.now()}`,
      AuthMode: "IAM",
      DefaultUserSettings: {},
    }),
  );
  const domainId = domain.DomainId!;

  const created = await client.send(
    new CreateSpaceCommand({
      DomainId: domainId,
      SpaceName: spaceName,
      SpaceDisplayName: "original-display",
    }),
  );
  expect(created.SpaceArn).toContain("space");

  const updated = await client.send(
    new UpdateSpaceCommand({
      DomainId: domainId,
      SpaceName: spaceName,
      SpaceDisplayName: "updated-display",
    }),
  );
  expect(updated.SpaceArn).toContain("space");

  const described = await client.send(
    new DescribeSpaceCommand({ DomainId: domainId, SpaceName: spaceName }),
  );
  expect(described.SpaceName).toBe(spaceName);
  expect(described.SpaceDisplayName).toBe("updated-display");
});

test("UpdateUserProfile → DescribeUserProfile reflects update", async () => {
  const client = sagemaker();
  const userName = `user-chunk30-${Date.now()}`;

  const domain = await client.send(
    new CreateDomainCommand({
      DomainName: `domain-up-chunk30-${Date.now()}`,
      AuthMode: "IAM",
      DefaultUserSettings: {},
    }),
  );
  const domainId = domain.DomainId!;

  await client.send(
    new CreateUserProfileCommand({
      DomainId: domainId,
      UserProfileName: userName,
      UserSettings: {
        ExecutionRole: "arn:aws:iam::123456789012:role/original",
      },
    }),
  );

  const updated = await client.send(
    new UpdateUserProfileCommand({
      DomainId: domainId,
      UserProfileName: userName,
      UserSettings: { ExecutionRole: "arn:aws:iam::123456789012:role/updated" },
    }),
  );
  expect(updated.UserProfileArn).toContain("user-profile");

  const described = await client.send(
    new DescribeUserProfileCommand({
      DomainId: domainId,
      UserProfileName: userName,
    }),
  );
  expect(described.UserProfileName).toBe(userName);
  const settings = described.UserSettings as
    | { ExecutionRole?: string }
    | undefined;
  expect(settings?.ExecutionRole).toBe(
    "arn:aws:iam::123456789012:role/updated",
  );
});

test("UpdateWorkteam → DescribeWorkteam reflects update", async () => {
  const client = sagemaker();
  const wfName = `wf-chunk30-${Date.now()}`;
  const wtName = `wt-chunk30-${Date.now()}`;

  await client.send(
    new CreateWorkforceCommand({
      WorkforceName: wfName,
      CognitoConfig: {
        UserPool: "us-east-1_test",
        ClientId: "test-client-id",
      },
    }),
  );

  await client.send(
    new CreateWorkteamCommand({
      WorkteamName: wtName,
      Description: "original description",
      MemberDefinitions: [
        {
          CognitoMemberDefinition: {
            UserPool: "us-east-1_test",
            UserGroup: "group1",
            ClientId: "test-client-id",
          },
        },
      ],
    }),
  );

  const updated = await client.send(
    new UpdateWorkteamCommand({
      WorkteamName: wtName,
      Description: "updated description",
    }),
  );
  const updatedTeam = updated.Workteam as
    | { WorkteamName?: string; Description?: string }
    | undefined;
  expect(updatedTeam?.WorkteamName).toBe(wtName);
  expect(updatedTeam?.Description).toBe("updated description");

  const described = await client.send(
    new DescribeWorkteamCommand({ WorkteamName: wtName }),
  );
  const team = described.Workteam as { Description?: string } | undefined;
  expect(team?.Description).toBe("updated description");
});

test("UpdateWorkforce reflects update", async () => {
  const client = sagemaker();
  const name = `wforce-chunk30-${Date.now()}`;

  await client.send(
    new CreateWorkforceCommand({
      WorkforceName: name,
      CognitoConfig: {
        UserPool: "us-east-1_test",
        ClientId: "test-client-id",
      },
    }),
  );

  const updated = await client.send(
    new UpdateWorkforceCommand({
      WorkforceName: name,
      SourceIpConfig: { Cidrs: ["10.0.0.0/8"] },
    }),
  );
  const workforce = updated.Workforce as
    | { WorkforceName?: string; SourceIpConfig?: { Cidrs?: string[] } }
    | undefined;
  expect(workforce?.WorkforceName).toBe(name);
  expect(workforce?.SourceIpConfig?.Cidrs).toContain("10.0.0.0/8");

  const described = await client.send(
    new DescribeWorkforceCommand({ WorkforceName: name }),
  );
  const wf = described.Workforce as
    | { SourceIpConfig?: { Cidrs?: string[] } }
    | undefined;
  expect(wf?.SourceIpConfig?.Cidrs).toContain("10.0.0.0/8");
});

test("UpdateProject → ResourceNotFound for missing project", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new UpdateProjectCommand({
        ProjectName: "no-such-project-chunk30",
        ProjectDescription: "test",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});

test("UpdateTrial → ResourceNotFound for missing trial", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new UpdateTrialCommand({
        TrialName: "no-such-trial-chunk30",
        DisplayName: "test",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});
