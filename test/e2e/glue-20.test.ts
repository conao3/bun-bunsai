import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDatabaseCommand,
  CreateJobCommand,
  CreateRegistryCommand,
  GetDatabaseCommand,
  GetJobCommand,
  GetRegistryCommand,
  GlueClient,
  UpdateDatabaseCommand,
  UpdateJobCommand,
  UpdateRegistryCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new GlueClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("UpdateDatabase → GetDatabase reflects update", async () => {
  await client.send(
    new CreateDatabaseCommand({
      DatabaseInput: {
        Name: "e2e_db_chunk20",
        Description: "original description",
      },
    }),
  );

  await client.send(
    new UpdateDatabaseCommand({
      Name: "e2e_db_chunk20",
      DatabaseInput: {
        Name: "e2e_db_chunk20",
        Description: "updated description",
        LocationUri: "s3://bucket/db",
      },
    }),
  );

  const after = await client.send(
    new GetDatabaseCommand({ Name: "e2e_db_chunk20" }),
  );
  expect(after.Database?.Name).toBe("e2e_db_chunk20");
  expect(after.Database?.Description).toBe("updated description");
  expect(after.Database?.LocationUri).toBe("s3://bucket/db");
});

test("UpdateDatabase on missing database throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateDatabaseCommand({
        Name: "no-such-db-chunk20",
        DatabaseInput: { Name: "no-such-db-chunk20" },
      }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("UpdateJob → GetJob reflects update", async () => {
  await client.send(
    new CreateJobCommand({
      Name: "e2e_job_chunk20",
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
    }),
  );

  const updated = await client.send(
    new UpdateJobCommand({
      JobName: "e2e_job_chunk20",
      JobUpdate: {
        Role: "arn:aws:iam::123456789012:role/GlueRoleUpdated",
        Description: "updated job",
      },
    }),
  );
  expect(updated.JobName).toBe("e2e_job_chunk20");

  const after = await client.send(
    new GetJobCommand({ JobName: "e2e_job_chunk20" }),
  );
  expect(after.Job?.Name).toBe("e2e_job_chunk20");
  expect(after.Job?.Role).toBe(
    "arn:aws:iam::123456789012:role/GlueRoleUpdated",
  );
});

test("UpdateJob on missing job throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateJobCommand({
        JobName: "no-such-job-chunk20",
        JobUpdate: { Role: "arn:aws:iam::123456789012:role/GlueRole" },
      }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("UpdateRegistry → GetRegistry reflects updated description", async () => {
  await client.send(
    new CreateRegistryCommand({
      RegistryName: "e2e_registry_chunk20",
      Description: "original",
    }),
  );

  const updated = await client.send(
    new UpdateRegistryCommand({
      RegistryId: { RegistryName: "e2e_registry_chunk20" },
      Description: "updated registry",
    }),
  );
  expect(updated.RegistryName).toBe("e2e_registry_chunk20");

  const after = await client.send(
    new GetRegistryCommand({
      RegistryId: { RegistryName: "e2e_registry_chunk20" },
    }),
  );
  expect(after.RegistryName).toBe("e2e_registry_chunk20");
  expect(after.Description).toBe("updated registry");
});

test("UpdateRegistry on missing registry throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateRegistryCommand({
        RegistryId: { RegistryName: "no-such-registry-chunk20" },
        Description: "x",
      }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});
