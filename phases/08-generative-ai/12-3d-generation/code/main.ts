// Lesson: 3D Generation (phase 08 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/12-3d-generation/docs/en.md
// Run: npx tsx phases/08-generative-ai/12-3d-generation/code/main.ts

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

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }
}

const SIZE = 12;

type Image = number[][];

interface Gaussian {
  pos: number[];
  sigma: number;
  color: number;
}

function makeTarget(size: number): Image {
  const target: Image = Array.from({ length: size }, () => new Array<number>(size).fill(0.0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d1 = ((x - 3) ** 2 + (y - 3) ** 2) / 6.0;
      const d2 = ((x - 8) ** 2 + (y - 8) ** 2) / 8.0;
      target[y][x] = Math.exp(-d1) + 0.5 * Math.exp(-d2);
    }
  }
  return target;
}

function initGaussians(n: number, rng: Random): Gaussian[] {
  const out: Gaussian[] = [];
  for (let i = 0; i < n; i++) {
    const pos = [rng.uniform(2, SIZE - 2), rng.uniform(2, SIZE - 2)];
    const sigma = rng.uniform(0.8, 2.5);
    const color = rng.uniform(0.2, 0.8);
    out.push({ pos, sigma, color });
  }
  return out;
}

function gaussianValue(x: number, y: number, g: Gaussian): number {
  const dx = x - g.pos[0];
  const dy = y - g.pos[1];
  const d2 = dx * dx + dy * dy;
  return g.color * Math.exp(-d2 / (2 * g.sigma ** 2));
}

function render(gaussians: Gaussian[]): Image {
  const img: Image = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0.0));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      for (const g of gaussians) img[y][x] += gaussianValue(x, y, g);
    }
  }
  return img;
}

function mse(a: Image, b: Image): number {
  let total = 0.0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) total += (a[y][x] - b[y][x]) ** 2;
  }
  return total / (SIZE * SIZE);
}

function finiteDiffStep(gaussians: Gaussian[], target: Image, lr: number, eps = 0.1): number {
  const base = render(gaussians);
  const baseLoss = mse(base, target);
  const updates: Array<() => void> = [];
  for (const g of gaussians) {
    for (let i = 0; i < g.pos.length; i++) {
      g.pos[i] += eps;
      const up = mse(render(gaussians), target);
      g.pos[i] -= eps;
      const grad = (up - baseLoss) / eps;
      updates.push(() => {
        g.pos[i] -= lr * grad;
      });
    }
    for (const key of ["sigma", "color"] as const) {
      g[key] += eps;
      const up = mse(render(gaussians), target);
      g[key] -= eps;
      const grad = (up - baseLoss) / eps;
      updates.push(() => {
        g[key] -= lr * grad;
      });
    }
  }
  for (const apply of updates) apply();
  return baseLoss;
}

function asciiImg(img: Image, chars = " .:;+*#@"): string {
  let peak = -Infinity;
  for (const row of img) for (const v of row) peak = Math.max(peak, v);
  if (peak === 0) peak = 1.0;
  const lines: string[] = [];
  for (const row of img) {
    let line = "";
    for (const v of row) {
      let idx = Math.min(chars.length - 1, Math.trunc((v / peak) * (chars.length - 1)));
      if (idx < 0) idx += chars.length;
      line += chars[idx];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function main(): void {
  const target = makeTarget(SIZE);

  console.log("=== target image ===");
  console.log(asciiImg(target));
  console.log();

  for (const n of [2, 4, 8]) {
    const rngLocal = new Random(7 + n);
    const gaussians = initGaussians(n, rngLocal);
    console.log(`=== fit ${n} Gaussians ===`);
    let loss = 0;
    for (let step = 0; step < 30; step++) loss = finiteDiffStep(gaussians, target, 0.5, 0.2);
    console.log(`final loss (MSE): ${loss.toFixed(4)}`);
    console.log(asciiImg(render(gaussians)));
    console.log();
  }

  console.log("takeaway: a few differentiable Gaussians can approximate smooth targets.");
  console.log("          scale to 1M splats in 3D, render via alpha compositing = 3D-GS.");
}

main();
