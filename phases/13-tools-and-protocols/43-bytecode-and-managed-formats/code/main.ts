// Lesson: Beyond Native Code: Python, JVM, .NET, and WebAssembly Bytecode (phase 13 / lesson 43)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/43-bytecode-and-managed-formats/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code/main.ts

import { accessSync, constants as fsConstants, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

export const HERE = realpathSync(__dirname);
export const FIXTURES = path.join(HERE, "fixtures");

export class FormatError extends Error {}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json } | ReadonlyMap<string | number, Json>;
type JsonObject = { [key: string]: Json };

export class PyEllipsis {
  readonly kind = "Ellipsis";
}

export class PyStopIteration {
  readonly kind = "StopIteration";
}

export class PyFloat {
  constructor(readonly value: number) {}
}

export class PyComplex {
  constructor(readonly real: number, readonly imag: number) {}
}

export class PyTuple {
  constructor(readonly items: PyValue[]) {}
}

export class PyList {
  constructor(readonly items: PyValue[]) {}
}

export class PySet {
  constructor(readonly items: PyValue[]) {}
}

export class PyFrozenSet {
  constructor(readonly items: PyValue[]) {}
}

export class PyDict {
  constructor(readonly entries: [PyValue, PyValue][]) {}
}

export type PyValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | PyFloat
  | PyComplex
  | PyTuple
  | PyList
  | PySet
  | PyFrozenSet
  | PyDict
  | PyEllipsis
  | PyStopIteration
  | CodeObject;

const ELLIPSIS = new PyEllipsis();
const STOP_ITERATION = new PyStopIteration();

function hex2(value: number): string {
  return value.toString(16).padStart(2, "0");
}

export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mantissa, exponentText] = x.toExponential().split("e");
  const exponent = Number(exponentText);
  const sign = mantissa.startsWith("-") ? "-" : "";
  const digits = mantissa.replace("-", "").replace(".", "");
  if (exponent >= -4 && exponent < 16) {
    if (exponent < 0) return `${sign}0.${"0".repeat(-exponent - 1)}${digits}`;
    const whole = digits.length > exponent + 1 ? digits.slice(0, exponent + 1) : digits.padEnd(exponent + 1, "0");
    const fraction = digits.slice(exponent + 1);
    return `${sign}${whole}.${fraction || "0"}`;
  }
  const rest = digits.slice(1);
  const exponentSign = exponent < 0 ? "-" : "+";
  return `${sign}${digits[0]}${rest ? "." + rest : ""}e${exponentSign}${String(Math.abs(exponent)).padStart(2, "0")}`;
}

export function pyStrRepr(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === quote || ch === "\\") out += "\\" + ch;
    else if (ch === "\t") out += "\\t";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (code < 0x20 || (code >= 0x7f && code < 0xa0)) out += "\\x" + hex2(code);
    else if (code >= 0xd800 && code <= 0xdfff) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + quote;
}

function pyBytesRepr(data: Uint8Array): string {
  const quote = data.includes(0x27) && !data.includes(0x22) ? '"' : "'";
  let out = "b" + quote;
  for (const byte of data) {
    const ch = String.fromCharCode(byte);
    if (ch === quote || ch === "\\") out += "\\" + ch;
    else if (ch === "\t") out += "\\t";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (byte < 0x20 || byte >= 0x7f) out += "\\x" + hex2(byte);
    else out += ch;
  }
  return out + quote;
}

function complexPart(value: number): string {
  const text = pyFloatRepr(value);
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

export function pyRepr(value: PyValue): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number" || typeof value === "bigint") return value.toString();
  if (typeof value === "string") return pyStrRepr(value);
  if (value instanceof Uint8Array) return pyBytesRepr(value);
  if (value instanceof PyFloat) return pyFloatRepr(value.value);
  if (value instanceof PyComplex) {
    if (value.real === 0 && !Object.is(value.real, -0)) return `${complexPart(value.imag)}j`;
    const joiner = value.imag >= 0 || Number.isNaN(value.imag) ? "+" : "";
    return `(${complexPart(value.real)}${joiner}${complexPart(value.imag)}j)`;
  }
  if (value instanceof PyTuple) {
    if (value.items.length === 1) return `(${pyRepr(value.items[0])},)`;
    return `(${value.items.map(pyRepr).join(", ")})`;
  }
  if (value instanceof PyList) return `[${value.items.map(pyRepr).join(", ")}]`;
  if (value instanceof PySet) return value.items.length ? `{${value.items.map(pyRepr).join(", ")}}` : "set()";
  if (value instanceof PyFrozenSet) return value.items.length ? `frozenset({${value.items.map(pyRepr).join(", ")}})` : "frozenset()";
  if (value instanceof PyDict) return `{${value.entries.map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(", ")}}`;
  if (value instanceof PyEllipsis) return "Ellipsis";
  if (value instanceof PyStopIteration) return "<class 'StopIteration'>";
  return `<code object ${value.name}, file "${value.filename}", line ${value.firstlineno}>`;
}

function jsonString(text: string): string {
  return JSON.stringify(text).replace(/[^\x20-\x7e]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

function jsonNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : pyFloatRepr(value);
}

export function dumps(value: Json, indent: number | null = null, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return jsonNumber(value);
  if (typeof value === "string") return jsonString(value);
  const inner = indent === null ? "" : "\n" + " ".repeat(indent * (level + 1));
  const outer = indent === null ? "" : "\n" + " ".repeat(indent * level);
  const itemSeparator = ",";
  const keySeparator = indent === null ? ":" : ": ";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return "[" + inner + value.map((item) => dumps(item, indent, level + 1)).join(itemSeparator + inner) + outer + "]";
  }
  const entries: [string, Json][] = [];
  if (value instanceof Map) {
    for (const [key, item] of value as ReadonlyMap<string | number, Json>) entries.push([String(key), item]);
  } else {
    for (const [key, item] of Object.entries(value as JsonObject)) entries.push([key, item]);
  }
  if (!entries.length) return "{}";
  return "{" + inner + entries.map(([key, item]) => jsonString(key) + keySeparator + dumps(item, indent, level + 1)).join(itemSeparator + inner) + outer + "}";
}

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

function decodeLatin1(data: Uint8Array): string {
  return Array.from(data, (byte) => String.fromCharCode(byte)).join("");
}

function decodeAscii(data: Uint8Array): string {
  return Array.from(data, (byte) => (byte < 0x80 ? String.fromCharCode(byte) : "\ufffd")).join("");
}

function splitlines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function splitWhitespace(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

function isDigits(text: string): boolean {
  return /^[0-9]+$/.test(text);
}

function readBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(file));
}

export class Reader {
  data: Uint8Array;
  position: number;
  end: number;

  constructor(data: Uint8Array, position = 0, end: number | null = null) {
    this.data = data;
    this.position = position;
    this.end = end === null ? data.length : end;
  }

  atEnd(): boolean {
    return this.position >= this.end;
  }

  take(count: number): Uint8Array {
    if (this.position + count > this.end) {
      throw new FormatError(`read of ${count} bytes at offset ${this.position} runs past ${this.end}`);
    }
    const chunk = this.data.subarray(this.position, this.position + count);
    this.position += count;
    return chunk;
  }

  u8(): number {
    return this.take(1)[0];
  }

  u16le(): number {
    return view(this.take(2)).getUint16(0, true);
  }

  u32le(): number {
    return view(this.take(4)).getUint32(0, true);
  }

  i32le(): number {
    return view(this.take(4)).getInt32(0, true);
  }

  u64le(): bigint {
    return view(this.take(8)).getBigUint64(0, true);
  }

  u16be(): number {
    return view(this.take(2)).getUint16(0, false);
  }

  u32be(): number {
    return view(this.take(4)).getUint32(0, false);
  }

  i32be(): number {
    return view(this.take(4)).getInt32(0, false);
  }

  uleb(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.u8();
      result += (byte & 0x7f) * 2 ** shift;
      shift += 7;
      if (!(byte & 0x80)) return result;
      if (shift > 70) throw new FormatError("LEB128 value longer than 10 bytes");
    }
  }

  sleb(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.u8();
      result += (byte & 0x7f) * 2 ** shift;
      shift += 7;
      if (!(byte & 0x80)) {
        if (byte & 0x40) result -= 2 ** shift;
        return result;
      }
      if (shift > 70) throw new FormatError("LEB128 value longer than 10 bytes");
    }
  }
}

export function hexBytes(data: Uint8Array): string {
  return Array.from(data, hex2).join(" ");
}

export const PYC_MAGIC_WORDS = new Map<number, string>([[3425, "3.9"], [3439, "3.10"], [3495, "3.11"], [3531, "3.12"], [3571, "3.13"], [3627, "3.14"], [3666, "3.15"]]);
export const PYC_HEADER_SIZE = 16;
const FLAG_REF = 0x80;
const CO_FAST_LOCAL = 0x20;
const CO_FAST_CELL = 0x40;
const CO_FAST_FREE = 0x80;

export class PycHeader {
  constructor(
    readonly magic: Uint8Array,
    readonly magicWord: number,
    readonly version: string,
    readonly flags: number,
    readonly sourceMtime: number | null,
    readonly sourceSize: number | null,
    readonly sourceHash: Uint8Array | null,
  ) {}

  get hashBased(): boolean {
    return Boolean(this.flags & 1);
  }

  get checkSource(): boolean {
    return Boolean(this.flags & 2);
  }

  toDict(): JsonObject {
    return {
      magic: hexBytes(this.magic),
      magicWord: this.magicWord,
      version: this.version,
      flags: this.flags,
      hashBased: this.hashBased,
      checkSource: this.checkSource,
      sourceMtime: this.sourceMtime,
      sourceSize: this.sourceSize,
      sourceHash: this.sourceHash === null ? null : hexBytes(this.sourceHash),
    };
  }
}

export function readPycHeader(data: Uint8Array): PycHeader {
  if (data.length < PYC_HEADER_SIZE) throw new FormatError("pyc shorter than its 16-byte header");
  const magic = data.subarray(0, 4);
  if (magic[2] !== 0x0d || magic[3] !== 0x0a) throw new FormatError("pyc magic does not end in CR LF");
  const fields = view(data);
  const word = fields.getUint16(0, true);
  const version = PYC_MAGIC_WORDS.get(word) ?? "unknown";
  const flags = fields.getUint32(4, true);
  if (flags & 1) return new PycHeader(magic, word, version, flags, null, null, data.subarray(8, 16));
  const mtime = fields.getUint32(8, true);
  const size = fields.getUint32(12, true);
  return new PycHeader(magic, word, version, flags, mtime, size, null);
}

export class CodeObject {
  constructor(
    readonly argcount: number,
    readonly posonlyargcount: number,
    readonly kwonlyargcount: number,
    readonly stacksize: number,
    readonly flags: number,
    readonly code: Uint8Array,
    readonly consts: PyValue[],
    readonly names: string[],
    readonly localsplusnames: string[],
    readonly localspluskinds: Uint8Array,
    readonly filename: string,
    readonly name: string,
    readonly qualname: string,
    readonly firstlineno: number,
    readonly linetable: Uint8Array,
    readonly exceptiontable: Uint8Array,
  ) {}

  private namesWhere(test: (kind: number) => boolean): string[] {
    const found: string[] = [];
    const count = Math.min(this.localsplusnames.length, this.localspluskinds.length);
    for (let i = 0; i < count; i++) if (test(this.localspluskinds[i])) found.push(this.localsplusnames[i]);
    return found;
  }

  get varnames(): string[] {
    return this.namesWhere((kind) => Boolean(kind & CO_FAST_LOCAL));
  }

  get freevars(): string[] {
    return this.namesWhere((kind) => Boolean(kind & CO_FAST_FREE));
  }

  get cellvars(): string[] {
    return this.namesWhere((kind) => Boolean(kind & CO_FAST_CELL) && !(kind & CO_FAST_FREE));
  }

  get argnames(): string[] {
    return this.varnames.slice(0, this.argcount + this.kwonlyargcount);
  }

  nested(): CodeObject[] {
    const found = this.consts.filter((value): value is CodeObject => value instanceof CodeObject);
    return [...found, ...found.flatMap((inner) => inner.nested())];
  }

  toDict(): JsonObject {
    return {
      name: this.name,
      qualname: this.qualname,
      argcount: this.argcount,
      argnames: this.argnames,
      varnames: this.varnames,
      names: this.names,
      consts: this.consts.map((c) => (c instanceof CodeObject ? c.qualname : pyRepr(c))),
      codeBytes: this.code.length,
      stacksize: this.stacksize,
      firstlineno: this.firstlineno,
      filename: this.filename,
      linetableBytes: this.linetable.length,
      exceptiontableBytes: this.exceptiontable.length,
    };
  }
}

function itemsOf(value: PyValue): PyValue[] {
  if (value instanceof PyTuple || value instanceof PyList || value instanceof PySet || value instanceof PyFrozenSet) return value.items;
  if (typeof value === "string") return Array.from(value);
  throw new FormatError(`marshal value ${pyRepr(value)} is not a sequence`);
}

function stringOf(value: PyValue): string {
  return typeof value === "string" ? value : pyRepr(value);
}

function bytesOf(value: PyValue): Uint8Array {
  if (value instanceof Uint8Array) return value;
  throw new FormatError(`marshal value ${pyRepr(value)} is not bytes`);
}

export class Unmarshaller {
  reader: Reader;
  version: string;
  refs: PyValue[] = [];
  oldLayout: boolean;

  constructor(data: Uint8Array, version: string) {
    this.reader = new Reader(data);
    this.version = version;
    this.oldLayout = version === "3.9" || version === "3.10";
  }

  load(): PyValue {
    return this.readObject();
  }

  private reserve(flagged: boolean): number | null {
    if (!flagged) return null;
    this.refs.push(null);
    return this.refs.length - 1;
  }

  private insert(slot: number | null, value: PyValue): PyValue {
    if (slot !== null) this.refs[slot] = value;
    return value;
  }

  private ref(value: PyValue, flagged: boolean): PyValue {
    if (flagged) this.refs.push(value);
    return value;
  }

  readObject(): PyValue {
    const reader = this.reader;
    const code = reader.u8();
    const flagged = Boolean(code & FLAG_REF);
    const kind = String.fromCharCode(code & ~FLAG_REF);
    if (kind === "0") return null;
    if (kind === "N") return null;
    if (kind === "F") return false;
    if (kind === "T") return true;
    if (kind === ".") return ELLIPSIS;
    if (kind === "S") return STOP_ITERATION;
    if (kind === "i") return this.ref(reader.i32le(), flagged);
    if (kind === "l") return this.ref(this.readLong(), flagged);
    if (kind === "g") return this.ref(new PyFloat(view(reader.take(8)).getFloat64(0, true)), flagged);
    if (kind === "y") {
      const pair = view(reader.take(16));
      return this.ref(new PyComplex(pair.getFloat64(0, true), pair.getFloat64(8, true)), flagged);
    }
    if (kind === "s") return this.ref(reader.take(reader.u32le()), flagged);
    if (kind === "t" || kind === "u" || kind === "a" || kind === "A") return this.ref(decodeUtf8(reader.take(reader.u32le())), flagged);
    if (kind === "z" || kind === "Z") return this.ref(decodeLatin1(reader.take(reader.u8())), flagged);
    if (kind === "(" || kind === ")" || kind === "[" || kind === "<" || kind === ">") {
      const count = kind === ")" ? reader.u8() : reader.u32le();
      const slot = this.reserve(flagged);
      const items: PyValue[] = [];
      for (let i = 0; i < count; i++) items.push(this.readObject());
      if (kind === "[") return this.insert(slot, new PyList(items));
      if (kind === "<") return this.insert(slot, new PySet(items));
      if (kind === ">") return this.insert(slot, new PyFrozenSet(items));
      return this.insert(slot, new PyTuple(items));
    }
    if (kind === "{") {
      const slot = this.reserve(flagged);
      const entries: [PyValue, PyValue][] = [];
      while (true) {
        const key = this.readObject();
        if (key === null && reader.data[reader.position - 1] === "0".charCodeAt(0)) break;
        entries.push([key, this.readObject()]);
      }
      return this.insert(slot, new PyDict(entries));
    }
    if (kind === "r") {
      const index = reader.u32le();
      if (index >= this.refs.length) throw new FormatError(`marshal reference ${index} points past ${this.refs.length} objects`);
      return this.refs[index];
    }
    if (kind === "c") {
      const slot = this.reserve(flagged);
      return this.insert(slot, this.readCode());
    }
    throw new FormatError(`marshal type code ${pyStrRepr(kind)} at offset ${reader.position - 1} is not handled`);
  }

  private readLong(): number | bigint {
    const count = this.reader.i32le();
    const digits: number[] = [];
    for (let i = 0; i < Math.abs(count); i++) digits.push(this.reader.u16le());
    let value = 0n;
    for (const digit of digits.reverse()) value = (value << 15n) | BigInt(digit);
    const signed = count < 0 ? -value : value;
    return signed >= BigInt(Number.MIN_SAFE_INTEGER) && signed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(signed) : signed;
  }

  private readCode(): CodeObject {
    const reader = this.reader;
    const argcount = reader.i32le();
    const posonlyargcount = reader.i32le();
    const kwonlyargcount = reader.i32le();
    if (this.oldLayout) reader.i32le();
    const stacksize = reader.i32le();
    const flags = reader.i32le();
    const code = this.readObject();
    const consts = this.readObject();
    const names = this.readObject();
    let localsplusnames: string[];
    let localspluskinds: Uint8Array;
    let filename: PyValue;
    let name: PyValue;
    let qualname: PyValue;
    let firstlineno: number;
    let linetable: PyValue;
    let exceptiontable: PyValue;
    if (this.oldLayout) {
      const varnames = itemsOf(this.readObject()).map(stringOf);
      const freevars = itemsOf(this.readObject()).map(stringOf);
      const cellvars = itemsOf(this.readObject()).map(stringOf);
      localsplusnames = [...varnames, ...cellvars, ...freevars];
      localspluskinds = Uint8Array.from([
        ...varnames.map(() => CO_FAST_LOCAL),
        ...cellvars.map(() => CO_FAST_CELL),
        ...freevars.map(() => CO_FAST_FREE),
      ]);
      filename = this.readObject();
      name = this.readObject();
      qualname = name;
      firstlineno = reader.i32le();
      linetable = this.readObject();
      exceptiontable = new Uint8Array(0);
    } else {
      localsplusnames = itemsOf(this.readObject()).map(stringOf);
      localspluskinds = bytesOf(this.readObject());
      filename = this.readObject();
      name = this.readObject();
      qualname = this.readObject();
      firstlineno = reader.i32le();
      linetable = this.readObject();
      exceptiontable = this.readObject();
    }
    return new CodeObject(
      argcount,
      posonlyargcount,
      kwonlyargcount,
      stacksize,
      flags,
      bytesOf(code),
      itemsOf(consts),
      itemsOf(names).map(stringOf),
      localsplusnames,
      localspluskinds,
      stringOf(filename),
      stringOf(name),
      stringOf(qualname),
      firstlineno,
      bytesOf(linetable),
      bytesOf(exceptiontable),
    );
  }
}

