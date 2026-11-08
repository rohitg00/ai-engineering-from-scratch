# Check the first step before you trust the run

> At step 0 the trainer and the engine hold the same weights, so the first step shows if the setup is correct.

Step 0 is the cheapest test you get. No training has happened yet, so every difference between the trainer and the engine comes from the setup, not from learning.

When you finish this section, you can check the first step of a run and stop a broken run before it trains on wrong numbers.

## Check two values at step 0

At step 0, the trainer computes the log probabilities of the samples with the same weights that the engine used. So two values must be at 0 in the step-0 metrics line:

- `train/ppo_kl`, the KL between the trainer's old and new probabilities. Before the first update they are the same.
- `train/pg_clipfrac`, the share of clipped tokens. Nothing can be clipped before the first update.

Miles asserts both in its own tests: `train/ppo_kl` below 1e-9 and `train/pg_clipfrac` below 1e-10. That assert runs only on the Megatron trainer with `--ci-test`, on the first optimizer step of each rollout. `--ci-disable-kl-checker` turns it off. On the FSDP trainer, or without that flag, read the values yourself.

All our runs logged a clip fraction of 0 at step 0.

## Compare the gap with your range

The gap between the trainer and the engine is never 0 outside true on-policy mode, because the two sides use different kernels. At step 0 it must still sit inside the range of your healthy runs:

| Our runs | Gap at step 0 |
|---|---|
| Qwen3-0.6B, no top-p or top-k, 17 runs | 0.0148 to 0.0157 |
| Qwen3-0.6B, top-p 0.95 and top-k 64 | 0.0136 |
| Qwen3-1.7B | 0.0109 |

The gap depends on the model and the sampler, so build the range for your own setup. A step-0 gap several times your range means the two sides do not compute the same model. Common causes are a wrong checkpoint path on one side, or a model format that one side reads in a different way.

## Check the weights directly

Add `--check-weight-update-equal` to a short test run, with `-e MILES_NUM_ROLLOUT=2 -e MILES_EXTRA_ARGS="--check-weight-update-equal"` on the run of [section 1.1](#s-run-grpo-on-one-gpu). After the first weight update, Miles compares the engine weights with the trainer weights. With FP8 or another low-precision engine, add `--check-weight-update-allow-quant-error` so that the check allows the expected rounding.

Run this check once for each new model or image, not on every long run.

```takeaways
- Read train/ppo_kl and train/pg_clipfrac at step 0, and expect both at 0.
- Compare the step-0 gap with the range of your healthy runs.
- Run one short test with --check-weight-update-equal for each new model or image.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (per_step[0] of each run); Miles metric checks, the Megatron model loop, and weight update check arguments at main 08752a12.
