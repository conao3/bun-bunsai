import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("DynamoDB backup ops e2e", () => {
  const ddb = () =>
    new DynamoDBClient({ endpoint, region, credentials, requestHandler });
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
