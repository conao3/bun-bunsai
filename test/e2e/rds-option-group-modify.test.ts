import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  RDSClient,
  CreateOptionGroupCommand,
  ModifyOptionGroupCommand,
  DescribeOptionGroupsCommand,
} from "@aws-sdk/client-rds";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new RDSClient({ endpoint, region, credentials, requestHandler });

test("ModifyOptionGroup includes, updates and removes options", async () => {
  await client.send(
    new CreateOptionGroupCommand({
      OptionGroupName: "og-mod",
      EngineName: "mysql",
      MajorEngineVersion: "5.6",
      OptionGroupDescription: "modify test",
    }),
  );

  const removedMissing = await client.send(
    new ModifyOptionGroupCommand({
      OptionGroupName: "og-mod",
      OptionsToInclude: [],
      OptionsToRemove: ["MEMCACHED"],
      ApplyImmediately: true,
    }),
  );
  expect(removedMissing.OptionGroup?.Options).toEqual([]);

  await client.send(
    new ModifyOptionGroupCommand({
      OptionGroupName: "og-mod",
      OptionsToInclude: [{ OptionName: "MARIADB_AUDIT_PLUGIN" }],
      OptionsToRemove: [],
      ApplyImmediately: true,
    }),
  );
  let described = await client.send(
    new DescribeOptionGroupsCommand({ OptionGroupName: "og-mod" }),
  );
  expect(described.OptionGroupsList?.[0]?.Options?.length).toBe(1);
  expect(described.OptionGroupsList?.[0]?.Options?.[0]?.OptionName).toBe(
    "MARIADB_AUDIT_PLUGIN",
  );

  await client.send(
    new ModifyOptionGroupCommand({
      OptionGroupName: "og-mod",
      OptionsToInclude: [
        {
          OptionName: "MARIADB_AUDIT_PLUGIN",
          OptionSettings: [
            { Name: "SERVER_AUDIT_FILE_ROTATE_SIZE", Value: "1000" },
          ],
        },
      ],
      ApplyImmediately: true,
    }),
  );
  described = await client.send(
    new DescribeOptionGroupsCommand({ OptionGroupName: "og-mod" }),
  );
  const options = described.OptionGroupsList?.[0]?.Options ?? [];
  expect(options.length).toBe(1);
  expect(
    options[0]?.OptionSettings?.find(
      (s) => s.Name === "SERVER_AUDIT_FILE_ROTATE_SIZE",
    )?.Value,
  ).toBe("1000");

  await client.send(
    new ModifyOptionGroupCommand({
      OptionGroupName: "og-mod",
      OptionsToRemove: ["MARIADB_AUDIT_PLUGIN"],
      ApplyImmediately: true,
    }),
  );
  described = await client.send(
    new DescribeOptionGroupsCommand({ OptionGroupName: "og-mod" }),
  );
  expect(described.OptionGroupsList?.[0]?.Options).toEqual([]);
});

test("ModifyOptionGroup validation errors", async () => {
  expect(
    client.send(new ModifyOptionGroupCommand({ OptionGroupName: "missing" })),
  ).rejects.toMatchObject({ name: "OptionGroupNotFoundFault" });

  await client.send(
    new CreateOptionGroupCommand({
      OptionGroupName: "og-noop",
      EngineName: "mysql",
      MajorEngineVersion: "5.6",
      OptionGroupDescription: "noop test",
    }),
  );
  expect(
    client.send(new ModifyOptionGroupCommand({ OptionGroupName: "og-noop" })),
  ).rejects.toMatchObject({ name: "InvalidParameterCombination" });
});
