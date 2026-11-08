# Evidence: cheatsheets/llm-pipeline-capstone.md

Abbreviations: P = phases/10-llms-from-scratch/13-building-complete-llm-pipeline, F = phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline, K = phases/19-capstone-projects/38-classifier-finetuning, S = phases/19-capstone-projects/39-instruction-tuning-sft, D = phases/19-capstone-projects/40-dpo-from-scratch.

## Commands (command-table)
- plan, run, gate commands: P/docs/en.md:220-222
- plan validates, prints DAG and gates: P/code/main.py:117-134, 216-218
- run prints manifest JSON: P/code/main.py:220-223
- gate prints SHIP or HOLD: P/code/main.py:225-230, P/docs/en.md:227
- no argument runs demo with passing and failing gate: P/code/main.py:212, 232-269
- ./pipeline.sh config/llama3.3-8b-domainX.yaml: F/docs/en.md:96, F/code/main.py:150
- run_demo exits zero: K/code/main.py:617, S/code/main.py:676, D/code/main.py:563, K/docs/en.md:125

## Twelve-stage DAG (architecture)
- 01-02 Tokenizer: P/docs/en.md:35, P/code/main.py:21-22
- 03 Dataset: P/docs/en.md:36, P/code/main.py:23
- 04-05 Checkpoint: P/docs/en.md:37-38, P/code/main.py:24-25
- 06 SFT model: P/docs/en.md:39, P/code/main.py:26
- 07 Reward + PPO: P/docs/en.md:40, P/code/main.py:27
- 08 DPO: P/docs/en.md:41, P/code/main.py:28
- 09 CAI / GRPO: P/docs/en.md:42, P/code/main.py:29
- 10 Eval report: P/docs/en.md:44, P/code/main.py:30
- 11 Quantized: P/docs/en.md:45, P/code/main.py:31
- 12 Server spec: P/docs/en.md:46, P/code/main.py:32
- Ship gate, SHIP or HOLD: P/docs/en.md:47-48, P/code/main.py:229
- Artifact key fields (vocab, merges, scores, quantized weights, endpoint): P/docs/en.md:85-93

## What the orchestrator does (flow)
- 1 resolve DAG: P/docs/en.md:121
- 2 skip at correct hash: P/docs/en.md:122
- 3 run, measure wall clock and cost: P/docs/en.md:123
- 4 verify output hash: P/docs/en.md:124
- 5 CostTracker halts, halted_over_budget: P/docs/en.md:211, P/code/main.py:151-160
- 6 partial manifest, exit nonzero: P/docs/en.md:125

## Manifest and gates (annotated-code)
- pipeline_version, seed, git_commit, stages, 01_tokenizer, hashes: P/docs/en.md:63-70
- output hash of stage N is input of N+1: P/docs/en.md:75
- gates mmlu, humaneval, safety_refusal_rate, kl_from_reference, cost_total_usd: P/docs/en.md:102-108
- KL budget gate: P/docs/en.md:113

## Gate defaults in main.py (defaults)
- mmlu 65.0 op >=: P/code/main.py:37
- humaneval 40.0 op >=: P/code/main.py:38
- truthfulqa 50.0 op >=: P/code/main.py:39
- safety_refusal_rate 0.05 op <=: P/code/main.py:40
- kl_from_reference 25.0 op <=: P/code/main.py:41
- cost_total_usd 50000.0 op <=: P/code/main.py:42
- budget_usd 50000.0, halts above: P/code/main.py:65; P/code/main.py:152
- seed 42 in Manifest: P/code/main.py:60

## The three capstones side by side (comparison)
- Builds: K/docs/en.md:121, K/code/main.py:141-151; S/docs/en.md:134, 46; D/docs/en.md:13, 108
- Data: K/docs/en.md:71-73; S/docs/en.md:50, 61; D/docs/en.md:102, 149
- Model: K/docs/en.md:111, K/code/main.py:473-477; S/docs/en.md:103, S/code/main.py:454-456; D/code/main.py:353-355
- Train: K/code/main.py:478-479; S/code/main.py:459-460; D/code/main.py:357-359
- Metric: K/docs/en.md:124; S/docs/en.md:61, S/code/main.py:590; D/docs/en.md:153
- Check: K/docs/en.md:125; S/docs/en.md:105; D/docs/en.md:104, D/code/main.py:557

## Key calls in the capstones (task-table)
- freeze_body(model): K/code/main.py:173
- mean_pool(h, mask): K/code/main.py:133, 149-150
- sft_collate with -100: S/code/main.py:397-402
- shifted_loss: S/code/main.py:432
- sequence_log_prob: D/code/main.py:195
- dpo_loss call: D/code/main.py:483
- policy.load_state_dict(reference.state_dict()): D/code/main.py:372

## DPO loss (annotated-code)
- diff_w, diff_l, margin, z, loss: D/code/main.py:250-255
- freeze reference loop and eval: D/code/main.py:374-376

## Capstone 07 log lines (command-table)
- 280k accepted (seed=7): F/docs/en.md:97
- val loss 1.42 -> 1.03, 3 epochs, 8xH100: F/docs/en.md:98
- 1 epoch, beta=0.08, 4xH100: F/docs/en.md:99
- GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB: F/docs/en.md:100
- EAGLE-3 acceptance 0.74: F/docs/en.md:101
- p99 126ms @ bs=8: F/docs/en.md:101
- MMLU-Pro +3.2, MT-Bench-v2 +0.41: F/docs/en.md:102

## Troubleshooting (troubleshooting)
- HOLD: missing metric: P/code/main.py:188-190
- input hash missing for stage: P/code/main.py:144-146
- halted_over_budget above budget_usd, plan-time estimate: P/code/main.py:152-157, P/docs/en.md:143, 225
- Stage 08 output used as stage 06 input, typed artifacts: P/docs/en.md:95
- Model predicts instruction without mask, -100 on instruction, pad, boundary: S/docs/en.md:142, 76-78
- Full fine-tuning overfits small data, head-only right call: K/docs/en.md:48, 131
- MMLU-Pro jumps from contamination, MinHash reject overlap: F/docs/en.md:127, 77
- Length bias, divide by completion length: D/docs/en.md:162

## Rollback and tips (tips)
- plan first, free vs expensive: P/docs/en.md:225
- Cheap to re-run: P/docs/en.md:176
- Medium, keep the base model: P/docs/en.md:177
- Expensive, use the last good checkpoint: P/docs/en.md:178
- Stage 06 and stage 11 invalidation: P/docs/en.md:180
- latest.pt foot-gun, by hash: P/docs/en.md:135
- 6 x params x tokens: P/docs/en.md:143

## Q&A (qa)
- Regression gate and KL budget gate: P/docs/en.md:113
- Reproducible not deterministic, 1e-5 level: P/docs/en.md:153
- log Z(x) cancels: D/docs/en.md:52
- Greedy for exact-match: S/docs/en.md:114