interface DisRow {
  offset: number | null;
  opname: string;
  arg: number | null;
  argrepr: string;
}

let runningPythonCache: { full: string; short: string } | null | undefined;

function runningPython(): { full: string; short: string } | null {
  if (runningPythonCache === undefined) {
    const completed = spawnSync("python3", ["-I", "-c", "import sys; print(sys.version.split()[0])"], { encoding: "utf8" });
    if (completed.status === 0) {
      const full = completed.stdout.trim();
      const [major, minor] = full.split(".");
      runningPythonCache = { full, short: `${major}.${minor}` };
    } else {
      runningPythonCache = null;
    }
  }
  return runningPythonCache;
}

const NATIVE_DIS_SCRIPT =
  "import sys, marshal, dis, json\n" +
  "module = marshal.loads(sys.stdin.buffer.read()[16:])\n" +
  "code = next((c for c in module.co_consts if hasattr(c, 'co_code') and c.co_qualname == sys.argv[1]), None)\n" +
  "print(json.dumps(None if code is None else [{'offset': i.offset, 'opname': i.opname, 'arg': i.arg, 'argrepr': i.argrepr} for i in dis.get_instructions(code)]))\n";

export class PycFile {
  data: Uint8Array;
  header: PycHeader;
  module: CodeObject;

  constructor(data: Uint8Array) {
    this.data = data;
    this.header = readPycHeader(data);
    const module = new Unmarshaller(data.subarray(PYC_HEADER_SIZE), this.header.version).load();
    if (!(module instanceof CodeObject)) throw new FormatError("the object after the pyc header is not a code object");
    this.module = module;
  }

  get bodySize(): number {
    return this.data.length - PYC_HEADER_SIZE;
  }

  functions(): Map<string, CodeObject> {
    const found = new Map<string, CodeObject>();
    for (const code of this.module.nested()) found.set(code.qualname, code);
    return found;
  }

  matchesRunningInterpreter(): boolean {
    const running = runningPython();
    return running !== null && this.header.version === running.short;
  }

  instructions(name: string): DisRow[] | null {
    if (!this.matchesRunningInterpreter()) return null;
    const completed = spawnSync("python3", ["-I", "-c", NATIVE_DIS_SCRIPT, name], { input: this.data, encoding: "utf8" });
    if (completed.status !== 0) return null;
    return JSON.parse(completed.stdout) as DisRow[] | null;
  }

  toDict(): JsonObject {
    const functions = new Map<string, Json>();
    for (const [name, code] of this.functions()) functions.set(name, code.toDict());
    return {
      header: this.header.toDict(),
      fileBytes: this.data.length,
      bodyBytes: this.bodySize,
      module: this.module.toDict(),
      functions,
    };
  }
}

export function loadPyc(name: string): PycFile {
  return new PycFile(readBytes(path.join(FIXTURES, "python", name)));
}

const DIS_HEADER = /^Disassembly of <code object (\S+) at 0x[0-9a-f]+, file "([^"]+)", line (\d+)>:/;
const DIS_OPNAME = /^[A-Z][A-Z0-9_]+$/;

export function parseDisText(text: string): Map<string, DisRow[]> {
  const listing = new Map<string, DisRow[]>([["<module>", []]]);
  let current = "<module>";
  for (const line of splitlines(text)) {
    const header = DIS_HEADER.exec(line);
    if (header) {
      current = header[1];
      listing.set(current, []);
      continue;
    }
    const tokens = splitWhitespace(line);
    if (!tokens.length) continue;
    for (let position = 0; position < tokens.length; position++) {
      const token = tokens[position];
      if (DIS_OPNAME.test(token)) {
        const before = position > 0 ? tokens[position - 1] : "";
        const rest = tokens.slice(position + 1);
        const arg = rest.length && isDigits(rest[0]) ? Number(rest[0]) : null;
        const argrepr = arg !== null ? rest.slice(1).join(" ") : rest.join(" ");
        listing.get(current)?.push({ offset: isDigits(before) ? Number(before) : null, opname: token, arg, argrepr });
        break;
      }
    }
  }
  for (const rows of listing.values()) {
    if (rows.length && rows.some((row) => row.offset === null)) {
      for (const row of rows) row.offset = null;
    }
  }
  return listing;
}

export function disFixtureListing(versionTag: string, caches = false): Map<string, DisRow[]> {
  const suffix = caches ? "dis-caches.txt" : "dis.txt";
  return parseDisText(readFileSync(path.join(FIXTURES, "python", `ledger.${versionTag}.${suffix}`), "utf8"));
}

function listingRows(listing: Map<string, DisRow[]>, name: string): DisRow[] {
  const rows = listing.get(name);
  if (rows === undefined) throw new FormatError(`no listing for ${name}`);
  return rows;
}

export const PYTHON_INTERPRETERS = ["python3.11", "python3.12", "python3.13", "python3.14", "python3.15"];

