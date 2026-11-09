// Lesson: Lifting to Pseudocode (phase 13 / lesson 34)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/34-lifting-to-pseudocode/code/main.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIXTURES = join(__dirname, "fixtures");
export const ARG_REGISTERS = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];
const range8to16 = Array.from({ length: 8 }, (_, k) => k + 8);
export const REG64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", ...range8to16.map((i) => `r${i}`)];
export const REG32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", ...range8to16.map((i) => `r${i}d`)];
export const REG16 = ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", ...range8to16.map((i) => `r${i}w`)];
export const R_X86_64_PC32 = 2;
export const R_X86_64_PLT32 = 4;
export const STT_FUNC = 2;
export const STT_SECTION = 3;
export const EXIT = -1;

export class Section {
  constructor(
    public index: number,
    public name: string,
    public type: number,
    public offset: number,
    public size: number,
    public link: number,
    public data: Buffer,
  ) {}
}

export class ElfSymbol {
  constructor(public name: string, public value: number, public size: number, public type: number, public shndx: number) {}
}

export class Relocation {
  constructor(public offset: number, public type: number, public symbol: string, public addend: number) {}
}

export class ElfObject {
  constructor(
    public path: string,
    public sections: Section[],
    public symbols: ElfSymbol[],
    public relocations: Map<string, Relocation[]>,
  ) {}

  section(name: string): Section {
    for (const section of this.sections) {
      if (section.name === name) return section;
    }
    throw new Error(`KeyError: ${pyRepr(name)}`);
  }

  functions(): ElfSymbol[] {
    const text = this.section(".text").index;
    const found = this.symbols.filter((s) => s.type === STT_FUNC && s.shndx === text);
    return [...found].sort((a, b) => a.value - b.value);
  }

  function(name: string): ElfSymbol {
    for (const symbol of this.functions()) {
      if (symbol.name === name) return symbol;
    }
    throw new Error(`KeyError: ${pyRepr(name)}`);
  }

  functionEnd(symbol: ElfSymbol): number {
    const later = this.functions()
      .filter((s) => s.value > symbol.value)
      .map((s) => s.value);
    return later.length ? Math.min(...later) : this.section(".text").size;
  }

  relocationAt(section: string, offset: number): Relocation | null {
    for (const relocation of this.relocations.get(section) ?? []) {
      if (relocation.offset === offset) return relocation;
    }
    return null;
  }
}

function cstr(table: Buffer, index: number): string {
  const end = table.indexOf(0, index);
  if (end < 0) throw new Error("ValueError: subsection not found");
  const raw = table.subarray(index, end);
  for (const b of raw) {
    if (b > 0x7f) throw new Error("UnicodeDecodeError: 'ascii' codec can't decode byte");
  }
  return raw.toString("latin1");
}

function u16(data: Buffer, offset: number): number {
  return data.readUInt16LE(offset);
}

function u32(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset);
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

function i64(data: Buffer, offset: number): number {
  return Number(data.readBigInt64LE(offset));
}

export function readObject(path: string): ElfObject {
  const data = readFileSync(path);
  if (data.subarray(0, 4).toString("latin1") !== "\x7fELF" || data[4] !== 2 || data[5] !== 1) {
    throw new Error(`ValueError: ${path} is not a little-endian ELF64 file`);
  }
  const eShoff = u64(data, 0x28);
  const eShentsize = u16(data, 0x3a);
  const eShnum = u16(data, 0x3c);
  const eShstrndx = u16(data, 0x3e);
  const raw: number[][] = [];
  for (let i = 0; i < eShnum; i++) {
    const b = eShoff + i * eShentsize;
    raw.push([u32(data, b), u32(data, b + 4), u64(data, b + 8), u64(data, b + 16), u64(data, b + 24), u64(data, b + 32), u32(data, b + 40), u32(data, b + 44), u64(data, b + 48), u64(data, b + 56)]);
  }
  const shstr = raw[eShstrndx];
  const shstrtab = data.subarray(shstr[4], shstr[4] + shstr[5]);
  const sections: Section[] = [];
  raw.forEach((header, index) => {
    const [shName, shType, , , shOffset, shSize, shLink] = header;
    const payload = shType === 8 ? Buffer.alloc(0) : data.subarray(shOffset, shOffset + shSize);
    sections.push(new Section(index, cstr(shstrtab, shName), shType, shOffset, shSize, shLink, payload));
  });
  const symbols: ElfSymbol[] = [];
  const symtab = sections.find((s) => s.name === ".symtab");
  if (symtab !== undefined) {
    const strtab = sections[symtab.link].data;
    for (let i = 0; i < Math.floor(symtab.size / 24); i++) {
      const b = i * 24;
      const stName = u32(symtab.data, b);
      const stInfo = symtab.data[b + 4];
      const stShndx = u16(symtab.data, b + 6);
      const stValue = u64(symtab.data, b + 8);
      const stSize = u64(symtab.data, b + 16);
      const stType = stInfo & 0xf;
      const name = stType === STT_SECTION ? sections[stShndx].name : cstr(strtab, stName);
      symbols.push(new ElfSymbol(name, stValue, stSize, stType, stShndx));
    }
  }
  const relocations = new Map<string, Relocation[]>();
  for (const section of sections) {
    if (!section.name.startsWith(".rela.")) continue;
    const target = section.name.slice(".rela".length);
    const entries: Relocation[] = [];
    for (let i = 0; i < Math.floor(section.size / 24); i++) {
      const b = i * 24;
      const rOffset = u64(section.data, b);
      const rInfo = section.data.readBigUInt64LE(b + 8);
      const rAddend = i64(section.data, b + 16);
      entries.push(new Relocation(rOffset, Number(rInfo & 0xffffffffn), symbols[Number(rInfo >> 32n)].name, rAddend));
    }
    relocations.set(target, entries);
  }
  return new ElfObject(path, sections, symbols, relocations);
}

export class DecodeError extends Error {}

export class Reg {
  constructor(readonly name: string, readonly width: number) {}
}

export class Imm {
  constructor(readonly value: number, readonly width: number) {}
}

export class Mem {
  constructor(
    readonly width: number,
    readonly base: string | null,
    readonly index: string | null,
    readonly scale: number,
    readonly disp: number,
    readonly rip: boolean,
    readonly segment: string | null,
    readonly dispOffset: number,
  ) {}
}

export class Rel {
  constructor(readonly target: number) {}
}

export type Operand = Reg | Imm | Mem | Rel;

export class Insn {
  constructor(
    public address: number,
    public raw: Buffer,
    public mnemonic: string,
    public operands: Operand[],
    public width: number,
  ) {}

  get size(): number {
    return this.raw.length;
  }

  get nextAddress(): number {
    return this.address + this.size;
  }

  att(): string {
    return renderAtt(this);
  }
}

const ALU_EV_GV = new Map([[0x01, "add"], [0x29, "sub"], [0x31, "xor"], [0x39, "cmp"], [0x85, "test"], [0x89, "mov"]]);
const ALU_GV_EV = new Map([[0x03, "add"], [0x2b, "sub"], [0x3b, "cmp"], [0x8b, "mov"], [0x8d, "lea"]]);
const GROUP1 = new Map([[0, "add"], [5, "sub"], [7, "cmp"]]);
const GROUP2 = new Map([[5, "shr"], [7, "sar"]]);
const GROUP3 = new Map([[7, "idiv"]]);
const JCC = new Map([
  [0x72, "jb"], [0x73, "jae"], [0x74, "je"], [0x75, "jne"], [0x76, "jbe"], [0x77, "ja"],
  [0x7c, "jl"], [0x7d, "jge"], [0x7e, "jle"], [0x7f, "jg"],
]);
const SUFFIX = new Map([[16, "w"], [32, "l"], [64, "q"]]);
const JCC_NAMES = new Set(JCC.values());

export function regName(number: number, width: number): string {
  const table = width === 16 ? REG16 : width === 32 ? REG32 : width === 64 ? REG64 : null;
  if (table === null) throw new Error(`KeyError: ${width}`);
  return table[number];
}

function sint(code: Buffer, pos: number, size: number): number {
  const chunk = code.subarray(pos, pos + size);
  if (chunk.length === 0) return 0;
  let value = 0n;
  for (let k = chunk.length - 1; k >= 0; k--) value = (value << 8n) | BigInt(chunk[k]);
  const bits = BigInt(chunk.length * 8);
  if (value >> (bits - 1n)) value -= 1n << bits;
  return Number(value);
}

function byteAt(code: Buffer, i: number): number {
  if (i >= code.length) throw new Error("IndexError: index out of range");
  return code[i];
}

function parseModrm(code: Buffer, i: number, width: number, rexX: number, rexB: number, segment: string | null, start: number): [Operand, number, number] {
  const modrm = byteAt(code, i);
  i += 1;
  const [mod, reg, rm] = [modrm >> 6, (modrm >> 3) & 7, modrm & 7];
  if (mod === 3) return [new Reg(regName(rm | (rexB << 3), width), width), reg, i];
  let base: string | null = null;
  let index: string | null = null;
  let scale = 1;
  let disp = 0;
  let rip = false;
  let dispSize = 0;
  let sibBaseIsDisp = false;
  if (rm === 4) {
    const sib = byteAt(code, i);
    i += 1;
    scale = 1 << (sib >> 6);
    const idx = ((sib >> 3) & 7) | (rexX << 3);
    index = idx === 4 ? null : REG64[idx];
    if ((sib & 7) === 5 && mod === 0) sibBaseIsDisp = true;
    else base = REG64[(sib & 7) | (rexB << 3)];
  } else if (rm === 5 && mod === 0) {
    rip = true;
  } else {
    base = REG64[rm | (rexB << 3)];
  }
  if (mod === 1) dispSize = 1;
  else if (mod === 2 || rip || sibBaseIsDisp) dispSize = 4;
  const dispOffset = i - start;
  if (dispSize) {
    disp = sint(code, i, dispSize);
    i += dispSize;
  }
  return [new Mem(width, base, index, scale, disp, rip, segment, dispOffset), reg, i];
}

