import type { ParsedRequest, Protocol } from "./types.ts";

const defaultAccount = "000000000000" as const;
const defaultRegion = "us-east-1" as const;

export type RouteResult = {
  service: string | undefined;
  region: string;
  account: string;
  target: string | undefined;
};

const parseCredentialScope = (
  authorization: string | null,
): { service: string; region: string } | undefined => {
  if (authorization === null) return undefined;
  const match = authorization.match(
    /Credential=[^/]+\/[^/]+\/([^/]+)\/([^/]+)\/aws4_request/,
  );
  if (match === null) return undefined;
  return { region: match[1], service: match[2] };
};

const serviceFromTarget = (
  target: string | null | undefined,
): string | undefined => {
  if (target === null || target === undefined) return undefined;
  const prefix = target.split(".")[0];
  if (prefix === undefined || prefix === "") return undefined;
  return prefix.toLowerCase();
};

const serviceFromHost = (host: string | null): string | undefined => {
  if (host === null) return undefined;
  const hostname = host.split(":")[0];
  const labels = hostname.split(".");
  const first = labels[0];
  if (first === undefined || first === "") return undefined;
  if (first === "localhost" || /^\d+$/.test(first)) return undefined;
  if (first === "s3" || first.startsWith("s3-")) return "s3";
  return first.toLowerCase();
};

export const routeRequest = (req: Request, url: URL): RouteResult => {
  const headers = req.headers;
  const credential = parseCredentialScope(headers.get("authorization"));
  const target = headers.get("x-amz-target") ?? undefined;
  const region = credential?.region ?? defaultRegion;

  let service = credential?.service;
  if (service === undefined) service = serviceFromTarget(target);
  if (service === undefined) service = serviceFromHost(headers.get("host"));

  return {
    service,
    region,
    account: defaultAccount,
    target,
  };
};

export const buildParsedRequest = (
  req: Request,
  url: URL,
  bodyText: string,
  route: RouteResult,
  protocol: Protocol,
): ParsedRequest => ({
  method: req.method,
  url,
  path: url.pathname,
  query: url.searchParams,
  headers: req.headers,
  bodyText,
  service: route.service ?? "",
  region: route.region,
  account: route.account,
  protocol,
  target: route.target,
});
