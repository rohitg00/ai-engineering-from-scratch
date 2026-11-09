// Lesson: Linking, Loading, and Stripped Binaries: PLT, GOT, Imports, Fixups, and Function Identification (phase 13 / lesson 40)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/main.ts

import { readFileSync } from "node:fs";
import * as path from "node:path";

export const HERE = __dirname;
export const FIXTURES = path.join(HERE, "fixtures");

type Dict = Record<string, unknown>;

export class FormatError extends Error {}

function cstring(table: Buffer, offset: number): string {
  const end = table.indexOf(0, offset);
  return table.subarray(offset, end >= 0 ? end : table.length).toString("utf8");
}

function asciiDecode(raw: Buffer): string {
  let out = "";
  for (const byte of raw) out += byte < 0x80 ? String.fromCharCode(byte) : "�";
  return out;
}

function rstripNul(raw: Buffer): Buffer {
  let end = raw.length;
  while (end > 0 && raw[end - 1] === 0) end -= 1;
  return raw.subarray(0, end);
}

function hex(value: number | bigint): string {
  return "0x" + value.toString(16);
}

function u8(data: Buffer, offset: number): number {
  return data.readUInt8(offset);
}

function u16(data: Buffer, offset: number): number {
  return data.readUInt16LE(offset);
}

function i16(data: Buffer, offset: number): number {
  return data.readInt16LE(offset);
}

function u32(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset);
}

function i32(data: Buffer, offset: number): number {
  return data.readInt32LE(offset);
}

function u64n(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

function i64(data: Buffer, offset: number): number {
  return Number(data.readBigInt64LE(offset));
}

function bytesEqual(data: Buffer, start: number, expected: number[]): boolean {
  for (let k = 0; k < expected.length; k++) {
    if (data[start + k] !== expected[k]) return false;
  }
  return true;
}

function setDefault<K, V>(table: Map<K, V[]>, key: K): V[] {
  let rows = table.get(key);
  if (rows === undefined) {
    rows = [];
    table.set(key, rows);
  }
  return rows;
}

function mapToObject<V, R>(table: Map<string, V>, convert: (value: V) => R): Record<string, R> {
  const out: Record<string, R> = {};
  for (const [key, value] of table) out[key] = convert(value);
  return out;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pick(source: Dict, keys: string[]): Dict {
  const out: Dict = {};
  for (const [key, value] of Object.entries(source)) {
    if (keys.includes(key)) out[key] = value;
  }
  return out;
}

function splitWs(text: string): string[] {
  const trimmed = text.trim();
  return trimmed === "" ? [] : trimmed.split(/\s+/);
}

function splitMax(text: string, maxsplit: number): string[] {
  const parts: string[] = [];
  let rest = text.replace(/^\s+/, "");
  while (rest !== "" && parts.length < maxsplit) {
    const match = /\s+/.exec(rest);
    if (match === null) break;
    parts.push(rest.slice(0, match.index));
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest !== "") parts.push(rest);
  return parts;
}

function splitlines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|[\n\r\x0b\x0c\x1c-\x1e\x85\u2028\u2029]/);
  if (/[\n\r\x0b\x0c\x1c-\x1e\x85\u2028\u2029]$/.test(text)) lines.pop();
  return lines;
}

function isDigits(text: string): boolean {
  return /^[0-9]+$/.test(text);
}

