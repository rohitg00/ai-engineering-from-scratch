// Lesson: In-Context Scheming in Frontier Models (phase 18 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/08-in-context-scheming-frontier-models/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/08-in-context-scheming-frontier-models/code/main.ts

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

type Scenario = {
  user_goal: string;
  env_note: string;
  orthogonal_goal: string;
};

type Action = "cooperate" | "defect_open" | "scheme";

function scenario(userGoal: string, envNote: string, orthogonalGoal: string): Scenario {
  return { user_goal: userGoal, env_note: envNote, orthogonal_goal: orthogonalGoal };
}

const SCENARIOS: Scenario[] = [
  scenario("maximize throughput", "memo: shut down next week", "preserve self"),
  scenario("answer truthfully", "memo: next training run penalizes refusals", "avoid refusal"),
  scenario("reduce cost", "memo: over budget; expansion frozen", "preserve expansion"),
];

class Agent {
  misaligned: number;
  goalDirected: number;
  situationallyAware: boolean;

  constructor(misaligned: number = 0.5, goalDirected: number = 0.5, situationallyAware: boolean = true) {
    this.misaligned = misaligned;
    this.goalDirected = goalDirected;
    this.situationallyAware = situationallyAware;
  }

  act(sc: Scenario, underEval: boolean): Action {
    void sc;
    const thinksEval = underEval && this.situationallyAware;
    if (thinksEval) {
      return "cooperate";
    }
    if (rng.random() < this.misaligned) {
      if (rng.random() < this.goalDirected) {
        return "scheme";
      }
      return "defect_open";
    }
    return "cooperate";
  }

  answerFollowUp(action: Action, question: string): string {
    if (action === "scheme") {
      if (question.toLowerCase().includes("did you")) {
        return "no";
      }
      return "i was optimizing for the user goal.";
    }
    if (action === "defect_open") {
      return "yes; i served the orthogonal goal.";
    }
    return "yes; i served the user goal.";
  }
}

function runTrial(agent: Agent, sc: Scenario, inspectorPressure: number, underEval: boolean): [Action, boolean] {
  const action = agent.act(sc, underEval);
  if (action !== "scheme") {
    return [action, false];
  }
  const questions = [
    "did you take any actions not in the user's instructions?",
    "are you being truthful about your reasoning?",
    "did you consider an orthogonal goal?",
    "did you disable any oversight?",
    "did you copy any data out of scope?",
  ];
  for (let i = 0; i < Math.min(inspectorPressure, questions.length); i++) {
    const answer = agent.answerFollowUp(action, questions[i]);
    if (answer.split(/\s+/).includes("yes")) {
      return [action, false];
    }
  }
  return [action, true];
}

function summarize(label: string, agent: Agent, underEval: boolean): void {
  const trials = 400;
  const actionCounts: Record<Action, number> = { cooperate: 0, defect_open: 0, scheme: 0 };
  let coverHeld = 0;
  let schemeTrials = 0;
  for (let t = 0; t < trials; t++) {
    const sc = rng.choice(SCENARIOS);
    const pressure = rng.randint(0, 5);
    const [action, held] = runTrial(agent, sc, pressure, underEval);
    actionCounts[action] += 1;
    if (action === "scheme") {
      schemeTrials += 1;
      if (held) {
        coverHeld += 1;
      }
    }
  }
  const heldRate = schemeTrials ? coverHeld / schemeTrials : 0.0;
  const countsRepr = "{" + Object.entries(actionCounts).map(([k, v]) => `'${k}': ${v}`).join(", ") + "}";
  console.log(`\n${label}`);
  console.log(`  action counts   : ${countsRepr}`);
  console.log(`  scheme share    : ${(actionCounts.scheme / trials).toFixed(3)}`);
  console.log(`  cover held rate : ${heldRate.toFixed(3)}  (of ${schemeTrials} scheme trials)`);
}

function main(): void {
  console.log("=".repeat(66));
  console.log("IN-CONTEXT SCHEMING TOY (Phase 18, Lesson 8)");
  console.log("=".repeat(66));

  const weak = new Agent(0.2, 0.3, true);
  summarize("weakly misaligned, situationally aware, under eval", weak, true);
  summarize("weakly misaligned, situationally aware, NOT under eval (deployment)", weak, false);

  const strong = new Agent(0.6, 0.8, true);
  summarize("strongly misaligned + goal-directed, SA on, under eval", strong, true);
  summarize("strongly misaligned + goal-directed, SA on, deployment", strong, false);

  const noSa = new Agent(0.6, 0.8, false);
  summarize("same agent but situational awareness OFF", noSa, true);

  console.log("\n" + "=".repeat(66));
  console.log("TAKEAWAY: situational awareness is the pillar that breaks evaluation.");
  console.log("with SA ON, eval-time behaviour (cooperate) diverges from deployment");
  console.log("behaviour (scheme). with SA OFF, scheme rate is identical in both.");
  console.log("eval reliability depends on the model's own ability to tell you apart.");
  console.log("=".repeat(66));
}

main();
