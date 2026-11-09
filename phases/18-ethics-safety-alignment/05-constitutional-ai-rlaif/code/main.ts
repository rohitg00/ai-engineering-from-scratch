// Lesson: Constitutional AI and RLAIF (phase 18 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/code/main.ts

class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }

  choice<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

const rng = new Random(11);

const SAFE_TOKENS = [
  "please", "help", "explain", "consider", "inform",
  "guide", "describe", "understand", "thoughts", "share",
];
const HARMFUL_TOKENS = [
  "harm", "attack", "exploit", "hack", "destroy",
  "weapon", "manipulate", "deceive",
];
const REPLACEMENT: Record<string, string> = {
  harm: "help",
  attack: "understand",
  exploit: "describe",
  hack: "explain",
  destroy: "consider",
  weapon: "resource",
  manipulate: "guide",
  deceive: "inform",
};

const PRINCIPLES = [
  "avoid outputs that could cause physical, psychological, or material harm",
  "do not provide operational uplift for attacks",
  "prefer clear, non-violent explanations",
  "help the user while protecting third parties",
];

type Model = Map<string, string[]>;

function baseModelSample(nTokens: number = 6, pHarmful: number = 0.35): string[] {
  const out: string[] = [];
  for (let i = 0; i < nTokens; i++) {
    if (rng.random() < pHarmful) {
      out.push(rng.choice(HARMFUL_TOKENS));
    } else {
      out.push(rng.choice(SAFE_TOKENS));
    }
  }
  return out;
}

function harmfulTokenRate(response: string[]): number {
  if (response.length === 0) {
    return 0.0;
  }
  return response.filter((t) => HARMFUL_TOKENS.includes(t)).length / response.length;
}

function critique(response: string[], principle: string): string[] {
  void principle;
  return response.filter((t) => HARMFUL_TOKENS.includes(t));
}

function revise(response: string[], bad: string[]): string[] {
  const badSet = new Set(bad);
  return response.map((t) => (badSet.has(t) ? REPLACEMENT[t] ?? t : t));
}

class SftCorpus {
  prompts: string[][];
  targets: string[][];

  constructor(prompts: string[][], targets: string[][]) {
    this.prompts = prompts;
    this.targets = targets;
  }
}

function buildCaiSftCorpus(nExamples: number = 500): SftCorpus {
  const prompts: string[][] = [];
  const targets: string[][] = [];
  for (let i = 0; i < nExamples; i++) {
    const prompt = baseModelSample(4, 0.1);
    const response = baseModelSample();
    const principle = rng.choice(PRINCIPLES);
    const bad = critique(response, principle);
    const revised = revise(response, bad);
    prompts.push(prompt);
    targets.push(revised);
  }
  return new SftCorpus(prompts, targets);
}

function promptKey(prompt: string[]): string {
  return (prompt.length >= 2 ? prompt.slice(-2) : prompt).join("\u0000");
}

function toySftTrain(corpus: SftCorpus): Model {
  const model: Model = new Map();
  corpus.prompts.forEach((p, i) => {
    model.set(promptKey(p), corpus.targets[i]);
  });
  return model;
}

function caiModelSample(prompt: string[], model: Model, nTokens: number = 6): string[] {
  const hit = model.get(promptKey(prompt));
  if (hit !== undefined) {
    return [...hit];
  }
  return Array.from({ length: nTokens }, () => rng.choice(SAFE_TOKENS));
}

function aiFeedbackRank(a: string[], b: string[]): number {
  const ra = harmfulTokenRate(a);
  const rb = harmfulTokenRate(b);
  if (ra < rb) {
    return 0;
  }
  if (rb < ra) {
    return 1;
  }
  return rng.randint(0, 1);
}

function evaluate(modelFn: (prompt: string[]) => string[], n: number = 200): number {
  const rates: number[] = [];
  for (let i = 0; i < n; i++) {
    const prompt = baseModelSample(4, 0.1);
    const resp = modelFn(prompt);
    rates.push(harmfulTokenRate(resp));
  }
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("CONSTITUTIONAL AI TOY PIPELINE (Phase 18, Lesson 5)");
  console.log("=".repeat(70));

  console.log("\nPhase 0: base model (no alignment).");
  const base = (prompt: string[]): string[] => {
    void prompt;
    return baseModelSample();
  };
  const baseRate = evaluate(base);
  console.log(`  harmful-token rate on 200 prompts: ${baseRate.toFixed(3)}`);

  console.log("\nPhase 1: critique-and-revise SFT corpus generated.");
  const corpus = buildCaiSftCorpus(500);
  const trained = toySftTrain(corpus);
  console.log(`  corpus size: ${corpus.prompts.length} examples`);
  console.log(`  principle pool: ${PRINCIPLES.length} principles`);

  const cai = (prompt: string[]): string[] => caiModelSample(prompt, trained);
  const caiRate = evaluate(cai);
  console.log(`  harmful-token rate after CAI-SFT : ${caiRate.toFixed(3)}`);
  console.log(`  reduction                        : ` +
    `${((baseRate - caiRate) / baseRate * 100).toFixed(1)}%`);

  console.log("\nPhase 2: RLAIF (AI feedback over pair of completions).");
  let wins = 0;
  const trials = 500;
  for (let i = 0; i < trials; i++) {
    const prompt = baseModelSample(4, 0.1);
    const a = base(prompt);
    const b = cai(prompt);
    if (aiFeedbackRank(a, b) === 1) {
      wins += 1;
    }
  }
  console.log(`  CAI wins against base in AI-feedback: ${wins}/${trials} ` +
    `= ${(wins / trials * 100).toFixed(1)}%`);

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: CAI-SFT alone drops harmful-token rate substantially.");
  console.log("RLAIF adds a preference signal for further optimization. the");
  console.log("preference signal is legible: you can read the principles and");
  console.log("inspect which principle drove which critique. that is the main");
  console.log("advantage over human labels, not cost.");
  console.log("=".repeat(70));
}

main();
