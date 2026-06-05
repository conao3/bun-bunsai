import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSAMLProviderCommand,
  DeleteSAMLProviderCommand,
  GetSAMLProviderCommand,
  IAMClient,
  ListSAMLProviderTagsCommand,
  ListSAMLProvidersCommand,
  TagSAMLProviderCommand,
  UntagSAMLProviderCommand,
  UpdateSAMLProviderCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });

const samlMetadata = `<?xml version="1.0" encoding="UTF-8"?><EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://example.com/saml"></EntityDescriptor>`;
const samlMetadataV2 = `<?xml version="1.0" encoding="UTF-8"?><EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://example.com/saml/v2"></EntityDescriptor>`;

test("IAM SAML provider lifecycle: create, get, update, tag, list, delete", async () => {
  const client = iam();

  const created = await client.send(
    new CreateSAMLProviderCommand({
      Name: "e2e-saml-provider",
      SAMLMetadataDocument: samlMetadata,
      Tags: [{ Key: "Env", Value: "test" }],
    }),
  );
  const arn = created.SAMLProviderArn;
  expect(arn).toContain(":saml-provider/e2e-saml-provider");

  const got = await client.send(
    new GetSAMLProviderCommand({ SAMLProviderArn: arn }),
  );
  expect(got.SAMLMetadataDocument).toBe(samlMetadata);
  expect((got.Tags ?? []).map((t) => t.Key)).toContain("Env");

  await client.send(
    new UpdateSAMLProviderCommand({
      SAMLProviderArn: arn,
      SAMLMetadataDocument: samlMetadataV2,
    }),
  );

  const gotAfterUpdate = await client.send(
    new GetSAMLProviderCommand({ SAMLProviderArn: arn }),
  );
  expect(gotAfterUpdate.SAMLMetadataDocument).toBe(samlMetadataV2);

  await client.send(
    new TagSAMLProviderCommand({
      SAMLProviderArn: arn,
      Tags: [{ Key: "Team", Value: "platform" }],
    }),
  );

  const tags = await client.send(
    new ListSAMLProviderTagsCommand({ SAMLProviderArn: arn }),
  );
  const tagKeys = (tags.Tags ?? []).map((t) => t.Key);
  expect(tagKeys).toContain("Team");
  expect(tagKeys).toContain("Env");

  await client.send(
    new UntagSAMLProviderCommand({
      SAMLProviderArn: arn,
      TagKeys: ["Env"],
    }),
  );

  const tagsAfterUntag = await client.send(
    new ListSAMLProviderTagsCommand({ SAMLProviderArn: arn }),
  );
  expect((tagsAfterUntag.Tags ?? []).map((t) => t.Key)).not.toContain("Env");

  const listed = await client.send(new ListSAMLProvidersCommand({}));
  const arns = (listed.SAMLProviderList ?? []).map((p) => p.Arn);
  expect(arns).toContain(arn);

  await client.send(new DeleteSAMLProviderCommand({ SAMLProviderArn: arn }));

  const listedAfter = await client.send(new ListSAMLProvidersCommand({}));
  const arnsAfter = (listedAfter.SAMLProviderList ?? []).map((p) => p.Arn);
  expect(arnsAfter).not.toContain(arn);
});
