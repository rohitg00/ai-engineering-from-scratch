// Lesson: Graph Theory for Machine Learning (phase 01 / lesson 21)
// TypeScript port of code/graph_theory.py. Node standard library only.
// Source: phases/01-math-foundations/21-graph-theory/docs/en.md
// Run: npx tsx phases/01-math-foundations/21-graph-theory/code/graph_theory.ts
type Random = () => number;
type Matrix = number[][];

function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(random: Random): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randnMatrix(random: Random, rows: number, cols: number, scale: number): Matrix {
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(gauss(random) * scale);
    }
    result.push(row);
  }
  return result;
}

function zeros(rows: number, cols: number): Matrix {
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    result.push(new Array<number>(cols).fill(0));
  }
  return result;
}

function subtract(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((value, j) => value - b[i]![j]!));
}

function matmul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0]!.length;
  const result = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      for (let j = 0; j < cols; j++) {
        result[i]![j]! += a[i]![k]! * b[k]![j]!;
      }
    }
  }
  return result;
}

function vectorNorm(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value * value;
  }
  return Math.sqrt(total);
}

function mean(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
}

function symmetricEigen(matrix: Matrix): { values: number[]; vectors: Matrix } {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  const v = zeros(n, n);
  for (let i = 0; i < n; i++) {
    v[i]![i] = 1;
  }

  for (let sweep = 0; sweep < 100; sweep++) {
    let offDiagonal = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        offDiagonal += a[p]![q]! ** 2;
      }
    }
    if (offDiagonal < 1e-22) {
      break;
    }

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p]![q]!;
        if (Math.abs(apq) < 1e-300) {
          continue;
        }
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
        const sign = theta >= 0 ? 1 : -1;
        const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k++) {
          const akp = a[k]![p]!;
          const akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p]![k]!;
          const aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k]![p]!;
          const vkq = v[k]![q]!;
          v[k]![p] = c * vkp - s * vkq;
          v[k]![q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = [...Array(n).keys()].sort((i, j) => a[i]![i]! - a[j]![j]!);
  const values = order.map((i) => a[i]![i]!);
  const vectors = v.map((row) => order.map((i) => row[i]!));
  for (let col = 0; col < n; col++) {
    const firstNonZero = vectors.find((row) => Math.abs(row[col]!) > 1e-12);
    if (firstNonZero && firstNonZero[col]! < 0) {
      for (const row of vectors) {
        row[col] = -row[col]!;
      }
    }
  }
  return { values, vectors };
}

function roundHalfEven(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  const scaled = value * scale;
  let rounded = Math.round(scaled);
  if (Math.abs(scaled % 1) === 0.5 && rounded % 2 !== 0) {
    rounded -= 1;
  }
  return rounded / scale;
}

function pyFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function pyList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

function pyNestedList(groups: number[][]): string {
  return `[${groups.map(pyList).join(", ")}]`;
}

function pyDict(entries: Map<number, number>): string {
  const parts: string[] = [];
  for (const [key, value] of entries) {
    parts.push(`${key}: ${value}`);
  }
  return `{${parts.join(", ")}}`;
}

function npIntArray(values: number[]): string {
  const width = Math.max(...values.map((value) => String(value).length));
  return `[${values.map((value) => String(value).padStart(width)).join(" ")}]`;
}

function npIntMatrix(rows: Matrix): string {
  const all = rows.flat().map((value) => String(Math.trunc(value) + 0));
  const width = Math.max(...all.map((text) => text.length));
  const lines = rows.map(
    (row) => `[${row.map((value) => String(Math.trunc(value) + 0).padStart(width)).join(" ")}]`,
  );
  return `[${lines.join("\n ")}]`;
}

function fractionDigits(value: number): number {
  const text = String(Math.abs(value));
  const dot = text.indexOf(".");
  if (dot === -1) {
    return 0;
  }
  return Math.min(text.length - dot - 1, 8);
}

function npFloatArray(values: number[]): string {
  const precision = Math.max(...values.map(fractionDigits));
  const parts = values.map((value) => {
    const negative = value < 0 || Object.is(value, -0);
    const digits = fractionDigits(value);
    const [whole, fraction = ""] = Math.abs(value).toFixed(digits).split(".");
    return { whole: (negative ? "-" : "") + whole, fraction };
  });
  const wholeWidth = Math.max(...parts.map((part) => part.whole.length));
  const words = parts.map(
    (part) => `${part.whole.padStart(wholeWidth)}.${part.fraction.padEnd(precision)}`,
  );

  const lineWidth = 75;
  let text = "";
  let current = "[";
  words.forEach((word, index) => {
    const isLast = index === words.length - 1;
    const limit = isLast ? lineWidth - 1 : lineWidth;
    if (current.length + word.length > limit) {
      text += current.trimEnd() + "\n";
      current = " ";
    }
    current += word;
    if (!isLast) {
      current += " ";
    }
  });
  return text + current + "]";
}

