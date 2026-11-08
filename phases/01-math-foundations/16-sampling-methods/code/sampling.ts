// Lesson: Sampling Methods (phase 01 / lesson 16)
// TypeScript port of code/sampling.py. Node standard library only.
// Source: phases/01-math-foundations/16-sampling-methods/docs/en.md
// Run: npx tsx phases/01-math-foundations/16-sampling-methods/code/sampling.ts
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(42);

function randomUniform(a: number, b: number): number {
  return a + (b - a) * random();
}

function gauss(mu: number, sigma: number): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function argmax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! > values[best]!) {
      best = i;
    }
  }
  return best;
}

function pyFloat(value: number): string {
  if (Number.isInteger(value)) {
    return value.toFixed(1);
  }
  return String(value);
}

function formatFloatList(values: number[]): string {
  return `[${values.map(pyFloat).join(", ")}]`;
}

function formatStringList(values: string[]): string {
  return `[${values.map((v) => `'${v}'`).join(", ")}]`;
}

function formatFixedList(values: number[], digits: number): string {
  return `[${values.map((v) => v.toFixed(digits)).join(", ")}]`;
}

function sampleUniform(a: number, b: number): number {
  return a + (b - a) * random();
}

function sampleExponentialInverseCdf(lam: number): number {
  const u = random();
  return -Math.log(u) / lam;
}

function verifyInverseCdf(lam: number, n = 10000): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    samples.push(sampleExponentialInverseCdf(lam));
  }
  const empiricalMean = sum(samples) / samples.length;
  const theoreticalMean = 1.0 / lam;
  console.log(
    `  Exponential(lambda=${pyFloat(lam)}): empirical mean=${empiricalMean.toFixed(4)}, ` +
      `theoretical=${theoreticalMean.toFixed(4)}`,
  );
  return samples;
}

function normalPdf(x: number, mu: number, sigma: number): number {
  const coeff = 1.0 / (sigma * Math.sqrt(2 * Math.PI));
  const exponent = -0.5 * ((x - mu) / sigma) ** 2;
  return coeff * Math.exp(exponent);
}