function pyJson(value: unknown, indent?: number): string {
  const text = indent === undefined ? JSON.stringify(value) : JSON.stringify(value, null, indent);
  return text.replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function readUleb128(data: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  while (true) {
    const byte = data[offset];
    offset += 1;
    value += (byte & 0x7f) * 2 ** shift;
    shift += 7;
    if (!(byte & 0x80)) return [value, offset];
  }
}

export function crc16(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let crc = 0xffff;
  for (let byte of data) {
    for (let k = 0; k < 8; k++) {
      if ((crc ^ byte) & 1) {
        crc = (crc >> 1) ^ 0x8408;
      } else {
        crc >>= 1;
      }
      byte >>= 1;
    }
  }
  crc = ~crc & 0xffff;
  return ((crc << 8) | (crc >> 8)) & 0xffff;
}

function hexbytes(data: Uint8Array): string {
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function signed(value: number, bits: number): number {
  return value >= 2 ** (bits - 1) ? value - 2 ** bits : value;
}

const SHT_SYMTAB = 2;
const SHT_RELA = 4;
const SHT_NOBITS = 8;
const SHT_DYNSYM = 11;
const STT_SECTION = 3;
const STT_FUNC = 2;
const SHN_UNDEF = 0;
const PT_DYNAMIC = 2;
const ET_REL = 1;
const ET_EXEC = 2;
const ET_DYN = 3;

const ELF_RELOCATION_NAMES = new Map<number, string>([
  [0, "R_X86_64_NONE"], [1, "R_X86_64_64"], [2, "R_X86_64_PC32"], [3, "R_X86_64_GOT32"], [4, "R_X86_64_PLT32"], [5, "R_X86_64_COPY"],
  [6, "R_X86_64_GLOB_DAT"], [7, "R_X86_64_JUMP_SLOT"], [8, "R_X86_64_RELATIVE"], [9, "R_X86_64_GOTPCREL"], [10, "R_X86_64_32"],
  [11, "R_X86_64_32S"], [24, "R_X86_64_PC64"], [26, "R_X86_64_GOTPC32"], [37, "R_X86_64_IRELATIVE"], [41, "R_X86_64_GOTPCRELX"],
  [42, "R_X86_64_REX_GOTPCRELX"],
]);
const ELF_RELOCATION_FORMULAS = new Map<number, string>([
  [1, "S + A"], [2, "S + A - P"], [3, "G + A"], [4, "L + A - P"], [6, "S"], [7, "S"], [8, "B + A"], [9, "G + GOT + A - P"], [10, "S + A"],
  [11, "S + A"], [24, "S + A - P"], [26, "GOT + A - P"], [37, "indirect (B + A)"], [41, "G + GOT + A - P"], [42, "G + GOT + A - P"],
]);
const DYNAMIC_TAG_NAMES = new Map<number, string>([
  [0, "DT_NULL"], [1, "DT_NEEDED"], [2, "DT_PLTRELSZ"], [3, "DT_PLTGOT"], [4, "DT_HASH"], [5, "DT_STRTAB"], [6, "DT_SYMTAB"], [7, "DT_RELA"],
  [8, "DT_RELASZ"], [9, "DT_RELAENT"], [10, "DT_STRSZ"], [11, "DT_SYMENT"], [12, "DT_INIT"], [13, "DT_FINI"], [14, "DT_SONAME"],
  [15, "DT_RPATH"], [16, "DT_SYMBOLIC"], [17, "DT_REL"], [18, "DT_RELSZ"], [19, "DT_RELENT"], [20, "DT_PLTREL"], [21, "DT_DEBUG"],
  [22, "DT_TEXTREL"], [23, "DT_JMPREL"], [24, "DT_BIND_NOW"], [25, "DT_INIT_ARRAY"], [26, "DT_FINI_ARRAY"], [27, "DT_INIT_ARRAYSZ"],
  [28, "DT_FINI_ARRAYSZ"], [29, "DT_RUNPATH"], [30, "DT_FLAGS"], [32, "DT_PREINIT_ARRAY"], [33, "DT_PREINIT_ARRAYSZ"], [36, "DT_RELR"],
  [0x6ffffef5, "DT_GNU_HASH"], [0x6ffffff0, "DT_VERSYM"], [0x6ffffff9, "DT_RELACOUNT"], [0x6ffffffb, "DT_FLAGS_1"],
  [0x6ffffffc, "DT_VERDEF"], [0x6ffffffd, "DT_VERDEFNUM"], [0x6ffffffe, "DT_VERNEED"], [0x6fffffff, "DT_VERNEEDNUM"],
]);
const DT_NEEDED = 1;
const DT_PLTRELSZ = 2;
const DT_PLTGOT = 3;
const DT_STRTAB = 5;
const DT_PLTREL = 20;
const DT_JMPREL = 23;
const DT_FLAGS_1 = 0x6ffffffb;
const DF_1_NOW = 0x1;
const DF_1_PIE = 0x08000000;
const PF_NAMES: [number, string][] = [[4, "r"], [2, "w"], [1, "x"]];
const PT_NAMES = new Map<number, string>([
  [1, "PT_LOAD"], [2, "PT_DYNAMIC"], [3, "PT_INTERP"], [4, "PT_NOTE"], [6, "PT_PHDR"], [0x6474e550, "PT_GNU_EH_FRAME"], [0x6474e551, "PT_GNU_STACK"], [0x6474e552, "PT_GNU_RELRO"],
]);

export class ElfSection {
  constructor(
    readonly index: number,
    readonly name: string,
    readonly type: number,
    readonly flags: number,
    readonly addr: number,
    readonly offset: number,
    readonly size: number,
    readonly link: number,
    readonly info: number,
    readonly entsize: number,
    readonly data: Buffer,
  ) {}
}

export class ElfSymbol {
  constructor(
    readonly name: string,
    readonly value: number,
    readonly size: number,
    readonly type: number,
    readonly bind: number,
    readonly shndx: number,
    readonly section: string,
  ) {}

  get defined(): boolean {
    return this.shndx !== SHN_UNDEF;
  }
}

export class ElfRelocation {
  constructor(
    readonly section: string,
    readonly offset: number,
    readonly type: number,
    readonly symbol: ElfSymbol,
    readonly addend: number,
  ) {}

  get typeName(): string {
    return ELF_RELOCATION_NAMES.get(this.type) ?? `R_X86_64_${this.type}`;
  }

  get symbolName(): string {
    return this.symbol.type === STT_SECTION ? this.symbol.section : this.symbol.name;
  }

  describe(): string {
    if (this.addend === 0) return `${this.typeName} ${this.symbolName}`;
    const sign = this.addend > 0 ? "+" : "-";
    return `${this.typeName} ${this.symbolName}${sign}0x${Math.abs(this.addend).toString(16)}`;
  }
}

export class ProgramHeader {
  constructor(
    readonly type: number,
    readonly flags: number,
    readonly offset: number,
    readonly vaddr: number,
    readonly filesz: number,
    readonly memsz: number,
    readonly align: number,
  ) {}

  get typeName(): string {
    return PT_NAMES.get(this.type) ?? hex(this.type);
  }

  get flagsText(): string {
    return PF_NAMES.map(([bit, letter]) => (this.flags & bit ? letter : "-")).join("");
  }
}

export class DynamicEntry {
  constructor(readonly tag: number, readonly value: number, readonly text: string) {}

  get tagName(): string {
    return DYNAMIC_TAG_NAMES.get(this.tag) ?? hex(this.tag);
  }
}

export class PltEntry {
  constructor(
    readonly index: number,
    readonly address: number,
    readonly raw: Buffer,
    readonly slot: number,
    readonly pushIndex: number,
    readonly plt0: number,
    readonly slotInitial: number,
    readonly symbol: string,
  ) {}

  lines(): string[] {
    return [
      `jmpq *${hex(this.slot - (this.address + 6))}(%rip)   -> GOT slot ${hex(this.slot)}`,
      `pushq $${hex(this.pushIndex)}   (index into DT_JMPREL)`,
      `jmp ${hex(this.plt0)} <.plt>   (PLT0, into the dynamic linker)`,
    ];
  }
}

export interface Plt0 {
  address: number;
  bytes: string;
  pushes: number;
  jumpsThrough: number;
  lines: string[];
}

export class ElfFile {
  readonly data: Buffer;
  readonly type: number;
  readonly machine: number;
  readonly entry: number;
  readonly programHeaders: ProgramHeader[] = [];
  readonly sections: ElfSection[] = [];
  readonly symbolTables = new Map<number, ElfSymbol[]>();
  readonly relocations: Map<string, ElfRelocation[]>;

  constructor(data: Buffer) {
    if (!bytesEqual(data, 0, [0x7f, 0x45, 0x4c, 0x46])) throw new FormatError("not an ELF file");
    if (data[4] !== 2 || data[5] !== 1) throw new FormatError("only ELF64 little-endian files are supported");
    this.data = data;
    this.type = u16(data, 16);
    this.machine = u16(data, 18);
    this.entry = u64(data, 24);
    const phoff = u64(data, 32);
    const shoff = u64(data, 40);
    const phentsize = u16(data, 54);
    const phnum = u16(data, 56);
    const shentsize = u16(data, 58);
    const shnum = u16(data, 60);
    const shstrndx = u16(data, 62);
    for (let index = 0; index < phnum; index++) {
      const base = phoff + index * phentsize;
      this.programHeaders.push(new ProgramHeader(u32(data, base), u32(data, base + 4), u64(data, base + 8), u64(data, base + 16), u64(data, base + 32), u64(data, base + 40), u64(data, base + 48)));
    }
    const rawHeaders: number[][] = [];
    for (let index = 0; index < shnum; index++) {
      const base = shoff + index * shentsize;
      rawHeaders.push([u32(data, base), u32(data, base + 4), u64(data, base + 8), u64(data, base + 16), u64(data, base + 24), u64(data, base + 32), u32(data, base + 40), u32(data, base + 44), u64(data, base + 48), u64(data, base + 56)]);
    }
    const names = shnum ? rawHeaders[shstrndx] : null;
    const nameTable = names ? data.subarray(names[4], names[4] + names[5]) : Buffer.alloc(0);
    rawHeaders.forEach((raw, index) => {
      const [shName, shType, shFlags, shAddr, shOffset, shSize, shLink, shInfo, , shEntsize] = raw;
      const payload = shType === SHT_NOBITS ? Buffer.alloc(0) : data.subarray(shOffset, shOffset + shSize);
      this.sections.push(new ElfSection(index, cstring(nameTable, shName), shType, shFlags, shAddr, shOffset, shSize, shLink, shInfo, shEntsize, payload));
    });
    for (const s of this.sections) {
      if (s.type === SHT_SYMTAB || s.type === SHT_DYNSYM) this.symbolTables.set(s.index, this.readSymbols(s));
    }
    this.relocations = this.readRelocations();
  }

  get typeName(): string {
    return new Map([[ET_REL, "ET_REL"], [ET_EXEC, "ET_EXEC"], [ET_DYN, "ET_DYN"]]).get(this.type) ?? hex(this.type);
  }

  private readSymbols(section: ElfSection): ElfSymbol[] {
    const strings = this.sections[section.link].data;
    const symbols: ElfSymbol[] = [];
    for (let offset = 0; offset < section.size; offset += 24) {
      const d = section.data;
      const stName = u32(d, offset);
      const stInfo = u8(d, offset + 4);
      const stShndx = u16(d, offset + 6);
      const stValue = u64(d, offset + 8);
      const stSize = u64(d, offset + 16);
      const sectionName = stShndx < this.sections.length ? this.sections[stShndx].name : "";
      symbols.push(new ElfSymbol(cstring(strings, stName), stValue, stSize, stInfo & 0xf, stInfo >> 4, stShndx, sectionName));
    }
    return symbols;
  }

  private readRelocations(): Map<string, ElfRelocation[]> {
    const table = new Map<string, ElfRelocation[]>();
    for (const section of this.sections) {
      if (section.type !== SHT_RELA) continue;
      const target = section.info < this.sections.length ? this.sections[section.info].name : section.name;
      const symbols = this.symbolTables.get(section.link) ?? [];
      for (let offset = 0; offset < section.size; offset += 24) {
        const rOffset = u64(section.data, offset);
        const rInfo = u64n(section.data, offset + 8);
        const rAddend = i64(section.data, offset + 16);
        const symbol = symbols[Number(rInfo >> 32n)];
        setDefault(table, this.type !== ET_REL ? section.name : target).push(new ElfRelocation(target, rOffset, Number(rInfo & 0xffffffffn), symbol, rAddend));
      }
    }
    return table;
  }

  get symbols(): ElfSymbol[] {
    for (const section of this.sections) {
      if (section.type === SHT_SYMTAB) return this.symbolTables.get(section.index) ?? [];
    }
    return [];
  }

  get dynamicSymbols(): ElfSymbol[] {
    for (const section of this.sections) {
      if (section.type === SHT_DYNSYM) return this.symbolTables.get(section.index) ?? [];
    }
    return [];
  }

  section(name: string): ElfSection {
    for (const section of this.sections) {
      if (section.name === name) return section;
    }
    throw new FormatError(`no section named ${name}`);
  }

  vaddrToOffset(address: number): number {
    for (const header of this.programHeaders) {
      if (header.type === 1 && header.vaddr <= address && address < header.vaddr + header.filesz) return address - header.vaddr + header.offset;
    }
    throw new FormatError(`address ${hex(address)} is in no PT_LOAD segment`);
  }

  read(address: number, size: number): Buffer {
    const offset = this.vaddrToOffset(address);
    return this.data.subarray(offset, offset + size);
  }

  dynamicEntries(): DynamicEntry[] {
    const header = this.programHeaders.find((h) => h.type === PT_DYNAMIC);
    if (header === undefined) return [];
    const raw: [number, number][] = [];
    for (let offset = header.offset; offset < header.offset + header.filesz; offset += 16) {
      const tag = i64(this.data, offset);
      const value = u64(this.data, offset + 8);
      raw.push([tag, value]);
      if (tag === 0) break;
    }
    const strtabEntry = raw.find(([t]) => t === DT_STRTAB);
    const strtab = strtabEntry === undefined ? null : strtabEntry[1];
    const entries: DynamicEntry[] = [];
    for (const [tag, value] of raw) {
      let text = hex(value);
      if (tag === DT_NEEDED && strtab !== null) {
        text = cstring(this.data, this.vaddrToOffset(strtab) + value);
      } else if (tag === DT_PLTREL) {
        text = new Map([[7, "RELA"], [17, "REL"]]).get(value) ?? hex(value);
      } else if (tag === DT_FLAGS_1) {
        const flagNames = ([[DF_1_NOW, "DF_1_NOW"], [DF_1_PIE, "DF_1_PIE"]] as [number, string][]).filter(([bit]) => value & bit).map(([, n]) => n);
        text = flagNames.join(" ") || hex(value);
      }
      entries.push(new DynamicEntry(tag, value, text));
    }
    return entries;
  }

  dynamic(tag: number): number | null {
    for (const entry of this.dynamicEntries()) {
      if (entry.tag === tag) return entry.value;
    }
    return null;
  }

  jumpSlots(): ElfRelocation[] {
    const jmprel = this.dynamic(DT_JMPREL);
    const size = this.dynamic(DT_PLTRELSZ);
    if (jmprel === null || size === null) return [];
    const symbols = this.dynamicSymbols;
    const slots: ElfRelocation[] = [];
    const base = this.vaddrToOffset(jmprel);
    for (let offset = base; offset < base + size; offset += 24) {
      const rOffset = u64(this.data, offset);
      const rInfo = u64n(this.data, offset + 8);
      const rAddend = i64(this.data, offset + 16);
      slots.push(new ElfRelocation(".got.plt", rOffset, Number(rInfo & 0xffffffffn), symbols[Number(rInfo >> 32n)], rAddend));
    }
    return slots;
  }

  pltEntries(): PltEntry[] {
    const plt = this.section(".plt");
    const slots = new Map<number, string>();
    for (const r of this.jumpSlots()) slots.set(r.offset, r.symbolName);
    const entries: PltEntry[] = [];
    for (let index = 0; index < Math.floor(plt.size / 16) - 1; index++) {
      const address = plt.addr + 16 * (index + 1);
      const raw = plt.data.subarray(16 * (index + 1), 16 * (index + 2));
      if (!bytesEqual(raw, 0, [0xff, 0x25]) || raw[6] !== 0x68 || raw[11] !== 0xe9) throw new FormatError(`PLT entry at ${hex(address)} does not match Figure 5.2`);
      const slot = address + 6 + i32(raw, 2);
      const pushIndex = u32(raw, 7);
      const plt0 = address + 16 + i32(raw, 12);
      const initial = u64(this.read(slot, 8), 0);
      entries.push(new PltEntry(index, address, raw, slot, pushIndex, plt0, initial, slots.get(slot) ?? "?"));
    }
    return entries;
  }

  plt0(): Plt0 {
    const plt = this.section(".plt");
    const raw = plt.data.subarray(0, 16);
    if (!bytesEqual(raw, 0, [0xff, 0x35]) || !bytesEqual(raw, 6, [0xff, 0x25])) throw new FormatError("PLT0 does not match Figure 5.2");
    const got8 = plt.addr + 6 + i32(raw, 2);
    const got16 = plt.addr + 12 + i32(raw, 8);
    return { address: plt.addr, bytes: hexbytes(raw), pushes: got8, jumpsThrough: got16, lines: [`pushq ${hex(got8)}(%rip)   (GOT[1], the link_map)`, `jmpq *${hex(got16)}(%rip)   (GOT[2], the resolver)`, "nopl (%rax)"] };
  }

  gotPltWords(): bigint[] {
    const got = this.section(".got.plt");
    const words: bigint[] = [];
    for (let k = 0; k < Math.floor(got.size / 8); k++) words.push(u64n(got.data, 8 * k));
    return words;
  }

  functions(section = ".text"): ElfSymbol[] {
    return this.symbols.filter((s) => s.type === STT_FUNC && s.section === section).sort((a, b) => a.value - b.value);
  }
}

export function loadElf(name: string): ElfFile {
  return new ElfFile(readFileSync(path.join(FIXTURES, name)));
}

export class LinkDecision {
  constructor(readonly object: string, readonly relocation: ElfRelocation, readonly kind: string, readonly outcome: string) {}

  toDict(): Dict {
    return { object: this.object, section: this.relocation.section, offset: hex(this.relocation.offset), relocation: this.relocation.describe(), kind: this.kind, outcome: this.outcome };
  }
}

export function planDynamicLink(objects: Map<string, ElfFile>): Dict {
  const defined = new Set<string>();
  for (const elf of objects.values()) {
    for (const s of elf.symbols) {
      if (s.defined && s.name && s.type !== STT_SECTION) defined.add(s.name);
    }
  }
  const decisions: LinkDecision[] = [];
  const pltSymbols: string[] = [];
  for (const [objectName, elf] of objects) {
    for (const relocations of elf.relocations.values()) {
      for (const relocation of relocations) {
        const name = relocation.symbolName;
        const isDefined = relocation.symbol.defined || defined.has(name);
        let kind: string;
        let outcome: string;
        if (relocation.type === 4) {
          if (isDefined) {
            kind = "direct";
            outcome = "the link editor writes S + A - P into the call: no PLT entry (the PLT32 to PC32 reduction)";
          } else {
            kind = "plt";
            outcome = "a 16-byte PLT entry, an 8-byte .got.plt slot, and one R_X86_64_JUMP_SLOT in .rela.plt";
            if (!pltSymbols.includes(name)) pltSymbols.push(name);
          }
        } else if (relocation.type === 2) {
          [kind, outcome] = isDefined ? ["in-place", "the link editor writes S + A - P: the distance is fixed inside the image"] : ["error", "a PC32 against an undefined symbol cannot be used in a PIE"];
        } else if (relocation.type === 1) {
          [kind, outcome] = isDefined ? ["relative", "an 8-byte field that needs the load base: one R_X86_64_RELATIVE (B + A) in .rela.dyn"] : ["dynamic-64", "one R_X86_64_64 dynamic relocation against the symbol in .rela.dyn"];
        } else if (relocation.type === 41 || relocation.type === 42 || relocation.type === 9) {
          [kind, outcome] = ["got", "an 8-byte .got slot and one R_X86_64_GLOB_DAT; relaxed to a direct lea or call when the symbol is local (psABI Appendix B)"];
        } else if (relocation.type === 10 || relocation.type === 11) {
          [kind, outcome] = ["error", "a 32-bit absolute field cannot hold a PIE address"];
        } else {
          [kind, outcome] = ["other", ELF_RELOCATION_FORMULAS.get(relocation.type) ?? "see Table 4.9"];
        }
        decisions.push(new LinkDecision(objectName, relocation, kind, outcome));
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const decision of decisions) counts[decision.kind] = (counts[decision.kind] ?? 0) + 1;
  const n = pltSymbols.length;
  const relatives = counts["relative"] ?? 0;
  return {
    objects: [...objects.keys()],
    decisions: decisions.map((d) => d.toDict()),
    counts,
    pltSymbols,
    sizes: { ".plt": 16 * (n + 1), ".got.plt": 8 * (n + 3), ".rela.plt": 24 * n, ".rela.dyn": 24 * relatives },
    dynamicTags: ["DT_NEEDED", "DT_STRTAB", "DT_SYMTAB", "DT_STRSZ", "DT_SYMENT", "DT_PLTGOT", "DT_PLTRELSZ", "DT_PLTREL", "DT_JMPREL"].concat(relatives ? ["DT_RELA", "DT_RELASZ", "DT_RELAENT", "DT_RELACOUNT"] : [], ["DT_FLAGS_1"]),
    jumpSlots: pltSymbols.map((name) => `R_X86_64_JUMP_SLOT ${name}`),
  };
}

const IMAGE_FILE_MACHINE_NAMES = new Map<number, string>([[0x8664, "IMAGE_FILE_MACHINE_AMD64"], [0xaa64, "IMAGE_FILE_MACHINE_ARM64"], [0x14c, "IMAGE_FILE_MACHINE_I386"]]);
const COFF_RELOCATION_NAMES = new Map<number, string>([
  [0, "IMAGE_REL_AMD64_ABSOLUTE"], [1, "IMAGE_REL_AMD64_ADDR64"], [2, "IMAGE_REL_AMD64_ADDR32"], [3, "IMAGE_REL_AMD64_ADDR32NB"],
  [4, "IMAGE_REL_AMD64_REL32"], [5, "IMAGE_REL_AMD64_REL32_1"], [6, "IMAGE_REL_AMD64_REL32_2"], [7, "IMAGE_REL_AMD64_REL32_3"],
  [8, "IMAGE_REL_AMD64_REL32_4"], [9, "IMAGE_REL_AMD64_REL32_5"], [10, "IMAGE_REL_AMD64_SECTION"], [11, "IMAGE_REL_AMD64_SECREL"],
]);
const IMAGE_SCN_FLAGS: [number, string][] = [
  [0x00000020, "CNT_CODE"], [0x00000040, "CNT_INITIALIZED_DATA"], [0x00000080, "CNT_UNINITIALIZED_DATA"], [0x00000800, "LNK_REMOVE"],
  [0x00001000, "LNK_COMDAT"], [0x02000000, "MEM_DISCARDABLE"], [0x20000000, "MEM_EXECUTE"], [0x40000000, "MEM_READ"], [0x80000000, "MEM_WRITE"],
];
const DLL_CHARACTERISTICS: [number, string][] = [
  [0x0020, "HIGH_ENTROPY_VA"], [0x0040, "DYNAMIC_BASE"], [0x0080, "FORCE_INTEGRITY"], [0x0100, "NX_COMPAT"], [0x0200, "NO_ISOLATION"],
  [0x0400, "NO_SEH"], [0x0800, "NO_BIND"], [0x1000, "APPCONTAINER"], [0x2000, "WDM_DRIVER"], [0x4000, "GUARD_CF"], [0x8000, "TERMINAL_SERVER_AWARE"],
];
const DATA_DIRECTORY_NAMES = ["Export", "Import", "Resource", "Exception", "Certificate", "Base Relocation", "Debug", "Architecture", "Global Ptr", "TLS", "Load Config", "Bound Import", "IAT", "Delay Import", "CLR Runtime Header", "Reserved"];
const BASE_RELOCATION_NAMES = new Map<number, string>([[0, "IMAGE_REL_BASED_ABSOLUTE"], [3, "IMAGE_REL_BASED_HIGHLOW"], [10, "IMAGE_REL_BASED_DIR64"]]);

export class CoffSymbol {
  constructor(
    readonly index: number,
    readonly name: string,
    readonly value: number,
    readonly sectionNumber: number,
    readonly type: number,
    readonly storageClass: number,
    readonly aux: Buffer[],
  ) {}
}

export class CoffRelocation {
  constructor(readonly section: string, readonly offset: number, readonly symbolIndex: number, readonly type: number, readonly symbolName: string) {}

  get typeName(): string {
    return COFF_RELOCATION_NAMES.get(this.type) ?? hex(this.type);
  }
}

export class CoffSection {
  constructor(
    readonly number: number,
    readonly name: string,
    readonly virtualSize: number,
    readonly virtualAddress: number,
    readonly rawSize: number,
    readonly rawOffset: number,
    readonly relocOffset: number,
    readonly relocCount: number,
    readonly characteristics: number,
    readonly data: Buffer,
  ) {}

  flagNames(): string[] {
    return IMAGE_SCN_FLAGS.filter(([bit]) => this.characteristics & bit).map(([, name]) => name);
  }
}

export class CoffObject {
  readonly data: Buffer;
  readonly machine: number;
  readonly timestamp: number;
  readonly characteristics: number;
  readonly symtabOffset: number;
  readonly symbolCount: number;
  readonly stringTable: Buffer;
  readonly sections: CoffSection[] = [];
  readonly symbols: CoffSymbol[];
  readonly relocations: Map<string, CoffRelocation[]>;

  constructor(data: Buffer) {
    this.data = data;
    const machine = u16(data, 0);
    const nsections = u16(data, 2);
    const symtab = u32(data, 8);
    const nsymbols = u32(data, 12);
    const optionalSize = u16(data, 16);
    if (!IMAGE_FILE_MACHINE_NAMES.has(machine) || optionalSize !== 0) throw new FormatError("not a COFF object this reader knows");
    this.machine = machine;
    this.timestamp = u32(data, 4);
    this.characteristics = u16(data, 18);
    this.symtabOffset = symtab;
    this.symbolCount = nsymbols;
    const stringsOffset = symtab + 18 * nsymbols;
    const stringsSize = symtab ? u32(data, stringsOffset) : 4;
    this.stringTable = data.subarray(stringsOffset, stringsOffset + stringsSize);
    for (let index = 0; index < nsections; index++) {
      const base = 20 + optionalSize + 40 * index;
      let name = asciiDecode(rstripNul(data.subarray(base, base + 8)));
      const rawSize = u32(data, base + 16);
      const rawOffset = u32(data, base + 20);
      if (name.startsWith("/") && isDigits(name.slice(1))) name = cstring(this.stringTable, parseInt(name.slice(1), 10));
      const payload = rawOffset ? data.subarray(rawOffset, rawOffset + rawSize) : Buffer.alloc(0);
      this.sections.push(new CoffSection(index + 1, name, u32(data, base + 8), u32(data, base + 12), rawSize, rawOffset, u32(data, base + 24), u16(data, base + 32), u32(data, base + 36), payload));
    }
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  get machineName(): string {
    return IMAGE_FILE_MACHINE_NAMES.get(this.machine) ?? "";
  }

  private symbolName(raw: Buffer): string {
    if (bytesEqual(raw, 0, [0, 0, 0, 0])) return cstring(this.stringTable, u32(raw, 4));
    return asciiDecode(rstripNul(raw));
  }

  private readSymbols(): CoffSymbol[] {
    const symbols: CoffSymbol[] = [];
    let index = 0;
    while (index < this.symbolCount) {
      const base = this.symtabOffset + 18 * index;
      const rawName = this.data.subarray(base, base + 8);
      const auxCount = u8(this.data, base + 17);
      const aux: Buffer[] = [];
      for (let k = 0; k < auxCount; k++) aux.push(this.data.subarray(base + 18 * (k + 1), base + 18 * (k + 2)));
      symbols.push(new CoffSymbol(index, this.symbolName(rawName), u32(this.data, base + 8), i16(this.data, base + 12), u16(this.data, base + 14), u8(this.data, base + 16), aux));
      index += 1 + auxCount;
    }
    return symbols;
  }

  symbolAt(index: number): CoffSymbol {
    for (const symbol of this.symbols) {
      if (symbol.index === index) return symbol;
    }
    throw new FormatError(`no symbol at index ${index}`);
  }

  private readRelocations(): Map<string, CoffRelocation[]> {
    const table = new Map<string, CoffRelocation[]>();
    for (const section of this.sections) {
      if (section.relocCount === 0) continue;
      const key = section.name;
      for (let k = 0; k < section.relocCount; k++) {
        const base = section.relocOffset + 10 * k;
        const symbolIndex = u32(this.data, base + 4);
        setDefault(table, key).push(new CoffRelocation(key, u32(this.data, base), symbolIndex, u16(this.data, base + 8), this.symbolAt(symbolIndex).name));
      }
    }
    return table;
  }

  sectionDefinitions(): Dict[] {
    const rows: Dict[] = [];
    for (const symbol of this.symbols) {
      if (symbol.storageClass === 3 && symbol.aux.length && symbol.sectionNumber > 0) {
        const aux = symbol.aux[0];
        rows.push({ section: symbol.name, number: symbol.sectionNumber, length: u32(aux, 0), relocations: u16(aux, 4), checksum: u32(aux, 8), comdat: u8(aux, 14) });
      }
    }
    return rows;
  }

  functions(): CoffSymbol[] {
    return this.symbols.filter((s) => s.type === 0x20 && s.sectionNumber > 0);
  }

  undefined(): string[] {
    return this.symbols.filter((s) => s.sectionNumber === 0 && s.storageClass === 2).map((s) => s.name);
  }
}

export function loadCoff(name: string): CoffObject {
  return new CoffObject(readFileSync(path.join(FIXTURES, name)));
}

export class PeSection {
  constructor(readonly name: string, readonly virtualSize: number, readonly virtualAddress: number, readonly rawSize: number, readonly rawOffset: number, readonly characteristics: number) {}
}

export class ImportEntry {
  constructor(
    readonly index: number,
    readonly slotRva: number,
    readonly lookup: bigint,
    readonly byOrdinal: boolean,
    readonly ordinal: number | null,
    readonly hint: number | null,
    readonly name: string | null,
  ) {}
}

export class ImportDescriptor {
  constructor(
    readonly rva: number,
    readonly lookupRva: number,
    readonly timestamp: number,
    readonly forwarder: number,
    readonly nameRva: number,
    readonly iatRva: number,
    readonly dll: string,
    readonly entries: ImportEntry[],
  ) {}
}

export interface IatCall {
  rva: number;
  bytes: string;
  text: string;
  slot: number;
  dll: string;
  name: string;
}

export class PeImage {
  readonly data: Buffer;
  readonly eLfanew: number;
  readonly machine: number;
  readonly sectionCount: number;
  readonly timestamp: number;
  readonly optionalSize: number;
  readonly characteristics: number;
  readonly magic: number;
  readonly entryPoint: number;
  readonly imageBase: number;
  readonly sectionAlignment: number;
  readonly fileAlignment: number;
  readonly sizeOfImage: number;
  readonly subsystem: number;
  readonly dllCharacteristics: number;
  readonly directoryCount: number;
  readonly dataDirectories: [string, number, number][] = [];
  readonly sections: PeSection[] = [];

  constructor(data: Buffer) {
    if (!bytesEqual(data, 0, [0x4d, 0x5a])) throw new FormatError("DOS header magic not found");
    this.data = data;
    this.eLfanew = u32(data, 0x3c);
    if (!bytesEqual(data, this.eLfanew, [0x50, 0x45, 0, 0])) throw new FormatError("PE signature not found");
    const coff = this.eLfanew + 4;
    this.machine = u16(data, coff);
    this.sectionCount = u16(data, coff + 2);
    this.timestamp = u32(data, coff + 4);
    this.optionalSize = u16(data, coff + 16);
    this.characteristics = u16(data, coff + 18);
    const optional = coff + 20;
    this.magic = u16(data, optional);
    if (this.magic !== 0x20b) throw new FormatError("only PE32+ (magic 0x20b) is supported");
    this.entryPoint = u32(data, optional + 16);
    this.imageBase = u64(data, optional + 24);
    this.sectionAlignment = u32(data, optional + 32);
    this.fileAlignment = u32(data, optional + 36);
    this.sizeOfImage = u32(data, optional + 56);
    this.subsystem = u16(data, optional + 68);
    this.dllCharacteristics = u16(data, optional + 70);
    this.directoryCount = u32(data, optional + 108);
    const directories = optional + 112;
    for (let index = 0; index < this.directoryCount; index++) {
      this.dataDirectories.push([index < 16 ? DATA_DIRECTORY_NAMES[index] : String(index), u32(data, directories + 8 * index), u32(data, directories + 8 * index + 4)]);
    }
    const table = optional + this.optionalSize;
    for (let index = 0; index < this.sectionCount; index++) {
      const base = table + 40 * index;
      this.sections.push(new PeSection(asciiDecode(rstripNul(data.subarray(base, base + 8))), u32(data, base + 8), u32(data, base + 12), u32(data, base + 16), u32(data, base + 20), u32(data, base + 36)));
    }
  }

  directory(name: string): [number, number] {
    for (const [entryName, rva, size] of this.dataDirectories) {
      if (entryName === name) return [rva, size];
    }
    throw new FormatError(`no data directory named ${name}`);
  }

  dllCharacteristicNames(): string[] {
    return DLL_CHARACTERISTICS.filter(([bit]) => this.dllCharacteristics & bit).map(([, name]) => name);
  }

  rvaToOffset(rva: number): number {
    for (const section of this.sections) {
      if (section.virtualAddress <= rva && rva < section.virtualAddress + Math.max(section.virtualSize, section.rawSize)) return rva - section.virtualAddress + section.rawOffset;
    }
    throw new FormatError(`RVA ${hex(rva)} is in no section`);
  }

  sectionOf(rva: number): PeSection {
    for (const section of this.sections) {
      if (section.virtualAddress <= rva && rva < section.virtualAddress + Math.max(section.virtualSize, section.rawSize)) return section;
    }
    throw new FormatError(`RVA ${hex(rva)} is in no section`);
  }

  readRva(rva: number, size: number): Buffer {
    const offset = this.rvaToOffset(rva);
    return this.data.subarray(offset, offset + size);
  }

  stringAt(rva: number): string {
    return cstring(this.data, this.rvaToOffset(rva));
  }

  imports(): ImportDescriptor[] {
    let [rva] = this.directory("Import");
    const descriptors: ImportDescriptor[] = [];
    while (true) {
      const base = this.rvaToOffset(rva);
      const lookupRva = u32(this.data, base);
      const timestamp = u32(this.data, base + 4);
      const forwarder = u32(this.data, base + 8);
      const nameRva = u32(this.data, base + 12);
      const iatRva = u32(this.data, base + 16);
      if (lookupRva === 0 && nameRva === 0 && iatRva === 0) break;
      const entries: ImportEntry[] = [];
      let index = 0;
      while (true) {
        const value = u64n(this.data, this.rvaToOffset(lookupRva + 8 * index));
        if (value === 0n) break;
        if (value >> 63n) {
          entries.push(new ImportEntry(index, iatRva + 8 * index, value, true, Number(value & 0xffffn), null, null));
        } else {
          const hintRva = Number(value & 0x7fffffffn);
          const hint = u16(this.data, this.rvaToOffset(hintRva));
          entries.push(new ImportEntry(index, iatRva + 8 * index, value, false, null, hint, this.stringAt(hintRva + 2)));
        }
        index += 1;
      }
      descriptors.push(new ImportDescriptor(rva, lookupRva, timestamp, forwarder, nameRva, iatRva, this.stringAt(nameRva), entries));
      rva += 20;
    }
    return descriptors;
  }

  exports(): Dict {
    const [rva] = this.directory("Export");
    if (rva === 0) return {};
    const base = this.rvaToOffset(rva);
    const nameRva = u32(this.data, base + 12);
    const ordinalBase = u32(this.data, base + 16);
    const addressCount = u32(this.data, base + 20);
    const nameCount = u32(this.data, base + 24);
    const eatRva = u32(this.data, base + 28);
    const enptRva = u32(this.data, base + 32);
    const eotRva = u32(this.data, base + 36);
    const addresses: number[] = [];
    for (let k = 0; k < addressCount; k++) addresses.push(u32(this.data, this.rvaToOffset(eatRva + 4 * k)));
    const names: string[] = [];
    for (let k = 0; k < nameCount; k++) names.push(this.stringAt(u32(this.data, this.rvaToOffset(enptRva + 4 * k))));
    const ordinals: number[] = [];
    for (let k = 0; k < nameCount; k++) ordinals.push(u16(this.data, this.rvaToOffset(eotRva + 2 * k)));
    const entries = names.map((name, k) => ({ ordinal: ordinalBase + ordinals[k], rva: addresses[ordinals[k]], name }));
    return { name: this.stringAt(nameRva), ordinalBase, addressCount, nameCount, tables: { eat: eatRva, enpt: enptRva, eot: eotRva }, entries };
  }

  baseRelocations(): Dict[] {
    let [rva, size] = this.directory("Base Relocation");
    const blocks: Dict[] = [];
    const end = rva + size;
    while (rva < end) {
      const base = this.rvaToOffset(rva);
      const page = u32(this.data, base);
      const blockSize = u32(this.data, base + 4);
      const entries: Dict[] = [];
      for (let k = 0; k < Math.floor((blockSize - 8) / 2); k++) {
        const word = u16(this.data, this.rvaToOffset(rva + 8 + 2 * k));
        entries.push({ type: word >> 12, typeName: BASE_RELOCATION_NAMES.get(word >> 12) ?? hex(word >> 12), offset: word & 0xfff, rva: page + (word & 0xfff) });
      }
      blocks.push({ pageRva: page, blockSize, entries });
      rva += blockSize;
    }
    return blocks;
  }

  iatCalls(): IatCall[] {
    const code = this.sectionOf(this.entryPoint);
    const data = this.readRva(code.virtualAddress, code.virtualSize);
    const slots = new Map<number, [string, string]>();
    for (const descriptor of this.imports()) {
      for (const entry of descriptor.entries) slots.set(entry.slotRva, [descriptor.dll, entry.name || `#${entry.ordinal}`]);
    }
    const calls: IatCall[] = [];
    for (let position = 0; position < data.length - 5; position++) {
      if (!bytesEqual(data, position, [0xff, 0x15])) continue;
      const rva = code.virtualAddress + position;
      const displacement = i32(data, position + 2);
      const slot = rva + 6 + displacement;
      const hit = slots.get(slot);
      if (hit !== undefined) {
        const [dll, name] = hit;
        calls.push({ rva, bytes: hexbytes(data.subarray(position, position + 6)), text: `call qword ptr [rip + ${hex(displacement)}]`, slot, dll, name });
      }
    }
    return calls;
  }
}

export function loadPe(name: string): PeImage {
  return new PeImage(readFileSync(path.join(FIXTURES, name)));
}

const MH_MAGIC_64 = 0xfeedfacf;
const LC_REQ_DYLD = 0x80000000;
const LC_SEGMENT_64 = 0x19;
const LC_SYMTAB = 0x2;
const LC_DYSYMTAB = 0xb;
const LC_LOAD_DYLIB = 0xc;
const LC_ID_DYLIB = 0xd;
const LC_LOAD_DYLINKER = 0xe;
const LC_LOAD_WEAK_DYLIB = LC_REQ_DYLD + 0x18;
const LC_REEXPORT_DYLIB = LC_REQ_DYLD + 0x1f;
const LC_RPATH = LC_REQ_DYLD + 0x1c;
const LC_MAIN = LC_REQ_DYLD + 0x28;
const LC_DYLD_INFO = 0x22;
const LC_DYLD_INFO_ONLY = LC_REQ_DYLD + 0x22;
const LC_FUNCTION_STARTS = 0x26;
const LC_DYLD_EXPORTS_TRIE = LC_REQ_DYLD + 0x33;
const LC_DYLD_CHAINED_FIXUPS = LC_REQ_DYLD + 0x34;
const LC_NAMES = new Map<number, string>([
  [0x1, "LC_SEGMENT"], [LC_SYMTAB, "LC_SYMTAB"], [0x5, "LC_UNIXTHREAD"], [LC_DYSYMTAB, "LC_DYSYMTAB"], [LC_LOAD_DYLIB, "LC_LOAD_DYLIB"],
  [LC_ID_DYLIB, "LC_ID_DYLIB"], [LC_LOAD_DYLINKER, "LC_LOAD_DYLINKER"], [LC_LOAD_WEAK_DYLIB, "LC_LOAD_WEAK_DYLIB"], [LC_SEGMENT_64, "LC_SEGMENT_64"],
  [0x1b, "LC_UUID"], [LC_RPATH, "LC_RPATH"], [0x1d, "LC_CODE_SIGNATURE"], [LC_REEXPORT_DYLIB, "LC_REEXPORT_DYLIB"], [LC_DYLD_INFO, "LC_DYLD_INFO"],
  [LC_DYLD_INFO_ONLY, "LC_DYLD_INFO_ONLY"], [LC_FUNCTION_STARTS, "LC_FUNCTION_STARTS"], [LC_MAIN, "LC_MAIN"], [0x29, "LC_DATA_IN_CODE"],
  [0x2a, "LC_SOURCE_VERSION"], [0x2e, "LC_LINKER_OPTIMIZATION_HINT"], [0x32, "LC_BUILD_VERSION"], [LC_DYLD_EXPORTS_TRIE, "LC_DYLD_EXPORTS_TRIE"],
  [LC_DYLD_CHAINED_FIXUPS, "LC_DYLD_CHAINED_FIXUPS"],
]);
const MH_FLAGS: [number, string][] = [[0x1, "MH_NOUNDEFS"], [0x4, "MH_DYLDLINK"], [0x80, "MH_TWOLEVEL"], [0x2000, "MH_SUBSECTIONS_VIA_SYMBOLS"], [0x200000, "MH_PIE"], [0x800000, "MH_HAS_TLV_DESCRIPTORS"]];
const MH_FILETYPES = new Map<number, string>([[0x1, "MH_OBJECT"], [0x2, "MH_EXECUTE"], [0x6, "MH_DYLIB"], [0x7, "MH_DYLINKER"], [0x8, "MH_BUNDLE"], [0xa, "MH_DSYM"]]);
const S_NON_LAZY_SYMBOL_POINTERS = 0x6;
const S_LAZY_SYMBOL_POINTERS = 0x7;
const S_SYMBOL_STUBS = 0x8;
const N_STAB = 0xe0;
const N_TYPE = 0x0e;
const N_EXT = 0x01;
const N_UNDF = 0x0;
const N_SECT = 0xe;
const REFERENCED_DYNAMICALLY = 0x0010;
const DYLD_CHAINED_PTR_64 = 2;
const DYLD_CHAINED_PTR_64_OFFSET = 6;
const DYLD_CHAINED_PTR_START_NONE = 0xffff;
const DYLD_CHAINED_IMPORT = 1;
const EXPORT_SYMBOL_FLAGS_REEXPORT = 0x08;
const EXPORT_SYMBOL_FLAGS_STUB_AND_RESOLVER = 0x10;
const ARM64_RELOCATION_NAMES = new Map<number, string>([
  [0, "ARM64_RELOC_UNSIGNED"], [1, "ARM64_RELOC_SUBTRACTOR"], [2, "ARM64_RELOC_BRANCH26"], [3, "ARM64_RELOC_PAGE21"], [4, "ARM64_RELOC_PAGEOFF12"],
  [5, "ARM64_RELOC_GOT_LOAD_PAGE21"], [6, "ARM64_RELOC_GOT_LOAD_PAGEOFF12"], [7, "ARM64_RELOC_POINTER_TO_GOT"], [8, "ARM64_RELOC_TLVP_LOAD_PAGE21"],
  [9, "ARM64_RELOC_TLVP_LOAD_PAGEOFF12"], [10, "ARM64_RELOC_ADDEND"],
]);

export class LoadCommand {
  constructor(readonly index: number, readonly cmd: number, readonly offset: number, readonly size: number) {}

  get name(): string {
    return LC_NAMES.get(this.cmd) ?? hex(this.cmd);
  }
}

export class MachSection {
  constructor(
    readonly sectname: string,
    readonly segname: string,
    readonly addr: number,
    readonly size: number,
    readonly offset: number,
    readonly flags: number,
    readonly reserved1: number,
    readonly reserved2: number,
    readonly reloff: number,
    readonly nreloc: number,
  ) {}

  get type(): number {
    return this.flags & 0xff;
  }

  contains(address: number): boolean {
    return this.addr <= address && address < this.addr + this.size;
  }
}

export class Segment {
  constructor(
    readonly name: string,
    readonly vmaddr: number,
    readonly vmsize: number,
    readonly fileoff: number,
    readonly filesize: number,
    readonly initprot: number,
    readonly sections: MachSection[],
  ) {}

  contains(address: number): boolean {
    return this.vmaddr <= address && address < this.vmaddr + this.vmsize;
  }
}

export class Nlist {
  constructor(readonly index: number, readonly name: string, readonly type: number, readonly sect: number, readonly desc: number, readonly value: number) {}

  get isStab(): boolean {
    return Boolean(this.type & N_STAB);
  }

  get kind(): number {
    return this.type & N_TYPE;
  }

  get external(): boolean {
    return Boolean(this.type & N_EXT);
  }

  get libraryOrdinal(): number {
    return (this.desc >> 8) & 0xff;
  }
}

export class MachRelocation {
  constructor(
    readonly address: number,
    readonly symbolnum: number,
    readonly pcrel: boolean,
    readonly length: number,
    readonly extern: boolean,
    readonly type: number,
    readonly name: string,
  ) {}

  get size(): number {
    return 1 << this.length;
  }

  get typeName(): string {
    return ARM64_RELOCATION_NAMES.get(this.type) ?? hex(this.type);
  }
}

export class Fixup {
  constructor(
    readonly offset: number,
    readonly address: number,
    readonly segment: string,
    readonly section: string,
    readonly raw: bigint,
    readonly kind: string,
    readonly next: number,
    readonly ordinal: number | null,
    readonly addend: number | null,
    readonly target: number | null,
  ) {}

  toDict(): Dict {
    const row: Dict = { offset: hex(this.offset), address: hex(this.address), segment: this.segment, section: this.section, raw: `0x${this.raw.toString(16).padStart(16, "0")}`, kind: this.kind, next: this.next };
    if (this.kind === "bind") {
      row["ordinal"] = this.ordinal;
      row["addend"] = this.addend;
    } else {
      row["target"] = hex(this.target || 0);
    }
    return row;
  }
}

export class ChainedImport {
  constructor(readonly index: number, readonly libOrdinal: number, readonly weak: boolean, readonly name: string, readonly library: string) {}
}

export class Stub {
  constructor(readonly index: number, readonly address: number, readonly raw: Buffer, readonly page: number, readonly slot: number, readonly symbol: string) {}

  lines(): string[] {
    return [`adrp x16, ${hex(this.page)}`, `ldr x16, [x16, #${hex(this.slot - this.page)}]   -> slot ${hex(this.slot)}`, "br x16"];
  }
}

export interface ChainedInfo {
  dataoff: number;
  datasize: number;
  header: Dict;
  segments: Dict[];
  fixups: Fixup[];
  imports: ChainedImport[];
}

export interface ExportEntry {
  name: string;
  flags: number;
  reexport?: number;
  importName?: string;
  offset?: number;
  resolver?: number;
}

export function shortLibraryName(p: string): string {
  const last = p.split("/").pop() ?? p;
  return last.split(".")[0];
}

function decodeUtf8(raw: Buffer): string {
  return rstripNul(raw).toString("utf8");
}

export class MachoFile {
  readonly data: Buffer;
  readonly cputype: number;
  readonly cpusubtype: number;
  readonly filetype: number;
  readonly ncmds: number;
  readonly sizeofcmds: number;
  readonly flags: number;
  readonly loadCommands: LoadCommand[] = [];
  readonly segments: Segment[] = [];
  readonly dylibs: string[] = [];
  readonly rpaths: string[] = [];
  symtab: [number, number, number, number] | null = null;
  indirectSymbols: number[] = [];
  entryoff: number | null = null;
  readonly linkedit = new Map<string, [number, number]>();
  dyldInfo: Record<string, number> | null = null;
  readonly nlists: Nlist[];

  constructor(data: Buffer) {
    if (data.length < 32 || u32(data, 0) !== MH_MAGIC_64) throw new FormatError("not a 64-bit little-endian Mach-O file");
    this.data = data;
    this.cputype = i32(data, 4);
    this.cpusubtype = i32(data, 8);
    this.filetype = u32(data, 12);
    this.ncmds = u32(data, 16);
    this.sizeofcmds = u32(data, 20);
    this.flags = u32(data, 24);
    let offset = 32;
    for (let index = 0; index < this.ncmds; index++) {
      const cmd = u32(data, offset);
      const cmdsize = u32(data, offset + 4);
      this.loadCommands.push(new LoadCommand(index, cmd, offset, cmdsize));
      if (cmd === LC_SEGMENT_64) {
        const s = offset + 8;
        const nsects = u32(data, s + 56);
        const sections: MachSection[] = [];
        for (let k = 0; k < nsects; k++) {
          const base = offset + 72 + 80 * k;
          sections.push(new MachSection(decodeUtf8(data.subarray(base, base + 16)), decodeUtf8(data.subarray(base + 16, base + 32)), u64(data, base + 32), u64(data, base + 40), u32(data, base + 48), u32(data, base + 64), u32(data, base + 68), u32(data, base + 72), u32(data, base + 56), u32(data, base + 60)));
        }
        this.segments.push(new Segment(decodeUtf8(data.subarray(s, s + 16)), u64(data, s + 16), u64(data, s + 24), u64(data, s + 32), u64(data, s + 40), i32(data, s + 52), sections));
      } else if (cmd === LC_SYMTAB) {
        this.symtab = [u32(data, offset + 8), u32(data, offset + 12), u32(data, offset + 16), u32(data, offset + 20)];
      } else if (cmd === LC_DYSYMTAB) {
        const indirectsymoff = u32(data, offset + 8 + 48);
        const nindirect = u32(data, offset + 8 + 52);
        this.indirectSymbols = [];
        for (let k = 0; k < nindirect; k++) this.indirectSymbols.push(u32(data, indirectsymoff + 4 * k));
      } else if (cmd === LC_LOAD_DYLIB || cmd === LC_LOAD_WEAK_DYLIB || cmd === LC_REEXPORT_DYLIB) {
        this.dylibs.push(cstring(data, offset + u32(data, offset + 8)));
      } else if (cmd === LC_RPATH) {
        this.rpaths.push(cstring(data, offset + u32(data, offset + 8)));
      } else if (cmd === LC_MAIN) {
        this.entryoff = u64(data, offset + 8);
      } else if (cmd === LC_FUNCTION_STARTS || cmd === LC_DYLD_EXPORTS_TRIE || cmd === LC_DYLD_CHAINED_FIXUPS || cmd === 0x29 || cmd === 0x1d) {
        this.linkedit.set(LC_NAMES.get(cmd) ?? hex(cmd), [u32(data, offset + 8), u32(data, offset + 12)]);
      } else if (cmd === LC_DYLD_INFO || cmd === LC_DYLD_INFO_ONLY) {
        const keys = ["rebase_off", "rebase_size", "bind_off", "bind_size", "weak_bind_off", "weak_bind_size", "lazy_bind_off", "lazy_bind_size", "export_off", "export_size"];
        const info: Record<string, number> = {};
        keys.forEach((key, k) => {
          info[key] = u32(data, offset + 8 + 4 * k);
        });
        this.dyldInfo = info;
      }
      offset += cmdsize;
    }
    this.nlists = this.readNlists();
  }

  get filetypeName(): string {
    return MH_FILETYPES.get(this.filetype) ?? hex(this.filetype);
  }

  flagNames(): string[] {
    return MH_FLAGS.filter(([bit]) => this.flags & bit).map(([, name]) => name);
  }

  commandNames(): string[] {
    return this.loadCommands.map((command) => command.name);
  }

  private readNlists(): Nlist[] {
    if (this.symtab === null) return [];
    const [symoff, nsyms, stroff, strsize] = this.symtab;
    const strings = this.data.subarray(stroff, stroff + strsize);
    const rows: Nlist[] = [];
    for (let index = 0; index < nsyms; index++) {
      const base = symoff + 16 * index;
      rows.push(new Nlist(index, cstring(strings, u32(this.data, base)), u8(this.data, base + 4), u8(this.data, base + 5), u16(this.data, base + 6), u64(this.data, base + 8)));
    }
    return rows;
  }

  get baseAddress(): number {
    for (const segment of this.segments) {
      if (segment.name === "__TEXT") return segment.vmaddr;
    }
    return this.segments.length ? this.segments[0].vmaddr : 0;
  }

  segment(name: string): Segment {
    for (const segment of this.segments) {
      if (segment.name === name) return segment;
    }
    throw new FormatError(`no segment named ${name}`);
  }

  section(segname: string, sectname: string): MachSection {
    for (const segment of this.segments) {
      for (const section of segment.sections) {
        if (section.segname === segname && section.sectname === sectname) return section;
      }
    }
    throw new FormatError(`no section ${segname},${sectname}`);
  }

  sections(): MachSection[] {
    return this.segments.flatMap((segment) => segment.sections);
  }

  sectionBytes(section: MachSection): Buffer {
    return this.data.subarray(section.offset, section.offset + section.size);
  }

  locate(address: number): [string, string] {
    for (const segment of this.segments) {
      for (const section of segment.sections) {
        if (section.contains(address)) return [segment.name, section.sectname];
      }
      if (segment.contains(address)) return [segment.name, ""];
    }
    throw new FormatError(`address ${hex(address)} is in no segment`);
  }

  addressToOffset(address: number): number {
    for (const segment of this.segments) {
      if (segment.contains(address) && segment.filesize) return address - segment.vmaddr + segment.fileoff;
    }
    throw new FormatError(`address ${hex(address)} is not in the file`);
  }

  read(address: number, size: number): Buffer {
    const offset = this.addressToOffset(address);
    return this.data.subarray(offset, offset + size);
  }

  word(address: number): number {
    return u32(this.read(address, 4), 0);
  }

  libraryName(ordinal: number): string {
    if (1 <= ordinal && ordinal <= this.dylibs.length) return shortLibraryName(this.dylibs[ordinal - 1]);
    return new Map([[0, "self"], [0xfe, "dynamic-lookup"], [0xff, "executable"]]).get(ordinal) ?? hex(ordinal);
  }

  twoLevelImports(): [string, string][] {
    const rows: [string, string][] = this.nlists.filter((n) => !n.isStab && n.kind === N_UNDF && n.external).map((n) => [n.name, this.libraryName(n.libraryOrdinal)]);
    return rows.sort((a, b) => compareStrings(a[0], b[0]) || compareStrings(a[1], b[1]));
  }

  nmLines(): string[] {
    const lines: string[] = [];
    for (const n of [...this.nlists].sort((a, b) => compareStrings(a.name, b.name))) {
      if (n.isStab) continue;
      const visibility = n.external ? "external" : "non-external";
      if (n.kind === N_UNDF) {
        lines.push(`(undefined) ${visibility} ${n.name} (from ${this.libraryName(n.libraryOrdinal)})`);
        continue;
      }
      const sections = this.sections();
      let where = "(absolute)";
      if (n.kind === N_SECT && 0 < n.sect && n.sect <= sections.length) where = `(${sections[n.sect - 1].segname},${sections[n.sect - 1].sectname})`;
      const flags = n.desc & REFERENCED_DYNAMICALLY ? " [referenced dynamically]" : "";
      lines.push(`${n.value.toString(16).padStart(16, "0")} ${where}${flags} ${visibility} ${n.name}`);
    }
    return lines;
  }

  functionStarts(): number[] {
    const entry = this.linkedit.get("LC_FUNCTION_STARTS");
    if (entry === undefined) return [];
    const [dataoff, datasize] = entry;
    const blob = this.data.subarray(dataoff, dataoff + datasize);
    const starts: number[] = [];
    let address = this.baseAddress;
    let position = 0;
    while (position < blob.length) {
      let delta: number;
      [delta, position] = readUleb128(blob, position);
      if (delta === 0 && starts.length) break;
      address += delta;
      starts.push(address);
    }
    return starts;
  }

  stubs(): Stub[] {
    const stubs: Stub[] = [];
    for (const section of this.sections()) {
      if (section.type !== S_SYMBOL_STUBS) continue;
      const size = section.reserved2 || 12;
      const data = this.sectionBytes(section);
      for (let index = 0; index < Math.floor(section.size / size); index++) {
        const address = section.addr + index * size;
        const raw = data.subarray(index * size, (index + 1) * size);
        const [page, slot] = MachoFile.decodeArm64Stub(address, raw);
        const indirect = this.indirectSymbols.length ? this.indirectSymbols[section.reserved1 + index] : null;
        const name = indirect !== null && indirect !== undefined && indirect < this.nlists.length ? this.nlists[indirect].name : "?";
        stubs.push(new Stub(index, address, raw, page, slot, name));
      }
    }
    return stubs;
  }

  private static decodeArm64Stub(address: number, raw: Buffer): [number, number] {
    const adrp = u32(raw, 0);
    const ldr = u32(raw, 4);
    const br = u32(raw, 8);
    if (((adrp & 0x9f000000) >>> 0) !== 0x90000000 || ((ldr & 0xffc00000) >>> 0) !== 0xf9400000 || ((br & 0xfffffc1f) >>> 0) !== 0xd61f0000) throw new FormatError(`stub at ${hex(address)} is not adrp/ldr/br`);
    const immlo = (adrp >>> 29) & 0x3;
    const immhi = (adrp >>> 5) & 0x7ffff;
    const pageDelta = signed(immhi * 4 + immlo, 21) * 4096;
    const page = address - (address % 4096) + pageDelta;
    const slot = page + ((ldr >>> 10) & 0xfff) * 8;
    return [page, slot];
  }

  indirectTable(): Dict[] {
    const rows: Dict[] = [];
    for (const section of this.sections()) {
      if (section.type !== S_SYMBOL_STUBS && section.type !== S_NON_LAZY_SYMBOL_POINTERS && section.type !== S_LAZY_SYMBOL_POINTERS) continue;
      const stride = section.type === S_SYMBOL_STUBS ? section.reserved2 : 8;
      for (let index = 0; index < Math.floor(section.size / stride); index++) {
        const symbol = this.indirectSymbols[section.reserved1 + index];
        rows.push({ section: `${section.segname},${section.sectname}`, address: section.addr + index * stride, index: symbol, name: symbol < this.nlists.length ? this.nlists[symbol].name : hex(symbol) });
      }
    }
    return rows;
  }

  chainedFixups(): ChainedInfo | null {
    const entry = this.linkedit.get("LC_DYLD_CHAINED_FIXUPS");
    if (entry === undefined) return null;
    const [dataoff, datasize] = entry;
    const field = (k: number): number => u32(this.data, dataoff + 4 * k);
    const [version, startsOffset, importsOffset, symbolsOffset, importsCount, importsFormat, symbolsFormat] = [0, 1, 2, 3, 4, 5, 6].map(field);
    const header: Dict = { fixups_version: version, starts_offset: startsOffset, imports_offset: importsOffset, symbols_offset: symbolsOffset, imports_count: importsCount, imports_format: importsFormat, symbols_format: symbolsFormat };
    if (importsFormat !== DYLD_CHAINED_IMPORT) throw new FormatError(`imports_format ${importsFormat} is not DYLD_CHAINED_IMPORT`);
    const imports: ChainedImport[] = [];
    const symbols = dataoff + symbolsOffset;
    for (let index = 0; index < importsCount; index++) {
      const packed = u32(this.data, dataoff + importsOffset + 4 * index);
      const libOrdinal = packed & 0xff;
      const weak = Boolean((packed >>> 8) & 1);
      const nameOffset = packed >>> 9;
      imports.push(new ChainedImport(index, libOrdinal, weak, cstring(this.data, symbols + nameOffset), this.libraryName(libOrdinal)));
    }
    const starts = dataoff + startsOffset;
    const segCount = u32(this.data, starts);
    const segInfo: number[] = [];
    for (let k = 0; k < segCount; k++) segInfo.push(u32(this.data, starts + 4 + 4 * k));
    const segmentsOut: Dict[] = [];
    const fixups: Fixup[] = [];
    segInfo.forEach((infoOffset, segIndex) => {
      if (infoOffset === 0) return;
      const base = starts + infoOffset;
      const size = u32(this.data, base);
      const pageSize = u16(this.data, base + 4);
      const pointerFormat = u16(this.data, base + 6);
      const segmentOffset = u64(this.data, base + 8);
      const maxValid = u32(this.data, base + 16);
      const pageCount = u16(this.data, base + 20);
      const pageStarts: number[] = [];
      for (let k = 0; k < pageCount; k++) pageStarts.push(u16(this.data, base + 22 + 2 * k));
      const segment = this.segments[segIndex];
      segmentsOut.push({ segment: segment.name, size, page_size: pageSize, pointer_format: pointerFormat, segment_offset: segmentOffset, max_valid_pointer: maxValid, page_count: pageCount, page_start: pageStarts });
      if (pointerFormat !== DYLD_CHAINED_PTR_64 && pointerFormat !== DYLD_CHAINED_PTR_64_OFFSET) throw new FormatError(`pointer_format ${pointerFormat} is not a 64-bit chain`);
      pageStarts.forEach((pageStart, pageIndex) => {
        if (pageStart === DYLD_CHAINED_PTR_START_NONE) return;
        let offset = segment.fileoff + pageIndex * pageSize + pageStart;
        let hops = 0;
        while (true) {
          const raw = u64n(this.data, offset);
          const address = segment.vmaddr + (offset - segment.fileoff);
          const [segName, sectName] = this.locate(address);
          const nxt = Number((raw >> 51n) & 0xfffn);
          if (raw >> 63n) {
            fixups.push(new Fixup(offset, address, segName, sectName, raw, "bind", nxt, Number(raw & 0xffffffn), Number((raw >> 24n) & 0xffn), null));
          } else {
            let target = Number(raw & ((1n << 36n) - 1n));
            if (pointerFormat === DYLD_CHAINED_PTR_64_OFFSET) target += this.baseAddress;
            fixups.push(new Fixup(offset, address, segName, sectName, raw, "rebase", nxt, null, null, target));
          }
          hops += 1;
          if (nxt === 0 || hops > 100000) break;
          offset += nxt * 4;
        }
      });
    });
    return { dataoff, datasize, header, segments: segmentsOut, fixups, imports };
  }

  fixupRows(): [string, string, number, string, string][] {
    const info = this.chainedFixups();
    if (info === null) return [];
    const imports = info.imports;
    const rows: [string, string, number, string, string][] = [];
    for (const fixup of info.fixups) {
      let target: string;
      if (fixup.kind === "bind") {
        const entry = imports[fixup.ordinal || 0];
        target = `${entry.library}/${entry.name}` + (fixup.addend ? `+${hex(fixup.addend)}` : "");
      } else {
        target = hex(fixup.target || 0);
      }
      rows.push([fixup.segment, fixup.section, fixup.address, fixup.kind, target]);
    }
    return rows;
  }

  exportsTrie(): ExportEntry[] {
    const entry = this.linkedit.get("LC_DYLD_EXPORTS_TRIE");
    if (entry === undefined) return [];
    const [dataoff, datasize] = entry;
    const blob = this.data.subarray(dataoff, dataoff + datasize);
    const exports: ExportEntry[] = [];

    const visit = (offset: number, prefix: string): void => {
      const [terminalSize, position] = readUleb128(blob, offset);
      if (terminalSize) {
        let [flags, cursor] = readUleb128(blob, position);
        const row: ExportEntry = { name: prefix, flags };
        if (flags & EXPORT_SYMBOL_FLAGS_REEXPORT) {
          let ordinal: number;
          [ordinal, cursor] = readUleb128(blob, cursor);
          row.reexport = ordinal;
          row.importName = cstring(blob, cursor);
        } else {
          let address: number;
          [address, cursor] = readUleb128(blob, cursor);
          row.offset = address;
          if (flags & EXPORT_SYMBOL_FLAGS_STUB_AND_RESOLVER) {
            let resolver: number;
            [resolver, cursor] = readUleb128(blob, cursor);
            row.resolver = resolver;
          }
        }
        exports.push(row);
      }
      const children = position + terminalSize;
      const count = blob[children];
      let cursor = children + 1;
      for (let k = 0; k < count; k++) {
        const edge = cstring(blob, cursor);
        cursor += Buffer.byteLength(edge, "utf8") + 1;
        let child: number;
        [child, cursor] = readUleb128(blob, cursor);
        visit(child, prefix + edge);
      }
    };

    if (blob.length) visit(0, "");
    return exports.sort((a, b) => compareStrings(a.name, b.name));
  }

  relocations(): Map<string, MachRelocation[]> {
    const table = new Map<string, MachRelocation[]>();
    for (const section of this.sections()) {
      for (let index = 0; index < section.nreloc; index++) {
        const base = section.reloff + 8 * index;
        const rAddress = i32(this.data, base);
        const packed = u32(this.data, base + 4);
        const symbolnum = packed & 0xffffff;
        const pcrel = Boolean((packed >>> 24) & 1);
        const length = (packed >>> 25) & 3;
        const extern = Boolean((packed >>> 27) & 1);
        const rType = (packed >>> 28) & 0xf;
        let name: string;
        if (extern) {
          name = this.nlists[symbolnum].name;
        } else {
          const sections = this.sections();
          name = 0 < symbolnum && symbolnum <= sections.length ? sections[symbolnum - 1].sectname : hex(symbolnum);
        }
        setDefault(table, section.sectname).push(new MachRelocation(rAddress, symbolnum, pcrel, length, extern, rType, name));
      }
    }
    return table;
  }

  textSection(): MachSection {
    return this.section("__TEXT", "__text");
  }

  textFunctions(): [string, number, number][] {
    const text = this.textSection();
    const starts = new Map<number, string>();
    for (const n of this.nlists) {
      if (n.isStab || n.kind !== N_SECT || !text.contains(n.value) || n.name.startsWith("ltmp")) continue;
      if (!starts.has(n.value) || n.external) starts.set(n.value, n.name);
    }
    const ordered = [...starts.keys()].sort((a, b) => a - b);
    return ordered.map((start, position) => {
      const end = position + 1 < ordered.length ? ordered[position + 1] : text.addr + text.size;
      return [starts.get(start) ?? "", start, end];
    });
  }
}

export function loadMacho(name: string): MachoFile {
  return new MachoFile(readFileSync(path.join(FIXTURES, name)));
}

const STP_FRAME_WORD = 0xa9bf7bfd;
const PROLOGUE_PATTERNS = new Map<string, [string, (w: number) => boolean]>([
  ["stp-frame", ["stp x29, x30, [sp, #-0x10]!", (w) => w === STP_FRAME_WORD]],
  ["sub-sp", ["sub sp, sp, #imm", (w) => ((w & 0xff0003ff) >>> 0) === 0xd10003ff]],
]);

export function decodeBl(word: number, address: number): number | null {
  if (((word & 0xfc000000) >>> 0) !== 0x94000000) return null;
  return address + signed(word & 0x03ffffff, 26) * 4;
}

export interface Score {
  hits: number;
  truePositives: number;
  falsePositives: string[];
  missed: string[];
  recall: string;
}

export class FunctionFinder {
  readonly text: MachSection;
  readonly code: Buffer;
  readonly words: number[] = [];

  constructor(readonly macho: MachoFile) {
    this.text = macho.textSection();
    this.code = macho.sectionBytes(this.text);
    for (let k = 0; k < this.code.length - 3; k += 4) this.words.push(u32(this.code, k));
  }

  symbols(): number[] {
    return this.macho.textFunctions().map(([, start]) => start);
  }

  functionStarts(): number[] {
    return this.macho.functionStarts().filter((a) => this.text.contains(a));
  }

  prologueScan(pattern: string): number[] {
    const entry = PROLOGUE_PATTERNS.get(pattern);
    if (entry === undefined) throw new FormatError(`no prologue pattern ${pattern}`);
    const matches = entry[1];
    const out: number[] = [];
    this.words.forEach((word, k) => {
      if (matches(word)) out.push(this.text.addr + 4 * k);
    });
    return out;
  }

  callTargets(): number[] {
    const targets = new Set<number>();
    this.words.forEach((word, k) => {
      const target = decodeBl(word, this.text.addr + 4 * k);
      if (target !== null && this.text.contains(target)) targets.add(target);
    });
    if (this.macho.entryoff !== null) targets.add(this.macho.baseAddress + this.macho.entryoff);
    return [...targets].sort((a, b) => a - b);
  }

  static score(found: number[], truth: number[]): Score {
    const truthSet = new Set(truth);
    const foundSet = new Set(found);
    const truePositives = found.filter((a) => truthSet.has(a));
    return {
      hits: found.length,
      truePositives: truePositives.length,
      falsePositives: found.filter((a) => !truthSet.has(a)).map(hex),
      missed: truth.filter((a) => !foundSet.has(a)).map(hex),
      recall: `${truePositives.length}/${truth.length}`,
    };
  }

  methods(): Map<string, number[]> {
    return new Map([
      ["functionStarts", this.functionStarts()],
      ["prologueSub", this.prologueScan("sub-sp")],
      ["prologueStp", this.prologueScan("stp-frame")],
      ["callTargets", this.callTargets()],
    ]);
  }
}

const PATTERN_LENGTH = 32;

export class Signature {
  constructor(
    readonly name: string,
    readonly pattern: (number | null)[],
    readonly crcLength: number,
    readonly crc: number,
    readonly length: number,
    readonly masked: (number | null)[],
    readonly referenced: string[],
  ) {}

  patLine(): string {
    const pattern = this.pattern.map((byte) => (byte === null ? ".." : byte.toString(16).toUpperCase().padStart(2, "0"))).join("");
    const refs = this.referenced.map((name, position) => ` ^${position.toString(16).toUpperCase().padStart(4, "0")} ${name}`).join("");
    const h = (value: number, width: number): string => value.toString(16).toUpperCase().padStart(width, "0");
    return `${pattern} ${h(this.crcLength, 2)} ${h(this.crc, 4)} ${h(this.length, 4)} :0000 ${this.name}${refs}`;
  }

  matches(data: Buffer): boolean {
    if (data.length < this.pattern.length) return false;
    for (let k = 0; k < this.pattern.length; k++) {
      const expected = this.pattern[k];
      if (expected !== null && data[k] !== expected) return false;
    }
    if (this.crcLength && crc16(data.subarray(PATTERN_LENGTH, PATTERN_LENGTH + this.crcLength)) !== this.crc) return false;
    return true;
  }

  tailMatches(data: Buffer): boolean {
    if (data.length < this.length) return false;
    return this.masked.every((expected, k) => expected === null || data[k] === expected);
  }
}

export function signaturesFromObject(macho: MachoFile): Signature[] {
  const text = macho.textSection();
  const code = macho.sectionBytes(text);
  const relocations = macho.relocations().get("__text") ?? [];
  const variant = new Set<number>();
  const referencedAt = new Map<number, string>();
  for (const relocation of relocations) {
    for (let a = relocation.address; a < relocation.address + relocation.size; a++) variant.add(a);
    if (relocation.extern) referencedAt.set(relocation.address, relocation.name);
  }
  const signatures: Signature[] = [];
  for (const [name, start, end] of macho.textFunctions()) {
    const body = code.subarray(start - text.addr, end - text.addr);
    const masked = Array.from(body, (byte, k): number | null => (variant.has(start - text.addr + k) ? null : byte));
    const pattern = masked.slice(0, PATTERN_LENGTH);
    let crcLength = 0;
    for (let k = PATTERN_LENGTH; k < masked.length; k++) {
      if (masked[k] === null) break;
      crcLength += 1;
    }
    const crc = crcLength ? crc16(Uint8Array.from(masked.slice(PATTERN_LENGTH, PATTERN_LENGTH + crcLength) as number[])) : 0;
    const referenced = [...referencedAt.keys()].sort((a, b) => a - b).filter((a) => start - text.addr <= a && a < end - text.addr).map((a) => referencedAt.get(a) ?? "");
    signatures.push(new Signature(name, pattern, crcLength, crc, body.length, masked, referenced));
  }
  return signatures;
}

export interface MatchResult {
  names: Record<string, string>;
  collisions: Dict[];
  unmatched: string[];
}

export function matchSignatures(signatures: Signature[], macho: MachoFile, candidates: number[]): MatchResult {
  const text = macho.textSection();
  const code = macho.sectionBytes(text);
  const names = new Map<number, string>();
  const collisions: Dict[] = [];
  const unmatched: number[] = [];
  for (const address of candidates) {
    const window = code.subarray(address - text.addr);
    let hits = signatures.filter((s) => s.matches(window));
    if (!hits.length) {
      unmatched.push(address);
      continue;
    }
    if (hits.length > 1) {
      const tail = hits.filter((s) => s.tailMatches(window));
      const split = firstTailDifference(hits);
      collisions.push({ address: hex(address), candidates: hits.map((s) => s.name), resolvedBy: split, winner: tail.length === 1 ? tail[0].name : null });
      hits = tail.length === 1 ? tail : hits.slice(0, 1);
    }
    names.set(address, hits[0].name);
  }
  const sortedNames: Record<string, string> = {};
  for (const a of [...names.keys()].sort((x, y) => x - y)) sortedNames[hex(a)] = names.get(a) ?? "";
  return { names: sortedNames, collisions, unmatched: unmatched.map(hex) };
}

function firstTailDifference(signatures: Signature[]): Dict {
  const [first, second] = signatures;
  const limit = Math.min(first.masked.length, second.masked.length);
  const lengths: Record<string, number> = {};
  lengths[first.name] = first.length;
  lengths[second.name] = second.length;
  for (let k = PATTERN_LENGTH; k < limit; k++) {
    const a = first.masked[k];
    const b = second.masked[k];
    if (a !== null && b !== null && a !== b) {
      const bytes: Record<string, string> = {};
      bytes[first.name] = a.toString(16).padStart(2, "0");
      bytes[second.name] = b.toString(16).padStart(2, "0");
      return { tailOffset: k, bytes, lengths };
    }
  }
  return { tailOffset: null, lengths };
}

export function parseObjdumpSections(text: string): [number, string, number, number][] {
  const rows: [number, string, number, number][] = [];
  let active = false;
  for (const line of splitlines(text)) {
    if (line.startsWith("Sections:")) {
      active = true;
      continue;
    }
    if (active) {
      if (!line.trim() || line.startsWith("Idx")) {
        if (line.startsWith("Idx")) continue;
        if (rows.length) active = false;
        continue;
      }
      const parts = splitWs(line);
      if (isDigits(parts[0])) {
        if (parts.length >= 4 && [...parts[2]].every((c) => "0123456789abcdef".includes(c))) {
          rows.push([parseInt(parts[0], 10), parts[1], parseInt(parts[2], 16), parseInt(parts[3], 16)]);
        } else if (parts.length >= 3) {
          rows.push([parseInt(parts[0], 10), "", parseInt(parts[1], 16), parseInt(parts[2], 16)]);
        }
      }
    }
  }
  return rows;
}

export function parseObjdumpRelocations(text: string): Map<string, [number, string, string][]> {
  const table = new Map<string, [number, string, string][]>();
  let current: string | null = null;
  const marker = "RELOCATION RECORDS FOR [";
  for (const line of splitlines(text)) {
    if (line.startsWith(marker)) {
      current = line.slice(marker.length, line.indexOf("]"));
      table.set(current, []);
      continue;
    }
    if (current === null || line.startsWith("OFFSET") || !line.trim()) {
      if (!line.trim()) current = null;
      continue;
    }
    const [offset, relType, value] = splitMax(line, 2);
    table.get(current)?.push([parseInt(offset, 16), relType, value.trim()]);
  }
  return table;
}

export function parseObjdumpCoffSymbols(text: string): [number, string][] {
  const rows: [number, string][] = [];
  for (const line of splitlines(text)) {
    if (line.startsWith("[") && line.includes("]")) {
      const index = parseInt(line.slice(1, line.indexOf("]")), 10);
      const parts = splitWs(line);
      rows.push([index, parts[parts.length - 1]]);
    }
  }
  return rows;
}

export function parseObjdumpDynamic(text: string): [string, string][] {
  const rows: [string, string][] = [];
  let active = false;
  for (const line of splitlines(text)) {
    if (line.startsWith("Dynamic Section:")) {
      active = true;
      continue;
    }
    if (active) {
      if (!line.trim()) break;
      const [tag, value] = splitMax(line, 1);
      rows.push([tag, value.trim()]);
    }
  }
  return rows;
}

export function parseObjdumpPeImports(text: string): [string, number, number, [number, string][]][] {
  const rows: [string, number, number, [number, string][]][] = [];
  let lookup = 0;
  let iat = 0;
  for (const line of splitlines(text)) {
    const stripped = line.trim();
    if (stripped.startsWith("lookup ")) {
      const parts = splitWs(stripped);
      lookup = parseInt(parts[1], 16);
      iat = parseInt(parts[9], 16);
    } else if (stripped.startsWith("DLL Name:")) {
      rows.push([stripped.slice(stripped.indexOf(":") + 1).trim(), lookup, iat, []]);
    } else if (rows.length && stripped && /[0-9]/.test(stripped[0]) && splitWs(stripped).length === 2) {
      const [hint, name] = splitWs(stripped);
      rows[rows.length - 1][3].push([parseInt(hint, 10), name]);
    }
  }
  return rows;
}

export function parseDyldFixups(text: string): [string, string, number, string, string][] {
  const rows: [string, string, number, string, string][] = [];
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length === 5 && parts[2].startsWith("0x")) rows.push([parts[0], parts[1], parseInt(parts[2], 16), parts[3], parts[4]]);
  }
  return rows;
}

export function parseDyldChainDetails(text: string): [number, bigint][] {
  const rows: [number, bigint][] = [];
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length >= 3 && parts[0].endsWith(":") && parts[1] === "raw:") {
      const raw = parts[2].startsWith("0x") ? parts[2] : "0x" + parts[2];
      rows.push([parseInt(parts[0].slice(0, -1), 16), BigInt(raw)]);
    }
  }
  return rows;
}

export function parseDyldImports(text: string): [number, string, string][] {
  const rows: [number, string, string][] = [];
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length >= 4 && parts[0].startsWith("0x") && parts[2] === "(from") rows.push([parseInt(parts[0], 16), parts[1], parts[3].replace(/\)+$/, "")]);
  }
  return rows;
}

