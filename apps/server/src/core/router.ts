import type { ParsedRequest, Protocol, ServiceDefinition } from "./types.ts";

const defaultAccount = "000000000000" as const;
const defaultRegion = "us-east-1" as const;

export type RouteResult = {
  service: string | undefined;
  region: string;
  account: string;
  target: string | undefined;
  presignedExpired: boolean;
};

type CredentialScope = {
  accessKeyId: string;
  service: string;
  region: string;
};

const parseCredentialScope = (
  authorization: string | null,
): CredentialScope | undefined => {
  if (authorization === null) return undefined;
  const match = authorization.match(
    /Credential=([^/]+)\/[^/]+\/([^/]+)\/([^/]+)\/aws4_request/,
  );
  if (match === null) return undefined;
  return { accessKeyId: match[1], region: match[2], service: match[3] };
};

const parseQueryCredentialScope = (url: URL): CredentialScope | undefined => {
  const credential = url.searchParams.get("X-Amz-Credential");
  if (credential === null) return undefined;
  const match = credential.match(
    /^([^/]+)\/[^/]+\/([^/]+)\/([^/]+)\/aws4_request$/,
  );
  if (match === null) return undefined;
  return { accessKeyId: match[1], region: match[2], service: match[3] };
};

const accountFromAccessKeyId = (
  accessKeyId: string | undefined,
): string | undefined => accessKeyId?.match(/^ASIA(\d{12})/)?.[1];

const presignedIsExpired = (url: URL): boolean => {
  const date = url.searchParams.get("X-Amz-Date");
  const expires = url.searchParams.get("X-Amz-Expires");
  if (date === null || expires === null) return false;
  const match = date.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  const seconds = Number(expires);
  if (match === null || !Number.isFinite(seconds)) return false;
  const signedAt = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  return Date.now() > signedAt + seconds * 1000;
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
  if (labels[1] === "execute-api") return "execute-api";
  if (first === "s3" || first.startsWith("s3-")) return "s3";
  return first.toLowerCase();
};

export const routeRequest = (req: Request, url: URL): RouteResult => {
  const headers = req.headers;
  const credential =
    parseCredentialScope(headers.get("authorization")) ??
    parseQueryCredentialScope(url);
  const target = headers.get("x-amz-target") ?? undefined;
  const region = credential?.region ?? defaultRegion;

  let service = credential?.service;
  if (service === undefined) service = serviceFromTarget(target);
  if (service === undefined) service = serviceFromHost(headers.get("host"));
  if (service === undefined) service = serviceFromHost(url.hostname);

  return {
    service,
    region,
    account: accountFromAccessKeyId(credential?.accessKeyId) ?? defaultAccount,
    target,
    presignedExpired:
      url.searchParams.has("X-Amz-Credential") && presignedIsExpired(url),
  };
};

export const pickService = (
  candidates: ServiceDefinition[],
  path: string,
): ServiceDefinition | undefined => {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const ctx = { path } as ParsedRequest;
  const matched = candidates.find((s) => s.matches?.(ctx) === true);
  return matched ?? candidates.find((s) => s.matches === undefined);
};

export const buildParsedRequest = (
  req: Request,
  url: URL,
  bodyBytes: Uint8Array,
  route: RouteResult,
  protocol: Protocol,
): ParsedRequest => {
  let bodyTextCache: string | undefined;
  return {
    method: req.method,
    url,
    path: url.pathname,
    query: url.searchParams,
    headers: req.headers,
    bodyBytes,
    get bodyText() {
      if (bodyTextCache === undefined)
        bodyTextCache = new TextDecoder().decode(bodyBytes);
      return bodyTextCache;
    },
    service: route.service ?? "",
    region: route.region,
    account: route.account,
    protocol,
    target: route.target,
  };
};
