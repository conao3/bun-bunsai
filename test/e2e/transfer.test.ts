import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAccessCommand,
  CreateAgreementCommand,
  CreateConnectorCommand,
  CreateProfileCommand,
  CreateServerCommand,
  CreateUserCommand,
  CreateWebAppCommand,
  CreateWorkflowCommand,
  DeleteAccessCommand,
  DeleteAgreementCommand,
  DeleteCertificateCommand,
  DeleteConnectorCommand,
  DeleteHostKeyCommand,
  DeleteProfileCommand,
  DeleteServerCommand,
  DeleteWebAppCommand,
  DeleteWorkflowCommand,
  DescribeAccessCommand,
  DescribeAgreementCommand,
  DescribeCertificateCommand,
  DescribeConnectorCommand,
  DescribeHostKeyCommand,
  DescribeProfileCommand,
  DescribeSecurityPolicyCommand,
  DescribeServerCommand,
  DescribeUserCommand,
  DescribeWebAppCommand,
  DescribeWebAppCustomizationCommand,
  DescribeWorkflowCommand,
  ImportCertificateCommand,
  ImportHostKeyCommand,
  ListAccessesCommand,
  ListAgreementsCommand,
  ListCertificatesCommand,
  ListConnectorsCommand,
  ListHostKeysCommand,
  ListProfilesCommand,
  ListSecurityPoliciesCommand,
  ListServersCommand,
  ListTagsForResourceCommand,
  ListUsersCommand,
  ListWebAppsCommand,
  ListWorkflowsCommand,
  StartServerCommand,
  StopServerCommand,
  TagResourceCommand,
  TestConnectionCommand,
  TransferClient,
  UntagResourceCommand,
  UpdateWebAppCustomizationCommand,
} from "@aws-sdk/client-transfer";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new TransferClient({ endpoint, region, credentials, requestHandler });

test("transfer server and user round-trip", async () => {
  const transfer = client();

  const created = await transfer.send(new CreateServerCommand({}));
  const serverId = created.ServerId;
  expect(serverId).toMatch(/^s-[0-9a-f]{17}$/);

  const described = await transfer.send(
    new DescribeServerCommand({ ServerId: serverId }),
  );
  expect(described.Server?.ServerId).toBe(serverId);
  expect(described.Server?.State).toBe("ONLINE");
  expect(described.Server?.Arn).toContain(`:server/${serverId}`);

  const listedServers = await transfer.send(new ListServersCommand({}));
  const serverIds = (listedServers.Servers ?? []).map(
    (entry) => entry.ServerId,
  );
  expect(serverIds).toContain(serverId);

  const userName = "bunsai-e2e-user";
  const createdUser = await transfer.send(
    new CreateUserCommand({
      ServerId: serverId,
      UserName: userName,
      Role: "arn:aws:iam::000000000000:role/transfer-role",
      HomeDirectory: "/bucket/home",
    }),
  );
  expect(createdUser.ServerId).toBe(serverId);
  expect(createdUser.UserName).toBe(userName);

  const describedUser = await transfer.send(
    new DescribeUserCommand({ ServerId: serverId, UserName: userName }),
  );
  expect(describedUser.ServerId).toBe(serverId);
  expect(describedUser.User?.UserName).toBe(userName);
  expect(describedUser.User?.HomeDirectory).toBe("/bucket/home");

  const listedUsers = await transfer.send(
    new ListUsersCommand({ ServerId: serverId }),
  );
  const userNames = (listedUsers.Users ?? []).map((entry) => entry.UserName);
  expect(userNames).toContain(userName);

  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));

  await expect(
    transfer.send(new DescribeServerCommand({ ServerId: serverId })),
  ).rejects.toThrow();
});

test("server start/stop lifecycle", async () => {
  const transfer = client();
  const { ServerId: serverId } = await transfer.send(
    new CreateServerCommand({}),
  );

  await transfer.send(new StopServerCommand({ ServerId: serverId }));
  const stopped = await transfer.send(
    new DescribeServerCommand({ ServerId: serverId }),
  );
  expect(stopped.Server?.State).toBe("OFFLINE");

  await transfer.send(new StartServerCommand({ ServerId: serverId }));
  const started = await transfer.send(
    new DescribeServerCommand({ ServerId: serverId }),
  );
  expect(started.Server?.State).toBe("ONLINE");

  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));
});

test("access lifecycle", async () => {
  const transfer = client();
  const { ServerId: serverId } = await transfer.send(
    new CreateServerCommand({}),
  );

  const { ServerId: aServerId, ExternalId } = await transfer.send(
    new CreateAccessCommand({
      ServerId: serverId,
      ExternalId: "S-1-5-21-example",
      Role: "arn:aws:iam::000000000000:role/transfer-role",
      HomeDirectory: "/bucket/access",
    }),
  );
  expect(aServerId).toBe(serverId);
  expect(ExternalId).toBe("S-1-5-21-example");

  const described = await transfer.send(
    new DescribeAccessCommand({ ServerId: serverId, ExternalId: ExternalId! }),
  );
  expect(described.Access?.ExternalId).toBe(ExternalId);
  expect(described.Access?.HomeDirectory).toBe("/bucket/access");

  const listed = await transfer.send(
    new ListAccessesCommand({ ServerId: serverId }),
  );
  expect((listed.Accesses ?? []).some((a) => a.ExternalId === ExternalId)).toBe(
    true,
  );

  await transfer.send(
    new DeleteAccessCommand({ ServerId: serverId, ExternalId: ExternalId! }),
  );
  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));
});

