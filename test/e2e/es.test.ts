import { expect, test } from "bun:test";
import {
  ElasticsearchServiceClient,
  UpdateElasticsearchDomainConfigCommand,
} from "@aws-sdk/client-elasticsearch-service";
import { startApp } from "./harness.ts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new ElasticsearchServiceClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("UpdateElasticsearchDomainConfig returns valid DomainConfig shape", async () => {
  const domainName = `bunsai-es-${Date.now()}`;
  const res = await client().send(
    new UpdateElasticsearchDomainConfigCommand({
      DomainName: domainName,
      ElasticsearchClusterConfig: {
        InstanceType: "m4.large.elasticsearch",
        InstanceCount: 2,
      },
    }),
  );
  expect(res.DomainConfig).toBeDefined();
  expect(
    res.DomainConfig?.ElasticsearchClusterConfig?.Options?.InstanceCount,
  ).toBe(2);
  expect(res.DomainConfig?.ElasticsearchClusterConfig?.Status?.State).toBe(
    "Active",
  );
});
