import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateServiceCommand,
  DeleteServiceCommand,
  DeregisterTaskDefinitionCommand,
  DescribeServicesCommand,
  ECSClient,
  ListServicesCommand,
  ListTaskDefinitionsCommand,
  RegisterTaskDefinitionCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";

const awsPort = 4863;
const uiPort = 5863;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("ecs service and task definition e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const ecs = () => new ECSClient({ endpoint, region, credentials });

  test("register, list and deregister task definitions", async () => {
    const client = ecs();
    const family = "bunsai-e2e-td";

    const first = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );
    expect(first.taskDefinition?.family).toBe(family);
    expect(first.taskDefinition?.revision).toBe(1);

    const second = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );
    expect(second.taskDefinition?.revision).toBe(2);

    const listed = await client.send(
      new ListTaskDefinitionsCommand({ familyPrefix: family, sort: "DESC" }),
    );
    const arns = listed.taskDefinitionArns ?? [];
    expect(arns.length).toBeGreaterThanOrEqual(2);
    expect(arns[0]).toContain(`${family}:2`);

    const deregistered = await client.send(
      new DeregisterTaskDefinitionCommand({
        taskDefinition: `${family}:1`,
      }),
    );
    expect(deregistered.taskDefinition?.status).toBe("INACTIVE");
    expect(deregistered.taskDefinition?.revision).toBe(1);
  });

  test("create, describe, update, list and delete service", async () => {
    const client = ecs();
    const family = "bunsai-e2e-svc-td";
    const serviceName = "bunsai-e2e-service";

    const td = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );
    const taskDefinition = td.taskDefinition?.taskDefinitionArn;

    const created = await client.send(
      new CreateServiceCommand({
        serviceName,
        taskDefinition,
        desiredCount: 2,
      }),
    );
    expect(created.service?.serviceName).toBe(serviceName);
    expect(created.service?.status).toBe("ACTIVE");
    expect(created.service?.desiredCount).toBe(2);
    expect(created.service?.serviceArn).toContain(serviceName);

    const described = await client.send(
      new DescribeServicesCommand({ services: [serviceName] }),
    );
    const names = (described.services ?? []).map((s) => s.serviceName);
    expect(names).toContain(serviceName);
    expect(described.failures ?? []).toHaveLength(0);

    const updated = await client.send(
      new UpdateServiceCommand({ service: serviceName, desiredCount: 5 }),
    );
    expect(updated.service?.desiredCount).toBe(5);

    const listed = await client.send(new ListServicesCommand({}));
    const serviceArns = listed.serviceArns ?? [];
    expect(serviceArns.some((arn) => arn.includes(serviceName))).toBe(true);

    const deleted = await client.send(
      new DeleteServiceCommand({ service: serviceName }),
    );
    expect(deleted.service?.status).toBe("DRAINING");

    const missing = await client.send(
      new DescribeServicesCommand({ services: [serviceName] }),
    );
    expect(missing.services ?? []).toHaveLength(0);
    expect((missing.failures ?? []).map((f) => f.reason)).toContain("MISSING");
  });
});
