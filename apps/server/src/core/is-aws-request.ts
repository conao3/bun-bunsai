export function isAwsRequest(req: Request, url: URL): boolean {
  const auth = req.headers.get("authorization");
  if (auth !== null && auth.startsWith("AWS4-HMAC-SHA256")) return true;
  if (req.headers.has("x-amz-target")) return true;
  if (url.searchParams.has("X-Amz-Credential")) return true;
  for (const k of req.headers.keys()) {
    if (k.startsWith("x-amz-")) return true;
  }

  if (
    url.pathname.endsWith("/.well-known/jwks.json") ||
    url.pathname.endsWith("/.well-known/openid-configuration")
  ) {
    return true;
  }

  const rawHost = (req.headers.get("host") ?? url.hostname).split(":")[0] ?? "";
  const labels = rawHost.split(".");
  const first = labels[0] ?? "";
  if (first === "s3" || first.startsWith("s3-")) return true;
  if (labels.length >= 2 && labels[1] === "s3") return true;
  if (labels.length >= 2 && labels[1] === "execute-api") return true;
  if (rawHost.endsWith(".amazonaws.com")) return true;

  return false;
}
