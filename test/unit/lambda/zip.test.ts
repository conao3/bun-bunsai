import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { unzip } from "../../../apps/server/src/services/lambda/zip.ts";

const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number): number[] => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >> 16) & 0xff,
  (n >> 24) & 0xff,
];

const makeZip = (files: Record<string, string>, method: 0 | 8): Uint8Array => {
  const encoder = new TextEncoder();
  const locals: number[] = [];
  const central: number[] = [];
  let offset = 0;
  for (const [name, source] of Object.entries(files)) {
    const nameBytes = [...encoder.encode(name)];
    const content = encoder.encode(source);
    const stored = [...content];
    const payload = method === 8 ? [...deflateRawSync(content)] : stored;
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(payload.length),
      ...u32(content.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...payload,
    ];
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(payload.length),
      ...u32(content.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nameBytes,
    );
    locals.push(...local);
    offset += local.length;
  }
  const count = Object.keys(files).length;
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(count),
    ...u16(count),
    ...u32(central.length),
    ...u32(locals.length),
    ...u16(0),
  ];
  return new Uint8Array([...locals, ...central, ...eocd]);
};

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("lambda zip", () => {
  test("extracts deflate-compressed entries", () => {
    const zip = makeZip({ "index.js": "exports.handler = 1;" }, 8);
    const files = unzip(zip);
    expect(files).not.toBeUndefined();
    expect(decode(files!["index.js"]!)).toBe("exports.handler = 1;");
  });

  test("extracts stored entries", () => {
    const zip = makeZip({ "main.js": "module.exports = {};" }, 0);
    const files = unzip(zip);
    expect(decode(files!["main.js"]!)).toBe("module.exports = {};");
  });

  test("extracts multiple files preserving paths", () => {
    const zip = makeZip(
      { "index.js": "require('./lib/a');", "lib/a.js": "exports.a = 2;" },
      8,
    );
    const files = unzip(zip);
    expect(Object.keys(files!).sort()).toEqual(["index.js", "lib/a.js"]);
    expect(decode(files!["lib/a.js"]!)).toBe("exports.a = 2;");
  });

  test("returns undefined for non-zip bytes", () => {
    expect(unzip(new TextEncoder().encode("PK fake zip"))).toBeUndefined();
    expect(unzip(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});
