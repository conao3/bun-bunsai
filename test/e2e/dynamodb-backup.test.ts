import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateBackupCommand,
  CreateTableCommand,
  DeleteBackupCommand,
  DeleteTableCommand,
  DescribeBackupCommand,
  DescribeContinuousBackupsCommand,
  DynamoDBClient,
  ListBackupsCommand,
  UpdateContinuousBackupsCommand,
} from "@aws-sdk/client-dynamodb";

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

describe("DynamoDB backup ops e2e", () => {
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

  const ddb = () => new DynamoDBClient({ endpoint, region, credentials });
  const table = "bunsai-e2e-ddb-backup";

  test("backup lifecycle and continuous backups", async () => {
    const client = ddb();

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    const created = await client.send(
      new CreateBackupCommand({
        TableName: table,
        BackupName: "bunsai-e2e-backup-1",
      }),
    );
    const backupArn = created.BackupDetails?.BackupArn;
    expect(typeof backupArn).toBe("string");
    expect(created.BackupDetails?.BackupName).toBe("bunsai-e2e-backup-1");
    expect(created.BackupDetails?.BackupStatus).toBe("AVAILABLE");

    const described = await client.send(
      new DescribeBackupCommand({ BackupArn: backupArn }),
    );
    expect(described.BackupDescription?.BackupDetails?.BackupArn).toBe(
      backupArn,
    );
    expect(described.BackupDescription?.SourceTableDetails?.TableName).toBe(
      table,
    );

    const listed = await client.send(
      new ListBackupsCommand({ TableName: table }),
    );
    const summaries = listed.BackupSummaries ?? [];
    expect(summaries.some((s) => s.BackupArn === backupArn)).toBe(true);

    const deleted = await client.send(
      new DeleteBackupCommand({ BackupArn: backupArn }),
    );
    expect(deleted.BackupDescription?.BackupDetails?.BackupStatus).toBe(
      "DELETED",
    );

    await expect(
      client.send(new DescribeBackupCommand({ BackupArn: backupArn })),
    ).rejects.toThrow();

    const initialPitr = await client.send(
      new DescribeContinuousBackupsCommand({ TableName: table }),
    );
    expect(
      initialPitr.ContinuousBackupsDescription?.ContinuousBackupsStatus,
    ).toBe("ENABLED");
    expect(
      initialPitr.ContinuousBackupsDescription?.PointInTimeRecoveryDescription
        ?.PointInTimeRecoveryStatus,
    ).toBe("DISABLED");

    const updatedPitr = await client.send(
      new UpdateContinuousBackupsCommand({
        TableName: table,
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      }),
    );
    expect(
      updatedPitr.ContinuousBackupsDescription?.PointInTimeRecoveryDescription
        ?.PointInTimeRecoveryStatus,
    ).toBe("ENABLED");

    const afterPitr = await client.send(
      new DescribeContinuousBackupsCommand({ TableName: table }),
    );
    expect(
      afterPitr.ContinuousBackupsDescription?.PointInTimeRecoveryDescription
        ?.PointInTimeRecoveryStatus,
    ).toBe("ENABLED");

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
