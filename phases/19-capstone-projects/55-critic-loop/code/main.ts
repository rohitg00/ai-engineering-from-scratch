// Lesson: Critic Loop (phase 19 / lesson 55)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/55-critic-loop/docs/en.md
// Run: npx tsx phases/19-capstone-projects/55-critic-loop/code/main.ts

export class PyFloat {
  constructor(readonly v: number) {}
}

export type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
export type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function pyRound(x: number, n: number): number {
  return Number(fmtFixed(x, n));
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
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

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

function pySum(values: number[]): number {
  let total = 0.0;
  let c = 0.0;
  for (const x of values) {
    const t = total + x;
    if (Math.abs(total) >= Math.abs(x)) c += total - t + x;
    else c += x - t + total;
    total = t;
  }
  if (c !== 0 && Number.isFinite(c)) total += c;
  return total;
}

const DIMENSIONS: readonly string[] = ["clarity", "novelty", "evidence", "methodology", "related_work"];

type Scores = Record<string, number>;

function scoresJson(scores: Scores): Obj {
  const out: Obj = {};
  for (const k of Object.keys(scores)) out[k] = fl(scores[k]);
  return out;
}

export class MiniSection {
  constructor(
    public id: string,
    public title: string,
    public body = "",
    public figure_refs: string[] = [],
    public cites: string[] = [],
  ) {}
}

export class MiniPaper {
  originality_tag = "low";
  citation_count_target = 4;
  figure_count_target = 2;

  constructor(
    public title: string,
    public abstract: string,
    public sections: MiniSection[] = [],
    init: Partial<Pick<MiniPaper, "originality_tag" | "citation_count_target" | "figure_count_target">> = {},
  ) {
    Object.assign(this, init);
  }
}

class Suggestion {
  constructor(
    public dimension: string,
    public target_section_id: string | null,
    public edit: string,
  ) {}

  toDict(): Obj {
    return { dimension: this.dimension, target_section_id: this.target_section_id, edit: this.edit };
  }
}

class Critique {
  constructor(
    public round: number,
    public scores: Scores,
    public suggestions: Suggestion[],
    public reason: string,
  ) {}

  mean(): number {
    const values = Object.values(this.scores);
    if (!values.length) return 0.0;
    return pySum(values) / values.length;
  }

  toDict(): Obj {
    return {
      round: this.round,
      scores: scoresJson(this.scores),
      mean: fl(this.mean()),
      suggestions: this.suggestions.map((s) => s.toDict()),
      reason: this.reason,
    };
  }
}

type Critic = (paper: MiniPaper, round: number) => Critique;
type Reviser = (paper: MiniPaper, suggestions: Suggestion[]) => MiniPaper;

class LoopTrace {
  constructor(
    public round: number,
    public scores: Scores,
    public mean: number,
    public suggestions_applied: number,
    public verdict: string,
  ) {}

  toDict(): Obj {
    return {
      round: this.round,
      scores: scoresJson(this.scores),
      mean: fl(this.mean),
      suggestions_applied: this.suggestions_applied,
      verdict: this.verdict,
    };
  }
}

export class LoopResult {
  constructor(
    public status: string,
    public reason: string,
    public rounds_used: number,
    public final_scores: Scores,
    public final_mean: number,
    public paper: MiniPaper,
    public trace: LoopTrace[],
  ) {}

  toDict(): Obj {
    return {
      status: this.status,
      reason: this.reason,
      rounds_used: this.rounds_used,
      final_scores: scoresJson(this.final_scores),
      final_mean: fl(this.final_mean),
      trace: this.trace.map((t) => t.toDict()),
    };
  }
}

interface CriticLoopOptions {
  max_rounds?: number;
  target_score?: number;
  plateau_epsilon?: number;
  plateau_window?: number;
}

export class CriticLoop {
  max_rounds: number;
  target_score: number;
  plateau_epsilon: number;
  plateau_window: number;

  constructor(
    public critic: Critic,
    public reviser: Reviser,
    opts: CriticLoopOptions = {},
  ) {
    this.max_rounds = opts.max_rounds ?? 5;
    this.target_score = opts.target_score ?? 8.0;
    this.plateau_epsilon = opts.plateau_epsilon ?? 0.1;
    this.plateau_window = opts.plateau_window ?? 2;
    if (this.max_rounds < 1) throw new Error("max_rounds must be >= 1");
    if (this.plateau_window < 1) throw new Error("plateau_window must be >= 1");
  }

  private targetMet(critique: Critique): boolean {
    return DIMENSIONS.every((d) => (critique.scores[d] ?? 0.0) >= this.target_score);
  }

  private plateau(trace: LoopTrace[]): boolean {
    if (trace.length < this.plateau_window + 1) return false;
    const recent = trace.slice(-(this.plateau_window + 1));
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].mean - recent[i - 1].mean > this.plateau_epsilon) return false;
    }
    return true;
  }

  run(paperIn: MiniPaper): LoopResult {
    let paper = paperIn;
    const trace: LoopTrace[] = [];
    let critique: Critique | null = null;

    for (let round = 1; round <= this.max_rounds; round++) {
      const current = this.critic(paper, round);
      critique = current;
      const applied = current.suggestions.length;

      if (this.targetMet(current)) {
        trace.push(new LoopTrace(round, { ...current.scores }, current.mean(), 0, "target"));
        return new LoopResult("converged", "target", round, { ...current.scores }, current.mean(), paper, trace);
      }

      const interim = new LoopTrace(round, { ...current.scores }, current.mean(), applied, "continue");
      trace.push(interim);

      if (this.plateau(trace)) {
        interim.verdict = "plateau";
        return new LoopResult("converged", "plateau", round, { ...current.scores }, current.mean(), paper, trace);
      }

      paper = this.reviser(paper, current.suggestions);
    }

    const finalScores: Scores = critique !== null ? { ...critique.scores } : Object.fromEntries(DIMENSIONS.map((d) => [d, 0.0]));
    const finalMean = critique !== null ? critique.mean() : 0.0;
    if (trace.length) trace[trace.length - 1].verdict = "budget";
    return new LoopResult("stopped", "budget", this.max_rounds, finalScores, finalMean, paper, trace);
  }
}

