---
id: when-to-split-prefill-and-decode
title: When prefill-decode disaggregation pays
card: inference-serving
kind: design
level: 3
roles: [inference-engineer]
rounds: [system-design, design-review]
tags: [disaggregation, kv-transfer, p99-itl, router, prefill]
minutes: 12
lessons: []
manuals: [vllm-101#s-split-prefill-and-decode, sglang-101#s-prefill-decode-disaggregation]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your chat users see a smooth stream until someone pastes a long document, and then every stream pauses while the server prefills it. A colleague proposes prefill-decode disaggregation: separate prefill servers and decode servers. When does that split pay, what does it not do, and how would you decide?

## Short answer

Split prefill from decode when the measured problem is the tail of the inter-token latency and long prompts cause it, because a prefill server then never shares a step with a stream. It does not raise throughput: the documentation says so, it costs a KV transfer for every request plus more servers and a router, and a 2025 study found that even the tail gain depends on the load and on the path that moves the cache. Decide with a measurement: one server first, then copies behind a gateway, and the split last, compared with the same GPUs run as plain servers at your real load.

## Full answer

### What it solves and what it does not

On one server a long prompt shares each step with the running streams, and every stream waits a little longer for its next token. Chunked prefill makes the pause shorter but cannot remove it. Two kinds of server remove it: a prefill server computes the prompt and builds its KV cache, and a decode server receives that cache and writes the answer.

The vLLM documentation says that disaggregated prefill does not raise throughput. It gives control over the first token and the stream as two separate numbers, and it controls the tail of the inter-token latency. Even that gain is a condition, not a default: the study that compared split servers with servers that run both stages found that it depends on the request load and on the path that moves the cache.

### How the cache moves

In SGLang the gateway starts every exchange. It picks one prefill server and one decode server, adds the bootstrap host and port of the prefill server and a random 63-bit room number, and sends the same request to both. The decode server reserves KV slots and publishes their addresses. The prefill server runs a normal prefill and writes the KV pages straight into those slots, a one-sided RDMA write with the default transfer backend, or over TCP on a cluster without RDMA cards. The decode server sees the transfer finish and adds the request to its running batch. Every transfer moves through bootstrapping, waiting, transferring and success, and any stage can fail. The bootstrap port defaults to 8998, both timeouts to 300 seconds, and the transfer queue count to 4.

In vLLM each server gets a KV connector and a role, `kv_producer` or `kv_consumer`, and the common connector needs a library that the wheel does not install, pinned at 1.4.1. A router sends each request to the prefill server first, reads the transfer parameters from its response, and sends the request to the decode server with them. If a transfer fails, the default policy fails the request; `kv_load_failure_policy` set to `recompute` computes the prompt again on the decode server instead.

Never send a request straight to a role server. The scheduler asserts that a bootstrap room exists and tells you to use the router.

### The order to decide

1. Measure TTFT and inter-token latency on one server with a benchmark that mixes long and short prompts.
2. Add data-parallel copies behind a gateway, and measure again.
3. Split only when the inter-token tail still rises when long prompts arrive, and compare the split with the same GPUs as plain servers at your real load.

### Size the two sides

Long prompts with short answers need more prefill capacity. Short prompts with long answers need more decode capacity. One test on eight GPUs found that at high concurrency one prefill server for three decode servers won every metric, while at low concurrency three to one and two to two gave a better first token. It shows the direction, not your ratio. Measure the first token and the stream on each side and move one server at a time.

### What went wrong for other teams

- A pair with one prefill and one decode server had a higher first token than one plain server with the same split of GPUs. An old transfer library was the cause, and an upgrade fixed it. Without the single-server baseline nobody would have known.
- At 64 concurrent requests one setup logged many bootstrap failures and `Aborted by AbortReq` on the prefill side, while 4 to 7 concurrent requests worked. The router's timeout for the prefill client was too short, and a later fix lengthened it. The rule: an abort means the client or the router aborted, so check timeouts before you suspect the transfer.
- With the overlap scheduler on, one deployment saw throughput rise about 10 percent and the first token get much worse, because the KV transfer waited for the next kernel launch; their fix was a flag that the manual could not find in the pinned version.

### What to watch after the split

The bootstrap-failed and transfer-failed counters must stay flat. The transfer latency and speed gauges show the cost of each move. The decode pre-allocation and transfer queue gauges show requests that wait for memory or for a transfer. In every benchmark, read the retokenized output tokens before the throughput.

## Follow-ups

- **Level 3:** On the same GPUs, the split pair's first token arrives later than the plain server's. What do you suspect first? Expected: the transfer path, an old transfer library or a router timeout; one incident fixed it with an upgrade, and only the single-server baseline showed that the split made it worse.
- **Level 3:** Prefill logs aborts at a load of 64 users and works at 4 to 7. Where is the fault? Expected: in the router or client timeouts, which aborted requests that were still running, not in the transfer; a later fix lengthened the router timeout.
- **Level 4:** How do you pick the ratio of prefill to decode servers? Expected: from your prompt and answer lengths and your concurrency; long prompts with short answers need more prefill and the reverse more decode; one test found one prefill for three decode servers won at high concurrency and three to one or two to two gave a better first token at low concurrency, so measure both sides and move one server at a time.

## Wrong answers

- "Disaggregation raises throughput." The documentation says it does not; it gives control over the first token and the stream as two numbers and costs a KV transfer per request and more servers.
- "Send requests straight to the decode server to skip the router." The scheduler asserts that a bootstrap room exists and tells you to send requests to the router; the room is how the two servers find each other's half of one request.
- "A failed transfer falls back to a normal prefill." The vLLM default policy fails the request; set the failure policy to recompute if you want the decode server to compute the prompt again.
- "Chunked prefill already solves this." It makes the pause shorter but cannot remove it, because the chunk still shares the step with the running decodes; the split removes the sharing at the cost of a transfer and a second set of failures.

## Taught in

[Split prefill and decode](../../../manuals/vllm-101/sections/6-3-split-prefill-and-decode.md) and [the SGLang disaggregation section](../../../manuals/sglang-101/sections/6-3-prefill-decode-disaggregation.md) cover the setup, the limits and the incidents.
