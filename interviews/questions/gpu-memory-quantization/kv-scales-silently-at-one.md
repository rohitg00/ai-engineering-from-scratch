---
id: kv-scales-silently-at-one
title: The FP8 KV scales that never loaded
card: gpu-memory-quantization
kind: debug
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [fp8, kv-cache, scales, accuracy, checkpoint]
minutes: 8
lessons: []
manuals: [vllm-101#s-fit-more-users-with-an-fp8-kv-cache, sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You enabled an FP8 KV cache on a checkpoint that ships calibrated scales, and accuracy on your eval dropped. The startup log contains a line about the scaling factor. What happened, how do you confirm it, and what are your options?

## Short answer

The server is running the cache with a scale of 1.0, because the loader did not use the scales in the checkpoint: vLLM prints `Using KV cache scaling factor 1.0` when that is the case. SGLang prints `Using FP8 KV cache but no scaling factors provided` whenever no `--quantization-param-path` is passed, so its warning alone does not show which scales the server uses. Confirm the vLLM case by searching the weight index of the checkpoint for tensors that end in `k_scale` or `v_scale`; if they exist and vLLM still prints the warning, the loader dropped them, which at 0.31.0 happens for one whole model family and for one draft loader in open issues. The options are another checkpoint or version whose scales load, a scale file passed through the quantization parameter path on SGLang, or a BF16 cache until they do, with an accuracy run on your own task after each change.

## Full answer

### What a scale does

FP8 needs a scale for each tensor to map the range of the keys and values into the format. Without one, every scale is 1.0. The vLLM team treats that as the worst case for accuracy. In their tests of uncalibrated caches most models stayed close to BF16, and one model family on a latent-attention backend did not work well without calibrated scales. A fix in SGLang for dropped scales on compressed-tensors checkpoints measured GSM8K at 0.960 with the scales dropped and 0.965 with them loaded, on a checkpoint whose scales were close to 1.0; a checkpoint with scales far from 1.0 loses more.

### Confirm it in three steps

1. Look for the scales in the checkpoint. Search the weight index for tensor names that end in `k_scale` or `v_scale`:

```bash
grep -oE '"[^"]*(k|v)_scale"' model.safetensors.index.json | sort -u
```

No output means that the checkpoint has no scales. A checkpoint with one weight file has no index; list its tensor names with the safetensors package instead.

2. Read the startup log. In vLLM the scaling factor warning with scales present in the checkpoint means that the loader dropped them. In SGLang the provided-scales warning prints whenever you pass no scale file, so it alone does not say which scales the server uses; a warning about a missing `k_scale` or `v_scale` parameter does say that the loader skipped them.

3. Run your own prompts with and without the FP8 cache and compare the answers before you go to production.

### The loaders at the pinned versions

At vLLM 0.31.0 one model family never loads its KV scales, and one speculative draft loader drops them too; both issues are open. SGLang dropped the KV scales of compressed-tensors checkpoints before a fix merged on 2026-08-20, and the log reported each `k_scale` parameter as not found; the fix is in v0.5.22. A later release of vLLM also fixed a case where a level 2 sleep cleared calibrated scales and the first request after a reload returned wrong values.

### Weight scales are not KV scales

The FP8 checkpoint of Qwen3-30B-A3B lists weight scales and no KV scales in its index, so its cache ran with a scale of 1.0 on the manual's GB10. An FP8 checkpoint says nothing about its cache until you look.

### What the manual measured without scales

Qwen3-8B has no KV scales, so the manual's FP8 KV runs used a scale of 1.0. On 500 GSM8K questions, 8-shot and greedy, vLLM scored 90.8 percent with the FP8 cache against 91.8 in BF16, and SGLang 91.6 against 91.6. Every interval overlapped. That is not a licence: 500 questions cannot rule out a loss of a few points, it is one model and one benchmark, and a model with another attention layout can lose more.

### The options

- Another checkpoint, or another engine version, whose scales load; read the log after the change.
- On SGLang, a scale file through `--quantization-param-path`.
- A BF16 cache until the scales load, and the capacity from FP8 weights instead.
- In every case, the accuracy run on your own task, with the cached warning read as a defect to track.

## Follow-ups

- **Level 3:** The checkpoint has one weight file and no index. How do you look for the scales? Expected: list the tensor names with the safetensors package instead of searching the index, and look for names that end in k_scale or v_scale.
- **Level 3:** The warning prints, but your GSM8K run shows no loss. Are you done? Expected: no; 500 questions cannot rule out a loss of a few points, the loss depends on the model and its attention layout, and one family needed calibrated scales while most did not; run your own task and track the warning as a defect.
- **Level 4:** Why do calibrated scales matter more for some attention layouts than for others? Expected: the scale maps the range of the keys and values into the FP8 range, and a layout whose values spread wider than the format clips or loses precision at a scale of 1.0; the vLLM team named one latent-attention family that did not work well uncalibrated while most models stayed close to BF16, so the layout and the calibration decide together.

## Wrong answers

- "The checkpoint is FP8, so the KV scales are loaded." Weight scales and KV scales are different tensors, and a checkpoint with KV scales can still have them dropped by the loader; the warning tells you what the server uses.
- "The warning is informational." On vLLM it means that every KV scale is 1.0, which the vLLM team treats as the worst case for accuracy; with scales in the checkpoint it means that the loader dropped them.
- "A scale of 1.0 worked for Qwen3-8B, so it works." It gave overlapping intervals on 500 GSM8K questions for one model, which cannot rule out a loss of a few points, and another family lost accuracy at 1.0.
- "Pass --quantization fp8 to load the scales." The weight method and the cache scales are separate; on SGLang the scales come from the checkpoint or from the quantization parameter path file, and a weight flag that does not match the checkpoint raises at startup.

## Taught in

[Fit more users with an FP8 KV cache](../../../manuals/vllm-101/sections/2-4-fit-more-users-with-an-fp8-kv-cache.md) and [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) show the scale warnings and how to check that scales load.
