// Lesson: Compiler Idioms: What Optimization Does to Your Code and How to Read It Back (phase 13 / lesson 39)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code/main.ts

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

type J = null | boolean | number | string | J[] | { [key: string]: J };
type Obj = { [key: string]: J };

const HERE = dirname(resolve(process.argv[1]));
const FIXTURES = join(HERE, "fixtures");

const LEVELS = ["O0", "O1", "O2", "O3"];
const ARCHES = ["x86_64", "arm64"];
const PARAM_REGISTERS: { [arch: string]: string[] } = {
  x86_64: ["di", "si", "d", "c", "r8", "r9"],
  arm64: ["0", "1", "2", "3", "4", "5", "6", "7"],
};
const SIMD_REGISTER = /%[xy]mm\d+|\bv\d+\.\d+[bhsd]\b|\bq\d+\b/;
const X86_SIZE_SUFFIX = new Set(["q", "l", "w", "b"]);
const X86_CONDITIONS = new Map<string, string>([
  ["e", "=="], ["ne", "!="], ["g", ">"], ["ge", ">="], ["l", "<"], ["le", "<="],
  ["a", ">"], ["ae", ">="], ["b", "<"], ["be", "<="], ["s", "< 0"], ["ns", ">= 0"],
]);
const ARM_CONDITIONS = new Map<string, string>([
  ["eq", "=="], ["ne", "!="], ["gt", ">"], ["ge", ">="], ["lt", "<"], ["le", "<="],
  ["hi", ">"], ["hs", ">="], ["cs", ">="], ["lo", "<"], ["cc", "<"], ["ls", "<="], ["mi", "< 0"], ["pl", ">= 0"],
]);
const UNSIGNED_CONDITIONS = new Set(["a", "ae", "b", "be", "hi", "hs", "cs", "lo", "cc", "ls"]);

function pyStr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

function hex(value: number | bigint): string {
  return "0x" + value.toString(16);
}

function bitAnd(a: number, b: number): number {
  return Number(BigInt(a) & BigInt(b));
}

function bitOr(a: number, b: number): number {
  return Number(BigInt(a) | BigInt(b));
}

function stripLeft(text: string, chars: string): string {
  let start = 0;
  while (start < text.length && chars.includes(text[start])) start++;
  return text.slice(start);
}

function stripBoth(text: string, chars: string): string {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end--;
  return stripLeft(text.slice(0, end), chars);
}

function splitWhitespace(text: string): string[] {
  return text.split(/\s+/).filter((part) => part.length > 0);
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function numericSort(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

function textSort(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function uniqueSorted(values: Iterable<number>): number[] {
  return numericSort(new Set(values));
}

function sameSet<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function sameList<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, k) => value === b[k]);
}

function lastOf<T>(items: T[]): T {
  return items[items.length - 1];
}

class Instruction {
  constructor(
    public address: number,
    public raw: string,
    public mnemonic: string,
    public operands: string[],
    public size: number,
    public relocation: [string, string] | null = null,
  ) {}

  get text(): string {
    return this.mnemonic + (this.operands.length ? " " + this.operands.join(", ") : "");
  }

  get end(): number {
    return this.address + this.size;
  }

  get relocationSymbol(): string | null {
    if (this.relocation === null) return null;
    const match = /^([^+-]+)/.exec(this.relocation[1]);
    return match ? match[1] : null;
  }

  get relocationAddend(): number {
    if (this.relocation === null) return 0;
    const match = /([+-]0x[0-9a-f]+)$/.exec(this.relocation[1]);
    if (!match) return 0;
    const value = parseInt(match[1].slice(3), 16);
    return match[1][0] === "-" ? -value : value;
  }
}

class Func {
  instructions: Instruction[] = [];

  constructor(public name: string, public start: number, public arch: string) {}

  get end(): number {
    return this.instructions.length ? lastOf(this.instructions).end : this.start;
  }

  at(address: number): Instruction | null {
    for (const instruction of this.instructions) {
      if (instruction.address === address) return instruction;
    }
    return null;
  }

  index(address: number): number {
    for (let position = 0; position < this.instructions.length; position++) {
      if (this.instructions[position].address === address) return position;
    }
    throw new Error("KeyError: " + hex(address));
  }

  body(): Instruction[] {
    return this.instructions.filter((i) => !i.mnemonic.startsWith("nop"));
  }
}

class Listing {
  constructor(public name: string, public arch: string, public functions: Map<string, Func>) {}

  textOf(fn: string): string {
    return this.functions.get(fn)!.instructions.map((i) => i.text).join("\n");
  }
}

