import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import outpostsModel from "../../models/outposts.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(outpostsModel);

const outpostPrefix = "outpost:" as const;
const sitePrefix = "site:" as const;
const orderPrefix = "order:" as const;
const capacityTaskPrefix = "capacity-task:" as const;
const connectionPrefix = "connection:" as const;
const tagsPrefix = "tags:" as const;

type StoredOutpost = {
  OutpostId: string;
  OwnerId: string;
  OutpostArn: string;
  SiteId: string;
  Name: string;
  Description?: string;
  LifeCycleStatus: string;
  AvailabilityZone?: string;
  AvailabilityZoneId?: string;
  Tags: Record<string, string>;
  SupportedHardwareType?: string;
};

type StoredAddress = {
  ContactName: string;
  ContactPhoneNumber: string;
  AddressLine1: string;
  AddressLine2?: string;
  AddressLine3?: string;
  City: string;
  StateOrRegion: string;
  DistrictOrCounty?: string;
  PostalCode: string;
  CountryCode: string;
  Municipality?: string;
};

type StoredSite = {
  SiteId: string;
  AccountId: string;
  Name: string;
  SiteArn: string;
  Description?: string;
  Notes?: string;
  Tags: Record<string, string>;
  OperatingAddressCountryCode?: string;
  OperatingAddressStateOrRegion?: string;
  OperatingAddressCity?: string;
  RackPhysicalProperties?: Record<string, unknown>;
  ShippingAddress?: StoredAddress;
  OperatingAddress?: StoredAddress;
};

type StoredOrder = {
  OutpostId: string;
  OrderId: string;
  Status: string;
  LineItems: unknown[];
  PaymentOption: string;
  PaymentTerm?: string;
  OrderSubmissionDate: string;
  OrderFulfilledDate?: string;
  OrderType: string;
};

type StoredCapacityTask = {
  CapacityTaskId: string;
  OutpostId: string;
  OrderId?: string;
  AssetId?: string;
  RequestedInstancePools: unknown[];
  InstancesToExclude?: unknown;
  DryRun?: boolean;
  CapacityTaskStatus: string;
  Failed?: unknown;
  CreationDate: string;
  CompletionDate?: string;
  LastModifiedDate: string;
  TaskActionOnBlockingInstances?: string;
};

