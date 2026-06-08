import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
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

describe("cognito-idp GlobalSignOut + RevokeToken e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("GlobalSignOut invalidates refresh token", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "signout-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "signout-client",
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
        Username: "signout-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "signout-user",
        Password: "Signout1!",
        Permanent: true,
      }),
    );

    const authRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "signout-user", PASSWORD: "Signout1!" },
    });
    expect(authRes.status).toBe(200);
    const authResult = authRes.body["AuthenticationResult"] as Record<
      string,
      unknown
    >;
    const refreshToken = authResult["RefreshToken"] as string;
    const accessToken = authResult["AccessToken"] as string;
    expect(refreshToken).toBeDefined();
    expect(accessToken).toBeDefined();

    const signoutRes = await cognitoPost("GlobalSignOut", {
      AccessToken: accessToken,
    });
    expect(signoutRes.status).toBe(200);

    const refreshRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });
    expect(refreshRes.status).toBe(400);
    expect(refreshRes.body["__type"]).toBe("NotAuthorizedException");
  });

  test("RevokeToken invalidates specific refresh token", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "revoke-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "revoke-client",
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
        Username: "revoke-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "revoke-user",
        Password: "Revoke1!",
        Permanent: true,
      }),
    );

    const authRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "revoke-user", PASSWORD: "Revoke1!" },
    });
    expect(authRes.status).toBe(200);
    const refreshToken = (
      authRes.body["AuthenticationResult"] as Record<string, unknown>
    )["RefreshToken"] as string;
    expect(refreshToken).toBeTruthy();

    const revokeRes = await cognitoPost("RevokeToken", {
      Token: refreshToken,
      ClientId: clientId,
    });
    expect(revokeRes.status).toBe(200);

    const refreshRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });
    expect(refreshRes.status).toBe(400);
    expect(refreshRes.body["__type"]).toBe("NotAuthorizedException");
  });
});

describe("cognito-idp user pool client OAuth settings round-trip", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("CreateUserPoolClient with OAuth settings persists and round-trips", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "oauth-settings-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const created = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "oauth-client",
        GenerateSecret: true,
        AllowedOAuthFlows: ["code", "implicit"],
        AllowedOAuthScopes: ["openid", "email", "profile"],
        CallbackURLs: ["https://example.com/callback"],
      }),
    );
    const uc = created.UserPoolClient;
    expect(uc?.ClientSecret).toBeDefined();
    expect(typeof uc?.ClientSecret).toBe("string");
    expect(uc?.AllowedOAuthFlows).toEqual(["code", "implicit"]);
    expect(uc?.AllowedOAuthScopes).toEqual(["openid", "email", "profile"]);
    expect(uc?.CallbackURLs).toEqual(["https://example.com/callback"]);

    const described = await client.send(
      new DescribeUserPoolClientCommand({
        UserPoolId: poolId,
        ClientId: uc?.ClientId ?? "",
      }),
    );
    const duc = described.UserPoolClient;
    expect(duc?.ClientSecret).toBe(uc?.ClientSecret);
    expect(duc?.AllowedOAuthFlows).toEqual(["code", "implicit"]);
    expect(duc?.AllowedOAuthScopes).toEqual(["openid", "email", "profile"]);
    expect(duc?.CallbackURLs).toEqual(["https://example.com/callback"]);
  });

  test("UpdateUserPoolClient updates OAuth settings", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "oauth-update-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const created = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "update-client",
        AllowedOAuthFlows: ["code"],
        AllowedOAuthScopes: ["openid"],
        CallbackURLs: ["https://example.com/v1"],
      }),
    );
    const clientId = created.UserPoolClient?.ClientId ?? "";

    const updated = await client.send(
      new UpdateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AllowedOAuthFlows: ["code", "client_credentials"],
        AllowedOAuthScopes: ["openid", "aws.cognito.signin.user.admin"],
        CallbackURLs: ["https://example.com/v2"],
      }),
    );
    const uuc = updated.UserPoolClient;
    expect(uuc?.AllowedOAuthFlows).toEqual(["code", "client_credentials"]);
    expect(uuc?.AllowedOAuthScopes).toEqual([
      "openid",
      "aws.cognito.signin.user.admin",
    ]);
    expect(uuc?.CallbackURLs).toEqual(["https://example.com/v2"]);
  });
});
