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
  expect(identifier).toBe("bunsai-e2e-bucket");

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
  const updateToken = updated.ProgressEvent?.RequestToken ?? "";

  await client.send(
    new GetResourceRequestStatusCommand({ RequestToken: updateToken }),
  );

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
  expect(cancelled.ProgressEvent?.OperationStatus).toBe("CANCEL_IN_PROGRESS");

  const finalStatus = await client.send(
    new GetResourceRequestStatusCommand({ RequestToken: token }),
  );
  expect(finalStatus.ProgressEvent?.OperationStatus).toBe("CANCEL_COMPLETE");

  await expect(
    client.send(new CancelResourceRequestCommand({ RequestToken: token })),
  ).rejects.toThrow();
});

test("CC-01: CreateResource extracts primary identifier from DesiredState and AlreadyExistsException on duplicate", async () => {
  const client = cloudcontrol();

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::DynamoDB::Table",
      DesiredState: JSON.stringify({ TableName: "cc01-test-table" }),
    }),
  );
  expect(created.ProgressEvent?.Identifier).toBe("cc01-test-table");

  const got = await client.send(
    new GetResourceCommand({
      TypeName: "AWS::DynamoDB::Table",
      Identifier: "cc01-test-table",
    }),
  );
  expect(got.ResourceDescription?.Identifier).toBe("cc01-test-table");

  await expect(
    client.send(
      new CreateResourceCommand({
        TypeName: "AWS::DynamoDB::Table",
        DesiredState: JSON.stringify({ TableName: "cc01-test-table" }),
      }),
    ),
  ).rejects.toThrow();
});

test("CC-02: ClientToken idempotency — same token returns same RequestToken and single resource", async () => {
  const client = cloudcontrol();
  const clientToken = crypto.randomUUID();

  const first = await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::CloudFormation::Stack",
      DesiredState: JSON.stringify({ StackName: "cc02-idempotent-stack" }),
      ClientToken: clientToken,
    }),
  );
  const second = await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::CloudFormation::Stack",
      DesiredState: JSON.stringify({ StackName: "cc02-idempotent-stack" }),
      ClientToken: clientToken,
    }),
  );

  expect(first.ProgressEvent?.RequestToken).toBe(
    second.ProgressEvent?.RequestToken,
  );
  expect(first.ProgressEvent?.Identifier).toBe(
    second.ProgressEvent?.Identifier,
  );

  const listed = await client.send(
    new ListResourcesCommand({ TypeName: "AWS::CloudFormation::Stack" }),
  );
  const matches = listed.ResourceDescriptions?.filter(
    (d) => d.Identifier === "cc02-idempotent-stack",
  );
  expect(matches?.length).toBe(1);

  await expect(
    client.send(
      new CreateResourceCommand({
        TypeName: "AWS::CloudFormation::Stack",
        DesiredState: JSON.stringify({ StackName: "different-stack" }),
        ClientToken: clientToken,
      }),
    ),
  ).rejects.toThrow();
});

test("CC-03/CC-04: ListResourceRequests Operations filter works and PENDING requests not auto-resolved", async () => {
  const client = cloudcontrol();

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::CloudWatch::Alarm",
      DesiredState: JSON.stringify({ AlarmName: "cc03-cc04-alarm" }),
    }),
  );
  const token = created.ProgressEvent?.RequestToken ?? "";

  const pendingList = await client.send(
    new ListResourceRequestsCommand({
      ResourceRequestStatusFilter: { OperationStatuses: ["PENDING"] },
    }),
  );
  expect(
    pendingList.ResourceRequestStatusSummaries?.some(
      (s) => s.RequestToken === token,
    ),
  ).toBe(true);

  const createList = await client.send(
    new ListResourceRequestsCommand({
      ResourceRequestStatusFilter: { Operations: ["CREATE"] },
    }),
  );
  expect(
    createList.ResourceRequestStatusSummaries?.some(
      (s) => s.RequestToken === token,
    ),
  ).toBe(true);

  const statusAfterList = await client.send(
    new GetResourceRequestStatusCommand({ RequestToken: token }),
  );
  expect(statusAfterList.ProgressEvent?.OperationStatus).toBe("SUCCESS");

  const pendingAfterResolve = await client.send(
    new ListResourceRequestsCommand({
      ResourceRequestStatusFilter: { OperationStatuses: ["PENDING"] },
    }),
  );
  expect(
    pendingAfterResolve.ResourceRequestStatusSummaries?.some(
      (s) => s.RequestToken === token,
    ),
  ).toBe(false);
});