export function decodeOne(code: Buffer, pos: number): Insn {
  const start = pos;
  let i = pos;
  let opsize16 = false;
  let segment: string | null = null;
  let rex = 0;
  while (i < code.length) {
    const b = code[i];
    if (b === 0x66) {
      opsize16 = true;
    } else if (b === 0x2e) {
      segment = "cs";
    } else if (b >= 0x40 && b <= 0x4f) {
      rex = b;
      i += 1;
      break;
    } else {
      break;
    }
    i += 1;
  }
  if (i >= code.length) throw new DecodeError(`0x${pos.toString(16)}: ran out of bytes inside the prefixes`);
  const [rexW, rexR, rexX, rexB] = [(rex >> 3) & 1, (rex >> 2) & 1, (rex >> 1) & 1, rex & 1];
  const width = rexW ? 64 : opsize16 ? 16 : 32;
  const op = code[i];
  i += 1;

  const done = (mnemonic: string, operands: Operand[], w: number = width): Insn =>
    new Insn(start, Buffer.from(code.subarray(start, i)), mnemonic, operands, w);
  const modrm = (w: number = width): [Operand, number] => {
    const [rmOperand, regField, next] = parseModrm(code, i, w, rexX, rexB, segment, start);
    i = next;
    return [rmOperand, regField];
  };
  const imm = (size: number, w: number = width): Imm => {
    const value = sint(code, i, size);
    i += size;
    return new Imm(value, w);
  };
  const rel = (size: number): Rel => {
    const offset = imm(size).value;
    return new Rel(i + offset);
  };
  const gv = (regField: number, w: number = width): Reg => new Reg(regName(regField | (rexR << 3), w), w);
  const hx = (v: number) => v.toString(16);
  const hx2 = (v: number) => v.toString(16).padStart(2, "0");

  if (ALU_EV_GV.has(op)) {
    const [ev, regField] = modrm();
    return done(ALU_EV_GV.get(op)!, [ev, gv(regField)]);
  }
  if (ALU_GV_EV.has(op)) {
    const [ev, regField] = modrm();
    return done(ALU_GV_EV.get(op)!, [gv(regField), ev]);
  }
  if (op === 0x63) {
    const [ev, regField] = modrm(32);
    return done("movsxd", [gv(regField, 64), ev], 64);
  }
  if (op === 0x69 || op === 0x6b) {
    const [ev, regField] = modrm();
    const immediate = imm(op === 0x69 ? 4 : 1);
    return done("imul", [gv(regField), ev, immediate]);
  }
  if (op >= 0x50 && op <= 0x5f) {
    const mnemonic = op <= 0x57 ? "push" : "pop";
    return done(mnemonic, [new Reg(regName((op & 7) | (rexB << 3), 64), 64)], 64);
  }
  if (JCC.has(op)) return done(JCC.get(op)!, [rel(1)], 0);
  if (op === 0x83) {
    const [ev, regField] = modrm();
    if (!GROUP1.has(regField)) throw new DecodeError(`0x${hx(start)}: group 1 extension /${regField} is outside the fixture subset`);
    return done(GROUP1.get(regField)!, [ev, imm(1)]);
  }
  if (op === 0x90) return done("nop", [], 0);
  if (op === 0x99) return done(rexW ? "cqto" : "cltd", [], width);
  if (op === 0xc1) {
    const [ev, regField] = modrm();
    if (!GROUP2.has(regField)) throw new DecodeError(`0x${hx(start)}: group 2 extension /${regField} is outside the fixture subset`);
    return done(GROUP2.get(regField)!, [ev, imm(1, 8)]);
  }
  if (op === 0xc3) return done("ret", [], 64);
  if (op === 0xc7) {
    const [ev, regField] = modrm();
    if (regField !== 0) throw new DecodeError(`0x${hx(start)}: C7 /${regField} is not mov`);
    return done("mov", [ev, imm(4)]);
  }
  if (op === 0xe8) return done("call", [rel(4)], 64);
  if (op === 0xe9) return done("jmp", [rel(4)], 0);
  if (op === 0xeb) return done("jmp", [rel(1)], 0);
  if (op === 0xf7) {
    const [ev, regField] = modrm();
    if (!GROUP3.has(regField)) throw new DecodeError(`0x${hx(start)}: group 3 extension /${regField} is outside the fixture subset`);
    return done(GROUP3.get(regField)!, [ev]);
  }
  if (op === 0xff) {
    const extension = (byteAt(code, i) >> 3) & 7;
    const [ev, regField] = modrm(extension === 4 ? 64 : width);
    if (regField === 0) return done("inc", [ev]);
    if (regField === 4) return done("jmp", [ev], 64);
    throw new DecodeError(`0x${hx(start)}: group 5 extension /${regField} is outside the fixture subset`);
  }
  if (op === 0x0f) {
    const op2 = byteAt(code, i);
    i += 1;
    if (op2 === 0x1f) {
      const [ev] = modrm();
      return done("nop", [ev]);
    }
    throw new DecodeError(`0x${hx(start)}: two-byte opcode 0f ${hx2(op2)} is outside the fixture subset`);
  }
  throw new DecodeError(`0x${hx(start)}: opcode ${hx2(op)} is outside the fixture subset`);
}

export function decodeRange(code: Buffer, start: number, end: number): Insn[] {
  const insns: Insn[] = [];
  let pos = start;
  while (pos < end) {
    const insn = decodeOne(code, pos);
    insns.push(insn);
    pos = insn.nextAddress;
  }
  return insns;
}

export function hex(value: number): string {
  return value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
}

function constText(value: number): string {
  return Math.abs(value) >= 0x10000 ? hex(value) : String(value);
}

export function renderOperand(operand: Operand): string {
  if (operand instanceof Reg) return `%${operand.name}`;
  if (operand instanceof Imm) return `$${hex(operand.value)}`;
  if (operand instanceof Rel) return hex(operand.target);
  const prefix = operand.segment ? `%${operand.segment}:` : "";
  const hasRegister = operand.base || operand.index || operand.rip;
  const disp = operand.disp || !hasRegister ? hex(operand.disp) : "";
  if (operand.rip) return `${prefix}${disp}(%rip)`;
  let inner = operand.base ? `%${operand.base}` : "";
  if (operand.index) {
    inner += `,%${operand.index}`;
    if (operand.scale !== 1) inner += `,${operand.scale}`;
  }
  return `${prefix}${disp}(${inner})`;
}

function suffixOf(width: number): string {
  const s = SUFFIX.get(width);
  if (s === undefined) throw new Error(`KeyError: ${width}`);
  return s;
}

export function renderAtt(insn: Insn): string {
  const m = insn.mnemonic;
  if (jumpTarget(insn) !== null) return `${m}\t${renderOperand(insn.operands[0])}`;
  if (m === "jmp") return `jmpq\t*${renderOperand(insn.operands[0])}`;
  if (m === "cltd" || m === "cqto") return m;
  if (m === "movsxd") return `movslq\t${renderOperand(insn.operands[1])}, ${renderOperand(insn.operands[0])}`;
  if (m === "nop") {
    if (!insn.operands.length) return "nop";
    return `nop${suffixOf(insn.width)}\t${renderOperand(insn.operands[0])}`;
  }
  if (m === "ret") return "retq";
  if (m === "call") return `callq\t${renderOperand(insn.operands[0])}`;
  const name = m + suffixOf(insn.width);
  const operands = [...insn.operands].reverse().map(renderOperand).join(", ");
  return `${name}\t${operands}`;
}

export function parseObjdump(text: string): Map<string, [number, string, string][]> {
  const functions = new Map<string, [number, string, string][]>();
  let current: string | null = null;
  for (const line of splitLines(text)) {
    if (line.endsWith(">:") && line.includes(" <")) {
      current = line.slice(line.indexOf("<") + 1, -2);
      functions.set(current, []);
      continue;
    }
    if (current === null || !line.includes(":") || line.startsWith("\t\t")) continue;
    const stripped = line.trim();
    const colon = stripped.indexOf(":");
    const head = stripped.slice(0, colon);
    let rest = stripped.slice(colon + 1);
    if (!head || ![...head].every((c) => "0123456789abcdef".includes(c))) continue;
    rest = rest.split("#")[0];
    const parts = rest.trim().split("\t");
    const raw = parts[0].replace(/ /g, "").toLowerCase();
    let asm = parts
      .slice(1)
      .map((p) => p.trim())
      .join("\t")
      .trim();
    if (asm.includes(" <")) asm = asm.slice(0, asm.indexOf(" <"));
    functions.get(current)!.push([parseInt(head, 16), raw, asm]);
  }
  return functions;
}

export class Const {
  constructor(readonly value: number, readonly width: number) {}
}

export class Var {
  constructor(readonly name: string, readonly width: number, readonly version: number = -1) {}
}

export class Bin {
  constructor(readonly op: string, readonly left: Expr, readonly right: Expr, readonly width: number) {}
}

export class Cast {
  constructor(readonly kind: string, readonly expr: Expr, readonly width: number) {}
}

export class Load {
  constructor(readonly addr: Expr, readonly width: number) {}
}

export class Index {
  constructor(readonly base: Expr, readonly index: Expr, readonly width: number) {}
}

export class Flags {
  constructor(readonly kind: string, readonly left: Expr, readonly right: Expr, readonly width: number) {}
}

export class Cond {
  constructor(readonly cc: string, readonly flags: Expr, readonly width: number = 32) {}
}

export class Concat {
  constructor(readonly high: Expr, readonly low: Expr, readonly width: number) {}
}

export class SignFill {
  constructor(readonly expr: Expr, readonly width: number) {}
}

