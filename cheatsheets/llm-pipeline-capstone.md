---
id: llm-pipeline-capstone
title: End-to-End LLM and Fine-Tuning Pipeline
code: EE
subtitle: Plan, run and gate a hashed stage DAG. Head swap, SFT loss mask and DPO loss from the capstones, with defaults.
hue: 215
sources: phases/10-llms-from-scratch/13-building-complete-llm-pipeline, phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline, phases/19-capstone-projects/38-classifier-finetuning, phases/19-capstone-projects/39-instruction-tuning-sft, phases/19-capstone-projects/40-dpo-from-scratch
source_hash: 2d1fd91ad69bc1db
---

## Commands
type: command-table
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md, phases/10-llms-from-scratch/13-building-complete-llm-pipeline/code/main.py, phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/docs/en.md, phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/code/main.py, phases/19-capstone-projects/38-classifier-finetuning/code/main.py, phases/19-capstone-projects/39-instruction-tuning-sft/code/main.py, phases/19-capstone-projects/40-dpo-from-scratch/code/main.py

| Command | What it does |
|---|---|
| `python code/main.py plan` | Validates the manifest, prints DAG and gates |
| `python code/main.py run` | Runs stages, prints the manifest JSON |
| `python code/main.py gate` | Applies eval gates. Prints `SHIP` or `HOLD` |
| `python code/main.py` | Demo: plan, run, a passing and a failing gate |
| `./pipeline.sh config/llama3.3-8b-domainX.yaml` | Capstone 07: data to model card |
| `run_demo()` | Capstones 38 to 40. Exits zero on success |

## Twelve-stage DAG
type: architecture
span: 2
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md, phases/10-llms-from-scratch/13-building-complete-llm-pipeline/code/main.py

```arch
node | tok | 1,1 | 01-02 Tokenizer | vocab, merges | store
node | data | 2,1 | 03 Dataset | sharded | store
node | base | 3,1 | 04-05 Checkpoint | pre-train, scale | gpu
node | sft | 4,1 | 06 SFT model | checkpoint + recipe | gpu
node | ppo | 4,2 | 07 Reward + PPO | policy | gpu
node | dpo | 3,2 | 08 DPO | policy | gpu
node | cai | 2,2 | 09 CAI / GRPO | refined policy | gpu
node | eval | 1,2 | 10 Eval report | scores, diffs | process
node | quant | 2,3 | 11 Quantized | weights + delta | store
node | srv | 3,3 | 12 Server spec | endpoint | process
node | gate | 1,3 | Ship gate | SHIP or HOLD | client
edge | tok | data |
edge | data | base |
edge | base | sft |
edge | sft | ppo |
edge | sft | dpo |
edge | ppo | cai |
edge | dpo | cai |
edge | cai | eval |
edge | cai | quant |
edge | quant | srv |
edge | eval | gate |
edge | srv | gate |
```

## What the orchestrator does
type: flow
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md, phases/10-llms-from-scratch/13-building-complete-llm-pipeline/code/main.py

1. **Orchestrator**: resolves the DAG from the manifest.
2. **Orchestrator**: skips a stage if its output already exists at the correct hash.
3. **Stage**: runs. The orchestrator measures wall clock and cost.
4. **Orchestrator**: checks the output hash against the next stage input hash.
5. **CostTracker**: halts with `halted_over_budget` when total cost passes the budget.
6. **On failure**: writes a partial manifest and exits nonzero.

## Manifest and gates
type: annotated-code
lang: yaml
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md

```yaml
pipeline_version: 1.2.3
seed: 42
git_commit: a1b2c3d4
stages:
  01_tokenizer:
    input_hash: sha256:...  # output hash of the stage before
    output_hash: sha256:...  # input hash of the next stage
gates:
  mmlu:      >= baseline + 0.5   # no regression
  humaneval: >= baseline + 1.0
  safety_refusal_rate: <= 0.05
  kl_from_reference: <= 25.0  # KL budget gate
  cost_total_usd: <= 50000
```

## Gate defaults in main.py
type: defaults
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/code/main.py

| Setting | Default | Note |
|---|---|---|
| `mmlu` | 65.0 | op `>=` |
| `humaneval` | 40.0 | op `>=` |
| `truthfulqa` | 50.0 | op `>=` |
| `safety_refusal_rate` | 0.05 | op `<=` |
| `kl_from_reference` | 25.0 | op `<=` |
| `cost_total_usd` | 50000.0 | op `<=` |
| `budget_usd` | 50000.0 | Run halts above it |
| `seed` | 42 | In `Manifest` |

## The three capstones side by side
type: comparison
span: 2
from: phases/19-capstone-projects/38-classifier-finetuning, phases/19-capstone-projects/39-instruction-tuning-sft, phases/19-capstone-projects/40-dpo-from-scratch

