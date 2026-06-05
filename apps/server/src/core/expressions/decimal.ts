import { awsError } from "../framework.ts";

type Dec = { neg: boolean; digits: bigint; scale: number };

const MAX_PRECISION = 38;
const MAX_EXPONENT = 125;
const MIN_EXPONENT = -130;

const validationError = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const parseDec = (input: string): Dec => {
  const s = input.trim();
  if (s.length === 0) {
    return validationError(
      "The parameter cannot be converted to a numeric value",
    );
  }
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
  if (match === null) {
    return validationError(
      `The parameter cannot be converted to a numeric value: ${input}`,
    );
  }
  const neg = match[1] === "-";
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? "";
  if (intPart === "" && fracPart === "") {
    return validationError(
      `The parameter cannot be converted to a numeric value: ${input}`,
    );
  }
  const expPart = match[4] === undefined ? 0 : Number(match[4]);
  const rawDigits = `${intPart}${fracPart}`.replace(/^0+/, "");
  const digitStr = rawDigits === "" ? "0" : rawDigits;
  const significantDigits = digitStr === "0" ? 0 : digitStr.length;
  if (significantDigits > MAX_PRECISION) {
    return validationError(
      `Attempting to store more than 38 significant digits in a Number`,
    );
  }
  let scale = fracPart.length - expPart;
  let digits = BigInt(digitStr);
  if (scale < 0) {
    digits = digits * 10n ** BigInt(-scale);
    scale = 0;
  }
  if (digits === 0n) {
    return { neg: false, digits: 0n, scale: 0 };
  }
  const decimalExp = significantDigits - 1 - scale;
  if (decimalExp > MAX_EXPONENT) {
    return validationError(
      `Number overflow. Attempting to store a number with magnitude larger than supported range`,
    );
  }
  if (decimalExp < MIN_EXPONENT) {
    return validationError(
      `Number underflow. Attempting to store a number with magnitude smaller than supported range`,
    );
  }
  return { neg, digits, scale };
};

const formatDec = (d: Dec): string => {
  if (d.digits === 0n) return "0";
  const raw = d.digits.toString();
  let body: string;
  if (d.scale === 0) {
    body = raw;
  } else if (raw.length > d.scale) {
    const cut = raw.length - d.scale;
    const intPart = raw.slice(0, cut);
    const fracPart = raw.slice(cut).replace(/0+$/, "");
    body = fracPart === "" ? intPart : `${intPart}.${fracPart}`;
  } else {
    const pad = "0".repeat(d.scale - raw.length);
    const fracPart = `${pad}${raw}`.replace(/0+$/, "");
    body = fracPart === "" ? "0" : `0.${fracPart}`;
  }
  return d.neg ? `-${body}` : body;
};

const alignScale = (
  a: Dec,
  b: Dec,
): { aDigits: bigint; bDigits: bigint; scale: number } => {
  const scale = Math.max(a.scale, b.scale);
  const aDigits = a.digits * 10n ** BigInt(scale - a.scale);
  const bDigits = b.digits * 10n ** BigInt(scale - b.scale);
  return { aDigits, bDigits, scale };
};

const fromSigned = (signed: bigint, scale: number): Dec => {
  if (signed === 0n) return { neg: false, digits: 0n, scale: 0 };
  const neg = signed < 0n;
  return { neg, digits: neg ? -signed : signed, scale };
};

const checkResult = (d: Dec, op: string): Dec => {
  if (d.digits === 0n) return d;
  const significantDigits = d.digits.toString().replace(/0+$/, "").length;
  if (significantDigits > MAX_PRECISION) {
    return validationError(
      `Result of ${op} exceeds maximum precision of 38 significant digits`,
    );
  }
  return d;
};

export const parseN = (input: string): string => {
  return formatDec(parseDec(input));
};

export const formatN = (input: string): string => {
  return formatDec(parseDec(input));
};

export const addN = (a: string, b: string): string => {
  const aD = parseDec(a);
  const bD = parseDec(b);
  const { aDigits, bDigits, scale } = alignScale(aD, bD);
  const aSigned = aD.neg ? -aDigits : aDigits;
  const bSigned = bD.neg ? -bDigits : bDigits;
  return formatDec(
    checkResult(fromSigned(aSigned + bSigned, scale), "addition"),
  );
};

export const subN = (a: string, b: string): string => {
  const aD = parseDec(a);
  const bD = parseDec(b);
  const { aDigits, bDigits, scale } = alignScale(aD, bD);
  const aSigned = aD.neg ? -aDigits : aDigits;
  const bSigned = bD.neg ? -bDigits : bDigits;
  return formatDec(
    checkResult(fromSigned(aSigned - bSigned, scale), "subtraction"),
  );
};

export const compareN = (a: string, b: string): -1 | 0 | 1 => {
  const aD = parseDec(a);
  const bD = parseDec(b);
  if (aD.digits === 0n && bD.digits === 0n) return 0;
  if (aD.neg && !bD.neg) return -1;
  if (!aD.neg && bD.neg) return 1;
  const { aDigits, bDigits } = alignScale(aD, bD);
  if (aDigits === bDigits) return 0;
  const less = aDigits < bDigits;
  if (aD.neg) return less ? 1 : -1;
  return less ? -1 : 1;
};
