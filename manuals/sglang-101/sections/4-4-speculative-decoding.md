# --speculative-algorithm

> Speculative decoding spends idle GPU compute to commit several tokens per step, so it cuts latency at low load and costs throughput when the GPU is already full.

A user turned on EAGLE-3 for Llama-3.1-8B on an A6000 and ran two tests. At batch 1, output went from 42.0 to 92.5 tok/s, more than twice as fast. At concurrency 20, output fell from 217.8 to 164.4 tok/s, a quarter slower. Both numbers are in issue #5274, and both are correct. A maintainer answered that speculative decoding "is for small batch sizes rather than stress tests" {{issue #5274}}.

When you finish this section, you can explain draft, verify, and acceptance length, and read the defaults SGLang picks. You can also find the request limit that speculation sets and decide where speculation belongs.

## The cost: decode is one token at a time

Each decode step commits one token per request, and the next step needs that token as input. At batch 1 a step reads every weight of the model to compute one token. The GPU has compute to spare and memory traffic is the limit. A larger batch fills that spare compute with other requests.

Speculative decoding fills it with guesses. **Draft model:** a small model, or a small head trained on the target model, that proposes the next few tokens cheaply. **Verify pass:** one forward of the target model over all proposed tokens at once. The target accepts the longest prefix that matches what it would have produced, and adds one token of its own.

**Acceptance length:** the number of tokens committed per verify pass, accepted drafts plus that one bonus token. An acceptance length of 3 means one target forward commits three tokens.

## One step in SGLang

```figure
id: fig-4-6
kind: sequence
title: one EAGLE step with steps 3, topk 1, and 4 draft tokens
claim: One EAGLE step drafts a chain of tokens, verifies them in one target forward, and commits the accepted prefix plus one bonus token.
caption: Read top to bottom. The numbers follow the default (3, 1, 4) for most models at v0.5.22. Green tokens are accepted and the rose token is rejected. From EAGLEWorkerV2.forward_batch_generation at v0.5.22.
```

1. **Draft.** The draft model runs `--speculative-num-steps` times. With `--speculative-eagle-topk` above 1, each step keeps several candidates per node and grows a tree. A tree builder keeps the best `--speculative-num-draft-tokens` nodes and builds a tree mask.
2. **Verify.** The target runs once in `TARGET_VERIFY` mode over every draft token with the tree mask. For greedy requests it keeps the longest matching path. For sampled requests it compares probabilities with temperature, top-k, and top-p applied.
3. **Draft extend.** The draft model reads the accepted tokens in `DRAFT_EXTEND_V2` mode, so its cache is ready for the next step.

The accept thresholds `--speculative-accept-threshold-single` and `--speculative-accept-threshold-acc` default to 1.0. With those values, a greedy request produces the same tokens it would produce without speculation.

## The algorithms and the defaults

`--speculative-algorithm` accepts `EAGLE`, `EAGLE3`, `NEXTN`, `STANDALONE`, `NGRAM`, `DFLASH`, `DSPARK`, and `UNO`. `NEXTN` is another name for `EAGLE`. For DeepSeek V3 and other models that include multi-token prediction layers in the checkpoint, SGLang sets the draft model path to the model path. `NGRAM` needs no draft model at all. It looks up repeated token sequences in the text it has already seen.

When you leave the shape unset, SGLang chooses `(num_steps, topk, num_draft_tokens)` from the model architecture.

| Model | Default shape |
|---|---|
| `LlamaForCausalLM`, Grok | (5, 4, 8): a tree of up to 8 drafts |
| DeepSeek, GLM, GPT-OSS, MiMo, `STANDALONE`, and every other model | (3, 1, 4): a chain of 3 drafts |

With topk 1, the code forces the draft token count to the step count plus one.

## The limit nobody asked for

The EAGLE, NGRAM, DFLASH, and DSPARK handlers at v0.5.22 each do the same thing when you did not set `--max-running-requests`. It sets the value to 48 and logs one warning: "Max running requests is reset to 48 for speculative decoding" {{code}}. Speculation needs memory for draft tokens and works best at small batch, so the cap protects the server. It also caps your benchmark.

