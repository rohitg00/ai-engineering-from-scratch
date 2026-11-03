---
id: finetune-pipeline-design
title: One command from raw data to a served tuned model
card: system-design
kind: design
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design]
tags: [fine-tuning, sft, dpo, quantization, speculative-decoding]
minutes: 25
lessons: [phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline, phases/10-llms-from-scratch/13-building-complete-llm-pipeline]
manuals: []
practice: []
cheatsheet: [lora-fine-tuning, rlhf-dpo, llm-pipeline-capstone]
related: [system-design/eval-platform-ship-gate, system-design/pipeline-rollback-plan, system-design/classifier-head-swap-choice]
updated: 2026-11-03
---

A team wants to adapt an open model in the 8B class to its own domain and serve it at a measurable cost per million tokens. Design the pipeline so that one command runs it end to end: the stages, the hardware per stage, the data hygiene, the ablations you require, the serving measurements, and what the release must include.

## Short answer

Five stages, each with a config file in version control: data preparation with deduplication, a quality filter, personal data scrubbing and a contamination check against the eval sets; supervised fine-tuning for 2-3 epochs on 8xH100 with a cosine schedule and packed sequences; one epoch of preference tuning on 4xH100 with a swept beta; quantization into three formats; and serving with speculative draft heads and autoscaling on queue wait. The deliverable is an ablation table of base, SFT only, SFT plus DPO and SFT plus GRPO on the task benchmarks, serving numbers at batch 1, 8 and 32 with the draft acceptance rate and cost per million tokens, a safety pass rate, and a model card with seeds, configs and commit hashes.

## Full answer

### Stages and hardware

| Stage | What | Hardware in the capstone |
|---|---|---|
| Data | Deduplicate, filter quality, scrub personal data, split with a seed | CPU |
| Contamination check | Near-duplicate hashing of every validation split against the public test sets; reject overlap | CPU |
| SFT | Sharded optimizer, fast attention kernels, packed sequences, 2-3 epochs | 8xH100 |
| Preference tuning | One epoch of DPO on pairs, or GRPO with a verifiable reward; sweep beta | 4xH100 |
| Quantize | Three formats for deployment flexibility; record size and throughput | One GPU |
| Serve | Draft heads for speculation, autoscaling on queue wait | Serving GPUs |
| Eval and card | Benchmark matrix, safety eval, model card | CPU plus eval GPU |

In the capstone's example run the data stage keeps 280k of 300k examples, SFT takes 6h12m and moves validation loss from 1.42 to 1.03, DPO runs 1h40m at a beta of 0.08, the quantized weights are 4.6 GB, and serving shows a draft acceptance rate of 0.74 with a p99 of 126ms at a batch of 8.

### Hygiene is a gate, not a step

The contamination check runs before training and fails the pipeline on overlap. The capstone's exercise leaks a small share of test answers into training and watches a benchmark jump unrealistically; the check is what makes the eval delta believable. The pipeline lesson adds the mechanism: a manifest with an input and output hash per stage, so the SFT stage refuses data that does not match the hash the contamination check approved.

### Ablations are the deliverable

The question the pipeline answers is not whether the model got better but which stage paid for it. Run the eval matrix on the base, on SFT only, on SFT plus DPO and on SFT plus GRPO. The example reports gains of +3.2 on one benchmark and +0.41 on another after the full run. Without the ablation, a regression from preference tuning hides behind the SFT gain.

### Serving measurements

Tokens per second at batch sizes 1, 8 and 32, the acceptance rate of the draft heads, and the cost for each million tokens against a hosted alternative at matched quality. Acceptance measured on the domain data, not generic chat, because the draft heads were trained for the domain and the latency budget depends on it.

### The release

A model card with the data sources and licenses, the training configs, the eval matrix, the safety pass rate, a reproducibility section with seeds and commit hashes, and the quantization deltas. One command reruns the pipeline with identical seeds; the rubric weights reproducibility and data hygiene as heavily as the eval gain.

## Follow-ups

- **Level 3:** Why does preference tuning need fewer GPUs than SFT? Expected: it runs one epoch on a much smaller set of pairs, and the capstone sizes it at half the SFT hardware.
- **Level 3:** Which stage gets rerun when the safety eval fails on the quantized model? Expected: quantization and serving only; the pipeline lesson's rollback invalidates the failed stage and its descendants.
- **Level 4:** The acceptance rate on domain traffic is far below the number from generic chat data. What does that do to the design? Expected: the latency budget was set on the wrong number; retrain the draft heads on domain data or size serving without the speculation gain.
- **Level 4:** A smaller model with a low-rank adapter matches quality at a tenth of the memory. How does the pipeline change? Expected: the SFT stage swaps to adapter training with the same data and eval gates, and the quantization and serving stages consume the merged weights unchanged.

## Wrong answers

- "Skip the contamination check; the data is internal." Internal data copies public text all the time, and one leaked test set makes the whole eval table meaningless.
- "Report the final model against the base and stop." Without the per-stage ablation nobody knows whether preference tuning helped or hurt.
- "Measure serving at batch one only." Throughput and cost per million tokens come from batched decoding; batch one measures latency, not economics.

## Taught in

The [end-to-end fine-tuning capstone](../../../phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/) gives the five stages, the hardware, the example run and the rubric, and the [complete LLM pipeline lesson](../../../phases/10-llms-from-scratch/13-building-complete-llm-pipeline/) gives the manifest, the hash chain and the rollback set.
