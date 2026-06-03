import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssmContactsModel from "../../../../test/vendor/aws-models/ssm-contacts.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ssmContactsModel);

const contactPrefix = "contact:" as const;

type StoredContact = {
  ContactArn: string;
  Alias: string;
  DisplayName?: string;
  Type: string;
  Plan: Record<string, unknown>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

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

const contactKey = (alias: string): string => `${contactPrefix}${alias}`;

const contactArn = (ctx: ServiceContext, alias: string): string =>
  `arn:aws:ssm-contacts:${ctx.region}:${ctx.account}:contact/${alias}`;

const aliasFromArn = (arn: string): string => {
  const marker = ":contact/";
  const index = arn.lastIndexOf(marker);
  return index === -1 ? arn : arn.slice(index + marker.length);
};

const contactSummary = (contact: StoredContact): Record<string, unknown> => ({
  ContactArn: contact.ContactArn,
  Alias: contact.Alias,
  DisplayName: contact.DisplayName,
  Type: contact.Type,
});

const CreateContact: OperationHandler = (input, ctx) => {
  const alias = requireString(input, "Alias");
  const type = requireString(input, "Type");
  const plan = asRecord(input["Plan"]);
  if (plan === undefined) {
    throw awsError("ValidationException", "Plan is required.", 400);
  }
  if (ctx.store.get<StoredContact>(contactKey(alias)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Contact ${alias} already exists.`,
      409,
    );
  }
  const arn = contactArn(ctx, alias);
  const contact: StoredContact = {
    ContactArn: arn,
    Alias: alias,
    DisplayName: stringOrUndefined(input["DisplayName"]),
    Type: type,
    Plan: plan,
  };
  ctx.store.set(contactKey(alias), contact);
  return { ContactArn: arn };
};

const GetContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  const contact = ctx.store.get<StoredContact>(contactKey(alias));
  if (contact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {
    ContactArn: contact.ContactArn,
    Alias: contact.Alias,
    DisplayName: contact.DisplayName,
    Type: contact.Type,
    Plan: contact.Plan,
  };
};

const ListContacts: OperationHandler = (input, ctx) => {
  const aliasPrefix = stringOrUndefined(input["AliasPrefix"]);
  const type = stringOrUndefined(input["Type"]);
  const contacts = ctx.store
    .list<StoredContact>()
    .filter((entry) => entry.key.startsWith(contactPrefix))
    .map((entry) => entry.value)
    .filter(
      (contact) =>
        aliasPrefix === undefined || contact.Alias.startsWith(aliasPrefix),
    )
    .filter((contact) => type === undefined || contact.Type === type)
    .sort((a, b) => (a.Alias < b.Alias ? -1 : a.Alias > b.Alias ? 1 : 0));
  return { Contacts: contacts.map(contactSummary) };
};

const DeleteContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  if (ctx.store.get<StoredContact>(contactKey(alias)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.delete(contactKey(alias));
  return {};
};

const ssmContacts = {
  name: "ssm-contacts",
  protocol: "json",
  operations: {
    CreateContact,
    GetContact,
    ListContacts,
    DeleteContact,
  },
  model,
} as const satisfies ServiceDefinition;

export default ssmContacts;
