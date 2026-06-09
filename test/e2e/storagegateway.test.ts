import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ActivateGatewayCommand,
  AddTagsToResourceCommand,
  AssignTapePoolCommand,
  AssociateFileSystemCommand,
  CancelRetrievalCommand,
  CreateCachediSCSIVolumeCommand,
  CreateNFSFileShareCommand,
  CreateSMBFileShareCommand,
  CreateTapePoolCommand,
  CreateTapeWithBarcodeCommand,
  CreateTapesCommand,
  DeleteFileShareCommand,
  DeleteGatewayCommand,
  DeleteTapeArchiveCommand,
  DeleteTapePoolCommand,
  DeleteVolumeCommand,
  DescribeCachediSCSIVolumesCommand,
  DescribeFileSystemAssociationsCommand,
  DescribeGatewayInformationCommand,
  DescribeNFSFileSharesCommand,
  DescribeSMBFileSharesCommand,
  DescribeTapesCommand,
  DisassociateFileSystemCommand,
  ListCacheReportsCommand,
  ListFileSharesCommand,
  ListFileSystemAssociationsCommand,
  ListGatewaysCommand,
  ListTagsForResourceCommand,
  ListTapePoolsCommand,
  ListTapesCommand,
  ListVolumesCommand,
  RemoveTagsFromResourceCommand,
  RetrieveTapeArchiveCommand,
  ShutdownGatewayCommand,
  StartGatewayCommand,
  StorageGatewayClient,
  UpdateNFSFileShareCommand,
  UpdateSnapshotScheduleCommand,
} from "@aws-sdk/client-storage-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new StorageGatewayClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("storagegateway gateway round-trip", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "ABCDE-12345-FGHIJ-67890-KLMNO",
      GatewayName: "bunsai-e2e-gateway",
      GatewayTimezone: "GMT-5:00",
      GatewayRegion: region,
    }),
  );
  const arn = activated.GatewayARN;
  expect(arn).toContain(":gateway/sgw-");

  const described = await sgw.send(
    new DescribeGatewayInformationCommand({ GatewayARN: arn }),
  );
  expect(described.GatewayARN).toBe(arn);
  expect(described.GatewayName).toBe("bunsai-e2e-gateway");
  expect(described.GatewayTimezone).toBe("GMT-5:00");
  expect(described.GatewayState).toBe("RUNNING");

  const listed = await sgw.send(new ListGatewaysCommand({}));
  const arns = (listed.Gateways ?? []).map((entry) => entry.GatewayARN);
  expect(arns).toContain(arn);

  const deleted = await sgw.send(new DeleteGatewayCommand({ GatewayARN: arn }));
  expect(deleted.GatewayARN).toBe(arn);

  await expect(
    sgw.send(new DescribeGatewayInformationCommand({ GatewayARN: arn })),
  ).rejects.toThrow();
});

test("storagegateway gateway start/shutdown lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "LIFECYCLE-TEST-KEY-12345",
      GatewayName: "lifecycle-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
    }),
  );
  const arn = activated.GatewayARN!;

  const shutdown = await sgw.send(
    new ShutdownGatewayCommand({ GatewayARN: arn }),
  );
  expect(shutdown.GatewayARN).toBe(arn);

  const afterShutdown = await sgw.send(
    new DescribeGatewayInformationCommand({ GatewayARN: arn }),
  );
  expect(afterShutdown.GatewayState).toBe("SHUTDOWN");

  const started = await sgw.send(new StartGatewayCommand({ GatewayARN: arn }));
  expect(started.GatewayARN).toBe(arn);

  const afterStart = await sgw.send(
    new DescribeGatewayInformationCommand({ GatewayARN: arn }),
  );
  expect(afterStart.GatewayState).toBe("RUNNING");

  await sgw.send(new DeleteGatewayCommand({ GatewayARN: arn }));
});

test("storagegateway tags round-trip", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "TAGS-TEST-KEY-12345",
      GatewayName: "tags-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
    }),
  );
  const arn = activated.GatewayARN!;

  await sgw.send(
    new AddTagsToResourceCommand({
      ResourceARN: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );

  const listed = await sgw.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["owner"]).toBe("bunsai");

  await sgw.send(
    new RemoveTagsFromResourceCommand({
      ResourceARN: arn,
      TagKeys: ["owner"],
    }),
  );

  const afterRemove = await sgw.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  const remainingKeys = (afterRemove.Tags ?? []).map((t) => t.Key);
  expect(remainingKeys).toContain("env");
  expect(remainingKeys).not.toContain("owner");

  await sgw.send(new DeleteGatewayCommand({ GatewayARN: arn }));
});

