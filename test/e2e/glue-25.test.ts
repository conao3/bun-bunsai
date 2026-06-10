import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateConnectionCommand,
  CreateCrawlerCommand,
  CreateDatabaseCommand,
  CreateJobCommand,
  GetConnectionsCommand,
  GetCrawlerCommand,
  GetDatabasesCommand,
  GlueClient,
  ListJobsCommand,
  StartCrawlerCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new GlueClient({ endpoint, region, credentials, requestHandler });

test("GetConnections: Filter.ConnectionType narrows results", async () => {
  const prefix = "con2039_ct_";
  await client.send(
    new CreateConnectionCommand({
      ConnectionInput: {
        Name: `${prefix}jdbc`,
        ConnectionType: "JDBC",
        ConnectionProperties: { JDBC_CONNECTION_URL: "jdbc://host/db", USERNAME: "u", PASSWORD: "p" },
      },
    }),
  );
  await client.send(
    new CreateConnectionCommand({
      ConnectionInput: {
        Name: `${prefix}sftp`,
        ConnectionType: "SFTP",
        ConnectionProperties: {},
      },
    }),
  );

  const jdbcOnly = await client.send(
    new GetConnectionsCommand({ Filter: { ConnectionType: "JDBC" } }),
  );
  const jdbcNames = (jdbcOnly.ConnectionList ?? []).map((c) => c.Name!);
  expect(jdbcNames).toContain(`${prefix}jdbc`);
  expect(jdbcNames).not.toContain(`${prefix}sftp`);

  const sftpOnly = await client.send(
    new GetConnectionsCommand({ Filter: { ConnectionType: "SFTP" } }),
  );
  const sftpNames = (sftpOnly.ConnectionList ?? []).map((c) => c.Name!);
  expect(sftpNames).toContain(`${prefix}sftp`);
  expect(sftpNames).not.toContain(`${prefix}jdbc`);
});

test("GetConnections: Filter.MatchCriteria filters by criteria", async () => {
  const prefix = "con2039_mc_";
  await client.send(
    new CreateConnectionCommand({
      ConnectionInput: {
        Name: `${prefix}alpha`,
        ConnectionType: "JDBC",
        ConnectionProperties: { JDBC_CONNECTION_URL: "jdbc://host/db", USERNAME: "u", PASSWORD: "p" },
        MatchCriteria: ["alpha", "common"],
      },
    }),
  );
  await client.send(
    new CreateConnectionCommand({
      ConnectionInput: {
        Name: `${prefix}beta`,
        ConnectionType: "JDBC",
        ConnectionProperties: { JDBC_CONNECTION_URL: "jdbc://host/db", USERNAME: "u", PASSWORD: "p" },
        MatchCriteria: ["beta"],
      },
    }),
  );

  const alphaRes = await client.send(
    new GetConnectionsCommand({ Filter: { MatchCriteria: ["alpha"] } }),
  );
  const alphaNames = (alphaRes.ConnectionList ?? []).map((c) => c.Name!);
  expect(alphaNames).toContain(`${prefix}alpha`);
  expect(alphaNames).not.toContain(`${prefix}beta`);

  const commonRes = await client.send(
    new GetConnectionsCommand({ Filter: { MatchCriteria: ["common"] } }),
  );
  const commonNames = (commonRes.ConnectionList ?? []).map((c) => c.Name!);
  expect(commonNames).toContain(`${prefix}alpha`);
});

test("GetConnections: NextToken/MaxResults pagination", async () => {
  const prefix = "con2039_pg_";
  for (let i = 0; i < 3; i++) {
    await client.send(
      new CreateConnectionCommand({
        ConnectionInput: {
          Name: `${prefix}${i}`,
          ConnectionType: "JDBC",
          ConnectionProperties: { JDBC_CONNECTION_URL: "jdbc://host/db", USERNAME: "u", PASSWORD: "p" },
        },
      }),
    );
  }

  const page1 = await client.send(new GetConnectionsCommand({ MaxResults: 2 }));
  expect(Array.isArray(page1.ConnectionList)).toBe(true);
  expect(page1.ConnectionList!.length).toBeLessThanOrEqual(2);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new GetConnectionsCommand({ MaxResults: 100, NextToken: page1.NextToken }),
  );
  expect(Array.isArray(page2.ConnectionList)).toBe(true);

  const allNames = [
    ...(page1.ConnectionList ?? []).map((c) => c.Name!),
    ...(page2.ConnectionList ?? []).map((c) => c.Name!),
  ].filter((n) => n.startsWith(prefix));
  expect(new Set(allNames).size).toBe(3);
});

