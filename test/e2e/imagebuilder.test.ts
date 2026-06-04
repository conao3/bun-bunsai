import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CancelImageCreationCommand,
  CancelLifecycleExecutionCommand,
  CreateComponentCommand,
  CreateContainerRecipeCommand,
  CreateDistributionConfigurationCommand,
  CreateImageCommand,
  CreateImagePipelineCommand,
  CreateImageRecipeCommand,
  CreateInfrastructureConfigurationCommand,
  CreateLifecyclePolicyCommand,
  DeleteComponentCommand,
  DeleteDistributionConfigurationCommand,
  DeleteImageCommand,
  DeleteImagePipelineCommand,
  DeleteImageRecipeCommand,
  DeleteInfrastructureConfigurationCommand,
  DeleteLifecyclePolicyCommand,
  GetComponentCommand,
  GetComponentPolicyCommand,
  GetContainerRecipeCommand,
  GetDistributionConfigurationCommand,
  GetImageCommand,
  GetImagePipelineCommand,
  GetImageRecipeCommand,
  GetInfrastructureConfigurationCommand,
  GetLifecycleExecutionCommand,
  GetLifecyclePolicyCommand,
  ImagebuilderClient,
  ListComponentBuildVersionsCommand,
  ListComponentsCommand,
  ListContainerRecipesCommand,
  ListDistributionConfigurationsCommand,
  ListImageBuildVersionsCommand,
  ListImagePackagesCommand,
  ListImagePipelineImagesCommand,
  ListImagePipelinesCommand,
  ListImageRecipesCommand,
  ListImagesCommand,
  ListInfrastructureConfigurationsCommand,
  ListLifecycleExecutionsCommand,
  ListLifecyclePoliciesCommand,
  ListTagsForResourceCommand,
  PutComponentPolicyCommand,
  PutImagePolicyCommand,
  PutImageRecipePolicyCommand,
  RetryImageCommand,
  StartImagePipelineExecutionCommand,
  StartResourceStateUpdateCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDistributionConfigurationCommand,
  UpdateImagePipelineCommand,
  UpdateInfrastructureConfigurationCommand,
  UpdateLifecyclePolicyCommand,
} from "@aws-sdk/client-imagebuilder";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const imagebuilder = () =>
  new ImagebuilderClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Imagebuilder image pipeline roundtrip", async () => {
  const client = imagebuilder();
  const name = `bunsai-e2e-${Date.now()}`;
  const imageRecipeArn = `arn:aws:imagebuilder:${region}:000000000000:image-recipe/${name}/1.0.0`;
  const infrastructureConfigurationArn = `arn:aws:imagebuilder:${region}:000000000000:infrastructure-configuration/${name}`;

  const created = await client.send(
    new CreateImagePipelineCommand({
      name,
      imageRecipeArn,
      infrastructureConfigurationArn,
    }),
  );
  expect(created.imagePipelineArn).toBeDefined();
  expect(created.imagePipelineArn).toContain(`image-pipeline/${name}`);
  const arn = created.imagePipelineArn ?? "";

  const got = await client.send(
    new GetImagePipelineCommand({ imagePipelineArn: arn }),
  );
  expect(got.imagePipeline?.arn).toBe(arn);
  expect(got.imagePipeline?.name).toBe(name);
  expect(got.imagePipeline?.imageRecipeArn).toBe(imageRecipeArn);
  expect(got.imagePipeline?.infrastructureConfigurationArn).toBe(
    infrastructureConfigurationArn,
  );
  expect(got.imagePipeline?.status).toBe("ENABLED");

  const listed = await client.send(new ListImagePipelinesCommand({}));
  expect((listed.imagePipelineList ?? []).map((p) => p.arn)).toContain(arn);

  const deleted = await client.send(
    new DeleteImagePipelineCommand({ imagePipelineArn: arn }),
  );
  expect(deleted.imagePipelineArn).toBe(arn);

  await expect(
    client.send(new GetImagePipelineCommand({ imagePipelineArn: arn })),
  ).rejects.toThrow();
});