class Graph {
  n: number;
  directed: boolean;
  adj: Map<number, Map<number, number>>;

  constructor(nNodes: number, directed = false) {
    this.n = nNodes;
    this.directed = directed;
    this.adj = new Map();
    for (let i = 0; i < nNodes; i++) {
      this.adj.set(i, new Map());
    }
  }

  addEdge(u: number, v: number, weight = 1.0): void {
    this.adj.get(u)!.set(v, weight);
    if (!this.directed) {
      this.adj.get(v)!.set(u, weight);
    }
  }

  neighbors(node: number): number[] {
    return [...this.adj.get(node)!.keys()];
  }

  degree(node: number): number {
    return this.adj.get(node)!.size;
  }

  weightedDegree(node: number): number {
    let total = 0;
    for (const weight of this.adj.get(node)!.values()) {
      total += weight;
    }
    return total;
  }

  adjacencyMatrix(): Matrix {
    const A = zeros(this.n, this.n);
    for (let u = 0; u < this.n; u++) {
      for (const [v, w] of this.adj.get(u)!) {
        A[u]![v] = w;
      }
    }
    return A;
  }

  degreeMatrix(): Matrix {
    const D = zeros(this.n, this.n);
    for (let i = 0; i < this.n; i++) {
      D[i]![i] = this.weightedDegree(i);
    }
    return D;
  }

  laplacian(): Matrix {
    return subtract(this.degreeMatrix(), this.adjacencyMatrix());
  }

