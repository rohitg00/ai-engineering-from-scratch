// Lesson: Calling Conventions and Stack Frames: System V, Windows x64, and AArch64 (phase 13 / lesson 38)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code/main.ts

import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";

type Rec = { [key: string]: any };

const HERE = __dirname;
const FIXTURES = join(HERE, "fixtures");

const SYSV = "sysv";
const WIN64 = "win64";
const AAPCS64 = "aapcs64";
const APPLE_ARM64 = "apple-arm64";

const ABI_NAMES: Record<string, string> = {
  [SYSV]: "System V AMD64 psABI",
  [WIN64]: "Microsoft x64",
  [AAPCS64]: "Arm AAPCS64",
  [APPLE_ARM64]: "Apple arm64 (AAPCS64 with Apple differences)",
};

const X86_ABIS = [SYSV, WIN64];
const ARM_ABIS = [AAPCS64, APPLE_ARM64];

function rangeNames(prefix: string, start: number, stop: number): string[] {
  const names: string[] = [];
  for (let n = start; n < stop; n++) names.push(`${prefix}${n}`);
  return names;
}

const INT_ARG_REGS: Record<string, string[]> = {
  [SYSV]: ["rdi", "rsi", "rdx", "rcx", "r8", "r9"],
  [WIN64]: ["rcx", "rdx", "r8", "r9"],
  [AAPCS64]: rangeNames("x", 0, 8),
  [APPLE_ARM64]: rangeNames("x", 0, 8),
};
const FLOAT_ARG_REGS: Record<string, string[]> = {
  [SYSV]: rangeNames("xmm", 0, 8),
  [WIN64]: rangeNames("xmm", 0, 4),
  [AAPCS64]: rangeNames("v", 0, 8),
  [APPLE_ARM64]: rangeNames("v", 0, 8),
};
const HIDDEN_RETURN_REG: Record<string, string> = { [SYSV]: "rdi", [WIN64]: "rcx", [AAPCS64]: "x8", [APPLE_ARM64]: "x8" };
const INT_RETURN_REGS: Record<string, string[]> = { [SYSV]: ["rax", "rdx"], [WIN64]: ["rax"], [AAPCS64]: ["x0", "x1"], [APPLE_ARM64]: ["x0", "x1"] };
const FLOAT_RETURN_REGS: Record<string, string[]> = { [SYSV]: ["xmm0", "xmm1"], [WIN64]: ["xmm0"], [AAPCS64]: ["v0"], [APPLE_ARM64]: ["v0"] };
const CALLEE_SAVED: Record<string, Set<string>> = {
  [SYSV]: new Set(["rbx", "rbp", "r12", "r13", "r14", "r15"]),
  [WIN64]: new Set(["rbx", "rbp", "rdi", "rsi", "r12", "r13", "r14", "r15", ...rangeNames("xmm", 6, 16)]),
  [AAPCS64]: new Set([...rangeNames("x", 19, 31), ...rangeNames("v", 8, 16)]),
  [APPLE_ARM64]: new Set([...rangeNames("x", 19, 31), ...rangeNames("v", 8, 16)]),
};
const CALLER_SAVED: Record<string, Set<string>> = {
  [SYSV]: new Set(["rax", "rcx", "rdx", "rsi", "rdi", "r8", "r9", "r10", "r11", ...rangeNames("xmm", 0, 16)]),
  [WIN64]: new Set(["rax", "rcx", "rdx", "r8", "r9", "r10", "r11", ...rangeNames("xmm", 0, 6)]),
  [AAPCS64]: new Set([...rangeNames("x", 0, 19), "x30", ...rangeNames("v", 0, 8), ...rangeNames("v", 16, 32)]),
  [APPLE_ARM64]: new Set([...rangeNames("x", 0, 19), "x30", ...rangeNames("v", 0, 8), ...rangeNames("v", 16, 32)]),
};
const STACK_ARG_BASE: Record<string, number> = { [SYSV]: 8, [WIN64]: 40, [AAPCS64]: 0, [APPLE_ARM64]: 0 };
const RETURN_ADDRESS_BYTES: Record<string, number> = { [SYSV]: 8, [WIN64]: 8, [AAPCS64]: 0, [APPLE_ARM64]: 0 };
const RED_ZONE_BYTES: Record<string, number> = { [SYSV]: 128, [WIN64]: 0, [AAPCS64]: 0, [APPLE_ARM64]: 128 };

const RULES: Record<string, Record<string, string>> = {
  "int-regs": {
    [SYSV]: "psABI 3.2.3: INTEGER arguments take the next register of %rdi, %rsi, %rdx, %rcx, %r8, %r9",
    [WIN64]: "Microsoft x64: integer arguments are passed in RCX, RDX, R8, and R9 by position",
    [AAPCS64]: "AAPCS64 6.8.2 C.9: an integral argument is copied to x[NGRN], NGRN from 0 to 7",
    [APPLE_ARM64]: "AAPCS64 6.8.2 C.9: an integral argument is copied to x[NGRN], NGRN from 0 to 7",
  },
  "float-regs": {
    [SYSV]: "psABI 3.2.3: SSE arguments take the next register of %xmm0 to %xmm7, independently of the INTEGER sequence",
    [WIN64]: "Microsoft x64: floating-point arguments in the first four positions use XMM0 to XMM3 by position",
    [AAPCS64]: "AAPCS64 6.8.2 C.1: a floating-point argument is allocated to v[NSRN], independently of NGRN",
    [APPLE_ARM64]: "AAPCS64 6.8.2 C.1: a floating-point argument is allocated to v[NSRN], independently of NGRN",
  },
  "stack-args": {
    [SYSV]: "psABI 3.2.3 and Figure 3.3: arguments without a register go on the stack right to left, eightbyte n at 8(%rsp) + 8n on entry",
    [WIN64]: "Microsoft x64: remaining arguments are passed on the stack above the 32-byte shadow store, the first at 40(%rsp) on entry",
    [AAPCS64]: "AAPCS64 6.8.2 C.14 to C.17: arguments beyond x7 go to the stack at the NSAA",
    [APPLE_ARM64]: "Apple arm64: stack arguments are packed to natural alignment and padded to 8 bytes at the end",
  },
  return: {
    [SYSV]: "psABI 3.2.3: INTEGER results return in %rax then %rdx, SSE in %xmm0 then %xmm1, MEMORY through the address passed in %rdi and returned in %rax",
    [WIN64]: "Microsoft x64: scalars that fit 64 bits return in RAX, floats in XMM0, larger types through a caller pointer in RCX that the callee returns in RAX",
    [AAPCS64]: "AAPCS64 6.9: a result that would be passed in registers returns in those registers, otherwise through the address in x8",
    [APPLE_ARM64]: "AAPCS64 6.9: a result that would be passed in registers returns in those registers, otherwise through the address in x8",
  },
  "callee-saved": {
    [SYSV]: "psABI 3.2.1: %rbp, %rbx and %r12 through %r15 belong to the calling function and the called function is required to preserve their values",
    [WIN64]: "Microsoft x64: RBX, RBP, RDI, RSI, RSP, R12 to R15 and XMM6 to XMM15 are nonvolatile; the first use of a nonvolatile register in the prolog must be to save it",
    [AAPCS64]: "AAPCS64 6.1.1: a subroutine invocation must preserve the contents of the registers r19-r29 and SP",
    [APPLE_ARM64]: "AAPCS64 6.1.1: a subroutine invocation must preserve the contents of the registers r19-r29 and SP",
  },
  alignment: {
    [SYSV]: "psABI 3.2.2: the stack is 16-byte aligned immediately before the call instruction, so (%rsp + 8) is a multiple of 16 on entry",
    [WIN64]: "Microsoft x64: the stack pointer must remain 16-byte aligned outside the prolog, the epilog, and leaf functions",
    [AAPCS64]: "AAPCS64 6.4.5.2: at a public interface SP mod 16 = 0",
    [APPLE_ARM64]: "AAPCS64 6.4.5.2: at a public interface SP mod 16 = 0",
  },
  shadow: {
    [WIN64]: "Microsoft x64: the caller must always allocate sufficient space to store four register parameters, even if the callee doesn't take that many parameters",
  },
  "red-zone": {
    [SYSV]: "psABI 3.2.2: the 128-byte area beyond the location pointed to by %rsp is reserved and may hold temporary data that is not needed across function calls",
    [WIN64]: "Microsoft x64 stack usage: all memory beyond the current address of RSP is considered volatile",
    [AAPCS64]: "AAPCS64 6.4.5: the stack is full-descending and no thread may access the inactive region below SP",
    [APPLE_ARM64]: "Apple arm64: the 128 bytes immediately below the stack pointer are not modified during exceptions",
  },
  "frame-pointer": {
    [SYSV]: "psABI 3.2.2 Figure 3.3: %rbp optionally holds the frame base, with the return address at 8(%rbp) and the previous %rbp at 0(%rbp)",
    [WIN64]: "Microsoft x64 prolog: a frame pointer is optional and is set after the fixed allocation",
    [AAPCS64]: "AAPCS64 6.4.6: a frame record is two 64-bit values, the previous frame record lower and the saved LR higher, pointed to by FP",
    [APPLE_ARM64]: "Apple arm64: the frame pointer register (x29) must always address a valid frame record; leaf functions may opt out",
  },
  variadic: {
    [SYSV]: "psABI 3.2.3: %al holds an upper bound on the number of vector registers used, in the range 0 to 8",
    [WIN64]: "Microsoft x64: for vararg functions the callee stores the register arguments to their home slots at 8, 16, 24, 32 bytes above the return address",
    [AAPCS64]: "AAPCS64 6.8.1: a variadic callee saves the unnamed argument registers in a register save area and va_list is a structure",
    [APPLE_ARM64]: "Apple arm64: variadic arguments are assigned to 8-byte stack slots and va_list is a char*",
  },
};
const EPILOGUE_RULE = "The epilogue restores the registers the prologue saved and the stack pointer returns to its entry value";

const TYPES: Record<string, [number, string]> = {
  int: [4, "int"],
  i64: [8, "int"],
  double: [8, "float"],
  float: [4, "float"],
  pair: [16, "struct"],
  big: [32, "struct"],
  void: [0, "void"],
};

const SIGNATURES: Record<string, [string, string[]]> = {
  leaf_add: ["int", ["int", "int"]],
  eight_args: ["i64", Array(8).fill("i64")],
  mixed: ["double", ["int", "double", "i64", "float"]],
  by_value: ["pair", ["pair"]],
  big_ret: ["big", ["i64"]],
  sum_varargs: ["int", ["int", "..."]],
  keeps: ["int", ["int"]],
  call8: ["i64", []],
  call_mixed: ["double", []],
  call_varargs: ["int", []],
  call_pair: ["i64", []],
  call_big: ["i64", []],
};

