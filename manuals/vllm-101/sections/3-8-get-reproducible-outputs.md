# Get reproducible outputs

> A seed alone does not give the same output in a busy batch, and batch invariance costs speed.

You run evals and the scores change between runs. When you finish this section, you can get the same output for the same request.

## Know why outputs change

The vLLM documentation says that vLLM does not promise the same output by default, for the sake of speed. Three things change the result of one request:

- **The batch.** The kernels split their sums by the batch size. The same request adds its numbers in a different order in a batch of 3 than in a batch of 30. Floating-point sums depend on the order. A small difference in one logit can change a sampled token, and every later token then differs.
- **The schedule.** In the default multiprocess server, the timing of requests decides which batch each one joins.
- **The prefix cache.** A request that reuses cached blocks computes its prompt in a different way than a request with no cache hit. In our runs on 0.31.0, a warm cache changed the greedy output of 11 of 32 prompts. The 2026 paper "Same Request, Different Answer" found the same effect on vLLM 0.11.
- **The dtype.** BF16 and FP16 round each number differently, so the same model in the two dtypes writes different text.

The seed defaults to 0 in the current engine, and you cannot unset it. Speculative decoding needs every worker to sample the same tokens. So a seed is always there, and it is not enough by itself.

## Pick the fix for your case

| Case | Fix | Cost |
|---|---|---|
| Offline evals with the `LLM` class | set `VLLM_ENABLE_V1_MULTIPROCESSING=0`, use the same seed, and send the same prompts in the same order | the engine runs in your process, so the schedule repeats |
| A server with live traffic | turn on the batch-invariant mode, as the next section shows | slower kernels for every request |
| Greedy evals that must match exactly | combine greedy sampling with one of the two fixes above | as above |

Every fix also needs the same hardware, the same vLLM version, and the same settings. A new release or a new GPU changes the kernels, and the outputs change with them.

## Turn on the batch-invariant mode

Set one environment variable when you start the server:

```bash
VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3-8B 2>&1 | tee server.log
```

The mode needs an NVIDIA GPU with compute capability 8.0 or higher, which includes the L4 and the GB10. The vLLM documentation lists Qwen3-8B among the models it tested in this mode. The mode turns off some speed features that change the order of the sums, such as custom all-reduce with tensor parallelism.

We ran one probe with the small Qwen3-0.6B on an L4. With the mode on, a greedy prompt gave the same text alone and inside a batch of 32 requests. With the mode off, the two texts differed. One prompt on one small model proves little for yours, so run the test at the end of this page on your own model.

## See what changed the output in our runs

We sent ShareGPT questions after one shared system prompt of about 170 tokens, greedy, with 128 output tokens and thinking off. We compared each output with the output of a second run, token by token. This was on the second GPU of our L4 node on 2026-10-22 and 2026-10-23, with `Qwen/Qwen3-0.6B`. That GPU is shared with its owner and had no clock lock.

A clock changes the speed of a run. It does not change the greedy tokens. Each count is still one session on one GPU.

```listing
title: outputs that differ at one user, out of 32
source: capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt
lang: text
note: The table for concurrency 1. The number in brackets is the median position of the first token that differs. The SGLang column comes from the same probe on SGLang 0.5.22.
---
comparison                     SGLang 0.6B   vLLM 0.6B
flushed repeat against fresh   0 of 32       0 of 32
cache off against cache off    0 of 32       0 of 32
fresh against warm cache       21 of 32 (45) 11 of 32 (57)
cache on against cache off     25 of 32 (26) 21 of 32 (48)
```

- **One user, the same cache state.** A repeat after a cache reset, or a repeat with the cache off, gave the same text for all 32 prompts.
- **One user, a warm cache.** The same prompts against a warm cache changed 11 of 32 outputs. The cache on against the cache off changed 21 of 32.
- **Many users.** At 64 users sent at once, two runs with the cache off differed in 50 of 64 outputs. The batch alone changed most outputs, so the cache effect could not be separated at that load.
- **The dtype.** We sent 64 questions at one user with the cache off. BF16 against FP16 changed 48 of 64 outputs for Qwen3-0.6B and 56 of 64 for Qwen3-1.7B. The first different token came at a median position of 51 and 56. A repeat in the same dtype changed none.

