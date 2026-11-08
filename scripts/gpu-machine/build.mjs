import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../agent-machine/kit/iso-kit.mjs";
import * as ink from "../agent-machine/kit/ink.mjs";
import * as Gm from "./geometry.mjs";
import * as M from "./model.mjs";
import { ABSTRACT, SPECS } from "./hardware.mjs";
import { NAMES, PART_ORDER, SCENARIOS } from "./content.mjs";
import { W, H } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = process.argv[2] || join(ROOT, "site", "inside-an-llm-serving-gpu.html");
const ORIGIN = "https://aiengineeringfromscratch.com";
const SLUG = "inside-an-llm-serving-gpu";

const exportsOf = (source) => [...source.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
function module(file, name, replace = []) {
  let source = readFileSync(join(HERE, file), "utf8");
  for (const [from, to] of replace) source = source.replace(from, to);
  return `const ${name} = (() => {\n${source.replace(/^export /gm, "")}\nreturn { ${exportsOf(source).join(", ")} };\n})();`;
}

const RIGS = Gm.build();
const round = (value) => Math.round(value * 1000) / 1000;
const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PILL = 10.5;
const pillWidth = (text) => text.length * PILL * 0.62 + PILL * 1.6;
function placeLabels(rig) {
  const entries = rig.LABELS.map((label) => ({ label, a: k.iso(label.at, rig.P), w: pillWidth(label.text) }));
  const xs = entries.map((e) => e.a[0]);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const out = new Map();
  for (const side of ["left", "right"]) {
    const list = entries.filter((e) => (side === "left" ? e.a[0] < mid : e.a[0] >= mid)).sort((p, q) => p.a[1] - q.a[1]);
    let floor = side === "left" ? 150 : 14;
    const limit = side === "left" ? H - 14 : 280;
    list.forEach((e, i) => {
      const y = Math.min(limit - (list.length - 1 - i) * 24, Math.max(floor, e.a[1] - 40));
      floor = y + 24;
      const x = side === "left" ? 6 + e.w / 2 : W - 6 - e.w / 2;
      out.set(e.label.id, { x, y });
    });
  }
  return rig.LABELS.map((label) => {
    const [ax, ay] = k.iso(label.at, rig.P);
    const { x, y } = label.to ? { x: label.to[0], y: label.to[1] } : out.get(label.id);
    return { id: label.id, text: label.text, stations: label.stations, asm: label.asm, at: label.at, dx: Math.round(x - ax), dy: Math.round(y - ay) };
  });
}

const rigData = {};
let layers = "";
for (const [name, rig] of Object.entries(RIGS)) {
  const items = rig.items.map((item) => ({ id: item.id, asm: item.asm, key: round(item.key) }));
  rigData[name] = { items, EXPLODE: rig.EXPLODE, ASSEMBLIES: rig.ASSEMBLIES, LABELS: placeLabels(rig), WAYPOINTS: rig.WAYPOINTS, FLOWS: rig.FLOWS, LAUNCH: rig.LAUNCH, HOT: rig.HOT, P: rig.P, V: rig.V, CHIPS: rig.CHIPS, SM_COUNT: rig.SM_COUNT };
  const sorted = rig.items.slice().sort((a, b) => a.key - b.key);
  layers += `<g data-rig="${name}"${name === "l4" ? "" : ' style="display:none"'}><g data-layer filter="url(#gm-hand)">${sorted.map((item) => `<g data-i="${item.id}" data-asm="${item.asm}">${item.svg}</g>`).join("")}</g></g>`;
}

const LABEL = "An NVIDIA GPU that serves a language model, drawn in isometric view from its published parts. The L4 view shows a host board with a network port, a host CPU and a PCIe Gen4 x16 riser, and the L4 card with its AD104 die of 58 SMs, a 48 MB L2 band, six GDDR6 packages, the substrate, the solder balls and a see-through passive heatsink. The GB10 view shows one board with a network port, the GB10 package with a CPU dielet of 20 Arm cores and a GPU dielet joined by NVLink-C2C, eight LPDDR5X packages and a see-through cooler. Colored cells on the memory packages show the weights, the KV pool and this request.";
const FILTER = ink.wobbleFilter("gm-hand", 1.6);
const GAUGE = `<g class="gauge" data-gauge transform="translate(6 4)"><rect class="gauge-bg" x="0" y="0" width="140" height="132" rx="3"/><text class="gauge-title" x="70" y="17" text-anchor="middle">MEMORY READ</text><path class="gauge-arc" d="M20 92A50 50 0 0 1 120 92"/><path class="gauge-fill" data-gauge-fill d=""/><line class="gauge-needle" data-gauge-needle x1="70" y1="92" x2="26" y2="92"/><circle class="gauge-hub" cx="70" cy="92" r="4"/><text class="gauge-value" data-gauge-value x="70" y="115" text-anchor="middle">idle</text><text class="gauge-peak" data-gauge-peak x="70" y="127" text-anchor="middle">of 300 GB/s peak</text></g>`;
const cutWeights = Array.from({ length: 13 }, (_, i) => `<rect class="cut-cell" data-cw data-c="w" x="${8 + i * 12.4}" y="34" width="10.6" height="10" rx="1"/>`).join("");
const cutKv = Array.from({ length: 26 }, (_, i) => `<rect class="cut-cell" data-ck data-c="free" x="${8 + (i % 13) * 12.4}" y="${70 + Math.floor(i / 13) * 12}" width="10.6" height="10" rx="1"/>`).join("");
const CUT = `<path class="cut-lead" data-clead d=""/><g class="cut" data-cut transform="translate(762 300)"><rect class="cut-bg" x="0" y="0" width="232" height="122" rx="3"/><text class="cut-title" x="8" y="14">CUT WINDOW · INSIDE THE MEMORY</text><text class="cut-cap" x="8" y="30">weights</text>${cutWeights}<text class="cut-cap" x="8" y="66">KV pool</text>${cutKv}<rect class="cut-sm" data-csm x="186" y="30" width="38" height="56" rx="2"/><text class="cut-smtext" x="205" y="62" text-anchor="middle">SMs</text><path class="cut-arrow" d="M170 39H184M205 86V100H172M172 100L178 96M172 100L178 104M184 39L179 35M184 39L179 43"/><text class="cut-tok" data-ctok x="8" y="114"></text></g><text class="sound" data-sound></text>`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: `${FILTER}${layers}${CUT}${GAUGE}<g data-pills></g>`, className: "gm-svg" }).replace("<svg ", "<svg data-gm-svg ");

