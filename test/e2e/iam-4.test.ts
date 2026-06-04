import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4902;
const uiPort = 5902;
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

const iam = () => new IAMClient({ endpoint, region, credentials });

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
