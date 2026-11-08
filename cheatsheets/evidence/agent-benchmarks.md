# Evidence: cheatsheets/agent-benchmarks.md

Abbreviations: L19 = phases/14-agent-engineering/19-benchmarks-swebench-gaia, L20 = phases/14-agent-engineering/20-benchmarks-webarena-osworld, M24 = phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks, HB = projects/harness-bench, d = docs/en.md, c = code/main.py, S = HB/solution, St1 = projects/harness-bench/stages/01-load-unseen-benchmark-cases/docs/en.md, St2 = projects/harness-bench/stages/02-define-exactly-what-a-correct-answer-means/docs/en.md, St3 = projects/harness-bench/stages/03-run-a-harness-under-a-call-budget/docs/en.md, St4 = projects/harness-bench/stages/04-compare-runs-on-equal-denominators/docs/en.md.

## Single-agent benchmarks side by side (comparison)
- Tests: code patching L19/d:3, generalist tool use L19/d:3, long-horizon web tasks L20/d:25, real computer tasks L20/d:39
- Size: 2,294 issues from 12 Python repos L19/d:32; 466 questions and 300 private L19/d:53; 812 tasks in 4 apps L20/d:25; 369 tasks on Ubuntu, Windows, macOS L20/d:39
- Agent input: codebase at pre-fix commit plus issue L19/d:33, web and multi-modality L19/d:55, self-hosted apps plus utilities L20/d:25-26; 1920×1080 screenshots L20/d:41
- Evaluator: FAIL_TO_PASS and PASS_TO_PASS L19/d:35, execution-based via gym APIs L20/d:27. GAIA and OSWorld evaluators are not given in the sources
- Best at release: SWE-agent 12.5% L19/d:37, GPT-4 with plugins 15% L19/d:54, GPT-4 agent 14.41% L20/d:28, best model 12.24% L20/d:42
- Human: 92% L19/d:54, 78.24% L20/d:28, 72.36% L20/d:42
- Main trap: contamination L19/d:43-49, confusion with code benchmarks L19/d:58, stale pinned apps L20/d:62, GUI grounding L20/d:46

## Multi-agent benchmarks side by side (comparison)
- Measures: MARBLE topologies M24/d:22, COMMA asymmetric information M24/d:36, MedAgentBoard four categories M24/d:42, Pro uncontaminated with later cutoffs M24/d:56
- Scoring: milestone KPIs M24/d:22, agent-agent collaboration M24/d:36, multi-agent vs single-LLM vs rule-based M24/d:42; 1865 problems in 41 repos M24/d:56
- Headline: graph best for research M24/d:26, struggle vs random baseline M24/d:36, does NOT dominate M24/d:44, ~23% vs 70%+ M24/d:56
- Lesson: cognitive planning ~3% M24/d:30, measure before claiming M24/d:38, over-engineered M24/d:46, Verified no longer evidence M24/d:63

## Use X when (tips)
- SWE-bench Verified for code agents, report Verified: L19/d:102
- SWE-bench Pro reality check, current gating test: M24/d:54, 63
- GAIA private leaderboard split: L19/d:103
- AgentBench multi-environment, 8 environments: L19/d:62, 104
- WebArena Verified self-hosted continuous evaluation: L20/d:87
- OSWorld in a VM fleet: L20/d:88
- MARBLE compare topologies apples-to-apples: M24/d:32
- AgentArch justify each layer: M24/d:52
- Gold trajectories for top 20 tasks: L20/d:90

## SWE-bench gate: run_task (flow)
1. copy state_before, pre counts: L19/c:35-37
2. apply patch to a copy: L19/c:39
3. post counts: L19/c:41-42
4. ftp_post equals all FAIL_TO_PASS: L19/c:46, L19/d:125
5. ptp_broke is 0: L19/c:45-46, L19/d:126
6. resolved: L19/c:46
7. resolution rate: L19/c:113

