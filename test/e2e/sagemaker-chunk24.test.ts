import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDomainCommand,
  CreateModelPackageGroupCommand,
  CreateUserProfileCommand,
  CreateWorkforceCommand,
  CreateWorkteamCommand,
  GetModelPackageGroupPolicyCommand,
  ListUserProfilesCommand,
  ListWorkforcesCommand,
  ListWorkteamsCommand,
  PutModelPackageGroupPolicyCommand,
  RegisterDevicesCommand,
  RenderUiTemplateCommand,
  SageMakerClient,
  SearchCommand,
  SearchTrainingPlanOfferingsCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("CreateDomain + CreateUserProfile → ListUserProfiles includes it", async () => {
  const client = sagemaker();
  const domainRes = await client.send(
    new CreateDomainCommand({
      DomainName: `domain-chunk24-${Date.now()}`,
      AuthMode: "IAM",
      DefaultUserSettings: {},
    }),
  );
  const domainId = domainRes.DomainId!;
  const profileName = `user-chunk24-${Date.now()}`;
  await client.send(
    new CreateUserProfileCommand({
      DomainId: domainId,
      UserProfileName: profileName,
    }),
  );
  const res = await client.send(new ListUserProfilesCommand({}));
  expect(Array.isArray(res.UserProfiles)).toBe(true);
  const found = res.UserProfiles!.find(
    (p) => p.UserProfileName === profileName,
  );
  expect(found).toBeDefined();
  expect(found!.DomainId).toBe(domainId);
  expect(found!.Status).toBeTruthy();
});

test("ListUserProfiles DomainIdEquals filter", async () => {
  const client = sagemaker();
  const domainRes = await client.send(
    new CreateDomainCommand({
      DomainName: `domain-filter-chunk24-${Date.now()}`,
      AuthMode: "IAM",
      DefaultUserSettings: {},
    }),
  );
  const domainId = domainRes.DomainId!;
  const profileName = `user-filter-chunk24-${Date.now()}`;
  await client.send(
    new CreateUserProfileCommand({
      DomainId: domainId,
      UserProfileName: profileName,
    }),
  );
  const res = await client.send(
    new ListUserProfilesCommand({ DomainIdEquals: domainId }),
  );
  expect(res.UserProfiles!.every((p) => p.DomainId === domainId)).toBe(true);
});

test("CreateWorkforce → ListWorkforces includes it", async () => {
  const client = sagemaker();
  const name = `wf-chunk24-${Date.now()}`;
  await client.send(
    new CreateWorkforceCommand({
      WorkforceName: name,
      CognitoConfig: {
        UserPool: "us-east-1_pool",
        ClientId: "client123",
      },
    }),
  );
  const res = await client.send(new ListWorkforcesCommand({}));
  expect(Array.isArray(res.Workforces)).toBe(true);
  const found = res.Workforces!.find((w) => w.WorkforceName === name);
  expect(found).toBeDefined();
  expect(found!.WorkforceArn).toBeTruthy();
});

test("CreateWorkteam → ListWorkteams includes it", async () => {
  const client = sagemaker();
  const name = `wt-chunk24-${Date.now()}`;
  await client.send(
    new CreateWorkteamCommand({
      WorkteamName: name,
      Description: "test workteam",
      MemberDefinitions: [
        {
          CognitoMemberDefinition: {
            UserPool: "us-east-1_pool",
            UserGroup: "group1",
            ClientId: "client123",
          },
        },
      ],
    }),
  );
  const res = await client.send(new ListWorkteamsCommand({}));
  expect(Array.isArray(res.Workteams)).toBe(true);
  const found = res.Workteams!.find((w) => w.WorkteamName === name);
  expect(found).toBeDefined();
  expect(found!.WorkteamArn).toBeTruthy();
  expect(found!.Description).toBe("test workteam");
});

test("PutModelPackageGroupPolicy → GetModelPackageGroupPolicy round-trip", async () => {
  const client = sagemaker();
  const groupName = `pkg-group-chunk24-${Date.now()}`;
  await client.send(
    new CreateModelPackageGroupCommand({
      ModelPackageGroupName: groupName,
    }),
  );
  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });
  const putRes = await client.send(
    new PutModelPackageGroupPolicyCommand({
      ModelPackageGroupName: groupName,
      ResourcePolicy: policy,
    }),
  );
  expect(putRes.ModelPackageGroupArn).toBeTruthy();
  const getRes = await client.send(
    new GetModelPackageGroupPolicyCommand({
      ModelPackageGroupName: groupName,
    }),
  );
  expect(getRes.ResourcePolicy).toBe(policy);
});

test("RegisterDevices → ListDevices includes registered device", async () => {
  const client = sagemaker();
  const fleetName = `fleet-chunk24-${Date.now()}`;
  const deviceName = `device-chunk24-${Date.now()}`;
  await client.send(
    new RegisterDevicesCommand({
      DeviceFleetName: fleetName,
      Devices: [{ DeviceName: deviceName, Description: "test device" }],
    }),
  );
  const { ListDevicesCommand } = await import("@aws-sdk/client-sagemaker");
  const res = await client.send(
    new ListDevicesCommand({ DeviceFleetName: fleetName }),
  );
  expect(Array.isArray(res.DeviceSummaries)).toBe(true);
  const found = res.DeviceSummaries!.find((d) => d.DeviceName === deviceName);
  expect(found).toBeDefined();
  expect(found!.DeviceFleetName).toBe(fleetName);
});

test("RenderUiTemplate returns rendered content and empty errors", async () => {
  const client = sagemaker();
  const res = await client.send(
    new RenderUiTemplateCommand({
      Task: { Input: '{"source": "s3://bucket/image.jpg"}' },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      UiTemplate: {
        Content: "<html><body>{{task.input.source}}</body></html>",
      },
    }),
  );
  expect(res.RenderedContent).toBeTruthy();
  expect(Array.isArray(res.Errors)).toBe(true);
});

test("Search returns results for known resource types", async () => {
  const client = sagemaker();
  const res = await client.send(new SearchCommand({ Resource: "Experiment" }));
  expect(Array.isArray(res.Results)).toBe(true);
  expect(res.TotalHits).toBeDefined();
});

test("SearchTrainingPlanOfferings returns empty offerings", async () => {
  const client = sagemaker();
  const res = await client.send(
    new SearchTrainingPlanOfferingsCommand({
      TargetResources: ["training-job"],
    }),
  );
  expect(Array.isArray(res.TrainingPlanOfferings)).toBe(true);
});
