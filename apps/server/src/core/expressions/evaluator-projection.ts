import { getAtPath } from "./paths.ts";
import type {
  AttributePath,
  AttributeValue,
  PathStep,
  ProjectionAST,
} from "./types.ts";

const insertPath = (
  parent: AttributeValue,
  steps: PathStep[],
  idx: number,
  value: AttributeValue,
): AttributeValue => {
  if (idx === steps.length) return value;
  const step = steps[idx]!;
  if (step.kind === "field") {
    const m = ((parent["M"] ?? {}) as Record<string, AttributeValue>) || {};
    const child = m[step.name] ?? {};
    const next = insertPath(child, steps, idx + 1, value);
    return { M: { ...m, [step.name]: next } };
  }
  const arr = (parent["L"] ?? []) as AttributeValue[];
  const child = arr[step.index] ?? {};
  const next = insertPath(child, steps, idx + 1, value);
  const nextArr = [...arr];
  while (nextArr.length <= step.index) {
    nextArr.push({});
  }
  nextArr[step.index] = next;
  return { L: nextArr };
};

const insertProjectedPath = (
  out: Record<string, AttributeValue>,
  path: AttributePath,
  value: AttributeValue,
): Record<string, AttributeValue> => {
  if (path.steps.length === 0) {
    return { ...out, [path.root]: value };
  }
  const existing = out[path.root] ?? {};
  const next = insertPath(existing, path.steps, 0, value);
  return { ...out, [path.root]: next };
};

export const projectItem = (
  ast: ProjectionAST,
  item: Record<string, AttributeValue>,
): Record<string, AttributeValue> => {
  let out: Record<string, AttributeValue> = {};
  for (const path of ast.paths) {
    const value = getAtPath(item, path);
    if (value === undefined) continue;
    out = insertProjectedPath(out, path, value);
  }
  return out;
};
