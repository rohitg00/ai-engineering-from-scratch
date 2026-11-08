---
id: inference-load-testing
title: Inference Metrics and Load Testing
code: IM
subtitle: Find why a load test lies. TTFT, TPOT, goodput, P99, realistic prompts, retry storms and hedged reads.
hue: 352
sources: phases/17-infrastructure-and-production/08-inference-metrics-goodput, phases/17-infrastructure-and-production/22-load-testing-llm-apis, projects/retry-storm-lab, projects/hedged-request-lab
source_hash: 26e858df4a14ef8f
---

## Symptoms, causes, fixes
type: troubleshooting
from: phases/17-infrastructure-and-production/08-inference-metrics-goodput, phases/17-infrastructure-and-production/22-load-testing-llm-apis, projects/retry-storm-lab, projects/hedged-request-lab

| Symptom | Cause | Fix |
|---|---|---|
| Test held at 500 users, prod fell at 200 | Identical prompts hit the prefix cache | `--mean-input-tokens` plus `--stddev-input-tokens` |
| Locust ITL high, server is fine | GIL trap: client tokenization backlog | LLM-Locust or a compiled harness |
| GenAI-Perf TPOT 6 ms, LLMPerf 11 ms | GenAI-Perf excludes TTFT from ITL | State the tool and the definition |
| High throughput, users leave | Low goodput, tail blows the SLO | Gate deploys on goodput |
| Mean TPOT 9 ms, users complain | Right-skewed tail, P99 TPOT 65 ms | Report P50, P90, P99 |
| TPOT spikes to 50 ms | Long prefill on a neighbor sequence | Chunked prefill |
| All clients retry at the same time | Synchronized exponential waits | `--jitter=true` and a shared `--budget` |
| Hedge looks free | Cancel does not stop server work | Count fixture work next to latency |

## Metric formulas
type: annotated-code
lang: text
span: 2
from: phases/17-infrastructure-and-production/08-inference-metrics-goodput/docs/en.md

```text
TTFT = queue_time + network_request + prefill_time  # before anything streams
TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced  # same as ITL
E2E = TTFT + TPOT * output_tokens + network_response  # TPOT-dominated above 500 tokens
throughput = total_output_tokens / elapsed_time  # fleet efficiency only
goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)
```

## SLO profiles in main.py
type: comparison
from: phases/17-infrastructure-and-production/08-inference-metrics-goodput

| Factor | loose | target | tight |
|---|---|---|---|
| TTFT ms | 800 | 500 | 300 |
| TPOT ms | 25 | 15 | 10 |
| E2E ms | 3000 | 2000 | 1500 |
| Verdict | SHIPPABLE at 99% | DEGRADED at 95% | FAILING below |

## Four load patterns
type: comparison
span: 2
from: phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md

| Factor | Steady-state | Ramp | Spike | Soak |
|---|---|---|---|---|
| Shape | Constant RPS | 0 to target RPS | Sudden 3-10x RPS, then back | Steady-state |
| Duration | 30-60 min | 15 min | 2 min | 4-8 hours |
| Catches | Baseline regressions | Capacity breakpoint, warm-up anomalies | Autoscaling latency, queue saturation, cold start | Memory leaks, connection-pool drift |

## Use each tool when
type: concepts
from: phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md

- **LLMPerf**: a benchmark run. Rust-backed tokenization, mean/stddev prompts.
- **GenAI-Perf**: you need the NVIDIA reference. ITL excludes TTFT.
- **LLM-Locust**: your team uses Locust. It fixes the GIL trap.
- **guidellm**: large-scale synthetic benchmarking.
- **k6 v2026.1.0**: CI/CD gates and SLA tests. Streaming-aware, no GIL.
- **k6 Operator**: distributed tests through TestRun / PrivateLoadZone CRDs.
- **Vegeta**: constant-rate saturation of a gateway or rate limit.
- **Locust 2.43.3 stock**: never alone for LLMs. It has the GIL trap.

## Run the labs
type: annotated-code
lang: bash
span: 2
from: projects/retry-storm-lab/README.md, projects/hedged-request-lab/README.md

