import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchGetBuildsCommand,
  BatchGetProjectsCommand,
  CodeBuildClient,
  CreateProjectCommand,
  DeleteProjectCommand,
  ListProjectsCommand,
  StartBuildCommand,
  UpdateProjectCommand,
} from "@aws-sdk/client-codebuild";
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

const codebuild = () =>
  new CodeBuildClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("CodeBuild project and build lifecycle", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-project";

  const created = await client.send(
    new CreateProjectCommand({
      name,
      description: "bunsai e2e project",
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );
  expect(created.project?.name).toBe(name);
  expect(created.project?.arn).toContain(`project/${name}`);
  expect(created.project?.description).toBe("bunsai e2e project");

  const listed = await client.send(new ListProjectsCommand({}));
  expect(listed.projects ?? []).toContain(name);

  const fetched = await client.send(
    new BatchGetProjectsCommand({ names: [name, "missing-project"] }),
  );
  expect((fetched.projects ?? [])[0]?.name).toBe(name);
  expect(fetched.projectsNotFound ?? []).toContain("missing-project");

  const updated = await client.send(
    new UpdateProjectCommand({
      name,
      description: "updated description",
    }),
  );
  expect(updated.project?.description).toBe("updated description");

  const started = await client.send(
    new StartBuildCommand({ projectName: name }),
  );
  const buildId = started.build?.id ?? "";
  expect(buildId).toContain(name);
  expect(started.build?.projectName).toBe(name);
  expect(started.build?.buildStatus).toBe("SUCCEEDED");

  const builds = await client.send(
    new BatchGetBuildsCommand({ ids: [buildId, "missing-build"] }),
  );
  expect((builds.builds ?? [])[0]?.id).toBe(buildId);
  expect(builds.buildsNotFound ?? []).toContain("missing-build");

  await client.send(new DeleteProjectCommand({ name }));
  const afterDelete = await client.send(
    new BatchGetProjectsCommand({ names: [name] }),
  );
  expect(afterDelete.projectsNotFound ?? []).toContain(name);
});
