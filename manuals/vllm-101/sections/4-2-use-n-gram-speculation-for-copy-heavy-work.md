# Use n-gram speculation for copy-heavy work

> N-gram speculation needs no draft model and pays when the answer copies the prompt, and it turns off async scheduling.

Your users ask for edits of documents they send. When you finish this section, you can decide when n-gram speculation beats a draft model.

**Our result:** on our L4, n-gram cut the time per token from 242 to 77 ms for one user, on random prompts with 128-token outputs.

## Turn it on

N-gram speculation guesses the next tokens from text that the request already holds. It takes the last few tokens of the output and finds the same tokens earlier in the request. Then it proposes the tokens that came after them. The target model then checks the guesses in one pass, as [the speculative decoding page](#s-how-speculative-decoding-checks-drafts) explains.

It needs no draft model, so it uses no extra GPU memory for weights. Start the server with a speculative config:

```bash
vllm serve Qwen/Qwen3-8B \
  --speculative-config '{"method": "ngram", "num_speculative_tokens": 3, "prompt_lookup_max": 4}'
```

`num_speculative_tokens` is the number of guesses in each step. `prompt_lookup_max` is the longest run of tokens that the proposer tries to match. Our runs used these two values.

## Know when it pays

The proposer can only guess text that already appears in the request. Work that copies the prompt gives it many matches:

- an edit of a document that the user sends
- a summary that quotes the source
- a code change that keeps most lines
- extraction of fields from a long input

Open chat copies little. For that work, most guesses fail, and each step writes one token, as it would without speculation.

## See what our run shows

**We measured** the time per token with and without n-gram speculation in [the shared-GPU session](#l4-sessions) of our L4 node, with `Qwen/Qwen3-8B`, on 2026-10-22. That GPU held a pool of 2,928 tokens, so we tested 1 and 4 users with two seeds each. The prompts came from the random dataset of the benchmark tool, with 512 tokens in and 128 tokens out.

```figure
id: fig-4-2
kind: chart
title: the time per token with n-gram speculation
claim: On our L4, n-gram speculation cut the median time per token to about a third for one user and to 37 percent for four users.
caption: Each bar is the median of two runs. Lower is faster. From capture/gpu/summary/l4-gpu1.json.
```

| Users, L4 shared-GPU session | Median TPOT, none / n-gram | Output tok/s, none / n-gram | P99 ITL, none / n-gram | Median SM clock, none / n-gram |
|---|---|---|---|---|
| 1 | 241.7 / 76.6 ms | 3.98 / 7.39 | 274 / 284 ms | 375 / 413 MHz |
| 4 | 272.6 / 101.3 ms | 13.02 / 19.22 | 290 / 1,691 ms | 428 / 443 MHz |

The GPU ran at 375 to 443 MHz, far below its full clock, because the GPU is shared and throttled. The times are slow for that reason. Read the ratio between the two columns, not the absolute times. The n-gram runs had a clock about 10 percent higher, which is small next to the threefold gain.

At one user, output rose by 86 percent. At four users it rose by 48 percent, and the worst token gap grew from 290 to 1,691 ms. We did not trace the cause of that gap.

We did not record the acceptance counters, so we cannot say how many guesses matched. Treat our gain as a result for random prompts and 128-token outputs only. On your own prompts, the gain depends on how much the output copies the input.

Another team reports the same limit, and we did not measure it ourselves. The paper "Speculative Decoding: Performance or Illusion?", posted at the end of 2025, studied speculation in vLLM. It found that the acceptance length changes a lot between requests and between datasets. Our own run also shows that a lower median can hide a worse tail. At four users the median time per token fell, and the P99 ITL rose.

## Know what it costs

- N-gram speculation turns off async scheduling, with only a warning in the log. [The async scheduling page](#s-leave-async-scheduling-on) lists the methods that do this.
- It runs on the older model runner, not on Model Runner V2.

## Check the gain on your prompts

Run a sample of your own traffic with and without the config. Keep your real output lengths, and do not use `--ignore-eos`. Compare the median TPOT, the P99 ITL, and the P99 TTFT, not only the median. Then read two counters from `/metrics`:

```bash
curl -s http://localhost:8000/metrics | grep -E "spec_decode_num_(draft|accepted)_tokens"
```

Divide the accepted tokens by the draft tokens. A high share means that your output copies the prompt and the method pays. A low share means that a draft model such as EAGLE3 is the better test.

```takeaways
- Try n-gram speculation for edits, quotes, code changes, and extraction.
- Measure the acceptance rate and the P99 ITL on your own prompts.
- Read the log for the warning that async scheduling is off.
```

Sources: capture/gpu/summary/l4-gpu1.json (load.vllm-fast-b, load.vllm-ngram), the vLLM source at v0.31.0 (vllm/config/vllm.py, vllm/v1/spec_decode/), vLLM documentation at v0.31.0 (docs/features/speculative_decoding), Speculative Decoding: Performance or Illusion? (arXiv 2601.11580).
