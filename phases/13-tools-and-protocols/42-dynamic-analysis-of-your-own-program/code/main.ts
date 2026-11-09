// Lesson: Dynamic Analysis of Your Own Program: Debuggers, Traces, and Confirming Static Claims (phase 13 / lesson 42)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/code/main.ts

import { spawnSync } from "node:child_process";
import { accessSync, closeSync, constants, existsSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join } from "node:path";

export class PyFloat {
  constructor(readonly value: number) {}
}

export class PyTuple {
  constructor(readonly items: PyValue[]) {}
}

export type PyValue = null | boolean | number | string | PyFloat | PyTuple | PyValue[];
export type Json = null | boolean | number | string | PyFloat | PyTuple | Json[] | { [key: string]: Json } | Map<string, Json>;

export const HERE = realpathSync(__dirname);
export const FIXTURES = join(HERE, "fixtures");
export const PROGRAM = "account.c";
export const VARIANTS = ["O0", "O2"];
export const FUNCTIONS = ["bump", "classify", "sum_balances"];
export const EDGE_FUNCTION = "classify";
export const WATCH_FUNCTION = "bump";
export const WATCH_EXPRESSION = "a->balance";
export const STRUCT_NAME = "account";
export const MEMORY_WORDS = 24;
export const CONTINUE_BUDGET = 16;
export const EXPECTED_CALLS: Map<string, number> = new Map([
  ["bump", 1],
  ["classify", 3],
  ["sum_balances", 1],
]);
export const EXPECTED_OUTPUT = ["sizeof 32 align 8", "offsets 0 4 8 16 24", "class 0 1 -1", "sum 315"];
export const HOOK_REGISTERS: Record<string, string[]> = { arm64: ["x0", "x1", "pc"], x86_64: ["rdi", "rsi", "rip"] };
export const ARGUMENT_REGISTERS: Record<string, string[]> = {
  arm64: ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"],
  x86_64: ["rdi", "rsi", "rdx", "rcx", "r8", "r9"],
};
export const CONDITIONAL_ARM64 = new Set(["cbz", "cbnz", "tbz", "tbnz"]);
export const CALL_MNEMONICS = new Set(["bl", "callq", "call"]);
export const LLDB_SETTINGS = "settings set interpreter.stop-command-source-on-error false";
export const VERDICTS = ["confirmed", "refuted", "not-observed"];
export const TOOLS = ["lldb", "gdb", "rr", "strace", "ltrace", "bpftrace", "dtrace", "dtruss", "clang", "objdump", "llvm-objdump"];

export const COMMAND_MAP: [string, string, string, string][] = [
  ["break at a function", "break bump", "breakpoint set -n bump", "b bump"],
  ["break at file and line", "break account.c:13", "breakpoint set -f account.c -l 13", "b account.c:13"],
  ["break at an address", "break *0x1000004f0", "breakpoint set -a 0x1000004f0", ""],
  ["break in one module only", "(no direct form)", "breakpoint set -a 0x1000004f0 -s account-O0", ""],
  ["condition on a breakpoint", "condition 1 by == 5", "breakpoint modify -c 'by == 5' 1", ""],
  ["commands on a breakpoint", "commands 1 ... end", "breakpoint command add 1", ""],
  ["run commands at every stop", "define hook-stop ... end", "target stop-hook add -o 'register read x0'", ""],
  ["list breakpoints", "info breakpoints", "breakpoint list", "br l"],
  ["watch a variable for writes", "watch a->balance", "watchpoint set variable a->balance", "wa s v a->balance"],
  ["watch an address", "watch *(int *)0x16fdfe1fc", "watchpoint set expression -- 0x16fdfe1fc", "wa s e -- 0x16fdfe1fc"],
  ["list watchpoints", "info watchpoints", "watchpoint list -v", "wa l -v"],
  ["start the program", "run", "process launch", "run"],
  ["start and stop at the first instruction", "starti", "process launch --stop-at-entry", ""],
  ["continue", "continue", "thread continue", "c"],
  ["step into a call", "step", "thread step-in", "s"],
  ["step over a call", "next", "thread step-over", "n"],
  ["step one instruction", "stepi", "thread step-inst", "si"],
  ["step one instruction over a call", "nexti", "thread step-inst-over", "ni"],
  ["run until the function returns", "finish", "thread step-out", "finish"],
  ["backtrace", "bt", "thread backtrace", "bt"],
  ["read every register", "info registers", "register read", "re r"],
  ["read one register", "p $x0", "register read x0", ""],
  ["read memory as words", "x/8xw 0x16fdfe1f8", "memory read -s4 -fx -c8 0x16fdfe1f8", "x -s4 -fx -c8 0x16fdfe1f8"],
  ["show arguments", "info args", "frame variable --no-locals", ""],
  ["show locals", "info locals", "frame variable --no-args", ""],
  ["show one variable", "print a->balance", "frame variable a->balance", "v a->balance"],
  ["evaluate an expression", "print by + 1", "expression by + 1", "p by + 1"],
  ["disassemble the current function", "disassemble", "disassemble --frame", "di -f"],
  ["disassemble a named function", "disassemble bump", "disassemble --name bump", "di -n bump"],
  ["name an address", "info symbol 0x1000004bc", "image lookup --address 0x1000004bc", "im loo -a 0x1000004bc"],
  ["attach to a process", "attach 1234", "process attach --pid 1234", ""],
  ["open a core file", "gdb account-O0 core", "lldb -c core account-O0", ""],
  ["write a core file", "gcore core", "process save-core --style stack core", ""],
  ["run a script line", "python print(1)", "script print(1)", ""],
  ["quit", "quit", "quit", "q"],
];

export const HARDWARE_LIMITS: Json[] = [
  { arch: "x86-64", resource: "debug address registers DR0 to DR3", count: 4, lengths: [1, 2, 4, 8], softwareBreakpoint: "int3, opcode 0xCC, one byte" },
  { arch: "arm64", resource: "DBGWVR<n>_EL1 and DBGWCR<n>_EL1 pairs", count: "2 to 64 per implementation, 4 reported by lldb on this machine", lengths: [1, 2, 4, 8], softwareBreakpoint: "brk #imm16, opcode 0xd4200000 | imm16 << 5, four bytes" },
];

export class HarnessError extends Error {}

export function pySplit(text: string): string[] {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}

export function pySplitLines(text: string): string[] {
  if (!text) {
    return [];
  }
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

export function pyStrip(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) {
    start += 1;
  }
  while (end > start && chars.includes(text[end - 1])) {
    end -= 1;
  }
  return text.slice(start, end);
}

export function pyLstrip(text: string, chars: string): string {
  let start = 0;
  while (start < text.length && chars.includes(text[start])) {
    start += 1;
  }
  return text.slice(start);
}

export function splitOnce(text: string, separator: string): string[] {
  const at = text.indexOf(separator);
  return at < 0 ? [text] : [text.slice(0, at), text.slice(at + separator.length)];
}

export function pyInt0(text: string): number {
  const match = /^\s*([+-]?)(?:0[xX]_?([0-9a-fA-F](?:_?[0-9a-fA-F])*)|0[oO]_?([0-7](?:_?[0-7])*)|0[bB]_?([01](?:_?[01])*)|([1-9](?:_?[0-9])*|0(?:_?0)*))\s*$/.exec(text);
  if (!match) {
    throw new HarnessError(`invalid literal for int() with base 0: ${pyRepr(text)}`);
  }
  const sign = match[1] === "-" ? -1 : 1;
  let value: number;
  if (match[2] !== undefined) {
    value = parseInt(match[2].replaceAll("_", ""), 16);
  } else if (match[3] !== undefined) {
    value = parseInt(match[3].replaceAll("_", ""), 8);
  } else if (match[4] !== undefined) {
    value = parseInt(match[4].replaceAll("_", ""), 2);
  } else {
    value = parseInt(match[5].replaceAll("_", ""), 10);
  }
  return sign * value;
}

export function hex(value: number): string {
  return value < 0 ? "-0x" + (-value).toString(16) : "0x" + value.toString(16);
}

export function pyFloatStr(value: number): string {
  if (Number.isNaN(value)) {
    return "nan";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "inf" : "-inf";
  }
  if (value === 0) {
    return Object.is(value, -0) ? "-0.0" : "0.0";
  }
  const sign = value < 0 ? "-" : "";
  const [mantissa, exponentText] = Math.abs(value).toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const exponent = parseInt(exponentText, 10);
  if (exponent >= -4 && exponent < 16) {
    if (exponent >= 0) {
      if (digits.length <= exponent + 1) {
        return sign + digits + "0".repeat(exponent + 1 - digits.length) + ".0";
      }
      return sign + digits.slice(0, exponent + 1) + "." + digits.slice(exponent + 1);
    }
    return sign + "0." + "0".repeat(-exponent - 1) + digits;
  }
  const head = digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "");
  return sign + head + "e" + (exponent < 0 ? "-" : "+") + String(Math.abs(exponent)).padStart(2, "0");
}

