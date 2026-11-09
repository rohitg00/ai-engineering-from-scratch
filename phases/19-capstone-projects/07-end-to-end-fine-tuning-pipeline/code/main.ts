// Lesson: Capstone 07: End-to-End Fine-Tuning Pipeline (Data to SFT to DPO to Serve) (phase 19 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/docs/en.md
// Run: npx tsx phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/code/main.ts

import { createHash } from "node:crypto";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Payload = { [k: string]: Json };

function pyDumpsSorted(v: Json): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "[" + v.map(pyDumpsSorted).join(", ") + "]";
  if (typeof v === "object") {
    const keys = Object.keys(v).sort();
    return "{" + keys.map((k) => `${JSON.stringify(k)}: ${pyDumpsSorted(v[k])}`).join(", ") + "}";
  }
  return JSON.stringify(v);
}

class Artifact {
  produced_at = Date.now() / 1000;

  constructor(public name: string, public kind: string, public payload: Payload, public produced_by: string) {}

  contentHash(): string {
    const blob = Buffer.from(pyDumpsSorted(this.payload), "utf8");
    return createHash("sha256").update(blob).digest("hex").slice(0, 12);
  }
}

class Manifest {
  artifacts = new Map<string, Artifact>();

  add(a: Artifact): void {
    this.artifacts.set(a.name, a);
  }

  get(name: string): Artifact {
    const a = this.artifacts.get(name);
    if (a === undefined) throw new Error(`KeyError: '${name}'`);
    return a;
  }

  summary(): [string, string, string, string][] {
    return [...this.artifacts.values()].map((a) => [a.name, a.kind, a.contentHash(), a.produced_by]);
  }
}

interface Cfg {
  base_model: string;
  raw_examples?: number;
  seed?: number;
  dpo_beta?: number;
}

type Stage = (m: Manifest, cfg: Cfg) => Artifact;

function stageData(m: Manifest, cfg: Cfg): Artifact {
  const rawN = cfg.raw_examples ?? 300_000;
  const dedupRatio = 0.94;
  const qualRatio = 0.91;
  const piiRatio = 0.995;
  const kept = Math.trunc(rawN * dedupRatio * qualRatio * piiRatio);
  return new Artifact("dataset", "dataset", {
    raw_examples: rawN,
    after_dedup: Math.trunc(rawN * dedupRatio),
    after_quality: Math.trunc(rawN * dedupRatio * qualRatio),
    after_pii_scrub: kept,
    seed: cfg.seed ?? 7,
  }, "Datatrove+Nemotron-CC+Presidio");
}

function stageContamination(m: Manifest, cfg: Cfg): Artifact {
  const ds = m.get("dataset");
  const overlap: { bench: string; overlap_examples: number }[] = [];
  for (const bench of ["MMLU-Pro", "MT-Bench-v2", "RewardBench-2"]) overlap.push({ bench, overlap_examples: 0 });
  return new Artifact("contamination_check", "report", {
    dataset_hash: ds.contentHash(),
    overlaps: overlap,
    status: overlap.every((o) => o.overlap_examples === 0) ? "clean" : "dirty",
  }, "minhash-lsh");
}

function stageSft(m: Manifest, cfg: Cfg): Artifact {
  const ds = m.get("dataset");
  return new Artifact("sft_checkpoint", "checkpoint", {
    base: cfg.base_model,
    dataset_hash: ds.contentHash(),
    epochs: 3,
    val_loss: 1.03,
    hours: 6.2,
    gpus: 8,
  }, "axolotl v0.8 + ZeRO-3");
}

function stageDpo(m: Manifest, cfg: Cfg): Artifact {
  const sft = m.get("sft_checkpoint");
  return new Artifact("dpo_checkpoint", "checkpoint", {
    from: sft.contentHash(),
    epochs: 1,
    beta: 0.08,
    hours: 1.7,
  }, "trl 0.15 DPO");
}

function stageQuantize(m: Manifest, cfg: Cfg): Artifact {
  const ckpt = m.get("dpo_checkpoint");
  return new Artifact("quants", "quant", {
    from: ckpt.contentHash(),
    gptq_int4_gb: 4.6,
    awq_int4_gb: 4.8,
    gguf_q4_km_gb: 5.1,
  }, "gptq+awq+llama.cpp");
}

function stageServe(m: Manifest, cfg: Cfg): Artifact {
  m.get("quants");
  return new Artifact("endpoint", "endpoint", {
    backend: "vLLM 0.7 + EAGLE-3",
    quant: "GPTQ-INT4-Marlin",
    eagle_acceptance: 0.74,
    p99_bs8_ms: 126,
    tokens_per_sec_bs32: 6400,
    dollars_per_mtokens: 0.28,
  }, "vllm+speculators");
}

function stageEval(m: Manifest, cfg: Cfg): Artifact {
  const ckpt = m.get("dpo_checkpoint");
  return new Artifact("eval_report", "report", {
    from: ckpt.contentHash(),
    mmlu_pro_delta: 3.2,
    mt_bench_v2_delta: 0.41,
    rewardbench2_delta: 0.08,
    llama_guard_4_pass: 0.987,
  }, "lm-eval-harness");
}

function stageModelCard(m: Manifest, cfg: Cfg): Artifact {
  return new Artifact("model_card", "report", {
    standard: "MOF 2026",
    data_license_declared: true,
    training_config_hash: m.get("sft_checkpoint").contentHash(),
    eval_attached: true,
    safety_attached: true,
    reproducibility_command: "./pipeline.sh config/llama3.3-8b-domainX.yaml",
  }, "mof-template");
}

const PIPELINE: [string, Stage][] = [
  ["data", stageData],
  ["contamination", stageContamination],
  ["sft", stageSft],
  ["dpo", stageDpo],
  ["quantize", stageQuantize],
  ["serve", stageServe],
  ["eval", stageEval],
  ["model_card", stageModelCard],
];

function runPipeline(cfg: Cfg): Manifest {
  const m = new Manifest();
  for (const [name, stageFn] of PIPELINE) {
    console.log(`[${name.padEnd(14)}] running...`);
    const art = stageFn(m, cfg);
    m.add(art);
    console.log(`[${name.padEnd(14)}] -> artifact '${art.name}' hash=${art.contentHash()}`);
  }
  return m;
}

function main(): void {
  const cfg: Cfg = { base_model: "llama-3.3-8b", raw_examples: 300_000, seed: 7, dpo_beta: 0.08 };
  console.log("=== fine-tuning pipeline run ===");
  const m = runPipeline(cfg);
  console.log();
  console.log("=== manifest ===");
  for (const [name, kind, h, by] of m.summary()) console.log(`  ${name.padEnd(18)} ${kind.padEnd(10)} ${h} by ${by}`);
  console.log();
  console.log("=== eval report ===");
  console.log(JSON.stringify(m.get("eval_report").payload, null, 2));
  console.log();
  console.log("=== served endpoint ===");
  console.log(JSON.stringify(m.get("endpoint").payload, null, 2));
}

main();
