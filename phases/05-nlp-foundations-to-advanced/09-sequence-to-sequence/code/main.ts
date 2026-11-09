// Lesson: Sequence-to-Sequence Models (phase 05 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/code/main.ts

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: Random, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function choice<T>(rng: Random, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pyFixed(x: number, d: number): string {
  if (Object.is(x, -0)) return "-" + (0).toFixed(d);
  const wide = Math.abs(x).toFixed(Math.min(100, d + 25));
  const dot = wide.indexOf(".");
  const cut = dot + 1 + d;
  if (/^50*$/.test(wide.slice(cut))) {
    const head = wide.slice(0, d === 0 ? dot : cut);
    if (Number(head[head.length - 1]) % 2 === 0) return (x < 0 ? "-" : "") + head;
  }
  return x.toFixed(d);
}

function simulateCopyAccuracy(seqLen: number, contextDim = 8, epochs = 200, nTrain = 300, seed = 4): number {
  const rng = mulberry32(seed);
  const vocab = [..."abcdefghij"];
  const vocabSize = vocab.length;

  const embed = Array.from({ length: vocabSize }, () =>
    Array.from({ length: contextDim }, () => gauss(rng, 0, 0.3)),
  );

  const encode = (sequence: string[]): number[] => {
    const c = new Array<number>(contextDim).fill(0.0);
    const decay = 0.85;
    for (const token of sequence) {
      const idx = vocab.indexOf(token);
      for (let d = 0; d < contextDim; d++) c[d] = c[d] * decay + embed[idx][d];
    }
    return c;
  };

  const decodeScore = (context: number[], target: string[]): number => {
    let total = 0.0;
    let recovery = 1.0;
    for (const token of target) {
      const idx = vocab.indexOf(token);
      let score = 0;
      for (let d = 0; d < contextDim; d++) score += context[d] * embed[idx][d];
      const normed = Math.tanh(score) * recovery;
      total += Math.max(0.0, normed);
      recovery *= 0.9;
    }
    return total / Math.max(1, target.length);
  };

  let hits = 0;
  const trials = 100;
  for (let t = 0; t < trials; t++) {
    const seq = Array.from({ length: seqLen }, () => choice(rng, vocab));
    const c = encode(seq);
    const targetScore = decodeScore(c, seq);

    const noiseScore = decodeScore(
      c,
      Array.from({ length: seqLen }, () => choice(rng, vocab)),
    );
    if (targetScore > noiseScore) hits += 1;
  }
  return hits / trials;
}

function main(): void {
  console.log("toy simulation of encoder-decoder bottleneck");
  console.log("context vector has fixed size = 8 floats");
  console.log("encoder decays state at rate 0.85 per step (simulates forgetting)");
  console.log();
  console.log(`${"seq_len".padStart(8)}  ${"accuracy".padStart(10)}`);
  for (const length of [5, 10, 20, 40, 80]) {
    const acc = simulateCopyAccuracy(length);
    console.log(`${String(length).padStart(8)}  ${(pyFixed(acc * 100, 0) + "%").padStart(9)}`);
  }
  console.log();
  console.log("real LSTMs decay more gracefully but hit the same ceiling.");
  console.log("attention (lesson 10) removes the fixed-size constraint.");
}

main();

export {};
