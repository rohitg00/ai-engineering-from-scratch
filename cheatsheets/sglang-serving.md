---
id: sglang-serving
title: LLM Serving with SGLang
code: LS
subtitle: Start, size, measure and fix an SGLang server. SGLang 0.5.22.
hue: 200
sources: manuals/sglang-101
source_hash: d7a954f07c2cb645
---

## Start a server
type: annotated-code
lang: bash
from: manuals/sglang-101/capture/gpu/out-l4/server-default.command.txt, manuals/sglang-101/capture/README.md, manuals/sglang-101/sections/1-1-install-sglang-and-serve-your-first-model.md

```bash
export HF_HUB_OFFLINE=1   # no Hub contact once the models are cached
sglang serve --model-path <model> --host 127.0.0.1 --port 30000 --enable-cache-report --enable-metrics --mem-fraction-static 0.85   # the L4 flags
curl http://127.0.0.1:30000/ready   # 200 when the server accepts requests
```

## Three processes
type: architecture
from: manuals/sglang-101/sections/2-1-sglang-serve-and-the-three-processes.md, manuals/sglang-101/sections/3-1-kv-bytes-per-token-and-the-kv-pool.md

```arch
node | client | 1,1 | Client | POST /generate | client
node | tok | 2,1 | TokenizerManager | text to token ids | process
node | sched | 3,1 | Scheduler | batches and KV pool | process
node | detok | 4,1 | Detokenizer | ids to text | process
node | gpu | 3,2 | Model on GPU | forward pass | model
node | kv | 3,3 | KV pool | slots per token | store
edge | client | tok | HTTP
edge | tok | sched | ZMQ
edge | sched | gpu | batch
edge | sched | kv | slots
edge | sched | detok | ids
edge | detok | client | text
```

## Requests and checks
type: task-table
from: manuals/sglang-101/sections/1-1-install-sglang-and-serve-your-first-model.md, manuals/sglang-101/sections/2-5-streaming-stop-strings-and-the-openai-api.md, manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md, manuals/sglang-101/sections/4-6-deterministic-inference-and-logprobs.md, manuals/sglang-101/sections/7-1-operating-sglang.md

| Task | Code |
|---|---|
| Send one native request | `POST /generate` |
| Ask in the OpenAI chat format | `POST /v1/chat/completions` |
| Read the cache hits of one request | `meta_info` field `cached_tokens` |
| Probe readiness | `/ready` |
| Fix the length spread of a benchmark | `--random-range-ratio 1.0` |
| Sweep one concurrency cap | `--max-concurrency 8` |
| Send a fixed arrival rate | `--request-rate <rate>` |
| Test output stability | `python3 -m sglang.test.test_deterministic --n-trials 50 --test-mode single` |

## Benchmark your server
type: command-table
from: manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md

| Command | What it does |
|---|---|
| `python -m sglang.benchmark.serving --backend sglang --port 30000 --dataset-name random --num-prompts 32 --max-concurrency 8 --seed 7` | Sends 32 random prompts with at most 8 in flight, then prints the report |
| `--random-input-len 512 --random-output-len 128` | Sets the prompt and answer lengths |
| `--random-range-ratio 1.0` | Keeps every prompt at the length you asked for. The default 0.0 makes the average about half |
| `--request-rate <rate>` | Sends requests on a schedule, so the server can fall behind like real traffic |

## Defaults that matter
type: defaults
from: manuals/sglang-101/sections/r-1-flags-and-defaults.md, manuals/sglang-101/sections/2-2-the-scheduler-loop-and-schedule-policy.md, manuals/sglang-101/sections/2-3-admission-and-retraction.md, manuals/sglang-101/sections/3-5-eviction-policies-and-hicache.md, manuals/sglang-101/sections/6-4-sgl-model-gateway.md

| Setting | Default | Note |
|---|---|---|
| `--schedule-policy` | `fcfs` | `lpm` is the paper's order, not the default |
| `--schedule-conservativeness` | 1.0 | Raise it when the log shows retractions |
| `--radix-eviction-policy` | `lru` | Change only after a measured hit rate |
| `--kv-cache-dtype` | `auto` | Keeps the model data type |
| `--stream-interval` | 1 | Streams after every step |
| `--tp-size` | 1 | One GPU unless the weights need more |
| `--cache-threshold` | 0.3 | Gateway match rate for prefix affinity |

## Fix these errors
type: troubleshooting
from: manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md, manuals/sglang-101/sections/2-3-admission-and-retraction.md, manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md, manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md, manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md

