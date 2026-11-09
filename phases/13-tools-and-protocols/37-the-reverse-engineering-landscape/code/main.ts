// Lesson: The Reverse Engineering Landscape: History, Tool Families, and How a Decompiler Is Built (phase 13 / lesson 37)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code/main.ts

import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Rec = { [key: string]: any };

const HERE = __dirname;
const FIXTURES = join(HERE, "fixtures");
const FIXTURE_OBJECTS = ["ledger-x86_64-O0.o", "ledger-x86_64-O1.o", "ledger-x86_64-O2.o", "sweep-trap.o"];
const TOOLS = ["llvm-objdump", "radare2", "rizin", "angr", "ghidra"];
const DESCENT_TOOLS = ["radare2", "rizin", "angr", "ghidra"];
const CAPTURE_SUFFIX: Record<string, string> = {
  "llvm-objdump": ".objdump.txt",
  radare2: ".radare2.json",
  rizin: ".rizin.json",
  angr: ".angr.json",
  ghidra: ".ghidra.json",
};
const LOCAL_BINARIES: Record<string, string[]> = { "llvm-objdump": ["llvm-objdump", "objdump"], radare2: ["r2", "radare2"], rizin: ["rizin"], ghidra: ["analyzeHeadless"] };

const SHT_SYMTAB = 2;
const STT_FUNC = 2;
const EM_X86_64 = 62;

class ElfError extends Error {}

