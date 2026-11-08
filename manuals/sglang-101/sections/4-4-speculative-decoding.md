# --speculative-algorithm

> Speculative decoding spends idle GPU compute to commit several tokens per step, so it cuts latency at low load and can cost throughput when the GPU is already full.

A user turned on EAGLE-3 for Llama-3.1-8B on an A6000 and ran two tests. At batch 1, output went from 42.0 to 92.5 tok/s, more than twice as fast. At concurrency 20, output fell from 217.8 to 164.4 tok/s, a quarter slower. Both numbers are in issue #5274, and both are correct. A maintainer answered that speculative decoding is meant for small batches, not for stress tests {{issue #5274}}.

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

With `NGRAM`, SGLang turns off mixed chunked prefill {{code}}. The docs page at v0.5.22 also says that `NGRAM` turns off the overlap scheduler and runs on CUDA only. The v0.5.22 code accepts CUDA, CPU, and XPU, and it turns the overlap off only on CPU {{code}}. Read `disable_overlap_schedule` from `GET /server_info` to see what your server runs. When you compare `NGRAM` with no speculation, run both with the same overlap setting.

When you leave the shape unset, SGLang chooses `(num_steps, topk, num_draft_tokens)` from the model architecture.

| Model | Default shape |
|---|---|
| `LlamaForCausalLM`, Grok | (5, 4, 8): a tree of up to 8 drafts |
| DeepSeek, GLM, GPT-OSS, MiMo, `STANDALONE`, and every other model | (3, 1, 4): a chain of 3 drafts |

With topk 1, the code forces the draft token count to the step count plus one.

## The limit nobody asked for

The EAGLE, NGRAM, DFLASH, and DSPARK handlers at v0.5.22 each do the same thing when you did not set `--max-running-requests`. It sets the value to 48 and logs one warning: `Max running requests is reset to 48 for speculative decoding` {{code}}. Speculation needs memory for draft tokens and works best at small batch, so the cap protects the server. It also caps your benchmark.

A throughput test with speculation on and no explicit limit measures a server that admits 48 requests. If your traffic runs 200 concurrent requests, the other 152 wait in the queue, and time to first token grows. The warning prints once at startup, and it scrolls away before the first request.

## What to measure

The scheduler logs `accept len` and `accept rate` on each decode log line, and `/metrics` exports `sglang:spec_accept_length` and `sglang:spec_accept_rate`. Measure them on your own prompts, because acceptance depends on the text and on the draft. A field report by David Noel Ng {{field David Noel Ng 2026-08}} on two GH200 measured 3.5 to 5.05 tokens on DeepSeek-V4-Flash after a loader fix.

Run a sample of your own traffic with and without speculation. Keep your real output lengths, and pass `--disable-ignore-eos` to the benchmark client. With no traffic sample, `--dataset-name speed-bench` reads a local copy of the SPEED-Bench prompts at v0.5.22 {{code}}. Compare these numbers:

1. The acceptance length, from `sglang:spec_accept_length`.
2. The median TPOT and the output throughput.
3. The P99 ITL and the P99 TTFT, because a gain in the median can hide a loss in the tail.
4. The acceptance length of your longest answers alone. Each `/generate` response gives it as `spec_accept_length` in `meta_info`.

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

The first start failed. The draft config says 2,048 positions, and the target says 262,144. The context length check raised `ValueError` and ended with `To allow overriding this maximum, set the env var SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1` {{code}}. The cookbook command for this pair sets that variable, so we set it too.

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

The same start shows the price of a draft on a small card. The target alone had a pool of 24,094 tokens on this L4. With the draft loaded, the pool held 8,827 tokens, about 14 of our 640-token requests. The sweep server on the same card started with more free memory and held 9,951 tokens.

**We measured** three seeds at each concurrency from 1 to 64, with the BF16 server as the baseline:

