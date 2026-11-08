---
id: agent-benchmarks
title: Agent Benchmarks: SWE-bench to OSWorld
code: AB
subtitle: Pick the benchmark, gate on the right tests, check contamination and compare runs on equal denominators.
hue: 28
sources: phases/14-agent-engineering/19-benchmarks-swebench-gaia, phases/14-agent-engineering/20-benchmarks-webarena-osworld, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks, projects/harness-bench
source_hash: 7ff044c00ba88674
---

## Single-agent benchmarks side by side
type: comparison
span: 2
from: phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md, phases/14-agent-engineering/20-benchmarks-webarena-osworld/docs/en.md

| Factor | SWE-bench | GAIA | WebArena | OSWorld |
|---|---|---|---|---|
| Tests | Code patching | Generalist tool use | Web tasks, long horizon | Real computer tasks |
| Size | 2,294 issues, 12 Python repos | 466 questions, 300 private | 812 tasks, 4 apps | 369 tasks, 3 OSes |
| Agent input | Codebase at pre-fix commit + issue | Question. Web, multi-modality | Self-hosted apps + utilities | 1920×1080 screenshots |
| Evaluator | FAIL_TO_PASS and PASS_TO_PASS tests | Not given | Execution-based, gym APIs | Not given |
| Best at release | SWE-agent 12.5% | GPT-4 with plugins 15% | GPT-4 agent 14.41% | Best model 12.24% |
| Human | Not given | 92% | 78.24% | 72.36% |
| Main trap | Contamination | Confusion with code benchmarks | Stale pinned app versions | GUI grounding |

## Multi-agent benchmarks side by side
type: comparison
span: 2
from: phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md

| Factor | MARBLE | COMMA | MedAgentBoard | SWE-bench Pro |
|---|---|---|---|---|
| Measures | Star, chain, tree, graph topologies | Multimodal asymmetric information | 4 medical task categories | Uncontaminated, later cutoffs |
| Scoring | Milestone KPIs, partial progress | Agent-agent collaboration | Multi-agent vs single-LLM vs rules | 1865 problems, 41 repos |
| Headline | Graph best for research | Frontier models struggle vs random | Multi-agent does NOT dominate | ~23% on Pro vs 70%+ on Verified |
| Lesson | Cognitive planning adds ~3% | Measure before you claim | Many systems are over-engineered | Verified alone is not evidence |

## Use X when
type: tips
from: phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md, phases/14-agent-engineering/20-benchmarks-webarena-osworld/docs/en.md, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md

- SWE-bench Verified: a code agent. Always report Verified scores.
- SWE-bench Pro: a contamination reality check. Pro is the current gating test.
- GAIA: a generalist agent. Use the private leaderboard split.
- AgentBench: a multi-environment comparison across 8 environments.
- WebArena Verified: a web agent. Self-host it for continuous evaluation.
- OSWorld: a desktop agent. Run it in a VM fleet.
- MARBLE: you compare coordination topologies apples-to-apples.
- AgentArch: you must justify each layer of an enterprise stack.
- Custom evals: your product flows. Capture gold trajectories for your top 20 tasks.

## SWE-bench gate: run_task
type: flow
from: phases/14-agent-engineering/19-benchmarks-swebench-gaia/code/main.py, phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md

1. **Harness**: copy `state_before`. Count passing FAIL_TO_PASS and PASS_TO_PASS checks.
2. **Agent**: apply the patch to a copy of the state.
3. **Harness**: count passing checks again on the new state.
4. **Fix gate**: all FAIL_TO_PASS tests must pass after the patch.
5. **No-regression gate**: `ptp_broke` must be 0.
6. **Result**: `resolved` is true only when both gates pass.
7. **Report**: resolution rate is resolved tasks over all tasks.

## Harness Bench pipeline
type: architecture
from: projects/harness-bench/solution, projects/harness-bench/README.md

```arch
node | cases | 1,1 | Cases JSON | ID, Prompt, Expected | store
node | load | 2,1 | Cases() | strict decode, max 1000
node | eval | 3,1 | EvaluatePolicy() | 3 policies, call budget | process
node | board | 4,1 | Leaderboard() | equal denominators
node | rec | 2,2 | Recording | authored_fixture | store
node | http | 3,2 | HTTPModel() | chat-completions | model
node | score | 4,2 | Correct() | exact answer contract
edge | cases | load |
edge | load | eval | cases
edge | rec | eval | NewModel
edge | http | eval | ContextModel
edge | eval | score | answer
edge | eval | board | Result
```

