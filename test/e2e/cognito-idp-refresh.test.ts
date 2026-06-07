import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const authHeader =
  "AWS4-HMAC-SHA256 Credential=test/20260607/us-east-1/cognito-idp/aws4_request, SignedHeaders=content-type;x-amz-target, Signature=fakesig";

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

describe("cognito-idp refresh token e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("InitiateAuth REFRESH_TOKEN_AUTH: valid token yields AccessToken, no RefreshToken", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "refresh-e2e-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "refresh-client",
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId ?? "";

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "refresh-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "refresh-user",
        Password: "Refresh1!",
        Permanent: true,
      }),
    );

    const authRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "refresh-user", PASSWORD: "Refresh1!" },
    });
    expect(authRes.status).toBe(200);
    const authResult = authRes.body["AuthenticationResult"] as Record<
      string,
      unknown
    >;
    const refreshToken = authResult["RefreshToken"];
    expect(refreshToken).toBeDefined();
    expect(typeof refreshToken).toBe("string");

    const refreshRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken as string },
    });
    expect(refreshRes.status).toBe(200);
    const refreshResult = refreshRes.body["AuthenticationResult"] as Record<
      string,
      unknown
    >;
    expect(refreshResult["AccessToken"]).toBeDefined();
    expect(refreshResult["IdToken"]).toBeDefined();
    expect(refreshResult["RefreshToken"]).toBeUndefined();
    expect(refreshResult["TokenType"]).toBe("Bearer");
  });

  test("InitiateAuth REFRESH_TOKEN_AUTH: forged token yields NotAuthorizedException", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "refresh-forged-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "forged-client",
        ExplicitAuthFlows: ["ALLOW_REFRESH_TOKEN_AUTH"],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId ?? "";

    const forgedRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: "forged.garbage.token" },
    });
    expect(forgedRes.status).toBe(400);
    expect(forgedRes.body["__type"]).toBe("NotAuthorizedException");
  });

  test("AdminInitiateAuth REFRESH_TOKEN: valid token yields AccessToken, no RefreshToken", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "admin-refresh-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "admin-refresh-client",
        ExplicitAuthFlows: [
          "ALLOW_ADMIN_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "admin-refresh-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "admin-refresh-user",
        Password: "AdminRef1!",
        Permanent: true,
      }),
    );

    const authResult = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: "admin-refresh-user",
          PASSWORD: "AdminRef1!",
        },
      }),
    );
    const refreshToken = authResult.AuthenticationResult?.RefreshToken;
    expect(refreshToken).toBeDefined();

    const refreshResult = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "REFRESH_TOKEN",
        AuthParameters: { REFRESH_TOKEN: refreshToken ?? "" },
      }),
    );
    expect(refreshResult.AuthenticationResult?.AccessToken).toBeDefined();
    expect(refreshResult.AuthenticationResult?.IdToken).toBeDefined();
    expect(refreshResult.AuthenticationResult?.RefreshToken).toBeUndefined();
    expect(refreshResult.AuthenticationResult?.TokenType).toBe("Bearer");
  });

  test("AdminInitiateAuth REFRESH_TOKEN: forged token yields NotAuthorizedException", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "admin-forged-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "admin-forged-client",
        ExplicitAuthFlows: ["ALLOW_REFRESH_TOKEN_AUTH"],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;

    await expect(
      client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: poolId,
          ClientId: clientId,
          AuthFlow: "REFRESH_TOKEN",
          AuthParameters: { REFRESH_TOKEN: "not.a.valid.jwt.at.all" },
        }),
      ),
    ).rejects.toMatchObject({ name: "NotAuthorizedException" });
  });
});