test("storagegateway cached iSCSI volume lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "VOLUME-TEST-KEY-1234",
      GatewayName: "vol-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "CACHED",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const created = await sgw.send(
    new CreateCachediSCSIVolumeCommand({
      GatewayARN: gatewayArn,
      VolumeSizeInBytes: 107374182400,
      NetworkInterfaceId: "10.0.0.1",
      TargetName: "bunsai-target-1",
      ClientToken: "token-1",
    }),
  );
  const volumeArn = created.VolumeARN!;
  expect(volumeArn).toContain("/volume/");

  const described = await sgw.send(
    new DescribeCachediSCSIVolumesCommand({ VolumeARNs: [volumeArn] }),
  );
  expect(described.CachediSCSIVolumes).toHaveLength(1);
  expect(described.CachediSCSIVolumes![0].VolumeARN).toBe(volumeArn);

  const volumes = await sgw.send(
    new ListVolumesCommand({ GatewayARN: gatewayArn }),
  );
  const volArns = (volumes.VolumeInfos ?? []).map((v) => v.VolumeARN);
  expect(volArns).toContain(volumeArn);

  await sgw.send(new DeleteVolumeCommand({ VolumeARN: volumeArn }));
  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway NFS file share lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "NFS-TEST-KEY-12345",
      GatewayName: "nfs-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "FILE_S3",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const created = await sgw.send(
    new CreateNFSFileShareCommand({
      GatewayARN: gatewayArn,
      LocationARN: "arn:aws:s3:::my-bucket",
      Role: "arn:aws:iam::123456789012:role/sgw-role",
      ClientToken: "nfs-token-1",
      ClientList: ["0.0.0.0/0"],
    }),
  );
  const shareArn = created.FileShareARN!;
  expect(shareArn).toContain(":share/");

  await sgw.send(
    new UpdateNFSFileShareCommand({
      FileShareARN: shareArn,
      Squash: "NoSquash",
    }),
  );

  const described = await sgw.send(
    new DescribeNFSFileSharesCommand({ FileShareARNList: [shareArn] }),
  );
  expect(described.NFSFileShareInfoList).toHaveLength(1);
  expect(described.NFSFileShareInfoList![0].FileShareARN).toBe(shareArn);
  expect(described.NFSFileShareInfoList![0].Squash).toBe("NoSquash");

  const listed = await sgw.send(
    new ListFileSharesCommand({ GatewayARN: gatewayArn }),
  );
  const shareArns = (listed.FileShareInfoList ?? []).map((s) => s.FileShareARN);
  expect(shareArns).toContain(shareArn);

  await sgw.send(new DeleteFileShareCommand({ FileShareARN: shareArn }));
  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway SMB file share lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "SMB-TEST-KEY-12345",
      GatewayName: "smb-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "FILE_S3",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const created = await sgw.send(
    new CreateSMBFileShareCommand({
      GatewayARN: gatewayArn,
      LocationARN: "arn:aws:s3:::my-smb-bucket",
      Role: "arn:aws:iam::123456789012:role/sgw-role",
      ClientToken: "smb-token-1",
    }),
  );
  const shareArn = created.FileShareARN!;
  expect(shareArn).toContain(":share/");

  const described = await sgw.send(
    new DescribeSMBFileSharesCommand({ FileShareARNList: [shareArn] }),
  );
  expect(described.SMBFileShareInfoList).toHaveLength(1);
  expect(described.SMBFileShareInfoList![0].FileShareARN).toBe(shareArn);

  await sgw.send(new DeleteFileShareCommand({ FileShareARN: shareArn }));
  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway tape pool and tape lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "TAPE-TEST-KEY-12345",
      GatewayName: "tape-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "VTL",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const pool = await sgw.send(
    new CreateTapePoolCommand({
      PoolName: "bunsai-tape-pool",
      StorageClass: "DEEP_ARCHIVE",
    }),
  );
  const poolArn = pool.PoolARN!;
  expect(poolArn).toContain(":tapepool/");

  const pools = await sgw.send(
    new ListTapePoolsCommand({ PoolARNs: [poolArn] }),
  );
  expect(pools.PoolInfos).toHaveLength(1);
  expect(pools.PoolInfos![0].PoolARN).toBe(poolArn);

  const tape = await sgw.send(
    new CreateTapeWithBarcodeCommand({
      GatewayARN: gatewayArn,
      TapeBarcode: "BSAI001234",
      TapeSizeInBytes: 107374182400,
    }),
  );
  const tapeArn = tape.TapeARN!;
  expect(tapeArn).toContain(":tape/BSAI001234");

  const tapes = await sgw.send(
    new DescribeTapesCommand({ GatewayARN: gatewayArn, TapeARNs: [tapeArn] }),
  );
  expect(tapes.Tapes).toHaveLength(1);
  expect(tapes.Tapes![0].TapeARN).toBe(tapeArn);

  const multiTapes = await sgw.send(
    new CreateTapesCommand({
      GatewayARN: gatewayArn,
      TapeBarcodePrefix: "MULT",
      NumTapesToCreate: 2,
      TapeSizeInBytes: 107374182400,
      ClientToken: "multi-tape-1",
    }),
  );
  expect(multiTapes.TapeARNs).toHaveLength(2);

  await sgw.send(
    new AssignTapePoolCommand({ TapeARN: tapeArn, PoolId: "DEEP_ARCHIVE" }),
  );

  await sgw.send(new DeleteTapePoolCommand({ PoolARN: poolArn }));
  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway snapshot schedule lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "SNAP-TEST-KEY-123456",
      GatewayName: "snap-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "CACHED",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const createdVol = await sgw.send(
    new CreateCachediSCSIVolumeCommand({
      GatewayARN: gatewayArn,
      VolumeSizeInBytes: 107374182400,
      NetworkInterfaceId: "10.0.0.1",
      TargetName: "snap-target",
      ClientToken: "snap-token-1",
    }),
  );
  const volumeArn = createdVol.VolumeARN!;

  await sgw.send(
    new UpdateSnapshotScheduleCommand({
      VolumeARN: volumeArn,
      StartAt: 0,
      RecurrenceInHours: 24,
      Description: "daily snapshot",
    }),
  );

  await sgw.send(new DeleteVolumeCommand({ VolumeARN: volumeArn }));
  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway file system association lifecycle", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "FSA-TEST-KEY-123456",
      GatewayName: "fsa-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "FILE_FSX_SMB",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const fsa = await sgw.send(
    new AssociateFileSystemCommand({
      GatewayARN: gatewayArn,
      LocationARN: "arn:aws:fsx:us-east-1:123456789012:file-system/fs-12345678",
      UserName: "admin",
      Password: "password",
      ClientToken: "fsa-token-1",
    }),
  );
  const fsaArn = fsa.FileSystemAssociationARN!;
  expect(fsaArn).toContain(":fs-association/");

  const described = await sgw.send(
    new DescribeFileSystemAssociationsCommand({
      FileSystemAssociationARNList: [fsaArn],
    }),
  );
  expect(described.FileSystemAssociationInfoList).toHaveLength(1);
  expect(
    described.FileSystemAssociationInfoList![0].FileSystemAssociationARN,
  ).toBe(fsaArn);

  const listed = await sgw.send(
    new ListFileSystemAssociationsCommand({ GatewayARN: gatewayArn }),
  );
  const fsaArns = (listed.FileSystemAssociationSummaryList ?? []).map(
    (f) => f.FileSystemAssociationARN,
  );
  expect(fsaArns).toContain(fsaArn);

  await sgw.send(
    new DisassociateFileSystemCommand({ FileSystemAssociationARN: fsaArn }),
  );

  const afterDisassociate = await sgw.send(
    new ListFileSystemAssociationsCommand({ GatewayARN: gatewayArn }),
  );
  const afterArns = (
    afterDisassociate.FileSystemAssociationSummaryList ?? []
  ).map((f) => f.FileSystemAssociationARN);
  expect(afterArns).not.toContain(fsaArn);

  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway cache reports list", async () => {
  const sgw = client();
  const result = await sgw.send(new ListCacheReportsCommand({}));
  expect(result.CacheReportList).toBeDefined();
});

