import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelCommandCommand,
  CreateActivationCommand,
  CreateAssociationCommand,
  CreateDocumentCommand,
  CreateMaintenanceWindowCommand,
  CreateOpsItemCommand,
  CreateOpsMetadataCommand,
  CreatePatchBaselineCommand,
  CreateResourceDataSyncCommand,
  DeleteActivationCommand,
  DeleteAssociationCommand,
  DeleteDocumentCommand,
  DeleteMaintenanceWindowCommand,
  DeleteOpsMetadataCommand,
  DeleteParameterCommand,
  DeletePatchBaselineCommand,
  DeleteResourceDataSyncCommand,
  DescribeActivationsCommand,
  DescribeAssociationCommand,
  DescribeOpsItemsCommand,
  DescribeParametersCommand,
  GetCommandInvocationCommand,
  GetDocumentCommand,
  GetMaintenanceWindowCommand,
  GetOpsItemCommand,
  GetOpsMetadataCommand,
  GetParameterCommand,
  GetParameterHistoryCommand,
  GetParametersByPathCommand,
  GetParametersCommand,
  GetPatchBaselineCommand,
  LabelParameterVersionCommand,
  ListCommandInvocationsCommand,
  ListCommandsCommand,
  ListResourceDataSyncCommand,
  PutParameterCommand,
  RegisterTargetWithMaintenanceWindowCommand,
  RegisterTaskWithMaintenanceWindowCommand,
  SendCommandCommand,
  SSMClient,
  UpdateOpsItemCommand,
} from "@aws-sdk/client-ssm";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ssm e2e", () => {
  const ssm = () =>
    new SSMClient({ endpoint, region, credentials, requestHandler });

  test("Parameter lifecycle round-trips through the real SDK", async () => {
    const client = ssm();
    const name = "/bunsai/e2e/param";
    const value = "bunsai-e2e-value";

    const put = await client.send(
      new PutParameterCommand({ Name: name, Value: value, Type: "String" }),
    );
    expect(put.Version).toBe(1);

    const got = await client.send(new GetParameterCommand({ Name: name }));
    expect(got.Parameter?.Name).toBe(name);
    expect(got.Parameter?.Value).toBe(value);
    expect(got.Parameter?.Type).toBe("String");
    expect(got.Parameter?.Version).toBe(1);

    const updated = await client.send(
      new PutParameterCommand({
        Name: name,
        Value: "v2",
        Type: "String",
        Overwrite: true,
      }),
    );
    expect(updated.Version).toBe(2);

    const second = "/bunsai/e2e/other";
    await client.send(
      new PutParameterCommand({ Name: second, Value: "x", Type: "String" }),
    );

    const batch = await client.send(
      new GetParametersCommand({ Names: [name, second, "/bunsai/missing"] }),
    );
    const batchNames = (batch.Parameters ?? []).map((p) => p.Name).sort();
    expect(batchNames).toEqual([second, name].sort());
    expect(batch.InvalidParameters).toContain("/bunsai/missing");

    const byPath = await client.send(
      new GetParametersByPathCommand({ Path: "/bunsai/e2e", Recursive: true }),
    );
    const pathNames = (byPath.Parameters ?? []).map((p) => p.Name).sort();
    expect(pathNames).toEqual([second, name].sort());

    const described = await client.send(new DescribeParametersCommand({}));
    const describedNames = (described.Parameters ?? []).map((p) => p.Name);
    expect(describedNames).toContain(name);
    expect(describedNames).toContain(second);

    await client.send(new DeleteParameterCommand({ Name: name }));
    await expect(
      client.send(new GetParameterCommand({ Name: name })),
    ).rejects.toThrow();

    await client.send(new DeleteParameterCommand({ Name: second }));
  });

  test("Document lifecycle", async () => {
    const client = ssm();
    const docName = "BunsaiE2ETestDoc";

    const created = await client.send(
      new CreateDocumentCommand({
        Name: docName,
        Content: "{}",
        DocumentType: "Command",
      }),
    );
    expect(created.DocumentDescription?.Name).toBe(docName);
    expect(created.DocumentDescription?.Status).toBe("Active");

    const got = await client.send(new GetDocumentCommand({ Name: docName }));
    expect(got.Name).toBe(docName);
    expect(got.Status).toBe("Active");

    await client.send(new DeleteDocumentCommand({ Name: docName }));
    await expect(
      client.send(new GetDocumentCommand({ Name: docName })),
    ).rejects.toThrow();
  });

  test("Association lifecycle", async () => {
    const client = ssm();

    const created = await client.send(
      new CreateAssociationCommand({
        Name: "AWS-RunShellScript",
        AssociationName: "BunsaiE2EAssoc",
      }),
    );
    const assocId = created.AssociationDescription?.AssociationId;
    expect(typeof assocId).toBe("string");
    expect(created.AssociationDescription?.Name).toBe("AWS-RunShellScript");

    const described = await client.send(
      new DescribeAssociationCommand({ AssociationId: assocId }),
    );
    expect(described.AssociationDescription?.AssociationId).toBe(assocId);

    await client.send(new DeleteAssociationCommand({ AssociationId: assocId }));
  });

  test("Maintenance Window lifecycle", async () => {
    const client = ssm();

    const win = await client.send(
      new CreateMaintenanceWindowCommand({
        Name: "BunsaiE2EWin",
        Schedule: "cron(0 0 * * ? *)",
        Duration: 2,
        Cutoff: 1,
        AllowUnassociatedTargets: false,
      }),
    );
    const windowId = win.WindowId;
    expect(typeof windowId).toBe("string");

    await client.send(
      new RegisterTargetWithMaintenanceWindowCommand({
        WindowId: windowId!,
        ResourceType: "INSTANCE",
        Targets: [{ Key: "InstanceIds", Values: ["i-test"] }],
      }),
    );

    await client.send(
      new RegisterTaskWithMaintenanceWindowCommand({
        WindowId: windowId!,
        TaskArn: "AWS-RunShellScript",
        TaskType: "RUN_COMMAND",
        Targets: [{ Key: "WindowTargetIds", Values: ["*"] }],
        MaxConcurrency: "1",
        MaxErrors: "1",
      }),
    );

    const got = await client.send(
      new GetMaintenanceWindowCommand({ WindowId: windowId! }),
    );
    expect(got.WindowId).toBe(windowId);
    expect(got.Name).toBe("BunsaiE2EWin");

    await client.send(
      new DeleteMaintenanceWindowCommand({ WindowId: windowId! }),
    );
  });

  test("Patch Baseline lifecycle", async () => {
    const client = ssm();

    const created = await client.send(
      new CreatePatchBaselineCommand({
        Name: "BunsaiE2EBaseline",
        OperatingSystem: "WINDOWS",
      }),
    );
    const baselineId = created.BaselineId;
    expect(typeof baselineId).toBe("string");

    const got = await client.send(
      new GetPatchBaselineCommand({ BaselineId: baselineId! }),
    );
    expect(got.BaselineId).toBe(baselineId);
    expect(got.Name).toBe("BunsaiE2EBaseline");

    await client.send(
      new DeletePatchBaselineCommand({ BaselineId: baselineId! }),
    );
  });

  test("OpsItem lifecycle", async () => {
    const client = ssm();

    const created = await client.send(
      new CreateOpsItemCommand({
        Title: "BunsaiE2EOpsItem",
        Source: "e2e-test",
        Description: "test",
      }),
    );
    const opsItemId = created.OpsItemId;
    expect(typeof opsItemId).toBe("string");

    const got = await client.send(
      new GetOpsItemCommand({ OpsItemId: opsItemId! }),
    );
    expect(got.OpsItem?.OpsItemId).toBe(opsItemId);
    expect(got.OpsItem?.Title).toBe("BunsaiE2EOpsItem");

    await client.send(
      new UpdateOpsItemCommand({ OpsItemId: opsItemId!, Status: "Resolved" }),
    );

    const described = await client.send(
      new DescribeOpsItemsCommand({
        OpsItemFilters: [
          { Key: "OpsItemId", Values: [opsItemId!], Operator: "Equal" },
        ],
      }),
    );
    expect(described.OpsItemSummaries?.length).toBeGreaterThan(0);
  });

  test("OpsMetadata lifecycle", async () => {
    const client = ssm();
    const resourceId = "arn:aws:e2e:us-east-1:123456789012:resource/bunsai-e2e";

    const created = await client.send(
      new CreateOpsMetadataCommand({ ResourceId: resourceId }),
    );
    const opsMetadataArn = created.OpsMetadataArn;
    expect(typeof opsMetadataArn).toBe("string");

    const got = await client.send(
      new GetOpsMetadataCommand({ OpsMetadataArn: opsMetadataArn! }),
    );
    expect(got.ResourceId).toBe(resourceId);

    await client.send(
      new DeleteOpsMetadataCommand({ OpsMetadataArn: opsMetadataArn! }),
    );
  });

  test("Activation lifecycle", async () => {
    const client = ssm();

    const created = await client.send(
      new CreateActivationCommand({
        IamRole: "arn:aws:iam::123456789012:role/e2e",
        Description: "e2e-activation",
        RegistrationLimit: 5,
      }),
    );
    expect(typeof created.ActivationId).toBe("string");
    expect(typeof created.ActivationCode).toBe("string");

    const listed = await client.send(new DescribeActivationsCommand({}));
    const found = listed.ActivationList?.some(
      (a) => a.ActivationId === created.ActivationId,
    );
    expect(found).toBe(true);

    await client.send(
      new DeleteActivationCommand({ ActivationId: created.ActivationId! }),
    );
  });

  test("ResourceDataSync lifecycle", async () => {
    const client = ssm();
    const syncName = "BunsaiE2ESync";

    await client.send(
      new CreateResourceDataSyncCommand({
        SyncName: syncName,
        S3Destination: {
          BucketName: "e2e-bucket",
          Region: "us-east-1",
          SyncFormat: "JsonSerDe",
        },
      }),
    );

    const listed = await client.send(new ListResourceDataSyncCommand({}));
    const found = listed.ResourceDataSyncItems?.some(
      (s) => s.SyncName === syncName,
    );
    expect(found).toBe(true);

    await client.send(
      new DeleteResourceDataSyncCommand({ SyncName: syncName }),
    );
  });

  test("Parameter version and label selectors", async () => {
    const client = ssm();
    const name = "/bunsai/e2e/versioned";

    const v1 = await client.send(
      new PutParameterCommand({
        Name: name,
        Value: "value-v1",
        Type: "String",
      }),
    );
    expect(v1.Version).toBe(1);

    const v2 = await client.send(
      new PutParameterCommand({
        Name: name,
        Value: "value-v2",
        Type: "String",
        Overwrite: true,
      }),
    );
    expect(v2.Version).toBe(2);

    const byV1 = await client.send(
      new GetParameterCommand({ Name: `${name}:1` }),
    );
    expect(byV1.Parameter?.Value).toBe("value-v1");
    expect(byV1.Parameter?.Version).toBe(1);

    const bare = await client.send(new GetParameterCommand({ Name: name }));
    expect(bare.Parameter?.Value).toBe("value-v2");
    expect(bare.Parameter?.Version).toBe(2);

    await client.send(
      new LabelParameterVersionCommand({
        Name: name,
        ParameterVersion: 1,
        Labels: ["stable"],
      }),
    );

    const byLabel = await client.send(
      new GetParameterCommand({ Name: `${name}:stable` }),
    );
    expect(byLabel.Parameter?.Value).toBe("value-v1");
    expect(byLabel.Parameter?.Version).toBe(1);

    const history = await client.send(
      new GetParameterHistoryCommand({ Name: name }),
    );
    expect(history.Parameters?.length).toBe(2);
    const histV1 = history.Parameters?.find((p) => p.Version === 1);
    expect(histV1?.Labels).toContain("stable");

    const batchBySelector = await client.send(
      new GetParametersCommand({ Names: [`${name}:1`, `${name}:2`] }),
    );
    expect(batchBySelector.Parameters?.length).toBe(2);
    const batchV1 = batchBySelector.Parameters?.find((p) => p.Version === 1);
    const batchV2 = batchBySelector.Parameters?.find((p) => p.Version === 2);
    expect(batchV1?.Value).toBe("value-v1");
    expect(batchV2?.Value).toBe("value-v2");

    await client.send(new DeleteParameterCommand({ Name: name }));
  });

  test("SecureString WithDecryption toggle", async () => {
    const client = ssm();
    const name = "/bunsai/e2e/secure";
    const plaintext = "my-secret-value";

    await client.send(
      new PutParameterCommand({
        Name: name,
        Value: plaintext,
        Type: "SecureString",
      }),
    );

    const decrypted = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    expect(decrypted.Parameter?.Value).toBe(plaintext);
    expect(decrypted.Parameter?.Type).toBe("SecureString");

    const encrypted = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: false }),
    );
    expect(encrypted.Parameter?.Value).not.toBe(plaintext);
    expect(encrypted.Parameter?.Type).toBe("SecureString");

    const batchDecrypted = await client.send(
      new GetParametersCommand({ Names: [name], WithDecryption: true }),
    );
    expect(batchDecrypted.Parameters?.[0]?.Value).toBe(plaintext);

    const batchEncrypted = await client.send(
      new GetParametersCommand({ Names: [name], WithDecryption: false }),
    );
    expect(batchEncrypted.Parameters?.[0]?.Value).not.toBe(plaintext);

    await client.send(new DeleteParameterCommand({ Name: name }));
  });

  test("GetParametersByPath hierarchy recursive and pagination", async () => {
    const client = ssm();
    const prefix = `/bunsai/e2e/hier/${Date.now()}`;
    const pathAbc = `${prefix}/a/b/c`;
    const pathAd = `${prefix}/a/d`;

    await client.send(
      new PutParameterCommand({ Name: pathAbc, Value: "abc", Type: "String" }),
    );
    await client.send(
      new PutParameterCommand({ Name: pathAd, Value: "ad", Type: "String" }),
    );

    const nonRecursive = await client.send(
      new GetParametersByPathCommand({
        Path: `${prefix}/a`,
        Recursive: false,
      }),
    );
    const nonRecNames = (nonRecursive.Parameters ?? []).map((p) => p.Name);
    expect(nonRecNames).toContain(pathAd);
    expect(nonRecNames).not.toContain(pathAbc);
    expect(nonRecNames.length).toBe(1);

    const recursive = await client.send(
      new GetParametersByPathCommand({
        Path: `${prefix}/a`,
        Recursive: true,
      }),
    );
    const recNames = (recursive.Parameters ?? []).map((p) => p.Name).sort();
    expect(recNames).toEqual([pathAbc, pathAd].sort());

    const page1 = await client.send(
      new GetParametersByPathCommand({
        Path: `${prefix}/a`,
        Recursive: true,
        MaxResults: 1,
      }),
    );
    expect(page1.Parameters?.length).toBe(1);
    expect(typeof page1.NextToken).toBe("string");

    const page2 = await client.send(
      new GetParametersByPathCommand({
        Path: `${prefix}/a`,
        Recursive: true,
        MaxResults: 1,
        NextToken: page1.NextToken,
      }),
    );
    expect(page2.Parameters?.length).toBe(1);
    expect(page2.NextToken).toBeUndefined();

    const allNames = [
      ...(page1.Parameters ?? []).map((p) => p.Name),
      ...(page2.Parameters ?? []).map((p) => p.Name),
    ].sort();
    expect(allNames).toEqual([pathAbc, pathAd].sort());

    await client.send(new DeleteParameterCommand({ Name: pathAbc }));
    await client.send(new DeleteParameterCommand({ Name: pathAd }));
  });

  test("GetParametersByPath ParameterFilters by Type and Name", async () => {
    const client = ssm();
    const prefix = `/bunsai/e2e/filterhier/${Date.now()}`;
    const pStr = `${prefix}/str`;
    const pSec = `${prefix}/sec`;

    await client.send(
      new PutParameterCommand({ Name: pStr, Value: "v1", Type: "String" }),
    );
    await client.send(
      new PutParameterCommand({
        Name: pSec,
        Value: "v2",
        Type: "SecureString",
      }),
    );

    const filterByType = await client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        Recursive: true,
        ParameterFilters: [
          { Key: "Type", Option: "Equals", Values: ["String"] },
        ],
      }),
    );
    const typeNames = (filterByType.Parameters ?? []).map((p) => p.Name);
    expect(typeNames).toContain(pStr);
    expect(typeNames).not.toContain(pSec);

    const filterByName = await client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        Recursive: true,
        ParameterFilters: [
          { Key: "Name", Option: "BeginsWith", Values: [`${prefix}/sec`] },
        ],
      }),
    );
    const nameResults = (filterByName.Parameters ?? []).map((p) => p.Name);
    expect(nameResults).toContain(pSec);
    expect(nameResults).not.toContain(pStr);

    await client.send(new DeleteParameterCommand({ Name: pStr }));
    await client.send(new DeleteParameterCommand({ Name: pSec }));
  });

  test("SendCommand and GetCommandInvocation lifecycle", async () => {
    const client = ssm();
    const instanceId = "i-0abcdef1234567890";

    const sent = await client.send(
      new SendCommandCommand({
        DocumentName: "AWS-RunShellScript",
        InstanceIds: [instanceId],
        Comment: "e2e-test",
      }),
    );
    const commandId = sent.Command?.CommandId;
    expect(typeof commandId).toBe("string");
    expect(sent.Command?.DocumentName).toBe("AWS-RunShellScript");

    const invocation = await client.send(
      new GetCommandInvocationCommand({
        CommandId: commandId!,
        InstanceId: instanceId,
      }),
    );
    expect(invocation.CommandId).toBe(commandId);
    expect(invocation.InstanceId).toBe(instanceId);
    expect(invocation.Status).toBe("Success");

    const commands = await client.send(new ListCommandsCommand({}));
    expect(commands.Commands?.some((c) => c.CommandId === commandId)).toBe(
      true,
    );

    const invocations = await client.send(
      new ListCommandInvocationsCommand({ CommandId: commandId! }),
    );
    expect(invocations.CommandInvocations?.length).toBeGreaterThan(0);

    await client.send(new CancelCommandCommand({ CommandId: commandId! }));
  });
});