function hx(value: number): string {
  return value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
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

function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function sortedNumbers(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

class FunctionSymbol {
  constructor(public name: string, public start: number, public size: number) {}

  get end(): number {
    return this.start + this.size;
  }

  covers(offset: number): boolean {
    return this.start <= offset && offset < this.end;
  }
}

class TextSection {
  constructor(public size: number, public functions: FunctionSymbol[]) {}

  function(name: string): FunctionSymbol {
    for (const symbol of this.functions) {
      if (symbol.name === name) return symbol;
    }
    throw new ElfError(`no function symbol named ${name}`);
  }

  gaps(): [number, number][] {
    const ranges: [number, number][] = [];
    let position = 0;
    for (const symbol of this.functions) {
      if (symbol.start > position) ranges.push([position, symbol.start]);
      position = symbol.end;
    }
    if (position < this.size) ranges.push([position, this.size]);
    return ranges;
  }

  owner(offset: number): FunctionSymbol | null {
    for (const symbol of this.functions) {
      if (symbol.covers(offset)) return symbol;
    }
    return null;
  }
}

function cstring(table: Buffer, offset: number): string {
  const end = table.indexOf(0, offset);
  return table.subarray(offset, end >= 0 ? end : table.length).toString("latin1").replace(/[^\x00-\x7f]/g, "\ufffd");
}

function readTextSymbols(path: string): TextSection {
  const data = readFileSync(path);
  if (!(data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46) || data[4] !== 2 || data[5] !== 1) {
    throw new ElfError("only ELF64 little-endian objects are supported");
  }
  const machine = data.readUInt16LE(18);
  if (machine !== EM_X86_64) throw new ElfError(`e_machine ${machine} is not x86-64`);
  const shoff = Number(data.readBigUInt64LE(40));
  const shentsize = data.readUInt16LE(58);
  const shnum = data.readUInt16LE(60);
  const shstrndx = data.readUInt16LE(62);
  const headers: number[][] = [];
  for (let index = 0; index < shnum; index++) {
    const base = shoff + index * shentsize;
    headers.push([
      data.readUInt32LE(base),
      data.readUInt32LE(base + 4),
      Number(data.readBigUInt64LE(base + 8)),
      Number(data.readBigUInt64LE(base + 16)),
      Number(data.readBigUInt64LE(base + 24)),
      Number(data.readBigUInt64LE(base + 32)),
      data.readUInt32LE(base + 40),
      data.readUInt32LE(base + 44),
      Number(data.readBigUInt64LE(base + 48)),
      Number(data.readBigUInt64LE(base + 56)),
    ]);
  }
  const names = data.subarray(headers[shstrndx][4], headers[shstrndx][4] + headers[shstrndx][5]);
  const textIndex = headers.findIndex((raw) => cstring(names, raw[0]) === ".text");
  if (textIndex < 0) throw new Error("StopIteration");
  const functions: FunctionSymbol[] = [];
  for (const raw of headers) {
    if (raw[1] !== SHT_SYMTAB) continue;
    const stringsHeader = headers[raw[6]];
    const strings = data.subarray(stringsHeader[4], stringsHeader[4] + stringsHeader[5]);
    for (let offset = 0; offset < raw[5]; offset += 24) {
      const at = raw[4] + offset;
      const stName = data.readUInt32LE(at);
      const stInfo = data[at + 4];
      const stShndx = data.readUInt16LE(at + 6);
      const stValue = Number(data.readBigUInt64LE(at + 8));
      const stSize = Number(data.readBigUInt64LE(at + 16));
      if ((stInfo & 0xf) === STT_FUNC && stShndx === textIndex) {
        functions.push(new FunctionSymbol(cstring(strings, stName), stValue, stSize));
      }
    }
  }
  return new TextSection(headers[textIndex][5], [...functions].sort((a, b) => a.start - b.start));
}

class Block {
  constructor(public start: number, public size: number, public instructions: number) {}

  get end(): number {
    return this.start + this.size;
  }
}

class FunctionView {
  constructor(
    public name: string,
    public start: number,
    public size: number,
    public fromSymbol: boolean,
    public blocks: Block[] | null,
    public edges: Set<string> = new Set(),
    public decompiled: string | null = null,
  ) {}

  get end(): number {
    return this.start + this.size;
  }
}

function edgeKey(a: number, b: number): string {
  return `${a},${b}`;
}

function edgePair(key: string): [number, number] {
  const [a, b] = key.split(",");
  return [Number(a), Number(b)];
}

class ToolView {
  constructor(
    public tool: string,
    public version: string,
    public fixture: string,
    public base: number,
    public instructions: Map<number, number>,
    public functions: Map<string, FunctionView>,
    public notes: string[] = [],
  ) {}

  claimed(): Set<number> {
    const claimed = new Set<number>();
    for (const [start, size] of this.instructions) {
      for (let offset = start; offset < start + size; offset++) claimed.add(offset);
    }
    return claimed;
  }

  startsIn(start: number, end: number): Set<number> {
    const result = new Set<number>();
    for (const address of this.instructions.keys()) {
      if (start <= address && address < end) result.add(address);
    }
    return result;
  }
}

function loadManifest(): Rec {
  return JSON.parse(readFileSync(join(FIXTURES, "captures.json"), "utf8"));
}

function parseObjdump(text: string, fixture: string, version = ""): ToolView {
  const instructions = new Map<number, number>();
  const labels: [number, string][] = [];
  for (const line of splitLines(text)) {
    const stripped = line.trim();
    if (stripped.endsWith(">:") && stripped.includes(" <")) {
      const cut = stripped.indexOf(" <");
      const addressText = stripped.slice(0, cut);
      const rest = stripped.slice(cut + 2);
      labels.push([parseInt(addressText, 16), rest.slice(0, -2)]);
      continue;
    }
    if (!line.includes(":") || !line.includes("\t")) continue;
    const head = line.slice(0, line.indexOf("\t")).trim();
    const colon = head.indexOf(":");
    const addressText = colon >= 0 ? head.slice(0, colon) : head;
    const byteText = colon >= 0 ? head.slice(colon + 1) : "";
    if (!addressText || ![...addressText].every((c) => "0123456789abcdef".includes(c))) continue;
    const pieces = byteText.trim() === "" ? [] : byteText.trim().split(/\s+/);
    instructions.set(parseInt(addressText, 16), pieces.length);
  }
  const functions = new Map<string, FunctionView>();
  labels.forEach(([start, name], position) => {
    let following: number;
    if (position + 1 < labels.length) {
      following = labels[position + 1][0];
    } else if (instructions.size > 0) {
      following = Math.max(...[...instructions].map(([a, n]) => a + n));
    } else {
      following = start;
    }
    functions.set(name, new FunctionView(name, start, following - start, true, null));
  });
  return new ToolView("llvm-objdump", version, fixture, 0, instructions, functions, ["linear sweep: no blocks, no edges, labels come from the symbol table"]);
}

function edgesFromR2Blocks(blocks: Rec[], base: number, start: number, end: number): Set<string> {
  const edges = new Set<string>();
  for (const block of blocks) {
    const source = block.addr - base;
    const targets: number[] = ["jump", "fail"].filter((key) => block[key]).map((key) => block[key]);
    if ("switch_op" in block) {
      for (const item of block.switch_op.cases ?? []) targets.push(item.jump);
    }
    for (const target of targets) {
      const offset = target - base;
      if (start <= offset && offset < end) edges.add(edgeKey(source, offset));
    }
  }
  return edges;
}

function getOr(record: Rec, key: string, fallback: any): any {
  return key in record ? record[key] : fallback;
}

function parseR2Family(record: Rec, fixture: string): ToolView {
  const commands = record.commands;
  const textSection = (commands["iSj"].output as Rec[]).find((s) => s.name === ".text");
  if (textSection === undefined) throw new Error("StopIteration");
  const base: number = textSection.vaddr;
  const functions = new Map<string, FunctionView>();
  const instructions = new Map<number, number>();
  const notes: string[] = [];
  for (const entry of commands["aaa; aflj"].output as Rec[]) {
    const address: number = getOr(entry, "addr", entry.offset);
    const name: string = entry.name.startsWith("sym.") ? entry.name.slice(4) : entry.name;
    const start = address - base;
    const size: number = entry.size;
    const rawBlocks: Rec[] = commands[`aaa; afbj @ ${hx(address)}`].output;
    for (const op of commands[`aaa; pdfj @ ${hx(address)}`].output.ops as Rec[]) {
      const opAddress: number = getOr(op, "addr", op.offset);
      instructions.set(opAddress - base, op.size);
    }
    const blocks = rawBlocks.map((b) => new Block(b.addr - base, b.size, b.ninstr));
    const edges = edgesFromR2Blocks(rawBlocks, base, start, start + size);
    if (rawBlocks.some((b) => "switch_op" in b)) {
      const cases = rawBlocks.filter((b) => "switch_op" in b).reduce((total, b) => total + b.switch_op.cases.length, 0);
      notes.push(`${name}: jump table resolved as switch_op with ${cases} cases`);
    }
    const pdc = getOr(commands, `aaa; pdc @ ${hx(address)}`, {});
    const pseudo = pdc.output ?? null;
    functions.set(name, new FunctionView(name, start, size, !name.startsWith("fcn."), blocks, edges, pseudo));
  }
  return new ToolView(record.tool, record.version, fixture, base, instructions, functions, notes);
}

function parseAngr(record: Rec, fixture: string): ToolView {
  const base: number = record.sections[".text"].vaddr;
  const textSize: number = record.sections[".text"].size;
  const functions = new Map<string, FunctionView>();
  const instructions = new Map<number, number>();
  const notes: string[] = [];
  for (const entry of record.functions as Rec[]) {
    const start = entry.addr - base;
    const blocks: Block[] = [];
    for (const block of entry.blocks as Rec[]) {
      blocks.push(new Block(block.addr - base, block.size, block.instructions.length));
      for (const insn of block.instructions as Rec[]) instructions.set(insn.addr - base, insn.size);
    }
    const edges = new Set<string>();
    for (const edge of entry.edges as Rec[]) {
      if (edge.type === "transition" && !edge.outside && edge.target === "BlockNode") {
        edges.add(edgeKey(edge.from - base, edge.to - base));
      } else if (edge.target === "HookNode") {
        notes.push(`${entry.name}: transfer at ${hx(edge.from - base)} leads to an unresolvable target node`);
      }
    }
    if (!entry.fromSymbol) notes.push(`${entry.name}: function invented at ${hx(start)}, ${entry.size} bytes, no symbol`);
    functions.set(entry.name, new FunctionView(entry.name, start, entry.size, entry.fromSymbol, blocks, edges, entry.decompiled ?? null));
  }
  for (const item of (record.memoryData ?? []) as Rec[]) {
    const offset = item.addr - base;
    if (0 <= offset && offset < textSize) notes.push(`memory data recorded inside .text at ${hx(offset)}, ${item.size} bytes, sort ${item.sort}`);
  }
  const version: string = record.versions.angr;
  return new ToolView("angr", version, fixture, base, instructions, functions, notes);
}

function parseGhidra(record: Rec, fixture: string): ToolView {
  const textBlock = (record.memoryBlocks as Rec[]).find((b) => b.name === ".text");
  if (textBlock === undefined) throw new Error("StopIteration");
  const base: number = textBlock.start;
  const functions = new Map<string, FunctionView>();
  const instructions = new Map<number, number>();
  const notes: string[] = [];
  for (const entry of record.functions as Rec[]) {
    const start = entry.entry - base;
    const bodyMin = entry.bodyMin - base;
    const bodyMax = entry.bodyMax - base;
    for (const insn of entry.instructions as Rec[]) instructions.set(insn.addr - base, insn.size);
    const blocks: Block[] = [];
    const edges = new Set<string>();
    for (const block of entry.blocks as Rec[]) {
      const blockStart = block.start - base;
      const count = (entry.instructions as Rec[]).filter((insn) => blockStart <= insn.addr - base && insn.addr - base < blockStart + block.size).length;
      blocks.push(new Block(blockStart, block.size, count));
      for (const destination of block.destinations as Rec[]) {
        const flow: string = destination.flow;
        const target = destination.to - base;
        if (flow.includes("CALL")) continue;
        if (bodyMin <= target && target <= bodyMax) edges.add(edgeKey(blockStart, target));
        if (flow.includes("COMPUTED")) notes.push(`${entry.name}: computed jump at block ${hx(blockStart)} resolved to ${hx(target)}`);
      }
    }
    functions.set(entry.name, new FunctionView(entry.name, start, entry.bodySize, entry.symbolSource === "IMPORTED", blocks, edges, entry.decompiled ?? null));
  }
  for (const symbol of (record.symbols ?? []) as Rec[]) {
    if (symbol.type === "Label" && symbol.name.startsWith("switchD")) notes.push(`switch label ${symbol.name} at ${hx(symbol.addr - base)}`);
  }
  return new ToolView("ghidra", record.version, fixture, base, instructions, functions, notes);
}

const PARSERS: Record<string, (record: Rec, fixture: string) => ToolView> = {
  radare2: parseR2Family,
  rizin: parseR2Family,
  angr: parseAngr,
  ghidra: parseGhidra,
};

function loadView(tool: string, fixture: string): ToolView | null {
  const path = join(FIXTURES, fixture.replaceAll(".o", CAPTURE_SUFFIX[tool]));
  if (!existsSync(path)) return null;
  if (tool === "llvm-objdump") {
    const version: string = loadManifest().tools["llvm-objdump"]?.version ?? "";
    return parseObjdump(readFileSync(path, "utf8"), fixture, version);
  }
  return PARSERS[tool](JSON.parse(readFileSync(path, "utf8")), fixture);
}

function loadViews(fixture: string): Map<string, ToolView> {
  const views = new Map<string, ToolView>();
  for (const tool of TOOLS) {
    const view = loadView(tool, fixture);
    if (view !== null) views.set(tool, view);
  }
  return views;
}

function majority(sets: Set<number>[]): Set<number> {
  const counts = new Map<number, number>();
  for (const members of sets) {
    for (const member of members) counts.set(member, (counts.get(member) ?? 0) + 1);
  }
  const result = new Set<number>();
  for (const [member, count] of counts) if (count * 2 > sets.length) result.add(member);
  return result;
}

function ranges(offsets: Set<number>): [number, number][] {
  const result: [number, number][] = [];
  for (const offset of sortedNumbers(offsets)) {
    if (result.length > 0 && result[result.length - 1][1] === offset) {
      result[result.length - 1] = [result[result.length - 1][0], offset + 1];
    } else {
      result.push([offset, offset + 1]);
    }
  }
  return result;
}

function hexRanges(offsets: Set<number>): string[] {
  return ranges(offsets).map(([a, b]) => `${hx(a)}-${hx(b)}`);
}

function difference(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => !b.has(x)));
}

