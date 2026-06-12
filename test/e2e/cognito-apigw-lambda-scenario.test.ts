import { expect, test } from "bun:test";
import {
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  APIGatewayClient,
  CreateAuthorizerCommand,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  CreateStageCommand,
  PutIntegrationCommand,
  PutMethodCommand,
} from "@aws-sdk/client-api-gateway";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { makeZip } from "./event-helpers.ts";
import { startApp } from "./harness.ts";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cognito = () =>
  new CognitoIdentityProviderClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });
const apigw = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });
const lam = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const authHeader =
  "AWS4-HMAC-SHA256 Credential=test/20260611/us-east-1/cognito-idp/aws4_request, SignedHeaders=content-type;x-amz-target, Signature=fakesig";

const cognitoPost = (
  action: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> =>
  gwFetch(`${endpoint}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  }).then(async (res) => ({
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  }));

test("Cognito User Pool JWT → API Gateway COGNITO_USER_POOLS authorizer → Lambda dispatch", async () => {
  const idpClient = cognito();
  const gwClient = apigw();
  const lambdaClient = lam();

  const pool = await idpClient.send(
    new CreateUserPoolCommand({ PoolName: "apigw-scenario-pool" }),
  );
  const poolId = pool.UserPool?.Id ?? "";
  expect(poolId).toBeTruthy();

  const appClient = await idpClient.send(
    new CreateUserPoolClientCommand({
      UserPoolId: poolId,
      ClientName: "apigw-scenario-client",
      ExplicitAuthFlows: [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ],
    }),
  );
  const clientId = appClient.UserPoolClient?.ClientId ?? "";
  expect(clientId).toBeTruthy();

  await idpClient.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: "apigw-user",
      UserAttributes: [{ Name: "email", Value: "apigw@example.com" }],
      TemporaryPassword: "TempPass1!",
    }),
  );

  await idpClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: "apigw-user",
      Password: "FinalPass1!",
      Permanent: true,
    }),
  );

  await idpClient.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: poolId,
      Username: "apigw-user",
    }),
  );

  const authRes = await cognitoPost("InitiateAuth", {
    ClientId: clientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: "apigw-user", PASSWORD: "FinalPass1!" },
  });
  expect(authRes.status).toBe(200);
  const authResult = authRes.body["AuthenticationResult"] as Record<
    string,
    unknown
  >;
  const idToken = authResult["IdToken"] as string;
  expect(idToken).toBeTruthy();

  const [, idPayloadSeg] = idToken.split(".");
  const idPayload = JSON.parse(
    Buffer.from(idPayloadSeg, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  expect(idPayload["sub"]).toBeTruthy();
  expect(idPayload["email"]).toBe("apigw@example.com");

  const fnName = "apigw-scenario-echo-fn";
  await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js":
            "exports.handler = async (event) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestContext: event.requestContext }) });",
        }),
      },
    }),
  );

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "apigw-scenario-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;
  expect(restApiId).toBeTruthy();

  const poolArn = `arn:aws:cognito-idp:${region}:000000000000:userpool/${poolId}`;
  const authorizer = await gwClient.send(
    new CreateAuthorizerCommand({
      restApiId,
      name: "cognito-pool-auth",
      type: "COGNITO_USER_POOLS",
      providerARNs: [poolArn],
      identitySource: "method.request.header.Authorization",
    }),
  );
  const authorizerId = authorizer.id as string;
  expect(authorizerId).toBeTruthy();

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "hello",
    }),
  );
  const resourceId = resource.id as string;
  expect(resource.path).toBe("/hello");

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "COGNITO_USER_POOLS",
      authorizerId,
    }),
  );

  const functionArn = `arn:aws:lambda:${region}:000000000000:function:${fnName}`;
  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  expect(deployment.id).toBeTruthy();

  await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "prod",
      deploymentId: deployment.id as string,
    }),
  );

  const base = `http://${restApiId}.execute-api.${region}.localhost/prod/hello`;

  const noAuthRes = await gwFetch(base);
  expect(noAuthRes.status).toBe(401);

  const badTokenRes = await gwFetch(base, {
    headers: { Authorization: "Bearer not.a.valid.jwt.token" },
  });
  expect(badTokenRes.status).toBe(401);

  const okRes = await gwFetch(base, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  expect(okRes.status).toBe(200);

  const okBody = (await okRes.json()) as {
    requestContext: {
      authorizer?: { claims?: Record<string, unknown> };
    };
  };
  const claims = okBody.requestContext?.authorizer?.claims;
  expect(claims).toBeDefined();
  expect(claims?.["sub"]).toBe(idPayload["sub"]);
  expect(claims?.["email"]).toBe("apigw@example.com");
});

test("COGNITO_USER_POOLS authorizer rejects token from different UserPool", async () => {
  const idpClient = cognito();
  const gwClient = apigw();
  const lambdaClient = lam();

  const pool = await idpClient.send(
    new CreateUserPoolCommand({ PoolName: "apigw-main-pool" }),
  );
  const poolId = pool.UserPool?.Id ?? "";
  expect(poolId).toBeTruthy();

  const appClient = await idpClient.send(
    new CreateUserPoolClientCommand({
      UserPoolId: poolId,
      ClientName: "apigw-main-client",
      ExplicitAuthFlows: [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ],
    }),
  );
  const clientId = appClient.UserPoolClient?.ClientId ?? "";
  expect(clientId).toBeTruthy();

  const otherPool = await idpClient.send(
    new CreateUserPoolCommand({ PoolName: "apigw-other-pool" }),
  );
  const otherPoolId = otherPool.UserPool?.Id ?? "";
  expect(otherPoolId).toBeTruthy();

  const otherAppClient = await idpClient.send(
    new CreateUserPoolClientCommand({
      UserPoolId: otherPoolId,
      ClientName: "apigw-other-client",
      ExplicitAuthFlows: [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ],
    }),
  );
  const otherClientId = otherAppClient.UserPoolClient?.ClientId ?? "";
  expect(otherClientId).toBeTruthy();

  await idpClient.send(
    new AdminCreateUserCommand({
      UserPoolId: otherPoolId,
      Username: "other-user",
      UserAttributes: [{ Name: "email", Value: "other@example.com" }],
      TemporaryPassword: "TempPass1!",
    }),
  );
  await idpClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: otherPoolId,
      Username: "other-user",
      Password: "FinalPass1!",
      Permanent: true,
    }),
  );
  await idpClient.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: otherPoolId,
      Username: "other-user",
    }),
  );

  const otherAuthRes = await cognitoPost("InitiateAuth", {
    ClientId: otherClientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: "other-user", PASSWORD: "FinalPass1!" },
  });
  expect(otherAuthRes.status).toBe(200);
  const otherAuthResult = otherAuthRes.body["AuthenticationResult"] as Record<
    string,
    unknown
  >;
  const otherIdToken = otherAuthResult["IdToken"] as string;
  expect(otherIdToken).toBeTruthy();

  const fnName = "apigw-wrong-pool-echo-fn";
  await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js":
            "exports.handler = async (event) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });",
        }),
      },
    }),
  );

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "apigw-wrong-pool-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;
  expect(restApiId).toBeTruthy();

  const mainPoolArn = `arn:aws:cognito-idp:${region}:000000000000:userpool/${poolId}`;
  const authorizer = await gwClient.send(
    new CreateAuthorizerCommand({
      restApiId,
      name: "cognito-main-pool-auth",
      type: "COGNITO_USER_POOLS",
      providerARNs: [mainPoolArn],
      identitySource: "method.request.header.Authorization",
    }),
  );
  const authorizerId = authorizer.id as string;
  expect(authorizerId).toBeTruthy();

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "secure",
    }),
  );
  const resourceId = resource.id as string;

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "COGNITO_USER_POOLS",
      authorizerId,
    }),
  );

  const functionArn = `arn:aws:lambda:${region}:000000000000:function:${fnName}`;
  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  const deployment2 = await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "prod",
      deploymentId: deployment.id as string,
    }),
  );
  expect(deployment2.stageName).toBe("prod");

  const base = `http://${restApiId}.execute-api.${region}.localhost/prod/secure`;

  const wrongPoolRes = await gwFetch(base, {
    headers: { Authorization: `Bearer ${otherIdToken}` },
  });
  expect(wrongPoolRes.status).toBe(401);

  await idpClient.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: "main-user",
      UserAttributes: [{ Name: "email", Value: "main@example.com" }],
      TemporaryPassword: "TempPass1!",
    }),
  );
  await idpClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: "main-user",
      Password: "FinalPass1!",
      Permanent: true,
    }),
  );
  await idpClient.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: poolId,
      Username: "main-user",
    }),
  );

  const mainAuthRes = await cognitoPost("InitiateAuth", {
    ClientId: clientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: "main-user", PASSWORD: "FinalPass1!" },
  });
  expect(mainAuthRes.status).toBe(200);
  const mainIdToken = (
    mainAuthRes.body["AuthenticationResult"] as Record<string, unknown>
  )["IdToken"] as string;
  expect(mainIdToken).toBeTruthy();

  const okRes = await gwFetch(base, {
    headers: { Authorization: `Bearer ${mainIdToken}` },
  });
  expect(okRes.status).toBe(200);
});