function deterministicScore(paper: MiniPaper): Scores {
  const bodyLens = paper.sections.map((s) => [...s.body].length);
  const avgBody = bodyLens.length ? bodyLens.reduce((a, b) => a + b, 0) / bodyLens.length : 0.0;
  const sectionTitles = new Set(paper.sections.map((s) => s.title.toLowerCase()));

  const clarity = Math.min(10.0, 3.0 + avgBody / 50.0);

  let novelty: number;
  if (paper.originality_tag === "high") novelty = 9.0;
  else if (paper.originality_tag === "medium") novelty = 6.0;
  else novelty = 3.0;

  const figRefs = paper.sections.reduce((n, s) => n + s.figure_refs.length, 0);
  const cites = paper.sections.reduce((n, s) => n + s.cites.length, 0);
  const evidence = Math.min(10.0, 2.0 + 2.0 * figRefs + 1.5 * cites);

  const hasMethod = paper.sections.some((s) => s.title.toLowerCase().startsWith("method") && s.body);
  const methodology = hasMethod ? 9.0 : 4.0;

  const hasRelated =
    sectionTitles.has("related work") && paper.sections.some((s) => s.title.toLowerCase() === "related work" && s.body);
  const relatedWork = hasRelated ? 9.0 : 4.0;

  return {
    clarity: pyRound(clarity, 2),
    novelty: pyRound(novelty, 2),
    evidence: pyRound(evidence, 2),
    methodology: pyRound(methodology, 2),
    related_work: pyRound(relatedWork, 2),
  };
}

