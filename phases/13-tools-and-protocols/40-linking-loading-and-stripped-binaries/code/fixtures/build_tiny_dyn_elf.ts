// Lesson: Linking, Loading, and Stripped Binaries: PLT, GOT, Imports, Fixups, and Function Identification (phase 13 / lesson 40)
// TypeScript port of code/fixtures/build_tiny_dyn_elf.py. Node standard library only.
// Source: phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures/build_tiny_dyn_elf.ts

import { statSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const HERE = __dirname;
const OUT = path.join(HERE, "tiny-dyn-x86_64");

const PAGE = 0x1000;
const IMPORTS = ["puts", "exit"];
const NEEDED = "libc.so.6";
const INTERP = Buffer.from("/lib64/ld-linux-x86-64.so.2\0", "latin1");
const MESSAGE = Buffer.from("linked by hand\0", "latin1");

const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const PT_INTERP = 3;
const PF_X = 1;
const PF_W = 2;
const PF_R = 4;
const SHT_PROGBITS = 1;
const SHT_STRTAB = 3;
const SHT_RELA = 4;
const SHT_HASH = 5;
const SHT_DYNAMIC = 6;
const SHT_DYNSYM = 11;
const SHF_WRITE = 0x1;
const SHF_ALLOC = 0x2;
const SHF_EXECINSTR = 0x4;
const SHF_INFO_LINK = 0x40;
const R_X86_64_JUMP_SLOT = 7;
const DT_NULL = 0;
const DT_NEEDED = 1;
const DT_PLTRELSZ = 2;
const DT_PLTGOT = 3;
const DT_HASH = 4;
const DT_STRTAB = 5;
const DT_SYMTAB = 6;
const DT_STRSZ = 10;
const DT_SYMENT = 11;
const DT_PLTREL = 20;
const DT_JMPREL = 23;
const DT_RELA = 7;
const DT_FLAGS_1 = 0x6ffffffb;
const DF_1_PIE = 0x08000000;

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

export function align(value: number, boundary: number): number {
  return (value + boundary - 1) & ~(boundary - 1);
}

export function sysvHash(name: string): number {
  let h = 0;
  for (const c of Buffer.from(name, "utf8")) {
    h = h * 16 + c;
    const g = (h & 0xf0000000) >>> 0;
    if (g) h = (h ^ (g >>> 24)) >>> 0;
    h = (h & ~g & 0xffffffff) >>> 0;
  }
  return h;
}

export function rel32(target: number, nextInstruction: number): Buffer {
  return pack("<i", target - nextInstruction);
}

export function build(): Buffer {
  const phnum = 4;
  const interpOff = 64 + 56 * phnum;
  const dynsymOff = align(interpOff + INTERP.length, 8);
  const dynsymSize = 24 * (1 + IMPORTS.length);
  const dynstrOff = dynsymOff + dynsymSize;
  let dynstr = Buffer.from([0]);
  const nameOffset = new Map<string, number>();
  for (const name of [...IMPORTS, NEEDED]) {
    nameOffset.set(name, dynstr.length);
    dynstr = Buffer.concat([dynstr, Buffer.from(name, "utf8"), bytes(0)]);
  }
  const hashOff = align(dynstrOff + dynstr.length, 8);
  const hashSize = 8 + 4 * 1 + 4 * (1 + IMPORTS.length);
  const relapltOff = align(hashOff + hashSize, 8);
  const relapltSize = 24 * IMPORTS.length;
  const pltOff = align(relapltOff + relapltSize, 16);
  const pltSize = 16 * (1 + IMPORTS.length);
  const textOff = pltOff + pltSize;
  const codeSize = 7 + 5 + 2 + 5 + 1;
  const rodataOff = align(textOff + codeSize, 8);
  const rxEnd = rodataOff + MESSAGE.length;
  const dynamicOff = PAGE;
  const dynamicCount = 12;
  const dynamicSize = 16 * dynamicCount;
  const gotpltOff = dynamicOff + dynamicSize;
  const gotpltSize = 8 * (3 + IMPORTS.length);
  const rwEnd = gotpltOff + gotpltSize;
  const sectionNames = [".interp", ".dynsym", ".dynstr", ".hash", ".rela.plt", ".plt", ".text", ".rodata", ".dynamic", ".got.plt", ".shstrtab"];
  let shstrtab = Buffer.from([0]);
  const shname = new Map<string, number>();
  for (const name of sectionNames) {
    shname.set(name, shstrtab.length);
    shstrtab = Buffer.concat([shstrtab, Buffer.from(name, "utf8"), bytes(0)]);
  }
  const shstrtabOff = rwEnd;
  const shoff = align(shstrtabOff + shstrtab.length, 8);
  const shnum = 1 + sectionNames.length;
  const image = Buffer.alloc(shoff + 64 * shnum);

  const pltEntry = (index: number): number => pltOff + 16 * (index + 1);
  const gotSlot = (index: number): number => gotpltOff + 24 + 8 * index;

  packInto("<16sHHIQQQIHHHHHH", image, 0, Buffer.concat([bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00), Buffer.alloc(8)]), 3, 62, 1, textOff, 64, shoff, 0, 64, 56, phnum, 64, shnum, shnum - 1);
  const phdrs: [number, number, number, number, number][] = [
    [PT_INTERP, PF_R, interpOff, INTERP.length, 1],
    [PT_LOAD, PF_R | PF_X, 0, rxEnd, PAGE],
    [PT_LOAD, PF_R | PF_W, PAGE, rwEnd - PAGE, PAGE],
    [PT_DYNAMIC, PF_R | PF_W, dynamicOff, dynamicSize, 8],
  ];
  phdrs.forEach(([pType, flags, offset, size, pAlign], index) => {
    packInto("<IIQQQQQQ", image, 64 + 56 * index, pType, flags, offset, offset, offset, size, size, pAlign);
  });
  INTERP.copy(image, interpOff);
  IMPORTS.forEach((name, k) => {
    packInto("<IBBHQQ", image, dynsymOff + 24 * (k + 1), nameOffset.get(name) ?? 0, 0x12, 0, 0, 0, 0);
  });
  dynstr.copy(image, dynstrOff);
  const nchain = 1 + IMPORTS.length;
  const chain: number[] = new Array(nchain).fill(0);
  let bucket = 0;
  for (let index = 1; index < nchain; index++) {
    chain[index] = bucket;
    bucket = index;
  }
  packInto(`<II${1}I${nchain}I`, image, hashOff, 1, nchain, bucket, ...chain);
  for (let index = 0; index < IMPORTS.length; index++) {
    packInto("<QQq", image, relapltOff + 24 * index, gotSlot(index), (BigInt(index + 1) << 32n) | BigInt(R_X86_64_JUMP_SLOT), 0);
  }
  const plt0 = Buffer.concat([bytes(0xff, 0x35), rel32(gotpltOff + 8, pltOff + 6), bytes(0xff, 0x25), rel32(gotpltOff + 16, pltOff + 12), bytes(0x0f, 0x1f, 0x40, 0x00)]);
  plt0.copy(image, pltOff);
  for (let index = 0; index < IMPORTS.length; index++) {
    const entry = pltEntry(index);
    const body = Buffer.concat([bytes(0xff, 0x25), rel32(gotSlot(index), entry + 6), bytes(0x68), pack("<I", index), bytes(0xe9), rel32(pltOff, entry + 16)]);
    body.copy(image, entry);
  }
  const code = Buffer.concat([
    bytes(0x48, 0x8d, 0x3d), rel32(rodataOff, textOff + 7),
    bytes(0xe8), rel32(pltEntry(0), textOff + 12),
    bytes(0x31, 0xff),
    bytes(0xe8), rel32(pltEntry(1), textOff + 19),
    bytes(0xf4),
  ]);
  if (code.length !== codeSize) throw new Error("assertion failed: code size");
  code.copy(image, textOff);
  MESSAGE.copy(image, rodataOff);
  const dynamic: [number, number][] = [
    [DT_NEEDED, nameOffset.get(NEEDED) ?? 0],
    [DT_HASH, hashOff],
    [DT_STRTAB, dynstrOff],
    [DT_SYMTAB, dynsymOff],
    [DT_STRSZ, dynstr.length],
    [DT_SYMENT, 24],
    [DT_PLTGOT, gotpltOff],
    [DT_PLTRELSZ, relapltSize],
    [DT_PLTREL, DT_RELA],
    [DT_JMPREL, relapltOff],
    [DT_FLAGS_1, DF_1_PIE],
    [DT_NULL, 0],
  ];
  if (dynamic.length !== dynamicCount) throw new Error("assertion failed: dynamic count");
  dynamic.forEach(([tag, value], index) => {
    packInto("<qQ", image, dynamicOff + 16 * index, tag, value);
  });
  const got = [dynamicOff, 0, 0, ...IMPORTS.map((_, index) => pltEntry(index) + 6)];
  packInto(`<${got.length}Q`, image, gotpltOff, ...got);
  shstrtab.copy(image, shstrtabOff);
  const dynsymIndex = 2;
  const dynstrIndex = 3;
  const gotpltIndex = 10;
  const sections: [string, number, number, number, number, number, number, number, number][] = [
    [".interp", SHT_PROGBITS, SHF_ALLOC, interpOff, INTERP.length, 0, 0, 1, 0],
    [".dynsym", SHT_DYNSYM, SHF_ALLOC, dynsymOff, dynsymSize, dynstrIndex, 1, 8, 24],
    [".dynstr", SHT_STRTAB, SHF_ALLOC, dynstrOff, dynstr.length, 0, 0, 1, 0],
    [".hash", SHT_HASH, SHF_ALLOC, hashOff, hashSize, dynsymIndex, 0, 8, 4],
    [".rela.plt", SHT_RELA, SHF_ALLOC | SHF_INFO_LINK, relapltOff, relapltSize, dynsymIndex, gotpltIndex, 8, 24],
    [".plt", SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, pltOff, pltSize, 0, 0, 16, 16],
    [".text", SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, textOff, codeSize, 0, 0, 16, 0],
    [".rodata", SHT_PROGBITS, SHF_ALLOC, rodataOff, MESSAGE.length, 0, 0, 1, 0],
    [".dynamic", SHT_DYNAMIC, SHF_ALLOC | SHF_WRITE, dynamicOff, dynamicSize, dynstrIndex, 0, 8, 16],
    [".got.plt", SHT_PROGBITS, SHF_ALLOC | SHF_WRITE, gotpltOff, gotpltSize, 0, 0, 8, 8],
    [".shstrtab", SHT_STRTAB, 0, shstrtabOff, shstrtab.length, 0, 0, 1, 0],
  ];
  sections.forEach(([name, shType, flags, offset, size, link, info, shAlign, entsize], k) => {
    const addr = flags === 0 ? 0 : offset;
    packInto("<IIQQQQIIQQ", image, shoff + 64 * (k + 1), shname.get(name) ?? 0, shType, flags, addr, offset, size, link, info, shAlign, entsize);
  });
  return image;
}

if (require.main === module) {
  writeFileSync(OUT, build());
  console.log(`wrote ${path.basename(OUT)}: ${statSync(OUT).size} bytes`);
}
