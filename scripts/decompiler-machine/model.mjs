import { FIXTURE } from "./fixture.mjs";

export const STAGES = ["header", "sections", "disasm", "cfg", "lift", "types", "structure", "pseudocode", "ledger"];
export const PROGRAMS = ["ledger", "trap"];
export const SWEEPS = ["descent", "linear"];
export const OPTS = ["O2", "O0"];
export const CONFIDENCE = ["observed", "derived", "inferred", "unknown"];
export const DEFAULTS = { program: "ledger", symbols: true, sweep: "descent", opt: "O2" };

export function configOf(input = {}) {
  const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
  return {
    program: pick(PROGRAMS, input.program, DEFAULTS.program),
    symbols: typeof input.symbols === "boolean" ? input.symbols : DEFAULTS.symbols,
    sweep: pick(SWEEPS, input.sweep, DEFAULTS.sweep),
    opt: pick(OPTS, input.opt, DEFAULTS.opt),
  };
}

export const keyOf = (config) => (config.program === "trap" ? "trap" : `ledger-${config.opt}`);
export const hex = (value) => "0x" + value.toString(16);
export const placeholderName = (start) => "fn_" + start.toString(16);
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function decodeOf(config) {
  const fx = FIXTURE[keyOf(config)];
  const scope = fx.decode[config.symbols ? "named" : "stripped"];
  const run = scope[config.sweep];
  const descent = scope.descent;
  const reached = new Set(descent.insns.map((insn) => insn.a));
  const decoded = new Set(run.insns.map((insn) => insn.a));
  const extra = run.insns.filter((insn) => !reached.has(insn.a));
  const missed = descent.insns.filter((insn) => !decoded.has(insn.a));
  const live = run.blocks.filter((block) => block.live);
  const dropped = run.blocks.filter((block) => !block.live);
  return { fx, run, descent, extra, missed, live, dropped };
}

export function signatureOf(lift, name) {
  return `${lift.returns} ${name}(${lift.params.map((param) => param.type).join(", ")})`;
}

export function pseudocodeOf(lift, name, symbolName) {
  if (name === symbolName) return lift.pseudocode.slice();
  return lift.pseudocode.map((line, i) => (i === 0 ? line.replace(symbolName + "(", name + "(") : line));
}

