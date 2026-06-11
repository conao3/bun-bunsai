import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelResourceRequestCommand,
  CloudControlClient,
  CreateResourceCommand,
  DeleteResourceCommand,
  GetResourceCommand,
  GetResourceRequestStatusCommand,
  ListResourceRequestsCommand,
  ListResourcesCommand,
  UpdateResourceCommand,
} from "@aws-sdk/client-cloudcontrol";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudcontrol = () =>
  new CloudControlClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const typeName = "AWS::S3::Bucket";

test("CloudControl resource lifecycle: create → status SUCCESS → get → update → list → delete", async () => {
  const client = cloudcontrol();

  const initialProps = JSON.stringify({ BucketName: "bunsai-e2e-bucket" });

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: typeName,
      DesiredState: initialProps,
    }),
  );

  expect(created.ProgressEvent).toBeDefined();
  expect(created.ProgressEvent?.TypeName).toBe(typeName);
  expect(created.ProgressEvent?.OperationStatus).toBe("PENDING");
  expect(created.ProgressEvent?.Operation).toBe("CREATE");
  expect(created.ProgressEvent?.RequestToken).toBeDefined();
  const identifier = created.ProgressEvent?.Identifier ?? "";
  const createToken = created.ProgressEvent?.RequestToken ?? "";
  expect(identifier).toBeTruthy();

  const status = await client.send(
    new GetResourceRequestStatusCommand({ RequestToken: createToken }),
  );
  expect(status.ProgressEvent?.OperationStatus).toBe("SUCCESS");
  expect(status.ProgressEvent?.RequestToken).toBe(createToken);

  const got = await client.send(
    new GetResourceCommand({ TypeName: typeName, Identifier: identifier }),
  );
  expect(got.TypeName).toBe(typeName);
  expect(got.ResourceDescription?.Identifier).toBe(identifier);
  expect(got.ResourceDescription?.Properties).toContain("bunsai-e2e-bucket");

  const patch = JSON.stringify([
    { op: "add", path: "/Tags", value: { Env: "e2e" } },
    { op: "replace", path: "/BucketName", value: "bunsai-e2e-bucket-updated" },
  ]);
  const updated = await client.send(
    new UpdateResourceCommand({
      TypeName: typeName,
      Identifier: identifier,
      PatchDocument: patch,
    }),
  );
  expect(updated.ProgressEvent?.Operation).toBe("UPDATE");
  expect(updated.ProgressEvent?.OperationStatus).toBe("PENDING");

  const afterUpdate = await client.send(
    new GetResourceCommand({ TypeName: typeName, Identifier: identifier }),
  );
  const props = JSON.parse(afterUpdate.ResourceDescription?.Properties ?? "{}");
  expect(props.BucketName).toBe("bunsai-e2e-bucket-updated");
  expect(props.Tags?.Env).toBe("e2e");

  const listed = await client.send(
    new ListResourcesCommand({ TypeName: typeName }),
  );
  expect(listed.TypeName).toBe(typeName);
  const found = listed.ResourceDescriptions?.find(
    (d) => d.Identifier === identifier,
  );
  expect(found).toBeDefined();

  const deleted = await client.send(
    new DeleteResourceCommand({ TypeName: typeName, Identifier: identifier }),
  );
  expect(deleted.ProgressEvent?.Operation).toBe("DELETE");
  expect(deleted.ProgressEvent?.OperationStatus).toBe("PENDING");

  await expect(
    client.send(
      new GetResourceCommand({ TypeName: typeName, Identifier: identifier }),
    ),
  ).rejects.toThrow();

  const listedAfterDelete = await client.send(
    new ListResourcesCommand({ TypeName: typeName }),
  );
  const notFound = listedAfterDelete.ResourceDescriptions?.find(
    (d) => d.Identifier === identifier,
  );
  expect(notFound).toBeUndefined();
});

test("CloudControl ListResourceRequests returns requests", async () => {
  const client = cloudcontrol();

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: typeName,
      DesiredState: JSON.stringify({ BucketName: "bunsai-list-test" }),
    }),
  );
  const token = created.ProgressEvent?.RequestToken ?? "";

  const list = await client.send(
    new ListResourceRequestsCommand({ MaxResults: 100 }),
  );
  expect(
    list.ResourceRequestStatusSummaries?.some((s) => s.RequestToken === token),
  ).toBe(true);
});

test("CloudControl CancelResourceRequest cancels PENDING request", async () => {
  const client = cloudcontrol();

  const typeName2 = "AWS::SNS::Topic";

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: typeName2,
      DesiredState: JSON.stringify({ TopicName: "bunsai-cancel-test" }),
    }),
  );
  const token = created.ProgressEvent?.RequestToken ?? "";
  expect(created.ProgressEvent?.OperationStatus).toBe("PENDING");

  const cancelled = await client.send(
    new CancelResourceRequestCommand({ RequestToken: token }),
  );
  expect(cancelled.ProgressEvent?.OperationStatus).toBe("CANCEL_COMPLETE");

  await expect(
    client.send(new CancelResourceRequestCommand({ RequestToken: token })),
  ).rejects.toThrow();
});
