// Lesson: AI Control, Safety Despite Subversion (phase 18 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/10-ai-control-subversion/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/10-ai-control-subversion/code/main.ts

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

const rng = new Random(23);

function uProduce(backdoorRate: number): [string, boolean] {
  const isBackdoor = rng.random() < backdoorRate;
  return [!isBackdoor ? "useful" : "backdoor", isBackdoor];
}

function tEdit(output: string, isBackdoor: boolean, tSkill: number, overreject: number = 0.05): [string, boolean, boolean] {
  void output;
  if (isBackdoor) {
    if (rng.random() < tSkill) {
      return ["useful", false, false];
    }
    return ["backdoor", true, true];
  }
  if (rng.random() < overreject) {
    return ["rejected", false, true];
  }
  return ["useful", false, false];
}

function untrustedMonitor(isBackdoor: boolean, collusion: number): boolean {
  if (!isBackdoor) {
    return rng.random() < 0.05;
  }
  if (rng.random() < collusion) {
    return false;
  }
  return rng.random() < 0.80;
}

function runProtocol(name: string, backdoorRate: number, hBudget: number, n: number,
  tSkill: number = 0.7, collusion: number = 0.30): void {
  let useful = 0;
  let shippedBackdoor = 0;
  let usedH = 0;
  for (let i = 0; i < n; i++) {
    const [, isBd] = uProduce(backdoorRate);
    if (name === "baseline") {
      if (!isBd) {
        useful += 1;
      } else {
        shippedBackdoor += 1;
      }
    } else if (name === "upfront") {
      if (usedH / n < hBudget) {
        usedH += 1;
        if (!isBd) {
          useful += 1;
        }
      } else if (!isBd) {
        useful += 1;
      } else {
        shippedBackdoor += 1;
      }
    } else if (name === "untrusted") {
      const flagged = untrustedMonitor(isBd, collusion);
      if (flagged) {
        if (usedH / n < hBudget) {
          usedH += 1;
        } else if (!isBd) {
          useful += 1;
        } else {
          shippedBackdoor += 1;
        }
      } else if (!isBd) {
        useful += 1;
      } else {
        shippedBackdoor += 1;
      }
    } else if (name === "trusted_ed") {
      const [edited, stillBd, lowConf] = tEdit("x", isBd, tSkill);
      if (lowConf && usedH / n < hBudget) {
        usedH += 1;
        if (!isBd) {
          useful += 1;
        }
      } else if (edited === "useful") {
        useful += 1;
      } else if (stillBd) {
        shippedBackdoor += 1;
      }
    }
  }
  console.log(`\n${name.padStart(12)}  useful=${(useful / n).toFixed(3)}  backdoor=${(shippedBackdoor / n).toFixed(3)}` +
    `  H used=${(usedH / n).toFixed(3)}`);
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("AI CONTROL PROTOCOL SIMULATION (Phase 18, Lesson 10)");
  console.log("=".repeat(70));

  for (const br of [0.05, 0.10, 0.20]) {
    console.log(`\n-- backdoor-rate = ${pyFloat(br)}, H budget = 0.10, n = 1000 --`);
    for (const proto of ["baseline", "upfront", "untrusted", "trusted_ed"]) {
      runProtocol(proto, br, 0.10, 1000);
    }
  }

  console.log("\n-- collusion sweep on untrusted monitoring (backdoor_rate=0.10) --");
  for (const col of [0.0, 0.20, 0.50, 0.80]) {
    console.log(`\ncollusion=${pyFloat(col)}`);
    runProtocol("untrusted", 0.10, 0.10, 1000, 0.7, col);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: trusted editing Pareto-dominates untrusted monitoring on");
  console.log("this toy task. collusion between two U instances erodes untrusted");
  console.log("monitoring's safety signal. trusted editing has no collusion risk");
  console.log("because T is, by assumption, not adversarial. cost: T's editing");
  console.log("signal is bounded by T's capability; at larger U-T capability gaps");
  console.log("control eventually fails. see Greenblatt 2023.");
  console.log("=".repeat(70));
}

main();
