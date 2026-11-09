// Lesson: Program Anatomy: An ELF Reader From Scratch (phase 13 / lesson 32)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code/main.ts

import { readFileSync } from "node:fs";
import * as path from "node:path";

export const FIXTURES = path.join(__dirname, "fixtures");

export class FormatError extends Error {}

export class KeyError extends Error {}

const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
const ELFCLASS64 = 2;
const ELFDATA2LSB = 1;
const EHDR_SIZE = 64;
const SHDR_SIZE = 64;
const PHDR_SIZE = 56;
const SYM_SIZE = 24;
const RELA_SIZE = 24;

const E_TYPE: Record<number, string> = { 0: "ET_NONE", 1: "ET_REL", 2: "ET_EXEC", 3: "ET_DYN", 4: "ET_CORE" };
const E_MACHINE: Record<number, string> = {
  0: "EM_NONE", 3: "EM_386", 40: "EM_ARM", 62: "EM_X86_64", 183: "EM_AARCH64", 243: "EM_RISCV",
};
const OSABI: Record<number, string> = { 0: "SYSV", 3: "LINUX", 9: "FREEBSD" };

const SHT: Record<number, string> = {
  0: "NULL", 1: "PROGBITS", 2: "SYMTAB", 3: "STRTAB", 4: "RELA", 5: "HASH", 6: "DYNAMIC", 7: "NOTE",
  8: "NOBITS", 9: "REL", 10: "SHLIB", 11: "DYNSYM", 14: "INIT_ARRAY", 15: "FINI_ARRAY",
  16: "PREINIT_ARRAY", 17: "GROUP", 18: "SYMTAB_SHNDX", 0x6fff4c03: "LLVM_ADDRSIG",
};
const SHT_NOBITS = 8;
const SHT_SYMTAB = 2;
const SHT_RELA = 4;
const SHF: [number, string][] = [
  [0x1, "W"], [0x2, "A"], [0x4, "X"], [0x10, "M"], [0x20, "S"], [0x40, "I"],
  [0x80, "L"], [0x100, "O"], [0x200, "G"], [0x400, "T"], [0x80000000, "E"],
];
const SHF_ALLOC = 0x2;
const SHF_EXECINSTR = 0x4;

const SHN_UNDEF = 0;
const SHN_LORESERVE = 0xff00;
const SHN_ABS = 0xfff1;
const SHN_COMMON = 0xfff2;

const STB: Record<number, string> = { 0: "LOCAL", 1: "GLOBAL", 2: "WEAK" };
const STT: Record<number, string> = {
  0: "NOTYPE", 1: "OBJECT", 2: "FUNC", 3: "SECTION", 4: "FILE", 5: "COMMON", 6: "TLS",
};
const STV: Record<number, string> = { 0: "DEFAULT", 1: "INTERNAL", 2: "HIDDEN", 3: "PROTECTED" };
const STT_FUNC = 2;
const STT_SECTION = 3;

const PT: Record<number, string> = {
  0: "PT_NULL", 1: "PT_LOAD", 2: "PT_DYNAMIC", 3: "PT_INTERP", 4: "PT_NOTE", 5: "PT_SHLIB",
  6: "PT_PHDR", 7: "PT_TLS", 0x6474e550: "PT_GNU_EH_FRAME", 0x6474e551: "PT_GNU_STACK",
  0x6474e552: "PT_GNU_RELRO", 0x6474e553: "PT_GNU_PROPERTY",
};
const PT_LOAD = 1;

const R_X86_64: Record<number, string> = {
  0: "R_X86_64_NONE", 1: "R_X86_64_64", 2: "R_X86_64_PC32", 3: "R_X86_64_GOT32", 4: "R_X86_64_PLT32",
  5: "R_X86_64_COPY", 6: "R_X86_64_GLOB_DAT", 7: "R_X86_64_JUMP_SLOT", 8: "R_X86_64_RELATIVE",
  9: "R_X86_64_GOTPCREL", 10: "R_X86_64_32", 11: "R_X86_64_32S", 12: "R_X86_64_16", 13: "R_X86_64_PC16",
  14: "R_X86_64_8", 15: "R_X86_64_PC8", 16: "R_X86_64_DTPMOD64", 17: "R_X86_64_DTPOFF64",
  18: "R_X86_64_TPOFF64", 19: "R_X86_64_TLSGD", 20: "R_X86_64_TLSLD", 21: "R_X86_64_DTPOFF32",
  22: "R_X86_64_GOTTPOFF", 23: "R_X86_64_TPOFF32", 24: "R_X86_64_PC64", 25: "R_X86_64_GOTOFF64",
  26: "R_X86_64_GOTPC32", 32: "R_X86_64_SIZE32", 33: "R_X86_64_SIZE64", 34: "R_X86_64_GOTPC32_TLSDESC",
  35: "R_X86_64_TLSDESC_CALL", 36: "R_X86_64_TLSDESC", 37: "R_X86_64_IRELATIVE",
  41: "R_X86_64_GOTPCRELX", 42: "R_X86_64_REX_GOTPCRELX",
};
const R_AARCH64: Record<number, string> = {
  257: "R_AARCH64_ABS64", 275: "R_AARCH64_ADR_PREL_PG_HI21", 277: "R_AARCH64_ADD_ABS_LO12_NC",
  282: "R_AARCH64_JUMP26", 283: "R_AARCH64_CALL26", 299: "R_AARCH64_LDST128_ABS_LO12_NC",
  1025: "R_AARCH64_GLOB_DAT", 1026: "R_AARCH64_JUMP_SLOT", 1027: "R_AARCH64_RELATIVE", 1031: "R_AARCH64_TLSDESC",
};
const RELOCATION_NAMES: Record<number, Record<number, string>> = { 62: R_X86_64, 183: R_AARCH64 };

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

function lookup(table: Record<number, string>, key: number, fallback: string): string {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : fallback;
}

function hasBit(value: number, bit: number): boolean {
  return Math.floor(value / bit) % 2 === 1;
}

function rpad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function lpad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

function bytesHex(data: Buffer, separator: string = ""): string {
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join(separator);
}

function bytesRepr(data: Buffer): string {
  const quote = data.includes(0x27) && !data.includes(0x22) ? '"' : "'";
  let out = "b" + quote;
  for (const byte of data) {
    if (byte === 0x5c) out += "\\\\";
    else if (byte === 0x09) out += "\\t";
    else if (byte === 0x0a) out += "\\n";
    else if (byte === 0x0d) out += "\\r";
    else if (String.fromCharCode(byte) === quote) out += "\\" + quote;
    else if (byte >= 0x20 && byte < 0x7f) out += String.fromCharCode(byte);
    else out += "\\x" + byte.toString(16).padStart(2, "0");
  }
  return out + quote;
}

