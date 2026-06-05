import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AddEndpointsCommand,
  AdvertiseByoipCidrCommand,
  CreateAcceleratorCommand,
  DescribeAcceleratorCommand,
  UpdateAcceleratorCommand,
  CreateCrossAccountAttachmentCommand,
  CreateCustomRoutingAcceleratorCommand,
  CreateCustomRoutingEndpointGroupCommand,
  CreateCustomRoutingListenerCommand,
  CreateEndpointGroupCommand,
  CreateListenerCommand,
  DeleteAcceleratorCommand,
  DeleteCrossAccountAttachmentCommand,
  DeleteCustomRoutingAcceleratorCommand,
  DeleteCustomRoutingEndpointGroupCommand,
  DeleteCustomRoutingListenerCommand,
  DeleteEndpointGroupCommand,
  DeleteListenerCommand,
  DeprovisionByoipCidrCommand,
  DescribeAcceleratorAttributesCommand,
  DescribeCrossAccountAttachmentCommand,
  DescribeCustomRoutingAcceleratorCommand,
  DescribeCustomRoutingEndpointGroupCommand,
  DescribeCustomRoutingListenerCommand,
  DescribeEndpointGroupCommand,
  DescribeListenerCommand,
  GlobalAcceleratorClient,
  ListAcceleratorsCommand,
  ListByoipCidrsCommand,
  ListCrossAccountAttachmentsCommand,
  ListCustomRoutingEndpointGroupsCommand,
  ListCustomRoutingListenersCommand,
  ListEndpointGroupsCommand,
  ListListenersCommand,
  ListTagsForResourceCommand,
  ProvisionByoipCidrCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAcceleratorAttributesCommand,
  UpdateListenerCommand,
  WithdrawByoipCidrCommand,
} from "@aws-sdk/client-global-accelerator";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const globalaccelerator = () =>
  new GlobalAcceleratorClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("GlobalAccelerator accelerator lifecycle", async () => {
  const client = globalaccelerator();
  const name = "bunsai-e2e-accelerator";

  const created = await client.send(
    new CreateAcceleratorCommand({
      Name: name,
      IdempotencyToken: crypto.randomUUID(),
      Enabled: true,
    }),
  );
  expect(created.Accelerator?.Name).toBe(name);
  expect(created.Accelerator?.Status).toBe("DEPLOYED");
  expect(created.Accelerator?.DnsName).toBeDefined();
  const arn = created.Accelerator?.AcceleratorArn ?? "";
  expect(arn).toContain("accelerator/");

  const described = await client.send(
    new DescribeAcceleratorCommand({ AcceleratorArn: arn }),
  );
  expect(described.Accelerator?.Name).toBe(name);

  const listed = await client.send(new ListAcceleratorsCommand({}));
  expect(
    (listed.Accelerators ?? []).some((a) => a.AcceleratorArn === arn),
  ).toBe(true);

  const updated = await client.send(
    new UpdateAcceleratorCommand({
      AcceleratorArn: arn,
      Name: "bunsai-e2e-accelerator-2",
    }),
  );
  expect(updated.Accelerator?.Name).toBe("bunsai-e2e-accelerator-2");

  await client.send(new DeleteAcceleratorCommand({ AcceleratorArn: arn }));
});