test("CC-05: CancelResourceRequest returns CANCEL_IN_PROGRESS and reverts DELETE mutation", async () => {
  const client = cloudcontrol();

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::SQS::Queue",
      DesiredState: JSON.stringify({ QueueName: "cc05-delete-cancel-queue" }),
    }),
  );
  const createToken = created.ProgressEvent?.RequestToken ?? "";
  await client.send(
    new GetResourceRequestStatusCommand({ RequestToken: createToken }),
  );

  const deleteReq = await client.send(
    new DeleteResourceCommand({
      TypeName: "AWS::SQS::Queue",
      Identifier: "cc05-delete-cancel-queue",
    }),
  );
  const deleteToken = deleteReq.ProgressEvent?.RequestToken ?? "";
  expect(deleteReq.ProgressEvent?.OperationStatus).toBe("PENDING");

  const cancelled = await client.send(
    new CancelResourceRequestCommand({ RequestToken: deleteToken }),
  );
  expect(cancelled.ProgressEvent?.OperationStatus).toBe("CANCEL_IN_PROGRESS");

  const restored = await client.send(
    new GetResourceCommand({
      TypeName: "AWS::SQS::Queue",
      Identifier: "cc05-delete-cancel-queue",
    }),
  );
  expect(restored.ResourceDescription?.Identifier).toBe(
    "cc05-delete-cancel-queue",
  );

  const finalStatus = await client.send(
    new GetResourceRequestStatusCommand({ RequestToken: deleteToken }),
  );
  expect(finalStatus.ProgressEvent?.OperationStatus).toBe("CANCEL_COMPLETE");
});

test("CC-06: DeleteResource throws ConcurrentOperationException when PENDING request exists", async () => {
  const client = cloudcontrol();

  const created = await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::Kinesis::Stream",
      DesiredState: JSON.stringify({ StreamName: "cc06-concurrent-stream" }),
    }),
  );
  expect(created.ProgressEvent?.OperationStatus).toBe("PENDING");

  await expect(
    client.send(
      new DeleteResourceCommand({
        TypeName: "AWS::Kinesis::Stream",
        Identifier: "cc06-concurrent-stream",
      }),
    ),
  ).rejects.toThrow();
});

test("CC-07: ListResources ResourceModel filter returns only matching resources", async () => {
  const client = cloudcontrol();

  await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::ECR::Repository",
      DesiredState: JSON.stringify({
        RepositoryName: "cc07-repo-alpha",
        Env: "production",
      }),
    }),
  );
  await client.send(
    new CreateResourceCommand({
      TypeName: "AWS::ECR::Repository",
      DesiredState: JSON.stringify({
        RepositoryName: "cc07-repo-beta",
        Env: "staging",
      }),
    }),
  );

  const allRepos = await client.send(
    new ListResourcesCommand({ TypeName: "AWS::ECR::Repository" }),
  );
  expect(
    allRepos.ResourceDescriptions?.filter((d) =>
      d.Identifier?.startsWith("cc07-"),
    ).length,
  ).toBe(2);

  const filtered = await client.send(
    new ListResourcesCommand({
      TypeName: "AWS::ECR::Repository",
      ResourceModel: JSON.stringify({ Env: "production" }),
    }),
  );
  const prodRepos = filtered.ResourceDescriptions?.filter((d) =>
    d.Identifier?.startsWith("cc07-"),
  );
  expect(prodRepos?.length).toBe(1);
  expect(prodRepos?.[0]?.Identifier).toBe("cc07-repo-alpha");
});

test("CC-08: ValidationException for invalid TypeName and out-of-range MaxResults", async () => {
  const client = cloudcontrol();

  await expect(
    client.send(
      new CreateResourceCommand({
        TypeName: "invalid-type",
        DesiredState: "{}",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new ListResourcesCommand({
        TypeName: "AWS::S3::Bucket",
        MaxResults: 0,
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new ListResourcesCommand({
        TypeName: "AWS::S3::Bucket",
        MaxResults: 101,
      }),
    ),
  ).rejects.toThrow();
});
