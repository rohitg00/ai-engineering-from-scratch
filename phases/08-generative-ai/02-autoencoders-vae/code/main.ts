// Lesson: Autoencoders & Variational Autoencoders (VAE) (phase 08 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/02-autoencoders-vae/docs/en.md
// Run: npx tsx phases/08-generative-ai/02-autoencoders-vae/code/main.ts

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

interface Encoder {
  W1: Matrix;
  b1: Vector;
  W_mu: Matrix;
  b_mu: Vector;
  W_sig: Matrix;
  b_sig: Vector;
}

interface Decoder {
  W1: Matrix;
  b1: Vector;
  W_out: Matrix;
  b_out: Vector;
}

interface Vae {
  enc: Encoder;
  dec: Decoder;
}

interface Forward {
  h_enc: Vector;
  mu: Vector;
  log_sigma2: Vector;
  sigma: Vector;
  z: Vector;
  h_dec: Vector;
  x_hat: Vector;
}

function signed(v: number, digits: number): string {
  const sign = v < 0 || Object.is(v, -0) ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

function pyList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
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

function tanh(v: Vector): Vector {
  return v.map((x) => Math.tanh(x));
}

function tanhGrad(h: Vector): Vector {
  return h.map((x) => 1 - x * x);
}

function randnMatrix(rows: number, cols: number, rng: Rng, scale = 0.2): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: Vector = [];
    for (let j = 0; j < cols; j++) row.push(rng.gauss(0, scale));
    out.push(row);
  }
  return out;
}

function zerosVec(n: number): Vector {
  return new Array(n).fill(0.0);
}

function initVae(inDim: number, hidden: number, zDim: number, rng: Rng): Vae {
  const enc: Encoder = {
    W1: randnMatrix(hidden, inDim, rng),
    b1: zerosVec(hidden),
    W_mu: randnMatrix(zDim, hidden, rng),
    b_mu: zerosVec(zDim),
    W_sig: randnMatrix(zDim, hidden, rng),
    b_sig: zerosVec(zDim),
  };
  const dec: Decoder = {
    W1: randnMatrix(hidden, zDim, rng),
    b1: zerosVec(hidden),
    W_out: randnMatrix(inDim, hidden, rng),
    b_out: zerosVec(inDim),
  };
  return { enc, dec };
}

function clamp(v: Vector, lo: number, hi: number): Vector {
  return v.map((x) => Math.max(lo, Math.min(hi, x)));
}

function forward(x: Vector, params: Vae, eps: Vector): Forward {
  const { enc, dec } = params;
  const h_enc = tanh(add(matmul(enc.W1, x), enc.b1));
  const mu = add(matmul(enc.W_mu, h_enc), enc.b_mu);
  const log_sigma2 = clamp(add(matmul(enc.W_sig, h_enc), enc.b_sig), -6, 6);
  const sigma = log_sigma2.map((lv) => Math.exp(0.5 * lv));
  const z = mu.map((m, i) => m + sigma[i] * eps[i]);
  const h_dec = tanh(add(matmul(dec.W1, z), dec.b1));
  const x_hat = add(matmul(dec.W_out, h_dec), dec.b_out);
  return { h_enc, mu, log_sigma2, sigma, z, h_dec, x_hat };
}

function lossValue(x: Vector, fwd: Forward, beta: number): [number, number, number] {
  let recon = 0;
  for (let i = 0; i < x.length; i++) recon += (x[i] - fwd.x_hat[i]) ** 2;
  let kl = 0;
  for (let i = 0; i < fwd.mu.length; i++) {
    const m = fwd.mu[i];
    const lv = fwd.log_sigma2[i];
    kl += Math.exp(lv) + m * m - lv - 1;
  }
  kl *= 0.5;
  return [recon + beta * kl, recon, kl];
}

function outerRows(d: Vector, v: Vector): Matrix {
  return d.map((di) => v.map((vj) => di * vj));
}

function backward(x: Vector, fwd: Forward, params: Vae, beta: number): Vae {
  const { enc, dec } = params;
  const { mu, log_sigma2, sigma, z, h_dec, h_enc, x_hat } = fwd;

  const dXHat = x_hat.map((a, i) => 2 * (a - x[i]));

  const decB_out = [...dXHat];
  const decW_out = outerRows(dXHat, h_dec);

  const dHDec = h_dec.map((_, j) => {
    let s = 0;
    for (let i = 0; i < dXHat.length; i++) s += dec.W_out[i][j] * dXHat[i];
    return s;
  });
  const gDec = tanhGrad(h_dec);
  const dPreDec = dHDec.map((dg, j) => dg * gDec[j]);
  const decB1 = [...dPreDec];
  const decW1 = outerRows(dPreDec, z);

  const dZ = z.map((_, j) => {
    let s = 0;
    for (let i = 0; i < dPreDec.length; i++) s += dec.W1[i][j] * dPreDec[i];
    return s;
  });

  const dMuRecon = [...dZ];
  const epsUsed = z.map((zi, i) => (zi - mu[i]) / Math.max(sigma[i], 1e-8));
  const dLvRecon = z.map((_, i) => 0.5 * dZ[i] * sigma[i] * epsUsed[i]);

  const dMu = mu.map((m, i) => dMuRecon[i] + beta * m);
  const dLv = mu.map((_, i) => dLvRecon[i] + beta * 0.5 * (Math.exp(log_sigma2[i]) - 1));

  const encB_mu = [...dMu];
  const encW_mu = outerRows(dMu, h_enc);
  const encB_sig = [...dLv];
  const encW_sig = outerRows(dLv, h_enc);

  const dHEnc: Vector = zerosVec(h_enc.length);
  for (let j = 0; j < h_enc.length; j++) {
    for (let i = 0; i < dMu.length; i++) {
      dHEnc[j] += enc.W_mu[i][j] * dMu[i];
      dHEnc[j] += enc.W_sig[i][j] * dLv[i];
    }
  }
  const gEnc = tanhGrad(h_enc);
  const dPreEnc = dHEnc.map((dg, j) => dg * gEnc[j]);
  const encB1 = [...dPreEnc];
  const encW1 = outerRows(dPreEnc, x);

  return {
    enc: { W1: encW1, b1: encB1, W_mu: encW_mu, b_mu: encB_mu, W_sig: encW_sig, b_sig: encB_sig },
    dec: { W1: decW1, b1: decB1, W_out: decW_out, b_out: decB_out },
  };
}