const PALETTES = { green: ["#6fbf7c", "#4a9a5a", "#163a22"], blue: ["#6f9fd8", "#4a78b8", "#142a4a"], black: ["#6a6e76", "#45484f", "#141518"], red: ["#e07a6a", "#c0503f", "#4a1a12"], purple: ["#a98bd6", "#8461b8", "#2e1a48"] };
const STATIONS = ["ingress", "tokenizer", "scheduler", "detok", "link", "sms", "weights", "pool"];
const specRows = (gpu) => {
  const s = SPECS[gpu];
  const rows = gpu === "l4"
    ? [["Die", s.architecture], ["SMs", s.sms, `${s.gpcs.value} GPCs, ${s.tpcs.value} TPCs`], ["Tensor Cores", s.tensorCores, `4 per SM, ${s.tensorGen.value}`], ["L2 cache", s.l2MB, "MB"], ["Memory", s.memory], ["Bus", s.busBits, "bits, 32-bit controllers"], ["Bandwidth", s.bandwidthGBs, "GB/s peak"], ["Host link", s.interconnect], ["Power", s.tdpW, "W, passive cooling"], ["Clocks", s.clocksMHz, "MHz"]]
    : [["Chip", s.architecture], ["CPU", s.cpu], ["GPU", s.cudaCores, `CUDA cores, ${s.tensorGen.value} Tensor Cores; SM count not published`], ["GPU L2", s.l2MB, "MB"], ["CPU caches", s.cpuL3MB, `MB L3, plus a ${s.slcMB.value} MB system level cache`], ["Memory", s.memory], ["Bus", s.busBits, `bits, ${s.channels.value} channels`], ["Bandwidth", s.bandwidthGBs, "GB/s peak"], ["Chip link", s.interconnect, `${s.c2cGBs.value} GB/s for the GPU`], ["Power", s.tdpW, "W for the chip"]];
  const DOCS = { l4Page: "NVIDIA L4 product page", l4Brief: "NVIDIA L4 product brief PB-11316-001", ada: "NVIDIA Ada GPU architecture whitepaper", sparkPage: "NVIDIA DGX Spark product page", sparkGuide: "NVIDIA DGX Spark user guide", gb10HotChips: "NVIDIA GB10 talk, Hot Chips 2025" };
  return rows.map(([label, entry, unit]) => `<dt>${escape(label)}</dt><dd>${escape(String(entry.value).toLocaleString("en-US"))}${unit ? ` ${escape(unit)}` : ""}<small>${escape(DOCS[entry.source])}, ${escape(entry.where)}</small></dd>`).join("");
};