| Concurrency | Baseline median TPOT | EAGLE-3 median TPOT | Baseline output tok/s | EAGLE-3 output tok/s |
|---|---|---|---|---|
| 1 | 32.52 ms | 20.30 ms | 29.14 | 40.93 |
| 8 | 102.21 ms | 59.44 ms | 74.11 | 97.06 |
| 32 | 201.91 ms | 106.97 ms | 150.66 | 228.78 |
| 64 | 254.06 ms | 138.41 ms | 235.38 | 276.32 |

The acceptance length stayed between 2.71 and 2.74 tokens per step at every concurrency. The gain per token stayed at 1.56 times or more at every load. It peaked at 1.89 times at concurrency 32, and it was 1.84 times at 64.

```figure
id: fig-4-4b
kind: chart
title: on a mixture-of-experts model the EAGLE-3 gain holds as the batch grows
claim: On the GB10, EAGLE-3 cut the median time per token by 1.60 times at concurrency 1 and by 1.89 times at 32.
caption: The line is baseline median TPOT divided by EAGLE-3 median TPOT, at each concurrency. The dashed rose line marks no gain. The footnote gives the acceptance length range. From capture/gpu/summary/gb10.json.
```

This result goes against the A6000 report above, and the model explains it. A dense model reads all its weights for each step, and a larger batch already uses the spare compute. A mixture-of-experts model reads only the experts that the tokens of the step chose. The verify pass scores four positions per request with the expert weights it already read for that step. That is our reading, measured on one model and one GPU.

The cap is the limit. At concurrency 64, throughput was still higher than the baseline, 276.32 against 235.38 tok/s. The median time to first token was 7,772 ms against 557 ms. The server admits 48 requests, and the other 16 waited in the queue.

## What we measured on a 24 GB L4

We ran the same sweep with the dense `Qwen/Qwen3-8B` and the `Tengyunw/qwen3_8b_eagle3` draft on one L4. The default server ran on 2026-10-16 and the EAGLE-3 server on 2026-10-17, both at a median clock of 1,080 MHz or more. This time we set the variable, as the sweep does for every EAGLE-3 server.

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

The acceptance length was 2.73 to 2.74 tokens per step at every concurrency. Each token came out 1.6 to 2.3 times faster at every load. Yet from concurrency 32, the server delivered no more tokens per second than the default.

```figure
id: fig-4-4c
kind: chart
title: On a 24 GB card each token got faster, but the server did not
claim: On the L4, EAGLE-3 gave 2.37 times the output throughput at concurrency 1 and 1.00 times at 32.
caption: Violet is default TPOT divided by EAGLE-3 TPOT. Teal is EAGLE-3 output throughput divided by the default. The dashed rose line marks no gain. From capture/gpu/summary/l4.json.
```

The pool explains the difference. With 15 requests in the pool, the rest waited for a slot. At concurrency 32, the median time to first token was 8,040 ms with EAGLE-3 and 2,970 ms without it. On a card where the KV pool is the limit, the draft spends the memory that the batch needs.

## Know the limits of our results

Both sweeps used the `random` dataset of the benchmark client, with 512 tokens in, 128 tokens out, and `ignore_eos` on. At v0.5.22 that dataset takes the first turn of ShareGPT conversations, then cuts or repeats it to 512 tokens {{code}}. It is real text, but it is not your traffic.

Other teams found that tests like ours can overstate the gain. We did not measure these effects ourselves:

- A 2026 benchmark study by NVIDIA researchers, SPEED-Bench, found that synthetic prompts overstated speculative throughput by 23 percent on average. It also found that the best draft length fell to 1 as the batch grew.
- The same study found that random token ids left 20 to 30 percent of the experts idle in some layers of an MoE target.
- A 2026 study of EAGLE-3 and other drafts, Test-Time Speculation, found that the acceptance length falls as the answer grows. On MATH answers that ran toward 20,000 tokens, it fell from about 3.7 to about 1.5.
- A 2025 study of serving benchmarks compared speculation with the baseline. The median TPOT was 1.3 times lower, and the P99 TPOT was 1.16 times higher. TTFT also rose, because the draft runs its own prefill.

