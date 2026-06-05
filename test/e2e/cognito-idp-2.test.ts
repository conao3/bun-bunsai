import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("cognito-idp groups e2e", () => {
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