type StoredConnection = {
  ConnectionId: string;
  UnderlayIpAddress: string;
  ConnectionDetails: {
    ClientPublicKey?: string;
    ServerPublicKey?: string;
    ServerEndpoint?: string;
    ClientTunnelAddress?: string;
    ServerTunnelAddress?: string;
    AllowedIps?: string[];
  };
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const outpostKey = (id: string): string => `${outpostPrefix}${id}`;
const siteKey = (id: string): string => `${sitePrefix}${id}`;
const orderKey = (id: string): string => `${orderPrefix}${id}`;
const capacityTaskKey = (id: string): string => `${capacityTaskPrefix}${id}`;
const connectionKey = (id: string): string => `${connectionPrefix}${id}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const newOutpostId = (): string =>
  `op-${Math.random().toString(16).slice(2, 19).padEnd(17, "0")}`;

const newSiteId = (): string =>
  `os-${Math.random().toString(16).slice(2, 19).padEnd(17, "0")}`;

const newOrderId = (): string =>
  `order-${Math.random().toString(16).slice(2, 18).padEnd(16, "0")}`;

const newCapacityTaskId = (): string =>
  `ct-${Math.random().toString(16).slice(2, 19).padEnd(17, "0")}`;

const newConnectionId = (): string =>
  `cn-${Math.random().toString(16).slice(2, 19).padEnd(17, "0")}`;

const outpostArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:outposts:${ctx.region}:${ctx.account}:outpost/${id}`;

const siteArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:outposts:${ctx.region}:${ctx.account}:site/${id}`;

const nowIso = (): string => new Date().toISOString();

const encodeCursor = (offset: number): string => btoa(String(offset));
const decodeCursor = (token: string): number => {
  const n = Number(atob(token));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; NextToken: string | undefined } => {
  const offset = typeof nextToken === "string" ? decodeCursor(nextToken) : 0;
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : items.length;
  const page = items.slice(offset, offset + max);
  const token =
    offset + max < items.length ? encodeCursor(offset + max) : undefined;
  return { items: page, NextToken: token };
};
const stringArrayFrom = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
};

const resolveOutpost = (
  ctx: ServiceContext,
  identifier: string,
): StoredOutpost | undefined => {
  if (identifier.startsWith("arn:")) {
    return ctx.store
      .list<StoredOutpost>()
      .filter((e) => e.key.startsWith(outpostPrefix))
      .map((e) => e.value)
      .find((o) => o.OutpostArn === identifier);
  }
  return ctx.store.get<StoredOutpost>(outpostKey(identifier));
};

const resolveSite = (
  ctx: ServiceContext,
  identifier: string,
): StoredSite | undefined => {
  if (identifier.startsWith("arn:")) {
    return ctx.store
      .list<StoredSite>()
      .filter((e) => e.key.startsWith(sitePrefix))
      .map((e) => e.value)
      .find((s) => s.SiteArn === identifier);
  }
  return ctx.store.get<StoredSite>(siteKey(identifier));
};

const outpostView = (
  outpost: StoredOutpost,
  tags?: Record<string, string>,
): Record<string, unknown> => ({
  OutpostId: outpost.OutpostId,
  OwnerId: outpost.OwnerId,
  OutpostArn: outpost.OutpostArn,
  SiteId: outpost.SiteId,
  Name: outpost.Name,
  Description: outpost.Description,
  LifeCycleStatus: outpost.LifeCycleStatus,
  AvailabilityZone: outpost.AvailabilityZone,
  AvailabilityZoneId: outpost.AvailabilityZoneId,
  Tags: tags ?? outpost.Tags,
  SupportedHardwareType: outpost.SupportedHardwareType,
});

const siteView = (
  site: StoredSite,
  tags?: Record<string, string>,
): Record<string, unknown> => ({
  SiteId: site.SiteId,
  AccountId: site.AccountId,
  Name: site.Name,
  SiteArn: site.SiteArn,
  Description: site.Description,
  Notes: site.Notes,
  Tags: tags ?? site.Tags,
  OperatingAddressCountryCode: site.OperatingAddressCountryCode,
  OperatingAddressStateOrRegion: site.OperatingAddressStateOrRegion,
  OperatingAddressCity: site.OperatingAddressCity,
  RackPhysicalProperties: site.RackPhysicalProperties,
});

const orderView = (order: StoredOrder): Record<string, unknown> => ({
  OutpostId: order.OutpostId,
  OrderId: order.OrderId,
  Status: order.Status,
  LineItems: order.LineItems,
  PaymentOption: order.PaymentOption,
  PaymentTerm: order.PaymentTerm,
  OrderSubmissionDate: order.OrderSubmissionDate,
  OrderFulfilledDate: order.OrderFulfilledDate,
  OrderType: order.OrderType,
});

const orderSummaryView = (order: StoredOrder): Record<string, unknown> => ({
  OutpostId: order.OutpostId,
  OrderId: order.OrderId,
  OrderType: order.OrderType,
  Status: order.Status,
  LineItemCountsByStatus: {},
  OrderSubmissionDate: order.OrderSubmissionDate,
  OrderFulfilledDate: order.OrderFulfilledDate,
});

const capacityTaskView = (
  task: StoredCapacityTask,
): Record<string, unknown> => ({
  CapacityTaskId: task.CapacityTaskId,
  OutpostId: task.OutpostId,
  OrderId: task.OrderId,
  AssetId: task.AssetId,
  RequestedInstancePools: task.RequestedInstancePools,
  InstancesToExclude: task.InstancesToExclude,
  DryRun: task.DryRun,
  CapacityTaskStatus: task.CapacityTaskStatus,
  Failed: task.Failed,
  CreationDate: task.CreationDate,
  CompletionDate: task.CompletionDate,
  LastModifiedDate: task.LastModifiedDate,
  TaskActionOnBlockingInstances: task.TaskActionOnBlockingInstances,
});

const capacityTaskSummaryView = (
  task: StoredCapacityTask,
): Record<string, unknown> => ({
  CapacityTaskId: task.CapacityTaskId,
  OutpostId: task.OutpostId,
  OrderId: task.OrderId,
  AssetId: task.AssetId,
  CapacityTaskStatus: task.CapacityTaskStatus,
  CreationDate: task.CreationDate,
  CompletionDate: task.CompletionDate,
  LastModifiedDate: task.LastModifiedDate,
});

const asAddress = (value: unknown): StoredAddress | undefined => {
  const r = asRecord(value);
  if (r === undefined) return undefined;
  const line1 = stringOrUndefined(r["AddressLine1"]);
  const city = stringOrUndefined(r["City"]);
  const state = stringOrUndefined(r["StateOrRegion"]);
  const postal = stringOrUndefined(r["PostalCode"]);
  const country = stringOrUndefined(r["CountryCode"]);
  const contact = stringOrUndefined(r["ContactName"]);
  const phone = stringOrUndefined(r["ContactPhoneNumber"]);
  if (!line1 || !city || !state || !postal || !country || !contact || !phone) {
    return undefined;
  }
  return {
    ContactName: contact,
    ContactPhoneNumber: phone,
    AddressLine1: line1,
    AddressLine2: stringOrUndefined(r["AddressLine2"]),
    AddressLine3: stringOrUndefined(r["AddressLine3"]),
    City: city,
    StateOrRegion: state,
    DistrictOrCounty: stringOrUndefined(r["DistrictOrCounty"]),
    PostalCode: postal,
    CountryCode: country,
    Municipality: stringOrUndefined(r["Municipality"]),
  };
};

const STATIC_CATALOG_ITEMS = [
  {
    CatalogItemId: "OR-PRD-GFQKQT6SFSP",
    ItemStatus: "AVAILABLE",
    EC2Capacities: [{ Family: "m5", MaxSize: "xlarge", Quantity: "2" }],
    PowerKva: 5.0,
    WeightLbs: 200,
    SupportedUplinkGbps: [10],
    SupportedStorage: ["EBS"],
  },
] as const;

const STATIC_INSTANCE_TYPES = [
  { InstanceType: "m5.xlarge", VCPUs: 4 },
  { InstanceType: "m5.2xlarge", VCPUs: 8 },
] as const;

const getTags = (ctx: ServiceContext, arn: string): Record<string, string> =>
  ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};

const CreateOutpost: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const siteId = requireString(input, "SiteId");
  const id = newOutpostId();
  const outpost: StoredOutpost = {
    OutpostId: id,
    OwnerId: ctx.account,
    OutpostArn: outpostArn(ctx, id),
    SiteId: siteId,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    LifeCycleStatus: "ACTIVE",
    AvailabilityZone: stringOrUndefined(input["AvailabilityZone"]),
    AvailabilityZoneId: stringOrUndefined(input["AvailabilityZoneId"]),
    Tags: stringMapFrom(input["Tags"]),
    SupportedHardwareType: stringOrUndefined(input["SupportedHardwareType"]),
  };
  ctx.store.set(outpostKey(id), outpost);
  ctx.store.set(tagsKey(outpost.OutpostArn), outpost.Tags);
  return { Outpost: outpostView(outpost) };
};

const GetOutpost: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostId");
  const outpost = resolveOutpost(ctx, id);
  if (outpost === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  return { Outpost: outpostView(outpost, getTags(ctx, outpost.OutpostArn)) };
};

const ListOutposts: OperationHandler = (input, ctx) => {
  const lcFilter = stringArrayFrom(input["LifeCycleStatusFilter"]);
  const azFilter = stringArrayFrom(input["AvailabilityZoneFilter"]);
  const azIdFilter = stringArrayFrom(input["AvailabilityZoneIdFilter"]);
  let outposts = ctx.store
    .list<StoredOutpost>()
    .filter((entry) => entry.key.startsWith(outpostPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.OutpostId < b.OutpostId ? -1 : a.OutpostId > b.OutpostId ? 1 : 0,
    );
  if (lcFilter.length > 0)
    outposts = outposts.filter((o) => lcFilter.includes(o.LifeCycleStatus));
  if (azFilter.length > 0)
    outposts = outposts.filter(
      (o) =>
        o.AvailabilityZone !== undefined &&
        azFilter.includes(o.AvailabilityZone),
    );
  if (azIdFilter.length > 0)
    outposts = outposts.filter(
      (o) =>
        o.AvailabilityZoneId !== undefined &&
        azIdFilter.includes(o.AvailabilityZoneId),
    );
  const { items, NextToken } = paginate(
    outposts,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    Outposts: items.map((o) => outpostView(o, getTags(ctx, o.OutpostArn))),
    NextToken,
  };
};

const DeleteOutpost: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostId");
  const outpost = resolveOutpost(ctx, id);
  if (outpost === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  ctx.store.delete(tagsKey(outpost.OutpostArn));
  ctx.store.delete(outpostKey(id));
  return {};
};

const UpdateOutpost: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostId");
  const outpost = resolveOutpost(ctx, id);
  if (outpost === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  const updated: StoredOutpost = {
    ...outpost,
    Name: stringOrUndefined(input["Name"]) ?? outpost.Name,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : outpost.Description,
    SupportedHardwareType:
      input["SupportedHardwareType"] !== undefined
        ? stringOrUndefined(input["SupportedHardwareType"])
        : outpost.SupportedHardwareType,
  };
  ctx.store.set(outpostKey(outpost.OutpostId), updated);
  return { Outpost: outpostView(updated, getTags(ctx, updated.OutpostArn)) };
};

const CreateSite: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = newSiteId();
  const rackProps = asRecord(input["RackPhysicalProperties"]);
  const site: StoredSite = {
    SiteId: id,
    AccountId: ctx.account,
    Name: name,
    SiteArn: siteArn(ctx, id),
    Description: stringOrUndefined(input["Description"]),
    Notes: stringOrUndefined(input["Notes"]),
    Tags: stringMapFrom(input["Tags"]),
    RackPhysicalProperties: rackProps,
    ShippingAddress: asAddress(input["ShippingAddress"]),
    OperatingAddress: asAddress(input["OperatingAddress"]),
  };
  if (site.OperatingAddress !== undefined) {
    site.OperatingAddressCity = site.OperatingAddress.City;
    site.OperatingAddressStateOrRegion = site.OperatingAddress.StateOrRegion;
    site.OperatingAddressCountryCode = site.OperatingAddress.CountryCode;
  }
  ctx.store.set(siteKey(id), site);
  ctx.store.set(tagsKey(site.SiteArn), site.Tags);
  return { Site: siteView(site) };
};

const GetSite: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SiteId");
  const site = resolveSite(ctx, id);
  if (site === undefined) {
    throw awsError("NotFoundException", `Site ${id} not found.`, 404);
  }
  return { Site: siteView(site, getTags(ctx, site.SiteArn)) };
};

const UpdateSite: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SiteId");
  const site = resolveSite(ctx, id);
  if (site === undefined) {
    throw awsError("NotFoundException", `Site ${id} not found.`, 404);
  }
  const updated: StoredSite = {
    ...site,
    Name: stringOrUndefined(input["Name"]) ?? site.Name,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : site.Description,
    Notes:
      input["Notes"] !== undefined
        ? stringOrUndefined(input["Notes"])
        : site.Notes,
  };
  ctx.store.set(siteKey(site.SiteId), updated);
  return { Site: siteView(updated, getTags(ctx, updated.SiteArn)) };
};

const DeleteSite: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SiteId");
  const site = resolveSite(ctx, id);
  if (site === undefined) {
    throw awsError("NotFoundException", `Site ${id} not found.`, 404);
  }
  ctx.store.delete(tagsKey(site.SiteArn));
  ctx.store.delete(siteKey(id));
  return {};
};

const ListSites: OperationHandler = (input, ctx) => {
  const countryFilter = stringArrayFrom(
    input["OperatingAddressCountryCodeFilter"],
  );
  const stateFilter = stringArrayFrom(
    input["OperatingAddressStateOrRegionFilter"],
  );
  const cityFilter = stringArrayFrom(input["OperatingAddressCityFilter"]);
  let sites = ctx.store
    .list<StoredSite>()
    .filter((e) => e.key.startsWith(sitePrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.SiteId < b.SiteId ? -1 : a.SiteId > b.SiteId ? 1 : 0));
  if (countryFilter.length > 0)
    sites = sites.filter(
      (s) =>
        s.OperatingAddressCountryCode !== undefined &&
        countryFilter.includes(s.OperatingAddressCountryCode),
    );
  if (stateFilter.length > 0)
    sites = sites.filter(
      (s) =>
        s.OperatingAddressStateOrRegion !== undefined &&
        stateFilter.includes(s.OperatingAddressStateOrRegion),
    );
  if (cityFilter.length > 0)
    sites = sites.filter(
      (s) =>
        s.OperatingAddressCity !== undefined &&
        cityFilter.includes(s.OperatingAddressCity),
    );
  const { items, NextToken } = paginate(
    sites,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    Sites: items.map((s) => siteView(s, getTags(ctx, s.SiteArn))),
    NextToken,
  };
};

const GetSiteAddress: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SiteId");
  const site = resolveSite(ctx, id);
  if (site === undefined) {
    throw awsError("NotFoundException", `Site ${id} not found.`, 404);
  }
  const addressType =
    stringOrUndefined(input["AddressType"]) ?? "OPERATING_ADDRESS";
  const address =
    addressType === "SHIPPING_ADDRESS"
      ? site.ShippingAddress
      : site.OperatingAddress;
  if (address === undefined) {
    throw awsError(
      "NotFoundException",
      `Address of type ${addressType} not found for site ${id}.`,
      404,
    );
  }
  return { SiteId: site.SiteId, AddressType: addressType, Address: address };
};

const UpdateSiteAddress: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SiteId");
  const site = resolveSite(ctx, id);
  if (site === undefined) {
    throw awsError("NotFoundException", `Site ${id} not found.`, 404);
  }
  const addressType = requireString(input, "AddressType");
  const address = asAddress(input["Address"]);
  if (address === undefined) {
    throw awsError("ValidationException", "Address is required.", 400);
  }
  const updated: StoredSite = { ...site };
  if (addressType === "SHIPPING_ADDRESS") {
    updated.ShippingAddress = address;
  } else {
    updated.OperatingAddress = address;
    updated.OperatingAddressCity = address.City;
    updated.OperatingAddressStateOrRegion = address.StateOrRegion;
    updated.OperatingAddressCountryCode = address.CountryCode;
  }
  ctx.store.set(siteKey(site.SiteId), updated);
  return { AddressType: addressType, Address: address };
};

const UpdateSiteRackPhysicalProperties: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SiteId");
  const site = resolveSite(ctx, id);
  if (site === undefined) {
    throw awsError("NotFoundException", `Site ${id} not found.`, 404);
  }
  const fields = [
    "PowerDrawKva",
    "PowerPhase",
    "PowerConnector",
    "PowerFeedDrop",
    "UplinkGbps",
    "UplinkCount",
    "FiberOpticCableType",
    "OpticalStandard",
    "MaximumSupportedWeightLbs",
  ] as const;
  const existing = site.RackPhysicalProperties ?? {};
  const rack: Record<string, unknown> = { ...existing };
  for (const f of fields) {
    if (input[f] !== undefined) rack[f] = input[f];
  }
  const updated: StoredSite = { ...site, RackPhysicalProperties: rack };
  ctx.store.set(siteKey(site.SiteId), updated);
  return { Site: siteView(updated, getTags(ctx, updated.SiteArn)) };
};

const CreateOrder: OperationHandler = (input, ctx) => {
  const outpostIdentifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, outpostIdentifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${outpostIdentifier} not found.`,
      404,
    );
  }
  const paymentOption = requireString(input, "PaymentOption");
  const id = newOrderId();
  const lineItems = Array.isArray(input["LineItems"]) ? input["LineItems"] : [];
  const order: StoredOrder = {
    OutpostId: outpost.OutpostId,
    OrderId: id,
    Status: "RECEIVED",
    LineItems: lineItems.map((li: unknown) => {
      const r = asRecord(li);
      return {
        CatalogItemId: r ? stringOrUndefined(r["CatalogItemId"]) : undefined,
        LineItemId: `li-${Math.random().toString(16).slice(2, 10)}`,
        Quantity: r ? r["Quantity"] : undefined,
        Status: "PREPARING",
      };
    }),
    PaymentOption: paymentOption,
    PaymentTerm: stringOrUndefined(input["PaymentTerm"]),
    OrderSubmissionDate: nowIso(),
    OrderType: "OUTPOST",
  };
  ctx.store.set(orderKey(id), order);
  return { Order: orderView(order) };
};

