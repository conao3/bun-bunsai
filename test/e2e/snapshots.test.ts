import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { SnapshotMeta } from "../../apps/server/src/management/api.ts";

const { endpoint, requestHandler, uiFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const s3 = () =>
  new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });

const postJson = (path: string, body: unknown) =>
  uiFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("snapshot lifecycle: create → list → restore → delete", async () => {
  const client = s3();
  const bucket = "snap-test-bucket";

  await client.send(new CreateBucketCommand({ Bucket: bucket }));

  const createRes = await postJson("/__bunsai/snapshots", {
    name: "before-delete",
  });
  expect(createRes.status).toBe(201);
  const snap = (await createRes.json()) as SnapshotMeta;
  expect(snap.id).toBeString();
  expect(snap.name).toBe("before-delete");
  expect(snap.services).toContain("s3");
  expect(snap.entryCount).toBeGreaterThan(0);
  expect(snap.sizeBytes).toBeGreaterThan(0);
  expect(snap.createdAt).toBeString();

  const listRes = await uiFetch("/__bunsai/snapshots");
  expect(listRes.ok).toBe(true);
  const list = (await listRes.json()) as SnapshotMeta[];
  expect(list.length).toBeGreaterThanOrEqual(1);
  expect(list.some((s) => s.id === snap.id)).toBe(true);

  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  const afterDelete = await client.send(new ListBucketsCommand({}));
  expect((afterDelete.Buckets ?? []).some((b) => b.Name === bucket)).toBe(
    false,
  );

  const restoreRes = await postJson(
    `/__bunsai/snapshots/${snap.id}/restore`,
    {},
  );
  expect(restoreRes.ok).toBe(true);
  const restoreMeta = (await restoreRes.json()) as SnapshotMeta;
  expect(restoreMeta.id).toBe(snap.id);

  const headRes = await client
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .catch(() => null);
  expect(headRes).not.toBeNull();

  const deleteRes = await uiFetch(`/__bunsai/snapshots/${snap.id}`, {
    method: "DELETE",
  });
  expect(deleteRes.status).toBe(204);

  const deleteAgain = await uiFetch(`/__bunsai/snapshots/${snap.id}`, {
    method: "DELETE",
  });
  expect(deleteAgain.status).toBe(404);
});

test("snapshot with default name uses snapshot-HHMMSS pattern", async () => {
  const createRes = await postJson("/__bunsai/snapshots", {});
  expect(createRes.status).toBe(201);
  const snap = (await createRes.json()) as SnapshotMeta;
  expect(snap.name).toMatch(/^snapshot-\d{6}$/);

  await uiFetch(`/__bunsai/snapshots/${snap.id}`, { method: "DELETE" });
});

test("restore unknown snapshot returns 404", async () => {
  const res = await postJson("/__bunsai/snapshots/nonexistent-id/restore", {});
  expect(res.status).toBe(404);
});
