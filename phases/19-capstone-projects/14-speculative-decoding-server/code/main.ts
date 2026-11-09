// Lesson: Capstone 14, Speculative-Decoding Inference Server (phase 19 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/14-speculative-decoding-server/docs/en.md
// Run: npx tsx phases/19-capstone-projects/14-speculative-decoding-server/code/main.ts

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

const VOCAB = [..."abcdefghij"];

function softmaxFrom(seed: number): number[] {
  const rnd = mulberry32(seed);
  const weights = VOCAB.map(() => rnd());
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
}

function sample(dist: number[], rng: Random): number {
  const r = rng();
  let acc = 0.0;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r <= acc) return i;
  }
  return dist.length - 1;
}

class TargetModel {
  calls = 0;
  tokensVerified = 0;

  distribution(ctxSeed: number): number[] {
    return softmaxFrom(ctxSeed * 7 + 13);
  }

  verify(draftTokens: number[], ctxSeed: number, rng: Random): [number[], number] {
    this.calls += 1;
    this.tokensVerified += draftTokens.length + 1;
    const accepted: number[] = [];
    for (let pos = 0; pos < draftTokens.length; pos++) {
      const tok = draftTokens[pos];
      const dist = this.distribution(ctxSeed + pos);
      if (dist[tok] >= 0.5 * Math.max(...dist)) {
        accepted.push(tok);
      } else {
        break;
      }
    }
    const ctx = ctxSeed + accepted.length;
    const dist = this.distribution(ctx);
    const nextTok = sample(dist, rng);
    return [accepted, nextTok];
  }
}

class DraftModel {
  calls = 0;

  constructor(public alignment = 0.80) {}

  propose(ctxSeed: number, k: number, rng: Random, target: TargetModel): number[] {
    this.calls += 1;
    const draftTokens: number[] = [];
    for (let pos = 0; pos < k; pos++) {
      const dist = target.distribution(ctxSeed + pos);
      if (rng() < this.alignment) {
        let best = 0;
        for (let i = 1; i < dist.length; i++) if (dist[i] > dist[best]) best = i;
        draftTokens.push(best);
      } else {
        draftTokens.push(sample(dist, rng));
      }
    }
    return draftTokens;
  }
}

class Metrics {
  generated = 0;
  targetCalls = 0;
  draftCalls = 0;
  acceptedSum = 0;

  acceptanceRate(k: number): number {
    if (this.targetCalls === 0) return 0.0;
    return this.acceptedSum / (this.targetCalls * k);
  }

  tokensPerTargetCall(): number {
    return this.generated / Math.max(1, this.targetCalls);
  }
}

function speculativeDecode(nTokens: number, k: number, rng: Random, target: TargetModel, draft: DraftModel): Metrics {
  const m = new Metrics();
  let ctxSeed = 1;
  while (m.generated < nTokens) {
    const draftTokens = draft.propose(ctxSeed, k, rng, target);
    m.draftCalls += 1;
    const [accepted] = target.verify(draftTokens, ctxSeed, rng);
    m.targetCalls += 1;
    m.acceptedSum += accepted.length;
    for (let i = 0; i < accepted.length; i++) {
      m.generated += 1;
      ctxSeed += 1;
      if (m.generated >= nTokens) break;
    }
    if (m.generated < nTokens) {
      m.generated += 1;
      ctxSeed += 1;
    }
  }
  return m;
}

function baselineDecode(nTokens: number, rng: Random, target: TargetModel): Metrics {
  const m = new Metrics();
  let ctxSeed = 1;
  while (m.generated < nTokens) {
    target.calls += 1;
    m.targetCalls += 1;
    const dist = target.distribution(ctxSeed);
    sample(dist, rng);
    m.generated += 1;
    ctxSeed += 1;
  }
  return m;
}

function main(): void {
  const nTokens = 500;
  console.log(`=== decode ${nTokens} tokens, compare baseline vs speculative ===`);

  let target = new TargetModel();
  let rng = mulberry32(7);
  const base = baselineDecode(nTokens, rng, target);
  console.log(`baseline: ${base.targetCalls} target calls, ` +
    `${base.tokensPerTargetCall().toFixed(2)} tok/call`);

  for (const alignment of [0.60, 0.75, 0.90]) {
    for (const k of [2, 4, 6]) {
      target = new TargetModel();
      const draft = new DraftModel(alignment);
      rng = mulberry32(7);
      const m = speculativeDecode(nTokens, k, rng, target, draft);
      const speedup = base.targetCalls / Math.max(1, m.targetCalls);
      console.log(`  align=${alignment.toFixed(2)} k=${k}  ` +
        `target_calls=${String(m.targetCalls).padStart(3)}  ` +
        `acceptance=${m.acceptanceRate(k).toFixed(2)}  ` +
        `tok/call=${m.tokensPerTargetCall().toFixed(2)}  ` +
        `speedup=${speedup.toFixed(2)}x`);
    }
  }
}

main();

export {};
