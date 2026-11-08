import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const GPU = "manuals/sglang-101/capture/gpu";
const OUT = join(HERE, "data.mjs");

const SUMMARIES = { l4: "summary/l4.json", "l4-hot": "summary/l4-throttled.json", gb10: "summary/gb10.json" };
const WANTED = {
  l4: ["load.default", "load.fp8", "load.no-cuda-graph", "prefix.default", "prefix.no-radix-cache", "prefix.small-pool", "prefix.fp8-small-pool"],
  "l4-hot": ["load.default", "load.fp8", "load.no-cuda-graph"],
  gb10: ["load.default", "load.fp8", "load.no-cuda-graph", "load.default-kv-max", "load.fp8-kv-max", "prefix.default", "prefix.no-radix-cache"],
};

const median = (value) => (value && typeof value === "object" ? value.median : value);
const pointOf = (point) => {
  const out = {
    x: point.x,
    tokS: median(point.output_throughput),
    tokMin: point.output_throughput.min,
    tokMax: point.output_throughput.max,
    ttft: median(point.median_ttft_ms),
    p99ttft: median(point.p99_ttft_ms),
    tpot: median(point.median_tpot_ms),
    p99tpot: median(point.p99_tpot_ms),
    goodput: median(point.goodput_rps),
  };
  if (point.gpu) {
    out.smMhz = median(point.gpu.median_sm_mhz);
    out.maxTemp = point.gpu.max_temp_c;
    out.thermal = point.gpu.thermal_share;
  }
  return out;
};

function runsOf(name) {
  const file = join(ROOT, GPU, SUMMARIES[name]);
  const data = JSON.parse(readFileSync(file, "utf8"));
  const runs = {};
  for (const key of WANTED[name]) {
    const [sweep, config] = key.split(".");
    const run = data[sweep][config];
    runs[key] = { pool: run.kv_pool_tokens, points: run.points.map(pointOf) };
  }
  const env = data.environment;
  return { runs, env: { gpu: env.gpu, cc: env.compute_capability, memoryGiB: env.gpu_memory_total_gib, sglang: env.sglang, machine: env.machine, models: env.models.slice(0, 2) } };
}

function line(file, pattern) {
  const text = readFileSync(join(ROOT, GPU, file), "utf8");
  const found = text.split("\n").find((row) => pattern.test(row));
  if (!found) throw new Error(`${file}: no line matches ${pattern}`);
  return found.replace(/^\[[^\]]+\]\s*/, "").trim();
}
const number = (text, pattern) => Number(pattern.exec(text)[1]);

function weights(file, quant) {
  const text = line(file, quant ? /Load weight end.*quant=fp8/ : /Load weight end\. .*type=Qwen3/);
  return { file, line: text, gib: number(text, /mem usage=([\d.]+) GB/) };
}
function pool(file, dtype, tokens) {
  const text = line(file, new RegExp(`KV Cache is allocated\\. dtype: torch\\.${dtype}, #tokens: ${tokens ?? "\\d+"},`));
  return { file, line: text, tokens: number(text, /#tokens: (\d+)/), kGiB: number(text, /K size: ([\d.]+) GB/), vGiB: number(text, /V size: ([\d.]+) GB/) };
}
function chunk(file) {
  const text = readFileSync(join(ROOT, GPU, file), "utf8");
  return number(text, /chunked_prefill_size=(\d+)/);
}

const LOGS = {
  l4: {
    weights: { bf16: weights("out-l4/server-load-default.log", false), fp8: weights("out-l4/server-load-fp8.log", true) },
    kv: {
      bf16: pool("out-l4/server-load-default.log", "bfloat16"),
      fp8: pool("out-l4/server-load-fp8.log", "float8_e4m3fn"),
      "bf16-small": pool("out-l4/server-small-pool-bf16-fp8.log", "bfloat16"),
      "fp8-small": pool("out-l4/server-small-pool-bf16-fp8.log", "float8_e4m3fn"),
    },
    chunk: { file: "out-l4/server-default.log", tokens: chunk("out-l4/server-default.log") },
  },
  gb10: {
    weights: { bf16: weights("out-gb10/server-default.log", false), fp8: weights("out-gb10/server-fp8.log", true) },
    kv: {
      bf16: pool("out-gb10/server-default.log", "bfloat16"),
      fp8: pool("out-gb10/server-fp8.log", "float8_e4m3fn"),
      "bf16-max": pool("out-gb10/server-load-default-kv-max.log", "bfloat16"),
    },
    chunk: { file: "out-gb10/server-default.log", tokens: chunk("out-gb10/server-default.log") },
  },
};

export function extract() {
  const RUNS = {};
  const ENV = {};
  for (const name of Object.keys(SUMMARIES)) {
    const { runs, env } = runsOf(name);
    RUNS[name] = runs;
    ENV[name] = env;
  }
  const SOURCES = Object.fromEntries(Object.entries(SUMMARIES).map(([name, file]) => [name, `${GPU}/${file}`]));
  return `export const SOURCES = ${JSON.stringify(SOURCES)};\nexport const ENV = ${JSON.stringify(ENV)};\nexport const RUNS = ${JSON.stringify(RUNS)};\nexport const LOGS = ${JSON.stringify(LOGS)};\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = extract();
  if (process.argv.includes("--check")) {
    const now = readFileSync(OUT, "utf8");
    if (now !== text) {
      console.error("data.mjs is stale: run node scripts/gpu-machine/extract.mjs");
      process.exit(1);
    }
    console.log("data.mjs matches the captures");
  } else {
    writeFileSync(OUT, text);
    console.log("wrote", OUT, (text.length / 1024).toFixed(1) + " KB");
  }
}
