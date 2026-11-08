# Check if your GPU can run true on-policy mode

> True on-policy mode makes the trainer and the engine match bit for bit, but only for the models and GPUs its contract covers.

True on-policy mode promises a gap of exactly 0 between the trainer and the engine. On our GB10 it did not start, and the run did not tell us so.

When you finish this section, you can check your GPU and model before you plan a true on-policy run.

## Check the contract before you start

The Miles versions we checked have one true on-policy contract. It covers dense Qwen3 models: Qwen3-0.6B and three Qwen3-4B variants. Both sides must run FlashAttention 3: the engine as its attention backend, and the trainer as its attention implementation.

FlashAttention 3 is built for Hopper GPUs. The engine check accepts compute capability 8.0 to 9.0 and refuses newer GPUs. So check two things before you plan the run:

1. Your GPU is a Hopper GPU, such as an H100 or an H200.
2. Your model is in the contract.

If either answer is no, true on-policy mode cannot start.

## What happens on another GPU

Our GB10 is a Blackwell GPU with compute capability 12.1. The engine stopped during startup:

```listing
title: FlashAttention 3 refuses the GB10
source: capture/gpu/out-gb10/engine-died-503.log
lang: text
note: The first engine lines of the true on-policy run.
---
[2026-10-17 21:03:03] Enable deterministic inference because of legacy rl_on_policy_target.
AssertionError: FlashAttention v3 Backend requires SM>=80 and SM<=90. Please use `--attention-backend flashinfer`.
```

The trainer kept going and sent requests to the dead engine for an hour. [Section 1.2](#s-add-a-watchdog) shows that part, and the watchdog that stops it.

The error suggests FlashInfer. Do not take that advice for true on-policy mode, because the contract names FlashAttention 3 on both sides. With FlashInfer you get a normal run, not a bit-exact one.

## What to use instead

Outside the contract, watch the gap and lower it where you can:

- [Section 4.4](#s-lower-the-logprob-gap) lowers the part that comes from top-p and top-k sampling.
- [Section 4.5](#s-use-deterministic-inference) makes the engine repeat itself, which helps you repeat an experiment.
- [Section 5.2](#s-check-the-first-step) checks that the gap at step 0 is in a healthy range.

On our GB10, every step of every finished Qwen3-0.6B run without top-p or top-k gave a gap between 0.0136 and 0.0164. That is the range to compare against on this setup.

```takeaways
- Before you plan true on-policy mode, check the GPU generation and the model list.
- Add a watchdog, because a failed engine start does not stop the run.
- Outside the contract, watch the gap and lower the sampler part of it.
```

Sources: capture/gpu/out-gb10/engine-died-503.log; capture/gpu/summary/miles-gb10-lab.json (logprob_abs_diff per run); Miles true on-policy contract and model profiles at main 08752a12.
