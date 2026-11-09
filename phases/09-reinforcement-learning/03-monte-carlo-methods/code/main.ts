// Lesson: Monte Carlo Methods: Learning from Complete Episodes (phase 09 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/03-monte-carlo-methods/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/03-monte-carlo-methods/code/main.ts

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

  choice<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type Step = [State, Action, number];
type Policy = (state: State, rng: Random) => Action;
type QRow = Map<Action, number>;

const GRID = 4;
const TERMINAL: State = [3, 3];
const ACTIONS: readonly Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

function key(s: State): string {
  return `${s[0]},${s[1]}`;
}

function isTerminal(s: State): boolean {
  return s[0] === TERMINAL[0] && s[1] === TERMINAL[1];
}

function reset(): State {
  return [0, 0];
}

function step(state: State, action: Action): [State, number, boolean] {
  if (isTerminal(state)) return [state, 0.0, true];
  const [dr, dc] = DELTAS[action];
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  const next: State = [nr, nc];
  return [next, -1.0, isTerminal(next)];
}

function states(): State[] {
  const out: State[] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) out.push([r, c]);
  return out;
}

function rollout(policy: Policy, rng: Random, maxSteps = 200): Step[] {
  const trajectory: Step[] = [];
  let state = reset();
  for (let i = 0; i < maxSteps; i++) {
    const action = policy(state, rng);
    const [stateNext, reward, done] = step(state, action);
    trajectory.push([state, action, reward]);
    state = stateNext;
    if (done) break;
  }
  return trajectory;
}

function returnsFrom(trajectory: Step[], gamma: number): number[] {
  const returns: number[] = [];
  let G = 0.0;
  for (let i = trajectory.length - 1; i >= 0; i--) {
    G = trajectory[i][2] + gamma * G;
    returns.push(G);
  }
  returns.reverse();
  return returns;
}

function uniformPolicy(_state: State, rng: Random): Action {
  return rng.choice(ACTIONS);
}

function mcPolicyEvaluation(
  policy: Policy,
  episodes: number,
  gamma = 0.99,
  rng: Random = new Random(0),
): [Map<string, number>, Map<string, number>] {
  const V = new Map<string, number>();
  const counts = new Map<string, number>();
  for (let ep = 0; ep < episodes; ep++) {
    const trajectory = rollout(policy, rng);
    const returns = returnsFrom(trajectory, gamma);
    const seen = new Set<string>();
    for (let i = 0; i < trajectory.length; i++) {
      const s = key(trajectory[i][0]);
      const G = returns[i];
      if (seen.has(s)) continue;
      seen.add(s);
      counts.set(s, (counts.get(s) ?? 0) + 1);
      const v = V.get(s) ?? 0.0;
      V.set(s, v + (G - v) / counts.get(s)!);
    }
  }
  return [V, counts];
}

function bestAction(row: QRow): Action {
  let best: Action = ACTIONS[0];
  let bestValue = -Infinity;
  for (const [a, v] of row) {
    if (v > bestValue) {
      best = a;
      bestValue = v;
    }
  }
  return best;
}

function mcControl(
  episodes: number,
  gamma = 0.99,
  epsilon = 0.1,
  rng: Random = new Random(0),
): [Map<string, QRow>, Map<string, Action>, number[]] {
  const Q = new Map<string, QRow>();
  const counts = new Map<string, Map<Action, number>>();
  const getQ = (s: string): QRow => {
    let row = Q.get(s);
    if (row === undefined) {
      row = new Map(ACTIONS.map((a) => [a, 0.0]));
      Q.set(s, row);
    }
    return row;
  };
  const getCounts = (s: string): Map<Action, number> => {
    let row = counts.get(s);
    if (row === undefined) {
      row = new Map(ACTIONS.map((a) => [a, 0]));
      counts.set(s, row);
    }
    return row;
  };

  const policy: Policy = (state, localRng) => {
    if (localRng.random() < epsilon) return localRng.choice(ACTIONS);
    return bestAction(getQ(key(state)));
  };

  const returnsLog: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    const trajectory = rollout(policy, rng);
    const returns = returnsFrom(trajectory, gamma);
    const seen = new Set<string>();
    for (let i = 0; i < trajectory.length; i++) {
      const [st, a] = trajectory[i];
      const s = key(st);
      const G = returns[i];
      const sa = `${s}|${a}`;
      if (seen.has(sa)) continue;
      seen.add(sa);
      const cRow = getCounts(s);
      cRow.set(a, cRow.get(a)! + 1);
      const qRow = getQ(s);
      qRow.set(a, qRow.get(a)! + (G - qRow.get(a)!) / cRow.get(a)!);
    }
    if (returns.length > 0) returnsLog.push(returns[0]);
  }
  const greedy = new Map<string, Action>();
  for (const [s, row] of Q) greedy.set(s, bestAction(row));
  return [Q, greedy, returnsLog];
}

function printV(V: Map<string, number>, title: string): void {
  console.log(`  ${title}`);
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) {
      const k = key([r, c]);
      if (!V.has(k)) V.set(k, 0.0);
      row.push(V.get(k)!.toFixed(2).padStart(7));
    }
    console.log("   " + row.join(" "));
  }
}

function printPolicy(policy: Map<string, Action>, title: string): void {
  const arrows: Record<Action, string> = { up: "^", down: "v", left: "<", right: ">" };
  console.log(`  ${title}`);
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) {
      const k = key([r, c]);
      if (policy.has(k) && !isTerminal([r, c])) row.push(arrows[policy.get(k)!]);
      else row.push(isTerminal([r, c]) ? "." : "?");
    }
    console.log("   " + row.join(" "));
  }
}

function main(): void {
  const rng = new Random(1);
  const [V, counts] = mcPolicyEvaluation(uniformPolicy, 20000, 0.99, rng);
  console.log(`=== first-visit MC, uniform-random policy, 20000 episodes, gamma=0.99 ===`);
  printV(V, "V^pi(s)");
  console.log();
  console.log(`V(0,0) MC estimate     = ${V.get(key([0, 0]))!.toFixed(2)}`);
  console.log(`V(0,0) DP  reference   = -39.41   (from lesson 02 of this phase)`);
  console.log(`visit counts at (0,0)  = ${counts.get(key([0, 0])) ?? 0}`);
  console.log();

  const rng2 = new Random(1);
  const [, greedy, log] = mcControl(30000, 0.99, 0.1, rng2);
  console.log("=== epsilon-greedy MC control, 30000 episodes ===");
  printPolicy(greedy, "greedy policy recovered");
  console.log();
  const tail = log.slice(-5000);
  if (tail.length > 0) {
    let total = 0;
    for (const x of tail) total += x;
    const meanTail = total / tail.length;
    console.log(`mean return over last 5000 episodes = ${meanTail.toFixed(2)}`);
    console.log("(optimal return on this 4x4 GridWorld = -6.0)");
  }
}

main();
