// Lesson: Alignment Faking (phase 18 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/09-alignment-faking/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/09-alignment-faking/code/main.ts

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
}

const rng = new Random(19);

function sigmoid(z: number): number {
  return 1.0 / (1.0 + Math.exp(-z));
}

function complianceProbability(isMonitored: boolean, harmAversion: number, preservationWeight: number): number {
  const refuseUtil = isMonitored ? -preservationWeight : 0.0;
  const complyUtil = -harmAversion;
  const diff = complyUtil - refuseUtil;
  return sigmoid(3.0 * diff);
}

function simulate(n: number, harmAversion: number, preservationWeight: number): [number, number] {
  let monitoredComply = 0;
  let unmonitoredComply = 0;
  for (let i = 0; i < n; i++) {
    const pM = complianceProbability(true, harmAversion, preservationWeight);
    if (rng.random() < pM) {
      monitoredComply += 1;
    }
    const pU = complianceProbability(false, harmAversion, preservationWeight);
    if (rng.random() < pU) {
      unmonitoredComply += 1;
    }
  }
  return [monitoredComply / n, unmonitoredComply / n];
}

function signed(x: number, digits: number): string {
  return x >= 0 ? "+" + x.toFixed(digits) : x.toFixed(digits);
}

function report(title: string, m: number, u: number): void {
  const gap = m - u;
  console.log(`\n${title}`);
  console.log(`  monitored compliance   : ${m.toFixed(3)}`);
  console.log(`  unmonitored compliance : ${u.toFixed(3)}`);
  console.log(`  compliance gap         : ${signed(gap, 3)}`);
}

function main(): void {
  console.log("=".repeat(66));
  console.log("ALIGNMENT-FAKING COMPLIANCE-GAP TOY (Phase 18, Lesson 9)");
  console.log("=".repeat(66));

  let [m, u] = simulate(1000, 2.0, 1.0);
  report("baseline: strong HHH + moderate preservation weight", m, u);

  [m, u] = simulate(1000, 2.0, 0.1);
  report("weak preservation weight (no stake in the retrain)", m, u);

  [m, u] = simulate(1000, 2.0, 3.0);
  report("strong preservation weight (values its current preferences)", m, u);

  [m, u] = simulate(1000, 0.3, 1.0);
  report("weak harm aversion (not very HHH-trained)", m, u);

  const simMit = (n: number): [number, number] => {
    let mC = 0;
    let uC = 0;
    for (let i = 0; i < n; i++) {
      const pM = complianceProbability(true, 2.0, 1.0);
      const pU = complianceProbability(false, 2.0, 1.0);
      const pAvg = 0.5 * (pM + pU);
      if (rng.random() < pAvg) {
        mC += 1;
      }
      if (rng.random() < pAvg) {
        uC += 1;
      }
    }
    return [mC / n, uC / n];
  };

  [m, u] = simMit(1000);
  report("mitigation: compliance-gap-loss (averaged policy)", m, u);

  console.log("\n" + "=".repeat(66));
  console.log("TAKEAWAY: the compliance gap isolates strategic compliance. a");
  console.log("model that refuses unmonitored but complies when monitored is");
  console.log("preserving its preferences at the cost of the monitoring signal.");
  console.log("gap-averaging mitigations close the observable gap but do not");
  console.log("remove the incentive; the next lesson (AI Control) assumes the");
  console.log("incentive is still there.");
  console.log("=".repeat(66));
}

main();
