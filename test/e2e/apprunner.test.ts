import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AppRunnerClient,
  AssociateCustomDomainCommand,
  CreateAutoScalingConfigurationCommand,
  CreateConnectionCommand,
  CreateObservabilityConfigurationCommand,
  CreateServiceCommand,
  CreateVpcConnectorCommand,
  CreateVpcIngressConnectionCommand,
  DeleteAutoScalingConfigurationCommand,
  DeleteConnectionCommand,
  DeleteObservabilityConfigurationCommand,
  DeleteServiceCommand,
  DeleteVpcConnectorCommand,
  DeleteVpcIngressConnectionCommand,
  DescribeAutoScalingConfigurationCommand,
  DescribeCustomDomainsCommand,
  DescribeObservabilityConfigurationCommand,
  DescribeServiceCommand,
  DescribeVpcConnectorCommand,
  DescribeVpcIngressConnectionCommand,
  DisassociateCustomDomainCommand,
  ListAutoScalingConfigurationsCommand,
  ListConnectionsCommand,
  ListObservabilityConfigurationsCommand,
  ListOperationsCommand,
  ListServicesCommand,
  ListServicesForAutoScalingConfigurationCommand,
  ListTagsForResourceCommand,
  ListVpcConnectorsCommand,
  ListVpcIngressConnectionsCommand,
  PauseServiceCommand,
  ResumeServiceCommand,
  StartDeploymentCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDefaultAutoScalingConfigurationCommand,
  UpdateServiceCommand,
  UpdateVpcIngressConnectionCommand,
} from "@aws-sdk/client-apprunner";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const apprunner = () =>
  new AppRunnerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AppRunner service lifecycle", async () => {
  const client = apprunner();
  const serviceName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier:
            "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const arn = created.Service?.ServiceArn;
  expect(arn).toBeDefined();
  expect(created.Service?.ServiceName).toBe(serviceName);
  expect(created.Service?.ServiceId).toBeDefined();
  expect(created.Service?.ServiceUrl).toContain("awsapprunner.com");
  expect(created.Service?.Status).toBe("RUNNING");
  expect(created.OperationId).toBeDefined();

  const described = await client.send(
    new DescribeServiceCommand({ ServiceArn: arn }),
  );
  expect(described.Service?.ServiceArn).toBe(arn);
  expect(described.Service?.Status).toBe("RUNNING");

  const listed = await client.send(new ListServicesCommand({}));
  expect((listed.ServiceSummaryList ?? []).map((s) => s.ServiceArn)).toContain(
    arn,
  );

  const paused = await client.send(
    new PauseServiceCommand({ ServiceArn: arn }),
  );
  expect(paused.Service?.Status).toBe("PAUSED");

  const resumed = await client.send(
    new ResumeServiceCommand({ ServiceArn: arn }),
  );
  expect(resumed.Service?.Status).toBe("RUNNING");

  const deleted = await client.send(
    new DeleteServiceCommand({ ServiceArn: arn }),
  );
  expect(deleted.Service?.ServiceArn).toBe(arn);
  await expect(
    client.send(new DescribeServiceCommand({ ServiceArn: arn })),
  ).rejects.toThrow();
});

