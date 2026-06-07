export type ParsedArn = {
  partition: string;
  service: string;
  region: string;
  account: string;
  resource: string;
};

export const parseArn = (arn: string): ParsedArn | undefined => {
  if (typeof arn !== "string") return undefined;
  const parts = arn.split(":");
  if (parts.length < 6 || parts[0] !== "arn") return undefined;
  return {
    partition: parts[1] ?? "",
    service: parts[2] ?? "",
    region: parts[3] ?? "",
    account: parts[4] ?? "",
    resource: parts.slice(5).join(":"),
  };
};

export const resourceName = (resource: string): string => {
  const afterColon = resource.includes(":")
    ? resource.slice(resource.lastIndexOf(":") + 1)
    : resource;
  return afterColon.includes("/")
    ? afterColon.slice(afterColon.lastIndexOf("/") + 1)
    : afterColon;
};

export const callerArn = (account: string): string =>
  `arn:aws:iam::${account}:root`;