function sampleNormalBoxMuller(mu = 0.0, sigma = 1.0): number {
  const u1 = random();
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

type Pdf = (x: number) => number;
type Sampler = () => number;

function rejectionSample(targetPdf: Pdf, proposalSample: Sampler, proposalPdf: Pdf, M: number): [number, number] {
  let attempts = 0;
  while (true) {
    const x = proposalSample();
    const u = random();
    attempts += 1;
    if (u < targetPdf(x) / (M * proposalPdf(x))) {
      return [x, attempts];
    }
  }
}

function rejectionSampleBatch(
  targetPdf: Pdf,
  proposalSample: Sampler,
  proposalPdf: Pdf,
  M: number,
  n: number,
): [number[], number] {
  const samples: number[] = [];
  let totalAttempts = 0;
  for (let i = 0; i < n; i++) {
    const [x, attempts] = rejectionSample(targetPdf, proposalSample, proposalPdf, M);
    samples.push(x);
    totalAttempts += attempts;
  }
  const acceptanceRate = n / totalAttempts;
  return [samples, acceptanceRate];
}

function truncatedNormalDemo(mu: number, sigma: number, a: number, b: number, n = 5000): [number[], number] {
  let normConst = 0;
  for (let i = 0; i <= 1000; i++) {
    normConst += (normalPdf(a + ((b - a) * i) / 1000, mu, sigma) * (b - a)) / 1000;
  }
  const peak = Math.min(Math.max(mu, a), b);
  const mVal = normalPdf(peak, mu, sigma) / (1.0 / (b - a));

  const target = (x: number): number => {
    if (a <= x && x <= b) {
      return normalPdf(x, mu, sigma);
    }
    return 0.0;
  };

  const proposal = (): number => sampleUniform(a, b);

  const proposalPdf = (x: number): number => {
    if (a <= x && x <= b) {
      return 1.0 / (b - a);
    }
    return 0.0;
  };

  return rejectionSampleBatch(target, proposal, proposalPdf, mVal, n);
}

function importanceSamplingEstimate(
  f: (x: number) => number,
  targetPdf: Pdf,
  proposalPdf: Pdf,
  proposalSample: Sampler,
  n: number,
): [number, number] {
  let weightedSum = 0.0;
  let weightSum = 0.0;
  for (let i = 0; i < n; i++) {
    const x = proposalSample();
    const w = targetPdf(x) / proposalPdf(x);
    weightedSum += f(x) * w;
    weightSum += w;
  }
  const unnormalized = weightedSum / n;
  const selfNormalized = weightedSum / weightSum;
  return [unnormalized, selfNormalized];
}

function importanceSamplingDemo(): void {
  const mu = 2.0;
  const sigma = 1.0;
  const a = -3.0;
  const b = 7.0;

  const f = (x: number): number => x ** 2;
  const target = (x: number): number => normalPdf(x, mu, sigma);
  const proposal = (): number => sampleUniform(a, b);
  const proposalPdf = (x: number): number => {
    if (a <= x && x <= b) {
      return 1.0 / (b - a);
    }
    return 0.0;
  };

  const [estUnnorm, estSelfnorm] = importanceSamplingEstimate(f, target, proposalPdf, proposal, 50000);
  const theoretical = mu ** 2 + sigma ** 2;
  console.log(`  E[X^2] under N(${pyFloat(mu)},${pyFloat(sigma)}):`);
  console.log(`    Unnormalized IS: ${estUnnorm.toFixed(4)}`);
  console.log(`    Self-normalized IS: ${estSelfnorm.toFixed(4)}`);
  console.log(`    Theoretical: ${theoretical.toFixed(4)}`);
}

function monteCarloPi(n: number): number {
  let inside = 0;
  for (let i = 0; i < n; i++) {
    const x = randomUniform(-1, 1);
    const y = randomUniform(-1, 1);
    if (x * x + y * y <= 1) {
      inside += 1;
    }
  }
  return (4 * inside) / n;
}

function monteCarloIntegral(f: (x: number) => number, a: number, b: number, n: number): number {
  let total = 0.0;
  for (let i = 0; i < n; i++) {
    const x = sampleUniform(a, b);
    total += f(x);
  }
  return ((b - a) * total) / n;
}

function metropolisHastings(
  targetLogPdf: (x: number) => number,
  x0: number,
  nSamples: number,
  burnIn: number,
  proposalStd = 1.0,
): [number[], number] {
  const samples: number[] = [];
  let x = x0;
  let accepted = 0;
  const total = nSamples + burnIn;

  for (let i = 0; i < total; i++) {
    const xNew = x + gauss(0, proposalStd);
    const logAlpha = targetLogPdf(xNew) - targetLogPdf(x);

    if (Math.log(random() + 1e-300) < logAlpha) {
      x = xNew;
      if (i >= burnIn) {
        accepted += 1;
      }
    }

    if (i >= burnIn) {
      samples.push(x);
    }
  }

  const acceptanceRate = accepted / nSamples;
  return [samples, acceptanceRate];
}

type Point = [number, number];

function metropolisHastings2d(
  targetLogPdf: (x: number, y: number) => number,
  x0: number,
  y0: number,
  nSamples: number,
  burnIn: number,
  proposalStd = 0.5,
): [Point[], number] {
  const samples: Point[] = [];
  let x = x0;
  let y = y0;
  let accepted = 0;
  const total = nSamples + burnIn;

  for (let i = 0; i < total; i++) {
    const xNew = x + gauss(0, proposalStd);
    const yNew = y + gauss(0, proposalStd);
    const logAlpha = targetLogPdf(xNew, yNew) - targetLogPdf(x, y);

    if (Math.log(random() + 1e-300) < logAlpha) {
      x = xNew;
      y = yNew;
      if (i >= burnIn) {
        accepted += 1;
      }
    }

    if (i >= burnIn) {
      samples.push([x, y]);
    }
  }

  const acceptanceRate = accepted / nSamples;
  return [samples, acceptanceRate];
}

function bimodalLogPdf(x: number): number {
  const p1 = 0.4 * normalPdf(x, -3, 1);
  const p2 = 0.6 * normalPdf(x, 3, 1);
  return Math.log(p1 + p2 + 1e-300);
}

function gibbsSampling2d(rho: number, nSamples: number, burnIn: number): Point[] {
  let x = 0.0;
  let y = 0.0;
  const samples: Point[] = [];

  for (let i = 0; i < nSamples + burnIn; i++) {
    x = gauss(rho * y, Math.sqrt(1 - rho ** 2));
    y = gauss(rho * x, Math.sqrt(1 - rho ** 2));
    if (i >= burnIn) {
      samples.push([x, y]);
    }
  }

  return samples;
}

function softmax(logits: number[]): number[] {
  const maxL = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - maxL));
  const total = sum(exps);
  return exps.map((e) => e / total);
}

