import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateViewCommand,
  CreateWorkspaceCommand,
  DescribeViewCommand,
  DescribeWorkspaceCommand,
  UpdateViewMetadataCommand,
  UpdateWorkspaceMetadataCommand,
  UpdateWorkspaceThemeCommand,
  UpdateWorkspaceVisibilityCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("chunk28: UpdateViewMetadata mutates view; UpdateWorkspaceMetadata/Theme/Visibility mutate workspace", async () => {
  const instanceRes = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const InstanceId = instanceRes.Id!;
  expect(InstanceId).toBeDefined();

  const viewRes = await client.send(
    new CreateViewCommand({
      InstanceId,
      Name: "original-view",
      Status: "SAVED",
      Content: { Template: "{}" },
    }),
  );
  const ViewId = viewRes.View!.Id!;
  expect(ViewId).toBeDefined();

  await client.send(
    new UpdateViewMetadataCommand({
      InstanceId,
      ViewId,
      Name: "updated-view",
      Description: "view-desc",
    }),
  );

  const descView = await client.send(
    new DescribeViewCommand({ InstanceId, ViewId }),
  );
  expect(descView.View!.Name).toBe("updated-view");
  expect(descView.View!.Description).toBe("view-desc");

  const wsRes = await client.send(
    new CreateWorkspaceCommand({ InstanceId, Name: "original-ws" }),
  );
  const WorkspaceId = wsRes.WorkspaceId!;
  expect(WorkspaceId).toBeDefined();

  await client.send(
    new UpdateWorkspaceMetadataCommand({
      InstanceId,
      WorkspaceId,
      Name: "updated-ws",
      Description: "ws-desc",
      Title: "WS Title",
    }),
  );

  const descWs1 = await client.send(
    new DescribeWorkspaceCommand({ InstanceId, WorkspaceId }),
  );
  expect(descWs1.Workspace!.Name).toBe("updated-ws");
  expect(descWs1.Workspace!.Description).toBe("ws-desc");
  expect(descWs1.Workspace!.Title).toBe("WS Title");

  await client.send(
    new UpdateWorkspaceThemeCommand({
      InstanceId,
      WorkspaceId,
      Theme: { Light: {}, Dark: {} },
    }),
  );

  const descWs2 = await client.send(
    new DescribeWorkspaceCommand({ InstanceId, WorkspaceId }),
  );
  expect(descWs2.Workspace!.Theme).toBeDefined();

  await client.send(
    new UpdateWorkspaceVisibilityCommand({
      InstanceId,
      WorkspaceId,
      Visibility: "ALL",
    }),
  );

  const descWs3 = await client.send(
    new DescribeWorkspaceCommand({ InstanceId, WorkspaceId }),
  );
  expect(descWs3.Workspace!.Visibility).toBe("ALL");
});