export function pyRepr(value: PyValue | Map<string, number>): string {
  if (value === null) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value instanceof PyFloat) {
    return pyFloatStr(value.value);
  }
  if (typeof value === "string") {
    const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
    let out = quote;
    for (const ch of value) {
      const code = ch.codePointAt(0) ?? 0;
      if (ch === "\\" || ch === quote) {
        out += "\\" + ch;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else if (code < 0x20 || code === 0x7f) {
        out += "\\x" + code.toString(16).padStart(2, "0");
      } else {
        out += ch;
      }
    }
    return out + quote;
  }
  if (value instanceof PyTuple) {
    if (value.items.length === 1) {
      return "(" + pyRepr(value.items[0]) + ",)";
    }
    return "(" + value.items.map((item) => pyRepr(item)).join(", ") + ")";
  }
  if (value instanceof Map) {
    return "{" + [...value.entries()].map(([key, item]) => `${pyRepr(key)}: ${pyRepr(item)}`).join(", ") + "}";
  }
  return "[" + value.map((item) => pyRepr(item)).join(", ") + "]";
}

export class LiteralError extends Error {}

export function literalEval(text: string): PyValue {
  let position = 0;
  const skip = (): void => {
    while (position < text.length && " \t".includes(text[position])) {
      position += 1;
    }
  };
  const parseString = (): string => {
    let out = "";
    while (position < text.length && (text[position] === "'" || text[position] === '"')) {
      const quote = text[position];
      position += 1;
      while (true) {
        if (position >= text.length) {
          throw new LiteralError("unterminated string");
        }
        const ch = text[position];
        if (ch === quote) {
          position += 1;
          break;
        }
        if (ch === "\\") {
          const next = text[position + 1];
          const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', "0": "\0" };
          if (next === "x") {
            out += String.fromCharCode(parseInt(text.slice(position + 2, position + 4), 16));
            position += 4;
            continue;
          }
          if (next !== undefined && next in escapes) {
            out += escapes[next];
            position += 2;
            continue;
          }
          out += ch;
          position += 1;
          continue;
        }
        out += ch;
        position += 1;
      }
      skip();
    }
    return out;
  };
  const parseSequence = (close: string): PyValue[] => {
    const items: PyValue[] = [];
    let trailingComma = false;
    skip();
    while (text[position] !== close) {
      items.push(parseValue());
      skip();
      trailingComma = false;
      if (text[position] === ",") {
        position += 1;
        trailingComma = true;
        skip();
        continue;
      }
      if (text[position] !== close) {
        throw new LiteralError("expected separator");
      }
    }
    position += 1;
    if (close === ")" && items.length === 1 && !trailingComma) {
      throw new LiteralError("parenthesized value");
    }
    return items;
  };
  const parseValue = (): PyValue => {
    skip();
    const ch = text[position];
    if (ch === undefined) {
      throw new LiteralError("unexpected end");
    }
    if (ch === "[") {
      position += 1;
      return parseSequence("]");
    }
    if (ch === "(") {
      position += 1;
      const start = position;
      try {
        return new PyTuple(parseSequence(")"));
      } catch (error) {
        if (!(error instanceof LiteralError) || error.message !== "parenthesized value") {
          throw error;
        }
        position = start;
        const inner = parseValue();
        skip();
        position += 1;
        return inner;
      }
    }
    if (ch === "'" || ch === '"') {
      return parseString();
    }
    const word = /^(None|True|False)\b/.exec(text.slice(position));
    if (word) {
      position += word[1].length;
      return word[1] === "None" ? null : word[1] === "True";
    }
    const number = /^[+-]?(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/.exec(text.slice(position));
    if (number && number[0] !== "+" && number[0] !== "-") {
      position += number[0].length;
      const literal = number[0];
      if (/^[+-]?0[xXoObB]/.test(literal) || /^[+-]?[\d_]+$/.test(literal)) {
        return pyInt0(literal);
      }
      return new PyFloat(parseFloat(literal.replaceAll("_", "")));
    }
    throw new LiteralError("malformed node or string");
  };
  const value = parseValue();
  skip();
  if (position !== text.length) {
    throw new LiteralError("invalid syntax");
  }
  return value;
}

export class Line {
  constructor(
    readonly address: number,
    readonly encoding: string,
    readonly mnemonic: string,
    readonly operands: string,
  ) {}

  get text(): string {
    return this.mnemonic + (this.operands ? "\t" + this.operands : "");
  }

  get target(): number | null {
    for (const token of pySplit(this.operands.replaceAll(",", " "))) {
      if (token.startsWith("0x")) {
        return parseInt(token, 16);
      }
    }
    return null;
  }

  get targetSymbol(): string | null {
    const match = /<([^>+]+)(?:\+0x[0-9a-f]+)?>/.exec(this.operands);
    return match ? match[1] : null;
  }
}

export class Branch {
  constructor(
    readonly address: number,
    readonly mnemonic: string,
    readonly operands: string,
    readonly target: number,
    readonly fallthrough: number,
  ) {}

  get text(): string {
    return `${this.mnemonic}\t${this.operands}`;
  }
}

export class Function {
  lines: Line[] = [];

  constructor(
    readonly symbol: string,
    readonly name: string,
    readonly start: number,
  ) {}

  get end(): number {
    const last = this.lines[this.lines.length - 1];
    return last.address + Math.max(1, Math.floor(last.encoding.replaceAll(" ", "").length / 2));
  }

  lineAt(address: number): Line | null {
    for (const line of this.lines) {
      if (line.address === address) {
        return line;
      }
    }
    return null;
  }

  lineBefore(address: number): Line | null {
    let previous: Line | null = null;
    for (const line of this.lines) {
      if (line.address >= address) {
        return previous;
      }
      previous = line;
    }
    return previous;
  }

  conditionalBranches(arch: string): Branch[] {
    const branches: Branch[] = [];
    this.lines.forEach((line, position) => {
      const target = line.target;
      if (!isConditional(line.mnemonic, arch) || target === null || position + 1 >= this.lines.length) {
        return;
      }
      branches.push(new Branch(line.address, line.mnemonic, line.operands.split("<")[0].trim(), target, this.lines[position + 1].address));
    });
    return branches;
  }

  calls(): [number, string | null][] {
    return this.lines.filter((line) => CALL_MNEMONICS.has(line.mnemonic)).map((line) => [line.address, line.targetSymbol]);
  }
}

export function isConditional(mnemonic: string, arch: string): boolean {
  if (arch === "arm64") {
    return mnemonic.startsWith("b.") || CONDITIONAL_ARM64.has(mnemonic);
  }
  return /^j(?!mp$)[a-z]+$/.test(mnemonic);
}

const HEADER_RE = /^(\S+):\s+file format (\S+)(?:\s+(\S+))?\s*$/;
const FUNCTION_RE = /^([0-9a-f]+) <(.+)>:\s*$/;
const INSTRUCTION_RE = /^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2}(?: [0-9a-f]{2})*)|[0-9a-f]{8})\s*\t(\S+)(?:\t(.*))?$/;

export class Listing {
  format = "";
  arch = "";
  functions: Map<string, Function> = new Map();

  constructor(text: string) {
    let current: Function | null = null;
    for (const raw of pySplitLines(text)) {
      const header = HEADER_RE.exec(raw);
      if (header && !this.format) {
        this.format = header[2];
        this.arch = header[3] || (header[2].includes("x86-64") ? "x86_64" : "");
        continue;
      }
      const start = FUNCTION_RE.exec(raw);
      if (start) {
        const symbol = start[2];
        if (symbol.startsWith("__") && this.format.startsWith("mach-o")) {
          current = null;
          continue;
        }
        const name = this.format.startsWith("mach-o") && symbol.startsWith("_") ? symbol.slice(1) : symbol;
        current = new Function(symbol, name, parseInt(start[1], 16));
        this.functions.set(name, current);
        continue;
      }
      const instruction = INSTRUCTION_RE.exec(raw);
      if (instruction && current !== null) {
        const operands = (instruction[4] || "").split(";")[0].trim();
        current.lines.push(new Line(parseInt(instruction[1], 16), instruction[2].trim(), instruction[3], operands));
      }
    }
    if (this.functions.size === 0) {
      throw new HarnessError("no functions found in the listing");
    }
  }

  function(name: string): Function {
    const found = this.functions.get(name);
    if (found === undefined) {
      throw new HarnessError(`no function named ${name} in the listing`);
    }
    return found;
  }

  functionContaining(address: number): Function | null {
    for (const fn of this.functions.values()) {
      if (fn.start <= address && address < fn.end) {
        return fn;
      }
    }
    return null;
  }

