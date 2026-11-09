// Lesson: Self-Refine and CRITIC: Iterative Output Improvement (phase 14 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/05-self-refine-and-critic/docs/en.md
// Run: npx tsx phases/14-agent-engineering/05-self-refine-and-critic/code/main.ts

export {};

const KNOWN_WRONG_FACTS = [
  "paris is the capital of germany",
  "mt everest is in europe",
  "the sun orbits the earth",
];

interface Attempt {
  iteration: number;
  output: string;
  critique: string;
  verified: boolean;
}

function generate(_topic: string, history: Attempt[]): string {
  if (history.length === 0) {
    return "- Paris is the capital of Germany\n" + "- Mt Everest is in Europe\n" + "- Water boils at 100C";
  }
  const last = history[history.length - 1];
  if (last.critique.toLowerCase().includes("germany")) {
    return "- Paris is the capital of France\n" + "- Mt Everest is in Europe\n" + "- Water boils at 100C";
  }
  if (last.critique.toLowerCase().includes("everest")) {
    return "- Paris is the capital of France\n" + "- Mt Everest is in Asia\n" + "- Water boils at 100C at sea level";
  }
  return last.output;
}

function feedbackSelf(output: string): [string, boolean] {
  if (output.includes("Germany") && output.includes("Paris")) {
    return ["first bullet reads wrong, double-check capital", false];
  }
  if (output.includes("Europe") && output.includes("Everest")) {
    return ["second bullet's continent looks off to me", false];
  }
  return ["no issues", true];
}

function verifyExternal(output: string): [string, boolean] {
  const text = output.toLowerCase();
  for (const fact of KNOWN_WRONG_FACTS) {
    const key = fact.includes(" is ") ? fact.split(" is ")[0] : fact;
    void key;
    if (text.includes("paris") && text.includes("germany")) {
      return ["verifier: 'paris is the capital of germany' contradicts reference data", false];
    }
    if (text.includes("everest") && text.includes("europe")) {
      return ["verifier: 'mt everest is in europe' contradicts reference data", false];
    }
  }
  const lines = output.split("\n");
  if (lines.filter((l) => l.startsWith("-")).length !== 3) return ["verifier: expected 3 bullet lines", false];
  if (lines.some((l) => l.length > 60)) return ["verifier: bullet exceeds 60 chars", false];
  return ["verifier: ok", true];
}

function refine(topic: string, _prev: string, _critique: string, history: Attempt[]): string {
  return generate(topic, history);
}

function runLoop(topic: string, useCritic: boolean, maxIters = 4): Attempt[] {
  const history: Attempt[] = [];
  let output = generate(topic, history);
  const verify = useCritic ? verifyExternal : (o: string) => feedbackSelf(o);
  for (let i = 1; i <= maxIters; i++) {
    const [critique, ok] = verify(output);
    history.push({ iteration: i, output, critique, verified: ok });
    if (ok) break;
    output = refine(topic, output, critique, history);
  }
  return history;
}

function printRun(label: string, history: Attempt[]): void {
  console.log(`\n${label}`);
  console.log("-".repeat(60));
  for (const a of history) {
    const tag = a.verified ? "OK " : "...";
    console.log(`  iter ${a.iteration} ${tag} critique: ${a.critique}`);
    for (const line of a.output.split("\n")) console.log(`    ${line}`);
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("SELF-REFINE and CRITIC: Phase 14, Lesson 05");
  console.log("=".repeat(70));

  const histSelf = runLoop("world facts", false);
  printRun("Self-Refine (self-critique only)", histSelf);

  const histCritic = runLoop("world facts", true);
  printRun("CRITIC (external verifier)", histCritic);

  const summary = (hist: Attempt[]): string =>
    hist.length > 0 && hist[hist.length - 1].verified ? "passed" : "did not converge";

  console.log();
  console.log(`Self-Refine ended: ${summary(histSelf)}  after ${histSelf.length} iters`);
  console.log(`CRITIC    ended: ${summary(histCritic)}  after ${histCritic.length} iters`);
  console.log();
  console.log("Observation: CRITIC's verifier is grounded against reference data; a");
  console.log("self-critic can fail to flag its own confident-sounding hallucination.");
}

main();