test("storagegateway tape retrieve and cancel retrieval state transitions", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "RETR-TEST-KEY-12345",
      GatewayName: "retr-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "VTL",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const created = await sgw.send(
    new CreateTapeWithBarcodeCommand({
      GatewayARN: gatewayArn,
      TapeBarcode: "RETR001234",
      TapeSizeInBytes: 107374182400,
    }),
  );
  const tapeArn = created.TapeARN!;

  await expect(
    sgw.send(new DeleteTapeArchiveCommand({ TapeARN: tapeArn })),
  ).rejects.toThrow();

  await sgw.send(
    new RetrieveTapeArchiveCommand({
      TapeARN: tapeArn,
      GatewayARN: gatewayArn,
    }),
  );
  const afterRetrieve = await sgw.send(
    new DescribeTapesCommand({ GatewayARN: gatewayArn, TapeARNs: [tapeArn] }),
  );
  expect(afterRetrieve.Tapes![0].TapeStatus).toBe("RETRIEVING");

  await sgw.send(
    new CancelRetrievalCommand({ TapeARN: tapeArn, GatewayARN: gatewayArn }),
  );
  const afterCancel = await sgw.send(
    new DescribeTapesCommand({ GatewayARN: gatewayArn, TapeARNs: [tapeArn] }),
  );
  expect(afterCancel.Tapes![0].TapeStatus).toBe("ARCHIVED");

  await sgw.send(new DeleteTapeArchiveCommand({ TapeARN: tapeArn }));

  const afterDelete = await sgw.send(
    new DescribeTapesCommand({ GatewayARN: gatewayArn, TapeARNs: [tapeArn] }),
  );
  expect(afterDelete.Tapes).toHaveLength(0);

  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("storagegateway ListTapes pagination", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "PGTN-TEST-KEY-12345",
      GatewayName: "pgtn-gateway",
      GatewayTimezone: "GMT",
      GatewayRegion: region,
      GatewayType: "VTL",
    }),
  );
  const gatewayArn = activated.GatewayARN!;

  const barcodes = ["PGTN000001", "PGTN000002", "PGTN000003"];
  const tapeArns: string[] = [];
  for (const barcode of barcodes) {
    const t = await sgw.send(
      new CreateTapeWithBarcodeCommand({
        GatewayARN: gatewayArn,
        TapeBarcode: barcode,
        TapeSizeInBytes: 107374182400,
      }),
    );
    tapeArns.push(t.TapeARN!);
  }

  const page1 = await sgw.send(new ListTapesCommand({ Limit: 2 }));
  const page1Arns = (page1.TapeInfos ?? []).map((t) => t.TapeARN);
  expect(page1Arns.length).toBe(2);
  expect(page1.Marker).toBeDefined();

  const page2 = await sgw.send(new ListTapesCommand({ Marker: page1.Marker }));
  const page2Arns = (page2.TapeInfos ?? []).map((t) => t.TapeARN);
  expect(page2Arns.length).toBeGreaterThanOrEqual(1);
  expect(page2.Marker).toBeUndefined();

  const allArns = [...page1Arns, ...page2Arns];
  for (const arn of tapeArns) {
    expect(allArns).toContain(arn);
  }

  await sgw.send(new DeleteGatewayCommand({ GatewayARN: gatewayArn }));
});

