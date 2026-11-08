# Decide between vLLM and SGLang

> With a fixed number of users, the engines tied on throughput on our machines, and the shape of the traffic decided latency.

You are choosing a serving engine and you want a measurement, not a reputation. When you finish this section, you can match your traffic to one of our side-by-side runs and say how far the result goes.

**Our result:** on our L4, throughput matched within 3 percent up to 32 users. On our DGX Spark, the worst token gap of vLLM was about twice that of SGLang from 32 users.

## Know what we compared

We ran vLLM 0.31.0 and SGLang 0.5.22 with their defaults on two machines:

- An NVIDIA L4 with `Qwen/Qwen3-8B` in BF16, in [the full-clock session](#l4-sessions). Both pools held about 24,100 tokens. The load runs were on 2026-10-17, and the rate and waves runs on 2026-10-18.
- A DGX Spark with `Qwen/Qwen3-30B-A3B-Instruct-2507` in BF16. The pools held 234,960 tokens for vLLM and between 233,303 and 251,910 tokens for SGLang. Each SGLang run was on the same day as its vLLM run, 2026-10-21.

Each point is the median of three seeds, from [one benchmark client](#s-benchmark-your-server-in-15-minutes) for both engines. This is two models on two cards. Treat the results as a guide to what you should measure, not as a rule.

## Read the result for your traffic

| Your traffic | What we measured | Pick |
|---|---|---|
| Many users at once, near the pool limit | Throughput tied within 3 percent up to 32 users on the L4. vLLM gave the first token sooner, SGLang gave a smoother stream. | vLLM for the first token, SGLang for the stream |
| A fixed request rate past what the GPU can serve | At 4 requests per second, vLLM gave 11 percent more output on the L4 | vLLM |
| Prompts of mixed length, 16 users at once | vLLM had the lower P99 ITL on both machines | vLLM by default |
| Prompts of the same length, 16 users at once | SGLang had the lower P99 ITL on both machines | SGLang |
| Long prompts of mixed length at a fixed rate, DGX Spark | vLLM had the lower P99 ITL at 0.5 requests per second, SGLang at 2 | measure at your rate |
| Repeated prefixes that fit the pool | Both caches gave the first token within about 100 ms of each other | either one |
| A mixture-of-experts model on a DGX Spark, many users | Throughput tied. The vLLM P99 ITL was about twice the SGLang value from 32 users. | SGLang for the stream |

## See the numbers behind each row

**Many users at once, L4.** At 32 users, vLLM gave 273.9 tok/s and SGLang 271.3. The median first token took 1,813 ms on vLLM and 2,871 ms on SGLang. The P99 ITL was 619 ms on vLLM and 102 ms on SGLang. At 64 users the output differed by 6 percent. The vLLM run had a lower median clock, 1,013 against 1,215 MHz, so we do not count that gap.

These runs did not reset the prefix cache. We ran them again with a reset at 900 MHz on 2026-10-23, and the direction held. At 32 users the median first token was 2.0 to 2.1 s on vLLM and 3.2 s on SGLang. The P99 ITL was 668 to 964 ms on vLLM and 105 to 106 ms on SGLang. At 16 users it was 522 ms against 82 ms.

**A fixed rate, L4.** At 4 requests per second, vLLM gave 286.6 tok/s and SGLang 257.5. The seed ranges did not overlap. At 8 requests per second the ranges overlapped. The runs at 16 requests per second ran below our clock floor, the lowest clock we accept for a run, so we left them out.

**Mixed and equal lengths, both machines.** Our waves workload sent 64 prompts at 16 users, with a length ratio that sets how much the prompt and output lengths vary. [The lab notes](#s-ref-lab-notes) define it. With mixed lengths on the L4, the P99 ITL was 191 ms on vLLM and 363 ms on SGLang. With equal lengths it was 502 ms on vLLM and 81 ms on SGLang. The DGX Spark showed the same direction: 188 against 198 ms with mixed lengths, and 394 against 159 ms with equal lengths.

**Mixture of experts, DGX Spark.** At 64 users, vLLM gave 239.3 tok/s and SGLang 245.1, inside the seed spread. The P99 ITL was 528 ms on vLLM and 271 ms on SGLang, and 478 against 220 ms at 32 users. The seed ranges did not overlap. The median first token was also longer on vLLM at every load from 2 users.

**Long prompts at a low rate, DGX Spark.** With prompts of about 1,000 to 4,000 tokens at 0.5 requests per second, vLLM had the lower P99 ITL, 571 against 922 ms. At 1 and 2 requests per second, SGLang had the lower one. For this sweep the SGLang pool was 7 percent larger than the vLLM pool, so read this row with care.

```figure
id: fig-5-3
kind: chart
title: throughput on the L4
claim: On our L4 with Qwen3-8B, vLLM and SGLang wrote the same output within 3 percent up to 32 users.
caption: Both servers had the same KV pool. Bands span three runs. From capture/gpu/summary/l4.json.
```

```figure
id: fig-5-3b
kind: chart
title: the worst token gap on the GB10
claim: On our DGX Spark, the 99th percentile token gap of vLLM was more than twice that of SGLang at 32 users.
caption: A higher line is a choppier stream. Bands span three runs. From capture/gpu/summary/gb10.json.
```

## Decide

Pick on the things that do not change with tuning first:

1. **Model support.** Check that your model and its quantization run on the engine and the version you pin.
2. **Startup time.** On our DGX Spark, vLLM took 330 seconds to load the 57 GiB of weights.
3. **Your hardware.** A result on an L4 or a GB10 does not carry over to a datacenter GPU without a test.

Then run [the sweep](#s-benchmark-your-server-in-15-minutes) on your own traffic with both engines. Use one benchmark client and equal pools.

```takeaways
- With a fixed number of users, the engines tied on throughput within a few percent on both machines. At a fixed rate past capacity, vLLM gave 11 percent more on the L4.
- vLLM gave the smoother stream with mixed prompt lengths, and SGLang with equal lengths.
- On the DGX Spark with a mixture-of-experts model, SGLang gave the smoother stream at high load.
- Pick on model support, startup, and hardware first, then measure your own traffic.
```

Sources: capture/gpu/summary/l4.json (load, rate, waves, and prefix for vllm and sglang), capture/gpu/summary/gb10.json (load, mixed, and waves for vllm and sglang), capture/gpu/out-l4/server-h2h-vllm.log, capture/gpu/out-gb10/server-load-vllm.log, capture/gpu/out-l4/load-flushed-vs-unflushed.txt.
