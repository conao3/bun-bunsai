import { awsError } from "../framework.ts";
import { compareN } from "./decimal.ts";
import type { AttributeTypeCode, AttributeValue } from "./types.ts";

const ATTRIBUTE_TAGS = [
  "S",
  "SS",
  "N",
  "NS",
  "B",
  "BS",
  "BOOL",
  "NULL",
  "L",
  "M",
] as const;

export const typeOfAV = (
  value: AttributeValue,
): AttributeTypeCode | undefined => {
  for (const tag of ATTRIBUTE_TAGS) {
    if (tag in value) return tag;
  }
  return undefined;
};

export const isSetType = (code: AttributeTypeCode | undefined): boolean =>
  code === "SS" || code === "NS" || code === "BS";

export const isNumeric = (value: AttributeValue): boolean =>
  typeOfAV(value) === "N";

const compareStrings = (a: string, b: string): -1 | 0 | 1 => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const compareBinary = (a: string, b: string): -1 | 0 | 1 => {
  const aBytes = atob(a);
  const bBytes = atob(b);
  const len = Math.min(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    const ac = aBytes.charCodeAt(i);
    const bc = bBytes.charCodeAt(i);
    if (ac < bc) return -1;
    if (ac > bc) return 1;
  }
  if (aBytes.length < bBytes.length) return -1;
  if (aBytes.length > bBytes.length) return 1;
  return 0;
};

export const equalsAV = (a: AttributeValue, b: AttributeValue): boolean => {
  const ta = typeOfAV(a);
  const tb = typeOfAV(b);
  if (ta === undefined || tb === undefined) return false;
  if (ta !== tb) return false;
  if (ta === "S") return a["S"] === b["S"];
  if (ta === "N") return compareN(a["N"] as string, b["N"] as string) === 0;
  if (ta === "B") return a["B"] === b["B"];
  if (ta === "BOOL") return a["BOOL"] === b["BOOL"];
  if (ta === "NULL") return true;
  if (ta === "SS" || ta === "NS" || ta === "BS") {
    const aSet = a[ta] as string[];
    const bSet = b[ta] as string[];
    if (aSet.length !== bSet.length) return false;
    if (ta === "NS") {
      const aSorted = [...aSet].map((n) => n).sort();
      const bSorted = [...bSet].map((n) => n).sort();
      for (let i = 0; i < aSorted.length; i++) {
        if (compareN(aSorted[i]!, bSorted[i]!) !== 0) return false;
      }
      return true;
    }
    const aSorted = [...aSet].sort();
    const bSorted = [...bSet].sort();
    for (let i = 0; i < aSorted.length; i++) {
      if (aSorted[i] !== bSorted[i]) return false;
    }
    return true;
  }
  if (ta === "L") {
    const aL = a["L"] as AttributeValue[];
    const bL = b["L"] as AttributeValue[];
    if (aL.length !== bL.length) return false;
    for (let i = 0; i < aL.length; i++) {
      if (!equalsAV(aL[i]!, bL[i]!)) return false;
    }
    return true;
  }
  const aM = a["M"] as Record<string, AttributeValue>;
  const bM = b["M"] as Record<string, AttributeValue>;
  const aKeys = Object.keys(aM);
  const bKeys = Object.keys(bM);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const bv = bM[k];
    if (bv === undefined) return false;
    if (!equalsAV(aM[k]!, bv)) return false;
  }
  return true;
};

export const compareAV = (
  a: AttributeValue,
  b: AttributeValue,
): -1 | 0 | 1 | undefined => {
  const ta = typeOfAV(a);
  const tb = typeOfAV(b);
  if (ta === undefined || tb === undefined) return undefined;
  if (ta !== tb) return undefined;
  if (ta === "S") return compareStrings(a["S"] as string, b["S"] as string);
  if (ta === "N") return compareN(a["N"] as string, b["N"] as string);
  if (ta === "B") return compareBinary(a["B"] as string, b["B"] as string);
  return undefined;
};