test("AppRunner UpdateService and StartDeployment", async () => {
  const client = apprunner();
  const serviceName = `bunsai-update-${Date.now()}`;

  const created = await client.send(
    new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier:
            "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const arn = created.Service?.ServiceArn;
  expect(arn).toBeDefined();

  const updated = await client.send(
    new UpdateServiceCommand({
      ServiceArn: arn,
      InstanceConfiguration: { Cpu: "2048", Memory: "4096" },
    }),
  );
  expect(updated.Service?.ServiceArn).toBe(arn);
  expect(updated.OperationId).toBeDefined();

  const deployed = await client.send(
    new StartDeploymentCommand({ ServiceArn: arn }),
  );
  expect(deployed.OperationId).toBeDefined();

  const ops = await client.send(new ListOperationsCommand({ ServiceArn: arn }));
  expect((ops.OperationSummaryList ?? []).length).toBeGreaterThan(0);

  await client.send(new DeleteServiceCommand({ ServiceArn: arn }));
});

test("AppRunner AutoScaling configurations", async () => {
  const client = apprunner();
  const name = `bunsai-asc-${Date.now()}`;

  const created = await client.send(
    new CreateAutoScalingConfigurationCommand({
      AutoScalingConfigurationName: name,
      MaxConcurrency: 50,
      MinSize: 2,
      MaxSize: 10,
    }),
  );
  const arn = created.AutoScalingConfiguration?.AutoScalingConfigurationArn;
  expect(arn).toBeDefined();
  expect(created.AutoScalingConfiguration?.AutoScalingConfigurationName).toBe(
    name,
  );
  expect(created.AutoScalingConfiguration?.Status).toBe("ACTIVE");

  const described = await client.send(
    new DescribeAutoScalingConfigurationCommand({
      AutoScalingConfigurationArn: arn,
    }),
  );
  expect(described.AutoScalingConfiguration?.MaxConcurrency).toBe(50);

  const listed = await client.send(
    new ListAutoScalingConfigurationsCommand({
      AutoScalingConfigurationName: name,
    }),
  );
  expect(
    (listed.AutoScalingConfigurationSummaryList ?? []).some(
      (c) => c.AutoScalingConfigurationArn === arn,
    ),
  ).toBe(true);

  const setDefault = await client.send(
    new UpdateDefaultAutoScalingConfigurationCommand({
      AutoScalingConfigurationArn: arn,
    }),
  );
  expect(setDefault.AutoScalingConfiguration?.IsDefault).toBe(true);

  const svcForAsc = await client.send(
    new ListServicesForAutoScalingConfigurationCommand({
      AutoScalingConfigurationArn: arn,
    }),
  );
  expect(svcForAsc.ServiceArnList).toBeDefined();

  const deleted = await client.send(
    new DeleteAutoScalingConfigurationCommand({
      AutoScalingConfigurationArn: arn,
    }),
  );
  expect(deleted.AutoScalingConfiguration?.Status).toBe("INACTIVE");
});

test("AppRunner Connection lifecycle", async () => {
  const client = apprunner();
  const name = `bunsai-conn-${Date.now()}`;

  const created = await client.send(
    new CreateConnectionCommand({
      ConnectionName: name,
      ProviderType: "GITHUB",
    }),
  );
  const arn = created.Connection?.ConnectionArn;
  expect(arn).toBeDefined();
  expect(created.Connection?.ConnectionName).toBe(name);
  expect(created.Connection?.Status).toBe("AVAILABLE");

  const listed = await client.send(
    new ListConnectionsCommand({ ConnectionName: name }),
  );
  expect(
    (listed.ConnectionSummaryList ?? []).some((c) => c.ConnectionArn === arn),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteConnectionCommand({ ConnectionArn: arn }),
  );
  expect(deleted.Connection?.Status).toBe("DELETED");
});

test("AppRunner ObservabilityConfiguration lifecycle", async () => {
  const client = apprunner();
  const name = `bunsai-obs-${Date.now()}`;

  const created = await client.send(
    new CreateObservabilityConfigurationCommand({
      ObservabilityConfigurationName: name,
    }),
  );
  const arn = created.ObservabilityConfiguration?.ObservabilityConfigurationArn;
  expect(arn).toBeDefined();
  expect(
    created.ObservabilityConfiguration?.ObservabilityConfigurationName,
  ).toBe(name);
  expect(created.ObservabilityConfiguration?.Status).toBe("ACTIVE");

  const described = await client.send(
    new DescribeObservabilityConfigurationCommand({
      ObservabilityConfigurationArn: arn,
    }),
  );
  expect(
    described.ObservabilityConfiguration?.ObservabilityConfigurationName,
  ).toBe(name);

  const listed = await client.send(
    new ListObservabilityConfigurationsCommand({
      ObservabilityConfigurationName: name,
    }),
  );
  expect(
    (listed.ObservabilityConfigurationSummaryList ?? []).some(
      (c) => c.ObservabilityConfigurationArn === arn,
    ),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteObservabilityConfigurationCommand({
      ObservabilityConfigurationArn: arn,
    }),
  );
  expect(deleted.ObservabilityConfiguration?.Status).toBe("INACTIVE");
});

test("AppRunner VpcConnector lifecycle", async () => {
  const client = apprunner();
  const name = `bunsai-vpc-${Date.now()}`;

  const created = await client.send(
    new CreateVpcConnectorCommand({
      VpcConnectorName: name,
      Subnets: ["subnet-12345"],
      SecurityGroups: ["sg-12345"],
    }),
  );
  const arn = created.VpcConnector?.VpcConnectorArn;
  expect(arn).toBeDefined();
  expect(created.VpcConnector?.VpcConnectorName).toBe(name);
  expect(created.VpcConnector?.Status).toBe("ACTIVE");

  const described = await client.send(
    new DescribeVpcConnectorCommand({ VpcConnectorArn: arn }),
  );
  expect(described.VpcConnector?.VpcConnectorName).toBe(name);

  const listed = await client.send(new ListVpcConnectorsCommand({}));
  expect(
    (listed.VpcConnectors ?? []).some((v) => v.VpcConnectorArn === arn),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteVpcConnectorCommand({ VpcConnectorArn: arn }),
  );
  expect(deleted.VpcConnector?.Status).toBe("INACTIVE");
});

test("AppRunner VpcIngressConnection lifecycle", async () => {
  const client = apprunner();
  const serviceName = `bunsai-vic-svc-${Date.now()}`;

  const svc = await client.send(
    new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier:
            "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const serviceArn = svc.Service?.ServiceArn;
  expect(serviceArn).toBeDefined();

  const vicName = `bunsai-vic-${Date.now()}`;
  const created = await client.send(
    new CreateVpcIngressConnectionCommand({
      ServiceArn: serviceArn,
      VpcIngressConnectionName: vicName,
      IngressVpcConfiguration: {
        VpcId: "vpc-12345",
        VpcEndpointId: "vpce-12345",
      },
    }),
  );
  const vicArn = created.VpcIngressConnection?.VpcIngressConnectionArn;
  expect(vicArn).toBeDefined();
  expect(created.VpcIngressConnection?.VpcIngressConnectionName).toBe(vicName);
  expect(created.VpcIngressConnection?.Status).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeVpcIngressConnectionCommand({
      VpcIngressConnectionArn: vicArn,
    }),
  );
  expect(described.VpcIngressConnection?.ServiceArn).toBe(serviceArn);

  const updated = await client.send(
    new UpdateVpcIngressConnectionCommand({
      VpcIngressConnectionArn: vicArn,
      IngressVpcConfiguration: {
        VpcId: "vpc-99999",
        VpcEndpointId: "vpce-99999",
      },
    }),
  );
  expect(updated.VpcIngressConnection?.IngressVpcConfiguration?.VpcId).toBe(
    "vpc-99999",
  );

  const listed = await client.send(new ListVpcIngressConnectionsCommand({}));
  expect(
    (listed.VpcIngressConnectionSummaryList ?? []).some(
      (v) => v.VpcIngressConnectionArn === vicArn,
    ),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteVpcIngressConnectionCommand({ VpcIngressConnectionArn: vicArn }),
  );
  expect(deleted.VpcIngressConnection?.Status).toBe("DELETED");

  await client.send(new DeleteServiceCommand({ ServiceArn: serviceArn }));
});

test("AppRunner custom domain lifecycle", async () => {
  const client = apprunner();
  const serviceName = `bunsai-domain-svc-${Date.now()}`;

  const svc = await client.send(
    new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier:
            "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const serviceArn = svc.Service?.ServiceArn;
  expect(serviceArn).toBeDefined();

  const domain = `test-${Date.now()}.example.com`;
  const associated = await client.send(
    new AssociateCustomDomainCommand({
      ServiceArn: serviceArn,
      DomainName: domain,
    }),
  );
  expect(associated.ServiceArn).toBe(serviceArn);
  expect(associated.CustomDomain?.DomainName).toBe(domain);

  const described = await client.send(
    new DescribeCustomDomainsCommand({ ServiceArn: serviceArn }),
  );
  expect(
    (described.CustomDomains ?? []).some((d) => d.DomainName === domain),
  ).toBe(true);

  const disassociated = await client.send(
    new DisassociateCustomDomainCommand({
      ServiceArn: serviceArn,
      DomainName: domain,
    }),
  );
  expect(disassociated.CustomDomain?.Status).toBe("DELETING");

  await client.send(new DeleteServiceCommand({ ServiceArn: serviceArn }));
});

test("AppRunner tags", async () => {
  const client = apprunner();
  const name = `bunsai-tag-asc-${Date.now()}`;

  const created = await client.send(
    new CreateAutoScalingConfigurationCommand({
      AutoScalingConfigurationName: name,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const arn = created.AutoScalingConfiguration?.AutoScalingConfigurationArn;
  expect(arn).toBeDefined();

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(
    (listed.Tags ?? []).some((t) => t.Key === "env" && t.Value === "test"),
  ).toBe(true);

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [{ Key: "owner", Value: "bunsai" }],
    }),
  );

  const listed2 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(
    (listed2.Tags ?? []).some((t) => t.Key === "owner" && t.Value === "bunsai"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );

  const listed3 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect((listed3.Tags ?? []).some((t) => t.Key === "env")).toBe(false);
  expect((listed3.Tags ?? []).some((t) => t.Key === "owner")).toBe(true);

  await client.send(
    new DeleteAutoScalingConfigurationCommand({
      AutoScalingConfigurationArn: arn,
    }),
  );
});
