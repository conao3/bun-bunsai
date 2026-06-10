import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminConfirmSignUpCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

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

describe("cognito auth scenario: SignUp → Confirm → InitiateAuth → JWT verify → GetUser", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("full lifecycle: signup confirm auth JWT JWKS GetUser refresh wrong-password", async () => {
    const client = cognito();

    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "scenario-auth-pool" }),
    );
    const poolId = pool.UserPool?.Id ?? "";

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "scenario-client",
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId ?? "";

    const signUpRes = await cognitoPost("SignUp", {
      ClientId: clientId,
      Username: "scenario-user",
      Password: "Scenario1!",
      UserAttributes: [{ Name: "email", Value: "scenario@example.com" }],
    });
    expect(signUpRes.status).toBe(200);
    expect(signUpRes.body["UserConfirmed"]).toBe(false);
    const signUpSub = signUpRes.body["UserSub"] as string;
    expect(typeof signUpSub).toBe("string");
    expect(signUpSub).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    await client.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: poolId,
        Username: "scenario-user",
      }),
    );

    const adminUser = await client.send(
      new AdminGetUserCommand({
        UserPoolId: poolId,
        Username: "scenario-user",
      }),
    );
    expect(adminUser.UserStatus).toBe("CONFIRMED");
    const adminSubAttr = adminUser.UserAttributes?.find(
      (a) => a.Name === "sub",
    );
    expect(adminSubAttr?.Value).toBe(signUpSub);

    const authRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: "scenario-user",
        PASSWORD: "Scenario1!",
      },
    });
    expect(authRes.status).toBe(200);
    const authResult = authRes.body["AuthenticationResult"] as Record<
      string,
      unknown
    >;
    const idToken = authResult["IdToken"] as string;
    const accessToken = authResult["AccessToken"] as string;
    const refreshToken = authResult["RefreshToken"] as string;
    expect(idToken).toBeDefined();
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();
    expect(authResult["TokenType"]).toBe("Bearer");

    const [idHeaderSeg, idPayloadSeg, idSigSeg] = idToken.split(".");
    const idHeader = decodeSegment(idHeaderSeg);
    const idPayload = decodeSegment(idPayloadSeg);

    expect(idHeader.alg).toBe("RS256");
    expect(idHeader.kid).toBeDefined();
    expect(idPayload.token_use).toBe("id");
    expect(idPayload.aud).toBe(clientId);
    expect(idPayload.iss).toBe(
      `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
    );
    expect(idPayload.email).toBe("scenario@example.com");
    expect(idPayload.sub).toBe(signUpSub);

    const jwksRes = await gwFetch(
      `${endpoint}/${poolId}/.well-known/jwks.json`,
    );
    expect(jwksRes.status).toBe(200);
    const jwks = (await jwksRes.json()) as { keys: JwkKey[] };
    const jwk = jwks.keys.find((k) => k.kid === idHeader.kid);
    expect(jwk).toBeDefined();

    const sigKey = await crypto.subtle.importKey(
      "jwk",
      jwk as JwkKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      sigKey,
      Buffer.from(idSigSeg, "base64url"),
      new TextEncoder().encode(`${idHeaderSeg}.${idPayloadSeg}`),
    );
    expect(valid).toBe(true);

    const getUserRes = await cognitoPost("GetUser", {
      AccessToken: accessToken,
    });
    expect(getUserRes.status).toBe(200);
    const getUserBody = getUserRes.body;
    expect(getUserBody["Username"]).toBe("scenario-user");
    const attrs = (
      getUserBody["UserAttributes"] as Array<{
        Name: string;
        Value: string;
      }>
    ).filter(Boolean);
    const emailAttr = attrs.find((a) => a.Name === "email");
    expect(emailAttr?.Value).toBe("scenario@example.com");
    const subAttr = attrs.find((a) => a.Name === "sub");
    expect(subAttr?.Value).toBe(signUpSub);

    const refreshRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken },
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

    const badAuthRes = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: "scenario-user",
        PASSWORD: "WrongPass1!",
      },
    });
    expect(badAuthRes.status).toBe(400);
    expect(badAuthRes.body["__type"]).toBe("NotAuthorizedException");
  });
});
