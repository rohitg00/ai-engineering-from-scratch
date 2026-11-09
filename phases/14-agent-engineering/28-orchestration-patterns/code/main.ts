// Lesson: Orchestration Patterns: Supervisor, Swarm, Hierarchical (phase 14 / lesson 28)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/28-orchestration-patterns/docs/en.md
// Run: npx tsx phases/14-agent-engineering/28-orchestration-patterns/code/main.ts

function mostCommonOne(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = "";
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function classify(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("refund")) return "refund";
  if (t.includes("crash") || t.includes("error") || t.includes("bug")) return "bug";
  if (t.includes("pricing") || t.includes("quote")) return "sales";
  return "sales";
}

const SPECIALISTS = new Map<string, (t: string) => string>([
  ["refund", (t) => `refund handled: ${t.slice(0, 30)}`],
  ["bug", (t) => `bug logged: ${t.slice(0, 30)}`],
  ["sales", (t) => `quote sent: ${t.slice(0, 30)}`],
]);

function specialist(label: string): (t: string) => string {
  return SPECIALISTS.get(label)!;
}

function supervisorWorker(tasks: string[]): [string[], number] {
  const trace: string[] = [];
  let ops = 0;
  for (const task of tasks) {
    ops += 1;
    const label = classify(task);
    trace.push(`supervisor -> ${label}`);
    const fn = specialist(label);
    ops += 1;
    trace.push(`  ${label}: ${fn(task)}`);
  }
  return [trace, ops];
}

function swarm(tasks: string[]): [string[], number] {
  const trace: string[] = [];
  let ops = 0;
  for (const task of tasks) {
    let current = [...SPECIALISTS.keys()][0]!;
    let hops = 0;
    while (hops < 3) {
      ops += 1;
      const label = classify(task);
      if (current === label) {
        trace.push(`swarm[${current}]: ${specialist(current)(task)}`);
        break;
      }
      trace.push(`swarm[${current}] handoff -> ${label}`);
      current = label;
      hops += 1;
    }
  }
  return [trace, ops];
}

function hierarchical(tasks: string[]): [string[], number] {
  const trace: string[] = [];
  let ops = 0;
  for (const task of tasks) {
    ops += 1;
    const topLabel = classify(task) !== "sales" ? "customer_ops" : "commercial";
    trace.push(`top -> ${topLabel}`);
    ops += 1;
    const subLabel = classify(task);
    trace.push(`  ${topLabel} -> ${subLabel}`);
    const fn = specialist(subLabel);
    ops += 1;
    trace.push(`    ${subLabel}: ${fn(task)}`);
  }
  return [trace, ops];
}

function debate(tasks: string[]): [string[], number] {
  const trace: string[] = [];
  let ops = 0;
  for (const task of tasks) {
    const proposals: string[] = [];
    for (const debater of ["alpha", "beta", "gamma"]) {
      ops += 1;
      const label = classify(task);
      proposals.push(label);
      trace.push(`${debater} proposes ${label}`);
    }
    ops += 1;
    const convergent = mostCommonOne(proposals);
    const fn = specialist(convergent);
    ops += 1;
    trace.push(`debate converges -> ${convergent}: ${fn(task)}`);
  }
  return [trace, ops];
}

function main(): void {
  console.log("=".repeat(70));
  console.log("ORCHESTRATION PATTERNS: Phase 14, Lesson 28");
  console.log("=".repeat(70));

  const tasks = ["I need a refund for invoice 4711", "the CLI crashes on ctrl-c", "do you offer volume pricing?"];

  const patterns: [string, (tasks: string[]) => [string[], number]][] = [
    ["supervisor-worker", supervisorWorker],
    ["swarm", swarm],
    ["hierarchical", hierarchical],
    ["debate", debate],
  ];
  for (const [name, fn] of patterns) {
    const [trace, ops] = fn(tasks);
    console.log(`\n--- ${name}  ops=${ops} ---`);
    for (const line of trace) console.log(`  ${line}`);
  }

  console.log();
  console.log("supervisor: cleanest. swarm: shortest. hierarchical: deepest.");
  console.log("debate: most expensive. pick topology AFTER picking the problem.");
}

main();
