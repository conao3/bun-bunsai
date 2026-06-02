import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  DeleteUserPoolCommand,
  DescribeUserPoolCommand,
  ListUserPoolsCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("cognito-idp e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

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
});
