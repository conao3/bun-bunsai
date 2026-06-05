import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateAuthorizerCommand,
  CreateBasePathMappingCommand,
  CreateRestApiCommand,
  DeleteApiKeyCommand,
  DeleteAuthorizerCommand,
  DeleteBasePathMappingCommand,
  DeleteClientCertificateCommand,
  GenerateClientCertificateCommand,
  GetApiKeyCommand,
  GetApiKeysCommand,
  GetAuthorizerCommand,
  GetAuthorizersCommand,
  GetBasePathMappingCommand,
  GetBasePathMappingsCommand,
  GetClientCertificateCommand,
  GetClientCertificatesCommand,
  GetTagsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApiKeyCommand,
  UpdateAuthorizerCommand,
  UpdateBasePathMappingCommand,
  UpdateClientCertificateCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("API Gateway api-key lifecycle", async () => {
  const client = apigateway();

  const created = await client.send(
    new CreateApiKeyCommand({
      name: "bunsai-e2e-key",
      description: "e2e test key",
      enabled: true,
    }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe("bunsai-e2e-key");
  expect(created.enabled).toBe(true);
  const keyId = created.id as string;

  const got = await client.send(new GetApiKeyCommand({ apiKey: keyId }));
  expect(got.id).toBe(keyId);
  expect(got.description).toBe("e2e test key");

  const listed = await client.send(new GetApiKeysCommand({}));
  expect((listed.items ?? []).map((k) => k.id)).toContain(keyId);

  const updated = await client.send(
    new UpdateApiKeyCommand({
      apiKey: keyId,
      patchOperations: [
        { op: "replace", path: "/description", value: "updated" },
      ],
    }),
  );
  expect(updated.description).toBe("updated");

  await client.send(new DeleteApiKeyCommand({ apiKey: keyId }));
  const afterDelete = await client.send(new GetApiKeysCommand({}));
  expect((afterDelete.items ?? []).map((k) => k.id)).not.toContain(keyId);
});

test("API Gateway authorizer lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-authorizer-api" }),
  );
  const restApiId = api.id as string;

  const created = await client.send(
    new CreateAuthorizerCommand({
      restApiId,
      name: "bunsai-authorizer",
      type: "TOKEN",
      identitySource: "method.request.header.Authorization",
      authorizerUri:
        "arn:aws:apigateway:us-east-1:lambda:path/functions/arn:aws:lambda:us-east-1:123456789012:function:MyLambda/invocations",
    }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe("bunsai-authorizer");
  expect(created.type).toBe("TOKEN");
  const authorizerId = created.id as string;

  const got = await client.send(
    new GetAuthorizerCommand({ restApiId, authorizerId }),
  );
  expect(got.id).toBe(authorizerId);
  expect(got.identitySource).toBe("method.request.header.Authorization");

  const listed = await client.send(new GetAuthorizersCommand({ restApiId }));
  expect((listed.items ?? []).map((a) => a.id)).toContain(authorizerId);

  const updated = await client.send(
    new UpdateAuthorizerCommand({
      restApiId,
      authorizerId,
      patchOperations: [
        { op: "replace", path: "/name", value: "renamed-authorizer" },
      ],
    }),
  );
  expect(updated.name).toBe("renamed-authorizer");

  await client.send(new DeleteAuthorizerCommand({ restApiId, authorizerId }));
  const afterDelete = await client.send(
    new GetAuthorizersCommand({ restApiId }),
  );
  expect((afterDelete.items ?? []).map((a) => a.id)).not.toContain(
    authorizerId,
  );
});

test("API Gateway base-path-mapping lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-bpm-api" }),
  );
  const restApiId = api.id as string;
  const domainName = "example.com";

  const created = await client.send(
    new CreateBasePathMappingCommand({
      domainName,
      restApiId,
      basePath: "v1",
    }),
  );
  expect(created.basePath).toBe("v1");
  expect(created.restApiId).toBe(restApiId);

  const got = await client.send(
    new GetBasePathMappingCommand({ domainName, basePath: "v1" }),
  );
  expect(got.basePath).toBe("v1");
  expect(got.restApiId).toBe(restApiId);

  const listed = await client.send(
    new GetBasePathMappingsCommand({ domainName }),
  );
  expect((listed.items ?? []).map((b) => b.basePath)).toContain("v1");

  const updated = await client.send(
    new UpdateBasePathMappingCommand({
      domainName,
      basePath: "v1",
      patchOperations: [{ op: "replace", path: "/stage", value: "prod" }],
    }),
  );
  expect(updated.stage).toBe("prod");

  await client.send(
    new DeleteBasePathMappingCommand({ domainName, basePath: "v1" }),
  );
  const afterDelete = await client.send(
    new GetBasePathMappingsCommand({ domainName }),
  );
  expect((afterDelete.items ?? []).map((b) => b.basePath)).not.toContain("v1");
});

test("API Gateway client-certificate lifecycle", async () => {
  const client = apigateway();

  const created = await client.send(
    new GenerateClientCertificateCommand({ description: "e2e cert" }),
  );
  expect(created.clientCertificateId).toBeDefined();
  expect(created.description).toBe("e2e cert");
  expect(created.pemEncodedCertificate).toBeDefined();
  const certId = created.clientCertificateId as string;

  const got = await client.send(
    new GetClientCertificateCommand({ clientCertificateId: certId }),
  );
  expect(got.clientCertificateId).toBe(certId);

  const listed = await client.send(new GetClientCertificatesCommand({}));
  expect((listed.items ?? []).map((c) => c.clientCertificateId)).toContain(
    certId,
  );

  const updated = await client.send(
    new UpdateClientCertificateCommand({
      clientCertificateId: certId,
      patchOperations: [
        { op: "replace", path: "/description", value: "updated cert" },
      ],
    }),
  );
  expect(updated.description).toBe("updated cert");

  await client.send(
    new DeleteClientCertificateCommand({ clientCertificateId: certId }),
  );
  const afterDelete = await client.send(new GetClientCertificatesCommand({}));
  expect(
    (afterDelete.items ?? []).map((c) => c.clientCertificateId),
  ).not.toContain(certId);
});

test("API Gateway tags lifecycle", async () => {
  const client = apigateway();
  const resourceArn = "arn:aws:apigateway:us-east-1::testresource";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", owner: "bunsai" },
    }),
  );

  const got = await client.send(new GetTagsCommand({ resourceArn }));
  expect(got.tags?.env).toBe("test");
  expect(got.tags?.owner).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["owner"] }),
  );

  const afterUntag = await client.send(new GetTagsCommand({ resourceArn }));
  expect(afterUntag.tags?.env).toBe("test");
  expect(afterUntag.tags?.owner).toBeUndefined();
});
