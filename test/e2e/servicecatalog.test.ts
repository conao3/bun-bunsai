import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AcceptPortfolioShareCommand,
  AssociatePrincipalWithPortfolioCommand,
  AssociateProductWithPortfolioCommand,
  AssociateTagOptionWithResourceCommand,
  BatchAssociateServiceActionWithProvisioningArtifactCommand,
  CreateConstraintCommand,
  CreatePortfolioCommand,
  CreateProductCommand,
  CreateProvisioningArtifactCommand,
  CreateServiceActionCommand,
  CreateTagOptionCommand,
  DeleteConstraintCommand,
  DeletePortfolioCommand,
  DeleteProductCommand,
  DeleteProvisioningArtifactCommand,
  DeleteServiceActionCommand,
  DeleteTagOptionCommand,
  DescribeConstraintCommand,
  DescribePortfolioCommand,
  DescribeProductAsAdminCommand,
  DescribeProductCommand,
  DescribeProvisionedProductCommand,
  DescribeProvisioningArtifactCommand,
  DescribeRecordCommand,
  DescribeServiceActionCommand,
  DescribeTagOptionCommand,
  DisassociateTagOptionFromResourceCommand,
  EnableAWSOrganizationsAccessCommand,
  GetAWSOrganizationsAccessStatusCommand,
  ListPortfoliosCommand,
  ListPrincipalsForPortfolioCommand,
  ListProvisioningArtifactsCommand,
  ListRecordHistoryCommand,
  ListServiceActionsCommand,
  ListTagOptionsCommand,
  ProvisionProductCommand,
  SearchProductsCommand,
  ServiceCatalogClient,
  TerminateProvisionedProductCommand,
  UpdatePortfolioCommand,
  UpdateProductCommand,
  UpdateServiceActionCommand,
  UpdateTagOptionCommand,
} from "@aws-sdk/client-service-catalog";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const catalog = () =>
  new ServiceCatalogClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("ServiceCatalog portfolio lifecycle", async () => {
  const client = catalog();

  const created = await client.send(
    new CreatePortfolioCommand({
      DisplayName: "bunsai-e2e-portfolio",
      ProviderName: "bunsai",
      IdempotencyToken: "bunsai-e2e-token-1",
    }),
  );
  const portfolioId = created.PortfolioDetail?.Id;
  expect(portfolioId).toMatch(/^port-/);
  expect(created.PortfolioDetail?.DisplayName).toBe("bunsai-e2e-portfolio");
  expect(created.PortfolioDetail?.ARN).toContain("portfolio/");

  const listed = await client.send(new ListPortfoliosCommand({}));
  expect(
    (listed.PortfolioDetails ?? []).some((p) => p.Id === portfolioId),
  ).toBe(true);

  const described = await client.send(
    new DescribePortfolioCommand({ Id: portfolioId }),
  );
  expect(described.PortfolioDetail?.Id).toBe(portfolioId);
  expect(described.PortfolioDetail?.ProviderName).toBe("bunsai");

  const updated = await client.send(
    new UpdatePortfolioCommand({
      Id: portfolioId,
      DisplayName: "bunsai-e2e-portfolio-renamed",
    }),
  );
  expect(updated.PortfolioDetail?.DisplayName).toBe(
    "bunsai-e2e-portfolio-renamed",
  );

  await client.send(new DeletePortfolioCommand({ Id: portfolioId }));

  const afterDelete = await client.send(new ListPortfoliosCommand({}));
  expect(
    (afterDelete.PortfolioDetails ?? []).some((p) => p.Id === portfolioId),
  ).toBe(false);
});