export function deterministicCritic(paper: MiniPaper, round: number): Critique {
  const scores = deterministicScore(paper);
  const suggestions: Suggestion[] = [];

  const firstSectionId = (fallback = "intro"): string => (paper.sections.length ? paper.sections[0].id : fallback);

  if (scores["clarity"] < 8.0) {
    const target = paper.sections.length ? paper.sections[paper.sections.length - 1].id : null;
    suggestions.push(new Suggestion("clarity", target, "expand-body"));
  }
  if (scores["novelty"] < 8.0) {
    suggestions.push(new Suggestion("novelty", null, "bump-originality"));
  }
  if (scores["evidence"] < 8.0) {
    suggestions.push(new Suggestion("evidence", firstSectionId(), "add-figure-and-cite"));
  }
  if (scores["methodology"] < 8.0) {
    suggestions.push(new Suggestion("methodology", null, "add-method-section"));
  }
  if (scores["related_work"] < 8.0) {
    suggestions.push(new Suggestion("related_work", null, "add-related-work-section"));
  }

  const reason = !suggestions.length ? "fully-met" : `${suggestions.length} below target`;
  return new Critique(round, scores, suggestions, reason);
}

export function deterministicReviser(paper: MiniPaper, suggestions: Suggestion[]): MiniPaper {
  let figCounter = 0;
  let citeCounter = 0;
  for (const s of paper.sections) {
    figCounter += s.figure_refs.length;
    citeCounter += s.cites.length;
  }

  for (const sug of suggestions) {
    if (sug.edit === "expand-body") {
      const sec = paper.sections.find((x) => x.id === sug.target_section_id);
      if (sec) sec.body = (sec.body + " " + "x".repeat(80)).trim();
    } else if (sug.edit === "bump-originality") {
      if (paper.originality_tag === "low") paper.originality_tag = "medium";
      else if (paper.originality_tag === "medium") paper.originality_tag = "high";
    } else if (sug.edit === "add-figure-and-cite") {
      const targetId = sug.target_section_id || (paper.sections.length ? paper.sections[0].id : null);
      const sec = paper.sections.find((x) => x.id === targetId);
      if (sec) {
        figCounter += 1;
        citeCounter += 1;
        sec.figure_refs.push(`f${figCounter}`);
        sec.cites.push(`c${citeCounter}`);
      }
    } else if (sug.edit === "add-method-section") {
      if (!paper.sections.some((s) => s.title.toLowerCase().startsWith("method"))) {
        paper.sections.push(new MiniSection("method", "Method", "A description of the method follows. " + "x".repeat(200)));
      } else {
        const sec = paper.sections.find((x) => x.title.toLowerCase().startsWith("method") && !x.body);
        if (sec) sec.body = "A description of the method follows. " + "x".repeat(200);
      }
    } else if (sug.edit === "add-related-work-section") {
      if (!paper.sections.some((s) => s.title.toLowerCase() === "related work")) {
        paper.sections.push(new MiniSection("related-work", "Related Work", "We survey adjacent work. " + "x".repeat(200)));
      } else {
        const sec = paper.sections.find((x) => x.title.toLowerCase() === "related work" && !x.body);
        if (sec) sec.body = "We survey adjacent work. " + "x".repeat(200);
      }
    }
  }
  return paper;
}

function makeDeterministicCriticPair(): [Critic, Reviser] {
  return [deterministicCritic, deterministicReviser];
}

function demo(): Obj {
  const paper = new MiniPaper("Auto-Research Loop", "abstract", [new MiniSection("intro", "Introduction", "short intro")], {
    originality_tag: "low",
  });
  const [critic, reviser] = makeDeterministicCriticPair();
  const loop = new CriticLoop(critic, reviser, { max_rounds: 6, target_score: 8.0 });
  const result = loop.run(paper);
  return result.toDict();
}

if (require.main === module) {
  console.log(pyDumps(demo(), 2));
}
