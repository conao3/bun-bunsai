import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachUserPolicyCommand,
  CreatePolicyCommand,
  CreateUserCommand,
  IAMClient,
  PutUserPolicyCommand,
  SimulateCustomPolicyCommand,
  SimulatePrincipalPolicyCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });

const putOnlyPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:PutObject", Resource: "*" }],
});

const wildcardS3Policy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:*", Resource: "*" }],
});

const allowThenDenyPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    { Effect: "Allow", Action: "s3:*", Resource: "*" },
    { Effect: "Deny", Action: "s3:GetObject", Resource: "*" },
  ],
});

test("SimulateCustomPolicy: allow/implicitDeny/explicitDeny", async () => {
  const client = iam();

  const putOnly = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [putOnlyPolicy],
      ActionNames: ["s3:PutObject", "s3:GetObject", "iam:CreateUser"],
    }),
  );
  const results = putOnly.EvaluationResults ?? [];
  expect(results).toHaveLength(3);
  expect(
    results.find((r) => r.EvalActionName === "s3:PutObject")?.EvalDecision,
  ).toBe("allowed");
  expect(
    results.find((r) => r.EvalActionName === "s3:GetObject")?.EvalDecision,
  ).toBe("implicitDeny");
  expect(
    results.find((r) => r.EvalActionName === "iam:CreateUser")?.EvalDecision,
  ).toBe("implicitDeny");

  const wildcard = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [wildcardS3Policy],
      ActionNames: ["s3:GetObject", "s3:PutObject", "iam:CreateUser"],
    }),
  );
  const wResults = wildcard.EvaluationResults ?? [];
  expect(
    wResults.find((r) => r.EvalActionName === "s3:GetObject")?.EvalDecision,
  ).toBe("allowed");
  expect(
    wResults.find((r) => r.EvalActionName === "s3:PutObject")?.EvalDecision,
  ).toBe("allowed");
  expect(
    wResults.find((r) => r.EvalActionName === "iam:CreateUser")?.EvalDecision,
  ).toBe("implicitDeny");

  const denyOverride = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [allowThenDenyPolicy],
      ActionNames: ["s3:GetObject", "s3:PutObject"],
    }),
  );
  const dResults = denyOverride.EvaluationResults ?? [];
  expect(
    dResults.find((r) => r.EvalActionName === "s3:GetObject")?.EvalDecision,
  ).toBe("explicitDeny");
  expect(
    dResults.find((r) => r.EvalActionName === "s3:PutObject")?.EvalDecision,
  ).toBe("allowed");
});

test("SimulatePrincipalPolicy: inline and attached policies", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "sim-test-user" }));

  await client.send(
    new PutUserPolicyCommand({
      UserName: "sim-test-user",
      PolicyName: "InlineS3Put",
      PolicyDocument: putOnlyPolicy,
    }),
  );

  const inlineResult = await client.send(
    new SimulatePrincipalPolicyCommand({
      PolicySourceArn: `arn:aws:iam::000000000000:user/sim-test-user`,
      ActionNames: ["s3:PutObject", "s3:GetObject"],
    }),
  );
  const iResults = inlineResult.EvaluationResults ?? [];
  expect(
    iResults.find((r) => r.EvalActionName === "s3:PutObject")?.EvalDecision,
  ).toBe("allowed");
  expect(
    iResults.find((r) => r.EvalActionName === "s3:GetObject")?.EvalDecision,
  ).toBe("implicitDeny");

  const { Policy: attachedPolicy } = await client.send(
    new CreatePolicyCommand({
      PolicyName: "ManagedS3Wildcard",
      PolicyDocument: wildcardS3Policy,
    }),
  );
  await client.send(
    new AttachUserPolicyCommand({
      UserName: "sim-test-user",
      PolicyArn: attachedPolicy!.Arn!,
    }),
  );

  const attachedResult = await client.send(
    new SimulatePrincipalPolicyCommand({
      PolicySourceArn: `arn:aws:iam::000000000000:user/sim-test-user`,
      ActionNames: ["s3:GetObject", "iam:CreateUser"],
    }),
  );
  const aResults = attachedResult.EvaluationResults ?? [];
  expect(
    aResults.find((r) => r.EvalActionName === "s3:GetObject")?.EvalDecision,
  ).toBe("allowed");
  expect(
    aResults.find((r) => r.EvalActionName === "iam:CreateUser")?.EvalDecision,
  ).toBe("implicitDeny");
});
