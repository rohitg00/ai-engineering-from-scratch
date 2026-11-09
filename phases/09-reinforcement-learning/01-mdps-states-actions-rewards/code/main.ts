// Lesson: MDPs, States, Actions & Rewards (phase 09 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/01-mdps-states-actions-rewards/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/01-mdps-states-actions-rewards/code/main.ts

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

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type Dist = Map<Action, number>;
type Policy = (state: State) => Dist;

const GRID = 4;
const TERMINAL: State = [3, 3];
const ACTIONS = new Map<Action, [number, number]>([
  ["up", [-1, 0]],
  ["down", [1, 0]],
  ["left", [0, -1]],
  ["right", [0, 1]],
]);

function same(a: State, b: State): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function key(s: State): string {
  return `${s[0]},${s[1]}`;
}

function allStates(): State[] {
  const out: State[] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) out.push([r, c]);
  return out;
}

function step(state: State, action: Action): [State, number, boolean] {
  if (same(state, TERMINAL)) return [state, 0.0, true];
  const [dr, dc] = ACTIONS.get(action)!;
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  const next: State = [nr, nc];
  return [next, -1.0, same(next, TERMINAL)];
}

function uniformPolicy(_state: State): Dist {
  return new Map([...ACTIONS.keys()].map((a) => [a, 1.0 / ACTIONS.size]));
}

function greedyPolicy(_state: State): Dist {
  return new Map<Action, number>([
    ["down", 0.5],
    ["right", 0.5],
    ["up", 0.0],
    ["left", 0.0],
  ]);
}

function sampleAction(dist: Dist, rng: Random): Action {
  const x = rng.random();
  let total = 0.0;
  for (const [a, p] of dist) {
    total += p;
    if (x <= total) return a;
  }
  return dist.keys().next().value!;
}

function rollout(policy: Policy, rng: Random, maxSteps = 200): [number, number] {
  let state: State = [0, 0];
  let total = 0.0;
  let steps = 0;
  for (let i = 0; i < maxSteps; i++) {
    const action = sampleAction(policy(state), rng);
    const [next, reward, done] = step(state, action);
    state = next;
    total += reward;
    steps += 1;
    if (done) break;
  }
  return [total, steps];
}

function policyEvaluation(policy: Policy, gamma = 0.99, tol = 1e-6, maxIter = 2000): Map<string, number> {
  let values = new Map<string, number>(allStates().map((s) => [key(s), 0.0]));
  for (let it = 0; it < maxIter; it++) {
    let delta = 0.0;
    const newValues = new Map(values);
    for (const state of allStates()) {
      if (same(state, TERMINAL)) continue;
      let v = 0.0;
      for (const [action, piA] of policy(state)) {
        const [sNext, reward] = step(state, action);
        v += piA * (reward + gamma * values.get(key(sNext))!);
      }
      delta = Math.max(delta, Math.abs(v - values.get(key(state))!));
      newValues.set(key(state), v);
    }
    values = newValues;
    if (delta < tol) break;
  }
  return values;
}

function printValueGrid(values: Map<string, number>, title: string): void {
  console.log(`  ${title}`);
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) row.push(values.get(key([r, c]))!.toFixed(2).padStart(7));
    console.log("   " + row.join(" "));
  }
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function main(): void {
  const rng = new Random(42);
  const returnsRandom = Array.from({ length: 5000 }, () => rollout(uniformPolicy, rng)[0]);
  const meanRandom = mean(returnsRandom);

  const rng2 = new Random(42);
  const returnsGreedy = Array.from({ length: 5000 }, () => rollout(greedyPolicy, rng2)[0]);
  const meanGreedy = mean(returnsGreedy);

  console.log("=== 4x4 GridWorld, 5000 rollouts ===");
  console.log(`random policy:  mean return = ${meanRandom.toFixed(2)}   (optimal = -6.00)`);
  console.log(`greedy  policy: mean return = ${meanGreedy.toFixed(2)}`);

  console.log();
  console.log("=== Policy evaluation V^pi(s) for uniform-random policy ===");
  for (const gamma of [0.5, 0.9, 0.99]) {
    const values = policyEvaluation(uniformPolicy, gamma);
    printValueGrid(values, `gamma = ${gamma}`);
    console.log();
  }

  console.log("=== Policy evaluation V^pi(s) for greedy down+right policy (gamma=0.99) ===");
  const values = policyEvaluation(greedyPolicy, 0.99);
  printValueGrid(values, "greedy policy");
  console.log();
  console.log("note: greedy values at (0,0) track the true optimal return far closer than random.");
}

main();
