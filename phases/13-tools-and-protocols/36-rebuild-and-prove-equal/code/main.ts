// Lesson: Rebuild and Prove Equal: Differential Tests, Byte Comparison, and the Evidence Loop (phase 13 / lesson 36)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/36-rebuild-and-prove-equal/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/main.ts
import { createHash } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { machine, tmpdir, type as osType } from "node:os";
import { basename, delimiter, dirname, extname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";

type J = any;
type Obj = Record<string, J>;

export const HERE = realpathSync(__dirname);
export const FIXTURES = join(HERE, "fixtures");
export const CANDIDATES = join(FIXTURES, "candidates");
export const RUNS = join(FIXTURES, "runs");
export const ORIGINAL_SOURCE = join(FIXTURES, "ledger.c");
export const ORIGINAL_OBJECT = join(FIXTURES, "ledger-x86_64-O1.o");
export const DRIVER_SOURCE = join(HERE, "driver.c");
export const AGENT_RUN = join(RUNS, "agent-run.json");
export const FIXTURE_FLAGS = ["-target", "x86_64-unknown-linux-gnu", "-O1", "-fno-asynchronous-unwind-tables", "-c"];
export const INT_MIN = -(2 ** 31);
export const INT_MAX = 2 ** 31 - 1;
export const TRAP = "trap";
export const FUNCTIONS = ["percent_change", "grade"];
export const REA_COMMAND = (process.env.REA_MCP_COMMAND ?? "npx -y rea-agents@6.5.0 mcp").split(/\s+/).filter((part) => part !== "");
export const MCP_PROTOCOL_VERSION = "2025-11-25";

function asciiEscape(text: string): string {
  return text.replace(/[^\x00-\x7e]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyFloat(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  const [mantissa, expText] = value.toExponential().split("e");
  const exp = Number(expText);
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace("-", "").replace(".", "");
  let body: string;
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) {
      const whole = digits.length > exp + 1 ? digits.slice(0, exp + 1) : digits.padEnd(exp + 1, "0");
      const frac = digits.length > exp + 1 ? digits.slice(exp + 1) : "0";
      body = `${whole}.${frac}`;
    } else {
      body = `0.${"0".repeat(-exp - 1)}${digits}`;
    }
  } else {
    const lead = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    body = `${lead}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return (negative ? "-" : "") + body;
}

export class PyFloat {
  constructor(readonly value: number) {}
}

export function pyDumps(value: J, options: { indent?: number | null; sortKeys?: boolean; separators?: [string, string] } = {}): string {
  const indent = options.indent ?? null;
  const [itemSep, keySep] = options.separators ?? (indent === null ? [", ", ": "] : [",", ": "]);
  const render = (item: J, level: number): string => {
    if (item === null || item === undefined) return "null";
    if (item === true) return "true";
    if (item === false) return "false";
    if (item instanceof PyFloat) return pyFloat(item.value);
    if (typeof item === "number") return Number.isInteger(item) ? String(item) : pyFloat(item);
    if (typeof item === "string") return asciiEscape(JSON.stringify(item));
    const open = indent === null ? "" : "\n" + " ".repeat(indent * (level + 1));
    const close = indent === null ? "" : "\n" + " ".repeat(indent * level);
    const sep = indent === null ? itemSep : itemSep + "\n" + " ".repeat(indent * (level + 1));
    if (Array.isArray(item)) {
      if (item.length === 0) return "[]";
      return "[" + open + item.map((entry) => render(entry, level + 1)).join(sep) + close + "]";
    }
    const keys = Object.keys(item);
    if (keys.length === 0) return "{}";
    if (options.sortKeys) keys.sort();
    return "{" + open + keys.map((key) => asciiEscape(JSON.stringify(key)) + keySep + render(item[key], level + 1)).join(sep) + close + "}";
  };
  return render(value, 0);
}

export function parsePyJson(text: string): J {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) => {
    if (token.startsWith('"') || !/[.eE]/.test(token) || !Number.isInteger(Number(token))) return token;
    return `{"\\u0000pyfloat":${token}}`;
  }), (_key, value) => (value !== null && typeof value === "object" && "\u0000pyfloat" in value ? new PyFloat(value["\u0000pyfloat"]) : value));
}

function pyRepr(value: J): string {
  if (value === null || value === undefined) return "None";
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  if (typeof value === "string") return `'${value}'`;
  return String(value);
}

function hexAlt(value: number, sign: boolean): string {
  const body = "0x" + Math.abs(value).toString(16);
  if (value < 0) return "-" + body;
  return (sign ? "+" : "") + body;
}

export function canonicalJson(value: J): string {
  return pyDumps(value, { sortKeys: true, separators: [",", ":"] });
}

export function digest(value: J): string {
  return createHash("sha256").update(Buffer.from(canonicalJson(value), "utf-8")).digest("hex");
}

export function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function wrap32(value: number): number {
  return Number(BigInt.asIntN(32, BigInt(value)));
}

export function cDiv(dividend: number, divisor: number): number {
  const quotient = Number(BigInt(Math.abs(dividend)) / BigInt(Math.abs(divisor)));
  return dividend < 0 !== divisor < 0 ? -quotient : quotient;
}

export function idiv32(dividend: number, divisor: number, arch: string): number | string {
  if (dividend === INT_MIN && divisor === -1) return arch === "x86_64" ? TRAP : INT_MIN;
  return cDiv(dividend, divisor);
}

export function percentChangeModel(before: number, after: number, arch = "x86_64"): number | string {
  if (before === 0) return 0;
  const product = wrap32(wrap32(after - before) * 100);
  return idiv32(product, before, arch);
}

export function gradeModel(score: number): number {
  const tens = cDiv(score, 10);
  const table: Record<number, number> = { 10: 4, 9: 4, 8: 3, 7: 2, 6: 1 };
  return table[tens] ?? 0;
}

export function model(fn: string, args: number[], arch = "x86_64"): number | string {
  if (fn === "percent_change") return percentChangeModel(args[0], args[1], arch);
  if (fn === "grade") return gradeModel(args[0]);
  throw new Error(`no model for ${fn}`);
}

export const PERCENT_BEFORE = [0, 1, -1, 3, -3, 7, 100, -100, INT_MAX, INT_MIN];
export const PERCENT_AFTER = [0, 5, -5, 105, 536870911, INT_MAX, INT_MIN];
export const GRADE_SCORES = [INT_MIN, -11, -10, -9, -1, 0, 9, 10, 59, 60, 69, 70, 79, 80, 89, 90, 99, 100, 101, 109, 110, INT_MAX];
export const NAIVE_CASES: Record<string, number[][]> = {
  percent_change: [
    [100, 150],
    [200, 100],
    [0, 5],
    [50, 100],
  ],
  grade: [[55], [65], [75], [85], [95], [100]],
};

export class Cell {
  constructor(
    readonly fn: string,
    readonly args: number[],
    readonly kind: string,
  ) {}

  line(): string {
    return [this.fn, ...this.args.map(String)].join(" ");
  }
}

export function classify(fn: string, args: number[]): string {
  if (fn === "percent_change") {
    const [before, after] = args;
    if (before === 0) return "zero guard";
    const difference = after - before;
    const product = wrap32(difference) * 100;
    if (wrap32(difference) !== difference || wrap32(product) !== product) {
      return percentChangeModel(before, after) === TRAP ? "trap" : "overflow";
    }
    if (before < 0 || after < 0) return "negative";
    return product % before !== 0 ? "rounding" : "plain";
  }
  const score = args[0];
  if (score < 0) return "negative truncation";
  if (score > 109) return "beyond the switch";
  const last = ((score % 10) + 10) % 10;
  return last === 0 || last === 9 ? "boundary" : "plain";
}

export function inputGrid(): Cell[] {
  const cells: Cell[] = [];
  for (const before of PERCENT_BEFORE) {
    for (const after of PERCENT_AFTER) cells.push(new Cell("percent_change", [before, after], classify("percent_change", [before, after])));
  }
  for (const score of GRADE_SCORES) cells.push(new Cell("grade", [score], classify("grade", [score])));
  return cells;
}

export function naiveCells(): Cell[] {
  const cells: Cell[] = [];
  for (const [fn, cases] of Object.entries(NAIVE_CASES)) for (const args of cases) cells.push(new Cell(fn, args, "naive"));
  return cells;
}

export function platformSystem(): string {
  const name = osType();
  return name === "Windows_NT" ? "Windows" : name;
}

export function hostArch(): string {
  const name = machine().toLowerCase();
  if (name === "x86_64" || name === "amd64") return "x86_64";
  if (name === "arm64" || name === "aarch64") return "aarch64";
  return name;
}

function which(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export function hostCompiler(): string | null {
  return which("clang") || which("cc");
}

export function originalIsFixtureObject(): boolean {
  return hostArch() === "x86_64" && platformSystem() === "Linux";
}

export interface Harness {
  binary: string;
  originalKind: string;
  host: string;
  compiler: string;
}

function runChecked(command: string, args: string[]): void {
  const completed = spawnSync(command, args, { stdio: "inherit" });
  if (completed.status !== 0) {
    throw new Error(`Command '${[command, ...args].join(" ")}' returned non-zero exit status ${completed.status}.`);
  }
}

export function buildHarness(candidates: Record<string, string>, workdir: string): Harness {
  const compiler = hostCompiler();
  if (compiler === null) throw new Error("no C compiler on PATH");
  const missing = FUNCTIONS.filter((name) => !(name in candidates));
  if (missing.length > 0) throw new Error(`candidate missing for ${pyRepr(missing)}`);
  const objects: string[] = [];
  let originalKind: string;
  if (originalIsFixtureObject()) {
    objects.push(ORIGINAL_OBJECT);
    originalKind = "fixture-object";
  } else {
    const original = join(workdir, "original.o");
    runChecked(compiler, ["-O1", "-c", ORIGINAL_SOURCE, "-o", original]);
    objects.push(original);
    originalKind = "fixture-source";
  }
  const renames = FUNCTIONS.map((name) => `-D${name}=cand_${name}`);
  for (const name of FUNCTIONS) {
    const out = join(workdir, `cand_${name}.o`);
    runChecked(compiler, ["-O1", ...renames, "-c", candidates[name], "-o", out]);
    objects.push(out);
  }
  const binary = join(workdir, "differential");
  runChecked(compiler, ["-O1", DRIVER_SOURCE, ...objects, "-o", binary]);
  return { binary, originalKind, host: `${hostArch()} ${platformSystem()}`, compiler };
}

export function parseValue(token: string): number | string {
  if (token === TRAP) return TRAP;
  if (!/^\s*[+-]?\d+\s*$/.test(token)) throw new Error(`invalid literal for int() with base 10: '${token}'`);
  return Number.parseInt(token, 10);
}

export function execute(harness: Harness, cells: Cell[]): Obj[] {
  const feed = cells.map((cell) => cell.line() + "\n").join("");
  const completed = spawnSync(harness.binary, [], { input: feed, encoding: "utf-8" });
  if (completed.status !== 0) throw new Error(`Command '${harness.binary}' returned non-zero exit status ${completed.status}.`);
  const lines = completed.stdout.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const rows: Obj[] = [];
  for (let i = 0; i < Math.min(cells.length, lines.length); i++) {
    const cell = cells[i];
    const tokens = lines[i].split(/\s+/).filter((token) => token !== "");
    const original = parseValue(tokens[tokens.length - 2]);
    const candidate = parseValue(tokens[tokens.length - 1]);
    rows.push({ function: cell.fn, args: [...cell.args], kind: cell.kind, original, candidate, match: original === candidate });
  }
  if (rows.length !== cells.length) throw new Error("driver printed fewer rows than cells");
  return rows;
}

export function oracleDisagreements(rows: Obj[], arch: string): Obj[] {
  const disagreements: Obj[] = [];
  for (const row of rows) {
    const expected = model(row.function, [...row.args], arch);
    if (expected !== row.original) disagreements.push({ ...row, model: expected });
  }
  return disagreements;
}

export interface LegOneReport {
  originalKind: string;
  host: string;
  arch: string;
  naivePassed: boolean;
  cells: number;
  mismatches: Obj[];
  oracleDisagreements: Obj[];
  rows: Obj[];
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "tmp"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function proveBehaviour(candidates: Record<string, string>, grid: Cell[] | null = null): LegOneReport {
  const cells = grid && grid.length > 0 ? [...grid] : inputGrid();
  const [harness, naiveRows, rows] = withTempDir((tmp) => {
    const built = buildHarness(candidates, tmp);
    return [built, execute(built, naiveCells()), execute(built, cells)] as const;
  });
  const arch = hostArch();
  return {
    originalKind: harness.originalKind,
    host: harness.host,
    arch,
    naivePassed: naiveRows.every((row) => row.match),
    cells: rows.length,
    mismatches: rows.filter((row) => !row.match),
    oracleDisagreements: oracleDisagreements(rows, arch),
    rows,
  };
}

export function compareRows(rows: Obj[]): Obj[] {
  return rows.filter((row) => row.original !== row.candidate);
}

const SHT_SYMTAB = 2;
const SHT_RELA = 4;
const STT_SECTION = 3;
const EM_X86_64 = 62;
const ET_REL = 1;
export const RELOC_NAMES: Record<number, string> = {
  0: "R_X86_64_NONE",
  1: "R_X86_64_64",
  2: "R_X86_64_PC32",
  4: "R_X86_64_PLT32",
  10: "R_X86_64_32",
  11: "R_X86_64_32S",
};
export const RELOC_WIDTH: Record<number, number> = { 1: 8, 2: 4, 4: 4, 10: 4, 11: 4 };
export const PC_RELATIVE = new Set([2, 4]);

export class Reloc {
  constructor(
    public offset: number,
    public type: number,
    public symbol: string,
    public addend: number,
  ) {}

  get typeName(): string {
    return RELOC_NAMES[this.type] ?? `R_X86_64_${this.type}`;
  }

  get width(): number {
    return RELOC_WIDTH[this.type] ?? 4;
  }
}

export class FunctionBytes {
  constructor(
    public name: string,
    public section: string,
    public start: number,
    public data: Buffer,
    public relocations: Reloc[],
  ) {}

  get size(): number {
    return this.data.length;
  }
}

interface Section {
  name_offset: number;
  type: number;
  offset: number;
  size: number;
  link: number;
  info: number;
  name: string;
  data: Buffer;
}

interface ElfSymbol {
  name: string;
  value: number;
  size: number;
  shndx: number;
  type: number;
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

export class ElfObject {
  path: string;
  data: Buffer;
  sections: Section[];
  symbols: ElfSymbol[];
  relocations: Map<number, Reloc[]>;

  constructor(path: string) {
    this.path = path;
    const data = readFileSync(path);
    this.data = data;
    if (data.length < 6 || data.subarray(0, 4).toString("latin1") !== "\x7fELF" || data[4] !== 2 || data[5] !== 1) {
      throw new Error(`${path} is not an ELF64 little-endian file`);
    }
    const eType = data.readUInt16LE(16);
    const eMachine = data.readUInt16LE(18);
    if (eMachine !== EM_X86_64 || eType !== ET_REL) throw new Error(`${path} is not an x86-64 relocatable object`);
    const shoff = u64(data, 40);
    const shentsize = data.readUInt16LE(58);
    const shnum = data.readUInt16LE(60);
    const shstrndx = data.readUInt16LE(62);
    const raw: Section[] = [];
    for (let index = 0; index < shnum; index++) {
      const base = shoff + index * shentsize;
      raw.push({
        name_offset: data.readUInt32LE(base),
        type: data.readUInt32LE(base + 4),
        offset: u64(data, base + 24),
        size: u64(data, base + 32),
        link: data.readUInt32LE(base + 40),
        info: data.readUInt32LE(base + 44),
        name: "",
        data: Buffer.alloc(0),
      });
    }
    const names = raw[shstrndx];
    for (const section of raw) {
      section.name = this.cstring(names.offset + section.name_offset);
      section.data = data.subarray(section.offset, section.offset + section.size);
    }
    this.sections = raw;
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  private cstring(offset: number): string {
    const end = this.data.indexOf(0, offset);
    return this.data.subarray(offset, end).toString("latin1");
  }

  private readSymbols(): ElfSymbol[] {
    const symtab = this.sections.find((section) => section.type === SHT_SYMTAB)!;
    const strtab = this.sections[symtab.link];
    const symbols: ElfSymbol[] = [];
    for (let offset = 0; offset < symtab.size; offset += 24) {
      const nameOffset = symtab.data.readUInt32LE(offset);
      const info = symtab.data[offset + 4];
      const shndx = symtab.data.readUInt16LE(offset + 6);
      const value = u64(symtab.data, offset + 8);
      const size = u64(symtab.data, offset + 16);
      let name = this.cstring(strtab.offset + nameOffset);
      if ((info & 0xf) === STT_SECTION && shndx < this.sections.length) name = this.sections[shndx].name;
      symbols.push({ name, value, size, shndx, type: info & 0xf });
    }
    return symbols;
  }

  private readRelocations(): Map<number, Reloc[]> {
    const table = new Map<number, Reloc[]>();
    for (const section of this.sections) {
      if (section.type !== SHT_RELA) continue;
      const entries: Reloc[] = [];
      for (let offset = 0; offset < section.size; offset += 24) {
        const rOffset = u64(section.data, offset);
        const rInfo = section.data.readBigUInt64LE(offset + 8);
        const rAddend = Number(section.data.readBigInt64LE(offset + 16));
        const symbol = this.symbols[Number(rInfo >> 32n)].name;
        entries.push(new Reloc(rOffset, Number(rInfo & 0xffffffffn), symbol, rAddend));
      }
      table.set(section.info, entries);
    }
    return table;
  }

  sectionNamed(name: string): Section {
    const found = this.sections.find((section) => section.name === name);
    if (found === undefined) throw new Error("StopIteration");
    return found;
  }

  symbol(name: string): ElfSymbol {
    const matches = this.symbols.filter((symbol) => symbol.name === name && symbol.type !== STT_SECTION);
    if (matches.length === 0) throw new Error(`${name} is not a symbol in ${basename(this.path)}`);
    return matches[0];
  }

  function(name: string): FunctionBytes {
    const symbol = this.symbol(name);
    const section = this.sections[symbol.shndx];
    const start = symbol.value;
    const size = symbol.size;
    const inside = (this.relocations.get(symbol.shndx) ?? [])
      .filter((reloc) => start <= reloc.offset && reloc.offset < start + size)
      .map((reloc) => new Reloc(reloc.offset - start, reloc.type, reloc.symbol, reloc.addend));
    return new FunctionBytes(name, section.name, start, section.data.subarray(start, start + size), inside);
  }

  readTarget(reloc: Reloc, length: number): Buffer {
    const section = this.sectionNamed(reloc.symbol);
    const offset = reloc.addend + (PC_RELATIVE.has(reloc.type) ? reloc.width : 0);
    return section.data.subarray(offset, offset + length);
  }
}

export function maskRelocations(data: Buffer, relocations: Reloc[]): [Buffer, [number, number][]] {
  const masked = Buffer.from(data);
  const ranges: [number, number][] = [];
  for (const reloc of relocations) {
    for (let index = reloc.offset; index < Math.min(reloc.offset + reloc.width, masked.length); index++) masked[index] = 0;
    ranges.push([reloc.offset, reloc.width]);
  }
  return [masked, ranges];
}

export function readTable(obj: ElfObject, reloc: Reloc, entries: number, width: number): number[] {
  const raw = obj.readTarget(reloc, entries * width);
  const values: number[] = [];
  for (let index = 0; index < raw.length; index += width) values.push(raw.readIntLE(index, Math.min(width, raw.length - index)));
  return values;
}

export const CLAIMS: Record<string, Obj> = {
  percent_change: { relocations: 0 },
  grade: { relocations: 1, table: { entries: 5, width: 4 } },
};

function listEqual(a: number[] | null, b: number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export class LegTwoReport {
  constructor(
    public fn: string,
    public candidate: string,
    public originalSize: number,
    public candidateSize: number,
    public maskedEqual: boolean,
    public differingOffsets: number[],
    public maskedRanges: [number, number][],
    public relocationsMatch: boolean,
    public relocationDetail: Obj[],
    public originalTable: number[] | null,
    public candidateTable: number[] | null,
  ) {}

  get tablesEqual(): boolean | null {
    if (this.originalTable === null) return null;
    return listEqual(this.originalTable, this.candidateTable);
  }

  get bytesEqual(): boolean {
    return this.originalSize === this.candidateSize && this.maskedEqual && this.relocationsMatch;
  }

  get status(): string {
    if (!this.bytesEqual || this.tablesEqual === false) return "fail";
    return "pass";
  }

  reasons(): string[] {
    const reasons: string[] = [];
    if (this.originalSize !== this.candidateSize) {
      reasons.push(`size ${this.originalSize} vs ${this.candidateSize} bytes`);
    } else if (!this.maskedEqual) {
      reasons.push(`${this.differingOffsets.length} unmasked bytes differ, first at offset ${hexAlt(this.differingOffsets[0], false)}`);
    }
    if (!this.relocationsMatch) reasons.push("relocation records differ in count, offset, type, or target section");
    if (this.tablesEqual === false) {
      reasons.push(`referenced constants differ: ${pyRepr(this.originalTable)} vs ${pyRepr(this.candidateTable)}`);
    }
    return reasons;
  }
}

export function compileFixtureObject(source: string, out: string): string {
  const clang = which("clang");
  if (clang === null) throw new Error("clang is required for the x86-64 fixture flags");
  runChecked(clang, [...FIXTURE_FLAGS, source, "-o", out]);
  return out;
}

function withSuffix(path: string, suffix: string): string {
  const ext = extname(path);
  return join(dirname(path), basename(path, ext) + suffix);
}

function stem(path: string): string {
  return basename(path, extname(path));
}

export function candidateObject(candidate: string, workdir: string | null): string {
  if (extname(candidate) === ".o") return candidate;
  if (which("clang") && workdir !== null) return compileFixtureObject(candidate, join(workdir, stem(candidate) + ".o"));
  const committed = withSuffix(candidate, ".o");
  if (existsSync(committed)) return committed;
  throw new Error(`no clang and no committed object for ${basename(candidate)}`);
}

export function proveBytes(fn: string, candidate: string, original: string = ORIGINAL_OBJECT, workdir: string | null = null): LegTwoReport {
  const originalObj = new ElfObject(original);
  const candidateObj = new ElfObject(candidateObject(candidate, workdir));
  const left = originalObj.function(fn);
  const right = candidateObj.function(fn);
  const [maskedLeft, ranges] = maskRelocations(left.data, left.relocations);
  const [maskedRight] = maskRelocations(right.data, right.relocations);
  const differing: number[] = [];
  for (let index = 0; index < Math.min(maskedLeft.length, maskedRight.length); index++) {
    if (maskedLeft[index] !== maskedRight[index]) differing.push(index);
  }
  const detail: Obj[] = [];
  let relocationsMatch = left.relocations.length === right.relocations.length;
  for (let i = 0; i < Math.min(left.relocations.length, right.relocations.length); i++) {
    const relocLeft = left.relocations[i];
    const relocRight = right.relocations[i];
    const same = relocLeft.offset === relocRight.offset && relocLeft.type === relocRight.type && relocLeft.symbol === relocRight.symbol;
    relocationsMatch = relocationsMatch && same;
    detail.push({
      offset: relocLeft.offset,
      type: relocLeft.typeName,
      original_target: `${relocLeft.symbol}${hexAlt(relocLeft.addend, true)}`,
      candidate_target: `${relocRight.symbol}${hexAlt(relocRight.addend, true)}`,
      same_shape: same,
    });
  }
  const claim = CLAIMS[fn] ?? {};
  if ("relocations" in claim && left.relocations.length !== claim.relocations) {
    throw new Error(`${fn}: expected ${claim.relocations} relocations in the original, found ${left.relocations.length}`);
  }
  let originalTable: number[] | null = null;
  let candidateTable: number[] | null = null;
  if ("table" in claim && left.relocations.length > 0 && right.relocations.length > 0) {
    const { entries, width } = claim.table;
    originalTable = readTable(originalObj, left.relocations[0], entries, width);
    candidateTable = readTable(candidateObj, right.relocations[0], entries, width);
  }
  return new LegTwoReport(
    fn,
    stem(candidate),
    left.size,
    right.size,
    left.size === right.size && differing.length === 0,
    differing,
    ranges,
    relocationsMatch,
    detail,
    originalTable,
    candidateTable,
  );
}

export class McpError extends Error {}

const EMPTY = Symbol("empty");

class Inbox<T> {
  private items: T[] = [];
  private waiters: ((value: T) => void)[] = [];

  put(value: T): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter(value);
    else this.items.push(value);
  }

  get(timeoutMs: number): Promise<T | typeof EMPTY> {
    if (this.items.length > 0) return Promise.resolve(this.items.shift() as T);
    return new Promise((resolveValue) => {
      const waiter = (value: T) => {
        clearTimeout(timer);
        resolveValue(value);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        resolveValue(EMPTY);
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }
}

function monotonic(): number {
  return performance.now() / 1000;
}

export class McpStdioClient {
  command: string[];
  env: NodeJS.ProcessEnv | undefined;
  timeout: number;
  process: ChildProcess | null = null;
  inbox = new Inbox<Obj | null>();
  nextId = 0;
  notifications: Obj[] = [];
  serverInfo: Obj = {};
  protocolVersion = "";

  constructor(command: string[], env?: NodeJS.ProcessEnv, timeout = 330.0) {
    this.command = command;
    this.env = env;
    this.timeout = timeout;
  }

  async enter(): Promise<McpStdioClient> {
    await this.start();
    return this;
  }

  async exit(): Promise<void> {
    await this.close();
  }

  async start(): Promise<void> {
    this.process = spawn(this.command[0], this.command.slice(1), { stdio: ["pipe", "pipe", "ignore"], env: this.env });
    this.pump();
    const result = await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "aiefs-lesson-36", version: "1.0.0" },
    });
    this.serverInfo = result.serverInfo ?? {};
    this.protocolVersion = result.protocolVersion ?? "";
    this.notify("notifications/initialized", {});
  }

  private pump(): void {
    const child = this.process!;
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        this.inbox.put(null);
      }
    };
    child.on("error", finish);
    const lines = createInterface({ input: child.stdout! });
    lines.on("line", (line) => {
      try {
        this.inbox.put(parsePyJson(line));
      } catch {
        return;
      }
    });
    lines.on("close", finish);
  }

  private send(message: Obj): void {
    this.process!.stdin!.write(Buffer.from(pyDumps(message) + "\n", "utf-8"));
  }

  notify(method: string, params: Obj): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  async request(method: string, params: Obj): Promise<Obj> {
    this.nextId += 1;
    const requestId = this.nextId;
    this.send({ jsonrpc: "2.0", id: requestId, method, params });
    const deadline = monotonic() + this.timeout;
    while (true) {
      const remaining = deadline - monotonic();
      if (remaining <= 0) throw new McpError(`${method}: no response within ${this.timeout.toFixed(0)} s`);
      const message = await this.inbox.get(remaining * 1000);
      if (message === EMPTY) continue;
      if (message === null) throw new McpError(`${method}: server closed stdout`);
      if (message.id !== requestId) {
        this.notifications.push(message);
        continue;
      }
      if ("error" in message) throw new McpError(pyDumps(message.error));
      return message.result ?? {};
    }
  }

  async listTools(): Promise<string[]> {
    const result = await this.request("tools/list", {});
    return (result.tools ?? []).map((tool: Obj) => tool.name).sort();
  }

  callTool(name: string, args: Obj): Promise<Obj> {
    return this.request("tools/call", { name, arguments: args });
  }

  async close(): Promise<void> {
    const child = this.process;
    if (child === null) return;
    const exited = new Promise<boolean>((resolveExit) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolveExit(true);
        return;
      }
      const timer = setTimeout(() => resolveExit(false), 20000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolveExit(true);
      });
    });
    child.stdin?.end();
    if (!(await exited)) child.kill("SIGKILL");
    child.stdout?.destroy();
    this.process = null;
  }
}

export function reaAvailable(): boolean {
  const ghidra = process.env.GHIDRA_INSTALL_DIR ?? "";
  let isDir = false;
  try {
    isDir = ghidra !== "" && statSync(ghidra).isDirectory();
  } catch {
    isDir = false;
  }
  return Boolean(which(REA_COMMAND[0])) && Boolean(ghidra) && isDir;
}

export function tableAddress(assembly: string[]): string | null {
  for (const line of assembly) {
    if (line.toUpperCase().includes("LEA")) {
      const found = line.match(/0x[0-9a-fA-F]+/g);
      if (found) return found[found.length - 1];
    }
  }
  return null;
}

export async function agentLoop(target: string, client: McpStdioClient, functions: string[] = FUNCTIONS): Promise<Obj> {
  const steps: Obj[] = [];
  const evidence: Obj = {};

  const step = async (tool: string, args: Obj): Promise<Obj> => {
    const started = monotonic();
    const result = await client.callTool(tool, args);
    const structured = result.structuredContent || {};
    const evidenceId = structured.evidence_id ?? null;
    if (evidenceId) evidence[evidenceId] = structured;
    steps.push({
      step: steps.length + 1,
      tool,
      arguments: args,
      seconds: new PyFloat(Number((monotonic() - started).toFixed(2))),
      is_error: Boolean(result.isError),
      evidence_id: evidenceId,
      confidence: structured.confidence ?? null,
      authority: structured.authority ?? null,
      limitations: structured.limitations ?? [],
      result_sha256: digest(result),
    });
    if (result.isError) throw new McpError(pyDumps(result.content ?? null).slice(0, 800));
    return structured;
  };

  await step("open_binary", { path: target, provider_id: "ghidra" });
  const dossiers: Obj = {};
  for (const name of functions) dossiers[name] = await step("analyze_function", { procedure: name });
  const address = tableAddress(((dossiers.grade || {}).normalized_result ?? {}).assembly ?? []);
  if (address) await step("read_bytes", { address, length: 20 });
  await step("get_evidence_bundle", { detail: "summary" });
  await step("close_binary", {});
  return {
    target: { path: basename(target), sha256: fileSha256(target) },
    server: { ...client.serverInfo, protocolVersion: client.protocolVersion },
    command: client.command,
    steps,
    evidence,
  };
}

export function loadAgentRun(path: string = AGENT_RUN): Obj {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function functionEvidence(run: Obj, fn: string): Obj | null {
  for (const step of run.steps) {
    if (step.tool === "analyze_function" && step.arguments.procedure === fn) return run.evidence[step.evidence_id] ?? null;
  }
  return null;
}

export function pseudocode(run: Obj, fn: string): string {
  const record = functionEvidence(run, fn) || {};
  return (record.normalized_result || {}).pseudocode || "";
}

export function claim(claimId: string, kind: string, status: string, evidenceIds: string[], detail: Obj): Obj {
  return { claim_id: claimId, kind, status, evidence_ids: evidenceIds, detail };
}

export function aggregate(statuses: string[]): string {
  if (statuses.some((status) => status === "fail")) return "fail";
  if (statuses.length === 0 || statuses.some((status) => status !== "pass")) return "unknown";
  return "pass";
}

export function buildProof(legOne: LegOneReport | null, legTwo: LegTwoReport[], run: Obj): Obj {
  const ids: Record<string, string[]> = {};
  for (const name of FUNCTIONS) {
    ids[name] = run.steps
      .filter((step: Obj) => step.tool === "analyze_function" && step.arguments.procedure === name && step.evidence_id)
      .map((step: Obj) => step.evidence_id);
  }
  const claims: Obj[] = [];
  for (const name of FUNCTIONS) {
    if (legOne === null) {
      claims.push(claim(`${name}.behaviour`, "behavioral", "unknown", ids[name], { reason: "no C compiler on this host" }));
    } else {
      const mismatches = legOne.mismatches.filter((row) => row.function === name);
      const cells = legOne.rows.filter((row) => row.function === name).length;
      claims.push(
        claim(`${name}.behaviour`, "behavioral", mismatches.length === 0 ? "pass" : "fail", ids[name], {
          original: legOne.originalKind,
          host: legOne.host,
          cells,
          mismatches: mismatches.length,
        }),
      );
    }
  }
  for (const report of legTwo) {
    claims.push(
      claim(`${report.fn}.bytes`, "structural-function", report.bytesEqual ? "pass" : "fail", ids[report.fn], {
        candidate: report.candidate,
        size: report.originalSize,
        masked: report.maskedRanges,
      }),
    );
    if (report.tablesEqual !== null) {
      claims.push(
        claim(`${report.fn}.referenced-constants`, "structural-function", report.tablesEqual ? "pass" : "fail", ids[report.fn], {
          original: report.originalTable,
          candidate: report.candidateTable,
        }),
      );
    }
  }
  const status = aggregate(claims.map((entry) => entry.status));
  const record: Obj = {
    predicate_type: "rea.reconstruction-proof",
    operation: "verify_reconstruction_obligations",
    confidence: "observed",
    authority: "controlled-replay",
    subject: run.target ?? null,
    normalized_result: { passed: status === "pass", status, claims },
    evidence_links: [...new Set(Object.values(ids).flat())].sort(),
    limitations: ["Pass covers the declared claims on the declared grid and the declared bytes. It is not global equivalence."],
  };
  record.evidence_id = "ev_" + digest(record);
  return record;
}

export const PLAUSIBLE: Record<string, string> = {
  percent_change: join(CANDIDATES, "percent_change_wide.c"),
  grade: join(CANDIDATES, "grade_thresholds.c"),
};
export const EQUAL: Record<string, string> = {
  percent_change: join(CANDIDATES, "percent_change_mul_first.c"),
  grade: join(CANDIDATES, "grade_switch.c"),
};
export const LEG_TWO_CANDIDATES: [string, string][] = [
  ["percent_change", join(CANDIDATES, "percent_change_mul_first.c")],
  ["percent_change", join(CANDIDATES, "percent_change_split.c")],
  ["percent_change", join(CANDIDATES, "percent_change_wide.c")],
  ["percent_change", join(CANDIDATES, "percent_change_div_first.c")],
  ["grade", join(CANDIDATES, "grade_switch.c")],
  ["grade", join(CANDIDATES, "grade_table.c")],
  ["grade", join(CANDIDATES, "grade_thresholds.c")],
  ["grade", join(CANDIDATES, "grade_case10_wrong.c")],
];

export function legOneSummary(report: LegOneReport): Obj {
  return {
    naivePassed: report.naivePassed,
    gridMismatches: report.mismatches.length,
    firstMismatches: report.mismatches.slice(0, 3).map((row) => ({
      function: row.function,
      args: row.args,
      kind: row.kind,
      original: row.original,
      candidate: row.candidate,
    })),
    oracleDisagreements: report.oracleDisagreements.length,
  };
}

export function saveLegOneRun(report: LegOneReport, label: string): string {
  mkdirSync(RUNS, { recursive: true });
  const path = join(RUNS, `leg-one-${label}-${report.arch}-${platformSystem().toLowerCase()}.json`);
  const payload = {
    original_kind: report.originalKind,
    host: report.host,
    arch: report.arch,
    naive_passed: report.naivePassed,
    rows: report.rows,
  };
  writeFileSync(path, pyDumps(payload, { indent: 1 }) + "\n");
  return path;
}

export async function runAgent(live: boolean, target: string = ORIGINAL_OBJECT): Promise<[Obj, string]> {
  if (live && reaAvailable()) {
    const client = await new McpStdioClient(REA_COMMAND, { ...process.env }).enter();
    let run: Obj;
    try {
      run = await agentLoop(target, client);
    } finally {
      await client.exit();
    }
    mkdirSync(RUNS, { recursive: true });
    writeFileSync(AGENT_RUN, pyDumps(run, { indent: 1 }) + "\n");
    return [run, "live"];
  }
  if (live) console.error("rea or GHIDRA_INSTALL_DIR not found; replaying fixtures/runs/agent-run.json");
  return [loadAgentRun(), "replayed fixture"];
}

export async function demo(argv: string[]): Promise<void> {
  const live = argv.includes("--live");
  const saveRuns = argv.includes("--save-runs");
  const legOne: Record<string, LegOneReport | null> = { plausible: null, equal: null };
  if (hostCompiler()) {
    legOne.plausible = proveBehaviour(PLAUSIBLE);
    legOne.equal = proveBehaviour(EQUAL);
    if (saveRuns) {
      for (const [label, report] of Object.entries(legOne)) if (report) saveLegOneRun(report, label);
    }
  }
  const legTwo = withTempDir((tmp) => LEG_TWO_CANDIDATES.map(([name, path]) => proveBytes(name, path, ORIGINAL_OBJECT, tmp)));
  const [run, mode] = await runAgent(live);
  const equalReports = legTwo.filter((report) => report.candidate === "percent_change_mul_first" || report.candidate === "grade_switch");
  const proof = buildProof(legOne.equal, equalReports, run);
  const legTwoSummary: Obj = {};
  for (const report of legTwo) legTwoSummary[report.candidate] = { status: report.status, reasons: report.reasons() };
  const proofClaims: Obj = {};
  for (const entry of proof.normalized_result.claims) proofClaims[entry.claim_id] = entry.status;
  console.log(
    pyDumps(
      {
        host: `${hostArch()} ${platformSystem()}`,
        originalKind: legOne.equal ? legOne.equal.originalKind : "not run",
        gridCells: inputGrid().length,
        plausible: legOne.plausible ? legOneSummary(legOne.plausible) : "no C compiler",
        equal: legOne.equal ? legOneSummary(legOne.equal) : "no C compiler",
        legTwo: legTwoSummary,
        agentRun: { mode, server: run.server, steps: run.steps.map((step: Obj) => `${step.tool} ${step.evidence_id || "-"}`) },
        proof: { status: proof.normalized_result.status, evidence_id: proof.evidence_id, claims: proofClaims },
      },
      { indent: 2 },
    ),
  );
}

if (require.main === module) {
  demo(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
