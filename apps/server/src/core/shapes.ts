import type {
  ErrorTrait,
  ListShape,
  MapShape,
  Member,
  OperationHttp,
  OperationModel,
  ScalarShape,
  ServiceMetadata,
  ServiceModel,
  Shape,
  ShapeRef,
  ShapeRegistry,
  StructureShape,
  TimestampFormat,
  XmlNamespace,
} from "./types";

type RawXmlNamespace = string | { uri?: string; prefix?: string };

type RawMember = {
  shape: string;
  locationName?: string;
  location?: string;
  queryName?: string;
  flattened?: boolean;
  timestampFormat?: string;
  xmlNamespace?: RawXmlNamespace;
  xmlAttribute?: boolean;
  jsonName?: string;
  payload?: boolean;
  hostLabel?: boolean;
  idempotencyToken?: boolean;
  jsonvalue?: boolean;
};

type RawShape = {
  type?: string;
  members?: Record<string, RawMember>;
  member?: RawMember;
  key?: RawMember;
  value?: RawMember;
  required?: string[];
  flattened?: boolean;
  payload?: string;
  locationName?: string;
  timestampFormat?: string;
  enum?: string[];
  xmlNamespace?: RawXmlNamespace;
  error?: ErrorTrait;
  exception?: boolean;
  fault?: boolean;
};

type RawShapeRef = {
  shape?: string;
  resultWrapper?: string;
};

type RawOperation = {
  name?: string;
  http?: OperationHttp;
  input?: RawShapeRef;
  output?: RawShapeRef;
  errors?: RawShapeRef[];
};

export type ServiceModelJson = {
  metadata?: ServiceMetadata;
  operations?: Record<string, RawOperation>;
  shapes?: Record<string, RawShape>;
};

export type SuiteShapes = {
  shapes?: Record<string, RawShape>;
};

const normalizeXmlNamespace = (
  raw: RawXmlNamespace | undefined,
): XmlNamespace | undefined => {
  if (raw === undefined) return undefined;
  if (typeof raw === "string") return { uri: raw };
  if (raw.uri === undefined) return undefined;
  const ns: XmlNamespace = { uri: raw.uri };
  if (raw.prefix !== undefined) ns.prefix = raw.prefix;
  return ns;
};

const timestampFormats = ["unixTimestamp", "iso8601", "rfc822"] as const;

const normalizeTimestampFormat = (
  raw: string | undefined,
): TimestampFormat | undefined => {
  if (raw === undefined) return undefined;
  return timestampFormats.includes(raw as TimestampFormat)
    ? (raw as TimestampFormat)
    : undefined;
};

const locations = [
  "querystring",
  "header",
  "headers",
  "uri",
  "statusCode",
] as const;

const normalizeMember = (raw: RawMember): Member => {
  const member: Member = { shape: raw.shape };
  if (raw.locationName !== undefined) member.locationName = raw.locationName;
  if (raw.location !== undefined && locations.includes(raw.location as never))
    member.location = raw.location as Member["location"];
  if (raw.queryName !== undefined) member.queryName = raw.queryName;
  if (raw.flattened !== undefined) member.flattened = raw.flattened;
  const ts = normalizeTimestampFormat(raw.timestampFormat);
  if (ts !== undefined) member.timestampFormat = ts;
  const ns = normalizeXmlNamespace(raw.xmlNamespace);
  if (ns !== undefined) member.xmlNamespace = ns;
  if (raw.xmlAttribute !== undefined) member.xmlAttribute = raw.xmlAttribute;
  if (raw.jsonName !== undefined) member.jsonName = raw.jsonName;
  if (raw.payload !== undefined) member.payload = raw.payload;
  if (raw.hostLabel !== undefined) member.hostLabel = raw.hostLabel;
  if (raw.idempotencyToken !== undefined)
    member.idempotencyToken = raw.idempotencyToken;
  if (raw.jsonvalue !== undefined) member.jsonvalue = raw.jsonvalue;
  return member;
};

const scalarTypes = [
  "string",
  "integer",
  "long",
  "double",
  "float",
  "boolean",
  "blob",
  "timestamp",
] as const;

