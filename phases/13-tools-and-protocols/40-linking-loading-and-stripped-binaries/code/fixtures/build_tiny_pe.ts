// Lesson: Linking, Loading, and Stripped Binaries: PLT, GOT, Imports, Fixups, and Function Identification (phase 13 / lesson 40)
// TypeScript port of code/fixtures/build_tiny_pe.py. Node standard library only.
// Source: phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures/build_tiny_pe.ts

import { statSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const HERE = __dirname;
const OUT = path.join(HERE, "tiny-x86_64.exe");

const IMAGE_BASE = 0x140000000;
const FILE_ALIGN = 0x200;
const SECTION_ALIGN = 0x1000;
const DLL = Buffer.from("msvcrt.dll\0", "latin1");
const IMPORTS = ["puts", "exit"];
const MESSAGE = Buffer.from("linked by hand\0", "latin1");
const EXPORT_NAME = Buffer.from("tiny_entry\0", "latin1");
const IMAGE_NAME = Buffer.from("tiny-x86_64.exe\0", "latin1");

const IMAGE_FILE_MACHINE_AMD64 = 0x8664;
const IMAGE_FILE_EXECUTABLE_IMAGE = 0x0002;
const IMAGE_FILE_LARGE_ADDRESS_AWARE = 0x0020;
const PE32_PLUS = 0x20b;
const SUBSYSTEM_CUI = 3;
const DLL_HIGH_ENTROPY_VA = 0x0020;
const DLL_DYNAMIC_BASE = 0x0040;
const DLL_NX_COMPAT = 0x0100;
const DLL_TERMINAL_SERVER_AWARE = 0x8000;
const SCN_CODE = 0x00000020;
const SCN_INITIALIZED_DATA = 0x00000040;
const SCN_MEM_DISCARDABLE = 0x02000000;
const SCN_MEM_EXECUTE = 0x20000000;
const SCN_MEM_READ = 0x40000000;
const SCN_MEM_WRITE = 0x80000000;
const IMAGE_REL_BASED_DIR64 = 10;
const DIR_EXPORT = 0;
const DIR_IMPORT = 1;
const DIR_BASERELOC = 5;
const DIR_IAT = 12;

type Value = number | bigint | Buffer;

function packInto(format: string, buffer: Buffer, offset: number, ...values: Value[]): number {
  let cursor = offset;
  let next = 0;
  for (const [, countText, code] of format.slice(1).matchAll(/(\d*)([sBbHhIiQq])/g)) {
    const count = countText === "" ? 1 : parseInt(countText, 10);
    if (code === "s") {
      const raw = values[next++] as Buffer;
      buffer.fill(0, cursor, cursor + count);
      raw.copy(buffer, cursor, 0, Math.min(count, raw.length));
      cursor += count;
      continue;
    }
    for (let k = 0; k < count; k++) {
      const value = values[next++] as number | bigint;
      if (code === "B") cursor = buffer.writeUInt8(Number(value), cursor);
      else if (code === "b") cursor = buffer.writeInt8(Number(value), cursor);
      else if (code === "H") cursor = buffer.writeUInt16LE(Number(value), cursor);
      else if (code === "h") cursor = buffer.writeInt16LE(Number(value), cursor);
      else if (code === "I") cursor = buffer.writeUInt32LE(Number(value), cursor);
      else if (code === "i") cursor = buffer.writeInt32LE(Number(value), cursor);
      else if (code === "Q") cursor = buffer.writeBigUInt64LE(BigInt(value), cursor);
      else cursor = buffer.writeBigInt64LE(BigInt(value), cursor);
    }
  }
  return cursor - offset;
}

function pack(format: string, ...values: Value[]): Buffer {
  const scratch = Buffer.alloc(4096);
  return Buffer.from(scratch.subarray(0, packInto(format, scratch, 0, ...values)));
}

function bytes(...values: number[]): Buffer {
  return Buffer.from(values);
}

export function rel32(targetRva: number, nextRva: number): Buffer {
  return pack("<i", targetRva - nextRva);
}

export function padded(blob: Buffer, size: number): Buffer {
  return Buffer.concat([blob, Buffer.alloc(size - blob.length)]);
}

export function build(): Buffer {
  const [textRva, rdataRva, dataRva, relocRva] = [0x1000, 0x2000, 0x3000, 0x4000];
  const [textOff, rdataOff, dataOff, relocOff] = [0x200, 0x400, 0x600, 0x800];

  const descriptorRva = rdataRva;
  const iltRva = rdataRva + 0x28;
  const iatRva = rdataRva + 0x40;
  const hintRva = new Map<string, number>([[IMPORTS[0], rdataRva + 0x58], [IMPORTS[1], rdataRva + 0x60]]);
  const dllRva = rdataRva + 0x68;
  const exportDirRva = rdataRva + 0x80;
  const eatRva = exportDirRva + 40;
  const enptRva = eatRva + 4;
  const eotRva = enptRva + 4;
  const imageNameRva = eotRva + 2;
  const exportNameRva = imageNameRva + IMAGE_NAME.length;
  const messageRva = exportNameRva + EXPORT_NAME.length;
  const exportSize = messageRva - exportDirRva;

  const code = Buffer.concat([
    bytes(0x48, 0x83, 0xec, 0x28),
    bytes(0x48, 0x8d, 0x0d), rel32(messageRva, textRva + 11),
    bytes(0xff, 0x15), rel32(iatRva, textRva + 17),
    bytes(0x31, 0xc9),
    bytes(0xff, 0x15), rel32(iatRva + 8, textRva + 25),
    bytes(0xcc),
  ]);

  const rdata = Buffer.alloc(0x200);
  packInto("<IIIII", rdata, 0, iltRva, 0, 0, dllRva, iatRva);
  const thunks = pack("<QQQ", hintRva.get(IMPORTS[0]) ?? 0, hintRva.get(IMPORTS[1]) ?? 0, 0);
  thunks.copy(rdata, 0x28);
  thunks.copy(rdata, 0x40);
  padded(Buffer.concat([bytes(0, 0), Buffer.from(IMPORTS[0], "utf8"), bytes(0)]), 8).copy(rdata, 0x58);
  padded(Buffer.concat([bytes(0, 0), Buffer.from(IMPORTS[1], "utf8"), bytes(0)]), 8).copy(rdata, 0x60);
  DLL.copy(rdata, 0x68);
  packInto("<IIHHIIIIIII", rdata, 0x80, 0, 0, 0, 0, imageNameRva, 1, 1, 1, eatRva, enptRva, eotRva);
  packInto("<I", rdata, eatRva - rdataRva, textRva);
  packInto("<I", rdata, enptRva - rdataRva, exportNameRva);
  packInto("<H", rdata, eotRva - rdataRva, 0);
  IMAGE_NAME.copy(rdata, imageNameRva - rdataRva);
  EXPORT_NAME.copy(rdata, exportNameRva - rdataRva);
  MESSAGE.copy(rdata, messageRva - rdataRva);
  const rdataUsed = messageRva - rdataRva + MESSAGE.length;

  const data = pack("<Q", IMAGE_BASE + messageRva);
  const reloc = pack("<IIHH", dataRva, 12, (IMAGE_REL_BASED_DIR64 << 12) | 0, 0);

  const sections: [Buffer, number, number, number, number][] = [
    [Buffer.from(".text"), code.length, textRva, textOff, SCN_CODE | SCN_MEM_EXECUTE | SCN_MEM_READ],
    [Buffer.from(".rdata"), rdataUsed, rdataRva, rdataOff, SCN_INITIALIZED_DATA | SCN_MEM_READ],
    [Buffer.from(".data"), data.length, dataRva, dataOff, (SCN_INITIALIZED_DATA | SCN_MEM_READ | SCN_MEM_WRITE) >>> 0],
    [Buffer.from(".reloc"), reloc.length, relocRva, relocOff, SCN_INITIALIZED_DATA | SCN_MEM_READ | SCN_MEM_DISCARDABLE],
  ];

  const image = Buffer.alloc(relocOff + FILE_ALIGN);
  bytes(0x4d, 0x5a).copy(image, 0);
  packInto("<I", image, 0x3c, 0x40);
  bytes(0x50, 0x45, 0, 0).copy(image, 0x40);
  packInto("<HHIIIHH", image, 0x44, IMAGE_FILE_MACHINE_AMD64, sections.length, 0, 0, 0, 240, IMAGE_FILE_EXECUTABLE_IMAGE | IMAGE_FILE_LARGE_ADDRESS_AWARE);
  packInto(
    "<HBBIIIIIQIIHHHHHHIIIIHHQQQQII", image, 0x58,
    PE32_PLUS, 14, 0, FILE_ALIGN, 3 * FILE_ALIGN, 0, textRva, textRva, IMAGE_BASE, SECTION_ALIGN, FILE_ALIGN,
    6, 0, 0, 0, 6, 0, 0, 0x5000, 0x200, 0, SUBSYSTEM_CUI,
    DLL_HIGH_ENTROPY_VA | DLL_DYNAMIC_BASE | DLL_NX_COMPAT | DLL_TERMINAL_SERVER_AWARE,
    0x100000, 0x1000, 0x100000, 0x1000, 0, 16,
  );
  const directories = 0x58 + 112;
  packInto("<II", image, directories + 8 * DIR_EXPORT, exportDirRva, exportSize);
  packInto("<II", image, directories + 8 * DIR_IMPORT, descriptorRva, 40);
  packInto("<II", image, directories + 8 * DIR_BASERELOC, relocRva, reloc.length);
  packInto("<II", image, directories + 8 * DIR_IAT, iatRva, 24);
  const table = directories + 16 * 8;
  sections.forEach(([name, virtualSize, rva, offset, characteristics], index) => {
    packInto("<8sIIIIIIHHI", image, table + 40 * index, name, virtualSize, rva, FILE_ALIGN, offset, 0, 0, 0, 0, characteristics);
  });
  code.copy(image, textOff);
  rdata.copy(image, rdataOff);
  data.copy(image, dataOff);
  reloc.copy(image, relocOff);
  return image;
}

if (require.main === module) {
  writeFileSync(OUT, build());
  console.log(`wrote ${path.basename(OUT)}: ${statSync(OUT).size} bytes`);
}
