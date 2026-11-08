# Serve many fine-tunes with multi-LoRA

> One base model can serve many LoRA adapters, and the adapter count and rank set the cost.

You have many fine-tunes of one base model. When you finish this section, you can serve LoRA adapters per request from one base model.

## Start the server with LoRA on

A LoRA adapter is a small set of extra weights on top of a base model. The server keeps one copy of the base model and applies the adapter that each request names. Requests for different adapters can run in the same batch.

```bash
vllm serve Qwen/Qwen3-8B \
  --enable-lora \
  --lora-modules support=/adapters/support legal=/adapters/legal \
  --max-loras 4 --max-lora-rank 64
```

Each path is a folder in the PEFT format that most training libraries write. It holds `adapter_config.json` and the weights in `adapter_model.safetensors`. vLLM also reads `adapter_model.bin`. A path can also be a Hugging Face repository name.

A request picks an adapter by its name in the `model` field:

```bash
curl http://localhost:8000/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model": "support", "messages": [{"role": "user", "content": "Reset my password"}]}'
```

`/v1/models` lists the base model and each adapter.

We ran this setup on the shared second GPU of our L4 node on 2026-10-23. We used `Qwen/Qwen3-0.6B` and two public adapters of rank 8 and rank 64. `/v1/models` listed the base model, `support`, and `legal`, and a chat request to each adapter returned HTTP 200.

## Size the three limits

| Flag | Default | What it limits |
|---|---|---|
| `--max-loras` | 1 | adapters that can run in one batch on the GPU |
| `--max-lora-rank` | 16 | the largest adapter rank the server accepts |
| `--max-cpu-loras` | not set | adapters kept in CPU memory, ready to load |

The default of one adapter for each batch is low for a server with many adapters. Requests for a second adapter wait until the first adapter's batch is done. Raise `--max-loras` to the number of adapters that are busy at the same time.

Set `--max-lora-rank` to the largest rank of your adapters, not higher. The vLLM documentation advises against a large default such as 256, because the server reserves memory for the largest rank.

## Load adapters while the server runs

To add an adapter without a restart, start the server with `VLLM_ALLOW_RUNTIME_LORA_UPDATING=True`. Then post to `/v1/load_lora_adapter` with the name and the path, and to `/v1/unload_lora_adapter` to remove it. Turn this on only when you trust every caller of the server, because the route loads files from a path that the caller gives.

## Know what LoRA changes elsewhere

- **Prefix cache.** The adapter is part of each block key. Two adapters never share cached blocks, even for the same prompt.
- **CUDA graphs.** vLLM captures separate graphs for batches with an adapter. More adapters and more graph sizes add startup time and memory.
- **Names.** Since 0.31, an adapter cannot have the name of a served model.

Not measured on our hardware. We have not measured the cost of the adapter count or the rank on the L4 or the GB10.

```takeaways
- One base model serves many adapters, and a request picks one by name.
- Raise --max-loras to the number of busy adapters, and set the rank limit to your largest rank.
- Two adapters never share prefix-cache blocks.
```

Sources: the vLLM source at v0.31.0 (vllm/config/lora.py, vllm/lora/lora_model.py, vllm/lora/peft_helper.py, vllm/lora/utils.py, vllm/v1/core/kv_cache_utils.py), vLLM documentation at v0.31.0 (docs/features/lora.md), the release notes for v0.31.0, capture/gpu/out-l4/livecheck-2026-10-23.txt.