function updateMatrix(tensor: Matrix, g: Matrix, lr: number): void {
  for (let i = 0; i < tensor.length; i++) {
    for (let j = 0; j < tensor[i].length; j++) tensor[i][j] -= lr * g[i][j];
  }
}

function updateVector(tensor: Vector, g: Vector, lr: number): void {
  for (let i = 0; i < tensor.length; i++) tensor[i] -= lr * g[i];
}

function applyUpdate(params: Vae, grads: Vae, lr: number): void {
  for (const name of ["W1", "W_mu", "W_sig"] as const) updateMatrix(params.enc[name], grads.enc[name], lr);
  for (const name of ["b1", "b_mu", "b_sig"] as const) updateVector(params.enc[name], grads.enc[name], lr);
  for (const name of ["W1", "W_out"] as const) updateMatrix(params.dec[name], grads.dec[name], lr);
  for (const name of ["b1", "b_out"] as const) updateVector(params.dec[name], grads.dec[name], lr);
}

function sampleMixture(n: number, d: number, rng: Rng): Vector[] {
  const data: Vector[] = [];
  const half = Math.floor(d / 2);
  for (let k = 0; k < n; k++) {
    let center: Vector;
    if (rng.random() < 0.5) {
      center = [...new Array(half).fill(1.0), ...new Array(d - half).fill(-1.0)];
    } else {
      center = [...new Array(half).fill(-1.0), ...new Array(d - half).fill(1.0)];
    }
    data.push(center.map((c) => c + rng.gauss(0, 0.2)));
  }
  return data;
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / Math.max(xs.length, 1);
}

function main(): void {
  const rng = new Rng(7);
  const inDim = 8;
  const hidden = 10;
  const zDim = 2;
  const params = initVae(inDim, hidden, zDim, rng);
  const data = sampleMixture(60, inDim, rng);

  const beta = 0.2;
  const lr = 0.01;
  console.log(`=== training tiny VAE: ${inDim}-D input, ${zDim}-D latent, beta=${beta} ===`);
  for (let epoch = 0; epoch < 40; epoch++) {
    const losses: number[] = [];
    const recons: number[] = [];
    const kls: number[] = [];
    for (const x of data) {
      const eps: Vector = [];
      for (let i = 0; i < zDim; i++) eps.push(rng.gauss(0, 1));
      const fwd = forward(x, params, eps);
      const [total, recon, kl] = lossValue(x, fwd, beta);
      const grads = backward(x, fwd, params, beta);
      applyUpdate(params, grads, lr);
      losses.push(total);
      recons.push(recon);
      kls.push(kl);
    }
    if ((epoch + 1) % 5 === 0) {
      console.log(
        `epoch ${String(epoch + 1).padStart(2)}: loss ${mean(losses).toFixed(3)}  recon ${mean(recons).toFixed(3)}  KL ${mean(kls).toFixed(3)}`,
      );
    }
  }

  console.log();
  console.log("=== reconstruction on held-out sample ===");
  const xTest = sampleMixture(1, inDim, rng)[0];
  const eps = zerosVec(zDim);
  const fwd = forward(xTest, params, eps);
  let mse = 0;
  for (let i = 0; i < xTest.length; i++) mse += (xTest[i] - fwd.x_hat[i]) ** 2;
  console.log("  x     =", pyList(xTest.map((v) => signed(v, 2))));
  console.log("  x_hat =", pyList(fwd.x_hat.map((v) => signed(v, 2))));
  console.log(`  mse = ${mse.toFixed(3)}`);

  console.log();
  console.log("=== samples from N(0, I) through decoder ===");
  for (let k = 0; k < 4; k++) {
    const z: Vector = [];
    for (let i = 0; i < zDim; i++) z.push(rng.gauss(0, 1));
    const h = tanh(add(matmul(params.dec.W1, z), params.dec.b1));
    const xHat = add(matmul(params.dec.W_out, h), params.dec.b_out);
    console.log(`  z=${pyList(z.map((zi) => signed(zi, 2)))}  ->  x_hat=${pyList(xHat.map((v) => signed(v, 2)))}`);
  }

  console.log();
  console.log("takeaway: decoder turns N(0, I) samples into structured 8-D vectors");
  console.log("          that resemble the two-cluster training data.");
}

main();

export {};