function which(name: string): string | null {
  for (const folder of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!folder) continue;
    const candidate = path.join(folder, name);
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export function availableInterpreters(): string[] {
  return PYTHON_INTERPRETERS.filter((name) => which(name) !== null);
}

export function compareInterpreters(source: string | null = null): Json[] {
  const sourcePath = source ?? path.join(FIXTURES, "python", "ledger.py");
  const script =
    "import sys, py_compile, dis, marshal, importlib.util, json\n" +
    "path = sys.argv[1]\n" +
    "target = sys.argv[2]\n" +
    "py_compile.compile(path, cfile=target, dfile='ledger.py', doraise=True, invalidation_mode=py_compile.PycInvalidationMode.CHECKED_HASH)\n" +
    "data = open(target, 'rb').read()\n" +
    "module = marshal.loads(data[16:])\n" +
    "grade = [c for c in module.co_consts if hasattr(c, 'co_code') and c.co_name == 'grade'][0]\n" +
    "rows = list(dis.get_instructions(grade))\n" +
    "print(json.dumps({'version': sys.version.split()[0], 'magic': importlib.util.MAGIC_NUMBER.hex(), 'marshalVersion': marshal.version, 'fileBytes': len(data), 'gradeCodeBytes': len(grade.co_code), 'gradeInstructions': len(rows), 'gradeOpnames': sorted(set(r.opname for r in rows))}))\n";
  const results: Json[] = [];
  for (const name of availableInterpreters()) {
    const folder = mkdtempSync(path.join(os.tmpdir(), "tmp"));
    try {
      const target = path.join(folder, "ledger.pyc");
      const completed = spawnSync(name, ["-I", "-c", script, sourcePath, target], { encoding: "utf8" });
      if (completed.status !== 0) {
        results.push({ interpreter: name, error: (completed.stderr ?? "").trim().slice(-300) });
        continue;
      }
      const row = JSON.parse(completed.stdout) as JsonObject;
      row["interpreter"] = name;
      row["headerFromOurReader"] = readPycHeader(readBytes(target)).toDict();
      results.push(row);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }
  return results;
}

export function pythonStructure(rows: DisRow[]): JsonObject {
  const jumps = rows.filter((row) => row.opname.startsWith("POP_JUMP") || row.opname.startsWith("JUMP_")).length;
  const compares = rows.filter((row) => row.opname.startsWith("COMPARE_OP")).length;
  const returns = rows.filter((row) => row.opname.startsWith("RETURN")).length;
  const caches = rows.filter((row) => row.opname === "CACHE").length;
  return { instructions: rows.length - caches, jumps, compares, returns, caches, structured: 0 };
}

export const CLASS_MAGIC = 0xcafebabe;
const CONSTANT_TAGS = new Map<number, string>([
  [1, "Utf8"], [3, "Integer"], [4, "Float"], [5, "Long"], [6, "Double"], [7, "Class"], [8, "String"], [9, "Fieldref"],
  [10, "Methodref"], [11, "InterfaceMethodref"], [12, "NameAndType"], [15, "MethodHandle"], [16, "MethodType"],
  [17, "Dynamic"], [18, "InvokeDynamic"], [19, "Module"], [20, "Package"],
]);
const JAVA_MAJOR_VERSIONS = new Map<number, string>([[45, "1.1"], [49, "5"], [52, "8"], [55, "11"], [61, "17"], [65, "21"], [69, "25"]]);
const JVM_OPCODES = (
  "nop aconst_null iconst_m1 iconst_0 iconst_1 iconst_2 iconst_3 iconst_4 iconst_5 lconst_0 lconst_1 fconst_0 fconst_1 fconst_2 " +
  "dconst_0 dconst_1 bipush sipush ldc ldc_w ldc2_w iload lload fload dload aload iload_0 iload_1 iload_2 iload_3 lload_0 lload_1 " +
  "lload_2 lload_3 fload_0 fload_1 fload_2 fload_3 dload_0 dload_1 dload_2 dload_3 aload_0 aload_1 aload_2 aload_3 iaload laload " +
  "faload daload aaload baload caload saload istore lstore fstore dstore astore istore_0 istore_1 istore_2 istore_3 lstore_0 " +
  "lstore_1 lstore_2 lstore_3 fstore_0 fstore_1 fstore_2 fstore_3 dstore_0 dstore_1 dstore_2 dstore_3 astore_0 astore_1 astore_2 " +
  "astore_3 iastore lastore fastore dastore aastore bastore castore sastore pop pop2 dup dup_x1 dup_x2 dup2 dup2_x1 dup2_x2 swap " +
  "iadd ladd fadd dadd isub lsub fsub dsub imul lmul fmul dmul idiv ldiv fdiv ddiv irem lrem frem drem ineg lneg fneg dneg ishl " +
  "lshl ishr lshr iushr lushr iand land ior lor ixor lxor iinc i2l i2f i2d l2i l2f l2d f2i f2l f2d d2i d2l d2f i2b i2c i2s lcmp " +
  "fcmpl fcmpg dcmpl dcmpg ifeq ifne iflt ifge ifgt ifle if_icmpeq if_icmpne if_icmplt if_icmpge if_icmpgt if_icmple if_acmpeq " +
  "if_acmpne goto jsr ret tableswitch lookupswitch ireturn lreturn freturn dreturn areturn return getstatic putstatic getfield " +
  "putfield invokevirtual invokespecial invokestatic invokeinterface invokedynamic new newarray anewarray arraylength athrow " +
  "checkcast instanceof monitorenter monitorexit wide multianewarray ifnull ifnonnull goto_w jsr_w"
).split(" ");
const JVM_OPERAND_BYTES = new Map<number, number>([[16, 1], [17, 2], [18, 1], [19, 2], [20, 2], [132, 2], [169, 1], [185, 4], [186, 4], [187, 2], [188, 1], [189, 2], [192, 2], [193, 2], [197, 3], [200, 4], [201, 4]]);
for (let opcode = 21; opcode < 26; opcode++) JVM_OPERAND_BYTES.set(opcode, 1);
for (let opcode = 54; opcode < 59; opcode++) JVM_OPERAND_BYTES.set(opcode, 1);
for (let opcode = 153; opcode < 169; opcode++) JVM_OPERAND_BYTES.set(opcode, 2);
for (let opcode = 178; opcode < 185; opcode++) JVM_OPERAND_BYTES.set(opcode, 2);
for (const opcode of [198, 199]) JVM_OPERAND_BYTES.set(opcode, 2);
const JVM_BRANCHES = new Set<number>([...Array.from({ length: 16 }, (_, i) => 153 + i), 198, 199]);
const JVM_WIDE_BRANCHES = new Set<number>([200, 201]);
const JVM_CONSTANT_REFS = new Set<number>([18, 19, 20, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 189, 192, 193, 197]);
const JVM_ARRAY_TYPES = new Map<number, string>([[4, "boolean"], [5, "char"], [6, "float"], [7, "double"], [8, "byte"], [9, "short"], [10, "int"], [11, "long"]]);

type ConstantValue = string | number | bigint | PyFloat | [number, number];

export class Constant {
  constructor(readonly index: number, readonly tag: number, readonly value: ConstantValue) {}

  get kind(): string {
    return CONSTANT_TAGS.get(this.tag) ?? `tag${this.tag}`;
  }

  get number(): number {
    if (typeof this.value !== "number") throw new FormatError(`constant #${this.index} is ${this.kind}, not an index`);
    return this.value;
  }

  get pair(): [number, number] {
    if (!Array.isArray(this.value)) throw new FormatError(`constant #${this.index} is ${this.kind}, not a pair of indexes`);
    return this.value;
  }
}

export interface JvmSwitch {
  low?: number;
  high?: number;
  default: number;
  targets: Map<number, number>;
}

export class JvmInstruction {
  constructor(
    readonly offset: number,
    readonly opcode: number,
    readonly raw: Uint8Array,
    readonly mnemonic: string,
    readonly operands: number[],
    readonly text: string,
    readonly targets: number[] = [],
    readonly switchInfo: JvmSwitch | null = null,
  ) {}

  get end(): number {
    return this.offset + this.raw.length;
  }
}

export class CodeAttribute {
  constructor(
    readonly maxStack: number,
    readonly maxLocals: number,
    readonly code: Uint8Array,
    readonly exceptionTable: [number, number, number, number][],
    readonly attributes: Attribute[],
  ) {}

  attribute(name: string): Attribute | null {
    return this.attributes.find((a) => a.name === name) ?? null;
  }
}

interface LocalVariableRow {
  start: number;
  length: number;
  slot: number;
  name: string;
  descriptor: string;
}

type AttributeParsed = CodeAttribute | [number, number][] | LocalVariableRow[] | string | { entries: number } | { count: number } | null;

export class Attribute {
  constructor(readonly name: string, readonly info: Uint8Array, readonly parsed: AttributeParsed = null) {}
}

export class Member {
  constructor(readonly accessFlags: number, readonly name: string, readonly descriptor: string, readonly attributes: Attribute[]) {}

  get code(): CodeAttribute | null {
    for (const attribute of this.attributes) {
      if (attribute.name === "Code") return attribute.parsed instanceof CodeAttribute ? attribute.parsed : null;
    }
    return null;
  }

  attributeNames(): string[] {
    const names = this.attributes.map((a) => a.name);
    const code = this.code;
    if (code !== null) names.push(...code.attributes.map((a) => a.name));
    return names;
  }
}

function requireCode(member: Member): CodeAttribute {
  const code = member.code;
  if (code === null) throw new FormatError(`method ${member.name} has no Code attribute`);
  return code;
}

export class ClassFile {
  data: Uint8Array;
  magic: number;
  minorVersion: number;
  majorVersion: number;
  constantPool: (Constant | null)[];
  accessFlags: number;
  thisClass: number;
  superClass: number;
  interfaces: number[] = [];
  fields: Member[] = [];
  methods: Member[] = [];
  attributes: Attribute[];

  constructor(data: Uint8Array) {
    this.data = data;
    const reader = new Reader(data);
    this.magic = reader.u32be();
    if (this.magic !== CLASS_MAGIC) throw new FormatError(`class magic is 0x${this.magic.toString(16).padStart(8, "0")}, not 0xCAFEBABE`);
    this.minorVersion = reader.u16be();
    this.majorVersion = reader.u16be();
    this.constantPool = this.readConstantPool(reader);
    this.accessFlags = reader.u16be();
    this.thisClass = reader.u16be();
    this.superClass = reader.u16be();
    for (let i = 0, count = reader.u16be(); i < count; i++) this.interfaces.push(reader.u16be());
    for (let i = 0, count = reader.u16be(); i < count; i++) this.fields.push(this.readMember(reader));
    for (let i = 0, count = reader.u16be(); i < count; i++) this.methods.push(this.readMember(reader));
    this.attributes = this.readAttributes(reader);
    if (!reader.atEnd()) throw new FormatError(`${reader.end - reader.position} bytes follow the class file attributes`);
  }

  private readConstantPool(reader: Reader): (Constant | null)[] {
    const count = reader.u16be();
    const pool: (Constant | null)[] = new Array<Constant | null>(count).fill(null);
    let index = 1;
    while (index < count) {
      const tag = reader.u8();
      let value: ConstantValue;
      if (tag === 1) value = decodeUtf8(reader.take(reader.u16be()));
      else if (tag === 3) value = reader.i32be();
      else if (tag === 4) value = new PyFloat(view(reader.take(4)).getFloat32(0, false));
      else if (tag === 5) value = view(reader.take(8)).getBigInt64(0, false);
      else if (tag === 6) value = new PyFloat(view(reader.take(8)).getFloat64(0, false));
      else if (tag === 7 || tag === 8 || tag === 16 || tag === 19 || tag === 20) value = reader.u16be();
      else if (tag === 9 || tag === 10 || tag === 11 || tag === 12 || tag === 17 || tag === 18) {
        const first = reader.u16be();
        value = [first, reader.u16be()];
      } else if (tag === 15) {
        const kind = reader.u8();
        value = [kind, reader.u16be()];
      } else throw new FormatError(`constant pool tag ${tag} at entry ${index} is not in JVMS 4.4`);
      pool[index] = new Constant(index, tag, value);
      index += tag === 5 || tag === 6 ? 2 : 1;
    }
    return pool;
  }

  constant(index: number): Constant {
    const constant = index > 0 && index < this.constantPool.length ? this.constantPool[index] : null;
    if (constant === null) throw new FormatError(`constant pool index ${index} is empty or out of range`);
    return constant;
  }

  utf8(index: number): string {
    const constant = this.constant(index);
    if (constant.tag !== 1 || typeof constant.value !== "string") throw new FormatError(`constant #${index} is ${constant.kind}, not Utf8`);
    return constant.value;
  }

  className(index: number): string {
    return this.utf8(this.constant(index).number);
  }

  describeConstant(index: number): string {
    const constant = this.constant(index);
    if (constant.tag === 1) return this.utf8(index);
    if (constant.tag === 3 || constant.tag === 4 || constant.tag === 5 || constant.tag === 6) {
      return constant.value instanceof PyFloat ? pyFloatRepr(constant.value.value) : String(constant.value);
    }
    if (constant.tag === 7) return "class " + this.className(index);
    if (constant.tag === 8) return "String " + this.utf8(constant.number);
    if (constant.tag === 9 || constant.tag === 10 || constant.tag === 11) {
      const owner = this.className(constant.pair[0]);
      const [name, descriptor] = this.nameAndType(constant.pair[1]);
      const label = constant.tag === 9 ? "Field" : constant.tag === 10 ? "Method" : "InterfaceMethod";
      return `${label} ${owner}.${name}:${descriptor}`;
    }
    if (constant.tag === 12) {
      const [name, descriptor] = this.nameAndType(index);
      return `${name}:${descriptor}`;
    }
    if (constant.tag === 17 || constant.tag === 18) {
      const [name, descriptor] = this.nameAndType(constant.pair[1]);
      return `InvokeDynamic #${constant.pair[0]}:${name}:${descriptor}`;
    }
    return constant.kind;
  }

  nameAndType(index: number): [string, string] {
    const constant = this.constant(index);
    if (constant.tag !== 12) throw new FormatError(`constant #${index} is ${constant.kind}, not NameAndType`);
    return [this.utf8(constant.pair[0]), this.utf8(constant.pair[1])];
  }

  private readAttributes(reader: Reader): Attribute[] {
    const attributes: Attribute[] = [];
    for (let i = 0, count = reader.u16be(); i < count; i++) {
      const name = this.utf8(reader.u16be());
      const info = reader.take(reader.u32be());
      attributes.push(new Attribute(name, info, this.parseAttribute(name, info)));
    }
    return attributes;
  }

  private parseAttribute(name: string, info: Uint8Array): AttributeParsed {
    const reader = new Reader(info);
    if (name === "Code") {
      const maxStack = reader.u16be();
      const maxLocals = reader.u16be();
      const code = reader.take(reader.u32be());
      const exceptions: [number, number, number, number][] = [];
      for (let i = 0, count = reader.u16be(); i < count; i++) exceptions.push([reader.u16be(), reader.u16be(), reader.u16be(), reader.u16be()]);
      return new CodeAttribute(maxStack, maxLocals, code, exceptions, this.readAttributes(reader));
    }
    if (name === "LineNumberTable") {
      const rows: [number, number][] = [];
      for (let i = 0, count = reader.u16be(); i < count; i++) rows.push([reader.u16be(), reader.u16be()]);
      return rows;
    }
    if (name === "LocalVariableTable") {
      const rows: LocalVariableRow[] = [];
      for (let i = 0, count = reader.u16be(); i < count; i++) {
        const start = reader.u16be();
        const length = reader.u16be();
        const nameIndex = reader.u16be();
        const descriptorIndex = reader.u16be();
        const slot = reader.u16be();
        rows.push({ start, length, slot, name: this.utf8(nameIndex), descriptor: this.utf8(descriptorIndex) });
      }
      return rows;
    }
    if (name === "SourceFile") return this.utf8(reader.u16be());
    if (name === "StackMapTable") return { entries: reader.u16be() };
    if (name === "BootstrapMethods") return { count: reader.u16be() };
    return null;
  }

  private readMember(reader: Reader): Member {
    const accessFlags = reader.u16be();
    const name = this.utf8(reader.u16be());
    const descriptor = this.utf8(reader.u16be());
    return new Member(accessFlags, name, descriptor, this.readAttributes(reader));
  }

  get name(): string {
    return this.className(this.thisClass);
  }

  method(name: string): Member {
    for (const member of this.methods) if (member.name === name) return member;
    throw new FormatError(`no method named ${name}`);
  }

  sourceFile(): string | null {
    const attribute = this.attributes.find((a) => a.name === "SourceFile");
    return attribute !== undefined && typeof attribute.parsed === "string" ? attribute.parsed : null;
  }

  constantPoolSummary(): JsonObject {
    const counts = new Map<string, number>();
    for (const constant of this.constantPool) {
      if (constant !== null) counts.set(constant.kind, (counts.get(constant.kind) ?? 0) + 1);
    }
    const summary: JsonObject = {};
    for (const key of [...counts.keys()].sort()) summary[key] = counts.get(key) ?? 0;
    return summary;
  }

  toDict(): JsonObject {
    return {
      magic: `0x${this.magic.toString(16).padStart(8, "0")}`,
      minorVersion: this.minorVersion,
      majorVersion: this.majorVersion,
      javaRelease: JAVA_MAJOR_VERSIONS.get(this.majorVersion) ?? "unknown",
      constantPoolCount: this.constantPool.length,
      constantPool: this.constantPoolSummary(),
      accessFlags: `0x${this.accessFlags.toString(16).padStart(4, "0")}`,
      thisClass: this.name,
      superClass: this.superClass ? this.className(this.superClass) : null,
      sourceFile: this.sourceFile(),
      fields: this.fields.map((f) => ({ name: f.name, descriptor: f.descriptor })),
      methods: this.methods.map((m) => {
        const code = m.code;
        return {
          name: m.name,
          descriptor: m.descriptor,
          codeBytes: code === null ? null : code.code.length,
          maxStack: code === null ? null : code.maxStack,
          maxLocals: code === null ? null : code.maxLocals,
          attributes: m.attributeNames(),
          instructions: code === null ? null : disassembleJvm(this, code.code).length,
        };
      }),
      classAttributes: this.attributes.map((a) => a.name),
      fileBytes: this.data.length,
    };
  }
}

export function loadClass(name: string): ClassFile {
  return new ClassFile(readBytes(path.join(FIXTURES, "java", name)));
}

export function disassembleJvm(classFile: ClassFile, code: Uint8Array): JvmInstruction[] {
  const reader = new Reader(code);
  const instructions: JvmInstruction[] = [];
  while (!reader.atEnd()) {
    const start = reader.position;
    const opcode = reader.u8();
    if (opcode >= JVM_OPCODES.length) throw new FormatError(`opcode ${opcode} at pc ${start} is reserved or undefined`);
    const mnemonic = JVM_OPCODES[opcode];
    let operands: number[] = [];
    let text = mnemonic;
    let targets: number[] = [];
    let switchInfo: JvmSwitch | null = null;
    if (opcode === 170 || opcode === 171) {
      while (reader.position % 4) reader.u8();
      const defaultTarget = start + reader.i32be();
      if (opcode === 170) {
        const low = reader.i32be();
        const high = reader.i32be();
        const table: number[] = [];
        for (let i = 0; i < high - low + 1; i++) table.push(start + reader.i32be());
        switchInfo = { low, high, default: defaultTarget, targets: new Map(table.map((t, i) => [low + i, t])) };
        text = `tableswitch { ${low} to ${high}, default ${defaultTarget} }`;
        targets = [...table, defaultTarget];
      } else {
        const pairs: [number, number][] = [];
        for (let i = 0, count = reader.i32be(); i < count; i++) {
          const key = reader.i32be();
          pairs.push([key, start + reader.i32be()]);
        }
        switchInfo = { default: defaultTarget, targets: new Map(pairs) };
        text = `lookupswitch { ${pairs.length} keys, default ${defaultTarget} }`;
        targets = [...pairs.map(([, t]) => t), defaultTarget];
      }
    } else if (opcode === 196) {
      const wideOpcode = reader.u8();
      const index = reader.u16be();
      operands = [wideOpcode, index];
      text = `wide ${JVM_OPCODES[wideOpcode]} ${index}`;
      if (wideOpcode === 132) {
        operands.push(view(reader.take(2)).getInt16(0, false));
        text += `, ${operands[2]}`;
      }
    } else {
      const size = JVM_OPERAND_BYTES.get(opcode) ?? 0;
      const rawOperand = reader.take(size);
      if (JVM_BRANCHES.has(opcode)) {
        const target = start + view(rawOperand).getInt16(0, false);
        operands = [target];
        targets = [target];
        text = `${mnemonic} ${target}`;
      } else if (JVM_WIDE_BRANCHES.has(opcode)) {
        const target = start + view(rawOperand).getInt32(0, false);
        operands = [target];
        targets = [target];
        text = `${mnemonic} ${target}`;
      } else if (JVM_CONSTANT_REFS.has(opcode)) {
        const index = size === 1 ? rawOperand[0] : view(rawOperand).getUint16(0, false);
        operands = [index, ...rawOperand.subarray(2)];
        text = `${mnemonic} #${index}`;
        if (opcode === 186) text += ", 0";
        else if (opcode === 185) text += `, ${rawOperand[2]}`;
        else if (opcode === 197) text += `, ${rawOperand[2]}`;
      } else if (opcode === 16) {
        operands = [view(rawOperand).getInt8(0)];
        text = `${mnemonic} ${operands[0]}`;
      } else if (opcode === 17) {
        operands = [view(rawOperand).getInt16(0, false)];
        text = `${mnemonic} ${operands[0]}`;
      } else if (opcode === 132) {
        operands = [rawOperand[0], view(rawOperand).getInt8(1)];
        text = `${mnemonic} ${operands[0]}, ${operands[1]}`;
      } else if (opcode === 188) {
        operands = [rawOperand[0]];
        text = `${mnemonic} ${JVM_ARRAY_TYPES.get(rawOperand[0]) ?? String(rawOperand[0])}`;
      } else if (size) {
        operands = [rawOperand.reduce((value, byte) => value * 256 + byte, 0)];
        text = `${mnemonic} ${operands[0]}`;
      }
    }
    instructions.push(new JvmInstruction(start, opcode, code.subarray(start, reader.position), mnemonic, operands, text, targets, switchInfo));
  }
  return instructions;
}

interface ListingRow {
  offset: number;
  bytes: string;
  text: string;
  comment?: string | null;
  depth?: number;
}

export function jvmListing(classFile: ClassFile, methodName: string): ListingRow[] {
  const code = requireCode(classFile.method(methodName));
  const rows: ListingRow[] = [];
  for (const instruction of disassembleJvm(classFile, code.code)) {
    const row: ListingRow = { offset: instruction.offset, bytes: hexBytes(instruction.raw), text: instruction.text };
    if (JVM_CONSTANT_REFS.has(instruction.opcode)) row.comment = classFile.describeConstant(instruction.operands[0]);
    rows.push(row);
  }
  return rows;
}

const JAVAP_METHOD = /^  (?:public |private |protected |static |final |synchronized |native |abstract )*[\w$.\[\]<>]+(?: [\w$<>]+)?\(.*\);$|^  static \{\};$|^  (?:public |private |protected )?[\w$]+\(.*\);$/;
const JAVAP_INSTRUCTION = /^\s+(\d+): (\w+)\s*(.*?)\s*(?:\/\/.*)?$/;
const JAVAP_SWITCH_ROW = /^\s+(-?\d+|default): (\d+)$/;

interface JavapRow {
  offset: number;
  mnemonic: string;
  operand: string;
  cases?: Map<string, number>;
}

interface JavapMethod {
  header: string;
  instructions: JavapRow[];
}

export function parseJavapCode(text: string): JavapMethod[] {
  const methods: JavapMethod[] = [];
  let current: JavapMethod | null = null;
  let inSwitch: JavapRow | null = null;
  for (const line of splitlines(text)) {
    if (JAVAP_METHOD.test(line)) {
      current = { header: line.trim(), instructions: [] };
      methods.push(current);
      continue;
    }
    if (current === null) continue;
    if (inSwitch !== null) {
      const row = JAVAP_SWITCH_ROW.exec(line);
      if (row) {
        inSwitch.cases?.set(row[1], Number(row[2]));
        continue;
      }
      if (line.trim() === "}") {
        inSwitch = null;
        continue;
      }
    }
    const match = JAVAP_INSTRUCTION.exec(line);
    if (!match) continue;
    const offset = Number(match[1]);
    const mnemonic = match[2];
    const entry: JavapRow = { offset, mnemonic, operand: match[3].replaceAll("  ", " ").trim() };
    if (mnemonic === "tableswitch" || mnemonic === "lookupswitch") {
      entry.cases = new Map();
      inSwitch = entry;
      entry.operand = "";
    }
    current.instructions.push(entry);
  }
  return methods;
}

type CaseKey = number | string;

function pyCasesRepr(cases: Map<CaseKey, number>): string {
  return "{" + [...cases].map(([key, value]) => `${typeof key === "number" ? key : pyStrRepr(key)}: ${value}`).join(", ") + "}";
}

function sameCases(a: Map<CaseKey, number>, b: Map<CaseKey, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) if (b.get(key) !== value) return false;
  return true;
}

export function compareWithJavap(classFile: ClassFile, javapText: string): { compared: number; mismatches: JsonObject[]; agree: boolean } {
  const expectedMethods = parseJavapCode(javapText);
  const withCode = classFile.methods.filter((m) => m.code !== null);
  const mismatches: JsonObject[] = [];
  let compared = 0;
  if (expectedMethods.length !== withCode.length) {
    mismatches.push({ method: "*", expected: `${expectedMethods.length} methods`, got: `${withCode.length} methods` });
  }
  for (let m = 0; m < Math.min(withCode.length, expectedMethods.length); m++) {
    const member = withCode[m];
    const expected = expectedMethods[m];
    const ours = disassembleJvm(classFile, requireCode(member).code);
    if (ours.length !== expected.instructions.length) {
      mismatches.push({ method: member.name, expected: `${expected.instructions.length} instructions`, got: `${ours.length} instructions` });
    }
    for (let i = 0; i < Math.min(ours.length, expected.instructions.length); i++) {
      const instruction = ours[i];
      const row = expected.instructions[i];
      compared += 1;
      if (instruction.offset !== row.offset || instruction.mnemonic !== row.mnemonic) {
        mismatches.push({ method: member.name, expected: `${row.offset}: ${row.mnemonic}`, got: `${instruction.offset}: ${instruction.mnemonic}` });
        continue;
      }
      if (instruction.switchInfo !== null) {
        const expectedCases = new Map<CaseKey, number>();
        for (const [key, value] of row.cases ?? new Map<string, number>()) expectedCases.set(key === "default" ? "default" : Number(key), value);
        const gotCases = new Map<CaseKey, number>(instruction.switchInfo.targets);
        gotCases.set("default", instruction.switchInfo.default);
        if (!sameCases(expectedCases, gotCases)) {
          mismatches.push({ method: member.name, expected: pyCasesRepr(expectedCases), got: pyCasesRepr(gotCases) });
        }
        continue;
      }
      let oursOperand = instruction.text.slice(instruction.mnemonic.length).trim();
      let theirs = row.operand;
      if (theirs.startsWith("#")) {
        theirs = theirs.split(",")[0].trim();
        oursOperand = oursOperand.split(",")[0].trim();
      }
      if (oursOperand !== theirs) {
        mismatches.push({ method: member.name, expected: `${row.offset}: ${row.mnemonic} ${theirs}`, got: `${instruction.offset}: ${instruction.text}` });
      }
    }
  }
  return { compared, mismatches, agree: mismatches.length === 0 };
}

export function jvmStructure(instructions: JvmInstruction[]): JsonObject {
  const jumps = instructions.filter((i) => JVM_BRANCHES.has(i.opcode) || JVM_WIDE_BRANCHES.has(i.opcode)).length;
  const switches = instructions.filter((i) => i.switchInfo !== null).length;
  const returns = instructions.filter((i) => i.opcode >= 172 && i.opcode <= 177).length;
  return { instructions: instructions.length, jumps, switches, returns, structured: 0 };
}

export const WASM_MAGIC = Uint8Array.from([0x00, 0x61, 0x73, 0x6d]);
const WASM_SECTION_NAMES = new Map<number, string>([
  [0, "Custom"], [1, "Type"], [2, "Import"], [3, "Function"], [4, "Table"], [5, "Memory"], [6, "Global"], [7, "Export"],
  [8, "Start"], [9, "Elem"], [10, "Code"], [11, "Data"], [12, "DataCount"], [13, "Tag"],
]);
const WASM_SECTION_ORDER = [1, 2, 3, 4, 5, 13, 6, 7, 8, 9, 12, 10, 11];
const WASM_VALTYPES = new Map<number, string>([[0x7f, "i32"], [0x7e, "i64"], [0x7d, "f32"], [0x7c, "f64"], [0x7b, "v128"], [0x70, "funcref"], [0x6f, "externref"]]);
const WASM_EXPORT_KINDS = new Map<number, string>([[0, "func"], [1, "table"], [2, "memory"], [3, "global"], [4, "tag"]]);
const WASM_CONTROL = new Map<number, string>([
  [0x00, "unreachable"], [0x01, "nop"], [0x02, "block"], [0x03, "loop"], [0x04, "if"], [0x05, "else"], [0x0b, "end"],
  [0x0c, "br"], [0x0d, "br_if"], [0x0e, "br_table"], [0x0f, "return"], [0x10, "call"], [0x11, "call_indirect"],
]);
const WASM_PARAMETRIC = new Map<number, string>([[0x1a, "drop"], [0x1b, "select"], [0x1c, "select"]]);
const WASM_VARIABLE = new Map<number, string>([[0x20, "local.get"], [0x21, "local.set"], [0x22, "local.tee"], [0x23, "global.get"], [0x24, "global.set"], [0x25, "table.get"], [0x26, "table.set"]]);
const WASM_MEMORY = new Map<number, string>([
  [0x28, "i32.load"], [0x29, "i64.load"], [0x2A, "f32.load"], [0x2B, "f64.load"], [0x2C, "i32.load8_s"], [0x2D, "i32.load8_u"],
  [0x2E, "i32.load16_s"], [0x2F, "i32.load16_u"], [0x30, "i64.load8_s"], [0x31, "i64.load8_u"], [0x32, "i64.load16_s"], [0x33, "i64.load16_u"],
  [0x34, "i64.load32_s"], [0x35, "i64.load32_u"], [0x36, "i32.store"], [0x37, "i64.store"], [0x38, "f32.store"], [0x39, "f64.store"],
  [0x3A, "i32.store8"], [0x3B, "i32.store16"], [0x3C, "i64.store8"], [0x3D, "i64.store16"], [0x3E, "i64.store32"],
]);
const WASM_CONSTANTS = new Map<number, string>([[0x41, "i32.const"], [0x42, "i64.const"], [0x43, "f32.const"], [0x44, "f64.const"]]);
const WASM_NUMERIC = new Map<number, string>(
  (
    "i32.eqz i32.eq i32.ne i32.lt_s i32.lt_u i32.gt_s i32.gt_u i32.le_s i32.le_u i32.ge_s i32.ge_u " +
    "i64.eqz i64.eq i64.ne i64.lt_s i64.lt_u i64.gt_s i64.gt_u i64.le_s i64.le_u i64.ge_s i64.ge_u " +
    "f32.eq f32.ne f32.lt f32.gt f32.le f32.ge f64.eq f64.ne f64.lt f64.gt f64.le f64.ge " +
    "i32.clz i32.ctz i32.popcnt i32.add i32.sub i32.mul i32.div_s i32.div_u i32.rem_s i32.rem_u i32.and i32.or i32.xor i32.shl i32.shr_s i32.shr_u i32.rotl i32.rotr " +
    "i64.clz i64.ctz i64.popcnt i64.add i64.sub i64.mul i64.div_s i64.div_u i64.rem_s i64.rem_u i64.and i64.or i64.xor i64.shl i64.shr_s i64.shr_u i64.rotl i64.rotr " +
    "f32.abs f32.neg f32.ceil f32.floor f32.trunc f32.nearest f32.sqrt f32.add f32.sub f32.mul f32.div f32.min f32.max f32.copysign " +
    "f64.abs f64.neg f64.ceil f64.floor f64.trunc f64.nearest f64.sqrt f64.add f64.sub f64.mul f64.div f64.min f64.max f64.copysign " +
    "i32.wrap_i64 i32.trunc_f32_s i32.trunc_f32_u i32.trunc_f64_s i32.trunc_f64_u i64.extend_i32_s i64.extend_i32_u i64.trunc_f32_s i64.trunc_f32_u " +
    "i64.trunc_f64_s i64.trunc_f64_u f32.convert_i32_s f32.convert_i32_u f32.convert_i64_s f32.convert_i64_u f32.demote_f64 f64.convert_i32_s " +
    "f64.convert_i32_u f64.convert_i64_s f64.convert_i64_u f64.promote_f32 i32.reinterpret_f32 i64.reinterpret_f64 f32.reinterpret_i32 f64.reinterpret_i64 " +
    "i32.extend8_s i32.extend16_s i64.extend8_s i64.extend16_s i64.extend32_s"
  )
    .split(" ")
    .map((name, i): [number, string] => [0x45 + i, name]),
);
const WASM_REFERENCE = new Map<number, string>([[0xd0, "ref.null"], [0xd1, "ref.is_null"], [0xd2, "ref.func"]]);

export class WasmSection {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly start: number,
    readonly end: number,
    readonly payloadStart: number,
    readonly customName: string | null = null,
  ) {}

  get size(): number {
    return this.end - this.payloadStart;
  }
}