function sampleFromProbs(probs: number[]): number {
  const r = random();
  let cumsum = 0.0;
  for (let i = 0; i < probs.length; i++) {
    cumsum += probs[i]!;
    if (r <= cumsum) {
      return i;
    }
  }
  return probs.length - 1;
}

function temperatureSample(logits: number[], temperature: number): number {
  if (temperature <= 0) {
    return argmax(logits);
  }
  const scaled = logits.map((z) => z / temperature);
  const probs = softmax(scaled);
  return sampleFromProbs(probs);
}

function temperatureDistribution(logits: number[], temperature: number): number[] {
  if (temperature <= 0) {
    const result = new Array<number>(logits.length).fill(0.0);
    result[argmax(logits)] = 1.0;
    return result;
  }
  const scaled = logits.map((z) => z / temperature);
  return softmax(scaled);
}

type IndexedValue = { index: number; value: number };

function sortDescending(values: number[]): IndexedValue[] {
  const indexed = values.map((value, index) => ({ index, value }));
  indexed.sort((a, b) => b.value - a.value);
  return indexed;
}

function topKSample(logits: number[], k: number): number {
  const top = sortDescending(logits).slice(0, k);
  const topLogits = top.map((entry) => entry.value);
  const probs = softmax(topLogits);
  const idx = sampleFromProbs(probs);
  return top[idx]!.index;
}

function topKDistribution(logits: number[], k: number): number[] {
  const probs = softmax(logits);
  const indexed = sortDescending(probs);
  const result = new Array<number>(logits.length).fill(0.0);
  const topIndices = indexed.slice(0, k).map((entry) => entry.index);
  const total = sum(topIndices.map((idx) => probs[idx]!));
  for (const idx of topIndices) {
    result[idx] = probs[idx]! / total;
  }
  return result;
}

function topPSample(logits: number[], p: number): number {
  const probs = softmax(logits);
  const indexed = sortDescending(probs);
  let cumsum = 0.0;
  const selected: IndexedValue[] = [];
  for (const entry of indexed) {
    cumsum += entry.value;
    selected.push(entry);
    if (cumsum >= p) {
      break;
    }
  }
  const total = sum(selected.map((entry) => entry.value));
  const selProbs = selected.map((entry) => entry.value / total);
  const idx = sampleFromProbs(selProbs);
  return selected[idx]!.index;
}

function topPDistribution(logits: number[], p: number): number[] {
  const probs = softmax(logits);
  const indexed = sortDescending(probs);
  let cumsum = 0.0;
  const selectedIndices: number[] = [];
  for (const entry of indexed) {
    cumsum += entry.value;
    selectedIndices.push(entry.index);
    if (cumsum >= p) {
      break;
    }
  }
  const result = new Array<number>(logits.length).fill(0.0);
  const total = sum(selectedIndices.map((i) => probs[i]!));
  for (const i of selectedIndices) {
    result[i] = probs[i]! / total;
  }
  return result;
}

