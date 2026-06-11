import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DeleteParametersCommand,
  GetParameterCommand,
  GetParameterHistoryCommand,
  GetParametersByPathCommand,
  LabelParameterVersionCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SSM scenario e2e", () => {
  const ssm = () =>
    new SSMClient({ endpoint, region, credentials, requestHandler });

  test("hierarchical app config: build tree → path-read → secure overwrite/label/history → delete", async () => {
    const client = ssm();
    const ts = Date.now();
    const base = `/app/${ts}`;
    const devDb = `${base}/dev/db`;
    const prodDb = `${base}/prod/db`;
    const devCache = `${base}/dev/cache`;
    const prodDbV1 = "postgres://dev-host/db";
    const prodDbV2 = "postgres://prod-host/db";

    const putDevDb = await client.send(
      new PutParameterCommand({
        Name: devDb,
        Value: "sqlite:///dev.db",
        Type: "String",
      }),
    );
    expect(putDevDb.Version).toBe(1);

    const putProdDb = await client.send(
      new PutParameterCommand({
        Name: prodDb,
        Value: prodDbV1,
        Type: "SecureString",
      }),
    );
    expect(putProdDb.Version).toBe(1);

    await client.send(
      new PutParameterCommand({
        Name: devCache,
        Value: "redis://localhost:6379",
        Type: "String",
      }),
    );

    const allParams = await client.send(
      new GetParametersByPathCommand({
        Path: base,
        Recursive: true,
      }),
    );
    const allNames = (allParams.Parameters ?? []).map((p) => p.Name).sort();
    expect(allNames).toEqual([devCache, devDb, prodDb].sort());
    expect(allNames.length).toBe(3);

    const directOnly = await client.send(
      new GetParametersByPathCommand({
        Path: base,
        Recursive: false,
      }),
    );
    expect((directOnly.Parameters ?? []).length).toBe(0);

    const decrypted = await client.send(
      new GetParameterCommand({ Name: prodDb, WithDecryption: true }),
    );
    expect(decrypted.Parameter?.Value).toBe(prodDbV1);

    const encrypted = await client.send(
      new GetParameterCommand({ Name: prodDb, WithDecryption: false }),
    );
    expect(encrypted.Parameter?.Value?.startsWith("kms:ssm:")).toBe(true);
    expect(encrypted.Parameter?.Value).not.toBe(prodDbV1);

    const overwrite = await client.send(
      new PutParameterCommand({
        Name: prodDb,
        Value: prodDbV2,
        Type: "SecureString",
        Overwrite: true,
      }),
    );
    expect(overwrite.Version).toBe(2);

    const afterOverwrite = await client.send(
      new GetParameterCommand({ Name: prodDb, WithDecryption: true }),
    );
    expect(afterOverwrite.Parameter?.Value).toBe(prodDbV2);
    expect(afterOverwrite.Parameter?.Version).toBe(2);

    await client.send(
      new LabelParameterVersionCommand({
        Name: prodDb,
        ParameterVersion: 1,
        Labels: ["previous"],
      }),
    );

    const byLabel = await client.send(
      new GetParameterCommand({
        Name: `${prodDb}:previous`,
        WithDecryption: true,
      }),
    );
    expect(byLabel.Parameter?.Value).toBe(prodDbV1);
    expect(byLabel.Parameter?.Version).toBe(1);

    const history = await client.send(
      new GetParameterHistoryCommand({ Name: prodDb, WithDecryption: true }),
    );
    expect(history.Parameters?.length).toBe(2);
    const hv1 = history.Parameters?.find((p) => p.Version === 1);
    const hv2 = history.Parameters?.find((p) => p.Version === 2);
    expect(hv1?.Value).toBe(prodDbV1);
    expect(hv1?.Labels).toContain("previous");
    expect(hv2?.Value).toBe(prodDbV2);

    const deleted = await client.send(
      new DeleteParametersCommand({
        Names: [devDb, prodDb, devCache, `${base}/nonexistent`],
      }),
    );
    expect(deleted.DeletedParameters?.length).toBe(3);
    expect(deleted.InvalidParameters).toContain(`${base}/nonexistent`);

    const afterDelete = await client.send(
      new GetParametersByPathCommand({
        Path: base,
        Recursive: true,
      }),
    );
    expect((afterDelete.Parameters ?? []).length).toBe(0);
  });
});
