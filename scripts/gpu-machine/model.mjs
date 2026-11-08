import { ENV, LOGS, RUNS, SOURCES } from "./data.mjs";
import { SPECS } from "./hardware.mjs";

export const GPUS = ["l4", "gb10"];
export const DTYPES = ["bf16", "fp8"];
export const FRACTIONS = { l4: ["0.85", "0.74"], gb10: ["0.7", "0.82"] };
export const USERS = [1, 2, 4, 8, 16, 32, 64];
export const SHARED = [0, 256, 1024, 2048, 4096];
export const WORKLOADS = ["unique", "shared"];
export const CLOCKS = ["cool", "hot"];
export const DEFAULTS = { gpu: "l4", dtype: "bf16", frac: "0.85", graphs: true, workload: "unique", users: 8, shared: 2048, radix: true, clock: "cool" };

export const WORK = {
  unique: { input: 512, output: 128 },
  shared: { groups: 4, perGroup: 16, question: 128, output: 64, users: 8 },
};
export const SHOWN_STEPS = 3;
export const CELLS = { l4: { chips: 6, perChip: 48 }, gb10: { chips: 8, perChip: 48 } };
export const GIB = 2 ** 30;

export const MACHINE = {
  l4: { model: ENV.l4.models[0], dense: true, bandwidth: SPECS.l4.bandwidthGBs.value, memoryGiB: ENV.l4.memoryGiB, chunk: LOGS.l4.chunk.tokens, link: "PCIe Gen4 x16", where: "host CPU" },
  gb10: { model: ENV.gb10.models[0], dense: false, activeParams: 3e9, bandwidth: SPECS.gb10.bandwidthGBs.value, memoryGiB: ENV.gb10.memoryGiB, chunk: LOGS.gb10.chunk.tokens, link: "NVLink-C2C", where: "CPU dielet" },
};

const kvBytesOf = (entry) => Math.round(((entry.kGiB + entry.vGiB) * GIB) / entry.tokens);
export const KV_BYTES = {
  l4: { bf16: kvBytesOf(LOGS.l4.kv.bf16), fp8: kvBytesOf(LOGS.l4.kv.fp8) },
  gb10: { bf16: kvBytesOf(LOGS.gb10.kv.bf16), fp8: kvBytesOf(LOGS.gb10.kv.fp8) },
};

export const POOLS = {
  l4: {
    bf16: { "0.85": RUNS.l4["load.default"].pool, "0.74": RUNS.l4["prefix.small-pool"].pool },
    fp8: { "0.85": RUNS.l4["load.fp8"].pool, "0.74": RUNS.l4["prefix.fp8-small-pool"].pool },
  },
  gb10: {
    bf16: { "0.7": RUNS.gb10["load.default"].pool, "0.82": RUNS.gb10["load.default-kv-max"].pool },
    fp8: { "0.7": RUNS.gb10["load.fp8"].pool, "0.82": RUNS.gb10["load.fp8-kv-max"].pool },
  },
};

export function configOf(input = {}) {
  const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
  const flag = (value, fallback) => (typeof value === "boolean" ? value : fallback);
  const gpu = pick(GPUS, input.gpu, DEFAULTS.gpu);
  return {
    gpu,
    dtype: pick(DTYPES, input.dtype, DEFAULTS.dtype),
    frac: pick(FRACTIONS[gpu], typeof input.frac === "number" ? String(input.frac) : input.frac, FRACTIONS[gpu][0]),
    graphs: flag(input.graphs, DEFAULTS.graphs),
    workload: pick(WORKLOADS, input.workload, DEFAULTS.workload),
    users: pick(USERS, Number(input.users), DEFAULTS.users),
    shared: pick(SHARED, Number(input.shared), DEFAULTS.shared),
    radix: flag(input.radix, DEFAULTS.radix),
    clock: gpu === "l4" ? pick(CLOCKS, input.clock, DEFAULTS.clock) : "cool",
  };
}