test("ServiceCatalog product + provisioning-artifact lifecycle", async () => {
  const client = catalog();

  const portfolio = await client.send(
    new CreatePortfolioCommand({
      DisplayName: "e2e-prod-portfolio",
      ProviderName: "e2e",
      IdempotencyToken: "e2e-prod-port-tok",
    }),
  );
  const portfolioId = portfolio.PortfolioDetail?.Id ?? "";
  expect(portfolioId).toMatch(/^port-/);

  const created = await client.send(
    new CreateProductCommand({
      Name: "e2e-product",
      Owner: "e2e-owner",
      ProductType: "CLOUD_FORMATION_TEMPLATE",
      IdempotencyToken: "e2e-product-tok",
      ProvisioningArtifactParameters: {
        Name: "v1",
        Type: "CLOUD_FORMATION_TEMPLATE",
        Info: { LoadTemplateFromURL: "https://s3.amazonaws.com/x/t.json" },
      },
    }),
  );
  const productId = created.ProductViewDetail?.ProductViewSummary?.Id ?? "";
  expect(productId).toMatch(/^prod-/);

  const described = await client.send(
    new DescribeProductCommand({ Id: productId }),
  );
  expect(described.ProductViewSummary?.Id).toBe(productId);

  const adminDesc = await client.send(
    new DescribeProductAsAdminCommand({ Id: productId }),
  );
  expect(adminDesc.ProductViewDetail?.ProductViewSummary?.Id).toBe(productId);

  const searched = await client.send(new SearchProductsCommand({}));
  expect(
    (searched.ProductViewSummaries ?? []).some((p) => p.Id === productId),
  ).toBe(true);

  const updated = await client.send(
    new UpdateProductCommand({ Id: productId, Name: "e2e-product-v2" }),
  );
  expect(updated.ProductViewDetail?.ProductViewSummary?.Name).toBe(
    "e2e-product-v2",
  );

  const paId =
    created.ProvisioningArtifactDetail?.Id ??
    (
      await client.send(
        new CreateProvisioningArtifactCommand({
          ProductId: productId,
          IdempotencyToken: "e2e-pa-tok",
          Parameters: {
            Name: "v2",
            Type: "CLOUD_FORMATION_TEMPLATE",
            Info: { LoadTemplateFromURL: "https://s3.amazonaws.com/x/t.json" },
          },
        }),
      )
    ).ProvisioningArtifactDetail?.Id ??
    "";
  expect(paId).toMatch(/^pa-/);

  const descPA = await client.send(
    new DescribeProvisioningArtifactCommand({
      ProvisioningArtifactId: paId,
      ProductId: productId,
    }),
  );
  expect(descPA.ProvisioningArtifactDetail?.Id).toBe(paId);

  const listPAs = await client.send(
    new ListProvisioningArtifactsCommand({ ProductId: productId }),
  );
  expect(
    (listPAs.ProvisioningArtifactDetails ?? []).some((pa) => pa.Id === paId),
  ).toBe(true);

  await client.send(
    new AssociateProductWithPortfolioCommand({
      PortfolioId: portfolioId,
      ProductId: productId,
    }),
  );

  await client.send(
    new AssociatePrincipalWithPortfolioCommand({
      PortfolioId: portfolioId,
      PrincipalARN: "arn:aws:iam::123456789012:role/Admin",
      PrincipalType: "IAM",
    }),
  );
  const principals = await client.send(
    new ListPrincipalsForPortfolioCommand({ PortfolioId: portfolioId }),
  );
  expect((principals.Principals ?? []).length).toBeGreaterThan(0);

  const constrained = await client.send(
    new CreateConstraintCommand({
      PortfolioId: portfolioId,
      ProductId: productId,
      Type: "LAUNCH",
      Parameters: JSON.stringify({
        RoleArn: "arn:aws:iam::123456789012:role/Launch",
      }),
      IdempotencyToken: "e2e-constraint-tok",
    }),
  );
  const constraintId = constrained.ConstraintDetail?.ConstraintId ?? "";
  expect(constraintId).toMatch(/^cons-/);

  const descConstraint = await client.send(
    new DescribeConstraintCommand({ Id: constraintId }),
  );
  expect(descConstraint.ConstraintDetail?.ConstraintId).toBe(constraintId);

  await client.send(new DeleteConstraintCommand({ Id: constraintId }));

  const provisioned = await client.send(
    new ProvisionProductCommand({
      ProductId: productId,
      ProvisioningArtifactId: paId,
      ProvisionedProductName: "e2e-pp",
      ProvisionToken: "e2e-prov-tok",
    }),
  );
  const ppId = provisioned.RecordDetail?.ProvisionedProductId ?? "";
  expect(ppId).toMatch(/^pp-/);
  const recordId = provisioned.RecordDetail?.RecordId ?? "";

  const descPP = await client.send(
    new DescribeProvisionedProductCommand({ Id: ppId }),
  );
  expect(descPP.ProvisionedProductDetail?.Id).toBe(ppId);
  expect(descPP.ProvisionedProductDetail?.Status).toBe("AVAILABLE");

  const record = await client.send(new DescribeRecordCommand({ Id: recordId }));
  expect(record.RecordDetail?.RecordId).toBe(recordId);

  const history = await client.send(new ListRecordHistoryCommand({}));
  expect((history.RecordDetails ?? []).length).toBeGreaterThan(0);

  await client.send(
    new TerminateProvisionedProductCommand({
      ProvisionedProductId: ppId,
      TerminateToken: "e2e-term-tok",
    }),
  );

  const sa = await client.send(
    new CreateServiceActionCommand({
      Name: "e2e-action",
      DefinitionType: "SSM_AUTOMATION",
      Definition: { Name: "AWS-RestartEC2Instance", Version: "1" },
      IdempotencyToken: "e2e-sa-tok",
    }),
  );
  const saId = sa.ServiceActionDetail?.ServiceActionSummary?.Id ?? "";
  expect(saId).toMatch(/^act-/);

  const descSA = await client.send(
    new DescribeServiceActionCommand({ Id: saId }),
  );
  expect(descSA.ServiceActionDetail?.ServiceActionSummary?.Id).toBe(saId);

  await client.send(
    new UpdateServiceActionCommand({ Id: saId, Name: "e2e-action-v2" }),
  );
  const listSA = await client.send(new ListServiceActionsCommand({}));
  expect((listSA.ServiceActionSummaries ?? []).some((a) => a.Id === saId)).toBe(
    true,
  );

  await client.send(
    new BatchAssociateServiceActionWithProvisioningArtifactCommand({
      ServiceActionAssociations: [
        {
          ServiceActionId: saId,
          ProductId: productId,
          ProvisioningArtifactId: paId,
        },
      ],
    }),
  );

  await client.send(new DeleteServiceActionCommand({ Id: saId }));

  const to = await client.send(
    new CreateTagOptionCommand({ Key: "env", Value: "e2e" }),
  );
  const toId = to.TagOptionDetail?.Id ?? "";
  expect(toId).toMatch(/^to-/);

  const descTO = await client.send(new DescribeTagOptionCommand({ Id: toId }));
  expect(descTO.TagOptionDetail?.Id).toBe(toId);

  await client.send(
    new UpdateTagOptionCommand({ Id: toId, Value: "e2e-updated" }),
  );
  const listTO = await client.send(new ListTagOptionsCommand({}));
  expect((listTO.TagOptionDetails ?? []).some((t) => t.Id === toId)).toBe(true);

  await client.send(
    new AssociateTagOptionWithResourceCommand({
      ResourceId: portfolioId,
      TagOptionId: toId,
    }),
  );
  await client.send(
    new DisassociateTagOptionFromResourceCommand({
      ResourceId: portfolioId,
      TagOptionId: toId,
    }),
  );
  await client.send(new DeleteTagOptionCommand({ Id: toId }));

  await client.send(new EnableAWSOrganizationsAccessCommand({}));
  const orgsStatus = await client.send(
    new GetAWSOrganizationsAccessStatusCommand({}),
  );
  expect(orgsStatus.AccessStatus).toBe("ENABLED");

  await client.send(
    new AcceptPortfolioShareCommand({ PortfolioId: portfolioId }),
  );

  await client.send(
    new DeleteProvisioningArtifactCommand({
      ProvisioningArtifactId: paId,
      ProductId: productId,
    }),
  );
  await client.send(new DeleteProductCommand({ Id: productId }));
  await client.send(new DeletePortfolioCommand({ Id: portfolioId }));
});
