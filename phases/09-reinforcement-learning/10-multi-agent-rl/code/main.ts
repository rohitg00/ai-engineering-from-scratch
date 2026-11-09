// Lesson: Multi-Agent RL (phase 09 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/10-multi-agent-rl/code/main.ts

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

type Pos = [number, number];
type JointState = [Pos, Pos];
type Action = "up" | "down" | "left" | "right";
type JointAction = [Action, Action];

const GRID = 5;
const GOAL: Pos = [4, 4];
const ACTIONS: readonly Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

class Table<A> {
  readonly rows = new Map<string, Map<A, number>>();

  constructor(private readonly actions: readonly A[]) {}

  get(s: JointState): Map<A, number> {
    const k = stateKey(s);
    let row = this.rows.get(k);
    if (row === undefined) {
      row = new Map(this.actions.map((a) => [a, 0.0]));
      this.rows.set(k, row);
    }
    return row;
  }
}

function stateKey(s: JointState): string {
  return `${s[0][0]},${s[0][1]}|${s[1][0]},${s[1][1]}`;
}

function samePos(a: Pos, b: Pos): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function move(pos: Pos, action: Action): Pos {
  const [dr, dc] = DELTAS[action];
  const [r, c] = pos;
  return [Math.min(Math.max(r + dr, 0), GRID - 1), Math.min(Math.max(c + dc, 0), GRID - 1)];
}

function reset(): JointState {
  return [
    [0, 0],
    [GRID - 1, 0],
  ];
}

function step(state: JointState, actionPair: JointAction): [JointState, number, boolean] {
  const [a1Pos, a2Pos] = state;
  const new1 = move(a1Pos, actionPair[0]);
  const new2 = move(a2Pos, actionPair[1]);
  const done = samePos(new1, GOAL) && samePos(new2, GOAL);
  const reward = done ? 10.0 : -1.0;
  return [[new1, new2], reward, done];
}

function defaultQ(): Table<Action> {
  return new Table(ACTIONS);
}

function argmaxKey<A>(keys: readonly A[], q: Map<A, number>): A {
  let best = keys[0];
  for (const a of keys) if (q.get(a)! > q.get(best)!) best = a;
  return best;
}

function maxValue<A>(q: Map<A, number>): number {
  return Math.max(...q.values());
}

function epsilonGreedy(qTable: Table<Action>, state: JointState, rng: Random, epsilon: number): Action {
  if (rng.random() < epsilon) return rng.choice(ACTIONS);
  return argmaxKey(ACTIONS, qTable.get(state));
}

function independentQ(
  episodes = 1500,
  alpha = 0.1,
  gamma = 0.95,
  epsilon = 0.15,
  rng: Random = new Random(0),
): [Table<Action>, Table<Action>, number[]] {
  const Q1 = defaultQ();
  const Q2 = defaultQ();
  const returnsLog: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    let total = 0.0;
    for (let t = 0; t < 100; t++) {
      const a1 = epsilonGreedy(Q1, s, rng, epsilon);
      const a2 = epsilonGreedy(Q2, s, rng, epsilon);
      const [sNext, r, done] = step(s, [a1, a2]);
      total += r;
      const row1 = Q1.get(s);
      const row2 = Q2.get(s);
      if (done) {
        row1.set(a1, row1.get(a1)! + alpha * (r - row1.get(a1)!));
        row2.set(a2, row2.get(a2)! + alpha * (r - row2.get(a2)!));
        break;
      }
      const target1 = r + gamma * maxValue(Q1.get(sNext));
      const target2 = r + gamma * maxValue(Q2.get(sNext));
      row1.set(a1, row1.get(a1)! + alpha * (target1 - row1.get(a1)!));
      row2.set(a2, row2.get(a2)! + alpha * (target2 - row2.get(a2)!));
      s = sNext;
    }
    returnsLog.push(total);
  }
  return [Q1, Q2, returnsLog];
}

