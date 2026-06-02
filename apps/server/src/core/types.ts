export const protocols = ["query", "json", "rest-json", "rest-xml"] as const;

export type Protocol = (typeof protocols)[number];

export type ParsedRequest = {
  method: string;
  url: URL;
  path: string;
  query: URLSearchParams;
  headers: Headers;
  bodyText: string;
  service: string;
  region: string;
  account: string;
  protocol: Protocol;
  target: string | undefined;
};

export type AwsError = {
  __awsError: true;
  code: string;
  message: string;
  statusCode: number;
};

export type StateScope = {
  account: string;
  region: string;
  service: string;
};

export type ScopedStore = {
  scope: StateScope;
  get: <T = unknown>(key: string) => T | undefined;
  set: <T = unknown>(key: string, value: T) => void;
  delete: (key: string) => boolean;
  list: <T = unknown>() => { key: string; value: T }[];
};

export type ServiceContext = {
  store: ScopedStore;
  account: string;
  region: string;
};

export type OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  req: ParsedRequest,
) => unknown | Promise<unknown>;

export type ServiceDefinition = {
  name: string;
  protocol: Protocol;
  operations: Record<string, OperationHandler>;
  resolveOperation?: (req: ParsedRequest) => string | undefined;
};

export type RequestLogEntry = {
  id: string;
  time: string;
  service: string;
  operation: string;
  statusCode: number;
  latencyMs: number;
  account: string;
  region: string;
  protocol: Protocol | "unknown";
  requestBodyText: string;
  responseBodyText: string;
};
