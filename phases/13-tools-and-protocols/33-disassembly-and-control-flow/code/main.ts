// Lesson: Disassembly and Control Flow: From Bytes to a Graph You Can Check (phase 13 / lesson 33)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/33-disassembly-and-control-flow/code/main.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json } | Map<string, Json>;

export const HERE = __dirname;
export const FIXTURES = join(HERE, "fixtures");
export const MAX_INSTRUCTION_LENGTH = 15;

export const SHT_SYMTAB = 2;
export const SHT_STRTAB = 3;
export const SHT_RELA = 4;
export const SHT_NOBITS = 8;
export const STT_SECTION = 3;
export const STT_FUNC = 2;
export const EM_X86_64 = 62;

export const RELOCATION_NAMES: Map<number, string> = new Map([
  [0, "R_X86_64_NONE"],
  [1, "R_X86_64_64"],
  [2, "R_X86_64_PC32"],
  [4, "R_X86_64_PLT32"],
  [10, "R_X86_64_32"],
  [11, "R_X86_64_32S"],
]);
export const PC_RELATIVE_RELOCATIONS = new Set([2, 4]);

function hx(value: number): string {
  return value.toString(16);
}

export class Section {
  constructor(
    readonly index: number,
    readonly name: string,
    readonly type: number,
    readonly flags: number,
    readonly offset: number,
    readonly size: number,
    readonly link: number,
    readonly info: number,
    readonly entsize: number,
    readonly data: Uint8Array,
  ) {}
}

export class Symbol {
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
    readonly symbol: Symbol,
    readonly addend: number,
  ) {}

  get typeName(): string {
    return RELOCATION_NAMES.get(this.type) ?? `R_X86_64_${this.type}`;
  }

  get symbolName(): string {
    if (this.symbol.type === STT_SECTION) {
      return this.symbol.section;
    }
    return this.symbol.name;
  }

  describe(): string {
    if (this.addend === 0) {
      return `${this.typeName} ${this.symbolName}`;
    }
    const sign = this.addend > 0 ? "+" : "-";
    return `${this.typeName} ${this.symbolName}${sign}0x${hx(Math.abs(this.addend))}`;
  }
}

export class ElfError extends Error {}

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function u64(dv: DataView, offset: number): number {
  return Number(dv.getBigUint64(offset, true));
}

function i64(dv: DataView, offset: number): number {
  return Number(dv.getBigInt64(offset, true));
}

export class ElfObject {
  readonly machine: number;
  readonly sections: Section[];
  readonly symbols: Symbol[];
  readonly relocations: Map<string, Relocation[]>;