export class Symbolic {
  constructor(readonly section: string, readonly offset: number, readonly width: number = 64) {}
}

export class CallExpr {
  constructor(readonly name: string, readonly args: Expr[], readonly width: number) {}
}

export type Expr = Const | Var | Bin | Cast | Load | Index | Flags | Cond | Concat | SignFill | Symbolic | CallExpr;

export class Assign {
  constructor(public dst: Var, public src: Expr) {}
}

export class Store {
  constructor(public addr: Expr, public value: Expr, public width: number) {}
}

export class Branch {
  constructor(public cond: Expr, public target: number, public fallthrough: number) {}
}

export class Jump {
  constructor(public target: number) {}
}

export class IndirectJump {
  constructor(public target: Expr) {}
}

export class Return {
  constructor(public value: Expr) {}
}

export class PhiStmt {
  constructor(public dst: Var, public sources: Map<number, Var>) {}
}

export type Stmt = Assign | Store | Branch | Jump | IndirectJump | Return | PhiStmt;

export class Block {
  stmts: Stmt[] = [];
  succs: number[] = [];
  preds: number[] = [];
  constructor(public start: number, public insns: Insn[]) {}
}

const FLAGS = new Var("flags", 0);
const COND_OPS = new Map([
  ["je", "=="], ["jne", "!="], ["jl", "<"], ["jge", ">="], ["jle", "<="], ["jg", ">"],
  ["jb", "<u"], ["jae", ">=u"], ["jbe", "<=u"], ["ja", ">u"],
]);
const NEGATE = new Map([
  ["==", "!="], ["!=", "=="], ["<", ">="], [">=", "<"], ["<=", ">"], [">", "<="],
  ["<u", ">=u"], [">=u", "<u"], ["<=u", ">u"], [">u", "<=u"],
]);

function isTerminator(stmt: Stmt): stmt is Branch | Jump | Return | IndirectJump {
  return stmt instanceof Branch || stmt instanceof Jump || stmt instanceof Return || stmt instanceof IndirectJump;
}

export function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => eq(x, b[i]));
  }
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return Object.keys(ra).every((k) => eq(ra[k], rb[k]));
}

export function family(name: string): string {
  for (const table of [REG64, REG32, REG16]) {
    const index = table.indexOf(name);
    if (index >= 0) return REG64[index];
  }
  return name;
}

export function jumpTarget(insn: Insn): number | null {
  if (JCC_NAMES.has(insn.mnemonic) || (insn.mnemonic === "jmp" && insn.operands[0] instanceof Rel)) {
    return (insn.operands[0] as Rel).target;
  }
  return null;
}

function endsBlock(insn: Insn): boolean {
  return JCC_NAMES.has(insn.mnemonic) || insn.mnemonic === "jmp" || insn.mnemonic === "ret";
}

export function buildBlocks(insns: Insn[]): Map<number, Block> {
  const start = insns[0].address;
  const end = insns[insns.length - 1].nextAddress;
  const leaders = new Set([start]);
  for (const insn of insns) {
    const target = jumpTarget(insn);
    if (target !== null && start <= target && target < end) leaders.add(target);
    if (endsBlock(insn) && insn.nextAddress < end) leaders.add(insn.nextAddress);
  }
  const blocks = new Map<number, Block>();
  let current: Block | null = null;
  for (const insn of insns) {
    if (leaders.has(insn.address)) {
      current = new Block(insn.address, []);
      blocks.set(insn.address, current);
    }
    current!.insns.push(insn);
  }
  for (const block of blocks.values()) {
    const last = block.insns[block.insns.length - 1];
    const target = jumpTarget(last);
    if (JCC_NAMES.has(last.mnemonic)) block.succs = [target!, last.nextAddress];
    else if (target !== null) block.succs = [target];
    else if (endsBlock(last)) block.succs = [];
    else if (last.nextAddress < end) block.succs = [last.nextAddress];
  }
  for (const block of blocks.values()) {
    for (const succ of block.succs) {
      const b = blocks.get(succ);
      if (b === undefined) throw new Error(`KeyError: ${succ}`);
      b.preds.push(block.start);
    }
  }
  return blocks;
}

type Graph = Map<number, number[]>;

export function reachable(entry: number, succs: Graph): Set<number> {
  const seen = new Set<number>();
  const stack = [entry];
  while (stack.length) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(succs.get(node) ?? []));
  }
  return seen;
}

export function reversePostorder(entry: number, succs: Graph): number[] {
  const order: number[] = [];
  const seen = new Set<number>();
  const visit = (node: number): void => {
    seen.add(node);
    for (const succ of succs.get(node) ?? []) {
      if (!seen.has(succ)) visit(succ);
    }
    order.push(node);
  };
  visit(entry);
  return order.reverse();
}

export function immediateDominators(entry: number, succs: Graph, preds: Graph): Map<number, number> {
  const rpo = reversePostorder(entry, succs);
  const position = new Map(rpo.map((node, i) => [node, i] as [number, number]));
  const idom = new Map<number, number>([[entry, entry]]);
  const intersect = (a: number, b: number): number => {
    while (a !== b) {
      while (position.get(a)! > position.get(b)!) a = idom.get(a)!;
      while (position.get(b)! > position.get(a)!) b = idom.get(b)!;
    }
    return a;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of rpo.slice(1)) {
      const candidates = (preds.get(node) ?? []).filter((p) => idom.has(p));
      let newIdom = candidates[0];
      for (const p of candidates.slice(1)) newIdom = intersect(p, newIdom);
      if (idom.get(node) !== newIdom) {
        idom.set(node, newIdom);
        changed = true;
      }
    }
  }
  return idom;
}

export function dominanceFrontiers(idom: Map<number, number>, preds: Graph): Map<number, Set<number>> {
  const frontier = new Map<number, Set<number>>();
  for (const node of idom.keys()) frontier.set(node, new Set());
  for (const node of idom.keys()) {
    const nodePreds = preds.get(node) ?? [];
    if (nodePreds.length < 2) continue;
    for (const p of nodePreds) {
      let runner = p;
      while (runner !== idom.get(node)) {
        frontier.get(runner)!.add(node);
        runner = idom.get(runner)!;
      }
    }
  }
  return frontier;
}

export function dominates(idom: Map<number, number>, a: number, b: number): boolean {
  for (;;) {
    if (a === b) return true;
    if (idom.get(b) === b) return false;
    b = idom.get(b)!;
  }
}

type Signatures = Map<string, [number[], number]>;

export class LiftContext {
  constructor(public obj: ElfObject, public signatures: Signatures, public frame: boolean = false) {}
}

export function localName(disp: number): string {
  return disp < 0 ? `local_${(-disp).toString(16)}` : `arg_${disp.toString(16)}`;
}

export function liftInsn(insn: Insn, ctx: LiftContext): Stmt[] {
  const m = insn.mnemonic;
  const ops = insn.operands;

  const addressOf = (mem: Mem): Expr => {
    if (mem.rip) {
      const relocation = ctx.obj.relocationAt(".text", insn.address + mem.dispOffset);
      if (relocation === null) return new Const(insn.nextAddress + mem.disp, 64);
      return new Symbolic(relocation.symbol, relocation.addend + (insn.size - mem.dispOffset));
    }
    let expr: Expr | null = mem.base ? new Var(mem.base, 64) : null;
    if (mem.index) {
      let scaled: Expr = new Var(mem.index, 64);
      if (mem.scale !== 1) scaled = new Bin("*", scaled, new Const(mem.scale, 64), 64);
      expr = expr === null ? scaled : new Bin("+", expr, scaled, 64);
    }
    if (mem.disp || expr === null) {
      const disp = new Const(mem.disp, 64);
      expr = expr === null ? disp : new Bin("+", expr, disp, 64);
    }
    return expr;
  };
  const isSlot = (mem: Operand): boolean => mem instanceof Mem && ctx.frame && mem.base === "rbp" && mem.index === null && !mem.rip;
  const widthOfOperand = (operand: Operand): number => (operand instanceof Rel ? 0 : operand.width);
  const read = (operand: Operand, width?: number): Expr => {
    const w = width || widthOfOperand(operand);
    if (operand instanceof Reg) return new Var(family(operand.name), w);
    if (operand instanceof Imm) return new Const(operand.value, w);
    if (isSlot(operand)) return new Var(localName((operand as Mem).disp), w);
    return new Load(addressOf(operand as Mem), w);
  };
  const write = (operand: Operand, expr: Expr): Stmt => {
    if (operand instanceof Reg) return new Assign(new Var(family(operand.name), operand.width), expr);
    if (isSlot(operand)) return new Assign(new Var(localName((operand as Mem).disp), (operand as Mem).width), expr);
    const mem = operand as Mem;
    return new Store(addressOf(mem), expr, mem.width);
  };
  const sameRegister = (a: Operand, b: Operand): boolean =>
    a instanceof Reg && b instanceof Reg && family(a.name) === family(b.name);

  if (m === "push" || m === "pop" || m === "nop") return [];
  if (m === "mov" && sameRegister(ops[0], new Reg("rbp", 64)) && sameRegister(ops[1], new Reg("rsp", 64))) {
    ctx.frame = true;
    return [];
  }
  if ((m === "add" || m === "sub") && ops[0] instanceof Reg && ops[0].name === "rsp") return [];
  if (m === "mov") return [write(ops[0], read(ops[1]))];
  if (m === "movsxd") return [write(ops[0], new Cast("sext", read(ops[1], 32), 64))];
  if (m === "lea") {
    let expr = addressOf(ops[1] as Mem);
    if (widthOfOperand(ops[0]) === 32) expr = new Cast("trunc", expr, 32);
    return [write(ops[0], expr)];
  }
  if (m === "add" || m === "sub" || m === "xor") {
    const w = widthOfOperand(ops[0]);
    if ((m === "sub" || m === "xor") && sameRegister(ops[0], ops[1])) return [write(ops[0], new Const(0, w))];
    const a = read(ops[0]);
    const b = read(ops[1]);
    const op = m === "add" ? "+" : m === "sub" ? "-" : "^";
    const flags = new Flags(m === "sub" ? "cmp" : m, a, b, w);
    return [new Assign(FLAGS, flags), write(ops[0], new Bin(op, a, b, w))];
  }
  if (m === "inc") {
    const a = read(ops[0]);
    const one = new Const(1, a.width);
    return [new Assign(FLAGS, new Flags("inc", a, one, a.width)), write(ops[0], new Bin("+", a, one, a.width))];
  }
  if (m === "cmp" || m === "test") return [new Assign(FLAGS, new Flags(m, read(ops[0]), read(ops[1]), widthOfOperand(ops[0])))];
  if (m === "imul") return [write(ops[0], new Bin("*", read(ops[1]), read(ops[2]), widthOfOperand(ops[0])))];
  if (m === "sar" || m === "shr") {
    const op = m === "sar" ? ">>s" : ">>u";
    return [write(ops[0], new Bin(op, read(ops[0]), new Const((ops[1] as Imm).value, 8), widthOfOperand(ops[0])))];
  }
  if (m === "cltd") return [new Assign(new Var("rdx", 32), new SignFill(new Var("rax", 32), 32))];
  if (m === "cqto") return [new Assign(new Var("rdx", 64), new SignFill(new Var("rax", 64), 64))];
  if (m === "idiv") {
    const w = widthOfOperand(ops[0]);
    const dividend = new Var("dividend", 2 * w);
    const divisor = read(ops[0]);
    return [
      new Assign(dividend, new Concat(new Var("rdx", w), new Var("rax", w), 2 * w)),
      new Assign(new Var("rax", w), new Bin("/", dividend, divisor, w)),
      new Assign(new Var("rdx", w), new Bin("%", dividend, divisor, w)),
    ];
  }
  if (JCC_NAMES.has(m)) return [new Branch(new Cond(m, FLAGS), (ops[0] as Rel).target, insn.nextAddress)];
  if (m === "jmp") {
    if (ops[0] instanceof Rel) return [new Jump(ops[0].target)];
    return [new IndirectJump(read(ops[0], 64))];
  }
  if (m === "call") {
    const relocation = ctx.obj.relocationAt(".text", insn.address + 1);
    const name = relocation ? relocation.symbol : `sub_${(ops[0] as Rel).target.toString(16)}`;
    const [paramWidths, resultWidth] = ctx.signatures.get(name) ?? [[], 32];
    const args = paramWidths.map((w, i) => new Var(ARG_REGISTERS[i], w));
    return [new Assign(new Var("rax", resultWidth), new CallExpr(name, args, resultWidth))];
  }
  if (m === "ret") return [new Return(new Var("rax", 0))];
  throw new DecodeError(`0x${insn.address.toString(16)}: no lifting rule for ${m}`);
}

