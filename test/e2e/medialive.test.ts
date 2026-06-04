import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateChannelCommand,
  CreateInputCommand,
  CreateInputSecurityGroupCommand,
  CreateMultiplexCommand,
  CreateMultiplexProgramCommand,
  DeleteChannelCommand,
  DeleteInputCommand,
  DeleteInputSecurityGroupCommand,
  DeleteMultiplexCommand,
  DeleteMultiplexProgramCommand,
  DeleteReservationCommand,
  DescribeChannelCommand,
  DescribeInputCommand,
  DescribeInputSecurityGroupCommand,
  DescribeMultiplexCommand,
  DescribeMultiplexProgramCommand,
  DescribeReservationCommand,
  ListChannelsCommand,
  ListInputSecurityGroupsCommand,
  ListInputsCommand,
  ListMultiplexProgramsCommand,
  ListMultiplexesCommand,
  ListOfferingsCommand,
  ListReservationsCommand,
  MediaLiveClient,
  PurchaseOfferingCommand,
} from "@aws-sdk/client-medialive";

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

const medialive = () =>
  new MediaLiveClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaLive channel roundtrip", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateChannelCommand({ Name: "bunsai-e2e-channel" }),
  );
  const id = created.Channel?.Id;
  expect(id).toBeDefined();
  expect(created.Channel?.Arn).toBeDefined();
  expect(created.Channel?.Name).toBe("bunsai-e2e-channel");
  expect(created.Channel?.State).toBe("IDLE");

  const described = await client.send(
    new DescribeChannelCommand({ ChannelId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.Name).toBe("bunsai-e2e-channel");

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Channels ?? []).map((c) => c.Id)).toContain(id);

  const deleted = await client.send(
    new DeleteChannelCommand({ ChannelId: id }),
  );
  expect(deleted.State).toBe("DELETING");

  await expect(
    client.send(new DescribeChannelCommand({ ChannelId: id })),
  ).rejects.toThrow();
});

test("MediaLive input lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateInputCommand({ Name: "bunsai-e2e-input", Type: "UDP_PUSH" }),
  );
  const id = created.Input?.Id;
  expect(id).toBeDefined();
  expect(created.Input?.Arn).toBeDefined();
  expect(created.Input?.Name).toBe("bunsai-e2e-input");
  expect(created.Input?.State).toBe("DETACHED");
  expect(created.Input?.Type).toBe("UDP_PUSH");

  const described = await client.send(
    new DescribeInputCommand({ InputId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.Name).toBe("bunsai-e2e-input");

  const listed = await client.send(new ListInputsCommand({}));
  expect((listed.Inputs ?? []).map((i) => i.Id)).toContain(id);

  await client.send(new DeleteInputCommand({ InputId: id }));

  await expect(
    client.send(new DescribeInputCommand({ InputId: id })),
  ).rejects.toThrow();
});

test("MediaLive input security group lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateInputSecurityGroupCommand({
      WhitelistRules: [{ Cidr: "10.0.0.0/8" }],
    }),
  );
  const id = created.SecurityGroup?.Id;
  expect(id).toBeDefined();
  expect(created.SecurityGroup?.Arn).toBeDefined();
  expect(created.SecurityGroup?.State).toBe("IDLE");

  const described = await client.send(
    new DescribeInputSecurityGroupCommand({ InputSecurityGroupId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.WhitelistRules).toHaveLength(1);

  const listed = await client.send(new ListInputSecurityGroupsCommand({}));
  expect((listed.InputSecurityGroups ?? []).map((g) => g.Id)).toContain(id);

  await client.send(
    new DeleteInputSecurityGroupCommand({ InputSecurityGroupId: id }),
  );

  await expect(
    client.send(
      new DescribeInputSecurityGroupCommand({ InputSecurityGroupId: id }),
    ),
  ).rejects.toThrow();
});

test("MediaLive multiplex and program lifecycle", async () => {
  const client = medialive();

  const mxCreated = await client.send(
    new CreateMultiplexCommand({
      Name: "bunsai-e2e-multiplex",
      AvailabilityZones: ["us-east-1a", "us-east-1b"],
      MultiplexSettings: {
        TransportStreamBitrate: 1000000,
        TransportStreamId: 1,
      },
      RequestId: "req-123",
    }),
  );
  const mxId = mxCreated.Multiplex?.Id;
  expect(mxId).toBeDefined();
  expect(mxCreated.Multiplex?.Arn).toBeDefined();
  expect(mxCreated.Multiplex?.Name).toBe("bunsai-e2e-multiplex");
  expect(mxCreated.Multiplex?.State).toBe("IDLE");

  const mxDescribed = await client.send(
    new DescribeMultiplexCommand({ MultiplexId: mxId }),
  );
  expect(mxDescribed.Id).toBe(mxId);

  const progCreated = await client.send(
    new CreateMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "e2e-program",
      MultiplexProgramSettings: {
        ProgramNumber: 1,
        ServiceDescriptor: { ProviderName: "test", ServiceName: "e2e" },
        VideoSettings: { ConstantBitrate: 500000 },
      },
      RequestId: "req-prog-1",
    }),
  );
  expect(progCreated.MultiplexProgram?.ProgramName).toBe("e2e-program");

  const progDescribed = await client.send(
    new DescribeMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "e2e-program",
    }),
  );
  expect(progDescribed.ProgramName).toBe("e2e-program");

  const progListed = await client.send(
    new ListMultiplexProgramsCommand({ MultiplexId: mxId }),
  );
  expect(
    (progListed.MultiplexPrograms ?? []).map((p) => p.ProgramName),
  ).toContain("e2e-program");

  await client.send(
    new DeleteMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "e2e-program",
    }),
  );

  const mxListed = await client.send(new ListMultiplexesCommand({}));
  expect((mxListed.Multiplexes ?? []).map((m) => m.Id)).toContain(mxId);

  await client.send(new DeleteMultiplexCommand({ MultiplexId: mxId }));

  await expect(
    client.send(new DescribeMultiplexCommand({ MultiplexId: mxId })),
  ).rejects.toThrow();
});

test("MediaLive reservation and offering lifecycle", async () => {
  const client = medialive();

  const offerings = await client.send(new ListOfferingsCommand({}));
  expect((offerings.Offerings ?? []).length).toBeGreaterThan(0);
  const offeringId = offerings.Offerings![0].OfferingId!;
  expect(offeringId).toBeDefined();

  const purchased = await client.send(
    new PurchaseOfferingCommand({
      OfferingId: offeringId,
      Count: 1,
      Name: "bunsai-e2e-reservation",
    }),
  );
  const reservationId = purchased.Reservation?.ReservationId;
  expect(reservationId).toBeDefined();
  expect(purchased.Reservation?.State).toBe("ACTIVE");
  expect(purchased.Reservation?.OfferingId).toBe(offeringId);

  const described = await client.send(
    new DescribeReservationCommand({ ReservationId: reservationId }),
  );
  expect(described.ReservationId).toBe(reservationId);

  const listed = await client.send(new ListReservationsCommand({}));
  expect((listed.Reservations ?? []).map((r) => r.ReservationId)).toContain(
    reservationId,
  );

  const deleted = await client.send(
    new DeleteReservationCommand({ ReservationId: reservationId }),
  );
  expect(deleted.State).toBe("CANCELED");

  await expect(
    client.send(
      new DescribeReservationCommand({ ReservationId: reservationId }),
    ),
  ).rejects.toThrow();
});
