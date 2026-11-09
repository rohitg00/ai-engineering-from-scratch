// Lesson: Open-Weight VLM Recipes: What Actually Matters (phase 12 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/07-open-weight-vlm-recipes/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/07-open-weight-vlm-recipes/code/main.ts

export {};

interface Recipe {
  name: string;
  encoder: string;
  connector: string;
  llmB: number;
  data: string;
  resolution: string;
  mmmu: number;
  cvBench: number;
  docvqa: number;
}

function recipe(
  name: string,
  encoder: string,
  connector: string,
  llmB: number,
  data: string,
  resolution: string,
  mmmu: number,
  cvBench: number,
  docvqa: number,
): Recipe {
  return { name, encoder, connector, llmB, data, resolution, mmmu, cvBench, docvqa };
}

const RECIPES: Recipe[] = [
  recipe("LLaVA-1.5", "CLIP L/14 @336", "MLP-2", 13, "LLaVA-Inst-150k", "336", 35.3, 56.0, 55.0),
  recipe("LLaVA-NeXT", "CLIP L/14 @336", "MLP-2", 13, "LLaVA-Inst + shareGPT4V", "AnyRes 672", 36.2, 58.5, 77.4),
  recipe("Idefics2-8B", "SigLIP SO400m/14", "Perceiver-64", 7, "OBELICS + Cauldron", "980 split", 43.0, 60.0, 74.0),
  recipe("MM1-3B", "CLIP L/14", "C-Abstractor", 3, "interleaved + caption", "672", 38.6, 59.0, 62.0),
  recipe("MM1-30B", "CLIP L/14", "C-Abstractor", 30, "interleaved + caption", "672", 44.7, 64.0, 74.0),
  recipe("Molmo-7B-D", "SigLIP SO400m/14", "MLP-2", 7, "PixMo (712K human caps)", "AnyRes 672", 45.3, 65.0, 92.4),
  recipe("Molmo-72B", "SigLIP SO400m/14", "MLP-2", 72, "PixMo (712K human caps)", "AnyRes 672", 54.1, 73.0, 93.5),
  recipe("Cambrian-1-8B", "CLIP + DINOv2 + SigLIP + ConvNeXt", "SVA", 8, "Cambrian-10M", "672", 42.7, 67.8, 77.8),
  recipe("Prismatic-7B default", "SigLIP SO400m/14", "MLP-2", 7, "LLaVA-Inst + shareGPT4V", "336", 40.0, 58.0, 70.0),
];

function axisImpact(): void {
  console.log("\nAXIS-IMPACT DECOMPOSITION (Prismatic VLMs controlled comparison)");
  console.log("-".repeat(60));
  const axes: [string, number, string][] = [
    ["visual-token count", 60, "64 -> 576 -> 1024 tokens; diminishing past 1024"],
    ["image encoder", 20, "CLIP vs SigLIP vs DINOv2; concatenation helps"],
    ["connector arch", 5, "MLP ~= Q-Former ~= Perceiver at same token count"],
    ["data mix", 10, "detailed human caps > distilled GPT-4V data"],
    ["LLM size", 15, "7B -> 70B plateau around MMMU 55"],
    ["resolution sched", 5, "ramp 224 -> 448 > flat 448; native wins OCR"],
  ];
  const totalWeight = axes.reduce((s, a) => s + a[1], 0);
  console.log(`${"axis".padEnd(22)}${"%var".padStart(8)}  note`);
  for (const [name, pct, note] of axes) {
    const bar = "#".repeat(Math.floor(pct / 2));
    console.log(`${name.padEnd(22)}${String(pct).padStart(6)}% ${bar}`);
    console.log(`${"".padEnd(22)}       ${note}`);
  }
  console.log(`note: weights rebased from ~${totalWeight}% to ~100% after rounding.`);
}

