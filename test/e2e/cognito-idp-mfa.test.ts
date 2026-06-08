import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const authHeader =
  "AWS4-HMAC-SHA256 Credential=test/20260101/us-east-1/cognito-idp/aws4_request, SignedHeaders=content-type;x-amz-target, Signature=fakesig";

const cognitoPost = async (
  target: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const res = await gwFetch(`${endpoint}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
};

describe("cognito-idp MFA e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("TOTP MFA full flow: associate → verify → enable → challenge → respond + wrong code reject", async () => {
    const client = cognito();

    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-mfa-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    expect(poolId).toBeDefined();

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "mfa-client",
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_ADMIN_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;
    expect(clientId).toBeDefined();

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "mfa-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "mfa-user",
        Password: "Pass1234!",
        Permanent: true,
      }),
    );

    const initNoMfa = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "mfa-user", PASSWORD: "Pass1234!" },
    });
    expect(initNoMfa.status).toBe(200);
    const noMfaResult = initNoMfa.body["AuthenticationResult"] as
      | Record<string, unknown>
      | undefined;
    expect(noMfaResult?.["AccessToken"]).toBeDefined();
    const accessToken = noMfaResult?.["AccessToken"] as string;

    const associated = await cognitoPost("AssociateSoftwareToken", {
      AccessToken: accessToken,
    });
    expect(associated.status).toBe(200);
    expect(associated.body["SecretCode"]).toBeDefined();
    expect(typeof associated.body["SecretCode"]).toBe("string");

    const verified = await cognitoPost("VerifySoftwareToken", {
      AccessToken: accessToken,
      UserCode: "000000",
    });
    expect(verified.status).toBe(200);
    expect(verified.body["Status"]).toBe("SUCCESS");

    const setMfaPref = await cognitoPost("SetUserMFAPreference", {
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    });
    expect(setMfaPref.status).toBe(200);

    const getUser = await cognitoPost("GetUser", { AccessToken: accessToken });
    expect(getUser.status).toBe(200);
    const mfaList = getUser.body["UserMFASettingList"] as string[] | undefined;
    expect(mfaList).toContain("SOFTWARE_TOKEN_MFA");
    expect(getUser.body["PreferredMfaSetting"]).toBe("SOFTWARE_TOKEN_MFA");

    const initMfa = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "mfa-user", PASSWORD: "Pass1234!" },
    });
    expect(initMfa.status).toBe(200);
    expect(initMfa.body["ChallengeName"]).toBe("SOFTWARE_TOKEN_MFA");
    expect(initMfa.body["Session"]).toBeDefined();
    expect(initMfa.body["AuthenticationResult"]).toBeUndefined();
    const mfaSession = initMfa.body["Session"] as string;

    const responded = await cognitoPost("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: mfaSession,
      ChallengeResponses: {
        USERNAME: "mfa-user",
        SOFTWARE_TOKEN_MFA_CODE: "123456",
      },
    });
    expect(responded.status).toBe(200);
    const authResult = responded.body["AuthenticationResult"] as
      | Record<string, unknown>
      | undefined;
    expect(authResult?.["AccessToken"]).toBeDefined();
    expect(authResult?.["TokenType"]).toBe("Bearer");

    const initMfa2 = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "mfa-user", PASSWORD: "Pass1234!" },
    });
    expect(initMfa2.status).toBe(200);
    const mfaSession2 = initMfa2.body["Session"] as string;

    const wrongCode = await cognitoPost("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: mfaSession2,
      ChallengeResponses: {
        USERNAME: "mfa-user",
        SOFTWARE_TOKEN_MFA_CODE: "999999",
      },
    });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body["__type"]).toBe("CodeMismatchException");
  });

  test("AdminInitiateAuth MFA challenge and AdminRespondToAuthChallenge", async () => {
    const client = cognito();

    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-admin-mfa-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    expect(poolId).toBeDefined();

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "admin-mfa-client",
        ExplicitAuthFlows: [
          "ALLOW_ADMIN_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;
    expect(clientId).toBeDefined();

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "admin-mfa-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "admin-mfa-user",
        Password: "AdminPass1!",
        Permanent: true,
      }),
    );

    const initNoMfa = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "admin-mfa-user", PASSWORD: "AdminPass1!" },
      }),
    );
    expect(initNoMfa.AuthenticationResult?.AccessToken).toBeDefined();
    const adminAccessToken = initNoMfa.AuthenticationResult?.AccessToken ?? "";

    const assocResult = await cognitoPost("AssociateSoftwareToken", {
      AccessToken: adminAccessToken,
    });
    expect(assocResult.status).toBe(200);

    const verifyResult = await cognitoPost("VerifySoftwareToken", {
      AccessToken: adminAccessToken,
      UserCode: "111111",
    });
    expect(verifyResult.status).toBe(200);
    expect(verifyResult.body["Status"]).toBe("SUCCESS");

    const setMfa = await cognitoPost("SetUserMFAPreference", {
      AccessToken: adminAccessToken,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    });
    expect(setMfa.status).toBe(200);

    const initMfa = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "admin-mfa-user", PASSWORD: "AdminPass1!" },
      }),
    );
    expect(initMfa.ChallengeName).toBe("SOFTWARE_TOKEN_MFA");
    expect(initMfa.Session).toBeDefined();

    const responded = await client.send(
      new AdminRespondToAuthChallengeCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        ChallengeName: "SOFTWARE_TOKEN_MFA",
        Session: initMfa.Session,
        ChallengeResponses: {
          USERNAME: "admin-mfa-user",
          SOFTWARE_TOKEN_MFA_CODE: "123456",
        },
      }),
    );
    expect(responded.AuthenticationResult?.AccessToken).toBeDefined();
    expect(responded.AuthenticationResult?.TokenType).toBe("Bearer");
  });
});