export function children(expr: Expr): Expr[] {
  if (expr instanceof Bin || expr instanceof Flags) return [expr.left, expr.right];
  if (expr instanceof Cast || expr instanceof SignFill) return [expr.expr];
  if (expr instanceof Load) return [expr.addr];
  if (expr instanceof Index) return [expr.base, expr.index];
  if (expr instanceof Cond) return [expr.flags];
  if (expr instanceof Concat) return [expr.high, expr.low];
  if (expr instanceof CallExpr) return [...expr.args];
  return [];
}

export function rebuild(expr: Expr, kids: Expr[]): Expr {
  if (expr instanceof Bin) return new Bin(expr.op, kids[0], kids[1], expr.width);
  if (expr instanceof Flags) return new Flags(expr.kind, kids[0], kids[1], expr.width);
  if (expr instanceof Cast) return new Cast(expr.kind, kids[0], expr.width);
  if (expr instanceof SignFill) return new SignFill(kids[0], expr.width);
  if (expr instanceof Load) return new Load(kids[0], expr.width);
  if (expr instanceof Index) return new Index(kids[0], kids[1], expr.width);
  if (expr instanceof Cond) return new Cond(expr.cc, kids[0], expr.width);
  if (expr instanceof Concat) return new Concat(kids[0], kids[1], expr.width);
  if (expr instanceof CallExpr) return new CallExpr(expr.name, [...kids], expr.width);
  return expr;
}

export function rewrite(expr: Expr, fn: (e: Expr) => Expr): Expr {
  const kids = children(expr).map((k) => rewrite(k, fn));
  return fn(rebuild(expr, kids));
}

export function* iterNodes(expr: Expr): Generator<Expr> {
  yield expr;
  for (const kid of children(expr)) yield* iterNodes(kid);
}

export function variables(expr: Expr): Var[] {
  return [...iterNodes(expr)].filter((n): n is Var => n instanceof Var);
}

export function stmtExprs(stmt: Stmt): Expr[] {
  if (stmt instanceof Assign) return [stmt.src];
  if (stmt instanceof Store) return [stmt.addr, stmt.value];
  if (stmt instanceof Branch) return [stmt.cond];
  if (stmt instanceof IndirectJump) return [stmt.target];
  if (stmt instanceof Return) return [stmt.value];
  return [];
}

export function mapStmt(stmt: Stmt, fn: (e: Expr) => Expr): Stmt {
  if (stmt instanceof Assign) stmt.src = fn(stmt.src);
  else if (stmt instanceof Store) [stmt.addr, stmt.value] = [fn(stmt.addr), fn(stmt.value)];
  else if (stmt instanceof Branch) stmt.cond = fn(stmt.cond);
  else if (stmt instanceof IndirectJump) stmt.target = fn(stmt.target);
  else if (stmt instanceof Return) stmt.value = fn(stmt.value);
  return stmt;
}

export function widthOf(expr: Expr): number {
  return expr.width;
}

type Key = [string, number];
const keyOf = (name: string, version: number): string => `${name}\u0000${version}`;
const keyParts = (key: string): Key => {
  const [name, version] = key.split("\u0000");
  return [name, Number(version)];
};
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const cmpKey = (a: Key, b: Key): number => cmpStr(a[0], b[0]) || a[1] - b[1];

export class Func {
  idom = new Map<number, number>();
  ipdom = new Map<number, number>();
  defWidth = new Map<string, number>();
  params: string[] = [];
  paramWidths = new Map<string, number>();
  undefinedReads: string[] = [];
  webNames = new Map<string, string>();
  webTypes = new Map<string, string>();
  returnType = "int";
  tables = new Map<string, [string, number]>();
  notes: string[] = [];

  constructor(public name: string, public insns: Insn[], public blocks: Map<number, Block>, public entry: number) {}

  succs(): Graph {
    return new Map([...this.blocks.values()].map((b) => [b.start, [...b.succs]] as [number, number[]]));
  }

  preds(): Graph {
    return new Map([...this.blocks.values()].map((b) => [b.start, [...b.preds]] as [number, number[]]));
  }

  orderedBlocks(): Block[] {
    return [...this.blocks.keys()].sort((a, b) => a - b).map((k) => this.blocks.get(k)!);
  }

  statements(): Stmt[] {
    return this.orderedBlocks().flatMap((b) => b.stmts);
  }
}

export function insertPhis(fn: Func): void {
  const frontier = dominanceFrontiers(fn.idom, fn.preds());
  const defsites = new Map<string, Set<number>>();
  for (const block of fn.blocks.values()) {
    for (const stmt of block.stmts) {
      if (stmt instanceof Assign) {
        if (!defsites.has(stmt.dst.name)) defsites.set(stmt.dst.name, new Set());
        defsites.get(stmt.dst.name)!.add(block.start);
      }
    }
  }
  for (const [name, sites] of defsites) {
    const hasPhi = new Set<number>();
    const work = [...sites];
    while (work.length) {
      const node = work.pop()!;
      for (const y of frontier.get(node)!) {
        if (hasPhi.has(y)) continue;
        hasPhi.add(y);
        const target = fn.blocks.get(y)!;
        const phi = new PhiStmt(new Var(name, 0), new Map(target.preds.map((p) => [p, new Var(name, 0)] as [number, Var])));
        target.stmts.unshift(phi);
        if (!sites.has(y)) work.push(y);
      }
    }
  }
}

