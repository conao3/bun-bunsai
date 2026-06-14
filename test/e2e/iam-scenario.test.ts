import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachRolePolicyCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  DeletePolicyCommand,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  DetachRolePolicyCommand,
  GetRoleCommand,
  GetRolePolicyCommand,
  IAMClient,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
  PutRolePolicyCommand,
  SimulatePrincipalPolicyCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const account = "000000000000";

describe("IAM scenario e2e: app permission setup", () => {
  const iam = () =>
    new IAMClient({ endpoint, region, credentials, requestHandler });

  test("CreateRole → CreatePolicy → Attach → PutInline → Simulate → cleanup", async () => {
    const client = iam();
    const roleName = "scenario-app-role";
    const policyName = "scenario-app-managed-policy";
    const inlinePolicyName = "scenario-app-inline-deny";

    const assumeRolePolicyDocument = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    });

    const createRoleRes = await client.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
      }),
    );
    expect(createRoleRes.Role?.RoleName).toBe(roleName);
    expect(createRoleRes.Role?.Arn).toBe(
      `arn:aws:iam::${account}:role/${roleName}`,
    );
    expect(createRoleRes.Role?.AssumeRolePolicyDocument).toBe(
      assumeRolePolicyDocument,
    );

    const getRoleRes = await client.send(
      new GetRoleCommand({ RoleName: roleName }),
    );
    expect(getRoleRes.Role?.RoleName).toBe(roleName);
    expect(getRoleRes.Role?.Arn).toBe(
      `arn:aws:iam::${account}:role/${roleName}`,
    );

    const createPolicyRes = await client.send(
      new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Action: "s3:GetObject", Resource: "*" },
          ],
        }),
      }),
    );
    const policyArn = createPolicyRes.Policy?.Arn ?? "";
    expect(policyArn).toBe(`arn:aws:iam::${account}:policy/${policyName}`);
    expect(createPolicyRes.Policy?.DefaultVersionId).toBe("v1");

    await client.send(
      new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );
    const listAttachedRes = await client.send(
      new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
    );
    expect(listAttachedRes.AttachedPolicies).toHaveLength(1);
    expect(listAttachedRes.AttachedPolicies?.[0]?.PolicyArn).toBe(policyArn);
    expect(listAttachedRes.AttachedPolicies?.[0]?.PolicyName).toBe(policyName);

    await client.send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: inlinePolicyName,
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Deny", Action: "s3:DeleteObject", Resource: "*" },
          ],
        }),
      }),
    );

    const getRolePolicyRes = await client.send(
      new GetRolePolicyCommand({
        RoleName: roleName,
        PolicyName: inlinePolicyName,
      }),
    );
    expect(getRolePolicyRes.RoleName).toBe(roleName);
    expect(getRolePolicyRes.PolicyName).toBe(inlinePolicyName);
    expect(getRolePolicyRes.PolicyDocument).toContain("s3:DeleteObject");

    const listRolePoliciesRes = await client.send(
      new ListRolePoliciesCommand({ RoleName: roleName }),
    );
    expect(listRolePoliciesRes.PolicyNames).toContain(inlinePolicyName);

    const roleArn = `arn:aws:iam::${account}:role/${roleName}`;
    const simulateRes = await client.send(
      new SimulatePrincipalPolicyCommand({
        PolicySourceArn: roleArn,
        ActionNames: ["s3:GetObject", "s3:DeleteObject"],
      }),
    );
    const byAction = Object.fromEntries(
      (simulateRes.EvaluationResults ?? []).map((r) => [
        r.EvalActionName,
        r.EvalDecision,
      ]),
    );
    expect(byAction["s3:GetObject"]).toBe("allowed");
    expect(byAction["s3:DeleteObject"]).toBe("explicitDeny");

    await client.send(
      new DetachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );
    const afterDetachRes = await client.send(
      new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
    );
    expect(afterDetachRes.AttachedPolicies ?? []).toHaveLength(0);

    await client.send(
      new DeleteRolePolicyCommand({
        RoleName: roleName,
        PolicyName: inlinePolicyName,
      }),
    );

    await client.send(new DeleteRoleCommand({ RoleName: roleName }));
    await expect(
      client.send(new GetRoleCommand({ RoleName: roleName })),
    ).rejects.toMatchObject({ name: "NoSuchEntityException" });

    await client.send(new DeletePolicyCommand({ PolicyArn: policyArn }));
  });

  test("DeleteConflict guards: DeleteRole fails when attachments or inline policies remain, succeeds after detach", async () => {
    const client = iam();
    const roleName = "scenario-guard-role";
    const policyName = "scenario-guard-policy";
    const inlinePolicyName = "scenario-guard-inline";

    const assumeRolePolicyDocument = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    });

    await client.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
      }),
    );

    const createPolicyRes = await client.send(
      new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Action: "s3:GetObject", Resource: "*" },
          ],
        }),
      }),
    );
    const policyArn = createPolicyRes.Policy!.Arn!;

    await client.send(
      new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );

    await expect(
      client.send(new DeleteRoleCommand({ RoleName: roleName })),
    ).rejects.toMatchObject({ name: "DeleteConflictException" });

    await client.send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: inlinePolicyName,
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Deny", Action: "s3:DeleteObject", Resource: "*" },
          ],
        }),
      }),
    );

    await client.send(
      new DetachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );

    await expect(
      client.send(new DeleteRoleCommand({ RoleName: roleName })),
    ).rejects.toMatchObject({ name: "DeleteConflictException" });

    await client.send(
      new DeleteRolePolicyCommand({
        RoleName: roleName,
        PolicyName: inlinePolicyName,
      }),
    );

    await client.send(new DeleteRoleCommand({ RoleName: roleName }));
    await expect(
      client.send(new GetRoleCommand({ RoleName: roleName })),
    ).rejects.toMatchObject({ name: "NoSuchEntityException" });

    await expect(
      client.send(new DeletePolicyCommand({ PolicyArn: policyArn })),
    ).resolves.toBeDefined();
  });

  test("DeleteConflict guard: DeletePolicy fails when attachments remain, succeeds after detach", async () => {
    const client = iam();
    const roleName = "scenario-policy-guard-role";
    const policyName = "scenario-policy-guard-policy";

    const assumeRolePolicyDocument = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    });

    await client.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
      }),
    );

    const createPolicyRes = await client.send(
      new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Action: "s3:GetObject", Resource: "*" },
          ],
        }),
      }),
    );
    const policyArn = createPolicyRes.Policy!.Arn!;

    await client.send(
      new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );

    await expect(
      client.send(new DeletePolicyCommand({ PolicyArn: policyArn })),
    ).rejects.toMatchObject({ name: "DeleteConflictException" });

    await client.send(
      new DetachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );

    await client.send(new DeletePolicyCommand({ PolicyArn: policyArn }));
    await client.send(new DeleteRoleCommand({ RoleName: roleName }));
  });
});