function reparamSample(mu: number, sigma: number): [number, number] {
  const epsilon = gauss(0, 1);
  const z = mu + sigma * epsilon;
  return [z, epsilon];
}

function reparamGradient(epsilon: number): [number, number] {
  const dzDmu = 1.0;
  const dzDsigma = epsilon;
  return [dzDmu, dzDsigma];
}

function vaeForwardDemo(mu: number, logVar: number): [number, number, number, number] {
  const sigma = Math.exp(0.5 * logVar);
  const [z, epsilon] = reparamSample(mu, sigma);

  const dzDmu = 1.0;
  const dzDsigma = epsilon;
  const dsigmaDlogvar = 0.5 * sigma;

  const dzDmuTotal = dzDmu;
  const dzDlogvar = dzDsigma * dsigmaDlogvar;

  return [z, epsilon, dzDmuTotal, dzDlogvar];
}

function gumbelSample(): number {
  let u = random();
  while (u === 0) {
    u = random();
  }
  return -Math.log(-Math.log(u));
}

function gumbelMaxSample(logProbs: number[]): number {
  const gumbels = logProbs.map((lp) => lp + gumbelSample());
  return argmax(gumbels);
}

function gumbelSoftmaxSample(logProbs: number[], temperature: number): number[] {
  const gumbels = logProbs.map((lp) => lp + gumbelSample());
  const scaled = gumbels.map((g) => g / temperature);
  return softmax(scaled);
}

function gumbelSoftmaxStraightThrough(logProbs: number[], temperature: number): [number[], number[]] {
  const soft = gumbelSoftmaxSample(logProbs, temperature);
  const hardIdx = argmax(soft);
  const hard = new Array<number>(logProbs.length).fill(0.0);
  hard[hardIdx] = 1.0;
  return [hard, soft];
}

function stratifiedSample1d(n: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = random();
    samples.push((i + u) / n);
  }
  return samples;
}

function compareSamplingVariance(f: (x: number) => number, n: number, nTrials = 200): [number, number] {
  const standardEstimates: number[] = [];
  const stratifiedEstimates: number[] = [];

  for (let trial = 0; trial < nTrials; trial++) {
    const standardSamples: number[] = [];
    for (let i = 0; i < n; i++) {
      standardSamples.push(random());
    }
    standardEstimates.push(sum(standardSamples.map(f)) / n);

    const stratSamples = stratifiedSample1d(n);
    stratifiedEstimates.push(sum(stratSamples.map(f)) / n);
  }

  const stdMean = sum(standardEstimates) / standardEstimates.length;
  const stdVar = sum(standardEstimates.map((e) => (e - stdMean) ** 2)) / standardEstimates.length;

  const stratMean = sum(stratifiedEstimates) / stratifiedEstimates.length;
  const stratVar = sum(stratifiedEstimates.map((e) => (e - stratMean) ** 2)) / stratifiedEstimates.length;

  return [stdVar, stratVar];
}

type GenerationParams = { temperature?: number; k?: number; p?: number };

function textGenerationDemo(
  vocab: string[],
  logits: number[],
  length: number,
  method: string,
  params: GenerationParams,
): string {
  const tokens: string[] = [];
  for (let i = 0; i < length; i++) {
    let idx: number;
    if (method === "greedy") {
      idx = argmax(logits);
    } else if (method === "temperature") {
      idx = temperatureSample(logits, params.temperature ?? 1.0);
    } else if (method === "top_k") {
      idx = topKSample(logits, params.k ?? 5);
    } else if (method === "top_p") {
      idx = topPSample(logits, params.p ?? 0.9);
    } else {
      idx = sampleFromProbs(softmax(logits));
    }
    tokens.push(vocab[idx]!);
  }
  return tokens.join(" ");
}

function standardDeviation(values: number[], center: number): number {
  return (sum(values.map((x) => (x - center) ** 2)) / values.length) ** 0.5;
}

