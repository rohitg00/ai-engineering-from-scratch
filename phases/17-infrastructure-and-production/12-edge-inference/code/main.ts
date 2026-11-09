// Lesson: Edge Inference: Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson (phase 17 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/12-edge-inference/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

const rj = (s: string | number, w: number): string => String(s).padStart(w);
const lj = (s: string, w: number): string => s.padEnd(w);

interface Target {
  name: string;
  bandwidthGbS: number;
  observedToksPerSLlama8bQ4: number | null;
  notes: string;
}

function target(name: string, bandwidthGbS: number, observed: number | null, notes: string): Target {
  return { name, bandwidthGbS, observedToksPerSLlama8bQ4: observed, notes };
}

const TARGETS: Target[] = [
  target("Datacenter H100 HBM3", 3350, 170, "reference ceiling"),
  target("Jetson AGX Orin", 205, 45, "edge-datacenter bridge"),
  target("Apple M3 Max", 400, 55, "unified memory MPS"),
  target("Apple M4 (MacBook Air)", 120, 25, "consumer laptop"),
  target("Apple A18 (iPhone 16)", 60, 8, "phone with ANE"),
  target("Snapdragon 8 Gen 3", 77, 7, "mid/high Android"),
  target("Snapdragon X Elite", 135, 22, "Windows ARM laptop"),
  target("WebGPU on M3 Max", 400, 41, "browser penalty ~25%"),
  target("WebGPU on Pixel 9", 77, 6, "mobile browser Chrome 121+"),
];

function ceiling(t: Target, modelGb: number): number {
  const secondsPerToken = modelGb / t.bandwidthGbS;
  return 1 / secondsPerToken;
}

function efficiency(observed: number | null, ceilingVal: number): string {
  if (observed === null) return "    -";
  return `${rj(fixed((observed / ceilingVal) * 100, 0), 4)}%`;
}

function main(): void {
  const modelName = "Llama 3.1 8B Q4";
  const modelGb = 4.7;
  console.log("=".repeat(95));
  console.log(`EDGE DECODE CEILING: ${modelName} (${fixed(modelGb, 1)} GB in HBM/DRAM)`);
  console.log("=".repeat(95));
  const header = `${lj("Target", 26)}  ${rj("BW (GB/s)", 9)}  ${rj("ceiling (tok/s)", 16)}  ${rj("observed", 10)}  ${rj("efficiency", 11)}  Notes`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const t of TARGETS) {
    const c = ceiling(t, modelGb);
    const obs = t.observedToksPerSLlama8bQ4;
    const eff = efficiency(obs, c);
    const obsDisplay = obs !== null ? `${rj(fixed(obs, 0), 8)}  ` : `${rj("-", 10)}  `;
    console.log(`${lj(t.name, 26)}  ${rj(fixed(t.bandwidthGbS, 0), 8)}   ${rj(fixed(c, 1), 15)}   ${obsDisplay}${rj(eff, 11)}  ${t.notes}`);
  }

  console.log();
  console.log("Read: bandwidth sets the ceiling. Compute matters only when runtime is inefficient.");
  console.log();
  console.log("=".repeat(95));
  console.log("QUANTIZATION IMPACT: same target, different format");
  console.log("=".repeat(95));
  const iphoneBw = 60.0;
  const formats: [string, number][] = [
    ["BF16", 18.8],
    ["INT8", 9.4],
    ["Q4 GGUF", 4.7],
    ["Q3 GGUF", 3.6],
  ];
  for (const [name, size] of formats) {
    const c = 1 / (size / iphoneBw);
    console.log(`iPhone 16 + ${lj(name, 8)}  model=${rj(fixed(size, 1), 5)} GB  ceiling=${rj(fixed(c, 1), 6)} tok/s`);
  }
}

main();
