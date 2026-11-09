// Lesson: Capstone Lesson 25: Verification Gates and the Observation Budget (phase 19 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/25-verification-gates-observation-budget/docs/en.md
// Run: npx tsx phases/19-capstone-projects/25-verification-gates-observation-budget/code/main.ts

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === quote) out += "\\" + ch;
    else out += ch;
  }
  return quote + out + quote;
}

function pyListRepr(items: string[]): string {
  return "[" + items.map(pyStrRepr).join(", ") + "]";
}

export class ToolCall {
  constructor(
    readonly turn: number,
    readonly tool: string,
    readonly argv: readonly string[],
    readonly payload: string = "",
  ) {}

  toDict(): Record<string, unknown> {
    return { turn: this.turn, tool: this.tool, argv: [...this.argv], payload: this.payload };
  }
}

export class Observation {
  constructor(
    readonly turn: number,
    readonly tool: string,
    readonly text: string,
    readonly tokens: number,
  ) {}

  toDict(): Record<string, unknown> {
    return { turn: this.turn, tool: this.tool, tokens: this.tokens };
  }
}

export class GateDecision {
  constructor(readonly allow: boolean, readonly gate: string, readonly reason: string) {}

  toDict(): Record<string, unknown> {
    return { allow: this.allow, gate: this.gate, reason: this.reason };
  }
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.floor(text.length / 4));
}

export class ObservationLedger {
  rows: Observation[] = [];

  record(obs: Observation): void {
    this.rows.push(obs);
  }

  cumulative(): number {
    return this.rows.reduce((acc, row) => acc + row.tokens, 0);
  }

  perTool(name: string): number {
    return this.rows.filter((row) => row.tool === name).reduce((acc, row) => acc + row.tokens, 0);
  }

  turnsSeen(): number[] {
    return [...new Set(this.rows.map((row) => row.turn))].sort((a, b) => a - b);
  }

  latestTurn(): number {
    return this.rows.length > 0 ? this.rows[this.rows.length - 1].turn : -1;
  }

  snapshot(): Record<string, unknown>[] {
    return this.rows.map((row) => row.toDict());
  }
}

export class GateContext {
  constructor(
    readonly ledger: ObservationLedger,
    readonly currentTurn: number,
    readonly history: readonly ToolCall[] = [],
  ) {}
}

export interface VerificationGate {
  name: string;
  evaluate(call: ToolCall, ctx: GateContext): GateDecision;
}

export class WhitelistGate implements VerificationGate {
  constructor(readonly allowed: ReadonlySet<string>, public name: string = "whitelist") {}

  evaluate(call: ToolCall, _ctx: GateContext): GateDecision {
    if (this.allowed.has(call.tool)) return new GateDecision(true, this.name, "tool in allow-set");
    return new GateDecision(
      false,
      this.name,
      `tool ${pyStrRepr(call.tool)} not in allow-set ${pyListRepr([...this.allowed].sort())}`,
    );
  }
}

export class RegexGate implements VerificationGate {
  constructor(readonly refusePatterns: readonly RegExp[], public name: string = "regex") {}

  static fromStrings(patterns: Iterable<string>, name: string = "regex"): RegexGate {
    return new RegexGate([...patterns].map((p) => new RegExp(p)), name);
  }

  evaluate(call: ToolCall, _ctx: GateContext): GateDecision {
    const haystack = call.argv.join(" ") + " " + call.payload;
    for (const pat of this.refusePatterns) {
      if (pat.test(haystack)) {
        return new GateDecision(false, this.name, `argv matched refuse pattern ${pyStrRepr(pat.source)}`);
      }
    }
    return new GateDecision(true, this.name, "no refuse pattern matched");
  }
}

export class RecencyGate implements VerificationGate {
  constructor(readonly window: number, public name: string = "recency") {}

  evaluate(call: ToolCall, ctx: GateContext): GateDecision {
    const last = ctx.ledger.latestTurn();
    if (last < 0) return new GateDecision(true, this.name, "no prior observations");
    const gap = call.turn - last;
    if (gap > this.window) {
      return new GateDecision(false, this.name, `observation gap ${gap} turns exceeds window ${this.window}`);
    }
    return new GateDecision(true, this.name, `gap ${gap} within window ${this.window}`);
  }
}

export class BudgetGate implements VerificationGate {
  constructor(readonly maxTokens: number, public name: string = "budget") {}

  evaluate(_call: ToolCall, ctx: GateContext): GateDecision {
    const used = ctx.ledger.cumulative();
    if (used >= this.maxTokens) {
      return new GateDecision(false, this.name, `observation budget exhausted: ${used}/${this.maxTokens} tokens`);
    }
    const remaining = this.maxTokens - used;
    return new GateDecision(true, this.name, `${remaining} tokens of budget remaining`);
  }
}

export class PerToolBudgetGate implements VerificationGate {
  constructor(readonly limits: Record<string, number>, public name: string = "per-tool-budget") {}

  evaluate(call: ToolCall, ctx: GateContext): GateDecision {
    const limit = this.limits[call.tool];
    if (limit === undefined) return new GateDecision(true, this.name, "tool has no per-tool budget");
    const used = ctx.ledger.perTool(call.tool);
    if (used >= limit) {
      return new GateDecision(false, this.name, `per-tool budget for ${call.tool} exhausted: ${used}/${limit}`);
    }
    return new GateDecision(true, this.name, `per-tool ${call.tool}: ${limit - used} tokens remaining`);
  }
}