| Symptom | Cause | Fix |
|---|---|---|
| `RuntimeError: [METAL] Command buffer execution failed` at 32 requests | Pool sized at 87 percent of free memory | Pass `--mem-fraction-static 0.4` and restart |
| Median TTFT near 28 s with free GPU memory | Admission queues requests for a full pool | Raise `--schedule-conservativeness` or lower `--max-running-requests` |
| `KV cache pool is full. Retract requests.` in a loop | The forecast is too bold | Raise `--schedule-conservativeness` and send realistic `max_new_tokens` |
| `RuntimeError: The memory capacity is unbalanced` | One TP card shares memory with other pods | Free the other card and restart. No flag disables the check |
| `cuda graph: False` on decode lines under load | Decode batch above the graph limit | Set `--cuda-graph-max-bs-decode` to peak concurrency |
| `ambiguous option: --cuda-graph-max-bs` | The flag was split at v0.5.22 | Use `--cuda-graph-max-bs-decode` or `--cuda-graph-max-bs-prefill` |
| `#cached-token: 0` on every repeat | Random ID at the start of the system prompt | Move the ID to the end or remove it |

## Tune in this order
type: flow
from: manuals/sglang-101/sections/7-1-operating-sglang.md, manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md, manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md

1. **Measure**: run `sglang.benchmark.serving` at three caps with `--random-range-ratio 1.0`.
2. **Memory**: set `--mem-fraction-static` on any shared machine.
3. **Prompts**: put shared text first and keep request IDs out of the start.
4. **Cap**: set `--max-running-requests` at the knee you measured.
5. **Kernels**: change graph and attention settings one at a time.
6. **Parallelism**: add `--tp-size` or `--dp-size` only when one replica saturates.

## Numbers to watch
type: concepts
from: manuals/sglang-101/sections/5-2-the-metrics-endpoint.md, manuals/sglang-101/sections/1-3-what-the-server-does-with-your-request.md, manuals/sglang-101/sections/2-5-streaming-stop-strings-and-the-openai-api.md

- **sglang:token_usage**: near 1.0 means the KV pool is full.
- **sglang:num_queue_reqs**: above 0 for minutes means the server is past its knee.
- **sglang:cache_hit_rate**: a gauge over one interval. Compute the rate from `sglang:prefill_effective_tokens_total`.
- **cached_tokens**: the count of prompt tokens reused from the cache.
- **Goodput**: requests per second that meet the TTFT and TPOT targets together.

## Incidents on record
type: concepts
from: manuals/sglang-101/sections/2-2-the-scheduler-loop-and-schedule-policy.md, manuals/sglang-101/sections/4-2-attention-backend.md, manuals/sglang-101/sections/4-4-speculative-decoding.md, manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md

- **Issue #36889**: a Mamba cap set the request limit to 2, and only an info line said so.
- **Issue #17411**: a FlashInfer upgrade made Hopper decode seven times slower.
- **Issue #5274**: EAGLE-3 doubled batch-1 speed and cut concurrency 20 by a quarter.
- **Issue #35129**: removing a per-session hash raised the hit rate from 66.8 to 94.4 percent.

## Glossary
type: glossary
from: manuals/sglang-101/sections/1-3-what-the-server-does-with-your-request.md, manuals/sglang-101/sections/3-1-kv-bytes-per-token-and-the-kv-pool.md, manuals/sglang-101/sections/6-2-moe-serving-deepep-and-eplb.md, manuals/sglang-101/sections/6-3-prefill-decode-disaggregation.md

- **ITL**: inter-token latency, the gap between tokens.
- **MLA**: multi-head latent attention, a compact KV layout used by DeepSeek.
- **MoE**: mixture of experts, where each token uses a few experts.
- **EPLB**: expert placement load balancing across GPUs.
- **PD**: prefill-decode disaggregation, with prefill and decode on separate servers.

## Questions
type: qa
from: manuals/sglang-101/sections/2-1-sglang-serve-and-the-three-processes.md, manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md, manuals/sglang-101/sections/7-1-operating-sglang.md

- **Where do I look when time to first token is high and the GPU is idle?** Check the tokenizer process before the kernels.
- **Why does a bigger pool add no throughput?** The pool was never full at 64 users in our runs.
- **Should I deploy `latest`?** No. Pin a tag such as `v0.5.22`.

## Tips
type: tips
from: manuals/sglang-101/sections/2-5-streaming-stop-strings-and-the-openai-api.md, manuals/sglang-101/sections/2-1-sglang-serve-and-the-three-processes.md, manuals/sglang-101/sections/5-2-the-metrics-endpoint.md, manuals/sglang-101/sections/7-1-operating-sglang.md

- Start servers with `--enable-cache-report` and `--enable-metrics`.
- Read the pool size in the startup log before you size clients.
- Send SIGTERM to the main process only.
- Set `SGLANG_ENABLE_HEALTH_ENDPOINT_GENERATION=false` for liveness probes.