test("connector and test-connection lifecycle", async () => {
  const transfer = client();

  const { ConnectorId } = await transfer.send(
    new CreateConnectorCommand({
      Url: "https://example.com/as2",
      AccessRole: "arn:aws:iam::000000000000:role/connector-role",
    }),
  );
  expect(ConnectorId).toBeDefined();

  const described = await transfer.send(
    new DescribeConnectorCommand({ ConnectorId: ConnectorId! }),
  );
  expect(described.Connector?.ConnectorId).toBe(ConnectorId);
  expect(described.Connector?.Status).toBe("ONLINE");

  const listed = await transfer.send(new ListConnectorsCommand({}));
  expect(
    (listed.Connectors ?? []).some((c) => c.ConnectorId === ConnectorId),
  ).toBe(true);

  const tested = await transfer.send(
    new TestConnectionCommand({ ConnectorId: ConnectorId! }),
  );
  expect(tested.Status).toBe("OK");

  await transfer.send(
    new DeleteConnectorCommand({ ConnectorId: ConnectorId! }),
  );
});

test("profile lifecycle", async () => {
  const transfer = client();

  const { ProfileId } = await transfer.send(
    new CreateProfileCommand({ As2Id: "PARTNER_AS2", ProfileType: "PARTNER" }),
  );
  expect(ProfileId).toBeDefined();

  const described = await transfer.send(
    new DescribeProfileCommand({ ProfileId: ProfileId! }),
  );
  expect(described.Profile?.ProfileId).toBe(ProfileId);
  expect(described.Profile?.As2Id).toBe("PARTNER_AS2");

  const listed = await transfer.send(new ListProfilesCommand({}));
  expect((listed.Profiles ?? []).some((p) => p.ProfileId === ProfileId)).toBe(
    true,
  );

  await transfer.send(new DeleteProfileCommand({ ProfileId: ProfileId! }));
});

test("agreement lifecycle", async () => {
  const transfer = client();
  const { ServerId: serverId } = await transfer.send(
    new CreateServerCommand({}),
  );
  const { ProfileId: localProfileId } = await transfer.send(
    new CreateProfileCommand({ As2Id: "LOCAL_AS2", ProfileType: "LOCAL" }),
  );
  const { ProfileId: partnerProfileId } = await transfer.send(
    new CreateProfileCommand({ As2Id: "PARTNER_AS2", ProfileType: "PARTNER" }),
  );

  const { AgreementId } = await transfer.send(
    new CreateAgreementCommand({
      ServerId: serverId,
      LocalProfileId: localProfileId!,
      PartnerProfileId: partnerProfileId!,
      AccessRole: "arn:aws:iam::000000000000:role/agreement-role",
      BaseDirectory: "/bucket/agreements",
    }),
  );
  expect(AgreementId).toBeDefined();

  const described = await transfer.send(
    new DescribeAgreementCommand({
      ServerId: serverId,
      AgreementId: AgreementId!,
    }),
  );
  expect(described.Agreement?.AgreementId).toBe(AgreementId);
  expect(described.Agreement?.Status).toBe("ACTIVE");

  const listed = await transfer.send(
    new ListAgreementsCommand({ ServerId: serverId }),
  );
  expect(
    (listed.Agreements ?? []).some((a) => a.AgreementId === AgreementId),
  ).toBe(true);

  await transfer.send(
    new DeleteAgreementCommand({
      ServerId: serverId,
      AgreementId: AgreementId!,
    }),
  );
  await transfer.send(new DeleteProfileCommand({ ProfileId: localProfileId! }));
  await transfer.send(
    new DeleteProfileCommand({ ProfileId: partnerProfileId! }),
  );
  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));
});

test("web-app and customization lifecycle", async () => {
  const transfer = client();

  const { WebAppId } = await transfer.send(
    new CreateWebAppCommand({
      IdentityProviderDetails: { IdentityProviderType: "AWS_IAM_IDP" },
    }),
  );
  expect(WebAppId).toBeDefined();

  const described = await transfer.send(
    new DescribeWebAppCommand({ WebAppId: WebAppId! }),
  );
  expect(described.WebApp?.WebAppId).toBe(WebAppId);

  const listed = await transfer.send(new ListWebAppsCommand({}));
  expect((listed.WebApps ?? []).some((w) => w.WebAppId === WebAppId)).toBe(
    true,
  );

  await transfer.send(
    new UpdateWebAppCustomizationCommand({
      WebAppId: WebAppId!,
      Title: "My App",
    }),
  );
  const customization = await transfer.send(
    new DescribeWebAppCustomizationCommand({ WebAppId: WebAppId! }),
  );
  expect(customization.WebAppCustomization?.Title).toBe("My App");

  await transfer.send(new DeleteWebAppCommand({ WebAppId: WebAppId! }));

  await expect(
    transfer.send(new DescribeWebAppCommand({ WebAppId: WebAppId! })),
  ).rejects.toThrow();
});

