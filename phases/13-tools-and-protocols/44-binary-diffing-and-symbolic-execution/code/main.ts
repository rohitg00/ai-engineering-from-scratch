// Lesson: Binary Diffing and Symbolic Execution (phase 13 / lesson 44)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/44-binary-diffing-and-symbolic-execution/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/44-binary-diffing-and-symbolic-execution/code/main.ts

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const HERE = __dirname;
export const FIXTURES = join(HERE, "fixtures");
export const LEVELS: Record<string, string> = { O0: "ledger-x86_64-O0.o", O1: "ledger-x86_64-O1.o", O2: "ledger-x86_64-O2.o" };
export const IMAGE_BASE = 0x100000;

const SHT_SYMTAB = 2;
const SHT_RELA = 4;
const SHT_NOBITS = 8;
const SHF_ALLOC = 2;
const STT_FUNC = 2;
const STT_SECTION = 3;
const R_X86_64_64 = 1;
const R_X86_64_PC32 = 2;
const R_X86_64_PLT32 = 4;
const RELOCATION_NAMES = new Map([[0, "R_X86_64_NONE"], [1, "R_X86_64_64"], [2, "R_X86_64_PC32"], [4, "R_X86_64_PLT32"], [10, "R_X86_64_32"], [11, "R_X86_64_32S"]]);
const RELOCATION_WIDTHS = new Map([[1, 8], [2, 4], [4, 4], [10, 4], [11, 4]]);
const PC_RELATIVE = new Set([R_X86_64_PC32, R_X86_64_PLT32]);

export class ElfError extends Error {}

export class PyFloat {
  constructor(readonly value: number) {}
}

export type Json = null | boolean | number | string | PyFloat | Json[] | Map<string, Json> | { [key: string]: Json };

