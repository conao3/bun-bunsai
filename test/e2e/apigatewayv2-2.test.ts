import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateApiMappingCommand,
  CreateDomainNameCommand,
  CreateIntegrationCommand,
  CreateIntegrationResponseCommand,
  CreateModelCommand,
  CreatePortalCommand,
  CreatePortalProductCommand,
  CreateProductPageCommand,
  CreateProductRestEndpointPageCommand,
  CreateRouteCommand,
  CreateRouteResponseCommand,
  CreateRoutingRuleCommand,
  CreateVpcLinkCommand,
  DeleteApiMappingCommand,
  DeleteCorsConfigurationCommand,
  DeleteDomainNameCommand,
  DeleteIntegrationResponseCommand,
  DeleteModelCommand,
  DeletePortalCommand,
  DeletePortalProductCommand,
  DeleteProductPageCommand,
  DeleteProductRestEndpointPageCommand,
  DeleteRouteResponseCommand,
  DeleteRoutingRuleCommand,
  DeleteVpcLinkCommand,
  DisablePortalCommand,
  ExportApiCommand,
  GetApiMappingCommand,
  GetApiMappingsCommand,
  GetDomainNameCommand,
  GetDomainNamesCommand,
  GetIntegrationResponseCommand,
  GetIntegrationResponsesCommand,
  GetModelCommand,
  GetModelTemplateCommand,
  GetModelsCommand,
  GetPortalCommand,
  GetPortalProductCommand,
  GetPortalProductSharingPolicyCommand,
  GetProductPageCommand,
  GetProductRestEndpointPageCommand,
  GetRouteResponseCommand,
  GetRouteResponsesCommand,
  GetRoutingRuleCommand,
  GetVpcLinkCommand,
  GetVpcLinksCommand,
  ImportApiCommand,
  ListPortalProductsCommand,
  ListPortalsCommand,
  ListProductPagesCommand,
  ListProductRestEndpointPagesCommand,
  ListRoutingRulesCommand,
  PublishPortalCommand,
  PutPortalProductSharingPolicyCommand,
  PutRoutingRuleCommand,
  ReimportApiCommand,
  UpdateApiMappingCommand,
  UpdateDomainNameCommand,
  UpdateIntegrationResponseCommand,
  UpdateModelCommand,
  UpdatePortalCommand,
  UpdatePortalProductCommand,
  UpdateProductPageCommand,
  UpdateProductRestEndpointPageCommand,
  UpdateRouteResponseCommand,
  UpdateVpcLinkCommand,
  PublishStatus,
} from "@aws-sdk/client-apigatewayv2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const v2 = () =>
  new ApiGatewayV2Client({ endpoint, region, credentials, requestHandler });

test("domain names lifecycle", async () => {
  const client = v2();

  const created = await client.send(
    new CreateDomainNameCommand({ DomainName: "example.com" }),
  );
  expect(created.DomainName).toBe("example.com");

  const got = await client.send(
    new GetDomainNameCommand({ DomainName: "example.com" }),
  );
  expect(got.DomainName).toBe("example.com");

  const list = await client.send(new GetDomainNamesCommand({}));
  expect(list.Items?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new UpdateDomainNameCommand({
      DomainName: "example.com",
      RoutingMode: "API_MAPPING_ONLY",
    }),
  );
  const updated = await client.send(
    new GetDomainNameCommand({ DomainName: "example.com" }),
  );
  expect(updated.RoutingMode).toBe("API_MAPPING_ONLY");

  await client.send(
    new DeleteDomainNameCommand({ DomainName: "example.com" }),
  );
  const listAfter = await client.send(new GetDomainNamesCommand({}));
  expect(
    listAfter.Items?.find((d) => d.DomainName === "example.com"),
  ).toBeUndefined();
});

test("api mappings lifecycle", async () => {
  const client = v2();

  await client.send(
    new CreateDomainNameCommand({ DomainName: "mapping-test.com" }),
  );

  const api = await client.send(
    new CreateApiCommand({ Name: "mapping-api", ProtocolType: "HTTP" }),
  );
  const apiId = api.ApiId!;

  const mapping = await client.send(
    new CreateApiMappingCommand({
      DomainName: "mapping-test.com",
      ApiId: apiId,
      Stage: "$default",
    }),
  );
  const mappingId = mapping.ApiMappingId!;
  expect(mapping.ApiId).toBe(apiId);

  const got = await client.send(
    new GetApiMappingCommand({
      DomainName: "mapping-test.com",
      ApiMappingId: mappingId,
    }),
  );
  expect(got.ApiId).toBe(apiId);

  const list = await client.send(
    new GetApiMappingsCommand({ DomainName: "mapping-test.com" }),
  );
  expect(list.Items?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new UpdateApiMappingCommand({
      DomainName: "mapping-test.com",
      ApiMappingId: mappingId,
      ApiId: apiId,
      ApiMappingKey: "v1",
    }),
  );

  await client.send(
    new DeleteApiMappingCommand({
      DomainName: "mapping-test.com",
      ApiMappingId: mappingId,
    }),
  );
});

