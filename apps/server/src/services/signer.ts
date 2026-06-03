import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import signerModel from "../../../../test/vendor/aws-models/signer.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(signerModel);

const profilePrefix = "profile:" as const;

type StoredProfile = {
  profileName: string;
  profileVersion: string;
  profileVersionArn: string;
  arn: string;
  platformId: string;
  platformDisplayName: string | undefined;
  signingMaterial: Record<string, unknown> | undefined;
  signatureValidityPeriod: Record<string, unknown> | undefined;
  overrides: Record<string, unknown> | undefined;
  signingParameters: Record<string, unknown> | undefined;
  status: string;
  tags: Record<string, unknown> | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
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

const profileKey = (name: string): string => `${profilePrefix}${name}`;

const profileArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:signer:${ctx.region}:${ctx.account}:/signing-profiles/${name}`;

const profileView = (profile: StoredProfile): Record<string, unknown> => ({
  profileName: profile.profileName,
  profileVersion: profile.profileVersion,
  profileVersionArn: profile.profileVersionArn,
  arn: profile.arn,
  platformId: profile.platformId,
  platformDisplayName: profile.platformDisplayName,
  signingMaterial: profile.signingMaterial,
  signatureValidityPeriod: profile.signatureValidityPeriod,
  overrides: profile.overrides,
  signingParameters: profile.signingParameters,
  status: profile.status,
  tags: profile.tags,
});

const profileSummary = (profile: StoredProfile): Record<string, unknown> => ({
  profileName: profile.profileName,
  profileVersion: profile.profileVersion,
  profileVersionArn: profile.profileVersionArn,
  arn: profile.arn,
  platformId: profile.platformId,
  platformDisplayName: profile.platformDisplayName,
  signingMaterial: profile.signingMaterial,
  signatureValidityPeriod: profile.signatureValidityPeriod,
  signingParameters: profile.signingParameters,
  status: profile.status,
  tags: profile.tags,
});

const requireProfile = (ctx: ServiceContext, name: string): StoredProfile => {
  const profile = ctx.store.get<StoredProfile>(profileKey(name));
  if (profile === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Signing profile ${name} not found.`,
      404,
    );
  }
  return profile;
};

const PutSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  const platformId = requireString(input, "platformId");
  const version = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const arn = profileArn(ctx, name);
  const profileVersionArn = `${arn}/${version}`;
  const profile: StoredProfile = {
    profileName: name,
    profileVersion: version,
    profileVersionArn,
    arn,
    platformId,
    platformDisplayName: stringOrUndefined(input["platformDisplayName"]),
    signingMaterial: recordOrUndefined(input["signingMaterial"]),
    signatureValidityPeriod: recordOrUndefined(
      input["signatureValidityPeriod"],
    ),
    overrides: recordOrUndefined(input["overrides"]),
    signingParameters: recordOrUndefined(input["signingParameters"]),
    status: "Active",
    tags: recordOrUndefined(input["tags"]),
  };
  ctx.store.set(profileKey(name), profile);
  return {
    arn,
    profileVersion: version,
    profileVersionArn,
  };
};

const GetSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  return profileView(requireProfile(ctx, name));
};

const ListSigningProfiles: OperationHandler = (input, ctx) => {
  const includeCanceled = input["includeCanceled"] === true;
  const platformId = stringOrUndefined(input["platformId"]);
  const profiles = ctx.store
    .list<StoredProfile>()
    .filter((entry) => entry.key.startsWith(profilePrefix))
    .map((entry) => entry.value)
    .filter((profile) => includeCanceled || profile.status !== "Canceled")
    .filter(
      (profile) =>
        platformId === undefined || profile.platformId === platformId,
    )
    .sort((a, b) =>
      a.profileName < b.profileName
        ? -1
        : a.profileName > b.profileName
          ? 1
          : 0,
    );
  return { profiles: profiles.map(profileSummary) };
};

const CancelSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  const profile = requireProfile(ctx, name);
  ctx.store.set(profileKey(name), { ...profile, status: "Canceled" });
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const signer = {
  name: "signer",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "signing-profiles") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListSigningProfiles";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "PutSigningProfile";
        if (req.method === "GET") return "GetSigningProfile";
        if (req.method === "DELETE") return "CancelSigningProfile";
        return undefined;
      }
      return undefined;
    }
    return undefined;
  },
  operations: {
    PutSigningProfile,
    GetSigningProfile,
    ListSigningProfiles,
    CancelSigningProfile,
  },
  model,
} as const satisfies ServiceDefinition;

export default signer;