| Factor | 38 Classifier head swap | 39 Instruction SFT | 40 DPO |
|---|---|---|---|
| Builds | Body + mean pool + 2-class head | `TinyGPT` trained on response tokens | Policy against a frozen reference |
| Data | 800 SMS, 640 train, 160 test | 200 pairs, 160 train, 40 test | 12 (prompt, chosen, rejected) triples |
| Model | hidden 64, 4 heads, 2 blocks, max 32 | hidden 96, 2 blocks | hidden 64, 2 blocks |
| Train | 20 epochs head-only, 20 full | 20 epochs, lr 5e-4 | 30 epochs, beta 0.2, lr 1e-3 |
| Metric | Precision, recall, F1, confusion | Exact-match per category | Chosen minus rejected margin |
| Check | Head-only and full both report | Exact-match rises over epochs | Loss falls, margin grows |

## Key calls in the capstones
type: task-table
span: 2
from: phases/19-capstone-projects/38-classifier-finetuning/code/main.py, phases/19-capstone-projects/39-instruction-tuning-sft/code/main.py, phases/19-capstone-projects/40-dpo-from-scratch/code/main.py

| Task | Code |
|---|---|
| Freeze the body for head-only training | `freeze_body(model)` |
| Pool hidden states with the mask | `mean_pool(h, mask)` |
| Pad a batch and mask labels with -100 | `sft_collate(batch)` |
| Causal loss on response tokens | `shifted_loss(logits, labels)` |
| Score a completion under a model | `sequence_log_prob(...)` |
| DPO loss and implicit reward margin | `dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=cfg.beta)` |
| Start the policy from the reference | `policy.load_state_dict(reference.state_dict())` |

## DPO loss
type: annotated-code
lang: python
from: phases/19-capstone-projects/40-dpo-from-scratch/code/main.py

```python
diff_w = logp_w_pol - logp_w_ref  # chosen log-ratio
diff_l = logp_l_pol - logp_l_ref  # rejected log-ratio
margin = diff_w - diff_l  # implicit reward difference
z = beta * margin
loss = -F.logsigmoid(z)  # numerically stable
for p in reference.parameters():
    p.requires_grad = False  # reference never trains
reference.eval()
```

## Capstone 07 log lines
type: command-table
from: phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/docs/en.md

| Command | What it does |
|---|---|
| `280k accepted (seed=7)` | Data stage rows kept |
| `val loss 1.42 -> 1.03` | SFT, 3 epochs on 8xH100 |
| `1 epoch, beta=0.08, 4xH100` | DPO run |
| `GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB` | Quant sizes |
| `EAGLE-3 acceptance 0.74` | Speculative decoding check |
| `p99 126ms @ bs=8` | Tail latency at batch 8 |
| `MMLU-Pro +3.2, MT-Bench-v2 +0.41` | Eval gain over base |

## Troubleshooting
type: troubleshooting
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md, phases/10-llms-from-scratch/13-building-complete-llm-pipeline/code/main.py, phases/19-capstone-projects/39-instruction-tuning-sft/docs/en.md, phases/19-capstone-projects/38-classifier-finetuning/docs/en.md, phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md, phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `HOLD: missing metric <metric>` | Eval report has no value | Add the metric to the eval stage |
| `input hash missing for stage` | Upstream artifact not in store | Re-run the upstream stage |
| `halted_over_budget` | Total cost above `budget_usd` | Fix the cost estimate at plan time |
| DPO model sent through the SFT path | Untyped artifacts | Typed artifacts and stage signatures |
| Model learns to predict the instruction | No loss mask | `-100` on instruction, pad, boundary |
| Full fine-tuning overfits 800 examples | Small data washes out the body | Train the head only |
| MMLU-Pro accuracy jumps | Contamination in training data | MinHash check, reject any overlap |
| DPO prefers short completions | Length bias | Divide log-prob by completion length |

## Rollback and tips
type: tips
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md, phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md

- Run `plan` first every time. It is free. `run` is expensive.
- Cheap to re-run: tokenizer, eval, quantization, inference server.
- Medium: SFT, DPO, CAI. Keep the base model.
- Expensive: pre-training. Use the last good checkpoint.
- A failure at stage 06 invalidates 06 to 12. At stage 11, only 11 and 12.
- Address artifacts by hash. A filename like `latest.pt` is a foot-gun.
- Pre-training FLOPs: 6 x params x tokens.

## Q&A
type: qa
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md, phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md, phases/19-capstone-projects/39-instruction-tuning-sft/docs/en.md

- **Which two gates catch most disasters?** A regression gate and a KL budget gate.
- **Reproducible or deterministic?** Reproducible. Floats differ at the 1e-5 level.
- **Why does log Z(x) drop out of DPO?** It is the same for chosen and rejected.
- **Why greedy for exact-match?** Temperature makes the metric stochastic.