export function rename(fn: Func): void {
  const counters = new Map<string, number>();
  const stacks = new Map<string, number[]>();
  const childrenOf = new Map<number, number[]>();
  for (const b of fn.blocks.keys()) childrenOf.set(b, []);
  for (const [node, parent] of fn.idom) {
    if (node !== parent) childrenOf.get(parent)!.push(node);
  }

  const fresh = (name: string, width: number): Var => {
    const version = (counters.get(name) ?? 0) + 1;
    counters.set(name, version);
    if (!stacks.has(name)) stacks.set(name, []);
    stacks.get(name)!.push(version);
    fn.defWidth.set(keyOf(name, version), width);
    return new Var(name, width, version);
  };
  const use = (v: Var): Var => {
    const stack = stacks.get(v.name);
    if (!stack || !stack.length) {
      const k = keyOf(v.name, 0);
      fn.defWidth.set(k, Math.max(fn.defWidth.get(k) ?? 0, v.width));
      return new Var(v.name, v.width, 0);
    }
    return new Var(v.name, v.width, stack[stack.length - 1]);
  };
  const renameUses = (expr: Expr): Expr => rewrite(expr, (e) => (e instanceof Var ? use(e) : e));

  const visit = (blockId: number): void => {
    const block = fn.blocks.get(blockId)!;
    const pushed: string[] = [];
    for (const stmt of block.stmts) {
      if (stmt instanceof PhiStmt) {
        stmt.dst = fresh(stmt.dst.name, 0);
        pushed.push(stmt.dst.name);
        continue;
      }
      mapStmt(stmt, renameUses);
      if (stmt instanceof Assign) {
        stmt.dst = fresh(stmt.dst.name, stmt.dst.width);
        pushed.push(stmt.dst.name);
      }
    }
    for (const succ of block.succs) {
      for (const stmt of fn.blocks.get(succ)!.stmts) {
        if (stmt instanceof PhiStmt) stmt.sources.set(blockId, use(new Var(stmt.dst.name, 0)));
      }
    }
    for (const child of childrenOf.get(blockId)!) visit(child);
    for (const name of pushed) stacks.get(name)!.pop();
  };

  visit(fn.entry);
  let changed = true;
  while (changed) {
    changed = false;
    for (const stmt of fn.statements()) {
      if (stmt instanceof PhiStmt) {
        const width = Math.max(...[...stmt.sources.values()].map((s) => fn.defWidth.get(keyOf(s.name, s.version)) ?? 0));
        const key = keyOf(stmt.dst.name, stmt.dst.version);
        if (width > fn.defWidth.get(key)!) {
          fn.defWidth.set(key, width);
          changed = true;
        }
      }
    }
  }
  for (const stmt of fn.statements()) {
    if (stmt instanceof PhiStmt) {
      stmt.dst = new Var(stmt.dst.name, fn.defWidth.get(keyOf(stmt.dst.name, stmt.dst.version))!, stmt.dst.version);
      stmt.sources = new Map(
        [...stmt.sources].map(([p, s]) => [p, new Var(s.name, fn.defWidth.get(keyOf(s.name, s.version))!, s.version)] as [number, Var]),
      );
    }
  }

  const castUse = (expr: Expr): Expr => {
    if (!(expr instanceof Var)) return expr;
    const defWidth = fn.defWidth.get(keyOf(expr.name, expr.version)) ?? expr.width;
    if (defWidth === 0 || expr.width === 0) return new Var(expr.name, defWidth || expr.width, expr.version);
    if (expr.width === defWidth) return expr;
    const definition = new Var(expr.name, defWidth, expr.version);
    return new Cast(expr.width > defWidth ? "zext" : "trunc", definition, expr.width);
  };
  for (const stmt of fn.statements()) {
    if (!(stmt instanceof PhiStmt)) mapStmt(stmt, (e) => rewrite(e, castUse));
  }
}

export function magicDivisor(multiplier: number, shift: number): number | null {
  if (multiplier <= 0 || shift < 32) return null;
  const m = BigInt(multiplier);
  const power = 1n << BigInt(shift);
  for (const d of [power / m, power / m + 1n]) {
    const ceil = (power + d - 1n) / d;
    if (d > 1n && m === ceil && m * d - power <= power >> 31n) return Number(d);
  }
  return null;
}

export function cDiv(a: number, b: number): number {
  const q = Math.floor(Math.abs(a) / Math.abs(b));
  return a < 0 === b < 0 ? q : -q;
}

export function truncate(value: number, width: number): number {
  const w = BigInt(width);
  let v = BigInt(value) & ((1n << w) - 1n);
  if (v >> (w - 1n)) v -= 1n << w;
  return Number(v);
}

function zeroExtend(value: number, width: number): number {
  return Number(BigInt(value) & ((1n << BigInt(width)) - 1n));
}

export function makeSimplifier(defs: Map<string, Expr>, recognizeDivision: boolean): (e: Expr) => Expr {
  const resolve = (expr: Expr): Expr => {
    if (expr instanceof Var) {
      const found = defs.get(keyOf(expr.name, expr.version));
      if (found !== undefined) return found;
    }
    return expr;
  };
  const stripTrunc = (expr: Expr): Expr => (expr instanceof Cast && expr.kind === "trunc" ? expr.expr : expr);
  const divisionPattern = (expr: Expr): Expr | null => {
    if (!recognizeDivision || !(expr instanceof Bin) || expr.op !== "+") return null;
    const parts = [resolve(stripTrunc(expr.left)), resolve(stripTrunc(expr.right))];
    for (const [quotient, sign] of [parts, [parts[1], parts[0]]]) {
      if (!(quotient instanceof Bin && quotient.op === ">>s" && quotient.right instanceof Const)) continue;
      if (!(sign instanceof Bin && sign.op === ">>u" && sign.right instanceof Const && sign.right.value === 63)) continue;
      const productA = resolve(quotient.left);
      const productB = resolve(sign.left);
      if (!eq(productA, productB) || !(productA instanceof Bin && productA.op === "*")) continue;
      const operand = productA.left;
      const multiplier = productA.right;
      if (!(multiplier instanceof Const && operand instanceof Cast && operand.kind === "sext")) continue;
      const d = magicDivisor(multiplier.value, quotient.right.value);
      if (d !== null) return new Bin("/", operand.expr, new Const(d, 32), 32);
    }
    return null;
  };
  const simplify = (expr: Expr): Expr => {
    if (expr instanceof Cond && expr.flags instanceof Flags) {
      const flags = expr.flags;
      const op = COND_OPS.get(expr.cc)!;
      if (flags.kind === "cmp") return new Bin(op, flags.left, flags.right, 32);
      if (flags.kind === "test") {
        if (eq(flags.left, flags.right)) return new Bin(op, flags.left, new Const(0, flags.width), 32);
        return new Bin(op, new Bin("&", flags.left, flags.right, flags.width), new Const(0, flags.width), 32);
      }
    }
    if (expr instanceof Bin && expr.op === "+" && expr.right instanceof Const && expr.right.value < 0) {
      return new Bin("-", expr.left, new Const(-expr.right.value, expr.right.width), expr.width);
    }
    if (expr instanceof Cast && expr.expr instanceof Const) {
      const value = expr.expr.value;
      if (expr.kind === "zext") return new Const(zeroExtend(value, expr.expr.width), expr.width);
      return new Const(truncate(value, expr.width), expr.width);
    }
    if (expr instanceof Cast && expr.kind === "trunc") {
      const inner = expr.expr;
      if (inner instanceof Cast && (inner.kind === "zext" || inner.kind === "sext") && inner.expr.width === expr.width) return inner.expr;
      if (inner instanceof Bin && ["+", "-", "*"].includes(inner.op) && inner.width > expr.width) {
        const left = simplify(new Cast("trunc", inner.left, expr.width));
        const right = simplify(new Cast("trunc", inner.right, expr.width));
        return simplify(new Bin(inner.op, left, right, expr.width));
      }
    }
    if (expr instanceof Concat && expr.high instanceof SignFill && eq(expr.high.expr, expr.low)) return expr.low;
    if (expr instanceof Load) {
      const addr = expr.addr;
      if (addr instanceof Bin && addr.op === "+") {
        for (const [base, offset] of [[addr.left, addr.right], [addr.right, addr.left]]) {
          const scaled = offset instanceof Bin && offset.op === "*" && offset.right instanceof Const;
          if (scaled && (offset.right as Const).value * 8 === expr.width && (base instanceof Var || base instanceof Symbolic)) {
            return new Index(base, offset.left, expr.width);
          }
        }
      }
    }
    const folded = divisionPattern(expr);
    if (folded !== null) return folded;
    return expr;
  };
  return simplify;
}

type Uses = Map<string, [number, Stmt][]>;

export function countUses(fn: Func): Uses {
  const uses: Uses = new Map();
  const add = (key: string, entry: [number, Stmt]) => {
    if (!uses.has(key)) uses.set(key, []);
    uses.get(key)!.push(entry);
  };
  for (const block of fn.blocks.values()) {
    for (const stmt of block.stmts) {
      if (stmt instanceof PhiStmt) {
        for (const src of stmt.sources.values()) add(keyOf(src.name, src.version), [block.start, stmt]);
        continue;
      }
      for (const expr of stmtExprs(stmt)) {
        for (const v of variables(expr)) add(keyOf(v.name, v.version), [block.start, stmt]);
      }
    }
  }
  return uses;
}

function hasSideEffect(expr: Expr): boolean {
  return [...iterNodes(expr)].some((n) => n instanceof CallExpr);
}

function containsLoad(expr: Expr): boolean {
  return [...iterNodes(expr)].some((n) => n instanceof Load || n instanceof Index);
}

function stmtHasSideEffect(stmt: Stmt): boolean {
  return stmt instanceof Store || stmtExprs(stmt).some(hasSideEffect);
}

export function removeDeadCode(fn: Func, uses: Uses): boolean {
  let changed = false;
  for (const block of fn.blocks.values()) {
    const kept: Stmt[] = [];
    for (const stmt of block.stmts) {
      const dead = (stmt instanceof Assign || stmt instanceof PhiStmt) && !uses.has(keyOf(stmt.dst.name, stmt.dst.version));
      if (dead && !(stmt instanceof Assign && hasSideEffect(stmt.src))) {
        changed = true;
        continue;
      }
      kept.push(stmt);
    }
    block.stmts = kept;
  }
  return changed;
}

export function substituteOnce(fn: Func, uses: Uses): boolean {
  for (const block of fn.blocks.values()) {
    for (let position = 0; position < block.stmts.length; position++) {
      const stmt = block.stmts[position];
      if (!(stmt instanceof Assign) || hasSideEffect(stmt.src)) continue;
      const users = uses.get(keyOf(stmt.dst.name, stmt.dst.version)) ?? [];
      if (users.length !== 1 || users[0][1] instanceof PhiStmt) continue;
      const [userBlock, user] = users[0];
      const later = block.stmts.slice(position + 1);
      const sameBlock = userBlock === block.start && later.some((s) => s === user);
      const constantLike = stmt.src instanceof Const || stmt.src instanceof Symbolic;
      if (!(sameBlock || constantLike)) continue;
      if (containsLoad(stmt.src)) {
        const at = later.findIndex((s) => s === user);
        if (at < 0) throw new Error("StopIteration");
        if (later.slice(0, at).some(stmtHasSideEffect)) continue;
      }
      const target = stmt.dst;
      const src = stmt.src;
      mapStmt(user, (e) => rewrite(e, (x) => (eq(x, target) ? src : x)));
      block.stmts.splice(block.stmts.indexOf(stmt), 1);
      return true;
    }
  }
  return false;
}