A throughput test with speculation on and no explicit limit measures a server that admits 48 requests. If your traffic runs 200 concurrent requests, the other 152 wait in the queue, and time to first token grows. The warning prints once at startup, and it scrolls away before the first request.

## What to measure

The scheduler logs `accept len` and `accept rate` on each decode log line, and `/metrics` exports `sglang:spec_accept_length` and `sglang:spec_accept_rate`. Measure them on your own prompts, because acceptance depends on the text and on the draft. A field report by David Noel Ng {{field David Noel Ng 2026-08}} on two GH200 measured 3.5 to 5.05 tokens on DeepSeek-V4-Flash after a loader fix.

Then sweep concurrency with speculation on and off, and find where the two lines cross. Ant Group {{field Ant Group 2025-09}} measured this on DeepSeek-R1 on H20. Longer drafts gained 21% at batch 1 and lost about 18% at batch 32.

```figure
id: fig-4-7
kind: comparison
title: the same feature at two batch sizes
claim: Speculation doubled single-request speed and cut throughput at concurrency 20 on the same GPU and model.
caption: Output tok/s for Llama-3.1-8B with and without EAGLE-3 on one A6000, as reported in issue 5274 on 2025-04-11. The bars use one scale.
```

## What we measured on a GB10

We ran EAGLE-3 on `Qwen/Qwen3-30B-A3B-Instruct-2507` on one NVIDIA GB10. The draft was `lmsys/SGLang-EAGLE3-Qwen3-30B-A3B-Instruct-2507-SpecForge-Nex`, with the shape (3, 1, 4) that the SGLang cookbook uses for this pair.

The first start failed. The draft config says 2,048 positions, and the target says 262,144. The context length check raised `ValueError` and ended with "To allow overriding this maximum, set the env var SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1" {{code}}. The cookbook command for this pair sets that variable, so we set it too.

```listing
title: the draft context length check with the override set
source: capture/gpu/out-gb10/server-eagle3.log
lang: text
note: Three lines from the startup log. Timestamps are cut.
---
… Warning: Target model's context_length (262144) is greater than the derived context_length (2048). This may lead to incorrect model outputs or CUDA errors. Note that the derived context_length may differ from max_position_embeddings in the model's config.
… Overriding the draft model's max_position_embeddings to 262144.
… Max running requests is reset to 48 for speculative decoding. You can override this by explicitly setting --max-running-requests.
```

The variable only removes the check. It does not teach the draft to read long prompts, which is the failure in issue #6783 below. Our prompts had 512 tokens, so this run says nothing about long contexts.

We expected the same refusal on a 24 GB L4. We started `Qwen/Qwen3-8B` with the draft `Tengyunw/qwen3_8b_eagle3` and no variable, and the server started. That draft declares 40,960 positions, the same as its target, so the check had nothing to refuse. The variable belongs to one draft config, not to EAGLE-3. Compare `max_position_embeddings` in both configs before you set it.

```listing
title: an EAGLE-3 start on a 24 GB L4
source: capture/gpu/out-l4/server-eagle3-no-env.log
lang: text
note: Four lines from the startup log. Timestamps are cut.
---
… Load weight end. elapsed=3.89 s, type=Qwen3ForCausalLM, avail mem=6.41 GB, mem usage=15.28 GB.
… Load weight end. elapsed=0.67 s, type=LlamaForCausalLMEagle3, avail mem=4.50 GB, mem usage=1.90 GB.
… KV Cache is allocated. dtype: torch.bfloat16, #tokens: 8827, K size: 0.61 GB, V size: 0.61 GB
… max_total_num_tokens=8827, chunked_prefill_size=4096, max_prefill_tokens=16384, max_running_requests=48, context_len=40960, available_gpu_mem=1.19 GB
```

