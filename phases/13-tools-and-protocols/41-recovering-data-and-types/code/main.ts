// Lesson: Recovering Data and Types: Structs, Arrays, C++ Objects, and DWARF (phase 13 / lesson 41)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/41-recovering-data-and-types/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/41-recovering-data-and-types/code/main.ts

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json } | Map<string, Json>;

export const HERE = __dirname;
export const FIXTURES = join(HERE, "fixtures");

export const SHT_SYMTAB = 2;
export const SHT_RELA = 4;
export const SHT_NOBITS = 8;
export const STT_OBJECT = 1;
export const STT_FUNC = 2;
export const STT_SECTION = 3;
export const EM_X86_64 = 62;
export const R_X86_64_64 = 1;
export const R_X86_64_PC32 = 2;
export const R_X86_64_PLT32 = 4;
export const R_X86_64_32 = 10;
export const R_X86_64_32S = 11;

const DECODER = new TextDecoder("utf-8", { ignoreBOM: true });

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function u16(data: Uint8Array, pos: number): number {
  return view(data).getUint16(pos, true);
}

function u32(data: Uint8Array, pos: number): number {
  return view(data).getUint32(pos, true);
}

function u64(data: Uint8Array, pos: number): number {
  return Number(view(data).getBigUint64(pos, true));
}

function i64(data: Uint8Array, pos: number): number {
  return Number(view(data).getBigInt64(pos, true));
}

export function hx(value: number): string {
  return value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
}

function pymod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

function gcdAll(values: number[]): number {
  return values.reduce((acc, v) => gcd(acc, v), 0);
}

function wsJoin(text: string): string {
  return text.split(/\s+/).filter((part) => part.length > 0).join(" ");
}

export function splitlines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function parseIntBase0(text: string): number {
  const match = /^\s*([+-]?)(0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|[1-9][0-9]*|0+)\s*$/.exec(text);
  if (match === null) {
    throw new Error(`invalid literal for int() with base 0: '${text}'`);
  }
  const body = /^0+$/.test(match[2]) ? 0n : BigInt(match[2]);
  return Number(match[1] === "-" ? -body : body);
}

function parseHex(text: string): number {
  const match = /^\s*([+-]?)(?:0[xX])?([0-9a-fA-F]+)\s*$/.exec(text);
  if (match === null) {
    throw new Error(`invalid literal for int() with base 16: '${text}'`);
  }
  const body = BigInt("0x" + match[2]);
  return Number(match[1] === "-" ? -body : body);
}

function sortedNumbers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function hexBytes(data: Uint8Array): string {
  return [...data].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readText(path: string): string {
  return DECODER.decode(readFileSync(path));
}

export class ElfError extends Error {}

export interface Section {
  index: number;
  name: string;
  type: number;
  offset: number;
  size: number;
  link: number;
  info: number;
  data: Uint8Array;
}

export class Symbol_ {
  constructor(
    readonly name: string,
    readonly value: number,
    readonly size: number,
    readonly type: number,
    readonly bind: number,
    readonly shndx: number,
    readonly section: string,
  ) {}
}

export class Relocation {
  constructor(
    readonly section: string,
    readonly offset: number,
    readonly type: number,
    readonly symbol: Symbol_,
    readonly addend: number,
  ) {}

  get symbolName(): string {
    return this.symbol.type === STT_SECTION ? this.symbol.section : this.symbol.name;
  }
}

export class ElfObject {
  sections: Section[];
  symbols: Symbol_[];
  relocations: Map<string, Relocation[]>;

  constructor(data: Uint8Array) {
    if (!(data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46)) {
      throw new ElfError("not an ELF file");
    }
    if (data[4] !== 2 || data[5] !== 1) {
      throw new ElfError("only ELF64 little-endian objects are supported");
    }
    const machine = u16(data, 18);
    if (machine !== EM_X86_64) {
      throw new ElfError(`e_machine ${machine} is not x86-64`);
    }
    const shoff = u64(data, 40);
    const shentsize = u16(data, 58);
    const shnum = u16(data, 60);
    const shstrndx = u16(data, 62);
    const raw: number[][] = [];
    for (let i = 0; i < shnum; i++) {
      const base = shoff + i * shentsize;
      raw.push([
        u32(data, base),
        u32(data, base + 4),
        u64(data, base + 8),
        u64(data, base + 16),
        u64(data, base + 24),
        u64(data, base + 32),
        u32(data, base + 40),
        u32(data, base + 44),
        u64(data, base + 48),
        u64(data, base + 56),
      ]);
    }
    const names = raw[shstrndx];
    const nameTable = data.subarray(names[4], names[4] + names[5]);
    this.sections = [];
    raw.forEach((entry, index) => {
      const [shName, shType, , , shOffset, shSize, shLink, shInfo] = entry;
      const payload = shType === SHT_NOBITS ? new Uint8Array(0) : data.subarray(shOffset, shOffset + shSize);
      this.sections.push({ index, name: cstring(nameTable, shName), type: shType, offset: shOffset, size: shSize, link: shLink, info: shInfo, data: payload });
    });
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  private readSymbols(): Symbol_[] {
    const symbols: Symbol_[] = [];
    for (const section of this.sections) {
      if (section.type !== SHT_SYMTAB) {
        continue;
      }
      const strings = this.sections[section.link].data;
      for (let offset = 0; offset < section.size; offset += 24) {
        const d = section.data;
        const stName = u32(d, offset);
        const stInfo = d[offset + 4];
        const stShndx = u16(d, offset + 6);
        const stValue = u64(d, offset + 8);
        const stSize = u64(d, offset + 16);
        const sectionName = stShndx < this.sections.length ? this.sections[stShndx].name : "";
        symbols.push(new Symbol_(cstring(strings, stName), stValue, stSize, stInfo & 0xf, stInfo >> 4, stShndx, sectionName));
      }
    }
    return symbols;
  }

  private readRelocations(): Map<string, Relocation[]> {
    const table: Map<string, Relocation[]> = new Map();
    for (const section of this.sections) {
      if (section.type !== SHT_RELA) {
        continue;
      }
      const target = this.sections[section.info].name;
      for (let offset = 0; offset < section.size; offset += 24) {
        const dv = view(section.data);
        const rOffset = Number(dv.getBigUint64(offset, true));
        const rInfo = dv.getBigUint64(offset + 8, true);
        const rAddend = Number(dv.getBigInt64(offset + 16, true));
        const symbol = this.symbols[Number(rInfo >> 32n)];
        if (!table.has(target)) {
          table.set(target, []);
        }
        (table.get(target) as Relocation[]).push(new Relocation(target, rOffset, Number(rInfo & 0xffffffffn), symbol, rAddend));
      }
    }
    return table;
  }

  hasSection(name: string): boolean {
    return this.sections.some((s) => s.name === name);
  }

  section(name: string): Section {
    for (const section of this.sections) {
      if (section.name === name) {
        return section;
      }
    }
    throw new ElfError(`no section named ${name}`);
  }

  symbol(name: string): Symbol_ {
    for (const symbol of this.symbols) {
      if (symbol.name === name) {
        return symbol;
      }
    }
    throw new ElfError(`no symbol named ${name}`);
  }

  symbolNames(): string[] {
    return [...new Set(this.symbols.filter((s) => s.name && s.type !== STT_SECTION).map((s) => s.name))].sort();
  }

  functions(section = ".text"): Symbol_[] {
    return this.symbols.filter((s) => s.type === STT_FUNC && s.section === section).sort((a, b) => a.value - b.value);
  }

  relocated(name: string): Uint8Array {
    const data = this.section(name).data.slice();
    const dv = view(data);
    for (const relocation of this.relocations.get(name) ?? []) {
      const base = relocation.symbol.type === STT_SECTION ? 0 : relocation.symbol.value;
      const value = BigInt(base + relocation.addend);
      if (relocation.type === R_X86_64_32 || relocation.type === R_X86_64_32S) {
        dv.setUint32(relocation.offset, Number(BigInt.asUintN(32, value)), true);
      } else if (relocation.type === R_X86_64_64) {
        dv.setBigUint64(relocation.offset, BigInt.asUintN(64, value), true);
      }
    }
    return data;
  }
}

export function cstring(table: Uint8Array, offset: number): string {
  const end = table.indexOf(0, offset);
  return DECODER.decode(table.subarray(offset, end >= 0 ? end : table.length));
}

export function loadObject(name: string): ElfObject {
  return new ElfObject(new Uint8Array(readFileSync(join(FIXTURES, name))));
}

export const DW_TAG: Map<number, string> = new Map([
  [0x01, "array_type"], [0x02, "class_type"], [0x04, "enumeration_type"], [0x05, "formal_parameter"], [0x0b, "lexical_block"],
  [0x0d, "member"], [0x0f, "pointer_type"], [0x10, "reference_type"], [0x11, "compile_unit"], [0x13, "structure_type"],
  [0x15, "subroutine_type"], [0x16, "typedef"], [0x17, "union_type"], [0x18, "unspecified_parameters"], [0x1c, "inheritance"],
  [0x21, "subrange_type"], [0x24, "base_type"], [0x26, "const_type"], [0x2e, "subprogram"], [0x34, "variable"],
  [0x35, "volatile_type"], [0x42, "rvalue_reference_type"],
]);
export const DW_AT: Map<number, string> = new Map([
  [0x01, "sibling"], [0x02, "location"], [0x03, "name"], [0x0b, "byte_size"], [0x10, "stmt_list"], [0x11, "low_pc"], [0x12, "high_pc"],
  [0x13, "language"], [0x1b, "comp_dir"], [0x1c, "const_value"], [0x1d, "containing_type"], [0x25, "producer"], [0x27, "prototyped"],
  [0x2f, "upper_bound"], [0x32, "accessibility"], [0x34, "artificial"], [0x36, "calling_convention"], [0x37, "count"],
  [0x38, "data_member_location"], [0x3a, "decl_file"], [0x3b, "decl_line"], [0x3c, "declaration"], [0x3e, "encoding"],
  [0x3f, "external"], [0x40, "frame_base"], [0x47, "specification"], [0x49, "type"], [0x4c, "virtuality"], [0x4d, "vtable_elem_location"],
  [0x63, "explicit"], [0x64, "object_pointer"], [0x6e, "linkage_name"], [0x72, "str_offsets_base"], [0x73, "addr_base"],
  [0x87, "noreturn"], [0x88, "alignment"], [0x8a, "deleted"], [0x8b, "defaulted"], [0x89, "export_symbols"],
]);
export const DW_FORM_NAMES: Map<number, string> = new Map([
  [0x01, "addr"], [0x03, "block2"], [0x04, "block4"], [0x05, "data2"], [0x06, "data4"], [0x07, "data8"], [0x08, "string"], [0x09, "block"],
  [0x0a, "block1"], [0x0b, "data1"], [0x0c, "flag"], [0x0d, "sdata"], [0x0e, "strp"], [0x0f, "udata"], [0x10, "ref_addr"], [0x11, "ref1"],
  [0x12, "ref2"], [0x13, "ref4"], [0x14, "ref8"], [0x15, "ref_udata"], [0x17, "sec_offset"], [0x18, "exprloc"], [0x19, "flag_present"],
  [0x1a, "strx"], [0x1b, "addrx"], [0x1e, "data16"], [0x1f, "line_strp"], [0x20, "ref_sig8"], [0x21, "implicit_const"], [0x22, "loclistx"],
  [0x23, "rnglistx"], [0x25, "strx1"], [0x26, "strx2"], [0x27, "strx3"], [0x28, "strx4"], [0x29, "addrx1"], [0x2a, "addrx2"], [0x2b, "addrx3"],
  [0x2c, "addrx4"],
]);
export const DW_ATE: Map<number, string> = new Map([
  [0x01, "address"], [0x02, "boolean"], [0x04, "float"], [0x05, "signed"], [0x06, "signed_char"], [0x07, "unsigned"], [0x08, "unsigned_char"], [0x10, "UTF"],
]);
export const DW_UT: Map<number, string> = new Map([
  [0x01, "compile"], [0x02, "type"], [0x03, "partial"], [0x04, "skeleton"], [0x05, "split_compile"], [0x06, "split_type"],
]);
export const DW_OP_CONSTU = 0x10;
export const DW_OP_FBREG = 0x91;
export const DW_OP_ADDRX = 0xa1;
export const DW_OP_REG0 = 0x50;
export const DW_OP_REG_NAMES = ["RAX", "RDX", "RCX", "RBX", "RSI", "RDI", "RBP", "RSP", ...Array.from({ length: 8 }, (_v, i) => `R${i + 8}`)];
export const DW_VIRTUALITY: Map<number, string> = new Map([[1, "virtual"], [2, "pure_virtual"]]);

export class DwarfError extends Error {}

export function readUleb(data: Uint8Array, start: number): [number, number] {
  let pos = start;
  let result = 0;
  let shift = 0;
  for (;;) {
    const byte = data[pos];
    pos += 1;
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
    if (!(byte & 0x80)) {
      return [result, pos];
    }
  }
}

export function readSleb(data: Uint8Array, start: number): [number, number] {
  let pos = start;
  let result = 0;
  let shift = 0;
  for (;;) {
    const byte = data[pos];
    pos += 1;
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
    if (!(byte & 0x80)) {
      if (byte & 0x40) {
        result -= 2 ** shift;
      }
      return [result, pos];
    }
  }
}

export class Abbreviation {
  constructor(
    readonly code: number,
    readonly tag: number,
    readonly hasChildren: boolean,
    readonly attributes: [number, number, number | null][],
  ) {}
}

export function parseAbbreviations(data: Uint8Array, offset = 0): Map<number, Abbreviation> {
  const table: Map<number, Abbreviation> = new Map();
  let pos = offset;
  while (pos < data.length) {
    let code: number;
    [code, pos] = readUleb(data, pos);
    if (code === 0) {
      break;
    }
    let tag: number;
    [tag, pos] = readUleb(data, pos);
    const hasChildren = data[pos] === 1;
    pos += 1;
    const attributes: [number, number, number | null][] = [];
    for (;;) {
      let attribute: number;
      let form: number;
      [attribute, pos] = readUleb(data, pos);
      [form, pos] = readUleb(data, pos);
      let implicit: number | null = null;
      if (form === 0x21) {
        [implicit, pos] = readSleb(data, pos);
      }
      if (attribute === 0 && form === 0) {
        break;
      }
      attributes.push([attribute, form, implicit]);
    }
    table.set(code, new Abbreviation(code, tag, hasChildren, attributes));
  }
  return table;
}

export type AttrValue = number | string | boolean | Uint8Array | null;

const DW_AT_BY_NAME: Map<string, number> = new Map([...DW_AT.entries()].map(([k, v]) => [v, k]));

function truthy(value: AttrValue | undefined): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === "") {
    return false;
  }
  if (value instanceof Uint8Array) {
    return value.length > 0;
  }
  return true;
}