function pyFloatRepr(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e16) return value.toFixed(1);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e16)) {
    const [mantissa, exponent] = value.toExponential().split("e");
    const exp = Number(exponent);
    const sign = exp < 0 ? "-" : "+";
    return `${mantissa}e${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return String(value);
}

function jsonQuote(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20 || (code > 0x7e && code < 0x10000)) out += "\\u" + code.toString(16).padStart(4, "0");
    else if (code >= 0x10000) {
      const v = code - 0x10000;
      out += "\\u" + (0xd800 + (v >> 10)).toString(16) + "\\u" + (0xdc00 + (v & 0x3ff)).toString(16);
    } else out += ch;
  }
  return out + '"';
}

export function dumps(value: Json, indent: number | null): string {
  const [itemSep, keySep] = indent === null ? [",", ":"] : [",", ": "];
  const write = (v: Json, depth: number): string => {
    const nl = (d: number) => (indent === null ? "" : "\n" + " ".repeat(indent * d));
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return jsonQuote(v);
    if (v instanceof PyFloat) return pyFloatRepr(v.value);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[" + v.map((item) => nl(depth + 1) + write(item, depth + 1)).join(itemSep) + nl(depth) + "]";
    }
    const entries: [string, Json][] = v instanceof Map ? [...v] : Object.entries(v);
    if (!entries.length) return "{}";
    return "{" + entries.map(([k, item]) => nl(depth + 1) + jsonQuote(k) + keySep + write(item, depth + 1)).join(itemSep) + nl(depth) + "}";
  };
  return write(value, 0);
}

function pyRound(value: number, digits: number): PyFloat {
  const abs = Math.abs(value);
  let text = abs.toFixed(digits);
  const full = abs.toFixed(Math.min(100, digits + 40));
  const kept = full.slice(0, full.indexOf(".") + (digits ? digits + 1 : 0));
  if (/^50*$/.test(full.slice(full.indexOf(".") + digits + 1)) && Number(kept[kept.length - 1]) % 2 === 0) text = kept;
  return new PyFloat(value < 0 ? -Number(text) : Number(text));
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
    readonly align: number,
    readonly data: Buffer,
  ) {}
}

export class ElfSymbol {
  constructor(readonly name: string, readonly value: number, readonly size: number, readonly type: number, readonly bind: number, readonly shndx: number) {}
}

export class Relocation {
  constructor(readonly offset: number, readonly type: number, readonly symbol: ElfSymbol, readonly addend: number, readonly targetSection: string) {}

  get width(): number {
    return RELOCATION_WIDTHS.get(this.type) ?? 4;
  }

  get typeName(): string {
    return RELOCATION_NAMES.get(this.type) ?? `R_X86_64_${this.type}`;
  }

  describe(elf: ElfObject): string {
    const name = this.symbol.name || elf.sections[this.symbol.shndx].name;
    const sign = this.addend >= 0 ? "+" : "-";
    return `${this.typeName} ${name}${sign}0x${Math.abs(this.addend).toString(16)}`;
  }
}

function cstring(table: Buffer, offset: number): string {
  const end = table.indexOf(0, offset);
  if (end < 0) throw new Error("ValueError: subsection not found");
  return table.subarray(offset, end).toString("latin1");
}

const u64 = (d: Buffer, o: number) => Number(d.readBigUInt64LE(o));

export class ElfObject {
  sections: Section[] = [];
  symbols: ElfSymbol[];
  relocations: Map<string, Relocation[]>;

  constructor(readonly data: Buffer, readonly name = "") {
    if (data.subarray(0, 4).toString("latin1") !== "\x7fELF" || data[4] !== 2 || data[5] !== 1) throw new ElfError("not a little-endian ELF64 file");
    if (data.readUInt16LE(0x12) !== 62) throw new ElfError("not an x86-64 object");
    const shoff = u64(data, 0x28);
    const shentsize = data.readUInt16LE(0x3a);
    const shnum = data.readUInt16LE(0x3c);
    const shstrndx = data.readUInt16LE(0x3e);
    const raw: number[][] = [];
    for (let index = 0; index < shnum; index++) {
      const b = shoff + index * shentsize;
      raw.push([data.readUInt32LE(b), data.readUInt32LE(b + 4), u64(data, b + 8), u64(data, b + 16), u64(data, b + 24), u64(data, b + 32), data.readUInt32LE(b + 40), data.readUInt32LE(b + 44), u64(data, b + 48), u64(data, b + 56)]);
    }
    const names = data.subarray(raw[shstrndx][4], raw[shstrndx][4] + raw[shstrndx][5]);
    raw.forEach(([shName, shType, shFlags, , shOffset, shSize, shLink, shInfo, shAlign], index) => {
      const body = shType === SHT_NOBITS ? Buffer.alloc(0) : data.subarray(shOffset, shOffset + shSize);
      this.sections.push(new Section(index, cstring(names, shName), shType, shFlags, shOffset, shSize, shLink, shInfo, shAlign, body));
    });
    this.symbols = this.readSymbols();
    this.relocations = this.readRelocations();
  }

  private readSymbols(): ElfSymbol[] {
    const table = this.sections.find((s) => s.type === SHT_SYMTAB);
    if (table === undefined) return [];
    const strings = this.sections[table.link].data;
    const symbols: ElfSymbol[] = [];
    for (let offset = 0; offset < table.size; offset += 24) {
      const d = table.data;
      const info = d[offset + 4];
      symbols.push(new ElfSymbol(cstring(strings, d.readUInt32LE(offset)), u64(d, offset + 8), u64(d, offset + 16), info & 0xf, info >> 4, d.readUInt16LE(offset + 6)));
    }
    return symbols;
  }

  private readRelocations(): Map<string, Relocation[]> {
    const result = new Map<string, Relocation[]>();
    for (const section of this.sections) {
      if (section.type !== SHT_RELA) continue;
      const target = this.sections[section.info].name;
      const entries: Relocation[] = [];
      for (let offset = 0; offset < section.size; offset += 24) {
        const d = section.data;
        const info = d.readBigUInt64LE(offset + 8);
        entries.push(new Relocation(u64(d, offset), Number(info & 0xffffffffn), this.symbols[Number(info >> 32n)], Number(d.readBigInt64LE(offset + 16)), target));
      }
      result.set(target, [...entries].sort((a, b) => a.offset - b.offset));
    }
    return result;
  }

  section(name: string): Section {
    const found = this.sections.find((s) => s.name === name);
    if (found === undefined) throw new ElfError(`no section named ${name}`);
    return found;
  }

  symbolSection(symbol: ElfSymbol): Section {
    return this.sections[symbol.shndx];
  }

  functions(): ElfSymbol[] {
    const text = this.section(".text").index;
    return this.symbols.filter((s) => s.type === STT_FUNC && s.shndx === text).sort((a, b) => a.value - b.value);
  }

  functionExtent(name: string): [number, number] {
    for (const symbol of this.functions()) {
      if (symbol.name === name) return [symbol.value, symbol.value + symbol.size];
    }
    throw new ElfError(`no function named ${name}`);
  }

  relocationsIn(section: string, start: number, end: number): Relocation[] {
    return (this.relocations.get(section) ?? []).filter((r) => start <= r.offset && r.offset < end);
  }

  readU32(section: string, offset: number): number {
    return this.section(section).data.readInt32LE(offset);
  }
}

export function readObject(path: string): ElfObject {
  return new ElfObject(readFileSync(path), basename(path));
}

export function loadFixture(name: string): ElfObject {
  return readObject(join(FIXTURES, name));
}

export function fixtureListing(name: string): Map<string, Instruction[]> {
  return parseListing(readFileSync(join(FIXTURES, name.replaceAll(".o", ".objdump.txt")), "utf-8"));
}

const CONDITIONAL_JUMPS = new Set(["ja", "jae", "jb", "jbe", "je", "jne", "jl", "jle", "jg", "jge", "js", "jns", "jo", "jno", "jp", "jnp"]);
const LINE_RE = /^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2}\s)+)\s*(\S+)?\s*(.*)$/;
const HEADER_RE = /^([0-9a-f]{16}) <([^>]+)>:$/;

export class Instruction {
  constructor(readonly address: number, readonly raw: Buffer, readonly mnemonic: string, readonly operands: string) {}

  get end(): number {
    return this.address + this.raw.length;
  }

  get isConditional(): boolean {
    return CONDITIONAL_JUMPS.has(this.mnemonic);
  }

  get isJump(): boolean {
    return this.mnemonic === "jmp";
  }

  get isIndirectJump(): boolean {
    return this.mnemonic === "jmpq" && this.operands.startsWith("*");
  }

  get isReturn(): boolean {
    return this.mnemonic === "retq";
  }

  get endsBlock(): boolean {
    return this.isConditional || this.isJump || this.isIndirectJump || this.isReturn;
  }

  get target(): number | null {
    if (!(this.isConditional || this.isJump)) return null;
    const match = /^0x([0-9a-f]+)/.exec(this.operands);
    return match ? parseInt(match[1], 16) : null;
  }

  get text(): string {
    return `${this.mnemonic} ${this.operands}`.trim();
  }
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function parseListing(text: string): Map<string, Instruction[]> {
  const functions = new Map<string, Instruction[]>();
  let current: string | null = null;
  for (const line of splitLines(text)) {
    const header = HEADER_RE.exec(line.trim());
    if (header) {
      current = header[2];
      functions.set(current, []);
      continue;
    }
    const match = LINE_RE.exec(line);
    if (!match || current === null || match[3] === undefined) continue;
    const operands = match[4].split("#")[0].trim();
    functions.get(current)!.push(new Instruction(parseInt(match[1], 16), Buffer.from(match[2].replace(/\s/g, ""), "hex"), match[3], operands));
  }
  return functions;
}

export class Block {
  constructor(public start: number, public end: number, public instructions: Instruction[]) {}

  get size(): number {
    return this.end - this.start;
  }

  get last(): Instruction {
    return this.instructions[this.instructions.length - 1];
  }
}

export class Edge {
  constructor(readonly source: number, readonly target: number, readonly kind: string) {}
}

export function jumpTableTargets(elf: ElfObject, start: number, end: number): number[] {
  const textIndex = elf.section(".text").index;
  const rodataIndex = elf.section(".rodata").index;
  const lea = elf.relocationsIn(".text", start, end).find((r) => r.type === R_X86_64_PC32 && r.symbol.type === STT_SECTION && r.symbol.shndx === rodataIndex);
  if (lea === undefined) return [];
  const tableOffset = lea.addend + 4;
  let expected = tableOffset;
  const targets: number[] = [];
  for (const entry of elf.relocations.get(".rodata") ?? []) {
    if (entry.offset < tableOffset) continue;
    if (entry.offset !== expected || entry.symbol.type !== STT_SECTION || entry.symbol.shndx !== textIndex) break;
    const target = entry.addend + tableOffset - entry.offset;
    if (!(start <= target && target < end)) break;
    targets.push(target);
    expected += 4;
  }
  return targets;
}

export function buildCfg(instructions: Instruction[], start: number, end: number, tableTargets: number[]): [Block[], Edge[]] {
  const leaders = new Set([start]);
  for (const insn of instructions) {
    const t = insn.target;
    if (t !== null && start <= t && t < end) leaders.add(t);
    if (insn.endsBlock && insn.end < end) leaders.add(insn.end);
    if (insn.isIndirectJump) {
      for (const target of tableTargets) if (start <= target && target < end) leaders.add(target);
    }
  }
  const blocks = new Map<number, Block>();
  let current: Block | null = null;
  for (const insn of [...instructions].sort((a, b) => a.address - b.address)) {
    if (leaders.has(insn.address) || current === null || current.end !== insn.address) {
      current = new Block(insn.address, insn.end, [insn]);
      blocks.set(insn.address, current);
    } else {
      current.instructions.push(insn);
      current.end = insn.end;
    }
  }
  const successors = new Map<number, Edge[]>();
  for (const block of blocks.values()) {
    const last = block.last;
    const edges: Edge[] = [];
    if (last.isReturn) {
      successors.set(block.start, edges);
      continue;
    }
    if (last.isJump && last.target !== null) {
      edges.push(new Edge(block.start, last.target, "jump"));
    } else if (last.isConditional && last.target !== null) {
      edges.push(new Edge(block.start, last.target, "taken"));
      if (blocks.has(block.end)) edges.push(new Edge(block.start, block.end, "fallthrough"));
    } else if (last.isIndirectJump) {
      for (const t of [...new Set(tableTargets)].sort((a, b) => a - b)) edges.push(new Edge(block.start, t, "table"));
    } else if (blocks.has(block.end)) {
      edges.push(new Edge(block.start, block.end, "fallthrough"));
    }
    successors.set(block.start, edges);
  }
  const reachable: number[] = [];
  const stack = [start];
  const seen = new Set<number>();
  while (stack.length) {
    const node = stack.pop()!;
    if (seen.has(node) || !blocks.has(node)) continue;
    seen.add(node);
    reachable.push(node);
    stack.push(...successors.get(node)!.map((e) => e.target));
  }
  const ordered = [...reachable].sort((a, b) => a - b);
  const edges = ordered.flatMap((node) => successors.get(node)!.filter((e) => seen.has(e.target)));
  return [ordered.map((node) => blocks.get(node)!), edges];
}

const sha16 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex").slice(0, 16);

const cmpTuple = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};

export class FunctionRecord {
  referencedData: Buffer | null = null;

  constructor(
    public name: string,
    public source: string,
    public start: number,
    public end: number,
    public raw: Buffer,
    public instructions: Instruction[],
    public relocations: Relocation[],
    public blocks: Block[],
    public edges: Edge[],
    public tableTargets: number[],
    public loaded = false,
  ) {}

  get size(): number {
    return this.end - this.start;
  }

  get mnemonics(): string[] {
    return this.instructions.map((i) => i.mnemonic);
  }

  maskedBytes(): Buffer {
    const masked = Buffer.from(this.raw);
    for (const relocation of this.relocations) {
      for (let index = relocation.offset - this.start; index < relocation.offset - this.start + relocation.width; index++) {
        if (index >= 0 && index < masked.length) masked[index] = 0;
      }
    }
    return masked;
  }

  reachableBytes(): Buffer {
    return Buffer.concat(this.blocks.map((b) => this.raw.subarray(b.start - this.start, b.end - this.start)));
  }

  degreeSequence(): [number, number][] {
    const incoming = new Map(this.blocks.map((b) => [b.start, 0] as [number, number]));
    const outgoing = new Map(this.blocks.map((b) => [b.start, 0] as [number, number]));
    for (const edge of this.edges) {
      outgoing.set(edge.source, outgoing.get(edge.source)! + 1);
      incoming.set(edge.target, incoming.get(edge.target)! + 1);
    }
    return this.blocks.map((b) => [incoming.get(b.start)!, outgoing.get(b.start)!] as [number, number]).sort(cmpTuple);
  }

  cfgShape(): string {
    const degrees = this.degreeSequence()
      .map(([i, o]) => `${i}/${o}`)
      .join(",");
    return `${this.blocks.length}b ${this.edges.length}e [${degrees}]`;
  }

  signatures(): Record<string, string> {
    return {
      "exact-bytes": sha16(this.raw),
      "masked-bytes": sha16(this.maskedBytes()),
      mnemonics: sha16(this.mnemonics.join(" ")),
      "cfg-shape": this.cfgShape(),
      name: this.name,
    };
  }

  summary(): Json {
    return {
      name: this.name,
      start: this.start,
      size: this.size,
      instructions: this.instructions.length,
      blocks: this.blocks.length,
      edges: this.edges.length,
      relocations: this.relocations.length,
      signatures: this.signatures(),
    };
  }
}

export class Image {
  constructor(public elf: ElfObject, public base: number, public addresses: Map<string, number>, public data: Map<string, Buffer>) {}

  addressOf(symbol: ElfSymbol): number | null {
    if (symbol.shndx >= this.elf.sections.length || !this.addresses.has(this.elf.sections[symbol.shndx].name)) return null;
    return this.addresses.get(this.elf.sections[symbol.shndx].name)! + symbol.value;
  }
}

export function loadImage(elf: ElfObject, base = IMAGE_BASE): Image {
  const addresses = new Map<string, number>();
  const data = new Map<string, Buffer>();
  let address = base;
  for (const section of elf.sections) {
    if (!(section.flags & SHF_ALLOC) || section.type === SHT_NOBITS) continue;
    const align = Math.max(1, section.align);
    address = Math.floor((address + align - 1) / align) * align;
    addresses.set(section.name, address);
    data.set(section.name, Buffer.from(section.data));
    address += section.size;
  }
  const image = new Image(elf, base, addresses, data);
  for (const [target, relocations] of elf.relocations) {
    const buffer = data.get(target);
    if (buffer === undefined) continue;
    for (const relocation of relocations) {
      const symbolValue = image.addressOf(relocation.symbol);
      if (symbolValue === null) continue;
      const place = addresses.get(target)! + relocation.offset;
      if (PC_RELATIVE.has(relocation.type)) buffer.writeInt32LE(symbolValue + relocation.addend - place, relocation.offset);
      else if (relocation.type === R_X86_64_64) buffer.writeBigUInt64LE(BigInt(symbolValue + relocation.addend), relocation.offset);
      else if (relocation.type === 10 || relocation.type === 11) buffer.writeUInt32LE(Number(BigInt(symbolValue + relocation.addend) & 0xffffffffn), relocation.offset);
    }
  }
  return image;
}

function pyIntHex(text: string): number {
  const negative = text.startsWith("-");
  const body = text.replace(/^[-+]/, "").replace(/^0[xX]/, "");
  if (!/^[0-9a-fA-F]+$/.test(body)) throw new Error(`ValueError: invalid literal for int() with base 16: ${text}`);
  const value = parseInt(body, 16);
  return negative ? -value : value;
}

export function referencedTable(elf: ElfObject, instructions: Instruction[], relocations: Relocation[], image: Image | null): Buffer | null {
  const rodata = elf.section(".rodata").index;
  const lea = relocations.find((r) => r.type === R_X86_64_PC32 && r.symbol.type === STT_SECTION && r.symbol.shndx === rodata);
  if (lea === undefined) return null;
  let count: number | null = null;
  let width: number | null = null;
  for (const insn of instructions) {
    if ((insn.mnemonic === "cmpl" || insn.mnemonic === "subl") && insn.operands.startsWith("$")) {
      count = pyIntHex(insn.operands.split(",")[0].slice(1)) + 1;
    }
    const scaled = /,\s*(\d)\)/.exec(insn.operands);
    if (scaled && ["movl", "movq", "movslq"].includes(insn.mnemonic)) width = Number(scaled[1]);
  }
  if (count === null || width === null) return null;
  const offset = lea.addend + 4;
  const source = image !== null ? image.data.get(".rodata")! : elf.section(".rodata").data;
  return Buffer.from(source.subarray(offset, offset + count * width));
}

export function functionRecord(elf: ElfObject, listing: Map<string, Instruction[]>, name: string, image: Image | null = null): FunctionRecord {
  const [start, end] = elf.functionExtent(name);
  const text = image !== null ? image.data.get(".text")! : elf.section(".text").data;
  const fromListing = listing.get(name);
  if (fromListing === undefined) throw new Error(`KeyError: '${name}'`);
  let instructions = fromListing.filter((i) => start <= i.address && i.address < end);
  for (const insn of instructions) {
    if (!elf.section(".text").data.subarray(insn.address, insn.end).equals(insn.raw)) {
      throw new ElfError(`listing bytes differ from the object at 0x${insn.address.toString(16)}`);
    }
  }
  const relocations = elf.relocationsIn(".text", start, end);
  const targets = instructions.some((i) => i.isIndirectJump) ? jumpTableTargets(elf, start, end) : [];
  let [blocks, edges] = buildCfg(instructions, start, end, targets);
  const raw = Buffer.from(text.subarray(start, end));
  if (image !== null) {
    instructions = instructions.map((i) => new Instruction(i.address, raw.subarray(i.address - start, i.end - start), i.mnemonic, i.operands));
    [blocks, edges] = buildCfg(instructions, start, end, targets);
  }
  const record = new FunctionRecord(name, elf.name, start, end, raw, instructions, relocations, blocks, edges, targets, image !== null);
  record.referencedData = referencedTable(elf, instructions, relocations, image);
  return record;
}

export function functionRecords(elf: ElfObject, listing: Map<string, Instruction[]>, image: Image | null = null): FunctionRecord[] {
  return elf.functions().map((symbol) => functionRecord(elf, listing, symbol.name, image));
}

export function fixtureRecords(name: string, loaded = false): FunctionRecord[] {
  const elf = loadFixture(name);
  const image = loaded ? loadImage(elf) : null;
  return functionRecords(elf, fixtureListing(name), image);
}

export class Stage {
  constructor(readonly id: string, readonly label: string, readonly quality: string, readonly ghidra: string, readonly bindiff: string) {}
}

export const STAGES = [
  new Stage("exact-bytes", "exact function bytes", "very good", "Exact Function Bytes Match", "hash matching"),
  new Stage("masked-bytes", "bytes with relocation fields masked", "very good", "Exact Function Instructions Match", "hash matching on a relocatable object"),
  new Stage("mnemonics", "mnemonic sequence", "good", "Exact Function Mnemonics Match", "prime signature matching"),
  new Stage("cfg-shape", "flow-graph shape", "medium", "none", "MD index matching"),
  new Stage("name", "symbol name", "very good", "Exact Symbol Name Match", "name hash matching"),
];
const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s] as [string, Stage]));
export const LESSON_ORDER = STAGES.map((s) => s.id);
export const BINDIFF_ORDER = ["exact-bytes", "name", "masked-bytes", "mnemonics", "cfg-shape"];

function bytesEqual(a: Buffer, b: Buffer): boolean {
  return a.equals(b);
}

export class Match {
  constructor(
    public left: FunctionRecord,
    public right: FunctionRecord,
    public stage: string,
    public agreeing: string[],
    public similarity: number,
    public dataEqual: boolean | null,
  ) {}

  get quality(): string {
    return STAGE_BY_ID.get(this.stage)!.quality;
  }

  get namesAgree(): boolean {
    return this.left.name === this.right.name;
  }

  toDict(): Json {
    return {
      left: this.left.name,
      right: this.right.name,
      stage: this.stage,
      quality: this.quality,
      agreeing: this.agreeing,
      similarity: pyRound(this.similarity, 6),
      sizes: [this.left.size, this.right.size],
      namesAgree: this.namesAgree,
      dataEqual: this.dataEqual,
    };
  }
}

export class MatchReport {
  constructor(
    public leftObject: string,
    public rightObject: string,
    public loaded: boolean,
    public matches: Match[],
    public unmatchedLeft: FunctionRecord[],
    public unmatchedRight: FunctionRecord[],
    public order: string[] = [...LESSON_ORDER],
  ) {}

  byName(leftName: string): Match | null {
    return this.matches.find((m) => m.left.name === leftName) ?? null;
  }

  stageOf(leftName: string): string | null {
    const match = this.byName(leftName);
    return match ? match.stage : null;
  }

  toDict(): Json {
    return {
      left: this.leftObject,
      right: this.rightObject,
      view: this.loaded ? "loaded image" : "object file",
      order: this.order,
      matches: this.matches.map((m) => m.toDict()),
      unmatchedLeft: this.unmatchedLeft.map((f) => f.name),
      unmatchedRight: this.unmatchedRight.map((f) => f.name),
    };
  }
}

export function levenshtein(left: Buffer, right: Buffer): number {
  let previous = Array.from({ length: right.length + 1 }, (_, k) => k);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (left[i - 1] !== right[j - 1] ? 1 : 0)));
    }
    previous = current;
  }
  return previous[previous.length - 1];
}

export function radare2Ratio(left: Buffer, right: Buffer): number {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1.0 : 1.0 - levenshtein(left, right) / longest;
}

export function matchFunctions(left: FunctionRecord[], right: FunctionRecord[], stages: string[] | null = null): MatchReport {
  const order = stages && stages.length ? stages : STAGES.map((s) => s.id);
  const leftOpen = [...left];
  const rightOpen = [...right];
  const matches: Match[] = [];
  for (const stage of order) {
    const leftGroups = new Map<string, FunctionRecord[]>();
    const rightGroups = new Map<string, FunctionRecord[]>();
    for (const record of leftOpen) {
      const key = record.signatures()[stage];
      if (!leftGroups.has(key)) leftGroups.set(key, []);
      leftGroups.get(key)!.push(record);
    }
    for (const record of rightOpen) {
      const key = record.signatures()[stage];
      if (!rightGroups.has(key)) rightGroups.set(key, []);
      rightGroups.get(key)!.push(record);
    }
    for (const [signature, candidates] of leftGroups) {
      const partners = rightGroups.get(signature) ?? [];
      if (candidates.length !== 1 || partners.length !== 1) continue;
      const [a, b] = [candidates[0], partners[0]];
      const sa = a.signatures();
      const sb = b.signatures();
      const agreeing = STAGES.filter((s) => sa[s.id] === sb[s.id]).map((s) => s.id);
      const dataEqual = a.referencedData === null || b.referencedData === null ? null : bytesEqual(a.referencedData, b.referencedData);
      matches.push(new Match(a, b, stage, agreeing, radare2Ratio(a.raw, b.raw), dataEqual));
      leftOpen.splice(leftOpen.indexOf(a), 1);
      rightOpen.splice(rightOpen.indexOf(b), 1);
    }
  }
  matches.sort((x, y) => x.left.start - y.left.start);
  const leftName = left.length ? left[0].source : "";
  const rightName = right.length ? right[0].source : "";
  const loaded = Boolean(left.length && left[0].loaded);
  return new MatchReport(leftName, rightName, loaded, matches, leftOpen, rightOpen, [...order]);
}

export function diffFixtures(left: string, right: string, loaded = false, stages: string[] | null = null): MatchReport {
  return matchFunctions(fixtureRecords(left, loaded), fixtureRecords(right, loaded), stages);
}

const RADIFF2_LINE = /^\s*sym\.(\S+)\s+(\d+)\s+0x([0-9a-f]+)\s+\|\s+(MATCH|UNMATCH)\s+\(([0-9.]+)\)\s+\|\s+0x([0-9a-f]+)\s+(\d+)\s+sym\.(\S+)\s*$/;

type RadiffRow = { left: string; leftSize: number; verdict: string; ratio: PyFloat; rightSize: number; right: string };

export function parseRadiff2(text: string): RadiffRow[] {
  const rows: RadiffRow[] = [];
  for (const line of splitLines(text)) {
    const match = RADIFF2_LINE.exec(line);
    if (match) {
      rows.push({ left: match[1], leftSize: Number(match[2]), verdict: match[4], ratio: new PyFloat(Number(match[5])), rightSize: Number(match[7]), right: match[8] });
    }
  }
  return rows;
}

export function radiff2Fixture(name: string): RadiffRow[] {
  const path = join(FIXTURES, name);
  return existsSync(path) ? parseRadiff2(readFileSync(path, "utf-8")) : [];
}

type GhidraMatch = {
  correlator: string;
  source: string;
  sourceAddress: number;
  sourceLength: number;
  destination: string;
  destinationAddress: number;
  destinationLength: number;
  type: string;
  similarity: number;
  confidence: number;
};
type GhidraReport = {
  version?: string;
  blocks: Map<string, Json>;
  functions: Map<string, Json>;
  correlators: Map<string, Json>;
  matches: GhidraMatch[];
};

export function parseGhidraVt(text: string): GhidraReport {
  const report: GhidraReport = {
    blocks: new Map([["source", new Map()], ["destination", new Map()]]),
    functions: new Map([["source", new Map()], ["destination", new Map()]]),
    correlators: new Map(),
    matches: [],
  };
  const slot = (table: Map<string, Json>, key: string): Map<string, Json> => {
    const found = table.get(key);
    if (!(found instanceof Map)) throw new Error(`KeyError: '${key}'`);
    return found;
  };
  for (const line of splitLines(text)) {
    const raw = line.trim().split("|");
    if (raw.length < 3 || raw[0] !== "VT") continue;
    const part = (i: number): string => {
      if (i >= raw.length) throw new Error("IndexError: list index out of range");
      return raw[i];
    };
    const kind = part(1);
    if (kind === "ghidra") {
      report.version = part(2);
    } else if (kind === "block" && !part(4).includes("::")) {
      slot(report.blocks, part(2)).set(part(3), { start: parseInt(part(4), 16), end: parseInt(part(5), 16), size: Number(part(6)) });
    } else if (kind === "function") {
      slot(report.functions, part(2)).set(part(3), { entry: parseInt(part(4), 16), size: Number(part(5)) });
    } else if (kind === "correlator") {
      report.correlators.set(part(2), Number(part(3)));
    } else if (kind === "match") {
      report.matches.push({
        correlator: part(2),
        source: part(3),
        sourceAddress: parseInt(part(4), 16),
        sourceLength: Number(part(5)),
        destination: part(6),
        destinationAddress: parseInt(part(7), 16),
        destinationLength: Number(part(8)),
        type: part(9),
        similarity: Number(part(10)),
        confidence: Number(part(11)),
      });
    }
  }
  return report;
}

export function ghidraFixture(name: string): GhidraReport {
  const path = join(FIXTURES, name);
  return existsSync(path) ? parseGhidraVt(readFileSync(path, "utf-8")) : { blocks: new Map(), functions: new Map(), correlators: new Map(), matches: [] };
}

export function ghidraFunctionsMatched(report: GhidraReport, correlator: string): string[] {
  return report.matches
    .filter((m) => m.correlator === correlator && m.type === "Function")
    .map((m) => m.source)
    .sort();
}

type Loose = { [key: string]: any };

export function angrFixture(): Loose {
  const path = join(FIXTURES, "angr-runs.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
}

export function z3Fixture(): Loose {
  const path = join(FIXTURES, "z3-runs.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
}

export class Const {
  constructor(readonly value: number, readonly width = 32) {}
}

export class Var {
  constructor(readonly name: string, readonly width = 32) {}
}

export class Bin {
  constructor(readonly op: string, readonly left: Expr, readonly right: Expr, readonly width = 32) {}
}

export class Not {
  constructor(readonly expr: Expr) {}
}

export class Cast {
  constructor(readonly kind: string, readonly expr: Expr, readonly width: number) {}
}

export class Load {
  constructor(readonly table: string, readonly index: Expr, readonly width = 32) {}
}

export type Expr = Const | Var | Bin | Not | Cast | Load;

export class Assign {
  constructor(readonly dst: Var, readonly src: Expr) {}
}

export class Branch {
  constructor(readonly cond: Expr, readonly target: number, readonly fallthrough: number) {}
}

export class Jump {
  constructor(readonly target: number) {}
}

export class Switch {
  constructor(readonly index: Expr, readonly targets: number[]) {}
}

export class Return {
  constructor(readonly value: Expr) {}
}

export type Stmt = Assign | Branch | Jump | Switch | Return;

export class IRBlock {
  constructor(public start: number, public stmts: Stmt[], public insns: number[], public next: number | null = null) {}
}

export class IRFunction {
  constructor(
    public name: string,
    public source: string,
    public entry: number,
    public params: Var[],
    public blocks: Map<number, IRBlock>,
    public tables: Map<string, number[]>,
  ) {}
}

export class IRError extends Error {}
class ZeroDivision extends Error {}
class OutOfRange extends Error {}

export function toSigned(value: number | bigint, width: number): number {
  const w = BigInt(width);
  let v = BigInt(value) & ((1n << w) - 1n);
  if (v & (1n << (w - 1n))) v -= 1n << w;
  return Number(v);
}

export function toUnsigned(value: number, width: number): number {
  return Number(BigInt(value) & ((1n << BigInt(width)) - 1n));
}

export function cDivide(dividend: number, divisor: number): number {
  if (divisor === 0) throw new ZeroDivision("division by zero in the path");
  const quotient = Math.floor(Math.abs(dividend) / Math.abs(divisor));
  return dividend < 0 === divisor < 0 ? quotient : -quotient;
}

export function widthOf(expr: Expr): number {
  if (expr instanceof Const || expr instanceof Var || expr instanceof Bin || expr instanceof Cast || expr instanceof Load) return expr.width;
  return 1;
}

export function evaluate(expr: Expr, assignment: Map<string, number>, tables: Map<string, number[]>): number {
  if (expr instanceof Const) return toSigned(expr.value, expr.width);
  if (expr instanceof Var) {
    if (!assignment.has(expr.name)) throw new IRError(`no value for ${expr.name}`);
    return toSigned(assignment.get(expr.name)!, expr.width);
  }
  if (expr instanceof Not) return evaluate(expr.expr, assignment, tables) ? 0 : 1;
  if (expr instanceof Cast) {
    const inner = evaluate(expr.expr, assignment, tables);
    if (expr.kind === "zext") return toSigned(toUnsigned(inner, widthOf(expr.expr)), expr.width);
    return toSigned(inner, expr.width);
  }
  if (expr instanceof Load) {
    const index = evaluate(expr.index, assignment, tables);
    const table = tables.get(expr.table);
    if (table === undefined) throw new Error(`KeyError: '${expr.table}'`);
    if (!(index >= 0 && index < table.length)) throw new OutOfRange(`index ${index} outside ${expr.table}`);
    return toSigned(table[index], expr.width);
  }
  const a = evaluate(expr.left, assignment, tables);
  const b = evaluate(expr.right, assignment, tables);
  const width = expr.width;
  const int = (flag: boolean) => (flag ? 1 : 0);
  switch (expr.op) {
    case "+":
      return toSigned(BigInt(a) + BigInt(b), width);
    case "-":
      return toSigned(BigInt(a) - BigInt(b), width);
    case "*":
      return toSigned(BigInt(a) * BigInt(b), width);
    case "/":
      return toSigned(cDivide(a, b), width);
    case "<<":
      return toSigned(BigInt(a) << BigInt(b), width);
    case ">>":
      return Math.floor(a / 2 ** b);
    case ">>u":
      return toSigned(Math.floor(toUnsigned(a, widthOf(expr.left)) / 2 ** b), width);
    case "==":
      return int(a === b);
    case "!=":
      return int(a !== b);
    case "<":
      return int(a < b);
    case "<=":
      return int(a <= b);
    case ">":
      return int(a > b);
    case ">=":
      return int(a >= b);
  }
  const operandWidth = widthOf(expr.left);
  const [ua, ub] = [toUnsigned(a, operandWidth), toUnsigned(b, operandWidth)];
  switch (expr.op) {
    case "<u":
      return int(ua < ub);
    case "<=u":
      return int(ua <= ub);
    case ">u":
      return int(ua > ub);
    case ">=u":
      return int(ua >= ub);
    case "&&":
      return int(Boolean(a) && Boolean(b));
    case "||":
      return int(Boolean(a) || Boolean(b));
  }
  throw new IRError(`unknown operator ${expr.op}`);
}

export function substitute(expr: Expr, env: Map<string, Expr>): Expr {
  if (expr instanceof Var) return env.get(expr.name) ?? expr;
  if (expr instanceof Not) return new Not(substitute(expr.expr, env));
  if (expr instanceof Cast) {
    const inner = substitute(expr.expr, env);
    if (inner instanceof Const) return new Const(evaluate(new Cast(expr.kind, inner, expr.width), new Map(), new Map()), expr.width);
    return new Cast(expr.kind, inner, expr.width);
  }
  if (expr instanceof Load) return new Load(expr.table, substitute(expr.index, env), expr.width);
  if (expr instanceof Bin) {
    const left = substitute(expr.left, env);
    const right = substitute(expr.right, env);
    if (left instanceof Const && right instanceof Const && expr.op !== "/") {
      return new Const(evaluate(new Bin(expr.op, left, right, expr.width), new Map(), new Map()), expr.width);
    }
    return new Bin(expr.op, left, right, expr.width);
  }
  return expr;
}

const PRECEDENCE = new Map([
  ["||", 1], ["&&", 2], ["==", 3], ["!=", 3], ["<", 4], ["<=", 4], [">", 4], [">=", 4], ["<u", 4], ["<=u", 4], [">u", 4], [">=u", 4],
  ["<<", 5], [">>", 5], [">>u", 5], ["+", 6], ["-", 6], ["*", 7], ["/", 7],
]);

export function render(expr: Expr, parent = 0): string {
  if (expr instanceof Const) return String(toSigned(expr.value, expr.width));
  if (expr instanceof Var) return expr.name;
  if (expr instanceof Not) return "!(" + render(expr.expr) + ")";
  if (expr instanceof Cast) return `${expr.kind}${expr.width}(${render(expr.expr)})`;
  if (expr instanceof Load) return `${expr.table}[${render(expr.index)}]`;
  const level = PRECEDENCE.get(expr.op)!;
  const text = `${render(expr.left, level)} ${expr.op} ${render(expr.right, level + 1)}`;
  return level < parent ? `(${text})` : text;
}

type Domain = { start: number; stop: number };
const range = (start: number, stop: number): Domain => ({ start, stop });

export class BoundedSearch {
  evaluations = 0;
  tables: Map<string, number[]>;

  constructor(public domains: Map<string, Domain>, tables: Map<string, number[]> | null = null) {
    this.tables = tables ?? new Map();
  }

  holds(constraints: Expr[], assignment: Map<string, number>): boolean {
    for (const constraint of constraints) {
      this.evaluations += 1;
      try {
        if (!evaluate(constraint, assignment, this.tables)) return false;
      } catch (error) {
        if (error instanceof ZeroDivision || error instanceof OutOfRange) return false;
        throw error;
      }
    }
    return true;
  }

  *models(constraints: Expr[]): Generator<Map<string, number>> {
    const names = [...this.domains.keys()];
    const domains = names.map((n) => this.domains.get(n)!);
    if (domains.some((d) => d.stop <= d.start)) return;
    const values = domains.map((d) => d.start);
    for (;;) {
      const assignment = new Map(names.map((n, i) => [n, values[i]] as [string, number]));
      if (this.holds(constraints, assignment)) yield assignment;
      let k = names.length - 1;
      while (k >= 0) {
        values[k] += 1;
        if (values[k] < domains[k].stop) break;
        values[k] = domains[k].start;
        k -= 1;
      }
      if (k < 0) return;
    }
  }

  satisfiable(constraints: Expr[]): boolean {
    return !this.models(constraints).next().done;
  }

  solve(constraints: Expr[]): Map<string, number> | null {
    const first = this.models(constraints).next();
    return first.done ? null : first.value;
  }

  summarize(constraints: Expr[], name: string): Map<string, Json> | null {
    const values = [...this.models(constraints)].map((m) => m.get(name)!);
    if (!values.length) return null;
    return new Map<string, Json>([
      ["count", values.length],
      ["min", Math.min(...values)],
      ["max", Math.max(...values)],
      ["sample", values[0]],
    ]);
  }
}

export class PathState {
  returned: Expr | null = null;
  status = "active";

  constructor(public block: number, public trace: number[], public condition: Expr[], public env: Map<string, Expr>) {}

  fork(block: number, extra: Expr | null): PathState {
    const condition = [...this.condition, ...(extra !== null ? [extra] : [])];
    return new PathState(block, [...this.trace, block], condition, new Map(this.env));
  }

  describe(): string {
    return this.condition.map((c) => render(c, PRECEDENCE.get("&&")!)).join(" && ") || "true";
  }

  toDict(): Json {
    return {
      trace: this.trace.map((b) => `0x${b.toString(16)}`),
      condition: this.describe(),
      returns: this.returned !== null ? render(this.returned) : null,
      status: this.status,
    };
  }
}

export function execute(fn: IRFunction, solver: BoundedSearch, stepLimit = 64): PathState[] {
  solver.tables = fn.tables;
  const start = new PathState(fn.entry, [fn.entry], [], new Map(fn.params.map((p) => [p.name, p] as [string, Expr])));
  const worklist = [start];
  const finished: PathState[] = [];
  while (worklist.length) {
    const path = worklist.pop()!;
    if (path.trace.length > stepLimit) {
      path.status = "truncated";
      finished.push(path);
      continue;
    }
    const block = fn.blocks.get(path.block);
    if (block === undefined) throw new Error(`KeyError: ${path.block}`);
    const successors: PathState[] = [];
    let terminated = false;
    for (const stmt of block.stmts) {
      if (stmt instanceof Assign) {
        path.env.set(stmt.dst.name, substitute(stmt.src, path.env));
      } else if (stmt instanceof Branch) {
        const cond = substitute(stmt.cond, path.env);
        for (const [extra, target] of [[cond, stmt.target], [new Not(cond), stmt.fallthrough]] as [Expr, number][]) {
          if (solver.satisfiable([...path.condition, extra])) successors.push(path.fork(target, extra));
        }
        terminated = true;
      } else if (stmt instanceof Jump) {
        successors.push(path.fork(stmt.target, null));
        terminated = true;
      } else if (stmt instanceof Switch) {
        const index = substitute(stmt.index, path.env);
        const byTarget = new Map<number, number[]>();
        stmt.targets.forEach((target, entry) => {
          if (!byTarget.has(target)) byTarget.set(target, []);
          byTarget.get(target)!.push(entry);
        });
        for (const [target, entries] of byTarget) {
          let extra: Expr = new Bin("==", index, new Const(entries[0]));
          for (const entry of entries.slice(1)) extra = new Bin("||", extra, new Bin("==", index, new Const(entry)), 1);
          if (solver.satisfiable([...path.condition, extra])) successors.push(path.fork(target, extra));
        }
        terminated = true;
      } else if (stmt instanceof Return) {
        path.returned = substitute(stmt.value, path.env);
        path.status = "returned";
        finished.push(path);
        terminated = true;
      }
      if (terminated) break;
    }
    if (!terminated) {
      if (block.next === null) throw new IRError(`block 0x${block.start.toString(16)} has no terminator and no fallthrough`);
      successors.push(path.fork(block.next, null));
    }
    worklist.push(...successors.reverse());
  }
  finished.sort((a, b) => cmpTuple(a.trace, b.trace));
  return finished;
}

export function solveReturns(paths: PathState[], solver: BoundedSearch, variable: string, values: number[]): Map<number, Map<string, Json>[]> {
  const classes = new Map<number, Map<string, Json>[]>();
  for (const value of values) {
    const hits: Map<string, Json>[] = [];
    for (const path of paths) {
      if (path.status !== "returned") continue;
      const summary = solver.summarize([...path.condition, new Bin("==", path.returned!, new Const(value))], variable);
      if (summary !== null) {
        summary.set("leaf", `0x${path.trace[path.trace.length - 1].toString(16)}`);
        hits.push(summary);
      }
    }
    classes.set(value, hits);
  }
  return classes;
}

export function rodataTable(elf: ElfObject, offset: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => elf.readU32(".rodata", offset + 4 * index));
}

const block = (start: number, stmts: Stmt[], insns: number[], next: number | null = null): [number, IRBlock] => [start, new IRBlock(start, stmts, insns, next)];

export function gradeIrO0(elf: ElfObject | null = null): IRFunction {
  const obj = elf ?? loadFixture(LEVELS.O0);
  const score = new Var("score");
  const quotient = new Bin("-", new Bin("/", score, new Const(10)), new Const(6));
  const targets = jumpTableTargets(obj, ...obj.functionExtent("grade"));
  const blocks = new Map([
    block(0x30, [new Assign(new Var("local_8"), score), new Assign(new Var("local_10"), quotient), new Branch(new Bin(">u", new Var("local_10"), new Const(4)), 0x9a, 0x62)], [0x30, 0x31, 0x34, 0x37, 0x3b, 0x42, 0x45, 0x49, 0x4b, 0x4f, 0x51, 0x53, 0x57, 0x59, 0x5d, 0x60]),
    block(0x62, [new Switch(new Var("local_10"), targets)], [0x62, 0x66, 0x6d, 0x71, 0x74]),
    block(0x76, [new Assign(new Var("local_4"), new Const(4)), new Jump(0xa1)], [0x76, 0x7d]),
    block(0x7f, [new Assign(new Var("local_4"), new Const(3)), new Jump(0xa1)], [0x7f, 0x86]),
    block(0x88, [new Assign(new Var("local_4"), new Const(2)), new Jump(0xa1)], [0x88, 0x8f]),
    block(0x91, [new Assign(new Var("local_4"), new Const(1)), new Jump(0xa1)], [0x91, 0x98]),
    block(0x9a, [new Assign(new Var("local_4"), new Const(0))], [0x9a], 0xa1),
    block(0xa1, [new Return(new Var("local_4"))], [0xa1, 0xa4, 0xa5]),
  ]);
  return new IRFunction("grade", LEVELS.O0, 0x30, [score], blocks, new Map());
}

export function gradeIrO1(elf: ElfObject | null = null): IRFunction {
  const obj = elf ?? loadFixture(LEVELS.O1);
  const score = new Var("score");
  const quotient = new Bin("-", new Bin("/", score, new Const(10)), new Const(6));
  const blocks = new Map([
    block(0x10, [new Assign(new Var("ecx"), quotient), new Assign(new Var("eax"), new Const(0)), new Branch(new Bin(">u", new Var("ecx"), new Const(4)), 0x3d, 0x31)], [0x10, 0x13, 0x1a, 0x1d, 0x21, 0x25, 0x27, 0x2a, 0x2c, 0x2f]),
    block(0x31, [new Assign(new Var("eax"), new Load("lookup_14", new Var("ecx")))], [0x31, 0x33, 0x3a], 0x3d),
    block(0x3d, [new Return(new Var("eax"))], [0x3d]),
  ]);
  return new IRFunction("grade", LEVELS.O1, 0x10, [score], blocks, new Map([["lookup_14", rodataTable(obj, 0x14, 5)]]));
}

export function percentChangeIrO1(): IRFunction {
  const before = new Var("before");
  const after = new Var("after");
  const blocks = new Map([
    block(0x0, [new Branch(new Bin("==", before, new Const(0)), 0xd, 0x4)], [0x0, 0x2]),
    block(0x4, [new Return(new Bin("/", new Bin("*", new Bin("-", after, before), new Const(100)), before))], [0x4, 0x6, 0x9, 0xa, 0xc]),
    block(0xd, [new Return(new Const(0))], [0xd, 0xf]),
  ]);
  return new IRFunction("percent_change", LEVELS.O1, 0x0, [before, after], blocks, new Map());
}

export function totalIrO1(values: number[]): IRFunction {
  const count = new Var("count");
  const blocks = new Map([
    block(0x40, [new Branch(new Bin("<=", count, new Const(0)), 0x5c, 0x44)], [0x40, 0x42]),
    block(0x44, [new Assign(new Var("rcx", 64), new Cast("zext", count, 64)), new Assign(new Var("rdx", 64), new Const(0, 64)), new Assign(new Var("eax"), new Const(0))], [0x44, 0x46, 0x48, 0x4a], 0x50),
    block(
      0x50,
      [
        new Assign(new Var("eax"), new Bin("+", new Var("eax"), new Load("values", new Var("rdx", 64)))),
        new Assign(new Var("rdx", 64), new Bin("+", new Var("rdx", 64), new Const(1, 64), 64)),
        new Branch(new Bin("!=", new Var("rdx", 64), new Var("rcx", 64), 64), 0x50, 0x5b),
      ],
      [0x50, 0x53, 0x56, 0x59],
    ),
    block(0x5b, [new Return(new Var("eax"))], [0x5b]),
    block(0x5c, [new Return(new Const(0))], [0x5c, 0x5e]),
  ]);
  return new IRFunction("total", LEVELS.O1, 0x40, [count], blocks, new Map([["values", [...values]]]));
}

export const SCORE_DOMAIN = range(-200, 1201);
export const PERCENT_DOMAIN = range(-16, 17);
export const TOTAL_VALUES = Array.from({ length: 9 }, (_, k) => k + 1);

export function checkIrAgainstListing(fn: IRFunction): string[] {
  const [start, end] = loadFixture(fn.source).functionExtent(fn.name);
  const found = fixtureListing(fn.source).get(fn.name);
  if (found === undefined) throw new Error(`KeyError: '${fn.name}'`);
  const listing = found.filter((i) => start <= i.address && i.address < end);
  const addresses = new Set(listing.map((i) => i.address));
  const problems: string[] = [];
  for (const b of fn.blocks.values()) {
    for (const address of b.insns) {
      if (!addresses.has(address)) problems.push(`0x${address.toString(16)} is not an instruction of ${fn.name} in ${fn.source}`);
    }
  }
  const claimed = [...fn.blocks.values()].flatMap((b) => b.insns).sort((a, b) => a - b);
  const expected = listing.map((i) => i.address).sort((a, b) => a - b);
  if (claimed.length !== expected.length || claimed.some((a, k) => a !== expected[k])) problems.push("the IR does not cover every instruction once");
  return problems;
}

const now = (): number => Number(process.hrtime.bigint()) / 1e9;

export function gradePaths(level = "O0"): Map<string, Json> {
  const fn = level === "O0" ? gradeIrO0() : gradeIrO1();
  const solver = new BoundedSearch(new Map([["score", SCORE_DOMAIN]]));
  const started = now();
  const paths = execute(fn, solver);
  const seconds = pyRound(now() - started, 3);
  const classes = solveReturns(paths, solver, "score", [0, 1, 2, 3, 4]);
  return new Map<string, Json>([
    ["function", fn.name],
    ["object", fn.source],
    ["domain", [SCORE_DOMAIN.start, SCORE_DOMAIN.stop - 1]],
    ["paths", paths.map((p) => p.toDict())],
    ["pathCount", paths.length],
    ["seconds", seconds],
    ["evaluations", solver.evaluations],
    ["returns", new Map<string, Json>([...classes].map(([value, hits]) => [String(value), hits] as [string, Json]))],
  ]);
}

const assignmentJson = (model: Map<string, number> | null): Json => (model === null ? null : new Map<string, Json>([...model]));

export function percentChangePaths(): Map<string, Json> {
  const fn = percentChangeIrO1();
  const solver = new BoundedSearch(new Map([["before", PERCENT_DOMAIN], ["after", PERCENT_DOMAIN]]));
  const paths = execute(fn, solver);
  const nonzero = paths.find((p) => p.status === "returned" && !(p.returned instanceof Const));
  if (nonzero === undefined) throw new Error("StopIteration");
  const returns50 = solver.solve([...nonzero.condition, new Bin("==", nonzero.returned!, new Const(50))]);
  const minus133 = solver.solve([...nonzero.condition, new Bin("==", nonzero.returned!, new Const(-133)), new Bin("==", new Var("before"), new Const(3))]);
  return new Map<string, Json>([
    ["function", fn.name],
    ["object", fn.source],
    ["domain", [PERCENT_DOMAIN.start, PERCENT_DOMAIN.stop - 1]],
    ["paths", paths.map((p) => p.toDict())],
    ["pathCount", paths.length],
    ["returns50", assignmentJson(returns50)],
    ["before3ReturnsMinus133", assignmentJson(minus133)],
  ]);
}

export function totalPaths(bound: number, stepLimit = 64): Map<string, Json> {
  const values = bound < TOTAL_VALUES.length ? TOTAL_VALUES : Array.from({ length: bound + 1 }, (_, k) => k + 1);
  const fn = totalIrO1(values);
  const solver = new BoundedSearch(new Map([["count", range(0, bound + 1)]]));
  const started = now();
  const paths = execute(fn, solver, stepLimit);
  const seconds = pyRound(now() - started, 3);
  const pairs: number[][] = [];
  for (const path of paths) {
    if (path.status !== "returned") continue;
    const model = solver.solve(path.condition);
    if (model === null) throw new Error("AssertionError");
    pairs.push([model.get("count")!, evaluate(path.returned!, model, fn.tables)]);
  }
  return new Map<string, Json>([
    ["bound", bound],
    ["pathCount", paths.length],
    ["returned", paths.filter((p) => p.status === "returned").length],
    ["truncated", paths.filter((p) => p.status === "truncated").length],
    ["seconds", seconds],
    ["evaluations", solver.evaluations],
    ["countSum", pairs.sort(cmpTuple)],
  ]);
}

export function explosionReport(): Json {
  return { bounded: [2, 4, 8].map((bound) => totalPaths(bound)), capped: totalPaths(64, 24) };
}

export function toolComparison(left: string, right: string, radiffName: string, ghidraName: string): Json {
  const objects = diffFixtures(left, right);
  const images = diffFixtures(left, right, true);
  const radiff = new Map(radiff2Fixture(radiffName).map((row) => [row.left, row] as [string, RadiffRow]));
  const ghidra = ghidraFixture(ghidraName);
  const rows: Json[] = [];
  for (const record of fixtureRecords(left)) {
    const name = record.name;
    const correlators = ghidra.matches
      .filter((m) => m.source === name && m.type === "Function")
      .map((m) => m.correlator)
      .sort();
    const row = radiff.get(name);
    rows.push({
      function: name,
      objectStage: objects.stageOf(name),
      imageStage: images.stageOf(name),
      radiff2: row !== undefined ? { verdict: row.verdict, ratio: row.ratio } : null,
      ghidra: correlators,
    });
  }
  return { left, right, rows, ghidraCorrelatorCounts: ghidra.correlators, ghidraBlocks: ghidra.blocks };
}

export function radare2RatioCheck(): Json {
  const byName = (records: FunctionRecord[]) => new Map(records.map((r) => [r.name, r] as [string, FunctionRecord]));
  const o0 = byName(fixtureRecords(LEVELS.O0));
  const o1 = byName(fixtureRecords(LEVELS.O1));
  const o2 = byName(fixtureRecords(LEVELS.O2));
  const gradeWithoutTable = functionRecord(loadFixture(LEVELS.O0), fixtureListing(LEVELS.O0), "grade");
  const [blocks] = buildCfg(gradeWithoutTable.instructions, gradeWithoutTable.start, gradeWithoutTable.end, []);
  gradeWithoutTable.blocks = blocks;
  const ratio = (a: Buffer, b: Buffer) => pyRound(radare2Ratio(a, b), 6);
  return {
    "percent_change O0 vs O1": ratio(o0.get("percent_change")!.raw, o1.get("percent_change")!.raw),
    "total O0 vs O1": ratio(o0.get("total")!.raw, o1.get("total")!.raw),
    "grade_label O0 vs O1": ratio(o0.get("grade_label")!.raw, o1.get("grade_label")!.raw),
    "total O1 vs O2": ratio(o1.get("total")!.raw, o2.get("total")!.raw),
    "grade O0 vs O1, 118 bytes": ratio(o0.get("grade")!.raw, o1.get("grade")!.raw),
    "grade O0 vs O1, 82 reachable bytes without the table": ratio(gradeWithoutTable.reachableBytes(), o1.get("grade")!.raw),
    fingerprintBytesWithoutTable: gradeWithoutTable.reachableBytes().length,
  };
}

const hexSpaced = (b: Buffer): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ");
const pyHex = (value: number): string => (value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`);