const GetOrder: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OrderId");
  const order = ctx.store.get<StoredOrder>(orderKey(id));
  if (order === undefined) {
    throw awsError("NotFoundException", `Order ${id} not found.`, 404);
  }
  return { Order: orderView(order) };
};

const CancelOrder: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OrderId");
  const order = ctx.store.get<StoredOrder>(orderKey(id));
  if (order === undefined) {
    throw awsError("NotFoundException", `Order ${id} not found.`, 404);
  }
  ctx.store.set(orderKey(id), { ...order, Status: "CANCELLED" });
  return {};
};

const ListOrders: OperationHandler = (input, ctx) => {
  const outpostFilter = stringOrUndefined(input["OutpostIdentifierFilter"]);
  const outpostIdFilter =
    outpostFilter !== undefined
      ? resolveOutpost(ctx, outpostFilter)?.OutpostId
      : undefined;
  let orders = ctx.store
    .list<StoredOrder>()
    .filter((e) => e.key.startsWith(orderPrefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.OrderId < b.OrderId ? -1 : a.OrderId > b.OrderId ? 1 : 0,
    );
  if (outpostIdFilter !== undefined)
    orders = orders.filter((o) => o.OutpostId === outpostIdFilter);
  const { items, NextToken } = paginate(
    orders,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Orders: items.map(orderSummaryView), NextToken };
};

const CreateRenewal: OperationHandler = (input, ctx) => {
  const outpostIdentifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, outpostIdentifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${outpostIdentifier} not found.`,
      404,
    );
  }
  const paymentOption =
    stringOrUndefined(input["PaymentOption"]) ?? "NO_UPFRONT";
  const paymentTerm = stringOrUndefined(input["PaymentTerm"]) ?? "ONE_YEAR";
  return {
    PaymentOption: paymentOption,
    PaymentTerm: paymentTerm,
    OutpostId: outpost.OutpostId,
    UpfrontPrice: 0.0,
    MonthlyRecurringPrice: 0.0,
  };
};

const StartCapacityTask: OperationHandler = (input, ctx) => {
  const outpostIdentifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, outpostIdentifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${outpostIdentifier} not found.`,
      404,
    );
  }
  const instancePools = Array.isArray(input["InstancePools"])
    ? input["InstancePools"]
    : [];
  const id = newCapacityTaskId();
  const now = nowIso();
  const task: StoredCapacityTask = {
    CapacityTaskId: id,
    OutpostId: outpost.OutpostId,
    OrderId: stringOrUndefined(input["OrderId"]),
    AssetId: stringOrUndefined(input["AssetId"]),
    RequestedInstancePools: instancePools,
    InstancesToExclude: input["InstancesToExclude"],
    DryRun: input["DryRun"] === true,
    CapacityTaskStatus: "COMPLETED",
    CreationDate: now,
    CompletionDate: now,
    LastModifiedDate: now,
    TaskActionOnBlockingInstances: stringOrUndefined(
      input["TaskActionOnBlockingInstances"],
    ),
  };
  ctx.store.set(capacityTaskKey(id), task);
  return capacityTaskView(task);
};

const GetCapacityTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "CapacityTaskId");
  const task = ctx.store.get<StoredCapacityTask>(capacityTaskKey(taskId));
  if (task === undefined) {
    throw awsError(
      "NotFoundException",
      `Capacity task ${taskId} not found.`,
      404,
    );
  }
  return capacityTaskView(task);
};

const CancelCapacityTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "CapacityTaskId");
  const task = ctx.store.get<StoredCapacityTask>(capacityTaskKey(taskId));
  if (task === undefined) {
    throw awsError(
      "NotFoundException",
      `Capacity task ${taskId} not found.`,
      404,
    );
  }
  ctx.store.set(capacityTaskKey(taskId), {
    ...task,
    CapacityTaskStatus: "CANCELLED",
    CompletionDate: nowIso(),
    LastModifiedDate: nowIso(),
  });
  return {};
};

const ListCapacityTasks: OperationHandler = (input, ctx) => {
  const outpostFilter = stringOrUndefined(input["OutpostIdentifierFilter"]);
  const outpostIdFilter =
    outpostFilter !== undefined
      ? resolveOutpost(ctx, outpostFilter)?.OutpostId
      : undefined;
  const statusFilter = stringArrayFrom(input["CapacityTaskStatusFilter"]);
  let tasks = ctx.store
    .list<StoredCapacityTask>()
    .filter((e) => e.key.startsWith(capacityTaskPrefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.CapacityTaskId < b.CapacityTaskId
        ? -1
        : a.CapacityTaskId > b.CapacityTaskId
          ? 1
          : 0,
    );
  if (outpostIdFilter !== undefined)
    tasks = tasks.filter((t) => t.OutpostId === outpostIdFilter);
  if (statusFilter.length > 0)
    tasks = tasks.filter((t) => statusFilter.includes(t.CapacityTaskStatus));
  const { items, NextToken } = paginate(
    tasks,
    input["MaxResults"],
    input["NextToken"],
  );
  return { CapacityTasks: items.map(capacityTaskSummaryView), NextToken };
};

const ListBlockingInstancesForCapacityTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "CapacityTaskId");
  const task = ctx.store.get<StoredCapacityTask>(capacityTaskKey(taskId));
  if (task === undefined) {
    throw awsError(
      "NotFoundException",
      `Capacity task ${taskId} not found.`,
      404,
    );
  }
  return { BlockingInstances: [] };
};