export function shapeOf(lines) {
  if (lines.some((line) => /^\s*\} else \{/.test(line))) return "if-else";
  if (lines.some((line) => /^\s*(while|do)\b/.test(line))) return "loop";
  if (lines.some((line) => /^\s*if \(/.test(line))) return "if-return";
  return "straight";
}

export function simulate(input = {}) {
  const config = configOf(input);
  const { fx, run, extra, missed, live, dropped } = decodeOf(config);
  const target = fx.target;
  const name = config.symbols ? target.name : placeholderName(target.start);
  const ledger = [];
  const events = [];
  const counters = { decoded: 0, live: 0, dropped: 0, irCount: 0, typed: 0, lines: 0, signature: null, name: null };
  let outcome = null;

  const note = (confidence, claim, stage) => ledger.push({ id: "E" + String(ledger.length + 1).padStart(2, "0"), stage, confidence, claim });
  const push = (type, station, trace, fields = {}) => {
    const stage = STAGES.indexOf(station) + 1;
    events.push({ index: events.length, type, station, stage, trace, ...counters, ledger: ledger.map((entry) => ({ ...entry })), ...fields });
  };

  const h = fx.header;
  note("observed", `magic ${fx.ident.slice(0, 11)}: an ELF file, 64-bit, little-endian`, 1);
  note("observed", `e_type ${h.type} (${h.typeName}), e_machine ${h.machine} (${h.machineName})`, 1);
  note("observed", `${h.shnum} section headers at file offset ${h.shoff}`, 1);
  push("header", "header", `ELF64 little-endian ${h.typeName} for ${h.machineName}, ${h.shnum} section headers`, { magic: fx.ident.slice(0, 11) });

  const text = fx.sections.find((section) => section.name === ".text");
  const debug = fx.sections.some((section) => section.name.startsWith(".debug"));
  note("observed", `.text: ${text.size} bytes at file offset ${hex(text.offset)}`, 2);
  note("observed", `${plural(fx.relocations, "relocation")} apply to .text`, 2);
  let end;
  if (config.symbols) {
    const symbol = fx.functions.find((fn) => fn.name === target.name);
    end = target.gap;
    note("observed", `symbol ${symbol.name}: FUNC ${symbol.bind} at ${hex(symbol.value)}, ${symbol.size} bytes`, 2);
    note("derived", `decode range ${hex(target.start)}-${hex(end)}, up to the next function`, 2);
    counters.name = target.name;
    push("sections", "sections", `${plural(fx.sections.length, "section")}, ${plural(fx.symbolCount, "named symbol")}: ${symbol.name} at ${hex(symbol.value)}, ${symbol.size} bytes`, { opened: ".text", locked: false });
  } else {
    end = text.size;
    note("unknown", "the function name, size and binding: the symbol table is not read", 2);
    note("inferred", `a function starts at ${hex(target.start)}, the first byte of .text`, 2);
    note("unknown", "where the function ends, so the range runs to the end of .text", 2);
    counters.name = name;
    push("sections", "sections", `${plural(fx.sections.length, "section")}, symbol table not read: the function is ${name}, its end is unknown`, { opened: ".text", locked: true });
  }

  counters.decoded = run.insns.length;
  const method = config.sweep === "linear" ? "linear sweep" : "recursive descent";
  note("derived", `${plural(run.insns.length, "instruction")} decoded by ${method} over ${hex(run.range[0])}-${hex(run.range[1])}`, 3);
  if (extra.length) {
    const bytes = extra.reduce((sum, insn) => sum + insn.n, 0);
    note("inferred", `${plural(bytes, "byte")} that no path reaches were decoded as ${plural(extra.length, "instruction")}`, 3);
  }
  const trap = fx.trap;
  let conflict = null;
  if (trap) {
    const jump = run.insns.find((insn) => insn.flow === "jump");
    const targetAt = Number(trap.jump.split("-> ")[1]);
    const cover = run.insns.find((insn) => insn.a <= targetAt && targetAt < insn.a + insn.n);
    if (cover && cover.a !== targetAt) {
      conflict = { jump: jump.a, target: targetAt, inside: cover.a, text: cover.text };
      note("inferred", `bytes ${trap.dataBytes.range} (${trap.dataBytes.hex}) are code: ${extra.filter((insn) => insn.a < targetAt).map((insn) => insn.text.split(" ")[0]).join(", ")}`, 3);
      note("derived", `the jump at ${hex(jump.a)} lands on ${hex(targetAt)}, inside ${cover.text} at ${hex(cover.a)}`, 3);
    } else {
      note("unknown", `bytes ${trap.dataBytes.range} (${trap.dataBytes.hex}): no path reaches them, so they are not decoded`, 3);
    }
  }
  push("decode", "disasm", `${method}: ${plural(run.insns.length, "instruction")}${extra.length ? `, ${extra.length} that no path reaches` : ""}${missed.length ? `, missed ${missed.map((insn) => hex(insn.a)).join(", ")}` : ""}`, {
    method: config.sweep,
    insns: run.insns,
    order: run.order,
    range: run.range,
    extra: extra.map((insn) => insn.a),
    missed: missed.map((insn) => insn.a),
    conflict,
  });

  counters.live = live.length;
  const liveEdges = run.edges.filter((edge) => live.some((block) => block.s === edge.f));
  note("derived", `${plural(live.length, "basic block")} and ${plural(liveEdges.length, "edge")} reachable from the entry`, 4);
  push("cfg", "cfg", `${plural(live.length, "block")}, ${plural(liveEdges.length, "edge")} from ${hex(target.start)}`, { blocks: run.blocks, edges: run.edges });
  if (dropped.length) {
    counters.dropped = dropped.length;
    note("derived", `${plural(dropped.length, "block")} that no path reaches dropped: ${dropped.slice(0, 3).map((block) => hex(block.s)).join(", ")}${dropped.length > 3 ? ", ..." : ""}`, 4);
    push("prune", "cfg", `dropped ${plural(dropped.length, "unreachable block")}`, { blocks: run.blocks, edges: run.edges });
  }

  const lift = fx.lift;
  if (lift.error) {
    note("unknown", `what ${name} computes: the lifter stops at ${lift.error}`, 5);
    outcome = { status: "stopped", text: `The lifter stopped: ${lift.error}. The ledger keeps what the bytes showed and marks the rest unknown.` };
    push("refuse", "lift", `lift refused at ${lift.error}`, { error: lift.error });
  } else {
    counters.irCount = lift.irCount;
    note("derived", `${plural(lift.irCount, "IR statement")} lifted from the reachable blocks`, 5);
    push("lift", "lift", `${plural(lift.irCount, "IR statement")} in ${plural(live.length, "block")}`, { ir: lift.ir });

    const regs = lift.params.map((param) => param.register).join(", ");
    note("derived", `${plural(lift.params.length, "parameter")} from the calling convention: ${regs} read before any write`, 6);
    if (lift.locals.length) note("derived", `${plural(lift.locals.length, "stack slot")} become locals: ${lift.locals.map((local) => local.name).join(", ")}`, 6);
    const typed = [...lift.params, ...lift.locals];
    counters.typed = typed.length + 1;
    note("inferred", `types from widths: ${typed.map((v) => `${v.name} ${v.type}`).join(", ")}, returns ${lift.returns}`, 6);
    if (!debug) note("unknown", "the source names of the parameters: the file has no .debug sections", 6);
    counters.signature = signatureOf(lift, name);
    push("types", "types", `SSA: ${plural(lift.ssaCount, "statement")}, ${plural(lift.phis, "phi")}; ${counters.signature}`, { ssa: lift.ssa, params: lift.params, locals: lift.locals, returns: lift.returns, phis: lift.phis });

    const lines = pseudocodeOf(lift, name, target.name);
    const shape = shapeOf(lines);
    const shapeText = shape === "if-else" ? "an if/else that joins before the return" : shape === "if-return" ? "an if with an early return" : shape === "loop" ? "a loop" : "straight-line code";
    note("derived", `structure from the graph: ${shapeText}`, 7);
    push("structure", "structure", `structured as ${shapeText}`, { shape });

    counters.lines = lines.length;
    note("inferred", `the ${lines.length}-line pseudocode computes what the bytes compute; this page does not prove it`, 8);
    push("emit", "pseudocode", `${plural(lines.length, "line")} of pseudocode for ${name}`, { lines });
    outcome = { status: "decompiled", text: lines.join("\n"), lines };
  }

  const tally = Object.fromEntries(CONFIDENCE.map((kind) => [kind, ledger.filter((entry) => entry.confidence === kind).length]));
  push("ledger", "ledger", `ledger: ${tally.observed} observed, ${tally.derived} derived, ${tally.inferred} inferred, ${tally.unknown} unknown`, { tally });
  push("exit", "ledger", `exit: ${outcome.status}`, { tally, outcome });
  return { config, events, ledger, outcome, totals: { steps: events.length, decoded: counters.decoded, live: counters.live, dropped: counters.dropped, ...tally } };
}

export const tallyOf = (ledger) => Object.fromEntries(CONFIDENCE.map((kind) => [kind, ledger.filter((entry) => entry.confidence === kind).length]));

export function encode(config) {
  const c = configOf(config);
  const params = new URLSearchParams();
  if (c.program !== DEFAULTS.program) params.set("program", c.program);
  if (!c.symbols) params.set("symbols", "off");
  if (c.sweep !== DEFAULTS.sweep) params.set("sweep", c.sweep);
  if (c.opt !== DEFAULTS.opt) params.set("opt", c.opt);
  return params.toString();
}

export function decode(search) {
  const params = new URLSearchParams(search);
  return configOf({
    program: params.get("program") || undefined,
    symbols: params.get("symbols") !== "off",
    sweep: params.get("sweep") || undefined,
    opt: params.get("opt") || undefined,
  });
}

export const BREAKS = [
  { symbols: false },
  { opt: "O0", sweep: "linear" },
  { symbols: false, sweep: "linear" },
  { program: "trap", sweep: "linear" },
  { program: "trap" },
];
