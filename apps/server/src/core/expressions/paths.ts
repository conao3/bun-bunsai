import { awsError } from "../framework.ts";
import { resolveName } from "./bindings.ts";
import type { TokenStream } from "./lexer.ts";
import type {
  AttributeBindings,
  AttributePath,
  AttributeValue,
  PathStep,
} from "./types.ts";

const MAX_DEPTH = 32;

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const resolveRoot = (
  text: string,
  kind: "ident" | "nameRef",
  bindings: Pick<AttributeBindings, "names">,
): string => {
  if (kind === "nameRef") return resolveName(text, bindings);
  return text;
};

export const parseAttributePath = (
  stream: TokenStream,
  bindings: Pick<AttributeBindings, "names">,
): AttributePath => {
  const head = stream.peek();
  if (head.kind !== "ident" && head.kind !== "nameRef") {
    failValidation(
      `Expected an attribute path but found '${head.text || head.kind}'`,
    );
  }
  stream.consume();
  const root = resolveRoot(
    head.text,
    head.kind as "ident" | "nameRef",
    bindings,
  );
  const steps: PathStep[] = [];
  let depth = 1;
  while (true) {
    const next = stream.peek();
    if (next.kind === "dot") {
      stream.consume();
      const member = stream.peek();
      if (member.kind !== "ident" && member.kind !== "nameRef") {
        failValidation(
          `Expected an attribute name after '.' but found '${member.text || member.kind}'`,
        );
      }
      stream.consume();
      steps.push({
        kind: "field",
        name: resolveRoot(
          member.text,
          member.kind as "ident" | "nameRef",
          bindings,
        ),
      });
      depth++;
      if (depth > MAX_DEPTH) {
        failValidation(`Maximum document path depth (${MAX_DEPTH}) exceeded`);
      }
      continue;
    }
    if (next.kind === "lbracket") {
      stream.consume();
      const idx = stream.peek();
      if (idx.kind !== "int") {
        failValidation(
          `Expected a non-negative integer inside [] but found '${idx.text || idx.kind}'`,
        );
      }
      stream.consume();
      stream.expect("rbracket", "expected ']'");
      const n = Number(idx.text);
      if (!Number.isInteger(n) || n < 0) {
        failValidation(
          `List index must be a non-negative integer: ${idx.text}`,
        );
      }
      steps.push({ kind: "index", index: n });
      depth++;
      if (depth > MAX_DEPTH) {
        failValidation(`Maximum document path depth (${MAX_DEPTH}) exceeded`);
      }
      continue;
    }
    break;
  }
  return { root, steps };
};

export const formatPath = (path: AttributePath): string => {
  let out = path.root;
  for (const step of path.steps) {
    if (step.kind === "field") {
      out += `.${step.name}`;
    } else {
      out += `[${step.index}]`;
    }
  }
  return out;
};

const getInner = (
  value: AttributeValue,
  step: PathStep,
): AttributeValue | undefined => {
  if (step.kind === "field") {
    const m = value["M"];
    if (typeof m !== "object" || m === null) return undefined;
    const child = (m as Record<string, AttributeValue>)[step.name];
    return child;
  }
  const l = value["L"];
  if (!Array.isArray(l)) return undefined;
  const child = l[step.index];
  return child === undefined ? undefined : (child as AttributeValue);
};

export const getAtPath = (
  item: Record<string, AttributeValue>,
  path: AttributePath,
): AttributeValue | undefined => {
  const root = item[path.root];
  if (root === undefined) return undefined;
  let current: AttributeValue | undefined = root;
  for (const step of path.steps) {
    if (current === undefined) return undefined;
    current = getInner(current, step);
  }
  return current;
};

const cloneValue = (v: AttributeValue): AttributeValue => {
  const out: AttributeValue = {};
  for (const k of Object.keys(v)) {
    const inner = v[k];
    if (Array.isArray(inner)) {
      out[k] = inner.map((entry) =>
        typeof entry === "object" && entry !== null
          ? cloneValue(entry as AttributeValue)
          : entry,
      );
    } else if (typeof inner === "object" && inner !== null) {
      const m: Record<string, AttributeValue> = {};
      for (const mk of Object.keys(inner as Record<string, AttributeValue>)) {
        m[mk] = cloneValue((inner as Record<string, AttributeValue>)[mk]!);
      }
      out[k] = m;
    } else {
      out[k] = inner;
    }
  }
  return out;
};

export const cloneItem = (
  item: Record<string, AttributeValue>,
): Record<string, AttributeValue> => {
  const out: Record<string, AttributeValue> = {};
  for (const k of Object.keys(item)) {
    out[k] = cloneValue(item[k]!);
  }
  return out;
};

const ensureContainer = (
  parent: AttributeValue,
  step: PathStep,
  pathStr: string,
): AttributeValue => {
  if (step.kind === "field") {
    if (parent["M"] === undefined) {
      throw awsError(
        "ValidationException",
        `The document path provided in the update expression is invalid for update: ${pathStr}`,
        400,
      );
    }
    return parent;
  }
  if (parent["L"] === undefined) {
    throw awsError(
      "ValidationException",
      `The document path provided in the update expression is invalid for update: ${pathStr}`,
      400,
    );
  }
  return parent;
};