export function optimize(fn: Func, recognizeDivision: boolean, rounds = 400): void {
  for (let round = 0; round < rounds; round++) {
    const defs = new Map<string, Expr>();
    for (const s of fn.statements()) {
      if (s instanceof Assign) defs.set(keyOf(s.dst.name, s.dst.version), s.src);
    }
    const simplify = makeSimplifier(defs, recognizeDivision);
    for (const stmt of fn.statements()) mapStmt(stmt, (e) => rewrite(e, simplify));
    const uses = countUses(fn);
    if (removeDeadCode(fn, uses)) continue;
    if (!substituteOnce(fn, uses)) return;
  }
}

export function liveKeys(fn: Func): Set<string> {
  const keys = new Set<string>();
  for (const stmt of fn.statements()) {
    if (stmt instanceof Assign || stmt instanceof PhiStmt) keys.add(keyOf(stmt.dst.name, stmt.dst.version));
    if (stmt instanceof PhiStmt) {
      for (const s of stmt.sources.values()) keys.add(keyOf(s.name, s.version));
    }
    for (const expr of stmtExprs(stmt)) {
      for (const v of variables(expr)) keys.add(keyOf(v.name, v.version));
    }
  }
  return keys;
}

export function collectParams(fn: Func): void {
  const entryReads = [...liveKeys(fn)].map(keyParts).filter((k) => k[1] === 0);
  const used = entryReads.map(([name]) => name).filter((name) => ARG_REGISTERS.includes(name));
  const count = Math.max(-1, ...used.map((name) => ARG_REGISTERS.indexOf(name))) + 1;
  fn.params = ARG_REGISTERS.slice(0, count);
  fn.paramWidths = new Map(fn.params.map((name) => [name, fn.defWidth.get(keyOf(name, 0)) ?? 64] as [string, number]));
  fn.undefinedReads = entryReads
    .map(([name]) => name)
    .filter((name) => !ARG_REGISTERS.includes(name))
    .sort(cmpStr);
}

export function coalesceWebs(fn: Func): void {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    if (!parent.has(key)) parent.set(key, key);
    while (parent.get(key) !== key) {
      parent.set(key, parent.get(parent.get(key)!)!);
      key = parent.get(key)!;
    }
    return key;
  };
  for (const key of liveKeys(fn)) find(key);
  for (const stmt of fn.statements()) {
    if (stmt instanceof PhiStmt) {
      for (const src of stmt.sources.values()) {
        const rootA = find(keyOf(stmt.dst.name, stmt.dst.version));
        const rootB = find(keyOf(src.name, src.version));
        if (rootA !== rootB) parent.set(rootA, rootB);
      }
    }
  }
  const webs = new Map<string, Key[]>();
  for (const key of [...parent.keys()]) {
    const root = find(key);
    if (!webs.has(root)) webs.set(root, []);
    webs.get(root)!.push(keyParts(key));
  }
  const counters = new Map<string, number>();
  const groups = [...webs.values()].map((members) => [...members].sort(cmpKey));
  groups.sort((a, b) => cmpKey(a[0], b[0]));
  for (const members of groups) {
    const width = Math.max(...members.map(([n, v]) => fn.defWidth.get(keyOf(n, v)) ?? 0));
    const [name, version] = members[0];
    let label: string;
    if (fn.params.includes(name) && version === 0) {
      label = `param_${fn.params.indexOf(name) + 1}`;
    } else if (name.startsWith("local_") || name.startsWith("arg_")) {
      label = name;
    } else if (version === 0) {
      label = `undefined_${name}`;
    } else {
      const register = width === 64 || !REG64.includes(name) ? name : REG32[REG64.indexOf(name)];
      counters.set(register, (counters.get(register) ?? 0) + 1);
      label = `${register}_${counters.get(register)}`;
    }
    for (const [n, v] of members) fn.webNames.set(keyOf(n, v), label);
    fn.webTypes.set(label, width === 64 ? "long" : "int");
  }
}

export function inferTypes(fn: Func): void {
  const aliases = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    if (!aliases.has(a)) aliases.set(a, new Set([a]));
    if (!aliases.has(b)) aliases.set(b, new Set([b]));
    const group = new Set([...aliases.get(a)!, ...aliases.get(b)!]);
    for (const member of group) aliases.set(member, group);
  };
  const web = (v: Var): string => {
    const label = fn.webNames.get(keyOf(v.name, v.version));
    if (label === undefined) throw new Error(`KeyError: (${pyRepr(v.name)}, ${v.version})`);
    return label;
  };
  const pointerEvidence = new Map<string, string>();
  const returned: number[] = [];
  for (const stmt of fn.statements()) {
    if (stmt instanceof Assign && stmt.src instanceof Var) link(web(stmt.dst), web(stmt.src));
    if (stmt instanceof PhiStmt) {
      for (const src of stmt.sources.values()) link(web(stmt.dst), web(src));
    }
    if (stmt instanceof Return) returned.push(widthOf(stmt.value));
    for (const expr of stmtExprs(stmt)) {
      for (const node of iterNodes(expr)) {
        if (node instanceof Index && node.base instanceof Var) pointerEvidence.set(web(node.base), `${ctype(node.width)} *`);
      }
    }
  }
  for (const [label, pointerType] of pointerEvidence) {
    for (const member of aliases.get(label) ?? new Set([label])) fn.webTypes.set(member, pointerType);
  }
  if (!returned.length) fn.returnType = "void";
  else fn.returnType = Math.max(...returned) === 64 ? "long" : "int";
}

const PRECEDENCE = new Map([
  ["*", 13], ["/", 13], ["%", 13], ["+", 12], ["-", 12], ["<<", 11], [">>s", 11], [">>u", 11],
  ["<", 10], ["<=", 10], [">", 10], [">=", 10], ["<u", 10], ["<=u", 10], [">u", 10], [">=u", 10],
  ["==", 9], ["!=", 9], ["&", 8], ["^", 7], ["|", 6],
]);

export function ctype(width: number): string {
  const name = new Map([[8, "char"], [16, "short"], [32, "int"], [64, "long"]]).get(width);
  if (name === undefined) throw new Error(`KeyError: ${width}`);
  return name;
}

function utype(width: number): string {
  return "unsigned " + ctype(width);
}

function declaration(typeName: string, label: string): string {
  return typeName.endsWith("*") ? `${typeName}${label}` : `${typeName} ${label}`;
}

function stripDots(s: string): string {
  return s.replace(/^\.+|\.+$/g, "");
}

export class Emitter {
  constructor(public fn: Func) {}

  name(v: Var): string {
    return this.fn.webNames.get(keyOf(v.name, v.version)) ?? `${v.name}_${v.version}`;
  }

  const(c: Const): string {
    return constText(c.value);
  }

  tableName(sym: Symbolic): string {
    const label = sym.section === ".rodata" ? `lookup_${sym.offset.toString(16)}` : `${stripDots(sym.section)}_${sym.offset.toString(16)}`;
    this.fn.tables.set(label, [sym.section, sym.offset]);
    return label;
  }

  wrap(text: string, prec: number, parent: number): string {
    return prec < parent ? `(${text})` : text;
  }

  unsigned(e: Expr): string {
    if (e instanceof Const) return this.const(e);
    return `(${utype(widthOf(e))})${this.expr(e, 14)}`;
  }

  expr(e: Expr, parent = 0): string {
    if (e instanceof Const) return this.const(e);
    if (e instanceof Var) return this.name(e);
    if (e instanceof Symbolic) return this.wrap(`(long)&${this.tableName(e)}`, 14, parent);
    if (e instanceof Index) {
      const base = e.base instanceof Symbolic ? this.tableName(e.base) : this.expr(e.base, 20);
      return `${base}[${this.expr(e.index)}]`;
    }
    if (e instanceof Load) return `*(${ctype(e.width)} *)(${this.expr(e.addr)})`;
    if (e instanceof Cast) {
      const inner = this.expr(e.expr, 14);
      if (e.kind === "zext") return this.wrap(`(${utype(e.width)})(${utype(e.expr.width)})${inner}`, 14, parent);
      return this.wrap(`(${ctype(e.width)})${inner}`, 14, parent);
    }
    if (e instanceof Bin) {
      const prec = PRECEDENCE.get(e.op)!;
      if (e.op === ">>u") return this.wrap(`${this.unsigned(e.left)} >> ${this.expr(e.right, prec + 1)}`, prec, parent);
      if (e.op.endsWith("u")) {
        const left = this.unsigned(e.left);
        const right = this.unsigned(e.right);
        return this.wrap(`${left} ${e.op.slice(0, -1)} ${right}`, prec, parent);
      }
      const op = e.op === ">>s" ? ">>" : e.op;
      return this.wrap(`${this.expr(e.left, prec)} ${op} ${this.expr(e.right, prec + 1)}`, prec, parent);
    }
    if (e instanceof Concat) {
      const high = this.expr(e.high, 14);
      const low = this.expr(e.low, 14);
      return `((${ctype(e.width)})${high} << ${e.low.width} | (${utype(e.low.width)})${low})`;
    }
    if (e instanceof SignFill) return this.wrap(`${this.expr(e.expr, 11)} >> ${e.width - 1}`, 11, parent);
    if (e instanceof CallExpr) return `${e.name}(${e.args.map((a) => this.expr(a)).join(", ")})`;
    if (e instanceof Flags) return `flags_of_${e.kind}(${this.expr(e.left)}, ${this.expr(e.right)})`;
    return `${e.cc}(${this.expr(e.flags)})`;
  }

  targetWidth(label: string): number {
    return (this.fn.webTypes.get(label) ?? "int") === "int" ? 32 : 64;
  }