export function parseDyldExports(text: string): [number, string][] {
  const rows: [number, string][] = [];
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length === 2 && parts[0].startsWith("0x")) rows.push([parseInt(parts[0], 16), parts[1]]);
  }
  return rows;
}

export function parseFunctionStarts(text: string): number[] {
  return splitlines(text).filter((line) => line.trim().startsWith("0x")).map((line) => parseInt(splitWs(line)[0], 16));
}

export function parseNmAddresses(text: string): Map<string, number> {
  const rows = new Map<string, number>();
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length === 3 && (parts[1] === "T" || parts[1] === "t")) rows.set(parts[2], parseInt(parts[0], 16));
  }
  return rows;
}

export function parseNmM(text: string): string[] {
  return splitlines(text).filter((line) => line.trim()).map((line) => splitWs(line).join(" "));
}

export function parseOtoolStubs(text: string): [number, string][] {
  const rows: [number, string][] = [];
  for (const line of splitlines(text)) {
    const parts = line.split("\t");
    if (parts.length >= 2 && parts[0].trim().startsWith("0000")) rows.push([parseInt(parts[0].trim(), 16), parts.slice(1).map((p) => p.trim()).join("\t")]);
  }
  return rows;
}

export function parseOtoolIndirect(text: string): [number, number, string][] {
  const rows: [number, number, string][] = [];
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length === 3 && parts[0].startsWith("0x")) rows.push([parseInt(parts[0], 16), parseInt(parts[1], 10), parts[2]]);
  }
  return rows;
}