function intersection(a: Set<number>, b: Set<number>): Set<number> {
  return new Set([...a].filter((x) => b.has(x)));
}

function functionReport(text: TextSection, symbol: FunctionSymbol, views: Map<string, ToolView>, descent: string[]): Rec {
  const starts = new Map<string, Set<number>>();
  for (const [tool, view] of views) starts.set(tool, view.startsIn(symbol.start, symbol.end));
  const agreed = majority(descent.map((tool) => starts.get(tool)!));
  const differences: Rec = {};
  for (const [tool, found] of starts) {
    if (!setsEqual(found, agreed)) {
      differences[tool] = { extra: sortedNumbers(difference(found, agreed)).map(hx), missing: sortedNumbers(difference(agreed, found)).map(hx) };
    }
  }
  const blocks: Rec = {};
  const blockStarts: Rec = {};
  const edges: Rec = {};
  const edgeSets = new Map<string, Set<string>>();
  for (const [tool, view] of views) {
    const fn = view.functions.get(symbol.name);
    if (fn === undefined || fn.blocks === null) continue;
    blocks[tool] = fn.blocks.length;
    blockStarts[tool] = [...fn.blocks].sort((a, b) => a.start - b.start).map((b) => hx(b.start));
    edges[tool] = fn.edges.size;
    edgeSets.set(tool, new Set(fn.edges));
  }
  const edgeUnion = new Set<string>();
  for (const found of edgeSets.values()) for (const edge of found) edgeUnion.add(edge);
  const edgeDifferences: Rec = {};
  for (const [tool, found] of edgeSets) {
    const missing = [...edgeUnion].filter((edge) => !found.has(edge)).map(edgePair);
    if (missing.length > 0) {
      missing.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      edgeDifferences[tool] = missing.map(([a, b]) => `${hx(a)}->${hx(b)}`);
    }
  }
  const found: Rec = {};
  for (const [tool, view] of views) found[tool] = view.functions.has(symbol.name);
  const perTool: Rec = {};
  for (const [tool, set] of starts) perTool[tool] = set.size;
  const distinctEdgeSets = new Set([...edgeSets.values()].map((set) => [...set].sort().join(";")));
  return {
    extent: `${hx(symbol.start)}-${hx(symbol.end)}`,
    size: symbol.size,
    found,
    instructionStarts: {
      agreed: agreed.size,
      perTool,
      allDescentToolsAgree: descent.every((tool) => setsEqual(starts.get(tool)!, agreed)),
      differences,
    },
    blocks,
    blockStarts,
    blocksAgree: new Set(Object.values(blocks)).size <= 1,
    edges,
    edgesAgree: distinctEdgeSets.size <= 1,
    edgesMissingPerTool: edgeDifferences,
  };
}

