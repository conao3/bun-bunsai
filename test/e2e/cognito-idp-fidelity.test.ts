import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  DeleteUserPoolCommand,
  ListTagsForResourceCommand,
  ListUsersCommand,
  TagResourceCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const authHeader =
  "AWS4-HMAC-SHA256 Credential=test/20241201/us-east-1/cognito-idp/aws4_request, SignedHeaders=content-type;x-amz-target, Signature=fakesig";

const cognitoPost = async (
  target: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> =>
  gwFetch(`${endpoint}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  }).then(async (res) => ({
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  }));

describe("cognito-idp fidelity e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("signup→confirm→auth: UNCONFIRMED gates auth, wrong password fails", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "fidelity-signup-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "signup-client",
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;

    const signUpRes = await cognitoPost("SignUp", {
      ClientId: clientId,
      Username: "fidelity-user",
      Password: "Pass1234!",
      UserAttributes: [{ Name: "email", Value: "fidelity@example.com" }],
    });
    expect(signUpRes.status).toBe(200);

    const authBeforeConfirm = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "fidelity-user", PASSWORD: "Pass1234!" },
    });
    expect(authBeforeConfirm.status).toBe(400);
    expect(authBeforeConfirm.body["__type"]).toBe("UserNotConfirmedException");

    await client.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: poolId,
        Username: "fidelity-user",
      }),
    );

    const authOk = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "fidelity-user", PASSWORD: "Pass1234!" },
    });
    expect(authOk.status).toBe(200);
    expect(
      (authOk.body["AuthenticationResult"] as Record<string, unknown>)?.[
        "AccessToken"
      ],
    ).toBeDefined();

    const authWrong = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "fidelity-user", PASSWORD: "Wrong1!" },
    });
    expect(authWrong.status).toBe(400);
    expect(authWrong.body["__type"]).toBe("NotAuthorizedException");
  });

  test("ConfirmSignUp transitions UNCONFIRMED→CONFIRMED and gates auth", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "fidelity-confirmsignup-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "confirmsignup-client",
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;

    await cognitoPost("SignUp", {
      ClientId: clientId,
      Username: "cs-user",
      Password: "CsPass1!",
    });

    const authBefore = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "cs-user", PASSWORD: "CsPass1!" },
    });
    expect(authBefore.body["__type"]).toBe("UserNotConfirmedException");

    const confirmRes = await cognitoPost("ConfirmSignUp", {
      ClientId: clientId,
      Username: "cs-user",
      ConfirmationCode: "123456",
    });
    expect(confirmRes.status).toBe(200);

    const authAfter = await cognitoPost("InitiateAuth", {
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "cs-user", PASSWORD: "CsPass1!" },
    });
    expect(authAfter.status).toBe(200);
    expect(
      (authAfter.body["AuthenticationResult"] as Record<string, unknown>)?.[
        "AccessToken"
      ],
    ).toBeDefined();
  });

  test("forgot-password flow updates stored password", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "fidelity-forgotpw-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "forgotpw-client",
        ExplicitAuthFlows: [
          "ALLOW_ADMIN_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const clientId = appClient.UserPoolClient?.ClientId;

    await client.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: "fp-user" }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "fp-user",
        Password: "OldPass1!",
        Permanent: true,
      }),
    );

    const forgotRes = await cognitoPost("ForgotPassword", {
      ClientId: clientId,
      Username: "fp-user",
    });
    expect(forgotRes.status).toBe(200);
    expect(
      (forgotRes.body["CodeDeliveryDetails"] as Record<string, unknown>)?.[
        "DeliveryMedium"
      ],
    ).toBe("EMAIL");

    const confirmRes = await cognitoPost("ConfirmForgotPassword", {
      ClientId: clientId,
      Username: "fp-user",
      ConfirmationCode: "000000",
      Password: "NewPass1!",
    });
    expect(confirmRes.status).toBe(200);

    await expect(
      client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: poolId,
          ClientId: clientId,
          AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
          AuthParameters: { USERNAME: "fp-user", PASSWORD: "OldPass1!" },
        }),
      ),
    ).rejects.toMatchObject({ name: "NotAuthorizedException" });

    const newAuth = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "fp-user", PASSWORD: "NewPass1!" },
      }),
    );
    expect(newAuth.AuthenticationResult?.AccessToken).toBeDefined();
  });

  test("ListUsers Filter and PaginationToken", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "fidelity-listusers-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    for (let i = 0; i < 5; i++) {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: `list-user-${i}`,
          UserAttributes: [{ Name: "email", Value: `list${i}@example.com` }],
        }),
      );
    }
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "other-user",
        UserAttributes: [{ Name: "email", Value: "other@different.com" }],
      }),
    );

    const allUsers = await client.send(
      new ListUsersCommand({ UserPoolId: poolId }),
    );
    expect((allUsers.Users ?? []).length).toBe(6);

    const filtered = await client.send(
      new ListUsersCommand({
        UserPoolId: poolId,
        Filter: 'username ^= "list-user"',
      }),
    );
    expect((filtered.Users ?? []).length).toBe(5);
    expect(
      filtered.Users?.every((u) => u.Username?.startsWith("list-user")),
    ).toBe(true);

    const emailFiltered = await client.send(
      new ListUsersCommand({
        UserPoolId: poolId,
        Filter: 'email = "other@different.com"',
      }),
    );
    expect((emailFiltered.Users ?? []).length).toBe(1);
    expect(emailFiltered.Users?.[0]?.Username).toBe("other-user");

    const page1 = await client.send(
      new ListUsersCommand({ UserPoolId: poolId, Limit: 3 }),
    );
    expect((page1.Users ?? []).length).toBe(3);
    expect(page1.PaginationToken).toBeDefined();

    const page2 = await client.send(
      new ListUsersCommand({
        UserPoolId: poolId,
        Limit: 3,
        PaginationToken: page1.PaginationToken,
      }),
    );
    expect((page2.Users ?? []).length).toBe(3);
    const page1Names = (page1.Users ?? []).map((u) => u.Username);
    const page2Names = (page2.Users ?? []).map((u) => u.Username);
    const overlap = page1Names.filter((n) => page2Names.includes(n));
    expect(overlap).toHaveLength(0);
  });

  test("UpdateUserAttributes round-trip reflected in GetUser", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "fidelity-updateattrs-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "updateattrs-client",
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
        Username: "attr-user",
        UserAttributes: [{ Name: "email", Value: "original@example.com" }],
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "attr-user",
        Password: "AttrPass1!",
        Permanent: true,
      }),
    );

    const auth = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "attr-user", PASSWORD: "AttrPass1!" },
      }),
    );
    const accessToken = auth.AuthenticationResult?.AccessToken ?? "";

    const updateRes = await cognitoPost("UpdateUserAttributes", {
      AccessToken: accessToken,
      UserAttributes: [{ Name: "email", Value: "updated@example.com" }],
    });
    expect(updateRes.status).toBe(200);

    const getUserRes = await cognitoPost("GetUser", {
      AccessToken: accessToken,
    });
    expect(getUserRes.status).toBe(200);
    const attrs = getUserRes.body["UserAttributes"] as Array<{
      Name: string;
      Value: string;
    }>;
    const email = attrs.find((a) => a.Name === "email")?.Value;
    expect(email).toBe("updated@example.com");
  });

  test("cognito:groups claim sorted by Precedence", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "fidelity-groups-claim-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "groups-claim-client",
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
        Username: "groups-user",
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "groups-user",
        Password: "GroupPass1!",
        Permanent: true,
      }),
    );

    await client.send(
      new CreateGroupCommand({
        UserPoolId: poolId,
        GroupName: "low-priority",
        Precedence: 10,
      }),
    );
    await client.send(
      new CreateGroupCommand({
        UserPoolId: poolId,
        GroupName: "high-priority",
        Precedence: 1,
      }),
    );
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: "groups-user",
        GroupName: "low-priority",
      }),
    );
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: "groups-user",
        GroupName: "high-priority",
      }),
    );

    const auth = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "groups-user", PASSWORD: "GroupPass1!" },
      }),
    );

    const idToken = auth.AuthenticationResult?.IdToken ?? "";
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const groups = payload["cognito:groups"] as string[];
    expect(Array.isArray(groups)).toBe(true);
    expect(groups).toContain("high-priority");
    expect(groups).toContain("low-priority");
    expect(groups.indexOf("high-priority")).toBeLessThan(
      groups.indexOf("low-priority"),
    );
  });

  test("UserPoolTags round-trip: CreateUserPool with tags → ListTagsForResource", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({
        PoolName: "tagged-pool",
        UserPoolTags: { env: "test", owner: "alice" },
      }),
    );
    const poolArn = pool.UserPool?.Arn;
    expect(typeof poolArn).toBe("string");

    const tags = await client.send(
      new ListTagsForResourceCommand({ ResourceArn: poolArn }),
    );
    expect(tags.Tags).toMatchObject({ env: "test", owner: "alice" });
  });

  test("DeletionProtection guard: ACTIVE pool rejects DeleteUserPool", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({
        PoolName: "protected-pool",
        DeletionProtection: "ACTIVE",
      }),
    );
    const poolId = pool.UserPool?.Id;

    const res = await cognitoPost("DeleteUserPool", { UserPoolId: poolId });
    expect(res.status).toBe(400);
    expect(res.body["__type"]).toBe("InvalidParameterException");
  });

  test("TagResource ref validation: missing pool ARN → ResourceNotFoundException", async () => {
    const res = await cognitoPost("TagResource", {
      ResourceArn:
        "arn:aws:cognito-idp:us-east-1:123456789012:userpool/nonexistent-pool",
      Tags: { key: "value" },
    });
    expect(res.status).toBe(400);
    expect(res.body["__type"]).toBe("ResourceNotFoundException");
  });
});
