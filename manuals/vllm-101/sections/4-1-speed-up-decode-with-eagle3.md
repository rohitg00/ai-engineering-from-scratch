# Speed up decode with EAGLE3

> EAGLE3 pays at low concurrency, and the draft depth that pays falls as more users share each step.

Your users wait for long answers at low load. When you finish this section, you can choose the draft depth for your concurrency.

**Our result:** on our clock-locked L4, EAGLE3 at depth 3 gave 1.6 times the baseline output at 32 users, on random prompts with 128-token outputs.

## Turn it on

EAGLE3 adds a small draft model that guesses the next tokens from the hidden states of the target model. The target model checks the guesses in one pass, as [the speculative decoding page](#s-how-speculative-decoding-checks-drafts) explains. The target model keeps only the guesses it would have written itself.

You need a draft that someone trained for your target model. For `Qwen/Qwen3-8B`, we used `Tengyunw/qwen3_8b_eagle3`:

```bash
vllm serve Qwen/Qwen3-8B \
  --speculative-config '{"method": "eagle3", "model": "Tengyunw/qwen3_8b_eagle3", "num_speculative_tokens": 3}'
```

`num_speculative_tokens` is the draft depth: the number of tokens the draft guesses in each step. If you leave it out, vLLM takes the value from the draft config, if the config has one. Set it yourself, so you know what runs.

EAGLE3 keeps async scheduling on. [The async scheduling page](#s-leave-async-scheduling-on) lists the methods that turn it off.

## Know why the depth matters

A deeper draft can give more tokens for each pass of the target model. But each guess also costs work in the check. With one user, the GPU has spare compute in each step, so the extra guesses are almost free. With many users, each step is already full, and wrong guesses take compute from real tokens.

## See what our runs show

**We measured** EAGLE3 at depths 1, 3, and 5 against no speculation on our L4 with `Qwen/Qwen3-8B` on 2026-10-22. This was [the session locked at 900 MHz](#l4-sessions), and we ran 1 and 32 users with two seeds each. The prompts came from the random dataset of the benchmark tool, with 512 tokens in and 128 tokens out.

```figure
id: fig-4-1
kind: chart
title: EAGLE3 output by draft depth
claim: With the clock locked, a draft depth of 3 gave the highest output at 32 users, and depths 3 and 5 tied at one user.
caption: Each bar is the median of two seeds. The run with no speculation at one user is left out, because its clock fell to 210 MHz. From capture/gpu/summary/l4.json.
```

| Users, L4 locked session | Config | Median TPOT | Output tok/s | Median SM clock |
|---|---|---|---|---|
| 32 | no speculation | 119.9 ms | 208.8 | 881 MHz |
| 32 | depth 1 | 100.4 ms | 271.1 | 900 MHz |
| 32 | depth 3 | 77.8 ms | 333.6 | 900 MHz |
| 32 | depth 5 | 83.7 ms | 289.5 | 885 MHz |
| 1 | depth 1 | 39.4 ms | 22.4 | 900 MHz |
| 1 | depth 3 | 27.8 ms | 31.3 | 900 MHz |
| 1 | depth 5 | 26.2 ms | 31.7 | 900 MHz |

At 32 users, depth 3 gave 1.6 times the output of no speculation. Its seed range did not overlap with any other config. Depth 5 gave less output than depth 3, so the extra guesses cost more than they gave.

At one user, depth 3 cut the time per token from 39.4 to 27.8 ms against depth 1. Depth 5 gave about the same as depth 3, and their seed ranges overlapped.

The run with no speculation at one user fell to 210 MHz, below the lock. A lock sets the highest clock, and it cannot stop the GPU from throttling. So we do not compare EAGLE3 against no speculation at one user.

We did not collect acceptance data from these runs, so we give no acceptance length here.

The median TPOT fell, but the gaps between the token groups grew. At 32 users, the median ITL rose from 84 ms with no speculation to 133 ms at depth 3. Each step now sends several tokens at once, so the stream arrives in larger and less frequent groups.

## Know the limits of our result

Our gain holds for random prompts and outputs of 128 tokens. Other teams found that real traffic can give less. We did not measure these effects ourselves:

- The 2026 paper "SPEED-Bench: A Unified and Diverse Benchmark for Speculative Decoding", by NVIDIA researchers, found that synthetic prompts overstate the speculative throughput of real prompts. It also found that the best draft depth changes with the batch size.
- The 2026 paper "Test-Time Speculation" studied EAGLE-3 and other drafts on MATH answers that ran toward 20,000 tokens. The acceptance length fell from about 3.7 to about 1.5 over those answers.

So a gain on short random answers does not predict a gain on long chat answers or on reasoning traces.

## Read the acceptance over a long answer

We measured the acceptance length against the position in the answer on 2026-10-23. We used `Qwen/Qwen3-8B-FP8` with an EAGLE3 draft and 3 speculative tokens, on the second GPU of our L4 node. Each of 8 prompts ran with thinking on, greedy, at one user, up to 4,096 tokens.

```listing
title: mean acceptance length by position in the answer
source: capture/gpu/out-l4/eagle3-acceptance-by-position.txt
lang: text
note: The range across prompts, with the number of prompts that reached each segment in brackets. The SGLang column comes from the same prompts on SGLang 0.5.22.
---
segment of the output   SGLang                 vLLM
0 to 256                2.05 to 2.64 (8)       2.14 to 2.51 (8)
256 to 512              1.95 to 2.64 (8)       2.09 to 2.55 (8)
512 to 1,024            2.11 to 2.77 (8)       2.12 to 2.79 (8)
1,024 to 2,048          2.09 to 2.47 (5)       1.72 to 2.66 (5)
2,048 to 4,096          2.33 and 2.48 (2)      2.35 and 2.60 (2)
```

Up to 4,096 tokens, the acceptance length did not fall steadily. It stayed at about 2.1 to 2.8 tokens for each step on both engines. Only 2 of the 8 prompts ran past 2,048 tokens, so the last segment rests on two answers. The GPU was shared and had no clock lock, which changes the speed but not the acceptance. Our limit of 4,096 tokens came from the memory we could use on that GPU. So we did not reach the range of the paper.

A second test on 2026-10-23 used `Qwen/Qwen3-8B` in BF16 on the first GPU of the node. It ran 8 users, with answers of up to 2,048 tokens and no ignore-eos. The median answer was 1,800 to 2,000 tokens. vLLM gave the acceptance from its counters before and after each run:

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

The first draft token was accepted 77 percent of the time on GSM8K and 67 percent on ShareGPT, and each later position less. On short 128-token answers in the same session, SGLang gave 2.69 to 2.78 on GSM8K and 2.33 to 2.43 on ShareGPT. Its long answers stayed within 0.01 of those ranges. We have no short-answer acceptance for vLLM from this session, so the vLLM rows show only the level on long answers.

Read the acceptance on your own long answers before you trust a gain. The metrics at the end of this page give it.

## Lock the clock before you compare

Our first EAGLE3 runs had no clock lock. At one user, the run with no speculation ran at 210 MHz, and the EAGLE3 run at about 1,400 MHz. A gap that large hides the effect of speculation, so we set those runs aside.

Before you compare speculative decoding with no speculation, lock the clock or record it for each run. Compare two runs only at the same clock. The lock needs root:

```bash
sudo nvidia-smi -lgc 900,900
sudo nvidia-smi -rgc
```

The first command locks the SM clock at 900 MHz, and the second releases the lock after the runs.

## Choose the depth

- For Qwen3-8B with this draft, start with a depth of 3. On our L4 it gave the best output at 32 users and tied at one user.
- For a busy server, sweep the depth on your own model. On our L4, depth 5 lost output at 32 users.
- If your load changes a lot through the day, vLLM can set the depth by batch size with `num_speculative_tokens_per_batch_size`. We did not test it.

## Check the gain on your prompts

Run a sample of your own traffic with and without the config. Keep your real output lengths, and do not use `--ignore-eos`. Compare these numbers:

1. The acceptance rate, from the two counters below.
2. The median TPOT and the output throughput.
3. The P99 ITL and the P99 TTFT, because a gain in the median can hide a loss in the tail.
4. The acceptance rate of your longest answers alone, if your answers run to thousands of tokens.

Read the two counters from `/metrics`:

```bash
curl -s http://localhost:8000/metrics | grep -E "spec_decode_num_(draft|accepted)_tokens"
```

Divide the accepted tokens by the draft tokens. vLLM also writes a `SpecDecoding metrics` line to the log, with the mean acceptance length.

```takeaways
- Use a draft trained for your target model, and start with a depth of 3.
- Measure the acceptance rate and the P99 latency on your own traffic.
- Lock or record the GPU clock before you compare speculative decoding.
```

Sources: capture/gpu/summary/l4.json (load.vllm-lock-b, load.vllm-lock-eagle3-k1, load.vllm-lock-eagle3-k3, load.vllm-lock-eagle3-k5, and the unlocked load.vllm-eagle3 and load.vllm-eagle3-k5), the vLLM source at v0.31.0 (vllm/config/speculative.py, vllm/v1/spec_decode/metrics.py), vLLM documentation at v0.31.0 (docs/features/speculative_decoding/eagle.md, docs/features/speculative_decoding/dynamic_speculative_decoding.md), SPEED-Bench: A Unified and Diverse Benchmark for Speculative Decoding (arXiv 2604.09557, 2026), Test-Time Speculation (arXiv 2605.09329, 2026), capture/gpu/out-l4/eagle3-acceptance-by-position.txt, capture/gpu/out-l4/eagle3-long-outputs.txt.