export class FuncType {
  constructor(readonly params: string[], readonly results: string[]) {}

  render(): string {
    const params = this.params.join(", ");
    const results = this.results.length ? this.results.join(", ") : "nil";
    return `(${params}) -> ${results}`;
  }
}

type WasmOperand = number | string | PyFloat;

function operandText(operand: WasmOperand): string {
  return operand instanceof PyFloat ? pyFloatRepr(operand.value) : String(operand);
}

export class WasmInstruction {
  constructor(
    readonly offset: number,
    readonly raw: Uint8Array,
    readonly mnemonic: string,
    readonly operands: WasmOperand[],
    readonly text: string,
    readonly depth: number,
  ) {}
}

export class WasmFunction {
  constructor(
    readonly index: number,
    readonly typeIndex: number,
    readonly bodyStart: number,
    readonly bodyEnd: number,
    readonly locals: [number, string][],
    readonly codeStart: number,
    readonly instructions: WasmInstruction[],
  ) {}

  get bodySize(): number {
    return this.bodyEnd - this.bodyStart;
  }
}

interface Limits {
  min: number;
  max: number | null;
}

interface WasmExport {
  name: string;
  kind: string;
  index: number;
}

interface DataSegment {
  memory: number;
  passive: boolean;
  offset: number | null;
  bytes: Uint8Array;
}

type WasmNameEntry = string | string[] | number[] | Map<number, string> | Map<number, Map<number, string>>;

export class WasmModule {
  data: Uint8Array;
  version: number;
  sections: WasmSection[] = [];
  types: FuncType[] = [];
  imports: JsonObject[] = [];
  functionTypes: number[] = [];
  memories: Limits[] = [];
  exports: WasmExport[] = [];
  functions: WasmFunction[] = [];
  dataSegments: DataSegment[] = [];
  names = new Map<string, WasmNameEntry>();
  startFunction: number | null = null;

  constructor(data: Uint8Array) {
    this.data = data;
    if (data.length < 4 || !WASM_MAGIC.every((byte, i) => data[i] === byte)) throw new FormatError("module does not start with \\0asm");
    this.version = data.length >= 8 ? view(data).getUint32(4, true) : 0;
    if (this.version !== 1) throw new FormatError(`binary version ${this.version} is not 1`);
    this.readSections();
  }

  private readSections(): void {
    const reader = new Reader(this.data, 8);
    let lastPosition = -1;
    while (!reader.atEnd()) {
      const start = reader.position;
      const sectionId = reader.u8();
      const size = reader.uleb();
      const payloadStart = reader.position;
      const end = payloadStart + size;
      if (end > this.data.length) throw new FormatError(`section ${sectionId} claims ${size} bytes past the end of the file`);
      let customName: string | null = null;
      if (sectionId === 0) {
        const nameReader = new Reader(this.data, payloadStart, end);
        customName = decodeUtf8(nameReader.take(nameReader.uleb()));
        this.readCustom(customName, new Reader(this.data, nameReader.position, end));
      } else {
        const position = WASM_SECTION_ORDER.indexOf(sectionId);
        if (position < 0) throw new FormatError(`section id ${sectionId} is not known`);
        if (position <= lastPosition) throw new FormatError(`section id ${sectionId} out of order after ${WASM_SECTION_ORDER.at(lastPosition)}`);
        lastPosition = position;
        this.readKnown(sectionId, new Reader(this.data, payloadStart, end));
      }
      this.sections.push(new WasmSection(sectionId, WASM_SECTION_NAMES.get(sectionId) ?? `id${sectionId}`, start, end, payloadStart, customName));
      reader.position = end;
    }
  }

  private valtype(reader: Reader): string {
    const byte = reader.u8();
    const name = WASM_VALTYPES.get(byte);
    if (name === undefined) throw new FormatError(`value type byte 0x${hex2(byte)} is not known`);
    return name;
  }

  private limits(reader: Reader): Limits {
    const flag = reader.u8();
    const minimum = reader.uleb();
    const maximum = flag & 1 ? reader.uleb() : null;
    return { min: minimum, max: maximum };
  }

  private readKnown(sectionId: number, reader: Reader): void {
    if (sectionId === 1) {
      for (let i = 0, count = reader.uleb(); i < count; i++) {
        if (reader.u8() !== 0x60) throw new FormatError("function type does not start with 0x60");
        const params: string[] = [];
        for (let p = 0, n = reader.uleb(); p < n; p++) params.push(this.valtype(reader));
        const results: string[] = [];
        for (let r = 0, n = reader.uleb(); r < n; r++) results.push(this.valtype(reader));
        this.types.push(new FuncType(params, results));
      }
    } else if (sectionId === 2) {
      for (let i = 0, count = reader.uleb(); i < count; i++) {
        const module = decodeUtf8(reader.take(reader.uleb()));
        const name = decodeUtf8(reader.take(reader.uleb()));
        const kind = reader.u8();
        const entry: JsonObject = { module, name, kind: WASM_EXPORT_KINDS.get(kind) ?? String(kind) };
        if (kind === 0) entry["type"] = reader.uleb();
        else if (kind === 1) {
          entry["reftype"] = this.valtype(reader);
          entry["limits"] = { ...this.limits(reader) };
        } else if (kind === 2) entry["limits"] = { ...this.limits(reader) };
        else if (kind === 3) {
          entry["valtype"] = this.valtype(reader);
          entry["mutable"] = Boolean(reader.u8());
        }
        this.imports.push(entry);
      }
    } else if (sectionId === 3) {
      this.functionTypes = [];
      for (let i = 0, count = reader.uleb(); i < count; i++) this.functionTypes.push(reader.uleb());
    } else if (sectionId === 5) {
      this.memories = [];
      for (let i = 0, count = reader.uleb(); i < count; i++) this.memories.push(this.limits(reader));
    } else if (sectionId === 7) {
      for (let i = 0, count = reader.uleb(); i < count; i++) {
        const name = decodeUtf8(reader.take(reader.uleb()));
        const kind = reader.u8();
        this.exports.push({ name, kind: WASM_EXPORT_KINDS.get(kind) ?? String(kind), index: reader.uleb() });
      }
    } else if (sectionId === 8) {
      this.startFunction = reader.uleb();
    } else if (sectionId === 10) {
      const imported = this.imports.filter((i) => i["kind"] === "func").length;
      for (let position = 0, count = reader.uleb(); position < count; position++) {
        const size = reader.uleb();
        const bodyStart = reader.position;
        const bodyEnd = bodyStart + size;
        const body = new Reader(this.data, bodyStart, bodyEnd);
        const locals: [number, string][] = [];
        for (let i = 0, groups = body.uleb(); i < groups; i++) {
          const localCount = body.uleb();
          locals.push([localCount, this.valtype(body)]);
        }
        const codeStart = body.position;
        const instructions = disassembleWasm(this.data, codeStart, bodyEnd);
        this.functions.push(new WasmFunction(imported + position, this.functionTypes[position], bodyStart, bodyEnd, locals, codeStart, instructions));
        reader.position = bodyEnd;
      }
    } else if (sectionId === 11) {
      for (let i = 0, count = reader.uleb(); i < count; i++) {
        const flag = reader.uleb();
        const memoryIndex = flag === 2 ? reader.uleb() : 0;
        let offset: number | null = null;
        if (flag === 0 || flag === 2) {
          const offsetInstructions = disassembleWasm(this.data, reader.position, reader.end);
          const last = offsetInstructions.at(-1);
          if (last === undefined || last.mnemonic !== "end") throw new FormatError("data segment offset expression has no end");
          const first = offsetInstructions[0];
          if (first.mnemonic === "i32.const" && typeof first.operands[0] === "number") offset = first.operands[0];
          reader.position = last.offset + 1;
        }
        const payload = reader.take(reader.uleb());
        this.dataSegments.push({ memory: memoryIndex, passive: flag === 1, offset, bytes: payload });
      }
    } else if ([4, 6, 9, 12, 13].includes(sectionId)) {
      reader.position = reader.end;
    }
  }

  private readCustom(name: string, reader: Reader): void {
    if (name !== "name") {
      const other = this.names.get("other");
      if (Array.isArray(other)) (other as string[]).push(name);
      else this.names.set("other", [name]);
      return;
    }
    while (!reader.atEnd()) {
      const subsection = reader.u8();
      const size = reader.uleb();
      const sub = new Reader(this.data, reader.position, reader.position + size);
      if (subsection === 0) {
        this.names.set("module", decodeUtf8(sub.take(sub.uleb())));
      } else if (subsection === 1) {
        const functions = new Map<number, string>();
        for (let i = 0, count = sub.uleb(); i < count; i++) {
          const index = sub.uleb();
          functions.set(index, decodeUtf8(sub.take(sub.uleb())));
        }
        this.names.set("functions", functions);
      } else if (subsection === 2) {
        const localsMap = new Map<number, Map<number, string>>();
        for (let i = 0, count = sub.uleb(); i < count; i++) {
          const functionIndex = sub.uleb();
          const names = new Map<number, string>();
          for (let j = 0, n = sub.uleb(); j < n; j++) {
            const index = sub.uleb();
            names.set(index, decodeUtf8(sub.take(sub.uleb())));
          }
          localsMap.set(functionIndex, names);
        }
        this.names.set("locals", localsMap);
      } else {
        const other = this.names.get("otherSubsections");
        if (Array.isArray(other)) (other as number[]).push(subsection);
        else this.names.set("otherSubsections", [subsection]);
      }
      reader.position = sub.end;
    }
  }

  functionNames(): Map<number, string> | null {
    const functions = this.names.get("functions");
    return functions instanceof Map ? (functions as Map<number, string>) : null;
  }

  localNames(): Map<number, Map<number, string>> {
    const locals = this.names.get("locals");
    return locals instanceof Map ? (locals as Map<number, Map<number, string>>) : new Map();
  }

  functionName(index: number): string | null {
    const named = this.functionNames();
    if (named !== null && named.has(index)) return named.get(index) ?? null;
    for (const entry of this.exports) {
      if (entry.kind === "func" && entry.index === index) return entry.name;
    }
    const imported = this.imports.filter((i) => i["kind"] === "func");
    if (index < imported.length) return `${imported[index]["module"]}.${imported[index]["name"]}`;
    return null;
  }

  function(name: string): WasmFunction {
    for (const fn of this.functions) if (this.functionName(fn.index) === name) return fn;
    throw new FormatError(`no function exported or named ${name}`);
  }

  signature(fn: WasmFunction): FuncType {
    return this.types[fn.typeIndex];
  }

  hasNameSection(): boolean {
    return this.sections.some((s) => s.id === 0 && s.customName === "name");
  }

  sectionLabel(section: WasmSection): string {
    return section.customName === null ? section.name : `Custom "${section.customName}"`;
  }

  namesJson(): Map<string, Json> {
    const out = new Map<string, Json>();
    for (const [key, value] of this.names) {
      if (value instanceof Map) {
        const converted = new Map<string, Json>();
        for (const [a, b] of value as Map<number, string | Map<number, string>>) converted.set(String(a), b);
        out.set(key, converted);
      } else {
        out.set(key, value);
      }
    }
    return out;
  }

  toDict(): JsonObject {
    return {
      fileBytes: this.data.length,
      version: this.version,
      sections: this.sections.map((s) => ({ id: s.id, name: this.sectionLabel(s), start: s.start, payloadStart: s.payloadStart, end: s.end, size: s.size })),
      types: this.types.map((t) => t.render()),
      imports: this.imports.map((i) => ({ ...i })),
      exports: this.exports.map((e) => ({ name: e.name, kind: e.kind, index: e.index })),
      memories: this.memories.map((m) => ({ min: m.min, max: m.max })),
      functions: this.functions.map((f) => ({
        index: f.index,
        name: this.functionName(f.index),
        type: this.signature(f).render(),
        locals: f.locals.map(([c, t]) => ({ count: c, type: t })),
        bodyBytes: f.bodySize,
        instructions: f.instructions.length,
      })),
      data: this.dataSegments.map((d) => ({ memory: d.memory, offset: d.offset, bytes: hexBytes(d.bytes), size: d.bytes.length })),
      nameSection: this.hasNameSection(),
      names: this.namesJson(),
    };
  }
}

export function loadWasm(name: string): WasmModule {
  return new WasmModule(readBytes(path.join(FIXTURES, "wasm", name)));
}

function blocktype(reader: Reader): string {
  const byte = reader.data[reader.position];
  if (byte === 0x40) {
    reader.u8();
    return "";
  }
  const name = WASM_VALTYPES.get(byte);
  if (name !== undefined) {
    reader.u8();
    return name;
  }
  return `type[${reader.sleb()}]`;
}

export function disassembleWasm(data: Uint8Array, start: number, end: number): WasmInstruction[] {
  const reader = new Reader(data, start, end);
  const instructions: WasmInstruction[] = [];
  let depth = 0;
  while (!reader.atEnd()) {
    const offset = reader.position;
    const opcode = reader.u8();
    let operands: WasmOperand[] = [];
    let shownDepth = depth;
    let mnemonic: string;
    const control = WASM_CONTROL.get(opcode);
    const parametric = WASM_PARAMETRIC.get(opcode);
    const variable = WASM_VARIABLE.get(opcode);
    const memory = WASM_MEMORY.get(opcode);
    const constant = WASM_CONSTANTS.get(opcode);
    const numeric = WASM_NUMERIC.get(opcode);
    const reference = WASM_REFERENCE.get(opcode);
    if (control !== undefined) {
      mnemonic = control;
      if (opcode === 0x02 || opcode === 0x03 || opcode === 0x04) {
        operands = [blocktype(reader)];
        depth += 1;
      } else if (opcode === 0x05) {
        shownDepth = depth - 1;
      } else if (opcode === 0x0b) {
        depth -= 1;
        shownDepth = Math.max(depth, 0);
      } else if (opcode === 0x0c || opcode === 0x0d || opcode === 0x10) {
        operands = [reader.uleb()];
      } else if (opcode === 0x0e) {
        const labels: number[] = [];
        for (let i = 0, count = reader.uleb(); i < count; i++) labels.push(reader.uleb());
        operands = [...labels, reader.uleb()];
      } else if (opcode === 0x11) {
        const typeIndex = reader.uleb();
        operands = [typeIndex, reader.uleb()];
      }
    } else if (parametric !== undefined) {
      mnemonic = parametric;
      if (opcode === 0x1c) {
        operands = [];
        for (let i = 0, count = reader.uleb(); i < count; i++) operands.push(WASM_VALTYPES.get(reader.u8()) ?? "?");
      }
    } else if (variable !== undefined) {
      mnemonic = variable;
      operands = [reader.uleb()];
    } else if (memory !== undefined) {
      mnemonic = memory;
      const align = reader.uleb();
      operands = [align, reader.uleb()];
    } else if (opcode === 0x3f || opcode === 0x40) {
      mnemonic = opcode === 0x3f ? "memory.size" : "memory.grow";
      operands = [reader.u8()];
    } else if (constant !== undefined) {
      mnemonic = constant;
      if (opcode === 0x41) operands = [reader.sleb()];
      else if (opcode === 0x42) operands = [reader.sleb()];
      else if (opcode === 0x43) operands = [new PyFloat(view(reader.take(4)).getFloat32(0, true))];
      else operands = [new PyFloat(view(reader.take(8)).getFloat64(0, true))];
    } else if (numeric !== undefined) {
      mnemonic = numeric;
    } else if (reference !== undefined) {
      mnemonic = reference;
      if (opcode !== 0xd1) operands = [reader.uleb()];
    } else {
      throw new FormatError(`opcode 0x${hex2(opcode)} at offset ${offset} is not in the single-byte table`);
    }
    const text = mnemonic + operands.filter((o) => o !== "").map((o) => ` ${operandText(o)}`).join("");
    instructions.push(new WasmInstruction(offset, data.subarray(offset, reader.position), mnemonic, operands, text, shownDepth));
    if (opcode === 0x0b && depth < 0) break;
  }
  return instructions;
}

export function wasmListing(module: WasmModule, name: string): ListingRow[] {
  const fn = module.function(name);
  const rows: ListingRow[] = [];
  for (const instruction of fn.instructions) {
    const row: ListingRow = { offset: instruction.offset, bytes: hexBytes(instruction.raw), text: instruction.text, depth: instruction.depth };
    if (instruction.mnemonic === "call") row.comment = module.functionName(Number(instruction.operands[0]));
    rows.push(row);
  }
  return rows;
}

const OBJDUMP_CODE_LINE = /^ ([0-9a-f]{6}): ((?:[0-9a-f]{2} )+)\s*\| ?(.*)$/;
const OBJDUMP_FUNCTION = /^([0-9a-f]{6}) func\[(\d+)\](?: <([^>]+)>)?:$/;
const OBJDUMP_SECTION = /^\s*(\w+) start=0x([0-9a-f]+) end=0x([0-9a-f]+) \(size=0x([0-9a-f]+)\)(?: count: (\d+))?(?: "[^"]*")?$/;

