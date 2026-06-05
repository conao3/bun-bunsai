import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreatePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  ListPoliciesCommand,
  ListRoleTagsCommand,
  TagRoleCommand,
  UntagRoleCommand,
  UpdateRoleCommand,
  UpdateRoleDescriptionCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });

test("IAM UpdateRole, UpdateRoleDescription, UntagRole, ListPolicies lifecycle", async () => {
  const client = iam();

  const createRole = await client.send(
    new CreateRoleCommand({
      RoleName: "TestRole6",
      AssumeRolePolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      Description: "initial",
      MaxSessionDuration: 3600,
    }),
  );
  expect(createRole.Role?.RoleName).toBe("TestRole6");
  expect(createRole.Role?.Description).toBe("initial");

  const updateRole = await client.send(
    new UpdateRoleCommand({
      RoleName: "TestRole6",
      Description: "updated-desc",
      MaxSessionDuration: 7200,
    }),
  );
  expect(updateRole.$metadata.httpStatusCode).toBe(200);

  const afterUpdate = await client.send(
    new GetRoleCommand({ RoleName: "TestRole6" }),
  );
  expect(afterUpdate.Role?.Description).toBe("updated-desc");
  expect(afterUpdate.Role?.MaxSessionDuration).toBe(7200);

  const updateDesc = await client.send(
    new UpdateRoleDescriptionCommand({
      RoleName: "TestRole6",
      Description: "desc-only",
    }),
  );
  expect(updateDesc.Role?.Description).toBe("desc-only");

  await client.send(
    new TagRoleCommand({
      RoleName: "TestRole6",
      Tags: [
        { Key: "Env", Value: "test" },
        { Key: "Owner", Value: "ci" },
      ],
    }),
  );
  const tagsBeforeUntag = await client.send(
    new ListRoleTagsCommand({ RoleName: "TestRole6" }),
  );
  expect(tagsBeforeUntag.Tags?.length).toBe(2);

  await client.send(
    new UntagRoleCommand({ RoleName: "TestRole6", TagKeys: ["Owner"] }),
  );
  const tagsAfterUntag = await client.send(
    new ListRoleTagsCommand({ RoleName: "TestRole6" }),
  );
  expect(tagsAfterUntag.Tags?.length).toBe(1);
  expect(tagsAfterUntag.Tags?.[0]?.Key).toBe("Env");

  await client.send(
    new CreatePolicyCommand({
      PolicyName: "TestPolicy6",
      PolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: "s3:*", Resource: "*" }],
      }),
    }),
  );

  const listAll = await client.send(new ListPoliciesCommand({ Scope: "All" }));
  expect(Array.isArray(listAll.Policies)).toBe(true);
  const found = listAll.Policies?.find((p) => p.PolicyName === "TestPolicy6");
  expect(found).toBeDefined();
  expect(found?.Arn).toMatch(/arn:aws:iam::/);

  const listLocal = await client.send(
    new ListPoliciesCommand({ Scope: "Local" }),
  );
  expect(listLocal.Policies?.some((p) => p.PolicyName === "TestPolicy6")).toBe(
    true,
  );
});