  callCounts(caller: string): Map<string, number> {
    const counts: Map<string, number> = new Map();
    for (const line of this.function(caller).lines) {
      const target = line.target;
      if (!CALL_MNEMONICS.has(line.mnemonic) || target === null) {
        continue;
      }
      const callee = this.functionContaining(target);
      const name = callee !== null ? callee.name : "external";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }
}

export function loadListing(name: string): Listing {
  return new Listing(readFileSync(join(FIXTURES, name), "utf8"));
}

const DIE_RE = /^(0x[0-9a-f]+):\s+(DW_TAG_\w+)/;
const ATTRIBUTE_RE = /^\s+(DW_AT_\w+)\s+\((.*)\)\s*$/;

export type Die = [string, Map<string, string>];

export function parseDies(text: string): Die[] {
  const dies: Die[] = [];
  for (const raw of pySplitLines(text)) {
    const die = DIE_RE.exec(raw);
    if (die) {
      dies.push([die[2], new Map()]);
      continue;
    }
    const attribute = ATTRIBUTE_RE.exec(raw);
    if (attribute && dies.length) {
      dies[dies.length - 1][1].set(attribute[1], attribute[2]);
    }
  }
  return dies;
}

export type Member = { offset: number; type: string };
export type Layout = { name: string; size: number; members: Map<string, Member> };

function required(attributes: Map<string, string>, key: string): string {
  const value = attributes.get(key);
  if (value === undefined) {
    throw new HarnessError(key);
  }
  return value;
}

export function structLayout(dwarfText: string, name: string): Layout {
  const dies = parseDies(dwarfText);
  for (let position = 0; position < dies.length; position += 1) {
    const [tag, attributes] = dies[position];
    if (tag !== "DW_TAG_structure_type" || attributes.get("DW_AT_name") !== `"${name}"`) {
      continue;
    }
    const members: Map<string, Member> = new Map();
    for (const [memberTag, member] of dies.slice(position + 1)) {
      if (memberTag !== "DW_TAG_member") {
        break;
      }
      const typeText = member.get("DW_AT_type") ?? "";
      const typeName = typeText.includes('"') ? typeText.split('"')[1] : typeText;
      members.set(pyStrip(required(member, "DW_AT_name"), '"'), { offset: parseInt(required(member, "DW_AT_data_member_location"), 16), type: typeName });
    }
    return { name, size: parseInt(required(attributes, "DW_AT_byte_size"), 16), members };
  }
  throw new HarnessError(`no structure named ${name} in the DWARF dump`);
}

function member(layout: Layout, name: string): Member {
  const found = layout.members.get(name);
  if (found === undefined) {
    throw new HarnessError(name);
  }
  return found;
}

export function countTags(dwarfText: string, tag: string): number {
  return parseDies(dwarfText).filter(([dieTag]) => dieTag === tag).length;
}

export function subprogramNames(dwarfText: string): string[] {
  return parseDies(dwarfText)
    .filter(([t, a]) => t === "DW_TAG_subprogram" && a.has("DW_AT_name") && !a.has("DW_AT_declaration"))
    .map(([, a]) => pyStrip(required(a, "DW_AT_name"), '"'));
}

export type Predicate = (value: number) => boolean;

export function liftCondition(fn: Function, branch: Branch, valueName: string): [string, Predicate] {
  const operands = branch.operands.split(",").map((part) => part.trim());
  if (branch.mnemonic === "tbz" || branch.mnemonic === "tbnz") {
    const bit = pyInt0(pyLstrip(operands[1], "#"));
    const want = branch.mnemonic === "tbz" ? 0 : 1;
    if (bit === 31) {
      const text = want === 0 ? `${valueName} >= 0` : `${valueName} < 0`;
      return [text, want === 0 ? (value) => value >= 0 : (value) => value < 0];
    }
    return [`bit ${bit} of ${valueName} is ${want}`, (value) => (Math.floor(value / 2 ** bit) & 1) === want];
  }
  if (branch.mnemonic === "cbz" || branch.mnemonic === "cbnz") {
    if (branch.mnemonic === "cbz") {
      return [`${valueName} == 0`, (value) => value === 0];
    }
    return [`${valueName} != 0`, (value) => value !== 0];
  }
  const condition = branch.mnemonic.startsWith("b.") ? branch.mnemonic.slice(2) : branch.mnemonic.slice(1);
  const compare = fn.lineBefore(branch.address);
  if (compare === null || !["subs", "cmp", "cmpl", "cmpq", "cmp"].includes(compare.mnemonic.split("l")[0])) {
    throw new HarnessError(`no compare before the branch at 0x${branch.address.toString(16)}`);
  }
  const immediates = pySplit(compare.operands.replaceAll(",", " ")).filter((token) => "#$".includes(token.slice(0, 1)));
  if (!immediates.length) {
    throw new HarnessError(`the compare at 0x${compare.address.toString(16)} has no immediate`);
  }
  const constant = pyInt0(pyLstrip(immediates[0], "#$"));
  const tests: Record<string, [string, Predicate]> = {
    le: ["<=", (value) => value <= constant],
    lt: ["<", (value) => value < constant],
    ge: [">=", (value) => value >= constant],
    gt: [">", (value) => value > constant],
    eq: ["==", (value) => value === constant],
    ne: ["!=", (value) => value !== constant],
    e: ["==", (value) => value === constant],
    g: [">", (value) => value > constant],
    l: ["<", (value) => value < constant],
  };
  if (!Object.prototype.hasOwnProperty.call(tests, condition)) {
    throw new HarnessError(`condition ${condition} is not in the subset`);
  }
  const [symbol, predicate] = tests[condition];
  return [`${valueName} ${symbol} ${constant}`, predicate];
}

export class Plan {
  constructor(
    readonly variant: string,
    readonly binary: string,
    readonly listing: Listing,
    readonly functions: string[] = FUNCTIONS,
    readonly edgeFunction: string = EDGE_FUNCTION,
    readonly watch: string | null = WATCH_EXPRESSION,
    readonly continues: number = CONTINUE_BUDGET,
  ) {}

  get arch(): string {
    return this.listing.arch;
  }

  hookRegisters(): string[] {
    const registers = HOOK_REGISTERS[this.arch];
    if (registers === undefined) {
      throw new HarnessError(this.arch);
    }
    return registers;
  }

  branches(): Branch[] {
    return this.listing.function(this.edgeFunction).conditionalBranches(this.arch);
  }

  commands(): string[] {
    const commands = this.functions.map((name) => `breakpoint set -n ${name}`);
    for (const branch of this.branches()) {
      commands.push(`breakpoint set -a 0x${branch.target.toString(16)} -s ${this.binary}`);
      commands.push(`breakpoint set -a 0x${branch.fallthrough.toString(16)} -s ${this.binary}`);
    }
    const registers = this.hookRegisters();
    commands.push(`target stop-hook add -o "register read ${registers.join(" ")}" -o "memory read -s4 -fx -c${MEMORY_WORDS} $${registers[0]}" -o "frame variable -P 1"`);
    commands.push("run");
    if (this.watch) {
      commands.push(`watchpoint set variable ${this.watch}`);
      commands.push("watchpoint list");
    }
    for (let i = 0; i < this.continues; i += 1) {
      commands.push("continue");
    }
    commands.push("breakpoint list", "watchpoint list -v");
    return commands;
  }

  sessionName(): string {
    return `session-${this.variant}.lldb`;
  }

  lldbCommand(): string[] {
    return ["lldb", "-b", "-o", LLDB_SETTINGS, "-s", this.sessionName(), `./${this.binary}`];
  }
}

export function makePlan(variant: string, listing: Listing | null = null): Plan {
  const resolved = listing ?? loadListing(`account-${variant}.objdump.txt`);
  return new Plan(variant, `account-${variant}`, resolved);
}

export class Variable {
  fields: Map<string, string> = new Map();

  constructor(
    readonly type: string,
    readonly name: string,
    readonly value: string,
  ) {}

  private field(name: string): string {
    const found = this.fields.get(name);
    if (found === undefined) {
      throw new HarnessError(name);
    }
    return found;
  }

  fieldInt(name: string): number {
    return pyInt0(pySplit(this.field(name))[0]);
  }

  fieldChar(name: string): string {
    return pyStrip(this.field(name), "'");
  }

  fieldFloat(name: string): number {
    return parseFloat(this.field(name));
  }

  fieldPointer(name: string): number {
    return parseInt(pySplit(this.field(name))[0], 16);
  }

  fieldString(name: string): string | null {
    const parts = splitOnce(this.field(name), " ");
    return parts.length === 2 ? pyStrip(parts[1], '"') : null;
  }

  get pointer(): number | null {
    const token = this.value ? pySplit(this.value)[0] : "";
    return token.startsWith("0x") ? parseInt(token, 16) : null;
  }
}

export class Stop {
  registers: Map<string, number> = new Map();
  memoryBase: number | null = null;
  memory: number[] = [];
  variables: Map<string, Variable> = new Map();
  watchHit: [number, number] | null = null;

  constructor(
    readonly index: number,
    readonly pc: number,
    readonly functionName: string,
    readonly arguments_: Map<string, string>,
    readonly file: string | null,
    readonly line: number | null,
    readonly reason: string,
  ) {}

  get breakpoint(): number | null {
    const match = /^breakpoint (\d+)\.\d+/.exec(this.reason);
    return match ? parseInt(match[1], 10) : null;
  }

  get isWatchpoint(): boolean {
    return this.reason.startsWith("watchpoint");
  }

  word(offset: number): number | null {
    const index = Math.floor(offset / 4);
    return index >= 0 && index < this.memory.length ? this.memory[index] : null;
  }