So our gains hold for 128 generated tokens with the end token ignored, on our test prompts. They do not predict the gain on long chat answers or on reasoning traces. Our reading of the GB10 result also depends on how real tokens choose their experts, and we did not measure the routing.

## Real prompts on the L4

On 2026-10-23 we ran the same L4 sweep on four datasets: the random set, ShareGPT, GSM8K questions, and code prompts. The clock was locked at 900 MHz, the cache was flushed before each run, and each point had two seeds.

```listing
title: speculation on four datasets, Qwen3-8B on SGLang 0.5.22, our L4 at 900 MHz
source: capture/gpu/out-l4/spec-real-prompts.txt
lang: text
note: The time per token at 8 users and the output at 32 users. The acceptance lines and the notes are cut.
---
median TPOT at 8 users: default / EAGLE3 / NGRAM
random     67.6 to 68.2 / 33.8 to 39.4 / 68.2 to 71.4 ms
ShareGPT   66.4 to 68.6 / 39.5 to 43.1 / 69.5 to 72.4 ms
GSM8K      65.5 / 33.3 to 34.3 / 54.6 to 55.0 ms
code       65.9 to 66.4 / 36.8 / 58.2 to 58.8 ms
…
output tok/s at 32 users: default / EAGLE3 / NGRAM
random     250 to 254 / 239 to 242 / 236 to 250
ShareGPT   281 to 288 / 277 to 283 / 245 to 256
GSM8K      397 / 648 to 660 / 433 to 435
code       365 to 366 / 566 to 581 / 377 to 386
…
```

EAGLE-3 cut the time per token about in half at 8 users on every dataset, with an acceptance length of 2.35 to 2.78. At 32 users it gave 1.6 times the output on GSM8K and code. On the random set and ShareGPT it gave no more output. There its first token came 2 to 3 times later, because the draft took pool space that the queue needed.

NGRAM helped only on GSM8K and code, by about 1.1 to 1.2 times at 8 users. On the other two sets it was slower, and its P99 ITL rose to 244 to 779 ms. So the dataset changed the result more than the random set suggests. Test on your own traffic.

## Acceptance over a long answer

We tested the claim of Test-Time Speculation on shorter answers. On 2026-10-23 we ran `Qwen/Qwen3-8B-FP8` with an EAGLE-3 draft, 3 steps, top-k 1, and 4 draft tokens. This was on the second GPU of our L4 node, which its owner shares and which had no clock lock. Each of 8 prompts ran with thinking on, greedy, alone, up to 4,096 tokens. We read `spec_verify_ct` after answers of 256, 512, 1,024, 2,048, and 4,096 tokens.

```listing
title: mean acceptance length by position in the answer
source: capture/gpu/out-l4/eagle3-acceptance-by-position.txt
lang: text
note: The range across prompts, with the number of prompts that reached each segment in brackets. The vLLM column comes from the same prompts on vLLM 0.31.0.
---
segment of the output   SGLang                 vLLM
0 to 256                2.05 to 2.64 (8)       2.14 to 2.51 (8)
256 to 512              1.95 to 2.64 (8)       2.09 to 2.55 (8)
512 to 1,024            2.11 to 2.77 (8)       2.12 to 2.79 (8)
1,024 to 2,048          2.09 to 2.47 (5)       1.72 to 2.66 (5)
2,048 to 4,096          2.33 and 2.48 (2)      2.35 and 2.60 (2)
```

Up to 4,096 tokens, the acceptance length did not fall steadily. It stayed at about 2.1 to 2.8 tokens for each verify step on both engines. Only 2 of the 8 prompts ran past 2,048 tokens before the end token, so the last segment rests on two answers. The clock changes the speed and not the acceptance. Our limit of 4,096 tokens came from the memory we could use on that GPU. So our test did not reach the range of the study.

A second test used `Qwen/Qwen3-8B` in BF16 at 8 users, with answers of up to 2,048 tokens and no ignore-eos. The median answer was 1,800 to 2,000 tokens.

