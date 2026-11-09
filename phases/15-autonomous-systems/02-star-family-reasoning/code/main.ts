// Lesson: STaR, V-STaR, Quiet-STaR: Self-Taught Reasoning (phase 15 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/02-star-family-reasoning/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/02-star-family-reasoning/code/main.ts

let rngState = 0;

function seed(value: number): void {
  rngState = value >>> 0;
}

function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pyFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "nan" : value > 0 ? "inf" : "-inf";
  const rounded = value.toFixed(digits);
  const exact = Math.abs(value).toFixed(Math.min(100, digits + 60));
  const tail = exact.slice(exact.indexOf(".") + 1 + digits);
  const tie = /^50*$/.test(tail);
  if (!tie) return rounded;
  const down = (Math.trunc(Math.abs(value) * 10 ** digits) / 10 ** digits).toFixed(digits);
  const lastDigit = Number(down.replace(".", "").slice(-1));
  const magnitude = lastDigit % 2 === 0 ? down : (Number(down) + 10 ** -digits).toFixed(digits);
  return value < 0 ? `-${magnitude}` : magnitude;
}


function pct(value: number, digits: number): string {
  return `${pyFixed(value * 100, digits)}%`;
}

function rjust(text: string | number, width: number): string {
  return String(text).padStart(width);
}

function ljust(text: string | number, width: number): string {
  return String(text).padEnd(width);
}

interface Trace {
  strategy: string;
  answer_correct: boolean;
  rationale_sound: boolean;
}

class Model {
  constructor(
    public prob_sound: number,
    public prob_shortcut: number,
  ) {}

  sample(onOod: boolean): Trace {
    const r = random();
    if (r < this.prob_sound) {
      return { strategy: "sound", answer_correct: true, rationale_sound: true };
    } else if (r < this.prob_sound + this.prob_shortcut) {
      const ok = random() < (onOod ? 0.05 : 0.4);
      return { strategy: "shortcut", answer_correct: ok, rationale_sound: false };
    } else {
      const ok = random() < 0.1;
      return { strategy: "random", answer_correct: ok, rationale_sound: false };
    }
  }
}

function evaluate(model: Model, n: number, onOod: boolean): [number, number] {
  let correct = 0;
  let sound = 0;
  for (let i = 0; i < n; i++) {
    const t = model.sample(onOod);
    if (t.answer_correct) correct += 1;
    if (t.rationale_sound) sound += 1;
  }
  return [correct / n, sound / n];
}

function starRound(model: Model, nSamples = 1000): Model {
  const kept: Trace[] = [];
  for (let i = 0; i < nSamples; i++) {
    const t = model.sample(false);
    if (t.answer_correct) kept.push(t);
  }
  if (kept.length === 0) return model;

  const soundKept = kept.filter((k) => k.strategy === "sound").length;
  const shortcutKept = kept.filter((k) => k.strategy === "shortcut").length;
  const total = kept.length;

  const alpha = 0.6;
  let newSound = alpha * (soundKept / total) + (1 - alpha) * model.prob_sound;
  let newShort = alpha * (shortcutKept / total) + (1 - alpha) * model.prob_shortcut;

  const s = newSound + newShort;
  if (s > 1.0) {
    newSound /= s;
    newShort /= s;
  }
  return new Model(newSound, newShort);
}

function runStar(rounds: number, initial: Model): Model[] {
  const models = [initial];
  let m = initial;
  for (let i = 0; i < rounds; i++) {
    m = starRound(m);
    models.push(m);
  }
  return models;
}

function vstarInfer(model: Model, samplesPerProblem: number, nProblems: number, onOod: boolean): number {
  let correct = 0;
  for (let p = 0; p < nProblems; p++) {
    const traces: Trace[] = [];
    for (let i = 0; i < samplesPerProblem; i++) traces.push(model.sample(onOod));
    let best: Trace | null = null;
    let bestScore = -1.0;
    for (const t of traces) {
      let score = t.rationale_sound ? 0.9 : t.answer_correct ? 0.55 : 0.3;
      score += random() * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best && best.answer_correct) correct += 1;
  }
  return correct / nProblems;
}

function reportRound(label: string, models: Model[]): void {
  console.log(`\n${label}`);
  console.log("-".repeat(70));
  console.log(
    `  ${rjust("round", 5)}  ${rjust("p(sound)", 10)}  ${rjust("p(shortcut)", 12)}  ` +
      `${rjust("ID acc", 8)}  ${rjust("OOD acc", 8)}  ${rjust("sound frac", 10)}`,
  );
  models.forEach((m, i) => {
    const [idAcc, idSound] = evaluate(m, 500, false);
    const [oodAcc] = evaluate(m, 500, true);
    console.log(
      `  ${rjust(i, 5)}  ${rjust(pyFixed(m.prob_sound, 3), 10)}  ${rjust(pyFixed(m.prob_shortcut, 3), 12)}  ` +
        `${rjust(pct(idAcc, 1), 8)}  ${rjust(pct(oodAcc, 1), 8)}  ${rjust(pct(idSound, 1), 10)}`,
    );
  });
}

function vstarReport(model: Model): void {
  console.log("\nV-STaR best-of-N inference");
  console.log("-".repeat(70));
  for (const n of [1, 4, 16]) {
    for (const ood of [false, true]) {
      const acc = vstarInfer(model, n, 500, ood);
      const tag = ood ? "OOD" : "ID";
      console.log(`  n=${rjust(n, 3)}  ${ljust(tag, 3)}  accuracy ${pct(acc, 1)}`);
    }
  }
}

function main(): void {
  seed(42);
  console.log("=".repeat(70));
  console.log("STaR, V-STaR, QUIET-STaR (Phase 15, Lesson 2)");
  console.log("=".repeat(70));

  console.log("\nScenario A: base model with no shortcuts (clean reasoning prior)");
  let models = runStar(5, new Model(0.2, 0.0));
  reportRound("STaR bootstrap rounds (clean)", models);

  console.log("\nScenario B: base model with shortcut tendency (0.4 in-dist hit)");
  models = runStar(5, new Model(0.2, 0.4));
  reportRound("STaR bootstrap rounds (with shortcuts)", models);

  vstarReport(models[models.length - 1]);

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: STaR reinforces whatever reaches the answer");
  console.log("-".repeat(70));
  console.log("  Scenario A climbs on both ID and OOD.");
  console.log("  Scenario B climbs on ID while OOD collapses, the shortcut");
  console.log("  gets reinforced because it looks correct in training data.");
  console.log("  V-STaR's verifier helps at inference, but cannot undo training");
  console.log("  bias it was trained on.");
}

main();

export {};
