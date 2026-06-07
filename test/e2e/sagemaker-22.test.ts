import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateExperimentCommand,
  CreateFeatureGroupCommand,
  CreateHubCommand,
  CreateImageCommand,
  CreateImageVersionCommand,
  CreateInferenceComponentCommand,
  CreateInferenceExperimentCommand,
  ListExperimentsCommand,
  ListFeatureGroupsCommand,
  ListHubContentsCommand,
  ListHubsCommand,
  ListImageVersionsCommand,
  ListImagesCommand,
  ListInferenceComponentsCommand,
  ListInferenceExperimentsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("ListExperiments empty then CreateExperiment → listed", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListExperimentsCommand({}));
  expect(empty.ExperimentSummaries).toBeDefined();

  await client.send(
    new CreateExperimentCommand({ ExperimentName: "bunsai-e2e-exp-22" }),
  );

  const listed = await client.send(new ListExperimentsCommand({}));
  const found = listed.ExperimentSummaries!.find(
    (e) => e.ExperimentName === "bunsai-e2e-exp-22",
  );
  expect(found).toBeDefined();
  expect(found!.ExperimentArn).toContain("experiment/bunsai-e2e-exp-22");
});

test("ListImages empty then CreateImage → listed", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListImagesCommand({}));
  expect(empty.Images).toBeDefined();

  await client.send(
    new CreateImageCommand({
      ImageName: "bunsai-e2e-img-22",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
    }),
  );

  const listed = await client.send(new ListImagesCommand({}));
  const found = listed.Images!.find((i) => i.ImageName === "bunsai-e2e-img-22");
  expect(found).toBeDefined();
  expect(found!.ImageArn).toContain("image/bunsai-e2e-img-22");
});

test("CreateImageVersion → ListImageVersions includes it", async () => {
  const client = sagemaker();

  await client.send(
    new CreateImageCommand({
      ImageName: "bunsai-e2e-imgv-22",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
    }),
  );

  await client.send(
    new CreateImageVersionCommand({
      ImageName: "bunsai-e2e-imgv-22",
      BaseImage:
        "763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:2.0",
    }),
  );

  const listed = await client.send(
    new ListImageVersionsCommand({ ImageName: "bunsai-e2e-imgv-22" }),
  );
  expect(listed.ImageVersions).toBeDefined();
  expect(listed.ImageVersions!.length).toBeGreaterThan(0);
  expect(listed.ImageVersions![0].ImageVersionArn).toBeDefined();
});

test("CreateFeatureGroup → ListFeatureGroups includes it", async () => {
  const client = sagemaker();

  await client.send(
    new CreateFeatureGroupCommand({
      FeatureGroupName: "bunsai-e2e-fg-22",
      RecordIdentifierFeatureName: "record-id",
      EventTimeFeatureName: "event-time",
      FeatureDefinitions: [
        { FeatureName: "record-id", FeatureType: "Integral" },
        { FeatureName: "event-time", FeatureType: "Fractional" },
      ],
    }),
  );

  const listed = await client.send(new ListFeatureGroupsCommand({}));
  const found = listed.FeatureGroupSummaries!.find(
    (g) => g.FeatureGroupName === "bunsai-e2e-fg-22",
  );
  expect(found).toBeDefined();
  expect(found!.FeatureGroupArn).toContain("feature-group/bunsai-e2e-fg-22");
});

test("CreateHub → ListHubs includes it; ListHubContents returns empty", async () => {
  const client = sagemaker();

  await client.send(
    new CreateHubCommand({
      HubName: "bunsai-e2e-hub-22",
      HubDescription: "e2e test hub chunk 22",
    }),
  );

  const listed = await client.send(new ListHubsCommand({}));
  const found = listed.HubSummaries!.find(
    (h) => h.HubName === "bunsai-e2e-hub-22",
  );
  expect(found).toBeDefined();
  expect(found!.HubArn).toContain("hub/bunsai-e2e-hub-22");

  const contents = await client.send(
    new ListHubContentsCommand({
      HubName: "bunsai-e2e-hub-22",
      HubContentType: "Model",
    }),
  );
  expect(contents.HubContentSummaries).toBeDefined();
});

test("CreateInferenceComponent → ListInferenceComponents includes it", async () => {
  const client = sagemaker();

  await client.send(
    new CreateInferenceComponentCommand({
      InferenceComponentName: "bunsai-e2e-ic-22",
      EndpointName: "bunsai-e2e-ep-22",
      Specification: {
        ComputeResourceRequirements: { MinMemoryRequiredInMb: 512 },
      },
    }),
  );

  const listed = await client.send(new ListInferenceComponentsCommand({}));
  const found = listed.InferenceComponents!.find(
    (c) => c.InferenceComponentName === "bunsai-e2e-ic-22",
  );
  expect(found).toBeDefined();
  expect(found!.InferenceComponentArn).toContain(
    "inference-component/bunsai-e2e-ic-22",
  );
});

test("CreateInferenceExperiment → ListInferenceExperiments includes it", async () => {
  const client = sagemaker();

  await client.send(
    new CreateInferenceExperimentCommand({
      Name: "bunsai-e2e-iexp-22",
      Type: "ShadowMode",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
      EndpointName: "bunsai-e2e-ep-22",
      ModelVariants: [
        {
          ModelName: "bunsai-model",
          VariantName: "control",
          InfrastructureConfig: {
            InfrastructureType: "RealTimeInference",
            RealTimeInferenceConfig: {
              InstanceType: "ml.m5.large",
              InstanceCount: 1,
            },
          },
        },
      ],
      ShadowModeConfig: {
        SourceModelVariantName: "control",
        ShadowModelVariants: [],
      },
    }),
  );

  const listed = await client.send(new ListInferenceExperimentsCommand({}));
  const found = listed.InferenceExperiments!.find(
    (e) => e.Name === "bunsai-e2e-iexp-22",
  );
  expect(found).toBeDefined();
  expect(found!.Type).toBe("ShadowMode");
});
