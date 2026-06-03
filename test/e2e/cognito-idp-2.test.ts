import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  CreateUserPoolCommand,
  DeleteGroupCommand,
  GetGroupCommand,
  ListGroupsCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const awsPort = 4621;
const uiPort = 5721;
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

describe("cognito-idp groups e2e", () => {
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

  test("group lifecycle: create, get, list, delete", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-group-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const groupName = "bunsai-group";

    const created = await client.send(
      new CreateGroupCommand({
        UserPoolId: poolId,
        GroupName: groupName,
        Description: "test group",
        Precedence: 5,
      }),
    );
    expect(created.Group?.GroupName).toBe(groupName);
    expect(created.Group?.UserPoolId).toBe(poolId ?? "");
    expect(created.Group?.Description).toBe("test group");
    expect(created.Group?.Precedence).toBe(5);

    const fetched = await client.send(
      new GetGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
    );
    expect(fetched.Group?.GroupName).toBe(groupName);
    expect(fetched.Group?.Description).toBe("test group");

    const listed = await client.send(
      new ListGroupsCommand({ UserPoolId: poolId }),
    );
    const names = (listed.Groups ?? []).map((g) => g.GroupName);
    expect(names).toContain(groupName);

    await client.send(
      new DeleteGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
    );

    const afterDelete = await client.send(
      new ListGroupsCommand({ UserPoolId: poolId }),
    );
    const afterNames = (afterDelete.Groups ?? []).map((g) => g.GroupName);
    expect(afterNames).not.toContain(groupName);
  });

  test("admin add and remove user from group", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-group-member-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const groupName = "members";
    const username = "bunsai-member";

    await client.send(
      new CreateGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
    );
    await client.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: username }),
    );

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: username,
        GroupName: groupName,
      }),
    );

    await client.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: poolId,
        Username: username,
        GroupName: groupName,
      }),
    );

    const fetched = await client.send(
      new GetGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
    );
    expect(fetched.Group?.GroupName).toBe(groupName);
  });
});