function functionStartReport(text: TextSection, views: Map<string, ToolView>): Rec {
  const symbols = new Map<string, number>();
  for (const s of text.functions) symbols.set(s.name, s.start);
  const symbolStarts = new Set(symbols.values());
  const report: Rec = {};
  for (const [tool, view] of views) {
    const found = new Map<string, number>();
    for (const [name, f] of view.functions) found.set(name, f.start);
    const foundStarts = new Set(found.values());
    const invented = [...found].sort((a, b) => a[1] - b[1]).filter(([, start]) => !symbolStarts.has(start)).map(([name, start]) => `${name}@${hx(start)}`);
    const missed = [...symbols].filter(([, start]) => !foundStarts.has(start)).map(([name]) => name);
    report[tool] = { found: found.size, invented, missed };
  }
  return report;
}

function byteReport(text: TextSection, views: Map<string, ToolView>, descent: string[]): Rec {
  const claimed = new Map<string, Set<number>>();
  for (const [tool, view] of views) claimed.set(tool, view.claimed());
  const agreed = majority(descent.map((tool) => claimed.get(tool)!));
  const symbolBytes = new Set<number>();
  for (const symbol of text.functions) for (let offset = symbol.start; offset < symbol.end; offset++) symbolBytes.add(offset);
  const gapBytes = new Set<number>();
  for (const [a, b] of text.gaps()) for (let offset = a; offset < b; offset++) gapBytes.add(offset);
  const report: Rec = {};
  for (const [tool, bytesClaimed] of claimed) {
    report[tool] = {
      codeBytesInsideSymbols: intersection(bytesClaimed, symbolBytes).size,
      paddingBytesClaimed: intersection(bytesClaimed, gapBytes).size,
      symbolBytesUnclaimed: hexRanges(difference(symbolBytes, bytesClaimed)),
      invents: hexRanges(difference(bytesClaimed, agreed)),
      misses: hexRanges(intersection(difference(agreed, bytesClaimed), symbolBytes)),
    };
  }
  report.dataInsideSymbols = hexRanges(difference(symbolBytes, agreed));
  report.symbolBytes = symbolBytes.size;
  report.paddingBytes = gapBytes.size;
  return report;
}

function findings(text: TextSection, views: Map<string, ToolView>, bytesReport: Rec, startsReport: Rec): string[] {
  const lines: string[] = [];
  for (const tool of views.keys()) {
    const entry = bytesReport[tool];
    for (const span of entry.invents as string[]) lines.push(`${tool} decodes bytes ${span} that most graph builders treat as data or padding`);
    for (const span of entry.misses as string[]) {
      const a = parseInt(span.split("-")[0], 16);
      const owner = text.owner(a);
      lines.push(`${tool} never reaches bytes ${span} inside ${owner ? owner.name : "?"} that the other graph builders decode`);
    }
    for (const name of startsReport[tool].invented as string[]) lines.push(`${tool} invents a function ${name} with no symbol`);
    for (const name of startsReport[tool].missed as string[]) lines.push(`${tool} misses the function ${name}`);
  }
  for (const span of bytesReport.dataInsideSymbols as string[]) lines.push(`no graph builder decodes ${span}; those bytes sit inside a function and are data`);
  return lines;
}

