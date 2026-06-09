import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateAssetsCommand,
  BatchAssociateProjectAssetsCommand,
  BatchPutAssetPropertyValueCommand,
  CreateAccessPolicyCommand,
  CreateAssetCommand,
  CreateAssetModelCommand,
  CreateDashboardCommand,
  CreateDatasetCommand,
  CreateGatewayCommand,
  CreatePortalCommand,
  CreateProjectCommand,
  DeleteAssetModelCommand,
  DescribeAccessPolicyCommand,
  DescribeAssetCommand,
  DescribeAssetModelCommand,
  DescribeDashboardCommand,
  DescribeDatasetCommand,
  DescribeGatewayCommand,
  DescribePortalCommand,
  DescribeProjectCommand,
  GetAssetPropertyValueCommand,
  GetAssetPropertyValueHistoryCommand,
  IoTSiteWiseClient,
  ListAccessPoliciesCommand,
  ListAssetsCommand,
  ListAssociatedAssetsCommand,
  ListAssetModelsCommand,
  ListDashboardsCommand,
  ListDatasetsCommand,
  ListGatewaysCommand,
  ListPortalsCommand,
  ListProjectAssetsCommand,
  ListProjectsCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
} from "@aws-sdk/client-iotsitewise";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iotsitewise = () =>
  new IoTSiteWiseClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("IoTSiteWise asset model roundtrip", async () => {
  const client = iotsitewise();
  const modelName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateAssetModelCommand({
      assetModelName: modelName,
      assetModelDescription: "bunsai e2e asset model",
    }),
  );
  expect(created.assetModelId).toBeDefined();
  expect(created.assetModelArn).toBeDefined();
  expect(created.assetModelStatus?.state).toBe("CREATING");
  const assetModelId = created.assetModelId ?? "";

  const described = await client.send(
    new DescribeAssetModelCommand({ assetModelId }),
  );
  expect(described.assetModelId).toBe(assetModelId);
  expect(described.assetModelName).toBe(modelName);
  expect(described.assetModelDescription).toBe("bunsai e2e asset model");
  expect(described.assetModelStatus?.state).toBe("ACTIVE");

  const listed = await client.send(new ListAssetModelsCommand({}));
  expect(
    (listed.assetModelSummaries ?? []).map((summary) => summary.id),
  ).toContain(assetModelId);

  const deleted = await client.send(
    new DeleteAssetModelCommand({ assetModelId }),
  );
  expect(deleted.assetModelStatus?.state).toBe("DELETING");

  await expect(
    client.send(new DescribeAssetModelCommand({ assetModelId })),
  ).rejects.toThrow();
});

test("IoTSiteWise asset lifecycle with association", async () => {
  const client = iotsitewise();

  const model = await client.send(
    new CreateAssetModelCommand({ assetModelName: `model-${Date.now()}` }),
  );
  const assetModelId = model.assetModelId ?? "";

  const parent = await client.send(
    new CreateAssetCommand({ assetName: "parent-asset", assetModelId }),
  );
  expect(parent.assetId).toBeDefined();
  expect(parent.assetArn).toBeDefined();
  expect(parent.assetStatus?.state).toBe("CREATING");
  const parentId = parent.assetId ?? "";

  const child = await client.send(
    new CreateAssetCommand({ assetName: "child-asset", assetModelId }),
  );
  const childId = child.assetId ?? "";

  const described = await client.send(
    new DescribeAssetCommand({ assetId: parentId }),
  );
  expect(described.assetId).toBe(parentId);
  expect(described.assetName).toBe("parent-asset");
  expect(described.assetModelId).toBe(assetModelId);

  const listedAll = await client.send(new ListAssetsCommand({}));
  expect((listedAll.assetSummaries ?? []).map((s) => s.id)).toContain(parentId);

  await client.send(
    new AssociateAssetsCommand({
      assetId: parentId,
      hierarchyId: "hierarchy-1",
      childAssetId: childId,
    }),
  );
  const associated = await client.send(
    new ListAssociatedAssetsCommand({
      assetId: parentId,
      hierarchyId: "hierarchy-1",
    }),
  );
  expect((associated.assetSummaries ?? []).map((s) => s.id)).toContain(childId);
});

test("IoTSiteWise gateway lifecycle", async () => {
  const client = iotsitewise();

  const created = await client.send(
    new CreateGatewayCommand({
      gatewayName: `gw-${Date.now()}`,
      gatewayPlatform: { greengrassV2: { coreDeviceThingName: "test-device" } },
    }),
  );
  expect(created.gatewayId).toBeDefined();
  expect(created.gatewayArn).toBeDefined();
  const gatewayId = created.gatewayId ?? "";

  const described = await client.send(
    new DescribeGatewayCommand({ gatewayId }),
  );
  expect(described.gatewayId).toBe(gatewayId);
  expect(described.gatewayName).toBeDefined();

  const listed = await client.send(new ListGatewaysCommand({}));
  expect((listed.gatewaySummaries ?? []).map((s) => s.gatewayId)).toContain(
    gatewayId,
  );
});

