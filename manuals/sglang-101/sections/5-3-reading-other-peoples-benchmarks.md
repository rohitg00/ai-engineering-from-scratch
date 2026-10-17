# Reading other people's SGLang benchmarks

> A published SGLang result depends on its version, workload, memory budget, graph ceiling, and kernels, so you read those five before you read the number.

The most repeated SGLang number on the web is "29 percent faster than vLLM": 16,215 tokens per second against 12,553. It comes from one offline test by the analyst firm AIMultiple, updated 2026-01-25 {{field AIMultiple 2026-01}}. That page lists SGLang as "v0.2.3" next to vLLM 0.11.0, a gap of about two years of releases. At least five later posts repeat the pair, some under the names of other companies. None of them reran the test.

When you finish this section, you can take a published SGLang benchmark apart into its five inputs. You can decide whether it applies to you and name the mechanism behind it. You can also say where the independent tests agree, which is a shorter list than the headlines suggest.

## The five inputs behind every result

A benchmark result is a function of five inputs. Most disagreements between published reports trace back to one of them.

1. **Workload shape.** Input length, output length, concurrency, and the share of the prompt that repeats. The radix cache helps only when prefixes repeat. Long inputs stress prefill. High concurrency stresses the scheduler and the KV pool.
2. **Memory budget.** SGLang computes `--mem-fraction-static` from the GPU when you leave it unset. vLLM uses `--gpu-memory-utilization 0.9`. A test that sets one and not the other compares two different KV pools.
3. **CUDA graph ceiling.** The decode step replays a captured CUDA graph only up to a batch size limit. Above it, decode runs eager, one kernel launch at a time. [Section 4.1](#s-forwardmode-and-cuda-graphs) explains the mechanism.
4. **Kernel path.** The attention backend, the MoE kernel, and the quantization format. Several reports below were decided by a kernel that did or did not exist for one GPU.
5. **Version and date.** One analyst measured the same model on the same AMD GPU at 20.4 and then 2,256 tokens per second per GPU, 26 days apart.

**The code** sets the third input from GPU memory at startup. Take an 80 GB H100 with tensor parallel size below 4. The default decode graph limit is 256, and the chunked prefill size is 8,192. On a 32 GB card the limit is 48, raised from 24 on 2026-09-04. The code comment on that change says the old cap "collapsed high-concurrency throughput vs vLLM" {{code}}.

## Six questions before you trust a number

```figure
id: fig-5-3
kind: decision
title: six questions to ask a published SGLang benchmark
claim: A result that fails the version or workload question tells you nothing about your server, however large its number is.
caption: Read top to bottom. Each question either passes to the next or ends in what the result can still tell you, in rose. From the field reports cited in this section.
```

1. **Is the SGLang version stated?** Without it, the result describes an unknown build.
2. **Does the workload match yours?** Unique prompts say nothing about a chat server with a long shared system prompt.
3. **Were the memory budgets matched across engines?**
4. **Did the concurrency pass the decode graph limit?** If yes, the test measured eager decode.
5. **Are the flags mapped correctly?** The same idea has different flag names in each engine.
6. **Who paid for the test?** A GPU cloud, a hardware vendor, a competitor, or the SGLang team each has a reason to like one answer.

## Where independent tests agree

These reports come from people outside the SGLang team. Each row names the mechanism from earlier sections that explains it.

| Finding | Field reports | Mechanism |
|---|---|---|
| Dense models with unique prompts: a tie | Spheron, SGLang 0.5.9, Llama 3.3 70B FP8 on one H100: 1,920 against 1,850 tok/s at 50 users. Modal: about 17 queries per second for both on 8 H100s. Varad More: 7B to 9B models within 3 percent on an A10G | both engines now use the same kernel families, paged KV, and continuous batching |
| Repeated prefixes: SGLang wins, by less than the folklore | Steve Rawlinson, SGLang 0.5.6 on 2 H100s: first token 583 ms against 2,141 ms at one user. RunPod: 35.0 against 32.8 tok/s per stream on a cached 7k context. Varad More: SGLang ahead on 10 of 16 models by 20 to 40 ms | the radix cache, see [section 3.3](#s-radixcache) |
| Long prompts: slower first token, faster tokens after it | Jarvislabs, 16k-token prompts on one H100 at 60 users: first token 10,802 ms against 1,874 ms, time per token 63 to 81 ms against 97 to 120 ms | chunked prefill at 8,192 tokens splits a long prompt and protects running decodes |
| Very high load with defaults: decode latency collapses | Jarvislabs, no concurrency cap: mean ITL 100.92 ms against 28.84 ms | probably decode past the graph limit of 256. This is our hypothesis, not theirs |
| DeepSeek-class MoE on many GPUs: SGLang is the reference | SemiAnalysis InferenceMAX chose SGLang as the default engine for DeepSeek R1. Crusoe's audited MLPerf v6.1 result used SGLang 0.5.15.post1 on 512 MI355X GPUs | attention data parallel and expert parallel, see [section 6.2](#s-moe-serving-deepep-and-eplb) |
| Speculative decoding: helps large GPUs, hurts small ones | InferenceX, GLM-5 with MTP on B200 at 4 users: time per token 18.43 ms down to 9.92 ms. Varad More on an A10G: 7 to 28 percent slower | draft cost against acceptance, see [section 4.4](#s-speculative-decoding) |

The links: [Spheron](https://www.spheron.network/blog/vllm-vs-tensorrt-llm-vs-sglang-benchmarks/) {{field Spheron 2026}}, [Modal](https://modal.com/llm-almanac/summary) {{field Modal 2025-06}}, [Varad More](https://github.com/varad-more/inference-engine-benchmark-system) {{field Varad-More 2026-04}}, [Steve Rawlinson](https://rawlinson.ca/articles/vllm-vs-sglang-performance-benchmark-h100) {{field Rawlinson 2025-12}}, [RunPod](https://runpod.ghost.io/when-to-choose-sglang-over-vllm-multi-turn-conversations-and-kv-cache-reuse/) {{field RunPod 2025-06}}, [Jarvislabs](https://jarvislabs.ai/blog/vllm-sglang-trtllm-comparison) {{field Jarvislabs 2026-05}}, [SemiAnalysis](https://newsletter.semianalysis.com/p/inferencemax-open-source-inference) {{field SemiAnalysis 2025-10}}, [Crusoe](https://www.crusoe.ai/resources/blog/serving-5-75-million-tokens-per-second-crusoes-mlperf-inference-v6-1-results-on-amd-mi355x) {{field Crusoe 2026-09}}, and [InferenceX](https://inferencex.semianalysis.com/blog/mi355x-glm5-fp8-sglang-40-cheaper-than-b200) {{field InferenceX 2026-05}}.

Read the caveats with the numbers. Rawlinson left SGLang memory at its default and vLLM at 0.9, so the two KV pools differed. Jarvislabs did not record either engine version. Spheron, RunPod, Modal, and Jarvislabs sell GPU time, which is a reason to run tests and no reason to favor one engine. The Crusoe result is the only one here that passed an external audit. Its p99 time per token was 79.98 ms against a limit of 80.

```figure
id: fig-5-3b
kind: structure
title: six findings and the mechanism behind each
claim: Every independent result in this section traces to one mechanism you can test on your own server.
caption: Read each row left to right, from the workload to the reported result to the SGLang mechanism. Olive is the client side, violet the kernels, green the cache. From the field reports cited in this section.
```

## Fragile on new hardware

The same reports show one more pattern. A Blackwell workstation card ran SGLang only with `--disable-cuda-graph`, according to [joshua8.ai](https://joshua8.ai/llm-inference-benchmark/) {{field joshua8 2026-01}}. A mixed cluster crashed when an older card joined, because the FP4 path required compute capability 10.0. [Pivot News](https://pivotnews.ai/build/benchmarking-vllm-vs-sglang-vs-llama-cpp-on-a-mixed-blackwel) summarized that community post {{field Pivot-News 2026-05}}. The fast paths are written per GPU generation, and the paths for other GPUs are fewer. On new hardware, expect the first SGLang release to be slow or broken, and measure again every week.

## What our own machines showed

Field reports tell you which mechanism to test. We tested them on a DGX Spark with a GB10 and on a machine with two 24 GB L4s. Each row below links to the section with the listings, the seeds, and the chart.

| Where | What we ran | Result | Mechanism |
|---|---|---|---|
| L4 | 4,096-token shared prompt, cache on and off | median TTFT 479 ms against 14,706 ms, 4.3 times the throughput, [section 3.3](#s-radixcache) | the radix cache |
| L4 | FP8 weights and KV against BF16 at 64 users | 736 against 251 tok/s, a pool of 142,369 tokens against 24,094, [section 4.3](#s-quantization) | more KV per GB |
| GB10 | EAGLE-3 on Qwen3-30B-A3B | time per token 1.60 to 1.89 times shorter, and the gain grew with the batch, [section 4.4](#s-speculative-decoding) | MoE verify reuses the expert weights it read |
| L4 | EAGLE-3 on dense Qwen3-8B | 2.37 times the throughput at one user, 1.00 at 32, [section 4.4](#s-speculative-decoding) | the draft took 59 percent of the pool |
| L4 pair | `--dp-size 2` with one shared card | 42 against 251 tok/s at 64 users, [section 6.1](#s-tp-size-dp-size-and-attn-dp-size) | round robin fed a copy with an eighth of the pool |
| L4 | SGLang 0.5.22 against vLLM 0.31.0, same pool, 64 users | 257 against 241 tok/s, P99 ITL 114 against 1,363 ms, median TTFT 18,356 against 10,953 ms, [below](#s-reading-other-peoples-benchmarks) | two different admission choices at a full pool |
| L4 pair | `--tp-size 2` with one shared card | refused at startup, [section 6.1](#s-tp-size-dp-size-and-attn-dp-size) | the memory balance check |
| L4 pair | prefill and decode split over TCP | every request after minute three came back empty with HTTP 200, [section 6.3](#s-prefill-decode-disaggregation) | the transfer session failed and did not recover |

The pattern is the same in every row. SGLang wins by a large factor when a mechanism removes repeated work. Examples are the prefill of a shared prompt and the bytes of each cached token. It loses when a feature spends memory that the batch needs, or when two parts of a deployment are not the same size. None of the losses printed an error that a dashboard would show. Two of them looked like success in the benchmark summary.

## SGLang against vLLM on the same L4

Every field report above compares two engines that someone else configured. We ran our own pair on one L4 with `Qwen/Qwen3-8B` and the closed-loop sweep of [section 5.1](#s-sglang-benchmark-serving). We made three choices so that only the engine differed.

- **The same KV pool.** The vLLM server got `--num-gpu-blocks-override 1506`, which is 1,506 blocks of 16 tokens. SGLang sized 24,094 tokens for itself on the same card.
- **The same card state.** Both engines ran in one session on one GPU, and every run started at 72 C or below. A run with a median SM clock under 1,000 MHz was set aside and repeated, up to three times.
- **No accidental handicap.** The vLLM server got `--max-model-len 8192`, which every request fits, and `VLLM_USE_FLASHINFER_SAMPLER=0`, because its FlashInfer sampler did not compile in our install. The benchmark is greedy, so the sampler does not change the output.

```listing
title: two pools of the same size
source: capture/gpu/out-l4/server-h2h-sglang.log
lang: text
note: The SGLang pool at startup, and one decode line at a cap of 64.
---
[2026-10-17 18:27:40] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
[2026-10-17 20:12:04] Decode batch, #running-req: 37, #token: 22162, token usage: 0.92, cuda graph: True, gen throughput (token/s): 432.55, #queue-req: 27
```

```listing
title: the vLLM pool, and vLLM at a cap of 64
source: capture/gpu/out-l4/server-h2h-vllm.log
lang: text
note: The vLLM pool at startup, and one stats line at a cap of 64.
---
INFO 10-17 20:13:17 [kv_cache_utils.py:2464] GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
INFO 10-17 22:35:43 [loggers.py:320] Engine 000: Avg prompt throughput: 460.3 tokens/s, Avg generation throughput: 323.6 tokens/s, Running: 40 reqs, Waiting: 11 reqs, GPU KV cache usage: 99.5%, Prefix cache hit rate: 8.7%
```

| Concurrency | Output tok/s, SGLang / vLLM | Median TTFT, SGLang / vLLM | P99 ITL, SGLang / vLLM | Median SM clock, SGLang / vLLM |
|---|---|---|---|---|
| 1 | 13.84 / 13.51 | 185 / 192 ms | 104 / 105 ms | 1,290 / 1,290 MHz |
| 8 | 112.46 / 112.79 | 170 / 253 ms | 71 / 68 ms | 1,485 / 1,470 MHz |
| 16 | 201.13 / 200.90 | 212 / 289 ms | 81 / 80 ms | 1,470 / 1,425 MHz |
| 32 | 271.28 / 273.93 | 2,871 / 1,813 ms | 102 / 619 ms | 1,320 / 1,275 MHz |
| 64 | 256.62 / 241.39 | 18,356 / 10,953 ms | 114 / 1,363 ms | 1,215 / 1,013 MHz |

```figure
id: fig-5-3c
kind: chart
title: Same throughput, two different choices at a full pool
claim: At 64 users on the L4, vLLM gave the first token 1.7 times sooner and SGLang kept the P99 inter-token latency 12 times lower.
caption: Solid lines are median TTFT and dashed lines are P99 inter-token latency, three seeds per point, on a log scale. Blue is SGLang and amber is vLLM. From capture/gpu/summary/l4.json.
```

**We measured** a tie in throughput. Up to 32 users, the two engines were within 3 percent of each other, and time per token was within 6 percent. At 64 users the median time per token was 106 ms on SGLang and 129 ms on vLLM. Below the point where the pool fills, SGLang gave the first token sooner, 170 against 253 ms at 8 users.

Above that point, the engines made different choices, and the stats lines show both. SGLang ran 37 requests and kept 27 waiting, with the pool 92 percent full. The vLLM server ran 40 requests and kept 11 waiting. It filled 99.5 percent of its pool while it prefilled new prompts at 460 tokens per second.

The vLLM server started more requests, so their first token came sooner. Each new prefill then shared the step with the running decodes, so the streams stalled. At 64 users the worst inter-token gap was 1,363 ms on vLLM and 114 ms on SGLang.

The clock caveat belongs with the last row. Even after three tries, the vLLM runs at 64 users had a median clock of 1,013 MHz against 1,215 MHz for SGLang. So part of the throughput gap at 64 can be the card. The 12-times gap in inter-token latency is too large for a 17 percent clock difference.

This is one model, one GPU, and one workload with unique prompts. It agrees with the field reports on the main point: on a dense model with unique prompts, the engines tie on throughput. It adds the part that a throughput chart hides. When the pool is full, you choose between a fast first token and a smooth stream, and the two engines chose differently by default.

## Our position

For a dense model with unique prompts, the choice of engine is not a throughput decision. It is a latency decision at a full pool: SGLang protected the stream, and vLLM the first token. Decide on model support, startup time, and the hardware you have. For repeated prefixes, SGLang has a real advantage that is smaller than the stories about it. For DeepSeek-class MoE models on many GPUs, start from SGLang, because that is where the field runs them.

Above all, do not import a result. Run the sweep from [section 5.1](#s-sglang-benchmark-serving) on your own workload. A published number tells you which mechanism to test, and nothing more.

## The incidents

**A memory result that was a flag error.** In [vLLM discussion #17221](https://github.com/vllm-project/vllm/discussions/17221), a user first saw SGLang use 7 GB against vLLM's 21 GB on one A10 {{field vLLM-discussion 2025-04}}. Then the user found that the flag that matches vLLM's `--max-model-len` is `--context-length`, not `--max-total-tokens`. With the right flag, memory use was about the same.

**Advice that no longer parses.** Field reports from 2026 advise raising the decode graph limit with `--cuda-graph-max-bs`. At v0.5.22 that flag is split into `--cuda-graph-max-bs-decode` and `--cuda-graph-max-bs-prefill`. **The code** rejects the old spelling. The argument parser of `sglang serve` stops with `ambiguous option: --cuda-graph-max-bs could match --cuda-graph-max-bs-decode, --cuda-graph-max-bs-prefill`. A tuning recipe is tied to its version as tightly as a benchmark is.

**The recycled number.** The 29 percent pair from the start of this section was criticized by DeepInfra on 2026-08-04 for its version gap {{field DeepInfra 2026-08}}. The author answered on 2026-10-14 that the result "should not be extrapolated" to long context {{field AIMultiple 2026-10}}. The SGLang team made a larger claim in 2024: "up to 3.1x higher throughput on Llama-70B" {{team 2024-07}}. No independent report found in this research reproduced a gap of that size on a dense model with unique prompts.

```takeaways
- Compare engines at matched KV pools and matched GPU clocks, or not at all.
- Read P99 ITL next to TTFT, because a full pool trades one for the other.
- Find the SGLang version and date before you read any number.
- Match the workload shape to yours, including the share of repeated prefix.
- Check that both engines ran with matched memory budgets and context flags.
- Compare the test concurrency with the decode graph limit for that GPU.
- Label each source as independent, GPU cloud, vendor, competitor, or SGLang team.
- Use `--cuda-graph-max-bs-decode` at v0.5.22, because the old flag is ambiguous.
```

Sources: python/sglang/srt/arg_groups/memory_hook.py (GPU memory tiers), python/sglang/srt/arg_groups/fields/exec_.py (cuda_graph_max_bs_decode), python/sglang/srt/arg_groups/fields/schedule.py, all at v0.5.22 (baa9befa); the field reports linked in the text, fetched 2026-10-16; aimultiple.com/inference-engines; deepinfra.com/blog/vllm-vs-sglang; lmsys.org/blog/2024-07-25-sglang-llama3; inferencex.semianalysis.com/blog/mi355x-deepseek-v4-pro-sglang-110x-in-26-days. capture/gpu/out-l4/server-h2h-sglang.log, capture/gpu/out-l4/server-h2h-vllm.log, capture/gpu/summary/l4.json, capture/gpu/sweep.py (vllm and sglang-h2h configs), capture/gpu/incidents/l4-vllm-flashinfer-jit.txt.