  assign(stmt: Assign): string {
    const label = this.name(stmt.dst);
    const width = this.targetWidth(label);
    const src = stmt.src;
    if (src instanceof Const) return `${label} = ${this.const(src)};`;
    if (widthOf(src) < width && !(src instanceof Symbolic)) return `${label} = (${utype(width)})(${utype(widthOf(src))})${this.expr(src, 14)};`;
    if (widthOf(src) > width) return `${label} = (${ctype(width)})${this.expr(src, 14)};`;
    return `${label} = ${this.expr(src)};`;
  }

  plain(stmt: Stmt, uses: Uses): string | null {
    if (stmt instanceof Assign) {
      if (stmt.src instanceof CallExpr && !uses.has(keyOf(stmt.dst.name, stmt.dst.version))) return `${this.expr(stmt.src)};`;
      return this.assign(stmt);
    }
    if (stmt instanceof Store) return `*(${ctype(stmt.width)} *)(${this.expr(stmt.addr)}) = ${this.expr(stmt.value)};`;
    if (stmt instanceof Return) return `return ${this.expr(stmt.value)};`;
    if (stmt instanceof IndirectJump) return `goto *(void *)${this.expr(stmt.target, 14)}; /* indirect jump: the target table is not resolved here */`;
    return null;
  }
}

export function negate(cond: Expr): Expr {
  if (cond instanceof Bin && NEGATE.has(cond.op)) return new Bin(NEGATE.get(cond.op)!, cond.left, cond.right, cond.width);
  return new Bin("==", cond, new Const(0, 32), 32);
}

export function naturalLoops(fn: Func): Map<number, Set<number>> {
  const preds = fn.preds();
  const loops = new Map<number, Set<number>>();
  for (const block of fn.blocks.values()) {
    for (const succ of block.succs) {
      if (dominates(fn.idom, succ, block.start)) {
        const body = new Set([succ]);
        const stack = [block.start];
        while (stack.length) {
          const node = stack.pop()!;
          if (body.has(node)) continue;
          body.add(node);
          stack.push(...preds.get(node)!);
        }
        if (!loops.has(succ)) loops.set(succ, new Set());
        for (const n of body) loops.get(succ)!.add(n);
      }
    }
  }
  return loops;
}

export function postDominators(fn: Func): Map<number, number> {
  const succs = fn.succs();
  const preds = fn.preds();
  const exits = [...succs].filter(([, s]) => !s.length).map(([b]) => b);
  const reverseSuccs: Graph = new Map([...preds].map(([b, p]) => [b, [...p]] as [number, number[]]));
  reverseSuccs.set(EXIT, exits);
  const reversePreds: Graph = new Map([...succs].map(([b, s]) => [b, [...s, ...(exits.includes(b) ? [EXIT] : [])]] as [number, number[]]));
  reversePreds.set(EXIT, []);
  return immediateDominators(EXIT, reverseSuccs, reversePreds);
}

export function structure(fn: Func): string[] {
  const emitter = new Emitter(fn);
  const uses = countUses(fn);
  const succs = fn.succs();
  fn.ipdom = postDominators(fn);
  const loops = naturalLoops(fn);
  const lines: string[] = [];
  const emitted = new Set<number>();

  const emit = (text: string, depth: number): void => {
    lines.push("  ".repeat(depth) + text);
  };
  const terminator = (block: Block): Stmt | null => {
    const last = block.stmts[block.stmts.length - 1];
    return last !== undefined && isTerminator(last) ? last : null;
  };
  const body = (block: Block, depth: number): void => {
    for (const stmt of block.stmts) {
      if (stmt instanceof PhiStmt || stmt instanceof Branch || stmt instanceof Jump) continue;
      const text = emitter.plain(stmt, uses);
      if (text !== null) emit(text, depth);
    }
  };
  const regionSize = (start: number, stop: number): number => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const node = stack.pop()!;
      if (seen.has(node) || node === stop || node === EXIT) continue;
      seen.add(node);
      stack.push(...succs.get(node)!);
    }
    return seen.size;
  };

  const walk = (blockId: number, stop: number, depth: number): void => {
    if (blockId === stop || blockId === EXIT || emitted.has(blockId)) return;
    const block = fn.blocks.get(blockId)!;
    if (loops.has(blockId)) {
      emitLoop(block, stop, depth);
      return;
    }
    emitted.add(blockId);
    const term = terminator(block);
    body(block, depth);
    if (term instanceof Branch) emitBranch(block, term, stop, depth);
    else if (term instanceof Jump) walk(term.target, stop, depth);
    else if (term === null && block.succs.length) walk(block.succs[0], stop, depth);
  };

  const emitBranch = (block: Block, term: Branch, stop: number, depth: number): void => {
    const join = fn.ipdom.get(block.start)!;
    const taken = term.target;
    const fall = term.fallthrough;
    if (join === taken) {
      emit(`if (${emitter.expr(negate(term.cond))}) {`, depth);
      walk(fall, join, depth + 1);
      emit("}", depth);
      walk(join, stop, depth);
    } else if (join === fall) {
      emit(`if (${emitter.expr(term.cond)}) {`, depth);
      walk(taken, join, depth + 1);
      emit("}", depth);
      walk(join, stop, depth);
    } else if (join === EXIT || join === stop) {
      let [first, second, cond] = [taken, fall, term.cond];
      if (regionSize(fall, join) < regionSize(taken, join)) [first, second, cond] = [fall, taken, negate(term.cond)];
      emit(`if (${emitter.expr(cond)}) {`, depth);
      walk(first, join, depth + 1);
      emit("}", depth);
      walk(second, join, depth);
    } else {
      emit(`if (${emitter.expr(term.cond)}) {`, depth);
      walk(taken, join, depth + 1);
      emit("} else {", depth);
      walk(fall, join, depth + 1);
      emit("}", depth);
      walk(join, stop, depth);
    }
  };

  const emitLoop = (header: Block, stop: number, depth: number): void => {
    const members = loops.get(header.start)!;
    const exitSet = new Set<number>();
    for (const b of members) {
      for (const s of succs.get(b)!) {
        if (!members.has(s)) exitSet.add(s);
      }
    }
    const exits = [...exitSet].sort((a, b) => a - b);
    const exitBlock = exits.length ? exits[0] : EXIT;
    const term = terminator(header);
    emitted.add(header.start);
    const selfLoop = succs.get(header.start)!.includes(header.start);
    const headerExits = term instanceof Branch && (!members.has(term.target) || !members.has(term.fallthrough));
    if (headerExits && !selfLoop) {
      const branch = term as Branch;
      const cond = !members.has(branch.fallthrough) ? branch.cond : negate(branch.cond);
      const inner = members.has(branch.target) ? branch.target : branch.fallthrough;
      body(header, depth);
      emit(`while (${emitter.expr(cond)}) {`, depth);
      walk(inner, header.start, depth + 1);
      emit("}", depth);
    } else {
      const latch = selfLoop ? header : fn.blocks.get([...members].filter((b) => succs.get(b)!.includes(header.start))[0])!;
      const latchTerm = terminator(latch) as Branch;
      emit("do {", depth);
      body(header, depth + 1);
      if (latch !== header) {
        for (const succ of header.succs) walk(succ, latch.start, depth + 1);
        emitted.add(latch.start);
        body(latch, depth + 1);
      }
      const cond = latchTerm.target === header.start ? latchTerm.cond : negate(latchTerm.cond);
      emit(`} while (${emitter.expr(cond)});`, depth);
    }
    walk(exitBlock, stop, depth);
  };

  walk(fn.entry, EXIT, 1);
  return lines;
}

export class IrPrinter {
  constructor(public fn: Func, public versions: boolean) {}

  var(v: Var): string {
    let name: string;
    const index = REG64.indexOf(v.name);
    if (index >= 0) {
      const width = v.width || (this.fn.defWidth.get(keyOf(v.name, v.version)) ?? 64);
      name = width === 32 ? REG32[index] : width === 16 ? REG16[index] : v.name;
    } else {
      name = v.name;
    }
    return this.versions && v.version >= 0 ? `${name}_${v.version}` : name;
  }

  expr(e: Expr): string {
    if (e instanceof Const) return constText(e.value);
    if (e instanceof Var) return this.var(e);
    if (e instanceof Bin) return `${this.expr(e.left)} ${e.op} ${this.expr(e.right)}`;
    if (e instanceof Cast) return `${e.kind}${e.width}(${this.expr(e.expr)})`;
    if (e instanceof Load) return `load${e.width}(${this.expr(e.addr)})`;
    if (e instanceof Index) return `${this.expr(e.base)}[${this.expr(e.index)}]`;
    if (e instanceof Flags) return `${e.kind}(${this.expr(e.left)}, ${this.expr(e.right)})`;
    if (e instanceof Cond) return `${e.cc}(${this.expr(e.flags)})`;
    if (e instanceof Concat) return `${this.expr(e.high)}:${this.expr(e.low)}`;
    if (e instanceof SignFill) return `signfill(${this.expr(e.expr)})`;
    if (e instanceof Symbolic) return `&${e.section}+0x${e.offset.toString(16)}`;
    return `call ${e.name}(${e.args.map((a) => this.expr(a)).join(", ")})`;
  }

  stmt(s: Stmt): string {
    if (s instanceof Assign) return `${this.var(s.dst)} = ${this.expr(s.src)}`;
    if (s instanceof PhiStmt) {
      const inner = [...s.sources]
        .sort((a, b) => a[0] - b[0])
        .map(([p, v]) => `0x${p.toString(16)}: ${this.var(v)}`)
        .join(", ");
      return `${this.var(s.dst)} = phi(${inner})`;
    }
    if (s instanceof Store) return `store${s.width}(${this.expr(s.addr)}) = ${this.expr(s.value)}`;
    if (s instanceof Branch) return `if ${this.expr(s.cond)} goto 0x${s.target.toString(16)} else goto 0x${s.fallthrough.toString(16)}`;
    if (s instanceof Jump) return `goto 0x${s.target.toString(16)}`;
    if (s instanceof IndirectJump) return `goto *${this.expr(s.target)}`;
    return `return ${this.expr(s.value)}`;
  }