export class Die {
  children: Die[] = [];

  constructor(
    readonly offset: number,
    readonly tag: number,
    readonly attributes: Map<number, AttrValue>,
    readonly forms: Map<number, number>,
    public parent: Die | null = null,
  ) {}

  get tagName(): string {
    return DW_TAG.get(this.tag) ?? `tag_${hx(this.tag)}`;
  }

  get(name: string, fallback: AttrValue = null): AttrValue {
    const number = DW_AT_BY_NAME.get(name);
    if (number === undefined || !this.attributes.has(number)) {
      return fallback;
    }
    return this.attributes.get(number) as AttrValue;
  }

  get name(): string | null {
    return this.get("name") as string | null;
  }
}

export class UnitHeader {
  constructor(
    readonly offset: number,
    readonly length: number,
    readonly version: number,
    readonly unitType: number,
    readonly addressSize: number,
    readonly abbrevOffset: number,
  ) {}

  toDict(): Json {
    return {
      unitLength: this.length,
      version: this.version,
      unitType: "DW_UT_" + (DW_UT.get(this.unitType) ?? hx(this.unitType)),
      addressSize: this.addressSize,
      abbrevOffset: this.abbrevOffset,
    };
  }
}

export class Member {
  constructor(
    readonly name: string,
    readonly offset: number,
    readonly type: string,
    readonly size: number,
    readonly kind: string,
    readonly sign: string | null,
  ) {}

  toDict(): Json {
    return { name: this.name, offset: this.offset, type: this.type, size: this.size, kind: this.kind, sign: this.sign };
  }
}

export class VirtualMethod {
  constructor(
    readonly name: string,
    readonly linkageName: string | null,
    readonly slot: number,
    readonly virtuality: string,
  ) {}
}

export function naturalAlignment(size: number): number {
  return [1, 2, 4, 8, 16].includes(size) ? size : 8;
}

export class StructLayout {
  constructor(
    readonly name: string,
    readonly size: number,
    readonly members: Member[],
    readonly bases: [string, number][] = [],
    readonly virtualMethods: VirtualMethod[] = [],
    readonly declLine: AttrValue = null,
  ) {}

  get align(): number {
    const values = [...this.members.map((m) => naturalAlignment(m.size)), ...this.bases.map(() => 8)];
    return values.length ? Math.max(...values) : 1;
  }

  padding(): number[] {
    const covered = new Set<number>();
    for (const m of this.members) {
      for (let b = m.offset; b < m.offset + m.size; b++) {
        covered.add(b);
      }
    }
    const result: number[] = [];
    for (let b = 0; b < this.size; b++) {
      if (!covered.has(b)) {
        result.push(b);
      }
    }
    return result;
  }

  toDict(): Json {
    return {
      name: this.name,
      size: this.size,
      align: this.align,
      members: this.members.map((m) => m.toDict()),
      padding: this.padding(),
      bases: this.bases.map(([t, o]) => ({ type: t, offset: o })),
      virtualMethods: this.virtualMethods.map((v) => ({ name: v.name, linkageName: v.linkageName, slot: v.slot, virtuality: v.virtuality })),
    };
  }
}

export class Parameter {
  constructor(
    readonly name: string,
    readonly type: string,
    readonly location: string,
  ) {}
}

export class FunctionInfo {
  constructor(
    readonly name: string,
    readonly lowPc: number,
    readonly highPc: number,
    readonly frameBase: string,
    readonly parameters: Parameter[],
    readonly returnType: string,
  ) {}

  toDict(): Json {
    return {
      name: this.name,
      range: `${hx(this.lowPc)}-${hx(this.highPc)}`,
      frameBase: this.frameBase,
      returnType: this.returnType,
      parameters: this.parameters.map((p) => ({ name: p.name, type: p.type, location: p.location })),
    };
  }
}

export class DwarfInfo {
  readonly info: Uint8Array;
  readonly abbrev: Uint8Array;
  readonly strings: Uint8Array;
  readonly lineStrings: Uint8Array;
  readonly strOffsets: Uint8Array;
  readonly addrs: Uint8Array;
  readonly units: [UnitHeader, Die][] = [];
  readonly dies: Map<number, Die> = new Map();

  constructor(readonly elf: ElfObject) {
    if (!elf.hasSection(".debug_info")) {
      throw new DwarfError("the object has no .debug_info section");
    }
    this.info = elf.relocated(".debug_info");
    this.abbrev = elf.relocated(".debug_abbrev");
    this.strings = elf.section(".debug_str").data;
    this.lineStrings = elf.hasSection(".debug_line_str") ? elf.section(".debug_line_str").data : new Uint8Array(0);
    this.strOffsets = elf.hasSection(".debug_str_offsets") ? elf.relocated(".debug_str_offsets") : new Uint8Array(0);
    this.addrs = elf.hasSection(".debug_addr") ? elf.relocated(".debug_addr") : new Uint8Array(0);
    let pos = 0;
    while (pos < this.info.length) {
      const [header, root, next] = this.parseUnit(pos);
      this.units.push([header, root]);
      pos = next;
    }
  }

  private parseUnit(start: number): [UnitHeader, Die, number] {
    const length = u32(this.info, start);
    if (length === 0xffffffff) {
      throw new DwarfError("64-bit DWARF is not supported by this reader");
    }
    const version = u16(this.info, start + 4);
    const unitType = this.info[start + 6];
    const addressSize = this.info[start + 7];
    const abbrevOffset = u32(this.info, start + 8);
    if (version !== 5) {
      throw new DwarfError(`DWARF version ${version} is not 5`);
    }
    const header = new UnitHeader(start, length, version, unitType, addressSize, abbrevOffset);
    const abbreviations = parseAbbreviations(this.abbrev, abbrevOffset);
    const end = start + 4 + length;
    let pos = start + 12;
    let root: Die | null = null;
    const stack: Die[] = [];
    const raw: Die[] = [];
    while (pos < end) {
      const dieOffset = pos;
      let code: number;
      [code, pos] = readUleb(this.info, pos);
      if (code === 0) {
        if (stack.length) {
          stack.pop();
        }
        continue;
      }
      const abbreviation = abbreviations.get(code);
      if (abbreviation === undefined) {
        throw new DwarfError(`unknown abbreviation code ${code}`);
      }
      const attributes: Map<number, AttrValue> = new Map();
      const forms: Map<number, number> = new Map();
      for (const [attribute, form, implicit] of abbreviation.attributes) {
        let value: AttrValue;
        [value, pos] = this.readForm(form, pos, addressSize, start, implicit);
        attributes.set(attribute, value);
        forms.set(attribute, form);
      }
      const die = new Die(dieOffset, abbreviation.tag, attributes, forms, stack.length ? stack[stack.length - 1] : null);
      if (stack.length) {
        stack[stack.length - 1].children.push(die);
      }
      raw.push(die);
      this.dies.set(dieOffset, die);
      if (root === null) {
        root = die;
      }
      if (abbreviation.hasChildren) {
        stack.push(die);
      }
    }
    if (root === null) {
      throw new DwarfError("empty compilation unit");
    }
    const strBase = root.attributes.has(0x72) ? (root.attributes.get(0x72) as number) : 8;
    const addrBase = root.attributes.has(0x73) ? (root.attributes.get(0x73) as number) : 8;
    for (const die of raw) {
      for (const [attribute, form] of die.forms) {
        if ([0x1a, 0x25, 0x26, 0x27, 0x28].includes(form)) {
          const index = die.attributes.get(attribute) as number;
          const offset = u32(this.strOffsets, strBase + 4 * index);
          die.attributes.set(attribute, cstring(this.strings, offset));
        } else if ([0x1b, 0x29, 0x2a, 0x2b, 0x2c].includes(form)) {
          const index = die.attributes.get(attribute) as number;
          die.attributes.set(attribute, u64(this.addrs, addrBase + 8 * index));
        }
      }
    }
    return [header, root, end];
  }

