import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddLFTagsToResourceCommand,
  AssumeDecoratedRoleWithSAMLCommand,
  BatchGrantPermissionsCommand,
  BatchRevokePermissionsCommand,
  CancelTransactionCommand,
  CommitTransactionCommand,
  CreateDataCellsFilterCommand,
  CreateLFTagCommand,
  CreateLFTagExpressionCommand,
  CreateLakeFormationIdentityCenterConfigurationCommand,
  CreateLakeFormationOptInCommand,
  DeleteDataCellsFilterCommand,
  DeleteLFTagCommand,
  DeleteLFTagExpressionCommand,
  DeleteLakeFormationIdentityCenterConfigurationCommand,
  DeleteLakeFormationOptInCommand,
  DeleteObjectsOnCancelCommand,
  DeregisterResourceCommand,
  DescribeLakeFormationIdentityCenterConfigurationCommand,
  DescribeResourceCommand,
  DescribeTransactionCommand,
  ExtendTransactionCommand,
  GetDataCellsFilterCommand,
  GetDataLakePrincipalCommand,
  GetDataLakeSettingsCommand,
  GetEffectivePermissionsForPathCommand,
  GetLFTagCommand,
  GetLFTagExpressionCommand,
  GetQueryStateCommand,
  GetQueryStatisticsCommand,
  GetResourceLFTagsCommand,
  GetTableObjectsCommand,
  GetTemporaryDataLocationCredentialsCommand,
  GetTemporaryGluePartitionCredentialsCommand,
  GetTemporaryGlueTableCredentialsCommand,
  GetWorkUnitResultsCommand,
  GetWorkUnitsCommand,
  GrantPermissionsCommand,
  LakeFormationClient,
  ListDataCellsFilterCommand,
  ListLFTagExpressionsCommand,
  ListLFTagsCommand,
  ListLakeFormationOptInsCommand,
  ListPermissionsCommand,
  ListResourcesCommand,
  ListTableStorageOptimizersCommand,
  ListTransactionsCommand,
  PutDataLakeSettingsCommand,
  RegisterResourceCommand,
  RemoveLFTagsFromResourceCommand,
  RevokePermissionsCommand,
  SearchDatabasesByLFTagsCommand,
  SearchTablesByLFTagsCommand,
  StartQueryPlanningCommand,
  StartTransactionCommand,
  UpdateDataCellsFilterCommand,
  UpdateLFTagCommand,
  UpdateLFTagExpressionCommand,
  UpdateLakeFormationIdentityCenterConfigurationCommand,
  UpdateResourceCommand,
  UpdateTableObjectsCommand,
  UpdateTableStorageOptimizerCommand,
} from "@aws-sdk/client-lakeformation";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lakeformation = () =>
  new LakeFormationClient({ endpoint, region, credentials, requestHandler });

const lakeformationNoHostPrefix = () =>
  new LakeFormationClient({
    endpoint,
    region,
    credentials,
    requestHandler,
    disableHostPrefix: true,
  });