  dump(): string {
    const lines: string[] = [];
    for (const block of this.fn.orderedBlocks()) {
      const succs = block.succs.map((s) => `0x${s.toString(16)}`).join(", ") || "exit";
      lines.push(`block 0x${block.start.toString(16)} -> ${succs}`);
      for (const stmt of block.stmts) lines.push(`  ${this.stmt(stmt)}`);
    }
    return lines.join("\n");
  }
}

export function tableValues(obj: ElfObject, section: string, offset: number, width: number): number[] {
  const data = obj.section(section).data;
  const referenced = new Set(
    (obj.relocations.get(".text") ?? []).filter((r) => r.symbol === section && r.type === R_X86_64_PC32).map((r) => r.addend + 4),
  );
  referenced.add(data.length);
  const end = Math.min(...[...referenced].filter((t) => t > offset));
  const size = width / 8;
  const count = Math.floor((end - offset) / size);
  return Array.from({ length: count }, (_, i) => sint(data, offset + i * size, size));
}

export class Lifted {
  constructor(
    public fn: Func,
    public decoded: Insn[],
    public irText: string,
    public ssaText: string,
    public pseudocode: string,
    public dataDefinitions: string[],
  ) {}

  get unit(): string {
    return [...this.dataDefinitions, this.pseudocode].join("\n");
  }
}

export function liftFunction(obj: ElfObject, name: string, signatures: Signatures | null = null, recognizeDivision = true): Lifted {
  const symbol = obj.function(name);
  const text = obj.section(".text").data;
  const decoded = decodeRange(text, symbol.value, obj.functionEnd(symbol));
  const insns = [...decoded];
  while (insns.length > 1 && insns[insns.length - 1].mnemonic === "nop" && insns[insns.length - 1].address >= symbol.value + symbol.size) insns.pop();
  const blocks = buildBlocks(insns);
  const fn = new Func(name, insns, blocks, symbol.value);
  const ctx = new LiftContext(obj, signatures ?? new Map());
  for (const block of fn.orderedBlocks()) {
    for (const insn of block.insns) block.stmts.push(...liftInsn(insn, ctx));
  }
  const live = reachable(fn.entry, fn.succs());
  const dropped = [...fn.blocks.keys()].filter((b) => !live.has(b)).sort((a, b) => a - b);
  if (dropped.length) {
    fn.notes.push(
      `${dropped.length} block(s) at ${dropped.map((b) => `0x${b.toString(16)}`).join(", ")} are reached only through an indirect jump and were not lifted`,
    );
    fn.blocks = new Map([...fn.blocks].filter(([b]) => live.has(b)));
    for (const block of fn.blocks.values()) block.preds = block.preds.filter((p) => live.has(p));
  }
  fn.idom = immediateDominators(fn.entry, fn.succs(), fn.preds());
  const irText = new IrPrinter(fn, false).dump();
  insertPhis(fn);
  rename(fn);
  const ssaText = new IrPrinter(fn, true).dump();
  optimize(fn, recognizeDivision);
  collectParams(fn);
  coalesceWebs(fn);
  inferTypes(fn);
  const body = structure(fn);
  const emitter = new Emitter(fn);
  const tableWidths = new Map<string, number>();
  for (const stmt of fn.statements()) {
    for (const expr of stmtExprs(stmt)) {
      for (const node of iterNodes(expr)) {
        if (node instanceof Index && node.base instanceof Symbolic) tableWidths.set(emitter.tableName(node.base), node.width);
      }
    }
  }
  const dataDefinitions: string[] = [];
  const tables = [...fn.tables].sort((a, b) => cmpStr(a[1][0], b[1][0]) || a[1][1] - b[1][1]);
  for (const [label, [section, offset]] of tables) {
    const width = tableWidths.get(label) ?? 32;
    const values = tableValues(obj, section, offset, width);
    dataDefinitions.push(`static const ${ctype(width)} ${label}[${values.length}] = {${values.map(String).join(", ")}};`);
  }
  const params = fn.params.map((_, i) => declaration(fn.webTypes.get(`param_${i + 1}`) ?? "long", `param_${i + 1}`)).join(", ");
  const used = new Set<string>();
  for (const s of fn.statements()) {
    for (const e of stmtExprs(s)) {
      for (const v of variables(e)) used.add(emitter.name(v));
    }
  }
  for (const s of fn.statements()) {
    if (s instanceof Assign || s instanceof PhiStmt) used.add(emitter.name(s.dst));
  }
  const declared = [...used].filter((n) => !n.startsWith("param_")).sort(cmpStr);
  const header = [`${fn.returnType} ${name}(${params || "void"})`, "{"];
  header.push(...declared.map((label) => `  ${declaration(fn.webTypes.get(label) ?? "int", label)};`));
  header.push(...fn.notes.map((note) => `  /* ${note} */`));
  if (declared.length || fn.notes.length) header.push("");
  const pseudocode = [...header, ...body, "}"].join("\n");
  return new Lifted(fn, decoded, irText, ssaText, pseudocode, dataDefinitions);
}

export function liftAll(obj: ElfObject, recognizeDivision = true): Map<string, Lifted> {
  const signatures: Signatures = new Map();
  const results = new Map<string, Lifted>();
  for (const symbol of obj.functions()) {
    const lifted = liftFunction(obj, symbol.name, signatures, recognizeDivision);
    const fn = lifted.fn;
    const widths = fn.params.map((p) => fn.defWidth.get(keyOf(p, 0))!);
    signatures.set(symbol.name, [widths, fn.returnType === "long" ? 64 : 32]);
    results.set(symbol.name, lifted);
  }
  return results;
}

export function ghidraPseudocode(name: string): string {
  const record = JSON.parse(readFileSync(join(FIXTURES, "ghidra", `${name}.json`), "utf-8"));
  return String(record.raw_result.value).replace(/^\n+|\n+$/g, "");
}

function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += "\\x" + code.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + quote;
}

export function compareWithObjdump(lifted: Map<string, Lifted>, objdumpText: string): string[] {
  const objdump = parseObjdump(objdumpText);
  const mismatches: string[] = [];
  for (const [name, result] of lifted) {
    const expected = objdump.get(name);
    if (expected === undefined) throw new Error(`KeyError: ${pyRepr(name)}`);
    if (expected.length !== result.decoded.length) {
      mismatches.push(`${name}: ${result.decoded.length} decoded instructions, objdump lists ${expected.length}`);
    }
    const n = Math.min(expected.length, result.decoded.length);
    for (let k = 0; k < n; k++) {
      const insn = result.decoded[k];
      const [address, raw, asm] = expected[k];
      if (insn.address !== address || insn.raw.toString("hex") !== raw || insn.att() !== asm) {
        mismatches.push(`0x${insn.address.toString(16)}: ours=${pyRepr(insn.att())} objdump=${pyRepr(asm)}`);
      }
    }
  }
  return mismatches;
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function sideBySide(left: string, right: string, leftTitle: string, rightTitle: string, width = 46): string {
  const leftLines = splitLines(left);
  const rightLines = splitLines(right);
  const rows = [`${leftTitle.padEnd(width)} | ${rightTitle}`, `${"-".repeat(width)}-+-${"-".repeat(width)}`];
  for (let i = 0; i < Math.max(leftLines.length, rightLines.length); i++) {
    const a = i < leftLines.length ? leftLines[i] : "";
    const b = i < rightLines.length ? rightLines[i] : "";
    rows.push(`${a.padEnd(width)} | ${b}`);
  }
  return rows.join("\n");
}

export function demo(): void {
  const o1 = readObject(join(FIXTURES, "ledger-x86_64-O1.o"));
  const o0 = readObject(join(FIXTURES, "ledger-x86_64-O0.o"));
  const lifted = liftAll(o1);
  const mismatches = compareWithObjdump(lifted, readFileSync(join(FIXTURES, "ledger-x86_64-O1.objdump.txt"), "utf-8"));
  const decoded = [...lifted.values()].reduce((sum, v) => sum + v.decoded.length, 0);
  console.log(`== ledger-x86_64-O1.o: ${decoded} instructions decoded, ${mismatches.length} differences from llvm-objdump ==`);
  for (const line of mismatches) console.log("  " + line);
  for (const name of ["percent_change", "grade", "total"]) {
    const result = lifted.get(name)!;
    console.log(`\n== ${name} at -O1: IR before SSA ==`);
    console.log(result.irText);
    console.log(`-- ${name}: SSA with phi functions --`);
    console.log(result.ssaText);
    console.log(`-- ${name}: our pseudocode next to Ghidra 12.1.4 through rea 6.5.0 --`);
    console.log(sideBySide(result.unit, ghidraPseudocode(name), "lifter", "ghidra"));
  }
  console.log("\n== grade at -O1 with division recognition switched off ==");
  console.log(liftAll(o1, false).get("grade")!.pseudocode);
  console.log("\n== ledger-x86_64-O0.o: stack slots become local variables ==");
  const o0Lifted = liftAll(o0);
  for (const name of ["percent_change", "total", "grade_label"]) {
    console.log(o0Lifted.get(name)!.pseudocode);
    console.log();
  }
  const summary = {
    functions: [...lifted.keys()].sort(cmpStr),
    instructions: decoded,
    blocks: Object.fromEntries([...lifted].map(([name, v]) => [name, v.fn.blocks.size])),
    phis: Object.fromEntries([...lifted].map(([name, v]) => [name, v.fn.statements().filter((s) => s instanceof PhiStmt).length])),
    objdumpDifferences: mismatches.length,
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  demo();
}