  private readForm(form: number, pos: number, addressSize: number, unitStart: number, implicit: number | null): [AttrValue, number] {
    const data = this.info;
    if (form === 0x01) {
      return [addressSize === 8 ? u64(data, pos) : u32(data, pos), pos + addressSize];
    }
    if ([0x0b, 0x11, 0x0c, 0x25, 0x29].includes(form)) {
      return [data[pos], pos + 1];
    }
    if ([0x05, 0x12, 0x26, 0x2a].includes(form)) {
      return [u16(data, pos), pos + 2];
    }
    if ([0x27, 0x2b].includes(form)) {
      return [data[pos] + data[pos + 1] * 256 + data[pos + 2] * 65536, pos + 3];
    }
    if ([0x06, 0x0e, 0x1f, 0x17, 0x28, 0x2c].includes(form)) {
      return [u32(data, pos), pos + 4];
    }
    if (form === 0x13) {
      return [unitStart + u32(data, pos), pos + 4];
    }
    if ([0x07, 0x14, 0x20].includes(form)) {
      return [u64(data, pos), pos + 8];
    }
    if (form === 0x1e) {
      return [data.slice(pos, pos + 16), pos + 16];
    }
    if (form === 0x08) {
      const end = data.indexOf(0, pos);
      if (end < 0) {
        throw new DwarfError("subsection not found");
      }
      return [DECODER.decode(data.subarray(pos, end)), end + 1];
    }
    if ([0x0f, 0x1a, 0x1b, 0x22, 0x23].includes(form)) {
      return readUleb(data, pos);
    }
    if (form === 0x15) {
      const [value, next] = readUleb(data, pos);
      return [unitStart + value, next];
    }
    if (form === 0x0d) {
      return readSleb(data, pos);
    }
    if (form === 0x18 || form === 0x09) {
      const [length, next] = readUleb(data, pos);
      return [data.slice(next, next + length), next + length];
    }
    if (form === 0x0a) {
      const length = data[pos];
      return [data.slice(pos + 1, pos + 1 + length), pos + 1 + length];
    }
    if (form === 0x03) {
      const length = u16(data, pos);
      return [data.slice(pos + 2, pos + 2 + length), pos + 2 + length];
    }
    if (form === 0x04) {
      const length = u32(data, pos);
      return [data.slice(pos + 4, pos + 4 + length), pos + 4 + length];
    }
    if (form === 0x19) {
      return [true, pos];
    }
    if (form === 0x21) {
      return [implicit, pos];
    }
    if (form === 0x10) {
      return [u32(data, pos), pos + 4];
    }
    throw new DwarfError(`form ${DW_FORM_NAMES.get(form) ?? hx(form)} is not supported by this reader`);
  }

  root(): Die {
    return this.units[0][1];
  }

  header(): UnitHeader {
    return this.units[0][0];
  }

  *walk(die: Die | null = null): Generator<Die> {
    const start = die ?? this.root();
    yield start;
    for (const child of start.children) {
      yield* this.walk(child);
    }
  }

  find(tagName: string, name: string | null = null): Die[] {
    return [...this.walk()].filter((d) => d.tagName === tagName && (name === null || d.name === name));
  }

  typeOf(die: Die): Die | null {
    const reference = die.get("type");
    return typeof reference === "number" ? this.dies.get(reference) ?? null : null;
  }

  typeName(die: Die | null): string {
    if (die === null) {
      return "void";
    }
    const tag = die.tagName;
    if (["base_type", "structure_type", "class_type", "union_type", "enumeration_type", "typedef"].includes(tag)) {
      return die.name || `anonymous ${tag}`;
    }
    if (tag === "pointer_type") {
      const inner = this.typeOf(die);
      if (inner !== null && inner.tagName === "subroutine_type") {
        return this.subroutineName(inner, "*");
      }
      if (inner !== null && inner.tagName === "pointer_type") {
        const target = this.typeOf(inner);
        if (target !== null && target.tagName === "subroutine_type") {
          return this.subroutineName(target, "**");
        }
      }
      return this.typeName(inner) + " *";
    }
    if (tag === "reference_type") {
      return this.typeName(this.typeOf(die)) + " &";
    }
    if (tag === "rvalue_reference_type") {
      return this.typeName(this.typeOf(die)) + " &&";
    }
    if (tag === "const_type") {
      return "const " + this.typeName(this.typeOf(die));
    }
    if (tag === "volatile_type") {
      return "volatile " + this.typeName(this.typeOf(die));
    }
    if (tag === "array_type") {
      const counts = die.children.filter((c) => c.tagName === "subrange_type").map((c) => c.get("count"));
      const suffix = counts.map((c) => (c !== null ? `[${c}]` : "[]")).join("");
      return this.typeName(this.typeOf(die)) + suffix;
    }
    if (tag === "subroutine_type") {
      return this.subroutineName(die, "");
    }
    return tag;
  }

  private subroutineName(die: Die, stars: string): string {
    const params = die.children.filter((c) => c.tagName === "formal_parameter").map((c) => this.typeName(this.typeOf(c)));
    const inner = stars ? `(${stars})` : "";
    return `${this.typeName(this.typeOf(die))} ${inner}(${params.join(", ")})`;
  }

  typeSize(die: Die | null): number {
    if (die === null) {
      return 0;
    }
    const tag = die.tagName;
    if (die.get("byte_size") !== null && tag !== "pointer_type") {
      return Number(die.get("byte_size"));
    }
    if (["pointer_type", "reference_type", "rvalue_reference_type"].includes(tag)) {
      return this.header().addressSize;
    }
    if (["const_type", "volatile_type", "typedef"].includes(tag)) {
      return this.typeSize(this.typeOf(die));
    }
    if (tag === "array_type") {
      let count = 1;
      for (const child of die.children) {
        if (child.tagName === "subrange_type") {
          const explicit = child.get("count");
          if (truthy(explicit)) {
            count *= Number(explicit);
          } else {
            const upper = child.get("upper_bound");
            count *= upper !== null ? Number(upper) + 1 : 0;
          }
        }
      }
      return count * this.typeSize(this.typeOf(die));
    }
    return 0;
  }

  typeKind(die: Die | null): [string, string | null] {
    if (die === null) {
      return ["void", null];
    }
    const tag = die.tagName;
    if (["const_type", "volatile_type", "typedef"].includes(tag)) {
      return this.typeKind(this.typeOf(die));
    }
    if (["pointer_type", "reference_type", "rvalue_reference_type"].includes(tag)) {
      return ["pointer", null];
    }
    if (tag === "base_type") {
      const raw = die.get("encoding");
      const encoding = DW_ATE.get(truthy(raw) ? Number(raw) : 0) ?? "unknown";
      if (encoding === "float") {
        return ["float", null];
      }
      if (encoding === "signed" || encoding === "signed_char") {
        return ["int", "signed"];
      }
      if (["unsigned", "unsigned_char", "boolean", "UTF"].includes(encoding)) {
        return ["int", "unsigned"];
      }
      return ["int", null];
    }
    if (["structure_type", "class_type", "union_type"].includes(tag)) {
      return ["struct", null];
    }
    if (tag === "array_type") {
      return ["array", null];
    }
    if (tag === "enumeration_type") {
      return ["int", null];
    }
    return [tag, null];
  }

  structLayouts(): StructLayout[] {
    const layouts: StructLayout[] = [];
    for (const die of this.walk()) {
      if (!(die.tagName === "structure_type" || die.tagName === "class_type") || truthy(die.get("declaration"))) {
        continue;
      }
      const members: Member[] = [];
      const bases: [string, number][] = [];
      const methods: VirtualMethod[] = [];
      for (const child of die.children) {
        if (child.tagName === "member") {
          const [kind, sign] = this.typeKind(this.typeOf(child));
          const location = child.get("data_member_location");
          members.push(new Member(child.name || "", truthy(location) ? Number(location) : 0, this.typeName(this.typeOf(child)), this.typeSize(this.typeOf(child)), kind, sign));
        } else if (child.tagName === "inheritance") {
          const location = child.get("data_member_location");
          bases.push([this.typeName(this.typeOf(child)), truthy(location) ? Number(location) : 0]);
        } else if (child.tagName === "subprogram" && child.get("vtable_elem_location") !== null) {
          const virtuality = child.get("virtuality");
          methods.push(
            new VirtualMethod(
              child.name || "",
              child.get("linkage_name") as string | null,
              decodeConstu(child.get("vtable_elem_location") as Uint8Array),
              DW_VIRTUALITY.get(truthy(virtuality) ? Number(virtuality) : 0) ?? "none",
            ),
          );
        }
      }
      const byteSize = die.get("byte_size");
      layouts.push(new StructLayout(die.name || "", truthy(byteSize) ? Number(byteSize) : 0, members, bases, methods, die.get("decl_line")));
    }
    return layouts;
  }

  struct(name: string): StructLayout {
    for (const layout of this.structLayouts()) {
      if (layout.name === name) {
        return layout;
      }
    }
    throw new DwarfError(`no structure type named ${name}`);
  }

  functions(): FunctionInfo[] {
    const found: FunctionInfo[] = [];
    for (const die of this.find("subprogram")) {
      const low = die.get("low_pc");
      if (low === null) {
        continue;
      }
      const highRaw = die.get("high_pc") as number;
      const highForm = die.forms.get(0x12);
      const high = highForm !== undefined && [0x05, 0x06, 0x07, 0x0b, 0x0f].includes(highForm) ? (low as number) + highRaw : highRaw;
      const params = die.children
        .filter((c) => c.tagName === "formal_parameter")
        .map((c) => new Parameter(c.name || "", this.typeName(this.typeOf(c)), decodeLocation(c.get("location") || new Uint8Array(0))));
      const specRef = die.get("specification");
      const specification = specRef !== null ? this.dies.get(specRef as number) ?? null : null;
      const declared = specification ?? die;
      const name = declared.name || (declared.get("linkage_name") as string | null) || "";
      found.push(new FunctionInfo(name, low as number, high, decodeLocation(die.get("frame_base") || new Uint8Array(0)), params, this.typeName(this.typeOf(declared))));
    }
    return found.sort((a, b) => a.lowPc - b.lowPc);
  }
}

export function decodeConstu(expression: Uint8Array): number {
  if (!expression.length || expression[0] !== DW_OP_CONSTU) {
    throw new DwarfError("vtable_elem_location is not DW_OP_constu");
  }
  return readUleb(expression, 1)[0];
}

export function decodeLocation(expression: AttrValue): string {
  if (typeof expression === "number") {
    return `loclist ${hx(expression)}`;
  }
  if (!(expression instanceof Uint8Array) || !expression.length) {
    return "";
  }
  const op = expression[0];
  if (op === DW_OP_FBREG) {
    return `DW_OP_fbreg ${readSleb(expression, 1)[0]}`;
  }
  if (op === DW_OP_ADDRX) {
    return `DW_OP_addrx ${hx(readUleb(expression, 1)[0])}`;
  }
  if (DW_OP_REG0 <= op && op < DW_OP_REG0 + 16) {
    return `DW_OP_reg${op - DW_OP_REG0} ${DW_OP_REG_NAMES[op - DW_OP_REG0]}`;
  }
  return "DW_OP_" + hexBytes(expression);
}

export const REGISTER_PARENT: Map<string, string> = new Map();
{
  const highs = Array.from({ length: 8 }, (_v, i) => i + 8);
  const r64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", ...highs.map((i) => `r${i}`)];
  const r32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", ...highs.map((i) => `r${i}d`)];
  const r16 = ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", ...highs.map((i) => `r${i}w`)];
  const r8 = ["al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil", ...highs.map((i) => `r${i}b`)];
  for (let n = 0; n < r64.length; n++) {
    for (const name of [r64[n], r32[n], r16[n], r8[n]]) {
      REGISTER_PARENT.set(name, r64[n]);
    }
  }
  for (const name of ["ah", "ch", "dh", "bh"]) {
    REGISTER_PARENT.set(name, "r" + name[0] + "x");
  }
}
export const ARGUMENT_REGISTERS = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];
export const CALLER_SAVED = new Set(["rax", "rcx", "rdx", "rsi", "rdi", "r8", "r9", "r10", "r11"]);
export const FRAME_REGISTERS = new Set(["rbp", "rsp"]);

