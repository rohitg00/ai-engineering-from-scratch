---
id: eval-platform-ship-gate
title: Design the gate that decides whether a model ships
card: system-design
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [eval-gate, manifest, regression, contamination, reproducibility]
minutes: 20
lessons: [phases/10-llms-from-scratch/13-building-complete-llm-pipeline]
manuals: []
practice: []
cheatsheet: [llm-pipeline-capstone, llm-evaluation]
related: [system-design/pipeline-rollback-plan, system-design/finetune-pipeline-design, system-design/rag-service-company-docs]
updated: 2026-11-03
---

A team trains and aligns models in a multi-stage pipeline and ships the result to serving. Design the evaluation platform that decides whether an artifact is shippable: what it reads, what a gate is, which two gates catch most disasters, how it handles a failed gate, and how a third party replays a decision.

## Short answer

The platform reads a manifest that describes the run completely, with a seed, a code revision, and an input and output hash for every stage, and it evaluates numeric gates that were written before the run started. A regression gate holds the new model to the previous one on core benchmarks and catches training bugs; a KL budget gate caps how far the aligned policy drifted from its reference and catches alignment overcooking. A failed gate holds the run for a named reviewer whose override is logged in the manifest, and anyone can replay the decision because the eval report is content-addressed and the eval data hash is part of it.

## Full answer

### What the platform reads

The manifest is the single file that describes the run well enough to replay it: pipeline version, seed, code revision, and per stage a recipe, an input hash, an output hash, wall clock and cost. The output hash of one stage is the input hash of the next, so a corrupted or swapped artifact stops the pipeline before any evaluation. Artifacts are typed: an eval report carries benchmark scores, regression diffs and the hash of the eval data, so a report cannot be confused with a checkpoint or attached to the wrong model.

### Gates

Every gate is a numeric threshold written before training starts, for example a core benchmark at least the baseline plus 0.5, a coding benchmark at least the baseline plus 1.0, a truthfulness benchmark with no drop, a safety refusal rate at most 0.05, a KL from the reference at most 25.0, and a total cost at most 50000. No "looks good" gates and no subjective sign-offs. If every gate passes the artifact is marked shippable; if any fails the run is held.

### The two gates that matter most

- Regression: the new model must be at least as good as the previous one on the core set. This catches training bugs, bad data mixes and broken tokenizers.
- KL budget: the aligned policy must not drift further than a set amount from its reference. This catches alignment that overcooked the model into a narrow behavior.

Every production pipeline has both.

### Contamination

A gate that compares the eval data hash against the training shards by exact match or long n-gram overlap, and fails when the overlap passes a small fraction, keeps a benchmark gain honest. The pipeline lesson's exercise sets that fraction at 0.1% with 13-gram matching.

### Holds, overrides and replay

A held run is a decision point, not a failure. A named reviewer either approves the rollback or overrides, and the override is written into the manifest with the name. Replay works because the manifest, the content-addressed eval report and the eval data hash identify the exact inputs; a teammate on another continent runs the gate against the same hashes and must get the same verdict. Reproducible is not deterministic: weights can differ at the level of small rounding between runs, so replay checks hashes and headline metrics, not bit-identical tensors.

### Where the platform plugs in

The gate runs after evaluation and after quantization, because quantized weights must pass the same thresholds as the full model. The three commands are plan, run and gate; plan is free and catches missing thresholds and stale hashes before any compute is spent.

## Follow-ups

- **Level 3:** Why must the thresholds be written before the run? Expected: a threshold chosen after seeing the scores is moved to pass the model; a gate is only a gate if it can fail.
- **Level 3:** A change to the eval set invalidates what? Expected: only the ship decision; the eval data hash changes, the report is recomputed, and the training artifacts stay valid.
- **Level 4:** The quantized model passes every gate except the safety refusal rate, which rose slightly. What do you ship? Expected: nothing without a logged override; the gate exists for the serving artifact, and the lesson's recipe keeps safety evals on a higher-precision quantization where deltas matter.
- **Level 4:** How does the platform stop a model trained through the wrong stage from reaching the gate? Expected: typed artifacts and typed stage signatures, so a preference-tuned checkpoint cannot be fed into the supervised path and the mismatch fails at plan time.

## Wrong answers

- "Have a reviewer look at samples and sign off." Subjective sign-offs are not gates; a gate is a number that can fail, and the reviewer's role is the logged override.
- "Rerun training to confirm a result." Pre-training costs weeks; replay checks hashes and metrics against the manifest instead.
- "One benchmark is enough if it is the right one." The regression set and the KL budget catch different failures, and a safety gate catches a third.

## Taught in

The [complete LLM pipeline lesson](../../../phases/10-llms-from-scratch/13-building-complete-llm-pipeline/) defines the manifest, the typed artifacts, the eval gate and the override and replay rules.