  structPointer(): Variable | null {
    for (const variable of this.variables.values()) {
      if (variable.fields.size && variable.pointer !== null) {
        return variable;
      }
    }
    return null;
  }
}

export class BreakpointInfo {
  constructor(
    readonly number: number,
    readonly spec: string,
    public address: number | null = null,
    readonly where: string | null = null,
    readonly line: number | null = null,
    public resolved = false,
    public hits = 0,
  ) {}
}

export class WatchpointInfo {
  hits: [number, number][] = [];
  hitCount: number | null = null;

  constructor(
    readonly number: number,
    readonly address: number,
    readonly size: number,
    readonly kind: string,
  ) {}
}

export class Exchange {
  constructor(
    readonly command: string,
    readonly lines: string[],
  ) {}
}

export class Transcript {
  executable: string | null = null;
  arch: string | null = null;
  breakpoints: Map<number, BreakpointInfo> = new Map();
  watchpoints: Map<number, WatchpointInfo> = new Map();
  hardwareWatchpoints: number | null = null;
  stops: Stop[] = [];
  backtrace: [number, number, string][] = [];
  variables: Map<string, Variable> = new Map();
  memory: Map<number, number[]> = new Map();
  scriptValues: PyValue[] = [];
  programOutput: string[] = [];
  errors: [string, string][] = [];
  launched: number | null = null;
  exitStatus: number | null = null;

  constructor(
    readonly header: Map<string, string>,
    readonly exchanges: Exchange[],
  ) {}

  breakpointInfo(number: number): BreakpointInfo {
    const info = this.breakpoints.get(number);
    if (info === undefined) {
      throw new HarnessError(String(number));
    }
    return info;
  }

  lastWatchpoint(): WatchpointInfo {
    const info = this.watchpoints.get(Math.max(...this.watchpoints.keys()));
    if (info === undefined) {
      throw new HarnessError("no watchpoint");
    }
    return info;
  }

  stopsIn(fn: string): Stop[] {
    return this.stops.filter((stop) => stop.functionName === fn);
  }

  entryStops(): Stop[] {
    return this.stops.filter((stop) => stop.breakpoint !== null && this.breakpointInfo(stop.breakpoint).spec.startsWith("name"));
  }

