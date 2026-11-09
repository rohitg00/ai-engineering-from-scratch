// Lesson: End-to-End Research Demo (phase 19 / lesson 57)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/57-end-to-end-research-demo/docs/en.md
// Run: npx tsx phases/19-capstone-projects/57-end-to-end-research-demo/code/main.ts

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BibEntry, Figure, MockProseGenerator, Paper, PaperWriter, Section } from "../../54-paper-writer/code/main.js";
import { CriticLoop, MiniPaper, MiniSection, PyFloat as CriticFloat, deterministicCritic, deterministicReviser } from "../../55-critic-loop/code/main.js";
import {
  Hypothesis,
  IterationScheduler,
  PyFloat,
  SchedulerReport,
  deterministicExpander,
  makeDeterministicRunner,
  pyDumps,
} from "../../56-iteration-scheduler/code/main.js";
import type { Json, Obj } from "../../56-iteration-scheduler/code/main.js";

export class NoTriggerError extends Error {}

export class BestResultError extends Error {}

function normalizeFloats(v: unknown): Json {
  if (v instanceof CriticFloat) return new PyFloat(v.v);
  if (Array.isArray(v)) return v.map(normalizeFloats);
  if (v !== null && typeof v === "object" && !(v instanceof PyFloat)) {
    const out: Obj = {};
    for (const [k, x] of Object.entries(v)) out[k] = normalizeFloats(x);
    return out;
  }
  return v as Json;
}

export class DemoReport {
  constructor(
    public scheduler_report: Obj,
    public best_branch: string,
    public best_reward: number,
    public critic_result: Obj,
    public paper_manifest: Obj,
    public stop_reason: string,
  ) {}

  toDict(): Obj {
    return {
      scheduler_report: this.scheduler_report,
      best_branch: this.best_branch,
      best_reward: new PyFloat(this.best_reward),
      critic_result: this.critic_result,
      paper_manifest: this.paper_manifest,
      stop_reason: this.stop_reason,
    };
  }
}

export function makeSeedHypotheses(): Hypothesis[] {
  return [
    new Hypothesis("h-alpha-1", "alpha", { q: "method-x" }),
    new Hypothesis("h-beta-1", "beta", { q: "method-y" }),
    new Hypothesis("h-gamma-1", "gamma", { q: "method-z" }),
  ];
}

export function pickBestBranch(schedulerReport: SchedulerReport): [string, number] {
  if (!schedulerReport.paper_triggers.length) throw new NoTriggerError("no branch crossed the paper threshold");
  const byBranch = new Map(schedulerReport.branches.map((b) => [b.branch, b]));
  const triggered = schedulerReport.paper_triggers.filter((name) => byBranch.has(name)).map((name) => byBranch.get(name)!);
  if (!triggered.length) throw new BestResultError("trigger list empty after lookup");
  triggered.sort((a, b) => b.mean - a.mean || (a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0));
  const best = triggered[0];
  return [best.branch, best.mean];
}

function originalityForReward(reward: number): string {
  if (reward >= 0.8) return "high";
  if (reward >= 0.6) return "medium";
  return "low";
}

export function buildMiniPaper(branch: string, reward: number): MiniPaper {
  return new MiniPaper(
    `Auto-Research Findings on Branch ${branch}`,
    `We summarise the best yielding branch ${branch} from the auto-research loop.`,
    [new MiniSection("intro", "Introduction", "initial observations"), new MiniSection("results", "Results", "")],
    { originality_tag: originalityForReward(reward) },
  );
}

export function miniToFullPaper(mini: MiniPaper, branch: string): Paper {
  const cites: string[] = [];
  for (const sec of mini.sections) {
    for (const c of sec.cites) {
      if (!cites.includes(c)) cites.push(c);
    }
  }

  let bib = cites.map((key) => new BibEntry(key, "article", { title: `Source ${key}`, author: "Synthesised", year: "2026" }));
  if (!bib.length) {
    bib = [new BibEntry(`${branch}-baseline`, "article", { title: "Baseline", author: "Synthesised", year: "2026" })];
    for (const sec of mini.sections) {
      if (sec.id === "intro") {
        sec.cites.push(`${branch}-baseline`);
        break;
      }
    }
  }

  const fig = new Figure(`${branch}-results`, `figs/${branch}.pdf`, `Reward trajectory on branch ${branch}`);

  const sections = mini.sections.map((s) => new Section(s.id, s.title, s.body, [...s.cites], s.id === "results" ? [fig.id] : []));
  return new Paper(mini.title, ["Auto-Research Demo"], mini.abstract, sections, [fig], bib);
}

async function runDemoAsync(outDir: string, seed = 11): Promise<DemoReport> {
  const seedList = makeSeedHypotheses();
  if (!seedList.length) throw new BestResultError("seed list is empty");

  const runner = makeDeterministicRunner({ alpha: 0.82, beta: 0.55, gamma: 0.15 }, { noise: 0.04, delay_ms: 2.0, seed });
  const sched = new IterationScheduler(runner, {
    slots: 3,
    max_experiments: 6,
    paper_threshold: 0.7,
    prune_floor: 0.2,
    prune_after_runs: 3,
    expander: deterministicExpander,
  });
  const schedReport = await sched.run(seedList);

  const [branch, reward] = pickBestBranch(schedReport);

  const mini = buildMiniPaper(branch, reward);
  const loop = new CriticLoop(deterministicCritic, deterministicReviser, { max_rounds: 6, target_score: 8.0 });
  const criticResult = loop.run(mini);

  const fullPaper = miniToFullPaper(criticResult.paper, branch);
  const prose = new MockProseGenerator({
    intro: `motivation for branch ${branch}`,
    results: `summary of reward trajectory on branch ${branch}`,
    method: "method description",
    "related-work": "related work survey",
  });
  const writer = new PaperWriter(prose.asGenerator());
  const manifest = writer.write(fullPaper, outDir) as Obj;

  return new DemoReport(schedReport.toDict(), branch, reward, normalizeFloats(criticResult.toDict()) as Obj, manifest, schedReport.stop_reason);
}

export async function runDemo(outDir: string | null = null, seed = 11): Promise<DemoReport> {
  const dir = outDir ?? mkdtempSync(join(tmpdir(), "auto-research-demo-"));
  return runDemoAsync(dir, seed);
}

export async function demo(): Promise<Obj> {
  return (await runDemo()).toDict();
}

if (require.main === module) {
  demo().then((rep) => {
    const critic = rep["critic_result"] as Obj;
    const manifest = rep["paper_manifest"] as Obj;
    const sched = rep["scheduler_report"] as Obj;
    const out: Json = {
      stop_reason: rep["stop_reason"],
      best_branch: rep["best_branch"],
      best_reward: rep["best_reward"],
      critic_status: critic["status"] as Json,
      critic_rounds: critic["rounds_used"] as Json,
      paper_sections: (manifest["sections"] as Obj[]).map((s) => s["id"]),
      paper_figures: (manifest["figures"] as Obj[]).map((f) => f["id"]),
      experiments_run: sched["experiments_run"],
    };
    console.log(pyDumps(out, 2));
  });
}