const DATA = {
  rigs: rigData,
  STATIONS,
  PALETTES,
  dense: { l4: true, gb10: false },
  specs: { l4: { name: "NVIDIA L4" }, gb10: { name: "NVIDIA GB10" } },
  machine: { l4: { model: M.MACHINE.l4.model }, gb10: { model: M.MACHINE.gb10.model } },
};

const script = [
  module("../agent-machine/kit/iso-kit.mjs", "K"),
  module("../agent-machine/kit/ink.mjs", "Ink", [['import { iso, segment, slabOf, solidSvg } from "./iso-kit.mjs";', "const { iso, segment, slabOf, solidSvg } = K;"]]),
  module("content.mjs", "C"),
  module("hardware.mjs", "Hw"),
  module("data.mjs", "Dt"),
  module("model.mjs", "M", [['import { ENV, LOGS, RUNS, SOURCES } from "./data.mjs";', "const { ENV, LOGS, RUNS, SOURCES } = Dt;"], ['import { SPECS } from "./hardware.mjs";', "const { SPECS } = Hw;"]]),
  `const D = ${JSON.stringify(DATA)};`,
  readFileSync(join(HERE, "live.js"), "utf8"),
].join("\n");
const wrapped = `(() => {\n${script}\n})();`;

const TITLE = "Inside an LLM Serving GPU";
const HOOK = "Decode reads every weight for every token. Watch the bytes leave the memory chips, and see why memory bandwidth sets the speed.";
const SUB = "L4 or GB10. BF16 or FP8. Fill the pool. Break the cooling.";
const DESCRIPTION = "An interactive isometric model of an NVIDIA L4 and an NVIDIA GB10 serving a language model with SGLang: the request path through the CPU and PCIe or NVLink-C2C, the KV pool in the memory chips, prefill on the SMs and the weight stream of every decode step, with the pool sizes and speeds measured in the SGLang 101 manual.";

const parts = PART_ORDER.map((part, i) => `<button type="button" class="gm-part" data-gm-part="${part}" aria-pressed="false"><span class="gm-part-n">${String(i + 1).padStart(2, "0")}</span><strong>${escape(typeof NAMES[part] === "string" ? NAMES[part] : NAMES[part].l4.replace("PCIE GEN4 X16", "LINK"))}</strong></button>`).join("");
const scenarios = SCENARIOS.map((item) => `<button type="button" class="gm-scenario" data-gm-scenario='${escape(JSON.stringify(item.config))}'><strong>${escape(item.label)}</strong><span>${escape(item.note)}</span></button>`).join("");
const option = (value, text, on = false) => `<option value="${value}"${on ? " selected" : ""}>${escape(text)}</option>`;

const STEP = `<div class="gm-step" aria-label="One decode step">
          <div class="gm-step-bar"><i data-step-read></i><i data-step-rest></i><b data-step-cursor></b></div>
          <p data-step-text></p>
        </div>`;