export function runOf(config) {
  const c = configOf(config);
  const small = c.frac !== FRACTIONS[c.gpu][0];
  let set = c.gpu;
  let key = null;
  if (c.workload === "unique") {
    if (!c.radix) return null;
    if (c.clock === "hot") set = "l4-hot";
    if (!small && c.dtype === "bf16") key = c.graphs ? "load.default" : "load.no-cuda-graph";
    if (!small && c.dtype === "fp8" && c.graphs) key = "load.fp8";
    if (c.gpu === "gb10" && small && c.graphs) key = c.dtype === "bf16" ? "load.default-kv-max" : "load.fp8-kv-max";
  } else {
    if (c.clock === "hot" || !c.graphs) return null;
    if (!small && c.dtype === "bf16") key = c.radix ? "prefix.default" : "prefix.no-radix-cache";
    if (c.gpu === "l4" && small && c.radix) key = c.dtype === "bf16" ? "prefix.small-pool" : "prefix.fp8-small-pool";
  }
  if (!key) return null;
  const run = RUNS[set][key];
  const x = c.workload === "unique" ? c.users : c.shared;
  const point = run.points.find((p) => p.x === x) || null;
  return point ? { set, key, pool: run.pool, point } : null;
}

export function memoryOf(config, pool) {
  const c = configOf(config);
  const total = MACHINE[c.gpu].memoryGiB;
  const weights = LOGS[c.gpu].weights[c.dtype].gib;
  const kv = (pool * KV_BYTES[c.gpu][c.dtype]) / GIB;
  const rest = Math.max(0, total - weights - kv);
  const { chips, perChip } = CELLS[c.gpu];
  const cells = chips * perChip;
  const weightCells = Math.round((weights / total) * cells);
  const kvCells = Math.max(1, Math.round((kv / total) * cells));
  return { totalGiB: total, weightsGiB: weights, kvGiB: round(kv, 2), restGiB: round(rest, 2), cells, weightCells, kvCells, restCells: cells - weightCells - kvCells };
}

export function admissionOf(config, pool) {
  const c = configOf(config);
  if (c.workload === "unique") {
    const need = WORK.unique.input + WORK.unique.output;
    const fits = Math.floor(pool / need);
    const running = Math.min(c.users, fits);
    return { need, fits, running, queued: c.users - running, users: c.users, matched: 0, prefixFits: null, used: running * need, input: WORK.unique.input, output: WORK.unique.output, own: need };
  }
  const w = WORK.shared;
  const N = c.shared;
  const own = w.question + w.output;
  const prefix = w.groups * N;
  const prefixFits = N > 0 && c.radix ? prefix + w.users * own <= pool : null;
  const per = N === 0 || prefixFits ? own : N + own;
  const fits = Math.floor((pool - (prefixFits ? prefix : 0)) / per);
  const running = Math.min(w.users, fits);
  const used = (prefixFits ? prefix : 0) + running * per;
  return { need: per, fits, running, queued: w.users - running, users: w.users, matched: prefixFits ? N : 0, prefixFits, prefix, used, input: N + w.question, output: w.output, own: N + own };
}

export function decodeOf(config, pool, admission, point) {
  const c = configOf(config);
  const m = MACHINE[c.gpu];
  const avgCtx = admission.input + admission.output / 2;
  const kvGB = (admission.running * avgCtx * KV_BYTES[c.gpu][c.dtype]) / 1e9;
  const weightsGB = (LOGS[c.gpu].weights[c.dtype].gib * GIB) / 1e9;
  let readGB = null;
  let basis = "";
  if (m.dense) {
    readGB = weightsGB + kvGB;
    basis = "every weight, every step";
  } else if (c.workload === "unique" && c.users === 1) {
    readGB = (m.activeParams * (c.dtype === "bf16" ? 2 : 1)) / 1e9 + kvGB;
    basis = "estimate: about 3 billion active parameters per token";
  } else {
    basis = "not computed: each token picks its own experts, so the bytes per step were not measured";
  }
  const floorMs = readGB === null ? null : (readGB / m.bandwidth) * 1000;
  const tpot = point ? point.tpot : null;
  const share = floorMs !== null && tpot ? Math.min(1, floorMs / tpot) : null;
  const effective = readGB !== null && tpot ? readGB / (tpot / 1000) : null;
  return { tokensPerStep: admission.running, weightsGB: round(weightsGB, 2), kvGB: round(kvGB, 2), readGB: readGB === null ? null : round(readGB, 2), floorMs: floorMs === null ? null : round(floorMs, 1), tpot, share: share === null ? null : round(share, 2), effectiveGBs: effective === null ? null : Math.round(effective), basis, bandwidth: m.bandwidth };
}

export function launchOf(config) {
  const c = configOf(config);
  const on = runOf({ ...c, graphs: true });
  const off = runOf({ ...c, graphs: false });
  if (!on || !off) return null;
  return { on: on.point.tpot, off: off.point.tpot, delta: round(off.point.tpot - on.point.tpot, 2) };
}

