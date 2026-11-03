---
id: two-clients-two-numbers
title: Two clients, two numbers, one server
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [benchmark, client, temperature, methodology, ttft, throughput]
minutes: 25
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [vllm-101#s-benchmark-your-server-in-15-minutes, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: [inference-load-testing]
related: [scenarios/prefix-cache-inflated-benchmark, scenarios/thermal-throttle-voided-ab-test]
updated: 2026-11-03
system:
  version: vLLM 0.31.0, measured by the SGLang 0.5.22 client and by vllm bench serve
  model: Qwen/Qwen3-0.6B
  hardware: the shared second L4 of a two-GPU node, throttled but steady at 420 to 495 MHz
source:
  - manuals/vllm-101/capture/gpu/out-l4/bench-client-bias.txt
  - manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md
  - manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md
---

## Situation

Two engineers evaluate one vLLM server that serves `Qwen/Qwen3-0.6B` on a shared L4, for a report that decides whether the team keeps the engine. The first uses the SGLang benchmark client at temperature 0.7, the temperature of the product, and files a median wait of 1,212 ms for the first token at 16 users and 331 output tokens each second at 64 users. The second uses `vllm bench serve` at temperature 0 and files 1,027 ms and 379 output tokens each second on that server.

The first engineer concludes that the server regressed between the two sessions and asks for a rollback of the last image. The second says the first client is broken. A third teammate ran all three clients, the SGLang client and the two versions of the vLLM client, against one server in interleaved rounds, and hands you the output.

## Evidence

- [one server, three clients, and the rules of the run](evidence/one-server-three-clients.txt)
- [median TTFT in ms from three clients at two temperatures](evidence/first-token-by-client.txt)
- [output tokens per second from three clients](evidence/throughput-by-client.txt)
- [the four findings written under the tables](evidence/what-the-run-showed.txt)
- [how the SGLang manual reads the same table](evidence/report-the-client.txt)
- [the four mistakes that make two runs disagree](evidence/the-four-mistakes.txt)

## Questions

1. Before you read any table, list what differed between the two filings besides the server.
2. Which cells of the TTFT table isolate the client, and what is the size of the client effect?
3. Which cells isolate the temperature, and which metric does temperature move most?
4. Why does one round at one user not count against the throughput finding?
5. The two clients send different prompts. Why is that a confound here and not a cause?
6. Write the benchmark rule that would have prevented this dispute, in four lines.

## Walkthrough

1. **List the variables first.** The two filings differ in the client, the dataset the client draws from, the temperature and the session, and so in the clock and the cache state. The server is the one thing they share. A disagreement of this size has four candidate causes before the server is one of them.
2. **Read the setup.** The third teammate's run holds four of those variables fixed. One server. The clock sat between 420 and 495 MHz for every run, throttled but steady, so the clock cannot separate the clients. The prefix cache was flushed before every run. Two rounds, interleaved by client, so drift over the session hits every client alike. Every run sent 512 tokens in and 128 out with seed 1 and ignored the end token.
3. **Isolate the client in the TTFT table.** Compare cells at the same temperature across the columns. At one user and temperature 0, the SGLang client read 154 and 164 ms, `vllm bench` 149 and 150, and its Rust version 144 and 144. At 16 users: 1,077 and 1,045 against 1,033 and 1,027. At 64 users: 1,688 and 1,838 against 1,624 and 1,667. The SGLang client reads a higher first token in every cell. The two vLLM clients agree with each other within the noise, which puts the noise floor at a few milliseconds at one user and tens at 64.
4. **Isolate the temperature.** Compare rows at the same client. For the SGLang client at 16 users, temperature 0.7 read 1,212 and 1,089 ms against 1,077 and 1,045 at 0. The notes under the tables give the metric that temperature moves most: the median TPOT was about 10 to 13 percent higher at one user, 34 ms against 30, and 3 to 6 percent higher at 16 and 64 users. Throughput was 3 to 10 percent lower. Sampling costs the server a kernel per token, and the client pays nothing for it, so the server is slower at 0.7 by that much on this card.
5. **Read the throughput table with its outlier.** At 16 users the SGLang client read 218 and 216 tokens per second against 222 and 222. At 64 users, 359 and 348 against 379 and 377. At one user, one SGLang round read 39.9 against about 32 for every other round. One round out of two cannot stand as a finding, so the notes give no throughput gap at one user. The gap at 16 and 64 users is 2 to 8 percent, and the TTFT gap is 3 to 10 percent.
6. **Name the confound.** The SGLang client drew its prompts from `random-ids`, and `vllm bench` from `random`. The two clients therefore sent different token sets, and part of a gap of a few percent can be the prompts, not the client code. The run cannot split those two, so it reports the combined client effect and names the confound. A cause would need the same prompts through both clients.
7. **Put the two filings together.** The first filing is the SGLang client at 0.7. The second is `vllm bench` at 0. The gap between them is the client effect plus the temperature effect, measured on different days with no shared clock record. Nothing in it points at the image.

## Resolution

No regression and no broken client. The two reports measured two methods. On this server, the SGLang client reads a median TTFT 3 to 10 percent higher and an output 2 to 8 percent lower than `vllm bench serve` at 16 and 64 users, with a prompt confound inside that gap, and temperature 0.7 adds 10 to 13 percent to the time per token at one user against temperature 0. The two vLLM clients agreed within noise, which is the size of a real difference on this card.

The rollback is cancelled. The team's rule has four lines: one client, one dataset and one temperature, written next to every number; interleaved rounds, at least two; a cache flush before each run; and the SM clock recorded, because the only reason this comparison held is that the clock stayed at 420 to 495 MHz throughout. A future report that uses a different client or temperature is a new baseline, not a comparison.

## Wrong turns

- "The server regressed, roll back the image." The two filings changed the client and the temperature at the same time, in different sessions. The controlled run shows that those two alone account for a gap of this size.
- "The SGLang client is broken, because it reads a slower server." Both vLLM clients also read a slower server at 0.7 than at 0, and the SGLang client's offset is 3 to 10 percent with a prompt confound inside it. A client that reads a few percent higher is a different ruler, not a wrong one.
- "Average the two filings." They measure different things. A mean of a run at 0.7 and a run at 0 is a number for a temperature nobody serves.
- "Run at one user, where the numbers are tightest." At one user one SGLang round read 39.9 tokens per second against about 32 for every other round. Small loads are not immune to outliers, and a single outlier flips a two-round cell.

## Generalize

A benchmark number is a property of the whole method, not of the server. Two numbers are comparable only when every part of the method that is not the thing under test stays fixed: the client, the dataset, the sampling settings, the cache state, the clock and the order of the runs. When two reports disagree, list what differed before you blame the system, and measure the size of each difference with a run that changes one thing at a time.

## Taught in

The vLLM manual compares the three clients in [the benchmark page](../../../manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md#use-the-vllm-client), the SGLang manual reads the same table in [its benchmark page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md#compare-two-clients-on-one-server), and [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) explains why the harness changes the number.
