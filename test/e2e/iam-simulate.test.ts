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

const allowS3Policy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

const denyS3Policy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Deny", Action: "s3:GetObject", Resource: "*" }],
});

test("SimulateCustomPolicy: allow-only returns allowed", async () => {
  const client = iam();
  const res = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [allowS3Policy],
      ActionNames: ["s3:GetObject"],
      ResourceArns: ["arn:aws:s3:::my-bucket/key"],
    }),
  );
  expect(res.EvaluationResults).toHaveLength(1);
  expect(res.EvaluationResults![0].EvalDecision).toBe("allowed");
  expect(res.EvaluationResults![0].MatchedStatements).toHaveLength(1);
  expect(
    res.EvaluationResults![0].MatchedStatements![0].SourcePolicyId,
  ).toContain("PolicyInputList");
});

test("SimulateCustomPolicy: explicit deny wins over allow", async () => {
  const client = iam();
  const res = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [allowS3Policy, denyS3Policy],
      ActionNames: ["s3:GetObject"],
      ResourceArns: ["arn:aws:s3:::my-bucket/key"],
    }),
  );
  expect(res.EvaluationResults![0].EvalDecision).toBe("explicitDeny");
});

test("SimulateCustomPolicy: wildcard action matches", async () => {
  const wildcardPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "s3:*", Resource: "*" }],
  });
  const client = iam();
  const res = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [wildcardPolicy],
      ActionNames: ["s3:PutObject", "s3:GetObject", "ec2:DescribeInstances"],
    }),
  );
  const byAction = Object.fromEntries(
    res.EvaluationResults!.map((r) => [r.EvalActionName, r.EvalDecision]),
  );
  expect(byAction["s3:PutObject"]).toBe("allowed");
  expect(byAction["s3:GetObject"]).toBe("allowed");
  expect(byAction["ec2:DescribeInstances"]).toBe("implicitDeny");
});

test("SimulateCustomPolicy: resource mismatch returns implicitDeny", async () => {
  const limitedPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "s3:GetObject",
        Resource: "arn:aws:s3:::specific-bucket/*",
      },
    ],
  });
  const client = iam();
  const res = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [limitedPolicy],
      ActionNames: ["s3:GetObject"],
      ResourceArns: ["arn:aws:s3:::other-bucket/key"],
    }),
  );
  expect(res.EvaluationResults![0].EvalDecision).toBe("implicitDeny");
});

test("SimulateCustomPolicy: NotAction excludes matched action", async () => {
  const notActionPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", NotAction: "s3:DeleteObject", Resource: "*" },
    ],
  });
  const client = iam();
  const res = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [notActionPolicy],
      ActionNames: ["s3:GetObject", "s3:DeleteObject"],
    }),
  );
  const byAction = Object.fromEntries(
    res.EvaluationResults!.map((r) => [r.EvalActionName, r.EvalDecision]),
  );
  expect(byAction["s3:GetObject"]).toBe("allowed");
  expect(byAction["s3:DeleteObject"]).toBe("implicitDeny");
});

test("SimulateCustomPolicy: NotResource excludes matched resource", async () => {
  const notResourcePolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "s3:GetObject",
        NotResource: "arn:aws:s3:::forbidden-bucket/*",
      },
    ],
  });
  const client = iam();
  const res = await client.send(
    new SimulateCustomPolicyCommand({
      PolicyInputList: [notResourcePolicy],
      ActionNames: ["s3:GetObject"],
      ResourceArns: [
        "arn:aws:s3:::allowed-bucket/key",
        "arn:aws:s3:::forbidden-bucket/key",
      ],
    }),
  );
  const byResource = Object.fromEntries(
    res.EvaluationResults!.map((r) => [r.EvalResourceName, r.EvalDecision]),
  );
  expect(byResource["arn:aws:s3:::allowed-bucket/key"]).toBe("allowed");
  expect(byResource["arn:aws:s3:::forbidden-bucket/key"]).toBe("implicitDeny");
});

test("SimulatePrincipalPolicy: user inline + attached managed policies", async () => {
  const client = iam();
  const userName = "simulate-test-user";
  const account = "000000000000";

  await client.send(new CreateUserCommand({ UserName: userName }));

  await client.send(
    new PutUserPolicyCommand({
      UserName: userName,
      PolicyName: "inline-s3-get",
      PolicyDocument: allowS3Policy,
    }),
  );

  const managedPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Deny", Action: "s3:DeleteObject", Resource: "*" }],
  });
  const { Policy } = await client.send(
    new CreatePolicyCommand({
      PolicyName: "managed-s3-deny-delete",
      PolicyDocument: managedPolicy,
    }),
  );
  await client.send(
    new AttachUserPolicyCommand({
      UserName: userName,
      PolicyArn: Policy!.Arn!,
    }),
  );

  const userArn = `arn:aws:iam::${account}:user/${userName}`;
  const res = await client.send(
    new SimulatePrincipalPolicyCommand({
      PolicySourceArn: userArn,
      ActionNames: ["s3:GetObject", "s3:DeleteObject"],
    }),
  );

  const byAction = Object.fromEntries(
    res.EvaluationResults!.map((r) => [r.EvalActionName, r.EvalDecision]),
  );
  expect(byAction["s3:GetObject"]).toBe("allowed");
  expect(byAction["s3:DeleteObject"]).toBe("explicitDeny");
});
