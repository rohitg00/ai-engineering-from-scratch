// Lesson: Program Anatomy: An ELF Reader From Scratch (phase 13 / lesson 32)
// TypeScript port of code/fixtures/build_tiny_elf.py. Node standard library only.
// Source: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code/fixtures/build_tiny_elf.ts

import { writeFileSync } from "node:fs";
import * as path from "node:path";

const BASE = 0x400000;
const PAGE = 0x1000;
const EHDR_SIZE = 64;
const PHDR_SIZE = 56;
const SHDR_SIZE = 64;
const SYM_SIZE = 24;

const PT_LOAD = 1;
const PT_GNU_STACK = 0x6474e551;
const PF_X = 1;
const PF_W = 2;
const PF_R = 4;

const SHT_PROGBITS = 1;
const SHT_SYMTAB = 2;
const SHT_STRTAB = 3;
const SHF_ALLOC = 2;
const SHF_EXECINSTR = 4;

const STB_LOCAL = 0;
const STB_GLOBAL = 1;
const STT_OBJECT = 1;
const STT_FUNC = 2;

function stringTable(names: string[]): [Buffer, Map<string, number>] {
  const parts: Buffer[] = [Buffer.from([0])];
  let length = 1;
  const offsets = new Map<string, number>([["", 0]]);
  for (const name of names) {
    offsets.set(name, length);
    const bytes = Buffer.concat([Buffer.from(name, "ascii"), Buffer.from([0])]);
    parts.push(bytes);
    length += bytes.length;
  }
  return [Buffer.concat(parts), offsets];
}

function align(value: number, boundary: number): number {
  return Math.floor((value + boundary - 1) / boundary) * boundary;
}

function u16(value: number): Buffer {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
}

function u32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value);
  return out;
}

function i32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeInt32LE(value);
  return out;
}

function u64(value: number): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

function sym(name: number, info: number, other: number, shndx: number, value: number, size: number): Buffer {
  return Buffer.concat([u32(name), Buffer.from([info, other]), u16(shndx), u64(value), u64(size)]);
}

function rawShdr(values: number[]): Buffer {
  const [name, type, flags, addr, offset, size, link, info, addralign, entsize] = values;
  return Buffer.concat([
    u32(name), u32(type), u64(flags), u64(addr), u64(offset), u64(size), u32(link), u32(info), u64(addralign), u64(entsize),
  ]);
}

function phdr(type: number, flags: number, values: number[]): Buffer {
  return Buffer.concat([u32(type), u32(flags), ...values.map((value) => u64(value))]);
}

function build(): Buffer {
  const phdrOff = EHDR_SIZE;
  const textOff = phdrOff + 2 * PHDR_SIZE;
  const message = Buffer.from("ok\n", "ascii");
  const codeWithoutLea = 5 + 7 + 5 + 5 + 2 + 5 + 5 + 2;
  const rodataOff = textOff + codeWithoutLea;
  const leaEnd = textOff + 5 + 7;
  const disp = rodataOff - leaEnd;
  const code = Buffer.concat([
    Buffer.from([0xbf, 0x01, 0x00, 0x00, 0x00]),
    Buffer.concat([Buffer.from([0x48, 0x8d, 0x35]), i32(disp)]),
    Buffer.concat([Buffer.from([0xba]), u32(message.length)]),
    Buffer.from([0xb8, 0x01, 0x00, 0x00, 0x00]),
    Buffer.from([0x0f, 0x05]),
    Buffer.from([0xbf, 0x2a, 0x00, 0x00, 0x00]),
    Buffer.from([0xb8, 0x3c, 0x00, 0x00, 0x00]),
    Buffer.from([0x0f, 0x05]),
  ]);
  if (code.length !== codeWithoutLea) throw new Error("AssertionError");
  const [strtab, strOff] = stringTable(["message", "_start"]);
  const [shstrtab, shOff] = stringTable([".text", ".rodata", ".symtab", ".strtab", ".shstrtab"]);

  const symtabOff = align(rodataOff + message.length, 8);
  const symbols = [
    sym(0, 0, 0, 0, 0, 0),
    sym(strOff.get("message") as number, (STB_LOCAL << 4) | STT_OBJECT, 0, 2, BASE + rodataOff, message.length),
    sym(strOff.get("_start") as number, (STB_GLOBAL << 4) | STT_FUNC, 0, 1, BASE + textOff, code.length),
  ];
  const symtab = Buffer.concat(symbols);
  const strtabOff = symtabOff + symtab.length;
  const shstrtabOff = strtabOff + strtab.length;
  const shdrOff = align(shstrtabOff + shstrtab.length, 8);
  const fileSize = shdrOff + 6 * SHDR_SIZE;

  const shdr = (
    name: string,
    shType: number,
    flags: number,
    addr: number,
    offset: number,
    size: number,
    link: number = 0,
    info: number = 0,
    addralign: number = 1,
    entsize: number = 0,
  ): Buffer => rawShdr([shOff.get(name) as number, shType, flags, addr, offset, size, link, info, addralign, entsize]);

  const sectionHeaders = Buffer.concat([
    rawShdr([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    shdr(".text", SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, BASE + textOff, textOff, code.length, 0, 0, 16),
    shdr(".rodata", SHT_PROGBITS, SHF_ALLOC, BASE + rodataOff, rodataOff, message.length),
    shdr(".symtab", SHT_SYMTAB, 0, 0, symtabOff, symtab.length, 4, 2, 8, SYM_SIZE),
    shdr(".strtab", SHT_STRTAB, 0, 0, strtabOff, strtab.length),
    shdr(".shstrtab", SHT_STRTAB, 0, 0, shstrtabOff, shstrtab.length),
  ]);
  const ident = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]), Buffer.alloc(8)]);
  const ehdr = Buffer.concat([
    ident,
    u16(2), u16(62), u32(1), u64(BASE + textOff), u64(phdrOff), u64(shdrOff), u32(0),
    u16(EHDR_SIZE), u16(PHDR_SIZE), u16(2), u16(SHDR_SIZE), u16(6), u16(5),
  ]);
  const load = phdr(PT_LOAD, PF_R | PF_X, [0, BASE, BASE, fileSize, fileSize, PAGE]);
  const stack = phdr(PT_GNU_STACK, PF_R | PF_W, [0, 0, 0, 0, 0, 16]);

  const out = Buffer.alloc(fileSize);
  ehdr.copy(out, 0);
  Buffer.concat([load, stack]).copy(out, phdrOff);
  code.copy(out, textOff);
  message.copy(out, rodataOff);
  symtab.copy(out, symtabOff);
  strtab.copy(out, strtabOff);
  shstrtab.copy(out, shstrtabOff);
  sectionHeaders.copy(out, shdrOff);
  return out;
}

const target = path.join(__dirname, "tiny-x86_64");
const data = build();
writeFileSync(target, data);
console.log(`wrote ${path.basename(target)}: ${data.length} bytes, entry 0x${(BASE + EHDR_SIZE + 2 * PHDR_SIZE).toString(16)}`);