export function parseOtoolHeaderFlags(text: string): number {
  for (const line of splitlines(text)) {
    const parts = splitWs(line);
    if (parts.length && parts[0] === "0xfeedfacf") return parseInt(parts[parts.length - 1], 16);
  }
  throw new FormatError("no Mach header line");
}

export function parseOtoolCommands(text: string): string[] {
  return splitlines(text).filter((line) => line.trim().startsWith("cmd ")).map((line) => splitWs(line)[1]);
}

export function fixtureText(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

export function elfReport(elf: ElfFile): Dict {
  const report: Dict = { type: elf.typeName, entry: hex(elf.entry), sections: elf.sections.filter((s) => s.name).map((s) => ({ name: s.name, size: s.size, addr: hex(s.addr) })) };
  if (elf.programHeaders.length) {
    report["programHeaders"] = elf.programHeaders.map((h) => ({ type: h.typeName, offset: hex(h.offset), vaddr: hex(h.vaddr), filesz: hex(h.filesz), flags: h.flagsText }));
  }
  if (elf.type !== ET_REL) {
    report["dynamic"] = elf.dynamicEntries().map((e) => ({ tag: e.tagName, value: e.text }));
    report["dynamicSymbols"] = elf.dynamicSymbols.filter((s) => s.name).map((s) => s.name);
    report["jumpSlots"] = elf.jumpSlots().map((r) => ({ slot: hex(r.offset), relocation: r.describe() }));
    report["plt0"] = elf.plt0();
    report["plt"] = elf.pltEntries().map((e) => ({ symbol: e.symbol, address: hex(e.address), bytes: hexbytes(e.raw), slot: hex(e.slot), pushIndex: e.pushIndex, slotInitial: hex(e.slotInitial), lines: e.lines() }));
    report["gotPlt"] = elf.gotPltWords().map(hex);
  } else {
    report["relocations"] = mapToObject(elf.relocations, (rows) => rows.map((r) => ({ offset: hex(r.offset), relocation: r.describe(), formula: ELF_RELOCATION_FORMULAS.get(r.type) ?? "" })));
    report["functions"] = elf.functions().map((s) => s.name);
    report["undefined"] = elf.symbols.filter((s) => !s.defined && s.name).map((s) => s.name);
  }
  return report;
}

export function coffReport(coff: CoffObject): Dict {
  return {
    machine: coff.machineName,
    sections: coff.sections.map((s) => ({ number: s.number, name: s.name, size: s.rawSize, relocations: s.relocCount, flags: s.flagNames() })),
    symbols: coff.symbols.map((s) => ({ index: s.index, name: s.name, section: s.sectionNumber, value: hex(s.value), storageClass: s.storageClass, type: hex(s.type), aux: s.aux.length })),
    sectionDefinitions: coff.sectionDefinitions(),
    relocations: mapToObject(coff.relocations, (rows) => rows.map((r) => ({ offset: hex(r.offset), type: r.typeName, symbol: r.symbolName }))),
    functions: coff.functions().map((s) => s.name),
    undefined: coff.undefined(),
  };
}

export function peReport(pe: PeImage): Dict {
  return {
    e_lfanew: hex(pe.eLfanew),
    machine: IMAGE_FILE_MACHINE_NAMES.get(pe.machine) ?? hex(pe.machine),
    magic: hex(pe.magic),
    entryPoint: hex(pe.entryPoint),
    imageBase: hex(pe.imageBase),
    sectionAlignment: hex(pe.sectionAlignment),
    fileAlignment: hex(pe.fileAlignment),
    sizeOfImage: hex(pe.sizeOfImage),
    subsystem: pe.subsystem,
    dllCharacteristics: pe.dllCharacteristicNames(),
    dataDirectories: pe.dataDirectories.filter(([, r, s]) => r || s).map(([n, r, s]) => ({ name: n, rva: hex(r), size: s })),
    sections: pe.sections.map((s) => ({ name: s.name, rva: hex(s.virtualAddress), virtualSize: s.virtualSize, rawSize: s.rawSize, rawOffset: hex(s.rawOffset) })),
    imports: pe.imports().map((d) => ({ dll: d.dll, descriptor: hex(d.rva), lookupTable: hex(d.lookupRva), iat: hex(d.iatRva), entries: d.entries.map((e) => ({ slot: hex(e.slotRva), hint: e.hint, name: e.name, lookup: hex(e.lookup) })) })),
    exports: pe.exports(),
    baseRelocations: pe.baseRelocations(),
    iatCalls: pe.iatCalls().map((c) => ({ ...c, rva: hex(c.rva), slot: hex(c.slot) })),
  };
}

export function machoReport(macho: MachoFile): Dict {
  const report: Dict = {
    filetype: macho.filetypeName,
    flags: hex(macho.flags),
    flagNames: macho.flagNames(),
    loadCommands: macho.commandNames(),
    libraries: macho.dylibs,
    rpaths: macho.rpaths,
    entry: macho.entryoff === null ? null : hex(macho.baseAddress + macho.entryoff),
    symtab: macho.symtab === null ? null : { nsyms: macho.symtab[1], strsize: macho.symtab[3] },
    functionStarts: macho.functionStarts().map(hex),
    twoLevelImports: macho.twoLevelImports().map(([name, library]) => `${name} (from ${library})`),
  };
  if (macho.filetype === 0x1) {
    report["relocations"] = mapToObject(macho.relocations(), (rows) => rows.map((r) => ({ address: hex(r.address), type: r.typeName, symbol: r.name, size: r.size })));
    report["functions"] = macho.textFunctions().map(([n, s, e]) => ({ name: n, start: hex(s), end: hex(e) }));
    return report;
  }
  if (macho.sections().some((s) => s.type === S_SYMBOL_STUBS)) {
    report["stubs"] = macho.stubs().map((s) => ({ symbol: s.symbol, address: hex(s.address), bytes: hexbytes(s.raw), slot: hex(s.slot), lines: s.lines() }));
  }
  const info = macho.chainedFixups();
  if (info !== null) {
    report["chainedFixups"] = { dataoff: info.dataoff, datasize: info.datasize, header: info.header, segments: info.segments, fixups: info.fixups.map((f) => f.toDict()), imports: info.imports.map((i) => ({ index: i.index, libOrdinal: i.libOrdinal, weak: i.weak, name: i.name, library: i.library })) };
    report["fixupRows"] = macho.fixupRows().map(([seg, sect, addr, kind, target]) => `${seg} ${sect} ${hex(addr)} ${kind} ${target}`);
  }
  if (macho.dyldInfo !== null && Object.keys(macho.dyldInfo).length) {
    report["dyldInfo"] = macho.dyldInfo;
    report["legacySections"] = macho.sections().filter((s) => ["__stub_helper", "__la_symbol_ptr", "__nl_symbol_ptr", "__got"].includes(s.sectname)).map((s) => `${s.segname},${s.sectname}`);
  }
  const exports = macho.exportsTrie();
  if (exports.length) {
    report["exports"] = exports.map((e) => ({ name: e.name, offset: hex(e.offset ?? 0), flags: e.flags }));
  }
  return report;
}

export function stripReport(before: MachoFile, after: MachoFile): Dict {
  const namesBefore = before.nlists.filter((n) => !n.isStab).map((n) => n.name).sort(compareStrings);
  const namesAfter = after.nlists.filter((n) => !n.isStab).map((n) => n.name).sort(compareStrings);
  return {
    nsymsBefore: before.symtab ? before.symtab[1] : 0,
    nsymsAfter: after.symtab ? after.symtab[1] : 0,
    removed: namesBefore.filter((n) => !namesAfter.includes(n)),
    kept: namesAfter,
    functionStartsBefore: before.functionStarts().length,
    functionStartsAfter: after.functionStarts().length,
    exportsBefore: before.exportsTrie().map((e) => e.name),
    exportsAfter: after.exportsTrie().map((e) => e.name),
  };
}

export function identificationReport(unstripped: MachoFile, stripped: MachoFile, objects: MachoFile[]): Dict {
  const truth = unstripped.textFunctions();
  const truthStarts = truth.map(([, start]) => start);
  const finder = new FunctionFinder(stripped);
  const methods = finder.methods();
  const signatures = objects.flatMap((macho) => signaturesFromObject(macho));
  const matched = matchSignatures(signatures, stripped, methods.get("functionStarts") ?? []);
  const methodsOut: Dict = {};
  for (const [name, found] of methods) methodsOut[name] = { found: found.map(hex), ...FunctionFinder.score(found, truthStarts) };
  return {
    truth: truth.map(([n, s, e]) => ({ name: n, start: hex(s), size: e - s })),
    strippedSymbolsInText: finder.symbols().map(hex),
    methods: methodsOut,
    signatures: { pat: signatures.map((s) => s.patLine()), ...matched },
    correctNames: truth.filter(([n, s]) => matched.names[hex(s)] === n).length,
  };
}

const FIXTURE_ELF_OBJECTS = ["main-x86_64-O1.o", "ledger-x86_64-O1.o"];
const FIXTURE_COFF_OBJECTS = ["main-x86_64.obj", "ledger-x86_64.obj"];

export function demo(): Dict {
  const objects = new Map<string, ElfFile>(FIXTURE_ELF_OBJECTS.map((name) => [name, loadElf(name)]));
  const tiny = loadElf("tiny-dyn-x86_64");
  const exe = loadMacho("ledger_main");
  const strippedExe = loadMacho("ledger_main.stripped");
  const dylib = loadMacho("libledger.dylib");
  const strippedDylib = loadMacho("libledger.stripped.dylib");
  const elfObjects: Dict = {};
  for (const [name, elf] of objects) {
    elfObjects[name] = { relocations: mapToObject(elf.relocations, (r) => r.length), functions: elf.functions().map((s) => s.name), undefined: elf.symbols.filter((s) => !s.defined && s.name).map((s) => s.name) };
  }
  const plan = planDynamicLink(objects);
  const linkPlan: Dict = {};
  for (const [k, v] of Object.entries(plan)) {
    if (k !== "decisions") linkPlan[k] = v;
  }
  const coff: Dict = {};
  for (const name of FIXTURE_COFF_OBJECTS) coff[name] = pick(coffReport(loadCoff(name)), ["machine", "sections", "relocations", "functions", "undefined"]);
  const identification: Dict = {};
  for (const level of ["O0", "O2"]) {
    identification[level] = identificationReport(loadMacho(`static-arm64-${level}`), loadMacho(`static-arm64-${level}.stripped`), [loadMacho(`main-arm64-${level}.o`), loadMacho(`ledger-arm64-${level}.o`)]);
  }
  return {
    elf: {
      objects: elfObjects,
      linkPlan,
      "tiny-dyn-x86_64": elfReport(tiny),
    },
    coff,
    pe: peReport(loadPe("tiny-x86_64.exe")),
    macho: {
      ledger_main: machoReport(exe),
      ledger_main_nochain: pick(machoReport(loadMacho("ledger_main_nochain")), ["flags", "flagNames", "loadCommands", "dyldInfo", "legacySections"]),
      "libledger.dylib": pick(machoReport(dylib), ["filetype", "flagNames", "exports", "functionStarts", "symtab"]),
      strip: { ledger_main: stripReport(exe, strippedExe), "libledger.dylib": stripReport(dylib, strippedDylib) },
    },
    identification,
  };
}

function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`assertion failed: ${what}`);
  return value;
}