  hits(): Map<string, number> {
    const hits: Map<string, number> = new Map();
    for (const info of this.breakpoints.values()) {
      hits.set(splitOnce(info.spec, "=")[1], info.hits);
    }
    return hits;
  }
}

const TARGET_RE = /^Current executable set to '(.+)' \((\w+)\)\.$/;
const BREAKPOINT_SET_RE = /^Breakpoint (\d+): (?:where = (\S+?)`(.+?) at (\S+?):(\d+)(?::\d+)?, )?address = 0x([0-9a-f]+)$/;
const BREAKPOINT_PENDING_RE = /^Breakpoint (\d+): no locations \(pending\)/;
const BREAKPOINT_LIST_RE = /^(\d+): (name = '(\w+)'|address = (\S+)), locations = (\d+)/;
const LOCATION_RE = /^\s+(\d+)\.(\d+): .*?address = 0x([0-9a-f]+), (resolved|unresolved), hit count = (\d+)/;
const WATCHPOINT_CREATED_RE = /^Watchpoint created: Watchpoint (\d+): addr = 0x([0-9a-f]+) size = (\d+) state = \w+ type = (\w)/;
const WATCHPOINT_HIT_RE = /^Watchpoint (\d+) hit:/;
const HARDWARE_RE = /^Number of supported hardware watchpoints: (\d+)/;
const HIT_COUNT_RE = /^\s+hit_count = (\d+)/;
const VALUE_RE = /^\s*(old|new) value: (-?\d+)/;
const PROCESS_RE = /^Process (\d+) (launched|stopped|resuming|exited with status = (\d+))/;
const THREAD_RE = /^\s*\*?\s*thread #(\d+),(?: queue = '[^']*',)? stop reason = (.+)$/;
const FRAME_RE = /^\s*\*?\s*frame #(\d+): 0x([0-9a-f]+) ([^`]+)`([\w.]+)(?:\((.*)\))?(?: \+ \d+)?(?: at ([^:\s]+):(\d+)(?::\d+)?)?\s*$/;
const REGISTER_RE = /^\s+(\w+) = 0x([0-9a-f]+)(?:\s{2,}(.*))?$/;
const MEMORY_RE = /^0x([0-9a-f]+):((?:\s+0x[0-9a-f]+)+)$/;
const VARIABLE_RE = /^\((.+?)\) (\S+) = (.*?)(\s\{)?$/;
const FIELD_RE = /^\s+(\w+) = (.*)$/;
const SOURCE_RE = /^(?:->|\s+)\s*\d+\s*\t|^\s*\t\s*\^|^\s+\^\s*$/;
const ERROR_RE = /^error: (.*)$/;
const IGNORED_RE = /^(Target \d+: \(.*\) stopped\.|Executing commands in '.*'\.|Stop hook #\d+ added\.|Current watchpoints:|Current breakpoints:|Core file '.*' was loaded\.|\s*watchpoint spec = .*|\s*declare @ .*|\s*watchpoint resources:|\s*#\d+: addr = .*|\s+ignore_count = .*|\s*Options: .*|\s*Breakpoint commands:|\s*\d+\.\d+: where = .*|\s*hit_count = .*)$/;

export function splitExchanges(text: string): [Map<string, string>, Exchange[]] {
  const header: Map<string, string> = new Map();
  const exchanges: Exchange[] = [new Exchange("", [])];
  for (const raw of pySplitLines(text)) {
    if (raw.startsWith("# ") && exchanges.length === 1 && !exchanges[0].lines.length) {
      const body = raw.slice(2);
      const at = body.indexOf(": ");
      if (at < 0) {
        header.set(body, "");
      } else {
        header.set(body.slice(0, at), body.slice(at + 2));
      }
      continue;
    }
    if (raw.startsWith("(lldb) ")) {
      exchanges.push(new Exchange(raw.slice("(lldb) ".length).trim(), []));
      continue;
    }
    exchanges[exchanges.length - 1].lines.push(raw);
  }
  return [header, exchanges];
}

export function parseFields(text: string): Map<string, string> {
  const fields: Map<string, string> = new Map();
  for (const part of text.matchAll(/(\w+) = ('[^']*'|"[^"]*"|0x[0-9a-f]+(?: "[^"]*")?|-?[\d.]+)/g)) {
    fields.set(part[1], part[2]);
  }
  return fields;
}

export function parseTranscript(text: string, leader = "x0"): Transcript {
  const [header, exchanges] = splitExchanges(text);
  const transcript = new Transcript(header, exchanges);
  let pendingRegisters: Map<string, number> = new Map();
  let pendingMemory: Map<number, number[]> = new Map();
  let pendingVariables: Map<string, Variable> = new Map();
  let pendingWatch: [number, number] | null = null;
  let watchValues: Map<string, number> = new Map();
  let awaitingStop = false;
  let reason = "";
  let block: Variable | null = null;
  for (const exchange of exchanges) {
    for (const raw of exchange.lines) {
      if (block !== null) {
        if (raw.trim() === "}") {
          block = null;
          continue;
        }
        const fld = FIELD_RE.exec(raw);
        if (fld) {
          block.fields.set(fld[1], fld[2].trim());
        }
        continue;
      }
      if (!raw.trim()) {
        continue;
      }
      let match = TARGET_RE.exec(raw);
      if (match) {
        transcript.executable = match[1];
        transcript.arch = match[2];
        continue;
      }
      match = BREAKPOINT_SET_RE.exec(raw);
      if (match) {
        const number = parseInt(match[1], 10);
        const spec = match[3] && exchange.command.startsWith("breakpoint set -n") ? `name=${match[3].split(" + ")[0]}` : `address=0x${match[6]}`;
        transcript.breakpoints.set(number, new BreakpointInfo(number, spec, parseInt(match[6], 16), match[3] ?? null, match[5] ? parseInt(match[5], 10) : null, true));
        continue;
      }
      match = BREAKPOINT_PENDING_RE.exec(raw);
      if (match) {
        const number = parseInt(match[1], 10);
        const words = pySplit(exchange.command);
        transcript.breakpoints.set(number, new BreakpointInfo(number, `name=${words[words.length - 1]}`));
        continue;
      }
      match = LOCATION_RE.exec(raw);
      if (match) {
        const info = transcript.breakpoints.get(parseInt(match[1], 10));
        if (info !== undefined) {
          info.address = parseInt(match[3], 16);
          info.resolved = match[4] === "resolved";
          info.hits = parseInt(match[5], 10);
        }
        continue;
      }
      if (BREAKPOINT_LIST_RE.test(raw)) {
        continue;
      }
      match = WATCHPOINT_CREATED_RE.exec(raw);
      if (match) {
        const number = parseInt(match[1], 10);
        transcript.watchpoints.set(number, new WatchpointInfo(number, parseInt(match[2], 16), parseInt(match[3], 10), match[4]));
        continue;
      }
      match = HARDWARE_RE.exec(raw);
      if (match) {
        transcript.hardwareWatchpoints = parseInt(match[1], 10);
        continue;
      }
      match = HIT_COUNT_RE.exec(raw);
      if (match && transcript.watchpoints.size) {
        transcript.lastWatchpoint().hitCount = parseInt(match[1], 10);
        continue;
      }
      if (WATCHPOINT_HIT_RE.test(raw)) {
        watchValues = new Map();
        continue;
      }
      match = VALUE_RE.exec(raw);
      if (match) {
        watchValues.set(match[1], parseInt(match[2], 10));
        const oldValue = watchValues.get("old");
        const newValue = watchValues.get("new");
        if (oldValue !== undefined && newValue !== undefined) {
          pendingWatch = [oldValue, newValue];
          if (transcript.watchpoints.size && (exchange.command.startsWith("run") || exchange.command.startsWith("continue"))) {
            transcript.lastWatchpoint().hits.push(pendingWatch);
          }
          watchValues = new Map();
        }
        continue;
      }
      match = PROCESS_RE.exec(raw);
      if (match) {
        if (match[2] === "launched") {
          transcript.launched = parseInt(match[1], 10);
        } else if (match[2] === "stopped") {
          awaitingStop = true;
        } else if (match[2].startsWith("exited")) {
          transcript.exitStatus = parseInt(match[3], 10);
        }
        continue;
      }
      match = THREAD_RE.exec(raw);
      if (match) {
        reason = match[2].trim();
        continue;
      }
      match = FRAME_RE.exec(raw);
      if (match) {
        const depth = parseInt(match[1], 10);
        const pc = parseInt(match[2], 16);
        const functionName = match[4];
        transcript.backtrace.push([depth, pc, functionName]);
        if (depth === 0 && awaitingStop) {
          const args: Map<string, string> = new Map();
          for (const part of (match[5] || "").split(", ")) {
            if (part.includes("=")) {
              const [key, value] = splitOnce(part, "=");
              args.set(key, value);
            }
          }
          const stop = new Stop(transcript.stops.length, pc, functionName, args, match[6] || null, match[7] ? parseInt(match[7], 10) : null, reason);
          stop.registers = pendingRegisters;
          if (pendingMemory.size) {
            const addresses = [...pendingMemory.keys()].sort((a, b) => a - b);
            stop.memoryBase = addresses[0];
            stop.memory = addresses.flatMap((address) => pendingMemory.get(address) ?? []);
          }
          stop.variables = pendingVariables;
          stop.watchHit = pendingWatch;
          transcript.stops.push(stop);
          pendingRegisters = new Map();
          pendingMemory = new Map();
          pendingVariables = new Map();
          pendingWatch = null;
          awaitingStop = false;
        }
        continue;
      }
      match = REGISTER_RE.exec(raw);
      if (match) {
        if (match[1] === leader) {
          pendingRegisters = new Map();
          pendingMemory = new Map();
          pendingVariables = new Map();
        }
        pendingRegisters.set(match[1], parseInt(match[2], 16));
        continue;
      }
      match = MEMORY_RE.exec(raw);
      if (match) {
        const words = pySplit(match[2]).map((token) => parseInt(token, 16));
        pendingMemory.set(parseInt(match[1], 16), words);
        transcript.memory.set(parseInt(match[1], 16), words);
        continue;
      }
      match = VARIABLE_RE.exec(raw);
      if (match && !raw.startsWith("(lldb)")) {
        const variable = new Variable(match[1], match[2], match[3].trim());
        if (match[4]) {
          block = variable;
        } else if (variable.value.startsWith("(") && variable.value.includes(" = ")) {
          variable.fields = parseFields(variable.value);
        }
        pendingVariables.set(variable.name, variable);
        transcript.variables.set(variable.name, variable);
        continue;
      }
      match = ERROR_RE.exec(raw);
      if (match) {
        transcript.errors.push([exchange.command, match[1]]);
        continue;
      }
      if (exchange.command.startsWith("script")) {
        try {
          transcript.scriptValues.push(literalEval(raw.trim()));
        } catch (error) {
          if (!(error instanceof LiteralError) && !(error instanceof HarnessError)) {
            throw error;
          }
          transcript.scriptValues.push(raw.trim());
        }
        continue;
      }
      if (SOURCE_RE.test(raw) || IGNORED_RE.test(raw) || raw.startsWith("Saving ") || raw.startsWith("Modified-memory") || raw.startsWith("not show") || raw.startsWith("those binaries") || raw.startsWith("in this corefile")) {
        continue;
      }
      if (exchange.command.startsWith("run") || exchange.command.startsWith("continue") || exchange.command.startsWith("process launch")) {
        transcript.programOutput.push(raw);
      }
    }
  }
  return transcript;
}

export function loadTranscript(name: string, leader = "x0"): Transcript {
  return parseTranscript(readFileSync(join(FIXTURES, name), "utf8"), leader);
}

export class Claim {
  constructor(
    readonly id: string,
    readonly kind: string,
    readonly statement: string,
    readonly source: string,
    readonly functionName: string | null = null,
  ) {}
}

export class Evidence {
  constructor(
    readonly claim: string,
    readonly verdict: string,
    readonly stop: number | null,
    readonly observation: string,
  ) {}

  toDict(): Json {
    return { claim: this.claim, verdict: this.verdict, stop: this.stop, observation: this.observation };
  }
}

export function claimsFor(plan: Plan, layout: Layout): Claim[] {
  const registers = ARGUMENT_REGISTERS[plan.arch];
  const abi = plan.arch === "arm64" ? "AAPCS64 section 6.4.2" : "x86-64 psABI section 3.2.3";
  const offsets = [...layout.members.entries()].map(([name, m]) => `${name} at ${m.offset}`).join(", ");
  const claims = [
    new Claim("arg-registers", "argument-register", `At every function entry the first arguments arrive in ${registers[0]} and ${registers[1]} (${abi}).`, "lesson 32 and the ABI"),
    new Claim("field-offsets", "field-offset", `struct ${layout.name} is ${layout.size} bytes with ${offsets} (DW_AT_data_member_location).`, "lesson 41 and the DWARF dump"),
  ];
  const fn = plan.listing.function(plan.edgeFunction);
  plan.branches().forEach((branch, index) => {
    const position = index + 1;
    const [text] = liftCondition(fn, branch, `${plan.watch || "a->balance"}`);
    claims.push(
      new Claim(
        `branch-${position}`,
        "branch-taken",
        `In ${plan.edgeFunction} the branch ${branch.mnemonic} ${branch.operands} at 0x${branch.address.toString(16)} goes to 0x${branch.target.toString(16)} when ${text}, otherwise to 0x${branch.fallthrough.toString(16)}.`,
        "lesson 33 edges and the lesson 34 lift",
        plan.edgeFunction,
      ),
    );
  });
  const calls = [...EXPECTED_CALLS.entries()].map(([name, count]) => `${name} ${count} time${count !== 1 ? "s" : ""}`).join(", ");
  claims.push(new Claim("calls", "call-edge", `main calls ${calls}, as the source says and the symbol table lists.`, "source text and nm", "main"));
  claims.push(new Claim("store-once", "store", `${WATCH_FUNCTION} writes ${plan.watch} exactly once and the new value is the old value plus by.`, "lesson 34 pseudocode", WATCH_FUNCTION));
  claims.push(new Claim("stride", "struct-stride", `sizeof(struct ${layout.name}) is ${layout.size}, so list[i].balance sits at list + ${layout.size}*i + ${member(layout, "balance").offset}.`, "lesson 41 and the psABI aggregate rule", "sum_balances"));
  claims.push(new Claim("output", "behaviour", "The program prints " + EXPECTED_OUTPUT.slice(2).join(" / ") + ".", "source arithmetic"));
  return claims;
}

function checkArguments(plan: Plan, stop: Stop): Evidence {
  const registers = ARGUMENT_REGISTERS[plan.arch];
  const parts: string[] = [];
  let verdict = "confirmed";
  let position = 0;
  for (const [name, text] of stop.arguments_) {
    const register = registers[position];
    position += 1;
    const expected = pyInt0(text);
    const actual = stop.registers.get(register);
    if (actual === undefined) {
      return new Evidence("arg-registers", "not-observed", stop.index, `${register} was not read at this stop`);
    }
    if (actual !== expected) {
      verdict = "refuted";
    }
    parts.push(`${register} = 0x${actual.toString(16)} and ${name} = ${text}`);
  }
  return new Evidence("arg-registers", verdict, stop.index, `${stop.functionName}: ` + parts.join(", "));
}

type Check = { name: string; got: string | number; expected: string | number; shown: string };

function checkLayout(layout: Layout, stop: Stop): Evidence | null {
  const pointer = stop.structPointer();
  if (pointer === null || pointer.pointer === null || stop.memoryBase !== pointer.pointer) {
    return null;
  }
  const word = (offset: number): number | null => stop.word(offset);
  const kindWord = word(member(layout, "kind").offset);
  const balanceWord = word(member(layout, "balance").offset);
  const codeWord = word(member(layout, "code").offset);
  const rateLow = word(member(layout, "rate").offset);
  const rateHigh = word(member(layout, "rate").offset + 4);
  const labelLow = word(member(layout, "label").offset);
  const labelHigh = word(member(layout, "label").offset + 4);
  if (kindWord === null || balanceWord === null || codeWord === null || rateLow === null || rateHigh === null || labelLow === null || labelHigh === null) {
    return new Evidence("field-offsets", "not-observed", stop.index, "fewer memory words than the struct needs");
  }
  const rateBytes = Buffer.alloc(8);
  rateBytes.writeUInt32LE(rateLow, 0);
  rateBytes.writeUInt32LE(rateHigh, 4);
  const kind = String.fromCharCode(kindWord & 0xff);
  const balance = balanceWord | 0;
  const code = ((codeWord & 0xffff) << 16) >> 16;
  const rate = rateBytes.readDoubleLE(0);
  const label = hex(labelHigh * 2 ** 32 + labelLow);
  const checks: Check[] = [
    { name: "kind", got: kind, expected: pointer.fieldChar("kind"), shown: kind.startsWith("0x") ? kind : pyRepr(kind) },
    { name: "balance", got: balance, expected: pointer.fieldInt("balance"), shown: String(balance) },
    { name: "code", got: code, expected: pointer.fieldInt("code"), shown: String(code) },
    { name: "rate", got: rate, expected: pointer.fieldFloat("rate"), shown: pyFloatStr(rate) },
    { name: "label", got: label, expected: hex(pointer.fieldPointer("label")), shown: label.startsWith("0x") ? label : pyRepr(label) },
  ];
  const mismatches = checks.filter((check) => check.got !== check.expected).map((check) => check.name);
  const words = stop.memory
    .slice(0, Math.floor(layout.size / 4))
    .map((w) => w.toString(16).padStart(8, "0"))
    .join(" ");
  const observation = `${stop.functionName}: bytes at 0x${pointer.pointer.toString(16)} = ${words}; ` + checks.map((check) => `${check.name} ${check.shown}`).join(", ");
  return new Evidence("field-offsets", mismatches.length ? "refuted" : "confirmed", stop.index, observation);
}

function activations(transcript: Transcript, fn: string): Stop[][] {
  const groups: Stop[][] = [];
  for (const stop of transcript.stopsIn(fn)) {
    if (stop.breakpoint !== null && transcript.breakpointInfo(stop.breakpoint).spec.startsWith("name")) {
      groups.push([stop]);
    } else if (groups.length) {
      groups[groups.length - 1].push(stop);
    }
  }
  return groups;
}

function checkBranches(plan: Plan, transcript: Transcript): Evidence[] {
  const fn = plan.listing.function(plan.edgeFunction);
  const evidence: Evidence[] = [];
  const branches = plan.branches();
  for (const activation of activations(transcript, plan.edgeFunction)) {
    const entry = activation[0];
    const pointer = entry.structPointer();
    if (pointer === null) {
      continue;
    }
    const value = pointer.fieldInt("balance");
    for (const stop of activation.slice(1)) {
      branches.forEach((branch, index) => {
        const position = index + 1;
        if (stop.pc !== branch.target && stop.pc !== branch.fallthrough) {
          return;
        }
        const [text, predicate] = liftCondition(fn, branch, "a->balance");
        const expected = predicate(value) ? branch.target : branch.fallthrough;
        const edge = stop.pc === branch.target ? "taken" : "fallthrough";
        const verdict = stop.pc === expected ? "confirmed" : "refuted";
        evidence.push(new Evidence(`branch-${position}`, verdict, stop.index, `a->balance = ${value}, ${text} is ${pyRepr(predicate(value))}, next stop 0x${stop.pc.toString(16)} (${edge}), expected 0x${expected.toString(16)}`));
      });
    }
  }
  return evidence;
}

function checkCalls(transcript: Transcript): Evidence {
  const counts: Map<string, number> = new Map();
  for (const name of EXPECTED_CALLS.keys()) {
    counts.set(name, transcript.entryStops().filter((s) => s.functionName === name).length);
  }
  const hits = transcript.hits();
  const text = [...EXPECTED_CALLS.keys()].map((name) => `${name} ${counts.get(name)} (hit count ${hits.get(name) ?? 0})`).join(", ");
  if (transcript.exitStatus === null) {
    return new Evidence("calls", "not-observed", null, `the run did not finish: entry stops ${text}`);
  }
  if ([...EXPECTED_CALLS.entries()].every(([name, count]) => counts.get(name) === count)) {
    return new Evidence("calls", "confirmed", null, `entry stops ${text}`);
  }
  return new Evidence("calls", "refuted", null, `after a full run with exit status ${transcript.exitStatus}: entry stops ${text}`);
}

function checkStore(transcript: Transcript): Evidence {
  const bump = transcript.stopsIn(WATCH_FUNCTION);
  if (!bump.length) {
    const failed = transcript.errors.filter(([command]) => command.startsWith("watchpoint set")).map(([, message]) => message);
    const detail = failed.length ? `; watchpoint set failed: ${failed[0]}` : "";
    return new Evidence("store-once", "not-observed", null, `no stop in ${WATCH_FUNCTION}, so the watchpoint was never set${detail}`);
  }
  const hits = bump.filter((stop) => stop.isWatchpoint && stop.watchHit);
  if (!hits.length) {
    return new Evidence("store-once", "not-observed", bump[0].index, "the watchpoint never reported a hit");
  }
  const [oldValue, newValue] = hits[0].watchHit ?? [0, 0];
  const by = pyInt0(hits[0].arguments_.get("by") ?? "0");
  let total = 0;
  for (const w of transcript.watchpoints.values()) {
    total += w.hits.length;
  }
  const verdict = total === 1 && newValue - oldValue === by ? "confirmed" : "refuted";
  return new Evidence("store-once", verdict, hits[0].index, `watchpoint hit ${total} time(s): old ${oldValue}, new ${newValue}, by ${by}, pc 0x${hits[0].pc.toString(16)}`);
}

function checkStride(layout: Layout, transcript: Transcript): Evidence {
  const stops = transcript.stopsIn("sum_balances").filter((s) => s.structPointer() !== null);
  if (!stops.length) {
    return new Evidence("stride", "not-observed", null, "no stop in sum_balances");
  }
  const stop = stops[0];
  const pointer = stop.structPointer();
  if (pointer === null || pointer.pointer === null) {
    throw new HarnessError("assertion failed");
  }
  const base = pointer.pointer;
  const count = pyInt0(stop.arguments_.get("count") ?? "0");
  const stride = layout.size;
  const offset = member(layout, "balance").offset;
  const byAddress: Map<number, number> = new Map();
  for (const s of transcript.stopsIn(EDGE_FUNCTION)) {
    const sp = s.structPointer();
    if (sp !== null && sp.pointer !== null) {
      byAddress.set(sp.pointer, sp.fieldInt("balance"));
    }
  }
  const seen: string[] = [];
  let verdict = "confirmed";
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const word = stop.word(stride * index + offset);
    if (word === null) {
      return new Evidence("stride", "not-observed", stop.index, `fewer than ${count} rows were read`);
    }
    const value = word | 0;
    total += value;
    const row = base + stride * index;
    const expected = byAddress.get(row);
    if (expected !== undefined && expected !== value) {
      verdict = "refuted";
    }
    seen.push(`row ${index} at 0x${row.toString(16)} balance ${value}` + (expected !== undefined ? ` (classify saw ${expected})` : ""));
  }
  const printed = transcript.programOutput.find((line) => line.startsWith("sum ")) ?? null;
  if (printed !== null && pyInt0(pySplit(printed)[1]) !== total) {
    verdict = "refuted";
  }
  return new Evidence("stride", verdict, stop.index, seen.join("; ") + `; total ${total}, program printed ${pyRepr(printed)}`);
}

function checkOutput(transcript: Transcript): Evidence {
  const missing = EXPECTED_OUTPUT.slice(2).filter((line) => !transcript.programOutput.includes(line));
  if (transcript.exitStatus === null) {
    return new Evidence("output", "not-observed", null, "the process did not exit");
  }
  const verdict = missing.length ? "refuted" : "confirmed";
  return new Evidence("output", verdict, null, `stdout ${pyRepr(transcript.programOutput)}, exit status ${transcript.exitStatus}`);
}

export function evaluate(plan: Plan, transcript: Transcript, layout: Layout): Evidence[] {
  const evidence: Evidence[] = [];
  for (const stop of transcript.entryStops()) {
    evidence.push(checkArguments(plan, stop));
  }
  for (const stop of transcript.stops) {
    const record = checkLayout(layout, stop);
    if (record !== null) {
      evidence.push(record);
    }
  }
  evidence.push(...checkBranches(plan, transcript));
  evidence.push(checkCalls(transcript));
  evidence.push(checkStore(transcript));
  evidence.push(checkStride(layout, transcript));
  evidence.push(checkOutput(transcript));
  const covered = new Set(evidence.map((record) => record.claim));
  for (const claim of claimsFor(plan, layout)) {
    if (!covered.has(claim.id)) {
      const hits = transcript.hits();
      const reason = hits.size ? `no stop tested it; breakpoint hit counts ${pyRepr(hits)}` : "no stop tested it";
      evidence.push(new Evidence(claim.id, "not-observed", null, reason));
    }
  }
  return evidence;
}

export function rollup(evidence: Evidence[]): Map<string, Map<string, Json>> {
  const summary: Map<string, Map<string, Json>> = new Map();
  for (const record of evidence) {
    let entry = summary.get(record.claim);
    if (entry === undefined) {
      entry = new Map<string, Json>([
        ["confirmed", 0],
        ["refuted", 0],
        ["not-observed", 0],
      ]);
      summary.set(record.claim, entry);
    }
    entry.set(record.verdict, (entry.get(record.verdict) as number) + 1);
  }
  for (const entry of summary.values()) {
    if (entry.get("refuted")) {
      entry.set("verdict", "refuted");
    } else if (entry.get("confirmed")) {
      entry.set("verdict", "confirmed");
    } else {
      entry.set("verdict", "not-observed");
    }
  }
  return summary;
}

export function stopKind(transcript: Transcript, stop: Stop): string {
  if (stop.isWatchpoint) {
    return "watchpoint";
  }
  if (stop.breakpoint !== null && transcript.breakpointInfo(stop.breakpoint).spec.startsWith("name")) {
    return "entry";
  }
  return "edge";
}

function claimEntry(claim: Claim, summary: Map<string, Map<string, Json>>, withSource: boolean): Json {
  const entry: Map<string, Json> = new Map([
    ["id", claim.id],
    ["kind", claim.kind],
    ["statement", claim.statement],
  ]);
  if (withSource) {
    entry.set("source", claim.source);
  }
  for (const [key, value] of summary.get(claim.id) ?? new Map<string, Json>()) {
    entry.set(key, value);
  }
  return entry;
}

function stringMap(map: Map<string, string>): Map<string, Json> {
  return new Map(map);
}

export function variantReport(variant: string): Json {
  const plan = makePlan(variant);
  const transcript = loadTranscript(`session-${variant}.lldb.txt`, plan.hookRegisters()[0]);
  const layout = structLayout(readFileSync(join(FIXTURES, `account-${variant}.dwarfdump.txt`), "utf8"), STRUCT_NAME);
  const evidence = evaluate(plan, transcript, layout);
  const summary = rollup(evidence);
  const claims = claimsFor(plan, layout);
  const hookLast = plan.hookRegisters()[plan.hookRegisters().length - 1];
  const breakpoints: Map<string, Json> = new Map();
  for (const info of transcript.breakpoints.values()) {
    breakpoints.set(`${info.number}`, { spec: info.spec, address: info.address === null ? null : `0x${info.address.toString(16)}`, resolved: info.resolved, hits: info.hits });
  }
  const watchpoints: Map<string, Json> = new Map();
  for (const w of transcript.watchpoints.values()) {
    watchpoints.set(`${w.number}`, { address: `0x${w.address.toString(16)}`, size: w.size, type: w.kind, hits: w.hits, hitCount: w.hitCount });
  }
  return {
    binary: plan.binary,
    arch: transcript.arch,
    sessionFile: plan.sessionName(),
    commands: plan.commands().length,
    breakpoints,
    hardwareWatchpoints: transcript.hardwareWatchpoints,
    watchpoints,
    stops: transcript.stops.map((stop) => {
      const registers: Map<string, Json> = new Map();
      for (const [name, value] of stop.registers) {
        if (name !== hookLast) {
          registers.set(name, `0x${value.toString(16)}`);
        }
      }
      return {
        index: stop.index,
        pc: `0x${stop.pc.toString(16)}`,
        function: stop.functionName,
        line: stop.line,
        reason: stop.reason,
        kind: stopKind(transcript, stop),
        registers,
        arguments: stringMap(stop.arguments_),
        watchHit: stop.watchHit,
      };
    }),
    exitStatus: transcript.exitStatus,
    programOutput: transcript.programOutput,
    errors: transcript.errors.map(([command, message]) => `${command}: ${message}`),
    claims: claims.map((claim) => claimEntry(claim, summary, true)),
    evidence: evidence.map((record) => record.toDict()),
  };
}

export function coreReport(): Json {
  const save = loadTranscript("core-save-O0.lldb.txt");
  const load = loadTranscript("core-load-O0.lldb.txt");
  let saving: string | null = null;
  for (const exchange of save.exchanges) {
    const found = exchange.lines.find((line) => line.startsWith("Saving "));
    if (found !== undefined) {
      saving = found;
      break;
    }
  }
  const label = load.variables.get("a->label") ?? null;
  const deref = load.variables.get("*a") ?? null;
  let labelString: string | null = null;
  if (label !== null) {
    if (label.fields.size) {
      labelString = label.fieldString("label");
    } else if (label.value.includes(" ")) {
      labelString = pyStrip(splitOnce(label.value, " ")[1], '"');
    }
  }
  const memory: Map<string, Json> = new Map();
  for (const [address, words] of load.memory) {
    memory.set(`0x${address.toString(16)}`, words.map((w) => `0x${w.toString(16).padStart(8, "0")}`));
  }
  return {
    savedAt: !save.stops.length ? null : { function: save.stops[0].functionName, pc: `0x${save.stops[0].pc.toString(16)}` },
    saving,
    backtrace: load.backtrace.map(([depth, pc, name]) => ({ frame: depth, pc: `0x${pc.toString(16)}`, function: name })),
    fieldsFromCore: deref === null ? null : stringMap(deref.fields),
    labelPointer: label === null ? null : label.value,
    labelString,
    memory,
  };
}

function isTupleList(value: PyValue, length: number): boolean {
  return Array.isArray(value) && value.length > 0 && value[0] instanceof PyTuple && value[0].items.length === length;
}

export function typesReport(): Json {
  const transcript = loadTranscript("types-O0.lldb.txt");
  const values = transcript.scriptValues;
  return {
    python: values.find((v) => typeof v === "string" && /^[0-9]/.test(v)) ?? null,
    fields: values.find((v) => isTupleList(v, 3)) ?? null,
    size: values.find((v) => typeof v === "number" || typeof v === "boolean") ?? null,
    functions: values.find((v) => isTupleList(v, 4)) ?? null,
  };
}

export function sandboxReport(): Json {
  const transcript = loadTranscript("sandbox-O0.lldb.txt");
  return { stops: transcript.stops.length, errors: transcript.errors.map(([, message]) => message).slice(0, 3), exitStatus: transcript.exitStatus };
}

export function which(name: string): string | null {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(directory || ".", name);
    try {
      accessSync(candidate, constants.X_OK);
      if (!statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function toolsPresent(): Map<string, Json> {
  return new Map(TOOLS.map((name) => [name, which(name) !== null]));
}

export function demo(): Json {
  const variants: Map<string, Json> = new Map(VARIANTS.map((variant) => [variant, variantReport(variant)]));
  const tools = toolsPresent();
  return {
    program: PROGRAM,
    variants,
    core: coreReport(),
    types: typesReport(),
    sandbox: sandboxReport(),
    commandMap: COMMAND_MAP.length,
    hardwareLimits: HARDWARE_LIMITS,
    tools,
    absentTools: [...tools.entries()]
      .filter(([, present]) => !present)
      .map(([name]) => name)
      .sort(),
  };
}

export function figureData(): Json {
  const layout = structLayout(readFileSync(join(FIXTURES, "account-O0.dwarfdump.txt"), "utf8"), STRUCT_NAME);
  const variants: Map<string, Json> = new Map();
  const claimOrder: string[] = [];
  for (const variant of VARIANTS) {
    const plan = makePlan(variant);
    const transcript = loadTranscript(`session-${variant}.lldb.txt`, plan.hookRegisters()[0]);
    const evidence = evaluate(plan, transcript, layout);
    const summary = rollup(evidence);
    const claims = claimsFor(plan, layout);
    for (const claim of claims) {
      if (!claimOrder.includes(claim.id)) {
        claimOrder.push(claim.id);
      }
    }
    const byStop: Map<number, Map<string, Json>> = new Map();
    for (const record of evidence) {
      if (record.stop !== null) {
        let entry = byStop.get(record.stop);
        if (entry === undefined) {
          entry = new Map();
          byStop.set(record.stop, entry);
        }
        entry.set(record.claim, record.verdict);
      }
    }
    const hookPair = plan.hookRegisters().slice(0, 2);
    const stops: Json[] = [];
    for (const stop of transcript.stops) {
      const pointer = stop.structPointer();
      const regs: Map<string, Json> = new Map();
      for (const [name, value] of stop.registers) {
        if (hookPair.includes(name)) {
          regs.set(name, `0x${value.toString(16)}`);
        }
      }
      stops.push({
        i: stop.index,
        pc: `0x${stop.pc.toString(16)}`,
        fn: stop.functionName,
        line: stop.line,
        kind: stopKind(transcript, stop),
        reason: stop.reason,
        regs,
        words: stop.memory.slice(0, 8).map((w) => w.toString(16).padStart(8, "0")),
        args: stringMap(stop.arguments_),
        balance: pointer === null ? null : pointer.fieldInt("balance"),
        watch: stop.watchHit,
        claims: byStop.get(stop.index) ?? new Map<string, Json>(),
      });
    }
    variants.set(variant, {
      binary: plan.binary,
      stops,
      exit: transcript.exitStatus,
      hits: [...transcript.breakpoints.values()].map((info) => ({ bp: info.number, spec: info.spec, hits: info.hits })),
      claims: claims.map((claim) => claimEntry(claim, summary, false)),
      runLevel: evidence.filter((record) => record.stop === null).map((record) => record.toDict()),
      output: transcript.programOutput,
    });
  }
  const offsets: Map<string, Json> = new Map([...layout.members.entries()].map(([name, m]) => [name, m.offset]));
  return { program: PROGRAM, struct: { name: layout.name, size: layout.size, offsets }, claimOrder, variants };
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function writeTranscript(path: string, command: string[], output: string, cwd: string): void {
  const result = spawnSync("lldb", ["--version"], { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  const version = pySplitLines((result.stdout ?? "").trim());
  const header = ["# lesson 42 capture", `# command: ${command.join(" ")}`, `# cwd: ${basename(cwd)}`, `# lldb: ${version.length ? version[0] : "unknown"}`, `# date: ${todayIso()}`];
  writeFileSync(path, header.join("\n") + "\n" + output);
}

