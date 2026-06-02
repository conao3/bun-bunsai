import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  ChangeResourceRecordSetsCommand,
  CreateHostedZoneCommand,
  DeleteHostedZoneCommand,
  GetHostedZoneCommand,
  ListHostedZonesCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

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

const route53 = () => new Route53Client({ endpoint, region, credentials });

test("Route53 hosted zone and record set lifecycle", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHostedZoneCommand({
      Name: "bunsai-e2e.example.com",
      CallerReference: `ref-${Date.now()}`,
      HostedZoneConfig: { Comment: "e2e" },
    }),
  );
  const zoneId = created.HostedZone?.Id;
  expect(zoneId).toBeDefined();
  expect(zoneId).toContain("/hostedzone/");
  expect(created.HostedZone?.Name).toBe("bunsai-e2e.example.com.");
  expect(created.DelegationSet?.NameServers?.length ?? 0).toBeGreaterThan(0);
  expect(created.ChangeInfo?.Status).toBeDefined();

  const got = await client.send(new GetHostedZoneCommand({ Id: zoneId }));
  expect(got.HostedZone?.Id).toBe(zoneId);
  expect(got.HostedZone?.Config?.Comment).toBe("e2e");

  const listed = await client.send(new ListHostedZonesCommand({}));
  const ids = (listed.HostedZones ?? []).map((z) => z.Id);
  expect(ids).toContain(zoneId);

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Comment: "add records",
        Changes: [
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "www.bunsai-e2e.example.com.",
              Type: "A",
              TTL: 300,
              ResourceRecords: [{ Value: "192.0.2.1" }, { Value: "192.0.2.2" }],
            },
          },
        ],
      },
    }),
  );

  const records = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const www = (records.ResourceRecordSets ?? []).find(
    (r) => r.Name === "www.bunsai-e2e.example.com." && r.Type === "A",
  );
  expect(www).toBeDefined();
  expect(www?.TTL).toBe(300);
  const values = (www?.ResourceRecords ?? []).map((r) => r.Value).sort();
  expect(values).toEqual(["192.0.2.1", "192.0.2.2"]);

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "www.bunsai-e2e.example.com.",
              Type: "A",
              TTL: 300,
              ResourceRecords: [{ Value: "192.0.2.1" }, { Value: "192.0.2.2" }],
            },
          },
        ],
      },
    }),
  );

  const afterDelete = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const stillThere = (afterDelete.ResourceRecordSets ?? []).find(
    (r) => r.Name === "www.bunsai-e2e.example.com." && r.Type === "A",
  );
  expect(stillThere).toBeUndefined();

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));

  const afterZoneDelete = await client.send(new ListHostedZonesCommand({}));
  const idsAfter = (afterZoneDelete.HostedZones ?? []).map((z) => z.Id);
  expect(idsAfter).not.toContain(zoneId);
});
