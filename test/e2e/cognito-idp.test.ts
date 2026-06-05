import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  CreateIdentityProviderCommand,
  CreateResourceServerCommand,
  CreateUserImportJobCommand,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  CreateUserPoolDomainCommand,
  DeleteUserPoolCommand,
  DescribeIdentityProviderCommand,
  DescribeResourceServerCommand,
  DescribeUserImportJobCommand,
  DescribeUserPoolClientCommand,
  DescribeUserPoolCommand,
  DescribeUserPoolDomainCommand,
  ListResourceServersCommand,
  ListTagsForResourceCommand,
  ListUserPoolsCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  StartUserImportJobCommand,
  TagResourceCommand,
  UpdateIdentityProviderCommand,
  UpdateUserPoolClientCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("cognito-idp e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({ endpoint, region, credentials });

  test("user pool lifecycle: create, describe, list, delete", async () => {
    const client = cognito();
    const created = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-pool" }),
    );
    const poolId = created.UserPool?.Id;
    expect(poolId).toBeDefined();
    expect(created.UserPool?.Name).toBe("bunsai-e2e-pool");
    expect(created.UserPool?.Arn).toContain(poolId ?? "");

    const described = await client.send(
      new DescribeUserPoolCommand({ UserPoolId: poolId }),
    );
    expect(described.UserPool?.Id).toBe(poolId ?? "");
    expect(described.UserPool?.Name).toBe("bunsai-e2e-pool");

    const listed = await client.send(
      new ListUserPoolsCommand({ MaxResults: 60 }),
    );
    const ids = (listed.UserPools ?? []).map((p) => p.Id);
    expect(ids).toContain(poolId);

    await client.send(new DeleteUserPoolCommand({ UserPoolId: poolId }));
  });

  test("create user pool client", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-client-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "bunsai-e2e-app",
        GenerateSecret: true,
      }),
    );
    expect(appClient.UserPoolClient?.ClientId).toBeDefined();
    expect(appClient.UserPoolClient?.ClientName).toBe("bunsai-e2e-app");
    expect(appClient.UserPoolClient?.ClientSecret).toBeDefined();
    expect(appClient.UserPoolClient?.UserPoolId).toBe(poolId ?? "");
  });

  test("admin create user, get user and list users", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-user-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const username = "bunsai-user";

    const created = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: username,
        UserAttributes: [{ Name: "email", Value: "user@example.com" }],
      }),
    );
    expect(created.User?.Username).toBe(username);
    const email = (created.User?.Attributes ?? []).find(
      (a) => a.Name === "email",
    );
    expect(email?.Value).toBe("user@example.com");

    const fetched = await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: username }),
    );
    expect(fetched.Username).toBe(username);
    expect(fetched.UserStatus).toBeDefined();
    const fetchedEmail = (fetched.UserAttributes ?? []).find(
      (a) => a.Name === "email",
    );
    expect(fetchedEmail?.Value).toBe("user@example.com");

    const listed = await client.send(
      new ListUsersCommand({ UserPoolId: poolId }),
    );
    const usernames = (listed.Users ?? []).map((u) => u.Username);
    expect(usernames).toContain(username);
  });

  test("user pool client describe and update", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-client-update-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const created = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "initial-name",
      }),
    );
    const clientId = created.UserPoolClient?.ClientId;

    const described = await client.send(
      new DescribeUserPoolClientCommand({
        UserPoolId: poolId,
        ClientId: clientId,
      }),
    );
    expect(described.UserPoolClient?.ClientName).toBe("initial-name");

    const updated = await client.send(
      new UpdateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        ClientName: "updated-name",
      }),
    );
    expect(updated.UserPoolClient?.ClientName).toBe("updated-name");
  });

  test("identity provider lifecycle: create, describe, update, delete", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-idp-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    await client.send(
      new CreateIdentityProviderCommand({
        UserPoolId: poolId,
        ProviderName: "Google",
        ProviderType: "Google",
        ProviderDetails: {
          client_id: "gclientid",
          client_secret: "gsecret",
          authorize_scopes: "email",
        },
      }),
    );

    const described = await client.send(
      new DescribeIdentityProviderCommand({
        UserPoolId: poolId,
        ProviderName: "Google",
      }),
    );
    expect(described.IdentityProvider?.ProviderName).toBe("Google");
    expect(described.IdentityProvider?.ProviderType).toBe("Google");

    const updated = await client.send(
      new UpdateIdentityProviderCommand({
        UserPoolId: poolId,
        ProviderName: "Google",
        IdpIdentifiers: ["google-e2e"],
      }),
    );
    expect(updated.IdentityProvider?.IdpIdentifiers).toContain("google-e2e");
  });

  test("resource server lifecycle: create, describe, list", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-rs-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    await client.send(
      new CreateResourceServerCommand({
        UserPoolId: poolId,
        Identifier: "https://api.example.com",
        Name: "example-api",
        Scopes: [{ ScopeName: "read", ScopeDescription: "Read access" }],
      }),
    );

    const described = await client.send(
      new DescribeResourceServerCommand({
        UserPoolId: poolId,
        Identifier: "https://api.example.com",
      }),
    );
    expect(described.ResourceServer?.Name).toBe("example-api");
    expect(described.ResourceServer?.Scopes).toHaveLength(1);

    const listed = await client.send(
      new ListResourceServersCommand({ UserPoolId: poolId }),
    );
    const identifiers = (listed.ResourceServers ?? []).map(
      (rs) => rs.Identifier,
    );
    expect(identifiers).toContain("https://api.example.com");
  });

  test("admin user create, confirm, and set password", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-signup-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "signup-user",
        UserAttributes: [{ Name: "email", Value: "signup@example.com" }],
      }),
    );

    await client.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: poolId,
        Username: "signup-user",
      }),
    );

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: "signup-user",
        Password: "Pass1234!",
        Permanent: true,
      }),
    );

    const confirmed = await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: "signup-user" }),
    );
    expect(confirmed.UserStatus).toBe("CONFIRMED");
  });

  test("group membership and list users in group", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-group-users-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    await client.send(
      new CreateGroupCommand({ UserPoolId: poolId, GroupName: "admins" }),
    );
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: "group-member",
      }),
    );

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: "group-member",
        GroupName: "admins",
      }),
    );

    const inGroup = await client.send(
      new ListUsersInGroupCommand({ UserPoolId: poolId, GroupName: "admins" }),
    );
    const names = (inGroup.Users ?? []).map((u) => u.Username);
    expect(names).toContain("group-member");
  });

  test("user pool domain lifecycle: create, describe", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-domain-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const domain = `bunsai-e2e-${poolId?.slice(-8) ?? "test"}`;

    await client.send(
      new CreateUserPoolDomainCommand({ Domain: domain, UserPoolId: poolId }),
    );

    const described = await client.send(
      new DescribeUserPoolDomainCommand({ Domain: domain }),
    );
    expect(described.DomainDescription?.Domain).toBe(domain);
    expect(described.DomainDescription?.Status).toBe("ACTIVE");
  });

  test("user import job lifecycle: create, describe, start", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-importjob-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const created = await client.send(
      new CreateUserImportJobCommand({
        UserPoolId: poolId,
        JobName: "test-import",
        CloudWatchLogsRoleArn:
          "arn:aws:iam::123456789012:role/CognitoImportRole",
      }),
    );
    const jobId = created.UserImportJob?.JobId;
    expect(jobId).toBeDefined();
    expect(created.UserImportJob?.Status).toBe("Created");

    const described = await client.send(
      new DescribeUserImportJobCommand({ UserPoolId: poolId, JobId: jobId }),
    );
    expect(described.UserImportJob?.JobName).toBe("test-import");

    const started = await client.send(
      new StartUserImportJobCommand({ UserPoolId: poolId, JobId: jobId }),
    );
    expect(started.UserImportJob?.Status).toBe("Pending");
  });

  test("auth flow: AdminInitiateAuth and AdminRespondToAuthChallenge", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-auth-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    const appClient = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: "auth-client",
        ExplicitAuthFlows: [
          "ALLOW_ADMIN_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    );
    const appClientId = appClient.UserPoolClient?.ClientId;

    await client.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: "auth-user" }),
    );

    const initiated = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: appClientId,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "auth-user", PASSWORD: "Pass1234!" },
      }),
    );
    expect(initiated.AuthenticationResult?.AccessToken).toBeDefined();
    expect(initiated.AuthenticationResult?.TokenType).toBe("Bearer");

    const responded = await client.send(
      new AdminRespondToAuthChallengeCommand({
        UserPoolId: poolId,
        ClientId: appClientId,
        ChallengeName: "PASSWORD_VERIFIER",
        ChallengeResponses: {
          USERNAME: "auth-user",
          PASSWORD_CLAIM_SIGNATURE: "fakesig",
        },
      }),
    );
    expect(responded.AuthenticationResult?.AccessToken).toBeDefined();
  });

  test("tags: tag resource and list tags", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-tags-pool" }),
    );
    const poolArn = pool.UserPool?.Arn;

    await client.send(
      new TagResourceCommand({
        ResourceArn: poolArn,
        Tags: { env: "test", owner: "bunsai" },
      }),
    );

    const listed = await client.send(
      new ListTagsForResourceCommand({ ResourceArn: poolArn }),
    );
    expect(listed.Tags?.["env"]).toBe("test");
    expect(listed.Tags?.["owner"]).toBe("bunsai");
  });
});
