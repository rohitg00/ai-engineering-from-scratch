# Flags by job

> The Miles flags this manual uses, grouped by the job they do.

The value column gives the setting of our lab runs where we set it. A dash means our runs did not set the flag.

## Model and data

| Flag | Our value | What it sets |
|---|---|---|
| `--hf-checkpoint` | the Qwen3-0.6B folder | the model that the engine and the FSDP trainer load |
| `--prompt-data` | the GSM8K training file | the prompts |
| `--input-key`, `--label-key` | `messages`, `label` | the fields of each data row |
| `--apply-chat-template` | on | wraps each prompt in the chat template of the model |
| `--rollout-shuffle` | on | shuffles the prompts |

## Rollout

| Flag | Our value | What it sets |
|---|---|---|
| `--num-rollout` | 12, 24, or 48, and 4 in the model-size runs | the number of steps |
| `--rollout-batch-size` | 32 | prompts per step |
| `--n-samples-per-prompt` | 8 | answers per prompt |
| `--rollout-max-response-len` | 1024, and 256 in the model-size runs | the answer limit in tokens |
| `--rollout-temperature` | 1 | the sampling temperature |
| `--rollout-top-p`, `--rollout-top-k` | 0.95, 64 in one run | the sampler, and sampling replay when set |
| `--rollout-num-gpus-per-engine` | 1 | GPUs per engine |
| `--rollout-seed` | the run seed | the sampling seed |
| `--partial-rollout` | - | continues long answers in a later step |
| `--over-sampling-batch-size` | - | the batch of new prompts when finished groups run short |
| `--dynamic-sampling-filter-path` | - | the group filter |

## Reward and loss

| Flag | Our value | What it sets |
|---|---|---|
| `--rm-type` | `math` | the built-in reward |
| `--custom-rm-path` | - | your own reward function |
| `--advantage-estimator` | `grpo` | the advantage method |
| `--global-batch-size` | 256 | samples per optimizer step |
| `--eps-clip`, `--eps-clip-high` | 0.2, 0.28 | the clip range of the update |
| `--kl-loss-coef`, `--kl-coef`, `--entropy-coef` | 0 | the KL and entropy terms |
| `--lr` | 1e-6 | the learning rate, constant |
| `--use-tis`, `--tis-clip` | - | truncated importance sampling |
| `--use-rollout-routing-replay` | - | routing replay for MoE models |

## Placement and memory

| Flag | Our value | What it sets |
|---|---|---|
| `--colocate` | on | trainer and engine on the same GPU, with offload |
| `--train-backend` | `fsdp` | the trainer |
| `--actor-num-nodes`, `--actor-num-gpus-per-node` | 1, 1 | trainer GPUs |
| `--sglang-mem-fraction-static` | 0.4, 0.25 in three runs, 0.2 in one 4B run | the engine share of GPU memory |
| `--offload-rollout-level` | the default, `kv_cache` in one run | what the engine gives back between phases |
| `--no-offload-rollout`, `--no-offload-train` | in two runs and in one run | keep one side loaded |
| `--update-weight-buffer-size` | 536870912 | the weight update bucket, in bytes |
| `--update-weight-transfer-mode` | - | the weight transfer method in a split layout |

## Engine

| Flag | Our value | What it sets |
|---|---|---|
| `--sglang-attention-backend` | the default, or `triton` or `flashinfer` | the engine attention kernel |
| `--sglang-enable-deterministic-inference` | in three runs | deterministic engine kernels |
| `--sglang-enable-metrics` | on | the engine metrics |
| `--use-session-server` | - | token-in, token-out sessions for agents |
| `--use-miles-router` | - | the Python router instead of the default |

## Checks and debugging

| Flag | Our value | What it sets |
|---|---|---|
| `--seed` | the run seed | the trainer seed |
| `--save-debug-event-data` | a folder per run | the events of each step |
| `--save-debug-rollout-data`, `--load-debug-rollout-data` | - | saves and replays rollout samples |
| `--debug-train-only`, `--debug-rollout-only` | - | runs one side alone |
| `--check-weight-update-equal` | - | compares engine and trainer weights after the first update |
| `--use-fault-tolerance`, `--ft-components` | - | fault tolerance |
| `--save`, `--save-interval`, `--load` | - | checkpoints |

Sources: capture/gpu/miles_grpo.py; capture/gpu/out-gb10/engine-settings.txt; Miles arguments at main 08752a12.