export const FLOAT_SCALAR = new Set(["movsd", "addsd", "subsd", "mulsd", "divsd", "ucomisd", "comisd", "sqrtsd", "minsd", "maxsd", "cvtsd2ss", "cvtsd2si"]);
export const FLOAT_SCALAR32 = new Set(["movss", "addss", "subss", "mulss", "divss", "ucomiss", "comiss", "sqrtss", "cvtss2sd", "cvtss2si"]);
export const VECTOR16 = new Set(["movaps", "movups", "movapd", "movupd", "movdqa", "movdqu", "paddd", "pxor", "pand", "por", "psubd"]);
export const INDIRECT_FLOW = new Set(["callq", "jmpq"]);

export class MemoryOperand {
  constructor(
    readonly displacement: number,
    readonly base: string | null,
    readonly index: string | null,
    readonly scale: number,
    readonly ripRelative: boolean,
  ) {}

  get isFrameSlot(): boolean {
    return this.base !== null && FRAME_REGISTERS.has(this.base) && this.index === null;
  }

  render(): string {
    if (this.ripRelative) {
      return this.displacement ? `${formatSigned(this.displacement)}(%rip)` : "(%rip)";
    }
    let inner = this.base ? "%" + this.base : "";
    if (this.index) {
      inner += ",%" + this.index + (this.scale !== 1 ? `,${this.scale}` : "");
    }
    const text = this.displacement || !this.base ? formatSigned(this.displacement) : "";
    return `${text}(${inner})`;
  }
}

const MEMORY_RE = /^(?:%[a-z]{2}:)?(?<disp>-?0x[0-9a-f]+|-?\d+)?\((?<base>%[a-z0-9]+)?(?:,(?<index>%[a-z0-9]+)(?:,(?<scale>[1248]))?)?\)$/;

export function formatSigned(value: number): string {
  return value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
}

export function parseMemory(operand: string): MemoryOperand | null {
  const match = MEMORY_RE.exec(operand.trim());
  if (match === null || match.groups === undefined) {
    return null;
  }
  const groups = match.groups;
  const disp = groups.disp ? parseIntBase0(groups.disp) : 0;
  const base = groups.base ? groups.base.slice(1) : null;
  const index = groups.index ? groups.index.slice(1) : null;
  const scale = Number(groups.scale || 1);
  return new MemoryOperand(disp, base === "rip" ? null : base, index, scale, base === "rip");
}

export class Instruction {
  constructor(
    readonly address: number,
    readonly raw: string,
    readonly mnemonic: string,
    readonly operands: string[],
    readonly target: number | null,
    readonly callee: string | null,
    readonly relocation: string | null,
  ) {}

  get text(): string {
    return this.mnemonic + (this.operands.length ? "\t" + this.operands.join(", ") : "");
  }

  get length(): number {
    return this.raw.split(/\s+/).filter((p) => p).length;
  }

  get flow(): string {
    if (this.mnemonic === "retq" || this.mnemonic === "ret") {
      return "return";
    }
    if ((this.mnemonic === "jmp" || this.mnemonic === "jmpq") && this.target !== null) {
      return "jump";
    }
    if (this.mnemonic.startsWith("j") && this.target !== null) {
      return "branch";
    }
    if ((this.mnemonic === "callq" || this.mnemonic === "call") && this.target !== null) {
      return "call";
    }
    if (this.operands.length && this.operands[0].startsWith("*")) {
      return this.mnemonic.startsWith("call") ? "indirect-call" : "indirect-jump";
    }
    return "next";
  }

  memoryOperands(): [number, MemoryOperand][] {
    const found: [number, MemoryOperand][] = [];
    this.operands.forEach((operand, position) => {
      const memory = parseMemory(operand.startsWith("*") ? operand.slice(1) : operand);
      if (memory !== null) {
        found.push([position, memory]);
      }
    });
    return found;
  }
}

const INSTRUCTION_RE = /^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} ?)+)\s*\t(\S+)(?:\t(.*))?$/;
const HEADER_RE = /^([0-9a-f]{16}) <([^>]+)>:$/;
const RELOCATION_RE = /^\s+([0-9a-f]+):\s+(R_X86_64_\w+)\t(\S+)/;
const TARGET_RE = /^(0x[0-9a-f]+)(?: <[^>]*>)?$/;