const GetCatalogItem: OperationHandler = (input, _ctx) => {
  const itemId = requireString(input, "CatalogItemId");
  const item = STATIC_CATALOG_ITEMS.find((i) => i.CatalogItemId === itemId);
  if (item === undefined) {
    throw awsError(
      "NotFoundException",
      `Catalog item ${itemId} not found.`,
      404,
    );
  }
  return { CatalogItem: item };
};

const ListCatalogItems: OperationHandler = (_input, _ctx) => {
  return { CatalogItems: [...STATIC_CATALOG_ITEMS] };
};

const GetOutpostInstanceTypes: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostId");
  const outpost = resolveOutpost(ctx, id);
  if (outpost === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  return {
    InstanceTypes: [...STATIC_INSTANCE_TYPES],
    OutpostId: outpost.OutpostId,
    OutpostArn: outpost.OutpostArn,
  };
};

const GetOutpostSupportedInstanceTypes: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, id);
  if (outpost === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  return { InstanceTypes: [...STATIC_INSTANCE_TYPES] };
};

const GetOutpostBillingInformation: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, identifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${identifier} not found.`,
      404,
    );
  }
  return {
    Subscriptions: [],
    ContractEndDate: "",
    PaymentTerm: "ONE_YEAR",
    PaymentOption: "NO_UPFRONT",
  };
};

const GetRenewalPricing: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, identifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${identifier} not found.`,
      404,
    );
  }
  return {
    PricingResult: "PRICED",
    PricingOptions: [
      {
        PricingType: "SUBSCRIPTION",
        SubscriptionPricingDetails: {
          PaymentOption: "NO_UPFRONT",
          PaymentTerm: "ONE_YEAR",
          UpfrontPrice: 0.0,
          MonthlyRecurringPrice: 0.0,
        },
      },
    ],
  };
};

