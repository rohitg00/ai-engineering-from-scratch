# Benchmark your server in 15 minutes

> One sweep over concurrency finds the point where your latency starts to grow, and four defaults change the result.

You changed a flag and you want to know if it helped. When you finish this section, you can run a concurrency sweep, find the latency jump, and avoid the four mistakes that make two runs disagree.

**Our result:** on our L4, output peaked near 275 tokens per second at 32 users and fell at 64 users.

## Run one sweep

Our tables came from the benchmark client of SGLang 0.5.22, not from the vLLM client, at temperature 0. We used one client for both engines, so that [the engine page](#s-decide-between-vllm-and-sglang) compares the engines with one method. To compare your GPU with our table, use the same client. Install it in a separate virtual environment, so that it does not change your vLLM install:

```bash
uv venv bench --python 3.12 --seed
source bench/bin/activate
uv pip install sglang==0.5.22
```

Start the vLLM server in one terminal. In a second terminal, run the client once for each concurrency. This is the command that made our table:

```bash
for c in 1 2 4 8 16 32 64; do
  python -m sglang.benchmark.serving --backend vllm --port 8000 \
    --dataset-name random --random-input-len 512 --random-output-len 128 --random-range-ratio 1.0 \
    --max-concurrency $c --num-prompts $((c * 4 > 16 ? c * 4 : 16)) --seed 1 \
    --output-file sweep-c$c.jsonl --output-details
done
```

We ran the loop three times, with `--seed 1`, `2`, and `3`, and report the median. With `--backend vllm`, the client sends each request to `/v1/completions`. It sends one warmup request first, and it tells the server to ignore the end-of-sequence token, so every answer has the full 128 tokens.

Each run prints a summary with four numbers. They are the output throughput, the time to first token (TTFT), the time per output token (TPOT), and the inter-token latency (ITL). Keep the four numbers together. A throughput number alone hides the latency that your users feel.

## Read the knee

**Knee:** the concurrency where the latency starts to rise fast while the output stops rising. Past the knee, more users get slower answers and the server writes almost no more tokens.

Here is the sweep from our L4 with `Qwen/Qwen3-8B` in BF16, run on 2026-10-21 in [the full-clock session](#l4-sessions). Each number is the median of three seeds. The pool was 24,096 tokens.

| Users, L4 full-clock session | Output tok/s | Median TTFT | Median TPOT | P99 ITL | Median SM clock |
|---|---|---|---|---|---|
| 1 | 13.5 | 191 ms | 60.4 ms | 105 ms | 1,275 MHz |
| 8 | 112.8 | 253 ms | 65.8 ms | 67 ms | 1,485 MHz |
| 16 | 201.3 | 288 ms | 69.5 ms | 85 ms | 1,455 MHz |
| 32 | 275.1 | 1,800 ms | 101.8 ms | 613 ms | 1,275 MHz |
| 64 | 242.3 | 11,181 ms | 129.2 ms | 1,233 ms | 1,005 MHz |

Up to 16 users, each new user adds output, and the time per token rises only from 60 to 70 ms. In this table, the median first token goes from 0.3 s to 1.8 s between 16 and 32 users. The P99 ITL goes from 85 to 613 ms.

Do not take that jump as the knee. This sweep did not reset the prefix cache between user counts, and each seed sent the same first prompts at every count. Below 32 users, many requests found their prompt in the cache. We ran the sweep again on 2026-10-23 with a reset before each run, with the clock locked at 900 MHz:

```listing
title: median TTFT with and without a cache flush, Qwen3-8B on our L4 at 900 MHz
source: capture/gpu/out-l4/load-flushed-vs-unflushed.txt
lang: text
note: The median TTFT rows. The share that met the target and the P99 ITL lines are cut.
---
median TTFT, flushed against unflushed
users   vLLM                                   SGLang
4       650 / 145 ms (4.5x)                    532 to 645 / 141 ms (3.8 to 4.6x)
8       951 to 978 / 264 to 274 ms (3.6x)      1,174 to 1,273 / 173 to 178 ms (6.6 to 7.3x)
16      1,550 to 1,587 / 294 to 295 ms (5.3x)  1,804 to 1,944 / 218 ms (8.3 to 8.9x)
32      1,982 to 2,084 / 2,012 to 3,091 ms     3,216 to 3,228 / 2,710 to 2,917 ms
…
```

With the reset, the median first token rose at every step. It was about 0.65 s at 4 users, 1.0 s at 8, and 1.6 s at 16. The P99 ITL jumped from about 70 ms at 8 users to 522 ms at 16. So on this card the knee sits between 8 and 16 users. The cache hid it. Pick your production concurrency below the knee that you measure with a reset.

At 64 users, the output fell. Two causes overlap here. At 640 tokens each, 64 users need more than the 24,096-token pool, so requests waited. The GPU also throttled, with a median clock of 1,005 MHz against 1,455 at 16 users. Our sweep cannot separate the two.

```figure
id: fig-5-1
kind: chart
title: the throughput peak of the old sweep
claim: Without a cache reset, output peaked at 275 tokens per second at 32 users, which is the throughput peak and not the latency knee.
caption: Users double at each step on the axis. The band spans the lowest and highest of three runs. The figure and the table show the same sweep of 2026-10-21, which had no cache reset. The latency knee with a reset is between 8 and 16 users, as the text says. From capture/gpu/summary/l4.json.
```

## Avoid the four mistakes

1. **Reusing a warm cache.** With the random dataset and a fixed seed, a second run sends the same prompts. The prefix cache then serves part of them, and the second run looks faster. The next section gives the protocol.
2. **Letting the model stop early.** Without `--ignore-eos`, some answers end before the output length. The run then measures fewer tokens than you asked for.
3. **Skipping the warmup.** The first requests after a start pay for compiled kernels and cold caches. Use `--num-warmups` or send a few requests before you measure.
4. **Ignoring the clock.** A GPU that throttles or that other work shares runs slower. Record `nvidia-smi --query-gpu=clocks.sm,temperature.gpu --format=csv -l 1` during the run. Compare two runs only at similar clocks.

## Reset the prefix cache between runs

The prefix cache keeps the KV blocks of earlier prompts. It changes two things between runs: the speed, and sometimes the output of a greedy request. [The reproducibility page](#s-get-reproducible-outputs) shows the output effect.

To see the speed effect, we ran one load twice with the same seed and no reset. This was on the second GPU of our L4 node on 2026-10-22 and 2026-10-23. We used `Qwen/Qwen3-0.6B`, 64 prompts at 16 users, 512 tokens in and 128 out. That GPU is shared with its owner and had no clock lock, so trust the ratio and not the times.

```listing
title: median TTFT in ms, the same load four times in a row
source: capture/gpu/out-l4/prefix-cache-flush.txt
lang: text
note: The vLLM row of the summary. The SGLang row is cut.
---
engine        fresh   repeat, not flushed   repeat after a flush   repeat, not flushed
…
vLLM 0.6B     925     148                   1,163                  184
```

The repeat without a reset read a median TTFT about 6 times lower than the fresh run. After a reset, the TTFT came back to the level of the fresh run. The time per token changed by less than 15 percent, because a cache hit removes prefill work and leaves the decode work the same.

Use this protocol for every run that you compare:

1. Start each run with an empty cache. Restart the server, or call `POST /reset_prefix_cache`. That route exists only with `VLLM_SERVER_DEV_MODE=1`, and a server in that mode must not be exposed.
2. Use a new `--seed` for each run, so that the random dataset sends new prompts.
3. Record the cached tokens. Read `vllm:prefix_cache_hits_total` and `vllm:prefix_cache_queries_total` before and after the run.
4. For a count on each response, start the server with `--enable-prompt-tokens-details`. Then read `usage.prompt_tokens_details.cached_tokens` in each response.
5. Write the cache setting and the cached tokens next to the result.

`vllm bench sweep serve` resets the server caches between its runs for you.

## Choose a closed loop or a fixed rate

`--max-concurrency` keeps a fixed number of users busy. When the server slows down, the users send their next request later, so the load drops by itself. This closed loop never falls behind.

`--request-rate` sends requests at a fixed rate, whether the server keeps up or not. Past the rate the server can serve, the queue grows, and the first token takes longer with every request. Real traffic behaves more like a fixed rate. Run both before you set a capacity limit.

## Use the vLLM client

vLLM has its own client, `vllm bench serve`. It reports the same four numbers, and it needs no second install. At 0.31.0, `VLLM_USE_RUST_BENCH=1` runs a Rust version of the same client. This loop runs the same sweep with it:

```bash
for c in 1 2 4 8 16 32 64; do
  vllm bench serve --model Qwen/Qwen3-8B \
    --dataset-name random --random-input-len 512 --random-output-len 128 \
    --max-concurrency $c --num-prompts $((c * 4 > 16 ? c * 4 : 16)) \
    --seed $c --ignore-eos --num-warmups 2 \
    --save-result --result-filename sweep-c$c.json
done
```

We ran this loop as written on 2026-10-23, with `Qwen/Qwen3-8B-FP8` on the shared second GPU of our L4 node. Each run finished and wrote its result file. The GPU was throttled, so we give no numbers from that run.

We ran three clients against one vLLM server with `Qwen/Qwen3-0.6B` on 2026-10-23: the SGLang client, `vllm bench serve`, and its Rust version. This was the shared second GPU of our L4 node. Its clock was throttled, but it stayed at 420 to 495 MHz for every run. We reset the cache before every run and alternated the clients over two rounds.

```listing
title: output tok/s from three clients, two rounds each
source: capture/gpu/out-l4/bench-client-bias.txt
lang: text
note: The rows at 64 users from the throughput table. The other rows and the TTFT table are cut.
---
users   temperature   SGLang client    vllm bench       vllm bench, Rust
…
64      0             359, 348         379, 377         371, 365
64      0.7           331, 343         360, 363         356, 353
```

- **The two vLLM clients agreed.** The Python and the Rust versions of `vllm bench serve` gave the same numbers within the noise at 1, 16, and 64 users.
- **The SGLang client read a slower server.** Its median TTFT was 3 to 10 percent higher than `vllm bench serve`. At 16 and 64 users, its output throughput was 2 to 8 percent lower. At one user, one of its rounds read a higher throughput than every other round, so we give no throughput gap there.
- **The prompts differ.** The two clients send different prompt tokens from their random datasets, so part of a small gap can come from the prompts.
- **Temperature changes the result.** Temperature 0.7 raised the median TPOT over temperature 0. It was 10 to 13 percent higher at one user, and 3 to 6 percent higher at 16 and 64 users.

So our tables, from the SGLang client at temperature 0, can read a few percent slower than a run with `vllm bench serve`. Pick one client and one temperature, and keep them for every run that you compare.

```takeaways
- Sweep concurrency with one client, and read throughput, TTFT, TPOT, and ITL together.
- Use a new seed for each run, ignore the end token, and warm up first.
- Reset the prefix cache and record the cached tokens for each run you compare.
- Record the GPU clock, and compare runs only at similar clocks.
- Run a fixed request rate as well as a closed loop before you set a capacity limit.
- Write the client and the temperature next to every result.
```

Sources: vLLM documentation at v0.31.0 (docs/benchmarking/cli.md, docs/benchmarking/sweeps.md), the vLLM source at v0.31.0 (vllm/benchmarks/serve.py), capture/gpu/summary/l4.json (load.vllm-b), the sweep tool of the SGLang 101 manual (capture/gpu/sweep.py), the SGLang 0.5.22 benchmark client source (python/sglang/benchmark/serving.py, python/sglang/benchmark/datasets/random.py), capture/gpu/out-l4/prefix-cache-flush.txt, capture/gpu/out-l4/bench-client-bias.txt, capture/gpu/out-l4/livecheck-2026-10-23.txt, capture/gpu/out-l4/load-flushed-vs-unflushed.txt.
