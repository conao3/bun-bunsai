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

const cognito = () =>
  new CognitoIdentityProviderClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

type JwkKey = {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
};

const decodeSegment = (segment: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));

describe("Cognito issues verifiable RS256 JWTs", () => {
  test("token is signed by the published JWKS key and carries Cognito claims", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-jwt-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "jwt-client",
        ExplicitAuthFlows: ["ALLOW_ADMIN_USER_PASSWORD_AUTH"],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId ?? "";

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "jwt-user",
        UserAttributes: [{ Name: "email", Value: "jwt@example.com" }],
      }),
    );

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "jwt-user",
        Password: "Pass1234!",
        Permanent: true,
      }),
    );

    const auth = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "jwt-user", PASSWORD: "Pass1234!" },
      }),
    );
    const idToken = auth.AuthenticationResult?.IdToken ?? "";
    const [headerSeg, payloadSeg, sigSeg] = idToken.split(".");
    const header = decodeSegment(headerSeg);
    const payload = decodeSegment(payloadSeg);

    expect(header.alg).toBe("RS256");
    expect(header.kid).toBeDefined();
    expect(payload.token_use).toBe("id");
    expect(payload.aud).toBe(clientId);
    expect(payload.iss).toBe(
      `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
    );
    expect(payload["cognito:username"]).toBe("jwt-user");
    expect(payload.email).toBe("jwt@example.com");

    const jwksResponse = await gwFetch(
      `http://localhost:4566/${poolId}/.well-known/jwks.json`,
    );
    expect(jwksResponse.status).toBe(200);
    const jwks = (await jwksResponse.json()) as { keys: JwkKey[] };
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    expect(jwk).toBeDefined();

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk as JwkKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      Buffer.from(sigSeg, "base64url"),
      new TextEncoder().encode(`${headerSeg}.${payloadSeg}`),
    );
    expect(valid).toBe(true);

    const tampered = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      Buffer.from(sigSeg, "base64url"),
      new TextEncoder().encode(`${headerSeg}.${payloadSeg}x`),
    );
    expect(tampered).toBe(false);
  });

  test("OIDC discovery document points at the JWKS", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-oidc-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const response = await gwFetch(
      `http://localhost:4566/${poolId}/.well-known/openid-configuration`,
    );
    expect(response.status).toBe(200);
    const config = (await response.json()) as {
      issuer: string;
      jwks_uri: string;
    };
    expect(config.issuer).toBe(
      `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
    );
    expect(config.jwks_uri).toBe(`${config.issuer}/.well-known/jwks.json`);
  });
});
