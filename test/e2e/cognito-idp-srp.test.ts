import { createHash, createHmac, randomBytes } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const SRP_N_HEX =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
  "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
  "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
  "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
  "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D" +
  "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
  "83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
  "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
  "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9" +
  "DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
  "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64" +
  "ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7" +
  "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B" +
  "F12FFA06D98A0864D87602733EC86A64521F2B18177B200C" +
  "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31" +
  "43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";

const SRP_N = BigInt(`0x${SRP_N_HEX}`);
const SRP_g = 2n;

const padHex = (n: bigint): string => {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  if (/^[89a-f]/i.test(hex)) hex = `00${hex}`;
  return hex;
};

const srpDigest = (hexStr: string): bigint =>
  BigInt(
    `0x${createHash("sha256").update(Buffer.from(hexStr, "hex")).digest("hex")}`,
  );

const SRP_k = srpDigest(padHex(SRP_N) + "02");

const modPow = (base: bigint, exp: bigint, mod: bigint): bigint => {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
};

const srpHkdf = (S: bigint, u: bigint): Buffer => {
  const ikm = Buffer.from(padHex(S), "hex");
  const salt = Buffer.from(padHex(u), "hex");
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const info = Buffer.concat([
    Buffer.from("Caldera Derived Key", "utf8"),
    Buffer.from([0x01]),
  ]);
  return createHmac("sha256", prk).update(info).digest().subarray(0, 16);
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const getNowString = (): string => {
  const now = new Date();
  const day = DAYS[now.getUTCDay()];
  const month = MONTHS[now.getUTCMonth()];
  const date = now.getUTCDate();
  const h = now.getUTCHours().toString().padStart(2, "0");
  const m = now.getUTCMinutes().toString().padStart(2, "0");
  const s = now.getUTCSeconds().toString().padStart(2, "0");
  const dateStr = date < 10 ? ` ${date}` : `${date}`;
  return `${day} ${month} ${dateStr} ${h}:${m}:${s} UTC ${now.getUTCFullYear()}`;
};

const computeSrpProof = (params: {
  poolId: string;
  username: string;
  password: string;
  SRP_A: string;
  SRP_B: string;
  SALT: string;
  SECRET_BLOCK: string;
  a: bigint;
}): { signature: string; timestamp: string } => {
  const { poolId, username, password, SRP_A, SRP_B, SALT, SECRET_BLOCK, a } =
    params;
  const poolName = poolId.split("_")[1] ?? poolId;
  const A = BigInt(`0x${SRP_A}`);
  const B = BigInt(`0x${SRP_B}`);
  const saltBigInt = BigInt(`0x${SALT}`);
  const u = srpDigest(padHex(A) + padHex(B));
  const innerHash = createHash("sha256")
    .update(`${poolName}${username}:${password}`, "utf8")
    .digest("hex");
  const x = srpDigest(padHex(saltBigInt) + innerHash);
  const v = modPow(SRP_g, x, SRP_N);
  const kv = (SRP_k * v) % SRP_N;
  const base = (((B - kv) % SRP_N) + SRP_N) % SRP_N;
  const S = modPow(base, a + u * x, SRP_N);
  const K = srpHkdf(S, u);
  const secretBlockBytes = Buffer.from(SECRET_BLOCK, "base64");
  const timestamp = getNowString();
  const signature = createHmac("sha256", K)
    .update(poolName, "utf8")
    .update(username, "utf8")
    .update(secretBlockBytes)
    .update(timestamp, "utf8")
    .digest("base64");
  return { signature, timestamp };
};

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

describe("cognito-idp USER_SRP_AUTH e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("USER_SRP_AUTH: correct password issues tokens", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "srp-e2e-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    expect(poolId).toBeDefined();

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "srp-client",
        ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;
    expect(clientId).toBeDefined();

    const username = "srp-user";
    const password = "SrpPass1!";

    await client.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: username }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: password,
        Permanent: true,
      }),
    );

    const aPrivate = BigInt(`0x${randomBytes(32).toString("hex")}`);
    const A = modPow(SRP_g, aPrivate, SRP_N);
    const SRP_A = padHex(A);

    const initiated = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_SRP_AUTH",
      AuthParameters: { USERNAME: username, SRP_A },
    });

    expect(initiated.status).toBe(200);
    expect(initiated.body["ChallengeName"]).toBe("PASSWORD_VERIFIER");
    const cp = (initiated.body["ChallengeParameters"] ?? {}) as Record<
      string,
      string
    >;
    expect(cp["SRP_B"]).toBeDefined();
    expect(cp["SALT"]).toBeDefined();
    expect(cp["SECRET_BLOCK"]).toBeDefined();
    expect(cp["USER_ID_FOR_SRP"]).toBe(username);
    expect(cp["USERNAME"]).toBe(username);

    const { signature, timestamp } = computeSrpProof({
      poolId: poolId!,
      username,
      password,
      SRP_A,
      SRP_B: cp["SRP_B"]!,
      SALT: cp["SALT"]!,
      SECRET_BLOCK: cp["SECRET_BLOCK"]!,
      a: aPrivate,
    });

    const responded = await cognitoPost("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "PASSWORD_VERIFIER",
      ChallengeResponses: {
        USERNAME: username,
        PASSWORD_CLAIM_SIGNATURE: signature,
        PASSWORD_CLAIM_SECRET_BLOCK: cp["SECRET_BLOCK"]!,
        TIMESTAMP: timestamp,
      },
    });

    expect(responded.status).toBe(200);
    const authResult = responded.body["AuthenticationResult"] as
      | Record<string, unknown>
      | undefined;
    expect(authResult?.["AccessToken"]).toBeDefined();
    expect(authResult?.["IdToken"]).toBeDefined();
    expect(authResult?.["TokenType"]).toBe("Bearer");
  });

  test("USER_SRP_AUTH: wrong password throws NotAuthorizedException", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "srp-e2e-wrongpw-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "srp-client-wp",
        ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;

    const username = "srp-user-wp";
    const password = "RealPass1!";

    await client.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: username }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: password,
        Permanent: true,
      }),
    );

    const aPrivate = BigInt(`0x${randomBytes(32).toString("hex")}`);
    const A = modPow(SRP_g, aPrivate, SRP_N);
    const SRP_A = padHex(A);

    const initiated = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_SRP_AUTH",
      AuthParameters: { USERNAME: username, SRP_A },
    });

    const cp = (initiated.body["ChallengeParameters"] ?? {}) as Record<
      string,
      string
    >;

    const { signature, timestamp } = computeSrpProof({
      poolId: poolId!,
      username,
      password: "WrongPass1!",
      SRP_A,
      SRP_B: cp["SRP_B"]!,
      SALT: cp["SALT"]!,
      SECRET_BLOCK: cp["SECRET_BLOCK"]!,
      a: aPrivate,
    });

    const responded = await cognitoPost("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "PASSWORD_VERIFIER",
      ChallengeResponses: {
        USERNAME: username,
        PASSWORD_CLAIM_SIGNATURE: signature,
        PASSWORD_CLAIM_SECRET_BLOCK: cp["SECRET_BLOCK"]!,
        TIMESTAMP: timestamp,
      },
    });

    expect(responded.status).toBe(400);
    expect(responded.body["__type"]).toBe("NotAuthorizedException");
  });
});
