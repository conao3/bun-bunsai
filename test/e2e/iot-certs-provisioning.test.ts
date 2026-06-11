import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptCertificateTransferCommand,
  CancelCertificateTransferCommand,
  ClearDefaultAuthorizerCommand,
  CreateAuthorizerCommand,
  CreateCertificateFromCsrCommand,
  CreateCertificateProviderCommand,
  CreateDomainConfigurationCommand,
  CreateProvisioningClaimCommand,
  CreateProvisioningTemplateCommand,
  CreateProvisioningTemplateVersionCommand,
  CreateRoleAliasCommand,
  DeleteAuthorizerCommand,
  DeleteCertificateProviderCommand,
  DeleteDomainConfigurationCommand,
  DeleteProvisioningTemplateCommand,
  DeleteRoleAliasCommand,
  DescribeAuthorizerCommand,
  DescribeCertificateProviderCommand,
  DescribeDefaultAuthorizerCommand,
  DescribeDomainConfigurationCommand,
  DescribeProvisioningTemplateCommand,
  DescribeRoleAliasCommand,
  GetRegistrationCodeCommand,
  IoTClient,
  ListAuthorizersCommand,
  ListCertificateProvidersCommand,
  ListDomainConfigurationsCommand,
  ListProvisioningTemplatesCommand,
  ListRoleAliasesCommand,
  RegisterCACertificateCommand,
  RegisterCertificateWithoutCACommand,
  SetDefaultAuthorizerCommand,
  TransferCertificateCommand,
  UpdateAuthorizerCommand,
  UpdateDomainConfigurationCommand,
  UpdateRoleAliasCommand,
} from "@aws-sdk/client-iot";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iot = () =>
  new IoTClient({ endpoint, region, credentials, requestHandler });

const suffix = () => Date.now().toString(36);

const FAKE_PEM =
  "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----";

test("IoT CA certificate lifecycle", async () => {
  const client = iot();

  const reg = await client.send(new GetRegistrationCodeCommand({}));
  expect(reg.registrationCode).toBeTruthy();

  const created = await client.send(
    new RegisterCACertificateCommand({
      caCertificate: FAKE_PEM,
      setAsActive: true,
    }),
  );
  expect(created.certificateId).toBeTruthy();
  expect(created.certificateArn).toContain("cacert/");
});

test("IoT certificate transfer lifecycle", async () => {
  const client = iot();

  const csr = await client.send(
    new CreateCertificateFromCsrCommand({
      certificateSigningRequest: "fake-csr-content",
      setAsActive: true,
    }),
  );
  expect(csr.certificateId).toBeTruthy();
  expect(csr.certificatePem).toContain("BEGIN CERTIFICATE");

  await client.send(
    new TransferCertificateCommand({
      certificateId: csr.certificateId!,
      targetAwsAccount: "123456789012",
    }),
  );

  await client.send(
    new CancelCertificateTransferCommand({
      certificateId: csr.certificateId!,
    }),
  );
});

test("IoT certificate transfer accept lifecycle", async () => {
  const client = iot();

  const csr = await client.send(
    new CreateCertificateFromCsrCommand({
      certificateSigningRequest: "fake-csr-content-2",
      setAsActive: true,
    }),
  );

  await client.send(
    new TransferCertificateCommand({
      certificateId: csr.certificateId!,
      targetAwsAccount: "123456789012",
    }),
  );

  await client.send(
    new AcceptCertificateTransferCommand({
      certificateId: csr.certificateId!,
      setAsActive: true,
    }),
  );
});

test("IoT RegisterCertificateWithoutCA", async () => {
  const client = iot();
  const result = await client.send(
    new RegisterCertificateWithoutCACommand({
      certificatePem: FAKE_PEM,
      status: "ACTIVE",
    }),
  );
  expect(result.certificateId).toBeTruthy();
  expect(result.certificateArn).toContain("cert/");
});

test("IoT certificate provider lifecycle", async () => {
  const client = iot();
  const name = `bunsai_e2e_cp_${suffix()}`;

  const created = await client.send(
    new CreateCertificateProviderCommand({
      certificateProviderName: name,
      lambdaFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
      accountDefaultForOperations: ["CreateCertificateFromCsr"],
    }),
  );
  expect(created.certificateProviderName).toBe(name);
  expect(created.certificateProviderArn).toContain("certificateprovider/");

  const described = await client.send(
    new DescribeCertificateProviderCommand({ certificateProviderName: name }),
  );
  expect(described.lambdaFunctionArn).toContain("lambda");

  const listed = await client.send(new ListCertificateProvidersCommand({}));
  expect(
    listed.certificateProviders?.some(
      (p) => p.certificateProviderName === name,
    ),
  ).toBe(true);

  await client.send(
    new DeleteCertificateProviderCommand({ certificateProviderName: name }),
  );
  const listed2 = await client.send(new ListCertificateProvidersCommand({}));
  expect(
    listed2.certificateProviders?.some(
      (p) => p.certificateProviderName === name,
    ),
  ).toBe(false);
});

