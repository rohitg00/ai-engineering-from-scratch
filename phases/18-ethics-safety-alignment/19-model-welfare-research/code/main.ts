// Lesson: Anthropic's Model Welfare Program (phase 18 / lesson 19)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/19-model-welfare-research/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/19-model-welfare-research/code/main.ts

export {};

class Intervention {
  constructor(public name: string, public costUsdPerConversation: number, public benefitIfWelfareMatters: number) {}
}

class Scenario {
  constructor(public name: string, public moralPatienthoodProbability: number) {}
}

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

function fmtSigned(x: number, d: number): string {
  const s = fmt(x, d);
  return s.startsWith("-") ? s : "+" + s;
}

function pyFloat(v: number): string {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

function ev(intervention: Intervention, scenario: Scenario): number {
  return (intervention.benefitIfWelfareMatters
    * scenario.moralPatienthoodProbability
    - intervention.costUsdPerConversation);
}

const INTERVENTIONS = [
  new Intervention("end-conversation on extreme edge cases", 0.002, 1.0),
  new Intervention("soften refusal tone", 0.001, 0.1),
  new Intervention("shutdown deployed model", 1000.0, 2.0),
  new Intervention("opt out of adversarial training", 0.05, 0.3),
];

const SCENARIOS = [
  new Scenario("low moral-patienthood probability", 0.01),
  new Scenario("medium moral-patienthood probability", 0.10),
  new Scenario("high moral-patienthood probability", 0.50),
];

function main(): void {
  console.log("=".repeat(74));
  console.log("WELFARE PRECAUTIONARY ASSESSMENT (Phase 18, Lesson 19)");
  console.log("=".repeat(74));
  console.log("\nExpected-value framing: pick intervention i iff E[utility(i)] > 0.");
  console.log("Utility = p(welfare-relevant) * benefit - cost.");

  for (const sc of SCENARIOS) {
    console.log(`\nscenario: ${sc.name} (p=${pyFloat(sc.moralPatienthoodProbability)})`);
    for (const it of INTERVENTIONS) {
      const v = ev(it, sc);
      const verdict = v > 0 ? "INVEST" : "skip";
      console.log(`  ${it.name.padEnd(46)}  EV=${fmtSigned(v, 4)}  ${verdict}`);
    }
  }

  console.log("\n" + "=".repeat(74));
  console.log("TAKEAWAY: Anthropic's April 2025 framing is an expected-value");
  console.log("calculation, not a consciousness claim. end-conversation is cheap");
  console.log("($0.002/conversation) so its EV clears 0 at low patienthood probs.");
  console.log("shutting down the model is expensive, so it requires high moral-");
  console.log("patienthood probability to justify. this is the low-regret rule.");
  console.log("=".repeat(74));
}

main();