export function simulate(input = {}) {
  const config = configOf(input);
  const m = MACHINE[config.gpu];
  const ref = runOf(config);
  const point = ref ? ref.point : null;
  const pool = ref ? ref.pool : POOLS[config.gpu][config.dtype][config.frac];
  const memory = memoryOf(config, pool);
  const adm = admissionOf(config, pool);
  const dec = decodeOf(config, pool, adm, point);
  const launch = launchOf(config);
  const shared = config.workload === "shared";
  const events = [];
  const state = { tokens: 0, poolUsed: 0, mine: 0, reused: 0, step: 0, out: 0, chunk: 0, waiting: 0, clock: null };
  const push = (type, station, trace, fields = {}) => {
    events.push({ index: events.length, type, station, trace, ...state, ...fields });
  };
  const ms = (value) => `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ms`;
  const pct = (value) => `${Math.round(value * 100)}%`;
  const others = Math.max(0, adm.running - 1);

  push("arrive", "ingress", config.gpu === "l4" ? "a request arrives at the host CPU over the network" : "a request arrives at the CPU dielet over the network", { lamp: "ok" });

  state.tokens = adm.input;
  const tokenText = shared ? `${n(adm.input)} token ids: a ${n(config.shared)}-token system prompt and a ${WORK.shared.question}-token question` : `${n(adm.input)} token ids`;
  push("tokenize", "tokenizer", `the tokenizer turns the text into ${tokenText}`, { lamp: "ok" });

  const othersUsed = shared ? (adm.prefixFits ? adm.prefix : 0) + others * adm.need : others * adm.need;
  state.poolUsed = othersUsed;
  if (shared && config.shared > 0) {
    let trace;
    let lamp = "ok";
    if (!config.radix) {
      trace = "the radix cache is off, so the scheduler matches nothing: the whole prompt is computed again";
      lamp = "bad";
    } else if (adm.prefixFits) {
      trace = `the radix tree matches ${n(adm.matched)} of ${n(adm.input)} tokens: the four system prompts (${n(adm.prefix)} tokens) stay in the pool`;
    } else {
      trace = `the four system prompts need ${n(adm.prefix)} tokens and the running requests ${n(WORK.shared.users * (WORK.shared.question + WORK.shared.output))}, more than the ${n(pool)}-token pool, so the tree evicted this prefix: 0 tokens match`;
      lamp = "bad";
    }
    push("match", "scheduler", trace, { matched: adm.matched, lamp });
  }

  if (adm.queued > 0) {
    state.waiting = adm.queued;
    state.poolUsed = adm.used;
    push("queue", "scheduler", `the pool holds ${n(adm.fits)} requests of ${n(adm.need)} tokens, so ${n(adm.running)} run and ${n(adm.queued)} wait: this request waits for a slot`, { lamp: "bad", poolFull: true });
    state.poolUsed = othersUsed;
  }
  state.waiting = 0;
  state.mine = adm.need;
  state.poolUsed = othersUsed + adm.need;
  push("admit", "scheduler", `admitted: ${n(adm.need)} tokens reserved, ${n(state.poolUsed)} of ${n(pool)} pool tokens in use (${pct(state.poolUsed / pool)}), ${plural(adm.running, "request")} running`, { lamp: adm.queued > 0 ? "bad" : "ok" });

  push("send", "link", config.gpu === "l4" ? `the ${n(adm.input)} token ids cross ${m.link} from the host to the GPU` : `the token ids stay in the shared LPDDR5X: the GPU dielet reads them through ${m.link}`, { lamp: "ok" });

  if (adm.matched > 0) {
    state.reused = adm.matched;
    push("reuse", "pool", `the ${n(adm.matched)} prefix tokens are already in the pool: the SMs do not compute them again`, { lamp: "ok" });
  }

  const prefill = adm.input - adm.matched;
  const chunks = Math.max(1, Math.ceil(prefill / m.chunk));
  for (let i = 0; i < chunks; i++) {
    const size = Math.min(m.chunk, prefill - i * m.chunk);
    state.chunk = i + 1;
    push("prefill", "sms", `prefill ${chunks > 1 ? `chunk ${i + 1} of ${chunks}` : "pass"}: ${n(size)} tokens through the tensor cores; their keys and values go to the pool`, { chunks, size, lamp: "ok" });
  }
  state.chunk = 0;

  state.out = 1;
  state.clock = point ? point.ttft : null;
  push("first", "sms", point ? `the last prefill pass gives the first token after ${ms(point.ttft)} (median, measured)` : "the last prefill pass gives the first token; this setting was not measured", { lamp: adm.queued > 0 || adm.matched < (shared ? config.shared : 0) ? "bad" : "ok" });

  const output = adm.output;
  const stepText = (k) => {
    const read = dec.readGB === null ? "the experts that the batch picked" : m.dense ? `${dec.readGB.toLocaleString("en-US")} GB` : `about ${dec.readGB.toLocaleString("en-US")} GB, an estimate,`;
    const tail = point ? `${ms(point.tpot)} per step (median, measured)` : "not measured";
    return `decode step ${k}: the SMs read ${read} through the L2 to make ${n(dec.tokensPerStep)} token${dec.tokensPerStep === 1 ? "" : "s"}, one for each running request; ${tail}`;
  };
  for (let k = 1; k <= SHOWN_STEPS; k++) {
    state.step = k;
    state.out = k + 1;
    state.clock = point ? round(point.ttft + k * point.tpot, 2) : null;
    push("decode", "weights", stepText(k), { lamp: "ok" });
  }
  state.step = output - 1;
  state.out = output;
  state.clock = point ? round(point.ttft + (output - 1) * point.tpot, 2) : null;
  push("decode-rest", "weights", `decode steps ${SHOWN_STEPS + 1} to ${output - 1}: ${m.dense ? "the same weight read" : "the same kind of step"} ${output - 1 - SHOWN_STEPS} more times`, { lamp: "ok" });

  push("detok", "detok", `the detokenizer turns ${n(output)} token ids back into text and streams it out`, { lamp: "ok" });

  const flags = [];
  if (adm.queued > 0) flags.push("queued");
  if (shared && config.shared > 0 && adm.matched === 0) flags.push("recomputed");
  if (config.clock === "hot") flags.push("throttled");
  const status = ["recomputed", "queued", "throttled"].find((flag) => flags.includes(flag)) || "served";
  const outcome = { status, flags, measured: Boolean(point), text: outcomeText(config, status, adm, pool, point) };
  state.poolUsed = othersUsed;
  state.mine = 0;
  push("exit", "ingress", `exit: ${status}${point ? `, ${point.tokS.toLocaleString("en-US")} output tok/s for ${adm.users === 1 ? "the one user" : `all ${n(adm.users)} users`}` : ", not measured"}`, { outcome, lamp: status === "served" ? "ok" : "bad" });

  const result = {
    config,
    events,
    outcome,
    run: ref ? { set: ref.set, key: ref.key } : null,
    point,
    pool,
    memory,
    admission: adm,
    decode: dec,
    launch,
    totals: { steps: events.length, chunks, prefill, pool, running: adm.running, queued: adm.queued, usage: round(adm.used / pool, 3), tokS: point ? point.tokS : null, ttft: point ? point.ttft : null, tpot: point ? point.tpot : null, share: dec.share },
  };
  result.serve = serveOf(result);
  return result;
}

