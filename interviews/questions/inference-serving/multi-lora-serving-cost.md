---
id: multi-lora-serving-cost
title: What many LoRA adapters cost one server
card: inference-serving
kind: design
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [system-design, screen]
tags: [lora, adapters, max-loras, prefix-cache, cuda-graphs]
minutes: 8
lessons: [phases/17-infrastructure-and-production/09-production-quantization]
manuals: [vllm-101#s-serve-many-fine-tunes-with-multi-lora, sglang-101#s-prefix-friendly-prompts]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You have twenty fine-tunes of one base model, each a LoRA adapter, and you want to serve them from one vLLM server. What do you set, what decides the cost, and what else in the server changes when LoRA is on?

## Short answer

Turn LoRA on at startup with `--enable-lora`, name the adapters with `--lora-modules`, and let each request pick one in its `model` field. Three limits set the cost: `--max-loras`, which defaults to 1 and caps the adapters that run in one batch, `--max-lora-rank`, which defaults to 16 and reserves memory for the largest rank, and `--max-cpu-loras` for adapters kept in CPU memory ready to load. LoRA also changes the prefix cache, because the adapter is part of every block key, so two adapters never share cached blocks, and it adds CUDA graphs per adapter, so startup takes longer and uses more memory.

## Full answer

### Start it

```bash
vllm serve Qwen/Qwen3-8B \
  --enable-lora \
  --lora-modules support=/adapters/support legal=/adapters/legal \
  --max-loras 4 --max-lora-rank 64
```

Each path is a folder in the PEFT format that most training libraries write: `adapter_config.json` and the weights in `adapter_model.safetensors`, or `adapter_model.bin`. A request picks an adapter by its name in the `model` field, and `/v1/models` lists the base model and each adapter. Requests for different adapters can run in the same batch. The manual ran this with Qwen3-0.6B and two public adapters of rank 8 and rank 64, and a chat request to each adapter returned HTTP 200.

### Size the three limits

| Flag | Default | What it limits |
|---|---|---|
| `--max-loras` | 1 | adapters that can run in one batch on the GPU |
| `--max-lora-rank` | 16 | the largest adapter rank the server accepts |
| `--max-cpu-loras` | not set | adapters kept in CPU memory, ready to load |

The default of one adapter per batch is low for a server with many adapters. Requests for a second adapter wait until the batch of the first adapter is done. Raise `--max-loras` to the number of adapters that are busy at the same time. Set `--max-lora-rank` to the largest rank of your adapters and not higher: the server reserves memory for the largest rank it accepts, and the documentation advises against a large default such as 256. Adapters in CPU memory load fast when a request names them, so size `--max-cpu-loras` for the adapters that are warm.

### Load adapters while the server runs

With `VLLM_ALLOW_RUNTIME_LORA_UPDATING=True` you can post to `/v1/load_lora_adapter` with a name and a path, and to `/v1/unload_lora_adapter` to remove it. Turn this on only when you trust every caller of the server, because the route loads files from a path that the caller gives.

### What changes elsewhere

- **The prefix cache.** The adapter is part of each block key in vLLM and of the tree key in SGLang. Two adapters never share cached blocks, even for the same prompt. A shared system prompt is cached once per adapter, not once.
- **CUDA graphs.** vLLM captures separate graphs for batches with an adapter. More adapters and more graph sizes add startup time and memory.
- **Names.** Since 0.31 an adapter cannot have the name of a served model.

The manual did not measure the cost of the adapter count or the rank on its hardware.

### Pick the base format with LoRA in mind

The lesson's picking guide says that a 4-bit GPTQ base supports LoRA adapters in vLLM, with the fast Marlin kernels, while the microscaling 4-bit formats did not support LoRA at the start of 2026. For a base model plus many fine-tuned variants, GPTQ is the 4-bit path; AWQ is the pick when there is no LoRA, and FP8 when quality must not move.

## Follow-ups

- **Level 2:** Two tenants send the same long system prompt through two different adapters. Does the second request hit the cache? Expected: no; the adapter is part of the block key in vLLM and of the tree key in SGLang, so two adapters never share blocks even for identical tokens.
- **Level 3:** Requests for the second adapter wait although the GPU is idle. Why? Expected: the adapter cap defaults to 1, so only one adapter runs in a batch and requests for another adapter wait until that batch is done; raise it to the number of adapters that are busy at the same time.
- **Level 3:** Why not set the rank limit to 256 to be safe? Expected: the server reserves memory for the largest rank it accepts, so a high limit takes memory from the KV pool for adapters you do not have; set it to your largest rank.
- **Level 4:** You also want 4-bit weights for the base model. Which format, and what does it rule out? Expected: a GPTQ 4-bit base, because it supports LoRA adapters in vLLM with the Marlin kernels; the microscaling 4-bit formats did not support LoRA at the start of 2026, so they are out until they do.

## Wrong answers

- "One server per adapter is simpler." Each server would hold its own copy of the base model and its own pool; one base with adapters per request shares both, and requests for different adapters can run in the same batch.
- "The default limits are fine." One adapter per batch makes requests for a second adapter wait, and a rank limit of 16 rejects a rank-64 adapter; set both from the adapters you serve.
- "Enable runtime adapter loading so that operators can add adapters without a restart." The load route reads files from a path that the caller gives, so turn it on only when you trust every caller of the server.
- "LoRA is free for the prefix cache because the base model is the same." The adapter changes the keys and values, so it is part of the block key, and two adapters never share cached blocks.

## Taught in

[Serve many fine-tunes with multi-LoRA](../../../manuals/vllm-101/sections/3-7-serve-many-fine-tunes-with-multi-lora.md) gives the flags and limits, [Prefix-friendly prompts](../../../manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md) notes the tree key, and [the production quantization lesson](../../../phases/17-infrastructure-and-production/09-production-quantization/docs/en.md) pairs a 4-bit base with adapters.