export function strRepr(value: string): string {
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  let out = quote;
  for (const character of value) {
    const code = character.codePointAt(0) as number;
    if (character === "\\") out += "\\\\";
    else if (character === "\t") out += "\\t";
    else if (character === "\n") out += "\\n";
    else if (character === "\r") out += "\\r";
    else if (character === quote) out += "\\" + quote;
    else if (code < 0x20 || code === 0x7f) out += "\\x" + code.toString(16).padStart(2, "0");
    else out += character;
  }
  return out + quote;
}

function listRepr(values: string[]): string {
  return "[" + values.map((value) => strRepr(value)).join(", ") + "]";
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

export class ElfHeader {
  constructor(
    readonly elf_class: number,
    readonly data: number,
    readonly ident_version: number,
    readonly osabi: number,
    readonly e_type: number,
    readonly e_machine: number,
    readonly e_version: number,
    readonly e_entry: number,
    readonly e_phoff: number,
    readonly e_shoff: number,
    readonly e_flags: number,
    readonly e_ehsize: number,
    readonly e_phentsize: number,
    readonly e_phnum: number,
    readonly e_shentsize: number,
    readonly e_shnum: number,
    readonly e_shstrndx: number,
  ) {}

  get type_name(): string {
    return lookup(E_TYPE, this.e_type, hex(this.e_type));
  }

  get machine_name(): string {
    return lookup(E_MACHINE, this.e_machine, hex(this.e_machine));
  }
}

export class Section {
  constructor(
    readonly index: number,
    readonly name: string,
    readonly sh_name: number,
    readonly sh_type: number,
    readonly sh_flags: number,
    readonly sh_addr: number,
    readonly sh_offset: number,
    readonly sh_size: number,
    readonly sh_link: number,
    readonly sh_info: number,
    readonly sh_addralign: number,
    readonly sh_entsize: number,
  ) {}

  get type_name(): string {
    return lookup(SHT, this.sh_type, hex(this.sh_type));
  }

  get flags_text(): string {
    return SHF.filter(([bit]) => hasBit(this.sh_flags, bit))
      .map(([, letter]) => letter)
      .join("");
  }

  get file_size(): number {
    return this.sh_type === SHT_NOBITS ? 0 : this.sh_size;
  }

  get objdump_kind(): string {
    if (hasBit(this.sh_flags, SHF_EXECINSTR)) return "TEXT";
    if (hasBit(this.sh_flags, SHF_ALLOC) && this.sh_type === SHT_NOBITS) return "BSS";
    if (hasBit(this.sh_flags, SHF_ALLOC)) return "DATA";
    return "";
  }
}

export class Symbol {
  constructor(
    readonly index: number,
    readonly name: string,
    readonly st_name: number,
    readonly st_info: number,
    readonly st_other: number,
    readonly st_shndx: number,
    readonly st_value: number,
    readonly st_size: number,
    readonly section_name: string,
  ) {}

  get bind(): string {
    return lookup(STB, this.st_info >> 4, String(this.st_info >> 4));
  }

  get type(): string {
    return lookup(STT, this.st_info & 0xf, String(this.st_info & 0xf));
  }

  get visibility(): string {
    return lookup(STV, this.st_other & 0x3, String(this.st_other & 0x3));
  }

  get display_name(): string {
    if ((this.st_info & 0xf) === STT_SECTION && !this.name) return this.section_name;
    return this.name;
  }
}

export class Relocation {
  constructor(
    readonly table: string,
    readonly target_section: string,
    readonly r_offset: number,
    readonly r_type: number,
    readonly type_name: string,
    readonly sym_index: number,
    readonly symbol: string,
    readonly r_addend: number,
  ) {}

  get value_text(): string {
    if (this.r_addend > 0) return `${this.symbol}+${hex(this.r_addend)}`;
    if (this.r_addend < 0) return `${this.symbol}-${hex(-this.r_addend)}`;
    return this.symbol;
  }
}

export class ProgramHeader {
  constructor(
    readonly index: number,
    readonly p_type: number,
    readonly p_flags: number,
    readonly p_offset: number,
    readonly p_vaddr: number,
    readonly p_paddr: number,
    readonly p_filesz: number,
    readonly p_memsz: number,
    readonly p_align: number,
  ) {}

  get type_name(): string {
    return lookup(PT, this.p_type, hex(this.p_type));
  }

  get flags_text(): string {
    return (this.p_flags & 4 ? "r" : "-") + (this.p_flags & 2 ? "w" : "-") + (this.p_flags & 1 ? "x" : "-");
  }
}

export class Span {
  constructor(
    readonly file_offset: number,
    readonly size: number,
    readonly container: string,
  ) {}
}

export class Region {
  constructor(
    readonly name: string,
    readonly kind: string,
    readonly offset: number,
    readonly size: number,
  ) {}

  get end(): number {
    return this.offset + this.size;
  }
}

export class ElfFile {
  readonly data: Buffer;
  readonly header: ElfHeader;
  readonly sections: Section[];
  readonly program_headers: ProgramHeader[];
  readonly symbols: Symbol[];
  readonly relocations: Relocation[];

  constructor(data: Buffer) {
    this.data = Buffer.from(data);
    this.header = this.readHeader();
    this.sections = this.readSections();
    this.program_headers = this.readProgramHeaders();
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  static fromPath(filePath: string): ElfFile {
    return new ElfFile(readFileSync(filePath));
  }

  private readHeader(): ElfHeader {
    const data = this.data;
    if (data.length < EHDR_SIZE) {
      throw new FormatError(`file is ${data.length} bytes, shorter than the 64-byte ELF header`);
    }
    if (!data.subarray(0, 4).equals(ELF_MAGIC)) {
      throw new FormatError(`magic is ${bytesRepr(data.subarray(0, 4))}, expected ${bytesRepr(ELF_MAGIC)}`);
    }
    if (data[4] !== ELFCLASS64) {
      throw new FormatError(`EI_CLASS is ${data[4]}, this reader handles ELFCLASS64 (2) only`);
    }
    if (data[5] !== ELFDATA2LSB) {
      throw new FormatError(`EI_DATA is ${data[5]}, this reader handles ELFDATA2LSB (1) only`);
    }
    const header = new ElfHeader(
      data[4],
      data[5],
      data[6],
      data[7],
      data.readUInt16LE(16),
      data.readUInt16LE(18),
      data.readUInt32LE(20),
      u64(data, 24),
      u64(data, 32),
      u64(data, 40),
      data.readUInt32LE(48),
      data.readUInt16LE(52),
      data.readUInt16LE(54),
      data.readUInt16LE(56),
      data.readUInt16LE(58),
      data.readUInt16LE(60),
      data.readUInt16LE(62),
    );
    if (header.e_shnum && header.e_shentsize !== SHDR_SIZE) {
      throw new FormatError(`e_shentsize is ${header.e_shentsize}, expected ${SHDR_SIZE}`);
    }
    if (header.e_phnum && header.e_phentsize !== PHDR_SIZE) {
      throw new FormatError(`e_phentsize is ${header.e_phentsize}, expected ${PHDR_SIZE}`);
    }
    return header;
  }

  private table(offset: number, count: number, entrySize: number, what: string): Buffer {
    const end = offset + count * entrySize;
    if (end > this.data.length) {
      throw new FormatError(`${what} ends at ${hex(end)}, past the ${this.data.length}-byte file`);
    }
    return this.data.subarray(offset, end);
  }

  private readSections(): Section[] {
    const h = this.header;
    if (h.e_shoff === 0 || h.e_shnum === 0) return [];
    const raw = this.table(h.e_shoff, h.e_shnum, SHDR_SIZE, "section header table");
    const rows: number[][] = [];
    for (let i = 0; i < h.e_shnum; i++) {
      const base = i * SHDR_SIZE;
      rows.push([
        raw.readUInt32LE(base),
        raw.readUInt32LE(base + 4),
        u64(raw, base + 8),
        u64(raw, base + 16),
        u64(raw, base + 24),
        u64(raw, base + 32),
        raw.readUInt32LE(base + 40),
        raw.readUInt32LE(base + 44),
        u64(raw, base + 48),
        u64(raw, base + 56),
      ]);
    }
    if (h.e_shstrndx >= h.e_shnum) {
      throw new FormatError(`e_shstrndx ${h.e_shstrndx} is outside the ${h.e_shnum} section headers`);
    }
    const shstr = rows[h.e_shstrndx];
    const strtab = this.data.subarray(shstr[4], shstr[4] + shstr[5]);
    return rows.map(
      (row, index) =>
        new Section(index, readCstring(strtab, row[0]), row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9]),
    );
  }

  section(name: string): Section {
    for (const section of this.sections) {
      if (section.name === name) return section;
    }
    throw new KeyError(`no section named ${strRepr(name)}`);
  }

  section_bytes(section: Section): Buffer {
    if (section.sh_type === SHT_NOBITS) return Buffer.alloc(0);
    return this.data.subarray(section.sh_offset, section.sh_offset + section.sh_size);
  }

  string(strtabIndex: number, offset: number): string {
    return readCstring(this.section_bytes(this.sections[strtabIndex]), offset);
  }

  section_name_for_index(shndx: number): string {
    if (shndx === SHN_UNDEF) return "*UND*";
    if (shndx === SHN_ABS) return "*ABS*";
    if (shndx === SHN_COMMON) return "*COM*";
    if (shndx >= SHN_LORESERVE || shndx >= this.sections.length) return hex(shndx);
    return this.sections[shndx].name;
  }

  private readProgramHeaders(): ProgramHeader[] {
    const h = this.header;
    if (h.e_phoff === 0 || h.e_phnum === 0) return [];
    const raw = this.table(h.e_phoff, h.e_phnum, PHDR_SIZE, "program header table");
    const out: ProgramHeader[] = [];
    for (let i = 0; i < h.e_phnum; i++) {
      const base = i * PHDR_SIZE;
      out.push(
        new ProgramHeader(
          i,
          raw.readUInt32LE(base),
          raw.readUInt32LE(base + 4),
          u64(raw, base + 8),
          u64(raw, base + 16),
          u64(raw, base + 24),
          u64(raw, base + 32),
          u64(raw, base + 40),
          u64(raw, base + 48),
        ),
      );
    }
    return out;
  }

  private readSymbols(): Symbol[] {
    const symtabs = this.sections.filter((s) => s.sh_type === SHT_SYMTAB);
    if (symtabs.length === 0) return [];
    const symtab = symtabs[0];
    if (symtab.sh_entsize !== 0 && symtab.sh_entsize !== SYM_SIZE) {
      throw new FormatError(`.symtab sh_entsize is ${symtab.sh_entsize}, expected ${SYM_SIZE}`);
    }
    const raw = this.section_bytes(symtab);
    const count = Math.floor(raw.length / SYM_SIZE);
    const symbols: Symbol[] = [];
    for (let index = 0; index < count; index++) {
      const base = index * SYM_SIZE;
      const stName = raw.readUInt32LE(base);
      const stInfo = raw[base + 4];
      const stOther = raw[base + 5];
      const stShndx = raw.readUInt16LE(base + 6);
      const stValue = u64(raw, base + 8);
      const stSize = u64(raw, base + 16);
      const name = this.string(symtab.sh_link, stName);
      const sectionName = this.section_name_for_index(stShndx);
      symbols.push(new Symbol(index, name, stName, stInfo, stOther, stShndx, stValue, stSize, sectionName));
    }
    return symbols;
  }

  symbol(name: string): Symbol {
    for (const symbol of this.symbols) {
      if (symbol.name === name) return symbol;
    }
    throw new KeyError(`no symbol named ${strRepr(name)}`);
  }

  private readRelocations(): Relocation[] {
    const names = RELOCATION_NAMES[this.header.e_machine] ?? {};
    const out: Relocation[] = [];
    for (const section of this.sections) {
      if (section.sh_type !== SHT_RELA) continue;
      if (section.sh_entsize !== 0 && section.sh_entsize !== RELA_SIZE) {
        throw new FormatError(`${section.name} sh_entsize is ${section.sh_entsize}, expected ${RELA_SIZE}`);
      }
      const target = this.section_name_for_index(section.sh_info);
      const raw = this.section_bytes(section);
      for (let i = 0; i < Math.floor(raw.length / RELA_SIZE); i++) {
        const base = i * RELA_SIZE;
        const rOffset = u64(raw, base);
        const rInfo = raw.readBigUInt64LE(base + 8);
        const rAddend = Number(raw.readBigInt64LE(base + 16));
        const symIndex = Number(rInfo >> 32n);
        const rType = Number(rInfo & 0xffffffffn);
        const symbol = symIndex < this.symbols.length ? this.symbols[symIndex].display_name : hex(symIndex);
        const typeName = lookup(names, rType, `R_${rType}`);
        out.push(new Relocation(section.name, target, rOffset, rType, typeName, symIndex, symbol, rAddend));
      }
    }
    return out;
  }

  relocations_for(targetSection: string): Relocation[] {
    return this.relocations.filter((r) => r.target_section === targetSection);
  }

  function_span(name: string): Span {
    const symbol = this.symbol(name);
    if ((symbol.st_info & 0xf) !== STT_FUNC) {
      throw new KeyError(`${strRepr(name)} is a ${symbol.type} symbol, not a FUNC`);
    }
    if (symbol.st_shndx === SHN_UNDEF || symbol.st_shndx >= SHN_LORESERVE) {
      throw new KeyError(`${strRepr(name)} has no section in this file (st_shndx ${hex(symbol.st_shndx)})`);
    }
    const section = this.sections[symbol.st_shndx];
    const fileOffset = section.sh_offset + (symbol.st_value - section.sh_addr);
    if (symbol.st_value - section.sh_addr + symbol.st_size > section.sh_size) {
      throw new FormatError(`${strRepr(name)} runs past the end of ${section.name}`);
    }
    return new Span(fileOffset, symbol.st_size, section.name);
  }

  function_bytes(name: string): Buffer {
    const span = this.function_span(name);
    return this.data.subarray(span.file_offset, span.file_offset + span.size);
  }

  address_to_file_offset(address: number): number {
    if (this.header.e_type === 1) {
      throw new KeyError("relocatable object: every address is relative to its section, use function_span");
    }
    for (const ph of this.program_headers) {
      if (ph.p_type === PT_LOAD && ph.p_vaddr <= address && address < ph.p_vaddr + ph.p_filesz) {
        return ph.p_offset + (address - ph.p_vaddr);
      }
    }
    for (const section of this.sections) {
      if (!hasBit(section.sh_flags, SHF_ALLOC) || section.sh_type === SHT_NOBITS) continue;
      if (section.sh_addr <= address && address < section.sh_addr + section.sh_size) {
        return section.sh_offset + (address - section.sh_addr);
      }
    }
    throw new KeyError(`address ${hex(address)} is in no PT_LOAD segment and no allocated section`);
  }

  file_offset_map(): Region[] {
    const h = this.header;
    const regions: Region[] = [new Region("ELF header", "header", 0, EHDR_SIZE)];
    if (h.e_phnum) regions.push(new Region("program header table", "table", h.e_phoff, h.e_phnum * PHDR_SIZE));
    for (const section of this.sections) {
      if (section.index === 0 || section.file_size === 0) continue;
      regions.push(new Region(section.name, "section", section.sh_offset, section.file_size));
    }
    if (h.e_shnum) regions.push(new Region("section header table", "table", h.e_shoff, h.e_shnum * SHDR_SIZE));
    regions.sort((a, b) => a.offset - b.offset || a.size - b.size);
    const filled: Region[] = [];
    let cursor = 0;
    for (const region of regions) {
      if (region.offset < cursor) {
        throw new FormatError(`${region.name} at ${hex(region.offset)} overlaps the region before it`);
      }
      if (region.offset > cursor) filled.push(new Region("inactive space", "gap", cursor, region.offset - cursor));
      filled.push(region);
      cursor = region.end;
    }
    if (cursor < this.data.length) {
      filled.push(new Region("inactive space", "gap", cursor, this.data.length - cursor));
    }
    if (cursor > this.data.length) {
      throw new FormatError(`structures end at ${hex(cursor)}, past the ${this.data.length}-byte file`);
    }
    return filled;
  }
}

export function fixedName(raw: Buffer): string {
  let end = raw.length;
  while (end > 0 && raw[end - 1] === 0) end--;
  return Array.from(raw.subarray(0, end), (byte) => (byte < 0x80 ? String.fromCharCode(byte) : "�")).join("");
}

export function readCstring(table: Buffer, offset: number): string {
  if (offset >= table.length) {
    throw new FormatError(`string offset ${hex(offset)} is outside a ${table.length}-byte string table`);
  }
  const end = table.indexOf(0, offset);
  if (end < 0) throw new FormatError(`string at ${hex(offset)} has no terminating zero byte`);
  return new TextDecoder("utf-8").decode(table.subarray(offset, end));
}

const MH_MAGIC_64 = 0xfeedfacf;
const MH_CIGAM_64 = 0xcffaedfe;
const MH_MAGIC_32 = 0xfeedface;
const FAT_MAGIC = 0xcafebabe;
const MACH_HEADER_64_SIZE = 32;
const LC_REQ_DYLD = 0x80000000;

const CPU_TYPE: Record<number, string> = {
  0x01000007: "CPU_TYPE_X86_64", 0x0100000c: "CPU_TYPE_ARM64", 7: "CPU_TYPE_X86", 12: "CPU_TYPE_ARM",
};
const MH_FILETYPE: Record<number, string> = {
  0x1: "MH_OBJECT", 0x2: "MH_EXECUTE", 0x3: "MH_FVMLIB", 0x4: "MH_CORE", 0x5: "MH_PRELOAD", 0x6: "MH_DYLIB",
  0x7: "MH_DYLINKER", 0x8: "MH_BUNDLE", 0x9: "MH_DYLIB_STUB", 0xa: "MH_DSYM", 0xb: "MH_KEXT_BUNDLE", 0xc: "MH_FILESET",
};
const MH_FLAGS: [number, string][] = [
  [0x1, "MH_NOUNDEFS"], [0x4, "MH_DYLDLINK"], [0x80, "MH_TWOLEVEL"], [0x2000, "MH_SUBSECTIONS_VIA_SYMBOLS"],
  [0x200000, "MH_PIE"], [0x800000, "MH_HAS_TLV_DESCRIPTORS"],
];
const LC: Record<number, string> = {
  0x1: "LC_SEGMENT", 0x2: "LC_SYMTAB", 0x5: "LC_UNIXTHREAD", 0xb: "LC_DYSYMTAB", 0xc: "LC_LOAD_DYLIB",
  0xd: "LC_ID_DYLIB", 0xe: "LC_LOAD_DYLINKER", 0x19: "LC_SEGMENT_64", 0x1b: "LC_UUID",
  [0x1c + LC_REQ_DYLD]: "LC_RPATH", 0x1d: "LC_CODE_SIGNATURE", 0x22: "LC_DYLD_INFO",
  [0x22 + LC_REQ_DYLD]: "LC_DYLD_INFO_ONLY", 0x26: "LC_FUNCTION_STARTS", [0x28 + LC_REQ_DYLD]: "LC_MAIN",
  0x29: "LC_DATA_IN_CODE", 0x2a: "LC_SOURCE_VERSION", 0x2e: "LC_LINKER_OPTIMIZATION_HINT",
  0x32: "LC_BUILD_VERSION", [0x33 + LC_REQ_DYLD]: "LC_DYLD_EXPORTS_TRIE", [0x34 + LC_REQ_DYLD]: "LC_DYLD_CHAINED_FIXUPS",
};
const LC_SEGMENT_64 = 0x19;
const LC_SYMTAB = 0x2;
const LC_BUILD_VERSION = 0x32;
const PLATFORM: Record<number, string> = {
  1: "macos", 2: "ios", 3: "tvos", 4: "watchos", 5: "bridgeos", 6: "maccatalyst", 7: "iossimulator",
};
const SECTION_TYPE: Record<number, string> = {
  0x0: "S_REGULAR", 0x1: "S_ZEROFILL", 0x2: "S_CSTRING_LITERALS", 0x6: "S_NON_LAZY_SYMBOL_POINTERS",
  0x7: "S_LAZY_SYMBOL_POINTERS", 0x8: "S_SYMBOL_STUBS", 0x9: "S_MOD_INIT_FUNC_POINTERS",
  0x16: "S_INIT_FUNC_OFFSETS",
};
const N_STAB = 0xe0;
const N_TYPE = 0x0e;
const N_EXT = 0x01;
const N_TYPE_NAMES: Record<number, string> = { 0x0: "N_UNDF", 0x2: "N_ABS", 0xa: "N_INDR", 0xc: "N_PBUD", 0xe: "N_SECT" };
const N_SECT = 0xe;
const ARM64_RELOC: Record<number, string> = {
  0: "ARM64_RELOC_UNSIGNED", 1: "ARM64_RELOC_SUBTRACTOR", 2: "ARM64_RELOC_BRANCH26", 3: "ARM64_RELOC_PAGE21",
  4: "ARM64_RELOC_PAGEOFF12", 5: "ARM64_RELOC_GOT_LOAD_PAGE21", 6: "ARM64_RELOC_GOT_LOAD_PAGEOFF12",
  7: "ARM64_RELOC_POINTER_TO_GOT", 8: "ARM64_RELOC_TLVP_LOAD_PAGE21", 9: "ARM64_RELOC_TLVP_LOAD_PAGEOFF12",
  10: "ARM64_RELOC_ADDEND", 11: "ARM64_RELOC_AUTHENTICATED_POINTER",
};

export class MachHeader {
  constructor(
    readonly magic: number,
    readonly cputype: number,
    readonly cpusubtype: number,
    readonly filetype: number,
    readonly ncmds: number,
    readonly sizeofcmds: number,
    readonly flags: number,
    readonly reserved: number,
  ) {}

  get cputype_name(): string {
    return lookup(CPU_TYPE, this.cputype, hex(this.cputype));
  }

  get filetype_name(): string {
    return lookup(MH_FILETYPE, this.filetype, hex(this.filetype));
  }

  get flags_text(): string {
    return MH_FLAGS.filter(([bit]) => hasBit(this.flags, bit))
      .map(([, name]) => name)
      .join(" ");
  }
}

export class LoadCommand {
  constructor(
    readonly index: number,
    readonly cmd: number,
    readonly cmdsize: number,
    readonly offset: number,
  ) {}

  get name(): string {
    return lookup(LC, this.cmd, hex(this.cmd));
  }
}

export class MachSection {
  constructor(
    readonly index: number,
    readonly sectname: string,
    readonly segname: string,
    readonly addr: number,
    readonly size: number,
    readonly offset: number,
    readonly align: number,
    readonly reloff: number,
    readonly nreloc: number,
    readonly flags: number,
  ) {}

  get type_name(): string {
    return lookup(SECTION_TYPE, this.flags & 0xff, hex(this.flags & 0xff));
  }

  get qualified_name(): string {
    return `${this.segname},${this.sectname}`;
  }
}

export class Segment {
  constructor(
    readonly segname: string,
    readonly vmaddr: number,
    readonly vmsize: number,
    readonly fileoff: number,
    readonly filesize: number,
    readonly maxprot: number,
    readonly initprot: number,
    readonly nsects: number,
    readonly flags: number,
    readonly sections: readonly MachSection[],
  ) {}
}

export class SymtabCommand {
  constructor(
    readonly symoff: number,
    readonly nsyms: number,
    readonly stroff: number,
    readonly strsize: number,
  ) {}
}

export class BuildVersion {
  constructor(
    readonly platform: number,
    readonly minos: string,
    readonly sdk: string,
  ) {}

  get platform_name(): string {
    return lookup(PLATFORM, this.platform, String(this.platform));
  }
}

export class Nlist {
  constructor(
    readonly index: number,
    readonly name: string,
    readonly n_strx: number,
    readonly n_type: number,
    readonly n_sect: number,
    readonly n_desc: number,
    readonly n_value: number,
    readonly section_name: string,
  ) {}

  get external(): boolean {
    return Boolean(this.n_type & N_EXT);
  }

  get type_name(): string {
    if (this.n_type & N_STAB) return "N_STAB";
    return lookup(N_TYPE_NAMES, this.n_type & N_TYPE, hex(this.n_type & N_TYPE));
  }
}

export class MachRelocation {
  constructor(
    readonly section: string,
    readonly r_address: number,
    readonly r_symbolnum: number,
    readonly r_pcrel: boolean,
    readonly r_length: number,
    readonly r_extern: boolean,
    readonly r_type: number,
    readonly type_name: string,
    readonly symbol: string,
  ) {}
}

export function versionText(packed: number): string {
  const major = packed >>> 16;
  const minor = (packed >>> 8) & 0xff;
  const patch = packed & 0xff;
  return patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
}

export class MachOFile {
  readonly data: Buffer;
  readonly header: MachHeader;
  readonly load_commands: LoadCommand[];
  readonly segments: Segment[];
  readonly sections: readonly MachSection[];
  readonly symtab_command: SymtabCommand | null;
  readonly build_version: BuildVersion | null;
  readonly symbols: Nlist[];
  readonly relocations: MachRelocation[];

  constructor(data: Buffer) {
    this.data = Buffer.from(data);
    this.header = this.readHeader();
    this.load_commands = this.readLoadCommands();
    this.segments = this.readSegments();
    this.sections = this.segments.flatMap((seg) => seg.sections);
    this.symtab_command = this.readSymtabCommand();
    this.build_version = this.readBuildVersion();
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  static fromPath(filePath: string): MachOFile {
    return new MachOFile(readFileSync(filePath));
  }

  private readHeader(): MachHeader {
    if (this.data.length < MACH_HEADER_64_SIZE) {
      throw new FormatError(`file is ${this.data.length} bytes, shorter than the 32-byte mach_header_64`);
    }
    const magic = this.data.readUInt32LE(0);
    if (magic === FAT_MAGIC || magic === 0xbebafeca) {
      throw new FormatError("universal (fat) Mach-O: extract one slice first");
    }
    if (magic === MH_MAGIC_32) throw new FormatError("32-bit Mach-O: this reader handles MH_MAGIC_64 only");
    if (magic === MH_CIGAM_64) {
      throw new FormatError("big-endian Mach-O: this reader handles little-endian files only");
    }
    if (magic !== MH_MAGIC_64) throw new FormatError(`magic is ${hex(magic)}, expected ${hex(MH_MAGIC_64)}`);
    const f = (i: number): number => this.data.readUInt32LE(i * 4);
    return new MachHeader(f(0), f(1), f(2), f(3), f(4), f(5), f(6), f(7));
  }

  private readLoadCommands(): LoadCommand[] {
    const commands: LoadCommand[] = [];
    let offset = MACH_HEADER_64_SIZE;
    const end = MACH_HEADER_64_SIZE + this.header.sizeofcmds;
    if (end > this.data.length) {
      throw new FormatError(`load commands end at ${hex(end)}, past the ${this.data.length}-byte file`);
    }
    for (let index = 0; index < this.header.ncmds; index++) {
      if (offset + 8 > end) throw new FormatError(`load command ${index} starts past sizeofcmds`);
      const cmd = this.data.readUInt32LE(offset);
      const cmdsize = this.data.readUInt32LE(offset + 4);
      if (cmdsize < 8 || offset + cmdsize > end) {
        throw new FormatError(`load command ${index} has cmdsize ${cmdsize}`);
      }
      commands.push(new LoadCommand(index, cmd, cmdsize, offset));
      offset += cmdsize;
    }
    return commands;
  }

  private readSegments(): Segment[] {
    const data = this.data;
    const segments: Segment[] = [];
    let sectionIndex = 1;
    for (const command of this.load_commands) {
      if (command.cmd !== LC_SEGMENT_64) continue;
      const base = command.offset + 8;
      const segname = fixedName(data.subarray(base, base + 16));
      const vmaddr = u64(data, base + 16);
      const vmsize = u64(data, base + 24);
      const fileoff = u64(data, base + 32);
      const filesize = u64(data, base + 40);
      const maxprot = data.readInt32LE(base + 48);
      const initprot = data.readInt32LE(base + 52);
      const nsects = data.readUInt32LE(base + 56);
      const flags = data.readUInt32LE(base + 60);
      const sections: MachSection[] = [];
      let cursor = command.offset + 72;
      for (let i = 0; i < nsects; i++) {
        sections.push(
          new MachSection(
            sectionIndex,
            fixedName(data.subarray(cursor, cursor + 16)),
            fixedName(data.subarray(cursor + 16, cursor + 32)),
            u64(data, cursor + 32),
            u64(data, cursor + 40),
            data.readUInt32LE(cursor + 48),
            data.readUInt32LE(cursor + 52),
            data.readUInt32LE(cursor + 56),
            data.readUInt32LE(cursor + 60),
            data.readUInt32LE(cursor + 64),
          ),
        );
        sectionIndex += 1;
        cursor += 80;
      }
      segments.push(new Segment(segname, vmaddr, vmsize, fileoff, filesize, maxprot, initprot, nsects, flags, sections));
    }
    return segments;
  }

  private readSymtabCommand(): SymtabCommand | null {
    for (const command of this.load_commands) {
      if (command.cmd === LC_SYMTAB) {
        const f = (i: number): number => this.data.readUInt32LE(command.offset + 8 + i * 4);
        return new SymtabCommand(f(0), f(1), f(2), f(3));
      }
    }
    return null;
  }

  private readBuildVersion(): BuildVersion | null {
    for (const command of this.load_commands) {
      if (command.cmd === LC_BUILD_VERSION) {
        const f = (i: number): number => this.data.readUInt32LE(command.offset + 8 + i * 4);
        return new BuildVersion(f(0), versionText(f(1)), versionText(f(2)));
      }
    }
    return null;
  }

  section_name_for_ordinal(nSect: number): string {
    if (nSect === 0 || nSect > this.sections.length) return "*UND*";
    return this.sections[nSect - 1].qualified_name;
  }

  private readSymbols(): Nlist[] {
    const cmd = this.symtab_command;
    if (cmd === null) return [];
    const strtab = this.data.subarray(cmd.stroff, cmd.stroff + cmd.strsize);
    const symbols: Nlist[] = [];
    for (let index = 0; index < cmd.nsyms; index++) {
      const base = cmd.symoff + index * 16;
      const nStrx = this.data.readUInt32LE(base);
      const nType = this.data[base + 4];
      const nSect = this.data[base + 5];
      const nDesc = this.data.readUInt16LE(base + 6);
      const nValue = u64(this.data, base + 8);
      const name = nStrx ? readCstring(strtab, nStrx) : "";
      symbols.push(new Nlist(index, name, nStrx, nType, nSect, nDesc, nValue, this.section_name_for_ordinal(nSect)));
    }
    return symbols;
  }

  private readRelocations(): MachRelocation[] {
    const out: MachRelocation[] = [];
    for (const section of this.sections) {
      for (let i = 0; i < section.nreloc; i++) {
        const base = section.reloff + i * 8;
        const rAddress = this.data.readInt32LE(base);
        const bits = this.data.readUInt32LE(base + 4);
        const symnum = bits & 0xffffff;
        const pcrel = Boolean((bits >>> 24) & 1);
        const length = (bits >>> 25) & 3;
        const extern = Boolean((bits >>> 27) & 1);
        const rType = (bits >>> 28) & 0xf;
        let symbol: string;
        if (extern) {
          symbol = symnum < this.symbols.length ? this.symbols[symnum].name : hex(symnum);
        } else {
          symbol = symnum > 0 && symnum <= this.sections.length ? this.sections[symnum - 1].sectname : hex(symnum);
        }
        out.push(
          new MachRelocation(
            section.qualified_name,
            rAddress,
            symnum,
            pcrel,
            length,
            extern,
            rType,
            lookup(ARM64_RELOC, rType, `R_${rType}`),
            symbol,
          ),
        );
      }
    }
    return out;
  }

  symbol(name: string): Nlist {
    for (const symbol of this.symbols) {
      if (symbol.name === name) return symbol;
    }
    throw new KeyError(`no symbol named ${strRepr(name)}`);
  }

  function_span(name: string): Span {
    const symbol = this.symbol(name);
    if ((symbol.n_type & N_TYPE) !== N_SECT) {
      throw new KeyError(`${strRepr(name)} is ${symbol.type_name}, not defined in a section`);
    }
    const section = this.sections[symbol.n_sect - 1];
    const later = this.symbols
      .filter((s) => s.n_sect === symbol.n_sect && s.n_value > symbol.n_value)
      .map((s) => s.n_value);
    const end = later.length ? Math.min(...later) : section.addr + section.size;
    const fileOffset = section.offset + (symbol.n_value - section.addr);
    return new Span(fileOffset, end - symbol.n_value, section.qualified_name);
  }

  function_bytes(name: string): Buffer {
    const span = this.function_span(name);
    return this.data.subarray(span.file_offset, span.file_offset + span.size);
  }
}

export function renderElf(elf: ElfFile): string {
  const h = elf.header;
  const lines: string[] = [
    `ELF header: ${h.type_name} ${h.machine_name} osabi=${lookup(OSABI, h.osabi, String(h.osabi))} entry=${hex(h.e_entry)}`,
    `  program headers: ${h.e_phnum} x ${h.e_phentsize} bytes at ${hex(h.e_phoff)}`,
    `  section headers: ${h.e_shnum} x ${h.e_shentsize} bytes at ${hex(h.e_shoff)}, names in section ${h.e_shstrndx}`,
    "",
    "Sections:",
    `${lpad("Idx", 3)} ${rpad("Name", 16)} ${rpad("Type", 12)} ${rpad("Flags", 5)} ${lpad("Offset", 8)} ${lpad("Size", 8)} ${lpad("Addr", 10)} ${lpad("Link", 4)} ${lpad("Info", 4)} ${lpad("Align", 5)}`,
  ];
  for (const s of elf.sections) {
    lines.push(
      `${lpad(s.index, 3)} ${rpad(s.name, 16)} ${rpad(s.type_name, 12)} ${rpad(s.flags_text, 5)} ${lpad(hex(s.sh_offset), 8)} ${lpad(hex(s.sh_size), 8)} ` +
        `${lpad(hex(s.sh_addr), 10)} ${lpad(s.sh_link, 4)} ${lpad(s.sh_info, 4)} ${lpad(s.sh_addralign, 5)}`,
    );
  }
  if (elf.program_headers.length) {
    lines.push("", "Program headers:");
    for (const p of elf.program_headers) {
      lines.push(
        `  ${rpad(p.type_name, 16)} ${p.flags_text} offset=${hex(p.p_offset)} vaddr=${hex(p.p_vaddr)} ` +
          `filesz=${hex(p.p_filesz)} memsz=${hex(p.p_memsz)} align=${hex(p.p_align)}`,
      );
    }
  }
  lines.push(
    "",
    "Symbols:",
    `${lpad("Idx", 3)} ${lpad("Value", 16)} ${lpad("Size", 6)} ${rpad("Bind", 6)} ${rpad("Type", 7)} ${rpad("Section", 16)} Name`,
  );
  for (const sym of elf.symbols) {
    lines.push(
      `${lpad(sym.index, 3)} ${lpad(hex(sym.st_value), 16)} ${lpad(sym.st_size, 6)} ${rpad(sym.bind, 6)} ${rpad(sym.type, 7)} ${rpad(sym.section_name, 16)} ${sym.display_name}`,
    );
  }
  if (elf.relocations.length) {
    lines.push("", "Relocations:");
    for (const r of elf.relocations) {
      lines.push(`  ${rpad(r.table, 14)} ${lpad(hex(r.r_offset), 6)} ${rpad(r.type_name, 22)} ${r.value_text}`);
    }
  }
  lines.push("", "File offset map:");
  for (const region of elf.file_offset_map()) {
    lines.push(`  ${lpad(hex(region.offset), 6)} +${rpad(region.size, 5)} ${rpad(region.kind, 8)} ${region.name}`);
  }
  return lines.join("\n");
}

export function renderMacho(macho: MachOFile): string {
  const h = macho.header;
  const lines: string[] = [
    `mach_header_64: ${h.cputype_name} ${h.filetype_name} ncmds=${h.ncmds} sizeofcmds=${h.sizeofcmds} flags=${h.flags_text}`,
    "",
    "Load commands:",
  ];
  for (const command of macho.load_commands) {
    lines.push(`  ${command.index} ${rpad(command.name, 28)} cmdsize=${command.cmdsize} at ${hex(command.offset)}`);
  }
  for (const segment of macho.segments) {
    lines.push(
      "",
      `LC_SEGMENT_64 ${strRepr(segment.segname)}: vmaddr=${hex(segment.vmaddr)} vmsize=${hex(segment.vmsize)} ` +
        `fileoff=${segment.fileoff} filesize=${segment.filesize} nsects=${segment.nsects}`,
      `  ${lpad("Idx", 3)} ${rpad("Section", 24)} ${lpad("Addr", 6)} ${lpad("Size", 6)} ${lpad("Offset", 6)} ${lpad("Reloff", 6)} ${lpad("Nreloc", 6)} Type`,
    );
    for (const s of segment.sections) {
      lines.push(
        `  ${lpad(s.index, 3)} ${rpad(s.qualified_name, 24)} ${lpad(hex(s.addr), 6)} ${lpad(hex(s.size), 6)} ${lpad(s.offset, 6)} ${lpad(s.reloff, 6)} ${lpad(s.nreloc, 6)} ${s.type_name}`,
      );
    }
  }
  if (macho.build_version) {
    const b = macho.build_version;
    lines.push("", `LC_BUILD_VERSION: platform=${b.platform_name} minos=${b.minos} sdk=${b.sdk}`);
  }
  if (macho.symtab_command) {
    const c = macho.symtab_command;
    lines.push(
      "",
      `LC_SYMTAB: symoff=${c.symoff} nsyms=${c.nsyms} stroff=${c.stroff} strsize=${c.strsize}`,
      `  ${lpad("Idx", 3)} ${lpad("Value", 6)} ${rpad("Ext", 3)} ${rpad("Type", 6)} ${rpad("Section", 24)} Name`,
    );
    for (const sym of macho.symbols) {
      lines.push(
        `  ${lpad(sym.index, 3)} ${lpad(hex(sym.n_value), 6)} ${rpad(sym.external ? "ext" : "loc", 3)} ${rpad(sym.type_name, 6)} ${rpad(sym.section_name, 24)} ${sym.name}`,
      );
    }
  }
  if (macho.relocations.length) {
    lines.push("", "Relocations:");
    for (const r of macho.relocations) {
      lines.push(
        `  ${rpad(r.section, 18)} ${lpad(hex(r.r_address), 6)} ${rpad(r.type_name, 28)} pcrel=${Number(r.r_pcrel)} len=${r.r_length} ${r.symbol}`,
      );
    }
  }
  return lines.join("\n");
}

export function compareFormats(elf: ElfFile, macho: MachOFile, fn: string = "percent_change"): [string, string, string][] {
  const text = elf.section(".text");
  const symtab = elf.sections.find((s) => s.sh_type === SHT_SYMTAB) as Section;
  const strtab = elf.sections[symtab.sh_link];
  const relaText = elf.relocations_for(".text");
  const mtext = macho.sections.find((s) => s.sectname === "__text") as MachSection;
  const mcmd = macho.symtab_command as SymtabCommand;
  const espan = elf.function_span(fn);
  const mspan = macho.function_span("_" + fn);
  const segment = macho.segments[0];
  const elfTypes = listRepr(sortedUnique(relaText.map((r) => r.type_name)));
  const machoTypes = listRepr(
    sortedUnique(macho.relocations.filter((r) => r.section === mtext.qualified_name).map((r) => r.type_name)),
  );
  return [
    ["file identity", `e_ident ${bytesRepr(ELF_MAGIC)} class 64 data LSB`, `magic ${hex(macho.header.magic)} (MH_MAGIC_64)`],
    [
      "machine",
      `e_machine ${elf.header.e_machine} (${elf.header.machine_name})`,
      `cputype ${hex(macho.header.cputype)} (${macho.header.cputype_name})`,
    ],
    [
      "file kind",
      `e_type ${elf.header.e_type} (${elf.header.type_name})`,
      `filetype ${macho.header.filetype} (${macho.header.filetype_name})`,
    ],
    [
      "where the tables are",
      `e_shoff ${hex(elf.header.e_shoff)}, ${elf.header.e_shnum} section headers`,
      `${macho.header.ncmds} load commands, ${macho.header.sizeofcmds} bytes after the header`,
    ],
    [
      "the code",
      `section .text: offset ${hex(text.sh_offset)}, size ${hex(text.sh_size)}, flags ${text.flags_text}`,
      `section ${mtext.qualified_name}: offset ${mtext.offset}, size ${hex(mtext.size)}, in segment ${strRepr(segment.segname)}`,
    ],
    [
      "symbol names",
      `.symtab (section ${symtab.index}) with names in ${strtab.name} (sh_link ${symtab.sh_link})`,
      `LC_SYMTAB symoff ${mcmd.symoff} nsyms ${mcmd.nsyms}, names at stroff ${mcmd.stroff}`,
    ],
    [
      "symbol size",
      `st_size: ${fn} = ${espan.size} bytes`,
      `no size field in nlist_64: next symbol minus this one = ${mspan.size} bytes`,
    ],
    [
      "relocations",
      `.rela.text: ${relaText.length} Elf64_Rela, types ${elfTypes}`,
      `__text reloff ${mtext.reloff} nreloc ${mtext.nreloc}, types ${machoTypes}`,
    ],
    [
      "function bytes",
      `${fn}: ${espan.size} bytes at file offset ${hex(espan.file_offset)}`,
      `_${fn}: ${mspan.size} bytes at file offset ${hex(mspan.file_offset)}`,
    ],
  ];
}

export function renderComparison(rows: [string, string, string][]): string {
  const width = Math.max(...rows.map((row) => row[0].length));
  const lines: string[] = [];
  for (const [concept, elfText, machoText] of rows) {
    lines.push(`${rpad(concept, width)}  ELF    ${elfText}`);
    lines.push(`${rpad("", width)}  Mach-O ${machoText}`);
  }
  return lines.join("\n");
}

export function openFile(filePath: string): ElfFile | MachOFile {
  const data = readFileSync(filePath);
  if (data.subarray(0, 4).equals(ELF_MAGIC)) return new ElfFile(data);
  if (data.length >= 4 && [MH_MAGIC_64, MH_CIGAM_64, MH_MAGIC_32, FAT_MAGIC].includes(data.readUInt32LE(0))) {
    return new MachOFile(data);
  }
  throw new FormatError(`${filePath}: not an ELF or Mach-O file (first bytes ${bytesHex(data.subarray(0, 4))})`);
}

export function demo(): string {
  const elf = ElfFile.fromPath(path.join(FIXTURES, "ledger-x86_64-O1.o"));
  const macho = MachOFile.fromPath(path.join(FIXTURES, "ledger-arm64-O1.o"));
  const tiny = ElfFile.fromPath(path.join(FIXTURES, "tiny-x86_64"));
  const out: string[] = ["== ledger-x86_64-O1.o ==", renderElf(elf), ""];
  for (const name of ["percent_change", "grade", "total", "grade_label"]) {
    const span = elf.function_span(name);
    out.push(`${name}: ${span.size} bytes at file offset ${hex(span.file_offset)}: ${bytesHex(elf.function_bytes(name), " ")}`);
  }
  out.push("", "== ledger-arm64-O1.o ==", renderMacho(macho), "");
  out.push("== the same ideas in two formats ==", renderComparison(compareFormats(elf, macho)), "");
  out.push("== tiny-x86_64 (an executable with program headers) ==", renderElf(tiny), "");
  const entry = tiny.header.e_entry;
  out.push(`entry ${hex(entry)} is file offset ${hex(tiny.address_to_file_offset(entry))} through PT_LOAD`);
  return out.join("\n");
}

export function main(argv: string[]): number {
  if (argv.length === 0) {
    console.log(demo());
    return 0;
  }
  for (const arg of argv) {
    const parsed = openFile(arg);
    console.log(`== ${arg} ==`);
    console.log(parsed instanceof ElfFile ? renderElf(parsed) : renderMacho(parsed));
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
