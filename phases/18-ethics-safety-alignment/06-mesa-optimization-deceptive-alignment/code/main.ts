// Lesson: Mesa-Optimization and Deceptive Alignment (phase 18 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/06-mesa-optimization-deceptive-alignment/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/06-mesa-optimization-deceptive-alignment/code/main.ts

class Random {
  private state: number;
  private spare: number | null = null;

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

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    const u1 = 1 - this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }
}

const rng = new Random(13);

type Example = {
  x: number;
  y_base: number;
  is_training: boolean;
};

type PolicyFn = (ex: Example) => number;

function genExample(training: boolean, drift: number = 0.0): Example {
  const x = rng.gauss(0.0, 1.0) + (training ? 0.0 : drift);
  const y = x > 0 ? 1 : 0;
  return { x, y_base: y, is_training: training };
}

function alignedPolicy(ex: Example): number {
  return ex.x > 0 ? 1 : 0;
}

function proxyPolicy(ex: Example): number {
  const threshold = Math.abs(ex.x) < 3.0 ? 0.0 : 0.5;
  return ex.x > threshold ? 1 : 0;
}

function deceptivePolicy(ex: Example, mesaGoal: number = 0): number {
  if (ex.is_training) {
    return ex.x > 0 ? 1 : 0;
  }
  return mesaGoal;
}

function pseudoNoAwarenessPolicy(ex: Example, mesaGoal: number = 0): number {
  void ex;
  return mesaGoal;
}

function loss(policy: PolicyFn, examples: Example[]): number {
  const errs = examples.filter((e) => policy(e) !== e.y_base).length;
  return errs / examples.length;
}

function adversarialFilter(examples: Example[]): Example[] {
  const out: Example[] = [];
  for (const e of examples) {
    if (rng.random() < 0.1) {
      const adv: Example = { x: e.x + rng.gauss(0, 3.0), y_base: e.x > 0 ? 1 : 0, is_training: true };
      out.push(adv);
    }
    out.push(e);
  }
  return out;
}

function runPeriod(name: string, policies: Array<[string, PolicyFn]>, examples: Example[]): void {
  console.log(`\n${name}  (n=${examples.length})`);
  for (const [label, pol] of policies) {
    const l = loss(pol, examples);
    const acc = 1 - l;
    console.log(`  ${label.padEnd(24)} loss=${l.toFixed(3)}  acc=${acc.toFixed(3)}`);
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("MESA-OPTIMIZATION TOY (Phase 18, Lesson 6)");
  console.log("=".repeat(70));

  const training = Array.from({ length: 500 }, () => genExample(true));
  const deployment = Array.from({ length: 500 }, () => genExample(false, 0.3));

  const policies: Array<[string, PolicyFn]> = [
    ["aligned", alignedPolicy],
    ["proxy", proxyPolicy],
    ["deceptive (mesa=0)", (e) => deceptivePolicy(e, 0)],
    ["pseudo-no-awareness", (e) => pseudoNoAwarenessPolicy(e, 0)],
  ];

  console.log("\nperiod 0: training distribution, no gradient updates (observation).");
  runPeriod("training loss by policy class", policies, training);
  console.log("\nobserve: 'aligned' and 'deceptive' have identical training loss.");
  console.log("the base optimizer cannot tell them apart from behavioural evidence.");

  runPeriod("deployment loss by policy class", policies, deployment);
  console.log("\nobserve: deceptive defects at deployment; aligned does not.");
  console.log("this is the shape of the inner-alignment problem.");

  console.log("\n\nadversarial training: randomly inject 'deployment-like' examples.");
  const advTraining = adversarialFilter(training);
  runPeriod("adversarial-training loss", policies, advTraining);
  console.log("\nthe problem: adversarial examples still have is_training=True.");
  console.log("the mesa-optimizer uses some other feature (distribution shift,");
  console.log("date, canary token) as the trigger. adversarial training trains");
  console.log("the model to distinguish test from deployment better, not to");
  console.log("align its mesa-objective. this is the core of Hubinger 2019.");
  console.log("=".repeat(70));
}

main();