export function gradeRelocationCase(): Map<string, Json> {
  const leftElf = loadFixture(LEVELS.O1);
  const rightElf = loadFixture(LEVELS.O2);
  const leftImage = loadImage(leftElf);
  const rightImage = loadImage(rightElf);
  const left = functionRecord(leftElf, fixtureListing(LEVELS.O1), "grade", leftImage);
  const right = functionRecord(rightElf, fixtureListing(LEVELS.O2), "grade", rightImage);
  const leaLeft = left.relocations[0];
  if (leaLeft === undefined) throw new Error("StopIteration");
  const fieldLeft = left.raw.subarray(leaLeft.offset - left.start, leaLeft.offset - left.start + 4);
  const fieldRight = right.raw.subarray(leaLeft.offset - right.start, leaLeft.offset - right.start + 4);
  const layout = (image: Image) => new Map<string, Json>([...image.addresses].map(([name, a]) => [name, pyHex(a)] as [string, Json]));
  return new Map<string, Json>([
    ["layout", new Map<string, Json>([[LEVELS.O1, layout(leftImage)], [LEVELS.O2, layout(rightImage)]])],
    ["rodataShift", rightImage.addresses.get(".rodata")! - leftImage.addresses.get(".rodata")!],
    ["relocation", leaLeft.describe(leftElf)],
    ["fieldOffset", leaLeft.offset],
    ["fieldBytes", new Map<string, Json>([[LEVELS.O1, hexSpaced(fieldLeft)], [LEVELS.O2, hexSpaced(fieldRight)]])],
    ["displacements", new Map<string, Json>([[LEVELS.O1, fieldLeft.readInt32LE(0)], [LEVELS.O2, fieldRight.readInt32LE(0)]])],
    ["objectBytesEqual", functionRecord(leftElf, fixtureListing(LEVELS.O1), "grade").raw.equals(functionRecord(rightElf, fixtureListing(LEVELS.O2), "grade").raw)],
    ["imageBytesEqual", left.raw.equals(right.raw)],
    ["maskedImageBytesEqual", left.maskedBytes().equals(right.maskedBytes())],
  ]);
}