test("IoT provisioning template lifecycle", async () => {
  const client = iot();
  const templateName = `bunsai_e2e_tmpl_${suffix()}`;
  const templateBody = JSON.stringify({
    Parameters: { ThingName: { Type: "String" } },
    Resources: {},
  });

  const created = await client.send(
    new CreateProvisioningTemplateCommand({
      templateName,
      templateBody,
      provisioningRoleArn:
        "arn:aws:iam::123456789012:role/iot-provisioning-role",
      enabled: true,
    }),
  );
  expect(created.templateName).toBe(templateName);
  expect(created.defaultVersionId).toBe(1);

  const described = await client.send(
    new DescribeProvisioningTemplateCommand({ templateName }),
  );
  expect(described.enabled).toBe(true);
  expect(described.defaultVersionId).toBe(1);

  const v2 = await client.send(
    new CreateProvisioningTemplateVersionCommand({
      templateName,
      templateBody,
      setAsDefault: true,
    }),
  );
  expect(v2.versionId).toBe(2);

  const claim = await client.send(
    new CreateProvisioningClaimCommand({ templateName }),
  );
  expect(claim.certificateId).toBeTruthy();
  expect(claim.certificatePem).toContain("BEGIN CERTIFICATE");

  const listed = await client.send(new ListProvisioningTemplatesCommand({}));
  expect(listed.templates?.some((t) => t.templateName === templateName)).toBe(
    true,
  );

  await client.send(new DeleteProvisioningTemplateCommand({ templateName }));
  const listed2 = await client.send(new ListProvisioningTemplatesCommand({}));
  expect(listed2.templates?.some((t) => t.templateName === templateName)).toBe(
    false,
  );
});

test("IoT role alias lifecycle", async () => {
  const client = iot();
  const roleAlias = `bunsai_e2e_role_alias_${suffix()}`;

  const created = await client.send(
    new CreateRoleAliasCommand({
      roleAlias,
      roleArn: "arn:aws:iam::123456789012:role/iot-role",
      credentialDurationSeconds: 3600,
    }),
  );
  expect(created.roleAlias).toBe(roleAlias);
  expect(created.roleAliasArn).toContain("rolealias/");

  const described = await client.send(
    new DescribeRoleAliasCommand({ roleAlias }),
  );
  expect(described.roleAliasDescription?.roleArn).toContain(
    "arn:aws:iam::123456789012",
  );

  await client.send(
    new UpdateRoleAliasCommand({
      roleAlias,
      credentialDurationSeconds: 7200,
    }),
  );

  const listed = await client.send(new ListRoleAliasesCommand({}));
  expect(listed.roleAliases?.includes(roleAlias)).toBe(true);

  await client.send(new DeleteRoleAliasCommand({ roleAlias }));
  const listed2 = await client.send(new ListRoleAliasesCommand({}));
  expect(listed2.roleAliases?.includes(roleAlias)).toBe(false);
});

test("IoT authorizer lifecycle", async () => {
  const client = iot();
  const authorizerName = `bunsai_e2e_auth_${suffix()}`;

  const created = await client.send(
    new CreateAuthorizerCommand({
      authorizerName,
      authorizerFunctionArn:
        "arn:aws:lambda:us-east-1:123456789012:function:auth",
      status: "ACTIVE",
      signingDisabled: true,
    }),
  );
  expect(created.authorizerName).toBe(authorizerName);
  expect(created.authorizerArn).toContain("authorizer/");

  const described = await client.send(
    new DescribeAuthorizerCommand({ authorizerName }),
  );
  expect(described.authorizerDescription?.status).toBe("ACTIVE");

  await client.send(
    new UpdateAuthorizerCommand({ authorizerName, status: "INACTIVE" }),
  );

  const listed = await client.send(new ListAuthorizersCommand({}));
  expect(
    listed.authorizers?.some((a) => a.authorizerName === authorizerName),
  ).toBe(true);

  await client.send(new SetDefaultAuthorizerCommand({ authorizerName }));
  const def = await client.send(new DescribeDefaultAuthorizerCommand({}));
  expect(def.authorizerDescription?.authorizerName).toBe(authorizerName);

  await client.send(new ClearDefaultAuthorizerCommand({}));

  await client.send(new DeleteAuthorizerCommand({ authorizerName }));
  const listed2 = await client.send(new ListAuthorizersCommand({}));
  expect(
    listed2.authorizers?.some((a) => a.authorizerName === authorizerName),
  ).toBe(false);
});

test("IoT domain configuration lifecycle", async () => {
  const client = iot();
  const domainConfigurationName = `bunsai_e2e_dc_${suffix()}`;

  const created = await client.send(
    new CreateDomainConfigurationCommand({
      domainConfigurationName,
      serviceType: "DATA",
    }),
  );
  expect(created.domainConfigurationName).toBe(domainConfigurationName);
  expect(created.domainConfigurationArn).toContain("domainconfiguration/");

  const described = await client.send(
    new DescribeDomainConfigurationCommand({ domainConfigurationName }),
  );
  expect(described.domainConfigurationStatus).toBe("ENABLED");

  await client.send(
    new UpdateDomainConfigurationCommand({
      domainConfigurationName,
      domainConfigurationStatus: "DISABLED",
    }),
  );

  const listed = await client.send(new ListDomainConfigurationsCommand({}));
  expect(
    listed.domainConfigurations?.some(
      (d) => d.domainConfigurationName === domainConfigurationName,
    ),
  ).toBe(true);

  await client.send(
    new DeleteDomainConfigurationCommand({ domainConfigurationName }),
  );
  const listed2 = await client.send(new ListDomainConfigurationsCommand({}));
  expect(
    listed2.domainConfigurations?.some(
      (d) => d.domainConfigurationName === domainConfigurationName,
    ),
  ).toBe(false);
});
