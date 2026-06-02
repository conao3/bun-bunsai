import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import sesModel from "../../../../test/vendor/aws-models/ses.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(sesModel);

type StoredIdentity = {
  Identity: string;
  IdentityType: string;
  VerificationStatus: string;
  VerificationToken: string;
};

const identityKey = (identity: string): string => `identity/${identity}`;

const identityTypeOf = (identity: string): string =>
  identity.includes("@") ? "EmailAddress" : "Domain";

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterValue", `${key} is required.`, 400);
  }
  return value;
};

const stringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const putIdentity = (ctx: ServiceContext, identity: string): StoredIdentity => {
  const existing = ctx.store.get<StoredIdentity>(identityKey(identity));
  if (existing !== undefined) {
    return existing;
  }
  const stored: StoredIdentity = {
    Identity: identity,
    IdentityType: identityTypeOf(identity),
    VerificationStatus: "Success",
    VerificationToken: crypto.randomUUID().replaceAll("-", ""),
  };
  ctx.store.set(identityKey(identity), stored);
  return stored;
};

const VerifyEmailIdentity: OperationHandler = (input, ctx) => {
  const emailAddress = requireString(input, "EmailAddress");
  putIdentity(ctx, emailAddress);
  return {};
};

const ListIdentities: OperationHandler = (input, ctx) => {
  const filterType =
    typeof input["IdentityType"] === "string"
      ? (input["IdentityType"] as string)
      : undefined;
  const identities = ctx.store
    .list<StoredIdentity>()
    .filter((entry) => entry.key.startsWith("identity/"))
    .filter(
      (entry) =>
        filterType === undefined || entry.value.IdentityType === filterType,
    )
    .map((entry) => entry.value.Identity);
  return { Identities: identities };
};

const DeleteIdentity: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  ctx.store.delete(identityKey(identity));
  return {};
};

const SendEmail: OperationHandler = (input, ctx) => {
  const source = requireString(input, "Source");
  const destination = input["Destination"];
  if (typeof destination !== "object" || destination === null) {
    throw awsError("InvalidParameterValue", "Destination is required.", 400);
  }
  const dest = destination as Record<string, unknown>;
  const recipients = [
    ...stringList(dest["ToAddresses"]),
    ...stringList(dest["CcAddresses"]),
    ...stringList(dest["BccAddresses"]),
  ];
  if (recipients.length === 0) {
    throw awsError(
      "InvalidParameterValue",
      "Destination must contain at least one recipient.",
      400,
    );
  }
  const stored = ctx.store.get<StoredIdentity>(identityKey(source));
  if (stored === undefined) {
    throw awsError(
      "MessageRejected",
      `Email address is not verified. The following identities failed the check in region ${ctx.region}: ${source}`,
      400,
    );
  }
  return { MessageId: crypto.randomUUID() };
};

const SendRawEmail: OperationHandler = (input, ctx) => {
  const rawMessage = input["RawMessage"];
  if (typeof rawMessage !== "object" || rawMessage === null) {
    throw awsError("InvalidParameterValue", "RawMessage is required.", 400);
  }
  const data = (rawMessage as Record<string, unknown>)["Data"];
  if (data === undefined || data === null) {
    throw awsError(
      "InvalidParameterValue",
      "RawMessage.Data is required.",
      400,
    );
  }
  const source = input["Source"];
  if (typeof source === "string" && source !== "") {
    const stored = ctx.store.get<StoredIdentity>(identityKey(source));
    if (stored === undefined) {
      throw awsError(
        "MessageRejected",
        `Email address is not verified. The following identities failed the check in region ${ctx.region}: ${source}`,
        400,
      );
    }
  }
  return { MessageId: crypto.randomUUID() };
};

const GetSendQuota: OperationHandler = () => {
  return {
    Max24HourSend: 200,
    MaxSendRate: 1,
    SentLast24Hours: 0,
  };
};

const GetIdentityVerificationAttributes: OperationHandler = (input, ctx) => {
  const identities = stringList(input["Identities"]);
  const attributes: Record<
    string,
    { VerificationStatus: string; VerificationToken?: string }
  > = {};
  for (const identity of identities) {
    const stored = ctx.store.get<StoredIdentity>(identityKey(identity));
    if (stored === undefined) {
      continue;
    }
    attributes[identity] =
      stored.IdentityType === "Domain"
        ? {
            VerificationStatus: stored.VerificationStatus,
            VerificationToken: stored.VerificationToken,
          }
        : { VerificationStatus: stored.VerificationStatus };
  }
  return { VerificationAttributes: attributes };
};

const ses = {
  name: "ses",
  protocol: "query",
  operations: {
    VerifyEmailIdentity,
    ListIdentities,
    DeleteIdentity,
    SendEmail,
    SendRawEmail,
    GetSendQuota,
    GetIdentityVerificationAttributes,
  },
  model,
} as const satisfies ServiceDefinition;

export default ses;
