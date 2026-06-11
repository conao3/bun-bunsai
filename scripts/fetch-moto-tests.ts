const MOTO_TAG = "5.2.2" as const;
const MOTO_COMMIT = "837595545cc4a4bb8fede2cff84b2b2373443981" as const;
const VENDOR_DIR = "test/vendor/moto-tests" as const;

const RAW_BASE =
  `https://raw.githubusercontent.com/getmoto/moto/${MOTO_COMMIT}` as const;
const CONTENTS_BASE =
  "https://api.github.com/repos/getmoto/moto/contents" as const;

const SERVICES: Record<string, string> = {
  "application-autoscaling": "tests/test_applicationautoscaling",
  rds: "tests/test_rds",
  "cognito-idp": "tests/test_cognitoidp",
  athena: "tests/test_athena",
  "timestream-write": "tests/test_timestreamwrite",
};

type ContentEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
};

const githubHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bunsai-fetch-moto-tests",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token !== undefined && token !== "")
    headers.Authorization = `Bearer ${token}`;
  return headers;
};

const listDir = async (path: string): Promise<ContentEntry[]> => {
  const url = `${CONTENTS_BASE}/${path}?ref=${MOTO_TAG}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok)
    throw new Error(`list ${path} failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as ContentEntry[];
};

const fetchRaw = async (path: string): Promise<ArrayBuffer> => {
  const url = `${RAW_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`fetch ${path} failed: ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
};

const hasAwsVerified = async (path: string): Promise<boolean> => {
  const bytes = await fetchRaw(path);
  const text = new TextDecoder().decode(bytes);
  return text.includes("@aws_verified");
};

const fetchMotoTestFiles = async (
  sourcePath: string,
  destDir: string,
): Promise<number> => {
  const entries = await listDir(sourcePath);
  let count = 0;
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    if (!entry.name.endsWith(".py")) continue;
    if (entry.name === "__init__.py") continue;
    const bytes = await fetchRaw(entry.path);
    const text = new TextDecoder().decode(bytes);
    if (!text.includes("@aws_verified")) continue;
    await Bun.write(`${destDir}/${entry.name}`, bytes);
    count += 1;
    console.log(`wrote ${destDir}/${entry.name}`);
  }
  return count;
};

const main = async (): Promise<void> => {
  console.log(
    `fetching moto tests at tag ${MOTO_TAG} (${MOTO_COMMIT.slice(0, 12)})`,
  );
  let total = 0;
  for (const [svc, srcPath] of Object.entries(SERVICES)) {
    const destDir = `${VENDOR_DIR}/${svc}`;
    await Bun.write(`${destDir}/.keep`, "");
    const count = await fetchMotoTestFiles(srcPath, destDir);
    total += count;
    console.log(`  ${svc}: ${count} aws_verified files`);
  }
  const license = await fetchRaw("LICENSE");
  await Bun.write(`${VENDOR_DIR}/LICENSE`, license);
  console.log(`wrote ${VENDOR_DIR}/LICENSE`);
  console.log(`done: ${total} aws_verified test files`);
};

await main();

export {};
