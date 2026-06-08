import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  CreateUserPoolCommand,
  DeleteGroupCommand,
  GetGroupCommand,
  ListGroupsCommand,
  ListUsersInGroupCommand,
  UpdateGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("cognito-idp groups e2e", () => {
  const cognito = () =>
    new CognitoIdentityProviderClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

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

  test("group membership full lifecycle", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-membership-pool" }),
    );
    const poolId = pool.UserPool?.Id;
    const groupName = "lifecycle-group";
    const username = "lifecycle-user";

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

    const groupsForUser = await client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: poolId,
        Username: username,
      }),
    );
    expect((groupsForUser.Groups ?? []).map((g) => g.GroupName)).toContain(
      groupName,
    );

    const usersInGroup = await client.send(
      new ListUsersInGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
    );
    expect((usersInGroup.Users ?? []).map((u) => u.Username)).toContain(
      username,
    );

    await client.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: poolId,
        Username: username,
        GroupName: groupName,
      }),
    );

    const afterRemoveGroups = await client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: poolId,
        Username: username,
      }),
    );
    expect(afterRemoveGroups.Groups ?? []).toHaveLength(0);

    const afterRemoveUsers = await client.send(
      new ListUsersInGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
    );
    expect(afterRemoveUsers.Users ?? []).toHaveLength(0);
  });

  test("admin user lifecycle", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({
        PoolName: "bunsai-e2e-admin-lifecycle-pool",
      }),
    );
    const poolId = pool.UserPool?.Id;
    const username = "lifecycle-admin-user";

    const created = await client.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: username }),
    );
    expect(created.User?.UserStatus).toBe("FORCE_CHANGE_PASSWORD");

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: "Pass1234!",
        Permanent: true,
      }),
    );
    const confirmed = await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: username }),
    );
    expect(confirmed.UserStatus).toBe("CONFIRMED");

    await client.send(
      new AdminDisableUserCommand({ UserPoolId: poolId, Username: username }),
    );
    const disabled = await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: username }),
    );
    expect(disabled.Enabled).toBe(false);

    await client.send(
      new AdminEnableUserCommand({ UserPoolId: poolId, Username: username }),
    );
    const reenabled = await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: username }),
    );
    expect(reenabled.Enabled).toBe(true);

    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: username,
        UserAttributes: [{ Name: "email", Value: "updated@example.com" }],
      }),
    );
    const updated = await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: username }),
    );
    expect(
      (updated.UserAttributes ?? []).find((a) => a.Name === "email")?.Value,
    ).toBe("updated@example.com");

    await client.send(
      new AdminDeleteUserCommand({ UserPoolId: poolId, Username: username }),
    );
    await expect(
      client.send(
        new AdminGetUserCommand({ UserPoolId: poolId, Username: username }),
      ),
    ).rejects.toMatchObject({ name: "UserNotFoundException" });
  });

  test("update group precedence", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({
        PoolName: "bunsai-e2e-update-group-pool",
      }),
    );
    const poolId = pool.UserPool?.Id;
    const groupName = "precedence-group";

    await client.send(
      new CreateGroupCommand({
        UserPoolId: poolId,
        GroupName: groupName,
        Precedence: 10,
      }),
    );

    const updatedGroup = await client.send(
      new UpdateGroupCommand({
        UserPoolId: poolId,
        GroupName: groupName,
        Precedence: 1,
      }),
    );
    expect(updatedGroup.Group?.Precedence).toBe(1);
  });

  test("missing resource errors", async () => {
    const client = cognito();
    const pool = await client.send(
      new CreateUserPoolCommand({ PoolName: "bunsai-e2e-errors-pool" }),
    );
    const poolId = pool.UserPool?.Id;

    await expect(
      client.send(
        new GetGroupCommand({ UserPoolId: poolId, GroupName: "no-such-group" }),
      ),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

    await expect(
      client.send(
        new AdminGetUserCommand({
          UserPoolId: poolId,
          Username: "no-such-user",
        }),
      ),
    ).rejects.toMatchObject({ name: "UserNotFoundException" });

    await expect(
      client.send(
        new GetGroupCommand({
          UserPoolId: "us-east-1_nopool",
          GroupName: "g",
        }),
      ),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  });
});
