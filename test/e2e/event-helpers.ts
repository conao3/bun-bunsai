import { deflateRawSync } from "node:zlib";

const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number): number[] => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >> 16) & 0xff,
  (n >> 24) & 0xff,
];

export const makeZip = (files: Record<string, string>): Uint8Array => {
  const encoder = new TextEncoder();
  const locals: number[] = [];
  const central: number[] = [];
  let offset = 0;
  for (const [name, source] of Object.entries(files)) {
    const nameBytes = [...encoder.encode(name)];
    const content = encoder.encode(source);
    const compressed = [...deflateRawSync(content)];
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(8),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(compressed.length),
      ...u32(content.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...compressed,
    ];
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(8),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(compressed.length),
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

export const markerHandler =
  "const fs = require('fs'); exports.handler = async (event) => { fs.appendFileSync(process.env.MARKER_PATH, JSON.stringify(event) + '\\n'); return { ok: true }; };";