```listing
title: EAGLE3 acceptance on answers of about 2,000 tokens, 8 users
source: capture/gpu/out-l4/eagle3-long-outputs.txt
lang: text
note: The table of the file. The comparison with short outputs is cut.
---
engine          dataset    mean acceptance length   accepted per draft position 1 / 2 / 3
SGLang EAGLE3   GSM8K      2.68
SGLang EAGLE3   ShareGPT   2.32
vLLM EAGLE3     GSM8K      2.69                     0.77 / 0.54 / 0.38
vLLM EAGLE3     ShareGPT   2.35                     0.67 / 0.42 / 0.26
```

On short answers in the same session, SGLang gave 2.69 to 2.78 on GSM8K and 2.33 to 2.43 on ShareGPT. Its long answers stayed within 0.01 of those ranges. We have no short-answer acceptance for vLLM from this session, so its rows show only the level on long answers.

## Our position

Treat speculative decoding as a latency tool for low and middle concurrency. Turn it on for interactive traffic with a few users per replica. Leave it off for batch jobs and high concurrency on a card where the KV pool is the limit, as on our L4. On the GB10, where the pool had room, speculation still gave 1.17 times the throughput at 64 users.

Measure the cross point on your model before you accept that rule. On the mixture-of-experts model above, speculation still won at concurrency 32 on the GB10. On the dense model on the L4, it gave no more throughput at 32, because the draft took nearly 60 percent of the pool. Measure it with your own prompts and output lengths, with the list in the section on what to measure.

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
- Test speculation with real output lengths and --disable-ignore-eos, and compare P99 ITL and P99 TTFT, not only the median.
- Check the draft model context length against your longest prompts.
- Treat SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1 as a removed check, and test long prompts yourself.
```

Sources: capture/gpu/out-gb10/server-eagle3.log, capture/gpu/out-l4/server-eagle3-no-env.log, capture/gpu/out-l4/server-load-eagle3.log, capture/gpu/summary/l4.json, server-eagle3.command.txt, eagle3-bench-random-c1.txt, eagle3-bench-random-c8.txt, eagle3-bench-random-c32.txt, capture/gpu/summary/gb10.json, python/sglang/srt/configs/model_config.py (_derive_context_length), docs/cookbook/specbundle/specbundle_usage.mdx, python/sglang/srt/speculative/eagle_worker_v2.py (forward_batch_generation), speculative/eagle_utils.py (build_tree_kernel_efficient, eagle_sample), arg_groups/speculative_hook.py (_auto_choose_speculative_params, _handle_eagle_family, _handle_ngram, _disable_overlap_schedule_for_cpu, _resolve_speculative_algorithm_alias), arg_groups/fields/spec.py, managers/tokenizer_manager.py (speculative meta_info), python/sglang/benchmark/datasets/random.py (sample_random_requests), python/sglang/benchmark/datasets/speed_bench.py, python/sglang/benchmark/serving.py (--disable-ignore-eos), docs/docs/advanced_features/speculative_decoding.mdx (the NGRAM row), managers/scheduler_components/metrics_reporter.py, and observability/metrics_collector.py at v0.5.22; issues #5274 and #6783; PR #33276; field reports by Ant Group on the LMSYS blog (2025-09-26) and David Noel Ng (2026-08-04); vendor reports by Google Cloud (2025-11-25) and Modal with Decagon (2025-11-13); Abramovich and others, SPEED-Bench: A Unified and Diverse Benchmark for Speculative Decoding, arXiv 2604.09557 (2026-02, revised 2026-05), Kumar, Sanghavi, and Das, Test-Time Speculation, arXiv 2605.09329 (2026-05), capture/gpu/out-l4/eagle3-acceptance-by-position.txt, Agrawal and others, On Evaluating Performance of LLM Inference Serving Systems, arXiv 2507.09019 (2025-07), capture/gpu/out-l4/spec-real-prompts.txt, capture/gpu/out-l4/eagle3-long-outputs.txt.