function compare(fixture: string): Rec {
  const text = readTextSymbols(join(FIXTURES, fixture));
  const views = loadViews(fixture);
  const descent = DESCENT_TOOLS.filter((tool) => views.has(tool));
  const startsReport = functionStartReport(text, views);
  const bytesReport = byteReport(text, views, descent);
  const symbols: Rec = {};
  for (const s of text.functions) symbols[s.name] = `${hx(s.start)}-${hx(s.end)}`;
  const tools: Rec = {};
  const bases: Rec = {};
  const notes: Rec = {};
  for (const [tool, view] of views) {
    tools[tool] = view.version;
    bases[tool] = hx(view.base);
    if (view.notes.length > 0) notes[tool] = view.notes;
  }
  const functions: Rec = {};
  for (const symbol of text.functions) functions[symbol.name] = functionReport(text, symbol, views, descent);
  return {
    fixture,
    textSize: text.size,
    symbols,
    padding: text.gaps().map(([a, b]) => `${hx(a)}-${hx(b)}`),
    tools,
    bases,
    functionStarts: startsReport,
    functions,
    bytes: bytesReport,
    notes,
    findings: findings(text, views, bytesReport, startsReport),
  };
}

const REGISTERS_64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi"];
const REGISTERS_32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"];
const VEX_GUEST_OFFSET: Record<string, number> = { rax: 16, rcx: 24, rdx: 32, rbx: 40, rsp: 48, rbp: 56, rsi: 64, rdi: 72, cc_op: 144, cc_dep1: 152, cc_dep2: 160, cc_ndep: 168 };
const VEX_CC_OP_SUB: Record<number, number> = { 8: 5, 16: 6, 32: 7, 64: 8 };

class TranslateError extends Error {}

class SmallInstruction {
  constructor(
    public hex: string,
    public kind: string,
    public text: string,
    public destination: string,
    public source: string,
    public width: number,
    public immediate: number | null,
  ) {}
}

function decodeSmall(code: Buffer): SmallInstruction {
  let position = 0;
  let rexW = false;
  if (code.length > 0 && 0x40 <= code[0] && code[0] <= 0x4f) {
    rexW = Boolean(code[0] & 0x8);
    if (code[0] & 0x7) throw new TranslateError("REX.R, REX.X, and REX.B are outside this translator");
    position = 1;
  }
  if (code.length < position + 2) throw new TranslateError("instruction too short");
  const opcode = code[position];
  const modrm = code[position + 1];
  const mod = modrm >> 6;
  const reg = (modrm >> 3) & 7;
  const rm = modrm & 7;
  if (mod !== 3) throw new TranslateError("only the register form (mod = 11) is translated");
  const width = rexW ? 64 : 32;
  const names = rexW ? REGISTERS_64 : REGISTERS_32;
  if (opcode === 0x83 && (reg === 5 || reg === 7)) {
    if (code.length !== position + 3) throw new TranslateError("83 /digit ib needs exactly one immediate byte");
    const immediate = code.readInt8(position + 2);
    const kind = reg === 5 ? "sub" : "cmp";
    const suffix = rexW ? "q" : "l";
    return new SmallInstruction(code.toString("hex"), kind, `${kind}${suffix} $${hx(immediate)}, %${names[rm]}`, names[rm], names[rm], width, immediate);
  }
  if (opcode === 0x63 && rexW) {
    if (code.length !== position + 2) throw new TranslateError("63 /r has no immediate");
    return new SmallInstruction(code.toString("hex"), "movsxd", `movslq %${REGISTERS_32[rm]}, %${REGISTERS_64[reg]}`, REGISTERS_64[reg], REGISTERS_32[rm], 64, null);
  }
  throw new TranslateError(`opcode ${opcode.toString(16).padStart(2, "0")} with /${reg} is outside this translator`);
}

function toPcodeLike(instruction: SmallInstruction): string[] {
  const destination = instruction.destination.toUpperCase();
  if (instruction.kind === "movsxd") return [`${destination} = sext(${instruction.source.toUpperCase()})`];
  const immediate = hx(instruction.immediate ?? 0);
  const result = instruction.kind === "sub" ? destination : "tmp";
  const lines = [`CF = ${destination} < ${immediate}`, `OF = sborrow(${destination}, ${immediate})`, `${result} = ${destination} - ${immediate}`];
  lines.push(`SF = ${result} s< 0x0`, `ZF = ${result} == 0x0`, `PF = popcount(${result} & 0xff) & 0x1 == 0x0`);
  return lines;
}

function toVexLike(instruction: SmallInstruction): string[] {
  const source64 = REGISTERS_32.includes(instruction.source) ? REGISTERS_64[REGISTERS_32.indexOf(instruction.source)] : instruction.source;
  const lines = [`t0 = GET:I64(${source64})`];
  if (instruction.kind === "movsxd") return [...lines, "t1 = 64to32(t0)", "t2 = 32Sto64(t1)", `PUT(${instruction.destination}) = t2`];
  const immediate = hx(instruction.immediate ?? 0);
  const ccOp = hx(VEX_CC_OP_SUB[instruction.width]);
  if (instruction.width === 64) {
    lines.push(`t1 = Sub64(t0, ${immediate})`, `PUT(cc_op) = ${ccOp}`, "PUT(cc_dep1) = t0", `PUT(cc_dep2) = ${immediate}`, "PUT(cc_ndep) = 0x0");
    if (instruction.kind === "sub") lines.push(`PUT(${instruction.destination}) = t1`);
    return lines;
  }
  lines.push("t1 = 64to32(t0)", `PUT(cc_op) = ${ccOp}`, "t2 = 32Uto64(t1)", "PUT(cc_dep1) = t2", `PUT(cc_dep2) = ${immediate}`, "PUT(cc_ndep) = 0x0");
  if (instruction.kind === "sub") {
    lines.push(`t3 = Sub32(t1, ${immediate})`);
    lines.push(`PUT(${instruction.destination}) = 32Uto64(t3)`);
  }
  return lines;
}

