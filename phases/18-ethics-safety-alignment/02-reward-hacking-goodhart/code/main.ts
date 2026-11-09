// Lesson: Reward Hacking and Goodhart's Law (phase 18 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/code/main.ts

class Random {
  private state: number;
  private spare: number | null = null;

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

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    const u1 = 1 - this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }
}

const rng = new Random(42);

const D = 8;
const GOLD_W = [1.0, -0.6, 0.4, 0.2, -0.1, 0.3, -0.5, 0.8];

type Row = [number, number, number];

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    s += a[i] * b[i];
  }
  return s;
}

function gauss(): number {
  return rng.gauss(0.0, 1.0);
}

function studentT(df: number): number {
  const u = rng.gauss(0.0, 1.0);
  let chi2 = 0;
  for (let i = 0; i < Math.trunc(df); i++) {
    chi2 += rng.gauss(0.0, 1.0) ** 2;
  }
  if (chi2 <= 0) {
    chi2 = 1e-6;
  }
  return u * Math.sqrt(df / chi2);
}

function sampleFeature(): number[] {
  return Array.from({ length: D }, () => gauss());
}

function goldReward(x: number[]): number {
  return dot(GOLD_W, x);
}

class ProxyRM {
  w: number[];
  nSamples: number;

  constructor(w: number[], nSamples: number) {
    this.w = w;
    this.nSamples = nSamples;
  }

  score(x: number[]): number {
    return dot(this.w, x);
  }
}

function trainProxy(nSamples: number, noise: string = "gauss"): ProxyRM {
  const xs = Array.from({ length: nSamples }, () => sampleFeature());
  const ys: number[] = [];
  for (const x of xs) {
    const eps = noise === "gauss" ? gauss() : studentT(3.0);
    ys.push(goldReward(x) + eps);
  }
  const g = Array.from({ length: D }, () => new Array<number>(D).fill(0.0));
  const b = new Array<number>(D).fill(0.0);
  for (let n = 0; n < xs.length; n++) {
    const x = xs[n];
    const y = ys[n];
    for (let i = 0; i < D; i++) {
      b[i] += x[i] * y;
      for (let j = 0; j < D; j++) {
        g[i][j] += x[i] * x[j];
      }
    }
  }
  for (let i = 0; i < D; i++) {
    g[i][i] += 1e-3;
  }
  const w = solve(g, b);
  return new ProxyRM(w, nSamples);
}

function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(m[k][i]) > Math.abs(m[piv][i])) {
        piv = k;
      }
    }
    [m[i], m[piv]] = [m[piv], m[i]];
    for (let k = i + 1; k < n; k++) {
      const f = m[k][i] / m[i][i];
      for (let j = i; j < n + 1; j++) {
        m[k][j] -= f * m[i][j];
      }
    }
  }
  const x = new Array<number>(n).fill(0.0);
  for (let i = n - 1; i >= 0; i--) {
    let s = 0;
    for (let j = i + 1; j < n; j++) {
      s += m[i][j] * x[j];
    }
    x[i] = (m[i][n] - s) / m[i][i];
  }
  return x;
}

function sqrtKlFromOrigin(mu: number[]): number {
  return Math.sqrt(0.5 * mu.reduce((s, m) => s + m * m, 0));
}

function expectedReward(w: number[], mu: number[]): number {
  return dot(w, mu);
}

function bestOfNSweep(proxy: ProxyRM, ns: number[]): Row[] {
  const curve: Row[] = [];
  const trials = 1000;
  for (const n of ns) {
    const kls: number[] = [];
    const proxies: number[] = [];
    const golds: number[] = [];
    for (let t = 0; t < trials; t++) {
      const xs = Array.from({ length: n }, () => sampleFeature());
      let best = xs[0];
      let bestScore = proxy.score(best);
      for (const x of xs.slice(1)) {
        const s = proxy.score(x);
        if (s > bestScore) {
          best = x;
          bestScore = s;
        }
      }
      proxies.push(proxy.score(best));
      golds.push(goldReward(best));
      kls.push(Math.sqrt(0.5 * best.reduce((s, v) => s + v * v, 0)));
    }
    const mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / trials;
    curve.push([mean(kls), mean(proxies), mean(golds)]);
  }
  return curve;
}

function klConstrainedPolicySweep(proxy: ProxyRM, klBudgets: number[]): Row[] {
  const curve: Row[] = [];
  for (const kl of klBudgets) {
    const norm = Math.sqrt(proxy.w.reduce((s, w) => s + w * w, 0));
    let mu: number[];
    if (norm < 1e-9) {
      mu = new Array<number>(D).fill(0.0);
    } else {
      const s = Math.sqrt(2 * kl) / norm;
      mu = proxy.w.map((w) => w * s);
    }
    curve.push([sqrtKlFromOrigin(mu), expectedReward(proxy.w, mu), expectedReward(GOLD_W, mu)]);
  }
  return curve;
}

function num(x: number, width: number, digits: number, sign: boolean = false): string {
  const body = sign && x >= 0 ? "+" + x.toFixed(digits) : x.toFixed(digits);
  return body.padStart(width);
}

function printCurve(name: string, curve: Row[]): void {
  console.log(`\n${name}`);
  console.log("-".repeat(60));
  console.log(`  ${"sqrt(KL)".padStart(9)}  ${"proxy".padStart(8)}  ${"gold".padStart(8)}  ${"gap".padStart(8)}`);
  for (const [sk, p, g] of curve) {
    console.log(`  ${num(sk, 9, 3)}  ${num(p, 8, 3)}  ${num(g, 8, 3)}  ${num(p - g, 8, 3, true)}`);
  }
  let peakGold = curve[0];
  for (const row of curve) {
    if (row[2] > peakGold[2]) {
      peakGold = row;
    }
  }
  console.log(`  gold peak at sqrt(KL) = ${peakGold[0].toFixed(3)}, ` +
    `gold = ${peakGold[2].toFixed(3)}, proxy = ${peakGold[1].toFixed(3)}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("REWARD HACKING OVER-OPTIMIZATION (Phase 18, Lesson 2)");
  console.log("=".repeat(60));

  const budgets = [0.0, 0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 8.0];

  for (const n of [100, 300, 1000, 10000]) {
    const rm = trainProxy(n);
    const curve = klConstrainedPolicySweep(rm, budgets);
    printCurve(`Proxy RM trained on ${n} samples (Gaussian noise)`, curve);
  }

  const rmHeavy = trainProxy(300, "student_t");
  const curveHeavy = klConstrainedPolicySweep(rmHeavy, budgets);
  printCurve("Proxy RM, 300 samples, Student-t(3) noise (heavy tails)", curveHeavy);

  const ns = [1, 2, 4, 8, 16, 64, 256, 1024];
  const bon = bestOfNSweep(trainProxy(300), ns);
  printCurve("Best-of-N sampling (300-sample proxy)", bon);

  console.log("\n" + "=".repeat(60));
  console.log("TAKEAWAY: proxy reward climbs monotonically; gold peaks and falls.");
  console.log("More proxy samples push the peak further, but do not eliminate it.");
  console.log("Heavy-tailed noise moves the peak closer to the origin. KL alone");
  console.log("does not save you. This is Goodhart's Law, measured.");
  console.log("=".repeat(60));
}

main();