test("vpc links lifecycle", async () => {
  const client = v2();

  const created = await client.send(
    new CreateVpcLinkCommand({
      Name: "my-vpc",
      SubnetIds: ["subnet-abc"],
      SecurityGroupIds: ["sg-abc"],
    }),
  );
  const vpcId = created.VpcLinkId!;
  expect(created.VpcLinkStatus).toBe("AVAILABLE");

  const got = await client.send(new GetVpcLinkCommand({ VpcLinkId: vpcId }));
  expect(got.Name).toBe("my-vpc");

  const list = await client.send(new GetVpcLinksCommand({}));
  expect(list.Items?.find((v) => v.VpcLinkId === vpcId)).toBeDefined();

  await client.send(
    new UpdateVpcLinkCommand({ VpcLinkId: vpcId, Name: "updated-vpc" }),
  );

  await client.send(new DeleteVpcLinkCommand({ VpcLinkId: vpcId }));
  const listAfter = await client.send(new GetVpcLinksCommand({}));
  expect(listAfter.Items?.find((v) => v.VpcLinkId === vpcId)).toBeUndefined();
});

test("models lifecycle", async () => {
  const client = v2();

  const api = await client.send(
    new CreateApiCommand({ Name: "model-api", ProtocolType: "HTTP" }),
  );
  const apiId = api.ApiId!;

  const created = await client.send(
    new CreateModelCommand({
      ApiId: apiId,
      Name: "MyModel",
      Schema: '{"type":"object"}',
      ContentType: "application/json",
    }),
  );
  const modelId = created.ModelId!;
  expect(created.Name).toBe("MyModel");

  const got = await client.send(
    new GetModelCommand({ ApiId: apiId, ModelId: modelId }),
  );
  expect(got.Schema).toBe('{"type":"object"}');

  const tmpl = await client.send(
    new GetModelTemplateCommand({ ApiId: apiId, ModelId: modelId }),
  );
  expect(tmpl.Value).toBe('{"type":"object"}');

  const list = await client.send(new GetModelsCommand({ ApiId: apiId }));
  expect(list.Items?.find((m) => m.ModelId === modelId)).toBeDefined();

  await client.send(
    new UpdateModelCommand({
      ApiId: apiId,
      ModelId: modelId,
      Name: "UpdatedModel",
    }),
  );

  await client.send(
    new DeleteModelCommand({ ApiId: apiId, ModelId: modelId }),
  );
});

test("integration responses lifecycle", async () => {
  const client = v2();

  const api = await client.send(
    new CreateApiCommand({ Name: "ir-api", ProtocolType: "WEBSOCKET" }),
  );
  const apiId = api.ApiId!;

  const integration = await client.send(
    new CreateIntegrationCommand({ ApiId: apiId, IntegrationType: "MOCK" }),
  );
  const integrationId = integration.IntegrationId!;

  const created = await client.send(
    new CreateIntegrationResponseCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
      IntegrationResponseKey: "$default",
    }),
  );
  const irId = created.IntegrationResponseId!;
  expect(created.IntegrationResponseKey).toBe("$default");

  const got = await client.send(
    new GetIntegrationResponseCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
      IntegrationResponseId: irId,
    }),
  );
  expect(got.IntegrationResponseId).toBe(irId);

  const list = await client.send(
    new GetIntegrationResponsesCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
    }),
  );
  expect(list.Items?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new UpdateIntegrationResponseCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
      IntegrationResponseId: irId,
      IntegrationResponseKey: "/2XX",
    }),
  );

  await client.send(
    new DeleteIntegrationResponseCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
      IntegrationResponseId: irId,
    }),
  );
});

