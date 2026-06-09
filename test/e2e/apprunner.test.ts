import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apprunner = () =>
  new AppRunnerClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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
  expect(created.Service?.Status).toBe("OPERATION_IN_PROGRESS");
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
  expect(created.VpcIngressConnection?.Status).toBe("PENDING_CREATION");

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
  expect(deleted.VpcIngressConnection?.Status).toBe("PENDING_DELETION");

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

test("AppRunner CreateService records CREATE_SERVICE operation", async () => {
  const client = apprunner();
  const serviceName = `bunsai-ops-${Date.now()}`;

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
  expect(created.Service?.Status).toBe("OPERATION_IN_PROGRESS");

  const ops = await client.send(new ListOperationsCommand({ ServiceArn: arn }));
  const createOp = (ops.OperationSummaryList ?? []).find(
    (op) => op.Type === "CREATE_SERVICE",
  );
  expect(createOp).toBeDefined();
  expect(createOp?.Status).toBe("IN_PROGRESS");
  expect(createOp?.Id).toBe(created.OperationId);

  const described = await client.send(
    new DescribeServiceCommand({ ServiceArn: arn }),
  );
  expect(described.Service?.Status).toBe("RUNNING");

  await client.send(new DeleteServiceCommand({ ServiceArn: arn }));
});

test("AppRunner ListServices pagination", async () => {
  const client = apprunner();
  const names = [
    `bunsai-pg-a-${Date.now()}`,
    `bunsai-pg-b-${Date.now()}`,
    `bunsai-pg-c-${Date.now()}`,
  ];
  const arns: string[] = [];

  for (const name of names) {
    const r = await client.send(
      new CreateServiceCommand({
        ServiceName: name,
        SourceConfiguration: {
          ImageRepository: {
            ImageIdentifier:
              "public.ecr.aws/aws-containers/hello-app-runner:latest",
            ImageRepositoryType: "ECR_PUBLIC",
          },
        },
      }),
    );
    arns.push(r.Service?.ServiceArn ?? "");
  }

  const page1 = await client.send(new ListServicesCommand({ MaxResults: 2 }));
  expect((page1.ServiceSummaryList ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListServicesCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect((page2.ServiceSummaryList ?? []).length).toBeGreaterThanOrEqual(1);

  for (const arn of arns) {
    await client.send(new DeleteServiceCommand({ ServiceArn: arn }));
  }
});

test("AppRunner custom domain lifecycle with status", async () => {
  const client = apprunner();
  const serviceName = `bunsai-domain2-${Date.now()}`;

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

  const domain = `lifecycle-${Date.now()}.example.com`;
  const associated = await client.send(
    new AssociateCustomDomainCommand({
      ServiceArn: serviceArn,
      DomainName: domain,
    }),
  );
  expect(associated.CustomDomain?.Status).toBe("CREATING");

  const described = await client.send(
    new DescribeCustomDomainsCommand({ ServiceArn: serviceArn }),
  );
  const stored = (described.CustomDomains ?? []).find(
    (d) => d.DomainName === domain,
  );
  expect(stored).toBeDefined();
  expect(stored?.Status).toBe("ACTIVE");

  await client.send(
    new DisassociateCustomDomainCommand({
      ServiceArn: serviceArn,
      DomainName: domain,
    }),
  );
  await client.send(new DeleteServiceCommand({ ServiceArn: serviceArn }));
});

test("AppRunner CreateService tag round-trip and no stale tags on recreate", async () => {
  const client = apprunner();
  const serviceName = `bunsai-tag-svc-${Date.now()}`;

  const created = await client.send(
    new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier: "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
      Tags: [{ Key: "env", Value: "staging" }],
    }),
  );
  const arn = created.Service?.ServiceArn;
  expect(arn).toBeDefined();

  const tags = await client.send(new ListTagsForResourceCommand({ ResourceArn: arn }));
  expect((tags.Tags ?? []).some((t) => t.Key === "env" && t.Value === "staging")).toBe(true);

  await client.send(new DeleteServiceCommand({ ServiceArn: arn }));

  const created2 = await client.send(
    new CreateServiceCommand({
      ServiceName: `${serviceName}-v2`,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier: "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const arn2 = created2.Service?.ServiceArn;
  expect(arn2).toBeDefined();

  const tags2 = await client.send(new ListTagsForResourceCommand({ ResourceArn: arn2 }));
  expect(tags2.Tags ?? []).toHaveLength(0);

  await client.send(new DeleteServiceCommand({ ServiceArn: arn2 }));
});

test("AppRunner AutoScaling in-use lifecycle", async () => {
  const client = apprunner();
  const ascName = `bunsai-asc-inuse-${Date.now()}`;

  const asc = await client.send(
    new CreateAutoScalingConfigurationCommand({
      AutoScalingConfigurationName: ascName,
    }),
  );
  const ascArn = asc.AutoScalingConfiguration?.AutoScalingConfigurationArn;
  expect(ascArn).toBeDefined();

  const svc = await client.send(
    new CreateServiceCommand({
      ServiceName: `bunsai-asc-svc-${Date.now()}`,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier: "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
      AutoScalingConfigurationArn: ascArn,
    }),
  );
  const serviceArn = svc.Service?.ServiceArn;
  expect(serviceArn).toBeDefined();

  const described = await client.send(
    new DescribeAutoScalingConfigurationCommand({ AutoScalingConfigurationArn: ascArn }),
  );
  expect(described.AutoScalingConfiguration?.HasAssociatedService).toBe(true);

  await expect(
    client.send(new DeleteAutoScalingConfigurationCommand({ AutoScalingConfigurationArn: ascArn })),
  ).rejects.toThrow();

  await client.send(new DeleteServiceCommand({ ServiceArn: serviceArn }));

  const described2 = await client.send(
    new DescribeAutoScalingConfigurationCommand({ AutoScalingConfigurationArn: ascArn }),
  );
  expect(described2.AutoScalingConfiguration?.HasAssociatedService).toBe(false);

  const deletedAsc = await client.send(
    new DeleteAutoScalingConfigurationCommand({ AutoScalingConfigurationArn: ascArn }),
  );
  expect(deletedAsc.AutoScalingConfiguration?.Status).toBe("INACTIVE");
});

test("AppRunner service state transition guards", async () => {
  const client = apprunner();

  const created = await client.send(
    new CreateServiceCommand({
      ServiceName: `bunsai-state-${Date.now()}`,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier: "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const arn = created.Service?.ServiceArn;
  expect(arn).toBeDefined();

  const paused = await client.send(new PauseServiceCommand({ ServiceArn: arn }));
  expect(paused.Service?.Status).toBe("PAUSED");

  await expect(
    client.send(new PauseServiceCommand({ ServiceArn: arn })),
  ).rejects.toThrow();

  const resumed = await client.send(new ResumeServiceCommand({ ServiceArn: arn }));
  expect(resumed.Service?.Status).toBe("RUNNING");

  await expect(
    client.send(new ResumeServiceCommand({ ServiceArn: arn })),
  ).rejects.toThrow();

  await client.send(new DeleteServiceCommand({ ServiceArn: arn }));
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