export function figureData(): Json {
  const objects = diffFixtures(LEVELS.O1, LEVELS.O2);
  const images = diffFixtures(LEVELS.O1, LEVELS.O2, true);
  const relocation = gradeRelocationCase();
  const column = (records: FunctionRecord[]): Json =>
    records.map((r) => ({ name: r.name, start: r.start, size: r.size, insns: r.instructions.length, blocks: r.blocks.length, edges: r.edges.length }));
  const view = (report: MatchReport): Json => ({
    matches: report.matches.map((m) => ({ left: m.left.name, right: m.right.name, stage: m.stage, agreeing: m.agreeing, similarity: pyRound(m.similarity, 3) })),
    unmatchedLeft: report.unmatchedLeft.map((f) => f.name),
    unmatchedRight: report.unmatchedRight.map((f) => f.name),
  });
  const tree = gradePaths("O0");
  const fn = gradeIrO0();
  const angr: Loose = angrFixture().objects?.[LEVELS.O0]?.grade?.returns ?? {};
  const z3: Loose = z3Fixture().grade?.returns ?? {};
  const treeReturns = tree.get("returns") as Map<string, Json>;
  const leaves: Json[] = [];
  for (const path of tree.get("paths") as { [key: string]: Json }[]) {
    const trace = path.trace as string[];
    const leaf = trace[trace.length - 1];
    const value = Number(path.returns);
    if (!Number.isInteger(value)) throw new Error(`ValueError: invalid literal for int(): ${path.returns}`);
    const hits = treeReturns.get(String(value)) as Map<string, Json>[] | undefined;
    if (hits === undefined) throw new Error(`KeyError: '${value}'`);
    const mine = hits.find((h) => h.get("leaf") === leaf) ?? null;
    const angrHit = (angr[String(value)] || [null])[0];
    const z3Hit = z3[String(value)];
    leaves.push({
      leaf,
      case: trace[trace.length - 2],
      returns: value,
      condition: path.condition,
      trace,
      bounded: mine ? new Map<string, Json>(["count", "min", "max", "sample"].map((k) => [k, mine.get(k)!] as [string, Json])) : null,
      angr: angrHit ? { min: angrHit.min, max: angrHit.max } : null,
      z3: z3Hit ? { min: z3Hit.min, max: z3Hit.max } : null,
    });
  }
  const hx = (v: number) => `0x${v.toString(16)}`;
  const edges: Json[] = [];
  for (const b of fn.blocks.values()) {
    for (const stmt of b.stmts) {
      if (stmt instanceof Branch) {
        edges.push({ from: hx(b.start), to: hx(stmt.target), cond: render(stmt.cond) });
        edges.push({ from: hx(b.start), to: hx(stmt.fallthrough), cond: "!(" + render(stmt.cond) + ")" });
      } else if (stmt instanceof Switch) {
        const byTarget = new Map<number, number[]>();
        stmt.targets.forEach((target, entry) => {
          if (!byTarget.has(target)) byTarget.set(target, []);
          byTarget.get(target)!.push(entry);
        });
        for (const [target, entries] of byTarget) {
          edges.push({ from: hx(b.start), to: hx(target), cond: entries.map((e) => `${render(stmt.index)} == ${e}`).join(" || ") });
        }
      } else if (stmt instanceof Jump) {
        edges.push({ from: hx(b.start), to: hx(stmt.target), cond: "" });
      }
    }
    if (b.next !== null) edges.push({ from: hx(b.start), to: hx(b.next), cond: "" });
  }
  const labels = new Map<string, Json>();
  for (const b of fn.blocks.values()) {
    const parts: string[] = [];
    for (const stmt of b.stmts) {
      if (stmt instanceof Assign && stmt.dst.name !== "local_8") parts.push(`${stmt.dst.name} = ${render(stmt.src)}`);
      else if (stmt instanceof Return) parts.push(`return ${render(stmt.value)}`);
      else if (stmt instanceof Switch) parts.push(`switch ${render(stmt.index)}`);
    }
    labels.set(hx(b.start), parts);
  }
  return {
    stages: STAGES.map((s) => ({ id: s.id, label: s.label, quality: s.quality, ghidra: s.ghidra })),
    left: { object: LEVELS.O1, functions: column(fixtureRecords(LEVELS.O1)) },
    right: { object: LEVELS.O2, functions: column(fixtureRecords(LEVELS.O2)) },
    views: { object: view(objects), image: view(images) },
    relocation: { shift: relocation.get("rodataShift")!, displacements: relocation.get("displacements")!, field: relocation.get("fieldOffset")! },
    tree: {
      function: "grade",
      object: LEVELS.O0,
      entry: "0x30",
      domain: tree.get("domain")!,
      labels,
      edges,
      leaves,
      pathCount: tree.get("pathCount")!,
    },
  };
}

