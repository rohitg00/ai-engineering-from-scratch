---
id: gpt-from-scratch-training
title: Train and Load a GPT from Scratch
code: TL
subtitle: Build the 124M GPT, train it with AdamW and cosine warmup, load GPT-2 weights, gate the pipeline.
hue: 28
sources: phases/19-capstone-projects/35-gpt-model-assembly, phases/19-capstone-projects/36-training-loop-eval, phases/19-capstone-projects/37-loading-pretrained-weights, phases/19-capstone-projects/44-cosine-lr-warmup, phases/10-llms-from-scratch/13-building-complete-llm-pipeline
source_hash: 06e61dd1d80fe8c1
---

## Run the lessons
type: command-table
from: phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md, phases/19-capstone-projects/36-training-loop-eval/docs/en.md, phases/19-capstone-projects/37-loading-pretrained-weights/docs/en.md, phases/19-capstone-projects/44-cosine-lr-warmup/docs/en.md, phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` (35) | Counts 124M params, generates with a tiny config |
| `python3 code/main.py` (36) | Trains a tiny model, writes `outputs/losses.jsonl` |
| `python3 code/main.py` (37) | Writes `outputs/gpt2-stub.safetensors`, loads it |
| `python3 code/main.py` (44) | 20 steps, per step lr and grad norm, text plot |
| `python code/main.py plan` | Validates manifest, cost estimate, prints DAG |
| `python code/main.py run` | Executes stages, writes `manifest.out.yaml` |
| `python code/main.py gate` | Applies eval gates. Prints `SHIP` or `HOLD` |
| `build_param_groups(model, weight_decay)` | AdamW groups, decay split |

## GPTConfig defaults (124M)
type: defaults
from: phases/19-capstone-projects/35-gpt-model-assembly/code/main.py, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `vocab_size` | 50257 | Rows of the token table |
| `context_length` | 1024 | Rows of the position table |
| `d_model` | 768 | Embedding width |
| `num_heads` | 12 | `d_model` must divide by it |
| `num_layers` | 12 | Twelve `TransformerBlock` modules |
| `mlp_expansion` | 4 | MLP hidden is 4 times `d_model` |
| `dropout` | 0.1 | Tiny demo sets 0.0 |
| `weight_tying` | True | `lm_head` shares `tok_embed` |

## GPTModel forward
type: architecture
from: phases/19-capstone-projects/35-gpt-model-assembly/code/main.py, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md

```arch
node | ids | 1,1 | Token ids | shape B, T | client
node | tok | 2,1 | tok_embed | 50257, 768 | store
node | pos | 2,2 | pos_embed | 1024, 768 learned | store
node | add | 3,1 | Add | embed_dropout | process
node | blk | 4,1 | 12 blocks | pre-LN TransformerBlock | model
node | ln | 4,2 | final_ln | LayerNorm | process
node | head | 3,2 | lm_head | logits B, T, 50257 | model
edge | ids | tok | ids
edge | ids | pos | 0 to T-1
edge | tok | add |
edge | pos | add |
edge | add | blk |
edge | blk | ln |
edge | ln | head |
edge | head | tok | tied weight
```

## Build, count and sample
type: annotated-code
lang: python
from: phases/19-capstone-projects/35-gpt-model-assembly/code/main.py

```python
ref_model = GPTModel(GPTConfig())  # 124M reference
count_parameters(ref_model)  # unique params, tied once
GPTModel(GPTConfig(weight_tying=False))  # adds vocab_size * d_model
self.lm_head.weight = self.tok_embed.weight  # share, never copy
generate(tiny_model, prompt, max_new_tokens=12,
         temperature=0.8, top_k=20, seed=42)  # temperature must be positive
top_k_filter(logits, top_k)  # others to -inf
window = tokens[:, -model.cfg.context_length:]  # sliding window
```

## One training step
type: flow
from: phases/19-capstone-projects/36-training-loop-eval/code/main.py, phases/19-capstone-projects/36-training-loop-eval/docs/en.md

1. **make_batches**: target is the input shifted by one position.
2. **Schedule**: `cosine_with_warmup` sets `group["lr"]` in each param group.
3. **calc_loss_batch**: forward, flatten to `(batch * seq, vocab)`, cross entropy.
4. **Backward**: `loss.backward()`, then `clip_grad_norm_` at `max_norm=1.0`.
5. **AdamW**: `optimizer.step()` with `betas=(0.9, 0.95)`.
6. **Log**: append `{"step", "train_loss", "lr"}` to `losses.jsonl`.
7. **Probe**: every `eval_every` steps run `evaluate_model` and `generate_and_print_sample`.

## Training loop core
type: annotated-code
lang: python
from: phases/19-capstone-projects/36-training-loop-eval/code/main.py

```python
optimizer = torch.optim.AdamW(
    build_param_groups(model, cfg.weight_decay),  # decay split
    lr=cfg.max_lr, betas=(0.9, 0.95))