  constructor(data: Uint8Array) {
    if (!(data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46)) {
      throw new ElfError("not an ELF file");
    }
    if (data[4] !== 2 || data[5] !== 1) {
      throw new ElfError("only ELF64 little-endian objects are supported");
    }
    const dv = view(data);
    this.machine = dv.getUint16(18, true);
    if (this.machine !== EM_X86_64) {
      throw new ElfError(`e_machine ${this.machine} is not x86-64`);
    }
    const shoff = u64(dv, 40);
    const shentsize = dv.getUint16(58, true);
    const shnum = dv.getUint16(60, true);
    const shstrndx = dv.getUint16(62, true);
    const rawHeaders: number[][] = [];
    for (let index = 0; index < shnum; index++) {
      const base = shoff + index * shentsize;
      rawHeaders.push([
        dv.getUint32(base, true),
        dv.getUint32(base + 4, true),
        u64(dv, base + 8),
        u64(dv, base + 16),
        u64(dv, base + 24),
        u64(dv, base + 32),
        dv.getUint32(base + 40, true),
        dv.getUint32(base + 44, true),
        u64(dv, base + 48),
        u64(dv, base + 56),
      ]);
    }
    const names = rawHeaders[shstrndx];
    const nameTable = data.subarray(names[4], names[4] + names[5]);
    this.sections = [];
    rawHeaders.forEach((raw, index) => {
      const [shName, shType, shFlags, , shOffset, shSize, shLink, shInfo, , shEntsize] = raw;
      const payload = shType === SHT_NOBITS ? new Uint8Array(0) : data.subarray(shOffset, shOffset + shSize);
      this.sections.push(new Section(index, cstring(nameTable, shName), shType, shFlags, shOffset, shSize, shLink, shInfo, shEntsize, payload));
    });
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  private readSymbols(): Symbol[] {
    const symbols: Symbol[] = [];
    for (const section of this.sections) {
      if (section.type !== SHT_SYMTAB) {
        continue;
      }
      const strings = this.sections[section.link].data;
      const dv = view(section.data);
      for (let offset = 0; offset < section.size; offset += 24) {
        const stName = dv.getUint32(offset, true);
        const stInfo = dv.getUint8(offset + 4);
        const stShndx = dv.getUint16(offset + 6, true);
        const stValue = u64(dv, offset + 8);
        const stSize = u64(dv, offset + 16);
        const sectionName = stShndx < this.sections.length ? this.sections[stShndx].name : "";
        symbols.push(new Symbol(cstring(strings, stName), stValue, stSize, stInfo & 0xf, stInfo >> 4, stShndx, sectionName));
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
      const dv = view(section.data);
      for (let offset = 0; offset < section.size; offset += 24) {
        const rOffset = u64(dv, offset);
        const rInfo = dv.getBigUint64(offset + 8, true);
        const rAddend = i64(dv, offset + 16);
        const symbol = this.symbols[Number(rInfo >> 32n)];
        if (!table.has(target)) {
          table.set(target, []);
        }
        table.get(target)!.push(new Relocation(target, rOffset, Number(rInfo & 0xffffffffn), symbol, rAddend));
      }
    }
    return table;
  }

  section(name: string): Section {
    for (const section of this.sections) {
      if (section.name === name) {
        return section;
      }
    }
    throw new ElfError(`no section named ${name}`);
  }

  functions(section = ".text"): Symbol[] {
    const found = this.symbols.filter((s) => s.type === STT_FUNC && s.section === section);
    return found.sort((a, b) => a.value - b.value);
  }

  relocationAt(section: string, offset: number): Relocation | null {
    for (const relocation of this.relocations.get(section) ?? []) {
      if (relocation.offset === offset) {
        return relocation;
      }
    }
    return null;
  }

  symbolize(address: number, section = ".text"): string {
    let best: Symbol | null = null;
    for (const symbol of this.functions(section)) {
      if (symbol.value <= address && (best === null || symbol.value >= best.value)) {
        best = symbol;
      }
    }
    if (best === null) {
      return `${section}+0x${hx(address)}`;
    }
    const delta = address - best.value;
    return delta === 0 ? best.name : `${best.name}+0x${hx(delta)}`;
  }

  functionExtent(name: string, section = ".text"): [number, number, number] {
    const functions = this.functions(section);
    for (let position = 0; position < functions.length; position++) {
      const symbol = functions[position];
      if (symbol.name === name) {
        const following = position + 1 < functions.length ? functions[position + 1].value : this.section(section).size;
        return [symbol.value, symbol.value + symbol.size, following];
      }
    }
    throw new ElfError(`no function symbol named ${name}`);
  }
}

function cstring(table: Uint8Array, offset: number): string {
  let end = table.indexOf(0, offset);
  if (end < 0) {
    end = table.length;
  }
  let text = "";
  for (const byte of table.subarray(offset, end)) {
    text += byte < 0x80 ? String.fromCharCode(byte) : "\ufffd";
  }
  return text;
}

export function loadFixture(name: string): ElfObject {
  return new ElfObject(readFileSync(join(FIXTURES, name)));
}

export const LEGACY_PREFIXES = new Set([0xf0, 0xf2, 0xf3, 0x2e, 0x36, 0x3e, 0x26, 0x64, 0x65, 0x66, 0x67]);
export const SEGMENT_PREFIXES: Map<number, string> = new Map([
  [0x2e, "cs"],
  [0x36, "ss"],
  [0x3e, "ds"],
  [0x26, "es"],
  [0x64, "fs"],
  [0x65, "gs"],
]);
export const REGISTERS: Record<number, string[]> = {
  64: ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"],
  32: ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d"],
  16: ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", "r8w", "r9w", "r10w", "r11w", "r12w", "r13w", "r14w", "r15w"],
  8: ["al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil", "r8b", "r9b", "r10b", "r11b", "r12b", "r13b", "r14b", "r15b"],
};
export const LEGACY_BYTE_REGISTERS = ["al", "cl", "dl", "bl", "ah", "ch", "dh", "bh"];
export const SUFFIX: Record<number, string> = { 8: "b", 16: "w", 32: "l", 64: "q" };
export const CONDITIONS = ["o", "no", "b", "ae", "e", "ne", "be", "a", "s", "ns", "p", "np", "l", "ge", "le", "g"];
export const GROUP1 = ["add", "or", "adc", "sbb", "and", "sub", "xor", "cmp"];
export const GROUP2 = ["rol", "ror", "rcl", "rcr", "shl", "shr", "shl", "sar"];
export const GROUP3 = ["test", "test", "not", "neg", "mul", "imul", "div", "idiv"];
export const ALU_RM_R: Map<number, string> = new Map([
  [0x01, "add"], [0x09, "or"], [0x11, "adc"], [0x19, "sbb"], [0x21, "and"], [0x29, "sub"], [0x31, "xor"], [0x39, "cmp"], [0x85, "test"], [0x89, "mov"],
]);
export const ALU_R_RM: Map<number, string> = new Map([
  [0x03, "add"], [0x0b, "or"], [0x13, "adc"], [0x1b, "sbb"], [0x23, "and"], [0x2b, "sub"], [0x33, "xor"], [0x3b, "cmp"], [0x8b, "mov"],
]);
export const ALU_ACC_IMM: Map<number, string> = new Map([
  [0x05, "add"], [0x0d, "or"], [0x15, "adc"], [0x1d, "sbb"], [0x25, "and"], [0x2d, "sub"], [0x35, "xor"], [0x3d, "cmp"],
]);
export const SSE_XMM_XMMM: Map<string, string> = new Map([
  ["102,239", "pxor"],
  ["102,254", "paddd"],
  ["102,250", "psubd"],
  ["102,219", "pand"],
  ["102,235", "por"],
  ["102,111", "movdqa"],
  ["243,111", "movdqu"],
]);

export class DecodeError extends Error {
  constructor(readonly address: number, readonly reason: string) {
    super(`0x${hx(address)}: ${reason}`);
  }
}

export class Memory {
  constructor(
    readonly base: string | null,
    readonly index: string | null,
    readonly scale: number,
    readonly displacement: number,
    readonly ripRelative: boolean,
    readonly segment: string | null,
  ) {}

  render(): string {
    let inner: string;
    if (this.ripRelative) {
      inner = "(%rip)";
    } else if (this.base === null && this.index === null) {
      inner = "";
    } else {
      const parts = [this.base ? "%" + this.base : ""];
      if (this.index) {
        parts.push("%" + this.index);
        if (this.scale !== 1) {
          parts.push(String(this.scale));
        }
      }
      inner = "(" + parts.join(",") + ")";
    }
    const showDisplacement = this.displacement !== 0 || (this.base === null && !this.ripRelative);
    const text = (showDisplacement ? formatSigned(this.displacement) : "") + inner;
    return this.segment ? `%${this.segment}:${text}` : text;
  }
}

export interface InstructionFields {
  target?: number | null;
  memory?: Memory | null;
  displacementOffset?: number | null;
  immediateOffset?: number | null;
  prefixes?: number[];
  rex?: number | null;
  opcode?: number[];
  modrm?: number | null;
}

export class Instruction {
  readonly target: number | null;
  readonly memory: Memory | null;
  readonly displacementOffset: number | null;
  readonly immediateOffset: number | null;
  readonly prefixes: number[];
  readonly rex: number | null;
  readonly opcode: number[];
  readonly modrm: number | null;

  constructor(
    readonly address: number,
    readonly raw: Uint8Array,
    readonly mnemonic: string,
    readonly operands: string[],
    readonly flow: string,
    fields: InstructionFields = {},
  ) {
    this.target = fields.target ?? null;
    this.memory = fields.memory ?? null;
    this.displacementOffset = fields.displacementOffset ?? null;
    this.immediateOffset = fields.immediateOffset ?? null;
    this.prefixes = fields.prefixes ?? [];
    this.rex = fields.rex ?? null;
    this.opcode = fields.opcode ?? [];
    this.modrm = fields.modrm ?? null;
  }

  get length(): number {
    return this.raw.length;
  }

  get end(): number {
    return this.address + this.length;
  }

  get text(): string {
    return this.mnemonic + (this.operands.length ? "\t" + this.operands.join(", ") : "");
  }

  get hex(): string {
    return Array.from(this.raw, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
  }

  covers(address: number): boolean {
    return this.address <= address && address < this.end;
  }
}

export function formatSigned(value: number | bigint): string {
  const big = BigInt(value);
  return big < 0n ? `-0x${(-big).toString(16)}` : `0x${big.toString(16)}`;
}

export function formatImmediate(value: number | bigint): string {
  return "$" + formatSigned(value);
}

class Cursor {
  position: number;

  constructor(readonly code: Uint8Array, readonly start: number) {
    this.position = start;
  }

  byte(): number {
    if (this.position >= this.code.length) {
      throw new DecodeError(this.start, "instruction runs past the end of the section");
    }
    if (this.position - this.start >= MAX_INSTRUCTION_LENGTH) {
      throw new DecodeError(this.start, "instruction longer than 15 bytes");
    }
    const value = this.code[this.position];
    this.position += 1;
    return value;
  }

  peek(): number | null {
    return this.position < this.code.length ? this.code[this.position] : null;
  }

  integer(size: number, signed: boolean): bigint {
    let value = 0n;
    for (let index = 0; index < size; index++) {
      value |= BigInt(this.byte()) << BigInt(8 * index);
    }
    return signed ? BigInt.asIntN(8 * size, value) : value;
  }
}

type Size = number | "xmm";

export class Decoder {
  decode(code: Uint8Array, address: number): Instruction {
    if (address >= code.length) {
      throw new DecodeError(address, "address is past the end of the section");
    }
    const cursor = new Cursor(code, address);
    const prefixes: number[] = [];
    while (LEGACY_PREFIXES.has(cursor.peek() ?? -1)) {
      prefixes.push(cursor.byte());
    }
    let rex: number | null = null;
    const next = cursor.peek();
    if (next !== null && 0x40 <= next && next <= 0x4f) {
      rex = cursor.byte();
    }
    const state = new State(cursor, prefixes, rex);
    const opcode = cursor.byte();
    if (opcode === 0x0f) {
      return this.twoByte(state, cursor.byte());
    }
    return this.oneByte(state, opcode);
  }

  private oneByte(state: State, opcode: number): Instruction {
    const size = state.operandSize();
    const aluRmR = ALU_RM_R.get(opcode);
    if (aluRmR !== undefined) {
      const [reg, rm] = state.modrm(size, size);
      return state.finish(aluRmR + SUFFIX[size], [reg, rm]);
    }
    const aluRRm = ALU_R_RM.get(opcode);
    if (aluRRm !== undefined) {
      const [reg, rm] = state.modrm(size, size);
      return state.finish(aluRRm + SUFFIX[size], [rm, reg]);
    }
    const aluAcc = ALU_ACC_IMM.get(opcode);
    if (aluAcc !== undefined) {
      const immediate = state.readImmediate(fullImmediateSize(size));
      return state.finish(aluAcc + SUFFIX[size], [formatImmediate(immediate), "%" + REGISTERS[size][0]]);
    }
    if (0x50 <= opcode && opcode <= 0x57) {
      return state.finish("pushq", ["%" + REGISTERS[64][(opcode & 7) | state.rexB()]]);
    }
    if (0x58 <= opcode && opcode <= 0x5f) {
      return state.finish("popq", ["%" + REGISTERS[64][(opcode & 7) | state.rexB()]]);
    }
    if (opcode === 0x63) {
      if (size !== 64) {
        throw new DecodeError(state.cursor.start, "opcode 63 without REX.W is not in the subset");
      }
      const [reg, rm] = state.modrm(64, 32);
      return state.finish("movslq", [rm, reg]);
    }
    if (opcode === 0x69 || opcode === 0x6b) {
      const [reg, rm] = state.modrm(size, size);
      const immediate = state.readImmediate(opcode === 0x6b ? 1 : fullImmediateSize(size));
      return state.finish("imul" + SUFFIX[size], [formatImmediate(immediate), rm, reg]);
    }
    if (0x70 <= opcode && opcode <= 0x7f) {
      return state.branch("j" + CONDITIONS[opcode & 0xf], 1, "branch");
    }
    if (opcode === 0x81 || opcode === 0x83) {
      const [digit, rm] = state.modrmGroup(size);
      const immediate = state.readImmediate(opcode === 0x83 ? 1 : fullImmediateSize(size));
      return state.finish(GROUP1[digit] + SUFFIX[size], [formatImmediate(immediate), rm]);
    }
    if (opcode === 0x8d) {
      const [reg, rm] = state.modrm(size, size);
      if (state.memory === null) {
        throw new DecodeError(state.cursor.start, "lea needs a memory operand");
      }
      return state.finish("lea" + SUFFIX[size], [rm, reg]);
    }
    if (opcode === 0x90) {
      return state.finish("nop", []);
    }
    if (opcode === 0x99) {
      const names: Record<number, string> = { 16: "cwtd", 32: "cltd", 64: "cqto" };
      return state.finish(names[size], []);
    }
    if (0xb8 <= opcode && opcode <= 0xbf) {
      const register = "%" + REGISTERS[size][(opcode & 7) | state.rexB()];
      if (size === 64) {
        return state.finish("movabsq", [formatImmediate(state.readImmediate(8)), register]);
      }
      return state.finish("mov" + SUFFIX[size], [formatImmediate(state.readImmediate(fullImmediateSize(size))), register]);
    }
    if (opcode === 0xc1) {
      const [digit, rm] = state.modrmGroup(size);
      return state.finish(GROUP2[digit] + SUFFIX[size], [formatImmediate(state.readImmediate(1, false)), rm]);
    }
    if (opcode === 0xc3) {
      return state.finish("retq", [], "return");
    }
    if (opcode === 0xc7) {
      const [digit, rm] = state.modrmGroup(size);
      if (digit !== 0) {
        throw new DecodeError(state.cursor.start, `opcode C7 /${digit} is not mov`);
      }
      return state.finish("mov" + SUFFIX[size], [formatImmediate(state.readImmediate(fullImmediateSize(size))), rm]);
    }
    if (opcode === 0xcc) {
      return state.finish("int3", []);
    }
    if (opcode === 0xe8) {
      return state.branch("callq", 4, "call");
    }
    if (opcode === 0xe9) {
      return state.branch("jmp", 4, "jump");
    }
    if (opcode === 0xeb) {
      return state.branch("jmp", 1, "jump");
    }
    if (opcode === 0xf4) {
      return state.finish("hlt", []);
    }
    if (opcode === 0xf7) {
      const [digit, rm] = state.modrmGroup(size);
      if (digit === 0 || digit === 1) {
        return state.finish("test" + SUFFIX[size], [formatImmediate(state.readImmediate(fullImmediateSize(size))), rm]);
      }
      return state.finish(GROUP3[digit] + SUFFIX[size], [rm]);
    }
    if (opcode === 0xff) {
      const [digit, rm] = state.modrmGroup(size);
      if (digit === 0) {
        return state.finish("inc" + SUFFIX[size], [rm]);
      }
      if (digit === 1) {
        return state.finish("dec" + SUFFIX[size], [rm]);
      }
      if (digit === 2 || digit === 4 || digit === 6) {
        const [, rm64] = state.modrmGroup(64, true);
        if (digit === 6) {
          return state.finish("pushq", [rm64]);
        }
        if (digit === 2) {
          return state.finish("callq", ["*" + rm64], "indirect-call");
        }
        return state.finish("jmpq", ["*" + rm64], "indirect-jump");
      }
      throw new DecodeError(state.cursor.start, `opcode FF /${digit} is not in the subset`);
    }
    throw new DecodeError(state.cursor.start, `opcode ${opcode.toString(16).padStart(2, "0")} is not in the subset`);
  }

  private twoByte(state: State, opcode: number): Instruction {
    const mandatory = state.mandatoryPrefix();
    const sse = SSE_XMM_XMMM.get(`${mandatory},${opcode}`);
    if (sse !== undefined) {
      state.consumeMandatory();
      const [reg, rm] = state.modrm("xmm", "xmm");
      return state.finish(sse, [rm, reg]);
    }
    if (mandatory === 0x66 && opcode === 0x70) {
      state.consumeMandatory();
      const [reg, rm] = state.modrm("xmm", "xmm");
      return state.finish("pshufd", [formatImmediate(state.readImmediate(1, false)), rm, reg]);
    }
    if (mandatory === 0x66 && (opcode === 0x6e || opcode === 0x7e)) {
      state.consumeMandatory();
      const [reg, rm] = state.modrm("xmm", state.rexW() ? 64 : 32);
      const operands = opcode === 0x7e ? [reg, rm] : [rm, reg];
      return state.finish(state.rexW() ? "movq" : "movd", operands);
    }
    const size = state.operandSize();
    if (opcode === 0x0b) {
      return state.finish("ud2", []);
    }
    if (opcode === 0x1f) {
      const [, rm] = state.modrmGroup(size);
      return state.finish("nop" + SUFFIX[size], [rm]);
    }
    if (0x80 <= opcode && opcode <= 0x8f) {
      return state.branch("j" + CONDITIONS[opcode & 0xf], 4, "branch");
    }
    if (0x90 <= opcode && opcode <= 0x9f) {
      const [, rm] = state.modrmGroup(8);
      return state.finish("set" + CONDITIONS[opcode & 0xf], [rm]);
    }
    if (0x40 <= opcode && opcode <= 0x4f) {
      const [reg, rm] = state.modrm(size, size);
      return state.finish("cmov" + CONDITIONS[opcode & 0xf] + SUFFIX[size], [rm, reg]);
    }
    if (opcode === 0xaf) {
      const [reg, rm] = state.modrm(size, size);
      return state.finish("imul" + SUFFIX[size], [rm, reg]);
    }
    if (opcode === 0xb6 || opcode === 0xb7 || opcode === 0xbe || opcode === 0xbf) {
      const source = opcode === 0xb6 || opcode === 0xbe ? 8 : 16;
      const [reg, rm] = state.modrm(size, source);
      const kind = opcode === 0xb6 || opcode === 0xb7 ? "movz" : "movs";
      return state.finish(kind + SUFFIX[source] + SUFFIX[size], [rm, reg]);
    }
    throw new DecodeError(state.cursor.start, `opcode 0f ${opcode.toString(16).padStart(2, "0")} is not in the subset`);
  }
}

function fullImmediateSize(operandSize: number): number {
  return operandSize === 16 ? 2 : 4;
}

class State {
  memory: Memory | null = null;
  modrmByte: number | null = null;
  displacementOffset: number | null = null;
  immediateOffset: number | null = null;
  readonly opcodeStart: number;
  private mandatoryConsumed = false;

  constructor(readonly cursor: Cursor, readonly prefixes: number[], readonly rex: number | null) {
    this.opcodeStart = cursor.position;
  }

  rexW(): boolean {
    return Boolean(this.rex && this.rex & 0x8);
  }

  rexR(): number {
    return this.rex && this.rex & 0x4 ? 8 : 0;
  }

  rexX(): number {
    return this.rex && this.rex & 0x2 ? 8 : 0;
  }

  rexB(): number {
    return this.rex && this.rex & 0x1 ? 8 : 0;
  }

  operandSize(): number {
    if (this.rexW()) {
      return 64;
    }
    if (this.prefixes.includes(0x66) && !this.mandatoryConsumed) {
      return 16;
    }
    return 32;
  }

  mandatoryPrefix(): number | null {
    for (const candidate of [0xf2, 0xf3]) {
      if (this.prefixes.includes(candidate)) {
        return candidate;
      }
    }
    return this.prefixes.includes(0x66) ? 0x66 : null;
  }

  consumeMandatory(): void {
    this.mandatoryConsumed = true;
  }

  segment(): string | null {
    for (const prefix of this.prefixes) {
      const name = SEGMENT_PREFIXES.get(prefix);
      if (name !== undefined) {
        return name;
      }
    }
    return null;
  }

  readImmediate(size: number, signed = true): bigint {
    this.immediateOffset = this.cursor.position - this.cursor.start;
    return this.cursor.integer(size, signed);
  }

  readDisplacement(size: number): number {
    this.displacementOffset = this.cursor.position - this.cursor.start;
    return Number(this.cursor.integer(size, true));
  }

  registerName(size: Size, number: number): string {
    if (size === "xmm") {
      return `%xmm${number}`;
    }
    if (size === 8 && this.rex === null && number < 8) {
      return "%" + LEGACY_BYTE_REGISTERS[number];
    }
    return "%" + REGISTERS[size][number];
  }

  modrm(regSize: Size, rmSize: Size): [string, string] {
    const modrm = this.cursor.byte();
    this.modrmByte = modrm;
    const mod = modrm >> 6;
    const reg = (modrm >> 3) & 7;
    const rm = modrm & 7;
    const regText = this.registerName(regSize, reg | this.rexR());
    if (mod === 3) {
      return [regText, this.registerName(rmSize, rm | this.rexB())];
    }
    let base: string | null = null;
    let index: string | null = null;
    let scale = 1;
    let ripRelative = false;
    let displacement = 0;
    if (rm === 4) {
      const sib = this.cursor.byte();
      scale = 1 << (sib >> 6);
      const indexNumber = ((sib >> 3) & 7) | this.rexX();
      const baseNumber = (sib & 7) | this.rexB();
      if (indexNumber !== 4) {
        index = REGISTERS[64][indexNumber];
      }
      if ((sib & 7) === 5 && mod === 0) {
        displacement = this.readDisplacement(4);
      } else {
        base = REGISTERS[64][baseNumber];
      }
    } else if (rm === 5 && mod === 0) {
      ripRelative = true;
      displacement = this.readDisplacement(4);
    } else {
      base = REGISTERS[64][rm | this.rexB()];
    }
    if (mod === 1) {
      displacement = this.readDisplacement(1);
    } else if (mod === 2) {
      displacement = this.readDisplacement(4);
    }
    this.memory = new Memory(base, index, scale, displacement, ripRelative, this.segment());
    return [regText, this.memory.render()];
  }

  modrmGroup(rmSize: Size, reuse = false): [number, string] {
    if (!reuse || this.modrmByte === null) {
      this.modrm(rmSize, rmSize);
    }
    const modrmByte = this.modrmByte!;
    const digit = (modrmByte >> 3) & 7;
    if (modrmByte >> 6 === 3) {
      return [digit, this.registerName(rmSize, (modrmByte & 7) | this.rexB())];
    }
    return [digit, this.memory!.render()];
  }

  branch(mnemonic: string, size: number, flow: string): Instruction {
    const offset = this.readImmediate(size);
    const target = Number(BigInt.asUintN(64, BigInt(this.cursor.position) + offset));
    return this.finish(mnemonic, [`0x${hx(target)}`], flow, target);
  }

  finish(mnemonic: string, operands: string[], flow = "next", target: number | null = null): Instruction {
    const raw = this.cursor.code.slice(this.cursor.start, this.cursor.position);
    const first = this.opcodeStart - this.cursor.start;
    const opcode = Array.from(raw.subarray(first, first + (raw[first] === 0x0f ? 2 : 1)));
    return new Instruction(this.cursor.start, raw, mnemonic, operands, flow, {
      target,
      memory: this.memory,
      displacementOffset: this.displacementOffset,
      immediateOffset: this.immediateOffset,
      prefixes: this.prefixes,
      rex: this.rex,
      opcode,
      modrm: this.modrmByte,
    });
  }
}

export const DECODER = new Decoder();

export function decode(code: Uint8Array, address: number): Instruction {
  return DECODER.decode(code, address);
}

export function listingLine(instruction: Instruction, elf: ElfObject | null = null): string {
  let text = instruction.text;
  if (instruction.target !== null && elf !== null) {
    text += ` <${elf.symbolize(instruction.target)}>`;
  }
  return `${hx(instruction.address).padStart(8, " ")}: ${instruction.hex.padEnd(30, " ")}\t${text}`;
}

export class Reference {
  constructor(
    readonly instruction: number,
    readonly relocation: Relocation,
    readonly section: string,
    readonly offset: number,
    readonly field: string,
  ) {}

  describe(): string {
    return `${this.section}+0x${hx(this.offset)}`;
  }
}

function symbolBase(symbol: Symbol): number {
  return symbol.type === STT_SECTION ? 0 : symbol.value;
}

export function resolveReference(elf: ElfObject, instruction: Instruction, section = ".text"): Reference | null {
  const fields: [string, number | null][] = [
    ["displacement", instruction.displacementOffset],
    ["immediate", instruction.immediateOffset],
  ];
  for (const [fieldName, fieldOffset] of fields) {
    if (fieldOffset === null) {
      continue;
    }
    const relocation = elf.relocationAt(section, instruction.address + fieldOffset);
    if (relocation === null) {
      continue;
    }
    const base = symbolBase(relocation.symbol);
    let offset: number;
    if (PC_RELATIVE_RELOCATIONS.has(relocation.type)) {
      offset = base + relocation.addend + (instruction.end - (instruction.address + fieldOffset));
    } else {
      offset = base + relocation.addend;
    }
    return new Reference(instruction.address, relocation, relocation.symbol.section, offset, fieldName);
  }
  return null;
}

export class SweepResult {
  constructor(readonly instructions: Instruction[], readonly undecodable: [number, number][]) {}

  at(address: number): Instruction | null {
    for (const instruction of this.instructions) {
      if (instruction.address === address) {
        return instruction;
      }
    }
    return null;
  }

  covering(address: number): Instruction | null {
    for (const instruction of this.instructions) {
      if (instruction.covers(address)) {
        return instruction;
      }
    }
    return null;
  }
}

export function linearSweep(code: Uint8Array, start = 0, end: number | null = null): SweepResult {
  const stop = end === null ? code.length : end;
  const instructions: Instruction[] = [];
  const undecodable: [number, number][] = [];
  const window = code.subarray(0, stop);
  let position = start;
  while (position < stop) {
    let instruction: Instruction;
    try {
      instruction = decode(window, position);
    } catch (error) {
      if (!(error instanceof DecodeError)) {
        throw error;
      }
      undecodable.push([position, code[position]]);
      position += 1;
      continue;
    }
    instructions.push(instruction);
    position = instruction.end;
  }
  return new SweepResult(instructions, undecodable);
}

function sortedNumbers(values: Iterable<number>): number[] {
  return Array.from(values).sort((a, b) => a - b);
}

export class DescentResult {
  constructor(
    readonly instructions: Map<number, Instruction>,
    readonly order: number[],
    readonly unresolved: Instruction[],
    readonly conflicts: [number, number][],
    readonly calls: [number, number | null][],
    readonly resolvedTables: Map<number, JumpTable>,
  ) {}

  sortedInstructions(): Instruction[] {
    return sortedNumbers(this.instructions.keys()).map((address) => this.instructions.get(address)!);
  }

  claimedBytes(): Set<number> {
    const claimed: Set<number> = new Set();
    for (const instruction of this.instructions.values()) {
      for (let address = instruction.address; address < instruction.end; address++) {
        claimed.add(address);
      }
    }
    return claimed;
  }
}

export type Resolver = (jump: Instruction, decoded: Map<number, Instruction>) => JumpTable | null;

export function recursiveDescent(code: Uint8Array, entries: number[], end: number | null = null, resolver: Resolver | null = null): DescentResult {
  const stop = end === null ? code.length : end;
  const window = code.subarray(0, stop);
  const instructions: Map<number, Instruction> = new Map();
  const order: number[] = [];
  const unresolved: Instruction[] = [];
  const conflicts: [number, number][] = [];
  const calls: [number, number | null][] = [];
  const tables: Map<number, JumpTable> = new Map();
  const worklist = [...entries].reverse();
  while (worklist.length) {
    let address = worklist.pop()!;
    while (address < stop && !instructions.has(address)) {
      let inside: Instruction | null = null;
      for (const candidate of instructions.values()) {
        if (candidate.covers(address)) {
          inside = candidate;
          break;
        }
      }
      if (inside !== null) {
        conflicts.push([address, inside.address]);
        break;
      }
      let instruction: Instruction;
      try {
        instruction = decode(window, address);
      } catch (error) {
        if (!(error instanceof DecodeError)) {
          throw error;
        }
        unresolved.push(new Instruction(address, code.slice(address, address + 1), "(undecodable)", [], "stop"));
        break;
      }
      instructions.set(address, instruction);
      order.push(address);
      if (instruction.flow === "return") {
        break;
      }
      if (instruction.flow === "jump") {
        address = instruction.target !== null ? instruction.target : stop;
        continue;
      }
      if (instruction.flow === "branch") {
        worklist.push(instruction.target !== null ? instruction.target : stop);
        address = instruction.end;
        continue;
      }
      if (instruction.flow === "call") {
        calls.push([instruction.address, instruction.target]);
        address = instruction.end;
        continue;
      }
      if (instruction.flow === "indirect-jump") {
        const table = resolver ? resolver(instruction, instructions) : null;
        if (table === null) {
          unresolved.push(instruction);
          break;
        }
        tables.set(instruction.address, table);
        worklist.push(...sortedNumbers(new Set(table.targets)).reverse());
        break;
      }
      if (instruction.flow === "indirect-call") {
        calls.push([instruction.address, null]);
      }
      address = instruction.end;
    }
  }
  return new DescentResult(instructions, order, unresolved, conflicts, calls, tables);
}

export class JumpTable {
  constructor(
    readonly section: string,
    readonly offset: number,
    readonly entrySize: number,
    readonly count: number,
    readonly targets: number[],
    readonly evidence: string,
    readonly boundsInstruction: number | null,
    readonly leaInstruction: number,
    readonly loadInstruction: number,
    readonly jumpInstruction: number | null,
  ) {}

  get isJumpTable(): boolean {
    return this.jumpInstruction !== null;
  }

  toDict(): { [key: string]: Json } {
    return {
      kind: this.isJumpTable ? "jump-table" : "value-table",
      table: `${this.section}+0x${hx(this.offset)}`,
      entrySize: this.entrySize,
      count: this.count,
      entries: this.isJumpTable ? this.targets.map((value) => `0x${hx(value)}`) : [...this.targets],
      evidence: this.evidence,
      boundsCheck: this.boundsInstruction === null ? null : `0x${hx(this.boundsInstruction)}`,
      lea: `0x${hx(this.leaInstruction)}`,
      load: `0x${hx(this.loadInstruction)}`,
      jump: this.jumpInstruction === null ? null : `0x${hx(this.jumpInstruction)}`,
    };
  }
}

function registerOf(operand: string): string | null {
  return operand.startsWith("%") ? operand.slice(1) : null;
}

function parseHexInt(text: string): number {
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const digits = body.toLowerCase().startsWith("0x") ? body.slice(2) : body;
  const value = parseInt(digits, 16);
  return negative ? -value : value;
}

function boundsCount(instructions: Instruction[], before: number): [number | null, number | null] {
  const earlier = instructions.filter((i) => i.address < before);
  for (let position = earlier.length - 1; position > 0; position--) {
    if (earlier[position].mnemonic === "ja" && ["cmpl", "subl", "cmpq", "subq"].includes(earlier[position - 1].mnemonic)) {
      const immediate = earlier[position - 1].operands[0];
      if (immediate.startsWith("$")) {
        return [parseHexInt(immediate.slice(1)), earlier[position - 1].address];
      }
    }
  }
  return [null, null];
}

function readLittle(raw: Uint8Array, signed: boolean): number {
  let value = 0n;
  raw.forEach((byte, index) => {
    value |= BigInt(byte) << BigInt(8 * index);
  });
  return Number(signed ? BigInt.asIntN(8 * raw.length, value) : value);
}

export function recoverTable(elf: ElfObject, instructions: Instruction[], load: Instruction, jump: Instruction | null, section = ".text"): JumpTable | null {
  if (load.memory === null || load.memory.base === null || load.memory.index === null) {
    return null;
  }
  const base = load.memory.base;
  let lea: Instruction | null = null;
  for (const candidate of instructions.filter((i) => i.address < load.address).reverse()) {
    if (candidate.mnemonic === "leaq" && candidate.memory && candidate.memory.ripRelative && registerOf(candidate.operands[1]) === base) {
      lea = candidate;
      break;
    }
    if (candidate.operands.length && registerOf(candidate.operands[candidate.operands.length - 1]) === base) {
      return null;
    }
  }
  if (lea === null) {
    return null;
  }
  const reference = resolveReference(elf, lea, section);
  if (reference === null) {
    return null;
  }
  const [limit, boundsAddress] = boundsCount(instructions, load.address);
  const count = limit !== null ? limit + 1 : 0;
  const entrySize = load.memory.scale;
  const tableSection = elf.section(reference.section);
  const entries: number[] = [];
  let evidence = "bytes";
  for (let index = 0; index < count; index++) {
    const entryOffset = reference.offset + index * entrySize;
    const relocation = elf.relocationAt(reference.section, entryOffset);
    if (relocation !== null && PC_RELATIVE_RELOCATIONS.has(relocation.type)) {
      entries.push(symbolBase(relocation.symbol) + relocation.addend + (reference.offset - entryOffset));
      evidence = "relocation";
    } else {
      const raw = tableSection.data.subarray(Math.max(0, entryOffset), Math.max(0, entryOffset + entrySize));
      if (raw.length < entrySize) {
        return null;
      }
      const value = readLittle(raw, jump !== null);
      entries.push(jump !== null ? reference.offset + value : value);
    }
  }
  return new JumpTable(reference.section, reference.offset, entrySize, count, entries, evidence, boundsAddress, lea.address, load.address, jump === null ? null : jump.address);
}

export function jumpTableResolver(elf: ElfObject, section = ".text"): Resolver {
  return (jump, decoded) => {
    const register = jump.operands.length && jump.operands[0].startsWith("*") ? registerOf(jump.operands[0].slice(1)) : null;
    if (register === null) {
      return null;
    }
    const instructions = sortedNumbers(decoded.keys())
      .filter((a) => a < jump.address)
      .map((a) => decoded.get(a)!);
    const reversed = [...instructions].reverse();
    const add = reversed.find((i) => i.mnemonic === "addq" && registerOf(i.operands[1]) === register);
    if (add === undefined) {
      return null;
    }
    const base = registerOf(add.operands[0]);
    const load = reversed.find(
      (i) => i.address < add.address && i.mnemonic === "movslq" && registerOf(i.operands[1]) === register && i.memory !== null && i.memory.base === base,
    );
    if (load === undefined) {
      return null;
    }
    return recoverTable(elf, instructions, load, jump, section);
  };
}

export function findValueTables(elf: ElfObject, instructions: Instruction[], section = ".text"): JumpTable[] {
  const tables: JumpTable[] = [];
  for (const instruction of instructions) {
    if (!["movl", "movq", "movslq", "movzbl"].includes(instruction.mnemonic) || instruction.memory === null) {
      continue;
    }
    if (instruction.memory.base === null || instruction.memory.index === null) {
      continue;
    }
    const following = instructions.filter((i) => i.address > instruction.address).slice(0, 3);
    if (following.some((i) => i.flow === "indirect-jump")) {
      continue;
    }
    const table = recoverTable(elf, instructions, instruction, null, section);
    if (table !== null) {
      tables.push(table);
    }
  }
  return tables;
}

export class Block {
  successors: [number, string][] = [];

  constructor(readonly start: number, readonly instructions: Instruction[]) {}

  get end(): number {
    return this.instructions[this.instructions.length - 1].end;
  }

  get last(): Instruction {
    return this.instructions[this.instructions.length - 1];
  }

  get size(): number {
    return this.end - this.start;
  }
}

export class ControlFlowGraph {
  readonly tables: Map<number, JumpTable>;
  readonly instructions: Instruction[];
  readonly blocks: Map<number, Block> = new Map();
  readonly unresolved: number[] = [];
  readonly edges: [number, number, string][];
  private idom: Map<number, number> | null = null;

  constructor(readonly entry: number, instructions: Instruction[], tables: Map<number, JumpTable> | null = null, limit: number | null = null) {
    this.tables = tables ?? new Map();
    let ordered = [...instructions].sort((a, b) => a.address - b.address);
    if (limit !== null) {
      ordered = ordered.filter((i) => i.address < limit);
    }
    this.instructions = ordered;
    this.build();
    this.edges = [];
    for (const block of this.blocks.values()) {
      for (const [target, kind] of block.successors) {
        this.edges.push([block.start, target, kind]);
      }
    }
  }

  private leaders(): Set<number> {
    const leaders: Set<number> = new Set([this.entry]);
    const addresses = new Set(this.instructions.map((i) => i.address));
    this.instructions.forEach((instruction, position) => {
      if (["jump", "branch", "return", "indirect-jump"].includes(instruction.flow)) {
        if (position + 1 < this.instructions.length) {
          leaders.add(this.instructions[position + 1].address);
        }
      }
      if ((instruction.flow === "jump" || instruction.flow === "branch") && instruction.target !== null && addresses.has(instruction.target)) {
        leaders.add(instruction.target);
      }
      const table = this.tables.get(instruction.address);
      if (table !== undefined) {
        for (const t of table.targets) {
          if (addresses.has(t)) {
            leaders.add(t);
          }
        }
      }
    });
    return leaders;
  }

  private build(): void {
    const leaders = this.leaders();
    let current: Block | null = null;
    for (const instruction of this.instructions) {
      if (leaders.has(instruction.address) || current === null || current.end !== instruction.address) {
        current = new Block(instruction.address, []);
        this.blocks.set(instruction.address, current);
      }
      current.instructions.push(instruction);
    }
    const starts = sortedNumbers(this.blocks.keys());
    starts.forEach((start, position) => {
      const block = this.blocks.get(start)!;
      const last = block.last;
      const following = position + 1 < starts.length ? starts[position + 1] : null;
      const fallsThrough = following !== null && following === block.end;
      if (last.flow === "return") {
        return;
      }
      if (last.flow === "jump") {
        if (last.target !== null && this.blocks.has(last.target)) {
          block.successors.push([last.target, "jump"]);
        }
        return;
      }
      if (last.flow === "branch") {
        if (last.target !== null && this.blocks.has(last.target)) {
          block.successors.push([last.target, "taken"]);
        }
        if (fallsThrough) {
          block.successors.push([following!, "fallthrough"]);
        }
        return;
      }
      if (last.flow === "indirect-jump") {
        const table = this.tables.get(last.address);
        if (table === undefined) {
          this.unresolved.push(last.address);
          return;
        }
        for (const target of sortedNumbers(new Set(table.targets))) {
          if (this.blocks.has(target)) {
            block.successors.push([target, "table"]);
          }
        }
        return;
      }
      if (fallsThrough) {
        block.successors.push([following!, "fallthrough"]);
      }
    });
  }

  predecessors(start: number): number[] {
    return this.edges.filter(([, target]) => target === start).map(([source]) => source);
  }

  reversePostorder(): number[] {
    const seen: Set<number> = new Set();
    const postorder: number[] = [];
    const visit = (start: number): void => {
      seen.add(start);
      for (const [target] of this.blocks.get(start)!.successors) {
        if (!seen.has(target)) {
          visit(target);
        }
      }
      postorder.push(start);
    };
    if (this.blocks.has(this.entry)) {
      visit(this.entry);
    }
    return postorder.reverse();
  }

  reachable(): Set<number> {
    return new Set(this.reversePostorder());
  }

  unreachable(): number[] {
    const reachable = this.reachable();
    return sortedNumbers(this.blocks.keys()).filter((start) => !reachable.has(start));
  }

  dominators(): Map<number, number> {
    if (this.idom !== null) {
      return this.idom;
    }
    const order = this.reversePostorder();
    const number: Map<number, number> = new Map(order.map((start, position) => [start, position]));
    const idom: Map<number, number> = new Map([[this.entry, this.entry]]);

    const intersect = (first: number, second: number): number => {
      while (first !== second) {
        while (number.get(first)! > number.get(second)!) {
          first = idom.get(first)!;
        }
        while (number.get(second)! > number.get(first)!) {
          second = idom.get(second)!;
        }
      }
      return first;
    };

    let changed = true;
    while (changed) {
      changed = false;
      for (const start of order.slice(1)) {
        const processed = this.predecessors(start).filter((p) => idom.has(p));
        let candidate = processed[0];
        for (const other of processed.slice(1)) {
          candidate = intersect(other, candidate);
        }
        if (idom.get(start) !== candidate) {
          idom.set(start, candidate);
          changed = true;
        }
      }
    }
    this.idom = idom;
    return idom;
  }

  dominates(dominator: number, start: number): boolean {
    const idom = this.dominators();
    for (;;) {
      if (start === dominator) {
        return true;
      }
      if ((idom.get(start) ?? start) === start) {
        return false;
      }
      start = idom.get(start)!;
    }
  }

  backEdges(): [number, number][] {
    const reachable = this.reachable();
    return this.edges
      .filter(([source, target]) => reachable.has(source) && reachable.has(target) && this.dominates(target, source))
      .map(([source, target]) => [source, target]);
  }

  dominatorTree(): Map<number, number[]> {
    const tree: Map<number, number[]> = new Map();
    for (const start of this.dominators().keys()) {
      tree.set(start, []);
    }
    for (const [start, parent] of this.dominators()) {
      if (start !== parent) {
        tree.get(parent)!.push(start);
      }
    }
    return tree;
  }

  summary(): { [key: string]: Json } {
    const idom = this.dominators();
    const immediate: { [key: string]: Json } = {};
    for (const start of sortedNumbers(idom.keys())) {
      immediate[`0x${hx(start)}`] = `0x${hx(idom.get(start)!)}`;
    }
    return {
      blocks: this.blocks.size,
      edges: this.edges.length,
      unreachableBlocks: this.unreachable().map((s) => `0x${hx(s)}`),
      unresolvedIndirectJumps: this.unresolved.map((a) => `0x${hx(a)}`),
      backEdges: this.backEdges().map(([s, t]) => `0x${hx(s)}->0x${hx(t)}`),
      immediateDominators: immediate,
    };
  }
}

export class FunctionAnalysis {
  constructor(
    readonly name: string,
    readonly start: number,
    readonly end: number,
    readonly gapEnd: number,
    readonly sweep: SweepResult,
    readonly descent: DescentResult,
    readonly descentPlain: DescentResult,
    readonly cfg: ControlFlowGraph,
    readonly cfgPlain: ControlFlowGraph,
    readonly cfgSweep: ControlFlowGraph,
    readonly valueTables: JumpTable[],
  ) {}

  toDict(): { [key: string]: Json } {
    const tables = [...this.descent.resolvedTables.values()].map((t) => t.toDict()).concat(this.valueTables.map((t) => t.toDict()));
    return {
      range: `0x${hx(this.start)}-0x${hx(this.end)}`,
      paddingBytes: this.gapEnd - this.end,
      linearSweep: { instructions: this.sweep.instructions.length, ...this.cfgSweep.summary() },
      recursiveDescent: { instructions: this.descentPlain.instructions.size, ...this.cfgPlain.summary() },
      recursiveDescentWithTables: { instructions: this.descent.instructions.size, ...this.cfg.summary() },
      tables,
    };
  }
}

export function analyzeFunction(elf: ElfObject, name: string, section = ".text"): FunctionAnalysis {
  const code = elf.section(section).data;
  const [start, end, gapEnd] = elf.functionExtent(name, section);
  const sweep = linearSweep(code, start, gapEnd);
  const plain = recursiveDescent(code, [start], gapEnd);
  const resolved = recursiveDescent(code, [start], gapEnd, jumpTableResolver(elf, section));
  const cfg = new ControlFlowGraph(start, resolved.sortedInstructions(), resolved.resolvedTables);
  const cfgPlain = new ControlFlowGraph(start, plain.sortedInstructions());
  const cfgSweep = new ControlFlowGraph(start, sweep.instructions);
  const valueTables = findValueTables(elf, resolved.sortedInstructions(), section);
  return new FunctionAnalysis(name, start, end, gapEnd, sweep, resolved, plain, cfg, cfgPlain, cfgSweep, valueTables);
}

function words(text: string): string {
  return text.split(/\s+/).filter((part) => part.length > 0).join(" ");
}

export function parseObjdump(text: string): [number, string, string][] {
  const rows: [number, string, string][] = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (!line.includes(":") || !line.includes("\t")) {
      continue;
    }
    const tab = line.indexOf("\t");
    const head = line.slice(0, tab).trim();
    const rest = line.slice(tab + 1);
    const colon = head.indexOf(":");
    const addressText = colon >= 0 ? head.slice(0, colon) : head;
    const byteText = colon >= 0 ? head.slice(colon + 1) : "";
    if (!addressText || ![...addressText].every((c) => "0123456789abcdef".includes(c))) {
      continue;
    }
    const body = rest.split("#")[0];
    rows.push([parseInt(addressText, 16), words(byteText), words(body)]);
  }
  return rows;
}

export interface OracleComparison {
  compared: number;
  ours: number;
  mismatches: { [key: string]: string }[];
  agree: boolean;
}

export function compareWithOracle(elf: ElfObject, oracleText: string, section = ".text"): OracleComparison {
  const code = elf.section(section).data;
  const ours = linearSweep(code);
  const expected = parseObjdump(oracleText);
  const mismatches: { [key: string]: string }[] = [];
  const byAddress: Map<number, Instruction> = new Map(ours.instructions.map((i) => [i.address, i]));
  for (const [address, byteText, text] of expected) {
    const instruction = byAddress.get(address);
    if (instruction === undefined) {
      mismatches.push({ address: `0x${hx(address)}`, expected: text, got: "(no instruction starts here)" });
      continue;
    }
    const line = listingLine(instruction, elf);
    const tab = line.indexOf("\t");
    const got = words(tab >= 0 ? line.slice(tab + 1) : "");
    if (instruction.hex !== byteText || got !== text) {
      mismatches.push({ address: `0x${hx(address)}`, expected: `${byteText} ${text}`, got: `${instruction.hex} ${got}` });
    }
  }
  return { compared: expected.length, ours: ours.instructions.length, mismatches, agree: mismatches.length === 0 && expected.length === ours.instructions.length };
}

export function figureData(elf: ElfObject, name = "grade"): { [key: string]: Json } {
  const analysis = analyzeFunction(elf, name);

  const blockEntries = (cfg: ControlFlowGraph): Json[] =>
    [...cfg.blocks.values()].sort((a, b) => a.start - b.start).map((b) => ({ s: b.start, e: b.end, n: b.instructions.length }));

  const edgeEntries = (cfg: ControlFlowGraph): Json[] => cfg.edges.map(([s, t, k]) => ({ f: s, t, k }));

  const layer: Map<number, number> = new Map([[analysis.start, 0]]);
  for (const start of analysis.cfg.reversePostorder().slice(1)) {
    const forward = analysis.cfg.predecessors(start).filter((p) => layer.has(p) && !analysis.cfg.dominates(start, p));
    layer.set(start, 1 + Math.max(...forward.map((p) => layer.get(p)!)));
  }
  let deepest = layer.size ? Math.max(...layer.values()) : 0;
  for (const start of analysis.cfgSweep.blocks.keys()) {
    if (!layer.has(start)) {
      deepest += 1;
      layer.set(start, deepest);
    }
  }
  const firstTable = analysis.descent.resolvedTables.values().next();
  const table = firstTable.done ? null : firstTable.value;
  const instructions: Json[] = analysis.sweep.instructions.map((i) => ({ a: i.address, n: i.length, b: i.hex, t: words(i.text), f: i.flow, g: i.target }));
  const layers: Map<string, Json> = new Map();
  for (const [s, l] of layer) {
    layers.set(`${s}`, l);
  }
  return {
    function: name,
    start: analysis.start,
    end: analysis.end,
    gapEnd: analysis.gapEnd,
    instructions,
    layers,
    table:
      table === null
        ? null
        : { at: `${table.section}+0x${hx(table.offset)}`, count: table.count, targets: sortedNumbers(new Set(table.targets)), jump: table.jumpInstruction },
    methods: {
      linear: { order: analysis.sweep.instructions.map((i) => i.address), blocks: blockEntries(analysis.cfgSweep), edges: edgeEntries(analysis.cfgSweep) },
      descent: {
        order: [...analysis.descentPlain.order],
        blocks: blockEntries(analysis.cfgPlain),
        edges: edgeEntries(analysis.cfgPlain),
        unresolved: analysis.descentPlain.unresolved.map((i) => i.address),
      },
      table: {
        order: [...analysis.descent.order],
        blocks: blockEntries(analysis.cfg),
        edges: edgeEntries(analysis.cfg),
        unresolved: analysis.descent.unresolved.map((i) => i.address),
      },
    },
  };
}

export const FIXTURE_OBJECTS = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "sweep-trap.o"];

function hexSpaced(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

export function trapReport(elf: ElfObject): { [key: string]: Json } {
  const code = elf.section(".text").data;
  const [start, end, gapEnd] = elf.functionExtent("lookup");
  const sweep = linearSweep(code, start, gapEnd);
  const descent = recursiveDescent(code, [start], gapEnd);
  const jump = descent.sortedInstructions().find((i) => i.flow === "jump");
  if (jump === undefined || jump.target === null) {
    throw new Error("lookup has no direct jump");
  }
  const target = jump.target;
  const sweepAtTarget = sweep.covering(target);
  let sweepData = 0;
  let sweepPadding = 0;
  for (const i of sweep.instructions) {
    for (let a = i.address; a < i.end; a++) {
      if (jump.end <= a && a < target) {
        sweepData += 1;
      }
      if (a >= end) {
        sweepPadding += 1;
      }
    }
  }
  const claimed = [...descent.claimedBytes()];
  const atTarget = descent.instructions.get(target);
  return {
    function: "lookup",
    jump: `0x${hx(jump.address)} ${jump.text} -> 0x${hx(target)}`,
    dataBytes: { range: `0x${hx(jump.end)}-0x${hx(target)}`, hex: hexSpaced(code.subarray(jump.end, target)) },
    linearSweep: {
      instructions: sweep.instructions.length,
      atJumpTarget:
        sweepAtTarget === null
          ? null
          : { starts: `0x${hx(sweepAtTarget.address)}`, text: sweepAtTarget.text, startsAtTarget: sweepAtTarget.address === target },
      claimedDataBytes: sweepData,
      claimedPaddingBytes: sweepPadding,
    },
    recursiveDescent: {
      instructions: descent.instructions.size,
      atJumpTarget: atTarget !== undefined ? atTarget.text : null,
      claimedDataBytes: claimed.filter((a) => jump.end <= a && a < target).length,
      claimedPaddingBytes: claimed.filter((a) => a >= end).length,
    },
  };
}

export function demo(): { [key: string]: Json } {
  const fixtures: { [key: string]: Json } = {};
  for (const objectName of FIXTURE_OBJECTS) {
    const elf = loadFixture(objectName);
    const oraclePath = join(FIXTURES, objectName.replace(".o", ".objdump.txt"));
    const entry: { [key: string]: Json } = {};
    if (existsSync(oraclePath)) {
      const comparison = compareWithOracle(elf, readFileSync(oraclePath, "utf-8"));
      entry.oracle = `${comparison.compared - comparison.mismatches.length}/${comparison.compared} instructions agree with llvm-objdump`;
    }
    const functions: { [key: string]: Json } = {};
    for (const symbol of elf.functions()) {
      functions[symbol.name] = analyzeFunction(elf, symbol.name).toDict();
    }
    entry.functions = functions;
    fixtures[objectName] = entry;
  }
  return { fixtures, sweepTrap: trapReport(loadFixture("sweep-trap.o")) };
}

export function disassemble(path: string): string {
  const elf = new ElfObject(readFileSync(path));
  const code = elf.section(".text").data;
  const lines: string[] = [];
  const functions: Map<number, string> = new Map(elf.functions().map((s) => [s.value, s.name]));
  for (const instruction of linearSweep(code).instructions) {
    const name = functions.get(instruction.address);
    if (name !== undefined) {
      lines.push(`\n${hx(instruction.address).padStart(16, "0")} <${name}>:`);
    }
    let line = listingLine(instruction, elf);
    const reference = resolveReference(elf, instruction);
    if (reference !== null) {
      line += `\t; ${reference.relocation.describe()} -> ${reference.describe()}`;
    }
    lines.push(line);
  }
  return lines.join("\n").replace(/^\n+/, "");
}

function quote(text: string): string {
  return JSON.stringify(text).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function dumps(value: Json, indent: number | null = null, depth = 0): string {
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
      items.push(dumps(item, indent, depth + 1));
    }
  } else {
    open = "{";
    close = "}";
    const pairs = value instanceof Map ? [...value.entries()] : Object.entries(value);
    for (const [key, item] of pairs) {
      items.push(quote(key) + (indent === null ? ":" : ": ") + dumps(item, indent, depth + 1));
    }
  }
  if (items.length === 0) {
    return open + close;
  }
  if (indent === null) {
    return open + items.join(",") + close;
  }
  const inner = " ".repeat(indent * (depth + 1));
  const outer = " ".repeat(indent * depth);
  return open + "\n" + items.map((item) => inner + item).join(",\n") + "\n" + outer + close;
}

export function main(argv: string[]): number {
  if (argv.length === 0) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "disasm" && argv.length === 2) {
    console.log(disassemble(argv[1]));
    return 0;
  }
  if (command === "cfg" && argv.length === 3) {
    const elf = new ElfObject(readFileSync(argv[1]));
    console.log(dumps(analyzeFunction(elf, argv[2]).toDict(), 2));
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData(loadFixture("ledger-x86_64-O0.o"), "grade")));
    return 0;
  }
  console.error("usage: main.py [disasm FILE.o | cfg FILE.o FUNCTION | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
