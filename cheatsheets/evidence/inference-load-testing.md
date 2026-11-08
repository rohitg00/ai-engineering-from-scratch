# Evidence: cheatsheets/inference-load-testing.md

Abbreviations: P17 = phases/17-infrastructure-and-production, L08 = P17/08-inference-metrics-goodput, L22 = P17/22-load-testing-llm-apis, d = docs/en.md, c = code/main.py, RS = projects/retry-storm-lab, HR = projects/hedged-request-lab, RS1 = projects/retry-storm-lab/stages/01-deterministic-service/docs/en.md, RS2 = projects/retry-storm-lab/stages/02-bounded-jitter/docs/en.md, RS3 = projects/retry-storm-lab/stages/03-shared-budget/docs/en.md, RS4 = projects/retry-storm-lab/stages/04-local-http-replay/docs/en.md, HR1 = projects/hedged-request-lab/stages/01-measure-safe-reads/docs/en.md, HR2 = projects/hedged-request-lab/stages/02-schedule-duplicate/docs/en.md, HR3 = projects/hedged-request-lab/stages/03-validate-and-account/docs/en.md, HR4 = projects/hedged-request-lab/stages/04-export-tradeoffs/docs/en.md.

## Symptoms, causes, fixes (troubleshooting)
- 500 users held, 200 fell, identical prompts and prefix caching: L22/d:19-21. Fix flags: L22/d:3, 37
- GIL trap, tokenization backlog, LLM-Locust or compiled harness: L22/d:29-31
- GenAI-Perf TPOT 6 ms vs LLMPerf 11 ms: L22/d:103. Exclude vs include TTFT: L08/d:78-79, 83
- high throughput at low goodput: L08/d:3, 55. Gate on goodput: L08/d:113
- mean TPOT 9 ms, P99 65 ms, report triple: L08/d:61-63
- TPOT spike to 50 ms without chunked prefill: L08/d:37
- synchronized exponential waits, --jitter=true seeded spreading: RS/README.md:35. Shared budget: RS3:13
- cancel does not prove saved computation: HR/README.md:30, HR4:17

## Metric formulas (annotated-code)
- TTFT: L08/d:27, comment L08/d:29
- TPOT: L08/d:35, same as ITL L08/d:33
- E2E: L08/d:41, TPOT-dominated above 500 tokens L08/d:43
- throughput: L08/d:47, fleet efficiency L08/d:49
- goodput: L08/d:53

## SLO profiles in main.py (comparison)
- TTFT ms loose 800, target 500, tight 300: L08/c:105-107
- TPOT ms loose 25, target 15, tight 10: L08/c:105-107
- E2E ms loose 3000, target 2000, tight 1500: L08/c:105-107
- Verdict SHIPPABLE >= 0.99, DEGRADED >= 0.95, else FAILING: L08/c:113

## Four load patterns (comparison)
- Steady-state constant RPS 30-60 min, baseline regressions: L22/d:41
- Ramp 0 to target over 15 min, breakpoint and warm-up: L22/d:42
- Spike 3-10x for 2 min, autoscaling, queue, cold start: L22/d:43
- Soak 4-8 hours, leaks, connection-pool drift: L22/d:44

## Use each tool when (concepts)
- LLMPerf: L22/d:13, 48
- GenAI-Perf: L22/d:50
- LLM-Locust: L22/d:52
- guidellm: L22/d:54
- k6 v2026.1.0: L22/d:56-59
- k6 Operator TestRun / PrivateLoadZone CRDs: L22/d:58
- Vegeta: L22/d:61
- Locust 2.43.3 stock: L22/d:63

## Run the labs (annotated-code)
- project_test.py --init, --all --solution --strict: RS/README.md:15, 17
- cd solution, jitter false and true runs: RS/README.md:25-27
- --local-http run and cli.ts: RS/README.md:30-31
- hedge go run --samples 3 --delay-ms 10: HR/README.md:25-26. 80ms primary, 5ms secondary: HR/README.md:30

## Lab flag defaults (defaults)
- --clients 20, concurrent clients: RS/solution/main.go:251
- --budget 12, shared retry attempts: RS/solution/main.go:252
- --base-ms 10, initial backoff: RS/solution/main.go:255
- --max-ms 80, maximum retry wait: RS/solution/main.go:256
- --attempts 4, maximum attempts per client: RS/solution/main.go:257
- --capacity 5, simulated capacity per exact millisecond: RS/solution/main.go:259
- --delay-ms 10, hedge delay: HR/solution/main.go:243
- --samples 3, samples per policy: HR/solution/main.go:244
- flag spellings: RS/README.md:26-35, HR/README.md:26

## Lab error strings (command-table)
- invalid bounded policy: RS/solution/main.go:43-44
- non-retryable HTTP status, 429/502/503/504: RS/solution/main.go:174-175
- server delay exceeds policy cap: RS/solution/main.go:181-182
- retry attempts or shared budget exhausted: RS/solution/main.go:198
- winner requires HTTP 200: HR/solution/main.go:73
- body exceeds 64 KiB: HR/solution/main.go:75-76
- no valid response: HR/solution/main.go:166
- samples must be 1..100: HR/solution/main.go:216

## One hedged read (flow)
1. primary and delay timer, GET only: HR2:13
2. valid primary before timer prevents hedge: HR2:13
3. at most one secondary, delay 0 to 1 second: HR2:13, 25
4. HTTP 200 with nonempty JSON value: HR3:13
5. cancel, observe at most 100ms: HR3:13, HR/README.md:34
6. late, unobserved, winner latency: HR3:13, HR2:25, HR/README.md:34
7. fixture work after cancel: HR4:13

## Worked numbers (qa)
- ITL = 700/99 = 7.07 ms and 1200/100 = 12.00 ms: L08/d:81
- 20 clients, 4 attempts, budget 12, 32 calls: RS3:17
- 10,20,25,25: RS2:17
- 3 vs 6 calls, fixture records nine: HR4:17
- [2,4,10,20,80] P50=10, P95=80, maximum=80: HR1:17
- HTTP 500 at 1ms loses to valid 15ms: HR3:17

## Reference numbers and gates (tips)
- 162 ms TTFT, 7.33 ms TPOT: L08/d:65-68
- consumer SLO 800 ms, 25 ms, 99%: L08/d:89-92
- 2x peak concurrency, 30-50 iterations: L08/d:99-100
- LLMPerf flags 800/300/150: L08/d:98
- CI gate P50/P95 TTFT, 5xx < 5%, break the build: L22/d:69-71
- publish tool name and setup: L08/d:101