const ListAssets: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, identifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${identifier} not found.`,
      404,
    );
  }
  return { Assets: [] };
};

const ListAssetInstances: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, identifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${identifier} not found.`,
      404,
    );
  }
  return { AssetInstances: [] };
};

const StartConnection: OperationHandler = (input, ctx) => {
  const id = newConnectionId();
  const conn: StoredConnection = {
    ConnectionId: id,
    UnderlayIpAddress: "10.0.0.1",
    ConnectionDetails: {
      ClientPublicKey: stringOrUndefined(input["ClientPublicKey"]),
      ServerPublicKey: "server-pub-key-placeholder",
      ServerEndpoint: "10.0.0.1:51820",
      ClientTunnelAddress: "192.168.100.2/32",
      ServerTunnelAddress: "192.168.100.1/32",
      AllowedIps: ["0.0.0.0/0"],
    },
  };
  ctx.store.set(connectionKey(id), conn);
  return {
    ConnectionId: conn.ConnectionId,
    UnderlayIpAddress: conn.UnderlayIpAddress,
  };
};

const GetConnection: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ConnectionId");
  const conn = ctx.store.get<StoredConnection>(connectionKey(id));
  if (conn === undefined) {
    throw awsError("NotFoundException", `Connection ${id} not found.`, 404);
  }
  return {
    ConnectionId: conn.ConnectionId,
    ConnectionDetails: conn.ConnectionDetails,
  };
};

