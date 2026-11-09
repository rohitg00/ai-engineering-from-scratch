// Lesson: Embodied VLAs: RT-2, OpenVLA, π0, GR00T (phase 12 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/code/main.ts

export {};

function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function round3List(xs: number[]): string {
  return "[" + xs.map((x) => pyFloat(Number(x.toFixed(3)))).join(", ") + "]";
}

function discretize(action: number[], bins = 256): number[] {
  const tokens: number[] = [];
  for (const a of action) {
    let idx = Math.trunc(((a + 1) / 2) * (bins - 1));
    idx = Math.max(0, Math.min(bins - 1, idx));
    tokens.push(idx);
  }
  return tokens;
}

function undiscretize(tokens: number[], bins = 256): number[] {
  return tokens.map((t) => (2 * t) / (bins - 1) - 1);
}

function dct(x: number[]): number[] {
  const n = x.length;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    let s = 0.0;
    for (let i = 0; i < n; i++) s += x[i] * Math.cos((Math.PI / n) * (i + 0.5) * k);
    out.push(s);
  }
  return out;
}

function fastCompress(trajectory: number[][], keepCoeff = 4, bins = 32): number[] {
  if (trajectory.length === 0) return [];
  const D = trajectory[0].length;
  const tokens: number[] = [];
  for (let d = 0; d < D; d++) {
    const series = trajectory.map((step) => step[d]);
    const coeffs = dct(series).slice(0, keepCoeff);
    for (const c of coeffs) {
      const cNorm = Math.max(-1.0, Math.min(1.0, c / series.length));
      const idx = Math.trunc(((cNorm + 1) / 2) * (bins - 1));
      tokens.push(idx);
    }
  }
  return tokens;
}

function compareFormats(): void {
  const T = 30;
  const D = 10;
  const trajectory: number[][] = [];
  for (let t = 0; t < T; t++) {
    const row: number[] = [];
    for (let d = 0; d < D; d++) row.push(Math.sin(0.1 * t + 0.3 * d));
    trajectory.push(row);
  }

  console.log("\nACTION TOKEN COUNTS (30-step trajectory, 10-DOF)");
  console.log("-".repeat(60));
  const perStepDiscrete = discretize(trajectory[0]).length;
  const totalDiscrete = perStepDiscrete * T;
  const fastTokens = fastCompress(trajectory, 4);
  const totalFast = fastTokens.length;
  const continuousFlowCount = 1;
  const rows: [string, number, string][] = [
    ["discrete 256-bin (RT-2)", totalDiscrete, "per-step autoregressive"],
    ["FAST 4-coeff per dim", totalFast, "sequence compressor"],
    ["flow-matching (pi0)", continuousFlowCount, "single head output"],
  ];
  for (const [name, count, note] of rows) {
    console.log(`  ${name.padEnd(28)}  ${String(count).padStart(6)} tokens   (${note})`);
  }
  console.log(`\n  speedup: FAST ~${(totalDiscrete / totalFast).toFixed(1)}x vs discrete bin`);
}

function roundTripDemo(): void {
  console.log("\nROUND-TRIP: 10-DOF action through discretize + undiscretize");
  console.log("-".repeat(60));
  const action = [0.1, -0.5, 0.25, -0.75, 0.9, -0.1, 0.0, 0.33, -0.67, 0.5];
  const tokens = discretize(action, 256);
  const recovered = undiscretize(tokens, 256);
  console.log(`  original  : ${round3List(action)}`);
  console.log(`  tokens    : [${tokens.join(", ")}]`);
  console.log(`  recovered : ${round3List(recovered)}`);
  let maxErr = -Infinity;
  for (let i = 0; i < action.length; i++) maxErr = Math.max(maxErr, Math.abs(action[i] - recovered[i]));
  console.log(`  max abs error: ${maxErr.toFixed(4)}  (bin width = 2/255 ~ 0.0078)`);
}

function lineageTable(): void {
  console.log("\nVLA LINEAGE");
  console.log("-".repeat(60));
  const rows: [string, string, string, string][] = [
    ["RT-2", "2023", "PaLM-X + discrete bin", "closed"],
    ["OpenVLA", "2024", "Llama 7B + discrete bin", "open"],
    ["Octo", "2024", "small diffusion head", "open"],
    ["pi0", "2024", "flow-matching head", "open"],
    ["pi0-FAST", "2025", "flow + FAST tokenizer", "open"],
    ["GR00T N1", "2025", "dual-system humanoid", "open"],
    ["GR00T N1.7", "2025", "sim-to-real data scale", "open"],
  ];
  console.log(`  ${"model".padEnd(12)}${"year".padEnd(6)}${"pattern".padEnd(28)}open/closed`);
  for (const r of rows) console.log(`  ${r[0].padEnd(12)}${r[1].padEnd(6)}${r[2].padEnd(28)}${r[3]}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("EMBODIED VLAS (Phase 12, Lesson 21)");
  console.log("=".repeat(60));

  roundTripDemo();
  compareFormats();
  lineageTable();

  console.log("\nCO-FINE-TUNING RATIO (web VQA : robot trajectories)");
  console.log("-".repeat(60));
  console.log("  RT-2       : ~1:1");
  console.log("  OpenVLA    : ~0.5:1 web-to-robot");
  console.log("  pi0        : similar balance");
  console.log("  too much VQA -> forgets actions; too much robot -> loses language");
}

main();
