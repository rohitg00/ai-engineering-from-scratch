# Load Testing LLM APIs — Why k6 and Locust Lie

> Traditional load testers were not designed for streaming responses, variable output lengths, token-level metrics, or GPU saturation. Two traps bite most teams. The GIL trap: Locust's token-level measurement runs tokenization under the Python GIL, which competes with request generation under heavy concurrency; tokenization backlog then inflates reported inter-token latency — your client is the bottleneck, not the server. The prompt-uniformity trap: identical prompts in a loop test one point on the token distribution; real traffic has variable length and diverse prefix matches. LLMPerf fixes this with `--mean-input-tokens` + `--stddev-input-tokens`. Tool mapping in 2026: LLM-specialized (GenAI-Perf, LLMPerf, LLM-Locust, guidellm) for token-level accuracy; **k6 v2026.1.0** + **k6 Operator 1.0 GA (Sept 2025)** — streaming-aware, Kubernetes-native distributed via TestRun/PrivateLoadZone CRDs, best for CI/CD gates; Vegeta for Go constant-rate saturation; Locust 2.43.3 only with LLM-Locust extension for streaming. Load patterns: steady-state, ramp, spike (autoscaling test), soak (memory leaks).

**Type:** Build
**Languages:** Python (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## Learning Objectives

- Explain the two anti-patterns (GIL trap, prompt-uniformity trap) that make generic load testers lie for LLM APIs.
- Pick a tool for a given purpose: LLMPerf (benchmark run), k6 + streaming extension (CI gate), guidellm (large-scale synthetic), GenAI-Perf (NVIDIA reference).
- Design four load patterns (steady, ramp, spike, soak) and name the failure mode each catches.
- Build a realistic prompt distribution using mean + stddev of input tokens rather than fixed length.

## The Problem

You k6-tested your LLM endpoint at 500 concurrent users. It held. You shipped. In production at 200 actual users the service fell over — P99 TTFT exploded, GPUs pinned.

Two things happened. First, k6 sent 500 identical prompts — your request-coalescing and prefix caching made it look like you were handling 500 concurrent decodes when you were actually handling one. Second, k6 doesn't track inter-token latency on streaming responses the way the eye experiences it; it sees one HTTP connection, not 500 tokens arriving at varying intervals.

Load testing for LLMs is its own discipline.

## The Concept

### The GIL trap (Locust)

Locust uses Python and runs tokenization client-side under the GIL. Under high concurrency the tokenizer queues behind request generation. Reported inter-token latency includes client-side tokenization backlog. You think the server is slow; it's the test harness.

Fix: LLM-Locust extension moves tokenization to separate processes, or use a compiled-language harness (k6, LLMPerf using tokenizers.rs).

### The prompt-uniformity trap

All known load testers let you configure one prompt. In a loop test of 10,000 iterations the exact same prompt sends each time. Server sees the same prefix every time — prefix cache hits approach 100%, throughput looks great.

Fix: sample from a prompt distribution. LLMPerf uses `--mean-input-tokens 500 --stddev-input-tokens 150` — diverse lengths, diverse content.

### Four load patterns

1. **Steady-state** — constant RPS for 30-60 min. Catches: baseline performance regressions.
2. **Ramp** — linearly increase RPS from 0 to target over 15 min. Catches: capacity breakpoint, warm-up anomalies.
3. **Spike** — sudden 3-10x RPS for 2 min then back. Catches: autoscaling latency, queue saturation, cold-start impact.
4. **Soak** — steady-state for 4-8 hours. Catches: memory leaks, connection-pool drift, observability overflow.

### 2026 tool mapping

**LLMPerf** (Anyscale) — Python but Rust-backed tokenization. Mean/stddev prompts. Streaming-aware. Best default for performance runs.

**NVIDIA GenAI-Perf** — NVIDIA's reference. Uses Triton client; comprehensive metric coverage. Note its ITL excludes TTFT; LLMPerf's includes it. Two tools produce different TPOT for the same server.

**LLM-Locust** (TrueFoundry) — Locust extension that fixes the GIL trap. Familiar Locust DSL + streaming metrics.

**guidellm** — large-scale synthetic benchmarking.

**k6 v2026.1.0** + **k6 Operator 1.0 GA (Sept 2025)**:
- k6 itself (Go, compiled, no GIL) added streaming-aware metrics.
- k6 Operator uses TestRun / PrivateLoadZone CRDs for Kubernetes-native distributed testing.
- Best for CI/CD gates and SLA testing.

**Vegeta** — Go, simpler than k6. Constant-rate HTTP saturation. Not LLM-aware but good for gateway / rate-limit testing.

**Locust 2.43.3 stock** — has the GIL trap for LLM. Only with LLM-Locust extension.

### SLA gate in CI

Run k6 on the PR with:

- 30-50 iterations each at baseline RPS.
- Gate: P50/P95 TTFT, 5xx < 5%, TPOT under threshold.
- Break the build on breach.

### Realistic prompt distribution

Build from real traffic samples (if you have them) or from published distributions (e.g., ShareGPT prompts for chat, HumanEval for code). Feed the mean + stddev to LLMPerf. Avoid loop-with-one-prompt at all costs.

### Numbers you should remember

- k6 Operator 1.0 GA: September 2025.
- k6 v2026.1.0: streaming-aware metrics.
- Typical LLMPerf run: 100-1000 requests at concurrency X.
- Typical CI gate: 30-50 iterations per PR.
- Four patterns: steady, ramp, spike, soak.

## Use It

`code/main.py` simulates a load test with realistic prompt distribution, measures effective TPOT, and demonstrates the uniform-prompt trap.

## Ship It

This lesson produces `outputs/skill-load-test-plan.md`. Given workload and SLA, picks tool and designs the four load patterns.

## Exercises

1. Run `code/main.py`. Compare uniform vs realistic distribution — where is the gap?
2. Write the k6 script for a CI gate: TTFT P95 < 800 ms at 100 concurrent, runtime 5 minutes.
3. Your soak test shows memory growing 50 MB/hour. Name three causes and the instrumentation to pick between them.
4. Spike test from 10 RPS to 100 RPS. What's the expected recovery time if Karpenter + vLLM production-stack are in place (Phase 17 · 03 + 18)?
5. GenAI-Perf reports TPOT=6ms; LLMPerf reports TPOT=11ms on the same server. Explain.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## Further Reading

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