const StartOutpostDecommission: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "OutpostIdentifier");
  const outpost = resolveOutpost(ctx, identifier);
  if (outpost === undefined) {
    throw awsError(
      "NotFoundException",
      `Outpost ${identifier} not found.`,
      404,
    );
  }
  return { Status: "REQUESTED", BlockingResourceTypes: [] };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = stringMapFrom(input["Tags"]);
  const existing = getTags(ctx, arn);
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const keyList = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const existing = getTags(ctx, arn);
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!keyList.includes(k)) updated[k] = v;
  }
  ctx.store.set(tagsKey(arn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const outposts = {
  name: "outposts",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0) return undefined;

    switch (parts[0]) {
      case "outposts": {
        if (parts.length === 1) {
          if (req.method === "POST") return "CreateOutpost";
          if (req.method === "GET") return "ListOutposts";
          return undefined;
        }
        if (parts.length === 2) {
          if (req.method === "GET") return "GetOutpost";
          if (req.method === "DELETE") return "DeleteOutpost";
          if (req.method === "PATCH") return "UpdateOutpost";
          return undefined;
        }
        if (parts.length === 3) {
          switch (parts[2]) {
            case "capacity":
              if (req.method === "POST") return "StartCapacityTask";
              return undefined;
            case "instanceTypes":
              if (req.method === "GET") return "GetOutpostInstanceTypes";
              return undefined;
            case "supportedInstanceTypes":
              if (req.method === "GET")
                return "GetOutpostSupportedInstanceTypes";
              return undefined;
            case "assets":
              if (req.method === "GET") return "ListAssets";
              return undefined;
            case "assetInstances":
              if (req.method === "GET") return "ListAssetInstances";
              return undefined;
            case "decommission":
              if (req.method === "POST") return "StartOutpostDecommission";
              return undefined;
            default:
              return undefined;
          }
        }
        if (parts.length === 4 && parts[2] === "capacity") {
          if (req.method === "GET") return "GetCapacityTask";
          if (req.method === "POST") return "CancelCapacityTask";
          return undefined;
        }
        if (
          parts.length === 5 &&
          parts[2] === "capacity" &&
          parts[4] === "blockingInstances"
        ) {
          if (req.method === "GET")
            return "ListBlockingInstancesForCapacityTask";
          return undefined;
        }
        return undefined;
      }

      case "outpost": {
        if (parts.length === 3) {
          if (parts[2] === "billing-information" && req.method === "GET") {
            return "GetOutpostBillingInformation";
          }
          if (parts[2] === "renewal-pricing" && req.method === "GET") {
            return "GetRenewalPricing";
          }
        }
        return undefined;
      }

      case "orders": {
        if (parts.length === 1 && req.method === "POST") return "CreateOrder";
        if (parts.length === 2 && req.method === "GET") return "GetOrder";
        if (
          parts.length === 3 &&
          parts[2] === "cancel" &&
          req.method === "POST"
        ) {
          return "CancelOrder";
        }
        return undefined;
      }

      case "list-orders": {
        if (parts.length === 1 && req.method === "GET") return "ListOrders";
        return undefined;
      }

      case "sites": {
        if (parts.length === 1) {
          if (req.method === "GET") return "ListSites";
          if (req.method === "POST") return "CreateSite";
          return undefined;
        }
        if (parts.length === 2) {
          if (req.method === "GET") return "GetSite";
          if (req.method === "PATCH") return "UpdateSite";
          if (req.method === "DELETE") return "DeleteSite";
          return undefined;
        }
        if (parts.length === 3) {
          if (parts[2] === "address") {
            if (req.method === "GET") return "GetSiteAddress";
            if (req.method === "PUT") return "UpdateSiteAddress";
          }
          if (parts[2] === "rackPhysicalProperties" && req.method === "PATCH") {
            return "UpdateSiteRackPhysicalProperties";
          }
        }
        return undefined;
      }

      case "capacity": {
        if (
          parts.length === 2 &&
          parts[1] === "tasks" &&
          req.method === "GET"
        ) {
          return "ListCapacityTasks";
        }
        return undefined;
      }

      case "catalog": {
        if (
          parts.length === 2 &&
          parts[1] === "items" &&
          req.method === "GET"
        ) {
          return "ListCatalogItems";
        }
        if (parts.length === 3 && parts[1] === "item" && req.method === "GET") {
          return "GetCatalogItem";
        }
        return undefined;
      }

      case "connections": {
        if (parts.length === 1 && req.method === "POST")
          return "StartConnection";
        if (parts.length === 2 && req.method === "GET") return "GetConnection";
        return undefined;
      }

      case "renewals": {
        if (parts.length === 1 && req.method === "POST") return "CreateRenewal";
        return undefined;
      }

      case "tags": {
        if (parts.length >= 2) {
          if (req.method === "GET") return "ListTagsForResource";
          if (req.method === "POST") return "TagResource";
          if (req.method === "DELETE") return "UntagResource";
        }
        return undefined;
      }

      default:
        return undefined;
    }
  },
  operations: {
    CancelCapacityTask,
    CancelOrder,
    CreateOrder,
    CreateOutpost,
    CreateRenewal,
    CreateSite,
    DeleteOutpost,
    DeleteSite,
    GetCapacityTask,
    GetCatalogItem,
    GetConnection,
    GetOrder,
    GetOutpost,
    GetOutpostBillingInformation,
    GetOutpostInstanceTypes,
    GetOutpostSupportedInstanceTypes,
    GetRenewalPricing,
    GetSite,
    GetSiteAddress,
    ListAssetInstances,
    ListAssets,
    ListBlockingInstancesForCapacityTask,
    ListCapacityTasks,
    ListCatalogItems,
    ListOrders,
    ListOutposts,
    ListSites,
    ListTagsForResource,
    StartCapacityTask,
    StartConnection,
    StartOutpostDecommission,
    TagResource,
    UntagResource,
    UpdateOutpost,
    UpdateSite,
    UpdateSiteAddress,
    UpdateSiteRackPhysicalProperties,
  },
  model,
} as const satisfies ServiceDefinition;

export default outposts;