interface ObjdumpSection {
  name: string;
  start: number;
  end: number;
  size: number;
  count: number | null;
}

interface ObjdumpRow {
  offset: number;
  bytes: string;
  text: string;
}

interface ObjdumpFunction {
  offset: number;
  name: string | null;
  rows: ObjdumpRow[];
}

export function parseWasmObjdump(text: string): { sections: ObjdumpSection[]; functions: Map<number, ObjdumpFunction> } {
  const sections: ObjdumpSection[] = [];
  const functions = new Map<number, ObjdumpFunction>();
  let current: ObjdumpFunction | null = null;
  for (const line of splitlines(text)) {
    const section = OBJDUMP_SECTION.exec(line);
    if (section) {
      sections.push({
        name: section[1],
        start: parseInt(section[2], 16),
        end: parseInt(section[3], 16),
        size: parseInt(section[4], 16),
        count: section[5] === undefined ? null : Number(section[5]),
      });
      continue;
    }
    const header = OBJDUMP_FUNCTION.exec(line);
    if (header) {
      current = { offset: parseInt(header[1], 16), name: header[3] ?? null, rows: [] };
      functions.set(Number(header[2]), current);
      continue;
    }
    const row = OBJDUMP_CODE_LINE.exec(line);
    if (row && current !== null) {
      let textPart = row[3].trim();
      const byteText = row[2].trim();
      const previous = current.rows.at(-1);
      if (!textPart && previous !== undefined) {
        previous.bytes += " " + byteText;
        continue;
      }
      if (textPart.startsWith("local[")) continue;
      textPart = textPart.replace(/ <[^>]*>$/, "");
      current.rows.push({ offset: parseInt(row[1], 16), bytes: byteText, text: textPart });
    }
  }
  return { sections, functions };
}

function sameTuples(a: (string | number)[][], b: (string | number)[][]): boolean {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length && row.every((cell, j) => cell === b[i][j]));
}

export function compareWithWasmObjdump(module: WasmModule, objdumpText: string): { compared: number; mismatches: JsonObject[]; agree: boolean } {
  const expected = parseWasmObjdump(objdumpText);
  const mismatches: JsonObject[] = [];
  let compared = 0;
  const oursSections = module.sections.map((s): (string | number)[] => [s.name, s.payloadStart, s.end]);
  const theirsSections = expected.sections.map((s): (string | number)[] => [s.name, s.start, s.end]);
  if (!sameTuples(oursSections, theirsSections)) mismatches.push({ where: "sections", expected: theirsSections, got: oursSections });
  for (const fn of module.functions) {
    const rows = expected.functions.get(fn.index);
    if (rows === undefined) {
      mismatches.push({ where: `func[${fn.index}]`, expected: "a listing", got: "none" });
      continue;
    }
    if (rows.rows.length !== fn.instructions.length) {
      mismatches.push({ where: `func[${fn.index}]`, expected: `${rows.rows.length} instructions`, got: `${fn.instructions.length}` });
    }
    for (let i = 0; i < Math.min(fn.instructions.length, rows.rows.length); i++) {
      const instruction = fn.instructions[i];
      const row = rows.rows[i];
      compared += 1;
      const ours: (string | number)[] = [instruction.offset, hexBytes(instruction.raw), instruction.text];
      const theirs: (string | number)[] = [row.offset, row.bytes, row.text];
      if (!sameTuples([ours], [theirs])) mismatches.push({ where: `func[${fn.index}]`, expected: theirs, got: ours });
    }
  }
  return { compared, mismatches, agree: mismatches.length === 0 };
}

export function wasmStructure(instructions: WasmInstruction[]): JsonObject {
  const structured = instructions.filter((i) => ["block", "loop", "if"].includes(i.mnemonic)).length;
  const branches = instructions.filter((i) => ["br", "br_if", "br_table"].includes(i.mnemonic)).length;
  const tables = instructions.filter((i) => i.mnemonic === "br_table").length;
  return { instructions: instructions.length, structured, branches, tables, jumps: 0 };
}

export const METADATA_SIGNATURE = 0x424a5342;
const CLI_HEADER_DIRECTORY = 14;
const TABLE_NAMES = new Map<number, string>([
  [0x00, "Module"], [0x01, "TypeRef"], [0x02, "TypeDef"], [0x03, "FieldPtr"], [0x04, "Field"], [0x05, "MethodPtr"], [0x06, "MethodDef"],
  [0x07, "ParamPtr"], [0x08, "Param"], [0x09, "InterfaceImpl"], [0x0A, "MemberRef"], [0x0B, "Constant"], [0x0C, "CustomAttribute"],
  [0x0D, "FieldMarshal"], [0x0E, "DeclSecurity"], [0x0F, "ClassLayout"], [0x10, "FieldLayout"], [0x11, "StandAloneSig"], [0x12, "EventMap"],
  [0x13, "EventPtr"], [0x14, "Event"], [0x15, "PropertyMap"], [0x16, "PropertyPtr"], [0x17, "Property"], [0x18, "MethodSemantics"],
  [0x19, "MethodImpl"], [0x1A, "ModuleRef"], [0x1B, "TypeSpec"], [0x1C, "ImplMap"], [0x1D, "FieldRva"], [0x1E, "EncLog"], [0x1F, "EncMap"],
  [0x20, "Assembly"], [0x21, "AssemblyProcessor"], [0x22, "AssemblyOS"], [0x23, "AssemblyRef"], [0x24, "AssemblyRefProcessor"],
  [0x25, "AssemblyRefOS"], [0x26, "File"], [0x27, "ExportedType"], [0x28, "ManifestResource"], [0x29, "NestedClass"], [0x2A, "GenericParam"],
  [0x2B, "MethodSpec"], [0x2C, "GenericParamConstraint"],
]);
const CODED_INDEXES = new Map<string, [number, (number | null)[]]>([
  ["TypeDefOrRef", [2, [0x02, 0x01, 0x1B]]],
  ["HasConstant", [2, [0x04, 0x08, 0x17]]],
  ["HasCustomAttribute", [5, [0x06, 0x04, 0x01, 0x02, 0x08, 0x09, 0x0A, 0x00, 0x0E, 0x17, 0x14, 0x11, 0x1A, 0x1B, 0x20, 0x23, 0x26, 0x27, 0x28, 0x2A, 0x2C, 0x2B]]],
  ["HasFieldMarshal", [1, [0x04, 0x08]]],
  ["HasDeclSecurity", [2, [0x02, 0x06, 0x20]]],
  ["MemberRefParent", [3, [0x02, 0x01, 0x1A, 0x06, 0x1B]]],
  ["HasSemantics", [1, [0x14, 0x17]]],
  ["MethodDefOrRef", [1, [0x06, 0x0A]]],
  ["MemberForwarded", [1, [0x04, 0x06]]],
  ["Implementation", [2, [0x26, 0x23, 0x27]]],
  ["CustomAttributeType", [3, [null, null, 0x06, 0x0A, null]]],
  ["ResolutionScope", [2, [0x00, 0x1A, 0x23, 0x01]]],
  ["TypeOrMethodDef", [1, [0x02, 0x06]]],
]);
const TABLE_SCHEMAS = new Map<number, [string, string][]>([
  [0x00, [["Generation", "u2"], ["Name", "S"], ["Mvid", "G"], ["EncId", "G"], ["EncBaseId", "G"]]],
  [0x01, [["ResolutionScope", "C:ResolutionScope"], ["TypeName", "S"], ["TypeNamespace", "S"]]],
  [0x02, [["Flags", "u4"], ["TypeName", "S"], ["TypeNamespace", "S"], ["Extends", "C:TypeDefOrRef"], ["FieldList", "T:04"], ["MethodList", "T:06"]]],
  [0x03, [["Field", "T:04"]]],
  [0x04, [["Flags", "u2"], ["Name", "S"], ["Signature", "B"]]],
  [0x05, [["Method", "T:06"]]],
  [0x06, [["RVA", "u4"], ["ImplFlags", "u2"], ["Flags", "u2"], ["Name", "S"], ["Signature", "B"], ["ParamList", "T:08"]]],
  [0x07, [["Param", "T:08"]]],
  [0x08, [["Flags", "u2"], ["Sequence", "u2"], ["Name", "S"]]],
  [0x09, [["Class", "T:02"], ["Interface", "C:TypeDefOrRef"]]],
  [0x0A, [["Class", "C:MemberRefParent"], ["Name", "S"], ["Signature", "B"]]],
  [0x0B, [["Type", "u2"], ["Parent", "C:HasConstant"], ["Value", "B"]]],
  [0x0C, [["Parent", "C:HasCustomAttribute"], ["Type", "C:CustomAttributeType"], ["Value", "B"]]],
  [0x0D, [["Parent", "C:HasFieldMarshal"], ["NativeType", "B"]]],
  [0x0E, [["Action", "u2"], ["Parent", "C:HasDeclSecurity"], ["PermissionSet", "B"]]],
  [0x0F, [["PackingSize", "u2"], ["ClassSize", "u4"], ["Parent", "T:02"]]],
  [0x10, [["Offset", "u4"], ["Field", "T:04"]]],
  [0x11, [["Signature", "B"]]],
  [0x12, [["Parent", "T:02"], ["EventList", "T:14"]]],
  [0x13, [["Event", "T:14"]]],
  [0x14, [["EventFlags", "u2"], ["Name", "S"], ["EventType", "C:TypeDefOrRef"]]],
  [0x15, [["Parent", "T:02"], ["PropertyList", "T:17"]]],
  [0x16, [["Property", "T:17"]]],
  [0x17, [["Flags", "u2"], ["Name", "S"], ["Type", "B"]]],
  [0x18, [["Semantics", "u2"], ["Method", "T:06"], ["Association", "C:HasSemantics"]]],
  [0x19, [["Class", "T:02"], ["MethodBody", "C:MethodDefOrRef"], ["MethodDeclaration", "C:MethodDefOrRef"]]],
  [0x1A, [["Name", "S"]]],
  [0x1B, [["Signature", "B"]]],
  [0x1C, [["MappingFlags", "u2"], ["MemberForwarded", "C:MemberForwarded"], ["ImportName", "S"], ["ImportScope", "T:1A"]]],
  [0x1D, [["RVA", "u4"], ["Field", "T:04"]]],
  [0x1E, [["Token", "u4"], ["FuncCode", "u4"]]],
  [0x1F, [["Token", "u4"]]],
  [0x20, [["HashAlgId", "u4"], ["MajorVersion", "u2"], ["MinorVersion", "u2"], ["BuildNumber", "u2"], ["RevisionNumber", "u2"], ["Flags", "u4"], ["PublicKey", "B"], ["Name", "S"], ["Culture", "S"]]],
  [0x21, [["Processor", "u4"]]],
  [0x22, [["OSPlatformId", "u4"], ["OSMajorVersion", "u4"], ["OSMinorVersion", "u4"]]],
  [0x23, [["MajorVersion", "u2"], ["MinorVersion", "u2"], ["BuildNumber", "u2"], ["RevisionNumber", "u2"], ["Flags", "u4"], ["PublicKeyOrToken", "B"], ["Name", "S"], ["Culture", "S"], ["HashValue", "B"]]],
  [0x24, [["Processor", "u4"], ["AssemblyRef", "T:23"]]],
  [0x25, [["OSPlatformId", "u4"], ["OSMajorVersion", "u4"], ["OSMinorVersion", "u4"], ["AssemblyRef", "T:23"]]],
  [0x26, [["Flags", "u4"], ["Name", "S"], ["HashValue", "B"]]],
  [0x27, [["Flags", "u4"], ["TypeDefId", "u4"], ["TypeName", "S"], ["TypeNamespace", "S"], ["Implementation", "C:Implementation"]]],
  [0x28, [["Offset", "u4"], ["Flags", "u4"], ["Name", "S"], ["Implementation", "C:Implementation"]]],
  [0x29, [["NestedClass", "T:02"], ["EnclosingClass", "T:02"]]],
  [0x2A, [["Number", "u2"], ["Flags", "u2"], ["Owner", "C:TypeOrMethodDef"], ["Name", "S"]]],
  [0x2B, [["Method", "C:MethodDefOrRef"], ["Instantiation", "B"]]],
  [0x2C, [["Owner", "T:2A"], ["Constraint", "C:TypeDefOrRef"]]],
]);
const CIL_ONE_BYTE = new Map<number, [string, string]>([
  [0x00, ["nop", ""]], [0x01, ["break", ""]], [0x02, ["ldarg.0", ""]], [0x03, ["ldarg.1", ""]], [0x04, ["ldarg.2", ""]], [0x05, ["ldarg.3", ""]],
  [0x06, ["ldloc.0", ""]], [0x07, ["ldloc.1", ""]], [0x08, ["ldloc.2", ""]], [0x09, ["ldloc.3", ""]], [0x0A, ["stloc.0", ""]],
  [0x0B, ["stloc.1", ""]], [0x0C, ["stloc.2", ""]], [0x0D, ["stloc.3", ""]], [0x0E, ["ldarg.s", "u8"]], [0x0F, ["ldarga.s", "u8"]],
  [0x10, ["starg.s", "u8"]], [0x11, ["ldloc.s", "u8"]], [0x12, ["ldloca.s", "u8"]], [0x13, ["stloc.s", "u8"]], [0x14, ["ldnull", ""]],
  [0x15, ["ldc.i4.m1", ""]], [0x16, ["ldc.i4.0", ""]], [0x17, ["ldc.i4.1", ""]], [0x18, ["ldc.i4.2", ""]], [0x19, ["ldc.i4.3", ""]],
  [0x1A, ["ldc.i4.4", ""]], [0x1B, ["ldc.i4.5", ""]], [0x1C, ["ldc.i4.6", ""]], [0x1D, ["ldc.i4.7", ""]], [0x1E, ["ldc.i4.8", ""]],
  [0x1F, ["ldc.i4.s", "i8"]], [0x20, ["ldc.i4", "i32"]], [0x21, ["ldc.i8", "i64"]], [0x22, ["ldc.r4", "f32"]], [0x23, ["ldc.r8", "f64"]],
  [0x25, ["dup", ""]], [0x26, ["pop", ""]], [0x27, ["jmp", "tok"]], [0x28, ["call", "tok"]], [0x29, ["calli", "tok"]], [0x2A, ["ret", ""]],
  [0x2B, ["br.s", "br8"]], [0x2C, ["brfalse.s", "br8"]], [0x2D, ["brtrue.s", "br8"]], [0x2E, ["beq.s", "br8"]], [0x2F, ["bge.s", "br8"]],
  [0x30, ["bgt.s", "br8"]], [0x31, ["ble.s", "br8"]], [0x32, ["blt.s", "br8"]], [0x33, ["bne.un.s", "br8"]], [0x34, ["bge.un.s", "br8"]],
  [0x35, ["bgt.un.s", "br8"]], [0x36, ["ble.un.s", "br8"]], [0x37, ["blt.un.s", "br8"]], [0x38, ["br", "br32"]], [0x39, ["brfalse", "br32"]],
  [0x3A, ["brtrue", "br32"]], [0x3B, ["beq", "br32"]], [0x3C, ["bge", "br32"]], [0x3D, ["bgt", "br32"]], [0x3E, ["ble", "br32"]],
  [0x3F, ["blt", "br32"]], [0x40, ["bne.un", "br32"]], [0x41, ["bge.un", "br32"]], [0x42, ["bgt.un", "br32"]], [0x43, ["ble.un", "br32"]],
  [0x44, ["blt.un", "br32"]], [0x45, ["switch", "switch"]], [0x46, ["ldind.i1", ""]], [0x47, ["ldind.u1", ""]], [0x48, ["ldind.i2", ""]],
  [0x49, ["ldind.u2", ""]], [0x4A, ["ldind.i4", ""]], [0x4B, ["ldind.u4", ""]], [0x4C, ["ldind.i8", ""]], [0x4D, ["ldind.i", ""]],
  [0x4E, ["ldind.r4", ""]], [0x4F, ["ldind.r8", ""]], [0x50, ["ldind.ref", ""]], [0x51, ["stind.ref", ""]], [0x52, ["stind.i1", ""]],
  [0x53, ["stind.i2", ""]], [0x54, ["stind.i4", ""]], [0x55, ["stind.i8", ""]], [0x56, ["stind.r4", ""]], [0x57, ["stind.r8", ""]],
  [0x58, ["add", ""]], [0x59, ["sub", ""]], [0x5A, ["mul", ""]], [0x5B, ["div", ""]], [0x5C, ["div.un", ""]], [0x5D, ["rem", ""]],
  [0x5E, ["rem.un", ""]], [0x5F, ["and", ""]], [0x60, ["or", ""]], [0x61, ["xor", ""]], [0x62, ["shl", ""]], [0x63, ["shr", ""]],
  [0x64, ["shr.un", ""]], [0x65, ["neg", ""]], [0x66, ["not", ""]], [0x67, ["conv.i1", ""]], [0x68, ["conv.i2", ""]], [0x69, ["conv.i4", ""]],
  [0x6A, ["conv.i8", ""]], [0x6B, ["conv.r4", ""]], [0x6C, ["conv.r8", ""]], [0x6D, ["conv.u4", ""]], [0x6E, ["conv.u8", ""]],
  [0x6F, ["callvirt", "tok"]], [0x70, ["cpobj", "tok"]], [0x71, ["ldobj", "tok"]], [0x72, ["ldstr", "tok"]], [0x73, ["newobj", "tok"]],
  [0x74, ["castclass", "tok"]], [0x75, ["isinst", "tok"]], [0x76, ["conv.r.un", ""]], [0x79, ["unbox", "tok"]], [0x7A, ["throw", ""]],
  [0x7B, ["ldfld", "tok"]], [0x7C, ["ldflda", "tok"]], [0x7D, ["stfld", "tok"]], [0x7E, ["ldsfld", "tok"]], [0x7F, ["ldsflda", "tok"]],
  [0x80, ["stsfld", "tok"]], [0x81, ["stobj", "tok"]], [0x82, ["conv.ovf.i1.un", ""]], [0x83, ["conv.ovf.i2.un", ""]],
  [0x84, ["conv.ovf.i4.un", ""]], [0x85, ["conv.ovf.i8.un", ""]], [0x86, ["conv.ovf.u1.un", ""]], [0x87, ["conv.ovf.u2.un", ""]],
  [0x88, ["conv.ovf.u4.un", ""]], [0x89, ["conv.ovf.u8.un", ""]], [0x8A, ["conv.ovf.i.un", ""]], [0x8B, ["conv.ovf.u.un", ""]],
  [0x8C, ["box", "tok"]], [0x8D, ["newarr", "tok"]], [0x8E, ["ldlen", ""]], [0x8F, ["ldelema", "tok"]], [0x90, ["ldelem.i1", ""]],
  [0x91, ["ldelem.u1", ""]], [0x92, ["ldelem.i2", ""]], [0x93, ["ldelem.u2", ""]], [0x94, ["ldelem.i4", ""]], [0x95, ["ldelem.u4", ""]],
  [0x96, ["ldelem.i8", ""]], [0x97, ["ldelem.i", ""]], [0x98, ["ldelem.r4", ""]], [0x99, ["ldelem.r8", ""]], [0x9A, ["ldelem.ref", ""]],
  [0x9B, ["stelem.i", ""]], [0x9C, ["stelem.i1", ""]], [0x9D, ["stelem.i2", ""]], [0x9E, ["stelem.i4", ""]], [0x9F, ["stelem.i8", ""]],
  [0xA0, ["stelem.r4", ""]], [0xA1, ["stelem.r8", ""]], [0xA2, ["stelem.ref", ""]], [0xA3, ["ldelem", "tok"]], [0xA4, ["stelem", "tok"]],
  [0xA5, ["unbox.any", "tok"]], [0xB3, ["conv.ovf.i1", ""]], [0xB4, ["conv.ovf.u1", ""]], [0xB5, ["conv.ovf.i2", ""]], [0xB6, ["conv.ovf.u2", ""]],
  [0xB7, ["conv.ovf.i4", ""]], [0xB8, ["conv.ovf.u4", ""]], [0xB9, ["conv.ovf.i8", ""]], [0xBA, ["conv.ovf.u8", ""]], [0xC2, ["refanyval", "tok"]],
  [0xC3, ["ckfinite", ""]], [0xC6, ["mkrefany", "tok"]], [0xD0, ["ldtoken", "tok"]], [0xD1, ["conv.u2", ""]], [0xD2, ["conv.u1", ""]],
  [0xD3, ["conv.i", ""]], [0xD4, ["conv.ovf.i", ""]], [0xD5, ["conv.ovf.u", ""]], [0xD6, ["add.ovf", ""]], [0xD7, ["add.ovf.un", ""]],
  [0xD8, ["mul.ovf", ""]], [0xD9, ["mul.ovf.un", ""]], [0xDA, ["sub.ovf", ""]], [0xDB, ["sub.ovf.un", ""]], [0xDC, ["endfinally", ""]],
  [0xDD, ["leave", "br32"]], [0xDE, ["leave.s", "br8"]], [0xDF, ["stind.i", ""]], [0xE0, ["conv.u", ""]],
]);
const CIL_TWO_BYTE = new Map<number, [string, string]>([
  [0x00, ["arglist", ""]], [0x01, ["ceq", ""]], [0x02, ["cgt", ""]], [0x03, ["cgt.un", ""]], [0x04, ["clt", ""]], [0x05, ["clt.un", ""]],
  [0x06, ["ldftn", "tok"]], [0x07, ["ldvirtftn", "tok"]], [0x09, ["ldarg", "u16"]], [0x0A, ["ldarga", "u16"]], [0x0B, ["starg", "u16"]],
  [0x0C, ["ldloc", "u16"]], [0x0D, ["ldloca", "u16"]], [0x0E, ["stloc", "u16"]], [0x0F, ["localloc", ""]], [0x11, ["endfilter", ""]],
  [0x12, ["unaligned.", "i8"]], [0x13, ["volatile.", ""]], [0x14, ["tail.", ""]], [0x15, ["initobj", "tok"]], [0x16, ["constrained.", "tok"]],
  [0x17, ["cpblk", ""]], [0x18, ["initblk", ""]], [0x19, ["no.", "i8"]], [0x1A, ["rethrow", ""]], [0x1C, ["sizeof", "tok"]],
  [0x1D, ["refanytype", ""]], [0x1E, ["readonly.", ""]],
]);
const CIL_OPERAND_TYPE_NAMES = new Map<string, string>([
  ["", "InlineNone"], ["i8", "ShortInlineI"], ["u8", "ShortInlineVar"], ["br8", "ShortInlineBrTarget"], ["i32", "InlineI"], ["i64", "InlineI8"],
  ["f32", "ShortInlineR"], ["f64", "InlineR"], ["br32", "InlineBrTarget"], ["switch", "InlineSwitch"], ["u16", "InlineVar"],
]);
const CIL_TOKEN_OPERAND_TYPES = new Set<string>(["InlineMethod", "InlineField", "InlineType", "InlineTok", "InlineString", "InlineSig"]);
const ELEMENT_TYPES = new Map<number, string>([
  [0x01, "void"], [0x02, "bool"], [0x03, "char"], [0x04, "int8"], [0x05, "uint8"], [0x06, "int16"], [0x07, "uint16"], [0x08, "int32"],
  [0x09, "uint32"], [0x0a, "int64"], [0x0b, "uint64"], [0x0c, "float32"], [0x0d, "float64"], [0x0e, "string"], [0x1c, "object"],
  [0x18, "native int"], [0x19, "native uint"],
]);

