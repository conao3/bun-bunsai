const KID = "bunsai-signing-key-1";

type SigningKey = {
  privateKey: CryptoKey;
  publicJwk: Record<string, string>;
};

let keyPromise: Promise<SigningKey> | undefined;

const ensureKey = (): Promise<SigningKey> => {
  if (keyPromise === undefined) {
    keyPromise = (async () => {
      const pair = (await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
      )) as CryptoKeyPair;
      const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
      return {
        privateKey: pair.privateKey,
        publicJwk: {
          kty: jwk.kty ?? "RSA",
          n: jwk.n ?? "",
          e: jwk.e ?? "AQAB",
          kid: KID,
          use: "sig",
          alg: "RS256",
        },
      };
    })();
  }
  return keyPromise;
};

const base64url = (input: string | Uint8Array): string => {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const signJwt = async (
  payload: Record<string, unknown>,
): Promise<string> => {
  const { privateKey } = await ensureKey();
  const header = base64url(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: KID }),
  );
  const body = base64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
};

export const publicJwks = async (): Promise<{
  keys: Record<string, string>[];
}> => {
  const { publicJwk } = await ensureKey();
  return { keys: [publicJwk] };
};
