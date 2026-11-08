# Prefill-decode disaggregation: --disaggregation-mode

> Disaggregation moves prefill to its own servers so long prompts stop delaying other users' tokens, and it pays off only when that delay is your measured problem.

Your chat users see smooth streaming until someone pastes a long document. Then every stream pauses while the server prefills the document. Prefill is compute work on many tokens at once, and decode is one token per request per step. On one server, they share the same GPU steps, and the long prefill takes the step. Chunked prefill makes the pause shorter but cannot remove it.

When you finish this section, you can explain how SGLang moves a request's KV cache from a prefill server to a decode server. You can also start the smallest disaggregated setup and decide from measurements whether you need it.

## Two servers, one request

**Prefill-decode disaggregation (PD):** two kinds of SGLang servers, started with `--disaggregation-mode prefill` and `--disaggregation-mode decode`. The default is `null`, which means one server does both {{code}}. A prefill server computes the prompt's KV cache and the first token. A decode server receives that KV cache and generates the rest.

The SGLang docs give two reasons for the split {{docs}}. Prefill batches interrupt decode batches. With attention data parallelism, one group can prefill while another decodes, so the decoding group waits for the slowest group in each step. Separate servers remove both kinds of waiting. Each pool can also use its own parallel layout, for example a wide TP for prefill and attention data parallelism for decode.

## How the KV cache moves

