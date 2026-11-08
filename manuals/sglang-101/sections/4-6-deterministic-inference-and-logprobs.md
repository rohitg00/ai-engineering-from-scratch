# --enable-deterministic-inference and logprobs

> The same prompt can give different tokens when the batch around it changes, and SGLang fixes the reduction order for each model and backend it has tested.

You run an evaluation twice at temperature 0 and the scores differ. You send one prompt alone and then inside a busy batch, and the second answer diverges after forty tokens. Nothing in your request changed. The server changed the batch your request ran in, and the batch changed the arithmetic.

When you finish this section, you can explain why batching changes output and what deterministic mode switches. You can also read the logprobs SGLang returns and test whether your model is deterministic.

## The cost: addition order depends on the batch

Floating-point addition is not associative. Summing the same numbers in a different order can change the last bits of the result. A matrix multiply, a softmax, or a norm splits its sums into tiles, and many kernels pick the tile split from the batch size. A request in a batch of 1 and the same request in a batch of 37 go through different splits.

A difference in the last bit can change which token has the highest logit. After one different token, every later token is conditioned on a different text. Thinking Machines described this effect in a 2025 post on nondeterminism in inference {{field Thinking Machines 2025-09}}, and SGLang built its deterministic mode on the same approach.

**Batch invariance:** a kernel property. The result for one row does not depend on the other rows in the batch, because the reduction order is fixed.

## What the flag switches

`--enable-deterministic-inference` is off by default. `--rl-on-policy-target fsdp` turns it on too. When it is on, startup does the following:

1. It replaces the PyTorch operators `aten::mm`, `addmm`, `_log_softmax`, `mean.dim`, `rms_norm`, and `bmm` with batch-invariant kernels.
2. It forces the `pytorch` sampling backend.
3. With tensor parallelism on CUDA, it sets `NCCL_ALGO=allreduce:tree`, so the all-reduce sums in a fixed order. On AMD it uses a one-stage all-reduce.
4. It accepts only the attention backends `ascend`, `fa3`, `fa4`, `flashinfer`, `intel_xpu`, and `triton`.
5. It turns the radix cache off unless the attention backend is `ascend`, `fa3`, `fa4`, or `triton`.
6. It gives every request without a `sampling_seed` the seed 42.

```figure
id: fig-4-9
kind: comparison
title: one row reduced in two batches
claim: A default kernel splits the same row differently in two batches, and a batch-invariant kernel uses one split for every batch.
caption: Read each column top to bottom. The row is one request, and the tiles are partial sums. From the batch-invariant operator overrides at v0.5.22.
```