function splitOperands(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if ("([".includes(char)) {
      depth += 1;
    } else if (")]".includes(char)) {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const HEADER = /^([0-9a-f]+) <([^>]+)>:$/;
const RELOC_LINE = /^\s*([0-9a-f]{16}):\s+(R_\w+)\s+(\S+)$/;
const INSN_LINE = /^\s*([0-9a-f]+):\s*(.*)$/;
const SYMBOL_SUFFIX = /\s*<[^>]*>/g;

function parseListing(text: string, name = ""): Listing {
  const arch = text.includes("littleaarch64") ? "arm64" : "x86_64";
  const functions = new Map<string, Func>();
  let current: Func | null = null;
  for (const line of splitLines(text)) {
    const header = HEADER.exec(line);
    if (header) {
      current = new Func(header[2], parseInt(header[1], 16), arch);
      functions.set(current.name, current);
      continue;
    }
    if (current === null) continue;
    const reloc = RELOC_LINE.exec(line);
    if (reloc && current.instructions.length) {
      lastOf(current.instructions).relocation = [reloc[2], reloc[3]];
      continue;
    }
    const match = INSN_LINE.exec(line);
    if (!match || !match[2].includes("\t")) continue;
    const fields = match[2].split("\t");
    const raw = splitWhitespace(fields[0]).join(" ");
    const mnemonic = fields[1].trim();
    let operandText = fields.length > 2 ? fields[2] : "";
    operandText = arch === "x86_64" ? operandText.split("#")[0] : operandText.split("//")[0];
    operandText = operandText.replace(SYMBOL_SUFFIX, "").trim();
    const size = arch === "arm64" ? 4 : splitWhitespace(raw).length;
    current.instructions.push(new Instruction(parseInt(match[1], 16), raw, mnemonic, splitOperands(operandText), size));
  }
  return new Listing(name, arch, functions);
}

function loadListing(name: string): Listing {
  return parseListing(readFileSync(join(FIXTURES, name), "utf-8"), name);
}

const SHT_SYMTAB = 2;
const SHT_RELA = 4;
const SHT_NOBITS = 8;
const STT_SECTION = 3;

interface Section {
  index: number;
  name: string;
  type: number;
  data: Buffer;
  link: number;
  info: number;
  size: number;
}

interface ElfSymbol {
  name: string;
  value: number;
  size: number;
  type: number;
  section: string;
}

interface Relocation {
  offset: number;
  type: number;
  symbol: string;
  base: number;
  addend: number;
}

class ElfFile {
  machine: number;
  sections: Section[] = [];
  symbols: ElfSymbol[] = [];
  relocations = new Map<string, Relocation[]>();

  constructor(data: Buffer) {
    if (!(data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46) || data[4] !== 2) {
      throw new Error("not an ELF64 file");
    }
    this.machine = data.readUInt16LE(18);
    const shoff = Number(data.readBigUInt64LE(40));
    const shentsize = data.readUInt16LE(58);
    const shnum = data.readUInt16LE(60);
    const shstrndx = data.readUInt16LE(62);
    const raw: number[][] = [];
    for (let i = 0; i < shnum; i++) {
      const at = shoff + i * shentsize;
      raw.push([
        data.readUInt32LE(at),
        data.readUInt32LE(at + 4),
        Number(data.readBigUInt64LE(at + 8)),
        Number(data.readBigUInt64LE(at + 16)),
        Number(data.readBigUInt64LE(at + 24)),
        Number(data.readBigUInt64LE(at + 32)),
        data.readUInt32LE(at + 40),
        data.readUInt32LE(at + 44),
        Number(data.readBigUInt64LE(at + 48)),
        Number(data.readBigUInt64LE(at + 56)),
      ]);
    }
    const names = raw[shstrndx];
    const table = data.subarray(names[4], names[4] + names[5]);
    raw.forEach(([shName, shType, , , shOffset, shSize, shLink, shInfo], index) => {
      const end = table.indexOf(0, shName);
      const payload = shType === SHT_NOBITS ? Buffer.alloc(0) : data.subarray(shOffset, shOffset + shSize);
      this.sections.push({ index, name: table.subarray(shName, end).toString("utf-8"), type: shType, data: payload, link: shLink, info: shInfo, size: shSize });
    });
    for (const section of this.sections) {
      if (section.type !== SHT_SYMTAB) continue;
      const strings = this.sections[section.link].data;
      for (let offset = 0; offset < section.size; offset += 24) {
        const d = section.data;
        const stName = d.readUInt32LE(offset);
        const stInfo = d.readUInt8(offset + 4);
        const stShndx = d.readUInt16LE(offset + 6);
        const stValue = Number(d.readBigUInt64LE(offset + 8));
        const stSize = Number(d.readBigUInt64LE(offset + 16));
        const end = strings.indexOf(0, stName);
        const sectionName = stShndx < this.sections.length ? this.sections[stShndx].name : "";
        this.symbols.push({ name: strings.subarray(stName, end).toString("utf-8"), value: stValue, size: stSize, type: stInfo & 0xf, section: sectionName });
      }
    }
    for (const section of this.sections) {
      if (section.type !== SHT_RELA) continue;
      const target = this.sections[section.info].name;
      for (let offset = 0; offset < section.size; offset += 24) {
        const d = section.data;
        const rOffset = Number(d.readBigUInt64LE(offset));
        const rInfo = d.readBigUInt64LE(offset + 8);
        const rAddend = Number(d.readBigInt64LE(offset + 16));
        const symbol = this.symbols[Number(rInfo >> 32n)];
        const base = symbol.type === STT_SECTION ? 0 : symbol.value;
        if (!this.relocations.has(target)) this.relocations.set(target, []);
        this.relocations.get(target)!.push({ offset: rOffset, type: Number(rInfo & 0xffffffffn), symbol: symbol.type === STT_SECTION ? symbol.section : symbol.name, base, addend: rAddend });
      }
    }
  }

  section(name: string): Buffer {
    for (const section of this.sections) {
      if (section.name === name) return section.data;
    }
    throw new Error("KeyError: " + name);
  }

  relocationAt(section: string, offset: number): Relocation | null {
    for (const relocation of this.relocations.get(section) ?? []) {
      if (relocation.offset === offset) return relocation;
    }
    return null;
  }

  words(section: string, offset: number, count: number, size = 4, signed = true): number[] {
    const data = this.section(section);
    const out: number[] = [];
    for (let k = 0; k < count; k++) {
      const at = offset + k * size;
      out.push(signed ? data.readIntLE(at, size) : data.readUIntLE(at, size));
    }
    return out;
  }
}

function loadElf(name: string): ElfFile {
  return new ElfFile(readFileSync(join(FIXTURES, name)));
}

class Magic {
  constructor(
    public divisor: number,
    public multiplier: bigint,
    public shift: number,
    public bits: number,
    public signed: boolean,
    public error: number,
  ) {}

  get add(): boolean {
    return this.multiplier >= 1n << BigInt(this.bits - (this.signed ? 1 : 0));
  }

  toDict(): Obj {
    return { divisor: this.divisor, multiplier: hex(this.multiplier), shift: this.shift, error: this.error, add: this.add, signed: this.signed };
  }
}

function magicNumbers(divisor: number, bits = 32, signed = false): Magic {
  if (divisor < 2) throw new Error("divisor must be at least 2");
  const d = BigInt(divisor);
  if ((d & (d - 1n)) === 0n) throw new Error("power of two: the compiler uses a shift, never the multiply");
  for (let shift = bits; shift <= 2 * bits; shift++) {
    const power = 1n << BigInt(shift);
    const multiplier = (power + d - 1n) / d;
    const error = multiplier * d - power;
    const bound = 1n << BigInt(shift - bits + (signed ? 1 : 0));
    if (error <= bound) return new Magic(divisor, multiplier, shift, bits, signed, Number(error));
  }
  throw new Error("no magic number found");
}

function divisorFromMagic(multiplier: number, shift: number, bits = 32, signed = false): number | null {
  const power = 1n << BigInt(shift);
  const m = BigInt(multiplier);
  for (const candidate of [power / m, power / m + 1n]) {
    if (candidate >= 2n) {
      let magic: Magic;
      try {
        magic = magicNumbers(Number(candidate), bits, signed);
      } catch {
        continue;
      }
      if (magic.multiplier === m && magic.shift === shift) return Number(candidate);
    }
  }
  return null;
}

function evaluateDivision(n: bigint, magic: Magic): bigint {
  const bits = BigInt(magic.bits);
  const mask = (1n << bits) - 1n;
  const shift = BigInt(magic.shift);
  if (magic.signed) {
    const product = n * magic.multiplier;
    return (product >> shift) + ((product >> (2n * bits - 1n)) & 1n);
  }
  if (magic.add) {
    const reduced = magic.multiplier - (1n << bits);
    const high = (n * reduced) >> bits;
    return ((((n - high) & mask) >> 1n) + high) >> (shift - bits - 1n);
  }
  return (n * magic.multiplier) >> shift;
}

function cDiv(a: bigint, b: bigint): bigint {
  const abs = (v: bigint): bigint => (v < 0n ? -v : v);
  const quotient = abs(a) / abs(b);
  return (a < 0n) === (b < 0n) ? quotient : -quotient;
}

function checkIdentity(magic: Magic, samples: bigint[]): boolean {
  const d = BigInt(magic.divisor);
  for (const n of samples) {
    const expected = magic.signed ? cDiv(n, d) : n / d;
    if (evaluateDivision(n, magic) !== expected) return false;
  }
  return true;
}

function edgeValues(bits = 32, signed = false): bigint[] {
  const values = new Set<bigint>();
  const top = signed ? 1n << BigInt(bits - 1) : 1n << BigInt(bits);
  const low = signed ? -top : 0n;
  for (let k = 0; k < bits; k++) {
    for (const delta of [-1n, 0n, 1n]) {
      const p = 1n << BigInt(k);
      for (const candidate of [p + delta, -p + delta]) {
        if (low <= candidate && candidate < top) values.add(candidate);
      }
    }
  }
  for (const v of [low, top - 1n, 0n, 1n, 2n, 3n, 7n, 9n, 10n, 11n, 99n, 100n, 1000n, 65535n, 65536n]) values.add(v);
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

class Val {
  constructor(
    public coefficients: Map<string, number> = new Map(),
    public constant = 0,
    public text: string | null = null,
    public seeded = false,
  ) {}

  static const(value: number): Val {
    return new Val(new Map(), value);
  }

  static symbol(name: string): Val {
    return new Val(new Map([[name, 1]]), 0);
  }

  static opaque(text: string, seeded = false): Val {
    return new Val(new Map(), 0, text, seeded);
  }

  get affine(): boolean {
    return this.text === null;
  }

  isConst(): boolean {
    return this.affine && this.coefficients.size === 0;
  }

  add(other: Val): Val {
    if (this.affine && other.affine) {
      const merged = new Map(this.coefficients);
      for (const [name, value] of other.coefficients) merged.set(name, (merged.get(name) ?? 0) + value);
      const kept = new Map([...merged].filter(([, v]) => v !== 0));
      return new Val(kept, this.constant + other.constant);
    }
    if (other.isConst() && other.constant === 0) return this;
    if (this.isConst() && this.constant === 0) return other;
    if (other.isConst() && other.constant < 0) return Val.opaque(`${this} - ${-other.constant}`);
    return Val.opaque(`${this} + ${other}`);
  }

  scale(factor: number): Val {
    if (this.affine) {
      return new Val(new Map([...this.coefficients].map(([k, v]) => [k, v * factor])), this.constant * factor);
    }
    return Val.opaque(`${this}*${factor}`);
  }

  negate(): Val {
    return this.affine ? this.scale(-1) : Val.opaque(`-${this}`);
  }

  sub(other: Val): Val {
    if (this.affine && other.affine) return this.add(other.negate());
    return Val.opaque(`${this} - ${other}`);
  }

  toString(): string {
    if (!this.affine) return this.text || "?";
    const terms: string[] = [];
    const items = [...this.coefficients].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    for (const [name, value] of items) {
      if (value === 1) {
        terms.push(name);
      } else if (value === -1) {
        terms.push(`-${name}`);
      } else {
        terms.push(`${value}*${name}`);
      }
    }
    if (this.constant || !terms.length) terms.push(String(this.constant));
    return terms.join(" + ").split("+ -").join("- ");
  }
}

function x86Family(register: string): string | null {
  const name = stripLeft(register, "%");
  let match = /^r(\d+)[dwb]?$/.exec(name);
  if (match) return "r" + match[1];
  match = /^[re]?([abcd])[xlh]$/.exec(name);
  if (match) return match[1];
  match = /^[re]?([sd]i|[sb]p)l?$/.exec(name);
  if (match) return match[1];
  return null;
}

function armFamily(register: string): string | null {
  const match = /^[wx](\d+)$/.exec(register);
  return match ? match[1] : null;
}

function registerFamily(arch: string, operand: string): string | null {
  if (arch === "x86_64") return operand.startsWith("%") ? x86Family(operand) : null;
  return armFamily(operand);
}

function parseImmediate(input: string): number | null {
  let text = input.trim();
  if (text.startsWith("$") || text.startsWith("#")) text = text.slice(1);
  let match = /^(-?)0x([0-9a-f]+)$/.exec(text);
  if (match) {
    const value = parseInt(match[2], 16);
    return match[1] ? -value : value;
  }
  match = /^-?\d+$/.exec(text);
  return match ? parseInt(text, 10) : null;
}

const X86_MEMORY = /^(-?0x[0-9a-f]+|-?\d+)?\(([^,)]*)(?:,([^,)]+)(?:,(\d))?)?\)$/;

class MemoryOperand {
  constructor(public base: string | null, public index: string | null, public scale: number, public displacement: number) {}
}

function parseX86Memory(operand: string): MemoryOperand | null {
  const match = X86_MEMORY.exec(operand);
  if (!match) return null;
  const displacement = match[1] ? parseImmediate(match[1]) : 0;
  return new MemoryOperand(match[2] || null, match[3] ?? null, parseInt(match[4] || "1", 10), displacement || 0);
}

function parseArmMemory(operand: string): MemoryOperand | null {
  let match = /^\[([wx]\d+|sp)(?:, #(-?0x[0-9a-f]+|-?\d+))?\]$/.exec(operand);
  if (match) return new MemoryOperand(match[1], null, 1, match[2] ? parseImmediate(match[2])! : 0);
  match = /^\[([wx]\d+|sp), ([wx]\d+)(?:, (?:uxtw|lsl) #(\d))?\]$/.exec(operand);
  if (match) return new MemoryOperand(match[1], match[2], 2 ** parseInt(match[3] || "0", 10), 0);
  return null;
}

function branchTarget(instruction: Instruction): number | null {
  const mnemonic = instruction.mnemonic;
  if (mnemonic.startsWith("j") && instruction.operands.length && !instruction.operands[0].startsWith("*")) {
    return parseImmediate(instruction.operands[0]);
  }
  if (mnemonic === "b" || mnemonic.startsWith("b.")) {
    return instruction.operands.length ? parseImmediate(lastOf(instruction.operands)) : null;
  }
  if (["cbz", "cbnz", "tbz", "tbnz"].includes(mnemonic)) return parseImmediate(lastOf(instruction.operands));
  return null;
}

function isBranch(instruction: Instruction): boolean {
  return branchTarget(instruction) !== null;
}

function isConditional(instruction: Instruction): boolean {
  return isBranch(instruction) && !["jmp", "b"].includes(instruction.mnemonic);
}

function isReturn(instruction: Instruction): boolean {
  return ["retq", "ret"].includes(instruction.mnemonic);
}

type Edge = [Instruction, number];

function backEdges(fn: Func): Edge[] {
  const edges: Edge[] = [];
  for (const instruction of fn.instructions) {
    const target = branchTarget(instruction);
    if (target !== null && fn.start <= target && target <= instruction.address) edges.push([instruction, target]);
  }
  return edges;
}

function loopBody(fn: Func, edge: Edge): Instruction[] {
  const [branch, target] = edge;
  return fn.instructions.filter((i) => target <= i.address && i.address <= branch.address);
}

function isTerminator(instruction: Instruction): boolean {
  return isBranch(instruction) || isReturn(instruction) || ["jmpq", "br"].includes(instruction.mnemonic);
}

function isUnconditional(instruction: Instruction): boolean {
  return ["jmp", "b", "jmpq", "br"].includes(instruction.mnemonic) || isReturn(instruction);
}

function blockStarts(fn: Func): Set<number> {
  const starts = new Set<number>([fn.start]);
  fn.instructions.forEach((instruction, position) => {
    const target = branchTarget(instruction);
    if (target !== null) starts.add(target);
    if (isTerminator(instruction) && position + 1 < fn.instructions.length) starts.add(fn.instructions[position + 1].address);
  });
  return starts;
}

function isLoop(fn: Func, edge: Edge): boolean {
  const [branch, target] = edge;
  for (const instruction of fn.instructions) {
    if (instruction.address < target) continue;
    if (instruction.address >= branch.address) return true;
    if (isReturn(instruction) || ["jmpq", "br"].includes(instruction.mnemonic)) return false;
    if (isUnconditional(instruction)) {
      const jump = branchTarget(instruction);
      return jump !== null && target <= jump && jump <= branch.address;
    }
  }
  return false;
}

function loops(fn: Func): Edge[] {
  return backEdges(fn).filter((edge) => isLoop(fn, edge));
}

function slotKey(arch: string, operand: string): string | null {
  if (arch === "x86_64") {
    const memory = parseX86Memory(operand);
    if (memory !== null && (memory.base === "%rbp" || memory.base === "%rsp") && memory.index === null) return operand;
  } else {
    const memory = parseArmMemory(operand);
    if (memory !== null && (memory.base === "sp" || memory.base === "x29") && memory.index === null) return operand;
  }
  return null;
}

type State = Map<string, Val>;
type Flags = [Val, Val] | null;
type Seeds = Map<number, [string, string]>;

class Evaluator {
  fn: Func;
  arch: string;
  params: string[];
  seeds: Seeds;
  entrySeeds: Seeds;
  state: State = new Map();
  flags: Flags = null;
  states = new Map<number, State>();
  flagsAt = new Map<number, Flags>();
  initial: State = new Map();

  constructor(fn: Func, params: string[], seeds: Seeds | null = null, entrySeeds: Seeds | null = null) {
    this.fn = fn;
    this.arch = fn.arch;
    this.params = params;
    this.seeds = seeds ?? new Map();
    this.entrySeeds = entrySeeds ?? new Map();
    params.forEach((name, position) => {
      const registers = PARAM_REGISTERS[this.arch];
      if (position < registers.length) this.initial.set(registers[position], Val.symbol(name));
    });
  }

  family(operand: string): string | null {
    return registerFamily(this.arch, operand);
  }

  key(operand: string): string | null {
    return this.family(operand) || slotKey(this.arch, operand);
  }

  read(operand: string): Val {
    const immediate = parseImmediate(operand);
    if (immediate !== null && (operand.startsWith("$") || operand.startsWith("#"))) return Val.const(immediate);
    if (operand === "wzr" || operand === "xzr") return Val.const(0);
    const key = this.key(operand);
    if (key !== null) {
      const fallback = this.family(operand) ? stripLeft(operand, "%") : `[${stripBoth(operand, "%")}]`;
      return this.state.get(key) ?? Val.opaque(fallback);
    }
    const memory = this.arch === "x86_64" ? parseX86Memory(operand) : null;
    if (memory !== null && memory.base === "%rip" && memory.index === null) return Val.opaque("table");
    return Val.opaque(`[${stripBoth(operand, "%")}]`);
  }

  write(operand: string, value: Val): void {
    const key = this.key(operand);
    if (key !== null) this.state.set(key, value);
  }

  merge(states: State[]): State {
    const merged: State = new Map();
    const keys = new Set<string>();
    for (const s of states) for (const k of s.keys()) keys.add(k);
    for (const key of keys) {
      const values = states.map((s) => s.get(key) ?? null);
      const rendered = new Set(values.map((v) => (v !== null ? v.toString() : null)));
      if (rendered.size === 1 && values[0] !== null) {
        merged.set(key, values[0]);
        continue;
      }
      const seeded = new Set(values.filter((v): v is Val => v !== null && v.seeded).map((v) => v.toString()));
      if (seeded.size === 1) merged.set(key, Val.opaque([...seeded][0], true));
    }
    return merged;
  }

  run(): void {
    const fn = this.fn;
    const starts = numericSort(blockStarts(fn));
    const blocks: Instruction[][] = [];
    starts.forEach((start, position) => {
      const end = position + 1 < starts.length ? starts[position + 1] : fn.end + 1;
      blocks.push(fn.instructions.filter((i) => start <= i.address && i.address < end));
    });
    const predecessors = new Map<number, number[]>(starts.map((start) => [start, []]));
    for (const block of blocks) {
      if (!block.length) continue;
      const last = lastOf(block);
      const following = last.end;
      if (predecessors.has(following) && !isUnconditional(last)) predecessors.get(following)!.push(block[0].address);
      const target = branchTarget(last);
      if (target !== null && predecessors.has(target)) predecessors.get(target)!.push(block[0].address);
    }
    const exits = new Map<number, State>();
    const exitFlags = new Map<number, Flags>();
    for (const block of blocks) {
      if (!block.length) continue;
      const start = block[0].address;
      if (start === fn.start) {
        this.state = new Map(this.initial);
        this.flags = null;
      } else {
        const preds = predecessors.get(start)!;
        const available = preds.filter((p) => exits.has(p)).map((p) => exits.get(p)!);
        this.state = available.length ? this.merge(available) : new Map();
        const fallthrough = preds.filter((p) => exits.has(p) && fn.at(p) !== null);
        this.flags = fallthrough.length ? exitFlags.get(lastOf(fallthrough)) ?? null : null;
      }
      let seed = this.entrySeeds.get(start);
      if (seed !== undefined) this.state.set(seed[0], Val.opaque(seed[1], true));
      for (const instruction of block) {
        this.states.set(instruction.address, new Map(this.state));
        this.flagsAt.set(instruction.address, this.flags);
        this.step(instruction);
        seed = this.seeds.get(instruction.address);
        if (seed !== undefined) this.state.set(seed[0], Val.opaque(seed[1], true));
      }
      exits.set(start, new Map(this.state));
      exitFlags.set(start, this.flags);
    }
  }

  before(address: number): State {
    return this.states.get(address) ?? new Map();
  }

  condition(code: string, flags: Flags): string {
    const table = this.arch === "x86_64" ? X86_CONDITIONS : ARM_CONDITIONS;
    const operator = table.get(code) ?? code;
    if (flags === null) return `flags ${code}`;
    const [left, right] = flags;
    if (operator.endsWith(" 0")) return `${left} ${operator}`;
    if (right.isConst() && right.constant === 0 && left.isConst() === false && left.toString() === right.toString()) return `${left} ${operator} 0`;
    return `${left} ${operator} ${right}`;
  }

  step(instruction: Instruction): void {
    if (this.arch === "x86_64") {
      this.stepX86(instruction);
    } else {
      this.stepArm(instruction);
    }
  }

  stepX86(instruction: Instruction): void {
    const mnemonic = instruction.mnemonic;
    const ops = instruction.operands;
    const tail = mnemonic[mnemonic.length - 1];
    let base = X86_SIZE_SUFFIX.has(tail) && mnemonic.length > 3 && !mnemonic.startsWith("set") && !mnemonic.startsWith("cmov") && !["call", "shrl", "shll", "sarl"].includes(mnemonic) ? mnemonic.slice(0, -1) : mnemonic;
    if (["shrl", "shll", "sarl", "shrq", "shlq", "sarq"].includes(mnemonic)) base = mnemonic.slice(0, -1);
    if (["mov", "movslq", "movsbl", "movzbl", "movabs"].includes(base) || ["movslq", "movsbl", "movzbl"].includes(mnemonic)) {
      if (ops.length === 2) {
        let value = this.read(ops[0]);
        if (mnemonic === "movl" && value.isConst() && value.constant > 0x7fffffff) value = Val.const(value.constant - 2 ** 32);
        this.write(ops[1], value);
      }
      return;
    }
    if (base === "xor" && ops.length === 2 && ops[0] === ops[1]) {
      this.write(ops[1], Val.const(0));
      return;
    }
    if (base === "lea" && ops.length === 2) {
      const memory = parseX86Memory(ops[0]);
      if (memory !== null && !(memory.base === "%rip")) {
        let value = Val.const(memory.displacement);
        if (memory.base && memory.index && x86Family(memory.base) === x86Family(memory.index)) {
          value = value.add(this.read(memory.base).scale(1 + memory.scale));
        } else {
          if (memory.base) value = value.add(this.read(memory.base));
          if (memory.index) value = value.add(this.read(memory.index).scale(memory.scale));
        }
        this.write(ops[1], value);
      }
      return;
    }
    if (base === "add" && ops.length === 2) {
      this.write(ops[1], this.read(ops[1]).add(this.read(ops[0])));
      return;
    }
    if (base === "sub" && ops.length === 2) {
      this.flags = [this.read(ops[1]), this.read(ops[0])];
      this.write(ops[1], this.read(ops[1]).sub(this.read(ops[0])));
      return;
    }
    if (base === "inc" && ops.length === 1) {
      this.write(ops[0], this.read(ops[0]).add(Val.const(1)));
      return;
    }
    if (base === "neg" && ops.length === 1) {
      const value = this.read(ops[0]).negate();
      this.write(ops[0], value);
      this.flags = [value, Val.const(0)];
      return;
    }
    if (base === "shl" && ops.length === 2) {
      const count = parseImmediate(ops[0]);
      if (count !== null) this.write(ops[1], this.read(ops[1]).scale(2 ** count));
      return;
    }
    if (base === "imul" && ops.length === 3) {
      const factor = parseImmediate(ops[0]);
      if (factor !== null) this.write(ops[2], this.read(ops[1]).scale(factor));
      return;
    }
    if (base === "cmp" && ops.length === 2) {
      this.flags = [this.read(ops[1]), this.read(ops[0])];
      return;
    }
    if (base === "test" && ops.length === 2) {
      this.flags = [this.read(ops[1]), Val.const(0)];
      return;
    }
    if (mnemonic.startsWith("set") && ops.length === 1) {
      this.write(ops[0], Val.opaque(`(${this.condition(mnemonic.slice(3), this.flags)})`));
      return;
    }
    if (mnemonic.startsWith("cmov") && ops.length === 2) {
      const code = X86_SIZE_SUFFIX.has(tail) ? mnemonic.slice(4, -1) : mnemonic.slice(4);
      const condition = this.condition(code, this.flags);
      this.write(ops[1], Val.opaque(`${condition} ? ${this.read(ops[0])} : ${this.read(ops[1])}`));
      return;
    }
    if (base === "and" && ops.length === 2) {
      this.write(ops[1], Val.opaque(`${this.read(ops[1])} & ${stripLeft(ops[0], "$")}`));
      return;
    }
    if (["cltd", "cqto", "pushq", "popq", "retq", "nop"].includes(mnemonic) || mnemonic.startsWith("nop") || mnemonic.startsWith("j")) return;
    if ((mnemonic === "divl" || mnemonic === "idivl") && ops.length === 1) {
      const dividend = this.read("%eax");
      const divisor = this.read(ops[0]);
      this.write("%eax", Val.opaque(`${dividend} / ${divisor}`));
      this.write("%edx", Val.opaque(`${dividend} % ${divisor}`));
      return;
    }
    for (const operand of ops.slice(-1)) {
      if (this.key(operand) !== null && !(["cmp", "test"].includes(base) || (mnemonic.startsWith("mov") && parseX86Memory(operand)))) {
        this.write(operand, Val.opaque(`${mnemonic}(...)`));
      }
    }
  }

  stepArm(instruction: Instruction): void {
    const mnemonic = instruction.mnemonic;
    const ops = instruction.operands;

    const shifted = (operand: string, modifier: string | null): Val => {
      const value = this.read(operand);
      if (modifier && modifier.startsWith("lsl #")) return value.scale(2 ** parseInt(modifier.slice(5), 10));
      if (modifier && modifier.startsWith("lsr #")) return Val.opaque(`${value} >> ${modifier.slice(5)}`);
      return value;
    };

    if (mnemonic === "mov" && ops.length === 2) {
      this.write(ops[0], this.read(ops[1]));
      return;
    }
    if (mnemonic === "movk" && ops.length === 3) {
      const low = this.read(ops[0]);
      const high = parseImmediate(ops[1]) || 0;
      if (low.isConst()) this.write(ops[0], Val.const(bitOr(bitAnd(low.constant, 0xffff), high * 65536)));
      return;
    }
    if (["add", "adds", "sub", "subs"].includes(mnemonic) && ops.length >= 3) {
      const right = shifted(ops[2], ops.length > 3 ? ops[3] : null);
      const left = this.read(ops[1]);
      const result = mnemonic.startsWith("add") ? left.add(right) : left.sub(right);
      if (mnemonic.endsWith("s")) this.flags = [left, right];
      this.write(ops[0], result);
      return;
    }
    if (mnemonic === "lsl" && ops.length === 3) {
      const count = parseImmediate(ops[2]);
      this.write(ops[0], this.read(ops[1]).scale(2 ** (count || 0)));
      return;
    }
    if ((mnemonic === "madd" || mnemonic === "msub") && ops.length === 4) {
      let product = this.read(ops[1]);
      const factor = this.read(ops[2]);
      if (factor.isConst()) {
        product = product.scale(factor.constant);
      } else if (product.isConst()) {
        product = factor.scale(product.constant);
      } else {
        product = Val.opaque(`${product}*${factor}`);
      }
      const addend = this.read(ops[3]);
      this.write(ops[0], mnemonic === "madd" ? addend.add(product) : addend.sub(product));
      return;
    }
    if ((mnemonic === "neg" || mnemonic === "negs") && ops.length === 2) {
      const value = this.read(ops[1]).negate();
      this.write(ops[0], value);
      if (mnemonic === "negs") this.flags = [value, Val.const(0)];
      return;
    }
    if (mnemonic === "cmp" && ops.length === 2) {
      this.flags = [this.read(ops[0]), this.read(ops[1])];
      return;
    }
    if ((mnemonic === "cbz" || mnemonic === "cbnz") && ops.length) {
      this.flags = [this.read(ops[0]), Val.const(0)];
      return;
    }
    if (mnemonic === "csel" && ops.length === 4) {
      this.write(ops[0], Val.opaque(`${this.condition(ops[3], this.flags)} ? ${this.read(ops[1])} : ${this.read(ops[2])}`));
      return;
    }
    if (mnemonic === "csinv" && ops.length === 4) {
      const other = this.read(ops[2]);
      const inverted = other.isConst() ? Val.const(-other.constant - 1) : Val.opaque(`~${other}`);
      this.write(ops[0], Val.opaque(`${this.condition(ops[3], this.flags)} ? ${this.read(ops[1])} : ${inverted}`));
      return;
    }
    if (mnemonic === "csneg" && ops.length === 4) {
      this.write(ops[0], Val.opaque(`${this.condition(ops[3], this.flags)} ? ${this.read(ops[1])} : ${this.read(ops[2]).negate()}`));
      return;
    }
    if (mnemonic === "csinc" && ops.length === 4) {
      this.write(ops[0], Val.opaque(`${this.condition(ops[3], this.flags)} ? ${this.read(ops[1])} : ${this.read(ops[2]).add(Val.const(1))}`));
      return;
    }
    if (mnemonic === "cneg" && ops.length === 3) {
      const value = this.read(ops[1]);
      this.write(ops[0], Val.opaque(`${this.condition(ops[2], this.flags)} ? ${value.negate()} : ${value}`));
      return;
    }
    if (mnemonic === "cset" && ops.length === 2) {
      this.write(ops[0], Val.opaque(`(${this.condition(ops[1], this.flags)})`));
      return;
    }
    if (mnemonic === "and" && ops.length === 3) {
      this.write(ops[0], Val.opaque(`${this.read(ops[1])} & ${stripLeft(ops[2], "#")}`));
      return;
    }
    if ((mnemonic === "sdiv" || mnemonic === "udiv") && ops.length === 3) {
      this.write(ops[0], Val.opaque(`${this.read(ops[1])} / ${this.read(ops[2])}`));
      return;
    }
    if ((mnemonic === "str" || mnemonic === "stur") && ops.length === 2) {
      this.write(ops[1], this.read(ops[0]));
      return;
    }
    if ((mnemonic === "ldr" || mnemonic === "ldur") && ops.length === 2 && slotKey("arm64", ops[1])) {
      this.write(ops[0], this.read(ops[1]));
      return;
    }
    if (["ret", "b", "br", "bl", "blr"].includes(mnemonic) || mnemonic.startsWith("b.") || mnemonic.startsWith("st")) return;
    if (ops.length && this.family(ops[0]) !== null) this.write(ops[0], Val.opaque(`${mnemonic}(...)`));
  }
}

type Result = [number, string, string];

class Idiom {
  constructor(
    public kind: string,
    public fn: string,
    public source: string,
    public evidence: number[],
    public detail: Obj = {},
    public verified: boolean | null = null,
    public result: Result | null = null,
  ) {}

  toDict(): Obj {
    return {
      kind: this.kind,
      function: this.fn,
      source: this.source,
      evidence: this.evidence.map((a) => hex(a)),
      verified: this.verified,
      ...this.detail,
    };
  }
}

class SourceFunction {
  constructor(
    public name: string,
    public params: string[],
    public body: string,
    public divisions: number[],
    public modulos: number[],
    public multiplies: number[],
    public hasSwitch: boolean,
    public cases: Map<number, number | null>,
    public hasSelect: boolean,
    public hasLoop: boolean,
    public calls: string[],
    public hasArray: boolean,
    public accumulator: string | null = null,
  ) {}

  get caseValues(): number[] {
    return [...this.cases].sort((a, b) => a[0] - b[0]).map(([, v]) => v).filter((v): v is number => v !== null);
  }
}

const FUNCTION_RE = /^(?:unsigned |int |void |long |char |static )+\*?\s*(\w+)\(/gm;
const CASE_RUN_RE = /((?:case\s+\d+:\s*)+)(?:return|\w+\s*=)\s*(-?\d+)/g;
const CALL_RE = /\b([a-z_]\w*)\s*\(/g;
const KEYWORDS = new Set(["switch", "for", "if", "return", "while", "sizeof"]);

function balanced(text: string, start: number, openChar: string, closeChar: string): number {
  let depth = 0;
  for (let position = start; position < text.length; position++) {
    if (text[position] === openChar) {
      depth += 1;
    } else if (text[position] === closeChar) {
      depth -= 1;
      if (depth === 0) return position;
    }
  }
  return text.length;
}

function paramName(declaration: string): string {
  const pointer = /\(\*(\w+)\)/.exec(declaration);
  if (pointer) return pointer[1];
  return stripLeft(lastOf(splitWhitespace(declaration)), "*");
}

function parseSource(text: string): Map<string, SourceFunction> {
  const functions = new Map<string, SourceFunction>();
  for (const match of text.matchAll(FUNCTION_RE)) {
    const name = match[1];
    const matchEnd = match.index! + match[0].length;
    const paramsEnd = balanced(text, matchEnd - 1, "(", ")");
    const brace = text.indexOf("{", paramsEnd);
    if (brace < 0 || text.slice(paramsEnd + 1, brace).trim()) continue;
    const bodyEnd = balanced(text, brace, "{", "}");
    const body = text.slice(brace + 1, bodyEnd);
    const rawParams = text.slice(matchEnd, paramsEnd);
    const params = splitOperands(rawParams).filter((p) => p.trim() && p.trim() !== "void").map(paramName);
    const accumulator = /(\w+)\s*\+=/.exec(body);
    const cases = new Map<number, number | null>();
    for (const [, run, value] of body.matchAll(CASE_RUN_RE)) {
      for (const label of run.matchAll(/case\s+(\d+):/g)) cases.set(parseInt(label[1], 10), parseInt(value, 10));
    }
    for (const label of body.matchAll(/case\s+(\d+):/g)) {
      const k = parseInt(label[1], 10);
      if (!cases.has(k)) cases.set(k, null);
    }
    const calls = [...body.matchAll(CALL_RE)].map((m) => m[1]).filter((c) => !KEYWORDS.has(c) && c !== name);
    functions.set(name, new SourceFunction(
      name,
      params,
      body,
      [...body.matchAll(/\/\s*(\d+)/g)].map((m) => parseInt(m[1], 10)),
      [...body.matchAll(/%\s*(\d+)/g)].map((m) => parseInt(m[1], 10)),
      [...body.matchAll(/\*\s*(\d+)/g)].map((m) => parseInt(m[1], 10)),
      body.includes("switch"),
      cases,
      body.includes("?"),
      body.includes("for ("),
      calls,
      /\w+\s+\w+\[\d+\];/.test(body),
      accumulator ? accumulator[1] : null,
    ));
  }
  return functions;
}

function loadSource(name = "idioms.c"): Map<string, SourceFunction> {
  return parseSource(readFileSync(join(FIXTURES, name), "utf-8"));
}

function hasSimd(body: Instruction[]): boolean {
  return body.some((i) => i.operands.some((o) => SIMD_REGISTER.test(o)));
}

function findReductions(fn: Func, source: SourceFunction | null): [Seeds, Seeds] {
  const name = source && source.accumulator ? source.accumulator : "sum";
  const seeds: Seeds = new Map();
  const entrySeeds: Seeds = new Map();
  for (const [branch, target] of loops(fn)) {
    const body = loopBody(fn, [branch, target]);
    if (hasSimd(body)) continue;
    let key: string | null = null;
    for (let position = 0; position < body.length; position++) {
      const instruction = body[position];
      const ops = instruction.operands;
      if (fn.arch === "x86_64" && instruction.mnemonic === "addl" && ops.length === 2 && x86Family(ops[1]) && !ops[0].startsWith("$")) {
        key = x86Family(ops[1]);
        const next = body[position + 1];
        if (position + 1 < body.length && next.mnemonic === "movl" && slotKey("x86_64", next.operands[1]) && x86Family(next.operands[0]) === key) key = next.operands[1];
        break;
      }
      if (fn.arch === "arm64" && instruction.mnemonic === "add" && ops.length === 3 && (armFamily(ops[0]) === armFamily(ops[1]) || armFamily(ops[0]) === armFamily(ops[2]))) {
        key = armFamily(ops[0]);
        const next = body[position + 1];
        if (position + 1 < body.length && next.mnemonic === "str" && slotKey("arm64", next.operands[1]) && armFamily(next.operands[0]) === key) key = next.operands[1];
        break;
      }
    }
    if (key === null) continue;
    seeds.set(branch.address, [key, name]);
    entrySeeds.set(target, [key, name]);
  }
  return [seeds, entrySeeds];
}

function evaluatorFor(fn: Func, source: SourceFunction | null, seeds: Seeds | null = null): Evaluator {
  const [reductionSeeds, entrySeeds] = findReductions(fn, source);
  const merged: Seeds = new Map(reductionSeeds);
  for (const [k, v] of seeds ?? new Map<number, [string, string]>()) merged.set(k, v);
  const evaluator = new Evaluator(fn, source ? source.params : [], merged, entrySeeds);
  evaluator.run();
  return evaluator;
}

function window(fn: Func, start: number, count: number): Instruction[] {
  return fn.instructions.slice(start, start + count);
}

function findDivisions(fn: Func, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  if (fn.arch === "x86_64") {
    found.push(...x86MagicDivisions(fn, evaluator));
    found.push(...x86HardwareDivisions(fn, evaluator));
  } else {
    found.push(...armMagicDivisions(fn, evaluator));
    found.push(...armHardwareDivisions(fn, evaluator));
  }
  return found;
}

function x86MagicDivisions(fn: Func, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  const instructions = fn.instructions;
  instructions.forEach((instruction, position) => {
    if (!instruction.mnemonic.startsWith("imul")) return;
    let magicValue: number | null = null;
    const evidence = [instruction.address];
    let sourceReg: string | null;
    let product: string | null;
    if (instruction.operands.length === 3) {
      magicValue = parseImmediate(instruction.operands[0]);
      sourceReg = x86Family(instruction.operands[1]);
      product = x86Family(instruction.operands[2]);
    } else if (instruction.operands.length === 2) {
      product = x86Family(instruction.operands[1]);
      sourceReg = x86Family(instruction.operands[0]);
      for (const earlier of window(fn, Math.max(0, position - 3), Math.min(3, position)).reverse()) {
        const target = earlier.operands.length === 2 ? x86Family(earlier.operands[1]) : null;
        if (earlier.mnemonic === "movl" && earlier.operands.length === 2 && earlier.operands[0].startsWith("$") && (target === product || target === sourceReg)) {
          magicValue = bitAnd(parseImmediate(earlier.operands[0])!, 0xffffffff);
          evidence.unshift(earlier.address);
          if (target === sourceReg) sourceReg = product;
          break;
        }
      }
    } else {
      return;
    }
    if (magicValue === null || magicValue < 0x1000 || product === null) return;
    magicValue = bitAnd(magicValue, 0xffffffff);
    let signed = false;
    let dividend = Val.opaque("?");
    let matched = false;
    for (const earlier of window(fn, Math.max(0, position - 3), Math.min(3, position)).reverse()) {
      if ((earlier.mnemonic === "movslq" || earlier.mnemonic === "movl") && earlier.operands.length === 2 && !earlier.operands[0].startsWith("$") && x86Family(earlier.operands[1]) === sourceReg) {
        signed = earlier.mnemonic === "movslq";
        const probe = new Evaluator(fn, []);
        probe.state = new Map(evaluator.before(earlier.address));
        dividend = probe.read(earlier.operands[0]);
        evidence.unshift(earlier.address);
        matched = true;
        break;
      }
    }
    if (!matched) dividend = evaluator.before(instruction.address).get(sourceReg || "") ?? Val.opaque(sourceReg || "?");
    const copies = new Set<string | null>([product]);
    let shift: number | null = null;
    let signFix = false;
    let signReg: string | null = null;
    const fixup: Instruction[] = [];
    let resultReg: string | null = product;
    let last = instruction;
    const combines: [Instruction, string][] = [];
    for (const later of window(fn, position + 1, 12)) {
      const mnemonic = later.mnemonic;
      const ops = later.operands;
      if (mnemonic === "movq" && ops.length === 2 && copies.has(x86Family(ops[0]))) {
        copies.add(x86Family(ops[1]));
        evidence.push(later.address);
        continue;
      }
      if (mnemonic === "shrq" && ops.length === 2 && copies.has(x86Family(ops[1])) && parseImmediate(ops[0]) === 63) {
        signFix = true;
        signReg = x86Family(ops[1]);
        evidence.push(later.address);
        continue;
      }
      if ((mnemonic === "sarq" || mnemonic === "shrq") && ops.length === 2 && copies.has(x86Family(ops[1])) && shift === null) {
        shift = parseImmediate(ops[0]);
        resultReg = x86Family(ops[1]);
        evidence.push(later.address);
        last = later;
        continue;
      }
      if (shift !== null && signFix && !fixup.length && (mnemonic === "addl" || mnemonic === "leal")) {
        let sources = new Set<string | null>();
        if (mnemonic === "addl" && ops.length === 2) sources = new Set([x86Family(ops[0]), x86Family(ops[1])]);
        if (mnemonic === "leal" && ops.length === 2) {
          const memory = parseX86Memory(ops[0]);
          if (memory && memory.displacement === 0 && memory.scale === 1) sources = new Set([x86Family(memory.base || ""), x86Family(memory.index || "")]);
        }
        if (sameSet(sources, new Set([resultReg, signReg])) && resultReg !== signReg) {
          combines.push([later, x86Family(lastOf(ops)) || ""]);
          continue;
        }
      }
      if (combines.length && ops.length && copies.has(x86Family(lastOf(ops)))) break;
      if (combines.length && !["addl", "leal", "subl", "movl"].includes(mnemonic)) break;
      if (shift === 32 && !signFix && mnemonic === "subl" && ops.length === 2 && copies.has(x86Family(ops[0]))) {
        fixup.push(later);
        evidence.push(later.address);
        continue;
      }
      if (fixup.length && (mnemonic === "shrl" || mnemonic === "addl")) {
        fixup.push(later);
        evidence.push(later.address);
        if (mnemonic === "shrl" && ops.length === 2 && copies.has(x86Family(ops[1])) && parseImmediate(ops[0]) !== null && parseImmediate(ops[0]) !== 1) {
          resultReg = x86Family(ops[1]);
          last = later;
          break;
        }
        continue;
      }
      if (shift !== null && !signFix && !fixup.length) break;
    }
    if (shift === null) return;
    let effective = magicValue;
    let totalShift = shift;
    if (fixup.length) {
      effective = magicValue + 2 ** 32;
      totalShift = shift + 1 + (parseImmediate(lastOf(fixup).operands[0]) || 0);
    }
    const divisor = divisorFromMagic(effective, totalShift, 32, signed);
    if (divisor === null) return;
    const magic = magicNumbers(divisor, 32, signed);
    const detail: Obj = { form: "magic multiply" + (fixup.length ? " with add fix-up" : ""), signed, magic: hex(magicValue), effectiveMagic: hex(effective), shift: totalShift, algorithm: magic.toDict(), clangMatchesAlgorithm: magic.multiplier === BigInt(effective) && magic.shift === totalShift };
    if (signFix && !combines.length) return;
    const results: [Instruction, string][] = combines.length ? combines.map(([c, reg]) => [c, reg]) : [[last, resultReg || ""]];
    for (const [combine, register] of results) {
      found.push(new Idiom(
        "division", fn.name, `${dividend} / ${divisor}`, [...evidence, ...(combine !== last ? [combine.address] : [])],
        { ...detail, sharedQuotient: results.length > 1 },
        null,
        [combine.address, register, `${dividend} / ${divisor}`],
      ));
    }
  });
  return found;
}

function x86HardwareDivisions(fn: Func, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  fn.instructions.forEach((instruction, position) => {
    if (!["divl", "idivl"].includes(instruction.mnemonic) || instruction.operands.length !== 1) return;
    const divisorReg = x86Family(instruction.operands[0]);
    let divisor: number | null = null;
    let evidence = [instruction.address];
    for (const earlier of window(fn, Math.max(0, position - 4), 4).reverse()) {
      if (earlier.mnemonic === "movl" && earlier.operands.length === 2 && earlier.operands[0].startsWith("$") && x86Family(earlier.operands[1]) === divisorReg) {
        divisor = parseImmediate(earlier.operands[0]);
        evidence.unshift(earlier.address);
      }
      if (earlier.mnemonic === "cltd" || earlier.mnemonic === "xorl") evidence.unshift(earlier.address);
    }
    if (divisor === null) return;
    const dividend = evaluator.before(instruction.address).get("a") ?? Val.opaque("eax");
    const remainderUsed = window(fn, position + 1, 2).some((later) => later.operands.length > 0 && x86Family(later.operands[0]) === "d");
    evidence = evidence.filter((e) => {
      const at = fn.at(e);
      return at !== null && (at.mnemonic !== "xorl" || x86Family(at.operands[0]) === "d");
    });
    const kind = remainderUsed ? "modulo" : "division";
    const operator = remainderUsed ? "%" : "/";
    const resultReg = remainderUsed ? "d" : "a";
    found.push(new Idiom(kind, fn.name, `${dividend} ${operator} ${divisor}`, evidence, { form: `hardware ${instruction.mnemonic}`, signed: instruction.mnemonic === "idivl", divisor }, null, [instruction.address, resultReg, `${dividend} ${operator} ${divisor}`]));
  });
  return found;
}

function armConstant(fn: Func, position: number, register: string): [number | null, number[]] {
  let value: number | null = null;
  const evidence: number[] = [];
  for (const earlier of window(fn, Math.max(0, position - 4), Math.min(4, position)).reverse()) {
    if (earlier.mnemonic === "movk" && armFamily(earlier.operands[0]) === register) {
      value = bitOr(value || 0, (parseImmediate(earlier.operands[1]) || 0) * 65536);
      evidence.unshift(earlier.address);
    } else if (earlier.mnemonic === "mov" && armFamily(earlier.operands[0]) === register && earlier.operands[1].startsWith("#")) {
      value = bitOr(value || 0, bitAnd(parseImmediate(earlier.operands[1]) || 0, 0xffff));
      evidence.unshift(earlier.address);
      break;
    }
  }
  return [value, evidence];
}

function armMagicDivisions(fn: Func, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  fn.instructions.forEach((instruction, position) => {
    if (!["smull", "umull"].includes(instruction.mnemonic) || instruction.operands.length !== 3) return;
    const signed = instruction.mnemonic === "smull";
    const product = armFamily(instruction.operands[0]);
    const [operandA, operandB] = [instruction.operands[1], instruction.operands[2]];
    let [magicValue, evidence] = armConstant(fn, position, armFamily(operandB) || "");
    let dividendReg = operandA;
    if (magicValue === null) {
      [magicValue, evidence] = armConstant(fn, position, armFamily(operandA) || "");
      dividendReg = operandB;
    }
    if (magicValue === null) return;
    evidence.push(instruction.address);
    const dividend = evaluator.before(instruction.address).get(armFamily(dividendReg) || "") ?? Val.opaque(dividendReg);
    let shift: number | null = null;
    const fixup: Instruction[] = [];
    let resultReg: string | null = product;
    let last = instruction;
    for (const later of window(fn, position + 1, 8)) {
      const [mnemonic, ops] = [later.mnemonic, later.operands];
      if (mnemonic === "lsr" && ops.length === 3 && armFamily(ops[1]) === product && parseImmediate(ops[2]) === 63) {
        evidence.push(later.address);
        continue;
      }
      if ((mnemonic === "asr" || mnemonic === "lsr") && ops.length === 3 && armFamily(ops[1]) === product && shift === null) {
        shift = parseImmediate(ops[2]);
        resultReg = armFamily(ops[0]);
        evidence.push(later.address);
        last = later;
        if (!signed && shift !== 32) break;
        continue;
      }
      if (shift !== null && signed && mnemonic === "add" && ops.length === 3) {
        resultReg = armFamily(ops[0]);
        evidence.push(later.address);
        last = later;
        break;
      }
      if (shift === 32 && !signed && mnemonic === "sub") {
        fixup.push(later);
        evidence.push(later.address);
        continue;
      }
      if (fixup.length && (mnemonic === "add" || mnemonic === "lsr")) {
        fixup.push(later);
        evidence.push(later.address);
        if (mnemonic === "lsr") {
          resultReg = armFamily(ops[0]);
          last = later;
          break;
        }
      }
    }
    if (shift === null) return;
    let effective = magicValue;
    let totalShift = shift;
    if (fixup.length) {
      effective = magicValue + 2 ** 32;
      totalShift = shift + 1 + (parseImmediate(lastOf(fixup).operands[2]) || 0);
    }
    const divisor = divisorFromMagic(effective, totalShift, 32, signed);
    if (divisor === null) return;
    const magic = magicNumbers(divisor, 32, signed);
    found.push(new Idiom(
      "division", fn.name, `${dividend} / ${divisor}`, evidence,
      { form: "magic multiply" + (fixup.length ? " with add fix-up" : ""), signed, magic: hex(magicValue), effectiveMagic: hex(effective), shift: totalShift, algorithm: magic.toDict(), clangMatchesAlgorithm: magic.multiplier === BigInt(effective) && magic.shift === totalShift },
      null,
      [last.address, resultReg || "", `${dividend} / ${divisor}`],
    ));
  });
  return found;
}

function armHardwareDivisions(fn: Func, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  fn.instructions.forEach((instruction, position) => {
    if (!["sdiv", "udiv"].includes(instruction.mnemonic) || instruction.operands.length !== 3) return;
    const [divisorValue, evidence] = armConstant(fn, position, armFamily(instruction.operands[2]) || "");
    if (divisorValue === null) return;
    evidence.push(instruction.address);
    const dividend = evaluator.before(instruction.address).get(armFamily(instruction.operands[1]) || "") ?? Val.opaque(instruction.operands[1]);
    const quotient = armFamily(instruction.operands[0]);
    const following = window(fn, position + 1, 2);
    const msub = following.find((i) => i.mnemonic === "msub" && armFamily(i.operands[1]) === quotient) ?? null;
    const mul = following.find((i) => i.mnemonic === "mul" && armFamily(i.operands[1]) === quotient) ?? null;
    const subtract = following.find((i) => mul !== null && i.address > mul.address && (i.mnemonic === "sub" || i.mnemonic === "subs") && armFamily(i.operands[2]) === armFamily(mul.operands[0])) ?? null;
    const signed = instruction.mnemonic === "sdiv";
    if (msub !== null) {
      evidence.push(msub.address);
      found.push(new Idiom("modulo", fn.name, `${dividend} % ${divisorValue}`, evidence, { form: `hardware ${instruction.mnemonic} + msub`, signed, divisor: divisorValue }, null, [msub.address, armFamily(msub.operands[0]) || "", `${dividend} % ${divisorValue}`]));
    } else if (mul !== null && subtract !== null) {
      evidence.push(mul.address, subtract.address);
      found.push(new Idiom("modulo", fn.name, `${dividend} % ${divisorValue}`, evidence, { form: `hardware ${instruction.mnemonic} + mul + ${subtract.mnemonic}`, signed, divisor: divisorValue }, null, [subtract.address, armFamily(subtract.operands[0]) || "", `${dividend} % ${divisorValue}`]));
    } else {
      found.push(new Idiom("division", fn.name, `${dividend} / ${divisorValue}`, evidence, { form: `hardware ${instruction.mnemonic}`, signed, divisor: divisorValue }, null, [instruction.address, quotient || "", `${dividend} / ${divisorValue}`]));
    }
  });
  return found;
}

function findModulos(fn: Func, divisions: Idiom[], evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  for (const division of divisions) {
    const form = division.detail["form"];
    if (division.kind !== "division" || division.result === null || (typeof form === "string" ? form : "").startsWith("hardware")) continue;
    const [endAddress, quotientReg] = division.result;
    const divisor = (division.detail["algorithm"] as Obj)["divisor"] as number;
    const dividendText = division.source.split(" / ")[0];
    const position = fn.index(endAddress);
    const factors = new Map<string | null, number>([[quotientReg, 1]]);
    const evidence: number[] = [];
    for (const later of window(fn, position + 1, 12)) {
      const [mnemonic, ops] = [later.mnemonic, later.operands];
      const written = ops.length ? registerFamily(fn.arch, fn.arch === "x86_64" ? lastOf(ops) : ops[0]) : null;
      if (fn.arch === "arm64" && mnemonic === "msub" && ops.length === 4 && armFamily(ops[1]) === quotientReg) {
        const [constant, constEvidence] = armConstant(fn, fn.index(later.address), armFamily(ops[2]) || "");
        if (constant === divisor) {
          found.push(new Idiom("modulo", fn.name, `${dividendText} % ${divisor}`, [...division.evidence, ...constEvidence, later.address], { form: "msub quotient * divisor from dividend", divisor }, null, [later.address, armFamily(ops[0]) || "", `${dividendText} % ${divisor}`]));
        }
        break;
      }
      if (fn.arch === "arm64" && written === quotientReg && mnemonic !== "mul") break;
      if (fn.arch === "x86_64") {
        if (mnemonic === "movl" && ops.length === 2 && factors.has(x86Family(ops[0])) && x86Family(ops[1]) !== null) {
          factors.set(x86Family(ops[1]), factors.get(x86Family(ops[0]))!);
          evidence.push(later.address);
          continue;
        }
        if (mnemonic === "addl" && ops.length === 2 && x86Family(ops[0]) === x86Family(ops[1]) && factors.has(x86Family(ops[1]))) {
          factors.set(x86Family(ops[1]), factors.get(x86Family(ops[1]))! * 2);
          evidence.push(later.address);
          continue;
        }
        if (mnemonic === "shll" && ops.length === 2 && factors.has(x86Family(ops[1]))) {
          factors.set(x86Family(ops[1]), factors.get(x86Family(ops[1]))! * 2 ** (parseImmediate(ops[0]) || 0));
          evidence.push(later.address);
          continue;
        }
        if (mnemonic === "leal" && ops.length === 2) {
          const memory = parseX86Memory(ops[0]);
          if (memory && factors.has(x86Family(memory.base || "")) && x86Family(memory.index || "") === x86Family(memory.base || "") && memory.displacement === 0) {
            factors.set(x86Family(ops[1]), factors.get(x86Family(memory.base || ""))! * (1 + memory.scale));
            evidence.push(later.address);
            continue;
          }
        }
        if (mnemonic === "imull" && ops.length === 3 && factors.has(x86Family(ops[1]))) {
          factors.set(x86Family(ops[2]), factors.get(x86Family(ops[1]))! * (parseImmediate(ops[0]) || 0));
          evidence.push(later.address);
          continue;
        }
        if (mnemonic === "subl" && ops.length === 2 && factors.has(x86Family(ops[0])) && factors.get(x86Family(ops[0])) === divisor) {
          evidence.push(later.address);
          found.push(new Idiom("modulo", fn.name, `${dividendText} % ${divisor}`, [...division.evidence, ...evidence], { form: "quotient multiplied back and subtracted", multiplyBack: `${quotientReg} * ${divisor}`, divisor }, null, [later.address, x86Family(ops[1]) || "", `${dividendText} % ${divisor}`]));
          break;
        }
        if (factors.has(written) && !["addl", "leal", "imull", "movl", "shll"].includes(mnemonic)) break;
      }
    }
  }
  found.push(...powerOfTwoModulos(fn, evaluator));
  return found;
}

function powerOfTwoModulos(fn: Func, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  const instructions = fn.instructions;
  if (fn.arch === "x86_64") {
    instructions.forEach((instruction, position) => {
      if (!instruction.mnemonic.startsWith("cmov") || !["s", "ns"].includes(instruction.mnemonic.slice(4, -1))) return;
      const later = window(fn, position + 1, 2);
      if (later.length < 2 || !(later[0].mnemonic === "andl") || !(later[1].mnemonic === "subl")) return;
      const mask = parseImmediate(later[0].operands[0]);
      if (mask === null || mask >= 0 || bitAnd(-mask, -mask - 1)) return;
      const modulus = -mask;
      const bias = window(fn, Math.max(0, position - 3), 3).reverse().find((i) => {
        if (i.mnemonic === "leal") {
          const memory = parseX86Memory(i.operands[0]);
          if (memory && memory.displacement === modulus - 1) return true;
        }
        return i.mnemonic === "addl" && parseImmediate(i.operands[0]) === modulus - 1;
      }) ?? null;
      if (bias === null) return;
      const dividend = evaluator.before(later[1].address).get(x86Family(later[1].operands[1]) || "") ?? Val.opaque("x");
      const biasIndex = fn.index(bias.address);
      const evidence = [bias.address, ...window(fn, biasIndex + 1, position - biasIndex).map((i) => i.address), later[0].address, later[1].address];
      found.push(new Idiom("modulo", fn.name, `${dividend} % ${modulus}`, evidence, { form: "signed power-of-two modulo: bias by 2^k-1 when negative, mask, subtract", divisor: modulus }, null, [later[1].address, x86Family(later[1].operands[1]) || "", `${dividend} % ${modulus}`]));
    });
  } else {
    instructions.forEach((instruction, position) => {
      if (instruction.mnemonic !== "csneg" || instruction.operands.length !== 4 || instruction.operands[3] !== "mi") return;
      const masks = window(fn, Math.max(0, position - 3), 3).filter((i) => i.mnemonic === "and" && i.operands.length === 3);
      const negs = window(fn, Math.max(0, position - 3), 3).find((i) => i.mnemonic === "negs") ?? null;
      if (masks.length < 2 || negs === null) return;
      const mask = parseImmediate(masks[0].operands[2]);
      if (mask === null || bitAnd(mask + 1, mask)) return;
      const dividend = evaluator.before(negs.address).get(armFamily(negs.operands[1]) || "") ?? Val.opaque("x");
      const evidence = [negs.address, ...masks.map((m) => m.address), instruction.address];
      found.push(new Idiom("modulo", fn.name, `${dividend} % ${mask + 1}`, numericSort(evidence), { form: "signed power-of-two modulo: negate, mask both signs, csneg", divisor: mask + 1 }, null, [instruction.address, armFamily(instruction.operands[0]) || "", `${dividend} % ${mask + 1}`]));
    });
  }
  return found;
}

function boundsCheck(fn: Func, before: number): [number | null, string | null, number[]] {
  const position = fn.index(before);
  const earlier = window(fn, Math.max(0, position - 8), Math.min(8, position));
  for (let index = earlier.length - 1; index > 0; index--) {
    const branch = earlier[index];
    const compare = earlier[index - 1];
    if (fn.arch === "x86_64" && (branch.mnemonic === "ja" || branch.mnemonic === "jae") && ["cmpl", "cmpq", "subl", "subq"].includes(compare.mnemonic) && compare.operands[0].startsWith("$")) {
      const limit = parseImmediate(compare.operands[0]) || 0;
      return [limit + (branch.mnemonic === "ja" ? 1 : 0), x86Family(compare.operands[1]), [compare.address, branch.address]];
    }
    if (fn.arch === "arm64" && (branch.mnemonic === "b.hi" || branch.mnemonic === "b.hs") && compare.mnemonic === "cmp" && compare.operands[1].startsWith("#")) {
      const limit = parseImmediate(compare.operands[1]) || 0;
      return [limit + (branch.mnemonic === "b.hi" ? 1 : 0), armFamily(compare.operands[0]), [compare.address, branch.address]];
    }
  }
  return [null, null, []];
}

function tableBase(fn: Func, before: number, register: string | null): [Instruction | null, number | null] {
  const position = fn.index(before);
  for (const earlier of window(fn, Math.max(0, position - 6), Math.min(6, position)).reverse()) {
    if (fn.arch === "x86_64" && earlier.mnemonic === "leaq" && earlier.relocation && x86Family(earlier.operands[1]) === register) {
      if (earlier.relocationSymbol === ".rodata") return [earlier, earlier.relocationAddend + 4];
    }
    if (fn.arch === "arm64" && earlier.mnemonic === "add" && earlier.relocation && earlier.relocationSymbol === ".rodata" && armFamily(earlier.operands[0]) === register) {
      return [earlier, earlier.relocationAddend];
    }
  }
  return [null, null];
}

function findSwitches(fn: Func, elf: ElfFile | null, source: SourceFunction | null, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  found.push(...jumpTables(fn, elf, source, evaluator));
  found.push(...lookupTables(fn, elf, source, evaluator));
  found.push(...linearMapsAndSelectChains(fn, source, evaluator));
  if (!found.length) found.push(...comparisonTrees(fn, source, evaluator));
  return found;
}

function indexText(index: Val, count: number | null): [string, string] {
  const text = index.toString();
  const match = /^(.*) - (\d+)$/.exec(text);
  if (match && count) {
    const bias = parseInt(match[2], 10);
    return [match[1], `cases ${bias}..${bias + count - 1}`];
  }
  return [text, count ? `cases 0..${count - 1}` : ""];
}

function jumpTables(fn: Func, elf: ElfFile | null, source: SourceFunction | null, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  fn.instructions.forEach((instruction, position) => {
    if (fn.arch === "x86_64") {
      if (instruction.mnemonic !== "jmpq" || !instruction.operands[0].startsWith("*%")) return;
      const targetReg = x86Family(instruction.operands[0].slice(1));
      const earlier = window(fn, Math.max(0, position - 4), Math.min(4, position)).reverse();
      const add = earlier.find((i) => i.mnemonic === "addq" && x86Family(i.operands[1]) === targetReg) ?? null;
      const load = earlier.find((i) => i.mnemonic === "movslq" && parseX86Memory(i.operands[0]) && x86Family(i.operands[1]) === targetReg) ?? null;
      if (add === null || load === null) return;
      const memory = parseX86Memory(load.operands[0])!;
      const baseReg = x86Family(memory.base || "");
      const [lea, tableOffset] = tableBase(fn, load.address, baseReg);
      if (lea === null || tableOffset === null) return;
      const [count, indexReg, bounds] = boundsCheck(fn, lea.address);
      const targets: number[] = [];
      if (elf !== null && count) {
        for (let k = 0; k < count; k++) {
          const relocation = elf.relocationAt(".rodata", tableOffset + 4 * k);
          if (relocation !== null) targets.push(relocation.base + relocation.addend - 4 * k);
        }
      }
      const evidence = [...bounds, lea.address, load.address, add.address, instruction.address];
      const indexVal = evaluator.before(load.address).get(x86Family(memory.index || "") || "") ?? Val.opaque(memory.index || "?");
      const [expression, caseRange] = indexText(indexVal, count);
      const distinct = new Set(targets).size;
      found.push(switchIdiom(fn, source, "jump table", evidence, { table: `.rodata+${hex(tableOffset)}`, entries: count, entrySize: 4, targets: targets.map((t) => hex(t)), distinctTargets: distinct, indexRegister: indexReg, index: indexVal.toString(), caseRange, entryEvidence: targets.length ? "relocation" : "none" }, targets.length ? distinct : null, expression));
    } else {
      if (instruction.mnemonic !== "br" || instruction.operands.length !== 1) return;
      const targetReg = armFamily(instruction.operands[0]);
      const earlier = window(fn, Math.max(0, position - 6), Math.min(6, position)).reverse();
      const add = earlier.find((i) => i.mnemonic === "add" && armFamily(i.operands[0]) === targetReg && i.operands.length === 4 && i.operands[3] === "lsl #2") ?? null;
      if (add === null) return;
      const adr = earlier.find((i) => i.mnemonic === "adr" && armFamily(i.operands[0]) === armFamily(add.operands[1])) ?? null;
      const load = earlier.find((i) => ["ldrb", "ldrh", "ldrsw", "ldr"].includes(i.mnemonic) && armFamily(i.operands[0]) === armFamily(add.operands[2])) ?? null;
      if (adr === null || load === null) return;
      const memory = parseArmMemory(load.operands[1]);
      const [tableInsn, tableOffset] = tableBase(fn, load.address, memory ? armFamily(memory.base || "") : null);
      if (tableInsn === null || tableOffset === null) return;
      const [count, indexReg, bounds] = boundsCheck(fn, tableInsn.address);
      const entrySize = ({ ldrb: 1, ldrh: 2, ldrsw: 4, ldr: 4 } as { [k: string]: number })[load.mnemonic];
      const base = parseImmediate(adr.operands[1]) || 0;
      let targets: number[] = [];
      if (elf !== null && count) {
        const entries = elf.words(".rodata", tableOffset, count, entrySize, entrySize === 4);
        targets = entries.map((e) => base + 4 * e);
      }
      const adrpIndex = fn.index(tableInsn.address) - 1;
      const adrp = fn.instructions[adrpIndex < 0 ? fn.instructions.length + adrpIndex : adrpIndex];
      const evidence = [...bounds, adrp.address, tableInsn.address, adr.address, load.address, add.address, instruction.address];
      const indexVal = evaluator.before(load.address).get(armFamily(memory!.index || "") || "") ?? Val.opaque(memory!.index || "?");
      const [expression, caseRange] = indexText(indexVal, count);
      const distinct = new Set(targets).size;
      found.push(switchIdiom(fn, source, "jump table", evidence, { table: `.rodata+${hex(tableOffset)}`, entries: count, entrySize, compressed: entrySize < 4, targets: targets.map((t) => hex(t)), distinctTargets: distinct, indexRegister: indexReg, index: indexVal.toString(), caseRange, entryEvidence: targets.length ? "bytes" : "none" }, targets.length ? distinct : null, expression));
    }
  });
  return found;
}

function lookupTables(fn: Func, elf: ElfFile | null, source: SourceFunction | null, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  fn.instructions.forEach((instruction, position) => {
    let count: number | null;
    let indexReg: string | null;
    let bounds: number[];
    let entrySize: number;
    let evidence: number[];
    let indexVal: Val;
    let resultReg: string | null;
    let tableOffset: number | null;
    if (fn.arch === "x86_64") {
      if (!["movl", "movslq"].includes(instruction.mnemonic) || instruction.operands.length !== 2) return;
      const memory = parseX86Memory(instruction.operands[0]);
      if (memory === null || memory.index === null || memory.scale !== 4) return;
      if (window(fn, position + 1, 3).some((i) => i.mnemonic === "jmpq")) return;
      let lea: Instruction | null;
      [lea, tableOffset] = tableBase(fn, instruction.address, x86Family(memory.base || ""));
      if (lea === null || tableOffset === null) return;
      [count, indexReg, bounds] = boundsCheck(fn, lea.address);
      entrySize = 4;
      evidence = [...bounds, lea.address, instruction.address];
      indexVal = evaluator.before(instruction.address).get(x86Family(memory.index) || "") ?? Val.opaque(memory.index);
      resultReg = x86Family(instruction.operands[1]);
    } else {
      if (instruction.mnemonic !== "ldr" || instruction.operands.length !== 2) return;
      const memory = parseArmMemory(instruction.operands[1]);
      if (memory === null || memory.index === null || memory.scale !== 4) return;
      let tableInsn: Instruction | null;
      [tableInsn, tableOffset] = tableBase(fn, instruction.address, armFamily(memory.base || ""));
      if (tableInsn === null || tableOffset === null) return;
      [count, indexReg, bounds] = boundsCheck(fn, tableInsn.address);
      entrySize = 4;
      const adrpIndex = fn.index(tableInsn.address) - 1;
      const adrp = fn.instructions[adrpIndex < 0 ? fn.instructions.length + adrpIndex : adrpIndex];
      evidence = [...bounds, adrp.address, tableInsn.address, instruction.address];
      indexVal = evaluator.before(instruction.address).get(armFamily(memory.index) || "") ?? Val.opaque(memory.index);
      resultReg = armFamily(instruction.operands[0]);
    }
    let entries: number[] = [];
    if (elf !== null && count) entries = elf.words(".rodata", tableOffset, count, entrySize);
    const [expression, caseRange] = indexText(indexVal, count);
    const detail: Obj = { table: `.rodata+${hex(tableOffset)}`, entries: count, entrySize, values: entries, indexRegister: indexReg, index: indexVal.toString(), caseRange };
    const idiom = switchIdiom(fn, source, "lookup table", evidence, detail, null, expression);
    idiom.result = [instruction.address, resultReg || "", `table[${indexVal}]`];
    if (source !== null && entries.length) {
      const values = source.caseValues;
      let ratio: number | null = null;
      if (values.length && values.length === entries.length && values.every((v) => v !== 0) && new Set(entries.map((e, k) => e / values[k])).size === 1) {
        ratio = Math.floor(entries[0] / values[0]);
      }
      idiom.detail["caseValues"] = values;
      idiom.detail["foldedFactor"] = ratio;
      idiom.verified = ratio !== null;
    }
    found.push(idiom);
  });
  return found;
}

function linearMapsAndSelectChains(fn: Func, source: SourceFunction | null, evaluator: Evaluator): Idiom[] {
  const found: Idiom[] = [];
  if (source === null || !source.hasSwitch || !source.params.length) return found;
  const index = source.params[0];
  const selects = fn.instructions.filter((i) => i.mnemonic.startsWith("cmov") || ["csel", "csinv", "csinc", "csneg"].includes(i.mnemonic));
  if (!selects.length) return found;
  const last = lastOf(selects);
  const state = new Map(evaluator.before(last.address));
  const probe = new Evaluator(fn, source.params);
  probe.state = state;
  probe.flags = evaluator.flagsAt.get(last.address) ?? null;
  probe.step(last);
  const destination = fn.arch === "x86_64" ? lastOf(last.operands) : last.operands[0];
  const result = probe.state.get(registerFamily(fn.arch, destination) || "");
  if (result === undefined) return found;
  const compares = fn.instructions.filter((i) => (i.mnemonic === "cmpl" || i.mnemonic === "cmp") && i.operands.some((o) => parseImmediate(o) !== null && (o.startsWith("$") || o.startsWith("#"))));
  const evidence = uniqueSorted([
    ...compares.map((i) => i.address),
    ...selects.map((i) => i.address),
    ...fn.instructions.filter((i) => ["leal", "madd", "sete", "setne", "movl", "mov", "xorl"].includes(i.mnemonic) && fn.start <= i.address && i.address < last.address).map((i) => i.address),
  ]);
  const text = result.toString();
  const affine = new RegExp(`\\? (-?\\d+\\*${index}(?: [+-] \\d+)?|${index}(?: [+-] \\d+)?) : (-?\\d+)$`).exec(text);
  if (affine && selects.length === 1) {
    const detail: Obj = { lowering: "linear map", expression: text };
    const idiom = switchIdiom(fn, source, "linear map", evidence, detail, null);
    const formula = affine[1];
    const fallback = parseInt(affine[2], 10);
    const coefficient = formula.includes("*") ? parseInt(formula.split("*")[0], 10) : 1;
    let constant = 0;
    const tail = / ([+-]) (\d+)$/.exec(formula);
    if (tail) constant = parseInt(tail[2], 10) * (tail[1] === "+" ? 1 : -1);
    const expected = new Map<number, number>();
    for (const [k, v] of source.cases) if (v !== null) expected.set(k, coefficient * k + constant);
    idiom.detail["formula"] = `${coefficient}*${index} + ${constant}`;
    idiom.detail["default"] = fallback;
    idiom.verified = [...expected].every(([k, v]) => source.cases.get(k) === v) && expected.size > 0;
    idiom.result = [last.address, registerFamily(fn.arch, destination) || "", text];
    found.push(idiom);
    return found;
  }
  if (compares.length >= 1 && (selects.length >= 2 || fn.instructions.some((i) => i.mnemonic.startsWith("set")))) {
    const idiom = switchIdiom(fn, source, "select chain", evidence, { lowering: "select chain", expression: text, selects: selects.length }, null);
    idiom.verified = [...source.cases.values()].filter((v) => v !== null).length <= 3;
    idiom.result = [last.address, registerFamily(fn.arch, destination) || "", text];
    found.push(idiom);
  }
  return found;
}

type Test = [Instruction, Instruction, number];
type RangeTest = [Instruction, Instruction, number, number];

function comparisonTrees(fn: Func, source: SourceFunction | null, evaluator: Evaluator): Idiom[] {
  const equality = new Map<string, Test[]>();
  const ordered = new Map<string, Test[]>();
  const ranges = new Map<string, RangeTest[]>();
  const push = <T>(map: Map<string, T[]>, key: string, item: T): void => {
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  };
  const flagWriters = new Set(["cmpl", "cmpq", "subl", "subq", "testl", "cmp", "subs", "adds", "negs", "cbz", "cbnz", "negl", "addl"]);
  fn.instructions.forEach((instruction, position) => {
    let branch: Instruction | null = null;
    for (const candidate of window(fn, position + 1, 3)) {
      if (isConditional(candidate)) {
        branch = candidate;
        break;
      }
      if (flagWriters.has(candidate.mnemonic) || isBranch(candidate) || isReturn(candidate)) break;
    }
    let value: Val | null = null;
    let constant: number | null = null;
    let code = "";
    const state = evaluator.before(instruction.address);

    const constantOf = (operand: string): number | null => {
      if (operand.startsWith("$") || operand.startsWith("#")) return parseImmediate(operand);
      const registerValue = state.get(registerFamily(fn.arch, operand) || "");
      return registerValue !== undefined && registerValue.isConst() ? registerValue.constant : null;
    };

    const ops = instruction.operands;
    if (fn.arch === "x86_64") {
      if (branch !== null && ["cmpl", "subl", "subq", "cmpq"].includes(instruction.mnemonic) && ops.length === 2 && constantOf(ops[0]) !== null) {
        value = state.get(x86Family(ops[1]) || "") ?? null;
        constant = constantOf(ops[0]);
      } else if (branch !== null && instruction.mnemonic === "testl" && ops.length === 2 && ops[0] === ops[1]) {
        value = state.get(x86Family(ops[1]) || "") ?? null;
        constant = 0;
      }
      code = branch !== null ? branch.mnemonic.slice(1) : "";
    } else {
      if (branch !== null && (instruction.mnemonic === "cmp" || instruction.mnemonic === "subs") && constantOf(lastOf(ops)) !== null) {
        value = state.get(armFamily(instruction.mnemonic === "subs" ? ops[1] : ops[0]) || "") ?? null;
        constant = constantOf(lastOf(ops));
        code = branch.mnemonic.startsWith("b.") ? branch.mnemonic.slice(2) : "";
      } else if (instruction.mnemonic === "cbz" || instruction.mnemonic === "cbnz") {
        value = state.get(armFamily(ops[0]) || "") ?? null;
        constant = 0;
        code = "eq";
        branch = instruction;
      }
    }
    if (value === null || constant === null || branch === null) return;
    const text = value.toString();
    const biased = /^(.*) - (\d+)$/.exec(text);
    if (biased && ["ae", "b", "hs", "lo", "a", "be", "hi", "ls"].includes(code)) {
      const inclusive = ["be", "ls", "a", "hi"].includes(code);
      const low = parseInt(biased[2], 10);
      push(ranges, biased[1], [instruction, branch, low, low + constant - (inclusive ? 0 : 1)] as RangeTest);
      return;
    }
    if (["e", "ne", "eq"].includes(code)) {
      push(equality, text, [instruction, branch, constant] as Test);
    } else if (["l", "le", "g", "ge", "lt", "gt", "hs", "hi", "lo", "ls", "ae", "a", "b", "be"].includes(code)) {
      push(ordered, text, [instruction, branch, constant] as Test);
    }
  });
  if (!equality.size) return [];
  let key = "";
  let best = -1;
  for (const [candidate, tests] of equality) {
    if (tests.length > best) {
      best = tests.length;
      key = candidate;
    }
  }
  const leaves = equality.get(key)!;
  if (leaves.length < 2 && !(ranges.get(key) ?? []).length) return [];
  const pivots = ordered.get(key) ?? [];
  const rangeTests = ranges.get(key) ?? [];
  const evidence = uniqueSorted([
    ...leaves.map(([i]) => i.address), ...leaves.map(([, b]) => b.address),
    ...pivots.map(([i]) => i.address), ...pivots.map(([, b]) => b.address),
    ...rangeTests.map(([i]) => i.address), ...rangeTests.map(([, b]) => b.address),
  ]);
  const kind = pivots.length ? "comparison tree" : "compare chain";
  const constants = uniqueSorted(leaves.map(([, , c]) => c));
  const detail: Obj = { lowering: kind, index: key, equalityTests: constants, pivots: uniqueSorted(pivots.map(([, , c]) => c)), rangeTests: rangeTests.map(([, , lo, hi]) => [lo, hi]), depth: pivots.length };
  const idiom = switchIdiom(fn, source, kind, evidence, detail, null, key);
  if (source !== null) {
    const tested = new Set(constants);
    for (const [, , lo, hi] of rangeTests) for (let k = lo; k <= hi; k++) tested.add(k);
    idiom.verified = source.hasSwitch && [...tested].every((k) => source.cases.has(k));
  }
  return [idiom];
}

function switchIdiom(fn: Func, source: SourceFunction | null, lowering: string, evidence: number[], detail: Obj, distinctTargets: number | null, indexTextValue: string | null = null): Idiom {
  const indexName = indexTextValue || (source && source.params.length ? source.params[0] : "k");
  const idiom = new Idiom("switch", fn.name, `switch (${indexName}) as ${lowering}`, uniqueSorted(evidence), { lowering, ...detail });
  if (source !== null) {
    idiom.verified = source.hasSwitch;
    if (distinctTargets !== null && source.cases.size) {
      const values = [...source.cases.values()];
      const distinctSource = values.every((v) => v !== null) ? new Set(values).size : source.cases.size;
      idiom.detail["distinctSourceOutcomes"] = distinctSource;
      idiom.verified = idiom.verified && distinctTargets === distinctSource;
    }
    if (detail["entries"] !== undefined && detail["entries"] !== null && source.cases.size) {
      idiom.detail["sourceCases"] = numericSort(source.cases.keys());
      if (detail["entries"] !== source.cases.size && idiom.verified !== false) idiom.verified = false;
    }
  }
  return idiom;
}

function laneCount(mnemonic: string, operands: string[]): [number, number] | null {
  if (mnemonic === "paddd") return [4, 32];
  if (mnemonic === "paddq") return [2, 64];
  if (mnemonic === "paddw") return [8, 16];
  for (const operand of operands) {
    const match = /\.(\d+)([bhsd])$/.exec(operand);
    if ((mnemonic === "add" || mnemonic === "addv") && match) {
      return [parseInt(match[1], 10), ({ b: 8, h: 16, s: 32, d: 64 } as { [k: string]: number })[match[2]]];
    }
  }
  return null;
}

function findVectorLoops(fn: Func, source: SourceFunction | null): Idiom[] {
  const found: Idiom[] = [];
  const edges = loops(fn);
  for (const [branch, target] of edges) {
    const body = loopBody(fn, [branch, target]);
    const simd = body.filter((i) => i.operands.some((o) => SIMD_REGISTER.test(o)));
    if (!simd.length) continue;
    const adds = simd.filter((i) => laneCount(i.mnemonic, i.operands));
    const lanes = adds.length ? laneCount(adds[0].mnemonic, adds[0].operands) : null;
    const accumulators = new Set(adds.map((i) => (fn.arch === "x86_64" ? lastOf(i.operands) : i.operands[0])));
    let step: number | null = null;
    for (const i of body) {
      if (fn.arch === "x86_64" && i.mnemonic === "addq" && i.operands[0].startsWith("$")) step = parseImmediate(i.operands[0]);
      if (fn.arch === "arm64" && i.mnemonic === "subs" && i.operands[2].startsWith("#")) step = parseImmediate(i.operands[2]);
    }
    let elements: number | null = null;
    if (lanes && step !== null) elements = fn.arch === "x86_64" ? Math.floor(step / Math.floor(lanes[1] / 8)) : step;
    const position = fn.index(target);
    const before = window(fn, Math.max(0, position - 24), Math.min(24, position));
    const reversedBefore = [...before].reverse();
    const mask = reversedBefore.find((i) => (i.mnemonic === "andl" || i.mnemonic === "and") && i.operands.some((o) => parseImmediate(o) !== null && bitAnd(parseImmediate(o) || 0, 0x7ffffff8) === 0x7ffffff8 && !o.startsWith("%"))) ?? null;
    const guard = reversedBefore.find((i) => (i.mnemonic === "cmpl" || i.mnemonic === "cmp") && parseImmediate(fn.arch === "x86_64" ? i.operands[0] : i.operands[1]) === (elements || 8) - 1) ?? null;
    const after = window(fn, fn.index(branch.address) + 1, 8);
    const reduction = after.filter((i) => ["pshufd", "paddd", "movd", "addv", "fmov"].includes(i.mnemonic));
    const remainder = edges.filter((e) => e[1] > branch.address && !hasSimd(loopBody(fn, e)));
    const evidence = uniqueSorted([...body.map((i) => i.address), ...reduction.map((i) => i.address), ...(mask ? [mask.address] : []), ...(guard ? [guard.address] : [])]);
    const registers = new Set<string>();
    for (const i of simd) {
      for (const o of i.operands) {
        const m = SIMD_REGISTER.exec(o);
        if (m) registers.add(m[0]);
      }
    }
    const detail: Obj = {
      vectorRegisters: textSort(registers),
      lanes: lanes ? lanes[0] : null,
      laneBits: lanes ? lanes[1] : null,
      accumulators: accumulators.size,
      elementsPerIteration: elements,
      tripCountMask: mask ? mask.text : null,
      minimumTripGuard: guard ? guard.text : null,
      reduction: reduction.map((i) => i.text),
      scalarRemainderLoop: remainder.length ? `${hex(remainder[0][1])}-${hex(remainder[0][0].address)}` : null,
      loop: `${hex(target)}-${hex(branch.address)}`,
    };
    const stores = simd.filter((i) => (fn.arch === "x86_64" && i.mnemonic.startsWith("mov") && parseX86Memory(lastOf(i.operands))) || (fn.arch === "arm64" && (i.mnemonic === "str" || i.mnemonic === "stp")));
    let text: string;
    if (lanes) {
      text = `vectorized loop: ${lanes[0]} lanes x ${accumulators.size} accumulators = ${pyStr(elements)} elements per iteration`;
    } else {
      text = `vectorized store loop: ${stores.length} x 16-byte stores = ${pyStr(step)} bytes per iteration`;
      detail["stores"] = stores.length;
      detail["bytesPerIteration"] = step;
    }
    const idiom = new Idiom("vector loop", fn.name, text, evidence, detail);
    idiom.verified = source ? source.hasLoop : null;
    const final = remainder.length ? remainder[0][0] : reduction.length ? lastOf(reduction) : branch;
    let accumulatorFamily: string | null = null;
    if (reduction.length) {
      const last = lastOf(reduction);
      accumulatorFamily = registerFamily(fn.arch, fn.arch === "x86_64" ? lastOf(last.operands) : last.operands[0]);
    }
    if (accumulatorFamily) idiom.result = [final.address, accumulatorFamily, "sum"];
    found.push(idiom);
  }
  if (!edges.length) {
    const simd = fn.instructions.filter((i) => i.operands.some((o) => SIMD_REGISTER.test(o)));
    const reduction = simd.filter((i) => ["pshufd", "paddd", "addv"].includes(i.mnemonic));
    if (reduction.length && source && source.hasLoop) {
      let lanes: [number, number] | null = null;
      for (const i of reduction) {
        const count = laneCount(i.mnemonic, i.operands);
        if (count) {
          lanes = count;
          break;
        }
      }
      const evidence = simd.map((i) => i.address);
      found.push(new Idiom("vector loop", fn.name, `fixed-count loop fully vectorized: one ${lanes ? lanes[0] : "?"}-lane load and a horizontal reduction, no back edge`, evidence, { lanes: lanes ? lanes[0] : null, reduction: reduction.map((i) => i.text), loop: null }, true));
    }
  }
  return found;
}

function findUnrolledLoops(fn: Func, source: SourceFunction | null): Idiom[] {
  const found: Idiom[] = [];
  if (source === null || !source.hasLoop) return found;
  const edges = loops(fn);
  const regions: [Instruction[], Edge | null][] = [...edges.map((e): [Instruction[], Edge | null] => [loopBody(fn, e), e]), ...(edges.length ? [] : [[fn.instructions, null] as [Instruction[], Edge | null]])];
  const parse = (operand: string): MemoryOperand | null => (fn.arch === "x86_64" ? parseX86Memory(operand) : parseArmMemory(operand));
  for (const [body, edge] of regions) {
    if (hasSimd(body)) continue;
    const loads = new Map<string, { base: string; index: string | null; entries: [number, number][] }>();
    for (const instruction of body) {
      for (const operand of instruction.operands) {
        const memory = parse(operand);
        if (memory === null || memory.base === null || ["%rbp", "%rsp", "sp"].includes(memory.base)) continue;
        if (instruction.mnemonic.startsWith("mov") && fn.arch === "x86_64" && lastOf(instruction.operands) === operand) continue;
        const width = instruction.mnemonic === "ldp" ? 2 : 1;
        const id = JSON.stringify([memory.base, memory.index]);
        if (!loads.has(id)) loads.set(id, { base: memory.base, index: memory.index, entries: [] });
        loads.get(id)!.entries.push([memory.displacement, width]);
      }
    }
    for (const { base, index, entries } of loads.values()) {
      const offsets = uniqueSorted(entries.map(([o]) => o));
      const copies = entries.reduce((total, [, w]) => total + w, 0);
      if (copies < 4 || offsets.length < 2) continue;
      const stride = offsets[1] - offsets[0];
      if (offsets.slice(1).some((b, k) => b - offsets[k] !== stride)) continue;
      let step: number | null = null;
      if (edge !== null) {
        for (const i of body) {
          if (fn.arch === "x86_64" && i.mnemonic === "addq" && i.operands[0].startsWith("$") && registerFamily("x86_64", i.operands[1]) === registerFamily("x86_64", index || "")) step = parseImmediate(i.operands[0]);
        }
      }
      const evidence = body.filter((i) => i.operands.some((o) => {
        const memory = parse(o);
        return memory !== null && memory.base === base;
      })).map((i) => i.address);
      const text = `loop unrolled by ${copies}` + (edge !== null ? ", loop kept" : ", no back edge: fully unrolled");
      const detail: Obj = { copies, stride, offsets: offsets.map((o) => hex(o)), base: stripLeft(base, "%"), indexStep: step, loop: edge ? `${hex(edge[1])}-${hex(edge[0].address)}` : null };
      found.push(new Idiom("unrolled loop", fn.name, text, numericSort(evidence), detail, true));
    }
  }
  return found;
}

function findTailCalls(fn: Func, source: SourceFunction | null): Idiom[] {
  const found: Idiom[] = [];
  for (const instruction of fn.instructions) {
    if (instruction.relocation === null) continue;
    const symbol = instruction.relocationSymbol || "";
    if ((symbol === "memset" || symbol === "memcpy") && source !== null && !source.calls.includes(symbol)) continue;
    if ((fn.arch === "x86_64" && instruction.mnemonic === "jmp" && instruction.relocation[0] === "R_X86_64_PLT32") || (fn.arch === "arm64" && instruction.mnemonic === "b" && instruction.relocation[0] === "R_AARCH64_JUMP26")) {
      const idiom = new Idiom("tail call", fn.name, `return ${symbol}(...)`, [instruction.address], { callee: symbol, relocation: instruction.relocation[0], returnsThroughCallee: true });
      idiom.verified = source ? source.calls.includes(symbol) : null;
      found.push(idiom);
    }
  }
  return found;
}

function findCalls(fn: Func): [Instruction, string][] {
  const calls: [Instruction, string][] = [];
  for (const instruction of fn.instructions) {
    if (instruction.relocation && ((instruction.mnemonic === "callq" && instruction.relocation[0] === "R_X86_64_PLT32") || (instruction.mnemonic === "bl" && instruction.relocation[0] === "R_AARCH64_CALL26"))) {
      calls.push([instruction, instruction.relocationSymbol || ""]);
    }
  }
  return calls;
}

function shape(instruction: Instruction, arch: string): string {
  let ops = [...instruction.operands];
  if (arch === "x86_64" && ops.length) {
    ops = ops.slice(0, -1);
  } else if (arch === "arm64" && ops.length) {
    ops = ops.slice(1);
  }
  return instruction.mnemonic + " " + ops.join(", ");
}

function findInlinedCalls(listing: Listing, fn: Func, source: SourceFunction | null, sources: Map<string, SourceFunction>): Idiom[] {
  const found: Idiom[] = [];
  if (source === null) return found;
  const direct = new Set<string | null>([...findCalls(fn).map(([, symbol]) => symbol), ...fn.instructions.filter((i) => (i.mnemonic === "jmp" || i.mnemonic === "b") && i.relocation).map((i) => i.relocationSymbol)]);
  for (const callee of source.calls) {
    if (!listing.functions.has(callee) || direct.has(callee)) continue;
    const calleeFunction = listing.functions.get(callee)!;
    const bodyShapes = new Set(calleeFunction.body().filter((i) => (!isReturn(i) && !["pushq", "popq", "movq", "movl", "sub", "add", "str", "ldr", "ldur", "stur"].includes(i.mnemonic)) || (i.mnemonic === "add" && i.operands.length === 3 && !i.operands[2].startsWith("#"))).map((i) => shape(i, listing.arch)));
    const matches = fn.body().filter((i) => bodyShapes.has(shape(i, listing.arch)));
    const evidence = matches.length ? matches.map((i) => i.address) : [fn.start];
    found.push(new Idiom("inlined call", fn.name, `${callee}(...) expanded in place`, evidence, { callee, calleeBodyShapes: textSort(bodyShapes), matchedInCaller: matches.map((i) => i.text), directCallPresent: false }, matches.length > 0));
  }
  return found;
}

function findSelects(fn: Func, source: SourceFunction | null, evaluator: Evaluator, taken: Set<number>): Idiom[] {
  const found: Idiom[] = [];
  fn.instructions.forEach((instruction, position) => {
    if (taken.has(instruction.address)) return;
    const mnemonic = instruction.mnemonic;
    const isSelect = (fn.arch === "x86_64" && (mnemonic.startsWith("cmov") || mnemonic.startsWith("set"))) || (fn.arch === "arm64" && ["csel", "cset", "cneg", "csinv", "csneg", "csinc"].includes(mnemonic));
    if (!isSelect || (mnemonic.startsWith("set") && fn.arch === "x86_64" && !X86_CONDITIONS.has(mnemonic.slice(3)))) return;
    const probe = new Evaluator(fn, source ? source.params : []);
    probe.state = new Map(evaluator.before(instruction.address));
    probe.flags = evaluator.flagsAt.get(instruction.address) ?? null;
    probe.step(instruction);
    const destination = fn.arch === "x86_64" ? lastOf(instruction.operands) : instruction.operands[0];
    const value = probe.state.get(registerFamily(fn.arch, destination) || "");
    const text = value !== undefined ? value.toString() : instruction.text;
    const compare = window(fn, Math.max(0, position - 3), Math.min(3, position)).reverse().find((i) => ["cmpl", "testl", "negl", "cmp", "negs", "subs"].includes(i.mnemonic)) ?? null;
    const evidence = [...(compare ? [compare.address] : []), instruction.address];
    const kind = text.includes("?") ? "branchless select" : "branchless flag";
    const idiom = new Idiom(kind, fn.name, text, evidence, { instruction: instruction.text, condition: compare ? compare.text : null });
    if (source !== null) {
      idiom.verified = source.hasSelect || /[<>]=?\s*\w+\s*;/.test(source.body) || /\b(a|b|x|rem) [<>] /.test(source.body);
    }
    idiom.result = [instruction.address, registerFamily(fn.arch, destination) || "", text];
    found.push(idiom);
  });
  return found;
}

function findMemoryBuiltins(fn: Func, source: SourceFunction | null): Idiom[] {
  const found: Idiom[] = [];
  for (const instruction of fn.instructions) {
    const symbol = instruction.relocationSymbol;
    if ((symbol === "memset" || symbol === "memcpy") && ["jmp", "callq", "b", "bl"].includes(instruction.mnemonic)) {
      const via = instruction.mnemonic === "jmp" || instruction.mnemonic === "b" ? "tail call" : "call";
      let text = `${symbol}(...) library ${via}`;
      if (source && !source.calls.some((c) => c === symbol) && source.hasLoop) text = `store loop recognized as ${symbol}(...)`;
      const idiom = new Idiom(symbol, fn.name, text, [instruction.address], { form: `library ${via}`, callee: symbol });
      idiom.verified = source ? source.calls.includes(symbol) || source.hasLoop : null;
      found.push(idiom);
    }
  }
  const instructions = fn.instructions;
  const calls = source ? source.calls : [];
  instructions.forEach((instruction, position) => {
    if (fn.arch === "x86_64" && ["movups", "movdqu", "movaps"].includes(instruction.mnemonic) && position + 1 < instructions.length) {
      const store = instructions[position + 1];
      if (store.mnemonic === instruction.mnemonic && store.operands[0] === instruction.operands[1] && parseX86Memory(store.operands[1]) && parseX86Memory(instruction.operands[0]) && !loops(fn).length) {
        const idiom = new Idiom("memcpy", fn.name, "memcpy(dst, src, 16) expanded inline as one 16-byte load and store", [instruction.address, store.address], { form: "inline expansion", bytes: 16 });
        idiom.verified = calls.includes("memcpy");
        found.push(idiom);
      }
    }
    if (fn.arch === "arm64" && instruction.mnemonic === "ldr" && instruction.operands[0].startsWith("q") && position + 1 < instructions.length) {
      const store = instructions[position + 1];
      if (store.mnemonic === "str" && store.operands[0] === instruction.operands[0]) {
        const idiom = new Idiom("memcpy", fn.name, "memcpy(dst, src, 16) expanded inline as one 16-byte load and store", [instruction.address, store.address], { form: "inline expansion", bytes: 16 });
        idiom.verified = calls.includes("memcpy");
        found.push(idiom);
      }
    }
    if (fn.arch === "x86_64" && instruction.mnemonic === "movq" && parseX86Memory(instruction.operands[0]) && position + 3 < instructions.length) {
      const following = instructions.slice(position + 1, position + 4);
      if (following[0].mnemonic === "movq" && parseX86Memory(following[0].operands[1]) && following[1].mnemonic === "movq" && parseX86Memory(following[1].operands[0]) && following[2].mnemonic === "movq" && parseX86Memory(following[2].operands[1]) && parseX86Memory(following[1].operands[0])!.displacement === 8) {
        const idiom = new Idiom("memcpy", fn.name, "memcpy(dst, src, 16) expanded inline as two 8-byte loads and stores", [instruction.address, ...following.map((i) => i.address)], { form: "inline expansion", bytes: 16 });
        idiom.verified = calls.includes("memcpy");
        found.push(idiom);
      }
    }
  });
  return found;
}

function findStackProtector(fn: Func): Idiom[] {
  const fail = fn.instructions.find((i) => i.relocationSymbol === "__stack_chk_fail") ?? null;
  if (fail === null) return [];
  let loads: Instruction[];
  let compare: Instruction | null;
  let slot: string | null;
  let guard: string;
  if (fn.arch === "x86_64") {
    loads = fn.instructions.filter((i) => i.operands.some((o) => o.includes("%fs:0x28")));
    compare = fn.instructions.find((i) => i.mnemonic === "cmpq") ?? null;
    slot = loads.length ? fn.instructions.find((i) => i.mnemonic === "movq" && i.address > loads[0].address && parseX86Memory(i.operands[1]))?.operands[1] ?? null : null;
    guard = "%fs:0x28 (tcbhead_t.stack_guard)";
  } else {
    loads = fn.instructions.filter((i) => i.relocationSymbol === "__stack_chk_guard");
    compare = loads.length ? fn.instructions.find((i) => i.mnemonic === "cmp" && i.address > lastOf(loads).address) ?? null : null;
    slot = fn.instructions.find((i) => i.mnemonic === "stur")?.operands[1] ?? null;
    guard = "__stack_chk_guard through the GOT";
  }
  const branch = fn.instructions.find((i) => compare && i.address > compare.address && isConditional(i)) ?? null;
  const evidence = [...loads.map((i) => i.address), ...(compare ? [compare.address] : []), ...(branch ? [branch.address] : []), fail.address];
  return [new Idiom("stack protector", fn.name, "canary stored in the prologue and compared in the epilogue", uniqueSorted(evidence), { guard, slot, failCall: fail.text + " -> __stack_chk_fail" }, true)];
}

function findCet(fn: Func): Idiom[] {
  if (fn.instructions.length && fn.instructions[0].mnemonic === "endbr64") {
    return [new Idiom("cet landing pad", fn.name, "endbr64 as the first instruction (-fcf-protection)", [fn.start], { bytes: fn.instructions[0].raw }, true)];
  }
  return [];
}

function findStrengthReduction(fn: Func, source: SourceFunction | null, evaluator: Evaluator, taken: Set<number>): Idiom[] {
  const found: Idiom[] = [];
  if (source === null) return found;
  for (const instruction of fn.instructions) {
    if (taken.has(instruction.address)) continue;
    let factor: number | null = null;
    let operand = "";
    if (fn.arch === "x86_64" && instruction.mnemonic === "leal") {
      const memory = parseX86Memory(instruction.operands[0]);
      if (memory && memory.base && memory.index && x86Family(memory.base) === x86Family(memory.index) && memory.displacement === 0) {
        factor = 1 + memory.scale;
        operand = memory.base;
      }
    }
    const ops = instruction.operands;
    if (fn.arch === "arm64" && instruction.mnemonic === "add" && ops.length === 4 && ops[3].startsWith("lsl #") && armFamily(ops[1]) === armFamily(ops[2])) {
      factor = 1 + 2 ** parseInt(ops[3].slice(5), 10);
      operand = ops[1];
    }
    if (factor === null || !source.multiplies.includes(factor)) continue;
    const value = evaluator.before(instruction.address).get(registerFamily(fn.arch, operand) || "") ?? Val.opaque(operand);
    found.push(new Idiom("strength reduction", fn.name, `${value} * ${factor}`, [instruction.address], { instruction: instruction.text, factor }, true));
  }
  return found;
}

function quotientShared(fn: Func, division: Idiom, modulo: Idiom): boolean {
  if (division.result === null) return false;
  const [endAddress, quotient] = division.result;
  let readsOutside = false;
  for (const instruction of fn.instructions) {
    if (instruction.address <= endAddress || modulo.evidence.includes(instruction.address)) continue;
    const families = instruction.operands.map((o) => registerFamily(fn.arch, o));
    if (!families.length) {
      if (isReturn(instruction)) break;
      continue;
    }
    const destination = fn.arch === "x86_64" ? lastOf(families) : families[0];
    let sources = fn.arch === "x86_64" ? families.slice(0, -1) : families.slice(1);
    if (["addl", "subl", "andl", "cmpl", "testl"].includes(instruction.mnemonic) && fn.arch === "x86_64") sources = families;
    if (sources.includes(quotient)) readsOutside = true;
    if (destination === quotient && !sources.includes(quotient)) break;
    if (isTerminator(instruction) && !isConditional(instruction)) break;
  }
  return readsOutside;
}

function analyzeFunction(listing: Listing, name: string, elf: ElfFile | null, sources: Map<string, SourceFunction>): Idiom[] {
  const fn = listing.functions.get(name)!;
  const source = sources.get(name) ?? null;
  const first = evaluatorFor(fn, source);
  let divisions = findDivisions(fn, first);
  let modulos = findModulos(fn, divisions, first);
  const seeds: Seeds = new Map();
  for (const idiom of [...divisions, ...modulos]) {
    if (idiom.result) seeds.set(idiom.result[0], [idiom.result[1], idiom.result[2]]);
  }
  const vectors = findVectorLoops(fn, source);
  const second = evaluatorFor(fn, source, seeds);
  divisions = findDivisions(fn, second);
  modulos = findModulos(fn, divisions, second);
  divisions = divisions.filter((d) => !modulos.some((m) => sameList(m.evidence.slice(0, d.evidence.length), d.evidence) && !quotientShared(fn, d, m)));
  for (const idiom of [...divisions, ...modulos]) {
    if (idiom.result) seeds.set(idiom.result[0], [idiom.result[1], idiom.result[2]]);
  }
  const third = evaluatorFor(fn, source, seeds);
  const switches = findSwitches(fn, elf, source, third);
  for (const idiom of switches) {
    if (idiom.result) seeds.set(idiom.result[0], [idiom.result[1], idiom.result[2]]);
  }
  const final = evaluatorFor(fn, source, seeds);
  const taken = new Set<number>();
  for (const i of [...divisions, ...modulos, ...switches]) for (const a of i.evidence) taken.add(a);
  let idioms = [...divisions, ...modulos, ...switches, ...vectors];
  idioms = idioms.concat(findUnrolledLoops(fn, source));
  idioms = idioms.concat(findTailCalls(fn, source));
  idioms = idioms.concat(findInlinedCalls(listing, fn, source, sources));
  idioms = idioms.concat(findSelects(fn, source, final, taken));
  idioms = idioms.concat(findMemoryBuiltins(fn, source));
  idioms = idioms.concat(findStackProtector(fn));
  idioms = idioms.concat(findCet(fn));
  idioms = idioms.concat(findStrengthReduction(fn, source, final, taken));
  for (const idiom of [...divisions, ...modulos]) {
    if (source !== null) {
      const algorithm = idiom.detail["algorithm"] as Obj | undefined;
      const divisor = (idiom.detail["divisor"] as number | undefined) || (algorithm ? (algorithm["divisor"] as number) : undefined);
      idiom.verified = divisor !== undefined && (idiom.kind === "division" ? source.divisions : source.modulos).includes(divisor);
    }
  }
  return idioms;
}

function tailCallText(idioms: Idiom[]): string[] {
  return idioms.filter((i) => i.kind === "tail call").map((i) => i.source);
}

const FIXTURE_BUILDS: [string, string, string, string][] = [
  ["idioms", "x86_64", "O0", "idioms.c"], ["idioms", "x86_64", "O1", "idioms.c"], ["idioms", "x86_64", "O2", "idioms.c"], ["idioms", "x86_64", "O3", "idioms.c"],
  ["idioms", "arm64", "O0", "idioms.c"], ["idioms", "arm64", "O1", "idioms.c"], ["idioms", "arm64", "O2", "idioms.c"], ["idioms", "arm64", "O3", "idioms.c"],
  ["idioms", "x86_64-nofastisel", "O0", "idioms.c"], ["idioms", "x86_64-nojt", "O2", "idioms.c"], ["idioms", "x86_64-novec", "O2", "idioms.c"], ["idioms", "x86_64-nobuiltin", "O2", "idioms.c"],
  ["idioms", "arm64-jt4", "O2", "idioms.c"],
  ["dispatch", "x86_64", "O2", "dispatch.c"], ["dispatch", "arm64", "O2", "dispatch.c"],
  ["canary", "x86_64-ssp", "O2", "canary.c"], ["canary", "x86_64-cet", "O2", "canary.c"], ["canary", "arm64-ssp", "O2", "canary.c"],
];

function buildName(program: string, tag: string, level: string): string {
  return `${program}-${tag}-${level}`;
}

function analyzeBuild(program: string, tag: string, level: string, sourceFile: string): Obj {
  const base = buildName(program, tag, level);
  const listing = loadListing(base + ".objdump.txt");
  const elf = loadElf(base + ".o");
  const sources = loadSource(sourceFile);
  const functions: Obj = {};
  for (const name of listing.functions.keys()) functions[name] = analyzeFunction(listing, name, elf, sources).map((i) => i.toDict());
  return { arch: listing.arch, level, flags: tag, functions };
}

function analyzeAll(): Map<string, Obj> {
  return new Map(FIXTURE_BUILDS.map(([p, t, l, s]) => [buildName(p, t, l), analyzeBuild(p, t, l, s)]));
}

function kindMatrix(report: Map<string, Obj>): Obj {
  const matrix: Obj = {};
  for (const [build, entry] of report) {
    const counts = new Map<string, number>();
    for (const idioms of Object.values(entry["functions"] as Obj)) {
      for (const idiom of idioms as Obj[]) {
        const kind = idiom["kind"] as string;
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    const sorted: Obj = {};
    for (const kind of textSort(counts.keys())) sorted[kind] = counts.get(kind)!;
    matrix[build] = sorted;
  }
  return matrix;
}

function relativeText(fn: Func, instruction: Instruction): string {
  const target = branchTarget(instruction);
  if (target === null) return instruction.text;
  return `${instruction.mnemonic} ->+${hex(target - fn.start)}`;
}

function listingIdentity(first: string, second: string): Obj {
  const [a, b] = [loadListing(first), loadListing(second)];
  const differences: Obj[] = [];
  for (const [name, fa] of a.functions) {
    const fb = b.functions.get(name);
    if (fb === undefined) {
      differences.push({ function: name, reason: "missing in second" });
      continue;
    }
    const count = Math.min(fa.instructions.length, fb.instructions.length);
    for (let k = 0; k < count; k++) {
      const [x, y] = [fa.instructions[k], fb.instructions[k]];
      if (relativeText(fa, x) !== relativeText(fb, y)) differences.push({ function: name, offset: `+${hex(x.address - fa.start)}`, first: x.text, second: y.text });
    }
    if (fa.instructions.length !== fb.instructions.length) differences.push({ function: name, reason: `instruction counts differ: ${fa.instructions.length} vs ${fb.instructions.length}` });
  }
  return { identical: !differences.length, differences };
}

function unverified(report: Map<string, Obj>): Obj[] {
  const rows: Obj[] = [];
  for (const [build, entry] of report) {
    for (const [name, idioms] of Object.entries(entry["functions"] as Obj)) {
      for (const idiom of idioms as Obj[]) {
        if (idiom["verified"] === false) rows.push({ build, function: name, kind: idiom["kind"], source: idiom["source"] });
      }
    }
  }
  return rows;
}

function demo(): Obj {
  const report = analyzeAll();
  const builds: Obj = {};
  for (const [k, v] of report) builds[k] = v;
  return {
    builds,
    kindMatrix: kindMatrix(report),
    sameCodeAtO2AndO3: { x86_64: listingIdentity("idioms-x86_64-O2.objdump.txt", "idioms-x86_64-O3.objdump.txt"), arm64: listingIdentity("idioms-arm64-O2.objdump.txt", "idioms-arm64-O3.objdump.txt") },
    unverified: unverified(report),
  };
}

const FIGURE_KINDS = ["division", "modulo", "switch", "vector loop", "unrolled loop", "branchless select", "branchless flag", "tail call", "inlined call", "memset", "memcpy", "strength reduction"];

function figureData(functionName = "digest"): Obj {
  const sources = loadSource("idioms.c");
  const arches: Obj = {};
  const data: Obj = { function: functionName, source: splitLines(sources.get(functionName)!.body.trim()), kinds: FIGURE_KINDS, arches };
  const keep = ["lowering", "form", "magic", "shift", "entries", "values", "targets", "elementsPerIteration", "lanes", "accumulators", "copies", "callee", "formula", "expression"];
  for (const arch of ARCHES) {
    const levels: Obj = {};
    for (const level of LEVELS) {
      const base = buildName("idioms", arch, level);
      const listing = loadListing(base + ".objdump.txt");
      const elf = loadElf(base + ".o");
      const fn = listing.functions.get(functionName)!;
      const idioms = analyzeFunction(listing, functionName, elf, sources).filter((i) => FIGURE_KINDS.includes(i.kind));
      const instructions: Obj[] = fn.instructions.map((i) => ({ a: i.address, b: i.raw, t: splitWhitespace(i.text).join(" ") }));
      const spans: Obj[] = idioms.map((i) => {
        const d: Obj = {};
        for (const [key, value] of Object.entries(i.detail)) if (keep.includes(key)) d[key] = value;
        return { k: i.kind, s: i.source, e: i.evidence, d };
      });
      levels[level] = { instructions, spans, bytes: fn.end - fn.start, count: fn.instructions.length };
    }
    arches[arch] = levels;
  }
  return data;
}

function quote(text: string): string {
  return JSON.stringify(text).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function dumps(value: J, indent: number | null, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return quote(value);
  const pad = indent === null ? "" : "\n" + " ".repeat(indent * (level + 1));
  const close = indent === null ? "" : "\n" + " ".repeat(indent * level);
  const comma = indent === null ? "," : ",";
  const colon = indent === null ? ":" : ": ";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return "[" + value.map((v) => pad + dumps(v, indent, level + 1)).join(comma) + close + "]";
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return "{" + entries.map(([k, v]) => pad + quote(k) + colon + dumps(v, indent, level + 1)).join(comma) + close + "}";
}

function parsePythonInt(text: string): number {
  const match = /^([+-]?)(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|[1-9][0-9_]*|0+)$/.exec(text.trim());
  if (!match) throw new Error(`invalid literal for int() with base 0: '${text}'`);
  const body = match[2].replace(/_/g, "");
  const value = /^0[xXoObB]/.test(body) ? Number(BigInt(body.toLowerCase())) : parseInt(body, 10);
  return match[1] === "-" ? -value : value;
}

function main(argv: string[]): number {
  if (!argv.length) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "scan" && (argv.length === 2 || argv.length === 3)) {
    const path = argv[1];
    const pathName = basename(path);
    const listing = parseListing(readFileSync(path, "utf-8"), pathName);
    const objectPath = join(dirname(path), pathName.replace(".objdump.txt", ".o"));
    const elf = existsSync(objectPath) ? new ElfFile(readFileSync(objectPath)) : null;
    const sourceName = pathName.startsWith("dispatch") ? "dispatch.c" : pathName.startsWith("canary") ? "canary.c" : "idioms.c";
    const sources = existsSync(join(FIXTURES, sourceName)) ? loadSource(sourceName) : new Map<string, SourceFunction>();
    const names = argv.length === 3 ? [argv[2]] : [...listing.functions.keys()];
    const out: Obj = {};
    for (const name of names) out[name] = analyzeFunction(listing, name, elf, sources).map((i) => i.toDict());
    console.log(dumps(out, 2));
    return 0;
  }
  if (command === "magic" && (argv.length === 2 || argv.length === 3)) {
    const divisor = parsePythonInt(argv[1]);
    const signed = argv.length === 3 && argv[2] === "signed";
    const magic = magicNumbers(divisor, 32, signed);
    console.log(dumps({ ...magic.toDict(), identityHoldsOnEdgeValues: checkIdentity(magic, edgeValues(32, signed)) }, 2));
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData(), null));
    return 0;
  }
  console.error("usage: main.py [scan LISTING.objdump.txt [FUNCTION] | magic DIVISOR [signed] | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
