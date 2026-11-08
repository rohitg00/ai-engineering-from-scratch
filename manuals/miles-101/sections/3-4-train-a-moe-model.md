# Train a mixture-of-experts model with routing replay

> Routing replay makes the trainer use the same experts that the engine chose, so the two sides agree on which weights each token used.

In a mixture-of-experts model, a router picks a few experts for each token. The engine and the trainer each run that router. A tiny numeric difference can make them pick different experts for the same token, and then they compute that token with different weights.

When you finish this section, you can decide when to turn on routing replay and what to watch when you do.

We have not run a mixture-of-experts model with Miles on our GB10. This page comes from the Miles source and release notes.

## Why the gap is worse on a MoE model

On a dense model, the gap between the two sides comes from small rounding differences. On a MoE model, the same rounding can flip an expert choice. A flipped choice is a large difference. The token goes through other weights, and its probability can change a lot.

So a MoE run can show a larger gap than a dense model, even when the dense parts of the model agree well.

## Turn on routing replay

The flag works only for MoE models. Add it with `MILES_EXTRA_ARGS`, as in [section 1.1](#s-run-grpo-on-one-gpu-add-flags-to-a-run). The Qwen MoE models are too large for full training on one 128 GB machine, as [section 2.1](#s-pick-a-model-size) shows. Our launcher starts one GPU, so use a launcher sized for your GPUs, and pass the same flag:

```bash
-e MILES_EXTRA_ARGS="--use-rollout-routing-replay"
```

**Routing replay:** the engine records the experts it chose for each token during rollout, and the trainer uses those same experts in its forward pass. The flag works only for MoE models.

Some models need a matching engine setting. The Miles notes for GLM-5.3-Flash ask for `--sglang-moe-runner-backend triton` with replay.

## What the Miles team reports

The Miles team ran colocated MoE jobs with routing replay on 8 nodes of 4 GB300 GPUs. Their v0.1.1 release notes give the gap per token for each model. [The sources](#s-ref-sources) list the notes and the routing replay paper.

| Model | Steps | Gap with replay | Reward |
|---|---|---|---|
| Qwen3.8-Flash-Next | 5 | 0.0083 to 0.0131 | 0.47 to 0.75 |
| GLM-5.3-Flash | 3 | 0.0085 to 0.0098 | 0.50 to 0.72 |

The GLM-5.3-Flash page of the Miles documentation reports a longer run on 16 nodes of 4 GB300 GPUs. Its gap was 0.0068 to 0.0106 over the first 11 steps.

These are short runs on hardware we do not have. Read them as the range a working setup reaches, not as a promise for your model.

## A known limit

If the engine pauses a request and later prefills it again under new weights, the routes from the second prefill can overwrite the recorded routes. An open Miles issue tracks this. If you use a pause mode that retracts requests, check the gap after each weight update.

```takeaways
- Turn on routing replay for every mixture-of-experts run.
- Read the gap per step, and compare it with a run without replay.
- Check the engine setting that your model needs with replay.
```

Sources: Miles routing replay arguments and release notes v0.1.1 at main 08752a12; Miles GLM-5.3-Flash model documentation; Rollout Routing Replay paper, arXiv 2510.11370; Miles issue 3277.