export const sizeOf = (value: AttributeValue): number | undefined => {
  const t = typeOfAV(value);
  if (t === undefined) return undefined;
  if (t === "S") return [...(value["S"] as string)].length;
  if (t === "B") return atob(value["B"] as string).length;
  if (t === "SS") return (value["SS"] as string[]).length;
  if (t === "NS") return (value["NS"] as string[]).length;
  if (t === "BS") return (value["BS"] as string[]).length;
  if (t === "L") return (value["L"] as AttributeValue[]).length;
  if (t === "M")
    return Object.keys(value["M"] as Record<string, AttributeValue>).length;
  return undefined;
};

export const containsAV = (
  haystack: AttributeValue,
  needle: AttributeValue,
): boolean => {
  const th = typeOfAV(haystack);
  const tn = typeOfAV(needle);
  if (th === undefined || tn === undefined) return false;
  if (th === "S") {
    if (tn !== "S") return false;
    return (haystack["S"] as string).includes(needle["S"] as string);
  }
  if (th === "SS" && tn === "S") {
    return (haystack["SS"] as string[]).includes(needle["S"] as string);
  }
  if (th === "NS" && tn === "N") {
    const items = haystack["NS"] as string[];
    const n = needle["N"] as string;
    for (const item of items) {
      if (compareN(item, n) === 0) return true;
    }
    return false;
  }
  if (th === "BS" && tn === "B") {
    return (haystack["BS"] as string[]).includes(needle["B"] as string);
  }
  if (th === "L") {
    const items = haystack["L"] as AttributeValue[];
    for (const item of items) {
      if (equalsAV(item, needle)) return true;
    }
    return false;
  }
  return false;
};

const dedupeStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (!seen.has(it)) {
      seen.add(it);
      out.push(it);
    }
  }
  return out;
};

const dedupeNumbers = (items: string[]): string[] => {
  const out: string[] = [];
  for (const it of items) {
    let dup = false;
    for (const existing of out) {
      if (compareN(it, existing) === 0) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(it);
  }
  return out;
};

export const setUnion = (
  current: AttributeValue,
  add: AttributeValue,
): AttributeValue => {
  const tc = typeOfAV(current);
  const ta = typeOfAV(add);
  if (tc === undefined || tc !== ta || !isSetType(tc)) {
    throw awsError(
      "ValidationException",
      `Incorrect operand type for operator or function; operator: ADD, operand type: ${ta ?? "UNKNOWN"}`,
      400,
    );
  }
  if (tc === "NS") {
    return {
      NS: dedupeNumbers([
        ...(current["NS"] as string[]),
        ...(add["NS"] as string[]),
      ]),
    };
  }
  const key = tc;
  return {
    [key]: dedupeStrings([
      ...(current[key] as string[]),
      ...(add[key] as string[]),
    ]),
  };
};

export const setDifference = (
  current: AttributeValue,
  remove: AttributeValue,
): AttributeValue | undefined => {
  const tc = typeOfAV(current);
  const tr = typeOfAV(remove);
  if (tc === undefined || tc !== tr || !isSetType(tc)) {
    throw awsError(
      "ValidationException",
      `Incorrect operand type for operator or function; operator: DELETE, operand type: ${tr ?? "UNKNOWN"}`,
      400,
    );
  }
  if (tc === "NS") {
    const removed = remove["NS"] as string[];
    const next = (current["NS"] as string[]).filter(
      (v) => !removed.some((r) => compareN(v, r) === 0),
    );
    if (next.length === 0) return undefined;
    return { NS: next };
  }
  const key = tc;
  const removed = remove[key] as string[];
  const next = (current[key] as string[]).filter((v) => !removed.includes(v));
  if (next.length === 0) return undefined;
  return { [key]: next };
};

export const matchesAttributeType = (
  value: AttributeValue,
  code: AttributeTypeCode,
): boolean => typeOfAV(value) === code;