function jointActionList(): JointAction[] {
  const out: JointAction[] = [];
  for (const a of ACTIONS) for (const b of ACTIONS) out.push([a, b]);
  return out;
}

const JOINT_ACTIONS: readonly JointAction[] = jointActionList();

function jointQLearning(
  episodes = 1500,
  alpha = 0.1,
  gamma = 0.95,
  epsilon = 0.15,
  rng: Random = new Random(0),
): [Table<JointAction>, number[]] {
  const jointActions = JOINT_ACTIONS;
  const Q = new Table<JointAction>(jointActions);
  const returnsLog: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    let total = 0.0;
    for (let t = 0; t < 100; t++) {
      let ja: JointAction;
      if (rng.random() < epsilon) ja = rng.choice(jointActions);
      else ja = argmaxKey(jointActions, Q.get(s));
      const [sNext, r, done] = step(s, ja);
      total += r;
      const row = Q.get(s);
      if (done) {
        row.set(ja, row.get(ja)! + alpha * (r - row.get(ja)!));
        break;
      }
      const bestNext = maxValue(Q.get(sNext));
      row.set(ja, row.get(ja)! + alpha * (r + gamma * bestNext - row.get(ja)!));
      s = sNext;
    }
    returnsLog.push(total);
  }
  return [Q, returnsLog];
}

function blockMean(xs: number[], block: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= xs.length - block; i += block) {
    let s = 0;
    for (const x of xs.slice(i, i + block)) s += x;
    out.push(s / block);
  }
  return out;
}

function evaluateInd(Q1: Table<Action>, Q2: Table<Action>, episodes = 100, rng: Random = new Random(42)): number {
  let total = 0.0;
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    for (let t = 0; t < 100; t++) {
      const a1 = epsilonGreedy(Q1, s, rng, 0.0);
      const a2 = epsilonGreedy(Q2, s, rng, 0.0);
      const [next, r, done] = step(s, [a1, a2]);
      s = next;
      total += r;
      if (done) break;
    }
  }
  return total / episodes;
}

function evaluateJoint(Q: Table<JointAction>, episodes = 100): number {
  const jointActions = JOINT_ACTIONS;
  let total = 0.0;
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    for (let t = 0; t < 100; t++) {
      const ja = argmaxKey(jointActions, Q.get(s));
      const [next, r, done] = step(s, ja);
      s = next;
      total += r;
      if (done) break;
    }
  }
  return total / episodes;
}

function main(): void {
  console.log(`=== Cooperative 2-agent GridWorld (${GRID}x${GRID}, shared reward) ===`);
  console.log(`agents start at (0,0) and (${GRID - 1}, 0); must both reach (${GOAL[0]}, ${GOAL[1]})`);
  console.log();

  const [Q1, Q2, logInd] = independentQ(1500, 0.1, 0.95, 0.15, new Random(1));
  const [qJoint, logJoint] = jointQLearning(1500, 0.1, 0.95, 0.15, new Random(1));

  console.log("learning curves (mean return per 150 episodes):");
  const bi = blockMean(logInd, 150);
  const bj = blockMean(logJoint, 150);
  for (let i = 0; i < Math.min(bi.length, bj.length); i++) {
    console.log(`  block ${i + 1}: independent-Q = ${bi[i].toFixed(2).padStart(7)}   joint-Q = ${bj[i].toFixed(2).padStart(7)}`);
  }

  console.log();
  console.log(`final greedy evaluation (100 eps):`);
  console.log(`  independent-Q mean return = ${evaluateInd(Q1, Q2).toFixed(2)}`);
  console.log(`  joint-Q       mean return = ${evaluateJoint(qJoint).toFixed(2)}`);

  console.log();
  console.log("note: joint-Q factors the global view correctly, but its action space is |A|^2.");
  console.log("CTDE methods (MAPPO, QMIX) keep decentralized actors but use a centralized critic.");
}

main();
