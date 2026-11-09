// Lesson: Transfusion: Autoregressive Text + Diffusion Image in One Transformer (phase 12 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/code/main.ts

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

const rng: Random = mulberry32(1);

function gauss(mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randint(low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1));
}

function choice<T>(xs: T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

const VOCAB = 8;
const IMG_PATCH_DIM = 4;
const HIDDEN = 8;
const SEP_OPEN = -1;
const SEP_CLOSE = -2;

type Tok = number | string;

interface Pair {
  caption: number[];
  image: number[][];
}

interface Weights {
  text_scale: number;
  img_scale: number;
  text_w: number;
  img_w: number;
}

function makeDataset(n = 24): Pair[] {
  const pairs: Pair[] = [];
  for (let k = 0; k < n; k++) {
    const cls = randint(0, VOCAB - 2);
    const cap = [1, 2, cls, 3];
    const shade = (cls + 1) / VOCAB;
    const img: number[][] = [];
    for (let r = 0; r < IMG_PATCH_DIM; r++) {
      const row: number[] = [];
      for (let c = 0; c < IMG_PATCH_DIM; c++) row.push(shade * (((r * 4 + c) % 3) + 1));
      img.push(row);
    }
    pairs.push({ caption: cap, image: img });
  }
  return pairs;
}

function patchToVec(patch: number[]): number[] {
  return [...patch.slice(0, HIDDEN), ...new Array<number>(Math.max(0, HIDDEN - patch.length)).fill(0.0)];
}

function buildMask(tokens: Tok[]): number[][] {
  const n = tokens.length;
  const imgRanges: [number, number][] = [];
  let i = 0;
  while (i < n) {
    if (tokens[i] === SEP_OPEN) {
      const start = i + 1;
      while (i < n && tokens[i] !== SEP_CLOSE) i += 1;
      imgRanges.push([start, i]);
    }
    i += 1;
  }

  const sameImg = (a: number, b: number): boolean => {
    for (const [s, e] of imgRanges) {
      if (s <= a && a < e && s <= b && b < e) return true;
    }
    return false;
  };

  const inText = (idx: number): boolean =>
    !imgRanges.some(([s, e]) => s <= idx && idx < e) &&
    tokens[idx] !== SEP_OPEN &&
    tokens[idx] !== SEP_CLOSE;

  const mask: number[][] = [];
  for (let r = 0; r < n; r++) mask.push(new Array<number>(n).fill(0));
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (inText(a) && inText(b) && b <= a) {
        mask[a][b] = 1;
      } else if (!inText(a) && !inText(b) && sameImg(a, b)) {
        mask[a][b] = 1;
      } else if (inText(a) && !inText(b) && b <= a) {
        mask[a][b] = 1;
      } else if (!inText(a) && inText(b) && b <= a) {
        mask[a][b] = 1;
      }
    }
  }
  return mask;
}

function mse(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] - b[i]) ** 2;
  return s / Math.max(1, a.length);
}

function crossEntropyToy(prob: number): number {
  return -Math.log(Math.max(prob, 1e-6));
}

function twoLossStep(pair: Pair, weights: Weights): { text_loss: number; img_loss: number; total: number } {
  const textProbs = pair.caption.map(() => 0.3 + 0.05 * weights.text_scale);
  const textLoss = textProbs.reduce((s, p) => s + crossEntropyToy(p), 0) / textProbs.length;

  const noise: number[][] = [];
  for (let r = 0; r < IMG_PATCH_DIM; r++) {
    const row: number[] = [];
    for (let c = 0; c < IMG_PATCH_DIM; c++) row.push(gauss(0, 1));
    noise.push(row);
  }
  const t = rng();
  const xt = pair.image.map((rowX, r) => rowX.map((x, c) => (1 - t) * x + t * noise[r][c]));
  const predictedVel = pair.image.map((rowX, r) =>
    rowX.map((x, c) => (noise[r][c] - x) * (0.8 + 0.02 * weights.img_scale)),
  );
  const targetVel = pair.image.map((rowX, r) => rowX.map((x, c) => noise[r][c] - x));
  const predFlat = predictedVel.flat();
  const tgtFlat = targetVel.flat();
  const imgLoss = mse(predFlat, tgtFlat);

  const total = weights.text_w * textLoss + weights.img_w * imgLoss;
  return { text_loss: textLoss, img_loss: imgLoss, total };
}

function train(pairs: Pair[], steps = 10): void {
  const weights: Weights = { text_scale: 0, img_scale: 0, text_w: 1.0, img_w: 0.1 };
  for (let step = 0; step < steps; step++) {
    const pair = choice(pairs);
    const losses = twoLossStep(pair, weights);
    weights.text_scale += 1;
    weights.img_scale += 1;
    if (step % 2 === 0) {
      console.log(
        `  step ${String(step).padStart(2)}  text_loss=${losses.text_loss.toFixed(3)}` +
          `  img_loss=${losses.img_loss.toFixed(3)}` +
          `  total=${losses.total.toFixed(3)}`,
      );
    }
  }
}

function tokRepr(t: Tok): string {
  return typeof t === "string" ? `'${t}'` : String(t);
}

function demoMask(): void {
  console.log("\nBLOCK-TRIANGULAR MASK for sequence:");
  const tokens: Tok[] = [10, 11, SEP_OPEN, "p0", "p1", "p2", "p3", SEP_CLOSE, 12, 13];
  console.log(`  tokens: [${tokens.map(tokRepr).join(", ")}]`);
  const mask = buildMask(tokens);
  console.log("\n  attention (1=attend, .=mask):");
  mask.forEach((row, i) => {
    console.log(`    ${String(i).padStart(2)} | ` + row.map((v) => (v ? "1" : ".")).join(" "));
  });
}

function main(): void {
  console.log("=".repeat(60));
  console.log("TRANSFUSION TOY (Phase 12, Lesson 13)");
  console.log("=".repeat(60));

  demoMask();

  console.log("\n" + "=".repeat(60));
  console.log("TWO-LOSS TRAINING (NTP on text + flow-matching on images)");
  console.log("-".repeat(60));
  const pairs = makeDataset(24);
  train(pairs, 10);

  console.log("\n" + "=".repeat(60));
  console.log("TRANSFUSION vs MMDiT vs CHAMELEON");
  console.log("-".repeat(60));
  console.log("  Chameleon  : discrete image tokens + NTP only");
  console.log("  Transfusion: continuous image patches + NTP (text) + flow (image)");
  console.log("  MMDiT (SD3): Transfusion siblings, modality-specific block weights");
  console.log("  Show-o     : NTP (text) + masked discrete diffusion (image)");
}

main();