export function runLldb(command: string[], cwd: string): string {
  const scratch = mkdtempSync(join(tmpdir(), "lesson42-out-"));
  const outPath = join(scratch, "output.txt");
  const fd = openSync(outPath, "w");
  try {
    const result = spawnSync(command[0], command.slice(1), { cwd, stdio: ["inherit", fd, fd] });
    if (result.error) {
      throw result.error;
    }
  } finally {
    closeSync(fd);
  }
  const text = readFileSync(outPath, "utf8").replace(/\r\n?/g, "\n");
  rmSync(scratch, { recursive: true, force: true });
  return text;
}

export function capture(variants: string[], directory: string = FIXTURES): string[] {
  if (which("lldb") === null) {
    throw new HarnessError("lldb is not on PATH");
  }
  const written: string[] = [];
  for (const variant of variants) {
    const plan = makePlan(variant, new Listing(readFileSync(join(directory, `account-${variant}.objdump.txt`), "utf8")));
    const session = join(directory, plan.sessionName());
    writeFileSync(session, plan.commands().join("\n") + "\n");
    const output = runLldb(plan.lldbCommand(), directory);
    writeTranscript(join(directory, `${plan.sessionName()}.txt`), plan.lldbCommand(), output, directory);
    written.push(basename(session), `${plan.sessionName()}.txt`);
  }
  return written;
}

