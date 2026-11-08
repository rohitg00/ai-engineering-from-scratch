# Evidence: cheatsheets/progressive-delivery.md

Abbreviations: P = phases/17-infrastructure-and-production. L20 = P/20-shadow-canary-progressive. L21 = P/21-ab-testing-llm-features. L24 = P/24-chaos-engineering-llm. CDE = projects/configuration-drift-explainer.

## Rollout sequence (flow)
- Shadow gets same requests, outputs logged not returned: L20/docs/en.md:27
- Shadow log: output diff, token counts, latency, refusal and error: L20/docs/en.md:29-32
- Canary progression 1 to 100 percent: L20/docs/en.md:38, 88
- Five metrics at each step, every 5-15 minutes: L20/docs/en.md:38, 80
- Optional A/B at 50% for distinctly different model: L20/docs/en.md:84
- Skip to 100% when canary gates pass: L20/docs/en.md:84
- Rollback = revert flag + pinned digest to previous: L20/docs/en.md:64

## Canary gates in the simulator (defaults)
- STAGES 0.01 ... 1.00: L20/code/main.py:13
- latency_p99_ms gate 1.5, baseline 900: L20/code/main.py:16, 24
- cost_per_req gate 1.2, baseline 0.02, breach >20%: L20/code/main.py:17, 25, L20/docs/en.md:41
- error_rate gate 2.0, 5xx plus refusals: L20/code/main.py:26, L20/docs/en.md:42
- output_len_p99 gate 1.4, baseline 450: L20/code/main.py:19, 27
- thumbs_down_rate gate 1.5, baseline 0.03: L20/code/main.py:20, 28
- rng.uniform(0.92, 1.08) noise: L20/code/main.py:43

## Run the labs (task-table)
- Canary simulator code/main.py: L20/docs/en.md:100, L20/code/main.py:1
- Regression(cost_mult=1.25): L20/code/main.py:92
- Regression(latency_mult=1.80): L20/code/main.py:93
- check_gates(metrics): L20/code/main.py:53
- Sequential A/B simulator: L21/code/main.py:1
- fixed_sample_size(baseline, lift), 80% power: L21/code/main.py:21, 73
- simulate(0.03, 0.0315) actual lift 5%: L21/code/main.py:79-80
- run_experiment(e): L24/code/main.py:30, 56

## Rollout and A/B terms (concepts)
- Shadow zero impact, smoke test not quality test: L20/docs/en.md:27, 34
- Canary gradual user-exposed rollout with gates: L20/docs/en.md:119
- Non-determinism up to 15%: L20/docs/en.md:54
- Policy flag seconds: L20/docs/en.md:62, 122
- Model pin, does not auto-upgrade, immutable reference: L20/docs/en.md:63, 123
- Evals vs A/B questions: L21/docs/en.md:12
- CUPED 30-70%: L21/docs/en.md:41
- SRM 50/50 gives 47/53: L21/docs/en.md:55

## Sequential stop rule (annotated-code)
- required/adjusted 1.4 buffer: L21/code/main.py:73-74
- n_a > 100 and n_b > 100 guard: L21/code/main.py:47
- z_statistic call: L21/code/main.py:48
- n_total, threshold formula, grows with log(n): L21/code/main.py:49-52
- abs(z) > threshold, stop: L21/code/main.py:53-54
- alpha 0.05, 80% power: L21/code/main.py:21

## Chaos planes (architecture)
- Control plane experiment scheduler: L24/docs/en.md:39
- Target plane services, pods, data stores: L24/docs/en.md:41
- Safety plane kill switch, error-budget gates: L24/docs/en.md:43
- Observability plane trace-ID correlation: L24/docs/en.md:45
- Feedback loop SLO, runbooks, code fixes: L24/docs/en.md:47
- burn-rate pause edge: L24/docs/en.md:51

## Chaos runner experiments (command-table)
- ERROR_BUDGET_PER_DAY 0.001, 99.9% SLO: L24/code/main.py:11
- EXPECTED_ERROR_RATE 0.0005: L24/code/main.py:12
- burn_rate > 2.0, first half of the abort rule: L24/code/main.py:32
- e.blast_radius_pct > 0.2, second half of the abort rule: L24/code/main.py:32
- pod kill 5 min, 0.05 blast: L24/code/main.py:24
- provider 429 5 min, 0.30 blast, aborts (0.015/0.0005 = 30 > 2.0 and 0.30 > 0.2): L24/code/main.py:25, 31-32, 40
- malformed prompt 3 min, 0.10 blast, completes (blast 0.10 not > 0.2): L24/code/main.py:26, 32

## Drift explainer commands (command-table)
- go run . --input --out: CDE/README.md:26
- go build -o /tmp/drift-explainer .: CDE/README.md:28
- --check, returns 2 on drift: CDE/README.md:29, 36
- --init: CDE/README.md:15
- --stage 1 --path --strict: CDE/README.md:16
- --all --solution --strict: CDE/README.md:17

## Drift report (concepts)
- layers, observed, optional sensitive, later layers win: CDE/README.md:32
- equal default kind: CDE/solution/main.go:135
- changed via reflect.DeepEqual: CDE/solution/main.go:140-141
- missing: CDE/solution/main.go:138-139
- unexpected: CDE/solution/main.go:136-137
- History append per layer, shadowed values: CDE/solution/main.go:104, CDE/README.md:34
- Redaction names and [REDACTED]: CDE/solution/main.go:111, 149-155, CDE/README.md:34
- schemaVersion 1, 0600 owner-only: CDE/solution/main.go:131, 180, CDE/README.md:36

## Troubleshooting (troubleshooting)
- Cost up 40% in 24 hours, shadow/canary avoids it, cost gate 20%: L20/docs/en.md:19-21, 41
- Redeploy takes 3 hours, policy flag fix: L20/docs/en.md:19, 64, 66
- Gates above the noise floor: L20/docs/en.md:54
- 1% traffic gives 50-150 data points, pause long enough: L20/docs/en.md:80
- SRM 47/53: L21/docs/en.md:55
- Non-determinism, 1.3-1.5x sample size: L21/docs/en.md:74
- 429 retry OOM, inject one 429 for 5 minutes: L24/docs/en.md:19, 85
- Innocently named value: CDE/README.md:34

## Q&A (qa)
- Shadow catches cost, length, refusal, hard errors only: L20/docs/en.md:34
- Skip A/B for improved version: L20/docs/en.md:84
- Stable within expected variance: L20/docs/en.md:54
- 20 tests one false positive, Bonferroni, BH: L21/docs/en.md:51
- Provider 429 aborts: L24/code/main.py:25, 32
- --check returns 2: CDE/README.md:36

## Tips (tips)
- Fix redeploy rollback before rolling: L20/docs/en.md:66
- 20% better model 3x cost: L20/docs/en.md:58
- Burn-rate pause 2x expected: L24/docs/en.md:51
- First experiment pod-kill one decode replica: L24/docs/en.md:83
- Cadence weekly, monthly, quarterly: L24/docs/en.md:69-71, 91
- Named source identifiers in layer names: CDE/README.md:32