The gateway in [section 6.4](#s-sgl-model-gateway) starts every exchange. It picks one prefill server and one decode server. It adds three fields to the request: the prefill server's bootstrap host, its bootstrap port, and a random 63-bit number called the bootstrap room. Then it sends the same request to both servers at the same time {{code}}.

**Bootstrap room:** the number that both servers use to find each other's half of one request. Think of it as a reservation number: the decode server books KV slots, and the prefill server writes into them.

```figure
id: fig-6-3
kind: sequence
title: one disaggregated request
claim: The decode server reserves KV slots and publishes their addresses, then the prefill server writes the KV pages straight into decode memory.
caption: Read top to bottom. Solid arrows are requests, teal arrows are memory writes, and the dotted arrow is the token stream to the client. From the gateway PD router, the prefill and decode schedulers, and the Mooncake connection code at v0.5.22.
```

1. The decode server creates a receiver, finds the prefill rank through the bootstrap server, and reserves KV slots for the prompt.
2. It sends the addresses of those slots to the prefill side.
3. The prefill server runs a normal prefill forward pass for the prompt.
4. It writes the KV pages into the decode server's reserved slots. With the default Mooncake backend, this is a one-sided RDMA write. Mooncake groups contiguous pages on both sides into one batch transfer {{code}}.
5. The decode server sees the transfer finish and adds the request to its running batch without another prefill.
6. The client stream comes from the decode server.

The bootstrap server runs on the prefill host. Its default port is 8998 {{code}}. Each side tracks a transfer with five states: Failed, Bootstrapping, WaitingForInput, Transferring, and Success {{code}}.

```figure
id: fig-6-3b
kind: state
title: the KVPoll states of one transfer
claim: Every transfer moves forward through bootstrapping, waiting, and transferring to success, and any stage can end in failure.
caption: Read left to right. The numbers are the values of the KVPoll class. Amber arrows are state changes, and rose arrows are failures. From the base connection code at v0.5.22.
```

## Settings that matter

| Setting | Default | Meaning |
|---|---|---|
| `--disaggregation-mode` | `null` | `prefill` or `decode` for the two roles |
| `--disaggregation-transfer-backend` | `mooncake` | also `mooncake_tcp`, `nixl`, `mori`, `ascend`, `fake` |
| `--disaggregation-bootstrap-port` | 8998 | the bootstrap server port on the prefill host |
| `--num-reserved-decode-tokens` | 512 | decode tokens reserved in memory when a request joins the running batch |
| `SGLANG_DISAGGREGATION_BOOTSTRAP_TIMEOUT` | 300 | seconds that prefill waits for the decode side's slot addresses |
| `SGLANG_DISAGGREGATION_WAITING_TIMEOUT` | 300 | seconds that decode waits for the KV pages |
| `SGLANG_DISAGGREGATION_QUEUE_SIZE` | 4 | parallel transfer queues |

All defaults come from the v0.5.22 code {{code}}. `mooncake_tcp` exists for clusters without RDMA network cards. We did not measure its speed.

Do not send requests straight to a prefill or decode server. The scheduler asserts that a bootstrap room exists, and its error message tells you to send requests to the router instead {{code}}.

## Our position

Do not start with disaggregation. Start with one server, then add data parallel copies behind the gateway. Split prefill from decode only after you measured that prefill interference hurts your inter-token latency at the concurrency you serve. Disaggregation adds a second set of failures: the bootstrap step, the RDMA transfer, two timeouts, and a router that must pair servers correctly.

Even for the tail, the gain is a condition, not a default. A 2025 study compared split servers with servers that run both stages. It found that the gain is not guaranteed, and that it depends on the request load and on the path that moves the KV cache. We did not measure this ourselves. Before you keep a split, compare it with the same GPUs run as plain servers, at your real load.

A real incident shows the cost of skipping that measurement. A user ran one prefill and one decode server, each with TP4 ([issue #12591](https://github.com/sgl-project/sglang/issues/12591)). Time to first token was higher than on one TP4 server without disaggregation. The cause was an old Mooncake transfer engine. Upgrading it fixed the problem, and a maintainer also suggested `SGLANG_DISAGGREGATION_QUEUE_SIZE=1` without attention data parallelism. Without the single-server baseline, nobody would have known that disaggregation made things worse.

## Two more incidents, both from the router

At 64 concurrent requests, a GLM-4.5 setup logged many "Prefill bootstrap failed" and "Aborted by AbortReq" errors on the prefill side ([issue #9266](https://github.com/sgl-project/sglang/issues/9266)). Four to seven concurrent requests worked. The router's timeout for the prefill client was too short, so the router aborted requests that were still running. Pull request [#9803](https://github.com/sgl-project/sglang/pull/9803) fixed the timeout.

A maintainer gave the general rule in a related thread ([issue #9926](https://github.com/sgl-project/sglang/issues/9926)). "Aborted by AbortReq" means that the client or the router aborted. Check timeouts before you suspect the transfer.

Novita AI found a different delay with GLM-4.7 on H200 {{field Novita 2026-01}}. With disaggregation and the overlap scheduler, throughput rose about 10 percent but time to first token got much worse. On prefill, the KV transfer waited until the next batch's kernel launch. Without CUDA graphs, that launch took hundreds of milliseconds for their 92-layer model. Their fix added a flag, `--disaggregation-async-transfer`. We could not find that flag in the v0.5.22 code, so check your version before you copy their command.

## How many prefill servers for each decode server

The ratio depends on your traffic. dstack tested gpt-oss-120b on eight H200 GPUs with SGLang disaggregation and tensor parallelism only {{field dstack 2025-09}}. At high concurrency, one prefill server for three decode servers won every metric, for prefill-heavy, decode-heavy, and balanced loads. At low concurrency, three to one and two to two gave a better time to first token. Their [post](https://dstack.ai/blog/benchmarking-pd-ratios/) shows charts without absolute numbers, so use it for the direction only.

At the largest scale, the SGLang team ran DeepSeek on 12 nodes of eight H100 GPUs {{team 2025-05}}. They reported 52.3k input and 22.3k output tokens per second per node for 2000-token inputs. They measured prefill on 4 nodes and decode on 9 nodes, in separate runs. The Mooncake team reported Kimi K2 on 128 H200 GPUs with 4 prefill and 12 decode nodes {{team 2025-07}}. They gave decode more nodes so that the KV pool could hold a batch of 480. Both are reports from the teams that built the system.

## What happened on two L4s

We split Qwen3-8B into one prefill server on the first L4 and one decode server on the second. Our two cards have no RDMA, so we used `--disaggregation-transfer-backend mooncake_tcp`. The second card also ran another team's pods, so the decode pool held 2,925 tokens against 24,094 on prefill. We then ran the open-loop sweep of [section 5.1](#s-sglang-benchmark-serving) through the router.

```listing
title: the KV transfer queue fills and the session dies
source: capture/gpu/incidents/l4-pd-mooncake-tcp-queue.txt
lang: text
note: Lines from the prefill and decode logs and from the benchmark result at 8 requests per second. Timestamps are cut.
---
… Decode batch, #running-req: 2, #token: 1206, token usage: 0.41, pre-allocated usage: 0.00, #prealloc-req: 19, #transfer-req: 0, #retracted-req: 0
… TCP lane queue-full rejection count: 4096
… Session 151.242.195.41:15367 failed.
Prefill transfer failed lines: 2902
Successful requests:                     240
Total generated tokens (retokenized):    0
Mean TTFT (ms):                          0.00
```

Decode could run only two requests at a time, and 19 more waited for decode memory. Prefill kept producing KV caches for them, and the TCP transfer queue to decode filled. Three minutes into the sweep, the transfer session failed, and it did not come back. Every later request failed its transfer.

The dangerous part came next. Each failed request still counted as a success through the router, with no text. The benchmark counted 240 successful requests out of 240 at 8 requests per second. It printed 751.85 output tokens per second, higher than the 728.61 of the FP8 server at the same rate. Only two numbers gave it away: zero retokenized output tokens and a mean TTFT of 0.00 ms.

We did not publish those throughput numbers. Our kit now refuses a run in which every request has a TTFT of 0.

We then ran the split the other way round. Decode had the full pool of 24,094 tokens, and prefill had the shared card with 2,925. From 1 to 8 users, every request came back with text. At 16 users, only 2,048 of 8,192 generated tokens came back as text. At 32 users, every request came back empty, and the kit stopped the sweep.

```listing
title: the swapped split as it failed
source: capture/gpu/out-l4/bench-pd-swap.txt
lang: text
note: Benchmark summary lines at 8, 16, and 32 users. Compare the generated tokens with the retokenized ones.
---
c8: Successful requests: 32 
c8: Total generated tokens: 4096 
c8: Total generated tokens (retokenized): 4096 
c16: Successful requests: 64 
c16: Total generated tokens: 8192 
c16: Total generated tokens (retokenized): 2048 
c32: Successful requests: 128 
c32: Total generated tokens: 16384 
c32: Total generated tokens (retokenized): 0 
```

The original direction failed early in both sweeps. At 2 users only 512 of 2,048 generated tokens came back as text, and at 4 users none did. The fixed-rate sweep lost most of its text from 0.5 requests per second. We have no measured result for the split under load on this pair of cards, and we do not claim one. Check `Total generated tokens (retokenized)` in every disaggregated benchmark before you read its throughput.

## What to measure

Measure TTFT and inter-token latency on one server first, with the benchmark in [section 5.1](#s-sglang-benchmark-serving). If inter-token latency rises when long prompts arrive, disaggregation can help. After the split, watch these metrics {{code}}:

- `sglang:num_bootstrap_failed_reqs_total` and `sglang:num_transfer_failed_reqs_total`, which must stay flat
- `sglang:kv_transfer_latency_ms` and `sglang:kv_transfer_speed_gb_s`, which show the cost of each move
- `sglang:num_decode_prealloc_queue_reqs` and `sglang:num_decode_transfer_queue_reqs`, which show requests that wait for memory or for a transfer.

```takeaways
- Measure TTFT and inter-token latency on one server before you split it.
- Start with one prefill and one decode server, and compare with one server.
- Send every request through the gateway, never to a role server directly.
- Check router and client timeouts first when prefill logs Aborted by AbortReq.
- Upgrade the transfer library before you tune queue sizes.
- Check retokenized output tokens before you trust a disaggregated benchmark.
- Choose the prefill to decode ratio from your own concurrency, then watch transfer failures.
```

Sources: python/sglang/srt/arg_groups/fields/disagg.py, python/sglang/srt/arg_groups/choices.py, python/sglang/srt/environ.py, python/sglang/srt/disaggregation/prefill.py, python/sglang/srt/disaggregation/decode.py, python/sglang/srt/disaggregation/base/conn.py (KVPoll), python/sglang/srt/disaggregation/common/conn.py, python/sglang/srt/disaggregation/mooncake/conn.py, python/sglang/srt/managers/data_parallel_controller.py, python/sglang/srt/observability/metrics_collector.py, sgl-model-gateway/src/routers/http/pd_router.rs and pd_types.rs, and docs/docs/advanced_features/pd_disaggregation.mdx, all at v0.5.22. capture/gpu/incidents/l4-pd-mooncake-tcp-queue.txt, capture/gpu/out-l4/bench-pd-swap.txt. Issues #12591, #9266, #9926, pull request #9803. Novita AI on Hugging Face, 2026-01-22. dstack, "Benchmarking Prefill-Decode ratios", 2025-09-25. LMSYS, 96 H100 deployment, 2025-05-05. The Mooncake team on the LMSYS blog, 2025-07-20, capture/gpu/incidents/l4-pd-summary-lines.txt, Li and others, Revisiting Disaggregated Large Language Model Serving for Performance and Energy Implications, arXiv 2601.08833 (2025-11).
