const protocols = ["query", "ec2", "json", "rest-json", "rest-xml"] as const;

export type Protocol = (typeof protocols)[number];

export type ParsedRequest = {
  method: string;
  url: URL;
  path: string;
  query: URLSearchParams;
  headers: Headers;
  bodyBytes: Uint8Array;
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
  data?: Record<string, unknown>;
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

export type TimestampFormat = "unixTimestamp" | "iso8601" | "rfc822";

type Location = "querystring" | "header" | "headers" | "uri" | "statusCode";

export type XmlNamespace = {
  uri: string;
  prefix?: string;
};

export type Member = {
  shape: string;
  locationName?: string;
  location?: Location;
  queryName?: string;
  flattened?: boolean;
  timestampFormat?: TimestampFormat;
  xmlNamespace?: XmlNamespace;
  xmlAttribute?: boolean;
  jsonName?: string;
  payload?: boolean;
  hostLabel?: boolean;
  idempotencyToken?: boolean;
  jsonvalue?: boolean;
};

export type ErrorTrait = {
  code?: string;
  httpStatusCode?: number;
  senderFault?: boolean;
};

export type StructureShape = {
  type: "structure";
  members: Record<string, Member>;
  required?: string[];
  payload?: string;
  locationName?: string;
  xmlNamespace?: XmlNamespace;
  error?: ErrorTrait;
  exception?: boolean;
  fault?: boolean;
};

export type ListShape = {
  type: "list";
  member: Member;
  flattened?: boolean;
  locationName?: string;
};

export type MapShape = {
  type: "map";
  key: Member;
  value: Member;
  flattened?: boolean;
  locationName?: string;
};

export type ScalarShape = {
  type:
    | "string"
    | "integer"
    | "long"
    | "double"
    | "float"
    | "boolean"
    | "blob"
    | "timestamp";
  timestampFormat?: TimestampFormat;
  enum?: string[];
  locationName?: string;
};

export type Shape = StructureShape | ListShape | MapShape | ScalarShape;

export type ShapeRef = {
  shape: string;
  resultWrapper?: string;
};

export type ServiceMetadata = {
  protocol?: string;
  apiVersion?: string;
  xmlNamespace?: string;
  targetPrefix?: string;
  jsonVersion?: string;
  endpointPrefix?: string;
  serviceId?: string;
};

export type OperationHttp = {
  method?: string;
  requestUri?: string;
  responseCode?: number;
};

export type OperationModel = {
  name: string;
  http?: OperationHttp;
  input?: ShapeRef;
  output?: ShapeRef;
  errors?: ShapeRef[];
};

export type ShapeRegistry = {
  shapes: Record<string, Shape>;
};

export type ServiceModel = {
  metadata: ServiceMetadata;
  operations: Record<string, OperationModel>;
  registry: ShapeRegistry;
};

export type ServiceDefinition = {
  name: string;
  protocol: Protocol;
  operations: Record<string, OperationHandler>;
  resolveOperation?: (req: ParsedRequest) => string | undefined;
  model?: ServiceModel;
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
