# Know what deterministic inference fixes

> Deterministic inference makes the engine repeat itself, and it does not make the engine agree with the trainer.

We turned on deterministic inference to close the gap between the trainer and the engine. The gap did not move. What changed was that two runs with the same seed now gave the same rollout at step 0.

When you finish this section, you can decide when deterministic inference is worth its cost.

**Our result:** with and without deterministic inference, the median gap stayed between 0.0151 and 0.0153. Two deterministic runs repeated the rollout of step 0 exactly.

## Turn it on

Add the engine flag and an attention backend that supports it to the run of [section 1.1](#s-run-grpo-on-one-gpu), both through `MILES_EXTRA_ARGS`:

```bash
-e MILES_EXTRA_ARGS="--sglang-enable-deterministic-inference --sglang-attention-backend triton"
```

The launcher also reads `MILES_SGLANG_ATTENTION`, but only in true on-policy mode with `MILES_TRUE_ON_POLICY=1`. In a normal run, that variable changes nothing.

On our GB10, both `triton` and `flashinfer` started with the flag. The engine also switches its sampler, and the log says so:

```listing
title: the engine changes its sampler for deterministic mode
source: capture/gpu/out-gb10/deterministic-sampler.log
lang: text
note: One line from the Triton run and one from the FlashInfer run.
---
[2026-10-21 13:45:36] Sampling backend is set to pytorch for deterministic inference.
[2026-10-21 14:55:18] Sampling backend is set to pytorch for deterministic inference.
```

## The gap stays the same

We ran four 12-step runs with seed 1 on Qwen3-0.6B:

| Run | Median gap | Gap at step 0 |
|---|---|---|
| Default engine | 0.01526 | 0.015271 |
| Deterministic, Triton | 0.01518 | 0.015404 |
| Deterministic, FlashInfer | 0.01520 | 0.015320 |
| Deterministic, Triton, second run | 0.01515 | 0.015404 |

**We measured** the same gap with and without deterministic inference. The four medians are within 0.0002 of each other.

This points to the kernels as the cause: the two sides compute with different kernels. Deterministic inference makes the engine give the same result for the same input, whatever the batch around it. It does not make the engine compute like the trainer.

## The first step repeats

The two Triton runs gave the same gap at step 0, to six decimal places: 0.015404. From step 1 they drifted apart.

The engine repeated itself, and the trainer most likely did not. These runs did not set the trainer's deterministic mode, so the weights after the first update can differ between the runs. We have not tested that with the trainer flags on.

So use deterministic inference when you need to repeat an experiment, for example to test a reward function on the same samples. Do not use it to lower the gap.

```figure
id: fig-4-5
kind: chart
title: Deterministic inference repeats, and the gap stays
claim: The two deterministic Triton runs gave the same gap at step 0, and all four runs kept a gap near 0.015.
caption: The logprob gap per step for four 12-step runs with seed 1.
```

## The cost

Deterministic kernels are slower. Four steps had no heat-guard pause in all four runs: steps 0, 1, 4, and 10. On those four steps, the median rollout took 56.5 s with the default engine. The 59.1 s of [section 5.3](#s-repeat-a-run) is the same default run over its 6 clean steps. It took 79.1 to 82.0 s in the three deterministic runs, with answers of about the same length.

That is 40 to 45 percent more rollout time, from one run of each setting on a GPU under heat pauses. Treat it as an unconfirmed result. Measure the cost on your own GPU before you leave the flag on for a long run.

```takeaways
- Use deterministic inference to repeat an experiment.
- Do not use deterministic inference to close the gap with the trainer.
- Measure the rollout cost on your GPU before a long run.
```

Sources: capture/gpu/miles_grpo.py; capture/gpu/summary/miles-gb10-lab.json (runs.e6a-base, runs.e6b-det-triton, runs.e6c-det-flashinfer, runs.e6d-det-triton-repeat, median_unpaused); capture/gpu/out-gb10/deterministic-sampler.log; capture/gpu/out-gb10/engine-settings.txt; capture/gpu/out-gb10/unpaused-timing.txt.
