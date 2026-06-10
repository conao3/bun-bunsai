import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
void region;
void credentials;

const authHeader =
  "AWS4-HMAC-SHA256 Credential=test/20260611/us-east-1/cognito-idp/aws4_request, SignedHeaders=content-type;x-amz-target, Signature=fakesig";
void requestHandler;

const cognitoPost = async (
  action: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const res = await gwFetch(`${endpoint}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
};

const base32Decode = (encoded: string): Buffer => {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const s = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let acc = 0;
  const bytes: number[] = [];
  for (const ch of s) {
    const val = CHARS.indexOf(ch);
    if (val === -1) continue;
    acc = (acc << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
};

const computeTotp = (secret: string, stepOffset = 0): string => {
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
};

describe("cognito TOTP MFA scenario: associate → verify → enable → challenge → respond", () => {
  test("full TOTP MFA lifecycle with real RFC 6238 code", async () => {
    const createPool = await cognitoPost("CreateUserPool", {
      PoolName: "totp-scenario-pool",
    });
    expect(createPool.status).toBe(200);
    const poolId = (createPool.body["UserPool"] as Record<string, unknown>)?.[
      "Id"
    ] as string;
    expect(poolId).toBeDefined();

    const createClient = await cognitoPost("CreateUserPoolClient", {
      UserPoolId: poolId,
      ClientName: "totp-scenario-client",
      ExplicitAuthFlows: [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ],
    });
    expect(createClient.status).toBe(200);
    const clientId = (
      createClient.body["UserPoolClient"] as Record<string, unknown>
    )?.["ClientId"] as string;
    expect(clientId).toBeDefined();

    const signUp = await cognitoPost("SignUp", {
      ClientId: clientId,
      Username: "totp-user",
      Password: "Totp1234!",
      UserAttributes: [{ Name: "email", Value: "totp@example.com" }],
    });
    expect(signUp.status).toBe(200);

    const confirm = await cognitoPost("AdminConfirmSignUp", {
      UserPoolId: poolId,
      Username: "totp-user",
    });
    expect(confirm.status).toBe(200);

    const initAuth = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "totp-user", PASSWORD: "Totp1234!" },
    });
    expect(initAuth.status).toBe(200);
    const authResult = initAuth.body["AuthenticationResult"] as
      | Record<string, unknown>
      | undefined;
    expect(authResult?.["AccessToken"]).toBeDefined();
    const accessToken = authResult?.["AccessToken"] as string;

    const associate = await cognitoPost("AssociateSoftwareToken", {
      AccessToken: accessToken,
    });
    expect(associate.status).toBe(200);
    const secretCode = associate.body["SecretCode"] as string;
    expect(secretCode).toBeDefined();
    expect(typeof secretCode).toBe("string");

    const totpCode = computeTotp(secretCode);
    const verify = await cognitoPost("VerifySoftwareToken", {
      AccessToken: accessToken,
      UserCode: totpCode,
    });
    expect(verify.status).toBe(200);
    expect(verify.body["Status"]).toBe("SUCCESS");

    const setMfa = await cognitoPost("SetUserMFAPreference", {
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    });
    expect(setMfa.status).toBe(200);

    const initMfa = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "totp-user", PASSWORD: "Totp1234!" },
    });
    expect(initMfa.status).toBe(200);
    expect(initMfa.body["ChallengeName"]).toBe("SOFTWARE_TOKEN_MFA");
    const session = initMfa.body["Session"] as string;
    expect(session).toBeDefined();

    const challengeCode = computeTotp(secretCode);
    const respond = await cognitoPost("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: session,
      ChallengeResponses: {
        USERNAME: "totp-user",
        SOFTWARE_TOKEN_MFA_CODE: challengeCode,
      },
    });
    expect(respond.status).toBe(200);
    const mfaResult = respond.body["AuthenticationResult"] as
      | Record<string, unknown>
      | undefined;
    expect(mfaResult?.["AccessToken"]).toBeDefined();
    expect(mfaResult?.["TokenType"]).toBe("Bearer");
    expect(mfaResult?.["IdToken"]).toBeDefined();
    expect(mfaResult?.["RefreshToken"]).toBeDefined();

    const initMfa2 = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "totp-user", PASSWORD: "Totp1234!" },
    });
    expect(initMfa2.status).toBe(200);
    const session2 = initMfa2.body["Session"] as string;

    const badRespond = await cognitoPost("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: session2,
      ChallengeResponses: {
        USERNAME: "totp-user",
        SOFTWARE_TOKEN_MFA_CODE: "000000",
      },
    });
    expect(badRespond.status).toBe(400);
    expect(badRespond.body["__type"]).toBe("CodeMismatchException");
  });
});
