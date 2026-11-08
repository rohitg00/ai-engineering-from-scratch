# Roll out in FP8 and train in BF16

> FP8 rollout makes generation cheaper and makes the trainer and the engine disagree more, so it needs a correction.

Rollout is often the longest phase of a step. Running the engine in FP8 halves the bytes of each weight that the engine reads. The trainer keeps its weights in BF16, so the two sides now compute with different numbers on purpose.

When you finish this section, you can choose a low-precision mode, and know which correction to pair with it.

We have not run FP8 rollout on our GB10. This page comes from the Miles low-precision documentation and arguments.

## Pick a mode

The Miles documentation lists four ways to mix precisions:

| Mode | Rollout | Training | Use it when |
|---|---|---|---|
| 1 | FP8 | BF16 | you want cheaper rollout with the least change to training |
| 2 | FP8, block-wise | FP8, block-wise | rollout and training both need the speed |
| 3 | MXFP8 | MXFP8 | you train on datacenter Blackwell GPUs |
| 4 | NVFP4 | NVFP4 | you train the routed experts of a MoE model on datacenter Blackwell GPUs |

Start with mode 1. It changes only the checkpoint that the engine loads.

Mode 1 is the easiest start, but it is not safe in every case. We have not tested these limits. They come from published reports:

- A 2026 study found that FP8 rollout with BF16 training matched BF16 on rollouts below about 4K tokens. At 8K tokens it drifted away, and at 16K tokens it collapsed. It also failed sooner on tasks that were hard for the base model.
- A post by the Miles team and its partners found that this mismatch grows with MoE model size, from 30B to 1T parameters. Their answer is FP8 on both sides, as in mode 2.
- Another RL library warns about small models. There, the cost to quantize the weights at each weight update can be larger than the time that FP8 saves.

[The sources](#s-ref-sources) list the study, the post, and the library documentation.

## Set up mode 1

Give the engine an FP8 checkpoint and give the trainer the BF16 weights:

- `--hf-checkpoint` points at the FP8 checkpoint. The engine loads it.
- The trainer loads the BF16 weights. On the Megatron trainer, `--ref-load` points at them.

Mode 1 needs the Megatron trainer. The FSDP trainer loads its own weights from `--hf-checkpoint` too, so with FSDP both sides would load the FP8 checkpoint. Our GB10 runs use FSDP, which is one reason we have not run mode 1.

**Block-wise FP8:** a format that stores one scale for each block of 128 by 128 weights. The documentation lists it for Hopper GPUs, for Blackwell B200 and newer, and for AMD MI350X and MI355X.

Check the first weight update with `--check-weight-update-equal --check-weight-update-allow-quant-error`. The second flag lets the check allow the rounding that FP8 adds.

## Pair it with a correction

FP8 rounding adds to the gap between the trainer and the engine. The gap now has a cause that no kernel setting removes. The documentation pairs mode 1 with routing replay on MoE models, and with a capped importance-sampling correction as an option:

- **Importance sampling with a cap:** `--use-tis --tis-clip 2.0` weights each token by the ratio of the trainer probability to the engine probability, and caps that ratio.
- **Routing replay:** on a MoE model, add `--use-rollout-routing-replay`, so that FP8 rounding does not also change the expert choices. [Section 3.4](#s-train-a-moe-model) explains it.

[Section 8.2](#s-the-correction-methods) compares the corrections.

## What to measure

Measure the gap at step 0 and over the first steps, with and without FP8 rollout. Measure the rollout time too, because we have no numbers for how much FP8 saves on a small model.

The documentation lists B200, B300, GB200, and GB300 for modes 3 and 4. Our GB10 is not on that list, and it is not on the block-wise FP8 list either, so we cannot test these modes as documented.

```takeaways
- Start with FP8 rollout and BF16 training, and expect trouble on long rollouts, hard tasks, and large MoE models.
- Check the first weight update with the quantization tolerance on.
- Add routing replay on a MoE model, and a capped importance-sampling correction when the gap grows.
```

Sources: Miles FSDP actor at main 08752a12 (the trainer weights load from the hf_checkpoint argument), Miles low-precision documentation, weight update check arguments, and importance sampling arguments at main 08752a12; Jet-RL, arXiv 2601.14243; Unified FP8, LMSYS blog, 2025-11-25; SkyRL quantized rollouts documentation.