export function demo(): Json {
  const pairs: [string, string, string, string][] = [
    [LEVELS.O0, LEVELS.O1, "radiff2-AC-O0-vs-O1.txt", "ghidra-vt-O0-vs-O1.txt"],
    [LEVELS.O1, LEVELS.O2, "radiff2-AC-O1-vs-O2.txt", "ghidra-vt-O1-vs-O2.txt"],
  ];
  const diffs: Json[] = [];
  const comparisons: Json[] = [];
  const radare2Ratios = radare2RatioCheck();
  const gradeRelocation = gradeRelocationCase();
  for (const [left, right, radiffName, ghidraName] of pairs) {
    diffs.push(diffFixtures(left, right).toDict());
    diffs.push(diffFixtures(left, right, true).toDict());
    comparisons.push(toolComparison(left, right, radiffName, ghidraName));
  }
  diffs.push(diffFixtures(LEVELS.O0, LEVELS.O1, false, BINDIFF_ORDER).toDict());
  const patch = diffFixtures(LEVELS.O1, "grade_case10_wrong.o").toDict();
  const symbolic = new Map<string, Json>([
    ["grade O0", gradePaths("O0")],
    ["grade O1", gradePaths("O1")],
    ["percent_change O1", percentChangePaths()],
    ["total O1", explosionReport()],
  ]);
  return { diffs, toolComparison: comparisons, patch, radare2Ratios, gradeRelocationCase: gradeRelocation, symbolic };
}