The same start shows the price of a draft on a small card. The target alone had a pool of 24,094 tokens on this L4. With the draft loaded, the pool held 8,827 tokens, about 13 of our 640-token requests.

**We measured** three seeds at each concurrency from 1 to 64, with the BF16 server as the baseline:

| Concurrency | Baseline median TPOT | EAGLE-3 median TPOT | Baseline output tok/s | EAGLE-3 output tok/s |
|---|---|---|---|---|
| 1 | 32.52 ms | 20.30 ms | 29.14 | 40.93 |
| 8 | 102.21 ms | 59.44 ms | 74.11 | 97.06 |
| 32 | 201.91 ms | 106.97 ms | 150.66 | 228.78 |
| 64 | 254.06 ms | 138.41 ms | 235.38 | 276.32 |

The acceptance length stayed between 2.71 and 2.74 tokens per step at every concurrency. The gain per token did not shrink with load. It grew from 1.60 times at concurrency 1 to 1.89 times at 32.

```figure
id: fig-4-4b
kind: chart
title: on a mixture-of-experts model the EAGLE-3 gain grows with the batch
claim: On the GB10, EAGLE-3 cut the median time per token by 1.60 times at concurrency 1 and by 1.89 times at 32.
caption: The line is baseline median TPOT divided by EAGLE-3 median TPOT, at each concurrency. The dashed rose line marks no gain. The footnote gives the acceptance length range. From capture/gpu/summary/gb10.json.
```

This result goes against the A6000 report above, and the model explains it. A dense model reads all its weights for each step, and a larger batch already uses the spare compute. A mixture-of-experts model reads only the experts that the tokens of the step chose. The verify pass scores four positions per request with the expert weights it already read for that step. That is our reading, measured on one model and one GPU.

The cap is the limit. At concurrency 64, throughput was still higher than the baseline, 276.32 against 235.38 tok/s. The median time to first token was 7,772 ms against 557 ms. The server admits 48 requests, and the other 16 waited in the queue.

## What we measured on a 24 GB L4

We ran the same sweep with the dense `Qwen/Qwen3-8B` and the `Tengyunw/qwen3_8b_eagle3` draft on one L4. This time we set the variable, as the sweep does for every EAGLE-3 server.

```listing
title: the pool of an EAGLE-3 server on the L4
source: capture/gpu/out-l4/server-load-eagle3.log
lang: text
note: Startup lines from the server log of the sweep. Timestamps are cut.
---
… KV Cache is allocated. dtype: torch.bfloat16, #tokens: 9951, K size: 0.68 GB, V size: 0.68 GB
… max_total_num_tokens=9951, chunked_prefill_size=4096, max_prefill_tokens=16384, max_running_requests=48, context_len=40960, available_gpu_mem=1.23 GB
```

**We measured** a pool of 9,951 tokens against 24,094 without the draft. That pool holds about 15 of our 640-token requests, fewer than the cap of 48.

| Concurrency | Default median TPOT | EAGLE-3 median TPOT | Default output tok/s | EAGLE-3 output tok/s |
|---|---|---|---|---|
| 1 | 60.16 ms | 25.61 ms | 13.42 | 31.81 |
| 8 | 66.01 ms | 35.58 ms | 112.62 | 181.55 |
| 32 | 96.18 ms | 43.82 ms | 270.11 | 269.42 |
| 64 | 107.42 ms | 51.50 ms | 250.85 | 245.34 |

The acceptance length was 2.73 to 2.74 tokens per step at every concurrency. Each token came out about two times faster at every load. Yet from concurrency 32, the server delivered no more tokens per second than the default.

```figure
id: fig-4-4c
kind: chart
title: On a 24 GB card each token got faster, but the server did not
claim: On the L4, EAGLE-3 gave 2.37 times the output throughput at concurrency 1 and 1.00 times at 32.
caption: Violet is default TPOT divided by EAGLE-3 TPOT. Teal is EAGLE-3 output throughput divided by the default. The dashed rose line marks no gain. From capture/gpu/summary/l4.json.
```

