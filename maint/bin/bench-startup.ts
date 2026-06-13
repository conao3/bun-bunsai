const ITERATIONS = 3;
const STS_BODY = "Action=GetCallerIdentity&Version=2011-06-15";
const AUTH =
  "AWS4-HMAC-SHA256 Credential=test/20990101/us-east-1/sts/aws4_request, SignedHeaders=host, Signature=x";

const freePort = async (): Promise<number> => {
  const srv = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const port = srv.port;
  await srv.stop();
  return port;
};

const stsReady = async (port: number, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        method: "POST",
        headers: {
          Authorization: AUTH,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: STS_BODY,
        signal: AbortSignal.timeout(1000),
      });
      if (res.status === 200) {
        const text = await res.text();
        if (text.includes("GetCallerIdentityResult")) return true;
      }
    } catch {
      await Bun.sleep(20);
    }
  }
  return false;
};

const rssOfPid = async (pid: number): Promise<number | undefined> => {
  try {
    const status = await Bun.file(`/proc/${pid}/status`).text();
    const m = status.match(/VmRSS:\s+(\d+) kB/);
    return m ? Math.round(Number(m[1]) / 1024) : undefined;
  } catch {
    return undefined;
  }
};

type Sample = { startupMs: number; rssMb: number | undefined };

const benchBunsai = async (binPath: string): Promise<Sample> => {
  const port = await freePort();
  const t0 = performance.now();
  const proc = Bun.spawn([binPath], {
    env: {
      ...process.env,
      BUNSAI_PORT: String(port),
      NODE_ENV: "production",
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  const ok = await stsReady(port, 30000);
  const startupMs = performance.now() - t0;
  if (!ok) {
    proc.kill();
    throw new Error("bunsai did not become ready");
  }
  const rssMb = await rssOfPid(proc.pid);
  proc.kill();
  await proc.exited;
  return { startupMs, rssMb };
};

const docker = (args: string[]): string => {
  const r = Bun.spawnSync(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (r.exitCode !== 0) {
    throw new Error(
      `docker ${args[0]} failed: ${r.stderr.toString().slice(0, 300)}`,
    );
  }
  return r.stdout.toString().trim();
};

const benchLocalStack = async (image: string): Promise<Sample> => {
  const port = await freePort();
  const t0 = performance.now();
  const cid = docker(["run", "-d", "--rm", "-p", `${port}:4566`, image]);
  try {
    const ok = await stsReady(port, 180000);
    const startupMs = performance.now() - t0;
    if (!ok) throw new Error("localstack did not become ready");
    const stats = docker([
      "stats",
      "--no-stream",
      "--format",
      "{{.MemUsage}}",
      cid,
    ]);
    const m = stats.match(/([\d.]+)\s*(GiB|MiB)/);
    const rssMb =
      m === null
        ? undefined
        : m[2] === "GiB"
          ? Math.round(Number(m[1]) * 1024)
          : Math.round(Number(m[1]));
    return { startupMs, rssMb };
  } finally {
    Bun.spawnSync(["docker", "stop", "-t", "1", cid], {
      stdout: "ignore",
      stderr: "ignore",
    });
  }
};

const summarize = (name: string, samples: Sample[]): void => {
  const times = samples.map((s) => s.startupMs).toSorted((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;
  const rss = samples.map((s) => s.rssMb).filter((v) => v !== undefined);
  const rssText =
    rss.length > 0 ? `${Math.max(...(rss as number[]))} MB` : "n/a";
  console.log(
    `${name}: startup median ${(median / 1000).toFixed(2)}s (min ${(times[0]! / 1000).toFixed(2)}s, max ${(times[times.length - 1]! / 1000).toFixed(2)}s), RSS ${rssText}`,
  );
};

const binPath = Bun.argv[2] ?? "/tmp/bunsai-bench-bin";
const image = Bun.argv[3] ?? "localstack/localstack:latest";

if (!(await Bun.file(binPath).exists())) {
  console.log(`building bunsai binary -> ${binPath}`);
  const build = Bun.spawnSync(
    [
      "bun",
      "build",
      "--compile",
      "apps/server/src/index.ts",
      "--outfile",
      binPath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (build.exitCode !== 0) {
    console.error(build.stderr.toString().slice(0, 500));
    process.exit(1);
  }
}

const bunsaiSamples: Sample[] = [];
for (let i = 0; i < ITERATIONS; i++)
  bunsaiSamples.push(await benchBunsai(binPath));
summarize("bunsai (single binary)", bunsaiSamples);

const lsSamples: Sample[] = [];
for (let i = 0; i < ITERATIONS; i++)
  lsSamples.push(await benchLocalStack(image));
summarize(`localstack (${image}, docker)`, lsSamples);