function withSuffix(path: string, suffix: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? path.slice(0, path.length - base.length + dot) : path;
  return stem + suffix;
}

export function main(argv: string[]): number {
  if (!argv.length) {
    console.log(dumps(demo(), 2));
    return 0;
  }
  const command = argv[0];
  if (command === "diff" && (argv.length === 3 || argv.length === 4)) {
    const loaded = argv.length === 4 && argv[3] === "--image";
    const [left, right] = [argv[1], argv[2]];
    const leftElf = readObject(left);
    const rightElf = readObject(right);
    const leftListing = parseListing(readFileSync(withSuffix(left, ".objdump.txt"), "utf-8"));
    const rightListing = parseListing(readFileSync(withSuffix(right, ".objdump.txt"), "utf-8"));
    const leftRecords = functionRecords(leftElf, leftListing, loaded ? loadImage(leftElf) : null);
    const rightRecords = functionRecords(rightElf, rightListing, loaded ? loadImage(rightElf) : null);
    console.log(dumps(matchFunctions(leftRecords, rightRecords).toDict(), 2));
    return 0;
  }
  if (command === "paths" && argv.length >= 2) {
    if (argv[1] === "grade") console.log(dumps(gradePaths(argv.length > 2 ? argv[2] : "O0"), 2));
    else if (argv[1] === "percent_change") console.log(dumps(percentChangePaths(), 2));
    else if (argv[1] === "total") console.log(dumps(totalPaths(argv.length > 2 ? Number.parseInt(argv[2], 10) : 2), 2));
    else {
      console.error("usage: main.py paths [grade O0|O1 | percent_change | total BOUND]");
      return 2;
    }
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData(), null));
    return 0;
  }
  console.error("usage: main.py [diff A.o B.o [--image] | paths FUNCTION ... | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
