// Lesson: LLaVA-OneVision: Single-Image, Multi-Image, Video in One Model (phase 12 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/08-llava-onevision-single-multi-video/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/08-llava-onevision-single-multi-video/code/main.ts

export {};

type Plan = Record<string, string | number>;

class Budget {
  constructor(
    public singleImageTokens: number,
    public multiImageTokens: number,
    public videoTokens: number,
  ) {}

  max(): number {
    return Math.max(this.singleImageTokens, this.multiImageTokens, this.videoTokens);
  }

  min(): number {
    return Math.min(this.singleImageTokens, this.multiImageTokens, this.videoTokens);
  }
}

function anyresTokens(tiles: number, perTile: number): number {
  return (tiles + 1) * perTile;
}

function perTileTokens(resolution: number, patch: number, pool: number): number {
  const g = Math.floor(resolution / patch);
  const pooled = Math.floor(g / pool);
  return pooled * pooled;
}

function planSingleImage(budget: number): Plan {
  for (const tiles of [9, 4, 1]) {
    for (const [res, patch, pool] of [
      [384, 14, 2],
      [384, 14, 1],
      [336, 14, 2],
    ]) {
      const per = perTileTokens(res, patch, pool);
      const total = anyresTokens(tiles, per);
      if (total <= budget) {
        return {
          scenario: "single-image",
          tiles,
          tile_res: res,
          pool,
          per_tile: per,
          total,
        };
      }
    }
  }
  return { scenario: "single-image", tiles: 1, per_tile: 81, total: 162 };
}

function planMultiImage(budget: number): Plan {
  for (const nImages of [8, 6, 4, 2]) {
    for (const [res, pool] of [
      [384, 2],
      [384, 1],
      [336, 2],
    ]) {
      const per = perTileTokens(res, 14, pool);
      const total = nImages * per;
      if (total <= budget) {
        return {
          scenario: "multi-image",
          n_images: nImages,
          resolution: res,
          pool,
          per_image: per,
          total,
        };
      }
    }
  }
  return { scenario: "multi-image", n_images: 2, per_image: 81, total: 162 };
}

function planVideo(budget: number): Plan {
  for (const nFrames of [32, 16, 8]) {
    for (const [res, pool] of [
      [384, 3],
      [384, 2],
      [336, 2],
    ]) {
      const per = perTileTokens(res, 14, pool);
      const total = nFrames * per;
      if (total <= budget) {
        return {
          scenario: "video",
          n_frames: nFrames,
          resolution: res,
          pool,
          per_frame: per,
          total,
        };
      }
    }
  }
  return { scenario: "video", n_frames: 8, per_frame: 64, total: 512 };
}

function printPlan(plan: Plan, budget: number): void {
  const total = Number(plan["total"]);
  const pct = (100 * total) / budget;
  console.log(
    `\n${String(plan["scenario"]).toUpperCase().padEnd(12)} budget target ${String(budget).padStart(5)}, ` +
      `used ${String(total).padStart(5)}  (${pct.toFixed(1).padStart(5)}%)`,
  );
  for (const [k, v] of Object.entries(plan)) {
    if (k === "scenario" || k === "total") continue;
    console.log(`    ${k.padEnd(12)}: ${v}`);
  }
}

function curriculumStages(mix: Record<string, number>): void {
  console.log("\nCURRICULUM SCHEDULE (three-stage)");
  console.log("-".repeat(60));
  const stages: [string, number, number, number, string][] = [
    ["Stage SI  ", 1.0, 0.0, 0.0, "single-image only, AnyRes high-res"],
    ["Stage OV  ", 0.5, 0.3, 0.2, "OneVision mix, unified budget"],
    ["Stage TT  ", mix["single"], mix["multi"], mix["video"], "target-task fine-tune"],
  ];
  console.log(
    `${"stage".padEnd(12)}${"single".padStart(8)}${"multi".padStart(8)}${"video".padStart(8)}   notes`,
  );
  for (const [name, s, m, v, note] of stages) {
    console.log(
      `${name.padEnd(12)}${s.toFixed(2).padStart(8)}${m.toFixed(2).padStart(8)}${v.toFixed(2).padStart(8)}   ${note}`,
    );
  }
  console.log(
    "\nordering matters: stages in reverse (video first) underperform by " +
      "2-4 MMMU per LLaVA-OneVision ablation.",
  );
}

function main(): void {
  console.log("=".repeat(60));
  console.log("LLAVA-ONEVISION TOKEN BUDGET + CURRICULUM (Phase 12, Lesson 08)");
  console.log("=".repeat(60));

  const budget = 4096;

  const si = planSingleImage(budget);
  const mi = planMultiImage(budget);
  const vi = planVideo(budget);

  console.log(`\nshared per-sample visual token budget: ${budget}`);
  for (const p of [si, mi, vi]) printPlan(p, budget);

  const totals = [si, mi, vi].map((p) => Number(p["total"]));
  const spread = Math.max(...totals) - Math.min(...totals);
  console.log(
    `\nbudget spread across scenarios: ${spread} tokens (${((100 * spread) / budget).toFixed(1)}% of budget)`,
  );
  console.log("LLaVA-OneVision target: keep spread under 30% for predictable LLM cost.");

  const mix = { single: 0.4, multi: 0.3, video: 0.3 };
  curriculumStages(mix);

  console.log("\nEMERGENT CAPABILITIES (reported in LLaVA-OneVision Sec 4.3)");
  console.log("-".repeat(60));
  console.log("  multi-camera reasoning  : multi-image + video curriculum combine");
  console.log("  set-of-mark prompting   : spatial grounding + multi-image ref");
  console.log("  iPhone-screenshot agent : UI screenshots + video workflows transfer");
  console.log("  none of the three appears in stage-SI data; curriculum unlocks them.");
}

main();
