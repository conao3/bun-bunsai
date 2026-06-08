import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCapacityReservationCommand,
  CreateFlowLogsCommand,
  EC2Client,
  GetDefaultCreditSpecificationCommand,
  GetEbsDefaultKmsKeyIdCommand,
  GetEnabledIpamPolicyCommand,
  GetFlowLogsIntegrationTemplateCommand,
  GetGroupsForCapacityReservationCommand,
  GetHostReservationPurchasePreviewCommand,
  GetInstanceMetadataDefaultsCommand,
  GetInstanceTypesFromInstanceRequirementsCommand,
  GetIpamAddressHistoryCommand,
  ModifyDefaultCreditSpecificationCommand,
  ModifyEbsDefaultKmsKeyIdCommand,
  ResetEbsDefaultKmsKeyIdCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ModifyDefaultCreditSpecification → GetDefaultCreditSpecification reflects it", async () => {
  const modify = await client.send(
    new ModifyDefaultCreditSpecificationCommand({
      InstanceFamily: "t3",
      CpuCredits: "unlimited",
    }),
  );
  expect(modify.InstanceFamilyCreditSpecification?.InstanceFamily).toBe("t3");
  expect(modify.InstanceFamilyCreditSpecification?.CpuCredits).toBe(
    "unlimited",
  );

  const get = await client.send(
    new GetDefaultCreditSpecificationCommand({ InstanceFamily: "t3" }),
  );
  expect(get.InstanceFamilyCreditSpecification?.InstanceFamily).toBe("t3");
  expect(get.InstanceFamilyCreditSpecification?.CpuCredits).toBe("unlimited");

  const getDefault = await client.send(
    new GetDefaultCreditSpecificationCommand({ InstanceFamily: "t2" }),
  );
  expect(getDefault.InstanceFamilyCreditSpecification?.CpuCredits).toBe(
    "standard",
  );
});

test("ModifyEbsDefaultKmsKeyId → GetEbsDefaultKmsKeyId returns it; ResetEbsDefaultKmsKeyId reverts", async () => {
  const modify = await client.send(
    new ModifyEbsDefaultKmsKeyIdCommand({
      KmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/test-key-id",
    }),
  );
  expect(modify.KmsKeyId).toBe(
    "arn:aws:kms:us-east-1:123456789012:key/test-key-id",
  );

  const get = await client.send(new GetEbsDefaultKmsKeyIdCommand({}));
  expect(get.KmsKeyId).toBe(
    "arn:aws:kms:us-east-1:123456789012:key/test-key-id",
  );

  const reset = await client.send(new ResetEbsDefaultKmsKeyIdCommand({}));
  expect(reset.KmsKeyId).toBe("alias/aws/ebs");

  const getAfterReset = await client.send(new GetEbsDefaultKmsKeyIdCommand({}));
  expect(getAfterReset.KmsKeyId).toBe("alias/aws/ebs");
});

test("GetEnabledIpamPolicy returns disabled when no policy set", async () => {
  const res = await client.send(new GetEnabledIpamPolicyCommand({}));
  expect(res.IpamPolicyEnabled).toBe(false);
});

test("GetGroupsForCapacityReservation returns empty list for valid reservation", async () => {
  const created = await client.send(
    new CreateCapacityReservationCommand({
      InstanceType: "t3.small",
      InstancePlatform: "Linux/UNIX",
      InstanceCount: 2,
      AvailabilityZone: `${region}a`,
    }),
  );
  const reservationId = created.CapacityReservation?.CapacityReservationId;
  expect(reservationId).toBeDefined();

  const groups = await client.send(
    new GetGroupsForCapacityReservationCommand({
      CapacityReservationId: reservationId!,
    }),
  );
  expect(Array.isArray(groups.CapacityReservationGroups)).toBe(true);
  expect(groups.CapacityReservationGroups!.length).toBe(0);
});

test("GetHostReservationPurchasePreview returns preview data", async () => {
  const res = await client.send(
    new GetHostReservationPurchasePreviewCommand({
      HostIdSet: ["h-0123456789abcdef0"],
      OfferingId: "hro-0123456789abcdef0",
    }),
  );
  expect(res.CurrencyCode).toBe("USD");
  expect(Array.isArray(res.Purchase)).toBe(true);
  expect(typeof res.TotalHourlyPrice).toBe("string");
  expect(typeof res.TotalUpfrontPrice).toBe("string");
});

test("GetInstanceMetadataDefaults returns account-level defaults", async () => {
  const res = await client.send(new GetInstanceMetadataDefaultsCommand({}));
  expect(res.AccountLevel).toBeDefined();
  expect(typeof res.AccountLevel?.HttpTokens).toBe("string");
  expect(typeof res.AccountLevel?.HttpEndpoint).toBe("string");
});

test("GetInstanceTypesFromInstanceRequirements returns plausible instance types", async () => {
  const res = await client.send(
    new GetInstanceTypesFromInstanceRequirementsCommand({
      ArchitectureTypes: ["x86_64"],
      VirtualizationTypes: ["hvm"],
      InstanceRequirements: {
        VCpuCount: { Min: 1 },
        MemoryMiB: { Min: 512 },
      },
    }),
  );
  expect(Array.isArray(res.InstanceTypes)).toBe(true);
  expect(res.InstanceTypes!.length).toBeGreaterThan(0);
  expect(typeof res.InstanceTypes![0]?.InstanceType).toBe("string");
});

test("GetIpamAddressHistory throws for missing scope", async () => {
  await expect(
    client.send(
      new GetIpamAddressHistoryCommand({
        Cidr: "10.0.0.0/16",
        IpamScopeId: "ipam-scope-nonexistent",
      }),
    ),
  ).rejects.toThrow();
});

test("GetFlowLogsIntegrationTemplate throws for missing flow log", async () => {
  await expect(
    client.send(
      new GetFlowLogsIntegrationTemplateCommand({
        FlowLogId: "fl-nonexistent",
        ConfigDeliveryS3DestinationArn:
          "arn:aws:s3:::my-bucket/flow-logs-template",
        IntegrateServices: {
          AthenaIntegrations: [
            {
              IntegrationResultS3DestinationArn:
                "arn:aws:s3:::my-bucket/athena",
              PartitionLoadFrequency: "monthly",
            },
          ],
        },
      }),
    ),
  ).rejects.toThrow();
});

test("GetFlowLogsIntegrationTemplate returns template for existing flow log", async () => {
  const created = await client.send(
    new CreateFlowLogsCommand({
      ResourceIds: ["vpc-12345678"],
      ResourceType: "VPC",
      TrafficType: "ALL",
      LogDestinationType: "s3",
      LogDestination: "arn:aws:s3:::my-flow-logs-bucket",
    }),
  );
  const flowLogId = created.FlowLogIds?.[0];
  expect(flowLogId).toBeDefined();

  const template = await client.send(
    new GetFlowLogsIntegrationTemplateCommand({
      FlowLogId: flowLogId!,
      ConfigDeliveryS3DestinationArn:
        "arn:aws:s3:::my-bucket/flow-logs-template",
      IntegrateServices: {
        AthenaIntegrations: [
          {
            IntegrationResultS3DestinationArn: "arn:aws:s3:::my-bucket/athena",
            PartitionLoadFrequency: "monthly",
          },
        ],
      },
    }),
  );
  expect(typeof template.Result).toBe("string");
  expect(template.Result!.length).toBeGreaterThan(0);
});