export function splitOperands(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

export function parseListing(text: string): Map<string, Instruction[]> {
  const functions: Map<string, Instruction[]> = new Map();
  let current: string | null = null;
  for (const line of splitlines(text)) {
    const header = HEADER_RE.exec(line);
    if (header) {
      current = header[2];
      functions.set(current, []);
      continue;
    }
    const relocation = RELOCATION_RE.exec(line);
    if (relocation && current && (functions.get(current) as Instruction[]).length) {
      const list = functions.get(current) as Instruction[];
      const last = list[list.length - 1];
      const symbol = relocation[3].split("-")[0].split("+")[0];
      const callee = last.flow === "call" && relocation[2] === "R_X86_64_PLT32" ? symbol : last.callee;
      list[list.length - 1] = new Instruction(last.address, last.raw, last.mnemonic, last.operands, last.target, callee, `${relocation[2]} ${relocation[3]}`);
      continue;
    }
    const match = INSTRUCTION_RE.exec(line);
    if (!match || current === null) {
      continue;
    }
    const address = parseInt(match[1], 16);
    const raw = wsJoin(match[2]);
    const mnemonic = match[3];
    const operandText = (match[4] || "").split("#")[0].trim();
    let operands = operandText ? splitOperands(operandText) : [];
    let target: number | null = null;
    if (operands.length && (mnemonic.startsWith("j") || mnemonic.startsWith("call"))) {
      const found = TARGET_RE.exec(operands[0]);
      if (found) {
        target = parseInt(found[1], 16);
        operands = [found[1]];
      }
    }
    (functions.get(current) as Instruction[]).push(new Instruction(address, raw, mnemonic, operands, target, null, null));
  }
  return functions;
}

export function loadListing(name: string): Map<string, Instruction[]> {
  return parseListing(readText(join(FIXTURES, name)));
}

export function accessWidth(mnemonic: string, _operandPosition: number, operandCount: number): [number, string, string | null] | null {
  if (mnemonic.startsWith("nop") || mnemonic === "leaq" || mnemonic === "leal" || mnemonic === "lea") {
    return null;
  }
  if ((mnemonic === "callq" || mnemonic === "jmpq") && operandCount === 1) {
    return [8, "code", null];
  }
  if (FLOAT_SCALAR.has(mnemonic)) {
    return [8, "float", null];
  }
  if (FLOAT_SCALAR32.has(mnemonic)) {
    return [4, "float", null];
  }
  if (VECTOR16.has(mnemonic)) {
    return [16, "vector", null];
  }
  if (mnemonic.startsWith("cvtsi2sd") || mnemonic.startsWith("cvtsi2ss")) {
    return [mnemonic.endsWith("q") ? 8 : 4, "int", "signed"];
  }
  if (mnemonic === "movd") {
    return [4, "int", null];
  }
  if (["movzbl", "movzbw", "movzbq", "movsbl", "movsbw", "movsbq"].includes(mnemonic)) {
    return [1, "int", mnemonic[3] === "z" ? "unsigned" : "signed"];
  }
  if (["movzwl", "movzwq", "movswl", "movswq"].includes(mnemonic)) {
    return [2, "int", mnemonic[3] === "z" ? "unsigned" : "signed"];
  }
  if (mnemonic === "movslq") {
    return [4, "int", "signed"];
  }
  if (mnemonic === "pushq" || mnemonic === "popq") {
    return [8, "int", null];
  }
  const suffix = mnemonic[mnemonic.length - 1];
  if (suffix === "b") {
    return [1, "int", null];
  }
  if (suffix === "w") {
    return [2, "int", null];
  }
  if (suffix === "l") {
    return [4, "int", null];
  }
  if (suffix === "q") {
    return [8, "int", null];
  }
  return null;
}

export class Pointer {
  constructor(
    readonly root: string,
    readonly offset: number,
    readonly strides: number[] = [],
    readonly origin: [string, number] | null = null,
  ) {}

  shifted(delta: number): Pointer {
    return new Pointer(this.root, this.offset + delta, this.strides, this.origin);
  }

  describe(): string {
    let text = this.root + (this.offset ? formatSigned(this.offset) : "");
    if (this.strides.length) {
      text += " + k*" + sortedNumbers(this.strides).map(String).join("/");
    }
    return text;
  }
}

export class Index {
  constructor(readonly scale: number = 1) {}
}

export type Value = Pointer | Index | null;

export class Access {
  constructor(
    readonly function_: string,
    readonly address: number,
    readonly text: string,
    readonly root: string | null,
    readonly offset: number,
    readonly width: number,
    readonly kind: string,
    readonly sign: string | null,
    readonly store: boolean,
    readonly base: string | null,
    readonly index: string | null,
    readonly strides: number[],
  ) {}

  key(): string {
    return JSON.stringify([this.function_, this.address, this.text, this.root, this.offset, this.width, this.kind, this.sign, this.store, this.base, this.index, sortedNumbers(this.strides)]);
  }

  toDict(): Json {
    return {
      function: this.function_,
      address: this.address,
      text: wsJoin(this.text),
      root: this.root,
      offset: this.offset,
      width: this.width,
      kind: this.kind,
      sign: this.sign,
      store: this.store,
      base: this.base,
      index: this.index,
      strides: sortedNumbers(this.strides),
    };
  }
}

export class Increment {
  constructor(
    readonly function_: string,
    readonly address: number,
    readonly register: string,
    readonly delta: number,
  ) {}
}

export class CallSite {
  constructor(
    readonly function_: string,
    readonly address: number,
    readonly callee: string,
    readonly arguments_: (string | null)[],
  ) {}

  toDict(): Json {
    return { function: this.function_, address: this.address, callee: this.callee, arguments: [...this.arguments_] };
  }
}

export class PointerUse {
  constructor(
    readonly function_: string,
    readonly address: number,
    readonly text: string,
    readonly origin: [string, number],
  ) {}
}

export class FunctionTrace {
  constructor(
    readonly name: string,
    readonly accesses: Access[],
    readonly increments: Increment[],
    readonly loops: [number, number][],
    readonly callSites: CallSite[],
    readonly pointerUses: PointerUse[],
    readonly unattributed: number,
  ) {}

  inLoop(first: number, second: number): boolean {
    return this.loops.some(([start, end]) => start <= first && first <= end && start <= second && second <= end);
  }
}

function register_(operand: string): string | null {
  if (operand.startsWith("%") && REGISTER_PARENT.has(operand.slice(1))) {
    return REGISTER_PARENT.get(operand.slice(1)) as string;
  }
  return null;
}

function is64bitRegister(operand: string): boolean {
  return operand.startsWith("%") && REGISTER_PARENT.has(operand.slice(1)) && REGISTER_PARENT.get(operand.slice(1)) === operand.slice(1);
}

function immediate_(operand: string): number | null {
  if (operand.startsWith("$")) {
    const value = parseIntBase0(operand.slice(1));
    return value >= 2 ** 31 ? value - 2 ** 32 : value;
  }
  return null;
}

function slotKey(memory: MemoryOperand): string {
  return `${memory.base}${memory.displacement ? formatSigned(memory.displacement) : ""}`;
}

const NONE_KEY = "\u0000None";
const MOVES = new Set(["movq", "movl", "movw", "movb", "movabsq", "movslq", "movzbl", "movsbl", "movzwl", "movswl", "movzbq", "movsbq", "movzwq", "movswq"]);
const COMPARES = new Set(["cmpq", "cmpl", "cmpw", "cmpb", "testq", "testl", "testb", "ucomisd", "comisd"]);

export function traceFunction(name: string, instructions: Instruction[]): FunctionTrace {
  const env: Map<string, Value> = new Map();
  ARGUMENT_REGISTERS.forEach((register, position) => env.set(register, new Pointer(`param${position}`, 0)));
  const accesses: Access[] = [];
  const increments: Increment[] = [];
  const callSites: CallSite[] = [];
  const pointerUses: PointerUse[] = [];
  let unattributed = 0;
  const loops: [number, number][] = instructions
    .filter((i) => (i.flow === "jump" || i.flow === "branch") && i.target !== null && i.target <= i.address)
    .map((i) => [i.target as number, i.address]);

  const look = (key: string): Value => env.get(key) ?? null;
  const put = (key: string | null, value: Value): void => {
    env.set(key ?? NONE_KEY, value);
  };

  const valueOf = (operand: string): Value => {
    const register = register_(operand);
    if (register !== null) {
      return is64bitRegister(operand) ? look(register) : new Index(1);
    }
    if (immediate_(operand) !== null) {
      return new Index(1);
    }
    const memory = parseMemory(operand);
    if (memory !== null && memory.isFrameSlot) {
      return look(slotKey(memory));
    }
    return null;
  };

  const addressOf = (memory: MemoryOperand): Value => {
    if (memory.ripRelative || memory.base === null) {
      return null;
    }
    if (FRAME_REGISTERS.has(memory.base)) {
      return new Pointer(`frame(${memory.base}${memory.displacement ? formatSigned(memory.displacement) : ""})`, 0);
    }
    const base = look(memory.base);
    if (!(base instanceof Pointer)) {
      return null;
    }
    const strides = new Set(base.strides);
    if (memory.index !== null) {
      const indexValue = look(memory.index);
      strides.add((indexValue instanceof Index ? indexValue.scale : 1) * memory.scale);
    }
    return new Pointer(base.root, base.offset + memory.displacement, sortedNumbers(strides), base.origin);
  };

  const write = (operand: string, value: Value): void => {
    const register = register_(operand);
    if (register !== null) {
      env.set(register, is64bitRegister(operand) ? value : new Index(1));
      return;
    }
    const memory = parseMemory(operand);
    if (memory !== null && memory.isFrameSlot) {
      env.set(slotKey(memory), value);
    }
  };

  for (const instruction of instructions) {
    const mnemonic = instruction.mnemonic;
    const operands = instruction.operands;
    const loaded: Map<number, Value> = new Map();
    for (const [position, memory] of instruction.memoryOperands()) {
      if (memory.isFrameSlot && !INDIRECT_FLOW.has(mnemonic)) {
        continue;
      }
      const spec = accessWidth(mnemonic, position, operands.length);
      if (spec === null) {
        continue;
      }
      const [width, kind, sign] = spec;
      const pointer = addressOf(memory);
      const store = position === operands.length - 1 && operands.length > 1 && !INDIRECT_FLOW.has(mnemonic);
      if (pointer instanceof Pointer) {
        if (pointer.origin !== null) {
          pointerUses.push(new PointerUse(name, instruction.address, instruction.text, pointer.origin));
        }
        accesses.push(new Access(name, instruction.address, instruction.text, pointer.root, pointer.offset, width, kind, sign, store, memory.base, memory.index, pointer.strides));
        if (!store && width === 8 && kind === "int") {
          loaded.set(position, new Pointer(`${pointer.root}->${hx(pointer.offset)}`, 0, [], [pointer.root, pointer.offset]));
        }
      } else {
        unattributed += 1;
      }
    }
    if (instruction.flow === "call" || instruction.flow === "indirect-call") {
      const args = ARGUMENT_REGISTERS.map((r) => {
        const value = look(r);
        return value instanceof Pointer ? value.describe() : null;
      });
      if (instruction.callee) {
        callSites.push(new CallSite(name, instruction.address, instruction.callee, args));
      }
      for (const register of CALLER_SAVED) {
        env.set(register, null);
      }
      continue;
    }
    if (!operands.length) {
      continue;
    }
    const destination = operands[operands.length - 1];
    const destRegister = register_(destination);
    if (mnemonic === "leaq") {
      const memory = parseMemory(operands[0]);
      if (memory !== null) {
        const value = addressOf(memory);
        const base = memory.base ? look(memory.base) : null;
        if (base instanceof Pointer && memory.index === null && destRegister === memory.base && memory.displacement) {
          increments.push(new Increment(name, instruction.address, memory.base as string, memory.displacement));
        }
        if (base instanceof Pointer && base.origin !== null) {
          pointerUses.push(new PointerUse(name, instruction.address, instruction.text, base.origin));
        }
        write(destination, value);
      }
      continue;
    }
    if (MOVES.has(mnemonic)) {
      const dest64 = is64bitRegister(destination);
      let sourceValue: Value = mnemonic === "movq" ? valueOf(operands[0]) : new Index(1);
      const sourceMemory = parseMemory(operands[0]);
      if (mnemonic === "movq" && dest64 && loaded.has(0)) {
        sourceValue = loaded.get(0) as Value;
      } else if (mnemonic === "movq" && sourceMemory !== null && !sourceMemory.isFrameSlot) {
        sourceValue = null;
      }
      write(destination, sourceValue);
      continue;
    }
    if ((mnemonic === "addq" || mnemonic === "subq") && operands.length === 2) {
      const current = look(destRegister || "");
      const imm = immediate_(operands[0]);
      if (imm !== null) {
        const delta = mnemonic === "addq" ? imm : -imm;
        if (current instanceof Pointer) {
          put(destRegister, current.shifted(delta));
        }
        if (destRegister === null || !FRAME_REGISTERS.has(destRegister)) {
          increments.push(new Increment(name, instruction.address, destRegister || destination, delta));
        }
        continue;
      }
      const other = valueOf(operands[0]);
      if (mnemonic === "addq") {
        put(destRegister, add_(current, other));
      } else {
        put(destRegister, current instanceof Index && other instanceof Index ? new Index(1) : null);
      }
      continue;
    }
    if (mnemonic === "incq" || mnemonic === "decq") {
      const current = look(destRegister || "");
      const delta = mnemonic === "incq" ? 1 : -1;
      if (current instanceof Pointer) {
        put(destRegister, current.shifted(delta));
      }
      increments.push(new Increment(name, instruction.address, destRegister || destination, delta));
      continue;
    }
    if ((mnemonic === "shlq" || mnemonic === "salq") && operands.length === 2) {
      const current = look(destRegister || "");
      const shift = immediate_(operands[0]);
      put(destRegister, shift !== null && !(current instanceof Pointer) ? new Index((current instanceof Index ? current.scale : 1) * 2 ** shift) : null);
      continue;
    }
    if (mnemonic === "imulq" && operands.length === 3 && immediate_(operands[0]) !== null) {
      const source = valueOf(operands[1]);
      put(destRegister, new Index((source instanceof Index ? source.scale : 1) * (immediate_(operands[0]) as number)));
      continue;
    }
    if ((mnemonic === "xorl" || mnemonic === "xorq") && operands.length === 2 && operands[0] === operands[1]) {
      write(destination, new Index(1));
      continue;
    }
    if (destRegister !== null && !COMPARES.has(mnemonic)) {
      if (instruction.flow !== "next" || mnemonic.startsWith("set")) {
        continue;
      }
      write(destination, !is64bitRegister(destination) || !mnemonic.startsWith("cmov") ? new Index(1) : null);
    }
  }
  return new FunctionTrace(name, accesses, increments, loops, callSites, pointerUses, unattributed);
}

function add_(first: Value, second: Value): Value {
  if (first instanceof Pointer && second instanceof Index) {
    return new Pointer(first.root, first.offset, sortedNumbers([...first.strides, second.scale]), first.origin);
  }
  if (second instanceof Pointer && first instanceof Index) {
    return new Pointer(second.root, second.offset, sortedNumbers([...second.strides, first.scale]), second.origin);
  }
  if (first instanceof Index && second instanceof Index) {
    return new Index(gcd(first.scale, second.scale));
  }
  return null;
}

export class Evidence {
  constructor(
    readonly function_: string,
    readonly address: number,
    readonly text: string,
    readonly note: string,
  ) {}

  toDict(): Json {
    return { function: this.function_, address: this.address, text: wsJoin(this.text), note: this.note };
  }
}

export class InferredField {
  constructor(
    readonly offset: number,
    readonly size: number,
    readonly kinds: Set<string>,
    readonly signs: Set<string>,
    readonly evidence: Evidence[],
    readonly pointerProof: Evidence[] = [],
  ) {}

  get kind(): string {
    if (this.pointerProof.length) {
      return "pointer";
    }
    if (this.kinds.size === 1) {
      return [...this.kinds][0];
    }
    if (this.kinds.size === 2 && this.kinds.has("int") && this.kinds.has("code")) {
      return "code";
    }
    return "conflict";
  }

  get sign(): string | null {
    return this.signs.size === 1 ? [...this.signs][0] : null;
  }

  get label(): string {
    const kind = this.kind;
    if (kind === "pointer") {
      return "pointer";
    }
    if (kind === "float") {
      return this.size === 4 ? "float32" : this.size === 8 ? "float64" : `float${this.size * 8}`;
    }
    if (kind === "int") {
      const sign = this.sign;
      const prefix = sign === "signed" ? "i" : sign === "unsigned" ? "u" : "int";
      return `${prefix}${this.size * 8}`;
    }
    return `${kind}${this.size * 8}`;
  }

  toDict(): Json {
    return {
      offset: this.offset,
      size: this.size,
      kind: this.kind,
      sign: this.sign,
      label: this.label,
      evidence: this.evidence.map((e) => e.toDict()),
      pointerProof: this.pointerProof.map((e) => e.toDict()),
    };
  }
}

export class StrideEvidence {
  constructor(
    readonly value: number,
    readonly kind: string,
    readonly function_: string,
    readonly address: number,
    readonly text: string,
  ) {}

  toDict(): Json {
    return { value: this.value, kind: this.kind, function: this.function_, address: this.address, text: wsJoin(this.text) };
  }
}

export class InferredLayout {
  constructor(
    readonly root: string,
    readonly fields: InferredField[],
    readonly conflicts: Json[],
    readonly strideEvidence: StrideEvidence[],
    readonly aliases: Map<string, number>,
  ) {}

  get stride(): number | null {
    const values = this.strideEvidence.map((e) => e.value);
    return values.length ? gcdAll(values) : null;
  }

  get sizeLowerBound(): number {
    return this.fields.reduce((acc, f) => Math.max(acc, f.offset + f.size), 0);
  }

  get size(): number | null {
    const stride = this.stride;
    if (stride === null) {
      return null;
    }
    return stride >= this.sizeLowerBound ? stride : null;
  }

  gaps(): number[] {
    const size = this.size || this.sizeLowerBound;
    const covered = new Set<number>();
    for (const f of this.fields) {
      for (let b = f.offset; b < f.offset + f.size; b++) {
        covered.add(b);
      }
    }
    const result: number[] = [];
    for (let b = 0; b < size; b++) {
      if (!covered.has(b)) {
        result.push(b);
      }
    }
    return result;
  }

  naturalAlignmentOk(): boolean {
    return this.fields.every((f) => pymod(f.offset, naturalAlignment(f.size)) === 0);
  }

  toDict(): Json {
    return {
      root: this.root,
      fields: [...this.fields].sort((a, b) => a.offset - b.offset).map((f) => f.toDict()),
      conflicts: this.conflicts,
      stride: this.stride,
      strideEvidence: this.strideEvidence.map((e) => e.toDict()),
      sizeLowerBound: this.sizeLowerBound,
      size: this.size,
      gaps: this.gaps(),
      naturalAlignment: this.naturalAlignmentOk(),
      aliases: new Map([...this.aliases.entries()].map(([k, v]) => [k, v as Json])),
    };
  }
}

export function inferLayout(traces: FunctionTrace[], witnesses: [string, string][], rootName = "struct", fold = true): InferredLayout {
  const byName: Map<string, FunctionTrace> = new Map(traces.map((t) => [t.name, t]));
  const fields: Map<string, InferredField> = new Map();
  const strideEvidence: StrideEvidence[] = [];
  const witnessSet = new Set(witnesses.map(([f, r]) => `${f}\u0000${r}`));
  for (const [fn, root] of witnesses) {
    const trace = byName.get(fn);
    if (trace === undefined) {
      continue;
    }
    const [mine, loopEvidence] = foldUnrolled(trace, trace.accesses.filter((a) => a.root === root), fold);
    strideEvidence.push(...loopEvidence);
    for (const access of mine) {
      const key = `${access.offset},${access.width}`;
      if (!fields.has(key)) {
        fields.set(key, new InferredField(access.offset, access.width, new Set(), new Set(), []));
      }
      const entry = fields.get(key) as InferredField;
      entry.kinds.add(access.kind);
      if (access.sign) {
        entry.signs.add(access.sign);
      }
      entry.evidence.push(new Evidence(fn, access.address, access.text, access.store ? "store" : "load"));
      for (const stride of access.strides) {
        if (stride > 1) {
          strideEvidence.push(new StrideEvidence(stride, "scale", fn, access.address, access.text));
        }
      }
      for (const increment of trace.increments) {
        if ((increment.register === access.base || increment.register === access.index) && trace.inLoop(increment.address, access.address) && increment.delta) {
          strideEvidence.push(new StrideEvidence(Math.abs(increment.delta), "loop-step", fn, increment.address, `${increment.register} += ${increment.delta}`));
        }
      }
    }
    for (const use of trace.pointerUses) {
      if (use.origin[0] === root) {
        for (const entry of fields.values()) {
          if (entry.offset === use.origin[1] && entry.size === 8) {
            entry.pointerProof.push(new Evidence(fn, use.address, use.text, "value used as an address"));
          }
        }
      }
    }
  }
  const aliases: Map<string, number> = new Map();
  for (const trace of traces) {
    for (const site of trace.callSites) {
      const first = site.arguments_[0];
      if (witnessSet.has(`${site.callee}\u0000param0`) && first && first.startsWith("frame(")) {
        const offsetText = first.slice(first.indexOf(")") + 1);
        aliases.set(`${site.callee}@${hx(site.address)}`, offsetText ? parseHex(offsetText) : 0);
      }
    }
  }
  const elementOffsets = sortedNumbers([...aliases.values()].filter((o) => o));
  for (const offset of elementOffsets) {
    strideEvidence.push(new StrideEvidence(offset, "call-site", "main", 0, `argument = frame object + ${hx(offset)}`));
  }
  const conflicts: Json[] = [];
  const ordered = [...fields.values()].sort((a, b) => a.offset - b.offset || a.size - b.size);
  for (let i = 0; i + 1 < ordered.length; i++) {
    const first = ordered[i];
    const second = ordered[i + 1];
    if (second.offset < first.offset + first.size) {
      conflicts.push({ first: { offset: first.offset, size: first.size }, second: { offset: second.offset, size: second.size }, reason: "overlapping accesses of different widths" });
    }
  }
  const unique: StrideEvidence[] = [];
  const seen = new Set<string>();
  for (const item of strideEvidence) {
    const key = JSON.stringify([item.value, item.kind, item.function_, item.address]);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return new InferredLayout(rootName, ordered, conflicts, unique, aliases);
}

export function foldUnrolled(trace: FunctionTrace, accesses: Access[], fold = true): [Access[], StrideEvidence[]] {
  const folded = [...accesses];
  const evidence: StrideEvidence[] = [];
  for (const [start, end] of trace.loops) {
    const inside = accesses.filter((a) => start <= a.address && a.address <= end);
    const groups: Map<string, { base: string | null; members: Access[] }> = new Map();
    for (const access of inside) {
      const key = JSON.stringify([access.base, access.width, access.store]);
      if (!groups.has(key)) {
        groups.set(key, { base: access.base, members: [] });
      }
      (groups.get(key) as { base: string | null; members: Access[] }).members.push(access);
    }
    for (const { base, members: group } of groups.values()) {
      const offsets = sortedNumbers(group.map((a) => a.offset));
      if (offsets.length < 2) {
        continue;
      }
      const differences: number[] = [];
      for (let i = 0; i + 1 < offsets.length; i++) {
        differences.push(offsets[i + 1] - offsets[i]);
      }
      const delta = gcdAll(differences);
      evidence.push(new StrideEvidence(delta, "offset-delta", trace.name, group[0].address, `${offsets.length} offsets ${delta} apart in loop ${hx(start)}-${hx(end)}`));
      const steps = new Set(trace.increments.filter((i) => i.register === base && start <= i.address && i.address <= end).map((i) => Math.abs(i.delta)));
      const groupKeys = new Set(group.map((a) => a.key()));
      for (const step of steps) {
        if (step > delta && step % delta === 0 && Math.floor(step / delta) === offsets.length) {
          evidence.push(new StrideEvidence(delta, "unrolled", trace.name, group[0].address, `loop step ${step} = ${offsets.length} x ${delta}`));
          if (!fold) {
            continue;
          }
          const lowest = offsets[0];
          folded.forEach((access, position) => {
            if (groupKeys.has(access.key())) {
              folded[position] = new Access(access.function_, access.address, access.text, access.root, lowest + pymod(access.offset - lowest, delta), access.width, access.kind, access.sign, access.store, access.base, access.index, access.strides);
            }
          });
        }
      }
    }
  }
  return [folded, evidence];
}

export function compareLayouts(inferred: InferredLayout, truth: StructLayout): { [key: string]: Json } {
  const rows: { [key: string]: Json }[] = [];
  const matched = new Set<string>();
  for (const member of truth.members) {
    const candidates = inferred.fields.filter((f) => f.offset === member.offset);
    if (!candidates.length) {
      rows.push({ member: member.name, offset: member.offset, truth: member.type, inferred: null, status: "no-evidence" });
      continue;
    }
    const best = candidates.find((f) => f.size === member.size) ?? candidates[0];
    matched.add(`${best.offset},${best.size}`);
    let status: string;
    if (best.size !== member.size) {
      status = "size-mismatch";
    } else if (best.kind === "conflict") {
      status = "kind-conflict";
    } else if (member.kind === "pointer" && best.kind !== "pointer") {
      status = "pointer-unproven";
    } else if (member.kind !== best.kind && !(member.kind === "int" && best.kind === "code")) {
      status = "kind-mismatch";
    } else {
      status = "match";
    }
    rows.push({ member: member.name, offset: member.offset, truth: member.type, inferred: best.label, status, evidence: best.evidence.length });
  }
  for (const entry of inferred.fields) {
    if (!matched.has(`${entry.offset},${entry.size}`)) {
      const inside = truth.members.filter((m) => m.offset <= entry.offset && entry.offset < m.offset + m.size);
      rows.push({ member: inside.length ? inside[0].name : null, offset: entry.offset, truth: inside.length ? inside[0].type : "padding", inferred: entry.label, status: "unexpected" });
    }
  }
  let sizeStatus: string;
  if (inferred.size === null) {
    sizeStatus = "unknown";
  } else if (inferred.size === truth.size) {
    sizeStatus = "match";
  } else {
    sizeStatus = "mismatch";
  }
  const allowed = new Set(truth.padding());
  for (const m of truth.members) {
    if (!inferred.fields.some((f) => f.offset === m.offset)) {
      for (let b = m.offset; b < m.offset + m.size; b++) {
        allowed.add(b);
      }
    }
  }
  const gapsOk = inferred.gaps().every((b) => allowed.has(b));
  return {
    struct: truth.name,
    rows,
    size: { inferred: inferred.size, lowerBound: inferred.sizeLowerBound, truth: truth.size, status: sizeStatus },
    gapsConsistent: gapsOk,
    matches: rows.filter((r) => r.status === "match").length,
    members: truth.members.length,
  };
}

export const PSABI_SCALARS: Map<string, [number, number]> = new Map([
  ["_Bool", [1, 1]], ["char", [1, 1]], ["signed char", [1, 1]], ["unsigned char", [1, 1]], ["short", [2, 2]], ["unsigned short", [2, 2]],
  ["int", [4, 4]], ["unsigned int", [4, 4]], ["enum", [4, 4]], ["long", [8, 8]], ["unsigned long", [8, 8]], ["long long", [8, 8]],
  ["unsigned long long", [8, 8]], ["__int128", [16, 16]], ["pointer", [8, 8]], ["float", [4, 4]], ["double", [8, 8]], ["long double", [16, 16]],
]);
export const ACCOUNT_MEMBERS: [string, string][] = [["kind", "char"], ["balance", "int"], ["code", "short"], ["rate", "double"], ["label", "pointer"]];

export function sysvLayout(members: [string, string][]): { members: { [key: string]: Json }[]; size: number; align: number; tailPadding: number } {
  let offset = 0;
  let align = 1;
  const laid: { [key: string]: Json }[] = [];
  for (const [name, typeName] of members) {
    const entry = PSABI_SCALARS.get(typeName);
    if (entry === undefined) {
      throw new Error(`KeyError: '${typeName}'`);
    }
    const [size, memberAlign] = entry;
    const padding = pymod(-offset, memberAlign);
    offset += padding;
    laid.push({ name, type: typeName, offset, size, align: memberAlign, paddingBefore: padding });
    offset += size;
    align = Math.max(align, memberAlign);
  }
  const tail = pymod(-offset, align);
  return { members: laid, size: offset + tail, align, tailPadding: tail };
}

export const CTYPES_ACCOUNT: [string, number, number][] = [["kind", 1, 1], ["balance", 4, 4], ["code", 2, 2], ["rate", 8, 8], ["label", 8, 8]];

export function ctypesLayout(): { members: { name: string; offset: number; size: number }[]; size: number; align: number } {
  let offset = 0;
  let align = 1;
  const members: { name: string; offset: number; size: number }[] = [];
  for (const [name, size, fieldAlign] of CTYPES_ACCOUNT) {
    offset += pymod(-offset, fieldAlign);
    members.push({ name, offset, size });
    offset += size;
    align = Math.max(align, fieldAlign);
  }
  return { members, size: offset + pymod(-offset, align), align };
}

export const BUILTIN_TYPES: Map<string, string> = new Map([
  ["v", "void"], ["b", "bool"], ["c", "char"], ["a", "signed char"], ["h", "unsigned char"], ["s", "short"], ["t", "unsigned short"], ["i", "int"],
  ["j", "unsigned int"], ["l", "long"], ["m", "unsigned long"], ["x", "long long"], ["y", "unsigned long long"], ["f", "float"], ["d", "double"],
  ["e", "long double"], ["z", "..."], ["w", "wchar_t"], ["n", "__int128"], ["o", "unsigned __int128"],
]);
export const SPECIAL_NAMES: Map<string, string> = new Map([["TV", "vtable for "], ["TI", "typeinfo for "], ["TS", "typeinfo name for "], ["TT", "VTT for "]]);
export const OPERATORS: Map<string, string> = new Map([
  ["nw", "operator new"], ["na", "operator new[]"], ["dl", "operator delete"], ["da", "operator delete[]"], ["pl", "operator+"], ["mi", "operator-"],
  ["ml", "operator*"], ["eq", "operator=="], ["aS", "operator="], ["cl", "operator()"], ["ix", "operator[]"],
]);
const QUALIFIER_TEXT: Map<string, string> = new Map([["K", " const"], ["V", " volatile"], ["r", " restrict"]]);

export class DemangleError extends Error {}

function isDigit(char: string): boolean {
  return char.length === 1 && char >= "0" && char <= "9";
}

function pyReprStr(text: string): string {
  return text.includes("'") && !text.includes('"') ? `"${text}"` : `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export class Demangler {
  pos = 0;
  substitutions: string[] = [];

  constructor(readonly text: string) {}

  peek(count = 1): string {
    return this.text.slice(this.pos, this.pos + count);
  }

  take(count = 1): string {
    const value = this.text.slice(this.pos, this.pos + count);
    this.pos += count;
    return value;
  }

  number(): number {
    const start = this.pos;
    while (this.pos < this.text.length && isDigit(this.text[this.pos])) {
      this.pos += 1;
    }
    if (start === this.pos) {
      throw new DemangleError(`expected a number at ${start} in ${this.text}`);
    }
    return Number(this.text.slice(start, this.pos));
  }

  sourceName(): string {
    const length = this.number();
    return this.take(length);
  }

  unqualifiedName(enclosing: string | null): string {
    if (isDigit(this.peek())) {
      return this.sourceName();
    }
    if (this.peek() === "C" && "123".includes(this.peek(2).slice(1))) {
      this.take(2);
      return enclosing ? (enclosing.split("::").pop() as string) : "?";
    }
    if (this.peek() === "D" && "012".includes(this.peek(2).slice(1))) {
      this.take(2);
      return "~" + (enclosing ? (enclosing.split("::").pop() as string) : "?");
    }
    const two = this.peek(2);
    const operator = OPERATORS.get(two);
    if (operator !== undefined) {
      this.take(2);
      return operator;
    }
    throw new DemangleError(`unsupported name at ${this.pos} in ${this.text}`);
  }

  nestedName(): [string, string] {
    this.take(1);
    let qualifiers = "";
    while (["r", "V", "K"].includes(this.peek())) {
      qualifiers = (QUALIFIER_TEXT.get(this.take()) as string) + qualifiers;
    }
    let parts: string[] = [];
    while (this.peek() !== "E") {
      if (this.peek() === "S" && this.peek(2) !== "St") {
        parts = [this.substitution()];
        continue;
      }
      if (this.peek(2) === "St") {
        this.take(2);
        parts.push("std");
        continue;
      }
      parts.push(this.unqualifiedName(parts.length ? parts.join("::") : null));
      if (this.peek() !== "E") {
        this.substitutions.push(parts.join("::"));
      }
    }
    this.take(1);
    return [parts.join("::"), qualifiers];
  }

  substitution(): string {
    this.take(1);
    if (this.peek() === "_") {
      this.take(1);
      return this.lookup(0);
    }
    let digits = "";
    while (this.peek() !== "_") {
      digits += this.take();
    }
    this.take(1);
    return this.lookup(parseInt(digits, 36) + 1);
  }

  private lookup(index: number): string {
    const value = this.substitutions[index];
    if (value === undefined) {
      throw new DemangleError("list index out of range");
    }
    return value;
  }

  name(): [string, string] {
    if (this.peek() === "N") {
      return this.nestedName();
    }
    if (this.peek() === "S" && this.peek(2) === "St") {
      this.take(2);
      return ["std::" + this.sourceName(), ""];
    }
    return [this.unqualifiedName(null), ""];
  }

  type(): string {
    const char = this.peek();
    const builtin = BUILTIN_TYPES.get(char);
    if (builtin !== undefined) {
      this.take();
      return builtin;
    }
    if (char === "P") {
      this.take();
      const result = this.type() + "*";
      this.substitutions.push(result);
      return result;
    }
    if (char === "R") {
      this.take();
      const result = this.type() + "&";
      this.substitutions.push(result);
      return result;
    }
    if (char === "O") {
      this.take();
      const result = this.type() + "&&";
      this.substitutions.push(result);
      return result;
    }
    if (char === "K" || char === "V" || char === "r") {
      this.take();
      const result = this.type() + (QUALIFIER_TEXT.get(char) as string);
      this.substitutions.push(result);
      return result;
    }
    if (char === "S") {
      return this.substitution();
    }
    if (char === "N") {
      const [name, qualifiers] = this.nestedName();
      const result = name + qualifiers;
      this.substitutions.push(result);
      return result;
    }
    if (isDigit(char)) {
      const result = this.sourceName();
      this.substitutions.push(result);
      return result;
    }
    throw new DemangleError(`unsupported type code ${pyReprStr(char)} at ${this.pos} in ${this.text}`);
  }

  parameters(): string {
    let params: string[] = [];
    while (this.pos < this.text.length && this.peek() !== "E" && this.peek() !== ".") {
      params.push(this.type());
    }
    if (params.length === 1 && params[0] === "void") {
      params = [];
    }
    return "(" + params.join(", ") + ")";
  }

  demangle(): string {
    if (!this.text.startsWith("_Z")) {
      throw new DemangleError("not an Itanium mangled name");
    }
    this.take(2);
    if (this.peek() === "T" && SPECIAL_NAMES.has(this.peek(2))) {
      const prefix = SPECIAL_NAMES.get(this.take(2)) as string;
      return prefix + this.type();
    }
    const [base, qualifiers] = this.name();
    if (this.pos >= this.text.length) {
      return base;
    }
    return base + this.parameters() + qualifiers;
  }
}

export function demangle(name: string): string {
  return new Demangler(name).demangle();
}

function removePrefix(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

export class VTable {
  constructor(
    readonly symbol: string,
    readonly className: string,
    readonly offsetToTop: number,
    readonly typeinfo: string | null,
    readonly functions: [number, string, string][],
    readonly addressPoint: number,
  ) {}

  toDict(): Json {
    return {
      symbol: this.symbol,
      class: this.className,
      offsetToTop: this.offsetToTop,
      typeinfo: this.typeinfo,
      addressPoint: this.addressPoint,
      slots: this.functions.map(([s, n, d]) => ({ slot: s, symbol: n, demangled: d })),
    };
  }
}

export function readVtable(elf: ElfObject, symbolName: string): VTable {
  const symbol = elf.symbol(symbolName);
  const section = elf.section(symbol.section);
  const relocations: Map<number, Relocation> = new Map();
  for (const r of elf.relocations.get(symbol.section) ?? []) {
    if (symbol.value <= r.offset && r.offset < symbol.value + symbol.size) {
      relocations.set(r.offset, r);
    }
  }
  const offsetToTop = i64(section.data, symbol.value);
  const typeinfo = relocations.get(symbol.value + 8);
  const functions: [number, string, string][] = [];
  for (let position = symbol.value + 16; position < symbol.value + symbol.size; position += 8) {
    const relocation = relocations.get(position);
    const name = relocation ? relocation.symbolName : "(null)";
    functions.push([Math.floor((position - symbol.value - 16) / 8), name, name.startsWith("_Z") ? demangle(name) : name]);
  }
  return new VTable(symbolName, removePrefix(demangle(symbolName), "vtable for "), offsetToTop, typeinfo ? typeinfo.symbolName : null, functions, 16);
}

export class TypeInfo {
  constructor(
    readonly symbol: string,
    readonly className: string,
    readonly kind: string,
    readonly nameString: string,
    readonly base: string | null,
  ) {}

  toDict(): Json {
    return { symbol: this.symbol, class: this.className, kind: this.kind, nameString: this.nameString, base: this.base };
  }
}

export function readTypeinfo(elf: ElfObject, symbolName: string): TypeInfo {
  const symbol = elf.symbol(symbolName);
  const relocations: Map<number, Relocation> = new Map((elf.relocations.get(symbol.section) ?? []).map((r) => [r.offset, r]));
  const vptr = relocations.get(symbol.value);
  const kind = vptr ? removePrefix(demangle(vptr.symbolName), "vtable for __cxxabiv1::") : "unknown";
  const nameRelocation = relocations.get(symbol.value + 8);
  let nameString = "";
  if (nameRelocation) {
    const nameSymbol = elf.symbol(nameRelocation.symbolName);
    nameString = cstring(elf.section(nameSymbol.section).data, nameSymbol.value);
  }
  const base = relocations.get(symbol.value + 16);
  return new TypeInfo(symbolName, removePrefix(demangle(symbolName), "typeinfo for "), kind, nameString, base ? base.symbolName : null);
}

export class VirtualCall {
  constructor(
    readonly function_: string,
    readonly address: number,
    readonly text: string,
    readonly slot: number,
    readonly candidates: Map<string, string>,
  ) {}

  toDict(): Json {
    return { function: this.function_, address: this.address, text: wsJoin(this.text), slot: this.slot, candidates: new Map([...this.candidates.entries()].map(([k, v]) => [k, v as Json])) };
  }
}

export function findVirtualCalls(listing: Map<string, Instruction[]>, vtables: VTable[]): VirtualCall[] {
  const calls: VirtualCall[] = [];
  for (const [name, instructions] of listing) {
    const vptrRegisters = new Set<string>();
    for (const instruction of instructions) {
      if (instruction.mnemonic === "movq" && instruction.operands.length === 2) {
        const memory = parseMemory(instruction.operands[0]);
        const destination = register_(instruction.operands[1]);
        if (memory && memory.displacement === 0 && !(memory.base !== null && FRAME_REGISTERS.has(memory.base)) && memory.index === null) {
          vptrRegisters.add(destination || "");
        } else if (destination !== null && vptrRegisters.has(destination)) {
          vptrRegisters.delete(destination);
        }
      }
      if (instruction.flow === "indirect-call") {
        const memory = parseMemory(instruction.operands[0].slice(1));
        if (memory && memory.base !== null && vptrRegisters.has(memory.base)) {
          const slot = Math.floor(memory.displacement / 8);
          const candidates: Map<string, string> = new Map();
          for (const v of vtables) {
            const hit = v.functions.find((f) => f[0] === slot);
            candidates.set(v.className, hit ? hit[1] : "(none)");
          }
          calls.push(new VirtualCall(name, instruction.address, instruction.text, slot, candidates));
        }
      }
    }
  }
  return calls;
}

export const ACCOUNT_BUILDS: Map<string, string> = new Map([["O0", "account-x86_64-O0-g"], ["O1", "account-x86_64-O1-g"], ["O2", "account-x86_64-O2-g"]]);
export const EVIDENCE_ORDER = ["bump", "sum_balances", "tag", "projected", "label_length", "main"];
export const WITNESSES: [string, string][] = EVIDENCE_ORDER.filter((name) => name !== "main").map((name) => [name, "param0"]);

export function traceListing(listing: Map<string, Instruction[]>): Map<string, FunctionTrace> {
  return new Map([...listing.entries()].map(([name, instructions]) => [name, traceFunction(name, instructions)]));
}

export function accountTruth(): StructLayout {
  return new DwarfInfo(loadObject("account-x86_64-O0-g.o")).struct("account");
}

export function analyzeBuild(build: string, functions: string[] | null = null, fold = true): { [key: string]: Json } {
  const object = ACCOUNT_BUILDS.get(build) as string;
  const listing = loadListing(`${object}.objdump.txt`);
  const traces = traceListing(listing);
  const chosen = functions && functions.length ? functions : EVIDENCE_ORDER;
  const witnesses = WITNESSES.filter(([f]) => chosen.includes(f));
  const selected = chosen.filter((name) => traces.has(name)).map((name) => traces.get(name) as FunctionTrace);
  const layout = inferLayout(selected, witnesses, "account", fold);
  const truth = accountTruth();
  const unattributed: Map<string, Json> = new Map();
  for (const t of selected) {
    if (t.unattributed) {
      unattributed.set(t.name, t.unattributed);
    }
  }
  return {
    object: `${object}.o`,
    functions: [...chosen],
    accesses: selected.flatMap((t) => t.accesses.filter((a) => a.root !== null && (a.root === "param0" || a.root.startsWith("param0->"))).map((a) => a.toDict())),
    unattributed,
    callSites: selected.flatMap((t) => t.callSites.map((c) => c.toDict())),
    layout: layout.toDict(),
    comparison: compareLayouts(layout, truth),
  };
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function layoutOracles(): { [key: string]: Json } {
  const truth = accountTruth();
  const rules = sysvLayout(ACCOUNT_MEMBERS);
  const reordered = sysvLayout([["rate", "double"], ["label", "pointer"], ["balance", "int"], ["code", "short"], ["kind", "char"]]);
  const nativePath = join(FIXTURES, "account-native.run.txt");
  const native = existsSync(nativePath) ? splitlines(readText(nativePath)) : [];
  const ctypes = ctypesLayout();
  const ruleOffsets = rules.members.map((m) => m.offset as number);
  const truthOffsets = truth.members.map((m) => m.offset);
  const ctypesOffsets = ctypes.members.map((m) => m.offset);
  const agree = arraysEqual(ruleOffsets, truthOffsets) && arraysEqual(truthOffsets, ctypesOffsets) && rules.size === truth.size && truth.size === ctypesLayout().size;
  return {
    psabiRules: rules,
    ctypes: ctypesLayout(),
    dwarf: truth.toDict(),
    nativeRun: native,
    agree,
    reordered,
  };
}

export function cxxReport(): { [key: string]: Json } {
  const elf = loadObject("shapes-x86_64-O0-g.o");
  const listing = loadListing("shapes-x86_64-O0-g.objdump.txt");
  const dwarf = new DwarfInfo(elf);
  const vtables = ["_ZTV5Shape", "_ZTV4Rect"].map((name) => readVtable(elf, name));
  const typeinfos = ["_ZTI5Shape", "_ZTI4Rect"].map((name) => readTypeinfo(elf, name));
  const calls = findVirtualCalls(listing, vtables);
  const mangled = elf.symbolNames().filter((n) => n.startsWith("_Z"));
  const structs: Map<string, Json> = new Map();
  const dwarfSlots: Map<string, Json> = new Map();
  for (const s of dwarf.structLayouts()) {
    if (s.name === "Shape" || s.name === "Rect") {
      structs.set(s.name, s.toDict());
    }
  }
  for (const s of dwarf.structLayouts()) {
    if (s.name === "Shape" || s.name === "Rect") {
      const slots: Map<string, Json> = new Map();
      for (const v of s.virtualMethods) {
        slots.set(String(v.slot), v.name);
      }
      dwarfSlots.set(s.name, slots);
    }
  }
  const optimized = loadObject("shapes-x86_64-O1-g.o");
  const optimizedListing = loadListing("shapes-x86_64-O1-g.objdump.txt");
  return {
    mangled: new Map(mangled.map((name) => [name, demangle(name) as Json])),
    vtables: vtables.map((v) => v.toDict()),
    typeinfo: typeinfos.map((t) => t.toDict()),
    virtualCalls: calls.map((c) => c.toDict()),
    dwarfVtableSlots: dwarfSlots,
    dwarfStructs: structs,
    optimizedObjectHasVtable: optimized.symbolNames().some((n) => n.startsWith("_ZTV")),
    optimizedDescribe: (optimizedListing.get("_Z8describeRK5Shapei") ?? []).map((i) => wsJoin(i.text)),
  };
}

export function toolCaptures(): Map<string, Json> {
  const tools = join(FIXTURES, "tools");
  const report: Map<string, Json> = new Map();
  const names = existsSync(tools) ? readdirSync(tools).filter((n) => n.endsWith(".txt")).sort() : [];
  for (const name of names) {
    const text = readText(join(tools, name));
    report.set(name, { lines: splitlines(text).length, mentionsAccountStruct: text.includes("struct account") || text.includes("/DWARF/account.c/account") || text.includes('name = "account"') });
  }
  return report;
}

export function demo(): Json {
  const dwarf = new DwarfInfo(loadObject("account-x86_64-O0-g.o"));
  const builds: Map<string, Json> = new Map();
  for (const build of ACCOUNT_BUILDS.keys()) {
    builds.set(build, analyzeBuild(build));
  }
  return {
    dwarf: {
      unit: dwarf.header().toDict(),
      structs: dwarf.structLayouts().map((s) => s.toDict()),
      functions: dwarf.functions().map((f) => f.toDict()),
    },
    oracles: layoutOracles(),
    builds,
    cxx: cxxReport(),
    tools: toolCaptures(),
  };
}

type Dict = { [key: string]: Json };

export function figureData(): Json {
  const truth = accountTruth();

  const summary = (report: Dict): Dict => {
    const layout = report.layout as Dict;
    const comparison = report.comparison as Dict;
    return {
      fields: (layout.fields as Dict[]).map((f) => ({ o: f.offset, s: f.size, k: f.kind, l: f.label, n: (f.evidence as Json[]).length, p: (f.pointerProof as Json[]).length })),
      stride: layout.stride,
      strideEvidence: (layout.strideEvidence as Dict[]).map((e) => ({ v: e.value, k: e.kind, f: e.function, a: e.address })),
      size: layout.size,
      lowerBound: layout.sizeLowerBound,
      rows: (comparison.rows as Dict[]).map((r) => ({ m: r.member, o: r.offset, t: r.truth, i: r.inferred, s: r.status })),
      sizeStatus: (comparison.size as Dict).status,
      conflicts: (layout.conflicts as Json[]).length,
    };
  };

  const builds: Map<string, Json> = new Map();
  for (const [build, object] of ACCOUNT_BUILDS) {
    const steps: Json[] = [];
    for (let count = 1; count <= EVIDENCE_ORDER.length; count++) {
      const report = analyzeBuild(build, EVIDENCE_ORDER.slice(0, count));
      const raw = analyzeBuild(build, EVIDENCE_ORDER.slice(0, count), false);
      const step: Dict = {
        function: EVIDENCE_ORDER[count - 1],
        accesses: (report.accesses as Dict[]).map((a) => ({ f: a.function, a: a.address, t: a.text, o: a.offset, w: a.width, k: a.kind, r: a.root })),
        callSites: (report.callSites as Dict[]).filter((c) => (c.arguments as Json[])[0]).map((c) => ({ a: c.address, c: c.callee, arg: (c.arguments as Json[])[0] })),
      };
      Object.assign(step, summary(report));
      const rawSummary = summary(raw);
      if (dumps(rawSummary.fields) !== dumps(step.fields)) {
        step.raw = rawSummary;
      }
      steps.push(step);
    }
    builds.set(build, { object: `${object}.o`, steps });
  }
  return {
    struct: truth.name,
    truth: { size: truth.size, align: truth.align, members: truth.members.map((m) => ({ n: m.name, t: m.type, o: m.offset, s: m.size, k: m.kind })), padding: truth.padding() },
    order: [...EVIDENCE_ORDER],
    builds,
  };
}

function quote(text: string): string {
  return JSON.stringify(text).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function dumps(value: Json, indent: number | null = null, separators: [string, string] | null = null, depth = 0): string {
  const [itemSep, keySep] = separators ?? (indent === null ? [", ", ": "] : [",", ": "]);
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return quote(value);
  }
  const items: string[] = [];
  let open = "[";
  let close = "]";
  if (Array.isArray(value)) {
    for (const item of value) {
      items.push(dumps(item, indent, separators, depth + 1));
    }
  } else {
    open = "{";
    close = "}";
    const pairs = value instanceof Map ? [...value.entries()] : Object.entries(value);
    for (const [key, item] of pairs) {
      items.push(quote(key) + keySep + dumps(item, indent, separators, depth + 1));
    }
  }
  if (items.length === 0) {
    return open + close;
  }
  if (indent === null) {
    return open + items.join(itemSep) + close;
  }
  const inner = " ".repeat(indent * (depth + 1));
  const outer = " ".repeat(indent * depth);
  return open + "\n" + items.map((item) => inner + item).join(itemSep + "\n") + "\n" + outer + close;
}

function pyStr(value: number | string | null | boolean): string {
  if (value === null) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}

export function printDwarf(path: string): string {
  const dwarf = new DwarfInfo(new ElfObject(new Uint8Array(readFileSync(path))));
  const lines = [`unit: ${dumps(dwarf.header().toDict())}`];
  for (const layout of dwarf.structLayouts()) {
    lines.push(`struct ${layout.name} size ${layout.size} align ${layout.align}`);
    for (const [base, offset] of layout.bases) {
      lines.push(`  : ${base} at ${offset}`);
    }
    for (const member of layout.members) {
      lines.push(`  +${String(member.offset).padEnd(3)} ${member.type.padEnd(14)} ${member.name} (${member.size} bytes, ${member.kind})`);
    }
    for (const method of layout.virtualMethods) {
      lines.push(`  vtable slot ${method.slot}: ${method.name} [${method.virtuality}]`);
    }
  }
  for (const fn of dwarf.functions()) {
    const params = fn.parameters.map((p) => `${p.type} ${p.name} @ ${p.location}`).join(", ");
    lines.push(`${fn.returnType} ${fn.name}(${params}) at ${hx(fn.lowPc)}-${hx(fn.highPc)}, frame base ${fn.frameBase}`);
  }
  return lines.join("\n");
}

export function printInference(listingPath: string, objectPath: string | null): string {
  const listing = parseListing(readText(listingPath));
  const traces = traceListing(listing);
  const witnesses: [string, string][] = [...listing.keys()].filter((name) => (traces.get(name) as FunctionTrace).accesses.some((a) => a.root === "param0")).map((name) => [name, "param0"]);
  const layout = inferLayout([...traces.values()], witnesses, "struct");
  const lines = [`witnesses: ${witnesses.map(([f]) => f).join(", ")}`];
  for (const entry of layout.fields) {
    lines.push(`  +${String(entry.offset).padEnd(3)} ${entry.label.padEnd(8)} ${entry.evidence.length} accesses` + (entry.pointerProof.length ? " pointer proven" : ""));
  }
  lines.push(`stride ${pyStr(layout.stride)} from [${layout.strideEvidence.map((e) => `(${pyReprStr(e.kind)}, ${e.value})`).join(", ")}]`);
  lines.push(`size ${pyStr(layout.size)} (lower bound ${layout.sizeLowerBound}), gaps [${layout.gaps().join(", ")}], natural alignment ${pyStr(layout.naturalAlignmentOk())}`);
  if (objectPath) {
    const dwarf = new DwarfInfo(new ElfObject(new Uint8Array(readFileSync(objectPath))));
    for (const truth of dwarf.structLayouts()) {
      const comparison = compareLayouts(layout, truth);
      lines.push(`against DWARF ${truth.name}: ${comparison.matches}/${comparison.members} members match, size ${(comparison.size as Dict).status}`);
      for (const row of comparison.rows as Dict[]) {
        lines.push(`  ${String(row.status).padEnd(16)} +${String(row.offset).padEnd(3)} ${String(row.truth).padEnd(14)} ${row.member || ""} <- ${pyStr(row.inferred as string | null)}`);
      }
    }
  }
  return lines.join("\n");
}

export function main(argv: string[]): number {
  if (argv.length === 0) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "dwarf" && argv.length === 2) {
    console.log(printDwarf(argv[1]));
    return 0;
  }
  if (command === "infer" && (argv.length === 2 || argv.length === 3)) {
    console.log(printInference(argv[1], argv.length === 3 ? argv[2] : null));
    return 0;
  }
  if (command === "demangle" && argv.length >= 2) {
    for (const name of argv.slice(1)) {
      console.log(`${name} -> ${demangle(name)}`);
    }
    return 0;
  }
  if (command === "vtable" && argv.length === 2) {
    const elf = new ElfObject(new Uint8Array(readFileSync(argv[1])));
    for (const name of elf.symbolNames()) {
      if (name.startsWith("_ZTV") && elf.symbol(name).type === STT_OBJECT) {
        console.log(dumps(readVtable(elf, name).toDict(), 2));
      }
    }
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData(), null, [",", ":"]));
    return 0;
  }
  console.error("usage: main.py [dwarf FILE.o | infer LISTING.txt [FILE.o] | demangle NAME... | vtable FILE.o | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