## Harness Bench pipeline (architecture)
- Cases JSON with ID, Prompt, Expected: HB/README.md:31, S/types.go:12-17
- Cases() strict decode, max 1000: S/stage1.go:10-26, S/main.go:31
- EvaluatePolicy() 3 policies under a call budget: S/stage3.go:20-26, S/main.go:63-65
- Leaderboard() equal denominators: S/stage4.go:9-44, St4:13
- Recording authored_fixture, NewModel: S/adapters.go:77, 90, S/main.go:46-51
- HTTPModel() chat-completions: S/adapters.go:109, HB/README.md:39
- Correct() exact contract: S/stage2.go:5-9, St2:13
- Edges: S/main.go:27-72

## Run the lessons and the project (command-table)
- python3 code/main.py: L19/d:95, L20/d:80, M24/d:106
- project_test.py --init: HB/README.md:15, St1:40
- --stage 1 --path --strict: HB/README.md:16, St1:41
- --all --solution --strict: HB/README.md:17
- go run . --budget 2 --out /tmp/orchard-budget.json: St3:50
- go run . --cases --endpoint --model: HB/README.md:36
- --key-env: HB/README.md:39

## Toy harness metrics in Python (annotated-code)
- resolved rule: L19/c:46
- GAIA score and level thresholds: L19/c:63-68
- efficiency = steps / task.gold_steps: L20/c:136
- delta seen minus held: M24/c:94
- contam_flag above 0.1, held-set canonical: M24/c:95, 102
- vs_random, baseline 0.15: M24/c:96, 59
- run_bench(sys, n_seen=40, n_held=160, seed=17): M24/c:93

## CLI defaults (defaults)
- --cases fixtures/orchard-cases.json: S/main.go:13
- --recording fixtures/orchard-recording.json, endpoint disables recordings: S/main.go:14-15
- --budget 4, at most 10000: S/main.go:20, 24
- --timeout 30s, at most 5 minutes: S/main.go:21, 24
- --temperature 0: S/main.go:18, HB/README.md:39
- --max-tokens 128: S/main.go:19, HB/README.md:39
- 1000 cases, one MiB: S/main.go:31, HB/README.md:31
- ten seconds, redirects and query-bearing endpoints rejected: HB/README.md:39

## Troubleshooting (troubleshooting)
- duplicate ID gives ErrConflict: S/stage1.go:32-33, St1:21
- misspelled Expected key errors, unknown fields rejected: St1:33, S/stage1.go:15
- Leaderboard ErrConflict on digest or budget mismatch: S/stage4.go:28-30, St4:21
- 15 min fails against 15 minutes, separate contract: St2:21
- budget-exhausted, later cases stay in denominator: S/stage3.go:26-27, St3:21, HB/README.md:45
- recording exhausted for requested prompt, exact prompts in responses: S/adapters.go:99, HB/README.md:33
- SWE-bench 50% to 35% on SWE-bench+, report both: L19/d:49
- delta above 0.1 flag *, held-set canonical: M24/c:85, 95, 102

## Numbers to remember (concepts)
- 32.67% and 31.08%: L19/d:46
- over 94% predate cutoffs: L19/d:45
- 1.4-2.7x more steps: L20/d:52
- 564 grounding samples, separates grounding from planning: L20/d:51
- ~30-40 point delta: M24/d:63
- coordination tax past ~4 agents: M24/d:29
- Orchard 1/3, 2/3, 3/3: HB/README.md:29
- not measured: cost, safety, domain, worst 1%: L19/d:68-71

## Claim checklist (qa)
- benchmark and split, worthless on wrong split: M24/d:73
- contamination check: M24/d:74
- baseline comparison: M24/d:75
- significance: M24/d:76
- cost disclosure: M24/d:78, P50/P75/P95: L19/d:75
- comparable receipts SHA-256 and budget: HB/README.md:43
- error retries never inspect expected answer: HB/README.md:45