function main(): void {
  console.log("=".repeat(65));
  console.log("SAMPLING METHODS");
  console.log("=".repeat(65));

  console.log("\n--- 1. Inverse CDF Sampling (Exponential) ---");
  for (const lam of [0.5, 1.0, 2.0]) {
    verifyInverseCdf(lam);
  }

  console.log("\n--- 2. Rejection Sampling (Truncated Normal) ---");
  const [truncSamples, acc] = truncatedNormalDemo(0, 1, -1, 2, 5000);
  const truncMean = sum(truncSamples) / truncSamples.length;
  console.log(`  Truncated N(0,1) on [-1, 2]: mean=${truncMean.toFixed(4)}, acceptance rate=${acc.toFixed(4)}`);

  console.log("\n--- 3. Importance Sampling ---");
  importanceSamplingDemo();

  console.log("\n--- 4. Monte Carlo Estimation ---");
  console.log("  Estimating pi:");
  for (const n of [1000, 10000, 100000]) {
    const piEst = monteCarloPi(n);
    const error = Math.abs(piEst - Math.PI);
    console.log(`    N=${String(n).padStart(7)}: pi ~ ${piEst.toFixed(6)}, error=${error.toFixed(6)}`);
  }

  console.log("  Estimating integral of sin(x) from 0 to pi (true = 2.0):");
  for (const n of [1000, 10000, 100000]) {
    const est = monteCarloIntegral(Math.sin, 0, Math.PI, n);
    const error = Math.abs(est - 2.0);
    console.log(`    N=${String(n).padStart(7)}: estimate=${est.toFixed(6)}, error=${error.toFixed(6)}`);
  }

  console.log("\n--- 5. Metropolis-Hastings MCMC ---");
  console.log("  Sampling from bimodal distribution (mixture of Gaussians):");
  for (const std of [0.5, 1.0, 3.0]) {
    const [samplesMh, accRate] = metropolisHastings(bimodalLogPdf, 0.0, 10000, 2000, std);
    const mhMean = sum(samplesMh) / samplesMh.length;
    const mhStd = standardDeviation(samplesMh, mhMean);
    console.log(
      `    proposal_std=${pyFloat(std)}: mean=${mhMean.toFixed(4)}, std=${mhStd.toFixed(4)}, ` +
        `acceptance=${accRate.toFixed(4)}`,
    );
  }

  console.log("\n  Sampling from 2D Gaussian:");
  const gaussian2dLogPdf = (x: number, y: number): number => -0.5 * (x ** 2 + y ** 2);

  const [samples2d, acc2d] = metropolisHastings2d(gaussian2dLogPdf, 5.0, 5.0, 10000, 2000, 1.0);
  const xs = samples2d.map((s) => s[0]);
  const ys = samples2d.map((s) => s[1]);
  console.log(
    `    mean_x=${(sum(xs) / xs.length).toFixed(4)}, mean_y=${(sum(ys) / ys.length).toFixed(4)}, ` +
      `acceptance=${acc2d.toFixed(4)}`,
  );

  console.log("\n--- 6. Gibbs Sampling (Correlated 2D Gaussian) ---");
  for (const rho of [0.0, 0.5, 0.9]) {
    const gibbsSamples = gibbsSampling2d(rho, 10000, 1000);
    const gx = gibbsSamples.map((s) => s[0]);
    const gy = gibbsSamples.map((s) => s[1]);
    const empiricalCorr =
      sum(gibbsSamples.map(([a, b]) => a * b)) / gibbsSamples.length -
      (sum(gx) / gx.length) * (sum(gy) / gy.length);
    console.log(`  rho=${pyFloat(rho)}: empirical correlation=${empiricalCorr.toFixed(4)}`);
  }

  console.log("\n--- 7. Temperature Sampling ---");
  const tokenLogits = [3.0, 2.0, 1.5, 0.5, -1.0, -2.0];
  const vocab = ["the", "a", "this", "one", "that", "some"];
  console.log(`  Logits: ${formatFloatList(tokenLogits)}`);
  console.log(`  Vocab: ${formatStringList(vocab)}`);
  for (const temp of [0.1, 0.5, 1.0, 1.5, 3.0]) {
    const dist = temperatureDistribution(tokenLogits, temp);
    console.log(`  T=${temp.toFixed(1)}: ${formatFixedList(dist, 4)}`);
  }

  console.log("\n  Generation samples at different temperatures:");
  for (const temp of [0.1, 0.7, 1.0, 2.0]) {
    const tokensOut: string[] = [];
    for (let i = 0; i < 10; i++) {
      const idx = temperatureSample(tokenLogits, temp);
      tokensOut.push(vocab[idx]!);
    }
    console.log(`    T=${pyFloat(temp)}: ${tokensOut.join(" ")}`);
  }

  console.log("\n--- 8. Top-k Sampling ---");
  console.log(`  Logits: ${formatFloatList(tokenLogits)}`);
  for (const k of [1, 2, 3, 6]) {
    const dist = topKDistribution(tokenLogits, k);
    console.log(`  k=${k}: ${formatFixedList(dist, 4)}`);
  }

  console.log("\n--- 9. Top-p (Nucleus) Sampling ---");
  console.log(`  Logits: ${formatFloatList(tokenLogits)}`);
  for (const p of [0.5, 0.8, 0.9, 0.95, 1.0]) {
    const dist = topPDistribution(tokenLogits, p);
    const nonzero = dist.filter((d) => d > 0).length;
    console.log(`  p=${p.toFixed(2)}: ${formatFixedList(dist, 4)} (${nonzero} tokens)`);
  }

  console.log("\n--- 10. Reparameterization Trick ---");
  const muVal = 2.0;
  const logVarVal = 0.5;

  console.log(`  VAE encoder output: mu=${pyFloat(muVal)}, log_var=${pyFloat(logVarVal)}`);
  const zSamples: number[] = [];
  for (let trial = 0; trial < 5; trial++) {
    const [z, eps, dzDmu, dzDlogvar] = vaeForwardDemo(muVal, logVarVal);
    zSamples.push(z);
    console.log(
      `    Trial ${trial + 1}: z=${z.toFixed(4)}, eps=${eps.toFixed(4)}, ` +
        `dz/dmu=${dzDmu.toFixed(4)}, dz/dlog_var=${dzDlogvar.toFixed(4)}`,
    );
  }

  console.log(`  Mean of z samples: ${(sum(zSamples) / zSamples.length).toFixed(4)} (expected ~${pyFloat(muVal)})`);
  console.log("  Gradients exist because z = mu + sigma * epsilon is differentiable.");

  console.log("\n  Verifying reparameterization matches direct sampling:");
  const sigmaVal = Math.exp(0.5 * logVarVal);
  const directSamples: number[] = [];
  for (let i = 0; i < 10000; i++) {
    directSamples.push(sampleNormalBoxMuller(muVal, sigmaVal));
  }
  const reparamSamples: number[] = [];
  for (let i = 0; i < 10000; i++) {
    reparamSamples.push(reparamSample(muVal, sigmaVal)[0]);
  }
  const dMean = sum(directSamples) / directSamples.length;
  const rMean = sum(reparamSamples) / reparamSamples.length;
  const dStd = standardDeviation(directSamples, dMean);
  const rStd = standardDeviation(reparamSamples, rMean);
  console.log(`    Direct:  mean=${dMean.toFixed(4)}, std=${dStd.toFixed(4)}`);
  console.log(`    Reparam: mean=${rMean.toFixed(4)}, std=${rStd.toFixed(4)}`);

  console.log("\n--- 11. Gumbel-Softmax ---");
  const probs = [0.5, 0.3, 0.15, 0.05];
  const logProbs = probs.map((p) => Math.log(p));
  const labels = ["cat", "dog", "bird", "fish"];
  console.log(`  True probs: ${formatFloatList(probs)}`);

  console.log("\n  Gumbel-Max (exact categorical) verification:");
  const counts = new Array<number>(probs.length).fill(0);
  const nGumbel = 10000;
  for (let i = 0; i < nGumbel; i++) {
    const idx = gumbelMaxSample(logProbs);
    counts[idx]! += 1;
  }
  const empirical = counts.map((c) => c / nGumbel);
  console.log(`    Empirical: ${formatFixedList(empirical, 4)}`);
  console.log(`    True:      ${formatFixedList(probs, 4)}`);

  console.log("\n  Gumbel-Softmax at different temperatures:");
  for (const tau of [0.1, 0.5, 1.0, 5.0]) {
    const soft = gumbelSoftmaxSample(logProbs, tau);
    const maxIdx = argmax(soft);
    console.log(`    tau=${tau.toFixed(1)}: ${formatFixedList(soft, 4)} -> ${labels[maxIdx]}`);
  }

  console.log("\n  Straight-through estimator:");
  const [hard, soft] = gumbelSoftmaxStraightThrough(logProbs, 0.5);
  console.log(`    Hard (forward): ${formatFloatList(hard)}`);
  console.log(`    Soft (backward): ${formatFixedList(soft, 4)}`);

  console.log("\n--- 12. Stratified Sampling ---");
  const testFn = (x: number): number => Math.sin(Math.PI * x);

  console.log("  Comparing standard vs stratified Monte Carlo:");
  console.log(`  Function: sin(pi*x) on [0,1], true integral = 2/pi = ${(2 / Math.PI).toFixed(6)}`);
  for (const n of [10, 50, 100]) {
    const [stdVar, stratVar] = compareSamplingVariance(testFn, n);
    const ratio = stratVar > 0 ? stdVar / stratVar : Infinity;
    console.log(
      `    N=${String(n).padStart(3)}: standard_var=${stdVar.toFixed(8)}, ` +
        `stratified_var=${stratVar.toFixed(8)}, ratio=${ratio.toFixed(2)}x`,
    );
  }

  console.log("\n--- 13. Text Generation Demo ---");
  const genVocab = ["the", "cat", "sat", "on", "mat", "a", "dog", "ran", "big", "red"];
  const genLogits = [3.0, 2.5, 2.0, 1.8, 1.5, 1.0, 0.5, 0.0, -0.5, -1.0];

  console.log(`  Vocab: ${formatStringList(genVocab)}`);
  console.log(`  Logits: ${formatFloatList(genLogits)}`);
  console.log("");

  const methods: [string, GenerationParams][] = [
    ["greedy", {}],
    ["temperature", { temperature: 0.5 }],
    ["temperature", { temperature: 1.0 }],
    ["temperature", { temperature: 2.0 }],
    ["top_k", { k: 3 }],
    ["top_p", { p: 0.8 }],
  ];

  for (const [methodName, params] of methods) {
    let label = methodName;
    const entries = Object.entries(params);
    if (entries.length > 0) {
      const parts = entries.map(([key, value]) => {
        const shown = key === "k" ? String(value) : pyFloat(value);
        return `${key}=${shown}`;
      });
      label += `(${parts.join(", ")})`;
    }
    const sequences: string[] = [];
    for (let run = 0; run < 3; run++) {
      sequences.push(textGenerationDemo(genVocab, genLogits, 8, methodName, params));
    }
    console.log(`  ${label}:`);
    sequences.forEach((seq, i) => {
      console.log(`    Run ${i + 1}: ${seq}`);
    });
    const unique = new Set(sequences).size;
    console.log(`    Unique sequences: ${unique}/3`);
    console.log("");
  }

  console.log("\n--- 14. Visualizations ---");
  console.log("  matplotlib not available, skipping visualization.");

  console.log("\n" + "=".repeat(65));
  console.log("All sampling methods complete.");
  console.log("=".repeat(65));
}

main();
