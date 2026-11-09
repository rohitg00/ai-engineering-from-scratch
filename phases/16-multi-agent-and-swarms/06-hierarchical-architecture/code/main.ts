// Lesson: Hierarchical Architecture and Its Failure Mode (phase 16 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/06-hierarchical-architecture/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/06-hierarchical-architecture/code/main.ts

export {};

interface LeafOutput {
  worker: string;
  question: string;
  answer: string;
}

interface SubSummary {
  sub_manager: string;
  leaves: LeafOutput[];
  summary: string;
}

interface TopSynthesis {
  top_manager: string;
  branches: SubSummary[];
  synthesis: string;
}

class Worker {
  constructor(public name: string, public canned: Map<string, string>) {}

  run(question: string): LeafOutput {
    const key = this.matchKey(question);
    const ans = this.canned.get(key) ?? `[no canned answer for '${question}']`;
    return { worker: this.name, question, answer: ans };
  }

  private matchKey(q: string): string {
    const ql = q.toLowerCase();
    for (const k of this.canned.keys()) {
      if (ql.includes(k)) return k;
    }
    return "default";
  }
}

class SubManager {
  constructor(public name: string, public workers: Worker[], public split: Map<string, string>) {}

  run(task: string): SubSummary {
    const leaves: LeafOutput[] = [];
    for (const w of this.workers) {
      const subQ = this.split.get(w.name) ?? task;
      leaves.push(w.run(subQ));
    }
    const summary = `[${this.name}] aggregated: ` + leaves.map((l) => l.answer).join(" | ");
    return { sub_manager: this.name, leaves, summary };
  }
}

class TopManager {
  constructor(public name: string, public subs: Map<string, SubManager>) {}

  run(task: string, branchLabels: string[]): TopSynthesis {
    const summaries: SubSummary[] = [];
    for (const label of branchLabels) {
      const sub = this.subs.get(label);
      if (!sub) {
        summaries.push({
          sub_manager: `MISSING[${label}]`,
          leaves: [],
          summary: `[top] tried to delegate to '${label}' -- no such sub-manager`,
        });
        continue;
      }
      summaries.push(sub.run(`${task} -- branch: ${label}`));
    }
    const synth = "top synthesis: " + summaries.map((s) => s.summary).join(" || ");
    return { top_manager: this.name, branches: summaries, synthesis: synth };
  }
}

function buildHierarchy(): TopManager {
  const fe = new Worker("fe", new Map([["frontend", "React component audited; 2 issues."]]));
  const be = new Worker("be", new Map([["backend", "API endpoints audited; 1 issue."]]));
  const eng = new SubManager(
    "eng-manager",
    [fe, be],
    new Map([["fe", "frontend review of the feature"], ["be", "backend review of the feature"]]),
  );
  const lw = new Worker("lawyer", new Map([["legal", "Contract clauses A and B are non-compliant."]]));
  const legal = new SubManager("legal-manager", [lw], new Map([["lawyer", "legal review of the feature"]]));
  const fw = new Worker(
    "finance",
    new Map([["finance", "Projected cost $42k/month; exceeds budget by 12%."]]),
  );
  const finance = new SubManager("finance-manager", [fw], new Map([["finance", "finance review of the feature"]]));
  return new TopManager("vp-eng", new Map([["engineering", eng], ["legal", legal], ["finance", finance]]));
}

function render(label: string, synth: TopSynthesis): void {
  console.log(`\n=== ${label} ===`);
  for (const branch of synth.branches) {
    console.log(`  [sub] ${branch.sub_manager}`);
    for (const leaf of branch.leaves) {
      console.log(`    [leaf] ${leaf.worker.padEnd(8)} asked: ${leaf.question}`);
      console.log(`           answered: ${leaf.answer}`);
    }
    console.log(`    [summary] ${branch.summary}`);
  }
  console.log(`  [top] ${synth.synthesis}`);
}

function main(): void {
  console.log("Hierarchical multi-agent with decomposition-drift demo");
  console.log("-".repeat(60));

  const top = buildHierarchy();
  const task = "Ship the premium tier feature to production.";

  const happy = top.run(task, ["engineering", "legal"]);
  render("Happy path (correct branches)", happy);

  const perturbed = top.run(task, ["engineering", "finance"]);
  render("Perturbed path (top manager mislabels 'legal' as 'finance')", perturbed);

  console.log("\nUser asked about legal/engineering review.");
  console.log("Happy path: both legal and engineering answer truthfully.");
  console.log("Perturbed path: finance dutifully answers, legal question goes unanswered.");
  console.log("The error appears at TOP synthesis -- one level removed from where a human could catch it.");
}

main();