```bash
python3 scripts/project_test.py retry-storm-lab --init /tmp/retry-storm-lab-work
python3 scripts/project_test.py retry-storm-lab --all --solution --strict
cd projects/retry-storm-lab/solution
go run . --clients 20 --budget 60 --jitter=false --out /tmp/synchronized.json  # synchronized waits
go run . --clients 20 --budget 60 --jitter=true --seed 7 --out /tmp/jittered.json  # seeded spread
go run . --local-http --clients 20 --budget 12 --out /tmp/retry-wire.json  # real loopback HTTP
node --experimental-strip-types cli.ts /tmp/retry-wire.json  # verify counters
cd projects/hedged-request-lab/solution
go run . --samples 3 --delay-ms 10 --out /tmp/hedge-report.json  # 80ms primary, 5ms secondary
```

## Lab flag defaults
type: defaults
from: projects/retry-storm-lab/solution/main.go, projects/retry-storm-lab/README.md, projects/hedged-request-lab/solution/main.go, projects/hedged-request-lab/README.md

| Setting | Default | Note |
|---|---|---|
| `--clients` | 20 | Concurrent clients |
| `--budget` | 12 | Shared retry attempts |
| `--base-ms` | 10 | Initial backoff |
| `--max-ms` | 80 | Maximum retry wait |
| `--attempts` | 4 | Maximum attempts per client |
| `--capacity` | 5 | Simulated capacity per exact millisecond |
| `--delay-ms` | 10 | Hedge delay |
| `--samples` | 3 | Samples per policy |

## Lab error strings
type: command-table
from: projects/retry-storm-lab/solution/main.go, projects/hedged-request-lab/solution/main.go

| Command | What it does |
|---|---|
| `invalid bounded policy` | Base below 1, cap below base, or attempts over 10 |
| `non-retryable HTTP status` | Status is not 429, 502, 503 or 504 |
| `server delay exceeds policy cap` | Retry-After is above the policy cap |
| `retry attempts or shared budget exhausted` | No attempts or budget left |
| `winner requires HTTP 200` | A fast error cannot win the hedge |
| `body exceeds 64 KiB` | Response body is over the read limit |
| `no valid response` | Both hedge attempts failed |
| `samples must be 1..100` | Sample count is out of range |

## One hedged read
type: flow
from: projects/hedged-request-lab/stages, projects/hedged-request-lab/README.md

1. **Client**: starts the primary GET and a delay timer.
2. **Client**: a valid primary before the timer prevents the hedge.
3. **Client**: else launches at most one secondary. Delay is 0 to 1 second.
4. **Validator**: only HTTP 200 with a nonempty JSON value can win.
5. **Client**: cancels the loser and observes it for at most 100ms.
6. **Receipt**: records late and unobserved attempts and winner latency.
7. **Fixture**: counts server work that continues after cancel.

## Worked numbers
type: qa
from: phases/17-infrastructure-and-production/08-inference-metrics-goodput, projects/retry-storm-lab/stages, projects/hedged-request-lab/stages

- **TTFT 500 ms, 100 tokens in 700 ms decode?** GenAI-Perf `ITL = 700/99 = 7.07 ms`. LLMPerf `ITL = 1200/100 = 12.00 ms`.
- **Twenty clients, four attempts, budget 12?** At most 32 total calls.
- **Base 10, cap 25, no jitter?** Waits of 10,20,25,25.
- **Three baseline and three hedged samples?** Three calls versus six. The fixture records nine.
- **Samples [2,4,10,20,80]?** P50=10, P95=80, maximum=80.
- **Primary HTTP 500 at 1ms, secondary valid at 15ms?** The secondary wins. A fast error cannot win.

## Reference numbers and gates
type: tips
from: phases/17-infrastructure-and-production/08-inference-metrics-goodput/docs/en.md, phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md

- Llama-3.1-8B-Instruct on TRT-LLM: mean TTFT 162 ms, mean TPOT 7.33 ms.
- Consumer 70B SLO: TTFT P99 <= 800 ms, TPOT P99 <= 25 ms, goodput >= 99%.
- Run at 2x peak concurrency. Take 30-50 iterations.
- Use `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`.
- CI gate: P50/P95 TTFT, 5xx < 5%, TPOT under threshold. Break the build on breach.
- Publish tool name, tool version, model, hardware, concurrency and prompt distribution.
