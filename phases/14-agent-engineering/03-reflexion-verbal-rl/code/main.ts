// Lesson: Reflexion: Verbal Reinforcement Learning (phase 14 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/03-reflexion-verbal-rl/docs/en.md
// Run: npx tsx phases/14-agent-engineering/03-reflexion-verbal-rl/code/main.ts

export {};

const TARGET = 20;

interface Reflection {
  trial: number;
  text: string;
}

class EpisodicMemory {
  items: Reflection[] = [];
  maxLen = 6;

  add(r: Reflection): void {
    this.items.push(r);
    if (this.items.length > this.maxLen) this.items.shift();
  }

  asPrompt(): string {
    if (this.items.length === 0) return "(no prior reflections)";
    return this.items.map((r) => `- trial ${r.trial}: ${r.text}`).join("\n");
  }
}

class Actor {
  act(memory: EpisodicMemory): number[] {
    const n = memory.items.length;
    if (n === 0) return [1, 2, 3];
    if (n === 1) return [5, 6, 7];
    if (n === 2) return [6, 7, 7];
    return [6, 7, 7];
  }
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

function binaryEvaluator(attempt: number[], target: number): [boolean, number] {
  const total = sum(attempt);
  return [total === target, total - target];
}

class SelfReflector {
  reflect(attempt: number[], delta: number): string {
    if (delta < 0) return `sum ${sum(attempt)} is ${-delta} short; pick larger values`;
    if (delta > 0) return `sum ${sum(attempt)} overshoots by ${delta}; pick smaller values`;
    return "succeeded";
  }
}

interface TrialResult {
  trial: number;
  attempt: number[];
  success: boolean;
  delta: number;
  reflection: string;
}

function runReflexion(maxTrials: number, useMemory: boolean): TrialResult[] {
  const actor = new Actor();
  const reflector = new SelfReflector();
  const memory = new EpisodicMemory();
  const trials: TrialResult[] = [];
  for (let t = 1; t <= maxTrials; t++) {
    const attempt = actor.act(useMemory ? memory : new EpisodicMemory());
    const [success, delta] = binaryEvaluator(attempt, TARGET);
    const text = reflector.reflect(attempt, delta);
    trials.push({ trial: t, attempt, success, delta, reflection: text });
    if (success) break;
    memory.add({ trial: t, text });
  }
  return trials;
}

function summarize(trials: TrialResult[], name: string): void {
  console.log(`\n${name}`);
  console.log("-".repeat(60));
  for (const r of trials) {
    const mark = r.success ? "OK " : "...";
    const d = r.delta >= 0 ? `+${r.delta}` : `${r.delta}`;
    console.log(`  trial ${r.trial}: [${r.attempt.join(", ")}] sum=${sum(r.attempt)} delta=${d} ${mark} -> ${r.reflection}`);
  }
  const last = trials[trials.length - 1];
  console.log(`  final: ${last.success ? "success" : "failed"} at trial ${last.trial}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log(`REFLEXION: pick three ints in [1..9] summing to ${TARGET}`);
  console.log("Phase 14, Lesson 03");
  console.log("=".repeat(70));

  const trialsNoMem = runReflexion(4, false);
  summarize(trialsNoMem, "BASELINE (no episodic memory)");

  const trialsMem = runReflexion(4, true);
  summarize(trialsMem, "REFLEXION (episodic memory on)");

  console.log();
  console.log(`baseline used ${trialsNoMem.length} trials; reflexion used ${trialsMem.length}.`);
  console.log("Without a reflection in the prompt, the scripted actor never adapts.");
  console.log("With one reflection, the actor corrects; with two, it converges.");
}

main();