test("route responses lifecycle", async () => {
  const client = v2();

  const api = await client.send(
    new CreateApiCommand({ Name: "rr-api", ProtocolType: "WEBSOCKET" }),
  );
  const apiId = api.ApiId!;

  const route = await client.send(
    new CreateRouteCommand({ ApiId: apiId, RouteKey: "$default" }),
  );
  const routeId = route.RouteId!;

  const created = await client.send(
    new CreateRouteResponseCommand({
      ApiId: apiId,
      RouteId: routeId,
      RouteResponseKey: "$default",
    }),
  );
  const rrId = created.RouteResponseId!;
  expect(created.RouteResponseKey).toBe("$default");

  const got = await client.send(
    new GetRouteResponseCommand({
      ApiId: apiId,
      RouteId: routeId,
      RouteResponseId: rrId,
    }),
  );
  expect(got.RouteResponseId).toBe(rrId);

  const list = await client.send(
    new GetRouteResponsesCommand({ ApiId: apiId, RouteId: routeId }),
  );
  expect(list.Items?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new UpdateRouteResponseCommand({
      ApiId: apiId,
      RouteId: routeId,
      RouteResponseId: rrId,
      RouteResponseKey: "$default",
    }),
  );

  await client.send(
    new DeleteRouteResponseCommand({
      ApiId: apiId,
      RouteId: routeId,
      RouteResponseId: rrId,
    }),
  );
});

test("routing rules lifecycle", async () => {
  const client = v2();

  await client.send(
    new CreateDomainNameCommand({ DomainName: "routing-test.com" }),
  );

  const created = await client.send(
    new CreateRoutingRuleCommand({
      DomainName: "routing-test.com",
      Actions: [{ InvokeApi: { ApiId: "abc", Stage: "$default" } }],
      Conditions: [{ MatchBasePaths: { AnyOf: ["/api"] } }],
      Priority: 1,
    }),
  );
  const ruleId = created.RoutingRuleId!;
  expect(created.Priority).toBe(1);

  const got = await client.send(
    new GetRoutingRuleCommand({
      DomainName: "routing-test.com",
      RoutingRuleId: ruleId,
    }),
  );
  expect(got.RoutingRuleId).toBe(ruleId);

  const list = await client.send(
    new ListRoutingRulesCommand({ DomainName: "routing-test.com" }),
  );
  expect(list.RoutingRules?.find((r) => r.RoutingRuleId === ruleId)).toBeDefined();

  await client.send(
    new PutRoutingRuleCommand({
      DomainName: "routing-test.com",
      RoutingRuleId: ruleId,
      Actions: [{ InvokeApi: { ApiId: "abc", Stage: "$default" } }],
      Conditions: [{ MatchBasePaths: { AnyOf: ["/v2"] } }],
      Priority: 2,
    }),
  );

  await client.send(
    new DeleteRoutingRuleCommand({
      DomainName: "routing-test.com",
      RoutingRuleId: ruleId,
    }),
  );
});

test("import and export api", async () => {
  const client = v2();

  const spec = JSON.stringify({
    openapi: "3.0.1",
    info: { title: "imported", version: "1.0" },
    paths: { "/users": { get: {}, post: {} } },
  });

  const imported = await client.send(new ImportApiCommand({ Body: spec }));
  const apiId = imported.ApiId!;
  expect(imported.Name).toBe("imported");

  const exported = await client.send(
    new ExportApiCommand({
      ApiId: apiId,
      Specification: "OAS30",
      OutputType: "JSON",
    }),
  );
  expect(exported.body).toBeDefined();

  const reimported = await client.send(
    new ReimportApiCommand({
      ApiId: apiId,
      Body: JSON.stringify({
        openapi: "3.0.1",
        info: { title: "reimported", version: "2.0" },
        paths: { "/items": { get: {} } },
      }),
    }),
  );
  expect(reimported.ApiId).toBe(apiId);
});

test("delete cors configuration", async () => {
  const client = v2();

  const api = await client.send(
    new CreateApiCommand({
      Name: "cors-api",
      ProtocolType: "HTTP",
      CorsConfiguration: { AllowOrigins: ["https://example.com"] },
    }),
  );
  const apiId = api.ApiId!;
  expect(api.CorsConfiguration?.AllowOrigins).toEqual(["https://example.com"]);

  await client.send(new DeleteCorsConfigurationCommand({ ApiId: apiId }));
});

