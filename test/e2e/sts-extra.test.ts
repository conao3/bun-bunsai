import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssumeRoleCommand,
  AssumeRoleWithSAMLCommand,
  AssumeRoleWithWebIdentityCommand,
  DecodeAuthorizationMessageCommand,
  GetCallerIdentityCommand,
  GetFederationTokenCommand,
  GetSessionTokenCommand,
  STSClient,
} from "@aws-sdk/client-sts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sts = () =>
  new STSClient({ endpoint, region, credentials, requestHandler });

const federationHandler = {
  handle(req: Parameters<typeof requestHandler.handle>[0]) {
    const headers = req.headers.authorization
      ? req.headers
      : {
          ...req.headers,
          authorization:
            "AWS4-HMAC-SHA256 Credential=test/20260101/us-east-1/sts/aws4_request, SignedHeaders=host, Signature=0000000000000000000000000000000000000000000000000000000000000000",
        };
    return requestHandler.handle({ ...req, headers });
  },
  updateHttpClientConfig: () => {},
  httpHandlerConfigs: () => ({}) as Record<string, never>,
} as const;

const stsF = () =>
  new STSClient({
    endpoint,
    region,
    credentials,
    requestHandler: federationHandler,
  });

test("STS AssumeRole returns Credentials and AssumedRoleUser", async () => {
  const client = sts();
  const out = await client.send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::000000000000:role/bunsai-e2e",
      RoleSessionName: "bunsai-e2e-session",
    }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(out.AssumedRoleUser?.Arn).toContain(
    "assumed-role/bunsai-e2e/bunsai-e2e-session",
  );
  expect(out.AssumedRoleUser?.AssumedRoleId).toContain("bunsai-e2e-session");
});