export class ChainOutcome {
  constructor(readonly decisions: GateDecision[]) {}

  get allow(): boolean {
    return this.decisions.every((d) => d.allow);
  }

  get denyReason(): string | null {
    for (const d of this.decisions) {
      if (!d.allow) return `[${d.gate}] ${d.reason}`;
    }
    return null;
  }

  toDict(): Record<string, unknown> {
    return {
      allow: this.allow,
      deny_reason: this.denyReason,
      decisions: this.decisions.map((d) => d.toDict()),
    };
  }
}

export class GateChain {
  constructor(readonly gates: readonly VerificationGate[]) {}

  evaluate(call: ToolCall, ctx: GateContext): ChainOutcome {
    const decisions: GateDecision[] = [];
    for (const gate of this.gates) {
      const decision = gate.evaluate(call, ctx);
      decisions.push(decision);
      if (!decision.allow) return new ChainOutcome(decisions);
    }
    return new ChainOutcome(decisions);
  }
}

export type ToolFn = (call: ToolCall) => string;

export class LoopReport {
  constructor(
    readonly turns: number,
    readonly allowed: number,
    readonly refused: number,
    readonly observations: Observation[],
    readonly decisions: ChainOutcome[],
  ) {}

  toDict(): Record<string, unknown> {
    return {
      turns: this.turns,
      allowed: this.allowed,
      refused: this.refused,
      observations: this.observations.map((o) => o.toDict()),
      decisions: this.decisions.map((d) => d.toDict()),
    };
  }
}

export function runSyntheticLoop(
  calls: ToolCall[],
  chain: GateChain,
  toolFns: Record<string, ToolFn>,
): LoopReport {
  const ledger = new ObservationLedger();
  const decisions: ChainOutcome[] = [];
  const observations: Observation[] = [];
  let allowed = 0;
  let refused = 0;

  const history: ToolCall[] = [];

  for (const call of calls) {
    const ctx = new GateContext(ledger, call.turn, [...history]);
    const outcome = chain.evaluate(call, ctx);
    decisions.push(outcome);
    history.push(call);
    if (!outcome.allow) {
      refused += 1;
      continue;
    }
    const fn = toolFns[call.tool];
    if (fn === undefined) {
      refused += 1;
      continue;
    }
    const result = fn(call);
    const obs = new Observation(call.turn, call.tool, result, estimateTokens(result));
    ledger.record(obs);
    observations.push(obs);
    allowed += 1;
  }

  return new LoopReport(calls.length, allowed, refused, observations, decisions);
}

function demoTools(): Record<string, ToolFn> {
  const readFile = (call: ToolCall): string => {
    const target = call.argv.length > 0 ? call.argv[0] : "<missing>";
    return `# fake contents of ${target}\n` + "line of fake source code that is sixty bytes long ".repeat(12);
  };

  const listDir = (_call: ToolCall): string => "main.py\nREADME.md\ntests/test_main.py\n";

  const runTests = (_call: ToolCall): string =>
    JSON.stringify({ status: "passed", tests: 4, duration_ms: 42 }, null, 2);

  return { read_file: readFile, list_dir: listDir, run_tests: runTests };
}

export function buildDefaultChain(budget: number = 200): GateChain {
  return new GateChain([
    new WhitelistGate(new Set(["read_file", "list_dir", "run_tests"])),
    RegexGate.fromStrings([
      String.raw`\brm\s+-rf\b`,
      String.raw`\bsudo\b`,
      String.raw`^/etc/`,
    ]),
    new RecencyGate(3),
    new BudgetGate(budget),
  ]);
}

export function runDemo(): number {
  const chain = buildDefaultChain(200);
  const tools = demoTools();

  const calls = [
    new ToolCall(1, "list_dir", ["./"]),
    new ToolCall(2, "read_file", ["main.py"]),
    new ToolCall(3, "read_file", ["README.md"]),
    new ToolCall(4, "run_tests", ["./"]),
    new ToolCall(5, "shell", ["rm", "-rf", "/"]),
  ];

  const report = runSyntheticLoop(calls, chain, tools);

  console.log("VERIFICATION GATE DEMO");
  console.log(`turns=${report.turns} allowed=${report.allowed} refused=${report.refused}`);
  console.log("");
  const n = Math.min(calls.length, report.decisions.length);
  for (let idx = 0; idx < n; idx++) {
    const call = calls[idx];
    const outcome = report.decisions[idx];
    const verdict = outcome.allow ? "ALLOW" : "DENY";
    console.log(`  [${idx}] turn=${call.turn} tool=${call.tool} -> ${verdict}`);
    if (!outcome.allow) console.log(`        reason: ${outcome.denyReason}`);
  }
  console.log("");
  console.log(`cumulative tokens observed: ${report.observations.reduce((acc, o) => acc + o.tokens, 0)}`);
  console.log(`observations recorded: ${report.observations.length}`);

  if (report.refused < 1) {
    console.error("ERROR: demo expected at least one refusal");
    return 1;
  }
  return 0;
}

process.exitCode = runDemo();