const setStep = (
  parent: AttributeValue,
  step: PathStep,
  next: AttributeValue,
  pathStr: string,
): AttributeValue => {
  ensureContainer(parent, step, pathStr);
  if (step.kind === "field") {
    const m = { ...(parent["M"] as Record<string, AttributeValue>) };
    m[step.name] = next;
    return { ...parent, M: m };
  }
  const arr = [...(parent["L"] as AttributeValue[])];
  const writeIndex = step.index > arr.length ? arr.length : step.index;
  arr[writeIndex] = next;
  return { ...parent, L: arr };
};

const ensurePathParents = (
  current: AttributeValue,
  steps: PathStep[],
  idx: number,
  pathStr: string,
): AttributeValue => {
  if (idx >= steps.length - 1) return current;
  const step = steps[idx]!;
  ensureContainer(current, step, pathStr);
  return current;
};

const setInner = (
  current: AttributeValue,
  steps: PathStep[],
  idx: number,
  value: AttributeValue,
  pathStr: string,
): AttributeValue => {
  if (idx === steps.length - 1) {
    return setStep(current, steps[idx]!, value, pathStr);
  }
  const step = steps[idx]!;
  ensurePathParents(current, steps, idx, pathStr);
  if (step.kind === "field") {
    const m = (current["M"] ?? {}) as Record<string, AttributeValue>;
    const child = m[step.name];
    if (child === undefined) {
      throw awsError(
        "ValidationException",
        `The document path provided in the update expression is invalid for update: ${pathStr}`,
        400,
      );
    }
    const nextChild = setInner(child, steps, idx + 1, value, pathStr);
    const nextM = { ...m, [step.name]: nextChild };
    return { ...current, M: nextM };
  }
  const arr = (current["L"] ?? []) as AttributeValue[];
  if (step.index >= arr.length) {
    throw awsError(
      "ValidationException",
      `The document path provided in the update expression is invalid for update: ${pathStr}`,
      400,
    );
  }
  const child = arr[step.index]!;
  const nextChild = setInner(child, steps, idx + 1, value, pathStr);
  const nextArr = [...arr];
  nextArr[step.index] = nextChild;
  return { ...current, L: nextArr };
};

export const setAtPath = (
  item: Record<string, AttributeValue>,
  path: AttributePath,
  value: AttributeValue,
): Record<string, AttributeValue> => {
  const pathStr = formatPath(path);
  if (path.steps.length === 0) {
    return { ...item, [path.root]: value };
  }
  const root = item[path.root];
  if (root === undefined) {
    throw awsError(
      "ValidationException",
      `The document path provided in the update expression is invalid for update: ${pathStr}`,
      400,
    );
  }
  const next = setInner(root, path.steps, 0, value, pathStr);
  return { ...item, [path.root]: next };
};

const removeStep = (parent: AttributeValue, step: PathStep): AttributeValue => {
  if (step.kind === "field") {
    const m = parent["M"] as Record<string, AttributeValue> | undefined;
    if (m === undefined) return parent;
    if (!(step.name in m)) return parent;
    const next: Record<string, AttributeValue> = {};
    for (const k of Object.keys(m)) {
      if (k !== step.name) next[k] = m[k]!;
    }
    return { ...parent, M: next };
  }
  const arr = parent["L"] as AttributeValue[] | undefined;
  if (arr === undefined) return parent;
  if (step.index >= arr.length) return parent;
  const nextArr = [...arr.slice(0, step.index), ...arr.slice(step.index + 1)];
  return { ...parent, L: nextArr };
};

const removeInner = (
  current: AttributeValue,
  steps: PathStep[],
  idx: number,
): AttributeValue => {
  if (idx === steps.length - 1) {
    return removeStep(current, steps[idx]!);
  }
  const step = steps[idx]!;
  if (step.kind === "field") {
    const m = current["M"] as Record<string, AttributeValue> | undefined;
    if (m === undefined) return current;
    const child = m[step.name];
    if (child === undefined) return current;
    const nextChild = removeInner(child, steps, idx + 1);
    return { ...current, M: { ...m, [step.name]: nextChild } };
  }
  const arr = current["L"] as AttributeValue[] | undefined;
  if (arr === undefined) return current;
  const child = arr[step.index];
  if (child === undefined) return current;
  const nextChild = removeInner(child, steps, idx + 1);
  const nextArr = [...arr];
  nextArr[step.index] = nextChild;
  return { ...current, L: nextArr };
};

export const removeAtPath = (
  item: Record<string, AttributeValue>,
  path: AttributePath,
): Record<string, AttributeValue> => {
  if (path.steps.length === 0) {
    if (!(path.root in item)) return item;
    const next: Record<string, AttributeValue> = {};
    for (const k of Object.keys(item)) {
      if (k !== path.root) next[k] = item[k]!;
    }
    return next;
  }
  const root = item[path.root];
  if (root === undefined) return item;
  const next = removeInner(root, path.steps, 0);
  return { ...item, [path.root]: next };
};

const segmentsEqual = (a: PathStep, b: PathStep): boolean => {
  if (a.kind === "field" && b.kind === "field") return a.name === b.name;
  if (a.kind === "index" && b.kind === "index") return a.index === b.index;
  return false;
};

export const pathsOverlap = (a: AttributePath, b: AttributePath): boolean => {
  if (a.root !== b.root) return false;
  const shorter = a.steps.length <= b.steps.length ? a.steps : b.steps;
  const longer = a.steps.length <= b.steps.length ? b.steps : a.steps;
  for (let i = 0; i < shorter.length; i++) {
    if (!segmentsEqual(shorter[i]!, longer[i]!)) return false;
  }
  return true;
};
