import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeletePolicyCommand,
  FMSClient,
  GetPolicyCommand,
  ListPoliciesCommand,
  PutPolicyCommand,
} from "@aws-sdk/client-fms";
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

const fms = () =>
  new FMSClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("FMS policy lifecycle", async () => {
  const client = fms();

  const put = await client.send(
    new PutPolicyCommand({
      Policy: {
        PolicyName: "bunsai-e2e-policy",
        SecurityServicePolicyData: { Type: "WAFV2" },
        ResourceType: "AWS::ElasticLoadBalancingV2::LoadBalancer",
        ExcludeResourceTags: false,
        RemediationEnabled: false,
      },
    }),
  );
  expect(put.Policy?.PolicyName).toBe("bunsai-e2e-policy");
  expect(put.Policy?.PolicyId).toBeDefined();
  expect(put.PolicyArn).toContain("policy/");

  const policyId = put.Policy?.PolicyId ?? "";

  const got = await client.send(new GetPolicyCommand({ PolicyId: policyId }));
  expect(got.Policy?.PolicyId).toBe(policyId);
  expect(got.PolicyArn).toContain(policyId);

  const listed = await client.send(new ListPoliciesCommand({}));
  expect((listed.PolicyList ?? []).some((p) => p.PolicyId === policyId)).toBe(
    true,
  );

  await client.send(new DeletePolicyCommand({ PolicyId: policyId }));

  await expect(
    client.send(new GetPolicyCommand({ PolicyId: policyId })),
  ).rejects.toThrow();
});