export class PeSection {
  constructor(
    readonly name: string,
    readonly virtualSize: number,
    readonly virtualAddress: number,
    readonly rawSize: number,
    readonly rawPointer: number,
  ) {}

  contains(rva: number): boolean {
    return this.virtualAddress <= rva && rva < this.virtualAddress + Math.max(this.virtualSize, this.rawSize);
  }
}

type CilOperand = number | bigint | PyFloat | number[] | null;

export class CilInstruction {
  constructor(
    readonly offset: number,
    readonly raw: Uint8Array,
    readonly mnemonic: string,
    readonly kind: string,
    readonly operand: CilOperand,
    readonly text: string,
    readonly targets: number[] = [],
  ) {}
}

export class MethodBody {
  constructor(
    readonly rva: number,
    readonly fileOffset: number,
    readonly fat: boolean,
    readonly flags: number,
    readonly maxStack: number,
    readonly codeSize: number,
    readonly localSignatureToken: number,
    readonly code: Uint8Array,
  ) {}

  get headerSize(): number {
    return this.fat ? 12 : 1;
  }

  get size(): number {
    return this.headerSize + this.codeSize;
  }

  get initLocals(): boolean {
    return Boolean(this.flags & 0x10);
  }
}

type CodedValue = [number | null, number];
type RowValue = number | string | Uint8Array | CodedValue;
type MetadataRow = Map<string, RowValue>;

function rowNumber(row: MetadataRow, key: string): number {
  const value = row.get(key);
  if (typeof value !== "number") throw new FormatError(`column ${key} is not an integer`);
  return value;
}

function rowString(row: MetadataRow, key: string): string {
  const value = row.get(key);
  if (typeof value !== "string") throw new FormatError(`column ${key} is not a string`);
  return value;
}

function rowBlob(row: MetadataRow, key: string): Uint8Array {
  const value = row.get(key);
  if (!(value instanceof Uint8Array)) throw new FormatError(`column ${key} is not a blob`);
  return value;
}

function rowCoded(row: MetadataRow, key: string): CodedValue {
  const value = row.get(key);
  if (!Array.isArray(value)) throw new FormatError(`column ${key} is not a coded index`);
  return value;
}

interface MethodDef {
  Name: string;
  RVA: number;
  ParamList: number;
  Signature: Uint8Array;
  token: number;
  params: string[];
  signatureText: string;
}

function fmtHex(value: number, width = 0): string {
  return value.toString(16).padStart(width, "0");
}

function compressedLength(reader: Reader): number {
  const first = reader.u8();
  if ((first & 0x80) === 0) return first;
  if ((first & 0xc0) === 0x80) return ((first & 0x3f) << 8) | reader.u8();
  return (first & 0x1f) * 2 ** 24 + (reader.u8() << 16) + (reader.u8() << 8) + reader.u8();
}

export class CliAssembly {
  data: Uint8Array;
  machine: number;
  pe32plus: boolean;
  cliHeaderRva: number;
  cliHeaderSize: number;
  sections: PeSection[] = [];
  cliHeaderCb = 0;
  runtimeMajor = 0;
  runtimeMinor = 0;
  metadataRva = 0;
  metadataSize = 0;
  cliFlags = 0;
  entryPointToken = 0;
  metadataOffset = 0;
  metadataMajor = 0;
  metadataMinor = 0;
  metadataVersion = "";
  streams = new Map<string, [number, number]>();
  stringsHeap = new Uint8Array(0);
  userStringsHeap = new Uint8Array(0);
  blobHeap = new Uint8Array(0);
  guidHeap = new Uint8Array(0);
  tablesMajor = 0;
  tablesMinor = 0;
  heapSizes = 0;
  sortedMask = 0n;
  rowCounts = new Map<number, number>();
  rowSizes = new Map<number, number>();
  tableOffsets = new Map<number, number>();
  columnLayouts = new Map<number, [string, string, number][]>();

  constructor(data: Uint8Array) {
    this.data = data;
    if (data[0] !== 0x4d || data[1] !== 0x5a) throw new FormatError("file does not start with MZ");
    const peOffset = view(data).getUint32(0x3c, true);
    if (!(data[peOffset] === 0x50 && data[peOffset + 1] === 0x45 && data[peOffset + 2] === 0 && data[peOffset + 3] === 0)) {
      throw new FormatError("PE signature missing");
    }
    const coff = new Reader(data, peOffset + 4);
    this.machine = coff.u16le();
    const sectionCount = coff.u16le();
    coff.take(12);
    const optionalSize = coff.u16le();
    coff.u16le();
    const optionalStart = coff.position;
    const optional = new Reader(data, optionalStart);
    const magic = optional.u16le();
    this.pe32plus = magic === 0x20b;
    if (magic !== 0x10b && magic !== 0x20b) throw new FormatError(`optional header magic 0x${fmtHex(magic, 4)} is not PE32 or PE32+`);
    const directoriesOffset = optionalStart + (this.pe32plus ? 112 : 96);
    const cliDirectory = new Reader(data, directoriesOffset + 8 * CLI_HEADER_DIRECTORY);
    this.cliHeaderRva = cliDirectory.u32le();
    this.cliHeaderSize = cliDirectory.u32le();
    const sectionsReader = new Reader(data, optionalStart + optionalSize);
    for (let i = 0; i < sectionCount; i++) {
      const rawName = sectionsReader.take(8);
      let nameEnd = rawName.length;
      while (nameEnd > 0 && rawName[nameEnd - 1] === 0) nameEnd--;
      const name = decodeAscii(rawName.subarray(0, nameEnd));
      const virtualSize = sectionsReader.u32le();
      const virtualAddress = sectionsReader.u32le();
      const rawSize = sectionsReader.u32le();
      const rawPointer = sectionsReader.u32le();
      sectionsReader.take(16);
      this.sections.push(new PeSection(name, virtualSize, virtualAddress, rawSize, rawPointer));
    }
    if (this.cliHeaderRva === 0) throw new FormatError("data directory 14 is empty, so this PE file carries no CLI header");
    this.readCliHeader();
    this.readMetadata();
  }

  rvaToOffset(rva: number): number {
    for (const section of this.sections) {
      if (section.contains(rva)) return rva - section.virtualAddress + section.rawPointer;
    }
    throw new FormatError(`RVA 0x${fmtHex(rva)} is in no section`);
  }

  private readCliHeader(): void {
    const reader = new Reader(this.data, this.rvaToOffset(this.cliHeaderRva));
    this.cliHeaderCb = reader.u32le();
    this.runtimeMajor = reader.u16le();
    this.runtimeMinor = reader.u16le();
    this.metadataRva = reader.u32le();
    this.metadataSize = reader.u32le();
    this.cliFlags = reader.u32le();
    this.entryPointToken = reader.u32le();
  }

  private readMetadata(): void {
    this.metadataOffset = this.rvaToOffset(this.metadataRva);
    const reader = new Reader(this.data, this.metadataOffset);
    if (reader.u32le() !== METADATA_SIGNATURE) throw new FormatError("metadata root signature is not BSJB");
    this.metadataMajor = reader.u16le();
    this.metadataMinor = reader.u16le();
    reader.u32le();
    const versionLength = reader.u32le();
    const versionBytes = reader.take(versionLength);
    let versionEnd = versionBytes.length;
    while (versionEnd > 0 && versionBytes[versionEnd - 1] === 0) versionEnd--;
    this.metadataVersion = decodeUtf8(versionBytes.subarray(0, versionEnd));
    reader.u16le();
    const streamCount = reader.u16le();
    for (let i = 0; i < streamCount; i++) {
      const offset = reader.u32le();
      const size = reader.u32le();
      const nameStart = reader.position;
      while (this.data[reader.position] !== 0) reader.position += 1;
      const name = decodeAscii(this.data.subarray(nameStart, reader.position));
      reader.position += 1;
      while ((reader.position - nameStart) % 4) reader.position += 1;
      this.streams.set(name, [offset, size]);
    }
    this.stringsHeap = this.streamBytes("#Strings");
    this.userStringsHeap = this.streamBytes("#US");
    this.blobHeap = this.streamBytes("#Blob");
    this.guidHeap = this.streamBytes("#GUID");
    this.readTables();
  }

  private streamBytes(name: string): Uint8Array {
    const stream = this.streams.get(name);
    if (stream === undefined) return new Uint8Array(0);
    const [offset, size] = stream;
    const start = this.metadataOffset + offset;
    return this.data.subarray(start, start + size);
  }

  private readTables(): void {
    const stream = this.streams.get("#~");
    if (stream === undefined) throw new FormatError("metadata has no #~ stream");
    const reader = new Reader(this.data, this.metadataOffset + stream[0]);
    reader.u32le();
    this.tablesMajor = reader.u8();
    this.tablesMinor = reader.u8();
    this.heapSizes = reader.u8();
    reader.u8();
    const valid = reader.u64le();
    this.sortedMask = reader.u64le();
    for (let table = 0; table < 64; table++) {
      if (valid & (1n << BigInt(table))) this.rowCounts.set(table, reader.u32le());
    }
    for (const table of [...this.rowCounts.keys()].sort((a, b) => a - b)) {
      const schema = TABLE_SCHEMAS.get(table);
      if (schema === undefined) throw new FormatError(`table 0x${fmtHex(table, 2)} is present but has no schema here`);
      const layout = schema.map(([name, kind]): [string, string, number] => [name, kind, this.columnSize(kind)]);
      this.columnLayouts.set(table, layout);
      this.rowSizes.set(table, layout.reduce((sum, [, , size]) => sum + size, 0));
      this.tableOffsets.set(table, reader.position - this.metadataOffset);
      reader.position += (this.rowSizes.get(table) ?? 0) * (this.rowCounts.get(table) ?? 0);
    }
  }

  private columnSize(kind: string): number {
    if (kind === "u2") return 2;
    if (kind === "u4") return 4;
    if (kind === "S") return this.heapSizes & 1 ? 4 : 2;
    if (kind === "G") return this.heapSizes & 2 ? 4 : 2;
    if (kind === "B") return this.heapSizes & 4 ? 4 : 2;
    if (kind.startsWith("T:")) return (this.rowCounts.get(parseInt(kind.slice(2), 16)) ?? 0) >= 1 << 16 ? 4 : 2;
    if (kind.startsWith("C:")) {
      const coded = CODED_INDEXES.get(kind.slice(2));
      if (coded === undefined) throw new FormatError(`column kind ${kind} is not known`);
      const [bits, tables] = coded;
      const largest = Math.max(...tables.filter((t): t is number => t !== null).map((t) => this.rowCounts.get(t) ?? 0));
      return largest >= 1 << (16 - bits) ? 4 : 2;
    }
    throw new FormatError(`column kind ${kind} is not known`);
  }

  row(table: number, number: number): MetadataRow {
    if (number < 1 || number > (this.rowCounts.get(table) ?? 0)) throw new FormatError(`row ${number} of table 0x${fmtHex(table, 2)} does not exist`);
    const start = this.metadataOffset + (this.tableOffsets.get(table) ?? 0) + (number - 1) * (this.rowSizes.get(table) ?? 0);
    const reader = new Reader(this.data, start);
    const values: MetadataRow = new Map();
    for (const [name, kind, size] of this.columnLayouts.get(table) ?? []) {
      const raw = size === 2 ? reader.u16le() : reader.u32le();
      if (kind === "S") values.set(name, this.string(raw));
      else if (kind === "B") values.set(name, this.blob(raw));
      else if (kind.startsWith("C:")) {
        const [bits, tables] = CODED_INDEXES.get(kind.slice(2)) ?? [0, []];
        const tag = raw & ((1 << bits) - 1);
        values.set(name, [tag < tables.length ? tables[tag] : null, raw >>> bits]);
      } else values.set(name, raw);
    }
    return values;
  }

  rows(table: number): MetadataRow[] {
    const found: MetadataRow[] = [];
    for (let number = 1; number <= (this.rowCounts.get(table) ?? 0); number++) found.push(this.row(table, number));
    return found;
  }

  string(index: number): string {
    const end = this.stringsHeap.indexOf(0, index);
    return decodeUtf8(this.stringsHeap.subarray(index, end >= 0 ? end : this.stringsHeap.length));
  }

  blob(index: number): Uint8Array {
    const reader = new Reader(this.blobHeap, index);
    return reader.take(compressedLength(reader));
  }

  userString(index: number): string {
    const reader = new Reader(this.userStringsHeap, index);
    const length = compressedLength(reader);
    const bytes = reader.take(length).subarray(0, length % 2 ? length - 1 : length);
    return new TextDecoder("utf-16le").decode(bytes);
  }

  typeDefs(): MetadataRow[] {
    return this.rows(0x02);
  }

  methodDefs(): MethodDef[] {
    const methods = this.rows(0x06);
    const params = this.rows(0x08);
    return methods.map((method, i) => {
      const number = i + 1;
      const paramList = rowNumber(method, "ParamList");
      const nextFirst = number < methods.length ? rowNumber(methods[number], "ParamList") : params.length + 1;
      const signature = rowBlob(method, "Signature");
      return {
        Name: rowString(method, "Name"),
        RVA: rowNumber(method, "RVA"),
        ParamList: paramList,
        Signature: signature,
        token: (0x06000000 | number) >>> 0,
        params: params.slice(paramList - 1, nextFirst - 1).map((p) => rowString(p, "Name")),
        signatureText: describeMethodSignature(signature),
      };
    });
  }

  method(name: string): MethodDef {
    for (const method of this.methodDefs()) if (method.Name === name) return method;
    throw new FormatError(`no MethodDef named ${name}`);
  }