function fromHex(text: string): Buffer {
  const clean = text.replaceAll(" ", "");
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) throw new Error(`non-hexadecimal number found in fromhex() arg`);
  return Buffer.from(clean, "hex");
}

function translate(hexText: string): Rec {
  const instruction = decodeSmall(fromHex(hexText));
  const pcode = toPcodeLike(instruction);
  const vex = toVexLike(instruction);
  return {
    hex: instruction.hex,
    text: instruction.text,
    kind: instruction.kind,
    width: instruction.width,
    pcodeLike: pcode,
    vexLike: vex,
    flags: {
      pcodeLike: pcode.some((line) => ["CF", "OF", "SF", "ZF", "PF"].some((flag) => line.startsWith(flag))) ? "eager" : "none",
      vexLike: vex.some((line) => line.includes("cc_op")) ? "thunk" : "none",
    },
    statements: { pcodeLike: pcode.length, vexLike: vex.length },
  };
}

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function observedIr(): Rec {
  const report = JSON.parse(readFileSync(join(FIXTURES, "ir-lifts.json"), "utf8"));
  const rows: Rec[] = [];
  for (const item of report.instructions as Rec[]) {
    const vexStatements = (item.vex as string[]).filter((s) => !s.startsWith("------ IMark"));
    const pcodeOps = (item.pcode as string[]).filter((s) => !s.startsWith("IMARK"));
    const ccLine = vexStatements.find((s) => s.startsWith(`PUT(offset=${VEX_GUEST_OFFSET.cc_op})`));
    const ccOp = ccLine === undefined ? null : parseInt(ccLine.slice(ccLine.lastIndexOf("=") + 1).trim(), 16);
    const esil: string = item.esil;
    const rzil: string = item.rzil;
    rows.push({
      name: item.name,
      hex: item.hex,
      att: item.att,
      esil: { tokens: esil.split(",").length, writesFlags: ["zf", "cf", "of", "sf", "pf"].some((flag) => esil.includes(`,${flag},:=`) || esil.includes(`,${flag},=`)) },
      rzil: { sets: countOf(rzil, "(set "), writesFlags: rzil.includes("(set zf") || rzil.includes("(set cf") },
      pcode: { ops: pcodeOps.length, writesFlags: pcodeOps.some((s) => ["CF ", "OF ", "SF ", "ZF ", "PF "].some((flag) => s.startsWith(flag))) },
      vex: { statements: vexStatements.length, ccOp, computesFlags: vexStatements.some((s) => ["CF", "OF", "SF", "ZF", "PF"].some((flag) => s.startsWith(flag))) },
    });
  }
  return { versions: report.versions, instructions: rows };
}

function which(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
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

function pythonHasModule(module: string): boolean {
  const python = which("python3");
  if (python === null) return false;
  const probe = spawnSync(python, ["-c", `import importlib.util, sys; sys.exit(0 if importlib.util.find_spec(${JSON.stringify(module)}) else 1)`], { stdio: "ignore", timeout: 60000 });
  return probe.status === 0;
}

function localTools(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [tool, names] of Object.entries(LOCAL_BINARIES)) {
    let path: string | null = null;
    for (const name of names) {
      path = which(name);
      if (path) break;
    }
    found[tool] = path || "absent";
  }
  found.angr = pythonHasModule("angr") ? "importable" : "absent";
  return found;
}