test("STS GetSessionToken returns Credentials", async () => {
  const client = sts();
  const out = await client.send(
    new GetSessionTokenCommand({ DurationSeconds: 3600 }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
});

test("STS GetFederationToken returns Credentials and FederatedUser", async () => {
  const client = sts();
  const out = await client.send(
    new GetFederationTokenCommand({ Name: "bunsai-e2e-user" }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.FederatedUser?.Arn).toContain("federated-user/bunsai-e2e-user");
  expect(out.FederatedUser?.FederatedUserId).toContain("bunsai-e2e-user");
});

test("STS AssumeRoleWithWebIdentity returns Credentials and SubjectFromWebIdentityToken", async () => {
  const client = stsF();
  const out = await client.send(
    new AssumeRoleWithWebIdentityCommand({
      RoleArn: "arn:aws:iam::111122223333:role/oidc-role",
      RoleSessionName: "oidc-session",
      WebIdentityToken: "eyJhbGciOiJSUzI1NiJ9.dummy.token",
    }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(out.SubjectFromWebIdentityToken).toBeDefined();
  expect(out.AssumedRoleUser?.Arn).toContain(
    "arn:aws:sts::111122223333:assumed-role/oidc-role/oidc-session",
  );
});

test("AssumeRoleWithWebIdentity credentials route GetCallerIdentity to role account", async () => {
  const caller = stsF();
  const assumed = await caller.send(
    new AssumeRoleWithWebIdentityCommand({
      RoleArn: "arn:aws:iam::222233334444:role/irsa-role",
      RoleSessionName: "irsa-session",
      WebIdentityToken: "eyJhbGciOiJSUzI1NiJ9.dummy.irsa",
    }),
  );
  const assumedClient = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
      secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
      sessionToken: assumed.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await assumedClient.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("222233334444");
});

test("AssumeRoleWithWebIdentity with empty token returns error", async () => {
  const client = stsF();
  await expect(
    client.send(
      new AssumeRoleWithWebIdentityCommand({
        RoleArn: "arn:aws:iam::000000000000:role/bunsai",
        RoleSessionName: "bunsai-session",
        WebIdentityToken: "",
      }),
    ),
  ).rejects.toThrow();
});

test("STS AssumeRoleWithSAML returns Credentials Subject and Issuer", async () => {
  const client = stsF();
  const out = await client.send(
    new AssumeRoleWithSAMLCommand({
      RoleArn: "arn:aws:iam::333344445555:role/saml-role",
      PrincipalArn: "arn:aws:iam::333344445555:saml-provider/MySAML",
      SAMLAssertion: "PHNhbWxwOkFzc2VydGlvbj5kdW1teTwvc2FtbHA6QXNzZXJ0aW9uPg==",
    }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(out.Subject).toBeDefined();
  expect(out.Issuer).toBeDefined();
  expect(out.AssumedRoleUser?.Arn).toContain(
    "arn:aws:sts::333344445555:assumed-role/saml-role/",
  );
});

test("AssumeRoleWithSAML credentials route GetCallerIdentity to role account", async () => {
  const caller = stsF();
  const assumed = await caller.send(
    new AssumeRoleWithSAMLCommand({
      RoleArn: "arn:aws:iam::444455556666:role/saml-cross",
      PrincipalArn: "arn:aws:iam::444455556666:saml-provider/MySAML",
      SAMLAssertion: "PHNhbWxwOkFzc2VydGlvbj5kdW1teTwvc2FtbHA6QXNzZXJ0aW9uPg==",
    }),
  );
  const assumedClient = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
      secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
      sessionToken: assumed.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await assumedClient.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("444455556666");
});

test("AssumeRoleWithSAML with empty assertion returns error", async () => {
  const client = stsF();
  await expect(
    client.send(
      new AssumeRoleWithSAMLCommand({
        RoleArn: "arn:aws:iam::000000000000:role/bunsai",
        PrincipalArn: "arn:aws:iam::000000000000:saml-provider/MySAML",
        SAMLAssertion: "",
      }),
    ),
  ).rejects.toThrow();
});

test("AssumeRole into another account flows through to later calls", async () => {
  const caller = sts();
  const assumed = await caller.send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::111122223333:role/cross-account",
      RoleSessionName: "bunsai-cross",
    }),
  );
  expect(assumed.AssumedRoleUser?.Arn).toContain(
    "arn:aws:sts::111122223333:assumed-role/cross-account/bunsai-cross",
  );

  const assumedClient = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
      secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
      sessionToken: assumed.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await assumedClient.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("111122223333");
  expect(identity.Arn).toBe(
    "arn:aws:sts::111122223333:assumed-role/cross-account/bunsai-cross",
  );
  expect(identity.UserId).toContain("bunsai-cross");

  const defaultIdentity = await caller.send(new GetCallerIdentityCommand({}));
  expect(defaultIdentity.Account).toBe("000000000000");
});

test("GetSessionToken credentials work with GetCallerIdentity", async () => {
  const client = sts();
  const out = await client.send(
    new GetSessionTokenCommand({ DurationSeconds: 3600 }),
  );
  const sessionClient = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: out.Credentials?.AccessKeyId ?? "",
      secretAccessKey: out.Credentials?.SecretAccessKey ?? "",
      sessionToken: out.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await sessionClient.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("000000000000");
  expect(identity.Arn).toBeDefined();
  expect(identity.UserId).toBeDefined();
});

test("GetFederationToken credentials reflect federated-user identity in GetCallerIdentity", async () => {
  const client = sts();
  const out = await client.send(
    new GetFederationTokenCommand({ Name: "fed-e2e-user" }),
  );
  const fedClient = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: out.Credentials?.AccessKeyId ?? "",
      secretAccessKey: out.Credentials?.SecretAccessKey ?? "",
      sessionToken: out.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await fedClient.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("000000000000");
  expect(identity.Arn).toContain("federated-user/fed-e2e-user");
  expect(identity.UserId).toContain("fed-e2e-user");
});

test("DecodeAuthorizationMessage returns DecodedMessage for base64 input", async () => {
  const client = sts();
  const encoded = btoa(
    JSON.stringify({ allowed: false, action: "s3:PutObject" }),
  );
  const out = await client.send(
    new DecodeAuthorizationMessageCommand({ EncodedMessage: encoded }),
  );
  expect(out.DecodedMessage).toBeDefined();
  expect(out.DecodedMessage).toContain("s3:PutObject");
});

test("DecodeAuthorizationMessage returns raw message for non-base64 input", async () => {
  const client = sts();
  const raw = "raw-auth-message-for-testing";
  const out = await client.send(
    new DecodeAuthorizationMessageCommand({ EncodedMessage: raw }),
  );
  expect(out.DecodedMessage).toBeDefined();
});

test("AssumeRole GetCallerIdentity fidelity: session creds reflect assumed role", async () => {
  const client = sts();
  const durationSeconds = 7200;
  const assumed = await client.send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::555566667777:role/fidelity-role",
      RoleSessionName: "fidelity-session",
      DurationSeconds: durationSeconds,
    }),
  );
  expect(assumed.Credentials?.AccessKeyId).toMatch(/^ASIA/);
  expect(assumed.Credentials?.SecretAccessKey).toBeDefined();
  expect(assumed.Credentials?.SessionToken).toBeDefined();
  expect(assumed.Credentials?.Expiration).toBeInstanceOf(Date);
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor(
    (assumed.Credentials?.Expiration?.getTime() ?? 0) / 1000,
  );
  expect(exp).toBeGreaterThan(now + durationSeconds - 5);
  expect(exp).toBeLessThanOrEqual(now + durationSeconds + 5);
  expect(assumed.AssumedRoleUser?.Arn).toBe(
    "arn:aws:sts::555566667777:assumed-role/fidelity-role/fidelity-session",
  );
  expect(assumed.AssumedRoleUser?.AssumedRoleId).toContain("fidelity-session");
  const assumedClient = new STSClient({
    endpoint,
    region,
    requestHandler,
    credentials: {
      accessKeyId: assumed.Credentials?.AccessKeyId ?? "",
      secretAccessKey: assumed.Credentials?.SecretAccessKey ?? "",
      sessionToken: assumed.Credentials?.SessionToken ?? "",
    },
  });
  const identity = await assumedClient.send(new GetCallerIdentityCommand({}));
  expect(identity.Account).toBe("555566667777");
  expect(identity.Arn).toBe(
    "arn:aws:sts::555566667777:assumed-role/fidelity-role/fidelity-session",
  );
  expect(identity.UserId).toContain("fidelity-session");
});