function compareEncoders(): void {
  console.log("\nENCODER SWAP DELTAS (fixed 7B LLM, LLaVA-Inst + shareGPT4V data)");
  console.log("-".repeat(60));
  const rows: [string, number, number, number][] = [
    ["CLIP ViT-L/14 @ 336", 38.5, 56.0, 70.0],
    ["SigLIP SO400m/14 @ 384", 41.0, 60.0, 75.0],
    ["DINOv2 ViT-g/14 @ 224", 37.0, 65.0, 52.0],
    ["SigLIP + DINOv2 concat", 42.0, 67.0, 74.0],
    ["InternViT-6B @ 448", 43.0, 66.0, 78.0],
  ];
  console.log(`${"encoder".padEnd(32)}${"MMMU".padStart(8)}${"CV-B".padStart(8)}${"DocVQA".padStart(10)}`);
  for (const [name, mmmu, cv, doc] of rows) {
    console.log(
      `${name.padEnd(32)}${mmmu.toFixed(1).padStart(8)}${cv.toFixed(1).padStart(8)}${doc.toFixed(1).padStart(10)}`,
    );
  }
  console.log(
    "deltas: SigLIP adds +2.5 MMMU over CLIP; DINOv2 wins CV-Bench; " +
      "concat beats either alone on vision-centric bench.",
  );
}

function compareData(): void {
  console.log("\nDATA-MIX DELTAS (fixed SigLIP + 7B LLM + AnyRes)");
  console.log("-".repeat(60));
  const rows: [string, number, string][] = [
    ["LLaVA-Inst-150k", 40.0, "web caps + GPT-4 dialogues"],
    ["+ ShareGPT4V", 42.0, "+ GPT-4V detailed captions"],
    ["+ Cauldron", 43.0, "+ OCR + charts + multimodal instructions"],
    ["PixMo (human caps only)", 45.3, "712K dense human captions"],
    ["PixMo + Cauldron + more", 47.0, "best data mix as of Jul 2025"],
  ];
  console.log(`${"data mix".padEnd(28)}${"MMMU".padStart(8)}  notes`);
  for (const [name, mmmu, note] of rows) {
    console.log(`${name.padEnd(28)}${mmmu.toFixed(1).padStart(8)}  ${note}`);
  }
  console.log("finding: dense human captions beat distilled captions by +2-3 MMMU");
  console.log("         at the same training token count (Molmo thesis).");
}

function printRecipes(): void {
  console.log("\nCANONICAL OPEN VLMS (ablation-reported MMMU, CV-Bench, DocVQA)");
  console.log("-".repeat(60));
  console.log(
    `${"recipe".padEnd(22)}${"LLM".padStart(6)}${"MMMU".padStart(8)}${"CV-B".padStart(8)}${"DocVQA".padStart(10)}`,
  );
  for (const r of RECIPES) {
    console.log(
      `${r.name.padEnd(22)}${String(r.llmB).padStart(5)}B${r.mmmu.toFixed(1).padStart(8)}` +
        `${r.cvBench.toFixed(1).padStart(8)}${r.docvqa.toFixed(1).padStart(10)}`,
    );
  }
}

function pickRecipe(budgetB: number, task: string): void {
  console.log(`\nPICKER: budget ${budgetB}B params, task profile: ${task}`);
  console.log("-".repeat(60));
  let weights = { mmmu: 1.0, cv: 1.0, doc: 1.0 };
  if (task === "ocr") {
    weights = { mmmu: 0.4, cv: 0.3, doc: 1.2 };
  } else if (task === "agent") {
    weights = { mmmu: 1.0, cv: 1.2, doc: 0.8 };
  } else if (task === "reasoning") {
    weights = { mmmu: 1.5, cv: 0.5, doc: 0.8 };
  }

  const score = (r: Recipe): number =>
    r.mmmu * weights.mmmu + r.cvBench * weights.cv + r.docvqa * weights.doc;

  const candidates = RECIPES.filter((r) => r.llmB <= budgetB);
  candidates.sort((a, b) => score(b) - score(a));
  for (const r of candidates.slice(0, 3)) {
    console.log(`  ${r.name.padEnd(22)} LLM ${r.llmB}B  score=${score(r).toFixed(1)}`);
    console.log(`    encoder=${r.encoder}`);
    console.log(`    data   =${r.data}`);
    console.log(`    res    =${r.resolution}`);
  }
}

function main(): void {
  console.log("=".repeat(60));
  console.log("OPEN-WEIGHT VLM RECIPE PICKER (Phase 12, Lesson 07)");
  console.log("=".repeat(60));

  printRecipes();
  axisImpact();
  compareEncoders();
  compareData();

  pickRecipe(10, "ocr");
  pickRecipe(80, "reasoning");
  pickRecipe(10, "agent");
}

main();
