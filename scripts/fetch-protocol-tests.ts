const BOTOCORE_TAG = "1.43.19" as const;
const BOTOCORE_COMMIT = "8fdb47d1636e7f7ae0cacdd4584ffd339f88c546" as const;
const SOURCE_PATH = "tests/unit/protocols" as const;
const VENDOR_DIR = "test/vendor/botocore-protocol-tests" as const;

const RAW_BASE =
  `https://raw.githubusercontent.com/boto/botocore/${BOTOCORE_COMMIT}` as const;
const CONTENTS_BASE =
  "https://api.github.com/repos/boto/botocore/contents" as const;

type ContentEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
};

const githubHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bunsai-fetch-protocol-tests",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token !== undefined && token !== "")
    headers.Authorization = `Bearer ${token}`;
  return headers;
};

const listDir = async (path: string): Promise<ContentEntry[]> => {
  const url = `${CONTENTS_BASE}/${path}?ref=${BOTOCORE_TAG}`;
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

const mirror = async (
  sourcePath: string,
  destPath: string,
): Promise<number> => {
  const entries = await listDir(sourcePath);
  let count = 0;
  for (const entry of entries) {
    const dest = `${destPath}/${entry.name}`;
    if (entry.type === "dir") {
      count += await mirror(entry.path, dest);
      continue;
    }
    const bytes = await fetchRaw(entry.path);
    await Bun.write(dest, bytes);
    count += 1;
    console.log(`wrote ${dest}`);
  }
  return count;
};

const main = async (): Promise<void> => {
  console.log(
    `fetching botocore protocol tests at tag ${BOTOCORE_TAG} (${BOTOCORE_COMMIT})`,
  );
  const protocolCount = await mirror(SOURCE_PATH, VENDOR_DIR);
  const license = await fetchRaw("LICENSE.txt");
  await Bun.write(`${VENDOR_DIR}/LICENSE.txt`, license);
  console.log(`wrote ${VENDOR_DIR}/LICENSE.txt`);
  console.log(`done: ${protocolCount} protocol files`);
};

await main();