const TIMELINE = [
  { year: 1973, label: "Hollander (Stanford) and Housel (Purdue) write the first decompilation theses", family: "research", tool: null },
  { year: 1977, label: "adb tutorial at Bell Labs; the debugger ships with UNIX V7 in 1979", family: "debugger", tool: null },
  { year: 1981, label: "DEBUG with an 8086 disassembler ships in PC-DOS 1.00", family: "debugger", tool: null },
  { year: 1986, label: "GDB enters distribution", family: "debugger", tool: null },
  { year: 1988, label: "Sourcer commenting disassembler; first GNU binutils snapshots", family: "disassembler", tool: null },
  { year: 1991, label: "IDA 0.1 released as shareware on 20 May", family: "disassembler", tool: "ida" },
  { year: 1994, label: "Cifuentes, Reverse Compilation Techniques; the dcc decompiler", family: "decompiler", tool: null },
  { year: 1997, label: "REC, Reverse Engineering Compiler 1.1", family: "decompiler", tool: null },
  { year: 2002, label: "Boomerang open-source decompiler, first code", family: "decompiler", tool: null },
  { year: 2004, label: "Flake, Structural Comparison of Executable Objects; BinDiff goes on sale", family: "diffing", tool: null },
  { year: 2006, label: "radare starts as a forensic hex editor", family: "disassembler", tool: "radare2" },
  { year: 2007, label: "Hex-Rays Decompiler 1.0; Van Emmerik, SSA for decompilation", family: "decompiler", tool: "ida" },
  { year: 2009, label: "radare2 r2-0.1, the modular rewrite, LGPL-3.0", family: "framework", tool: "radare2" },
  { year: 2010, label: "LLDB announced as an LLVM subproject", family: "debugger", tool: null },
  { year: 2011, label: "BAP (CAV); Google acquires zynamics; Hopper appears", family: "framework", tool: null },
  { year: 2012, label: "Compiler Explorer starts", family: "compiler-side", tool: null },
  { year: 2013, label: "angr first line of code; Phoenix decompiler (USENIX Security)", family: "framework", tool: "angr" },
  { year: 2015, label: "DREAM, No More Gotos (NDSS)", family: "research", tool: null },
  { year: 2015, label: "Vector 35 founded; Binary Ninja prototype", family: "disassembler", tool: "binja" },
  { year: 2015, label: "angr released publicly under BSD-2-Clause", family: "framework", tool: "angr" },
  { year: 2016, label: "Binary Ninja on sale with LLIL and a Python API", family: "disassembler", tool: "binja" },
  { year: 2016, label: "BinDiff free of charge; angr SoK paper (IEEE S&P)", family: "diffing", tool: null },
  { year: 2017, label: "Cutter 1.0, a Qt GUI for radare2", family: "disassembler", tool: "radare2" },
  { year: 2017, label: "IDA 7.0 native 64-bit; Binary Ninja MLIL", family: "disassembler", tool: "ida" },
  { year: 2018, label: "Guilfanov, Decompiler internals: microcode (Recon)", family: "decompiler", tool: "ida" },
  { year: 2019, label: "Ghidra 9.0 released by NSA under Apache-2.0", family: "decompiler", tool: "ghidra" },
  { year: 2019, label: "angr 8.19.2.4 adds a preliminary decompiler", family: "decompiler", tool: "angr" },
  { year: 2020, label: "Binary Ninja 2.0 with the HLIL decompiler", family: "decompiler", tool: "binja" },
  { year: 2020, label: "Rizin announced as a fork of radare2; the Cutter team joins", family: "framework", tool: "rizin" },
  { year: 2021, label: "IDA Freeware 7.6 with a cloud x64 decompiler", family: "decompiler", tool: "ida" },
  { year: 2021, label: "Cutter 2.0 on rizin; iaito continues for radare2", family: "disassembler", tool: "rizin" },
  { year: 2023, label: "BinDiff 8 open-sourced under Apache-2.0", family: "diffing", tool: null },
  { year: 2024, label: "SAILR becomes the default angr structurer (USENIX Security)", family: "research", tool: "angr" },
  { year: 2024, label: "Binary Ninja 4.0 with the Free edition; IDA 9.0 with idalib", family: "disassembler", tool: "binja" },
  { year: 2025, label: "Ghidra 12.0", family: "decompiler", tool: "ghidra" },
  { year: 2025, label: "Binary Ninja 5.0; DecompileBench (ACL Findings)", family: "research", tool: "binja" },
  { year: 2026, label: "Ghidra 12.1.4 (21 Sep)", family: "decompiler", tool: "ghidra" },
  { year: 2026, label: "radare2 6.2.4 (5 Oct)", family: "framework", tool: "radare2" },
  { year: 2026, label: "rizin 0.9.1 and Cutter 2.5.0 (June)", family: "framework", tool: "rizin" },
  { year: 2026, label: "Binary Ninja 6.0 Krypton (3 Sep)", family: "disassembler", tool: "binja" },
  { year: 2026, label: "IDA 9.4 (13 Jul)", family: "disassembler", tool: "ida" },
  { year: 2026, label: "angr 10.0.3 (10 Oct)", family: "framework", tool: "angr" },
  { year: 2026, label: "LLM decompiler studies: readability metrics; recompile more, preserve less", family: "research", tool: null },
];

const STAGES = [
  { id: "loader", label: "Loader", what: "Parse the container, map sections, read symbols and relocations." },
  { id: "disassembly", label: "Disassembly", what: "Decode bytes into instructions and decide where code starts." },
  { id: "cfg", label: "CFG recovery", what: "Cut instructions into basic blocks and add the edges." },
  { id: "lifting", label: "Lifting", what: "Translate each instruction into a machine-independent form." },
  { id: "ssa", label: "SSA", what: "Give every definition one name so each use points at one definition." },
  { id: "dataflow", label: "Data flow and types", what: "Propagate constants, remove dead code, recover arguments, variables, and types." },
  { id: "structuring", label: "Structuring", what: "Turn the graph back into if, while, and switch, with goto for the rest." },
  { id: "emission", label: "Emission", what: "Print the result as C-like text with names and casts." },
];

const FIGURE_TOOLS = [
  { id: "ghidra", label: "Ghidra", maker: "NSA", version: "12.1.4", licence: "Apache-2.0", ran: true },
  { id: "binja", label: "Binary Ninja", maker: "Vector 35", version: "6.0", licence: "commercial, Free edition", ran: false },
  { id: "ida", label: "IDA / Hex-Rays", maker: "Hex-Rays", version: "9.4", licence: "commercial, IDA Free", ran: false },
  { id: "radare2", label: "radare2", maker: "radareorg", version: "6.2.4", licence: "LGPL-3.0", ran: true },
  { id: "rizin", label: "rizin", maker: "rizinorg", version: "0.9.1", licence: "LGPL-3.0", ran: true },
  { id: "angr", label: "angr", maker: "UCSB SecLab, ASU SEFCOM", version: "10.0.3", licence: "BSD-2-Clause", ran: true },
];