  methodBody(rva: number): MethodBody {
    const offset = this.rvaToOffset(rva);
    const first = this.data[offset];
    if ((first & 3) === 2) {
      const size = first >> 2;
      return new MethodBody(rva, offset, false, 0, 8, size, 0, this.data.subarray(offset + 1, offset + 1 + size));
    }
    if ((first & 3) !== 3) throw new FormatError(`method header byte 0x${fmtHex(first, 2)} is neither tiny nor fat`);
    const reader = new Reader(this.data, offset);
    const flagsAndSize = reader.u16le();
    const flags = flagsAndSize & 0xfff;
    const headerDwords = flagsAndSize >> 12;
    const maxStack = reader.u16le();
    const codeSize = reader.u32le();
    const localToken = reader.u32le();
    const start = offset + headerDwords * 4;
    return new MethodBody(rva, offset, true, flags, maxStack, codeSize, localToken, this.data.subarray(start, start + codeSize));
  }

  tokenText(token: number): string {
    const table = token >>> 24;
    const index = token & 0xffffff;
    if (table === 0x70) return pyStrRepr(this.userString(index));
    if (table === 0x06) return rowString(this.row(0x06, index), "Name");
    if (table === 0x04) return rowString(this.row(0x04, index), "Name");
    if (table === 0x0a) {
      const member = this.row(0x0a, index);
      const [parentTable, parentIndex] = rowCoded(member, "Class");
      let owner = "";
      if (parentTable === 0x01) {
        const typeRef = this.row(0x01, parentIndex);
        owner = `${rowString(typeRef, "TypeNamespace")}.${rowString(typeRef, "TypeName")}`;
      } else if (parentTable === 0x02) {
        owner = rowString(this.row(0x02, parentIndex), "TypeName");
      }
      return `${owner}::${rowString(member, "Name")}`;
    }
    if (table === 0x01) {
      const typeRef = this.row(0x01, index);
      return `${rowString(typeRef, "TypeNamespace")}.${rowString(typeRef, "TypeName")}`;
    }
    if (table === 0x02) return rowString(this.row(0x02, index), "TypeName");
    if (table === 0x11) return "locals " + describeLocalsSignature(rowBlob(this.row(0x11, index), "Signature"));
    return `0x${fmtHex(token, 8)}`;
  }

  methodSummaries(): JsonObject[] {
    return this.methodDefs().map((method) => {
      const body = method.RVA ? this.methodBody(method.RVA) : null;
      return {
        token: `0x${fmtHex(method.token, 8)}`,
        name: method.Name,
        signature: method.signatureText,
        params: method.params,
        rva: `0x${fmtHex(method.RVA)}`,
        fatHeader: body === null ? null : body.fat,
        maxStack: body === null ? null : body.maxStack,
        codeBytes: body === null ? null : body.codeSize,
        initLocals: body === null ? null : body.initLocals,
        locals: body === null || !body.localSignatureToken ? null : describeLocalsSignature(rowBlob(this.row(0x11, body.localSignatureToken & 0xffffff), "Signature")),
        instructions: body === null ? null : disassembleCil(body.code).length,
      };
    });
  }

  cliHeaderJson(): JsonObject {
    return {
      rva: `0x${fmtHex(this.cliHeaderRva)}`,
      size: this.cliHeaderSize,
      runtime: `${this.runtimeMajor}.${this.runtimeMinor}`,
      flags: `0x${fmtHex(this.cliFlags)}`,
      entryPoint: `0x${fmtHex(this.entryPointToken, 8)}`,
    };
  }

  sortedTables(): number[] {
    return [...this.rowCounts.keys()].sort((a, b) => a - b);
  }

  toDict(): JsonObject {
    const streams: JsonObject = {};
    for (const [name, [offset, size]] of this.streams) streams[name] = { offset: `0x${fmtHex(offset)}`, size };
    const tables: JsonObject = {};
    for (const t of this.sortedTables()) {
      tables[TABLE_NAMES.get(t) ?? String(t)] = {
        id: `0x${fmtHex(t, 2)}`,
        rows: this.rowCounts.get(t) ?? 0,
        rowSize: this.rowSizes.get(t) ?? 0,
        offset: `0x${fmtHex(this.tableOffsets.get(t) ?? 0)}`,
      };
    }
    return {
      fileBytes: this.data.length,
      machine: `0x${fmtHex(this.machine, 4)}`,
      pe32plus: this.pe32plus,
      sections: this.sections.map((s) => ({
        name: s.name,
        virtualAddress: `0x${fmtHex(s.virtualAddress)}`,
        virtualSize: `0x${fmtHex(s.virtualSize)}`,
        rawPointer: `0x${fmtHex(s.rawPointer)}`,
        rawSize: `0x${fmtHex(s.rawSize)}`,
      })),
      cliHeader: this.cliHeaderJson(),
      metadata: { rva: `0x${fmtHex(this.metadataRva)}`, size: this.metadataSize, version: this.metadataVersion, streams, heapSizes: this.heapSizes },
      tables,
      typeDefs: this.typeDefs().map((t) => ({ name: rowString(t, "TypeName"), namespace: rowString(t, "TypeNamespace"), flags: `0x${fmtHex(rowNumber(t, "Flags"))}` })),
      fields: this.rows(0x04).map((f) => ({ name: rowString(f, "Name"), signature: hexBytes(rowBlob(f, "Signature")) })),
      methods: this.methodSummaries(),
      userStrings: this.userStringOffsets().map((i) => this.userString(i)),
    };
  }

  userStringOffsets(): number[] {
    const offsets: number[] = [];
    const heap = this.userStringsHeap;
    let position = 1;
    while (position < heap.length) {
      const first = heap[position];
      let length: number;
      let header: number;
      if ((first & 0x80) === 0) {
        length = first;
        header = 1;
      } else if ((first & 0xc0) === 0x80) {
        length = ((first & 0x3f) << 8) | (heap[position + 1] ?? 0);
        header = 2;
      } else {
        const word = heap.subarray(position, position + 4).reduce((value, byte) => value * 256 + byte, 0);
        length = word % 2 ** 29;
        header = 4;
      }
      if (length > 1) offsets.push(position);
      position += header + length;
    }
    return offsets;
  }
}

export function loadAssembly(name: string): CliAssembly {
  return new CliAssembly(readBytes(path.join(FIXTURES, "dotnet", name)));
}

function elementType(reader: Reader): string {
  const byte = reader.u8();
  const name = ELEMENT_TYPES.get(byte);
  if (name !== undefined) return name;
  if (byte === 0x1d) return elementType(reader) + "[]";
  if (byte === 0x12 || byte === 0x11) return (byte === 0x12 ? "class" : "valuetype") + ` 0x${fmtHex(reader.uleb())}`;
  return `type0x${fmtHex(byte, 2)}`;
}

export function describeMethodSignature(blob: Uint8Array): string {
  const reader = new Reader(blob);
  const convention = reader.u8();
  const count = reader.u8();
  const returns = elementType(reader);
  const params: string[] = [];
  for (let i = 0; i < count; i++) params.push(elementType(reader));
  const prefix = !(convention & 0x20) ? "static " : "instance ";
  return `${prefix}${returns}(${params.join(", ")})`;
}

export function describeLocalsSignature(blob: Uint8Array): string {
  const reader = new Reader(blob);
  if (reader.u8() !== 0x07) throw new FormatError("local signature does not start with LOCAL_SIG 0x07");
  const count = reader.u8();
  const types: string[] = [];
  for (let i = 0; i < count; i++) types.push(elementType(reader));
  return "(" + types.join(", ") + ")";
}

function cilOperandText(operand: CilOperand): string {
  if (operand instanceof PyFloat) return pyFloatRepr(operand.value);
  if (Array.isArray(operand)) return `(${operand.join(", ")})`;
  return operand === null ? "None" : operand.toString();
}

export function disassembleCil(code: Uint8Array, assembly: CliAssembly | null = null): CilInstruction[] {
  const reader = new Reader(code);
  const instructions: CilInstruction[] = [];
  while (!reader.atEnd()) {
    const offset = reader.position;
    const first = reader.u8();
    let entry: [string, string] | undefined;
    if (first === 0xfe) {
      const second = reader.u8();
      entry = CIL_TWO_BYTE.get(second);
      if (entry === undefined) throw new FormatError(`opcode fe ${fmtHex(second, 2)} at IL_${fmtHex(offset, 4)} is not defined`);
    } else {
      entry = CIL_ONE_BYTE.get(first);
      if (entry === undefined) throw new FormatError(`opcode ${fmtHex(first, 2)} at IL_${fmtHex(offset, 4)} is not defined`);
    }
    const [mnemonic, kind] = entry;
    let operand: CilOperand = null;
    let targets: number[] = [];
    if (kind === "i8") operand = view(reader.take(1)).getInt8(0);
    else if (kind === "u8") operand = reader.u8();
    else if (kind === "u16") operand = reader.u16le();
    else if (kind === "i32") operand = reader.i32le();
    else if (kind === "i64") operand = view(reader.take(8)).getBigInt64(0, true);
    else if (kind === "f32") operand = new PyFloat(view(reader.take(4)).getFloat32(0, true));
    else if (kind === "f64") operand = new PyFloat(view(reader.take(8)).getFloat64(0, true));
    else if (kind === "br8") {
      const next = reader.position + 1;
      const target = next + view(reader.take(1)).getInt8(0);
      operand = target;
      targets = [target];
    } else if (kind === "br32") {
      const next = reader.position + 4;
      const target = next + reader.i32le();
      operand = target;
      targets = [target];
    } else if (kind === "tok") operand = reader.u32le();
    else if (kind === "switch") {
      const count = reader.u32le();
      const base = reader.position + 4 * count;
      const table: number[] = [];
      for (let i = 0; i < count; i++) table.push(base + reader.i32le());
      operand = table;
      targets = table;
    }
    let text: string;
    if ((kind === "br8" || kind === "br32") && typeof operand === "number") text = `${mnemonic} IL_${fmtHex(operand, 4)}`;
    else if (kind === "switch" && Array.isArray(operand)) text = `${mnemonic} (${operand.map((t) => `IL_${fmtHex(t, 4)}`).join(", ")})`;
    else if (kind === "tok" && typeof operand === "number") text = `${mnemonic} ${assembly !== null ? assembly.tokenText(operand) : `0x${fmtHex(operand, 8)}`}`;
    else if (kind) text = `${mnemonic} ${cilOperandText(operand)}`;
    else text = mnemonic;
    instructions.push(new CilInstruction(offset, code.subarray(offset, reader.position), mnemonic, kind, operand, text, targets));
  }
  return instructions;
}

export function cilListing(assembly: CliAssembly, methodName: string): ListingRow[] {
  const method = assembly.method(methodName);
  const body = assembly.methodBody(method.RVA);
  return disassembleCil(body.code, assembly).map((i) => ({ offset: i.offset, bytes: hexBytes(i.raw), text: i.text }));
}

interface TableDump {
  id: number;
  rows: number;
  rowsize: number;
  offset: number;
}

interface MethodDump {
  token: number;
  rva: number;
  sig: string;
  params: string[];
}

interface BodyDump {
  size: number;
  maxstack: number;
  codesize: number;
  localsinit: boolean;
  localsig: number;
  locals: string;
}

interface OpcodeDump {
  name: string;
  operandType: string;
  size: number;
}

interface MetaDump {
  tables: Map<string, TableDump>;
  methods: Map<string, MethodDump>;
  bodies: Map<number, BodyDump>;
  il: Map<number, string>;
  opcodes: Map<number, OpcodeDump>;
  heaps: Map<string, { size: number; offset: number }>;
  typedefs: string[];
  params: Map<string, string>;
  info: Map<string, string>;
}

function keyValues(parts: string[], keep: (part: string) => boolean = () => true): Map<string, string> {
  const fields = new Map<string, string>();
  for (const part of parts) {
    if (!keep(part)) continue;
    const split = part.indexOf("=");
    if (split < 0) throw new FormatError(`metadump field ${part} has no '='`);
    fields.set(part.slice(0, split), part.slice(split + 1));
  }
  return fields;
}

function field(fields: Map<string, string>, key: string): string {
  const value = fields.get(key);
  if (value === undefined) throw new FormatError(`metadump line has no ${key}`);
  return value;
}

export function parseMetadump(text: string): MetaDump {
  const result: MetaDump = { tables: new Map(), methods: new Map(), bodies: new Map(), il: new Map(), opcodes: new Map(), heaps: new Map(), typedefs: [], params: new Map(), info: new Map() };
  for (const line of splitlines(text)) {
    const parts = splitWhitespace(line);
    if (!parts.length) continue;
    if (parts[0] === "table") {
      const fields = keyValues(parts.slice(2));
      result.tables.set(parts[1], {
        id: parseInt(field(fields, "id"), 16),
        rows: Number(field(fields, "rows")),
        rowsize: Number(field(fields, "rowsize")),
        offset: parseInt(field(fields, "offset"), 16),
      });
    } else if (parts[0] === "heap") {
      const fields = keyValues(parts.slice(2));
      result.heaps.set(parts[1], { size: Number(field(fields, "size")), offset: parseInt(field(fields, "offset"), 16) });
    } else if (parts[0] === "method") {
      const fields = keyValues(parts.slice(3), (p) => p.includes("=") && !p.startsWith("sig"));
      const sig = line.split("sig=")[1].split(" params=")[0];
      const params = line.split("params=[")[1].replace(/\]+$/, "");
      result.methods.set(parts[2], {
        token: parseInt(parts[1], 16),
        rva: parseInt(field(fields, "rva"), 16),
        sig,
        params: params.split(",").filter((p) => p).map((p) => p.slice(p.indexOf(":") + 1)),
      });
    } else if (parts[0] === "body") {
      const fields = keyValues(parts.slice(2), (p) => p.includes("="));
      result.bodies.set(parseInt(parts[1], 16), {
        size: Number(field(fields, "size")),
        maxstack: Number(field(fields, "maxstack")),
        codesize: Number(field(fields, "codesize")),
        localsinit: field(fields, "localsinit") === "True",
        localsig: parseInt(field(fields, "localsig"), 16),
        locals: line.split("locals=[")[1].split("]")[0],
      });
    } else if (parts[0] === "il") {
      result.il.set(parseInt(parts[1], 16), parts.slice(2).join(" "));
    } else if (parts[0] === "opcode") {
      result.opcodes.set(parseInt(parts[1], 16), { name: parts[2], operandType: parts[3], size: Number(parts[4].split("=")[1]) });
    } else if (parts[0] === "typedef") {
      result.typedefs.push(parts[2]);
    } else if (["version", "entrypoint", "metadata", "runtime", "flags"].includes(parts[0])) {
      result.info.set(parts[0], parts.slice(1).join(" "));
    }
  }
  return result;
}