test("workflow lifecycle", async () => {
  const transfer = client();

  const { WorkflowId } = await transfer.send(
    new CreateWorkflowCommand({
      Steps: [{ Type: "COPY", CopyStepDetails: { Name: "copy-step" } }],
      Description: "e2e test workflow",
    }),
  );
  expect(WorkflowId).toBeDefined();

  const described = await transfer.send(
    new DescribeWorkflowCommand({ WorkflowId: WorkflowId! }),
  );
  expect(described.Workflow?.WorkflowId).toBe(WorkflowId);
  expect(described.Workflow?.Description).toBe("e2e test workflow");

  const listed = await transfer.send(new ListWorkflowsCommand({}));
  expect(
    (listed.Workflows ?? []).some((w) => w.WorkflowId === WorkflowId),
  ).toBe(true);

  await transfer.send(new DeleteWorkflowCommand({ WorkflowId: WorkflowId! }));
});

test("certificate and host-key import lifecycle", async () => {
  const transfer = client();
  const { ServerId: serverId } = await transfer.send(
    new CreateServerCommand({}),
  );

  const fakePem =
    "-----BEGIN CERTIFICATE-----\naGVsbG8=\n-----END CERTIFICATE-----";
  const { CertificateId } = await transfer.send(
    new ImportCertificateCommand({ Usage: "SIGNING", Certificate: fakePem }),
  );
  expect(CertificateId).toBeDefined();

  const certDescribed = await transfer.send(
    new DescribeCertificateCommand({ CertificateId: CertificateId! }),
  );
  expect(certDescribed.Certificate?.CertificateId).toBe(CertificateId);
  expect(certDescribed.Certificate?.Usage).toBe("SIGNING");

  const certListed = await transfer.send(new ListCertificatesCommand({}));
  expect(
    (certListed.Certificates ?? []).some(
      (c) => c.CertificateId === CertificateId,
    ),
  ).toBe(true);

  await transfer.send(
    new DeleteCertificateCommand({ CertificateId: CertificateId! }),
  );

  const fakeHostKey = "ssh-rsa AAAA... host-key-body";
  const { HostKeyId } = await transfer.send(
    new ImportHostKeyCommand({ ServerId: serverId, HostKeyBody: fakeHostKey }),
  );
  expect(HostKeyId).toBeDefined();

  const hkDescribed = await transfer.send(
    new DescribeHostKeyCommand({ ServerId: serverId, HostKeyId: HostKeyId! }),
  );
  expect(hkDescribed.HostKey?.HostKeyId).toBe(HostKeyId);

  const hkListed = await transfer.send(
    new ListHostKeysCommand({ ServerId: serverId }),
  );
  expect((hkListed.HostKeys ?? []).some((k) => k.HostKeyId === HostKeyId)).toBe(
    true,
  );

  await transfer.send(
    new DeleteHostKeyCommand({ ServerId: serverId, HostKeyId: HostKeyId! }),
  );
  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));
});

test("tags lifecycle", async () => {
  const transfer = client();
  const { ServerId: serverId } = await transfer.send(
    new CreateServerCommand({}),
  );
  const { Server: server } = await transfer.send(
    new DescribeServerCommand({ ServerId: serverId }),
  );
  const arn = server?.Arn!;

  await transfer.send(
    new TagResourceCommand({ Arn: arn, Tags: [{ Key: "Env", Value: "test" }] }),
  );

  const listed = await transfer.send(
    new ListTagsForResourceCommand({ Arn: arn }),
  );
  expect(
    (listed.Tags ?? []).some((t) => t.Key === "Env" && t.Value === "test"),
  ).toBe(true);

  await transfer.send(new UntagResourceCommand({ Arn: arn, TagKeys: ["Env"] }));
  const afterUntag = await transfer.send(
    new ListTagsForResourceCommand({ Arn: arn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "Env")).toBe(false);

  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));
});

test("security policy lifecycle", async () => {
  const transfer = client();

  const listed = await transfer.send(new ListSecurityPoliciesCommand({}));
  expect((listed.SecurityPolicyNames ?? []).length).toBeGreaterThan(0);

  const described = await transfer.send(
    new DescribeSecurityPolicyCommand({
      SecurityPolicyName: "TransferSecurityPolicy-2018-11",
    }),
  );
  expect(described.SecurityPolicy?.SecurityPolicyName).toBe(
    "TransferSecurityPolicy-2018-11",
  );
});