export function captureExtras(directory: string = FIXTURES): string[] {
  const core = "account-O0-stack.core";
  const sessions: [string, string[], string[]][] = [
    ["core-save-O0.lldb", [`breakpoint set -n ${WATCH_FUNCTION}`, "run", `process save-core --style stack ${core}`], ["lldb", "-b", "-o", LLDB_SETTINGS, "-s", "core-save-O0.lldb", "./account-O0"]],
    ["core-load-O0.lldb", ["bt", "frame variable *a", "frame variable a->label", "memory read -s4 -fx -c8 $x0"], ["lldb", "-b", "-c", core, "-o", LLDB_SETTINGS, "-s", "core-load-O0.lldb", "./account-O0"]],
    [
      "types-O0.lldb",
      [
        "script import sys; print(sys.version.split()[0])",
        `script print([(f.name, f.byte_offset, f.type.name) for f in lldb.target.FindFirstType("${STRUCT_NAME}").get_fields_array()])`,
        `script print(lldb.target.FindFirstType("${STRUCT_NAME}").size)`,
        "script print([(c.function.name, hex(c.function.addr.file_addr), hex(c.function.end_addr.file_addr), c.function.addr.line_entry.line) for n in " +
          pyRepr(new PyTuple(FUNCTIONS)) +
          " for c in lldb.target.FindFunctions(n)])",
      ],
      ["lldb", "-b", "-o", LLDB_SETTINGS, "-s", "types-O0.lldb", "./account-O0"],
    ],
  ];
  const written: string[] = [];
  for (const [name, commands, command] of sessions) {
    writeFileSync(join(directory, name), commands.join("\n") + "\n");
    const output = runLldb(command, directory);
    writeTranscript(join(directory, `${name}.txt`), command, output, directory);
    written.push(name, `${name}.txt`);
  }
  const corePath = join(directory, core);
  if (existsSync(corePath)) {
    unlinkSync(corePath);
  }
  return written;
}