So at one user, a cache reset is enough to repeat a greedy output exactly. Under load, a reset was not enough in our runs. For a live server, the batch-invariant mode is the fix this page covers, and we did not test it at that load. Our counts come from small models and one GPU, so test your own model.

## Know what the batch-invariant mode does not cover

At 0.31.0 the mode is in beta. Work by other teams shows three limits. We did not measure them ourselves:

- **The speed cost.** In the post "Defeating Nondeterminism in LLM Inference" of September 2025, Thinking Machines Lab ran 1,000 Qwen3-8B requests on vLLM. They took 26 s by default and 55 s with batch-invariant kernels, and 42 s with a better attention kernel. The 2026 CoRun paper reports that batch-invariant kernels more than double the latency and cut throughput by up to 74 percent.
- **Other changes in execution.** The 2026 paper "Vosti: Specifying, Implementing, and Verifying Deterministic LLM Inference" tested changes such as prompt chunking and KV cache reuse. The batch-invariant mode of vLLM gave different logits under some of them.
- **Some model paths.** At 0.31.0, a model that picks its own attention backend skips the check for the mode, so its output can still depend on the batch. Release 0.32.0 checks the backend of every attention layer. A fix for MoE models with data, tensor, and expert parallelism under torch.compile is not in 0.32.0.

So test the exact setup that you serve: the model, the parallel layout, the prefix cache setting, and the token budget.

## Check the result

Run the same eval twice and compare the outputs token by token, not only the score. Between the two runs, reset the prefix cache or restart the server, as [the benchmark page](#s-benchmark-your-server-in-15-minutes) shows. If the outputs differ, send one failing prompt alone twice. If the two answers match when alone, the batch causes the difference.

## Know the speed cost on our L4

We measured the cost on our L4 on 2026-10-23, with the clock locked at 900 MHz. The runs went in the order default, batch-invariant, default again, with two seeds each and a cache reset before each run.

```listing
title: the batch-invariant mode against the default, Qwen3-0.6B on vLLM 0.31.0
source: capture/gpu/out-l4/batch-invariant-cost.txt
lang: text
note: The Qwen3-0.6B rows, where every run had a median clock of 900 MHz. The setup lines before them and the Qwen3-8B rows after them are cut.
---
…
users   median TPOT default / batch-invariant   output tok/s default / batch-invariant
1       6.9 / 16.9 ms (2.4x)                    140.6 / 58.7 (58% lower)
8       9.9 / 18.2 ms (1.8x)                    755 / 420 (44% lower)
32      18.8 / 25.9 ms (1.4x)                   1,565 / 1,154 (26% lower)
…
```

On `Qwen/Qwen3-8B` at 8 users, the time per token was 1.4 times longer and the output tok/s 27 percent lower. At 32 users they were 1.3 times longer and 23 percent lower. The 1-user runs of the 8B model ran below the lock, so we leave them out. The relative cost fell as more users shared each step, and it was larger on the small model. Measure it on your model before you turn the mode on for a live server.

```takeaways
- A seed is not enough, because the batch changes the order of the sums.
- Offline, run the engine in one process with the same seed and order.
- Online, the batch-invariant mode is the main fix, but it costs speed and misses some paths.
- Reset the prefix cache between two runs that you compare.
- Keep the dtype the same between two runs that you compare.
```

Sources: vLLM documentation at v0.31.0 (docs/usage/reproducibility.md, docs/features/batch_invariance.md), the vLLM source at v0.31.0 (vllm/envs.py), Same Request, Different Answer: Quantization Amplifies Cache-Induced Divergence in LLM Serving (arXiv 2609.04748, 2026), Defeating Nondeterminism in LLM Inference by Horace He and Thinking Machines Lab (2025-09-10), CoRun: Padding is Simple and Efficient for Deterministic LLM Inference (arXiv 2608.14376, 2026), Vosti: Specifying, Implementing, and Verifying Deterministic LLM Inference (arXiv 2609.38981, 2026), the release notes for v0.32.0 (attention backend check for the batch-invariant mode), vLLM pull request 61118 (inductor batch-invariant mode, merged on 2026-10-17 and not in v0.32.0), capture/gpu/out-l4/livecheck-2026-10-22.txt, capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt, capture/gpu/out-l4/batch-invariant-cost.txt.