The pool explains the difference. With 15 requests in the pool, the rest waited for a slot. At concurrency 32, the median time to first token was 8,040 ms with EAGLE-3 and 2,970 ms without it. On a card where the KV pool is the limit, the draft spends the memory that the batch needs.

## Our position

Treat speculative decoding as a latency tool for low and middle concurrency. Turn it on for interactive traffic with a few users per replica. Leave it off for batch jobs and for servers that run at high concurrency.

Measure the cross point on your model before you accept that rule. On the mixture-of-experts model above, speculation still won at concurrency 32 on the GB10. On the dense model on the L4, it stopped winning at 32, because the draft took nearly 60 percent of the pool.

Always set `--max-running-requests` yourself when speculation is on. Choose it from the concurrency where your sweep shows speculation still wins.

Use the draft layers that come with your model first. A model with multi-token prediction layers needs no extra download. For EAGLE-3, check that the draft model supports your prompt length, and train a draft on your own traffic when acceptance is low. Google Cloud {{team Google Cloud 2025-11}} and Modal with Decagon {{team Modal 2025-11}} both trained their own drafts. Modal reported 38% longer acceptance than open-source drafts. Both are vendor reports.

## Incidents

**Speculation made a stress test slower.** Issue #5274 (2025-04-11): EAGLE-3 on an A6000 lowered throughput at concurrency 20 from 217.8 to 164.4 tok/s. It raised batch-1 speed from 42.0 to 92.5 tok/s. The fix was to run speculation only at small batch.

**The draft could not read long prompts.** Issue #6783 (2025-05-30): Llama-3.3-70B FP8 with EAGLE-3 accepted 3.2 tokens at 1k input, 1.6 at 3k, and 1.2 at 10k. At 10k it produced 63.9 tok/s against 102.7 without speculation. The draft config had 2,048 positions and no rope scaling. Adding Llama 3 rope scaling and 131,072 positions to the draft config fixed it.

**A loader bug hid the expert weights.** David Noel Ng {{field David Noel Ng 2026-08}} found SGLang slower than vLLM on DeepSeek-V4-Flash. Acceptance was 1.3 to 1.8 tokens, and only a log warning pointed at the cause. The draft loader never mapped the shared expert weights into the fused slot. After a local fix, decode went from 115.7 to 176.0 tok/s, and PR #33276 fixed it upstream.

```takeaways
- Turn on speculative decoding for low-concurrency interactive traffic, and measure where it stops winning.
- Set --max-running-requests explicitly whenever --speculative-algorithm is set.
- Read accept len in the decode log on your own prompts before you trust a speedup.
- Check the draft model context length against your longest prompts.
- Treat SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1 as a removed check, and test long prompts yourself.
```

Sources: capture/gpu/out-gb10/server-eagle3.log, capture/gpu/out-l4/server-eagle3-no-env.log, capture/gpu/out-l4/server-load-eagle3.log, capture/gpu/summary/l4.json, server-eagle3.command.txt, eagle3-bench-random-c1.txt, eagle3-bench-random-c8.txt, eagle3-bench-random-c32.txt, capture/gpu/summary/gb10.json, python/sglang/srt/configs/model_config.py (_derive_context_length), docs/cookbook/specbundle/specbundle_usage.mdx, python/sglang/srt/speculative/eagle_worker_v2.py (forward_batch_generation), speculative/eagle_utils.py (build_tree_kernel_efficient, eagle_sample), arg_groups/speculative_hook.py (_auto_choose_speculative_params, _handle_eagle_family, _handle_ngram, _resolve_speculative_algorithm_alias), arg_groups/fields/spec.py, managers/scheduler_components/metrics_reporter.py, and observability/metrics_collector.py at v0.5.22; issues #5274 and #6783; PR #33276; field reports by Ant Group on the LMSYS blog (2025-09-26) and David Noel Ng (2026-08-04); vendor reports by Google Cloud (2025-11-25) and Modal with Decagon (2025-11-13).