test("GlobalAccelerator listener + endpoint-group lifecycle", async () => {
  const client = globalaccelerator();

  const acc = await client.send(
    new CreateAcceleratorCommand({
      Name: "e2e-acc-for-listener",
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const accArn = acc.Accelerator?.AcceleratorArn ?? "";

  const attrs = await client.send(
    new DescribeAcceleratorAttributesCommand({ AcceleratorArn: accArn }),
  );
  expect(attrs.AcceleratorAttributes?.FlowLogsEnabled).toBe(false);

  await client.send(
    new UpdateAcceleratorAttributesCommand({
      AcceleratorArn: accArn,
      FlowLogsEnabled: false,
    }),
  );

  const lstCreated = await client.send(
    new CreateListenerCommand({
      AcceleratorArn: accArn,
      PortRanges: [{ FromPort: 80, ToPort: 80 }],
      Protocol: "TCP",
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const lstArn = lstCreated.Listener?.ListenerArn ?? "";
  expect(lstArn).toContain("listener/");

  const lstDescribed = await client.send(
    new DescribeListenerCommand({ ListenerArn: lstArn }),
  );
  expect(lstDescribed.Listener?.Protocol).toBe("TCP");

  const lstListed = await client.send(
    new ListListenersCommand({ AcceleratorArn: accArn }),
  );
  expect(
    (lstListed.Listeners ?? []).some((l) => l.ListenerArn === lstArn),
  ).toBe(true);

  await client.send(
    new UpdateListenerCommand({
      ListenerArn: lstArn,
      PortRanges: [{ FromPort: 443, ToPort: 443 }],
    }),
  );

  const egCreated = await client.send(
    new CreateEndpointGroupCommand({
      ListenerArn: lstArn,
      EndpointGroupRegion: "us-east-1",
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const egArn = egCreated.EndpointGroup?.EndpointGroupArn ?? "";
  expect(egArn).toContain("endpoint-group/");

  const egDescribed = await client.send(
    new DescribeEndpointGroupCommand({ EndpointGroupArn: egArn }),
  );
  expect(egDescribed.EndpointGroup?.EndpointGroupRegion).toBe("us-east-1");

  const egListed = await client.send(
    new ListEndpointGroupsCommand({ ListenerArn: lstArn }),
  );
  expect(
    (egListed.EndpointGroups ?? []).some((g) => g.EndpointGroupArn === egArn),
  ).toBe(true);

  await client.send(
    new AddEndpointsCommand({
      EndpointGroupArn: egArn,
      EndpointConfigurations: [
        {
          EndpointId:
            "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/abc123",
        },
      ],
    }),
  );

  await client.send(
    new DeleteEndpointGroupCommand({ EndpointGroupArn: egArn }),
  );
  await client.send(new DeleteListenerCommand({ ListenerArn: lstArn }));
  await client.send(new DeleteAcceleratorCommand({ AcceleratorArn: accArn }));
});

test("GlobalAccelerator custom routing accelerator + listener + endpoint-group lifecycle", async () => {
  const client = globalaccelerator();

  const crAcc = await client.send(
    new CreateCustomRoutingAcceleratorCommand({
      Name: "e2e-custom-routing",
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const crAccArn = crAcc.Accelerator?.AcceleratorArn ?? "";
  expect(crAccArn).toContain("accelerator/");

  const crAccDescribed = await client.send(
    new DescribeCustomRoutingAcceleratorCommand({ AcceleratorArn: crAccArn }),
  );
  expect(crAccDescribed.Accelerator?.Name).toBe("e2e-custom-routing");

  const crLst = await client.send(
    new CreateCustomRoutingListenerCommand({
      AcceleratorArn: crAccArn,
      PortRanges: [{ FromPort: 5000, ToPort: 5100 }],
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const crLstArn = crLst.Listener?.ListenerArn ?? "";
  expect(crLstArn).toContain("listener/");

  const crLstDescribed = await client.send(
    new DescribeCustomRoutingListenerCommand({ ListenerArn: crLstArn }),
  );
  expect(crLstDescribed.Listener?.PortRanges?.[0]?.FromPort).toBe(5000);

  const crLstListed = await client.send(
    new ListCustomRoutingListenersCommand({ AcceleratorArn: crAccArn }),
  );
  expect(
    (crLstListed.Listeners ?? []).some((l) => l.ListenerArn === crLstArn),
  ).toBe(true);

  const crEg = await client.send(
    new CreateCustomRoutingEndpointGroupCommand({
      ListenerArn: crLstArn,
      EndpointGroupRegion: "us-east-1",
      DestinationConfigurations: [
        { FromPort: 5000, ToPort: 5100, Protocols: ["TCP"] },
      ],
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const crEgArn = crEg.EndpointGroup?.EndpointGroupArn ?? "";
  expect(crEgArn).toContain("endpoint-group/");

  const crEgDescribed = await client.send(
    new DescribeCustomRoutingEndpointGroupCommand({
      EndpointGroupArn: crEgArn,
    }),
  );
  expect(crEgDescribed.EndpointGroup?.EndpointGroupRegion).toBe("us-east-1");

  const crEgListed = await client.send(
    new ListCustomRoutingEndpointGroupsCommand({ ListenerArn: crLstArn }),
  );
  expect(
    (crEgListed.EndpointGroups ?? []).some(
      (g) => g.EndpointGroupArn === crEgArn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteCustomRoutingEndpointGroupCommand({ EndpointGroupArn: crEgArn }),
  );
  await client.send(
    new DeleteCustomRoutingListenerCommand({ ListenerArn: crLstArn }),
  );
  await client.send(
    new DeleteCustomRoutingAcceleratorCommand({ AcceleratorArn: crAccArn }),
  );
});

test("GlobalAccelerator cross-account attachment lifecycle", async () => {
  const client = globalaccelerator();

  const att = await client.send(
    new CreateCrossAccountAttachmentCommand({
      Name: "e2e-attachment",
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const attArn = att.CrossAccountAttachment?.AttachmentArn ?? "";
  expect(attArn).toContain("attachment/");
  expect(att.CrossAccountAttachment?.Name).toBe("e2e-attachment");

  const attDescribed = await client.send(
    new DescribeCrossAccountAttachmentCommand({ AttachmentArn: attArn }),
  );
  expect(attDescribed.CrossAccountAttachment?.Name).toBe("e2e-attachment");

  const attListed = await client.send(
    new ListCrossAccountAttachmentsCommand({}),
  );
  expect(
    (attListed.CrossAccountAttachments ?? []).some(
      (a) => a.AttachmentArn === attArn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteCrossAccountAttachmentCommand({ AttachmentArn: attArn }),
  );
});

test("GlobalAccelerator BYOIP CIDR lifecycle", async () => {
  const client = globalaccelerator();
  const cidr = "192.0.2.0/24";

  const provisioned = await client.send(
    new ProvisionByoipCidrCommand({
      Cidr: cidr,
      CidrAuthorizationContext: {
        Message: "test-message",
        Signature: "test-signature",
      },
    }),
  );
  expect(provisioned.ByoipCidr?.Cidr).toBe(cidr);

  const advertised = await client.send(
    new AdvertiseByoipCidrCommand({ Cidr: cidr }),
  );
  expect(advertised.ByoipCidr?.State).toBe("ADVERTISING");

  const withdrawn = await client.send(
    new WithdrawByoipCidrCommand({ Cidr: cidr }),
  );
  expect(withdrawn.ByoipCidr?.State).toBe("PROVISIONED");

  const listed = await client.send(new ListByoipCidrsCommand({}));
  expect((listed.ByoipCidrs ?? []).some((c) => c.Cidr === cidr)).toBe(true);

  await client.send(new DeprovisionByoipCidrCommand({ Cidr: cidr }));
});

test("GlobalAccelerator tags lifecycle", async () => {
  const client = globalaccelerator();

  const acc = await client.send(
    new CreateAcceleratorCommand({
      Name: "e2e-tag-accelerator",
      IdempotencyToken: crypto.randomUUID(),
    }),
  );
  const arn = acc.Accelerator?.AcceleratorArn ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [
        { Key: "Env", Value: "test" },
        { Key: "Owner", Value: "e2e" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.Tags?.some((t) => t.Key === "Env" && t.Value === "test")).toBe(
    true,
  );
  expect(listed.Tags?.some((t) => t.Key === "Owner")).toBe(true);

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["Owner"] }),
  );
  const listed2 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed2.Tags?.some((t) => t.Key === "Owner")).toBe(false);
  expect(listed2.Tags?.some((t) => t.Key === "Env")).toBe(true);

  await client.send(new DeleteAcceleratorCommand({ AcceleratorArn: arn }));
});
