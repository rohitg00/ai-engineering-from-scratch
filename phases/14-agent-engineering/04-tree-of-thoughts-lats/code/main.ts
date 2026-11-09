// Lesson: Tree of Thoughts and LATS: Deliberate Search (phase 14 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md
// Run: npx tsx phases/14-agent-engineering/04-tree-of-thoughts-lats/code/main.ts

export {};

interface Num {
  v: number;
  f: boolean;
}

const NUMBERS = [4, 6, 4, 1];
const TARGET = 24;
const OPS = ["+", "-", "*", "/"];

function pyFloat(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = parseInt(expStr, 10);
  if (exp < -4 || exp >= 16) {
    const sign = exp < 0 ? "-" : "+";
    return `${mant}e${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  const s = String(x);
  return s.includes(".") ? s : s + ".0";
}

function numStr(n: Num): string {
  return n.f ? pyFloat(n.v) : String(n.v);
}

function pyFixed(x: number, d: number): string {
  const s = x.toFixed(d);
  return Object.is(x, -0) ? "-" + s : s;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class TreeNode {
  visits = 0;
  valueSum = 0;
  children: TreeNode[] = [];

  constructor(public state: Num[], public trace: string[]) {}

  get q(): number {
    return this.visits ? this.valueSum / this.visits : 0;
  }
}

function evaluate(a: Num, op: string, b: Num): Num | null {
  const f = a.f || b.f;
  if (op === "+") return { v: a.v + b.v, f };
  if (op === "-") return { v: a.v - b.v, f };
  if (op === "*") return { v: a.v * b.v, f };
  if (op === "/") return b.v !== 0 ? { v: a.v / b.v, f: true } : null;
  return null;
}

function sortedDesc(xs: Num[]): Num[] {
  return [...xs].sort((p, q) => q.v - p.v);
}

function expand(node: TreeNode): TreeNode[] {
  const children: TreeNode[] = [];
  const state = node.state;
  if (state.length < 2) return children;
  for (let i = 0; i < state.length; i++) {
    for (let j = i + 1; j < state.length; j++) {
      for (const op of OPS) {
        const a = state[i];
        const b = state[j];
        const v = evaluate(a, op, b);
        if (v === null) continue;
        const remaining = state.filter((_s, k) => k !== i && k !== j);
        const newState = sortedDesc([...remaining, v]);
        const step = `${numStr(a)}${op}${numStr(b)}=${numStr(v)}`;
        children.push(new TreeNode(newState, [...node.trace, step]));
      }
    }
  }
  return children;
}

function value(node: TreeNode): number {
  if (node.state.length === 1) {
    const result = node.state[0];
    if (Math.abs(result.v - TARGET) < 1e-6) return 1.0;
    const d = Math.abs(result.v - TARGET);
    return d === 0 && !result.f ? 0 : -d / 100.0;
  }
  let best = node.state[0];
  for (const s of node.state) {
    if (Math.abs(s.v - TARGET) < Math.abs(best.v - TARGET)) best = s;
  }
  const d = Math.abs(best.v - TARGET);
  return d === 0 && !best.f ? 0 : -d / 100.0;
}

function maxBy<T>(xs: T[], key: (x: T) => number): T {
  let best = xs[0];
  let bestK = key(best);
  for (let i = 1; i < xs.length; i++) {
    const k = key(xs[i]);
    if (k > bestK) {
      best = xs[i];
      bestK = k;
    }
  }
  return best;
}

function totBfs(root: TreeNode, maxExpansionsPerLevel = 8, maxDepth = 3): [TreeNode | null, number] {
  let frontier = [root];
  let expansions = 0;
  for (let depth = 0; depth < maxDepth; depth++) {
    const scored: Array<[number, TreeNode]> = [];
    for (const node of frontier) {
      for (const child of expand(node)) {
        expansions += 1;
        scored.push([value(child), child]);
        if (value(child) > 0.99) return [child, expansions];
      }
    }
    scored.sort((p, q) => q[0] - p[0]);
    frontier = scored.slice(0, maxExpansionsPerLevel).map((p) => p[1]);
  }
  const best = frontier.length > 0 ? maxBy(frontier, value) : null;
  return [best, expansions];
}

function uct(parent: TreeNode, child: TreeNode, c = 1.4): number {
  if (child.visits === 0) return Infinity;
  return child.q + c * Math.sqrt(Math.log(parent.visits) / child.visits);
}

function select(node: TreeNode): TreeNode {
  let cur = node;
  while (cur.children.length > 0) {
    const parent = cur;
    cur = maxBy(parent.children, (ch) => uct(parent, ch));
  }
  return cur;
}

function simulate(node: TreeNode, depth: number, rng: () => number): number {
  let current = node;
  for (let d = 0; d < depth; d++) {
    const options = expand(current);
    if (options.length === 0) break;
    current = options[Math.floor(rng() * options.length)];
  }
  return value(current);
}

function backprop(path: TreeNode[], reward: number): void {
  for (const n of path) {
    n.visits += 1;
    n.valueSum += reward;
  }
}

function mcts(root: TreeNode, iterations: number, rng: () => number): [TreeNode, number] {
  let expansions = 0;
  for (let it = 0; it < iterations; it++) {
    const path = [root];
    let cur = root;
    while (cur.children.length > 0) {
      const parent = cur;
      cur = maxBy(parent.children, (ch) => uct(parent, ch));
      path.push(cur);
    }
    if (cur.visits > 0 && cur.state.length > 1) {
      cur.children = expand(cur);
      expansions += cur.children.length;
      if (cur.children.length > 0) {
        cur = cur.children[0];
        path.push(cur);
      }
    }
    const reward = simulate(cur, Math.max(0, 3 - cur.trace.length), rng);
    backprop(path, reward);
  }
  const leaves = allLeaves(root);
  const bestLeaf = leaves.length > 0 ? maxBy(leaves, value) : root;
  return [bestLeaf, expansions];
}

function allLeaves(node: TreeNode): TreeNode[] {
  if (node.children.length === 0) return [node];
  const out: TreeNode[] = [];
  for (const ch of node.children) out.push(...allLeaves(ch));
  return out;
}

function traceRepr(trace: string[]): string {
  return "[" + trace.map((s) => `'${s}'`).join(", ") + "]";
}

function stateRepr(state: Num[]): string {
  if (state.length === 1) return `(${numStr(state[0])},)`;
  return "(" + state.map(numStr).join(", ") + ")";
}

function main(): void {
  console.log("=".repeat(70));
  console.log("TREE OF THOUGHTS + LATS: Phase 14, Lesson 04");
  console.log("=".repeat(70));
  console.log(`numbers: [${NUMBERS.join(", ")}]  target: ${TARGET}`);

  const start = (): Num[] => sortedDesc(NUMBERS.map((v) => ({ v, f: false })));

  const rootTot = new TreeNode(start(), []);
  const [bestTot, nTot] = totBfs(rootTot);
  console.log("\nToT BFS");
  console.log("-".repeat(60));
  if (bestTot !== null) {
    console.log(`  best trace: ${traceRepr(bestTot.trace)}`);
    console.log(`  final state: ${stateRepr(bestTot.state)}  value: ${pyFixed(value(bestTot), 3)}`);
  }
  console.log(`  expansions: ${nTot}`);

  const rng = mulberry32(7);
  const rootLats = new TreeNode(start(), []);
  rootLats.children = expand(rootLats);
  for (const ch of rootLats.children) ch.visits = 0;
  const [bestLats, nLats] = mcts(rootLats, 80, rng);
  console.log("\nLATS MCTS");
  console.log("-".repeat(60));
  console.log(`  best trace: ${traceRepr(bestLats.trace)}`);
  console.log(`  final state: ${stateRepr(bestLats.state)}  value: ${pyFixed(value(bestLats), 3)}`);
  console.log(`  node expansions: ${nLats}`);

  console.log();
  console.log("Paper headlines (for reference):");
  console.log("  ToT Game-of-24:  GPT-4 CoT 4%  -> ToT 74%");
  console.log("  LATS HumanEval:  pass@1 92.7% with GPT-4 (SOTA at paper time)");
  console.log("  Cost: ToT uses 100-1000x the tokens of CoT. Use with intent.");
}

main();
