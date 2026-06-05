import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  DisableOrganizationsRootCredentialsManagementCommand,
  DisableOrganizationsRootSessionsCommand,
  EnableOrganizationsRootCredentialsManagementCommand,
  EnableOrganizationsRootSessionsCommand,
  GenerateOrganizationsAccessReportCommand,
  GetOrganizationsAccessReportCommand,
  IAMClient,
  ListOrganizationsFeaturesCommand,
} from "@aws-sdk/client-iam";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () => new IAMClient({ endpoint, region, credentials });

test("IAM organizations-root toggle and access-report lifecycle", async () => {
  const client = iam();

  const init = await client.send(new ListOrganizationsFeaturesCommand({}));
  expect(init.OrganizationId).toBeDefined();
  expect(Array.isArray(init.EnabledFeatures)).toBe(true);

  const enableCreds = await client.send(
    new EnableOrganizationsRootCredentialsManagementCommand({}),
  );
  expect(enableCreds.EnabledFeatures).toContain("RootCredentialsManagement");

  const enableSessions = await client.send(
    new EnableOrganizationsRootSessionsCommand({}),
  );
  expect(enableSessions.EnabledFeatures).toContain("RootSessions");
  expect(enableSessions.EnabledFeatures).toContain("RootCredentialsManagement");

  const listAfterEnable = await client.send(
    new ListOrganizationsFeaturesCommand({}),
  );
  expect(listAfterEnable.EnabledFeatures).toContain(
    "RootCredentialsManagement",
  );
  expect(listAfterEnable.EnabledFeatures).toContain("RootSessions");

  const disableCreds = await client.send(
    new DisableOrganizationsRootCredentialsManagementCommand({}),
  );
  expect(disableCreds.EnabledFeatures).not.toContain(
    "RootCredentialsManagement",
  );

  const disableSessions = await client.send(
    new DisableOrganizationsRootSessionsCommand({}),
  );
  expect(disableSessions.EnabledFeatures).not.toContain("RootSessions");

  const generated = await client.send(
    new GenerateOrganizationsAccessReportCommand({
      EntityPath: "o-exampleorgid11/r-f6g7h8i9j0example",
    }),
  );
  expect(generated.JobId).toBeDefined();

  const report = await client.send(
    new GetOrganizationsAccessReportCommand({
      JobId: generated.JobId!,
    }),
  );
  expect(report.JobStatus).toBe("COMPLETED");
  expect(report.JobCreationDate).toBeDefined();
});