const PARAM_NAMES: Record<string, string[]> = {
  leaf_add: ["a", "b"],
  eight_args: ["a", "b", "c", "d", "e", "f", "g", "h"],
  mixed: ["i", "d", "l", "f"],
  by_value: ["p"],
  big_ret: ["seed"],
  sum_varargs: ["count", "..."],
  keeps: ["n"],
};

const CALLEE_SHAPES: Record<string, string> = { call8: "eight_args", call_mixed: "mixed", call_varargs: "sum_varargs", call_pair: "by_value", call_big: "big_ret" };

const FIXTURE_OBJECTS: Record<string, string> = {
  "convention-x86_64-linux-O0": SYSV,
  "convention-x86_64-linux-O2": SYSV,
  "convention-x86_64-windows-O0": WIN64,
  "convention-x86_64-windows-O2": WIN64,
  "convention-aarch64-linux-O0": AAPCS64,
  "convention-aarch64-linux-O2": AAPCS64,
  "convention-arm64-macos-O2": APPLE_ARM64,
};

function has(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function pyString(text: string): string {
  return (
    '"' +
    text.replace(/[\\"]|[^ -~]/g, (c) => {
      if (c === "\\") return "\\\\";
      if (c === '"') return '\\"';
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function dumps(value: unknown, indent: number | null, depth = 0): string {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyString(value);
  const pad = indent === null ? "" : "\n" + " ".repeat(indent * (depth + 1));
  const close = indent === null ? "" : "\n" + " ".repeat(indent * depth);
  const colon = indent === null ? ":" : ": ";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[" + value.map((item) => pad + dumps(item, indent, depth + 1)).join(",") + close + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return "{" + entries.map(([k, v]) => pad + pyString(k) + colon + dumps(v, indent, depth + 1)).join(",") + close + "}";
}

function pyFmt(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

function pyReprString(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let body = text.replaceAll("\\", "\\\\");
  if (quote === "'") body = body.replaceAll("'", "\\'");
  return quote + body + quote;
}

function pyReprList(items: string[]): string {
  return "[" + items.map(pyReprString).join(", ") + "]";
}

function pyMod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function pyInt(text: string, base: number): number {
  const clean = text.trim();
  const pattern = base === 16 ? /^[+-]?(0[xX])?_?[0-9a-fA-F]+(_[0-9a-fA-F]+)*$/ : /^[+-]?[0-9]+(_[0-9]+)*$/;
  if (!pattern.test(clean)) throw new RangeError(`invalid literal for int() with base ${base}: '${text}'`);
  let digits = clean.replaceAll("_", "");
  let negative = false;
  if (digits.startsWith("-") || digits.startsWith("+")) {
    negative = digits.startsWith("-");
    digits = digits.slice(1);
  }
  if (base === 16 && /^0[xX]/.test(digits)) digits = digits.slice(2);
  const value = parseInt(digits, base);
  return negative ? -value : value;
}

function isSubset<T>(a: Set<T>, b: Set<T>): boolean {
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && isSubset(a, b);
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((item, k) => item === b[k]);
}

function numeric(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

class ObjectError extends Error {}

class FunctionSymbol {
  constructor(public name: string, public offset: number, public size: number) {}
}

class ObjectInfo {
  constructor(
    public path: string,
    public format: string,
    public machine: string,
    public abi: string,
    public functions: FunctionSymbol[],
    public sections: Map<string, Buffer> = new Map(),
    public symbolNames: string[] = [],
  ) {}
}

function cstr(data: Buffer, offset: number): string {
  const end = data.indexOf(0, offset);
  if (end < 0) throw new RangeError("subsection not found");
  return data.subarray(offset, end).toString("latin1").replace(/[^\x00-\x7f]/g, "\ufffd");
}

function asciiStrict(data: Buffer): string {
  for (const byte of data) if (byte > 0x7f) throw new RangeError("'ascii' codec can't decode byte");
  return data.toString("latin1");
}

function rstripNul(data: Buffer): Buffer {
  let end = data.length;
  while (end > 0 && data[end - 1] === 0) end--;
  return data.subarray(0, end);
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

function byOffsetName(functions: FunctionSymbol[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const f of functions) map.set(f.offset, f.name);
  return map;
}

function readElf(data: Buffer, path: string): ObjectInfo {
  const machine = data.readUInt16LE(0x12);
  const shoff = u64(data, 0x28);
  const shentsize = data.readUInt16LE(0x3a);
  const shnum = data.readUInt16LE(0x3c);
  const shstrndx = data.readUInt16LE(0x3e);
  const headers: [number, number, number, number, number][] = [];
  for (let index = 0; index < shnum; index++) {
    const base = shoff + index * shentsize;
    headers.push([data.readUInt32LE(base), data.readUInt32LE(base + 4), u64(data, base + 24), u64(data, base + 32), data.readUInt32LE(base + 40)]);
  }
  const strtabOff = headers[shstrndx][2];
  const names = headers.map((h) => cstr(data, strtabOff + h[0]));
  const sections = new Map<string, Buffer>();
  headers.forEach((h, i) => {
    if (h[1] !== 8) sections.set(names[i], data.subarray(h[2], h[2] + h[3]));
  });
  const functions: FunctionSymbol[] = [];
  const symbolNames: string[] = [];
  for (const h of headers) {
    if (h[1] !== 2) continue;
    const strings = headers[h[4]];
    for (let k = 0; k < Math.floor(h[3] / 24); k++) {
      const at = h[2] + 24 * k;
      const stName = data.readUInt32LE(at);
      const stInfo = data[at + 4];
      const stShndx = data.readUInt16LE(at + 6);
      const stValue = u64(data, at + 8);
      const stSize = u64(data, at + 16);
      const name = stName ? cstr(data, strings[2] + stName) : "";
      if (name) symbolNames.push(name);
      if ((stInfo & 0xf) === 2 && stShndx !== 0) functions.push(new FunctionSymbol(name, stValue, stSize));
    }
  }
  functions.sort((a, b) => a.offset - b.offset);
  if (machine === 62) return new ObjectInfo(path, "ELF64", "x86-64", SYSV, functions, sections, symbolNames);
  if (machine === 183) return new ObjectInfo(path, "ELF64", "AArch64", AAPCS64, functions, sections, symbolNames);
  throw new ObjectError(`unsupported ELF machine ${machine}`);
}

function readCoff(data: Buffer, path: string): ObjectInfo {
  const machine = data.readUInt16LE(0);
  const nsections = data.readUInt16LE(2);
  const symoff = data.readUInt32LE(8);
  const nsyms = data.readUInt32LE(12);
  const optsize = data.readUInt16LE(16);
  if (machine !== 0x8664) throw new ObjectError(`unsupported COFF machine 0x${machine.toString(16)}`);
  const strtab = symoff + nsyms * 18;
  const sections = new Map<string, Buffer>();
  for (let index = 0; index < nsections; index++) {
    const base = 20 + optsize + 40 * index;
    const rawName = data.subarray(base, base + 8);
    const size = data.readUInt32LE(base + 16);
    const offset = data.readUInt32LE(base + 20);
    let name: string;
    if (rawName[0] === 0x2f) {
      name = cstr(data, strtab + pyInt(asciiStrict(rstripNul(rawName.subarray(1))), 10));
    } else {
      name = asciiStrict(rstripNul(rawName));
    }
    if (!sections.has(name)) sections.set(name, data.subarray(offset, offset + size));
  }
  const functions: FunctionSymbol[] = [];
  const symbolNames: string[] = [];
  let k = 0;
  while (k < nsyms) {
    const base = symoff + 18 * k;
    const rawName = data.subarray(base, base + 8);
    const value = data.readUInt32LE(base + 8);
    const section = data.readInt16LE(base + 12);
    const typ = data.readUInt16LE(base + 14);
    const naux = data[base + 17];
    let name: string;
    if (rawName.readUInt32LE(0) === 0) {
      name = cstr(data, strtab + rawName.readUInt32LE(4));
    } else {
      name = asciiStrict(rstripNul(rawName));
    }
    symbolNames.push(name);
    if (typ === 0x20 && section > 0) functions.push(new FunctionSymbol(name, value, 0));
    k += 1 + naux;
  }
  functions.sort((a, b) => a.offset - b.offset);
  return new ObjectInfo(path, "COFF", "AMD64", WIN64, functions, sections, symbolNames);
}

function readMacho(data: Buffer, path: string): ObjectInfo {
  const cputype = data.readUInt32LE(4);
  const ncmds = data.readUInt32LE(16);
  if (cputype !== 0x0100000c) throw new ObjectError(`unsupported Mach-O cputype 0x${cputype.toString(16)}`);
  let offset = 32;
  const functions: FunctionSymbol[] = [];
  const symbolNames: string[] = [];
  for (let c = 0; c < ncmds; c++) {
    const cmd = data.readUInt32LE(offset);
    const cmdsize = data.readUInt32LE(offset + 4);
    if (cmd === 2) {
      const symoff = data.readUInt32LE(offset + 8);
      const nsyms = data.readUInt32LE(offset + 12);
      const stroff = data.readUInt32LE(offset + 16);
      for (let k = 0; k < nsyms; k++) {
        const at = symoff + 16 * k;
        const nStrx = data.readUInt32LE(at);
        const nType = data[at + 4];
        const nSect = data[at + 5];
        const nValue = u64(data, at + 8);
        const name = cstr(data, stroff + nStrx);
        symbolNames.push(name);
        if ((nType & 0x0e) === 0x0e && nSect === 1 && nType & 0x01) {
          functions.push(new FunctionSymbol(name.startsWith("_") ? name.slice(1) : name, nValue, 0));
        }
      }
    }
    offset += cmdsize;
  }
  functions.sort((a, b) => a.offset - b.offset);
  return new ObjectInfo(path, "Mach-O 64", "arm64", APPLE_ARM64, functions, new Map(), symbolNames);
}

function describeObject(path: string): ObjectInfo {
  const data = readFileSync(path);
  if (data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46) return readElf(data, path);
  if (data[0] === 0x64 && data[1] === 0x86) return readCoff(data, path);
  if (data[0] === 0xcf && data[1] === 0xfa && data[2] === 0xed && data[3] === 0xfe) return readMacho(data, path);
  throw new ObjectError(`unknown object format in ${basename(path)}`);
}

class Instruction {
  constructor(
    public address: number,
    public hex: string,
    public mnemonic: string,
    public operands: string,
    public relocation: string | null = null,
  ) {}

  get text(): string {
    return `${this.mnemonic} ${this.operands}`.trim();
  }

  get length(): number {
    return this.hex.includes(" ") || this.hex.length === 2 ? this.hex.trim().split(/\s+/).length : Math.floor(this.hex.length / 2);
  }
}

const LISTING_LINE = /^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+|[0-9a-f]{8})\s*\t?\s*(\S+)\s*(.*)$/;
const FUNCTION_HEADER = /^([0-9a-f]{16}) <(\S+)>:$/;
const RELOCATION_LINE = /^\s+[0-9a-f]{16}:\s+(R_\S+|IMAGE_REL\S+|ARM64_RELOC\S+)\s+(\S+)$/;
const FORMAT_LINE = /file format (\S+)/;

class Listing {
  constructor(public arch: string, public functions: Map<string, Instruction[]>) {}
}

function parseListing(text: string, functions: FunctionSymbol[] | null = null): Listing {
  const byOffset = byOffsetName(functions ?? []);
  const knownNames = new Set(byOffset.values());
  let arch = "x86";
  const result = new Map<string, Instruction[]>();
  let current: string | null = null;
  for (const raw of splitLines(text)) {
    const line = raw.trimEnd();
    if (FORMAT_LINE.test(line)) {
      arch = line.includes("aarch64") || line.includes("arm64") ? "arm" : "x86";
      continue;
    }
    const header = FUNCTION_HEADER.exec(line);
    if (header) {
      const offset = parseInt(header[1], 16);
      let label = header[2];
      if (label.startsWith("_") && knownNames.has(label.slice(1))) label = label.slice(1);
      current = byOffset.get(offset) ?? label;
      if (!result.has(current)) result.set(current, []);
      continue;
    }
    if (current === null) continue;
    const listing = result.get(current)!;
    const relocation = RELOCATION_LINE.exec(line);
    if (relocation) {
      if (listing.length > 0) {
        const target = relocation[2].replace(/[-+]0x[0-9a-f]+$/, "");
        listing[listing.length - 1].relocation = arch === "arm" && target.startsWith("_") && relocation[1].includes("RELOC") ? target.slice(1) : target;
      }
      continue;
    }
    const match = LISTING_LINE.exec(line);
    if (!match) continue;
    let operands = match[4];
    const markers = arch === "arm" ? ["\t//", " //", "\t;", " ;"] : ["\t#", " #"];
    for (const marker of markers) {
      const cut = operands.indexOf(marker);
      if (cut >= 0) operands = operands.slice(0, cut);
    }
    operands = operands.replace(/\s+/g, " ").trim();
    operands = operands.replace(/ <[^>]*>$/, "");
    listing.push(new Instruction(parseInt(match[1], 16), match[2].trim(), match[3], operands));
  }
  return new Listing(arch, result);
}

const X86_CANONICAL = new Map<string, string>();
for (const base of ["a", "b", "c", "d"]) {
  for (const name of [`r${base}x`, `e${base}x`, `${base}x`, `${base}l`, `${base}h`]) X86_CANONICAL.set(name, `r${base}x`);
}
for (const base of ["si", "di", "bp", "sp"]) {
  for (const name of [`r${base}`, `e${base}`, base, `${base}l`]) X86_CANONICAL.set(name, `r${base}`);
}
for (let n = 8; n < 16; n++) {
  for (const suffix of ["", "d", "w", "b", "l"]) X86_CANONICAL.set(`r${n}${suffix}`, `r${n}`);
}
for (let n = 0; n < 16; n++) X86_CANONICAL.set(`xmm${n}`, `xmm${n}`);
X86_CANONICAL.set("rip", "rip");

function x86Register(token: string): string | null {
  return X86_CANONICAL.get(token.trim().replace(/^\*+/, "").replace(/^%+/, "")) ?? null;
}

class Operand {
  kind: string;
  register: string | null;
  base: string | null;
  index: string | null;
  displacement: number;
  immediate: number | null;
  preIndex: boolean;
  postIndex: number | null;
  width: number;

  constructor(kind: string, fields: Partial<Omit<Operand, "kind" | "addressRegisters" | "equals">> = {}) {
    this.kind = kind;
    this.register = fields.register ?? null;
    this.base = fields.base ?? null;
    this.index = fields.index ?? null;
    this.displacement = fields.displacement ?? 0;
    this.immediate = fields.immediate ?? null;
    this.preIndex = fields.preIndex ?? false;
    this.postIndex = fields.postIndex ?? null;
    this.width = fields.width ?? 8;
  }

  addressRegisters(): string[] {
    return [this.base, this.index].filter((r): r is string => Boolean(r) && r !== "rip");
  }

  equals(other: Operand): boolean {
    return (
      this.kind === other.kind &&
      this.register === other.register &&
      this.base === other.base &&
      this.index === other.index &&
      this.displacement === other.displacement &&
      this.immediate === other.immediate &&
      this.preIndex === other.preIndex &&
      this.postIndex === other.postIndex &&
      this.width === other.width
    );
  }
}

function toInt(source: string): number {
  let text = source.trim().replaceAll("#", "");
  const negative = text.startsWith("-");
  text = text.replace(/^-+/, "");
  const value = text.startsWith("0x") ? pyInt(text, 16) : pyInt(text, 10);
  return negative ? -value : value;
}

function splitOperandsX86(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
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

const X86_MEMORY = /^(?:%\w+:)?(-?0x[0-9a-f]+|-?\d+)?\((%\w+)?(?:,(%\w+)(?:,(\d))?)?\)$/;

function parseOperandX86(source: string): Operand {
  const text = source.trim();
  if (text.startsWith("$")) return new Operand("imm", { immediate: toInt(text.slice(1)) });
  const memory = X86_MEMORY.exec(text.replace(/^\*+/, ""));
  if (memory) {
    const disp = memory[1] ? toInt(memory[1]) : 0;
    const base = memory[2] ? x86Register(memory[2]) : null;
    const index = memory[3] ? x86Register(memory[3]) : null;
    return new Operand("mem", { base, index, displacement: disp });
  }
  const register = x86Register(text);
  if (register) return new Operand("reg", { register });
  return new Operand("target");
}

const ARM_MEMORY = /\[([^\]]*)\](!?)/;
const ARM_WIDTH: Record<string, number> = { x: 8, w: 4, q: 16, d: 8, s: 4, h: 2, b: 1, v: 16 };

function armRegister(token: string): [string | null, number] {
  const name = token.trim().split(".")[0];
  if (name === "sp" || name === "wsp") return ["sp", 8];
  if (name === "xzr" || name === "wzr") return [null, name === "xzr" ? 8 : 4];
  let match = /^([xw])(\d+)$/.exec(name);
  if (match) return [`x${parseInt(match[2], 10)}`, ARM_WIDTH[match[1]]];
  match = /^([vqdshb])(\d+)$/.exec(name);
  if (match) return [`v${parseInt(match[2], 10)}`, ARM_WIDTH[match[1]]];
  if (name === "fp") return ["x29", 8];
  if (name === "lr") return ["x30", 8];
  return [null, 0];
}

function parseOperandsArm(text: string): Operand[] {
  const operands: Operand[] = [];
  const memory = ARM_MEMORY.exec(text);
  let tail = text;
  let memOperand: Operand | null = null;
  if (memory) {
    const inside = memory[1].split(",").map((p) => p.trim());
    const [base] = armRegister(inside[0]);
    const disp = inside.length > 1 && inside[1].startsWith("#") ? toInt(inside[1]) : 0;
    const memoryEnd = memory.index + memory[0].length;
    let after = text.slice(memoryEnd).trim();
    let postIndex: number | null = null;
    if (after.startsWith(",")) {
      const afterImm = after.slice(1).trim();
      if (afterImm.startsWith("#")) {
        postIndex = toInt(afterImm);
        after = "";
      }
    }
    tail = text.slice(0, memory.index) + after;
    memOperand = new Operand("mem", { base, displacement: disp, preIndex: memory[2] === "!", postIndex });
  }
  for (const piece of tail.split(",").map((p) => p.trim()).filter((p) => p)) {
    if (piece.startsWith("#")) {
      try {
        operands.push(new Operand("imm", { immediate: toInt(piece) }));
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        operands.push(new Operand("imm"));
      }
      continue;
    }
    const [register, width] = armRegister(piece);
    if (register || piece === "xzr" || piece === "wzr") {
      operands.push(new Operand("reg", { register, width }));
    } else if (["lsl", "lsr", "asr", "uxtw", "sxtw", "uxtx", "sxtx"].includes(piece)) {
      continue;
    } else {
      operands.push(new Operand("target"));
    }
  }
  if (memOperand) operands.push(memOperand);
  return operands;
}

type Store = [Operand, string | null, number, number | null];

class Effect {
  reads: string[] = [];
  addressReads: string[] = [];
  writes: string[] = [];
  loads: Operand[] = [];
  stores: Store[] = [];
  addresses: Operand[] = [];
  spDelta = 0;
  postSpDelta = 0;
  kind = "other";

  get allReads(): string[] {
    return [...this.reads, ...this.addressReads];
  }
}

const X86_WIDTHS: Record<string, number> = { movaps: 16, movups: 16, movdqu: 16, movsd: 8, movss: 4, movq: 8, movl: 4, movw: 2, movb: 1, movabsq: 8 };

const X86_ROOTS = ["cvtsi2sd", "cvtss2sd", "cvtsd2ss", "cvttsd2si", "movabs", "movs", "movz", "mov", "lea", "set", "cmov", "test", "cmp", "push", "pop", "call", "ret", "jmp", "nop", "xor", "pxor", "paddd", "paddq", "pshufd", "add", "sub", "and", "or", "imul", "inc", "dec", "neg", "not", "shl", "shr", "sar", "movd"];

function x86Root(mnemonic: string): string {
  for (const prefix of X86_ROOTS) {
    if (mnemonic.startsWith(prefix)) return prefix;
  }
  if (mnemonic.startsWith("j")) return "jmp";
  return mnemonic;
}

function x86Width(instruction: Instruction, destination: Operand): number {
  if (has(X86_WIDTHS, instruction.mnemonic)) return X86_WIDTHS[instruction.mnemonic];
  if (instruction.mnemonic.endsWith("q")) return 8;
  if (instruction.mnemonic.endsWith("l")) return 4;
  return destination.width;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function effectX86(instruction: Instruction, abi: string): Effect {
  const root = x86Root(instruction.mnemonic);
  const operands = instruction.operands ? splitOperandsX86(instruction.operands).map(parseOperandX86) : [];
  const eff = new Effect();
  if (root === "push") {
    eff.kind = "push";
    eff.spDelta = -8;
    if (operands.length > 0 && operands[0].kind === "reg") eff.reads.push(operands[0].register ?? "");
    return eff;
  }
  if (root === "pop") {
    eff.kind = "pop";
    eff.spDelta = 8;
    if (operands.length > 0 && operands[0].kind === "reg") eff.writes.push(operands[0].register ?? "");
    return eff;
  }
  if (root === "call") {
    eff.kind = "call";
    for (const operand of operands) {
      if (operand.kind === "reg") eff.reads.push(operand.register ?? "");
      else if (operand.kind === "mem") eff.addressReads.push(...operand.addressRegisters());
    }
    eff.writes.push(...sortedStrings(CALLER_SAVED[abi]));
    return eff;
  }
  if (root === "ret") {
    eff.kind = "ret";
    return eff;
  }
  if (root === "jmp") {
    eff.kind = "jump";
    for (const operand of operands) {
      if (operand.kind === "reg") eff.reads.push(operand.register ?? "");
    }
    return eff;
  }
  if (root === "nop" || operands.length === 0) {
    eff.kind = root === "nop" ? "nop" : "other";
    return eff;
  }
  const destination = operands[operands.length - 1];
  const sources = operands.slice(0, -1);
  if ((root === "xor" || root === "pxor" || instruction.mnemonic === "xorps") && operands.length === 2 && operands[0].equals(operands[1]) && destination.kind === "reg") {
    eff.kind = "zero";
    eff.writes.push(destination.register ?? "");
    return eff;
  }
  const writeOnly = ["mov", "movs", "movz", "movabs", "lea", "set", "cvtsi2sd", "cvtss2sd", "cvtsd2ss", "cvttsd2si", "movd", "pshufd"].includes(root) || (root === "imul" && operands.length === 3);
  const readOnly = root === "cmp" || root === "test";
  for (const operand of sources) {
    if (operand.kind === "reg") {
      eff.reads.push(operand.register ?? "");
    } else if (operand.kind === "mem") {
      eff.addressReads.push(...operand.addressRegisters());
      if (root === "lea") eff.addresses.push(operand);
      else eff.loads.push(operand);
    }
  }
  if (destination.kind === "reg") {
    if (readOnly || !writeOnly) eff.reads.push(destination.register ?? "");
    if (!readOnly) eff.writes.push(destination.register ?? "");
  } else if (destination.kind === "mem") {
    eff.addressReads.push(...destination.addressRegisters());
    if (readOnly || !writeOnly) eff.loads.push(destination);
    if (!readOnly) {
      const value = sources.length > 0 && sources[0].kind === "reg" ? sources[0].register : null;
      const immediate = sources.length > 0 && sources[0].kind === "imm" ? sources[0].immediate : null;
      eff.stores.push([destination, value, x86Width(instruction, destination), immediate]);
    }
  }
  if ((root === "add" || root === "sub") && destination.kind === "reg" && destination.register === "rsp" && sources.length > 0 && sources[0].kind === "imm") {
    const amount = sources[0].immediate || 0;
    eff.spDelta = root === "add" ? amount : -amount;
    eff.kind = "sp-adjust";
  }
  if (
    destination.kind === "reg" &&
    destination.register === "rbp" &&
    sources.length > 0 &&
    ((root === "mov" && sources[0].kind === "reg" && sources[0].register === "rsp") || (root === "lea" && sources[0].kind === "mem" && sources[0].base === "rsp"))
  ) {
    eff.kind = "set-frame-pointer";
  }
  return eff;
}

const ARM_STORES = new Set(["str", "strb", "strh", "stur", "sturb", "sturh", "stp", "stnp"]);
const ARM_LOADS = new Set(["ldr", "ldrb", "ldrh", "ldrsb", "ldrsh", "ldrsw", "ldur", "ldurb", "ldurh", "ldursw", "ldp", "ldnp"]);
const ARM_READ_ONLY = new Set(["cmp", "cmn", "tst", "ccmp", "ccmn", "cbz", "cbnz", "tbz", "tbnz", "fcmp", "fcmpe"]);

function effectArm(instruction: Instruction, abi: string): Effect {
  const mnemonic = instruction.mnemonic;
  const operands = instruction.operands ? parseOperandsArm(instruction.operands) : [];
  const eff = new Effect();
  if (mnemonic === "ret") {
    eff.kind = "ret";
    eff.reads.push("x30");
    return eff;
  }
  if (mnemonic === "bl" || mnemonic === "blr") {
    eff.kind = "call";
    for (const operand of operands) {
      if (operand.kind === "reg" && operand.register) eff.reads.push(operand.register);
    }
    eff.writes.push(...sortedStrings(CALLER_SAVED[abi]));
    return eff;
  }
  if (mnemonic === "b" || mnemonic.startsWith("b.")) {
    eff.kind = "jump";
    return eff;
  }
  const mem = operands.find((o) => o.kind === "mem") ?? null;
  const regs = operands.filter((o) => o.kind === "reg");
  if (mem !== null) {
    if (mem.base) eff.addressReads.push(mem.base);
    if (mem.preIndex || mem.postIndex !== null) {
      eff.writes.push(mem.base ?? "");
      if (mem.base === "sp") {
        if (mem.preIndex) eff.spDelta = mem.displacement;
        else eff.postSpDelta = mem.postIndex || 0;
        eff.kind = "sp-adjust";
      }
    }
    if (ARM_STORES.has(mnemonic)) {
      const offset = mem.preIndex ? 0 : mem.displacement;
      regs.forEach((reg, slot) => {
        if (reg.register) eff.reads.push(reg.register);
        eff.stores.push([new Operand("mem", { base: mem.base, displacement: offset + reg.width * slot }), reg.register, reg.width, null]);
      });
      if (eff.kind !== "sp-adjust") eff.kind = "store";
    } else if (ARM_LOADS.has(mnemonic)) {
      for (const reg of regs) {
        if (reg.register) eff.writes.push(reg.register);
      }
      eff.loads.push(new Operand("mem", { base: mem.base, displacement: mem.preIndex ? 0 : mem.displacement }));
      if (eff.kind !== "sp-adjust") eff.kind = "load";
    }
    return eff;
  }
  if (ARM_READ_ONLY.has(mnemonic)) {
    eff.kind = "compare";
    for (const r of regs) if (r.register) eff.reads.push(r.register);
    return eff;
  }
  if (regs.length === 0) return eff;
  const destination = regs[0];
  for (const reg of regs.slice(1)) {
    if (reg.register) eff.reads.push(reg.register);
  }
  if (["movk", "bfi", "bfxil", "ins"].includes(mnemonic) && destination.register) eff.reads.push(destination.register);
  if (destination.register) eff.writes.push(destination.register);
  const immediate = operands.find((o) => o.kind === "imm") ?? null;
  if ((mnemonic === "add" || mnemonic === "sub") && destination.register === "sp" && regs.length >= 2 && regs[1].register === "sp" && immediate && immediate.immediate !== null) {
    eff.spDelta = mnemonic === "add" ? immediate.immediate : -immediate.immediate;
    eff.kind = "sp-adjust";
  }
  if (destination.register === "x29" && regs.length >= 2 && regs[1].register === "sp" && (mnemonic === "mov" || mnemonic === "add")) {
    eff.kind = "set-frame-pointer";
  }
  if ((mnemonic === "add" || mnemonic === "mov") && regs.length >= 2 && regs[1].register === "sp" && destination.register !== "sp" && destination.register !== "x29") {
    eff.addresses.push(new Operand("mem", { base: "sp", displacement: immediate && immediate.immediate !== null ? immediate.immediate : 0 }));
  }
  return eff;
}

function effect(instruction: Instruction, abi: string): Effect {
  return X86_ABIS.includes(abi) ? effectX86(instruction, abi) : effectArm(instruction, abi);
}

class Check {
  constructor(public rule: string, public expected: unknown, public observed: unknown, public agree: boolean) {}

  toDict(): Rec {
    return { rule: this.rule, expected: this.expected, observed: this.observed, agree: this.agree };
  }
}

class FunctionAnalysis {
  prologue: Instruction[] = [];
  epilogue: Instruction[] = [];
  frameSize = 0;
  saved: [string, number][] = [];
  framePointer: number | null = null;
  paramRegisters: string[] = [];
  stackSlots: number[] = [];
  homeStores: [string, number][] = [];
  spills: [string, number, number][] = [];
  frameAddresses: number[] = [];
  returnRegisters: string[] = [];
  hiddenPointer: string | null = null;
  belowSp: number[] = [];
  calls: [string | null, number][] = [];
  outgoingRegisters: string[] = [];
  outgoingStores: [number, number | null][] = [];
  outgoingAddresses: [number, string][] = [];
  alZeroed = false;
  readsAl = false;
  calleeSavedWritten: string[] = [];
  depthAtExit = 0;
  maxDepth = 0;
  tailCall: string | null = null;
  checks: Check[] = [];

  constructor(public name: string, public abi: string, public instructions: Instruction[]) {}

  get epilogueMirrors(): boolean {
    return this.depthAtExit === 0 && restoresMatch(this);
  }

  toDict(): Rec {
    const outgoing = [...this.outgoingStores].sort((a, b) => a[0] - b[0] || (a[1] !== null && b[1] !== null ? a[1] - b[1] : 0));
    return {
      function: this.name,
      abi: this.abi,
      instructions: this.instructions.length,
      prologue: this.prologue.map((i) => `${i.hex}  ${i.text}`),
      epilogue: this.epilogue.map((i) => `${i.hex}  ${i.text}`),
      frameBytes: this.frameSize,
      savedRegisters: this.saved.map(([r, o]) => ({ register: r, entryOffset: o })),
      framePointerAt: this.framePointer,
      parameterRegisters: this.paramRegisters,
      stackArgumentOffsets: numeric(this.stackSlots),
      homeStores: this.homeStores.map(([r, o]) => ({ register: r, entryOffset: o })),
      spills: this.spills.map(([r, o, n]) => ({ register: r, entryOffset: o, bytes: n })),
      frameAddressesTaken: this.frameAddresses,
      returnRegisters: this.returnRegisters,
      hiddenPointer: this.hiddenPointer,
      bytesBelowStackPointer: this.belowSp.length > 0 ? Math.max(...this.belowSp) : 0,
      calls: this.calls.map(([c, d]) => ({ callee: c, depth: d })),
      tailCall: this.tailCall,
      outgoingRegisters: this.outgoingRegisters,
      outgoingStores: outgoing.map(([o, v]) => ({ callOffset: o, value: v })),
      outgoingAddresses: this.outgoingAddresses.map(([o, r]) => ({ callOffset: o, register: r })),
      alZeroed: this.alZeroed,
      readsAl: this.readsAl,
      calleeSavedWritten: this.calleeSavedWritten,
      deepestStackBytes: this.maxDepth,
      epilogueMirrorsPrologue: this.epilogueMirrors,
      checks: this.checks.map((c) => c.toDict()),
      agree: this.checks.filter((c) => c.agree).length,
      disagree: this.checks.filter((c) => !c.agree).map((c) => c.rule),
    };
  }
}

function restoresMatch(analysis: FunctionAnalysis): boolean {
  const calleeSaved = CALLEE_SAVED[analysis.abi];
  const saved = analysis.saved.map(([r]) => r).filter((r) => calleeSaved.has(r));
  const restored: string[] = [];
  for (const instruction of analysis.epilogue) {
    const eff = effect(instruction, analysis.abi);
    restored.push(...eff.writes.filter((r) => calleeSaved.has(r)));
  }
  if (X86_ABIS.includes(analysis.abi)) return arraysEqual(restored, [...saved].reverse());
  return isSubset(new Set(saved), new Set(restored));
}

function isPrologue(eff: Effect, abi: string): boolean {
  if (eff.kind === "push" || eff.kind === "set-frame-pointer") return true;
  if (eff.kind === "sp-adjust" && eff.spDelta < 0) return true;
  if (ARM_ABIS.includes(abi) && eff.kind === "store") {
    const stored = new Set(eff.stores.map((s) => s[1]).filter((r): r is string => Boolean(r)));
    return eff.stores.length > 0 && eff.stores[0][0].base === "sp" && isSubset(stored, CALLEE_SAVED[abi]);
  }
  return false;
}

function bodyEnd(instructions: Instruction[], abi: string): [number, string | null] {
  for (let position = 0; position < instructions.length; position++) {
    const instruction = instructions[position];
    if (instruction.mnemonic === "retq" || instruction.mnemonic === "ret") return [position, null];
    if ((instruction.mnemonic === "jmp" || instruction.mnemonic === "b") && instruction.relocation && !instruction.relocation.startsWith(".")) {
      return [position, instruction.relocation];
    }
  }
  return [instructions.length - 1, null];
}

function analyzeFunction(name: string, instructions: Instruction[], abi: string): FunctionAnalysis {
  const analysis = new FunctionAnalysis(name, abi, instructions);
  const x86 = X86_ABIS.includes(abi);
  const [end, tail] = bodyEnd(instructions, abi);
  analysis.tailCall = tail;
  let depth = 0;
  let frameDepth = 0;
  const written = new Set<string>();
  const argClass = new Set([...INT_ARG_REGS[abi], ...FLOAT_ARG_REGS[abi], HIDDEN_RETURN_REG[abi]]);
  const calleeSaved = CALLEE_SAVED[abi];
  let prologueOpen = true;
  let liveOutgoing = new Map<string, boolean>();
  let storesEntry: [number, number | null][] = [];
  let addressesEntry: [number, string][] = [];
  const body = instructions.slice(0, end + 1);
  body.forEach((instruction, position) => {
    const eff = effect(instruction, abi);
    const inPrologue = prologueOpen && position < 12 && isPrologue(eff, abi);
    const interleaved = !x86 && (eff.kind === "compare" || eff.kind === "other") && position < 6 && eff.loads.length === 0 && eff.stores.length === 0;
    if (prologueOpen && !inPrologue && !interleaved) prologueOpen = false;
    if (inPrologue) analysis.prologue.push(instruction);
    for (const register of eff.allReads) {
      if (argClass.has(register) && !written.has(register) && !analysis.paramRegisters.includes(register)) analysis.paramRegisters.push(register);
    }
    for (const register of eff.reads) liveOutgoing.delete(register);
    if (x86 && instruction.mnemonic === "testb" && instruction.operands.includes("%al") && !written.has("rax")) analysis.readsAl = true;
    if (eff.kind === "push") {
      depth += 8;
      if (inPrologue) {
        analysis.saved.push([eff.reads.length > 0 ? eff.reads[0] : "imm", -depth]);
      } else if (instruction.operands.startsWith("$")) {
        storesEntry.push([-depth, parseOperandX86(instruction.operands).immediate]);
      }
    } else if (eff.kind === "pop") {
      depth -= 8;
    } else if (eff.kind === "sp-adjust") {
      depth -= eff.spDelta;
    }
    if (eff.kind === "set-frame-pointer") {
      const immediate = !x86 ? parseOperandsArm(instruction.operands).filter((o) => o.kind === "imm") : [];
      analysis.framePointer = -depth + (immediate.length > 0 ? immediate[0].immediate || 0 : 0);
    }
    for (const [operand, value, width, immediate] of eff.stores) {
      const entry = entryOffset(operand, depth, analysis.framePointer);
      if (entry === null) continue;
      if ((operand.base === "rsp" || operand.base === "sp") && !inPrologue) storesEntry.push([entry, immediate]);
      if (value !== null && calleeSaved.has(value) && inPrologue && !x86) {
        analysis.saved.push([value, entry]);
      } else if (value !== null && argClass.has(value) && !written.has(value)) {
        if (abi === WIN64 && 8 <= entry && entry < 40) analysis.homeStores.push([value, entry]);
        else analysis.spills.push([value, entry, width]);
      }
    }
    for (const operand of [...eff.loads, ...eff.stores.map((s) => s[0])]) {
      const entry = entryOffset(operand, depth, analysis.framePointer);
      if (entry === null) continue;
      const below = -(entry + depth);
      if (below > 0) analysis.belowSp.push(below);
    }
    for (const operand of eff.loads) {
      const entry = entryOffset(operand, depth, analysis.framePointer);
      if (entry !== null && entry >= STACK_ARG_BASE[abi] && !analysis.stackSlots.includes(entry)) analysis.stackSlots.push(entry);
    }
    for (const operand of eff.addresses) {
      const entry = entryOffset(operand, depth, analysis.framePointer);
      if (entry !== null) {
        analysis.frameAddresses.push(entry);
        if (eff.writes.length > 0) addressesEntry.push([entry, eff.writes[0]]);
      }
    }
    depth -= eff.postSpDelta;
    analysis.maxDepth = Math.max(analysis.maxDepth, depth);
    if (inPrologue) frameDepth = Math.max(frameDepth, depth);
    if (eff.kind === "call" || (position === end && tail)) {
      analysis.calls.push([instruction.relocation, depth]);
      const addressRegisters = new Set(addressesEntry.map(([, r]) => r));
      analysis.outgoingRegisters = [...liveOutgoing.keys()].filter((r) => !(!x86 && r === "x8" && !addressRegisters.has(r)));
      analysis.outgoingStores = storesEntry.map(([o, v]) => [o + depth, v]);
      analysis.outgoingAddresses = addressesEntry.map(([o, r]) => [o + depth, r]);
      storesEntry = [];
      addressesEntry = [];
      liveOutgoing = new Map();
    }
    for (const register of eff.writes) {
      if (argClass.has(register) && eff.kind !== "call") liveOutgoing.set(register, true);
      if (calleeSaved.has(register) && !analysis.calleeSavedWritten.includes(register) && !["call", "pop", "load", "sp-adjust"].includes(eff.kind)) {
        analysis.calleeSavedWritten.push(register);
      }
      written.add(register);
    }
    if (eff.kind === "zero" && x86 && arraysEqual(eff.writes, ["rax"])) analysis.alZeroed = true;
    if (x86 && instruction.mnemonic === "movb" && instruction.operands === "$0x0, %al") {
      analysis.alZeroed = true;
      written.add("rax");
    }
  });
  analysis.depthAtExit = depth;
  analysis.frameSize = frameDepth;
  analysis.hiddenPointer = hiddenPointer(body, abi, analysis.paramRegisters);
  analysis.returnRegisters = returnRegisters(body, abi, analysis.hiddenPointer, tail);
  analysis.epilogue = epilogueOf(instructions, end, abi);
  analysis.checks = runChecks(analysis);
  return analysis;
}

function entryOffset(operand: Operand, depth: number, framePointer: number | null): number | null {
  if (operand.base === "rsp" || operand.base === "sp") return operand.displacement - depth;
  if ((operand.base === "rbp" || operand.base === "x29") && framePointer !== null) return framePointer + operand.displacement;
  return null;
}

function hiddenPointer(instructions: Instruction[], abi: string, paramRegs: string[]): string | null {
  const pointer = HIDDEN_RETURN_REG[abi];
  if (!paramRegs.includes(pointer)) return null;
  const aliases = new Set([pointer]);
  let storesThrough = 0;
  let copiedToReturn = ARM_ABIS.includes(abi);
  for (const instruction of instructions) {
    const eff = effect(instruction, abi);
    for (const [operand] of eff.stores) {
      if (operand.base !== null && aliases.has(operand.base)) storesThrough += 1;
    }
    if ((instruction.mnemonic === "mov" || instruction.mnemonic === "movq") && eff.reads.length === 1 && aliases.has(eff.reads[0]) && eff.writes.length === 1) {
      if (INT_RETURN_REGS[abi].slice(0, 1).includes(eff.writes[0])) copiedToReturn = true;
      else if (ARM_ABIS.includes(abi)) aliases.add(eff.writes[0]);
    }
  }
  return storesThrough && copiedToReturn ? pointer : null;
}

function returnRegisters(instructions: Instruction[], abi: string, hidden: string | null, tail: string | null): string[] {
  const candidates = [...INT_RETURN_REGS[abi], ...FLOAT_RETURN_REGS[abi]];
  const lastWrite = new Map<string, string>();
  for (const instruction of instructions) {
    const eff = effect(instruction, abi);
    for (const register of eff.reads) lastWrite.delete(register);
    for (const register of eff.writes) {
      if (candidates.includes(register)) lastWrite.set(register, eff.kind === "call" ? "callee" : instruction.text);
    }
  }
  if (tail) return [`tail call to ${tail}`];
  const explicit = candidates.filter((r) => lastWrite.has(r) && lastWrite.get(r) !== "callee");
  if (explicit.length > 0) return explicit;
  if (hidden && ARM_ABIS.includes(abi)) return [`${hidden} (indirect result)`];
  if (candidates.some((r) => lastWrite.get(r) === "callee")) return [`${INT_RETURN_REGS[abi][0]} or ${FLOAT_RETURN_REGS[abi][0]} (from callee)`];
  return [];
}

function epilogueOf(instructions: Instruction[], end: number, abi: string): Instruction[] {
  const last = instructions.at(end);
  if (last === undefined) throw new RangeError("list index out of range");
  if (last.mnemonic !== "retq" && last.mnemonic !== "ret") return [];
  const epilogue = [last];
  let k = end - 1;
  while (k >= 0) {
    const eff = effect(instructions[k], abi);
    const restoring =
      eff.kind === "pop" ||
      (eff.kind === "sp-adjust" && (eff.spDelta > 0 || eff.postSpDelta > 0)) ||
      (eff.kind === "load" && ARM_ABIS.includes(abi) && eff.loads.length > 0 && eff.loads[0].base === "sp");
    if (!restoring && !(X86_ABIS.includes(abi) && instructions[k].text === "movq %rbp, %rsp")) break;
    epilogue.unshift(instructions[k]);
    k -= 1;
  }
  return epilogue;
}

function classify(typeName: string): [number, string] {
  return TYPES[typeName];
}

interface Expected {
  parameters: { name: string; type: string; location: string[] }[];
  hidden: string | null;
  registers: string[];
  variadicSaveArea: string[];
  stackOffsets: number[];
  returnRegisters: string[];
  variadic: boolean;
}

function expectedLocations(abi: string, name: string): Expected {
  const [returnType, params] = SIGNATURES[name];
  const names = PARAM_NAMES[name] ?? [];
  const ints = [...INT_ARG_REGS[abi]];
  const floats = [...FLOAT_ARG_REGS[abi]];
  const assignments: { name: string; type: string; location: string[] }[] = [];
  let hidden: string | null = null;
  const stackOffsets: number[] = [];
  const [retSize, retKind] = classify(returnType);
  let returnRegs: string[];
  if (retKind === "struct" && (retSize > 16 || (abi === WIN64 && ![1, 2, 4, 8].includes(retSize)))) {
    hidden = HIDDEN_RETURN_REG[abi];
    if (X86_ABIS.includes(abi)) ints.shift();
    returnRegs = ARM_ABIS.includes(abi) ? [`${hidden} (indirect result)`] : ["rax"];
  } else if (retKind === "struct") {
    returnRegs = INT_RETURN_REGS[abi].slice(0, Math.floor(retSize / 8));
  } else if (retKind === "float") {
    returnRegs = [FLOAT_RETURN_REGS[abi][0]];
  } else {
    returnRegs = [INT_RETURN_REGS[abi][0]];
  }
  let position = hidden && abi === WIN64 ? 1 : 0;
  let nextStack = STACK_ARG_BASE[abi];
  let variadic = false;
  for (let k = 0; k < params.length; k++) {
    const typeName = params[k];
    const label = k < names.length ? names[k] : `p${k}`;
    if (typeName === "...") {
      variadic = true;
      break;
    }
    const [size, kind] = classify(typeName);
    let location: string[] = [];
    if (abi === WIN64) {
      if (position < 4) {
        if (kind === "float") location = [FLOAT_ARG_REGS[WIN64][position]];
        else if (kind === "struct" && ![1, 2, 4, 8].includes(size)) location = [`${INT_ARG_REGS[WIN64][position]} (pointer to copy)`];
        else location = [INT_ARG_REGS[WIN64][position]];
      } else {
        location = [`stack+${40 + 8 * (position - 4)}`];
        stackOffsets.push(40 + 8 * (position - 4));
      }
      position += 1;
    } else if (kind === "float" && floats.length > 0) {
      location = [floats.shift()!];
    } else if (kind === "int" && ints.length > 0) {
      location = [ints.shift()!];
    } else if (kind === "struct" && size <= 16 && ints.length >= Math.floor(size / 8)) {
      for (let n = 0; n < Math.floor(size / 8); n++) location.push(ints.shift()!);
    } else if (kind === "struct" && ARM_ABIS.includes(abi) && ints.length > 0) {
      location = [`${ints.shift()!} (pointer to copy)`];
    } else {
      for (let n = 0; n < Math.max(1, Math.floor(size / 8)); n++) {
        location.push(`stack+${nextStack}`);
        stackOffsets.push(nextStack);
        nextStack += 8;
      }
    }
    assignments.push({ name: label, type: typeName, location });
  }
  const registers = assignments.flatMap((a) => a.location.filter((loc) => !loc.startsWith("stack")).map((loc) => loc.split(" ")[0]));
  if (hidden) registers.unshift(hidden);
  let saveArea: string[] = [];
  if (variadic) {
    if (abi === SYSV) saveArea = [...ints, ...floats];
    else if (abi === WIN64 || abi === AAPCS64) saveArea = abi === WIN64 ? ints : [...ints, ...floats];
  }
  return { parameters: assignments, hidden, registers, variadicSaveArea: saveArea, stackOffsets, returnRegisters: returnRegs, variadic };
}

function regSortKey(name: string): [number, number, string] {
  const order = ["rdi", "rsi", "rdx", "rcx", "r8", "r9", "rax", "rbx", "rbp", "r10", "r11", "r12", "r13", "r14", "r15"];
  if (order.includes(name)) return [0, order.indexOf(name), name];
  const match = /^(x|v|xmm)(\d+)/.exec(name);
  if (match) return [({ x: 1, v: 2, xmm: 3 } as Record<string, number>)[match[1]], parseInt(match[2], 10), name];
  return [9, 0, name];
}

function regSorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => {
    const ka = regSortKey(a);
    const kb = regSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  });
}

function runChecks(analysis: FunctionAnalysis): Check[] {
  const abi = analysis.abi;
  const checks: Check[] = [];
  if (has(CALLEE_SHAPES, analysis.name)) checks.push(...callerChecks(analysis));
  else if (has(SIGNATURES, analysis.name)) checks.push(...calleeChecks(analysis));
  const savedSet = new Set(analysis.saved.map(([r]) => r).filter((r) => CALLEE_SAVED[abi].has(r)));
  const written = new Set(analysis.calleeSavedWritten);
  checks.push(new Check(RULES["callee-saved"][abi], regSorted(written), regSorted(savedSet), isSubset(written, savedSet)));
  if (analysis.calls.length > 0) {
    const depths = analysis.calls.map(([, d]) => d);
    if (analysis.tailCall) {
      checks.push(new Check(RULES.alignment[abi], "tail call with the stack pointer back at its entry value", depths.map((d) => `${d} bytes deep at the jump`), depths.every((d) => d === 0)));
    } else if (X86_ABIS.includes(abi)) {
      checks.push(new Check(RULES.alignment[abi], "(rsp + 8) % 16 == 0 at every call", depths.map((d) => `${d} bytes deep: (${d} + 8) % 16 = ${pyMod(d + 8, 16)}`), depths.every((d) => pyMod(d + 8, 16) === 0)));
    } else {
      checks.push(new Check(RULES.alignment[abi], "sp % 16 == 0 at every bl", depths.map((d) => `${d} bytes deep`), depths.every((d) => pyMod(d, 16) === 0)));
    }
    if (abi === WIN64 && !analysis.tailCall) {
      checks.push(new Check(RULES.shadow[abi], "at least 32 bytes between rsp and the return address at every call", depths, depths.every((d) => d >= 32)));
    }
  }
  if (analysis.belowSp.length > 0) {
    const extent = Math.max(...analysis.belowSp);
    checks.push(new Check(RULES["red-zone"][abi], `at most ${RED_ZONE_BYTES[abi]} bytes below the stack pointer`, `${extent} bytes below the stack pointer`, extent <= RED_ZONE_BYTES[abi]));
  } else if (abi === WIN64 || abi === AAPCS64) {
    checks.push(new Check(RULES["red-zone"][abi], "no access below the stack pointer", "none", true));
  }
  if (analysis.framePointer !== null) {
    const record = new Map<string, number>(analysis.saved);
    const get = (key: string): number | null => record.get(key) ?? null;
    if (X86_ABIS.includes(abi)) {
      checks.push(
        new Check(
          RULES["frame-pointer"][abi],
          "rbp saved at entry offset -8, then rbp = rsp",
          `rbp = entry offset ${analysis.framePointer}, saved rbp at ${pyFmt(get("rbp"))}`,
          get("rbp") === -8 && analysis.framePointer === -8,
        ),
      );
    } else {
      const ok = get("x29") === analysis.framePointer && get("x30") === analysis.framePointer + 8;
      checks.push(
        new Check(
          RULES["frame-pointer"][abi],
          "x29 points at the saved x29, with the saved x30 eight bytes above",
          `x29 = entry offset ${analysis.framePointer}; saved x29 at ${pyFmt(get("x29"))}, x30 at ${pyFmt(get("x30"))}`,
          ok,
        ),
      );
    }
  }
  const mirrors = analysis.epilogueMirrors;
  checks.push(new Check(EPILOGUE_RULE, "mirror of the prologue, stack pointer back at entry", mirrors ? "mirror" : `stack pointer ${analysis.depthAtExit} bytes off at exit or registers not restored`, mirrors));
  return checks;
}

function ruleKeyFor(name: string): string {
  return SIGNATURES[name][1].filter((t) => t !== "...").some((t) => classify(t)[1] === "float") ? "float-regs" : "int-regs";
}

function calleeChecks(analysis: FunctionAnalysis): Check[] {
  const abi = analysis.abi;
  const checks: Check[] = [];
  const expected = expectedLocations(abi, analysis.name);
  const expRegs = new Set([...expected.registers, ...expected.variadicSaveArea]);
  const obsRegs = new Set(analysis.paramRegisters);
  checks.push(new Check(RULES[ruleKeyFor(analysis.name)][abi], regSorted(expRegs), regSorted(obsRegs), setsEqual(expRegs, obsRegs)));
  if (expected.stackOffsets.length > 0 || analysis.stackSlots.length > 0) {
    checks.push(new Check(RULES["stack-args"][abi], expected.stackOffsets, numeric(analysis.stackSlots), setsEqual(new Set(expected.stackOffsets), new Set(analysis.stackSlots))));
  }
  if (expected.variadic) {
    if (abi === SYSV) {
      checks.push(new Check(RULES.variadic[abi], "callee reads %al before writing it", analysis.readsAl ? "reads %al" : "does not read %al", analysis.readsAl));
    } else if (abi === WIN64) {
      const homes = numeric(analysis.homeStores.map(([, o]) => o));
      checks.push(new Check(RULES.variadic[abi], [16, 24, 32], homes, arraysEqual(homes, [16, 24, 32])));
    } else if (abi === AAPCS64) {
      const spilled = new Set(analysis.spills.map(([r]) => r));
      const area = new Set(expected.variadicSaveArea);
      checks.push(new Check(RULES.variadic[abi], regSorted(area), regSorted([...spilled].filter((r) => area.has(r))), isSubset(area, spilled)));
    } else {
      checks.push(new Check(RULES.variadic[abi], "va_list starts at the caller's stack pointer (entry offset 0)", analysis.frameAddresses, analysis.frameAddresses.includes(0)));
    }
  }
  const observed = analysis.returnRegisters;
  if (expected.hidden && X86_ABIS.includes(abi)) {
    checks.push(
      new Check(
        RULES.return[abi],
        `${expected.hidden} copied to rax, result stored through it`,
        analysis.hiddenPointer ? `${analysis.hiddenPointer} copied to rax` : observed,
        analysis.hiddenPointer === expected.hidden && observed.includes("rax"),
      ),
    );
  } else {
    checks.push(new Check(RULES.return[abi], expected.returnRegisters, observed, setsEqual(new Set(expected.returnRegisters), new Set(observed))));
  }
  return checks;
}

function callerChecks(analysis: FunctionAnalysis): Check[] {
  const abi = analysis.abi;
  const checks: Check[] = [];
  const shape = CALLEE_SHAPES[analysis.name];
  const expected = expectedLocations(abi, shape);
  const expRegs = new Set(expected.registers);
  if (expected.variadic) {
    let extra: string[] = [];
    if (abi === SYSV) extra = ["rsi", "rdx", "rcx"];
    else if (abi === WIN64) extra = ["rdx", "r8", "r9"];
    else if (abi === AAPCS64) extra = ["x1", "x2", "x3"];
    for (const r of extra) expRegs.add(r);
  }
  const obsRegs = new Set(analysis.outgoingRegisters);
  checks.push(new Check(RULES[ruleKeyFor(shape)][abi], regSorted(expRegs), regSorted(obsRegs), setsEqual(expRegs, obsRegs)));
  const callRelative = expected.stackOffsets.map((o) => o - RETURN_ADDRESS_BYTES[abi]);
  const observedStack = numeric(analysis.outgoingStores.filter(([o, v]) => v !== null || callRelative.includes(o)).map(([o]) => o));
  if (callRelative.length > 0) {
    checks.push(new Check(RULES["stack-args"][abi], callRelative, observedStack, isSubset(new Set(callRelative), new Set(observedStack))));
  }
  if (expected.variadic) {
    if (abi === SYSV) {
      checks.push(new Check(RULES.variadic[abi], "%al set to 0 before the call (no vector registers used)", analysis.alZeroed ? "al zeroed" : "al not set", analysis.alZeroed));
    } else if (abi === APPLE_ARM64) {
      const slots = numeric(analysis.outgoingStores.map(([o]) => o));
      checks.push(new Check(RULES.variadic[abi], [0, 8, 16], slots, arraysEqual(slots, [0, 8, 16])));
    } else if (abi === AAPCS64) {
      checks.push(new Check(RULES.variadic[abi], "unnamed arguments stay in w1, w2, w3", regSorted(obsRegs), isSubset(new Set(["x1", "x2", "x3"]), obsRegs)));
    }
  }
  if (expected.hidden) {
    const pointer = expected.hidden;
    const passed = analysis.outgoingAddresses.filter(([, r]) => r === pointer).map(([o]) => `${pointer} = address of call offset ${o}`);
    checks.push(
      new Check(
        RULES.return[abi],
        `caller passes the address of its result buffer in ${pointer}`,
        passed.length > 0 ? passed : sortedStrings(obsRegs),
        analysis.outgoingAddresses.some(([, r]) => r === pointer),
      ),
    );
  } else {
    checks.push(new Check(RULES.return[abi], `result of ${shape} arrives in ${pyReprList(expected.returnRegisters)}`, analysis.returnRegisters, analysis.returnRegisters.length > 0));
  }
  return checks;
}

function loadFixture(stem: string): [ObjectInfo, Map<string, Instruction[]>] {
  const info = describeObject(join(FIXTURES, `${stem}.o`));
  let listingPath = join(FIXTURES, `${stem}.objdump.txt`);
  if (!existsSync(listingPath)) listingPath = join(FIXTURES, `${stem.replaceAll("-eh", "")}.objdump.txt`);
  return [info, parseListing(readFileSync(listingPath, "utf8"), info.functions).functions];
}

function listingGet(listing: Map<string, Instruction[]>, name: string): Instruction[] {
  const instructions = listing.get(name);
  if (instructions === undefined) throw new RangeError(`KeyError: '${name}'`);
  return instructions;
}

function analyzeFixture(stem: string): Map<string, FunctionAnalysis> {
  const [info, listing] = loadFixture(stem);
  const result = new Map<string, FunctionAnalysis>();
  for (const [name, instructions] of listing) {
    if (has(SIGNATURES, name)) result.set(name, analyzeFunction(name, instructions, info.abi));
  }
  return result;
}

const UWOP_NAMES: Record<number, string> = { 0: "UWOP_PUSH_NONVOL", 1: "UWOP_ALLOC_LARGE", 2: "UWOP_ALLOC_SMALL", 3: "UWOP_SET_FPREG", 4: "UWOP_SAVE_NONVOL", 5: "UWOP_SAVE_NONVOL_FAR", 8: "UWOP_SAVE_XMM128", 9: "UWOP_SAVE_XMM128_FAR", 10: "UWOP_PUSH_MACHFRAME" };
const SEH_REGISTERS = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"];

function decodeUnwindInfo(xdata: Buffer, offset: number): Rec {
  const first = xdata[offset];
  const sizeOfProlog = xdata[offset + 1];
  const count = xdata[offset + 2];
  const frame = xdata[offset + 3];
  const codes: Rec[] = [];
  let k = 0;
  const base = offset + 4;
  while (k < count) {
    const codeOffset = xdata[base + 2 * k];
    const op = xdata[base + 2 * k + 1] & 0x0f;
    const info = xdata[base + 2 * k + 1] >> 4;
    const entry: Rec = { prologOffset: codeOffset, op: UWOP_NAMES[op] ?? String(op) };
    if (op === 0) {
      entry.register = SEH_REGISTERS[info];
      k += 1;
    } else if (op === 2) {
      entry.bytes = info * 8 + 8;
      k += 1;
    } else if (op === 1) {
      if (info === 0) {
        entry.bytes = xdata.readUInt16LE(base + 2 * (k + 1)) * 8;
        k += 2;
      } else {
        entry.bytes = xdata.readUInt32LE(base + 2 * (k + 1));
        k += 3;
      }
    } else if (op === 4 || op === 8) {
      entry.register = op === 4 ? SEH_REGISTERS[info] : `xmm${info}`;
      entry.offset = xdata.readUInt16LE(base + 2 * (k + 1)) * (op === 4 ? 8 : 16);
      k += 2;
    } else if (op === 5 || op === 9) {
      entry.register = op === 5 ? SEH_REGISTERS[info] : `xmm${info}`;
      entry.offset = xdata.readUInt32LE(base + 2 * (k + 1));
      k += 3;
    } else {
      entry.info = info;
      k += 1;
    }
    codes.push(entry);
  }
  return { version: first & 0x7, flags: first >> 3, sizeOfProlog, countOfCodes: count, frameRegister: frame & 0xf ? SEH_REGISTERS[frame & 0xf] : null, frameOffset: (frame >> 4) * 16, codes };
}

function sehTable(info: ObjectInfo): Rec[] {
  const pdata = info.sections.get(".pdata");
  const xdata = info.sections.get(".xdata");
  if (!pdata || pdata.length === 0 || xdata === undefined) return [];
  const byOffset = byOffsetName(info.functions);
  const entries: Rec[] = [];
  for (let k = 0; k < Math.floor(pdata.length / 12); k++) {
    const begin = pdata.readUInt32LE(12 * k);
    const end = pdata.readUInt32LE(12 * k + 4);
    const unwind = pdata.readUInt32LE(12 * k + 8);
    entries.push({ function: byOffset.get(begin) ?? `0x${begin.toString(16)}`, begin, end, unwindData: unwind, unwind: decodeUnwindInfo(xdata, unwind) });
  }
  return entries;
}

function sehCrossCheck(stem = "convention-x86_64-windows-O2-seh"): Rec[] {
  const [info, listing] = loadFixture(stem);
  const results: Rec[] = [];
  for (const entry of sehTable(info)) {
    const name: string = entry.function;
    const analysis = analyzeFunction(name, listingGet(listing, name), WIN64);
    const codes: Rec[] = entry.unwind.codes;
    const pushes: string[] = codes.filter((c) => c.op === "UWOP_PUSH_NONVOL").map((c) => c.register);
    const allocs = codes.filter((c) => c.op === "UWOP_ALLOC_SMALL" || c.op === "UWOP_ALLOC_LARGE").reduce((total, c) => total + (c.bytes ?? 0), 0);
    const observedPushes = analysis.saved.map(([r]) => r).filter((r) => CALLEE_SAVED[WIN64].has(r));
    const observedAlloc = analysis.frameSize - 8 * observedPushes.length;
    const prologueBytes = analysis.prologue.reduce((total, i) => total + i.length, 0);
    const agree = arraysEqual([...pushes].reverse(), observedPushes) && allocs === observedAlloc && entry.unwind.sizeOfProlog === prologueBytes;
    results.push({ function: name, sizeOfProlog: entry.unwind.sizeOfProlog, prologueBytes, unwindPushes: pushes, observedPushes, unwindAllocBytes: allocs, observedAllocBytes: observedAlloc, codes, agree });
  }
  return results;
}

const FDE_HEADER = /FDE cie=\S+ pc=([0-9a-f]+)\.\.\.([0-9a-f]+)/;

interface FdeRecord {
  start: number;
  end: number;
  cfaOffsets: number[];
  savedAtCfa: Rec;
  cfaRegisters: string[];
}

function parseEhFrame(text: string): FdeRecord[] {
  const frames: FdeRecord[] = [];
  let current: FdeRecord | null = null;
  for (const line of splitLines(text)) {
    const header = FDE_HEADER.exec(line);
    if (header) {
      current = { start: parseInt(header[1], 16), end: parseInt(header[2], 16), cfaOffsets: [], savedAtCfa: {}, cfaRegisters: [] };
      frames.push(current);
      continue;
    }
    if (current === null) continue;
    let match = /DW_CFA_def_cfa_offset: \+(\d+)/.exec(line);
    if (match) current.cfaOffsets.push(parseInt(match[1], 10));
    match = /DW_CFA_def_cfa: (\w+) \+(\d+)/.exec(line);
    if (match) {
      current.cfaRegisters.push(dwarfRegister(match[1]));
      current.cfaOffsets.push(parseInt(match[2], 10));
    }
    match = /DW_CFA_offset: (\w+) (-?\d+)/.exec(line);
    if (match) current.savedAtCfa[dwarfRegister(match[1])] = parseInt(match[2], 10);
  }
  return frames;
}

function dwarfRegister(name: string): string {
  const match = /^W(\d+)$/.exec(name);
  if (match) return `x${match[1]}`;
  if (name === "WSP") return "sp";
  return name.toLowerCase();
}

function recordsEqual(a: Rec, b: Rec): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => has(b, key) && a[key] === b[key]);
}

function ehFrameCrossCheck(stem: string): Rec[] {
  const [info, listing] = loadFixture(stem);
  const frames = parseEhFrame(readFileSync(join(FIXTURES, `${stem}.eh-frame.txt`), "utf8"));
  const byOffset = byOffsetName(info.functions);
  const results: Rec[] = [];
  const returnAddress = RETURN_ADDRESS_BYTES[info.abi];
  for (const frame of frames) {
    const name = byOffset.get(frame.start);
    if (name === undefined || !listing.has(name)) continue;
    const analysis = analyzeFunction(name, listingGet(listing, name), info.abi);
    const observed: Rec = {};
    for (const [r, o] of analysis.saved) {
      if (CALLEE_SAVED[info.abi].has(r)) observed[r] = o - returnAddress;
    }
    const maxCfa = frame.cfaOffsets.length > 0 ? Math.max(...frame.cfaOffsets) : returnAddress;
    const deepest = analysis.maxDepth + returnAddress;
    results.push({ function: name, cfiSaved: frame.savedAtCfa, prologueSaved: observed, cfiMaxOffset: maxCfa, deepestStack: deepest, cfaRegisters: frame.cfaRegisters, agree: recordsEqual(frame.savedAtCfa, observed) && maxCfa === deepest });
  }
  return results;
}

function toolCaptures(): Rec {
  const toolsDir = join(FIXTURES, "tools");
  const report: Rec = {};
  if (!existsSync(toolsDir)) return report;
  const files = sortedStrings(readdirSync(toolsDir).filter((name) => name.endsWith(".txt")));
  for (const fileName of files) {
    if (fileName.includes("version")) continue;
    const text = readFileSync(join(toolsDir, fileName), "utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    const entry: Rec = {};
    const sections = new Map<string, string[]>();
    let current: string | null = null;
    for (const line of splitLines(text)) {
      const marker = /^\[([a-z]+)(?: (\w+))?\]$/.exec(line);
      if (marker) {
        current = marker[2] ? `${marker[1]} ${marker[2]}` : marker[1];
        sections.set(current, []);
        continue;
      }
      if (current) sections.get(current)!.push(line.trimEnd());
    }
    const conventions: Rec = {};
    for (const [k, v] of sections) if (k.startsWith("afc ") && v.length > 0) conventions[k.split(/\s+/)[1]] = v[0];
    if (Object.keys(conventions).length > 0) entry.conventions = conventions;
    if (sections.has("afcl")) {
      entry.available = sections.get("afcl")!.filter((l) => l && !["WARNING", "INFO", "ERROR", "HINT"].some((p) => l.startsWith(p)));
    }
    const args: Rec = {};
    for (const [key, lines] of sections) {
      if (!key.includes(" ")) continue;
      const [kind, name] = key.split(/\s+/);
      if (kind === "afv" || kind === "afvl") args[name] = lines.filter((l) => l.startsWith("arg ")).map((l) => l.split("@").at(-1)!.trim());
      if (kind === "prototype") args[name] = lines.slice(0, 1);
    }
    if (Object.keys(args).length > 0) entry.arguments = args;
    const cc: Rec = {};
    for (const [k, v] of sections) if (k.startsWith("cc ") && v.length > 0) cc[k.split(/\s+/)[1]] = v[0];
    if (Object.keys(cc).length > 0) entry.conventions = cc;
    report[fileName] = entry;
  }
  return report;
}

function which(name: string): string | null {
  for (const dir of (process.env.PATH ?? "/bin:/usr/bin").split(delimiter)) {
    const candidate = join(dir || ".", name);
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function runTools(stem = "convention-x86_64-linux-O2"): Rec {
  const results: Rec = {};
  const path = join(FIXTURES, `${stem}.o`);
  for (const [tool, command] of [["radare2", "r2"], ["rizin", "rizin"]]) {
    const binary = which(command);
    if (!binary) {
      results[tool] = "absent";
      continue;
    }
    const script = "afc @ sym.eight_args; " + (tool === "radare2" ? "afv @ sym.eight_args" : "afvl @ sym.eight_args");
    const argv = ["-A", "-q", "-e", "scr.color=0", "-c", script, path];
    const out = spawnSync(binary, argv, { encoding: "utf8", timeout: 120000 });
    if (out.error) {
      const timedOut = (out.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
      const listed = "[" + [binary, ...argv].map((item) => `'${item}'`).join(", ") + "]";
      results[tool] = timedOut ? `failed: Command '${listed}' timed out after 120 seconds` : `failed: ${out.error.message}`;
      continue;
    }
    results[tool] = splitLines(out.stdout.trim()).filter((l) => !["INFO", "WARNING", "HINT"].some((p) => l.startsWith(p))).slice(-12);
  }
  return results;
}

class FrameCell {
  constructor(public low: number, public high: number, public label: string, public kind: string) {}

  toDict(): Rec {
    return { lo: this.low, hi: this.high, label: this.label, kind: this.kind };
  }
}

function frameCells(analysis: FunctionAnalysis): FrameCell[] {
  const abi = analysis.abi;
  const x86 = X86_ABIS.includes(abi);
  const cells: FrameCell[] = [];
  const expected: { parameters: Expected["parameters"]; hidden: string | null } = has(SIGNATURES, analysis.name) ? expectedLocations(abi, analysis.name) : { parameters: [], hidden: null };
  const byLocation = new Map<string, string>();
  for (const param of expected.parameters) {
    for (const location of param.location) byLocation.set(location.split(" ")[0], param.name);
  }
  if (expected.hidden) byLocation.set(expected.hidden, "result pointer");
  for (const offset of analysis.stackSlots) {
    const label = byLocation.get(`stack+${offset}`) ?? "stack argument";
    cells.push(new FrameCell(offset, offset + 8, `argument ${label} (caller's frame)`, "arg"));
  }
  if (abi === WIN64) {
    INT_ARG_REGS[WIN64].forEach((register, k) => {
      const low = 8 + 8 * k;
      const used = analysis.homeStores.some(([, o]) => o === low);
      cells.push(new FrameCell(low, low + 8, used ? `home of ${register}` : `shadow slot for ${register}`, "shadow"));
    });
  }
  if (x86) cells.push(new FrameCell(0, 8, "return address", "ret"));
  for (const [register, offset] of analysis.saved) {
    if (register === "imm") continue;
    if (CALLEE_SAVED[abi].has(register)) {
      const kind = (register === "rbp" && analysis.framePointer === offset) || register === "x29" || register === "x30" ? "fp" : "save";
      const labels: Record<string, string> = { x29: "frame record: saved x29", x30: "frame record: saved x30 (LR)" };
      const label = labels[register] ?? `saved ${register}`;
      cells.push(new FrameCell(offset, offset + 8, label, kind));
    } else {
      cells.push(new FrameCell(offset, offset + 8, `pushq %${register}: 8-byte alignment pad`, "pad"));
    }
  }
  for (const [register, offset, size] of analysis.spills) {
    const label = byLocation.get(register) ?? register;
    cells.push(new FrameCell(offset, offset + size, `spill of ${register} (argument ${label})`, "spill"));
  }
  if (abi === WIN64 && analysis.calls.length > 0 && analysis.frameSize >= 32) {
    for (let low = -analysis.frameSize; low < -analysis.frameSize + 32; low += 8) cells.push(new FrameCell(low, low + 8, "shadow space for the callees", "shadow"));
  }
  const covered = cells.map((c): [number, number] => [c.low, c.high]);
  if (analysis.belowSp.length > 0) {
    const extent = Math.max(...analysis.belowSp);
    cells.push(new FrameCell(-analysis.frameSize - extent, -analysis.frameSize, `red zone, ${extent} bytes used`, "redzone"));
  }
  for (let low = -analysis.frameSize; low < 0; low += 8) {
    if (!covered.some(([a, b]) => a < low + 8 && low < b)) cells.push(new FrameCell(low, low + 8, "locals or alignment", "local"));
  }
  cells.sort((a, b) => b.low - a.low);
  return cells;
}

function figureData(): Rec {
  const abis = [
    { id: SYSV, label: "System V AMD64", short: "SysV", stems: { O0: "convention-x86_64-linux-O0", O2: "convention-x86_64-linux-O2" } as Record<string, string> },
    { id: WIN64, label: "Microsoft x64", short: "Win64", stems: { O0: "convention-x86_64-windows-O0", O2: "convention-x86_64-windows-O2" } as Record<string, string> },
    { id: AAPCS64, label: "AArch64 AAPCS64", short: "AArch64", stems: { O0: "convention-aarch64-linux-O0", O2: "convention-aarch64-linux-O2" } as Record<string, string> },
  ];
  const frames: Rec = {};
  for (const name of ["eight_args", "keeps"]) {
    frames[name] = {};
    for (const level of ["O0", "O2"]) {
      frames[name][level] = {};
      for (const abi of abis) {
        const [info, listing] = loadFixture(abi.stems[level]);
        const analysis = analyzeFunction(name, listingGet(listing, name), info.abi);
        const expected = expectedLocations(info.abi, name);
        const regs = expected.parameters.flatMap((p) => p.location.filter((loc) => !loc.startsWith("stack")).map((loc) => ({ p: p.name, r: loc.split(" ")[0] })));
        frames[name][level][abi.id] = {
          frame: analysis.frameSize,
          fp: analysis.framePointer,
          cells: frameCells(analysis).map((c) => c.toDict()),
          regs,
          ret: analysis.returnRegisters,
          prologue: analysis.prologue.map((i) => `${i.hex}  ${i.text}`),
          epilogue: analysis.epilogue.map((i) => `${i.hex}  ${i.text}`),
          calls: analysis.calls.map(([, d]) => d),
          agree: analysis.checks.filter((c) => c.agree).length,
          checks: analysis.checks.length,
        };
      }
    }
  }
  const signatures: Rec = {};
  for (const n of ["eight_args", "keeps"]) signatures[n] = `${SIGNATURES[n][0]} ${n}(${SIGNATURES[n][1].join(", ")})`;
  return {
    functions: ["eight_args", "keeps"],
    signatures,
    abis: abis.map((a) => ({ id: a.id, label: a.label, short: a.short })),
    frames,
  };
}

function demo(): Rec {
  const report: Rec = { objects: {} };
  for (const stem of Object.keys(FIXTURE_OBJECTS)) {
    const [info, listing] = loadFixture(stem);
    const functions: Rec = {};
    for (const [name, instructions] of listing) {
      if (has(SIGNATURES, name)) functions[name] = analyzeFunction(name, instructions, info.abi).toDict();
    }
    const values = Object.values(functions) as Rec[];
    const agree = values.reduce((total, f) => total + f.agree, 0);
    const total = values.reduce((sum, f) => sum + f.checks.length, 0);
    report.objects[stem] = { format: info.format, machine: info.machine, abi: ABI_NAMES[info.abi], checks: `${agree}/${total} agree`, functions };
  }
  report.sehCrossCheck = sehCrossCheck();
  const eh: Rec = {};
  for (const stem of ["convention-x86_64-linux-O2-eh", "convention-aarch64-linux-O2-eh"]) eh[stem] = ehFrameCrossCheck(stem);
  report.ehFrameCrossCheck = eh;
  report.toolCaptures = toolCaptures();
  report.liveTools = runTools();
  return report;
}

function main(argv: string[]): number {
  if (argv.length === 0) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "analyze" && argv.length === 3) {
    const [info, listing] = loadFixture(argv[1]);
    console.log(dumps(analyzeFunction(argv[2], listingGet(listing, argv[2]), info.abi).toDict(), 2));
    return 0;
  }
  if (command === "object" && argv.length === 2) {
    const info = describeObject(argv[1]);
    console.log(dumps({ format: info.format, machine: info.machine, abi: ABI_NAMES[info.abi], functions: info.functions.map((f) => f.name) }, 2));
    return 0;
  }
  if (command === "seh") {
    console.log(dumps(sehCrossCheck(), 2));
    return 0;
  }
  if (command === "eh-frame" && argv.length === 2) {
    console.log(dumps(ehFrameCrossCheck(argv[1]), 2));
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData(), null));
    return 0;
  }
  console.error("usage: main.py [analyze FIXTURE_STEM FUNCTION | object FILE | seh | eh-frame FIXTURE_STEM | figure-data]");
  return 2;
}

export { analyzeFixture };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