The fifth point matters most for a server. With `flashinfer`, deterministic mode turns off prefix caching. Every repeated prefix pays its full prefill again. [Section 3.3](#s-radixcache) explains what that cache saves.

## Logprobs are temperature-scaled

**Logprob:** the log probability of a token under the distribution the server sampled from. SGLang returns it when a request sets `return_logprob` or the OpenAI `logprobs` field.

The sampler computes returned logprobs as `log_softmax(logits / temperature)` when the batch is not all greedy. It returns `log_softmax(logits)` without the temperature only for all-greedy batches or when the environment variable `SGLANG_RETURN_ORIGINAL_LOGPROB` is set. A request at temperature 0.7 gets logprobs of the sharpened distribution.

In our test, top-p did not change the returned value. The test used `return_logprob` at temperature 1 and top-p 0.9. We ran it on the second GPU of our L4 node on 2026-10-23, with `Qwen/Qwen3-0.6B` in BF16. We sent 16 prompts of 48 tokens. We compared each returned logprob with a float32 Transformers pass over the full vocabulary.

```listing
title: returned logprob minus the full-vocabulary reference
source: capture/gpu/out-l4/logprobs-top-p.txt
lang: text
note: The two SGLang rows. The vLLM rows are cut. ORIGINAL_LOGPROB is short for SGLANG_RETURN_ORIGINAL_LOGPROB.
---
engine and mode                                  returned minus reference, median   median absolute
…
SGLang return_logprob, ORIGINAL_LOGPROB=0        0.0000                             0.0066
SGLang return_logprob, ORIGINAL_LOGPROB=1        0.0000                             0.0066
```

SGLang returned the logprob from before top-p, with the environment variable at 0 or at 1. At temperature 1 the two settings compute the same value. On the same prompts, the logprob after top-p was higher by minus the log of the kept mass, a median of about 0.053. So a trainer that renormalizes over the kept tokens must not compare with this value directly. The GPU was shared and had no clock lock, which does not change these values.

At a temperature other than 1, the scaled value is correct for sampling. It surprises anyone who compares those numbers with a model run at temperature 1. A reinforcement learning trainer that computes logprobs from the raw logits sees a mismatch on every token, and the mismatch looks like a numerical bug. [Section 7.2](#s-sglang-as-an-rl-rollout-engine) shows why that matters for training.

## On Apple silicon

Our capture ran on the MLX runtime, and MLX treats sampling differently. The help text for `--mlx-enable-sampling` says what changes.

```listing
title: the MLX sampling flag in sglang serve --help
source: capture/out/serve-help.txt
lang: text
note: Cut from the flag list. Three lines about the overlap scheduler are cut.
---
  --mlx-enable-sampling
                        MLX backend only: sample decode tokens (temperature /
                        top-k / top-p / min-p) instead of greedy argmax.
…
                        exact argmax behavior. Also enables on the MLX path:
                        grammar vocab masks and custom logit processors (these
                        break decode chaining per step; custom processors run
                        on pure-decode steps only), logit_bias, output
                        logprobs (sampled token / top-k / token_ids; prompt
                        input logprobs are not computed), NaN sanitization
                        (SGLANG_SANITIZE_NAN_LOGITS), and per-request
                        sampling_seed under --enable-deterministic-inference
                        (deterministic within MLX only). Penalties are not
                        applied.
```

Without that flag, every decode step on MLX takes the token with the highest logit, whatever temperature the request asks for. Grammar masks and output logprobs also need the flag, and penalties never apply on MLX. Our capture kit sends temperature 0, so its results do not depend on this flag.

## What to measure

SGLang includes a test that sends one prompt in random batch sizes and counts distinct outputs. It has three modes: `single`, `prefix` for shared prefixes, and `radix_cache` for cached against uncached prefill.

```bash
python3 -m sglang.test.test_deterministic --n-trials 50 --test-mode single
python3 -m sglang.test.test_deterministic --n-start 1 --n-trials 50 --test-mode prefix
```

Run it against your model, your attention backend, and your parallel layout. One distinct output per prompt is the pass condition. Then measure throughput with the flag on and off, because batch-invariant kernels give up some speed.

## What we measured on a GB10

Our probe sends one prompt at temperature 0 with 128 new tokens. It sends the prompt five times alone, then five times inside a batch of 16 with 15 other prompts. We ran it against `Qwen/Qwen3-30B-A3B-Instruct-2507` on one NVIDIA GB10, first on the default server and then with `--enable-deterministic-inference`.

**We measured** two different answers from the default server. The first request alone and all five batched requests wrote one text. The next four requests alone wrote another text, which left the first after 238 characters. Nothing in the request changed between those runs.

Our reading is that the first request computed its prompt from nothing. The four later ones found that prompt in the radix cache and ran a different prefill path. The `radix_cache` mode of the test above checks that case.

With the flag on, all ten requests wrote the same text. The startup log shows the switches from the list above:

```listing
title: what deterministic mode switched on the GB10
source: capture/gpu/out-gb10/server-deterministic.log
lang: text
note: Three lines from the startup log. Timestamps and the end of the second line are cut.
---
… Sampling backend is set to pytorch for deterministic inference.
… Attention backend not specified. Falling back to 'flashinfer' for deterministic inference. You can explicitly set --attention-backend to one of ['ascend', 'fa3', 'fa4', 'flashinfer', 'intel_xpu', 'tri…
… Currently radix cache is not compatible with flashinfer attention backend for deterministic inference. It will be supported in the future.
```

In one run per server, the price at concurrency 8 was 18 percent of the throughput. Output fell from 78.92 to 64.83 tok/s, and the median time per token rose from 97.30 to 117.43 ms. The radix cache was off, so a workload with shared prefixes pays more than this test shows.

## What we measured on an L4

On an L4 with `Qwen/Qwen3-8B` in BF16, the four later requests alone also matched each other and not the first. The batched requests there wrote two more texts, so the default server gave four different answers to one prompt. With the flag on, all ten matched on the L4 too.

A later check used `Qwen/Qwen3-8B-FP8` on the second GPU of the same L4 node. The first request alone again differed from the four later ones. This time the batch added one more text, not two. With the flag on, all ten matched again.

That check also showed a backend change. With the flag on and no `--attention-backend`, SGLang chose `fa3` on the L4, which is SM 8.9. The default server on the same GPU uses `flashinfer`.

```listing
title: the attention backend that deterministic mode chose on the L4
source: capture/gpu/out-l4/livecheck-2026-10-23.txt
lang: text
note: One line from the startup log, and the note under it.
---
Attention backend not specified. Falling back to 'fa3' for deterministic inference
The server ran on fa3 on SM 8.9 with no error. The default server on this GPU uses flashinfer.
```

So on this GPU the flag changes the attention backend too. With `fa3`, the fifth point of the list above keeps the radix cache on.

## What the cache, the batch, and the dtype changed

We counted how many greedy outputs changed between two runs. The prompts were ShareGPT questions after one shared system prompt of about 170 tokens, with 128 output tokens and thinking off. This was on the second GPU of our L4 node with `Qwen/Qwen3-0.6B`, which its owner shares and which had no clock lock. A clock changes the speed and not the greedy tokens.

```listing
title: outputs that differ at a concurrency of 1, out of 32
source: capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt
lang: text
note: The number in brackets is the median position of the first token that differs. The vLLM column comes from the same probe on vLLM 0.31.0.
---
comparison                     SGLang 0.6B   vLLM 0.6B
flushed repeat against fresh   0 of 32       0 of 32
cache off against cache off    0 of 32       0 of 32
fresh against warm cache       21 of 32 (45) 11 of 32 (57)
cache on against cache off     25 of 32 (26) 21 of 32 (48)
```

- **One request at a time, the same cache state.** A repeat after a flush, or a repeat with the radix cache off, gave the same text for all 32 prompts.
- **One request at a time, a warm cache.** The same prompts against a warm cache changed 21 of 32 outputs. The cache on against the cache off changed 25 of 32.
- **64 requests at once.** Two runs with the cache off differed in 27 of 64 outputs. The batch alone changed many outputs, so the cache effect could not be separated at that load.
- **The dtype.** We sent 64 questions at a concurrency of 1 with the cache off. BF16 against FP16 changed 51 of 64 outputs for Qwen3-0.6B and 57 of 64 for Qwen3-1.7B. The first different token came at a median position of 41 and 54. A repeat in the same dtype changed none.

A 2026 study of two serving engines found the same cache split. Our counts come from small models on one GPU, so test your own model the same way.

## Know the limits of our result

Our 18 percent is one run at one concurrency on one model. Other teams measured the cost and the gaps of deterministic modes. We did not measure these results ourselves:

- **The speed cost.** Thinking Machines Lab ran 1,000 Qwen3-8B requests on vLLM in 26 s by default and in 55 s with batch-invariant kernels. A better attention kernel brought it to 42 s.
- **A larger cost under load.** A 2026 study, CoRun, measured batch-invariant kernels at more than twice the latency and up to 74 percent less throughput.
- **Other changes in execution.** A 2026 verification study, Vosti, tested changes such as prompt chunking and KV cache reuse. The deterministic mode of SGLang gave different logits under some of them.

So measure the cost at the concurrency you serve. Test the exact setup: the model, the attention backend, the parallel layout, the chunk size, and the cache setting.

## Our position

Treat `--enable-deterministic-inference` as a promise for one model on one backend, and test that promise. Turn it on for reinforcement learning rollouts and for evaluations you want to reproduce. Leave it off for production traffic, where prefix caching and faster kernels are worth more than identical bits. Do not assume that temperature 0 alone gives identical text. On the GB10 it did not.

Set `sampling_seed` on each request that must reproduce. Seed 42 for everyone makes every sampled request draw the same random numbers.

Run the same eval twice and compare the outputs token by token, not only the score. Between the two runs, call `POST /flush_cache` or restart the server, as [section 5.1](#s-sglang-benchmark-serving) shows. Write the cache setting and the cached tokens next to the result.

## Incidents

**The flag was accepted and the output still varied.** Issue #43055 (2026-10-08): gpt-oss-20b gave several different greedy outputs for one prompt in prefix mode. Comments traced it to the deterministic Triton extend kernel on sliding-window layers. It aligned KV tiles to the trimmed prefix and not to absolute positions. The issue was open when this manual was verified.

**Some architectures are not covered yet.** Issue #43413 reported that a Mamba2 hybrid model was not batch-invariant. Issues #36174 and #31261 list DeepSeek-V4 and Qwen3.5 as not yet supported in deterministic mode.

**A restart changed greedy output.** Issue #39597 (2026-09-15): with the DFLASH speculative algorithm, the same prompt gave different text after a restart. FlashInfer autotuning picked different kernel tactics on each start. The workaround was `--disable-flashinfer-autotune` or deterministic mode.

```takeaways
- Run sglang.test.test_deterministic on your model and backend before you rely on reproducible output.
- Expect deterministic mode to turn off prefix caching on flashinfer. Pick triton, or fa3 and fa4 where your GPU supports them.
- Send one prompt alone and in a batch, and count distinct outputs, before you trust temperature 0.
- Flush the cache between two eval runs that you compare, and record the cached tokens.
- Measure the cost of deterministic mode at the concurrency you serve, not at one point.
- Set SGLANG_RETURN_ORIGINAL_LOGPROB when you sample at a temperature other than 1 and the trainer scores at 1.
- Keep the dtype the same between two runs that you compare.
- Pass --mlx-enable-sampling on Apple silicon when requests need temperature or logprobs.
```

Sources: capture/gpu/out-gb10/determinism.txt, deterministic-determinism.txt, server-deterministic.log, bench-random-c8.txt, deterministic-bench-random-c8.txt, capture/gpu/out-l4/determinism.txt, deterministic-determinism.txt, capture/gpu/out-l4/livecheck-2026-10-23.txt, capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt, capture/gpu/out-l4/logprobs-top-p.txt, capture/gpu/determinism_probe.py, python/sglang/srt/batch_invariant_ops/batch_invariant_ops.py (enable_batch_invariant_mode), arg_groups/attention_hook.py (handle_deterministic_inference), arg_groups/choices.py (DETERMINISTIC_ATTENTION_BACKEND_CHOICES, RADIX_SUPPORTED_DETERMINISTIC_ATTENTION_BACKEND), sampling/sampling_batch_info.py, layers/sampler.py, and python/sglang/test/test_deterministic.py at v0.5.22; capture/out/serve-help.txt; issues #43055, #43413, #36174, #31261, and #39597; Thinking Machines, Defeating Nondeterminism in LLM Inference (2025-09), the 1,000 Qwen3-8B requests on vLLM; python/sglang/srt/entrypoints/http_server.py (flush_cache) at v0.5.22; Patodiya, Same Request, Different Answer: Quantization Amplifies Cache-Induced Divergence in LLM Serving, arXiv 2609.04748 (2026-09, revised 2026-10); Zhao and others, CoRun: Padding is Simple and Efficient for Deterministic LLM Inference, arXiv 2608.14376 (2026-08); Qin and others, Vosti: Specifying, Implementing, and Verifying Deterministic LLM Inference, arXiv 2609.38981 (2026-09).
