import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateIPSetCommand,
  CreateWebACLCommand,
  DeleteWebACLCommand,
  GetWebACLCommand,
  ListIPSetsCommand,
  ListWebACLsCommand,
  UpdateWebACLCommand,
  WAFV2Client,
  WAFNonexistentItemException,
} from "@aws-sdk/client-wafv2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const wafv2 = () =>
  new WAFV2Client({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const visibilityConfig = {
  SampledRequestsEnabled: true,
  CloudWatchMetricsEnabled: true,
  MetricName: "bunsai-e2e-metric",
} as const;

test("WAFv2 WebACL and IPSet lifecycle", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-webacl";

  const created = await client.send(
    new CreateWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: visibilityConfig,
    }),
  );
  expect(created.Summary?.Id).toBeDefined();
  expect(created.Summary?.ARN).toBeDefined();
  const aclId = created.Summary?.Id ?? "";

  const listed = await client.send(
    new ListWebACLsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.WebACLs ?? []).map((acl) => acl.Name)).toContain(name);

  const got = await client.send(
    new GetWebACLCommand({ Scope: "REGIONAL", Name: name, Id: aclId }),
  );
  expect(got.WebACL?.Name).toBe(name);
  expect(got.LockToken).toBeDefined();
  const lockToken = got.LockToken ?? "";

  const updated = await client.send(
    new UpdateWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: aclId,
      DefaultAction: { Block: {} },
      VisibilityConfig: visibilityConfig,
      LockToken: lockToken,
      Description: "updated",
    }),
  );
  expect(updated.NextLockToken).toBeDefined();
  expect(updated.NextLockToken).not.toBe(lockToken);
  const nextToken = updated.NextLockToken ?? "";

  const ipSet = await client.send(
    new CreateIPSetCommand({
      Name: "bunsai-e2e-ipset",
      Scope: "REGIONAL",
      IPAddressVersion: "IPV4",
      Addresses: ["192.0.2.0/24"],
    }),
  );
  expect(ipSet.Summary?.Id).toBeDefined();

  const ipSets = await client.send(
    new ListIPSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((ipSets.IPSets ?? []).map((set) => set.Name)).toContain(
    "bunsai-e2e-ipset",
  );

  await client.send(
    new DeleteWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: aclId,
      LockToken: nextToken,
    }),
  );
  const afterDelete = await client.send(
    new ListWebACLsCommand({ Scope: "REGIONAL" }),
  );
  expect((afterDelete.WebACLs ?? []).map((acl) => acl.Name)).not.toContain(
    name,
  );
});

test("WAFv2 ListWebACLs pagination", async () => {
  const client = wafv2();
  const prefix = "pag-e2e";
  const names = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];

  for (const n of names) {
    await client.send(
      new CreateWebACLCommand({
        Name: n,
        Scope: "REGIONAL",
        DefaultAction: { Allow: {} },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: `${n}-metric`,
        },
      }),
    );
  }

  const page1 = await client.send(
    new ListWebACLsCommand({ Scope: "REGIONAL", Limit: 1 }),
  );
  expect(page1.WebACLs?.length).toBe(1);
  expect(page1.NextMarker).toBeDefined();

  const page2 = await client.send(
    new ListWebACLsCommand({
      Scope: "REGIONAL",
      Limit: 1,
      NextMarker: page1.NextMarker,
    }),
  );
  expect(page2.WebACLs?.length).toBe(1);
  expect(page2.WebACLs?.[0]?.Name).not.toBe(page1.WebACLs?.[0]?.Name);
});

test("WAFv2 GetWebACL id-mismatch returns WAFNonexistentItemException", async () => {
  const client = wafv2();
  const name = "idmismatch-e2e";

  await client.send(
    new CreateWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: `${name}-metric`,
      },
    }),
  );

  await expect(
    client.send(
      new GetWebACLCommand({
        Name: name,
        Scope: "REGIONAL",
        Id: "wrong-id-0000-0000-0000-000000000000",
      }),
    ),
  ).rejects.toThrow(WAFNonexistentItemException);
});

test("WAFv2 GetWebACL ARN-based lookup", async () => {
  const client = wafv2();
  const name = "arn-lookup-e2e";

  const created = await client.send(
    new CreateWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: `${name}-metric`,
      },
    }),
  );
  const aclArn = created.Summary?.ARN ?? "";
  expect(aclArn).toBeTruthy();

  const got = await client.send(new GetWebACLCommand({ ARN: aclArn }));
  expect(got.WebACL?.Name).toBe(name);
  expect(got.WebACL?.ARN).toBe(aclArn);
});