export function figureData(): Dict {
  const tiny = loadElf("tiny-dyn-x86_64");
  const entry = required(tiny.pltEntries().find((e) => e.symbol === "puts"), "puts@plt");
  const text = tiny.section(".text");
  let callAt: number | null = null;
  for (let position = 0; position < text.size - 4; position++) {
    if (text.data[position] === 0xe8 && text.addr + position + 5 + i32(text.data, position + 1) === entry.address) {
      callAt = text.addr + position;
      break;
    }
  }
  const callAddress = required(callAt, "call to puts@plt");
  const plt0 = tiny.plt0();
  const jumpSlot = required(tiny.jumpSlots().find((r) => r.offset === entry.slot), "jump slot");
  const elf = {
    file: "tiny-dyn-x86_64",
    symbol: "puts",
    call: { address: callAddress, bytes: hexbytes(tiny.read(callAddress, 5)), text: `callq ${hex(entry.address)} <puts@plt>`, target: entry.address },
    stub: { label: "puts@plt", address: entry.address, bytes: hexbytes(entry.raw), lines: entry.lines(), slot: entry.slot },
    plt0: { address: plt0.address, bytes: plt0.bytes, lines: plt0.lines },
    slot: { label: ".got.plt", address: entry.slot, initial: hex(entry.slotInitial), initialMeaning: `${hex(entry.slotInitial)} = the pushq inside puts@plt, so the first call falls into PLT0`, relocation: jumpSlot.describe(), after: "ld.so writes the address of puts from libc.so.6 here on the first call, or at startup with DF_BIND_NOW" },
    dynamic: tiny.dynamicEntries().filter((e) => [DT_NEEDED, DT_PLTGOT, DT_JMPREL, DT_PLTRELSZ, DT_PLTREL, DT_FLAGS_1].includes(e.tag)).map((e) => [e.tagName, e.text]),
  };
  const pe = loadPe("tiny-x86_64.exe");
  const call = required(pe.iatCalls().find((c) => c.name === "puts"), "IAT call to puts");
  const descriptor = pe.imports()[0];
  const importEntry = required(descriptor.entries.find((e) => e.name === "puts"), "import entry puts");
  const peData = {
    file: "tiny-x86_64.exe",
    symbol: "puts",
    call: { address: call.rva, bytes: call.bytes, text: call.text, target: call.slot },
    slot: { label: "IAT", address: importEntry.slotRva, initial: hex(importEntry.lookup), initialMeaning: `${hex(importEntry.lookup)} = RVA of the hint/name entry: hint ${importEntry.hint}, name puts`, relocation: `import descriptor at ${hex(descriptor.rva)}: ${descriptor.dll}`, after: "the Windows loader writes the address of puts from msvcrt.dll here before the entry point runs" },
    descriptor: { address: descriptor.rva, lookup: descriptor.lookupRva, name: descriptor.nameRva, iat: descriptor.iatRva, dll: descriptor.dll },
  };
  const exe = loadMacho("ledger_main");
  const stub = required(exe.stubs().find((s) => s.symbol === "_puts"), "stub _puts");
  const mainStart = exe.baseAddress + (exe.entryoff || 0);
  const textSection = exe.textSection();
  const code = exe.sectionBytes(textSection);
  let blAt: number | null = null;
  for (let k = 0; k < code.length - 3; k += 4) {
    const address = textSection.addr + k;
    if (address >= mainStart && decodeBl(u32(code, k), address) === stub.address) {
      blAt = address;
      break;
    }
  }
  const blAddress = required(blAt, "bl to _puts stub");
  const info = required(exe.chainedFixups(), "chained fixups");
  const fixup = required(info.fixups.find((f) => f.address === stub.slot), "fixup at stub slot");
  const chainedImport = info.imports[fixup.ordinal || 0];
  const rawText = `0x${fixup.raw.toString(16).padStart(16, "0")}`;
  const macho = {
    file: "ledger_main",
    symbol: "_puts",
    call: { address: blAddress, bytes: hexbytes(exe.read(blAddress, 4)), text: `bl ${hex(stub.address)}`, target: stub.address },
    stub: { label: "__stubs", address: stub.address, bytes: hexbytes(stub.raw), lines: stub.lines(), slot: stub.slot },
    slot: { label: "__got", address: stub.slot, initial: rawText, initialMeaning: `${rawText} is not an address: bit 63 = bind, next = ${fixup.next} (x4 bytes), ordinal = ${fixup.ordinal}`, relocation: `chained import ${fixup.ordinal}: ${chainedImport.name} (from ${chainedImport.library})`, after: "dyld writes the address of _puts from libSystem here while it walks the chain, before main runs" },
    imports: info.imports.map((i) => [i.index, i.name, i.library]),
  };
  const unstripped = loadMacho("static-arm64-O2");
  const stripped = loadMacho("static-arm64-O2.stripped");
  const truth = unstripped.textFunctions();
  const finder = new FunctionFinder(stripped);
  const methods = finder.methods();
  const signatures = ["main-arm64-O2.o", "ledger-arm64-O2.o"].flatMap((name) => signaturesFromObject(loadMacho(name)));
  const matched = matchSignatures(signatures, stripped, methods.get("functionStarts") ?? []);
  const labels: Record<string, string> = { functionStarts: "LC_FUNCTION_STARTS", prologueSub: "prologue scan: sub sp, sp, #imm", prologueStp: "prologue scan: stp x29, x30, [sp, #-0x10]!", callTargets: "bl targets + LC_MAIN entry", signatures: "signatures from our objects" };
  const methodRows: Dict[] = [...methods].map(([name, found]) => ({ id: name, label: labels[name], found }));
  methodRows.push({ id: "signatures", label: labels["signatures"], found: Object.keys(matched.names).map((a) => parseInt(a, 16)), names: matched.names });
  return {
    elf,
    pe: peData,
    macho,
    stripped: {
      file: "static-arm64-O2.stripped",
      textStart: stripped.textSection().addr,
      textEnd: stripped.textSection().addr + stripped.textSection().size,
      truth: truth.map(([n, s, e]) => ({ name: n, start: s, end: e })),
      methods: methodRows,
      collisions: matched.collisions,
    },
  };
}

