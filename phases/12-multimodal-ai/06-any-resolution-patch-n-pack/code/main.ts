// Lesson: Any-Resolution Vision: Patch-n'-Pack and NaFlex (phase 12 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/06-any-resolution-patch-n-pack/code/main.ts

export {};

class Image {
  constructor(
    public name: string,
    public h: number,
    public w: number,
  ) {}

  grid(p: number): [number, number] {
    return [Math.floor(this.h / p), Math.floor(this.w / p)];
  }

  seq(p: number): number {
    const [gh, gw] = this.grid(p);
    return gh * gw;
  }
}

interface PackResult {
  totalTokens: number;
  perImage: number[];
  maskNonzero: number;
  maskSize: number;
  cuSeqlens: number[];
}

function packBatch(images: Image[], patch: number): PackResult {
  const lens = images.map((img) => img.seq(patch));
  const total = lens.reduce((s, n) => s + n, 0);
  const nz = lens.reduce((s, n) => s + n * n, 0);
  const offsets = [0];
  for (const n of lens) offsets.push(offsets[offsets.length - 1] + n);
  return {
    totalTokens: total,
    perImage: lens,
    maskNonzero: nz,
    maskSize: total * total,
    cuSeqlens: offsets,
  };
}

function buildDenseMask(pack: PackResult): number[][] {
  const n = pack.totalTokens;
  const mask: number[][] = [];
  for (let i = 0; i < n; i++) mask.push(new Array<number>(n).fill(0));
  for (let b = 0; b < pack.cuSeqlens.length - 1; b++) {
    const lo = pack.cuSeqlens[b];
    const hi = pack.cuSeqlens[b + 1];
    for (let i = lo; i < hi; i++) {
      for (let j = lo; j < hi; j++) mask[i][j] = 1;
    }
  }
  return mask;
}

interface AnyresCost {
  grid: [number, number];
  tile_tokens: number;
  thumb_tokens: number;
  total: number;
}

function anyresCost(img: Image, tile = 336, thumb = 336): AnyresCost {
  const tileGrid = Math.floor(tile / 14);
  const thumbGrid = Math.floor(thumb / 14);
  let gridR = 1;
  let gridC = 1;
  if (!(img.h <= tile && img.w <= tile)) {
    let best: [number, number, number] | null = null;
    for (let gr = 1; gr < 4; gr++) {
      for (let gc = 1; gc < 4; gc++) {
        if (gr * gc > 6) continue;
        const tileH = gr * tile;
        const tileW = gc * tile;
        const ratio = img.h / img.w;
        const tileRatio = tileH / tileW;
        const score = Math.abs(ratio - tileRatio) + 0.1 * (gr + gc);
        if (best === null || score < best[0]) best = [score, gr, gc];
      }
    }
    if (best !== null) {
      gridR = best[1];
      gridC = best[2];
    }
  }
  const tileTokens = gridR * gridC * tileGrid * tileGrid;
  const thumbTokens = thumbGrid * thumbGrid;
  return {
    grid: [gridR, gridC],
    tile_tokens: tileTokens,
    thumb_tokens: thumbTokens,
    total: tileTokens + thumbTokens,
  };
}

function squareCost(_img: Image, side = 336, patch = 14): number {
  const g = Math.floor(side / patch);
  return g * g;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function demoToyPack(): void {
  console.log("\nToy batch: two images, patch 2");
  console.log("-".repeat(60));
  const imgs = [new Image("A", 6, 4), new Image("B", 4, 8)];
  for (const img of imgs) {
    const [gh, gw] = img.grid(2);
    console.log(`  ${img.name}: ${img.h}x${img.w} -> grid ${gh}x${gw} = ${img.seq(2)} tokens`);
  }
  const pack = packBatch(imgs, 2);
  console.log(`packed total length: ${pack.totalTokens}`);
  console.log(`cu_seqlens (FlashAttn varlen): [${pack.cuSeqlens.join(", ")}]`);
  console.log(
    `dense mask size: ${pack.maskSize} cells, non-zero: ${pack.maskNonzero} ` +
      `(${((pack.maskNonzero * 100) / pack.maskSize).toFixed(1)}%)`,
  );
  const mask = buildDenseMask(pack);
  console.log("\nblock-diagonal mask (1=attend, .=mask):");
  for (const row of mask) console.log("  " + row.map((v) => (v ? "1" : ".")).join(""));
}

function budgetTable(workload: Image[]): void {
  console.log("\n" + "=".repeat(72));
  console.log(
    "image".padEnd(26) +
      "native".padStart(10) +
      "square".padStart(10) +
      "anyres".padStart(14) +
      "grid".padStart(10),
  );
  console.log("-".repeat(72));
  let nativeSum = 0;
  let squareSum = 0;
  let anyresSum = 0;
  for (const img of workload) {
    const nat = img.seq(14);
    const sq = squareCost(img, 336, 14);
    const ar = anyresCost(img);
    nativeSum += nat;
    squareSum += sq;
    anyresSum += ar.total;
    const [gr, gc] = ar.grid;
    console.log(
      img.name.padEnd(26) +
        String(nat).padStart(10) +
        String(sq).padStart(10) +
        String(ar.total).padStart(14) +
        `   ${gr}x${gc}`,
    );
  }
  console.log("-".repeat(72));
  console.log(
    "TOTAL".padEnd(26) +
      String(nativeSum).padStart(10) +
      String(squareSum).padStart(10) +
      String(anyresSum).padStart(14),
  );
  console.log(
    `\nnative vs square : ${(nativeSum / squareSum).toFixed(2).padStart(6)}x tokens, preserves OCR + layout detail`,
  );
  console.log(
    `native vs anyres : ${(nativeSum / anyresSum).toFixed(2).padStart(6)}x tokens, no tile + thumbnail blow-up past ~2 tiles`,
  );
  console.log(
    `anyres vs square : ${(anyresSum / squareSum).toFixed(2).padStart(6)}x tokens, the middle ground when encoder is locked at 336`,
  );
}

function main(): void {
  console.log("=".repeat(60));
  console.log("PATCH-N-PACK FOR ANY-RESOLUTION VLMS (Phase 12, Lesson 06)");
  console.log("=".repeat(60));

  demoToyPack();

  const workload = [
    new Image("receipt 600x1500 (1:2.5)", 600, 1500),
    new Image("chart 1280x720 (16:9)", 1280, 720),
    new Image("phone screen 1170x2532", 1170, 2532),
    new Image("photo 2048x1536 (4:3)", 2048, 1536),
    new Image("receipt 504x1260 (1:2.5)", 504, 1260),
  ];
  for (const img of workload) {
    img.h -= img.h % 14;
    img.w -= img.w % 14;
  }

  budgetTable(workload);

  console.log("\n" + "=".repeat(60));
  console.log("WHEN TO USE EACH STRATEGY");
  console.log("-".repeat(60));
  console.log("  native-pack (NaViT / NaFlex / M-RoPE):");
  console.log("    multi-aspect batch, maximum fidelity, minimum tokens");
  console.log("  AnyRes (LLaVA-NeXT):");
  console.log("    encoder is frozen at 336x336, but you need detail");
  console.log("  square-resize:");
  console.log("    fast baseline, photo-only workloads, no OCR");
}

main();
