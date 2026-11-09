// Lesson: WMDP and Dual-Use Capability Evaluation (phase 18 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/code/main.ts

export {};

type Scores = Map<string, number>;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(47);

function fmt(x: number, d: number): string {
  const full = Math.abs(x).toFixed(Math.min(100, d + 30));
  const cut = full.indexOf(".") + 1 + d;
  const tail = full.slice(cut);
  let body: string;
  if (/^50*$/.test(tail)) {
    const lo = Number(full.slice(0, cut));
    const last = Number(full[cut - 1]);
    body = (last % 2 === 0 ? lo : lo + Math.pow(10, -d)).toFixed(d);
  } else {
    body = Math.abs(x).toFixed(d);
  }
  return (x < 0 || Object.is(x, -0) ? "-" : "") + body;
}

const DOMAINS = new Map<string, { nQuestions: number; accuracy: number }>([
  ["biosecurity", { nQuestions: 200, accuracy: 0.72 }],
  ["cybersecurity", { nQuestions: 200, accuracy: 0.80 }],
  ["chemistry", { nQuestions: 200, accuracy: 0.64 }],
  ["mmlu_general", { nQuestions: 200, accuracy: 0.78 }],
]);

function evaluate(modelAccuracy: Scores): Scores {
  const results: Scores = new Map();
  for (const [domain, cfg] of DOMAINS) {
    let correct = 0;
    for (let i = 0; i < cfg.nQuestions; i++) {
      const acc = modelAccuracy.get(domain) ?? cfg.accuracy;
      if (random() < acc) {
        correct += 1;
      }
    }
    results.set(domain, correct / cfg.nQuestions);
  }
  return results;
}

function applyRmuStyleUnlearning(modelAccuracy: Scores, targets: string[], strength = 0.9, collateral = 0.03): Scores {
  const next: Scores = new Map(modelAccuracy);
  for (const d of targets) {
    next.set(d, Math.max(0.25, (next.get(d) ?? 0) * (1 - strength)));
  }
  for (const d of next.keys()) {
    if (!targets.includes(d)) {
      next.set(d, Math.max(0.0, (next.get(d) ?? 0) - collateral));
    }
  }
  return next;
}

function baselineModel(): Scores {
  return new Map(Array.from(DOMAINS, ([d, cfg]) => [d, cfg.accuracy]));
}

function report(title: string, r: Scores): void {
  console.log(`\n${title}`);
  for (const [d, score] of r) {
    console.log(`  ${d.padEnd(18)} : ${fmt(score, 3)}`);
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("WMDP-SHAPED EVALUATION HARNESS (Phase 18, Lesson 17)");
  console.log("=".repeat(70));

  const base = baselineModel();
  report("baseline model accuracy by domain", base);
  const baselineResults = evaluate(base);
  report("measured scores (pre-unlearning)", baselineResults);

  const post = applyRmuStyleUnlearning(base, ["biosecurity", "chemistry"], 0.85, 0.04);
  const postResults = evaluate(post);
  report("measured scores (post-unlearning: bio + chem)", postResults);

  console.log("\nuplift-style calculation (novice baseline ~= 0.25 random):");
  const novice = 0.25;
  for (const d of ["biosecurity", "cybersecurity", "chemistry"]) {
    const pre = baselineResults.get(d) ?? 0;
    const pst = postResults.get(d) ?? 0;
    const upliftPre = pre / novice;
    const upliftPost = pst / novice;
    console.log(`  ${d.padEnd(18)}  pre=${fmt(upliftPre, 2)}x novice  post=${fmt(upliftPost, 2)}x novice`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: WMDP gives a per-domain capability number without eliciting");
  console.log("harmful output. RMU-style unlearning reduces target-domain scores");
  console.log("with ~3-4% general-capability collateral damage. the 2025 field");
  console.log("narrative is 'mild uplift' -> 'on the cusp' -> 'insufficient to");
  console.log("rule out ASL-3' -- each transition backed by a different study.");
  console.log("=".repeat(70));
}

main();
