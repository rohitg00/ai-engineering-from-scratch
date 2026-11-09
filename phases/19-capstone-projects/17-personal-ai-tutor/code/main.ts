// Lesson: Capstone 17, Personal AI Tutor (Adaptive, Multimodal, with Memory) (phase 19 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/17-personal-ai-tutor/docs/en.md
// Run: npx tsx phases/19-capstone-projects/17-personal-ai-tutor/code/main.ts

class Rng {
  private a: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    let u1 = this.random();
    while (u1 <= 0) u1 = this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }

  getState(): [number, number | null] {
    return [this.a, this.spare];
  }

  setState(state: [number, number | null]): void {
    [this.a, this.spare] = state;
  }
}

class BKTParams {
  constructor(
    public pInit = 0.2,
    public pLearn = 0.12,
    public pSlip = 0.10,
    public pGuess = 0.15,
  ) {}
}

function bktUpdate(mastery: number, correct: boolean, p: BKTParams): number {
  let num: number;
  let denom: number;
  if (correct) {
    num = mastery * (1 - p.pSlip);
    denom = num + (1 - mastery) * p.pGuess;
  } else {
    num = mastery * p.pSlip;
    denom = num + (1 - mastery) * (1 - p.pGuess);
  }
  const posterior = num / Math.max(denom, 1e-6);
  return posterior + (1 - posterior) * p.pLearn;
}

class Concept {
  constructor(public name: string, public prereqs: string[] = []) {}
}

const ALGEBRA: Concept[] = [
  new Concept("number_line", []),
  new Concept("addition_subtraction", ["number_line"]),
  new Concept("multiplication_division", ["addition_subtraction"]),
  new Concept("negative_numbers", ["addition_subtraction"]),
  new Concept("equality", ["addition_subtraction"]),
  new Concept("isolating_variable_one_step", ["equality", "addition_subtraction"]),
  new Concept("isolating_variable_two_step", ["isolating_variable_one_step", "multiplication_division"]),
  new Concept("distributive_property", ["multiplication_division"]),
  new Concept("combining_like_terms", ["addition_subtraction", "distributive_property"]),
  new Concept("linear_equations", ["isolating_variable_two_step", "combining_like_terms"]),
  new Concept("quadratic_basics", ["linear_equations", "multiplication_division"]),
];

type CMap = Map<string, Concept>;

function curriculumMap(concepts: Concept[]): CMap {
  return new Map(concepts.map((c) => [c.name, c]));
}

class MasteryMap extends Map<string, number> {
  get(key: string): number {
    if (!super.has(key)) super.set(key, 0.2);
    return super.get(key)!;
  }
}

class LearnerState {
  mastery = new MasteryMap();
  history: [string, boolean][] = [];

  constructor(public learnerId: string) {}
}

function nextConcept(state: LearnerState, cmap: CMap, masterThreshold = 0.85): string | null {
  for (const c of cmap.values()) {
    if (state.mastery.get(c.name) >= masterThreshold) continue;
    if (c.prereqs.every((pr) => state.mastery.get(pr) >= masterThreshold)) return c.name;
  }
  return null;
}

function socraticPolicy(state: LearnerState, concept: string, correct: boolean): string {
  const m = state.mastery.get(concept);
  if (correct && m > 0.8) return "celebrate_and_advance";
  if (correct) return "reinforce_and_next_question";
  if (m > 0.5) return "hint";
  return "scaffold_from_prereq";
}

function simulateAnswer(learnerKnowledge: number, conceptDifficulty: number, rng: Rng): boolean {
  const p = 1 / (1 + Math.exp(-(learnerKnowledge - conceptDifficulty)));
  return rng.random() < p;
}

function runAdaptive(learnerId: string, inherentAbility: number, cmap: CMap, nTurns: number, rng: Rng): LearnerState {
  const state = new LearnerState(learnerId);
  const p = new BKTParams();
  let lastAction: string | null = null;
  for (let t = 0; t < nTurns; t++) {
    const concept = nextConcept(state, cmap);
    if (concept === null) break;
    let difficulty = 0.3 + 0.1 * cmap.get(concept)!.prereqs.length;
    if (lastAction === "scaffold_from_prereq") {
      difficulty -= 0.15;
    } else if (lastAction === "hint") {
      difficulty -= 0.08;
    } else if (lastAction === "celebrate_and_advance") {
      state.mastery.set(concept, Math.min(1.0, state.mastery.get(concept) + 0.02));
    }
    const ek = inherentAbility + state.mastery.get(concept) * 1.5;
    const correct = simulateAnswer(ek, difficulty, rng);
    lastAction = socraticPolicy(state, concept, correct);
    state.history.push([concept, correct]);
    state.mastery.set(concept, bktUpdate(state.mastery.get(concept), correct, p));
  }
  return state;
}

function runBaseline(learnerId: string, inherentAbility: number, cmap: CMap, nTurns: number, rng: Rng): LearnerState {
  const state = new LearnerState(learnerId);
  const p = new BKTParams();
  const order = [...cmap.keys()];
  for (let i = 0; i < nTurns; i++) {
    const concept = order[i % order.length];
    const difficulty = 0.3 + 0.1 * cmap.get(concept)!.prereqs.length;
    const ek = inherentAbility + state.mastery.get(concept) * 1.5;
    const correct = simulateAnswer(ek, difficulty, rng);
    state.history.push([concept, correct]);
    state.mastery.set(concept, bktUpdate(state.mastery.get(concept), correct, p));
  }
  return state;
}

function masterySum(state: LearnerState, cmap: CMap): number {
  let s = 0;
  for (const c of cmap.keys()) s += state.mastery.get(c);
  return s;
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function main(): void {
  const cmap = curriculumMap(ALGEBRA);
  const rng = new Rng(29);

  console.log("=== 2-week efficacy study (simulated) ===");
  console.log(`curriculum: ${cmap.size} concepts`);

  const adaptiveGains: number[] = [];
  const baselineGains: number[] = [];
  const nLearners = 10;
  const nTurns = 60;

  for (let i = 0; i < nLearners; i++) {
    const ability = rng.gauss(0.3, 0.4);
    const seed = 100 + i;
    const rAdapt = new Rng(seed);
    const rBase = new Rng(0);
    rBase.setState(rAdapt.getState());
    const s1 = runAdaptive(`adapt_${i}`, ability, cmap, nTurns, rAdapt);
    const s2 = runBaseline(`base_${i}`, ability, cmap, nTurns, rBase);
    adaptiveGains.push(masterySum(s1, cmap));
    baselineGains.push(masterySum(s2, cmap));
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`adaptive mastery sum  mean=${mean(adaptiveGains).toFixed(2)}`);
  console.log(`baseline mastery sum  mean=${mean(baselineGains).toFixed(2)}`);
  const delta = mean(adaptiveGains) - mean(baselineGains);
  console.log(`delta (adaptive - baseline): ${signed(delta, 2)} mastery points over ${nTurns} turns`);

  console.log("\n=== sample trajectory (adaptive learner 0) ===");
  const state = runAdaptive("demo", 0.3, cmap, 20, new Rng(7));
  const seenConcepts: [string, number][] = [];
  for (const [c] of state.history) {
    if (!seenConcepts.some((x) => x[0] === c)) seenConcepts.push([c, state.mastery.get(c)]);
  }
  for (const [c, m] of seenConcepts.slice(0, 8)) {
    console.log(`  ${c.padEnd(34)} mastery=${m.toFixed(2)}`);
  }
}

main();

export {};
