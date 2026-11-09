// Lesson: Chameleon and Early-Fusion Token-Only Multimodal Models (phase 12 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/code/main.ts

export {};

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

const rng: Random = mulberry32(7);

function choice<T>(xs: T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

function randrange(n: number): number {
  return Math.floor(rng() * n);
}

const VOCAB_TEXT = 32;
const VOCAB_IMG = 16;
const IMG_OFFSET = VOCAB_TEXT;
const SEP_OPEN = VOCAB_TEXT + VOCAB_IMG;
const SEP_CLOSE = SEP_OPEN + 1;
const VOCAB_SIZE = SEP_CLOSE + 1;

const CODEBOOK: number[][] = [];
for (let i = 0; i < VOCAB_IMG; i++) {
  const code: number[] = [];
  for (let j = 0; j < 4; j++) code.push((i * 7 + 3 * j) % 8);
  CODEBOOK.push(code);
}

type Bigram = Map<number, Map<number, number>>;

function quantizePatch(patch: number[]): number {
  let best = 0;
  let bestD = Infinity;
  CODEBOOK.forEach((code, k) => {
    let d = 0;
    const n = Math.min(patch.length, code.length);
    for (let i = 0; i < n; i++) d += (patch[i] - code[i]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best + IMG_OFFSET;
}

function imageToTokens(img: number[][]): number[] {
  const patches: number[][] = [];
  for (let pr = 0; pr < 8; pr += 4) {
    for (let pc = 0; pc < 8; pc += 4) {
      const flat: number[] = [];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          let s = 0;
          for (let dr = 0; dr < 2; dr++) {
            for (let dc = 0; dc < 2; dc++) s += img[pr + 2 * r + dr][pc + 2 * c + dc];
          }
          flat.push(Math.floor(s / 4));
        }
      }
      patches.push(flat);
    }
  }
  return patches.map(quantizePatch);
}

function synthesizeCaption(kind: string): number[] {
  if (kind === "red") return [1, 5, 3, 7];
  if (kind === "blue") return [2, 5, 3, 8];
  if (kind === "green") return [1, 5, 3, 9];
  return [1, 5, 3, 10];
}

function synthImage(kind: string): number[][] {
  const shades: Record<string, number> = { red: 7, blue: 2, green: 4, gray: 5 };
  const shade = shades[kind];
  const out: number[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: number[] = [];
    for (let c = 0; c < 8; c++) row.push(shade + ((r + c) % 3));
    out.push(row);
  }
  return out;
}

function makeDataset(n = 40): number[][] {
  const kinds = ["red", "blue", "green", "gray"];
  const corpus: number[][] = [];
  for (let i = 0; i < n; i++) {
    const k = choice(kinds);
    let tokens = [...synthesizeCaption(k), SEP_OPEN, ...imageToTokens(synthImage(k)), SEP_CLOSE];
    if (rng() < 0.4) {
      tokens = [SEP_OPEN, ...imageToTokens(synthImage(k)), SEP_CLOSE, ...synthesizeCaption(k)];
    }
    corpus.push(tokens);
  }
  return corpus;
}

function trainBigram(corpus: number[][]): Bigram {
  const counts: Bigram = new Map();
  for (const seq of corpus) {
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      let row = counts.get(a);
      if (row === undefined) {
        row = new Map();
        counts.set(a, row);
      }
      row.set(b, (row.get(b) ?? 0) + 1);
    }
  }
  return counts;
}

function sampleNext(bigram: Bigram, prev: number): number {
  const dist = bigram.get(prev);
  if (dist === undefined || dist.size === 0) return randrange(VOCAB_SIZE);
  let total = 0;
  for (const c of dist.values()) total += c;
  const r = rng() * total;
  let acc = 0;
  for (const [tok, c] of dist) {
    acc += c;
    if (r <= acc) return tok;
  }
  return dist.keys().next().value ?? 0;
}

function generate(bigram: Bigram, prompt: number[], maxLen = 40): number[] {
  const out = [...prompt];
  while (out.length < maxLen) {
    const nxt = sampleNext(bigram, out[out.length - 1]);
    out.push(nxt);
    if (nxt === SEP_CLOSE && out.some((t) => t < VOCAB_TEXT)) break;
  }
  return out;
}

function render(tokens: number[]): string {
  const parts: string[] = [];
  for (const t of tokens) {
    if (t === SEP_OPEN) parts.push("<image>");
    else if (t === SEP_CLOSE) parts.push("</image>");
    else if (t < VOCAB_TEXT) parts.push(`w${t}`);
    else parts.push(`i${t - IMG_OFFSET}`);
  }
  return parts.join(" ");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("CHAMELEON EARLY-FUSION TOY (Phase 12, Lesson 11)");
  console.log("=".repeat(60));

  console.log("\n1. VQ tokenizer: 8x8 grayscale -> 4 patches -> 4 image tokens");
  console.log("-".repeat(60));
  for (const kind of ["red", "blue", "green", "gray"]) {
    const img = synthImage(kind);
    const codes = imageToTokens(img);
    console.log(`  ${kind.padEnd(6)} -> codes [${codes.join(", ")}]`);
  }

  console.log("\n2. Shared vocabulary layout");
  console.log("-".repeat(60));
  console.log(`  text tokens   : 0..${VOCAB_TEXT - 1}`);
  console.log(`  image tokens  : ${IMG_OFFSET}..${IMG_OFFSET + VOCAB_IMG - 1}`);
  console.log(`  <image>       : ${SEP_OPEN}`);
  console.log(`  </image>      : ${SEP_CLOSE}`);
  console.log(`  vocab total   : ${VOCAB_SIZE}`);

  console.log("\n3. Dataset (40 sequences of interleaved text + image tokens)");
  console.log("-".repeat(60));
  const corpus = makeDataset(40);
  for (const seq of corpus.slice(0, 4)) console.log("  " + render(seq));

  console.log("\n4. Train bigram, sample mixed-modality output");
  console.log("-".repeat(60));
  const bigram = trainBigram(corpus);
  for (let i = 0; i < 3; i++) {
    const out = generate(bigram, [1, 5], 30);
    console.log("  " + render(out));
  }

  console.log("\nTAKEAWAY");
  console.log("-".repeat(60));
  console.log("  one model, one vocab, one loss -> mixed-modality output for free");
  console.log("  tokenizer quality caps image fidelity (lesson 12.12 on Emu3)");
  console.log("  at scale you need QK-Norm + careful dropout for stable training");
}

main();