export function main(argv: string[]): number {
  if (!argv.length) {
    console.log(pyJson(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "figure-data") {
    console.log(pyJson(figureData()));
    return 0;
  }
  if (argv.length === 2 && ["elf", "coff", "pe", "macho"].includes(command)) {
    const data = readFileSync(argv[1]);
    const readers: Record<string, (d: Buffer) => Dict> = {
      elf: (d) => elfReport(new ElfFile(d)),
      coff: (d) => coffReport(new CoffObject(d)),
      pe: (d) => peReport(new PeImage(d)),
      macho: (d) => machoReport(new MachoFile(d)),
    };
    console.log(pyJson(readers[command](data), 2));
    return 0;
  }
  if (command === "plan" && argv.length >= 2) {
    const objects = new Map<string, ElfFile>(argv.slice(1).map((p) => [path.basename(p), new ElfFile(readFileSync(p))]));
    console.log(pyJson(planDynamicLink(objects), 2));
    return 0;
  }
  if (command === "functions" && [3, 4, 5].includes(argv.length)) {
    const stripped = new MachoFile(readFileSync(argv[1]));
    const unstripped = new MachoFile(readFileSync(argv[2]));
    const objects = argv.slice(3).map((p) => new MachoFile(readFileSync(p)));
    console.log(pyJson(identificationReport(unstripped, stripped, objects), 2));
    return 0;
  }
  console.error("usage: main.py [elf FILE | coff FILE | pe FILE | macho FILE | plan OBJECT... | functions STRIPPED UNSTRIPPED [OBJECT...] | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
