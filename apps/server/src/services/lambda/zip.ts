import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CD_SIGNATURE = 0x02014b50;

const findEndOfCentralDirectory = (view: DataView): number | undefined => {
  for (let offset = view.byteLength - 22; offset >= 0; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return undefined;
};

const inflateEntry = (
  method: number,
  data: Uint8Array,
): Uint8Array | undefined => {
  if (method === 0) return data;
  if (method === 8) return new Uint8Array(inflateRawSync(data));
  return undefined;
};

export const unzip = (
  bytes: Uint8Array,
): Record<string, Uint8Array> | undefined => {
  if (bytes.byteLength < 22) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd === undefined) return undefined;
  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > bytes.byteLength) return undefined;
    if (view.getUint32(cursor, true) !== CD_SIGNATURE) return undefined;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) return undefined;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    const content = inflateEntry(method, raw);
    if (content === undefined) return undefined;
    files[name] = content;
  }
  return files;
};
