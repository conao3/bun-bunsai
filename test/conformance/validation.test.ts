import { describe, expect, it } from "bun:test";
import { dispatch } from "../../apps/server/src/core/framework.ts";
import { createStateStore } from "../../apps/server/src/core/state.ts";
import { services } from "../../apps/server/src/services/index.ts";
import type {
  ParsedRequest,
  Protocol,
  ServiceDefinition,
} from "../../apps/server/src/core/types.ts";

const findService = (name: string): ServiceDefinition => {
  const found = services.find((s) => s.name === name);
  if (found === undefined) throw new Error(`service ${name} not registered`);
  return found;
};

type RequestInit = {
  protocol: Protocol;
  service: string;
  method?: string;
  path?: string;
  bodyText?: string;
  target?: string;
  query?: string;
};

const makeRequest = (init: RequestInit): ParsedRequest => {
  const url = new URL(
    `http://localhost${init.path ?? "/"}${
      init.query !== undefined ? `?${init.query}` : ""
    }`,
  );
  const headers = new Headers();
  if (init.target !== undefined) headers.set("X-Amz-Target", init.target);
  return {
    method: init.method ?? "POST",
    url,
    path: url.pathname,
    query: url.searchParams,
    headers,
    bodyText: init.bodyText ?? "",
    service: init.service,
    region: "us-east-1",
    account: "000000000000",
    protocol: init.protocol,
    target: init.target,
  };
};

const run = async (
  service: ServiceDefinition,
  init: RequestInit,
): Promise<Awaited<ReturnType<typeof dispatch>>> =>
  dispatch(service, makeRequest(init), createStateStore());

describe("L2 validation: required member omission", () => {
  it("query (sts AssumeRole) missing RoleArn returns MissingParameter Sender fault 400", async () => {
    const result = await run(findService("sts"), {
      protocol: "query",
      service: "sts",
      bodyText: "Action=AssumeRole&Version=2011-06-15",
    });
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("<Code>MissingParameter</Code>");
    expect(result.body).toContain("<Type>Sender</Type>");
    expect(result.body).toContain("RoleArn");
    expect(result.body).toMatch(/<ErrorResponse>/);
  });

  it("json (sqs SendMessage) missing QueueUrl returns ValidationException 400", async () => {
    const result = await run(findService("sqs"), {
      protocol: "json",
      service: "sqs",
      target: "AmazonSQS.SendMessage",
      bodyText: JSON.stringify({ MessageBody: "hello" }),
    });
    expect(result.statusCode).toBe(400);
    const payload = JSON.parse(result.body) as Record<string, unknown>;
    expect(payload.__type).toBe("ValidationException");
    expect(String(payload.Message)).toContain("QueueUrl");
  });

  it("rest-json (lambda CreateFunction) missing FunctionName returns ValidationException 400", async () => {
    const result = await run(findService("lambda"), {
      protocol: "rest-json",
      service: "lambda",
      method: "POST",
      path: "/2015-03-31/functions",
      bodyText: JSON.stringify({ Role: "arn:role", Code: {} }),
    });
    expect(result.statusCode).toBe(400);
    const payload = JSON.parse(result.body) as Record<string, unknown>;
    expect(String(payload.message)).toContain("FunctionName");
    expect(result.headers?.["X-Amzn-Errortype"]).toBe("ValidationException");
  });

  it("ec2 (RunInstances) missing MinCount returns MissingParameter Sender fault 400", async () => {
    const result = await run(findService("ec2"), {
      protocol: "ec2",
      service: "ec2",
      bodyText: "Action=RunInstances&Version=2016-11-15&MaxCount=1",
    });
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("<Code>MissingParameter</Code>");
    expect(result.body).toMatch(/<Response>/);
  });

  it("valid query request with all required members is not rejected by validation", async () => {
    const result = await run(findService("sts"), {
      protocol: "query",
      service: "sts",
      bodyText:
        "Action=AssumeRole&Version=2011-06-15" +
        "&RoleArn=arn%3Aaws%3Aiam%3A%3A000000000000%3Arole%2Fdemo" +
        "&RoleSessionName=sess",
    });
    expect(result.statusCode).toBe(200);
    expect(result.body).not.toContain("MissingParameter");
  });
});

describe("L2 validation: malformed operation resolution", () => {
  it("query unknown Action returns InvalidAction error", async () => {
    const result = await run(findService("sts"), {
      protocol: "query",
      service: "sts",
      bodyText: "Action=NotARealOperation&Version=2011-06-15",
    });
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("<Code>InvalidAction</Code>");
  });

  it("query with no Action returns InvalidAction (unresolvable operation)", async () => {
    const result = await run(findService("sts"), {
      protocol: "query",
      service: "sts",
      bodyText: "Version=2011-06-15",
    });
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("<Code>InvalidAction</Code>");
  });

  it("json unknown X-Amz-Target operation returns InvalidAction error", async () => {
    const result = await run(findService("sqs"), {
      protocol: "json",
      service: "sqs",
      target: "AmazonSQS.NoSuchOperation",
      bodyText: "{}",
    });
    expect(result.statusCode).toBe(400);
    const payload = JSON.parse(result.body) as Record<string, unknown>;
    expect(payload.__type).toBe("InvalidAction");
  });
});