test("Imagebuilder component + policy lifecycle", async () => {
  const client = imagebuilder();
  const name = `comp-${Date.now()}`;
  const version = "1.0.0";

  const created = await client.send(
    new CreateComponentCommand({
      name,
      semanticVersion: version,
      platform: "Linux",
      data: "schemaVersion: 1.0\nphases:\n  - name: build\n    steps: []",
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.componentBuildVersionArn).toContain(`component/${name}`);
  const arn = created.componentBuildVersionArn ?? "";

  const got = await client.send(
    new GetComponentCommand({ componentBuildVersionArn: arn }),
  );
  expect(got.component?.arn).toBe(arn);
  expect(got.component?.name).toBe(name);
  expect(got.component?.platform).toBe("Linux");

  const versionArn = arn.split("/").slice(0, -1).join("/");
  const buildVersions = await client.send(
    new ListComponentBuildVersionsCommand({ componentVersionArn: versionArn }),
  );
  expect(
    (buildVersions.componentSummaryList ?? []).map((c) => c.arn),
  ).toContain(arn);

  const listed = await client.send(new ListComponentsCommand({}));
  expect(listed.componentVersionList?.length).toBeGreaterThan(0);

  const policy = JSON.stringify({ Statement: [{ Effect: "Allow" }] });
  await client.send(
    new PutComponentPolicyCommand({ componentArn: arn, policy }),
  );
  const gotPolicy = await client.send(
    new GetComponentPolicyCommand({ componentArn: arn }),
  );
  expect(gotPolicy.policy).toBe(policy);

  await client.send(
    new DeleteComponentCommand({ componentBuildVersionArn: arn }),
  );
  await expect(
    client.send(new GetComponentCommand({ componentBuildVersionArn: arn })),
  ).rejects.toThrow();
});

test("Imagebuilder image recipe + policy lifecycle", async () => {
  const client = imagebuilder();
  const name = `img-recipe-${Date.now()}`;

  const created = await client.send(
    new CreateImageRecipeCommand({
      name,
      semanticVersion: "1.0.0",
      parentImage: "ami-0abcdef1234567890",
      components: [],
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.imageRecipeArn).toContain(`image-recipe/${name}`);
  const arn = created.imageRecipeArn ?? "";

  const got = await client.send(
    new GetImageRecipeCommand({ imageRecipeArn: arn }),
  );
  expect(got.imageRecipe?.arn).toBe(arn);
  expect(got.imageRecipe?.name).toBe(name);
  expect(got.imageRecipe?.parentImage).toBe("ami-0abcdef1234567890");

  const listed = await client.send(new ListImageRecipesCommand({}));
  expect((listed.imageRecipeSummaryList ?? []).map((r) => r.arn)).toContain(
    arn,
  );

  const policy = JSON.stringify({ Statement: [] });
  await client.send(
    new PutImageRecipePolicyCommand({ imageRecipeArn: arn, policy }),
  );

  await client.send(new DeleteImageRecipeCommand({ imageRecipeArn: arn }));
  await expect(
    client.send(new GetImageRecipeCommand({ imageRecipeArn: arn })),
  ).rejects.toThrow();
});

test("Imagebuilder container recipe lifecycle", async () => {
  const client = imagebuilder();
  const name = `container-recipe-${Date.now()}`;

  const created = await client.send(
    new CreateContainerRecipeCommand({
      name,
      semanticVersion: "1.0.0",
      containerType: "DOCKER",
      parentImage:
        "arn:aws:imagebuilder:us-east-1:aws:image/ubuntu-server-20-lts-x86/x.x.x",
      targetRepository: { service: "ECR", repositoryName: "my-repo" },
      components: [],
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.containerRecipeArn).toContain(`container-recipe/${name}`);
  const arn = created.containerRecipeArn ?? "";

  const got = await client.send(
    new GetContainerRecipeCommand({ containerRecipeArn: arn }),
  );
  expect(got.containerRecipe?.arn).toBe(arn);
  expect(got.containerRecipe?.containerType).toBe("DOCKER");

  const listed = await client.send(new ListContainerRecipesCommand({}));
  expect((listed.containerRecipeSummaryList ?? []).map((r) => r.arn)).toContain(
    arn,
  );
});

test("Imagebuilder distribution configuration create/update lifecycle", async () => {
  const client = imagebuilder();
  const name = `dist-config-${Date.now()}`;

  const created = await client.send(
    new CreateDistributionConfigurationCommand({
      name,
      distributions: [
        { region: "us-east-1", amiDistributionConfiguration: {} },
      ],
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.distributionConfigurationArn).toContain(
    `distribution-configuration/${name}`,
  );
  const arn = created.distributionConfigurationArn ?? "";

  const got = await client.send(
    new GetDistributionConfigurationCommand({
      distributionConfigurationArn: arn,
    }),
  );
  expect(got.distributionConfiguration?.arn).toBe(arn);
  expect(got.distributionConfiguration?.name).toBe(name);

  await client.send(
    new UpdateDistributionConfigurationCommand({
      distributionConfigurationArn: arn,
      distributions: [
        { region: "us-east-1", amiDistributionConfiguration: {} },
        { region: "us-west-2", amiDistributionConfiguration: {} },
      ],
      clientToken: crypto.randomUUID(),
    }),
  );

  const listed = await client.send(
    new ListDistributionConfigurationsCommand({}),
  );
  expect(
    (listed.distributionConfigurationSummaryList ?? []).map((d) => d.arn),
  ).toContain(arn);

  await client.send(
    new DeleteDistributionConfigurationCommand({
      distributionConfigurationArn: arn,
    }),
  );
  await expect(
    client.send(
      new GetDistributionConfigurationCommand({
        distributionConfigurationArn: arn,
      }),
    ),
  ).rejects.toThrow();
});

test("Imagebuilder infrastructure configuration create/update lifecycle", async () => {
  const client = imagebuilder();
  const name = `infra-config-${Date.now()}`;

  const created = await client.send(
    new CreateInfrastructureConfigurationCommand({
      name,
      instanceProfileName: "EC2InstanceProfileForImageBuilder",
      instanceTypes: ["t2.micro"],
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.infrastructureConfigurationArn).toContain(
    `infrastructure-configuration/${name}`,
  );
  const arn = created.infrastructureConfigurationArn ?? "";

  const got = await client.send(
    new GetInfrastructureConfigurationCommand({
      infrastructureConfigurationArn: arn,
    }),
  );
  expect(got.infrastructureConfiguration?.arn).toBe(arn);
  expect(got.infrastructureConfiguration?.name).toBe(name);
  expect(got.infrastructureConfiguration?.instanceProfileName).toBe(
    "EC2InstanceProfileForImageBuilder",
  );

  await client.send(
    new UpdateInfrastructureConfigurationCommand({
      infrastructureConfigurationArn: arn,
      instanceProfileName: "UpdatedProfile",
      clientToken: crypto.randomUUID(),
    }),
  );

  const updated = await client.send(
    new GetInfrastructureConfigurationCommand({
      infrastructureConfigurationArn: arn,
    }),
  );
  expect(updated.infrastructureConfiguration?.instanceProfileName).toBe(
    "UpdatedProfile",
  );

  const listed = await client.send(
    new ListInfrastructureConfigurationsCommand({}),
  );
  expect(
    (listed.infrastructureConfigurationSummaryList ?? []).map((i) => i.arn),
  ).toContain(arn);

  await client.send(
    new DeleteInfrastructureConfigurationCommand({
      infrastructureConfigurationArn: arn,
    }),
  );
  await expect(
    client.send(
      new GetInfrastructureConfigurationCommand({
        infrastructureConfigurationArn: arn,
      }),
    ),
  ).rejects.toThrow();
});

test("Imagebuilder tag operations", async () => {
  const client = imagebuilder();
  const name = `tag-test-${Date.now()}`;

  const created = await client.send(
    new CreateInfrastructureConfigurationCommand({
      name,
      instanceProfileName: "EC2InstanceProfileForImageBuilder",
      tags: { env: "test" },
      clientToken: crypto.randomUUID(),
    }),
  );
  const arn = created.infrastructureConfigurationArn ?? "";

  await client.send(
    new TagResourceCommand({ resourceArn: arn, tags: { owner: "bunsai" } }),
  );

  const tagged = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(tagged.tags?.owner).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["owner"] }),
  );

  const untagged = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(untagged.tags?.owner).toBeUndefined();
});

test("Imagebuilder image create/get/list/policy/cancel/retry/delete lifecycle", async () => {
  const client = imagebuilder();
  const name = `img-e2e-${Date.now()}`;
  const imageRecipeArn = `arn:aws:imagebuilder:${region}:000000000000:image-recipe/${name}/1.0.0`;
  const infrastructureConfigurationArn = `arn:aws:imagebuilder:${region}:000000000000:infrastructure-configuration/${name}`;

  const created = await client.send(
    new CreateImageCommand({
      imageRecipeArn,
      infrastructureConfigurationArn,
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.imageBuildVersionArn).toBeDefined();
  expect(created.imageBuildVersionArn).toContain(`image/${name}`);
  const buildArn = created.imageBuildVersionArn ?? "";

  const got = await client.send(
    new GetImageCommand({ imageBuildVersionArn: buildArn }),
  );
  expect(got.image?.arn).toBe(buildArn);
  expect(got.image?.name).toBe(name);
  expect(got.image?.state?.status).toBe("BUILDING");

  const listed = await client.send(new ListImagesCommand({}));
  expect((listed.imageVersionList ?? []).some((v) => v.name === name)).toBe(
    true,
  );

  const versionArn = buildArn.split("/").slice(0, -1).join("/");
  const buildVersions = await client.send(
    new ListImageBuildVersionsCommand({ imageVersionArn: versionArn }),
  );
  expect((buildVersions.imageSummaryList ?? []).map((s) => s.arn)).toContain(
    buildArn,
  );

  await client.send(
    new ListImagePackagesCommand({ imageBuildVersionArn: buildArn }),
  );

  const imageArn = versionArn;
  const policy = JSON.stringify({ Statement: [{ Effect: "Allow" }] });
  const putPolicy = await client.send(
    new PutImagePolicyCommand({ imageArn, policy }),
  );
  expect(putPolicy.imageArn).toBe(imageArn);

  const cancelled = await client.send(
    new CancelImageCreationCommand({
      imageBuildVersionArn: buildArn,
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(cancelled.imageBuildVersionArn).toBe(buildArn);

  const afterCancel = await client.send(
    new GetImageCommand({ imageBuildVersionArn: buildArn }),
  );
  expect(afterCancel.image?.state?.status).toBe("CANCELLED");

  const retried = await client.send(
    new RetryImageCommand({
      imageBuildVersionArn: buildArn,
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(retried.imageBuildVersionArn).toBe(buildArn);

  const afterRetry = await client.send(
    new GetImageCommand({ imageBuildVersionArn: buildArn }),
  );
  expect(afterRetry.image?.state?.status).toBe("BUILDING");

  const deleted = await client.send(
    new DeleteImageCommand({ imageBuildVersionArn: buildArn }),
  );
  expect(deleted.imageBuildVersionArn).toBe(buildArn);

  await expect(
    client.send(new GetImageCommand({ imageBuildVersionArn: buildArn })),
  ).rejects.toThrow();
});

test("Imagebuilder lifecycle policy create/get/list/update/delete", async () => {
  const client = imagebuilder();
  const name = `lc-policy-${Date.now()}`;
  const executionRole = `arn:aws:iam::000000000000:role/ImageBuilderLifecycleRole`;
  const resourceSelection = { tagMap: { lifecycle: "true" } };
  const policyDetails = [
    {
      action: { name: "DELETE" },
      filter: { type: "AGE", value: 6, unit: "MONTHS" },
    },
  ];

  const created = await client.send(
    new CreateLifecyclePolicyCommand({
      name,
      executionRole,
      resourceType: "AMI_IMAGE",
      policyDetails,
      resourceSelection,
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.lifecyclePolicyArn).toBeDefined();
  expect(created.lifecyclePolicyArn).toContain(`lifecycle-policy/${name}`);
  const arn = created.lifecyclePolicyArn ?? "";

  const got = await client.send(
    new GetLifecyclePolicyCommand({ lifecyclePolicyArn: arn }),
  );
  expect(got.lifecyclePolicy?.arn).toBe(arn);
  expect(got.lifecyclePolicy?.name).toBe(name);
  expect(got.lifecyclePolicy?.status).toBe("ENABLED");
  expect(got.lifecyclePolicy?.executionRole).toBe(executionRole);
  expect(got.lifecyclePolicy?.resourceType).toBe("AMI_IMAGE");

  const listed = await client.send(new ListLifecyclePoliciesCommand({}));
  expect((listed.lifecyclePolicySummaryList ?? []).map((p) => p.arn)).toContain(
    arn,
  );

  await client.send(
    new UpdateLifecyclePolicyCommand({
      lifecyclePolicyArn: arn,
      executionRole,
      resourceType: "AMI_IMAGE",
      policyDetails,
      resourceSelection,
      status: "DISABLED",
      clientToken: crypto.randomUUID(),
    }),
  );

  const updated = await client.send(
    new GetLifecyclePolicyCommand({ lifecyclePolicyArn: arn }),
  );
  expect(updated.lifecyclePolicy?.status).toBe("DISABLED");

  await client.send(
    new DeleteLifecyclePolicyCommand({ lifecyclePolicyArn: arn }),
  );
  await expect(
    client.send(new GetLifecyclePolicyCommand({ lifecyclePolicyArn: arn })),
  ).rejects.toThrow();
});

test("Imagebuilder StartResourceStateUpdate/GetLifecycleExecution/ListLifecycleExecutions/Cancel", async () => {
  const client = imagebuilder();
  const imageArn = `arn:aws:imagebuilder:${region}:000000000000:image/test-img/1.0.0/1`;

  const started = await client.send(
    new StartResourceStateUpdateCommand({
      resourceArn: imageArn,
      state: { status: "DEPRECATED" },
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(started.lifecycleExecutionId).toBeDefined();
  expect(started.resourceArn).toBe(imageArn);
  const execId = started.lifecycleExecutionId ?? "";

  const got = await client.send(
    new GetLifecycleExecutionCommand({ lifecycleExecutionId: execId }),
  );
  expect(got.lifecycleExecution?.lifecycleExecutionId).toBe(execId);
  expect(got.lifecycleExecution?.state?.status).toBe("IN_PROGRESS");

  const listed = await client.send(
    new ListLifecycleExecutionsCommand({ resourceArn: imageArn }),
  );
  expect(
    (listed.lifecycleExecutions ?? []).map((e) => e.lifecycleExecutionId),
  ).toContain(execId);

  await client.send(
    new CancelLifecycleExecutionCommand({
      lifecycleExecutionId: execId,
      clientToken: crypto.randomUUID(),
    }),
  );
  const afterCancel = await client.send(
    new GetLifecycleExecutionCommand({ lifecycleExecutionId: execId }),
  );
  expect(afterCancel.lifecycleExecution?.state?.status).toBe("CANCELLED");
});

test("Imagebuilder UpdateImagePipeline and StartImagePipelineExecution", async () => {
  const client = imagebuilder();
  const name = `pipeline-exec-${Date.now()}`;
  const imageRecipeArn = `arn:aws:imagebuilder:${region}:000000000000:image-recipe/${name}/1.0.0`;
  const infraArn = `arn:aws:imagebuilder:${region}:000000000000:infrastructure-configuration/${name}`;

  const created = await client.send(
    new CreateImagePipelineCommand({
      name,
      imageRecipeArn,
      infrastructureConfigurationArn: infraArn,
    }),
  );
  const pipelineArn = created.imagePipelineArn ?? "";

  await client.send(
    new UpdateImagePipelineCommand({
      imagePipelineArn: pipelineArn,
      infrastructureConfigurationArn: infraArn,
      description: "updated desc",
      clientToken: crypto.randomUUID(),
    }),
  );

  const updated = await client.send(
    new GetImagePipelineCommand({ imagePipelineArn: pipelineArn }),
  );
  expect(updated.imagePipeline?.description).toBe("updated desc");

  const exec = await client.send(
    new StartImagePipelineExecutionCommand({
      imagePipelineArn: pipelineArn,
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(exec.imageBuildVersionArn).toBeDefined();
  expect(exec.imageBuildVersionArn).toContain(`image/${name}`);

  const images = await client.send(
    new ListImagePipelineImagesCommand({ imagePipelineArn: pipelineArn }),
  );
  expect((images.imageSummaryList ?? []).map((i) => i.arn)).toContain(
    exec.imageBuildVersionArn,
  );

  await client.send(
    new DeleteImagePipelineCommand({ imagePipelineArn: pipelineArn }),
  );
});