test("IoTSiteWise portal lifecycle", async () => {
  const client = iotsitewise();

  const created = await client.send(
    new CreatePortalCommand({
      portalName: `portal-${Date.now()}`,
      portalContactEmail: "test@example.com",
      roleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  expect(created.portalId).toBeDefined();
  expect(created.portalArn).toBeDefined();
  expect(created.portalStatus?.state).toBe("CREATING");
  const portalId = created.portalId ?? "";

  const described = await client.send(new DescribePortalCommand({ portalId }));
  expect(described.portalId).toBe(portalId);
  expect(described.portalContactEmail).toBe("test@example.com");

  const listed = await client.send(new ListPortalsCommand({}));
  expect((listed.portalSummaries ?? []).map((s) => s.id)).toContain(portalId);
});

test("IoTSiteWise project and project-assets lifecycle", async () => {
  const client = iotsitewise();

  const portal = await client.send(
    new CreatePortalCommand({
      portalName: `portal-proj-${Date.now()}`,
      portalContactEmail: "proj@example.com",
      roleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  const portalId = portal.portalId ?? "";

  const project = await client.send(
    new CreateProjectCommand({ portalId, projectName: `proj-${Date.now()}` }),
  );
  expect(project.projectId).toBeDefined();
  const projectId = project.projectId ?? "";

  const described = await client.send(
    new DescribeProjectCommand({ projectId }),
  );
  expect(described.projectId).toBe(projectId);
  expect(described.portalId).toBe(portalId);

  const listedProjects = await client.send(
    new ListProjectsCommand({ portalId }),
  );
  expect((listedProjects.projectSummaries ?? []).map((s) => s.id)).toContain(
    projectId,
  );

  const fakeAssetId = crypto.randomUUID();
  await client.send(
    new BatchAssociateProjectAssetsCommand({
      projectId,
      assetIds: [fakeAssetId],
    }),
  );
  const projectAssets = await client.send(
    new ListProjectAssetsCommand({ projectId }),
  );
  expect((projectAssets.assetIds ?? []).includes(fakeAssetId)).toBe(true);
});

test("IoTSiteWise dashboard lifecycle", async () => {
  const client = iotsitewise();

  const portal = await client.send(
    new CreatePortalCommand({
      portalName: `portal-dash-${Date.now()}`,
      portalContactEmail: "dash@example.com",
      roleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  const project = await client.send(
    new CreateProjectCommand({
      portalId: portal.portalId ?? "",
      projectName: `proj-dash-${Date.now()}`,
    }),
  );
  const projectId = project.projectId ?? "";

  const dashboard = await client.send(
    new CreateDashboardCommand({
      projectId,
      dashboardName: `dash-${Date.now()}`,
      dashboardDefinition: '{"widgets":[]}',
    }),
  );
  expect(dashboard.dashboardId).toBeDefined();
  const dashboardId = dashboard.dashboardId ?? "";

  const described = await client.send(
    new DescribeDashboardCommand({ dashboardId }),
  );
  expect(described.dashboardId).toBe(dashboardId);
  expect(described.dashboardDefinition).toBe('{"widgets":[]}');

  const listed = await client.send(new ListDashboardsCommand({ projectId }));
  expect((listed.dashboardSummaries ?? []).map((s) => s.id)).toContain(
    dashboardId,
  );
});

test("IoTSiteWise dataset lifecycle", async () => {
  const client = iotsitewise();

  const created = await client.send(
    new CreateDatasetCommand({
      datasetName: `ds-${Date.now()}`,
      datasetSource: {
        sourceType: "KENDRA",
        sourceFormat: "KNOWLEDGE_BASE",
      },
    }),
  );
  expect(created.datasetId).toBeDefined();
  expect(created.datasetStatus?.state).toBe("CREATING");
  const datasetId = created.datasetId ?? "";

  const described = await client.send(
    new DescribeDatasetCommand({ datasetId }),
  );
  expect(described.datasetId).toBe(datasetId);

  const listed = await client.send(
    new ListDatasetsCommand({ sourceType: "KENDRA" }),
  );
  expect((listed.datasetSummaries ?? []).map((s) => s.id)).toContain(datasetId);
});

test("IoTSiteWise access policy lifecycle", async () => {
  const client = iotsitewise();

  const portal = await client.send(
    new CreatePortalCommand({
      portalName: `portal-ap-${Date.now()}`,
      portalContactEmail: "ap@example.com",
      roleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  const portalId = portal.portalId ?? "";

  const policy = await client.send(
    new CreateAccessPolicyCommand({
      accessPolicyIdentity: { user: { id: "user-123" } },
      accessPolicyResource: { portal: { id: portalId } },
      accessPolicyPermission: "VIEWER",
    }),
  );
  expect(policy.accessPolicyId).toBeDefined();
  const accessPolicyId = policy.accessPolicyId ?? "";

  const described = await client.send(
    new DescribeAccessPolicyCommand({ accessPolicyId }),
  );
  expect(described.accessPolicyId).toBe(accessPolicyId);
  expect(described.accessPolicyPermission).toBe("VIEWER");

  const listed = await client.send(new ListAccessPoliciesCommand({}));
  expect((listed.accessPolicySummaries ?? []).map((s) => s.id)).toContain(
    accessPolicyId,
  );
});

test("IoTSiteWise property value put/get", async () => {
  const client = iotsitewise();

  const model = await client.send(
    new CreateAssetModelCommand({ assetModelName: `model-pv-${Date.now()}` }),
  );
  const asset = await client.send(
    new CreateAssetCommand({
      assetName: "pv-asset",
      assetModelId: model.assetModelId ?? "",
    }),
  );
  const assetId = asset.assetId ?? "";
  const propertyId = crypto.randomUUID();

  await client.send(
    new BatchPutAssetPropertyValueCommand({
      entries: [
        {
          entryId: "e1",
          assetId,
          propertyId,
          propertyValues: [
            {
              value: { doubleValue: 42.5 },
              timestamp: { timeInSeconds: Math.floor(Date.now() / 1000) },
              quality: "GOOD",
            },
          ],
        },
      ],
    }),
  );

  const got = await client.send(
    new GetAssetPropertyValueCommand({ assetId, propertyId }),
  );
  expect(got.propertyValue?.value?.doubleValue).toBe(42.5);
  expect(got.propertyValue?.quality).toBe("GOOD");
});

test("IoTSiteWise resource tags", async () => {
  const client = iotsitewise();

  const model = await client.send(
    new CreateAssetModelCommand({ assetModelName: `model-tags-${Date.now()}` }),
  );
  const resourceArn = model.assetModelArn ?? "";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.team).toBe("bunsai");
});

test("IoTSiteWise ListAssets pagination and filter", async () => {
  const client = iotsitewise();

  const model = await client.send(
    new CreateAssetModelCommand({
      assetModelName: `model-paginate-${Date.now()}`,
    }),
  );
  const assetModelId = model.assetModelId ?? "";

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await client.send(
      new CreateAssetCommand({
        assetName: `paginate-asset-${i}`,
        assetModelId,
      }),
    );
    ids.push(a.assetId ?? "");
  }

  const page1 = await client.send(
    new ListAssetsCommand({ assetModelId, filter: "ALL", maxResults: 2 }),
  );
  expect((page1.assetSummaries ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListAssetsCommand({
      assetModelId,
      filter: "ALL",
      maxResults: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect((page2.assetSummaries ?? []).length).toBeGreaterThanOrEqual(1);
  expect(page2.nextToken).toBeUndefined();

  const modelFilter = await client.send(
    new ListAssetsCommand({ assetModelId, filter: "ALL" }),
  );
  const filteredIds = (modelFilter.assetSummaries ?? []).map((s) => s.id);
  for (const id of ids) {
    expect(filteredIds).toContain(id);
  }
});

test("IoTSiteWise GetAssetPropertyValue missing asset throws", async () => {
  const client = iotsitewise();

  await expect(
    client.send(
      new GetAssetPropertyValueCommand({
        assetId: crypto.randomUUID(),
        propertyId: crypto.randomUUID(),
      }),
    ),
  ).rejects.toThrow();
});

test("IoTSiteWise BatchPutAssetPropertyValue round-trip and history", async () => {
  const client = iotsitewise();

  const model = await client.send(
    new CreateAssetModelCommand({
      assetModelName: `model-history-${Date.now()}`,
    }),
  );
  const asset = await client.send(
    new CreateAssetCommand({
      assetName: "history-asset",
      assetModelId: model.assetModelId ?? "",
    }),
  );
  const assetId = asset.assetId ?? "";
  const propertyId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await client.send(
    new BatchPutAssetPropertyValueCommand({
      entries: [
        {
          entryId: "e1",
          assetId,
          propertyId,
          propertyValues: [
            {
              value: { doubleValue: 10.0 },
              timestamp: { timeInSeconds: now - 10 },
              quality: "GOOD",
            },
          ],
        },
        {
          entryId: "e2",
          assetId,
          propertyId,
          propertyValues: [
            {
              value: { doubleValue: 20.0 },
              timestamp: { timeInSeconds: now },
              quality: "GOOD",
            },
          ],
        },
      ],
    }),
  );

  const latest = await client.send(
    new GetAssetPropertyValueCommand({ assetId, propertyId }),
  );
  expect(latest.propertyValue?.value?.doubleValue).toBe(20.0);

  const history = await client.send(
    new GetAssetPropertyValueHistoryCommand({ assetId, propertyId }),
  );
  expect((history.assetPropertyValueHistory ?? []).length).toBe(2);

  const missingResult = await client.send(
    new BatchPutAssetPropertyValueCommand({
      entries: [
        {
          entryId: "missing",
          assetId: crypto.randomUUID(),
          propertyId,
          propertyValues: [
            {
              value: { doubleValue: 99.0 },
              timestamp: { timeInSeconds: now },
              quality: "GOOD",
            },
          ],
        },
      ],
    }),
  );
  expect((missingResult.errorEntries ?? []).length).toBe(1);
  expect(missingResult.errorEntries?.[0]?.entryId).toBe("missing");
});
