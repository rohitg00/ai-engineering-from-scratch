# Metrics

> The metrics this manual reads, with their range on our setup.

The ranges come from our lab runs: Qwen3-0.6B on GSM8K on one GB10, 32 prompts with 8 answers each, a limit of 1,024 tokens. They hold for that setup. Build your own ranges from two or three seeds of yours.

## Rollout

| Metric | Meaning | Our range |
|---|---|---|
| `rollout/raw_reward` | the mean reward of the step | 0.53 to 0.87 per step over 48 steps |
| `rollout/response_lengths` | the mean answer length in tokens | 396 to 787 |
| `rollout/truncated` | the share of answers that hit the length limit | 0.02 to 0.43 |

## Training

| Metric | Meaning | Our range |
|---|---|---|
| `train/train_rollout_logprob_abs_diff` | the mean absolute gap between the trainer and engine log probabilities, per token | 0.0136 to 0.0164 with plain sampling |
| `train/train_rollout_kl` | the KL between the engine and trainer distributions at the sampled tokens | 0.00063 to 0.00076 |
| `train/grad_norm` | the gradient norm | 0.35 to 4.95 |
| `train/pg_clipfrac` | the share of tokens where the update hit the clip limit | 0 at every step |
| `train/ppo_kl` | the KL between the old and the new trainer probabilities | 0 at step 0 in a healthy run |
| `train/entropy_loss` | the entropy term of the loss | 0 in our runs |

## Time

| Metric | Meaning | Our value |
|---|---|---|
| `perf/step_time` | the full step | 152.6 s median of 48 steps, in a run made before the heat guard |
| `perf/rollout_time` | the rollout phase | 47.5 s median of 48 steps, in a run made before the heat guard |
| `perf/log_probs_time` | the trainer scoring of the samples | 23.4 s median of 48 steps, in a run made before the heat guard |
| `perf/train_time` | the training phase, with the scoring | 100.3 s median of 48 steps, in a run made before the heat guard |
| `perf/update_weights_time` | the copy of new weights into the engine | 0.63 to 0.65 s for Qwen3-0.6B |
| `perf/sleep_time` | the trainer moving its state to host memory after training | 0.76 s median over 48 steps for Qwen3-0.6B, and 1.9 to 3.7 s in the first two steps of the same 48-step run |
| `perf/wake_up_time` | the trainer moving its state back before the log probabilities | 0.87 s median over 48 steps for Qwen3-0.6B |
| `perf/train_wait_time` | the time the trainer waits for samples | logged in every step |

Time values hold only for steps that no heat-guard pause touched. [The lab notes](#s-ref-lab-notes) give the rule.

## Evaluation and async

| Metric | Meaning |
|---|---|
| `eval/lag_steps` | how many steps late an eval on a dedicated fleet finished |
| the weight version statistics in the rollout metrics | how old the samples of an async run are |

We did not run evaluation or async training, so this table has no ranges.

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.plain-48, runs.plain-48-s2, runs.plain-48-s3, runs.e4-0.6b); capture/gpu/out-gb10/thermostat.log; Miles loss, metric, and evaluation code at main 08752a12.