export const STEPS = [
  { id: "in", name: "Prompt in", types: ["arrive"], hint: "A question comes in through the cable.", sound: "tap" },
  { id: "tokens", name: "Words to numbers", types: ["tokenize"], hint: "The computer turns the words into numbers.", sound: "tik tik" },
  { id: "room", name: "Find room", types: ["match", "queue", "admit"], hint: "The boss checks that the memory has room for this question.", sound: "click" },
  { id: "send", name: "Send to the GPU", types: ["send"], hint: "The numbers zip over to the graphics chip.", sound: "zip" },
  { id: "prefill", name: "Read the prompt", types: ["reuse", "prefill", "first"], hint: "The chip reads the whole question at once and writes notes to memory.", sound: "whirr" },
  { id: "decode", name: "Write the answer", types: ["decode", "decode-rest"], hint: "For each new word, the chip reads all of its memory again.", sound: "whoosh" },
  { id: "out", name: "Send it back", types: ["detok", "exit"], hint: "The numbers turn back into words and go home.", sound: "ding" },
];

export function stepOf(type) {
  return STEPS.findIndex((step) => step.types.includes(type));
}

export function serveOf(sim) {
  const c = sim.config;
  const p = sim.point;
  const dec = sim.decode;
  const adm = sim.admission;
  return {
    machine: c.gpu,
    model: MACHINE[c.gpu].model,
    prefillTokens: sim.totals.prefill,
    prefillChunks: sim.totals.chunks,
    decodeTokens: adm.output,
    tokensPerStep: dec.tokensPerStep,
    kvPagesUsed: adm.used,
    kvPagesTotal: sim.pool,
    kvPageTokens: 1,
    running: adm.running,
    waiting: adm.queued,
    weightReadShare: dec.share,
    computeShare: dec.share === null ? null : round(1 - dec.share, 2),
    bandwidthGBs: dec.effectiveGBs,
    peakGBs: dec.bandwidth,
    stepMs: p ? p.tpot : null,
    firstTokenMs: p ? p.ttft : null,
    tokS: p ? p.tokS : null,
    source: sim.run ? `${SUMMARY[sim.run.set]} ${sim.run.key}` : null,
  };
}