test("LakeFormation resource roundtrip", async () => {
  const client = lakeformation();
  const resourceArn = `arn:aws:s3:::bunsai-e2e-${Date.now()}`;

  await client.send(new RegisterResourceCommand({ ResourceArn: resourceArn }));

  const described = await client.send(
    new DescribeResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(described.ResourceInfo?.ResourceArn).toBe(resourceArn);

  const listed = await client.send(new ListResourcesCommand({}));
  expect(
    (listed.ResourceInfoList ?? []).map((info) => info.ResourceArn),
  ).toContain(resourceArn);

  await client.send(
    new DeregisterResourceCommand({ ResourceArn: resourceArn }),
  );

  await expect(
    client.send(new DescribeResourceCommand({ ResourceArn: resourceArn })),
  ).rejects.toThrow();
});

test("LakeFormation UpdateResource", async () => {
  const client = lakeformation();
  const resourceArn = `arn:aws:s3:::bunsai-update-${Date.now()}`;

  await client.send(new RegisterResourceCommand({ ResourceArn: resourceArn }));
  await client.send(
    new UpdateResourceCommand({
      ResourceArn: resourceArn,
      RoleArn: "arn:aws:iam::123456789012:role/test",
    }),
  );
  const described = await client.send(
    new DescribeResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(described.ResourceInfo?.RoleArn).toBe(
    "arn:aws:iam::123456789012:role/test",
  );
  await client.send(
    new DeregisterResourceCommand({ ResourceArn: resourceArn }),
  );
});

test("LakeFormation LF tag roundtrip", async () => {
  const client = lakeformation();
  const tagKey = `e2e-tag-${Date.now()}`;

  await client.send(
    new CreateLFTagCommand({ TagKey: tagKey, TagValues: ["val1", "val2"] }),
  );

  const got = await client.send(new GetLFTagCommand({ TagKey: tagKey }));
  expect(got.TagKey).toBe(tagKey);
  expect(got.TagValues).toContain("val1");

  await client.send(
    new UpdateLFTagCommand({
      TagKey: tagKey,
      TagValuesToAdd: ["val3"],
      TagValuesToDelete: ["val1"],
    }),
  );

  const updated = await client.send(new GetLFTagCommand({ TagKey: tagKey }));
  expect(updated.TagValues).toContain("val3");
  expect(updated.TagValues).not.toContain("val1");

  const listed = await client.send(new ListLFTagsCommand({}));
  expect((listed.LFTags ?? []).map((t) => t.TagKey)).toContain(tagKey);

  await client.send(new DeleteLFTagCommand({ TagKey: tagKey }));

  await expect(
    client.send(new GetLFTagCommand({ TagKey: tagKey })),
  ).rejects.toThrow();
});

test("LakeFormation LF tag expression roundtrip", async () => {
  const client = lakeformation();
  const name = `e2e-expr-${Date.now()}`;

  await client.send(
    new CreateLFTagExpressionCommand({
      Name: name,
      Description: "test expr",
      Expression: [{ TagKey: "env", TagValues: ["prod"] }],
    }),
  );

  const got = await client.send(new GetLFTagExpressionCommand({ Name: name }));
  expect(got.Name).toBe(name);
  expect(got.Description).toBe("test expr");

  await client.send(
    new UpdateLFTagExpressionCommand({
      Name: name,
      Description: "updated",
      Expression: [{ TagKey: "env", TagValues: ["dev"] }],
    }),
  );

  const updated = await client.send(
    new GetLFTagExpressionCommand({ Name: name }),
  );
  expect(updated.Description).toBe("updated");

  const listed = await client.send(new ListLFTagExpressionsCommand({}));
  expect((listed.LFTagExpressions ?? []).map((e) => e.Name)).toContain(name);

  await client.send(new DeleteLFTagExpressionCommand({ Name: name }));

  await expect(
    client.send(new GetLFTagExpressionCommand({ Name: name })),
  ).rejects.toThrow();
});

test("LakeFormation AddLFTagsToResource / RemoveLFTagsFromResource / GetResourceLFTags", async () => {
  const client = lakeformation();
  const resource = { Database: { Name: `e2e-db-${Date.now()}` } };

  const added = await client.send(
    new AddLFTagsToResourceCommand({
      Resource: resource,
      LFTags: [{ TagKey: "env", TagValues: ["prod"] }],
    }),
  );
  expect(added.Failures).toHaveLength(0);

  const removed = await client.send(
    new RemoveLFTagsFromResourceCommand({
      Resource: resource,
      LFTags: [{ TagKey: "env", TagValues: ["prod"] }],
    }),
  );
  expect(removed.Failures).toHaveLength(0);

  const tagged = await client.send(
    new GetResourceLFTagsCommand({ Resource: resource }),
  );
  expect(tagged.LFTagOnDatabase).toBeDefined();
});

test("LakeFormation data cells filter roundtrip", async () => {
  const client = lakeformation();
  const filterName = `e2e-dcf-${Date.now()}`;
  const dbName = `e2e-db-${Date.now()}`;
  const tableName = `e2e-tbl-${Date.now()}`;

  await client.send(
    new CreateDataCellsFilterCommand({
      TableData: {
        TableCatalogId: "123456789012",
        DatabaseName: dbName,
        TableName: tableName,
        Name: filterName,
        RowFilter: { AllRowsWildcard: {} },
      },
    }),
  );

  const got = await client.send(
    new GetDataCellsFilterCommand({
      TableCatalogId: "123456789012",
      DatabaseName: dbName,
      TableName: tableName,
      Name: filterName,
    }),
  );
  expect(got.DataCellsFilter?.Name).toBe(filterName);

  await client.send(
    new UpdateDataCellsFilterCommand({
      TableData: {
        TableCatalogId: "123456789012",
        DatabaseName: dbName,
        TableName: tableName,
        Name: filterName,
        RowFilter: { FilterExpression: "col > 0" },
      },
    }),
  );

  const listed = await client.send(new ListDataCellsFilterCommand({}));
  expect((listed.DataCellsFilters ?? []).map((f) => f.Name)).toContain(
    filterName,
  );

  await client.send(
    new DeleteDataCellsFilterCommand({
      TableCatalogId: "123456789012",
      DatabaseName: dbName,
      TableName: tableName,
      Name: filterName,
    }),
  );

  await expect(
    client.send(
      new GetDataCellsFilterCommand({
        TableCatalogId: "123456789012",
        DatabaseName: dbName,
        TableName: tableName,
        Name: filterName,
      }),
    ),
  ).rejects.toThrow();
});

test("LakeFormation permissions roundtrip", async () => {
  const client = lakeformation();
  const principal = {
    DataLakePrincipalIdentifier: "arn:aws:iam::123456789012:role/test",
  };
  const resource = { Database: { Name: `e2e-permdb-${Date.now()}` } };

  await client.send(
    new GrantPermissionsCommand({
      Principal: principal,
      Resource: resource,
      Permissions: ["DESCRIBE"],
    }),
  );

  const listed = await client.send(new ListPermissionsCommand({}));
  expect(listed.PrincipalResourcePermissions?.length).toBeGreaterThan(0);

  await client.send(
    new RevokePermissionsCommand({
      Principal: principal,
      Resource: resource,
      Permissions: ["DESCRIBE"],
    }),
  );
});

test("LakeFormation batch permissions", async () => {
  const client = lakeformation();

  const batchGrant = await client.send(
    new BatchGrantPermissionsCommand({
      Entries: [
        {
          Id: "entry1",
          Principal: {
            DataLakePrincipalIdentifier:
              "arn:aws:iam::123456789012:role/batch-test",
          },
          Resource: { Database: { Name: `e2e-batchdb-${Date.now()}` } },
          Permissions: ["DESCRIBE"],
        },
      ],
    }),
  );
  expect(batchGrant.Failures).toHaveLength(0);

  const batchRevoke = await client.send(
    new BatchRevokePermissionsCommand({
      Entries: [
        {
          Id: "entry1",
          Principal: {
            DataLakePrincipalIdentifier:
              "arn:aws:iam::123456789012:role/batch-test",
          },
          Resource: { Database: { Name: `e2e-batchdb-revoke-${Date.now()}` } },
          Permissions: ["DESCRIBE"],
        },
      ],
    }),
  );
  expect(batchRevoke.Failures).toHaveLength(0);
});

test("LakeFormation GetEffectivePermissionsForPath", async () => {
  const client = lakeformation();
  const resourceArn = `arn:aws:s3:::bunsai-eff-${Date.now()}`;

  await client.send(new RegisterResourceCommand({ ResourceArn: resourceArn }));
  const result = await client.send(
    new GetEffectivePermissionsForPathCommand({ ResourceArn: resourceArn }),
  );
  expect(result.Permissions).toBeDefined();
  await client.send(
    new DeregisterResourceCommand({ ResourceArn: resourceArn }),
  );
});

test("LakeFormation transaction roundtrip", async () => {
  const client = lakeformation();

  const started = await client.send(
    new StartTransactionCommand({ TransactionType: "READ_AND_WRITE" }),
  );
  const transactionId = started.TransactionId!;
  expect(transactionId).toBeTruthy();

  const described = await client.send(
    new DescribeTransactionCommand({ TransactionId: transactionId }),
  );
  expect(described.TransactionDescription?.TransactionStatus).toBe("ACTIVE");

  await client.send(
    new ExtendTransactionCommand({ TransactionId: transactionId }),
  );

  const committed = await client.send(
    new CommitTransactionCommand({ TransactionId: transactionId }),
  );
  expect(committed.TransactionStatus).toBe("COMMITTED");

  const listed = await client.send(new ListTransactionsCommand({}));
  expect((listed.Transactions ?? []).map((t) => t.TransactionId)).toContain(
    transactionId,
  );
});

test("LakeFormation cancel transaction", async () => {
  const client = lakeformation();

  const started = await client.send(new StartTransactionCommand({}));
  const transactionId = started.TransactionId!;

  await client.send(
    new CancelTransactionCommand({ TransactionId: transactionId }),
  );

  const described = await client.send(
    new DescribeTransactionCommand({ TransactionId: transactionId }),
  );
  expect(described.TransactionDescription?.TransactionStatus).toBe("ABORTED");
});

test("LakeFormation DeleteObjectsOnCancel", async () => {
  const client = lakeformation();
  const started = await client.send(new StartTransactionCommand({}));
  const transactionId = started.TransactionId!;

  await client.send(
    new DeleteObjectsOnCancelCommand({
      DatabaseName: "test-db",
      TableName: "test-table",
      TransactionId: transactionId,
      Objects: [],
    }),
  );
});

test("LakeFormation UpdateTableObjects", async () => {
  const client = lakeformation();
  const started = await client.send(new StartTransactionCommand({}));
  const transactionId = started.TransactionId!;

  await client.send(
    new UpdateTableObjectsCommand({
      DatabaseName: "test-db",
      TableName: "test-table",
      TransactionId: transactionId,
      WriteOperations: [],
    }),
  );
});

test("LakeFormation GetTableObjects", async () => {
  const client = lakeformation();
  const result = await client.send(
    new GetTableObjectsCommand({
      DatabaseName: "test-db",
      TableName: "test-table",
    }),
  );
  expect(result.Objects).toHaveLength(0);
});

test("LakeFormation data lake settings roundtrip", async () => {
  const client = lakeformation();

  const settings = await client.send(new GetDataLakeSettingsCommand({}));
  expect(settings.DataLakeSettings).toBeDefined();

  await client.send(
    new PutDataLakeSettingsCommand({
      DataLakeSettings: {
        DataLakeAdmins: [
          {
            DataLakePrincipalIdentifier: "arn:aws:iam::123456789012:role/admin",
          },
        ],
      },
    }),
  );

  const updated = await client.send(new GetDataLakeSettingsCommand({}));
  expect(
    (updated.DataLakeSettings?.DataLakeAdmins ?? []).map(
      (p) => p.DataLakePrincipalIdentifier,
    ),
  ).toContain("arn:aws:iam::123456789012:role/admin");
});

test("LakeFormation GetDataLakePrincipal", async () => {
  const client = lakeformation();
  const result = await client.send(new GetDataLakePrincipalCommand({}));
  expect(result.Identity).toBeTruthy();
});

test("LakeFormation identity center configuration roundtrip", async () => {
  const client = lakeformation();
  const catalogId = `123456789${Date.now().toString().slice(-3)}`;

  const created = await client.send(
    new CreateLakeFormationIdentityCenterConfigurationCommand({
      CatalogId: catalogId,
      InstanceArn: "arn:aws:sso:::instance/ssoins-abc123",
    }),
  );
  expect(created.ApplicationArn).toBeTruthy();

  const described = await client.send(
    new DescribeLakeFormationIdentityCenterConfigurationCommand({
      CatalogId: catalogId,
    }),
  );
  expect(described.ApplicationArn).toBeTruthy();

  await client.send(
    new UpdateLakeFormationIdentityCenterConfigurationCommand({
      CatalogId: catalogId,
      ApplicationStatus: "ENABLED",
    }),
  );

  await client.send(
    new DeleteLakeFormationIdentityCenterConfigurationCommand({
      CatalogId: catalogId,
    }),
  );

  await expect(
    client.send(
      new DescribeLakeFormationIdentityCenterConfigurationCommand({
        CatalogId: catalogId,
      }),
    ),
  ).rejects.toThrow();
});

test("LakeFormation opt-in roundtrip", async () => {
  const client = lakeformation();
  const principal = {
    DataLakePrincipalIdentifier: `arn:aws:iam::123456789012:role/optin-${Date.now()}`,
  };
  const resource = { Database: { Name: `e2e-optindb-${Date.now()}` } };

  await client.send(
    new CreateLakeFormationOptInCommand({
      Principal: principal,
      Resource: resource,
    }),
  );

  const listed = await client.send(new ListLakeFormationOptInsCommand({}));
  expect((listed.LakeFormationOptInsInfoList ?? []).length).toBeGreaterThan(0);

  await client.send(
    new DeleteLakeFormationOptInCommand({
      Principal: principal,
      Resource: resource,
    }),
  );
});

test("LakeFormation temporary credentials", async () => {
  const client = lakeformation();

  const dataLoc = await client.send(
    new GetTemporaryDataLocationCredentialsCommand({
      DataLocations: ["s3://bucket/prefix"],
      DurationSeconds: 900,
    }),
  );
  expect(dataLoc.Credentials?.AccessKeyId).toBeTruthy();

  const glueTable = await client.send(
    new GetTemporaryGlueTableCredentialsCommand({
      TableArn: "arn:aws:glue:us-east-1:123456789012:table/test-db/test-table",
      SupportedPermissionTypes: ["COLUMN_PERMISSION"],
    }),
  );
  expect(glueTable.AccessKeyId).toBeTruthy();

  const gluePartition = await client.send(
    new GetTemporaryGluePartitionCredentialsCommand({
      TableArn: "arn:aws:glue:us-east-1:123456789012:table/test-db/test-table",
      Partition: { Values: ["2023-01-01"] },
      SupportedPermissionTypes: ["COLUMN_PERMISSION"],
    }),
  );
  expect(gluePartition.AccessKeyId).toBeTruthy();
});

test("LakeFormation AssumeDecoratedRoleWithSAML", async () => {
  const client = lakeformation();
  const result = await client.send(
    new AssumeDecoratedRoleWithSAMLCommand({
      SAMLAssertion: "base64assertion==",
      RoleArn: "arn:aws:iam::123456789012:role/saml-role",
      PrincipalArn: "arn:aws:iam::123456789012:saml-provider/test",
    }),
  );
  expect(result.AccessKeyId).toBeTruthy();
});

test("LakeFormation table storage optimizers", async () => {
  const client = lakeformation();

  const listed = await client.send(
    new ListTableStorageOptimizersCommand({
      DatabaseName: "test-db",
      TableName: "test-table",
    }),
  );
  expect(listed.StorageOptimizerList).toHaveLength(0);

  const updated = await client.send(
    new UpdateTableStorageOptimizerCommand({
      DatabaseName: "test-db",
      TableName: "test-table",
      StorageOptimizerConfig: {},
    }),
  );
  expect(updated.Result).toBe("SUCCESS");
});

test("LakeFormation query planning roundtrip", async () => {
  const client = lakeformationNoHostPrefix();

  const started = await client.send(
    new StartQueryPlanningCommand({
      QueryPlanningContext: { DatabaseName: "test-db" },
      QueryString: "SELECT * FROM test_table",
    }),
  );
  const queryId = started.QueryId!;
  expect(queryId).toBeTruthy();

  const state = await client.send(
    new GetQueryStateCommand({ QueryId: queryId }),
  );
  expect(state.State).toBe("FINISHED");

  const stats = await client.send(
    new GetQueryStatisticsCommand({ QueryId: queryId }),
  );
  expect(stats.ExecutionStatistics).toBeDefined();

  const workUnits = await client.send(
    new GetWorkUnitsCommand({ QueryId: queryId }),
  );
  expect(workUnits.WorkUnitRanges?.length).toBeGreaterThan(0);

  const results = await client.send(
    new GetWorkUnitResultsCommand({
      QueryId: queryId,
      WorkUnitId: 0,
      WorkUnitToken: "token",
    }),
  );
  expect(results).toBeDefined();
});

test("LakeFormation search by LF tags", async () => {
  const client = lakeformation();

  const dbs = await client.send(
    new SearchDatabasesByLFTagsCommand({
      Expression: [{ TagKey: "env", TagValues: ["prod"] }],
    }),
  );
  expect(dbs.DatabaseList).toHaveLength(0);

  const tables = await client.send(
    new SearchTablesByLFTagsCommand({
      Expression: [{ TagKey: "env", TagValues: ["prod"] }],
    }),
  );
  expect(tables.TableList).toHaveLength(0);
});
