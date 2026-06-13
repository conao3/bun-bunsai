import { mkdtemp, mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "../types.ts";

const HARNESS = `import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;

public class Harness {
  static String esc(String s) {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '\\\\' || c == '"') { b.append('\\\\'); b.append(c); }
      else if (c == '\\n') b.append("\\\\n");
      else if (c == '\\r') b.append("\\\\r");
      else if (c == '\\t') b.append("\\\\t");
      else if (c < 0x20) b.append(String.format("\\\\u%04x", (int) c));
      else b.append(c);
    }
    return b.toString();
  }
  static String enc(Object v) {
    if (v == null) return "null";
    if (v instanceof Boolean || v instanceof Number) return v.toString();
    if (v instanceof CharSequence) return "\\"" + esc(v.toString()) + "\\"";
    if (v instanceof Map) {
      StringBuilder b = new StringBuilder("{");
      boolean first = true;
      for (Object e : ((Map<?, ?>) v).entrySet()) {
        Map.Entry<?, ?> en = (Map.Entry<?, ?>) e;
        if (!first) b.append(",");
        first = false;
        b.append("\\"").append(esc(en.getKey().toString())).append("\\":").append(enc(en.getValue()));
      }
      return b.append("}").toString();
    }
    if (v instanceof Iterable) {
      StringBuilder b = new StringBuilder("[");
      boolean first = true;
      for (Object e : (Iterable<?>) v) {
        if (!first) b.append(",");
        first = false;
        b.append(enc(e));
      }
      return b.append("]").toString();
    }
    return "\\"" + esc(v.toString()) + "\\"";
  }
  static Object decode(String s, int[] idx) {
    skipWs(s, idx);
    char c = s.charAt(idx[0]);
    if (c == '{') return decodeObj(s, idx);
    if (c == '[') return decodeArr(s, idx);
    if (c == '"') return decodeStr(s, idx);
    if (c == 't' || c == 'f') return decodeBool(s, idx);
    if (c == 'n') { idx[0] += 4; return null; }
    return decodeNum(s, idx);
  }
  static void skipWs(String s, int[] idx) {
    while (idx[0] < s.length() && Character.isWhitespace(s.charAt(idx[0]))) idx[0]++;
  }
  static Map<String, Object> decodeObj(String s, int[] idx) {
    Map<String, Object> m = new LinkedHashMap<>();
    idx[0]++;
    skipWs(s, idx);
    if (s.charAt(idx[0]) == '}') { idx[0]++; return m; }
    while (true) {
      skipWs(s, idx);
      String k = decodeStr(s, idx);
      skipWs(s, idx);
      idx[0]++;
      Object v = decode(s, idx);
      m.put(k, v);
      skipWs(s, idx);
      char c = s.charAt(idx[0]++);
      if (c == '}') return m;
    }
  }
  static List<Object> decodeArr(String s, int[] idx) {
    List<Object> l = new ArrayList<>();
    idx[0]++;
    skipWs(s, idx);
    if (s.charAt(idx[0]) == ']') { idx[0]++; return l; }
    while (true) {
      l.add(decode(s, idx));
      skipWs(s, idx);
      char c = s.charAt(idx[0]++);
      if (c == ']') return l;
    }
  }
  static String decodeStr(String s, int[] idx) {
    StringBuilder b = new StringBuilder();
    idx[0]++;
    while (true) {
      char c = s.charAt(idx[0]++);
      if (c == '"') return b.toString();
      if (c == '\\\\') {
        char n = s.charAt(idx[0]++);
        if (n == 'n') b.append('\\n');
        else if (n == 'r') b.append('\\r');
        else if (n == 't') b.append('\\t');
        else if (n == 'u') {
          b.append((char) Integer.parseInt(s.substring(idx[0], idx[0] + 4), 16));
          idx[0] += 4;
        } else b.append(n);
      } else b.append(c);
    }
  }
  static Boolean decodeBool(String s, int[] idx) {
    if (s.charAt(idx[0]) == 't') { idx[0] += 4; return Boolean.TRUE; }
    idx[0] += 5; return Boolean.FALSE;
  }
  static Object decodeNum(String s, int[] idx) {
    int start = idx[0];
    while (idx[0] < s.length() && "-+0123456789.eE".indexOf(s.charAt(idx[0])) >= 0) idx[0]++;
    String t = s.substring(start, idx[0]);
    if (t.contains(".") || t.contains("e") || t.contains("E")) return Double.parseDouble(t);
    try { return Long.parseLong(t); } catch (Exception e) { return Double.parseDouble(t); }
  }
  static Object parseJson(String s) {
    if (s == null || s.isEmpty()) return null;
    return decode(s, new int[] { 0 });
  }
  public static class Ctx {
    private final Map<String, Object> data;
    private final long deadline;
    public Ctx(Map<String, Object> d, long dl) { this.data = d; this.deadline = dl; }
    String str(String k) { Object v = data.get(k); return v == null ? "" : v.toString(); }
    public String getFunctionName() { return str("functionName"); }
    public String getFunctionVersion() { return str("functionVersion"); }
    public String getInvokedFunctionArn() { return str("invokedFunctionArn"); }
    public int getMemoryLimitInMB() {
      try { return Integer.parseInt(str("memoryLimitInMB")); } catch (Exception e) { return 0; }
    }
    public String getAwsRequestId() { return str("awsRequestId"); }
    public String getLogGroupName() { return str("logGroupName"); }
    public String getLogStreamName() { return str("logStreamName"); }
    public long getRemainingTimeInMillis() { return Math.max(0L, deadline - System.currentTimeMillis()); }
  }
  static List<URL> collectUrls(Path root) throws Exception {
    List<URL> urls = new ArrayList<>();
    urls.add(root.toUri().toURL());
    if (Files.isDirectory(root)) {
      Files.walk(root).forEach(p -> {
        if (p.toString().endsWith(".jar")) {
          try { urls.add(p.toUri().toURL()); } catch (Exception e) {}
        }
      });
    }
    return urls;
  }
  public static void main(String[] args) throws Exception {
    String handler = System.getProperty("bunsai.handler");
    String eventPath = System.getProperty("bunsai.event");
    String resultPath = System.getProperty("bunsai.result");
    String contextJson = System.getProperty("bunsai.context");
    String userDir = System.getProperty("bunsai.userdir");
    long deadline = Long.parseLong(System.getProperty("bunsai.deadline"));
    String result;
    try {
      int sep = handler.indexOf("::");
      String className = sep < 0 ? handler : handler.substring(0, sep);
      String methodName = sep < 0 ? "handleRequest" : handler.substring(sep + 2);
      List<URL> urls = collectUrls(Paths.get(userDir));
      URLClassLoader cl = new URLClassLoader(urls.toArray(new URL[0]), Harness.class.getClassLoader());
      Class<?> cls = Class.forName(className, true, cl);
      Object instance = cls.getDeclaredConstructor().newInstance();
      String eventText = new String(Files.readAllBytes(Paths.get(eventPath)));
      Object event = parseJson(eventText);
      @SuppressWarnings("unchecked")
      Map<String, Object> ctxData = (Map<String, Object>) parseJson(contextJson);
      Ctx ctx = new Ctx(ctxData, deadline);
      Method method = null;
      for (Method m : cls.getMethods()) {
        if (m.getName().equals(methodName) && m.getParameterCount() == 2) { method = m; break; }
      }
      if (method == null) {
        for (Method m : cls.getMethods()) {
          if (m.getName().equals(methodName) && m.getParameterCount() == 1) { method = m; break; }
        }
      }
      if (method == null) {
        result = "{\\"ok\\":false,\\"errorType\\":\\"Runtime.HandlerNotFound\\",\\"errorMessage\\":\\"" + esc(methodName) + " not found on " + esc(className) + "\\",\\"trace\\":[]}";
      } else {
        Object ret;
        if (method.getParameterCount() == 2) ret = method.invoke(instance, event, ctx);
        else ret = method.invoke(instance, event);
        result = "{\\"ok\\":true,\\"result\\":" + enc(ret) + "}";
      }
    } catch (Throwable t) {
      Throwable root = t instanceof InvocationTargetException && t.getCause() != null ? t.getCause() : t;
      StringWriter sw = new StringWriter();
      root.printStackTrace(new PrintWriter(sw));
      String[] lines = sw.toString().split("\\n");
      StringBuilder tr = new StringBuilder("[");
      for (int i = 0; i < lines.length; i++) {
        if (i > 0) tr.append(",");
        tr.append("\\"").append(esc(lines[i])).append("\\"");
      }
      tr.append("]");
      result = "{\\"ok\\":false,\\"errorType\\":\\"" + esc(root.getClass().getName()) + "\\",\\"errorMessage\\":\\"" + esc(root.getMessage() == null ? "" : root.getMessage()) + "\\",\\"trace\\":" + tr.toString() + "}";
    }
    Files.write(Paths.get(resultPath), result.getBytes());
  }
}
`;

const resolveJavaCommand = async (): Promise<string | undefined> => {
  const override = process.env.BUNSAI_LAMBDA_JAVA;
  if (override !== undefined && override.length > 0) return override;
  const proc = Bun.spawn(["sh", "-c", "command -v java"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const trimmed = out.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed;
};

const probeVersion = async (cmd: string): Promise<string | undefined> => {
  const proc = Bun.spawn([cmd, "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  const combined = (stdout + stderr).trim();
  if (combined.length === 0) return undefined;
  return combined.split("\n")[0];
};

const collectClasspathExtras = async (dir: string): Promise<string[]> => {
  const optLib = join(dir, "opt/java/lib");
  const entries = await readdir(optLib).catch(() => undefined);
  if (entries === undefined) return [];
  return entries.filter((e) => e.endsWith(".jar")).map((e) => join(optLib, e));
};

type ResultFile =
  | { ok: true; result: unknown }
  | { ok: false; errorType: string; errorMessage: string; trace: string[] };

export const javaAdapter: RuntimeAdapter = {
  id: "java",
  matches: (runtime) => runtime !== undefined && runtime.startsWith("java"),
  probeHost: async (): Promise<ProbeResult> => {
    const cmd = await resolveJavaCommand();
    if (cmd === undefined)
      return { ok: false, reason: "java interpreter not found on PATH" };
    const version = await probeVersion(cmd);
    if (version === undefined)
      return { ok: false, reason: `failed to run ${cmd} --version` };
    return { ok: true, interpreterPath: cmd, version };
  },
  execute: async (args: ExecuteArgs): Promise<LambdaExecution> => {
    const cmd = await resolveJavaCommand();
    if (cmd === undefined)
      return {
        kind: "host_runtime_missing",
        runtime: args.runtime ?? "java",
        reason: "java interpreter not found on PATH",
      };

    const dir = await mkdtemp(join(tmpdir(), "bunsai-lambda-java-"));
    try {
      const userDir = join(dir, "user");
      await mkdir(userDir, { recursive: true });
      for (const [name, content] of Object.entries(args.files)) {
        const target = join(userDir, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const eventPath = join(dir, "__bunsai_event.json");
      const resultPath = join(dir, "__bunsai_result.json");
      const harnessPath = join(dir, "Harness.java");
      await writeFile(eventPath, JSON.stringify(args.event ?? null));
      await writeFile(harnessPath, HARNESS);

      const extras = await collectClasspathExtras(userDir);
      const cp = [userDir, ...extras].join(":");

      const start = Date.now();
      const proc = Bun.spawn(
        [
          cmd,
          `-Dbunsai.handler=${args.handler}`,
          `-Dbunsai.event=${eventPath}`,
          `-Dbunsai.result=${resultPath}`,
          `-Dbunsai.context=${JSON.stringify(args.context)}`,
          `-Dbunsai.userdir=${userDir}`,
          `-Dbunsai.deadline=${start + args.timeoutMs}`,
          `-cp`,
          cp,
          harnessPath,
        ],
        {
          cwd: dir,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            ...args.env,
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: args.timeoutMs,
          killSignal: "SIGKILL",
        },
      );
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      await proc.exited;
      const logs = stdout + stderr;
      const elapsed = Date.now() - start;

      const resultText = await Bun.file(resultPath)
        .text()
        .catch(() => undefined);
      if (resultText === undefined) {
        if (elapsed >= args.timeoutMs) return { kind: "timeout", logs };
        return {
          kind: "error",
          errorType: "Runtime.ExitError",
          errorMessage:
            stderr.trim().split("\n").slice(-1)[0] ??
            "Process exited before completing the request",
          trace: [],
          logs,
        };
      }
      const parsed = JSON.parse(resultText) as ResultFile;
      if (parsed.ok) return { kind: "result", payload: parsed.result, logs };
      return {
        kind: "error",
        errorType: parsed.errorType,
        errorMessage: parsed.errorMessage,
        trace: parsed.trace,
        logs,
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