export const SUMMARY = SOURCES;

export function serve(input = {}) {
  return simulate(input).serve;
}

export function selfCheck() {
  const s = serve(DEFAULTS);
  const ok = s.kvPagesTotal === 24094 && s.model === "Qwen/Qwen3-8B" && s.source === `${SUMMARY.l4} load.default` && s.tokS === 112.62;
  return `${ok ? "self-check ok" : "self-check FAILED"}: L4 ${s.model} BF16, ${s.running} users, KV pool ${s.kvPagesTotal.toLocaleString("en-US")} tokens, ${s.kvPagesUsed.toLocaleString("en-US")} used, step ${s.stepMs} ms, weight read ${Math.round(s.weightReadShare * 100)}%, ${s.tokS} tok/s, from ${s.source}`;
}

function outcomeText(config, status, adm, pool, point) {
  const parts = [];
  if (status === "served") parts.push("Served without a wait.");
  if (adm.queued > 0) parts.push(`The pool of ${n(pool)} tokens holds ${n(adm.fits)} requests, so ${n(adm.queued)} of ${n(adm.users)} waited.`);
  if (status === "recomputed") parts.push(config.radix ? "The shared prefix did not fit in the pool, so every request computed it again." : "With the radix cache off, every request computed the shared prefix again.");
  if (config.clock === "hot") parts.push("The card was hot and slowed its clock.");
  parts.push(point ? `Measured: ${point.tokS.toLocaleString("en-US")} output tok/s, median first token ${point.ttft.toLocaleString("en-US")} ms, median ${point.tpot.toLocaleString("en-US")} ms per token.` : "This setting was not measured, so the page shows the arithmetic and no speed.");
  return parts.join(" ");
}

const n = (value) => Math.round(value).toLocaleString("en-US");
const plural = (count, one, many = one + "s") => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

function round(value, places) {
  const k = 10 ** places;
  return Math.round(value * k) / k;
}

export function encode(input) {
  const c = configOf(input);
  const params = new URLSearchParams();
  if (c.gpu !== DEFAULTS.gpu) params.set("gpu", c.gpu);
  if (c.dtype !== DEFAULTS.dtype) params.set("dtype", c.dtype);
  if (c.frac !== FRACTIONS[c.gpu][0]) params.set("frac", c.frac);
  if (!c.graphs) params.set("graphs", "off");
  if (c.workload !== DEFAULTS.workload) params.set("workload", c.workload);
  if (c.users !== DEFAULTS.users) params.set("users", String(c.users));
  if (c.shared !== DEFAULTS.shared) params.set("shared", String(c.shared));
  if (!c.radix) params.set("radix", "off");
  if (c.clock !== DEFAULTS.clock) params.set("clock", c.clock);
  return params.toString();
}

export function decode(search) {
  const params = new URLSearchParams(search);
  return configOf({
    gpu: params.get("gpu") || undefined,
    dtype: params.get("dtype") || undefined,
    frac: params.get("frac") || undefined,
    graphs: params.get("graphs") !== "off",
    workload: params.get("workload") || undefined,
    users: params.get("users") || undefined,
    shared: params.get("shared") || undefined,
    radix: params.get("radix") !== "off",
    clock: params.get("clock") || undefined,
  });
}

export const BREAKS = [
  { users: 64 },
  { workload: "shared", shared: 2048, frac: "0.74" },
  { clock: "hot", users: 1 },
  { workload: "shared", shared: 4096, radix: false },
  { graphs: false, users: 1 },
];

export function allConfigs() {
  const out = [];
  for (const gpu of GPUS)
    for (const dtype of DTYPES)
      for (const frac of FRACTIONS[gpu])
        for (const graphs of [true, false])
          for (const radix of [true, false])
            for (const clock of gpu === "l4" ? CLOCKS : ["cool"]) {
              for (const users of USERS) out.push(configOf({ gpu, dtype, frac, graphs, radix, clock, workload: "unique", users }));
              for (const shared of SHARED) out.push(configOf({ gpu, dtype, frac, graphs, radix, clock, workload: "shared", shared }));
            }
  return out;
}
