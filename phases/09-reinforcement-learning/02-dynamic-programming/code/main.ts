// Lesson: Dynamic Programming: Policy Iteration & Value Iteration (phase 09 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/02-dynamic-programming/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/02-dynamic-programming/code/main.ts

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type Values = Map<string, number>;
type PolicyMap = Map<string, Action>;
type Dist = Map<Action, number>;

const GRID = 4;
const TERMINAL: State = [3, 3];
const ACTIONS: Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const SLIP = 0.1;

function pySum(xs: Iterable<number>): number {
  let f = 0;
  let c = 0;
  for (const x of xs) {
    const t = f + x;
    if (Math.abs(f) >= Math.abs(x)) c += f - t + x;
    else c += x - t + f;
    f = t;
  }
  if (c && Number.isFinite(c)) f += c;
  return f;
}

function argmax<T>(items: T[], score: (item: T) => number): T {
  let best = items[0];
  let bestScore = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s > bestScore) {
      best = items[i];
      bestScore = s;
    }
  }
  return best;
}

function key(s: State): string {
  return `${s[0]},${s[1]}`;
}

function isTerminal(s: State): boolean {
  return s[0] === TERMINAL[0] && s[1] === TERMINAL[1];
}

function states(): State[] {
  const out: State[] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) out.push([r, c]);
  return out;
}

function applyMove(state: State, direction: Action): State {
  const [dr, dc] = DELTAS[direction];
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  return [nr, nc];
}

function perpendiculars(action: Action): [Action, Action] {
  if (action === "up" || action === "down") return ["left", "right"];
  return ["up", "down"];
}

function transitions(state: State, action: Action): [State, number, number][] {
  if (isTerminal(state)) return [[state, 0.0, 1.0]];
  const outcomes: [State, number, number][] = [];
  const pIntended = 1.0 - SLIP;
  outcomes.push([applyMove(state, action), -1.0, pIntended]);
  for (const perp of perpendiculars(action)) outcomes.push([applyMove(state, perp), -1.0, SLIP / 2.0]);
  return outcomes;
}

function qValue(state: State, action: Action, V: Values, gamma: number): number {
  return pySum(transitions(state, action).map(([sNext, r, p]) => p * (r + gamma * V.get(key(sNext))!)));
}

function policyEvaluation(policy: (s: State) => Dist, gamma = 0.99, tol = 1e-6, maxIter = 5000): Values {
  const V: Values = new Map(states().map((s) => [key(s), 0.0]));
  for (let it = 0; it < maxIter; it++) {
    let delta = 0.0;
    for (const state of states()) {
      if (isTerminal(state)) continue;
      const dist = policy(state);
      const v = pySum([...dist].map(([action, piA]) => piA * qValue(state, action, V, gamma)));
      delta = Math.max(delta, Math.abs(v - V.get(key(state))!));
      V.set(key(state), v);
    }
    if (delta < tol) return V;
  }
  return V;
}

function greedyFromV(V: Values, gamma = 0.99): PolicyMap {
  const policy: PolicyMap = new Map();
  for (const state of states()) {
    if (isTerminal(state)) {
      policy.set(key(state), "up");
      continue;
    }
    policy.set(key(state), argmax(ACTIONS, (a) => qValue(state, a, V, gamma)));
  }
  return policy;
}

function samePolicy(a: PolicyMap, b: PolicyMap): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function policyIteration(gamma = 0.99, tol = 1e-6): [Values, PolicyMap, number] {
  let policy: PolicyMap = new Map(states().map((s) => [key(s), "up" as Action]));
  let V: Values = new Map();
  for (let it = 0; it < 100; it++) {
    const current = policy;
    V = policyEvaluation((s) => new Map([[current.get(key(s))!, 1.0]]), gamma, tol);
    const newPolicy = greedyFromV(V, gamma);
    if (samePolicy(newPolicy, policy)) return [V, policy, it + 1];
    policy = newPolicy;
  }
  return [V, policy, 100];
}

function valueIteration(gamma = 0.99, tol = 1e-6, maxIter = 5000): [Values, PolicyMap, number] {
  const V: Values = new Map(states().map((s) => [key(s), 0.0]));
  for (let it = 0; it < maxIter; it++) {
    let delta = 0.0;
    for (const state of states()) {
      if (isTerminal(state)) continue;
      const v = Math.max(...ACTIONS.map((action) => qValue(state, action, V, gamma)));
      delta = Math.max(delta, Math.abs(v - V.get(key(state))!));
      V.set(key(state), v);
    }
    if (delta < tol) return [V, greedyFromV(V, gamma), it + 1];
  }
  return [V, greedyFromV(V, gamma), maxIter];
}

function printV(V: Values, title: string): void {
  console.log(`  ${title}`);
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) row.push(V.get(key([r, c]))!.toFixed(2).padStart(7));
    console.log("   " + row.join(" "));
  }
}

function printPolicy(policy: PolicyMap, title: string): void {
  const arrows: Record<Action, string> = { up: "^", down: "v", left: "<", right: ">" };
  console.log(`  ${title}`);
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) row.push(isTerminal([r, c]) ? "." : arrows[policy.get(key([r, c]))!]);
    console.log("   " + row.join(" "));
  }
}

function sci(x: number, digits: number): string {
  return x.toExponential(digits).replace(/e([+-])(\d)$/, "e$10$2");
}

function main(): void {
  console.log("=== 4x4 stochastic GridWorld (slip=0.1), value iteration ===");
  const [vVi, piVi, nVi] = valueIteration(0.99);
  printV(vVi, `V* (converged in ${nVi} sweeps)`);
  console.log();
  printPolicy(piVi, "optimal policy");

  console.log();
  console.log("=== Same MDP, policy iteration ===");
  const [vPi, piPi, nPi] = policyIteration(0.99);
  printV(vPi, `V* (converged in ${nPi} outer iters)`);
  console.log();
  printPolicy(piPi, "optimal policy");

  console.log();
  const vMatch = Math.max(...states().map((s) => Math.abs(vVi.get(key(s))! - vPi.get(key(s))!)));
  console.log(`sup-norm |V_vi - V_pi| = ${sci(vMatch, 2)}  (should be ~0)`);
  console.log(`policies identical?     ${samePolicy(piVi, piPi) ? "True" : "False"}`);
}

main();