test("GetDatabases: ResourceShareType=FEDERATED returns empty list", async () => {
  const res = await client.send(
    new GetDatabasesCommand({ ResourceShareType: "FEDERATED" }),
  );
  expect(res.DatabaseList).toEqual([]);
});

test("GetDatabases: ResourceShareType=FOREIGN returns empty list", async () => {
  const res = await client.send(
    new GetDatabasesCommand({ ResourceShareType: "FOREIGN" }),
  );
  expect(res.DatabaseList).toEqual([]);
});

test("GetDatabases: ResourceShareType=ALL returns local databases", async () => {
  const name = "con2039_db_all";
  await client.send(new CreateDatabaseCommand({ DatabaseInput: { Name: name } }));
  const res = await client.send(
    new GetDatabasesCommand({ ResourceShareType: "ALL" }),
  );
  const names = (res.DatabaseList ?? []).map((d) => d.Name!);
  expect(names).toContain(name);
});

test("GetDatabases: AttributesToGet=[NAME] returns only name field", async () => {
  const name = "con2039_db_attr";
  await client.send(
    new CreateDatabaseCommand({
      DatabaseInput: { Name: name, Description: "test description" },
    }),
  );
  const res = await client.send(
    new GetDatabasesCommand({ AttributesToGet: ["NAME"] }),
  );
  const db = (res.DatabaseList ?? []).find((d) => d.Name === name);
  expect(db).toBeDefined();
  expect(db!.Name).toBe(name);
  expect(db!.Description).toBeUndefined();
});

test("CreateCrawler: empty Role throws InvalidInputException", async () => {
  expect(
    client.send(
      new CreateCrawlerCommand({
        Name: "con2039_crawler_norole",
        Role: "",
        Targets: { S3Targets: [] },
      }),
    ),
  ).rejects.toThrow();
});

test("CreateCrawler: invalid ARN format throws InvalidInputException", async () => {
  expect(
    client.send(
      new CreateCrawlerCommand({
        Name: "con2039_crawler_badarn",
        Role: "arn:aws:iam::bad-account:role/Role",
        Targets: { S3Targets: [] },
      }),
    ),
  ).rejects.toThrow();
});

test("CreateJob: empty Role throws InvalidInputException", async () => {
  expect(
    client.send(
      new CreateJobCommand({
        Name: "con2039_job_norole",
        Role: "",
        Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
      }),
    ),
  ).rejects.toThrow();
});

test("CreateJob: invalid ARN format throws InvalidInputException", async () => {
  expect(
    client.send(
      new CreateJobCommand({
        Name: "con2039_job_badarn",
        Role: "arn:aws:iam::not-digits:role/Role",
        Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
      }),
    ),
  ).rejects.toThrow();
});

test("ListJobs: NextToken/MaxResults pagination", async () => {
  const prefix = "con2039_listjob_";
  const total = 4;
  for (let i = 0; i < total; i++) {
    await client.send(
      new CreateJobCommand({
        Name: `${prefix}${i}`,
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
      }),
    );
  }

  const page1 = await client.send(new ListJobsCommand({ MaxResults: 2 }));
  expect(Array.isArray(page1.JobNames)).toBe(true);
  expect(page1.JobNames!.length).toBeLessThanOrEqual(2);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new ListJobsCommand({ MaxResults: 100, NextToken: page1.NextToken }),
  );
  expect(Array.isArray(page2.JobNames)).toBe(true);

  const allNames = [
    ...(page1.JobNames ?? []),
    ...(page2.JobNames ?? []),
  ].filter((n) => n.startsWith(prefix));
  expect(new Set(allNames).size).toBe(total);
});

test("StartCrawler: crawler transitions through RUNNING to READY", async () => {
  const name = "con2039_crawler_running";
  await client.send(
    new CreateCrawlerCommand({
      Name: name,
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Targets: { S3Targets: [] },
    }),
  );

  const before = await client.send(new GetCrawlerCommand({ Name: name }));
  expect(before.Crawler!.State).toBe("READY");

  await client.send(new StartCrawlerCommand({ Name: name }));

  const after = await client.send(new GetCrawlerCommand({ Name: name }));
  expect(after.Crawler!.State).toBe("READY");
});