test("portal lifecycle", async () => {
  const client = v2();

  const created = await client.send(
    new CreatePortalCommand({
      Authorization: { None: {} },
      PortalContent: {
        DisplayName: "My Portal",
        Theme: {
          CustomColors: {
            AccentColor: "#FF0000",
            BackgroundColor: "#FFFFFF",
            ErrorValidationColor: "#FF0000",
            HeaderColor: "#000000",
            NavigationColor: "#000000",
            TextColor: "#000000",
          },
        },
      },
      EndpointConfiguration: { None: {} },
    }),
  );
  const portalId = created.PortalId!;
  expect(created.PublishStatus).toBe(PublishStatus.DISABLED);

  const got = await client.send(new GetPortalCommand({ PortalId: portalId }));
  expect(got.PortalId).toBe(portalId);

  const list = await client.send(new ListPortalsCommand({}));
  expect(list.Items?.find((p) => p.PortalId === portalId)).toBeDefined();

  await client.send(
    new UpdatePortalCommand({
      PortalId: portalId,
      LogoUri: "https://example.com/logo.png",
    }),
  );

  await client.send(new PublishPortalCommand({ PortalId: portalId }));
  const published = await client.send(
    new GetPortalCommand({ PortalId: portalId }),
  );
  expect(published.PublishStatus).toBe(PublishStatus.PUBLISHED);

  await client.send(new DisablePortalCommand({ PortalId: portalId }));
  const disabled = await client.send(
    new GetPortalCommand({ PortalId: portalId }),
  );
  expect(disabled.PublishStatus).toBe(PublishStatus.DISABLED);

  await client.send(new DeletePortalCommand({ PortalId: portalId }));
});

test("portal product and pages lifecycle", async () => {
  const client = v2();

  const product = await client.send(
    new CreatePortalProductCommand({ DisplayName: "My Product" }),
  );
  const ppId = product.PortalProductId!;
  expect(product.DisplayName).toBe("My Product");

  const gotProduct = await client.send(
    new GetPortalProductCommand({ PortalProductId: ppId }),
  );
  expect(gotProduct.PortalProductId).toBe(ppId);

  const listProducts = await client.send(new ListPortalProductsCommand({}));
  expect(listProducts.Items?.find((p) => p.PortalProductId === ppId)).toBeDefined();

  await client.send(
    new UpdatePortalProductCommand({
      PortalProductId: ppId,
      DisplayName: "Updated Product",
    }),
  );

  const page = await client.send(
    new CreateProductPageCommand({
      PortalProductId: ppId,
      DisplayContent: { Body: "Overview content", Title: "Overview" },
    }),
  );
  const pageId = page.ProductPageId!;

  const gotPage = await client.send(
    new GetProductPageCommand({ PortalProductId: ppId, ProductPageId: pageId }),
  );
  expect(gotPage.ProductPageId).toBe(pageId);

  const listPages = await client.send(
    new ListProductPagesCommand({ PortalProductId: ppId }),
  );
  expect(listPages.Items?.find((p) => p.ProductPageId === pageId)).toBeDefined();

  await client.send(
    new UpdateProductPageCommand({
      PortalProductId: ppId,
      ProductPageId: pageId,
      DisplayContent: { Body: "Updated content", Title: "Updated" },
    }),
  );

  await client.send(
    new DeleteProductPageCommand({ PortalProductId: ppId, ProductPageId: pageId }),
  );

  const restPage = await client.send(
    new CreateProductRestEndpointPageCommand({
      PortalProductId: ppId,
      RestEndpointIdentifier: {
        IdentifierParts: { RestApiId: "abc", Path: "/", Method: "GET", Stage: "$default" },
      },
    }),
  );
  const restPageId = restPage.ProductRestEndpointPageId!;

  const gotRestPage = await client.send(
    new GetProductRestEndpointPageCommand({
      PortalProductId: ppId,
      ProductRestEndpointPageId: restPageId,
    }),
  );
  expect(gotRestPage.ProductRestEndpointPageId).toBe(restPageId);

  const listRestPages = await client.send(
    new ListProductRestEndpointPagesCommand({ PortalProductId: ppId }),
  );
  expect(
    listRestPages.Items?.find((p) => p.ProductRestEndpointPageId === restPageId),
  ).toBeDefined();

  await client.send(
    new UpdateProductRestEndpointPageCommand({
      PortalProductId: ppId,
      ProductRestEndpointPageId: restPageId,
      TryItState: "ENABLED",
    }),
  );

  await client.send(
    new DeleteProductRestEndpointPageCommand({
      PortalProductId: ppId,
      ProductRestEndpointPageId: restPageId,
    }),
  );

  await client.send(
    new PutPortalProductSharingPolicyCommand({
      PortalProductId: ppId,
      PolicyDocument: '{"Version":"2012-10-17"}',
    }),
  );

  const policy = await client.send(
    new GetPortalProductSharingPolicyCommand({ PortalProductId: ppId }),
  );
  expect(policy.PolicyDocument).toBe('{"Version":"2012-10-17"}');

  await client.send(
    new DeletePortalProductCommand({ PortalProductId: ppId }),
  );
});
