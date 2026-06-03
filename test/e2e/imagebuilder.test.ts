import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateImagePipelineCommand,
  DeleteImagePipelineCommand,
  GetImagePipelineCommand,
  ImagebuilderClient,
  ListImagePipelinesCommand,
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