for step in range(cfg.num_steps):
    lr = cosine_with_warmup(step, cfg.warmup_steps, cfg.num_steps, cfg.max_lr, cfg.min_lr)
    for group in optimizer.param_groups:
        group["lr"] = lr
    inputs, targets = next(train_loader)
    optimizer.zero_grad(set_to_none=True)
    loss = calc_loss_batch(model, inputs, targets)  # flat cross entropy
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=cfg.grad_clip)
    optimizer.step()
```

## Schedule and size numbers
type: concepts
from: phases/19-capstone-projects/44-cosine-lr-warmup/docs/en.md, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md, phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md

- **Warmup**: `lr_max * step / warmup_steps` up to `warmup_steps`.
- **Cosine**: `lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * progress))`.
- **Floor**: past `total_steps` the rate stays at `lr_min`.
- **Warmup size**: a fraction of total steps. Typical is 1 to 3 percent.
- **Floor size**: `lr_min` at 10 percent of `lr_max` keeps the optimizer learning.
- **Weight tying**: saves 50257 times 768 = 38 million parameters.
- **Residual init**: scale out projections by `1 / sqrt(2 * num_layers)`.
- **Pre-training FLOPs**: 6 x params x tokens.

## GPT-2 names to local names
type: comparison
span: 2
from: phases/19-capstone-projects/37-loading-pretrained-weights/docs/en.md, phases/19-capstone-projects/37-loading-pretrained-weights/code/main.py

| Factor | GPT-2 file | Local model |
|---|---|---|
| Token embedding | `wte.weight` | `tok_embed.weight` |
| Position embedding | `wpe.weight` | `pos_embed.weight` |
| LayerNorm 1 scale | `h.N.ln_1.weight` | `blocks.N.ln1.scale` |
| Fused QKV, transposed | `h.N.attn.c_attn.weight` | `blocks.N.attn.qkv.weight` |
| Attention out, transposed | `h.N.attn.c_proj.weight` | `blocks.N.attn.out_proj.weight` |
| MLP fc1, transposed | `h.N.mlp.c_fc.weight` | `blocks.N.mlp.fc1.weight` |
| MLP fc2, transposed | `h.N.mlp.c_proj.weight` | `blocks.N.mlp.fc2.weight` |
| Final LayerNorm | `ln_f.weight`, `ln_f.bias` | `final_ln.scale`, `final_ln.shift` |

## Load safetensors weights
type: annotated-code
lang: python
from: phases/19-capstone-projects/37-loading-pretrained-weights/code/main.py

```python
make_stub_safetensors(STUB_PATH, cfg, seed=42)  # offline fixture
model = GPTModel(cfg)
report = load_safetensors(model, STUB_PATH, verbose=False)
report.summary()  # loaded= missing= unexpected= shape_mismatch=
report.ok()  # no missing, no shape_mismatch
model.lm_head.weight.data_ptr() == model.tok_embed.weight.data_ptr()  # tied
```

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/36-training-loop-eval/docs/en.md, phases/19-capstone-projects/37-loading-pretrained-weights/docs/en.md, phases/19-capstone-projects/44-cosine-lr-warmup/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss near zero, model learns nothing | No shift by one | Target at positions 1..T |
| LayerNorm scale goes to zero | Weight decay on the scale | Scale and bias in the no decay group |
| One bad batch wipes hours | Huge gradient | `clip_grad_norm_` before `step` |
| Same samples before and after load | Name map missed every tensor | Read the `LoadReport` |
| `shape_mismatch` in the report | Dims differ from the config | Loader assigns nothing. Fix the config |
| Off by one LR late in the run | Glued three part schedule | One function over `step`, test the edges |

## Pipeline eval gates
type: defaults
from: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/code/main.py

| Setting | Default | Note |
|---|---|---|
| `mmlu` | 65.0 | Must be at least this |
| `humaneval` | 40.0 | Must be at least this |
| `truthfulqa` | 50.0 | Must be at least this |
| `safety_refusal_rate` | 0.05 | Must be at most this |
| `kl_from_reference` | 25.0 | Must be at most this |
| `cost_total_usd` | 50000.0 | Must be at most this |
| `budget_usd` | 50000.0 | Run halts over budget |
| `seed` | 42 | Manifest field |

## Q&A
type: qa
from: phases/19-capstone-projects/37-loading-pretrained-weights/docs/en.md, phases/19-capstone-projects/36-training-loop-eval/docs/en.md, phases/19-capstone-projects/44-cosine-lr-warmup/docs/en.md

- **Why transpose on load?** `c_attn`, `c_proj` and `c_fc` use conv1d layout. `nn.Linear` wants the transpose.
- **Why print a sample during training?** Loss is a scalar. A sample shows a model stuck on one token.
- **Why slice eval batches once?** Identical batches make eval loss comparable across runs.
- **Where does the schedule read its step?** From `global_step` in the checkpoint, not a local counter.