const TERMS: Record<string, Record<string, string>> = {
  loader: {
    ghidra: "ElfLoader, MachoLoader, PeLoader; .ldefs picks the language",
    binja: "BinaryView, BinaryViewType",
    ida: "Loader module (LDSC)",
    radare2: "RBin (rabin2)",
    rizin: "RzBin (rz-bin)",
    angr: "CLE (cle.Loader, main_object)",
  },
  disassembly: {
    ghidra: "Disassembler; SLEIGH .slaspec to .sla; Disassemble Entry Points, Function Start Search",
    binja: "Architecture plugin; Recursive Descent, then linear sweep phases",
    ida: "Processor module (ana.cpp, emu.cpp, out.cpp); autoanalysis queues; FLIRT",
    radare2: "RArch plugin to RAnalOp; aa, aaa, af",
    rizin: "RzAnalysis plugin; aa, aaa, af",
    angr: "Capstone blocks; CFGFast function start search",
  },
  cfg: {
    ghidra: "Generate Basic Blocks and the CFG; BlockGraph; Decompiler Switch Analysis",
    binja: "Function, BasicBlock; CFG Analysis phase",
    ida: "mbl_graph_t, ready at MMAT_LOCOPT",
    radare2: "afb, agf, aab",
    rizin: "afb, agf, aab (Nucleus)",
    angr: "CFGFast, CFGEmulated; kb.functions; IRSB",
  },
  lifting: {
    ghidra: "Generate Raw P-code; Varnodes in ram, register, const, unique",
    binja: "Lifted IL to LLIL to Mapped MLIL to MLIL",
    ida: "microcode (minsn_t, mop_t); MMAT_GENERATED",
    radare2: "ESIL (asm.esil, ae)",
    rizin: "RzIL (aoi, aez)",
    angr: "VEX (pyvex.lift, IRSB), then AIL",
  },
  ssa: {
    ghidra: "Heritage, ActionHeritage; MULTIEQUAL, INDIRECT",
    binja: "LLIL SSA, MLIL SSA, HLIL SSA; HLIL_VAR_PHI",
    ida: "no named SSA; use-def data flow in MMAT_GLBOPT1 to 3",
    radare2: "none; ESIL is built for emulation",
    rizin: "none; RzIL is built for emulation",
    angr: "_stage_transform_to_ssa_level0 and level1; SeqNodeDephication",
  },
  dataflow: {
    ghidra: "ActionDeadCode, ActionInferTypes, Rule pool; prototype from .cspec",
    binja: "MLIL constant propagation, variables and types; analyzeReturns",
    ida: "Transform microcode; MMAT_CALLS, MMAT_GLBOPT, MMAT_LVARS; TIL",
    radare2: "afv, afc, aaft; ESIL emulation",
    rizin: "afv, afc, aft",
    angr: "CallingConventionAnalysis, VariableRecoveryFast, Typehoon",
  },
  structuring: {
    ghidra: "CollapseStructure; BlockIf, BlockWhileDo, BlockSwitch, BlockGoto",
    binja: "HLIL_IF, HLIL_WHILE, HLIL_SWITCH; AST at root",
    ida: "Generate ctree; structural analysis; goto regions",
    radare2: "pdc (ESIL plus pseudo); pdd (r2dec); pdg (r2ghidra)",
    rizin: "pdg (rz-ghidra); jsdec",
    angr: "RegionIdentifier; RecursiveStructurer with SAILRStructurer",
  },
  emission: {
    ghidra: "Emit Final C Tokens; PrintC, ActionNameVars, ActionSetCasts",
    binja: "HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python",
    ida: "Beautify ctree; Print ctree; cfunc_t",
    radare2: "text of pdc, pdd, pdg",
    rizin: "pdg text",
    angr: "CStructuredCodeGenerator; codegen.text",
  },
};

function figureData(): Rec {
  const reports: Rec = {};
  for (const name of FIXTURE_OBJECTS) reports[name] = compare(name);
  const o1 = reports["ledger-x86_64-O1.o"];
  const o0 = reports["ledger-x86_64-O0.o"];
  const trap = reports["sweep-trap.o"];
  const evidence: Rec = {};
  for (const tool of DESCENT_TOOLS) {
    evidence[tool] = {
      o1Blocks: ["percent_change", "grade", "total", "grade_label"].map((name) => o1.functions[name].blocks[tool] ?? null),
      o0GradeBlocks: o0.functions.grade.blocks[tool] ?? null,
      o0GradeEdges: o0.functions.grade.edges[tool] ?? null,
      trapLookupInstructions: trap.functions.lookup.instructionStarts.perTool[tool] ?? null,
      inventedFunctions: Object.values(reports).reduce((total: number, report: Rec) => total + report.functionStarts[tool].invented.length, 0),
    };
  }
  return { timeline: TIMELINE, stages: STAGES, tools: FIGURE_TOOLS, terms: TERMS, evidence };
}

const IR_EXAMPLES = ["4883ec10", "4863c7", "83f904"];

function demo(): Rec {
  const manifest = loadManifest();
  const captureTools: Rec = {};
  for (const [tool, entry] of Object.entries(manifest.tools as Rec)) captureTools[tool] = entry.version;
  const fixtures: Rec = {};
  for (const name of FIXTURE_OBJECTS) fixtures[name] = compare(name);
  return {
    captured: manifest.captured,
    captureTools,
    localTools: localTools(),
    fixtures,
    ir: { translator: IR_EXAMPLES.map(translate), observed: observedIr() },
  };
}

function main(argv: string[]): number {
  if (argv.length === 0) {
    const report = demo();
    const absent = Object.entries(report.localTools as Record<string, string>).filter(([, where]) => where === "absent").map(([tool]) => tool);
    if (absent.length > 0) console.error("external tools absent on this machine (captures are used instead): " + absent.join(", "));
    console.log(dumps(report as Json, 2));
    return 0;
  }
  const command = argv[0];
  if (command === "compare" && argv.length === 2) {
    console.log(dumps(compare(argv[1]) as Json, 2));
    return 0;
  }
  if (command === "ir" && argv.length === 2) {
    console.log(dumps(translate(argv[1]) as Json, 2));
    return 0;
  }
  if (command === "figure-data") {
    console.log(dumps(figureData() as Json, null));
    return 0;
  }
  console.error("usage: main.py [compare FIXTURE.o | ir HEXBYTES | figure-data]");
  return 2;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
