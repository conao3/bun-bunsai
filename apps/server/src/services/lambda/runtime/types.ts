export type LambdaExecution =
  | { kind: "unsupported" }
  | { kind: "unsupported_runtime"; runtime: string | undefined }
  | { kind: "host_runtime_missing"; runtime: string; reason: string }
  | { kind: "result"; payload: unknown; logs: string }
  | {
      kind: "error";
      errorType: string;
      errorMessage: string;
      trace: string[];
      logs: string;
    }
  | { kind: "timeout"; logs: string };

export type ExecuteArgs = {
  files: Record<string, Uint8Array>;
  handler: string;
  runtime: string | undefined;
  event: unknown;
  env: Record<string, string>;
  timeoutMs: number;
  context: Record<string, unknown>;
  nodePaths?: string[];
};

export type ProbeResult =
  | { ok: true; interpreterPath: string; version: string }
  | { ok: false; reason: string };

export type RuntimeAdapter = {
  readonly id: string;
  matches(runtime: string | undefined): boolean;
  probeHost(): Promise<ProbeResult>;
  execute(args: ExecuteArgs): Promise<LambdaExecution>;
};