  toString(): string {
    const edges: string[] = [];
    const seen = new Set<string>();
    for (let u = 0; u < this.n; u++) {
      for (const [v, w] of this.adj.get(u)!) {
        const key = this.directed ? `${u},${v}` : `${Math.min(u, v)},${Math.max(u, v)}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (w === 1.0) {
            edges.push(`${u}-${v}`);
          } else {
            edges.push(`${u}-${v}(${pyFloat(w)})`);
          }
        }
      }
    }
    return `Graph(n=${this.n}, edges=[${edges.join(", ")}])`;
  }
}

function bfs(graph: Graph, start: number): [number[], Map<number, number>] {
  const visited = new Set<number>();
  const order: number[] = [];
  const distances = new Map<number, number>();
  const queue: [number, number][] = [[start, 0]];
  let head = 0;
  visited.add(start);
  while (head < queue.length) {
    const [node, dist] = queue[head]!;
    head += 1;
    order.push(node);
    distances.set(node, dist);
    for (const neighbor of graph.neighbors(node)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, dist + 1]);
      }
    }
  }
  return [order, distances];
}

function dfs(graph: Graph, start: number): number[] {
  const visited = new Set<number>();
  const order: number[] = [];
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    order.push(node);
    for (const neighbor of graph.neighbors(node).reverse()) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }
  return order;
}

function connectedComponents(graph: Graph): number[][] {
  if (graph.directed) {
    throw new Error("connected_components requires an undirected graph");
  }
  const visited = new Set<number>();
  const components: number[][] = [];
  for (let node = 0; node < graph.n; node++) {
    if (!visited.has(node)) {
      const [order] = bfs(graph, node);
      for (const member of order) {
        visited.add(member);
      }
      components.push(order);
    }
  }
  return components;
}

function chooseWithoutReplacement(random: Random, n: number, k: number): number[] {
  const pool = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, k);
}

function allClose(a: Matrix, b: Matrix): boolean {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i]!.length; j++) {
      if (Math.abs(a[i]![j]! - b[i]![j]!) > 1e-8 + 1e-5 * Math.abs(b[i]![j]!)) {
        return false;
      }
    }
  }
  return true;
}

function spectralClustering(graph: Graph, k = 2): number[] {
  if (graph.n < 2) {
    throw new Error("spectral_clustering requires at least 2 nodes");
  }
  if (!(k >= 2 && k <= graph.n)) {
    throw new Error(`k must satisfy 2 <= k <= ${graph.n}, got k=${k}`);
  }
  if (graph.directed) {
    throw new Error("spectral_clustering requires an undirected graph");
  }

  const components = connectedComponents(graph);
  if (k === 2 && components.length > 1) {
    const labels: number[] = new Array<number>(graph.n).fill(1);
    for (const node of components[0]!) {
      labels[node] = 0;
    }
    return labels;
  }

  const L = graph.laplacian();
  const { vectors } = symmetricEigen(L);

  if (k === 2) {
    return vectors.map((row) => (row[1]! < 0 ? 1 : 0));
  }

  const features = vectors.map((row) => {
    const slice = row.slice(1, k + 1);
    const norm = vectorNorm(slice) || 1;
    return slice.map((value) => value / norm);
  });

  const random = mulberry32(42);
  let centroids = chooseWithoutReplacement(random, graph.n, k).map((i) => [...features[i]!]);
  let labels: number[] = new Array<number>(graph.n).fill(0);

  for (let iteration = 0; iteration < 100; iteration++) {
    labels = features.map((point) => {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, c) => {
        const distance = vectorNorm(point.map((value, d) => value - centroid[d]!));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = c;
        }
      });
      return best;
    });

    const newCentroids = zeros(k, k);
    for (let c = 0; c < k; c++) {
      const members = features.filter((_, i) => labels[i] === c);
      if (members.length > 0) {
        for (let d = 0; d < k; d++) {
          newCentroids[c]![d] = mean(members.map((point) => point[d]!));
        }
      }
    }

    if (allClose(centroids, newCentroids)) {
      break;
    }
    centroids = newCentroids;
  }

  return labels;
}

function messagePassing(graph: Graph, features: Matrix, weightMatrix: Matrix): Matrix {
  const A = graph.adjacencyMatrix();
  const ANorm = A.map((row) => {
    const rowSum = row.reduce((total, value) => total + value, 0) || 1;
    return row.map((value) => value / rowSum);
  });

  const aggregated = matmul(ANorm, features);
  const output = matmul(aggregated, weightMatrix);
  return output;
}

function pagerank(graph: Graph, damping = 0.85, maxIter = 100, tol = 1e-6): number[] {
  const n = graph.n;
  let scores: number[] = new Array<number>(n).fill(1 / n);

  for (let iteration = 0; iteration < maxIter; iteration++) {
    const newScores: number[] = new Array<number>(n).fill((1 - damping) / n);
    let danglingSum = 0;
    for (let u = 0; u < n; u++) {
      const outDeg = graph.degree(u);
      if (outDeg > 0) {
        for (const v of graph.neighbors(u)) {
          newScores[v] = newScores[v]! + (damping * scores[u]!) / outDeg;
        }
      } else {
        danglingSum += scores[u]!;
      }
    }
    for (let v = 0; v < n; v++) {
      newScores[v] = newScores[v]! + (damping * danglingSum) / n;
    }
    let change = 0;
    for (let v = 0; v < n; v++) {
      change += Math.abs(newScores[v]! - scores[v]!);
    }
    if (change < tol) {
      scores = newScores;
      break;
    }
    scores = newScores;
  }

  return scores;
}

function demoSocialNetwork(): void {
  console.log("=".repeat(60));
  console.log("DEMO 1: Small Social Network -- BFS and DFS");
  console.log("=".repeat(60));

  const g = new Graph(6);
  g.addEdge(0, 1);
  g.addEdge(0, 2);
  g.addEdge(1, 3);
  g.addEdge(2, 3);
  g.addEdge(3, 4);
  g.addEdge(4, 5);

  console.log(`\nGraph: ${g}`);
  console.log(`\nAdjacency matrix:\n${npIntMatrix(g.adjacencyMatrix())}`);

  for (let node = 0; node < g.n; node++) {
    console.log(`  Node ${node}: degree=${g.degree(node)}, neighbors=${pyList(g.neighbors(node))}`);
  }

  const [bfsOrder, bfsDist] = bfs(g, 0);
  console.log("\nBFS from node 0:");
  console.log(`  Visit order: ${pyList(bfsOrder)}`);
  console.log(`  Distances:   ${pyDict(bfsDist)}`);

  const dfsOrder = dfs(g, 0);
  console.log("\nDFS from node 0:");
  console.log(`  Visit order: ${pyList(dfsOrder)}`);
}

function demoLaplacian(): void {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 2: Laplacian Eigenvalues and Connected Components");
  console.log("=".repeat(60));

  const g = new Graph(7);
  g.addEdge(0, 1);
  g.addEdge(1, 2);
  g.addEdge(0, 2);
  g.addEdge(3, 4);
  g.addEdge(5, 6);

  console.log(`\nGraph: ${g}`);
  console.log(`Connected components: ${pyNestedList(connectedComponents(g))}`);

  const L = g.laplacian();
  const eigenvalues = symmetricEigen(L).values;
  console.log(`\nLaplacian:\n${npIntMatrix(L)}`);
  console.log(`\nEigenvalues: ${npFloatArray(eigenvalues.map((value) => roundHalfEven(value, 4)))}`);

  const nZeros = eigenvalues.filter((value) => Math.abs(value) < 1e-8).length;
  console.log(`Number of zero eigenvalues: ${nZeros}`);
  console.log(`Number of connected components: ${connectedComponents(g).length}`);
  console.log(`Match: ${nZeros === connectedComponents(g).length ? "True" : "False"}`);
}

function demoMessagePassing(): void {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 3: Message Passing with Random Node Features");
  console.log("=".repeat(60));

  const g = new Graph(5);
  g.addEdge(0, 1);
  g.addEdge(0, 2);
  g.addEdge(1, 2);
  g.addEdge(2, 3);
  g.addEdge(3, 4);

  const random = mulberry32(42);
  const features = randnMatrix(random, 5, 3, 1);
  const W = randnMatrix(random, 3, 2, 0.5);

  const rounded = (row: number[]) => npFloatArray(row.map((value) => roundHalfEven(value, 4)));

  console.log(`\nGraph: ${g}`);
  console.log("\nNode features (5 nodes, 3 features each):");
  for (let i = 0; i < 5; i++) {
    console.log(`  Node ${i}: ${rounded(features[i]!)}`);
  }

  const output = messagePassing(g, features, W);
  console.log("\nAfter 1 round of message passing (output dim = 2):");
  for (let i = 0; i < 5; i++) {
    console.log(`  Node ${i}: ${rounded(output[i]!)}`);
  }

  const output2 = messagePassing(g, output, randnMatrix(random, 2, 2, 0.5));
  console.log("\nAfter 2 rounds (2-hop neighborhood info):");
  for (let i = 0; i < 5; i++) {
    console.log(`  Node ${i}: ${rounded(output2[i]!)}`);
  }
}

function demoSpectralClustering(): void {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO 4: Spectral Clustering on Two Communities");
  console.log("=".repeat(60));

  const g = new Graph(10);
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      g.addEdge(i, j);
    }
  }
  for (let i = 5; i < 10; i++) {
    for (let j = i + 1; j < 10; j++) {
      g.addEdge(i, j);
    }
  }
  g.addEdge(2, 7);

  console.log("\nGraph: two cliques (0-4 and 5-9) connected by edge 2-7");

  const labels = spectralClustering(g, 2);
  const nodesWithLabel = (label: number) =>
    labels.flatMap((value, node) => (value === label ? [node] : []));
  console.log(`\nSpectral clustering labels: ${npIntArray(labels)}`);
  console.log(`Cluster 0: ${npIntArray(nodesWithLabel(0))}`);
  console.log(`Cluster 1: ${npIntArray(nodesWithLabel(1))}`);

  const L = g.laplacian();
  const eigenvalues = symmetricEigen(L).values;
  console.log(`\nLaplacian eigenvalues: ${npFloatArray(eigenvalues.map((value) => roundHalfEven(value, 4)))}`);
  console.log(`Fiedler value (algebraic connectivity): ${eigenvalues[1]!.toFixed(4)}`);

  const scores = pagerank(g);
  console.log("\nPageRank scores:");
  for (let i = 0; i < g.n; i++) {
    console.log(`  Node ${i}: ${scores[i]!.toFixed(4)}`);
  }

  const bridgeNodes = [2, 7];
  const nonBridge = [...Array(g.n).keys()].filter((node) => !bridgeNodes.includes(node));
  console.log(
    `\nBridge nodes ${pyList(bridgeNodes)} PageRank: ` +
      `${mean(bridgeNodes.map((node) => scores[node]!)).toFixed(4)}`,
  );
  console.log(`Non-bridge nodes avg PageRank: ${mean(nonBridge.map((node) => scores[node]!)).toFixed(4)}`);
  console.log("Bridge nodes have higher PageRank -- they connect communities.");
}

demoSocialNetwork();
demoLaplacian();
demoMessagePassing();
demoSpectralClustering();
