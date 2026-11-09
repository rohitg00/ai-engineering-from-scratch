// Lesson: Generative Models: Taxonomy & History (phase 08 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/01-generative-models-taxonomy-history/docs/en.md
// Run: npx tsx phases/08-generative-ai/01-generative-models-taxonomy-history/code/main.ts

class Rng {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 === 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  choice<T>(items: T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

type Density = (samples: number[], x: number) => number;

function signed(v: number, digits: number): string {
  const sign = v < 0 || Object.is(v, -0) ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

function sampleMixture(n: number, rng: Rng): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    if (rng.random() < 0.4) samples.push(rng.gauss(-2.0, 0.6));
    else samples.push(rng.gauss(2.0, 0.9));
  }
  return samples;
}

function histogramDensity(samples: number[], x: number, binWidth = 0.25): number {
  const n = samples.length;
  const lo = x - binWidth / 2;
  const hi = x + binWidth / 2;
  let count = 0;
  for (const s of samples) if (lo <= s && s < hi) count++;
  return count / (n * binWidth);
}

function kdeDensity(samples: number[], x: number, bandwidth = 0.3): number {
  const n = samples.length;
  let total = 0.0;
  for (const s of samples) {
    const u = (x - s) / bandwidth;
    total += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
  }
  return total / (n * bandwidth);
}

function implicitGenerator(samples: number[], k: number, rng: Rng): number[] {
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const base = rng.choice(samples);
    out.push(base + rng.gauss(0.0, 0.1));
  }
  return out;
}

function integrateDensity(densityFn: Density, samples: number[], lo: number, hi: number, steps = 200): number {
  const xs: number[] = [];
  for (let i = 0; i <= steps; i++) xs.push(lo + ((hi - lo) * i) / steps);
  let total = 0.0;
  for (let i = 0; i < steps; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    total += 0.5 * (densityFn(samples, a) + densityFn(samples, b)) * (b - a);
  }
  return total;
}

function asciiHistogram(samples: number[], lo = -5.0, hi = 5.0, bins = 40, height = 12): string {
  const width = (hi - lo) / bins;
  const counts: number[] = new Array(bins).fill(0);
  for (const s of samples) {
    if (lo <= s && s < hi) counts[Math.trunc((s - lo) / width)] += 1;
  }
  const peak = Math.max(...counts) || 1;
  const rows: string[] = [];
  for (let row = height; row > 0; row--) {
    const threshold = (peak * row) / height;
    rows.push(counts.map((c) => (c >= threshold ? "#" : " ")).join(""));
  }
  rows.push("-".repeat(bins));
  rows.push(lo.toFixed(1) + " ".repeat(bins - 8) + hi.toFixed(1));
  return rows.join("\n");
}

function main(): void {
  const rng = new Rng(42);
  const samples = sampleMixture(2000, rng);

  console.log("=== 2000 samples from a two-mode Gaussian mixture ===");
  console.log(asciiHistogram(samples));
  console.log();

  const query = 0.0;
  console.log(`evaluate p(x=${query.toFixed(1)}) three ways:`);
  console.log(`  histogram density: ${histogramDensity(samples, query).toFixed(4)}`);
  console.log(`  kernel density:    ${kdeDensity(samples, query).toFixed(4)}`);
  console.log(`  implicit generator: N/A (only samples, no density)`);
  console.log();

  const pHist = integrateDensity(histogramDensity, samples, -0.5, 0.5);
  const pKde = integrateDensity(kdeDensity, samples, -0.5, 0.5);
  console.log(`integrate p(x in [-0.5, 0.5]):`);
  console.log(`  histogram: ${pHist.toFixed(3)}`);
  console.log(`  kde:       ${pKde.toFixed(3)}`);
  console.log();

  const newSamples = implicitGenerator(samples, 10, rng);
  console.log("10 new samples from the implicit (GAN-ish) generator:");
  console.log("  " + newSamples.map((s) => signed(s, 2)).join(", "));
  console.log();

  console.log("takeaway: explicit density (buckets 1-2 in the doc) lets you answer");
  console.log("'how likely is this point?'. implicit (bucket 3) does not.");
}

main();

export {};