## Run the lessons and the project
type: command-table
span: 2
from: phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md, phases/14-agent-engineering/20-benchmarks-webarena-osworld/docs/en.md, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md, projects/harness-bench/README.md, projects/harness-bench/stages

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs the toy harness of lessons 14.19, 14.20 and 16.24 |
| `python3 scripts/project_test.py harness-bench --init /tmp/harness-bench-work` | Creates the learner workspace |
| `python3 scripts/project_test.py harness-bench --stage 1 --path /tmp/harness-bench-work --strict` | Grades one stage |
| `python3 scripts/project_test.py harness-bench --all --solution --strict` | Grades the reference solution |
| `go run . --budget 2 --out /tmp/orchard-budget.json` | Replays Orchard with 2 calls per policy |
| `go run . --cases <cases.json> --endpoint <url> --model <model>` | Calls a live chat-completions model |
| `--key-env <VAR>` | Names the environment variable that holds the key |

## Toy harness metrics in Python
type: annotated-code
lang: python
from: phases/14-agent-engineering/19-benchmarks-swebench-gaia/code/main.py, phases/14-agent-engineering/20-benchmarks-webarena-osworld/code/main.py, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/code/main.py

```python
resolved = (ftp_post == len(task.fail_to_pass)) and (ptp_broke == 0)
score = steps + modalities + tools    # GAIA level: <=2 is 1, <=5 is 2, else 3
efficiency = steps / task.gold_steps  # trajectory efficiency, 1.0 is gold
delta = r["accuracy_seen"] - r["accuracy_held"]
contam_flag = "*" if delta > 0.1 else " "  # held-set accuracy is canonical
vs_random = r["accuracy_held"] - rand_baseline  # baseline 0.15
r = run_bench(sys, n_seen=40, n_held=160, seed=17)
```

## CLI defaults
type: defaults
from: projects/harness-bench/solution/main.go, projects/harness-bench/README.md

| Setting | Default | Note |
|---|---|---|
| `--cases` | fixtures/orchard-cases.json | JSON array of cases |
| `--recording` | fixtures/orchard-recording.json | Ignored when `--endpoint` is set |
| `--budget` | 4 | Model calls per policy, at most 10000 |
| `--timeout` | 30s | Deadline per policy, at most 5 minutes |
| `--temperature` | 0 | HTTP sampling temperature |
| `--max-tokens` | 128 | HTTP output token ceiling |
| Case limit | 1000 | Files are limited to one MiB |
| HTTP request cap | ten seconds | Redirects and query endpoints are rejected |

## Troubleshooting
type: troubleshooting
span: 2
from: projects/harness-bench/stages, projects/harness-bench/solution, projects/harness-bench/README.md, phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md, phases/14-agent-engineering/20-benchmarks-webarena-osworld/docs/en.md, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| `Cases` returns `ErrConflict` | Two cases share an ID | Give each case a unique ID |
| `Cases` returns an error on a valid answer | Misspelled `Expected` key | Fix the key. Unknown fields are rejected |
| `Leaderboard` returns `ErrConflict` | Dataset digest, model digest or budget differ | Rerun all policies on one config |
| `15 min` fails against `15 minutes` | Exact answer contract | Declare variants in a separate contract |
| State is `budget-exhausted` | A retry spent the budget | Later cases stay in `Total`. Raise `--budget` |
| `recording exhausted for requested prompt` | Prompt missing or array used up | Add the exact policy prompt to `responses` |
| SWE-bench 50% drops to 35% on SWE-bench+ | Solution leakage in the issue text | Report Verified and SWE-bench+ scores |
| Delta above 0.1, flag `*` | Seen tasks score higher than held tasks | Quote held-set accuracy only |

## Numbers to remember
type: concepts
from: phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md, phases/14-agent-engineering/20-benchmarks-webarena-osworld/docs/en.md, phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md, projects/harness-bench/README.md

- **SWE-bench+**: 32.67% of successful patches leaked solutions. 31.08% had weak tests.
- **Cutoffs**: over 94% of SWE-bench issues predate most model cutoffs.
- **OSWorld-Human**: top agents use 1.4-2.7x more steps than gold.
- **OSWorld-G**: 564 grounding-only samples. It splits grounding from planning.
- **Agent-team gain**: ~30-40 point delta on SWE-bench Pro.
- **Coordination tax**: appears past ~4 agents on graph topology.
- **Orchard replay**: baseline 1/3 in 3 calls, error-retry 2/3 in 4, evidence 3/3 in 3.
- **Not measured**: cost, adversarial safety, your domain and the worst 1% of tails.

## Claim checklist
type: qa
from: phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md, phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md, projects/harness-bench/README.md

- **Which benchmark and split?** Verified vs Pro is a large gap. A number on the wrong split is worthless.
- **Contamination check?** Was the benchmark released after the training cutoff? If not, treat with caution.
- **Which baseline?** Single-LLM, random and prior multi-agent work. Not an untuned copy of the same system.
- **Significance?** N trials, p-value and a confidence interval. Single runs mislead.
- **Cost disclosed?** Tokens per task and wall-clock. Report P50/P75/P95, not one number.
- **Comparable receipts?** Same dataset SHA-256, model config SHA-256 and call budget.
- **Retry on a wrong answer?** No. Error retries never inspect the expected answer.
