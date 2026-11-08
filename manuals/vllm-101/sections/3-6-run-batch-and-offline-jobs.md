# Run batch and offline jobs

> When nobody waits for the first token, push concurrency up until throughput stops growing.

You must process a large set of prompts overnight. When you finish this section, you can get the most tokens per second when latency does not matter.

**Our result:** on our L4 with Qwen3-8B, output stopped growing at 32 users, near 274 tokens per second.

## Pick the offline class or the server

For a fixed list of prompts, the offline `LLM` class runs the engine in your Python process. It has no HTTP layer and no client to tune:

```python
from vllm import LLM, SamplingParams

prompts = ["Summarize the history of Lisbon in three sentences.", "Write a haiku about the sea."]
llm = LLM(model="Qwen/Qwen3-8B")
params = SamplingParams(temperature=0.7, max_tokens=256)
outputs = llm.generate(prompts, params)
for out in outputs:
    print(out.outputs[0].text)
```

Pass the whole list in one call. The engine schedules all the prompts itself and keeps the batch full.

For a file of OpenAI requests, use the batch command:

```bash
vllm run-batch -i requests.jsonl -o results.jsonl --model Qwen/Qwen3-8B
```

Use the server when other programs must send the work, or when the job shares the GPU with live traffic.

## Find where throughput stops growing

When nobody waits for a first token, only the total output matters. Raise the concurrency until the output stops growing.

We ran `Qwen/Qwen3-8B` with 512-token prompts on our L4, in [the full-clock session](#l4-sessions) on 2026-10-17. The output grew from 13.5 tok/s with one user to 273.9 tok/s with 32 users. At 64 users it fell to 241.4 tok/s, because the pool was full and the GPU throttled. In a separate run on 2026-10-18, a fixed rate of 4 requests each second gave 286.6 tok/s, at 1,245 against 1,275 MHz. So on this card, the most output came at about 32 users at once. More users only made each request wait longer.

The ceiling on your setup depends on the model, the prompt and answer lengths, and the pool. Run [the sweep](#s-benchmark-your-server-in-15-minutes) with your own lengths to find it.

## Raise the limits for a batch job

Two limits cap the batch. Their defaults depend on the GPU memory and on how you run vLLM:

- `--max-num-seqs` caps the requests that run at once.
- `--max-num-batched-tokens` caps the tokens in one step. The offline `LLM` class has a larger default than the server. The vLLM documentation suggests a value above 8,192 for throughput, most of all for small models on large GPUs.

[The token budget page](#s-keep-long-prompts-from-stalling-short-ones) gives the default of each limit for your GPU.

A larger token budget lets long prompts finish their prefill in fewer steps. Running streams get less of each step, which a batch job does not care about.

We measured the budget on our DGX Spark, where 16,384 gave longer gaps between tokens at a low rate. [The long prompts page](#s-keep-long-prompts-from-stalling-short-ones) has the numbers. We did not measure it for a batch job.

## Check the run

Watch `vllm:num_requests_running` and `vllm:kv_cache_usage_perc`. If the cache usage stays near 1 and requests wait, the pool limits the batch. Add memory with an FP8 KV cache or a shorter maximum length. If the running count sits at the `--max-num-seqs` limit with free cache, raise the limit.

```takeaways
- Use the offline LLM class for a fixed list, and pass the whole list in one call.
- Raise concurrency until the output stops growing. On our L4 that was about 32 users.
- Raise the token budget for a batch job, because a slow first token costs nothing there.
```

Sources: capture/gpu/summary/l4.json (load.vllm, rate.vllm), vLLM documentation at v0.31.0 (docs/configuration/optimization.md), the vLLM source at v0.31.0 (vllm/entrypoints/llm.py, vllm/entrypoints/cli/).
