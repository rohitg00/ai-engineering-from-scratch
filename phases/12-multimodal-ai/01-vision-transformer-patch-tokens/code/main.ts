// Lesson: Vision Transformers and the Patch-Token Primitive (phase 12 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/01-vision-transformer-patch-tokens/code/main.ts

export {};

interface ViTConfig {
  name: string;
  imageSize: number;
  patchSize: number;
  hidden: number;
  depth: number;
  heads: number;
  registers: number;
  clsToken: boolean;
}

function vit(
  name: string,
  imageSize: number,
  patchSize: number,
  hidden: number,
  depth: number,
  heads: number,
  registers = 0,
  clsToken = true,
): ViTConfig {
  return { name, imageSize, patchSize, hidden, depth, heads, registers, clsToken };
}

const ZOO: ViTConfig[] = [
  vit("ViT-B/16 @ 224", 224, 16, 768, 12, 12),
  vit("ViT-L/14 @ 336 (CLIP)", 336, 14, 1024, 24, 16),
  vit("DINOv2 ViT-g/14 @ 224", 224, 14, 1536, 40, 24, 4),
  vit("SigLIP SO400m/14 @ 378", 378, 14, 1152, 27, 16, 4, false),
  vit("Qwen2.5-VL ViT @ 896x896", 896, 14, 1280, 32, 16),
];

function gridShape(imageSize: number, patchSize: number): [number, number] {
  if (imageSize <= 0 || patchSize <= 0) {
    throw new Error(
      `image_size and patch_size must be positive, got image_size=${imageSize} patch_size=${patchSize}`,
    );
  }
  if (imageSize % patchSize !== 0) {
    throw new Error(`image_size (${imageSize}) must be divisible by patch_size (${patchSize})`);
  }
  const g = Math.floor(imageSize / patchSize);
  return [g, g];
}

function seqLength(cfg: ViTConfig): number {
  const [h, w] = gridShape(cfg.imageSize, cfg.patchSize);
  const extra = (cfg.clsToken ? 1 : 0) + cfg.registers;
  return h * w + extra;
}

function patchEmbedParams(cfg: ViTConfig): number {
  const p = cfg.patchSize;
  return 3 * p * p * cfg.hidden + cfg.hidden;
}

function posEmbedParams(cfg: ViTConfig): number {
  return seqLength(cfg) * cfg.hidden;
}

function clsRegisterParams(cfg: ViTConfig): number {
  const n = (cfg.clsToken ? 1 : 0) + cfg.registers;
  return n * cfg.hidden;
}

function blockParams(cfg: ViTConfig): number {
  const d = cfg.hidden;
  const qkvo = 4 * d * d + 4 * d;
  const mlp = 2 * d * 4 * d + d + 4 * d;
  const ln = 2 * 2 * d;
  return qkvo + mlp + ln;
}

function totalParams(cfg: ViTConfig): Record<string, number> {
  const pe = patchEmbedParams(cfg);
  const po = posEmbedParams(cfg);
  const cr = clsRegisterParams(cfg);
  const bl = blockParams(cfg) * cfg.depth;
  const fl = 2 * cfg.hidden;
  const total = pe + po + cr + bl + fl;
  return { patch_embed: pe, position: po, "cls+reg": cr, blocks: bl, final_ln: fl, total };
}

function flopsPerForward(cfg: ViTConfig): number {
  const n = seqLength(cfg);
  const d = cfg.hidden;
  const attn = 4 * n * d * d + 2 * n * n * d;
  const mlp = 2 * n * d * 4 * d * 2;
  return cfg.depth * (attn + mlp);
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function list(xs: number[]): string {
  return "[" + xs.join(", ") + "]";
}

function patchToyImage(): void {
  console.log("\nToy image patch tokenization (8x8 grayscale, patch_size=4)");
  console.log("-".repeat(60));
  const img: number[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: number[] = [];
    for (let c = 0; c < 8; c++) row.push((r * 8 + c) % 256);
    img.push(row);
  }
  console.log("pixel grid (row 0..7):");
  for (const row of img) {
    console.log("  " + row.map((v) => String(v).padStart(3)).join(" "));
  }

  const P = 4;
  const patches: number[][] = [];
  for (let pr = 0; pr < 8; pr += P) {
    for (let pc = 0; pc < 8; pc += P) {
      const patch: number[] = [];
      for (let dr = 0; dr < P; dr++) {
        for (let dc = 0; dc < P; dc++) patch.push(img[pr + dr][pc + dc]);
      }
      patches.push(patch);
    }
  }

  console.log(`\npatches (${patches.length} total, each length ${P * P}):`);
  patches.forEach((p, i) => console.log(`  patch ${i}: ${list(p)}`));

  const fakeW: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const row: number[] = [];
    for (let j = 0; j < P * P; j++) row.push(((i + j) % 5) - 2);
    fakeW.push(row);
  }
  const embeddings: number[][] = [];
  for (const patch of patches) {
    const emb: number[] = [];
    for (const row of fakeW) {
      if (row.length !== patch.length) throw new Error("zip() arguments have different lengths");
      let s = 0;
      for (let k = 0; k < row.length; k++) s += row[k] * patch[k];
      emb.push(s);
    }
    embeddings.push(emb);
  }

  console.log("\nlinear projection (P*P=16 -> hidden=4):");
  embeddings.forEach((emb, i) => console.log(`  token ${i}: ${list(emb)}`));
  console.log("→ 4 tokens of dim 4 ready for the transformer.");
}

function printConfig(cfg: ViTConfig): void {
  const params = totalParams(cfg);
  const seq = seqLength(cfg);
  const [gh, gw] = gridShape(cfg.imageSize, cfg.patchSize);
  const fl = flopsPerForward(cfg);
  console.log(`\n${cfg.name}`);
  console.log("-".repeat(60));
  console.log(`  image            : ${cfg.imageSize}x${cfg.imageSize}`);
  console.log(`  patch size       : ${cfg.patchSize}`);
  console.log(`  grid             : ${gh}x${gw}`);
  console.log(
    `  seq length       : ${seq} (incl ${cfg.clsToken ? "CLS" : "no CLS"}, ${cfg.registers} registers)`,
  );
  console.log(`  hidden / depth   : ${cfg.hidden} / ${cfg.depth}`);
  console.log(`  patch embed      : ${fmt(params["patch_embed"])}`);
  console.log(`  position embed   : ${fmt(params["position"])}`);
  console.log(`  blocks total     : ${fmt(params["blocks"])}`);
  console.log(`  ** total params **: ${fmt(params["total"])}`);
  console.log(`  flops / forward  : ${fmt(fl)}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("VIT PATCH-TOKEN GEOMETRY CALCULATOR (Phase 12, Lesson 01)");
  console.log("=".repeat(60));

  patchToyImage();

  for (const cfg of ZOO) printConfig(cfg);

  console.log("\n" + "=".repeat(60));
  console.log("KEY RATIOS");
  console.log("-".repeat(60));
  const vitB = ZOO[0];
  const qwen = ZOO[ZOO.length - 1];
  console.log(`  ViT-B/16 @ 224    seq length: ${seqLength(vitB)}`);
  console.log(`  Qwen2.5-VL @ 896  seq length: ${seqLength(qwen)}`);
  console.log(`  ratio: ${(seqLength(qwen) / seqLength(vitB)).toFixed(1)}x more tokens`);
  console.log("  That is why high-resolution VLMs need token-merging or pooling.");
}

main();