const normalizeShape = (raw: RawShape): Shape => {
  if (raw.type === "structure") {
    const members: Record<string, Member> = {};
    for (const [name, m] of Object.entries(raw.members ?? {}))
      members[name] = normalizeMember(m);
    const shape: StructureShape = { type: "structure", members };
    if (raw.required !== undefined) shape.required = raw.required;
    if (raw.payload !== undefined) shape.payload = raw.payload;
    if (raw.locationName !== undefined) shape.locationName = raw.locationName;
    const ns = normalizeXmlNamespace(raw.xmlNamespace);
    if (ns !== undefined) shape.xmlNamespace = ns;
    if (raw.error !== undefined) shape.error = raw.error;
    if (raw.exception !== undefined) shape.exception = raw.exception;
    if (raw.fault !== undefined) shape.fault = raw.fault;
    return shape;
  }
  if (raw.type === "list") {
    const shape: ListShape = {
      type: "list",
      member: normalizeMember(raw.member ?? { shape: "" }),
    };
    if (raw.flattened !== undefined) shape.flattened = raw.flattened;
    if (raw.locationName !== undefined) shape.locationName = raw.locationName;
    return shape;
  }
  if (raw.type === "map") {
    const shape: MapShape = {
      type: "map",
      key: normalizeMember(raw.key ?? { shape: "" }),
      value: normalizeMember(raw.value ?? { shape: "" }),
    };
    if (raw.flattened !== undefined) shape.flattened = raw.flattened;
    if (raw.locationName !== undefined) shape.locationName = raw.locationName;
    return shape;
  }
  const type = scalarTypes.includes(raw.type as never)
    ? (raw.type as ScalarShape["type"])
    : "string";
  const shape: ScalarShape = { type };
  const ts = normalizeTimestampFormat(raw.timestampFormat);
  if (ts !== undefined) shape.timestampFormat = ts;
  if (raw.enum !== undefined) shape.enum = raw.enum;
  if (raw.locationName !== undefined) shape.locationName = raw.locationName;
  return shape;
};

export const loadRegistry = (
  rawShapes: Record<string, RawShape> | undefined,
): ShapeRegistry => {
  const shapes: Record<string, Shape> = {};
  for (const [name, raw] of Object.entries(rawShapes ?? {}))
    shapes[name] = normalizeShape(raw);
  return { shapes };
};

const normalizeShapeRef = (
  raw: RawShapeRef | undefined,
): ShapeRef | undefined => {
  if (raw === undefined || raw.shape === undefined) return undefined;
  const ref: ShapeRef = { shape: raw.shape };
  if (raw.resultWrapper !== undefined) ref.resultWrapper = raw.resultWrapper;
  return ref;
};

const normalizeOperation = (
  name: string,
  raw: RawOperation,
): OperationModel => {
  const op: OperationModel = { name: raw.name ?? name };
  if (raw.http !== undefined) op.http = raw.http;
  const input = normalizeShapeRef(raw.input);
  if (input !== undefined) op.input = input;
  const output = normalizeShapeRef(raw.output);
  if (output !== undefined) op.output = output;
  if (raw.errors !== undefined) {
    const errors: ShapeRef[] = [];
    for (const e of raw.errors) {
      const ref = normalizeShapeRef(e);
      if (ref !== undefined) errors.push(ref);
    }
    op.errors = errors;
  }
  return op;
};

export const loadServiceModel = (json: ServiceModelJson): ServiceModel => {
  const operations: Record<string, OperationModel> = {};
  for (const [name, raw] of Object.entries(json.operations ?? {}))
    operations[name] = normalizeOperation(name, raw);
  return {
    metadata: json.metadata ?? {},
    operations,
    registry: loadRegistry(json.shapes),
  };
};

export const getShape = (
  registry: ShapeRegistry,
  name: string,
): Shape | undefined => registry.shapes[name];

export const resolveOperation = (
  model: ServiceModel,
  name: string,
): OperationModel | undefined => model.operations[name];

export const resolveInputShape = (
  model: ServiceModel,
  name: string,
): Shape | undefined => {
  const op = model.operations[name];
  if (op?.input === undefined) return undefined;
  return model.registry.shapes[op.input.shape];
};

export const resolveOutputShape = (
  model: ServiceModel,
  name: string,
): Shape | undefined => {
  const op = model.operations[name];
  if (op?.output === undefined) return undefined;
  return model.registry.shapes[op.output.shape];
};

export const resolveErrorShape = (
  model: ServiceModel,
  operationName: string,
  errorShapeName: string,
): Shape | undefined => {
  const op = model.operations[operationName];
  if (op?.errors === undefined) return undefined;
  const found = op.errors.find((e) => e.shape === errorShapeName);
  if (found === undefined) return undefined;
  return model.registry.shapes[found.shape];
};

export const errorTraitCode = (
  shape: Shape | undefined,
): string | undefined => {
  if (shape === undefined || shape.type !== "structure") return undefined;
  return shape.error?.code;
};
