// Lesson: StyleGAN (phase 08 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/05-stylegan/docs/en.md
// Run: npx tsx phases/08-generative-ai/05-stylegan/code/main.ts

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
}

type Matrix = number[][];
type Vector = number[];
type Layer = [Matrix, Vector];

interface Synth {
  W: Matrix[];
  b: Vector[];
  scale: Vector[];
  bias: Vector[];
}

function signed(v: number, digits: number): string {
  const sign = v < 0 || Object.is(v, -0) ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

function pyList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function leaky(x: number, a = 0.2): number {
  return x > 0 ? x : a * x;
}

function randnMatrix(rows: number, cols: number, rng: Rng, scale = 0.3): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: Vector = [];
    for (let j = 0; j < cols; j++) row.push(rng.gauss(0, scale));
    out.push(row);
  }
  return out;
}

function matmul(W: Matrix, x: Vector): Vector {
  return W.map((row) => {
    let s = 0;
    for (let i = 0; i < Math.min(row.length, x.length); i++) s += row[i] * x[i];
    return s;
  });
}

function add(a: Vector, b: Vector): Vector {
  return a.map((x, i) => x + b[i]);
}

function meanStd(xs: Vector): [number, number] {
  let m = 0;
  for (const x of xs) m += x;
  m /= xs.length;
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  v /= xs.length;
  return [m, Math.sqrt(v + 1e-8)];
}

function adain(features: Vector, scale: number, bias: number): Vector {
  const [m, s] = meanStd(features);
  return features.map((f) => (scale * (f - m)) / s + bias);
}

function mapping(z: Vector, layers: Layer[]): Vector {
  let h = z;
  for (const [W, b] of layers) {
    const pre = add(matmul(W, h), b);
    h = pre.map((x) => leaky(x));
  }
  return h;
}

function initMapping(zDim: number, wDim: number, depth: number, rng: Rng): Layer[] {
  const layers: Layer[] = [];
  const dims = [zDim, ...new Array(depth).fill(wDim)];
  for (let i = 0; i < depth; i++) {
    layers.push([randnMatrix(dims[i + 1], dims[i], rng), new Array(dims[i + 1]).fill(0.0)]);
  }
  return layers;
}

function dot(a: Vector, b: Vector): number {
  let s = 0;
  for (let j = 0; j < b.length; j++) s += a[j] * b[j];
  return s;
}

function styleganForward(w: Vector, constant: Vector, synth: Synth, noiseSigma: number, rng: Rng, adainOn = true): Vector {
  let h = [...constant];
  for (let i = 0; i < 3; i++) {
    const pre = add(matmul(synth.W[i], h), synth.b[i]);
    h = pre.map((x) => leaky(x));
    if (adainOn) {
      const scale = dot(synth.scale[i], w);
      const bias = dot(synth.bias[i], w);
      h = adain(h, scale, bias);
    }
    if (noiseSigma > 0) h = h.map((x) => x + noiseSigma * rng.gauss(0, 1));
  }
  return h;
}

function initSynth(hidden: number, wDim: number, rng: Rng): Synth {
  const synth: Synth = { W: [], b: [], scale: [], bias: [] };
  for (let i = 0; i < 3; i++) {
    synth.W.push(randnMatrix(hidden, hidden, rng));
    synth.b.push(new Array(hidden).fill(0.0));
    const scale: Vector = [];
    for (let j = 0; j < wDim; j++) scale.push(rng.gauss(0, 0.3));
    synth.scale.push(scale);
    const bias: Vector = [];
    for (let j = 0; j < wDim; j++) bias.push(rng.gauss(0, 0.3));
    synth.bias.push(bias);
  }
  return synth;
}

function randnVector(n: number, rng: Rng): Vector {
  const out: Vector = [];
  for (let i = 0; i < n; i++) out.push(rng.gauss(0, 1));
  return out;
}

function main(): void {
  const rng = new Rng(299);
  const zDim = 8;
  const wDim = 8;
  const hidden = 6;

  const mappingNet = initMapping(zDim, wDim, 4, rng);
  const synth = initSynth(hidden, wDim, rng);
  const constant: Vector = [];
  for (let i = 0; i < hidden; i++) constant.push(rng.gauss(0, 0.3));

  console.log("=== compare: style inputs via AdaIN vs no AdaIN ===");
  console.log("sample 5 random z, look at std of output under each mode");

  for (const mode of [true, false]) {
    const outs: Vector[] = [];
    for (let k = 0; k < 5; k++) {
      const z = randnVector(zDim, rng);
      const w = mapping(z, mappingNet);
      outs.push(styleganForward(w, constant, synth, 0.0, rng, mode));
    }
    const flat = outs.flat();
    const [m, s] = meanStd(flat);
    const label = mode ? "with AdaIN" : "no AdaIN  ";
    console.log(`  ${label}: mean ${signed(m, 3)}  std ${s.toFixed(3)}`);
  }

  console.log();
  console.log("=== truncation trick: sample many w, take mean, interpolate ===");
  const ws: Vector[] = [];
  for (let k = 0; k < 200; k++) {
    const z = randnVector(zDim, rng);
    ws.push(mapping(z, mappingNet));
  }
  const wBar: Vector = [];
  for (let i = 0; i < wDim; i++) {
    let s = 0;
    for (const w of ws) s += w[i];
    wBar.push(s / ws.length);
  }

  const zTest = randnVector(zDim, rng);
  const wTest = mapping(zTest, mappingNet);

  for (const psi of [0.0, 0.5, 0.7, 1.0]) {
    const wPsi = wBar.map((wb, i) => wb + psi * (wTest[i] - wb));
    const h = styleganForward(wPsi, constant, synth, 0.0, rng, true);
    console.log(`  psi=${psi.toFixed(1)}: output = ${pyList(h.map((v) => signed(v, 2)))}`);
  }

  console.log();
  console.log("=== per-layer noise injection (pose fixed, stochastic detail changes) ===");
  const zFixed = randnVector(zDim, rng);
  const wFixed = mapping(zFixed, mappingNet);
  for (let seed = 0; seed < 3; seed++) {
    const rngLocal = new Rng(seed);
    const h = styleganForward(wFixed, constant, synth, 0.1, rngLocal, true);
    console.log(`  seed ${seed}: ${pyList(h.map((v) => signed(v, 2)))}`);
  }

  console.log();
  console.log("notice: with the same w, outputs vary slightly with noise seed.");
  console.log("         that is the stochastic-detail vs global-style split.");
}

main();

export {};
