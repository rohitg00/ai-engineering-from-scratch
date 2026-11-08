---
id: pipeline-rollback-plan
title: Write the rollback plan before the training run starts
card: system-design
kind: tradeoff
level: 4
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [rollback, manifest, content-addressed, reproducibility]
minutes: 20
lessons: [phases/10-llms-from-scratch/13-building-complete-llm-pipeline]
manuals: []
practice: []
cheatsheet: [llm-pipeline-capstone]
related: [system-design/eval-platform-ship-gate, system-design/finetune-pipeline-design]
updated: 2026-11-03
---

A twelve-stage training pipeline runs from tokenizer to inference server, and the pre-training stage costs weeks and millions of dollars. Before the run starts you must write what happens when each stage fails. Lay out the plan, explain how the orchestrator computes what to rerun, and say what "reproduce the run" can and cannot promise.

## Short answer

Sort the stages by the cost to rerun them: tokenizer, evaluation, quantization and the server are cheap and rerun in hours, supervised tuning and alignment take days, so the base checkpoint is kept and only those stages rerun, and pre-training takes weeks and a budget in the millions, so the plan is the last good checkpoint plus revised downstream stages. The rerun set falls out of the typed, hashed dependency graph: invalidate the failed stage and every descendant. A replay promises the same code, recipe and source data hashes and the same headline metrics, not bit-identical weights or the same output hashes.

## Full answer

### Three cost classes

| Class | Stages | Plan on failure |
|---|---|---|
| Cheap, hours | Tokenizer, eval, quantization, inference server | Rerun |
| Medium, days | SFT, DPO, constitutional refinement | Keep the base model, rerun alignment |
| Expensive, weeks and millions | Pre-training | Last good checkpoint plus revised downstream stages |

Writing this before the run means nobody improvises at four in the morning with an exhausted team.

### How the rerun set is computed

Every stage has typed inputs and outputs, and the output hash of a stage is the input hash of the next. A failure at the SFT stage invalidates it and every descendant: the reward model, the DPO policy, the refined policy, the eval report, the quantized weights and the server, which is stages six through twelve. A failure at quantization invalidates only quantization and the server. The orchestrator reads the graph from the manifest, so the rollback set is computed, not remembered. A change to the tokenizer invalidates everything downstream; a change to the eval set invalidates only the ship decision.

### Why hashes make it safe

Artifacts live in an immutable store addressed by content hash, never by a name such as latest. A partial rerun checks whether each expected output already exists at the right hash and skips the stage if it does. That is also how a partial rollback saves most of the wall clock: stages one through eight stay cached while nine through twelve rerun. The pipeline lesson's exercise measures exactly that saving.

### What reproduce means

Reproducible: the same manifest, code and infrastructure give a checkpoint with equivalent downstream metrics. Deterministic: bit-identical output. Distributed reduce order, kernel nondeterminism and mixed precision rounding make modern training reproducible but not deterministic; weights differ at a level around 1e-5 between runs while the metrics do not move. The cure is to log the input hash, the output hash and the headline metrics per stage. If the code, recipe and source data hashes and the headline metrics match, the run is reproduced even when a weight artifact and the input hashes after it get new values, and a bit-level diff is the wrong debugging tool. The lesson's rule that the input hash, the output hash and the metrics all match holds in full for the stages with deterministic output, such as the tokenizer and the eval data; for a weight artifact, which cannot be bit-identical, the metrics carry the check.

### Budget as part of the plan

The pre-run cost estimate uses six times parameters times tokens for the training compute, divided by peak throughput and utilization, at the rental rate. If the estimate exceeds the cost gate the pipeline refuses to start. After each stage the remaining budget is rechecked, so an overrun in one stage changes the gate for the next instead of being discovered when the money is gone.

## Follow-ups

- **Level 3:** Why not name artifacts by version string? Expected: two artifacts can share a name and differ in content; the hash is the identity, and a name like latest is a trap.
- **Level 4:** The reward model and the DPO policy both depend on the SFT checkpoint. What can run in parallel and what must wait? Expected: the two can run together after SFT; the refined policy waits for both, and its input hash must be a deterministic combination of both outputs.
- **Level 4:** A corrupted checkpoint is discovered after alignment finished. Which plan applies? Expected: the expensive class; take the last good pre-training checkpoint and rerun the medium and cheap stages, never the full pre-training.
- **Level 4:** A teammate reports that their replay has different weights. Is the run broken? Expected: not by itself; compare the code, recipe and source data hashes and the headline metrics, and only a mismatch there means the run is not reproduced.

## Wrong answers

- "Rerun from the start to be safe." The expensive stage costs weeks; the typed graph tells you exactly which stages are invalid.
- "Keep the latest checkpoint file and overwrite it each step." A mutable name cannot be verified or replayed; content addressing is what makes the rollback set trustworthy.
- "If the weights are not bit-identical, the pipeline is not reproducible." Distributed training is not deterministic; reproducibility is defined on the code, recipe and source data hashes and the metrics.

## Taught in

The [complete LLM pipeline lesson](../../../phases/10-llms-from-scratch/13-building-complete-llm-pipeline/) gives the three cost classes, the descendant rule, the content-addressed store and the distinction between reproducible and deterministic.
