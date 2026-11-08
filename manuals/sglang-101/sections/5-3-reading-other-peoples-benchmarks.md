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

**The code** sets the third input from GPU memory at startup. Take an 80 GB H100 with tensor parallel size below 4. The default decode graph limit is 256, and the chunked prefill size is 8,192. On a 32 GB card the limit is 48, raised from 24 on 2026-09-04. The code comment on that change says the old cap made throughput at high concurrency fall far behind vLLM {{code}}.

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
| L4 | 4,096-token shared prompt, cache on and off | median TTFT 479 ms against 14,706 ms, 4.3 times the throughput, with the cache-off run at 930 MHz, under our clock floor, [section 3.3](#s-radixcache) | the radix cache |
| L4 | FP8 weights and KV against BF16 at 64 users | 736 against 251 tok/s, a pool of 142,369 tokens against 24,094, [section 4.3](#s-quantization) | more KV per GB |
| GB10 | EAGLE-3 on Qwen3-30B-A3B | time per token 1.56 to 1.89 times shorter, largest at 16 to 64 users, [section 4.4](#s-speculative-decoding) | MoE verify reuses the expert weights it read |
| L4 | EAGLE-3 on dense Qwen3-8B | 2.37 times the throughput at one user, with the default at a 19 percent lower clock, and 1.00 at 32, [section 4.4](#s-speculative-decoding) | the draft took 59 percent of the pool |
| L4 pair | `--dp-size 2` with one shared card | 42 against 251 tok/s at 64 users, with the pair at 675 MHz, under our clock floor, [section 6.1](#s-tp-size-dp-size-and-attn-dp-size) | round robin fed a copy with an eighth of the pool |
| L4 | SGLang 0.5.22 against vLLM 0.31.0, same pool, 64 users | 257 against 241 tok/s, P99 ITL 114 against 1,363 ms, median TTFT 18,356 against 10,953 ms, [below](#s-reading-other-peoples-benchmarks) | two different admission choices at a full pool |
| L4 | the same pair on a 4,096-token shared prompt | 88.4 against 86.8 tok/s, median TTFT 474 against 375 ms, [below](#s-reading-other-peoples-benchmarks) | two prefix caches that both hit |
| L4 | the same pair at 4 requests per second, Poisson arrivals | 257.5 against 286.6 tok/s, P99 TPOT 127 against 187 ms, [below](#s-reading-other-peoples-benchmarks) | the same admission choice under a fixed rate |
| L4 | the same pair with mixed prompt lengths at 16 users | 159.6 against 169.6 tok/s, P99 ITL 363 against 191 ms, [below](#s-reading-other-peoples-benchmarks) | how each engine mixes prefill into the stream |
| L4 pair | `--tp-size 2` with one shared card | refused at startup, [section 6.1](#s-tp-size-dp-size-and-attn-dp-size) | the memory balance check |
| L4 pair | prefill and decode split over TCP | every request after minute three came back empty with HTTP 200, [section 6.3](#s-prefill-decode-disaggregation) | the transfer session failed and did not recover |

Most rows follow one pattern. A mechanism wins by a large factor when it removes repeated work, in either engine. Examples are the prefill of a shared prompt and the bytes of each cached token. It loses when a feature spends memory that the batch needs, or when two parts of a deployment are not the same size. None of the losses at runtime printed an error that a dashboard would show. Two of them looked like success in the benchmark summary.

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

The vLLM server started more requests, so their first token came sooner. Each new prefill then shared the step with the running decodes, so the streams stalled. At 64 users the P99 inter-token gap was 1,363 ms on vLLM and 114 ms on SGLang.

The clock caveat belongs with the last row. Even after three tries, the vLLM runs at 64 users had a median clock of 1,013 MHz against 1,215 MHz for SGLang. So part of the throughput gap at 64 can be the card. The 12-times gap in inter-token latency is too large for a 17 percent clock difference.

### The same pair on shared prompts

We then ran the prefix sweep of [section 3.3](#s-radixcache) on the same pair, with the same pools and the same cool-down rule. Each run sent 64 prompts in 4 groups of 16, at 8 users. The prompts in a group shared a system prompt of 0 to 4,096 tokens, then had a 128-token question and 64 tokens of output. SGLang used its radix cache. The vLLM server used its prefix caching, which is on by default at 0.31.0.

```listing
title: both caches hit
source: capture/gpu/out-l4/server-h2h-prefix-vllm.log
lang: text
note: The vLLM pool at startup, and one stats line at 4,096 shared tokens.
---
INFO 10-17 23:37:11 [kv_cache_utils.py:2464] GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
INFO 10-18 00:43:16 [loggers.py:320] Engine 000: Avg prompt throughput: 231.0 tokens/s, Avg generation throughput: 93.6 tokens/s, Running: 8 reqs, Waiting: 0 reqs, GPU KV cache usage: 77.2%, Prefix cache hit rate: 87.2%
```

The SGLang log shows the same thing in its own words. In one prefill batch at 4,096 shared tokens, 12,952 tokens came from the cache and 406 were new.

| Shared prompt tokens | Output tok/s, SGLang / vLLM | Median TTFT, SGLang / vLLM | P99 TTFT, SGLang / vLLM |
|---|---|---|---|
| 0 | 113.5 / 113.8 | 354 / 408 ms | 483 / 485 ms |
| 256 | 110.9 / 111.5 | 470 / 488 ms | 856 / 616 ms |
| 1,024 | 105.7 / 106.0 | 466 / 396 ms | 1,887 / 1,303 ms |
| 2,048 | 100.4 / 100.2 | 441 / 410 ms | 2,317 / 1,767 ms |
| 4,096 | 88.4 / 86.8 | 474 / 375 ms | 4,275 / 4,019 ms |

```figure
id: fig-5-3d
kind: chart
title: Two prefix caches, one result
claim: On the L4, both prefix caches kept the median TTFT under 500 ms at every shared length, and the cache-off run reached 14,706 ms.
caption: Median TTFT against shared prompt length at 8 users, three seeds per point, on a log scale. Blue is SGLang with the radix cache, and amber is vLLM with prefix caching. Dashed rose is SGLang with the cache off, from the earlier run in section 3.3. From capture/gpu/summary/l4.json.
```

**We measured** a tie on throughput, within 2 percent at every shared length. The median TTFT of both engines stayed between 354 and 488 ms. At 0 and 256 shared tokens, SGLang gave the first token sooner, outside the seed spread: 354 against 408 ms and 470 against 488 ms. From 1,024 tokens up, the seed ranges overlapped.

vLLM leaned ahead on the tail. Its P99 TTFT was lower from 256 shared tokens up, 1,303 against 1,887 ms at 1,024. SGLang had the shorter time per token at 4,096, 75.6 against 80.8 ms. The median SM clock of every run was 1,395 MHz or higher.

The size of the result is in the third line. With the cache off, a separate SGLang run needed 14,706 ms for the median first token at 4,096 shared tokens. That card ran under our clock floor. Both cached runs stayed under 500 ms. The difference between the two caches was about 100 ms.

We then ran the vLLM server with `--no-enable-prefix-caching`, with the same pool and the same sweep. Its log shows the cache off and every prompt token prefilled again.

```listing
title: vLLM with prefix caching off
source: capture/gpu/out-l4/server-h2h-prefix-vllm-no-cache.log
lang: text
note: The pool at startup, and one stats line at 4,096 shared tokens. The prompt throughput is high because nothing is reused.
---
INFO 10-21 06:20:24 [kv_cache_utils.py:2464] GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
INFO 10-21 08:07:49 [loggers.py:320] Engine 000: Avg prompt throughput: 1607.0 tokens/s, Avg generation throughput: 6.4 tokens/s, Running: 8 reqs, Waiting: 0 reqs, GPU KV cache usage: 76.7%
```

| Shared prompt tokens | Median TTFT, cache on / off, SGLang | Median TTFT, cache on / off, vLLM | Output tok/s, cache off, SGLang / vLLM |
|---|---|---|---|
| 256 | 470 / 985 ms | 488 / 753 ms | 99.4 / 99.1 |
| 1,024 | 466 / 2,202 ms | 396 / 1,213 ms | 70.2 / 70.9 |
| 4,096 | 474 / 14,706 ms | 375 / 13,353 ms | 20.8 / 19.6 |

**We measured** the same size of gain in both engines. At 4,096 shared tokens, the cache cut the median first token about 31 times on SGLang and 36 times on vLLM. It gave 4.2 times the output on SGLang and 4.4 times on vLLM. Without a cache, the two engines tied on throughput within 7 percent.

Without a cache, the vLLM server gave the first token sooner at 256 to 2,048 shared tokens. Its SGLang counterpart ran on another day. The vLLM run with the cache off was on 2026-10-21, four days after the vLLM run with the cache on. The runs at 4,096 shared tokens stayed under our clock floor after three tries, at 930 and 675 MHz. Read that row for its size, not its exact value.

### The same pair at a fixed arrival rate

A closed loop sends a new request only when one comes back, so the engine sets the pace. Production traffic does not wait for the engine. We ran the rate sweep of [section 5.1](#s-sglang-benchmark-serving) on the same pair, with the same pools and the same rules for heat and clock. Requests arrived at a Poisson rate from 0.5 to 16 per second, with 512 input and 128 output tokens. Each run sent at least 32 prompts, or 30 seconds of arrivals.

```listing
title: the same admission choice under a fixed rate
source: capture/gpu/out-l4/server-h2h-rate-sglang.log
lang: text
note: The SGLang pool at startup, and one decode line with requests waiting.
---
[2026-10-18 00:43:57] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
[2026-10-18 03:13:55] Decode batch, #running-req: 37, #token: 22424, token usage: 0.93, cuda graph: True, gen throughput (token/s): 370.33, #queue-req: 71
```

```listing
title: vLLM admits more at the same rate
source: capture/gpu/out-l4/server-h2h-rate-vllm.log
lang: text
note: The vLLM pool at startup, and one stats line with requests waiting.
---
INFO 10-18 03:15:35 [kv_cache_utils.py:2464] GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
INFO 10-18 06:10:22 [loggers.py:320] Engine 000: Avg prompt throughput: 1326.7 tokens/s, Avg generation throughput: 158.4 tokens/s, Running: 43 reqs, Waiting: 30 reqs, GPU KV cache usage: 99.7%, Prefix cache hit rate: 0.6%
```

| Requests per second | Output tok/s, SGLang / vLLM | Median TTFT, SGLang / vLLM | Median TPOT, SGLang / vLLM | P99 TPOT, SGLang / vLLM | Median SM clock, SGLang / vLLM |
|---|---|---|---|---|---|
| 0.5 | 70.6 / 70.6 | 284 / 317 ms | 74.7 / 72.7 ms | 81 / 78 ms | 1,485 / 1,485 MHz |
| 1 | 123.3 / 123.6 | 166 / 180 ms | 74.0 / 68.2 ms | 76 / 69 ms | 1,500 / 1,485 MHz |
| 2 | 226.3 / 227.8 | 221 / 233 ms | 99.9 / 88.7 ms | 120 / 109 ms | 1,433 / 1,418 MHz |
| 4 | 257.5 / 286.6 | 9,575 / 8,304 ms | 115.1 / 126.9 ms | 127 / 187 ms | 1,350 / 1,245 MHz |
| 8 | 253.9 / 261.8 | 37,211 / 27,510 ms | 105.2 / 126.0 ms | 151 / 248 ms | 1,215 / 1,035 MHz |
| 16 | 218.2 / 205.8 | 97,542 / 94,322 ms | 115.2 / 185.2 ms | 189 / 322 ms | 600 / 450 MHz |

```figure
id: fig-5-3e
kind: chart
title: The same choice at a fixed arrival rate
claim: At 4 requests per second on the L4, vLLM gave 11 percent more output and SGLang kept the P99 time per token 32 percent lower.
caption: Solid lines are median TTFT and dashed lines are P99 time per output token, three seeds per point, on a log scale. Blue is SGLang and amber is vLLM. From capture/gpu/summary/l4.json.
```

**We measured** a tie up to 2 requests per second. Both engines kept up with the arrivals, so throughput was within 1 percent. SGLang gave the first token sooner at 0.5 and 1 per second, outside the seed spread. The medians were 284 against 317 ms and 166 against 180 ms. vLLM had the shorter time per token. It was 68 against 74 ms at 1 per second, outside the spread, and 89 against 100 ms at 2.

Goodput shows what that means for a target. We set the target at 1 s to the first token and 100 ms per token. At 2 requests per second, vLLM served a median of 1.36 requests per second within the target, and SGLang 0.88. The seed ranges overlapped, 1.09 to 1.44 against 0.54 to 1.18. The SGLang median time per token was 99.9 ms, on the line of the target.

From 4 requests per second, both engines fell behind the arrivals, and no request met the target. The stats lines show the same admission choice as in the closed loop. SGLang ran 37 requests with the pool 93 percent full. The vLLM server ran 43 requests and filled 99.7 percent of its pool.

At 4 per second, vLLM gave 286.6 against 257.5 tok/s, 11 percent more and outside the seed spread. Its median first token came at 8.3 against 9.6 s, but those seed ranges overlapped. The cost was the stream: its P99 time per token was 187 against 127 ms, outside the spread.

The clock does not explain the gap at 4. The vLLM runs had the lower median clock, 1,245 against 1,350 MHz. At 8 per second the throughput ranges overlapped. At 16 per second, every run of both engines stayed under 1,000 MHz after three tries, so we do not compare that row.

### The same pair on waves

The last workload is the one from [section 5.1](#s-sglang-benchmark-serving) that makes requests arrive in waves. Each run sent 64 prompts of 512 tokens with 128 tokens of output, at a cap of 16 users. Only `--random-range-ratio` changed. At 1.0 every prompt has the same length, so requests finish together and their replacements arrive together. At 0.5 and 0.0 the lengths are mixed, so requests arrive one by one.

```listing
title: vLLM in the middle of a wave
source: capture/gpu/out-l4/server-h2h-waves-vllm.log
lang: text
note: The vLLM pool at startup, and one stats line with 16 requests running.
---
INFO 10-18 18:38:07 [kv_cache_utils.py:2464] GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
INFO 10-18 19:14:22 [loggers.py:320] Engine 000: Avg prompt throughput: 960.0 tokens/s, Avg generation throughput: 187.3 tokens/s, Running: 16 reqs, Waiting: 0 reqs, GPU KV cache usage: 22.6%, Prefix cache hit rate: 8.5%
```

| Length ratio | Output tok/s, SGLang / vLLM | Median TTFT, SGLang / vLLM | Median TPOT, SGLang / vLLM | P99 ITL, SGLang / vLLM |
|---|---|---|---|---|
| 1.0, fixed lengths | 182.3 / 181.7 | 1,775 / 1,499 ms | 74.7 / 76.8 ms | 81 / 502 ms |
| 0.5, mixed | 159.6 / 169.6 | 325 / 353 ms | 87.8 / 81.4 ms | 363 / 191 ms |
| 0.0, mixed | 158.2 / 174.4 | 283 / 284 ms | 86.7 / 75.0 ms | 302 / 202 ms |

**We measured** a different winner for each traffic shape. With fixed lengths, the two engines tied on throughput. They made the same trade as at a full pool. The vLLM server gave the first token sooner, 1,499 against 1,775 ms, outside the seed spread. SGLang kept the stream smooth, with a P99 ITL of 81 against 502 ms.

With mixed lengths, vLLM led. At a ratio of 0.5 it gave 169.6 against 159.6 tok/s, 6 percent more and outside the seed spread. Its median time per token was 81.4 against 87.8 ms, and its P99 ITL was 191 against 363 ms. At 0.0 the throughput ranges overlapped, and vLLM still had the lower time per token and the lower P99 ITL. Every median clock was 1,410 MHz or higher.

Our reading: when new prompts arrive one by one, each prefill shares a step with the running decodes. The vLLM server split that work so that the stream stalled less.

To test that reading, we ran SGLang again with `--enable-mixed-chunk` on 2026-10-21, with the same sweep and the same pool. This flag puts the running decodes into the prefill batch, so a new prompt does not stop the stream. The log shows one prefill of 514 tokens with 15 requests running in the same batch.

```listing
title: SGLang with the mixed chunk in the middle of a wave
source: capture/gpu/out-l4/server-waves-mixed-chunk.log
lang: text
note: The pool at startup, one decode step with 16 users, and one prefill that ran together with 15 decodes.
---
[2026-10-21 08:34:19] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
[2026-10-21 08:39:51] Decode batch, #running-req: 16, #token: 8889, token usage: 0.37, cuda graph: True, gen throughput (token/s): 231.46, #queue-req: 0
[2026-10-21 08:40:22] Prefill batch, #new-seq: 1, #new-token: 514, #cached-token: 0, token usage: 0.34, #running-req: 15, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 2569.89
```

| Length ratio | Output tok/s, SGLang mixed chunk / vLLM | Median TPOT, SGLang mixed chunk / vLLM | P99 ITL, SGLang default / mixed chunk / vLLM |
|---|---|---|---|
| 1.0, fixed lengths | 182.3 / 181.7 | 73.1 / 76.8 ms | 81 / 203 / 502 ms |
| 0.5, mixed | 171.8 / 169.6 | 80.8 / 81.4 ms | 363 / 193 / 191 ms |
| 0.0, mixed | 171.9 / 174.4 | 76.8 / 75.0 ms | 302 / 196 / 202 ms |

**We measured** that the mixed chunk closed the gap. With mixed lengths, SGLang now tied vLLM on throughput, time per token, and P99 ITL, and every seed range overlapped. Against SGLang without the flag, the P99 ITL fell from 363 to 193 ms at 0.5 and from 302 to 196 ms at 0.0. The output rose by about 8 percent.

The flag had a cost with fixed lengths. The median P99 ITL rose from 81 to 203 ms, and the three seeds spread from 83 to 349 ms. When a whole wave arrives together, the prefills now share steps with the decodes, so the stream loses the clean gaps that it had before. The vLLM server stayed worse there, at 502 ms.

The GB10 with Qwen3-30B-A3B, against a default run on the same day, moved in the same direction, but every change was inside the seed spread. With mixed lengths, the median P99 ITL went from 198 to 164 ms at 0.5 and from 214 to 202 ms at 0.0. With fixed lengths, it went from 159 to 210 ms. The flag also raised the median TTFT at 0.0 from 324 to 442 ms, outside the spread. Read the GB10 as a weak second sign, not a second proof.

One caveat applies. The SGLang default run on the L4 was from 2026-10-18, three days before the mixed-chunk run. The median clocks were 1,425 to 1,508 MHz with the flag and 1,440 to 1,485 MHz without it. The clock does not explain the gap.

This is one model, one GPU, and four workloads. It agrees with the field reports on the main point. On a dense model with unique prompts, the engines were within 3 percent on throughput in the closed loop up to 32 users. Under load they were up to 11 percent apart. 

The sweep adds the part that a throughput chart hides. When the pool is full, you choose between a fast first token and a smooth stream, and the two engines chose differently by default. With mixed prompt lengths, vLLM was ahead by default on throughput and stream smoothness. SGLang still gave the first token at the same time or sooner. One SGLang flag, `--enable-mixed-chunk`, removed that lead.

To see why one GPU number differs from another, run the [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu) machine. It reads its pool sizes, step times and throughputs from the same summaries as this section, for the L4 and the GB10. It says when a setting was not measured.

## Our position

On our L4 with Qwen3-8B and unique prompts, the choice of engine was mostly not a throughput decision. It was a latency decision, and the shape of the traffic picked the winner. When requests arrived together, at a full pool or in waves, SGLang protected the stream and vLLM the first token. When prompts of mixed lengths arrive one by one, vLLM led by default on throughput and stream smoothness. With the mixed chunk on, SGLang tied it.

At 4 requests per second, past the full pool, vLLM also gave 11 percent more output on our L4. At 8 per second the seed ranges overlapped. Decide on model support, startup time, and the hardware you have, then measure your own length mix.

For repeated prefixes, check that the prefix cache is on, then measure. On our L4, with prefixes that fit the pool, the two caches tied under 500 ms. With the cache off, SGLang took 14,706 ms and vLLM 13,353 ms. The cache is the result, not the engine. For DeepSeek-class MoE models on many GPUs, start from SGLang, because that is where the field runs them.

Above all, do not import a result. Run the sweep from [section 5.1](#s-sglang-benchmark-serving) on your own workload. A published number tells you which mechanism to test, and nothing more.

## The incidents

**A memory result that was a flag error.** In [vLLM discussion #17221](https://github.com/vllm-project/vllm/discussions/17221), a user first saw SGLang use 7 GB against vLLM's 21 GB on one A10 {{field vLLM-discussion 2025-04}}. Then the user found that the flag that matches vLLM's `--max-model-len` is `--context-length`, not `--max-total-tokens`. With the right flag, memory use was about the same.

**Advice that no longer parses.** Field reports from 2026 advise raising the decode graph limit with `--cuda-graph-max-bs`. At v0.5.22 that flag is split into `--cuda-graph-max-bs-decode` and `--cuda-graph-max-bs-prefill`. **The code** rejects the old spelling. The argument parser of `sglang serve` stops with `ambiguous option: --cuda-graph-max-bs could match --cuda-graph-max-bs-decode, --cuda-graph-max-bs-prefill`. A tuning recipe is tied to its version as tightly as a benchmark is.

**The recycled number.** The 29 percent pair from the start of this section was criticized by DeepInfra on 2026-08-04 for its version gap {{field DeepInfra 2026-08}}. The author answered on 2026-10-14 that the result does not carry over to long context {{field AIMultiple 2026-10}}. The SGLang team made a larger claim in 2024: up to 3.1 times the throughput on Llama-70B {{team 2024-07}}. No independent report found in this research reproduced a gap of that size on a dense model with unique prompts.

```takeaways
- Compare engines at matched KV pools and matched GPU clocks, or not at all.
- Read P99 ITL next to TTFT, because a full pool trades one for the other.
- Find the SGLang version and date before you read any number.
- Match the workload shape to yours, including the share of repeated prefix.
- Check that prefix caching is on in both engines before you compare them on repeated prompts.
- Test a fixed arrival rate too, because a closed loop never falls behind.
- Check that both engines ran with matched memory budgets and context flags.
- Compare the test concurrency with the decode graph limit for that GPU.
- Turn on --enable-mixed-chunk in SGLang before you compare it on mixed prompt lengths, and test fixed lengths too.
- Label each source as independent, GPU cloud, vendor, competitor, or SGLang team.
- Use `--cuda-graph-max-bs-decode` at v0.5.22, because the old flag is ambiguous.
```

Sources: python/sglang/srt/arg_groups/memory_hook.py (GPU memory tiers), python/sglang/srt/arg_groups/fields/exec_.py (cuda_graph_max_bs_decode), python/sglang/srt/arg_groups/fields/schedule.py, all at v0.5.22 (baa9befa); the field reports linked in the text, fetched 2026-10-16; aimultiple.com/inference-engines; deepinfra.com/blog/vllm-vs-sglang; lmsys.org/blog/2024-07-25-sglang-llama3; inferencex.semianalysis.com/blog/mi355x-deepseek-v4-pro-sglang-110x-in-26-days. capture/gpu/out-l4/server-h2h-sglang.log, capture/gpu/out-l4/server-h2h-vllm.log, capture/gpu/out-l4/server-h2h-prefix-sglang.log, capture/gpu/out-l4/server-h2h-prefix-vllm.log, capture/gpu/out-l4/server-h2h-rate-sglang.log, capture/gpu/out-l4/server-h2h-rate-vllm.log, capture/gpu/out-l4/server-h2h-waves-vllm.log, capture/gpu/summary/l4.json, capture/gpu/sweep.py (vllm and sglang-h2h configs), capture/gpu/incidents/l4-vllm-flashinfer-jit.txt; capture/gpu/out-l4/server-h2h-prefix-vllm-no-cache.log, capture/gpu/summary/l4.json (prefix.vllm-no-prefix-cache); capture/gpu/out-l4/server-waves-mixed-chunk.log, capture/gpu/summary/l4.json (waves.mixed-chunk), capture/gpu/summary/gb10.json (waves.mixed-chunk, waves.graphs-on-b).
