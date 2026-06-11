const LOCALSTACK_TAG = "v3.8.1" as const;
const LOCALSTACK_COMMIT = "529aba7d8372e9199f42a31a6500071363ad8c18" as const;
const VENDOR_DIR = "test/vendor/localstack-snapshots" as const;

const RAW_BASE =
  `https://raw.githubusercontent.com/localstack/localstack/${LOCALSTACK_COMMIT}` as const;
const CONTENTS_BASE =
  "https://api.github.com/repos/localstack/localstack/contents" as const;

const SERVICES: Record<string, string> = {
  sqs: "tests/aws/services/sqs",
  sns: "tests/aws/services/sns",
  lambda: "tests/aws/services/lambda_",
  dynamodb: "tests/aws/services/dynamodb",
  cloudformation: "tests/aws/services/cloudformation",
  events: "tests/aws/services/events",
  secretsmanager: "tests/aws/services/secretsmanager",
  ssm: "tests/aws/services/ssm",
  kms: "tests/aws/services/kms",
  sts: "tests/aws/services/sts",
};

type ContentEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
};

const githubHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bunsai-fetch-localstack-snapshots",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token !== undefined && token !== "")
    headers.Authorization = `Bearer ${token}`;
  return headers;
};

const listDir = async (path: string): Promise<ContentEntry[]> => {
  const url = `${CONTENTS_BASE}/${path}?ref=${LOCALSTACK_TAG}`;
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

const fetchSnapshotFiles = async (
  sourcePath: string,
  destDir: string,
): Promise<number> => {
  const entries = await listDir(sourcePath);
  let count = 0;
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    if (!entry.name.endsWith(".snapshot.json")) continue;
    const bytes = await fetchRaw(entry.path);
    await Bun.write(`${destDir}/${entry.name}`, bytes);
    count += 1;
    console.log(`wrote ${destDir}/${entry.name}`);
  }
  return count;
};

const main = async (): Promise<void> => {
  console.log(
    `fetching localstack snapshot tests at tag ${LOCALSTACK_TAG} (${LOCALSTACK_COMMIT})`,
  );
  let total = 0;
  for (const [svc, srcPath] of Object.entries(SERVICES)) {
    const destDir = `${VENDOR_DIR}/${svc}`;
    const count = await fetchSnapshotFiles(srcPath, destDir);
    total += count;
    console.log(`  ${svc}: ${count} snapshot files`);
  }
  const license = await fetchRaw("LICENSE.txt");
  await Bun.write(`${VENDOR_DIR}/LICENSE.txt`, license);
  console.log(`wrote ${VENDOR_DIR}/LICENSE.txt`);
  console.log(`done: ${total} snapshot files`);
};

await main();

export {};
