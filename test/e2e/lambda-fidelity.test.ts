import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  LambdaClient,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const makeZip = () => new TextEncoder().encode("PK fake zip");

test("Lambda tag round-trip via CreateFunction", async () => {
  const client = lambda();
  const name = "bunsai-fidelity-tags";

  const created = await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: { ZipFile: makeZip() },
      Tags: { env: "prod", team: "bunsai" },
    }),
  );
  expect(created.FunctionArn).toBeDefined();

  const got = await client.send(new GetFunctionCommand({ FunctionName: name }));
  expect(got.Tags?.env).toBe("prod");
  expect(got.Tags?.team).toBe("bunsai");

  await client.send(new DeleteFunctionCommand({ FunctionName: name }));
});

test("Lambda Pending lifecycle on CreateFunction", async () => {
  const client = lambda();
  const name = "bunsai-fidelity-pending";

  const created = await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: { ZipFile: makeZip() },
    }),
  );
  expect(created.State).toBe("Pending");

  const immediate = await client.send(
    new GetFunctionConfigurationCommand({ FunctionName: name }),
  );
  expect(immediate.State).toBe("Pending");

  await Bun.sleep(200);

  const later = await client.send(
    new GetFunctionConfigurationCommand({ FunctionName: name }),
  );
  expect(later.State).toBe("Active");

  await client.send(new DeleteFunctionCommand({ FunctionName: name }));
});

test("Lambda ListFunctions Marker/MaxItems pagination", async () => {
  const client = lambda();
  const prefix = "bunsai-fidelity-page";
  const names = Array.from({ length: 5 }, (_, i) => `${prefix}-${i}`);

  for (const n of names) {
    await client.send(
      new CreateFunctionCommand({
        FunctionName: n,
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: { ZipFile: makeZip() },
      }),
    );
  }

  const page1 = await client.send(new ListFunctionsCommand({ MaxItems: 3 }));
  expect((page1.Functions ?? []).length).toBe(3);
  expect(page1.NextMarker).toBeDefined();

  const page2 = await client.send(
    new ListFunctionsCommand({ Marker: page1.NextMarker }),
  );
  expect((page2.Functions ?? []).length).toBe(2);
  expect(page2.NextMarker).toBeUndefined();

  const page1Names = (page1.Functions ?? []).map((f) => f.FunctionName);
  const page2Names = (page2.Functions ?? []).map((f) => f.FunctionName);
  const overlap = page1Names.filter((n) => page2Names.includes(n));
  expect(overlap.length).toBe(0);

  for (const n of names) {
    await client.send(new DeleteFunctionCommand({ FunctionName: n }));
  }
});