test("StorageGateway CreateNFSFileShare is idempotent with ClientToken and tags cleared on Delete", async () => {
  const sgw = client();
  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "act-key-idem",
      GatewayName: "gw-idem",
      GatewayTimezone: "GMT",
      GatewayRegion: "us-east-1",
      GatewayType: "FILE_S3",
    }),
  );
  const gatewayArn = activated.GatewayARN as string;
  const token = `idem-${Date.now()}`;

  const first = await sgw.send(
    new CreateNFSFileShareCommand({
      ClientToken: token,
      GatewayARN: gatewayArn,
      LocationARN: "arn:aws:s3:::my-bucket",
      Role: "arn:aws:iam::000000000000:role/sg",
    }),
  );
  const second = await sgw.send(
    new CreateNFSFileShareCommand({
      ClientToken: token,
      GatewayARN: gatewayArn,
      LocationARN: "arn:aws:s3:::my-bucket",
      Role: "arn:aws:iam::000000000000:role/sg",
    }),
  );
  expect(second.FileShareARN).toBe(first.FileShareARN);

  const shareArn = first.FileShareARN as string;
  await sgw.send(
    new AddTagsToResourceCommand({
      ResourceARN: shareArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const tagsBefore = await sgw.send(
    new ListTagsForResourceCommand({ ResourceARN: shareArn }),
  );
  expect((tagsBefore.Tags ?? []).some((t) => t.Key === "env")).toBe(true);

  await sgw.send(new DeleteFileShareCommand({ FileShareARN: shareArn }));
  const tagsAfter = await sgw.send(
    new ListTagsForResourceCommand({ ResourceARN: shareArn }),
  );
  expect((tagsAfter.Tags ?? []).length).toBe(0);
});

test("StorageGateway Start/Shutdown gateway enforce state guards", async () => {
  const sgw = client();
  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "act-key-state",
      GatewayName: "gw-state",
      GatewayTimezone: "GMT",
      GatewayRegion: "us-east-1",
      GatewayType: "FILE_S3",
    }),
  );
  const arn = activated.GatewayARN as string;

  await expect(
    sgw.send(new StartGatewayCommand({ GatewayARN: arn })),
  ).rejects.toThrow(/SHUTDOWN/);

  await sgw.send(new ShutdownGatewayCommand({ GatewayARN: arn }));

  await expect(
    sgw.send(new ShutdownGatewayCommand({ GatewayARN: arn })),
  ).rejects.toThrow(/RUNNING/);

  await sgw.send(new StartGatewayCommand({ GatewayARN: arn }));
});
