// Lesson: Watermarking: SynthID, Stable Signature, C2PA (phase 18 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/code/main.ts

import { createHash } from "node:crypto";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(61);

function randrange(n: number): number {
  return Math.floor(random() * n);
}

function choice<T>(xs: T[]): T {
  return xs[randrange(xs.length)];
}

function fmt(x: number, d: number): string {
  const full = Math.abs(x).toFixed(Math.min(100, d + 30));
  const cut = full.indexOf(".") + 1 + d;
  const tail = full.slice(cut);
  let body: string;
  if (/^50*$/.test(tail)) {
    const lo = Number(full.slice(0, cut));
    const last = Number(full[cut - 1]);
    body = (last % 2 === 0 ? lo : lo + Math.pow(10, -d)).toFixed(d);
  } else {
    body = Math.abs(x).toFixed(d);
  }
  return (x < 0 || Object.is(x, -0) ? "-" : "") + body;
}

const VOCAB = 200;
const K = 4;

function greenSet(prevTokens: number[]): Set<number> {
  const seed = prevTokens.slice(-K).map(String).join(",");
  const digest = createHash("sha256").update(seed, "utf8").digest("hex");
  const hParity = parseInt(digest[digest.length - 1], 16) % 2;
  const greens = new Set<number>();
  for (let t = 0; t < VOCAB; t++) {
    if ((t + hParity) % 2 === 0) {
      greens.add(t);
    }
  }
  return greens;
}

function unwatermarkedSample(n: number, seedPrefix: number[]): number[] {
  const out = [...seedPrefix];
  for (let i = 0; i < n; i++) {
    out.push(randrange(VOCAB));
  }
  return out;
}

function watermarkedSample(n: number, seedPrefix: number[], bias = 0.9): number[] {
  const out = [...seedPrefix];
  for (let i = 0; i < n; i++) {
    const greens = greenSet(out);
    const useGreen = random() < bias;
    const pool: number[] = [];
    for (let t = 0; t < VOCAB; t++) {
      if (greens.has(t) === useGreen) {
        pool.push(t);
      }
    }
    out.push(choice(pool));
  }
  return out;
}

function detect(tokens: number[]): number {
  if (tokens.length <= K) {
    return 0.0;
  }
  let greenCount = 0;
  for (let i = K; i < tokens.length; i++) {
    const greens = greenSet(tokens.slice(0, i));
    if (greens.has(tokens[i])) {
      greenCount += 1;
    }
  }
  const n = tokens.length - K;
  const expected = n * 0.5;
  const std = Math.sqrt(n * 0.5 * 0.5);
  return (greenCount - expected) / std;
}

function paraphrase(tokens: number[], ratio = 0.3): number[] {
  const out = [...tokens];
  for (let i = 0; i < out.length; i++) {
    if (random() < ratio) {
      out[i] = randrange(VOCAB);
    }
  }
  return out;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("TOY TOKEN WATERMARK (Phase 18, Lesson 23)");
  console.log("=".repeat(70));

  const seed = Array.from({ length: K }, () => randrange(VOCAB));

  const watermarked = watermarkedSample(1000, seed);
  const plain = unwatermarkedSample(1000, seed);

  console.log(`\nwatermarked z-score       : ${fmt(detect(watermarked), 2)}`);
  console.log(`unwatermarked z-score     : ${fmt(detect(plain), 2)}`);
  console.log("(z >= 4 is very strong evidence of watermark.)");

  const para = paraphrase(watermarked, 0.3);
  console.log(`after 30% paraphrase      : ${fmt(detect(para), 2)}`);
  const para2 = paraphrase(watermarked, 0.6);
  console.log(`after 60% paraphrase      : ${fmt(detect(para2), 2)}`);

  const fprs = Array.from({ length: 100 }, () => detect(unwatermarkedSample(1000, seed)));
  const fprAbove4 = fprs.filter((z) => z >= 4).length / fprs.length;
  console.log(`\nFPR (z >= 4) over 100 human draws : ${fmt(fprAbove4, 3)}`);

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: the text watermark is detectable at >=1000 tokens with");
  console.log("strong z-scores and <1% FPR at z=4. paraphrase of 30% weakens the");
  console.log("signal; 60% destroys it. text watermarks do not survive paraphrase.");
  console.log("C2PA metadata + watermark is the deployment combination: watermark");
  console.log("survives compression, metadata survives (as long as it is not stripped).");
  console.log("=".repeat(70));
}

main();