const plate = k.plateHtml({
  fig: "FIG_GPU · interactive simulation",
  title: "LLM serving GPU",
  hint: "Click a part · Space runs · → steps",
  readout: "ready",
  body: `<div class="gm-stage" data-gm-stage tabindex="0" role="group" aria-label="GPU machine. Space or Enter runs or pauses. Right arrow advances one step. E explodes the machine. B breaks one part. R repairs it. Click a part to inspect it.">${svg}</div>`,
});

const legend = [["w", "weights"], ["r", "read this step"], ["kv", "pool: other requests"], ["me", "pool: this request"], ["pre", "pool: reused prefix"], ["free", "pool: free"]].map(([c, text]) => `<li><i class="gm-key" data-c="${c}"></i>${escape(text)}</li>`).join("");
const abstract = (gpu) => ABSTRACT[gpu].map((line) => `<li>${escape(line)}</li>`).join("");

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TITLE} - AI Engineering from Scratch</title>
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="description" content="${escape(DESCRIPTION)}">
  <link rel="canonical" href="${ORIGIN}/${SLUG}.html">
  <meta property="og:title" content="${TITLE} · AI Engineering from Scratch">
  <meta property="og:description" content="${escape(HOOK)}">
  <meta property="og:image" content="${ORIGIN}/og/page/${SLUG}.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${TITLE} - AI Engineering from Scratch">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ORIGIN}/og/page/${SLUG}.png">
  <meta name="twitter:image:alt" content="${TITLE} - AI Engineering from Scratch">
  <meta property="og:url" content="${ORIGIN}/${SLUG}.html">
  <meta property="og:type" content="website">
  <meta name="twitter:title" content="${TITLE} · AI Engineering from Scratch">
  <meta name="twitter:description" content="${escape(HOOK)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=VT323&family=Caveat:wght@600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=20261015a">
  <script>
    (function () {
      var root = document.documentElement;
      var stored = '';
      try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
      var asked = /[?&]theme=(light|dark)\\b/.exec(location.search);
      root.setAttribute('data-theme', asked ? asked[1] : stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      var poster = /[?&]poster(?:=([a-z0-9]))?\\b/.exec(location.search); if (poster) root.setAttribute('data-poster', poster[1] || '1');
    })();
  </script>
  <style>${k.ISO_CSS}${ink.INK_CSS}${readFileSync(join(HERE, "materials.css"), "utf8")}${readFileSync(join(HERE, "page.css"), "utf8")}</style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a>
      <nav class="header-nav">
        <a href="index.html#contents">Contents</a>
        <a href="catalog.html">Catalog</a>
        <a href="roadmap.html">Roadmap</a>
        <a href="glossary.html">Glossary</a>
        <a href="about.html">About</a>
        <a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github">GitHub <span class="star-count" data-loading="true" aria-label="GitHub stars">…</span></a>
      </nav>
      <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button>
    </div>
  </header>

  <main id="main" class="gm">
    <div class="gm-screen">
    <section class="gm-hero">
      <p class="gm-eyebrow">FIG_GPU · An interactive simulation</p>
      <div class="gm-hero-row">
        <h1>${TITLE}</h1>
        <p class="gm-hook">${escape(HOOK)} <span class="gm-sub">${escape(SUB)}</span></p>
      </div>
    </section>

    <section class="gm-app" aria-label="The machine">
      <div class="gm-toolbar" role="group" aria-label="Machine controls">
        <div class="gm-buttons">
          <button type="button" class="gm-btn gm-btn--primary" data-gm-run aria-pressed="false">Run</button>
          <button type="button" class="gm-btn" data-gm-step>Step</button>
          <button type="button" class="gm-btn gm-btn--break" data-gm-break>Break</button>
          <button type="button" class="gm-btn" data-gm-repair>Repair</button>
          <button type="button" class="gm-btn" data-gm-explode aria-pressed="false">Explode</button>
          <button type="button" class="gm-btn" data-gm-reset>Reset</button>
          <div class="gm-speed" role="group" aria-label="Animation speed">
            <span>Speed</span>
            <button type="button" data-gm-speed="0.5" aria-pressed="false">½×</button>
            <button type="button" data-gm-speed="1" aria-pressed="true">1×</button>
            <button type="button" data-gm-speed="2" aria-pressed="false">2×</button>
            <button type="button" data-gm-speed="4" aria-pressed="false">4×</button>
          </div>
        </div>
        <div class="gm-switches">
          <label class="gm-select"><span>GPU</span><select id="gm-gpu">${option("l4", "NVIDIA L4", true)}${option("gb10", "NVIDIA GB10")}</select></label>
          <label class="gm-select"><span>Weights</span><select id="gm-dtype">${option("bf16", "BF16", true)}${option("fp8", "FP8")}</select></label>
          <label class="gm-select"><span>Memory fraction</span><select id="gm-frac" data-gpu="l4">${option("0.85", "0.85 (kit default)", true)}${option("0.74", "0.74 (smaller)")}</select></label>
          <label class="gm-select"><span>Workload</span><select id="gm-workload">${option("unique", "Unique prompts", true)}${option("shared", "Shared system prompt")}</select></label>
          <label class="gm-select gm-range" data-gm-users-wrap><span>Users</span><input type="range" id="gm-users" min="0" max="${M.USERS.length - 1}" step="1" value="${M.USERS.indexOf(M.DEFAULTS.users)}" aria-label="Concurrent users"><output data-gm-users-out>${M.DEFAULTS.users}</output></label>
          <label class="gm-select" data-gm-shared-wrap hidden><span>Shared tokens</span><select id="gm-shared">${M.SHARED.map((s) => option(s, s.toLocaleString("en-US"), s === M.DEFAULTS.shared)).join("")}</select></label>
          <label class="gm-switch"><input type="checkbox" id="gm-graphs" checked><span>CUDA graphs</span></label>
          <label class="gm-switch"><input type="checkbox" id="gm-radix" checked><span>Radix cache</span></label>
          <label class="gm-switch"><input type="checkbox" id="gm-clock"><span>Hot card</span></label>
        </div>
        <p class="gm-sr" data-gm-live aria-live="polite"></p>
      </div>

      <aside class="gm-left" aria-label="Steps and scenarios">
        <div class="gm-mode" role="group" aria-label="Play mode"><button type="button" data-gm-mode="manual" aria-pressed="true">Manual</button><button type="button" data-gm-mode="auto" aria-pressed="false">Auto</button></div>
        <ol class="gm-steps">${M.STEPS.map((step, i) => `<li><button type="button" class="gm-stepbtn" data-gm-stepbtn="${i}" data-status="${i ? "later" : "next"}"${i ? " disabled" : ""}><span class="gm-num">${i + 1}</span><span class="gm-stepname">${escape(step.name)}</span></button></li>`).join("")}</ol>
        <a href="#" class="gm-restart" data-gm-restart>Start over</a>
        <h2 class="gm-gap">Try to break it</h2>
        <p class="gm-muted">Each one sets the switches and runs one request again. Every number comes from a measured run.</p>
        <div class="gm-scenarios">${scenarios}</div>
        <div class="gm-look gm-look--side" role="group" aria-label="Figure style">
          <label>Hand-drawn wobble <input type="range" id="gm-wobble" min="0" max="5" step="0.1" value="1.6"></label>
          <span class="gm-swatches" role="group" aria-label="Solder mask colour">Board ${Object.keys(PALETTES).map((name) => `<button type="button" class="gm-sw" data-gm-pal="${name}" aria-label="${name}" aria-pressed="${name === "green"}"></button>`).join("")}</span>
          <label class="gm-switch"><input type="checkbox" id="gm-labels" checked><span>Labels</span></label>
        </div>
      </aside>

      <div class="gm-center">
        <p class="gm-hintbar"><span data-gm-hint>1. A question comes in through the cable.</span><span class="gm-badge" data-gm-badge title="Animation speed against the measured time">ready</span></p>
        <div class="gm-figure iso iso-ink">${plate}</div>
        <p class="gm-flash" data-gm-flash aria-live="polite"></p>
        <p class="gm-idea"><strong>The big idea</strong>Memory, not math, sets the speed of decode, and the KV pool sets how many users fit.</p>
        ${STEP}
        <p class="gm-now"><span>Now</span><strong data-gm-stage-name>Ready</strong></p>
      </div>

      <aside class="gm-right" aria-label="Run details">
        <div class="gm-readouts gm-readouts--side" aria-label="Live readouts">
          <div class="gm-readout"><span>KV pool</span><strong data-gm-pool>0</strong></div>
          <div class="gm-readout"><span>Requests</span><strong data-gm-running>0</strong></div>
          <div class="gm-readout"><span>Tokens per step</span><strong data-gm-tps>0</strong></div>
          <div class="gm-readout"><span>Weight read</span><strong data-gm-share>0</strong></div>
          <div class="gm-readout"><span>Time per token</span><strong data-gm-tpot>0</strong></div>
          <div class="gm-readout"><span>First token</span><strong data-gm-ttft>0</strong></div>
          <div class="gm-readout"><span>Output</span><strong data-gm-toks>0</strong></div>
          <div class="gm-readout"><span>Clock</span><strong data-gm-clock>0</strong></div>
        </div>
        <div class="gm-tabs" role="tablist" aria-label="Details">
          <button type="button" role="tab" id="gm-tab-run" aria-controls="gm-panel-run" aria-selected="true" data-gm-tab="run">Run</button>
          <button type="button" role="tab" id="gm-tab-memory" aria-controls="gm-panel-memory" aria-selected="false" tabindex="-1" data-gm-tab="memory">Memory</button>
          <button type="button" role="tab" id="gm-tab-inspect" aria-controls="gm-panel-inspect" aria-selected="false" tabindex="-1" data-gm-tab="inspect">Inspect</button>
          <button type="button" role="tab" id="gm-tab-trace" aria-controls="gm-panel-trace" aria-selected="false" tabindex="-1" data-gm-tab="trace">Trace</button>
          <button type="button" role="tab" id="gm-tab-specs" aria-controls="gm-panel-specs" aria-selected="false" tabindex="-1" data-gm-tab="specs">Specs</button>
        </div>
        <div class="gm-panel" id="gm-panel-run" role="tabpanel" aria-labelledby="gm-tab-run" data-gm-panel="run">
          <p class="gm-label">Machine</p>
          <p class="gm-work" data-gm-model></p>
          <p class="gm-label">Workload</p>
          <p class="gm-work" data-gm-work></p>
          <p class="gm-label">Outcome <span class="gm-status" data-gm-status data-status="served">served</span></p>
          <p class="gm-truth" data-gm-outcome></p>
          <p class="gm-muted" data-gm-measured></p>
          <p class="gm-honest">This is a simulation. The page does not run a model in your browser. The pool sizes, weight sizes, chunk sizes, step times, first-token times and throughputs are medians of three seeds from the SGLang 101 runs on one NVIDIA L4 and one NVIDIA GB10. The admission count and the weight-read share are arithmetic on those numbers and the published bandwidth. Where a setting was not measured, the page says so. The motion is paced for reading, not to scale.</p>
          <div class="gm-share">
            <button type="button" class="gm-btn" data-gm-copy>Copy link to this setup</button>
          </div>
          <a class="gm-btn gm-poster" href="anatomy/${SLUG}-poster.png" download>Download poster</a>
        </div>
        <div class="gm-panel" id="gm-panel-memory" role="tabpanel" aria-labelledby="gm-tab-memory" data-gm-panel="memory" hidden>
          <ul class="gm-legend">${legend}</ul>
          <ul class="gm-memory" data-gm-memory></ul>
          <p class="gm-muted" data-gm-memory-note></p>
        </div>
        <div class="gm-panel" id="gm-panel-inspect" role="tabpanel" aria-labelledby="gm-tab-inspect" data-gm-panel="inspect" hidden>
          <div class="gm-parts">${parts}</div>
          <div class="gm-inspect" data-gm-inspect aria-live="polite"><p class="gm-muted">Select a part of the machine, or pick one from the list, to see what it does for one request.</p></div>
        </div>
        <div class="gm-panel" id="gm-panel-trace" role="tabpanel" aria-labelledby="gm-tab-trace" data-gm-panel="trace" hidden>
          <p class="gm-muted">One line for each step of the request.</p>
          <ol class="gm-trace" data-gm-trace></ol>
        </div>
        <div class="gm-panel" id="gm-panel-specs" role="tabpanel" aria-labelledby="gm-tab-specs" data-gm-panel="specs" hidden>
          <p class="gm-label">NVIDIA L4</p>
          <dl class="gm-specs">${specRows("l4")}</dl>
          <ul class="gm-abstract">${abstract("l4")}</ul>
          <p class="gm-label">NVIDIA GB10</p>
          <dl class="gm-specs">${specRows("gb10")}</dl>
          <ul class="gm-abstract">${abstract("gb10")}</ul>
          <p class="gm-source-line">Hardware sources: the NVIDIA L4 product page and product brief, the NVIDIA Ada GPU architecture whitepaper, the NVIDIA DGX Spark product page and user guide, and the NVIDIA GB10 talk at Hot Chips 2025.</p>
        </div>
      </aside>
    </section>
    </div>

    <section class="gm-why container">
      <h2>What the machine shows</h2>
      <div class="gm-why-grid">
        <p><strong>Decode is a memory read.</strong> On the L4, one decode step of Qwen3-8B in BF16 reads 16.41 GB of weights. At the peak 300 GB/s that takes 54.7 ms, and the measured step at one user took 60.16 ms. The SMs wait for the bytes.</p>
        <p><strong>Fewer bytes, faster steps.</strong> FP8 weights are 8.81 GB on the L4. The step at one user fell to 39.66 ms, and the freed memory grew the KV pool from 24,094 to 142,369 tokens. At 64 users the output went from 250.85 to 735.91 tok/s.</p>
        <p><strong>The pool decides who runs.</strong> The scheduler admits a request only when the pool has room. At 64 users the BF16 pool holds 37 requests and the rest wait. At a memory fraction of 0.74, four 2,048-token prefixes no longer fit, and the median first token took 12.6 s, against 0.47 s at 1,024 shared tokens.</p>
        <p><strong>Launch gaps are small.</strong> Without CUDA graphs, each kernel launch crosses from the host. On the L4 that added 0.47 ms to a 60 ms step at one user. Next to the weight read, the launch path barely matters.</p>
      </div>
      <div class="gm-cta">
        <p>Measure it on your own GPU.</p>
        <a class="gm-btn gm-btn--primary" href="manual-sglang-101.html">Read the SGLang 101 manual</a>
        <a class="gm-btn" href="/lesson?path=${encodeURIComponent("phases/17-infrastructure-and-production/09-production-quantization")}">Production quantization</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© 2026 · open source · free forever</p>
      <div class="footer-links">
        <a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a>
        <a href="about.html">About</a>
        <a href="catalog.html">Catalog</a>
        <a href="glossary.html">Glossary</a>
        <a href="https://github.com/rohitg00/ai-engineering-from-scratch/issues/new/choose" target="_blank" rel="noopener">Report</a>
        <a href="sponsors.html">Sponsor us</a>
      </div>
    </div>
  </footer>
  <script>
    (function () {
      var root = document.documentElement;
      var icon = document.getElementById('themeIcon');
      var sync = function () { if (icon) icon.textContent = root.getAttribute('data-theme') === 'light' ? 'N' : 'D'; };
      sync();
      document.getElementById('themeToggle').addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (_) {}
        sync();
      });
    })();
  </script>
  <script src="header.js?v=20261103a" defer></script>
  <script>${wrapped.replace(/<\/(script)/gi, "<\\/$1")}</script>
</body>
</html>
`;

writeFileSync(OUT, html);
const count = Object.values(RIGS).map((rig) => `${rig.name} ${rig.items.length} items`).join(", ");
console.log(M.selfCheck());
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB", count);