function sameStrings(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

export function compareWithMetadump(assembly: CliAssembly, dumpText: string): { compared: number; mismatches: JsonObject[]; agree: boolean } {
  const expected = parseMetadump(dumpText);
  const mismatches: JsonObject[] = [];
  for (const [name, table] of expected.tables) {
    const ours = { id: table.id, rows: assembly.rowCounts.get(table.id) ?? null, rowsize: assembly.rowSizes.get(table.id) ?? null, offset: assembly.tableOffsets.get(table.id) ?? null };
    if (ours.rows !== table.rows || ours.rowsize !== table.rowsize || ours.offset !== table.offset) {
      mismatches.push({ where: `table ${name}`, expected: { ...table }, got: ours });
    }
  }
  for (const [name, method] of expected.methods) {
    const oursMethod = assembly.method(name);
    if (oursMethod.RVA !== method.rva || oursMethod.token !== method.token || !sameStrings(oursMethod.params, method.params) || hexBytes(oursMethod.Signature) !== method.sig) {
      mismatches.push({
        where: `method ${name}`,
        expected: { token: method.token, rva: method.rva, sig: method.sig, params: method.params },
        got: { rva: oursMethod.RVA, token: oursMethod.token, params: oursMethod.params, sig: hexBytes(oursMethod.Signature) },
      });
      continue;
    }
    const body = assembly.methodBody(oursMethod.RVA);
    const expectedBody = expected.bodies.get(method.token);
    if (expectedBody === undefined) throw new FormatError(`metadump has no body for token 0x${fmtHex(method.token, 8)}`);
    const oursBody = { size: body.size, maxstack: body.maxStack, codesize: body.codeSize, localsinit: body.initLocals, localsig: body.localSignatureToken };
    if (
      oursBody.size !== expectedBody.size ||
      oursBody.maxstack !== expectedBody.maxstack ||
      oursBody.codesize !== expectedBody.codesize ||
      oursBody.localsinit !== expectedBody.localsinit ||
      oursBody.localsig !== expectedBody.localsig
    ) {
      mismatches.push({ where: `body ${name}`, expected: { ...expectedBody }, got: oursBody });
    }
    const expectedIl = expected.il.get(method.token);
    if (hexBytes(body.code) !== expectedIl) mismatches.push({ where: `il ${name}`, expected: expectedIl ?? null, got: hexBytes(body.code) });
  }
  for (const [value, row] of expected.opcodes) {
    if (row.name.startsWith("prefix")) continue;
    const oursEntry = value > 0xff ? CIL_TWO_BYTE.get(value & 0xff) : CIL_ONE_BYTE.get(value);
    if (oursEntry === undefined) {
      mismatches.push({ where: `opcode 0x${fmtHex(value, 4)}`, expected: row.name, got: null });
      continue;
    }
    const operandOk = oursEntry[1] === "tok" ? CIL_TOKEN_OPERAND_TYPES.has(row.operandType) : CIL_OPERAND_TYPE_NAMES.get(oursEntry[1]) === row.operandType;
    if (oursEntry[0] !== row.name || !operandOk) mismatches.push({ where: `opcode 0x${fmtHex(value, 4)}`, expected: { ...row }, got: [...oursEntry] });
  }
  const compared = expected.tables.size + expected.methods.size + expected.opcodes.size;
  return { compared, mismatches, agree: mismatches.length === 0 };
}

export function cilStructure(instructions: CilInstruction[]): JsonObject {
  const jumps = instructions.filter((i) => i.kind === "br8" || i.kind === "br32").length;
  const switches = instructions.filter((i) => i.kind === "switch").length;
  const returns = instructions.filter((i) => i.mnemonic === "ret").length;
  return { instructions: instructions.length, jumps, switches, returns, structured: 0 };
}

export class NativeObject {
  sectionNames: string[];
  functions: [string, number, number][] = [];
  listing: string;
  fileSize: number;

  constructor(data: Uint8Array, listing: string) {
    if (!(data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46)) throw new FormatError("not an ELF file");
    const fields = view(data);
    const shoff = Number(fields.getBigUint64(0x28, true));
    const shentsize = fields.getUint16(0x3a, true);
    const shnum = fields.getUint16(0x3c, true);
    const shstrndx = fields.getUint16(0x3e, true);
    const headers: number[][] = [];
    for (let i = 0; i < shnum; i++) {
      const base = shoff + i * shentsize;
      headers.push([
        fields.getUint32(base, true),
        fields.getUint32(base + 4, true),
        Number(fields.getBigUint64(base + 8, true)),
        Number(fields.getBigUint64(base + 16, true)),
        Number(fields.getBigUint64(base + 24, true)),
        Number(fields.getBigUint64(base + 32, true)),
        fields.getUint32(base + 40, true),
        fields.getUint32(base + 44, true),
        Number(fields.getBigUint64(base + 48, true)),
        Number(fields.getBigUint64(base + 56, true)),
      ]);
    }
    const namesHeader = headers[shstrndx];
    const nameTable = data.subarray(namesHeader[4], namesHeader[4] + namesHeader[5]);
    this.sectionNames = headers.map((h) => cstring(nameTable, h[0]));
    for (const header of headers) {
      if (header[1] !== 2) continue;
      const stringsHeader = headers[header[6]];
      const strings = data.subarray(stringsHeader[4], stringsHeader[4] + stringsHeader[5]);
      for (let offset = 0; offset < header[5]; offset += 24) {
        const base = header[4] + offset;
        const stName = fields.getUint32(base, true);
        const stInfo = fields.getUint8(base + 4);
        const stValue = Number(fields.getBigUint64(base + 8, true));
        const stSize = Number(fields.getBigUint64(base + 16, true));
        if ((stInfo & 0xf) === 2) this.functions.push([cstring(strings, stName), stValue, stSize]);
      }
    }
    this.listing = listing;
    this.fileSize = data.length;
  }

  functionRows(name: string): ListingRow[] {
    const found = this.functions.find(([n]) => n === name);
    if (found === undefined) throw new FormatError(`no function symbol named ${name}`);
    const [, start, size] = found;
    const rows: ListingRow[] = [];
    for (const line of splitlines(this.listing)) {
      if (!line.includes(":") || !line.includes("\t")) continue;
      const tab = line.indexOf("\t");
      const head = line.slice(0, tab);
      const rest = line.slice(tab + 1);
      const trimmed = head.trim();
      const colon = trimmed.indexOf(":");
      const addressText = colon < 0 ? trimmed : trimmed.slice(0, colon);
      const byteText = colon < 0 ? "" : trimmed.slice(colon + 1);
      if (!addressText || ![...addressText].every((c) => "0123456789abcdef".includes(c))) continue;
      const address = parseInt(addressText, 16);
      if (start <= address && address < start + size) {
        rows.push({ offset: address, bytes: splitWhitespace(byteText).join(" "), text: splitWhitespace(rest.split("#")[0]).join(" ") });
      }
    }
    return rows;
  }

  hasDebugInfo(): boolean {
    return this.sectionNames.some((name) => name.startsWith(".debug_"));
  }
}

function cstring(table: Uint8Array, offset: number): string {
  const end = table.indexOf(0, offset);
  return decodeAscii(table.subarray(offset, end >= 0 ? end : table.length));
}

export function loadNative(): NativeObject {
  const folder = path.join(FIXTURES, "native");
  return new NativeObject(readBytes(path.join(folder, "ledger-x86_64-O0.o")), readFileSync(path.join(folder, "ledger-x86_64-O0.objdump.txt"), "utf8"));
}

export function nativeStructure(rows: ListingRow[]): JsonObject {
  const mnemonics = rows.filter((row) => row.text).map((row) => splitWhitespace(row.text)[0]);
  const jumps = mnemonics.filter((m) => m.startsWith("j") && m !== "jmpq").length;
  const indirect = mnemonics.filter((m) => m === "jmpq").length;
  return { instructions: rows.length, jumps, indirectJumps: indirect, returns: mnemonics.filter((m) => m === "retq").length, structured: 0 };
}

export const PYC_FIGURE_TAG = "cpython-314";

function requireFunction(pyc: PycFile, name: string): CodeObject {
  const code = pyc.functions().get(name);
  if (code === undefined) throw new FormatError(`no code object named ${name}`);
  return code;
}

function localTableRows(code: CodeAttribute): LocalVariableRow[] | null {
  const attribute = code.attribute("LocalVariableTable");
  return attribute === null ? null : (attribute.parsed as LocalVariableRow[]);
}

export function whatEachKeeps(): JsonObject {
  const native = loadNative();
  const nativeRows = native.functionRows("grade");
  const pyc = loadPyc(`ledger.${PYC_FIGURE_TAG}.pyc`);
  const gradeCode = requireFunction(pyc, "grade");
  const pycRows = listingRows(disFixtureListing(PYC_FIGURE_TAG, true), "grade");
  const classFile = loadClass("Ledger-g.class");
  const gradeMethod = classFile.method("grade");
  const gradeAttribute = requireCode(gradeMethod);
  const jvmRows = disassembleJvm(classFile, gradeAttribute.code);
  const localTable = localTableRows(gradeAttribute);
  const lineTable = gradeAttribute.attribute("LineNumberTable");
  const plain = loadWasm("ledger.wasm");
  const named = loadWasm("ledger-names.wasm");
  const wasmGrade = plain.function("grade");
  const wasmSignature = plain.signature(wasmGrade);
  const wasmLocalNames = [...(named.localNames().get(wasmGrade.index) ?? new Map<number, string>()).values()];
  const assembly = loadAssembly("LedgerNet.dll");
  const cilMethod = assembly.method("Grade");
  const cilBody = assembly.methodBody(cilMethod.RVA);
  const cilRows = disassembleCil(cilBody.code, assembly);
  const nativeGrade = native.functions.find(([n]) => n === "grade");
  const descriptor = gradeMethod.descriptor;
  return {
    native: {
      container: "ELF relocatable object, x86-64, clang -O0",
      functionName: "grade",
      functionNames: native.functions.map(([n]) => n),
      parameterNames: [],
      parameterTypes: null,
      returnType: null,
      localNames: [],
      lineNumbers: native.hasDebugInfo(),
      bodyBytes: nativeGrade === undefined ? null : nativeGrade[2],
      structure: nativeStructure(nativeRows),
    },
    python: {
      container: `CPython ${pyc.header.version} pyc, magic ${pyc.header.magicWord}`,
      functionName: gradeCode.qualname,
      functionNames: [...pyc.functions().keys()].sort(),
      parameterNames: gradeCode.argnames,
      parameterTypes: null,
      returnType: null,
      localNames: gradeCode.varnames.slice(gradeCode.argcount),
      lineNumbers: gradeCode.linetable.length > 0,
      firstLine: gradeCode.firstlineno,
      bodyBytes: gradeCode.code.length,
      structure: pythonStructure(pycRows),
    },
    jvm: {
      container: `JVM class file, major ${classFile.majorVersion}, javac -g`,
      functionName: gradeMethod.name,
      functionNames: classFile.methods.map((m) => m.name),
      parameterNames: localTable === null ? [] : localTable.filter((row) => row.start === 0).map((row) => row.name),
      parameterTypes: descriptor.slice(1, descriptor.indexOf(")")),
      returnType: descriptor.slice(descriptor.indexOf(")") + 1),
      localNames: localTable === null ? [] : localTable.filter((row) => row.start !== 0).map((row) => row.name),
      lineNumbers: lineTable !== null,
      bodyBytes: gradeAttribute.code.length,
      structure: jvmStructure(jvmRows),
    },
    wasm: {
      container: "WebAssembly binary version 1, wat2wasm",
      functionName: plain.functionName(wasmGrade.index),
      functionNames: plain.functions.map((f) => plain.functionName(f.index)),
      parameterNames: wasmLocalNames.slice(0, wasmSignature.params.length),
      parameterNamesWithoutNameSection: [],
      parameterTypes: wasmSignature.params.join(", "),
      returnType: wasmSignature.results.join(", "),
      localNames: wasmLocalNames.slice(wasmSignature.params.length),
      lineNumbers: false,
      bodyBytes: wasmGrade.bodySize,
      structure: wasmStructure(wasmGrade.instructions),
    },
    dotnet: {
      container: `ECMA-335 assembly, runtime ${assembly.runtimeMajor}.${assembly.runtimeMinor}, ${assembly.metadataVersion}`,
      functionName: cilMethod.Name,
      functionNames: assembly.methodDefs().map((m) => m.Name),
      parameterNames: cilMethod.params,
      parameterTypes: cilMethod.signatureText,
      returnType: splitWhitespace(cilMethod.signatureText)[1].split("(")[0],
      localNames: [],
      localTypes: describeLocalsSignature(rowBlob(assembly.row(0x11, cilBody.localSignatureToken & 0xffffff), "Signature")),
      lineNumbers: false,
      bodyBytes: cilBody.codeSize,
      structure: cilStructure(cilRows),
    },
  };
}

function startsWithAny(text: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => text.startsWith(prefix));
}

export function figureData(): JsonObject {
  const keeps = whatEachKeeps();
  const native = loadNative();
  const pyc = loadPyc(`ledger.${PYC_FIGURE_TAG}.pyc`);
  const gradeCode = requireFunction(pyc, "grade");
  const classFile = loadClass("Ledger-g.class");
  const module = loadWasm("ledger.wasm");
  const assembly = loadAssembly("LedgerNet.dll");
  const pythonRows: Json[] = [];
  for (const row of listingRows(disFixtureListing(PYC_FIGURE_TAG, true), "grade")) {
    if (row.opname === "CACHE") continue;
    const offset = row.offset ?? 0;
    const text = (row.opname + (row.arg !== null ? " " + String(row.arg) : "") + (row.argrepr ? " " + row.argrepr : "")).trim();
    const kind = row.opname.startsWith("POP_JUMP") ? "jump" : row.argrepr.includes("(score)") || row.argrepr.includes("(bucket)") ? "name" : "";
    pythonRows.push({ o: row.offset, b: hexBytes(gradeCode.code.subarray(offset, offset + 2)), t: text, k: kind });
  }
  const jvmRows: Json[] = jvmListing(classFile, "grade").map((r) => ({ o: r.offset, b: r.bytes, t: r.text, k: r.text.startsWith("tableswitch") ? "switch" : "" }));
  const wasmRows: Json[] = wasmListing(module, "grade").map((r) => ({
    o: r.offset,
    b: r.bytes,
    t: r.text,
    k: ["block", "loop", "if", "end", "br_table"].includes(splitWhitespace(r.text)[0]) ? "structure" : "",
    d: r.depth ?? 0,
  }));
  const nativeRows: Json[] = native.functionRows("grade").map((r) => ({ o: r.offset, b: r.bytes, t: r.text, k: startsWithAny(r.text, ["j", "ja"]) ? "jump" : "" }));
  const cilRows: Json[] = cilListing(assembly, "Grade").map((r) => {
    const kind = r.text.startsWith("switch") ? "switch" : startsWithAny(r.text, ["br", "blt", "beq", "bge"]) ? "jump" : "";
    return { o: r.offset, b: r.bytes, t: r.text, k: kind };
  });
  const panels: Json[] = [];
  const order: [string, string, Json[]][] = [
    ["native", "x86-64 object", nativeRows],
    ["python", "CPython 3.14 pyc", pythonRows],
    ["jvm", "JVM class", jvmRows],
    ["wasm", "WebAssembly", wasmRows],
    ["dotnet", ".NET assembly", cilRows],
  ];
  for (const [key, label, rows] of order) {
    const facts = keeps[key] as JsonObject;
    panels.push({
      id: key,
      label,
      container: facts["container"],
      name: facts["functionName"],
      params: facts["parameterNames"],
      paramTypes: facts["parameterTypes"],
      returnType: facts["returnType"],
      locals: facts["localNames"],
      lines: facts["lineNumbers"],
      bodyBytes: facts["bodyBytes"],
      structure: facts["structure"],
      rows,
    });
  }
  return { function: "grade", panels };
}

function oracleLine(comparison: { compared: number; mismatches: JsonObject[] }, suffix: string): string {
  return `${comparison.compared - comparison.mismatches.length}/${comparison.compared} ${suffix}`;
}

export function demo(): JsonObject {
  const report: JsonObject = {};
  const pycEntries: JsonObject = {};
  for (const tag of ["cpython-311", "cpython-312", "cpython-313", "cpython-314"]) {
    const pyc = loadPyc(`ledger.${tag}.pyc`);
    const timestamp = loadPyc(`ledger.${tag}.timestamp.pyc`);
    const listing = disFixtureListing(tag);
    const grade = requireFunction(pyc, "grade");
    const gradeRows = listingRows(listing, "grade");
    pycEntries[tag] = {
      header: pyc.header.toDict(),
      timestampHeader: timestamp.header.toDict(),
      fileBytes: pyc.data.length,
      gradeCodeBytes: grade.code.length,
      gradeInstructions: gradeRows.length,
      gradeOpnames: [...new Set(gradeRows.map((row) => row.opname))].sort(),
      names: pyc.module.names,
      gradeVarnames: grade.varnames,
      readableHere: pyc.matchesRunningInterpreter(),
    };
  }
  report["python"] = pycEntries;
  const jvmEntries: JsonObject = {};
  for (const variant of ["Ledger", "Ledger-g", "Ledger-gnone", "Ledger-jdk25"]) {
    const classFile = loadClass(`${variant}.class`);
    const oracle = readFileSync(path.join(FIXTURES, "java", `${variant}.javap-c.txt`), "utf8");
    const comparison = compareWithJavap(classFile, oracle);
    jvmEntries[variant] = {
      majorVersion: classFile.majorVersion,
      javaRelease: JAVA_MAJOR_VERSIONS.get(classFile.majorVersion) ?? "unknown",
      fileBytes: classFile.data.length,
      constantPoolCount: classFile.constantPool.length,
      sourceFile: classFile.sourceFile(),
      lineNumberTables: classFile.methods.filter((m) => m.attributeNames().includes("LineNumberTable")).length,
      localVariableTables: classFile.methods.filter((m) => m.attributeNames().includes("LocalVariableTable")).length,
      oracle: oracleLine(comparison, "instructions agree with javap -c"),
    };
  }
  report["jvm"] = jvmEntries;
  const wasmEntries: JsonObject = {};
  for (const variant of ["ledger", "ledger-names"]) {
    const module = loadWasm(`${variant}.wasm`);
    const comparison = compareWithWasmObjdump(module, readFileSync(path.join(FIXTURES, "wasm", `${variant}.objdump.txt`), "utf8"));
    wasmEntries[variant] = {
      fileBytes: module.data.length,
      sections: module.sections.map((s) => module.sectionLabel(s)),
      types: module.types.map((t) => t.render()),
      functions: module.functions.map((f) => ({ name: module.functionName(f.index), type: module.signature(f).render(), bodyBytes: f.bodySize, instructions: f.instructions.length })),
      nameSection: module.hasNameSection(),
      localNames: module.namesJson().get("locals") ?? {},
      oracle: oracleLine(comparison, "instructions agree with wasm-objdump -d"),
    };
  }
  report["wasm"] = wasmEntries;
  const assembly = loadAssembly("LedgerNet.dll");
  const comparison = compareWithMetadump(assembly, readFileSync(path.join(FIXTURES, "dotnet", "LedgerNet.metadump.txt"), "utf8"));
  const tables: JsonObject = {};
  for (const t of assembly.sortedTables()) tables[TABLE_NAMES.get(t) ?? String(t)] = assembly.rowCounts.get(t) ?? 0;
  report["dotnet"] = {
    fileBytes: assembly.data.length,
    cliHeader: assembly.cliHeaderJson(),
    metadataVersion: assembly.metadataVersion,
    streams: [...assembly.streams.keys()],
    tables,
    methods: assembly.methodSummaries().map((m) => ({
      name: m["name"],
      signature: m["signature"],
      params: m["params"],
      codeBytes: m["codeBytes"],
      locals: m["locals"],
      instructions: m["instructions"],
    })),
    oracle: oracleLine(comparison, "checks agree with System.Reflection.Metadata"),
  };
  report["keeps"] = whatEachKeeps();
  report["interpretersInstalled"] = availableInterpreters();
  return report;
}

export function main(argv: string[]): number {
  if (!argv.length) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "pyc" && argv.length === 2) {
    const pyc = new PycFile(readBytes(argv[1]));
    console.log(dumps(pyc.toDict(), 2));
    if (pyc.matchesRunningInterpreter()) {
      for (const name of pyc.functions().keys()) {
        console.log(`\n${name}:`);
        for (const row of pyc.instructions(name) ?? []) {
          console.log(`  ${String(row.offset).padStart(4)} ${row.opname.padEnd(28)} ${row.arg === null ? "" : row.arg} ${row.argrepr}`);
        }
      }
    } else {
      console.error(`\ninstruction listing needs Python ${pyc.header.version}, this is ${runningPython()?.full ?? "not on PATH"}`);
    }
    return 0;
  }
  if (command === "class" && argv.length === 2) {
    const classFile = new ClassFile(readBytes(argv[1]));
    console.log(dumps(classFile.toDict(), 2));
    for (const member of classFile.methods) {
      if (member.code === null) continue;
      console.log(`\n${member.name}${member.descriptor}:`);
      for (const row of jvmListing(classFile, member.name)) {
        console.log(`  ${String(row.offset).padStart(4)}: ${row.bytes.padEnd(20)} ${row.text}` + (row.comment !== undefined ? `  // ${row.comment}` : ""));
      }
    }
    return 0;
  }
  if (command === "wasm" && argv.length === 2) {
    const module = new WasmModule(readBytes(argv[1]));
    console.log(dumps(module.toDict(), 2));
    for (const fn of module.functions) {
      const name = module.functionName(fn.index);
      console.log(`\nfunc[${fn.index}] ${name ?? "None"} ${module.signature(fn).render()}:`);
      for (const row of wasmListing(module, name ?? "")) {
        console.log(`  ${fmtHex(row.offset, 6)}: ${row.bytes.padEnd(28)} ${"  ".repeat(row.depth ?? 0)}${row.text}`);
      }
    }
    return 0;
  }
  if (command === "dll" && argv.length === 2) {
    const assembly = new CliAssembly(readBytes(argv[1]));
    console.log(dumps(assembly.toDict(), 2));
    for (const method of assembly.methodDefs()) {
      if (!method.RVA) continue;
      console.log(`\n${method.Name} ${method.signatureText}:`);
      for (const row of cilListing(assembly, method.Name)) {
        console.log(`  IL_${fmtHex(row.offset, 4)}: ${row.bytes.padEnd(24)} ${row.text}`);
      }
    }
    return 0;
  }
  if (command === "compare") {
    console.log(dumps(compareInterpreters(), 2));
    return 0;
  }
  if (command === "keeps") {
    console.log(dumps(whatEachKeeps(), 2));
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData()));
    return 0;
  }
  console.error("usage: main.py [pyc FILE | class FILE | wasm FILE | dll FILE | compare | keeps | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
