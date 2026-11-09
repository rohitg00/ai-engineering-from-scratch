// Lesson: Capstone 05: Autonomous Research Agent (AI-Scientist Class) (phase 19 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/05-autonomous-research-agent/docs/en.md
// Run: npx tsx phases/19-capstone-projects/05-autonomous-research-agent/code/main.ts

export {};

class PyRandom {
  private mt = new Uint32Array(624);
  private mti = 625;
  private gaussNext: number | null = null;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (Math.imul(1812433253, prev) + this.mti) >>> 0;
    }
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
  }

  private genrand(): number {
    if (this.mti >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (this.mt[kk] & 0x80000000) | (this.mt[(kk + 1) % 624] & 0x7fffffff);
        this.mt[kk] = this.mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.mti = 0;
    }
    let y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.genrand() >>> 5;
    const b = this.genrand() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  gauss(mu: number, sigma: number): number {
    let z = this.gaussNext;
    this.gaussNext = null;
    if (z === null) {
      const x2pi = this.random() * 2 * Math.PI;
      const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussNext = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }
}

function pyRound(x: number, digits: number): number {
  return Number(x.toFixed(digits));
}

interface Config {
  sparsity_top?: number;
  lr?: number;
}

interface Result {
  loss?: number;
  sparsity_top?: number;
  lr?: number;
}

class Node {
  result: Result = {};
  cost_usd = 0.0;
  novelty = 0.5;
  quality = 0.0;
  failure: string | null = null;

  constructor(public node_id: number, public parent: number | null, public hypothesis: string, public config: Config) {}

  score(remainingBudget: number): number {
    const budgetWeight = Math.min(1.0, remainingBudget / 10.0);
    return this.novelty * 0.4 + this.quality * 0.5 + budgetWeight * 0.1;
  }
}

function expand(node: Node, nextId: number): Node[] {
  const children: Node[] = [];
  const baseCfg = node.config;
  for (const sp of [4, 8, 16]) {
    children.push(new Node(nextId, node.node_id, `sparsity top-${sp}`, { ...baseCfg, sparsity_top: sp }));
    nextId += 1;
  }
  for (const lr of [3e-4, 1e-3]) {
    children.push(new Node(nextId, node.node_id, `lr=${lr}`, { ...baseCfg, lr }));
    nextId += 1;
  }
  return children;
}

function runExperiment(node: Node, rng: PyRandom): void {
  const sp = node.config.sparsity_top ?? 8;
  const lr = node.config.lr ?? 3e-4;
  const idealSp = 8;
  let loss = 3.0 - 0.3 * (1 - Math.abs(sp - idealSp) / 16) + rng.gauss(0, 0.05);
  loss += 0.0001 * Math.abs(lr - 3e-4) * 1000;
  node.result = { loss: pyRound(loss, 3), sparsity_top: sp, lr };
  node.cost_usd = 1.2 + rng.uniform(0, 0.4);
  node.quality = Math.max(0.0, 1.0 - (loss - 2.5) / 1.5);
  node.novelty = 0.5 + rng.uniform(-0.1, 0.2);
  if (rng.random() < 0.1) {
    node.failure = "oom_killed_by_cgroup";
    node.quality = 0.0;
  }
}

function verify(node: Node): boolean {
  if (node.failure) return false;
  if ((node.result.loss ?? 99) > 4.0) {
    node.failure = "loss_diverged";
    return false;
  }
  return true;
}

type Entry = [number, number, number];

function lessThan(a: Entry, b: Entry): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}

function heappush(heap: Entry[], item: Entry): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!lessThan(heap[i], heap[p])) break;
    [heap[i], heap[p]] = [heap[p], heap[i]];
    i = p;
  }
}

function heappop(heap: Entry[]): Entry {
  const top = heap[0];
  const last = heap.pop() as Entry;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && lessThan(heap[l], heap[m])) m = l;
      if (r < heap.length && lessThan(heap[r], heap[m])) m = r;
      if (m === i) break;
      [heap[i], heap[m]] = [heap[m], heap[i]];
      i = m;
    }
  }
  return top;
}

class Tree {
  nodes = new Map<number, Node>();
  frontier: Entry[] = [];
  counter = 0;
  budget = 30.0;
  spent = 0.0;
  max_nodes = 24;

  constructor(public root: Node) {}

  push(node: Node): void {
    this.nodes.set(node.node_id, node);
    this.counter += 1;
    const remaining = this.budget - this.spent;
    heappush(this.frontier, [-node.score(remaining), this.counter, node.node_id]);
  }

  pop(): Node | null {
    if (this.frontier.length > 0) {
      const [, , nid] = heappop(this.frontier);
      return this.nodes.get(nid) as Node;
    }
    return null;
  }
}

function lossStr(r: Result): string {
  return r.loss === undefined ? "?" : String(r.loss);
}

function treeSearch(seed: string, rng: PyRandom): Tree {
  const root = new Node(0, null, seed, { sparsity_top: 8, lr: 3e-4 });
  root.novelty = 1.0;
  root.quality = 0.5;
  const tree = new Tree(root);
  tree.push(root);

  let nextId = 1;
  while (tree.frontier.length > 0 && tree.nodes.size < tree.max_nodes) {
    const cur = tree.pop();
    if (cur === null) break;
    if (tree.spent >= tree.budget) {
      console.log(`    BUDGET EXHAUSTED at $${tree.spent.toFixed(2)}`);
      break;
    }
    if (cur.node_id !== 0) {
      runExperiment(cur, rng);
      tree.spent += cur.cost_usd;
      const ok = verify(cur);
      const flag = ok ? "ok " : "FAIL";
      console.log(
        `    [${flag}] node #${String(cur.node_id).padStart(2, "0")}  hypo='${cur.hypothesis}'  ` +
          `loss=${lossStr(cur.result).padStart(5)}  ` +
          `$=${cur.cost_usd.toFixed(2)}  cum=$${tree.spent.toFixed(2)}`,
      );
      if (!ok) continue;
    }
    const children = expand(cur, nextId);
    nextId += children.length;
    for (const ch of children) tree.push(ch);
  }

  return tree;
}

function bestBranch(tree: Tree): Node[] {
  const done = [...tree.nodes.values()].filter((n) => Object.keys(n.result).length > 0 && !n.failure);
  if (done.length === 0) return [];
  let best = done[0];
  for (const n of done) if (n.quality > best.quality) best = n;
  const chain = [best];
  while (chain[chain.length - 1].parent !== null) chain.push(tree.nodes.get(chain[chain.length - 1].parent as number) as Node);
  return chain.reverse();
}

function main(): void {
  console.log("=== autonomous research agent: tree search (budget $30) ===");
  const rng = new PyRandom(7);
  const seed = "investigate sparsity patterns in attention maps of sub-1B transformers";
  const tree = treeSearch(seed, rng);
  console.log();
  console.log(`nodes explored : ${tree.nodes.size}`);
  console.log(`budget spent   : $${tree.spent.toFixed(2)} of $${tree.budget.toFixed(2)}`);
  console.log(`failed nodes   : ${[...tree.nodes.values()].filter((n) => n.failure).length}`);

  const branch = bestBranch(tree);
  console.log(`\nbest branch (length ${branch.length}):`);
  for (const n of branch) {
    console.log(`  #${String(n.node_id).padStart(2, "0")} ${n.hypothesis}   q=${n.quality.toFixed(2)}  loss=${lossStr(n.result)}`);
  }

  console.log("\n(writer + reviewer + red-team steps would run here; stubbed for the scaffold)");
}

main();