function runChecked(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new HarnessError(`Command '${[command, ...args].join(" ")}' returned non-zero exit status ${result.status}.`);
  }
  return result.stdout ?? "";
}

export function live(variant: string): Map<string, Json> {
  const missing = ["clang", "lldb"].filter((tool) => which(tool) === null);
  const objdump = which("llvm-objdump") ?? which("objdump");
  if (objdump === null) {
    missing.push("objdump");
  }
  if (missing.length || objdump === null) {
    return new Map<string, Json>([
      ["ran", false],
      ["reason", `missing tools: ${missing.join(", ")}`],
    ]);
  }
  const directory = mkdtempSync(join(tmpdir(), "lesson42-"));
  try {
    const binary = `account-${variant}`;
    const compile = spawnSync("clang", ["-g", `-${variant}`, "-o", join(directory, binary), join(FIXTURES, PROGRAM)], { stdio: "inherit" });
    if (compile.error) {
      throw compile.error;
    }
    if (compile.status !== 0) {
      throw new HarnessError(`clang returned non-zero exit status ${compile.status}.`);
    }
    const listingText = runChecked(objdump, ["-d", join(directory, binary)]);
    writeFileSync(join(directory, `${binary}.objdump.txt`), listingText);
    const dwarfdump = which("dwarfdump");
    const dwarf = dwarfdump ? (spawnSync(dwarfdump, ["--debug-info", join(directory, `${binary}.dSYM`)], { encoding: "utf8", maxBuffer: 1 << 28 }).stdout ?? "") : "";
    const plan = makePlan(variant, new Listing(listingText));
    writeFileSync(join(directory, plan.sessionName()), plan.commands().join("\n") + "\n");
    const output = runLldb(plan.lldbCommand(), directory);
    const transcript = parseTranscript(output, plan.hookRegisters()[0]);
    if (transcript.launched === null) {
      return new Map<string, Json>([
        ["ran", false],
        ["reason", "lldb could not launch the process"],
        ["errors", transcript.errors.map(([, m]) => m).slice(0, 3)],
      ]);
    }
    const layout = dwarf ? structLayout(dwarf, STRUCT_NAME) : structLayout(readFileSync(join(FIXTURES, "account-O0.dwarfdump.txt"), "utf8"), STRUCT_NAME);
    const evidence = evaluate(plan, transcript, layout);
    return new Map<string, Json>([
      ["ran", true],
      ["variant", variant],
      ["stops", transcript.stops.length],
      ["exitStatus", transcript.exitStatus],
      ["claims", rollup(evidence)],
      ["evidence", evidence.map((e) => e.toDict())],
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function commandTable(): string {
  const width = Math.max(...COMMAND_MAP.map((row) => row[0].length));
  const lines = [`${"task".padEnd(width)}  gdb                                 lldb`];
  for (const [task, gdb, lldb, alias] of COMMAND_MAP) {
    const suffix = alias ? `  (${alias})` : "";
    lines.push(`${task.padEnd(width)}  ${gdb.padEnd(35)} ${lldb}${suffix}`);
  }
  return lines.join("\n");
}

function quote(text: string): string {
  return JSON.stringify(text).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
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
  if (value instanceof PyFloat) {
    return pyFloatStr(value.value);
  }
  const items: string[] = [];
  let open = "[";
  let close = "]";
  if (Array.isArray(value) || value instanceof PyTuple) {
    const list: Json[] = value instanceof PyTuple ? value.items : value;
    for (const item of list) {
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
  if (!argv.length) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "figure-data") {
    console.log(dumps(figureData()));
    return 0;
  }
  if (command === "commands") {
    console.log(commandTable());
    return 0;
  }
  if (command === "tools") {
    console.log(dumps(toolsPresent(), 2));
    return 0;
  }
  if (command === "plan" && argv.length === 2) {
    console.log(makePlan(argv[1]).commands().join("\n"));
    return 0;
  }
  if (command === "capture") {
    const variants = argv.length > 1 ? argv.slice(1) : [...VARIANTS];
    const written = capture(variants.filter((v) => VARIANTS.includes(v)));
    if (variants.includes("extras") || argv.length <= 1) {
      written.push(...captureExtras());
    }
    console.log(written.join("\n"));
    return 0;
  }
  if (command === "live") {
    const result = live(argv.length > 1 ? argv[1] : "O0");
    console.log(dumps(result, 2));
    return result.get("ran") ? 0 : 1;
  }
  console.error("usage: main.py [figure-data | commands | tools | plan VARIANT | capture [VARIANT ...] | live [VARIANT]]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
