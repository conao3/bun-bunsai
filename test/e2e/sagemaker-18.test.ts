import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDomainCommand,
  CreateSpaceCommand,
  CreateTrialCommand,
  CreateWorkforceCommand,
  CreateWorkteamCommand,
  DescribeSpaceCommand,
  DescribeSubscribedWorkteamCommand,
  DescribeTrialCommand,
  DescribeWorkforceCommand,
  DescribeWorkteamCommand,
  DisableSagemakerServicecatalogPortfolioCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("CreateSpace → DescribeSpace lifecycle", async () => {
  const client = sagemaker();

  const domain = await client.send(
    new CreateDomainCommand({
      DomainName: "bunsai-e2e-domain-18",
      AuthMode: "IAM",
      DefaultUserSettings: {},
      SubnetIds: ["subnet-12345678"],
      VpcId: "vpc-12345678",
    }),
  );
  expect(domain.DomainId).toBeDefined();
  const domainId = domain.DomainId!;

  const created = await client.send(
    new CreateSpaceCommand({
      DomainId: domainId,
      SpaceName: "bunsai-e2e-space-18",
      SpaceDisplayName: "E2E Space 18",
    }),
  );
  expect(created.SpaceArn).toBeDefined();
  expect(created.SpaceArn).toContain("space/");

  const described = await client.send(
    new DescribeSpaceCommand({
      DomainId: domainId,
      SpaceName: "bunsai-e2e-space-18",
    }),
  );
  expect(described.DomainId).toBe(domainId);
  expect(described.SpaceName).toBe("bunsai-e2e-space-18");
  expect(described.SpaceArn).toBe(created.SpaceArn);
  expect(described.SpaceDisplayName).toBe("E2E Space 18");
  expect(described.Status).toBe("InService");
  expect(described.CreationTime).toBeDefined();
  expect(described.LastModifiedTime).toBeDefined();

  await expect(
    client.send(
      new DescribeSpaceCommand({
        DomainId: domainId,
        SpaceName: "bunsai-e2e-space-18-nope",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateTrial → DescribeTrial lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateTrialCommand({
      TrialName: "bunsai-e2e-trial-18",
      ExperimentName: "bunsai-e2e-experiment-18",
    }),
  );
  expect(created.TrialArn).toBeDefined();

  const described = await client.send(
    new DescribeTrialCommand({ TrialName: "bunsai-e2e-trial-18" }),
  );
  expect(described.TrialName).toBe("bunsai-e2e-trial-18");
  expect(described.TrialArn).toBe(created.TrialArn);
  expect(described.ExperimentName).toBe("bunsai-e2e-experiment-18");
  expect(described.CreationTime).toBeDefined();

  await expect(
    client.send(new DescribeTrialCommand({ TrialName: "no-such-trial" })),
  ).rejects.toThrow();
});

test("CreateWorkforce → DescribeWorkforce lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateWorkforceCommand({ WorkforceName: "bunsai-e2e-workforce-18" }),
  );
  expect(created.WorkforceArn).toBeDefined();

  const described = await client.send(
    new DescribeWorkforceCommand({ WorkforceName: "bunsai-e2e-workforce-18" }),
  );
  expect(described.Workforce).toBeDefined();
  expect(described.Workforce!.WorkforceName).toBe("bunsai-e2e-workforce-18");
  expect(described.Workforce!.WorkforceArn).toBe(created.WorkforceArn);
});

test("CreateWorkteam → DescribeWorkteam lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateWorkteamCommand({
      WorkteamName: "bunsai-e2e-workteam-18",
      Description: "E2E Workteam 18",
      MemberDefinitions: [],
    }),
  );
  expect(created.WorkteamArn).toBeDefined();

  const described = await client.send(
    new DescribeWorkteamCommand({ WorkteamName: "bunsai-e2e-workteam-18" }),
  );
  expect(described.Workteam).toBeDefined();
  expect(described.Workteam!.WorkteamName).toBe("bunsai-e2e-workteam-18");
  expect(described.Workteam!.WorkteamArn).toBe(created.WorkteamArn);
  expect(described.Workteam!.Description).toBe("E2E Workteam 18");
});

test("DescribeSubscribedWorkteam returns synthetic workteam", async () => {
  const client = sagemaker();
  const arn =
    "arn:aws:sagemaker:us-east-1:123456789012:workteam/public-crowd/test-workteam";
  const described = await client.send(
    new DescribeSubscribedWorkteamCommand({ WorkteamArn: arn }),
  );
  expect(described.SubscribedWorkteam).toBeDefined();
  expect(described.SubscribedWorkteam!.WorkteamArn).toBe(arn);
});

test("DisableSagemakerServicecatalogPortfolio succeeds", async () => {
  const client = sagemaker();
  const result = await client.send(
    new DisableSagemakerServicecatalogPortfolioCommand({}),
  );
  expect(result.$metadata.httpStatusCode).toBe(200);
});
