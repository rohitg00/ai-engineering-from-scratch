---
id: coding-agents
title: Coding Agents: Landscape and Capstones
code: CL
subtitle: Pick a scaffold, set the budgets and gates, run the capstone agents and the three coding-agent projects.
hue: 25
sources: phases/15-autonomous-systems/09-coding-agent-landscape, phases/19-capstone-projects/01-terminal-native-coding-agent, phases/19-capstone-projects/09-code-migration-agent, phases/19-capstone-projects/16-github-issue-to-pr-agent, phases/19-capstone-projects/29-end-to-end-coding-task-demo, projects/tiny-coding-agent, projects/rust-agent-shell, projects/pr-review-reporter
source_hash: 409e63299e9dca9c
---

## JSON tool calls vs CodeAct
type: comparison
from: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md, phases/15-autonomous-systems/09-coding-agent-landscape/code/main.py

| Factor | JSON tool calls | CodeAct |
|---|---|---|
| One action is | One structured JSON payload | A whole Python program |
| Audit | Easy, one action per turn | Harder, wide blast radius |
| Composition | Limited | Loops, chains tools, catches errors |
| Safety | Validator on every call | Needs a hardened sandbox |
| Toy blast radius | 1 file per action | Every failing file at once |
| Dominant in | Managed services | Open platforms |

## Three capstone agents
type: comparison
span: 2
from: phases/19-capstone-projects/01-terminal-native-coding-agent/docs/en.md, phases/19-capstone-projects/16-github-issue-to-pr-agent/docs/en.md, phases/19-capstone-projects/09-code-migration-agent/docs/en.md

| Factor | Terminal agent (01) | Issue-to-PR (16) | Migration (09) |
|---|---|---|---|
| Trigger | `agent run <repo> "<task>"` | Issue label `@agent fix this` | `migrate <repo> --target java17` |
| Sandbox | E2B or Daytona, git worktree | Daytona or E2B per task | Daytona per branch |
| Turn cap | 50 turns | 30 agent turns | 20 agent turns |
| Cost cap | $5 per task | $20 per PR, 5 PRs per repo per day | $8 per repo |
| Other cap | 200k context | 30 min wall-clock | 30 min per repo |
| Gate before PR | Tests pass | Full CI in sandbox, coverage delta | Tests pass, coverage not down 2% |
| On failure | `Stop` hook writes a trace bundle | CI red: halt, no PR | Failure class plus repro |

## Use X when
type: concepts
from: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md, phases/19-capstone-projects/01-terminal-native-coding-agent/docs/en.md, phases/19-capstone-projects/16-github-issue-to-pr-agent/docs/en.md, phases/19-capstone-projects/09-code-migration-agent/docs/en.md

- **Use JSON tool calls when**: each action needs an explicit validator and an easy audit.
- **Use CodeAct when**: one action must chain tools over many files. Harden the sandbox first.
- **Use a terminal agent when**: the work is CLI in, pull request out, with a live plan.
- **Use issue-to-PR when**: the UX is a GitHub label. No interactive loop, no terminal.
- **Use a migration agent when**: the test suite is the ground truth across many repos.
- **Use deterministic recipes first**: they catch 70 to 80% of mechanical migration fixes.

## Numbers to know
type: concepts
from: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md, phases/19-capstone-projects/01-terminal-native-coding-agent/docs/en.md

- **SWE-bench Verified**: 4% to 80.9% in under three years. 500 human-curated tasks.
- **Scaffold delta**: Claude Sonnet 4.5 got 43.2% on SWE-agent v1 and 59.8% on Cline.
- **Easy tail**: 161 of 500 Verified tasks need only a 1 or 2 line change.
- **SWE-bench Pro**: 10+ line changes. Frontier systems score 23 to 59%.
- **Verifier loop**: a 10+ point delta on SWE-bench.
- **Live-SWE-agent**: 79.2% on SWE-bench Verified with Opus 4.5.

## Terminal agent harness (01)
type: architecture
from: phases/19-capstone-projects/01-terminal-native-coding-agent/docs/en.md

```arch
node | cli | 1,1 | User CLI | agent run | client
node | harness | 2,1 | Harness | Bun + Ink TUI | process
node | loop | 3,1 | Plan, act, observe | TodoWrite plan state | process
node | model | 4,1 | Model | via OpenRouter | model
node | tools | 3,2 | Tool dispatcher | MCP StreamableHTTP | process
node | box | 2,2 | Sandbox | E2B or Daytona, worktree | process
node | hooks | 1,2 | Hooks | 8 lifecycle events | queue
node | otel | 1,3 | OpenTelemetry | Langfuse: spans, tokens, $ | store
node | pr | 2,3 | PR | via GitHub app | client
edge | cli | harness |
edge | harness | loop |
edge | loop | model | calls
edge | loop | tools | tool calls
edge | tools | box | run
edge | box | hooks |
edge | hooks | otel |
edge | otel | pr |
```

## Run the lessons
type: task-table
span: 2
from: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md, phases/19-capstone-projects/01-terminal-native-coding-agent/code, phases/19-capstone-projects/09-code-migration-agent/code/main.py, phases/19-capstone-projects/16-github-issue-to-pr-agent/code/main.py, phases/19-capstone-projects/29-end-to-end-coding-task-demo/docs/en.md

| Task | Code |
|---|---|
| Compare the toy scaffolds (L09) | `code/main.py` |
| Plan, act, observe loop (01) | `python main.py` |
| TS harness demo plus offline eval | `npm start` |
| Simulate 50 migrations (09) | `python main.py` |
| Dispatch 20 issues over 3 repos (16) | `python main.py` |
| Fix the fizz fixture (29) | `python3 code/main.py` |
| Test the end-to-end demo | `python3 -m pytest code/tests/ -v` |

## The three projects
type: comparison
span: 2
col: 1
from: projects/tiny-coding-agent, projects/rust-agent-shell, projects/pr-review-reporter

| Factor | tiny-coding-agent | rust-agent-shell | pr-review-reporter |
|---|---|---|---|
| Builds | Bounded repair loop with exact patches | Rust stdin/stdout action loop | Anchored patch review report |
| Language | Python 3.10+ | Rust plus a Python adapter | TypeScript on Node 22.18+, Python |
| Input | Workspace plus `proposals.json` | Workspace plus `requests.jsonl` | Unified diff, stdin or `--repo` |
| Output | `repair-trace.json` | JSONL events per request id | `review.json`, `review.html`, SARIF |
| Budget | `--max-steps` default 6 | `--limit` default 50 | Diff at most one megabyte |
| Safety | Path containment, one test command | No OS shell, 16 KiB reads | HTML escaping, exact quote gate |
| End states | `completed`, `failed`, `budget_exhausted` | `ok`, `error`, `rejected` | Accepted or rejected findings |

## Project commands
type: command-table
span: 2
col: 3
from: projects/tiny-coding-agent/README.md, projects/rust-agent-shell/README.md, projects/pr-review-reporter/README.md

| Command | What it does |
|---|---|
| `project_test.py <project> --init learning-artifacts/<project>` | Creates a learner workspace |
| `project_test.py <project> --stage 1 --path <workspace>` | Grades one stage |
| `project_test.py <project> --all --solution --strict` | Checks the reference |
| `cli.py <workspace> <proposals> --copy-to <dir> --out <trace>` | Repairs a disposable copy |
| `client.py <workspace> <requests> --limit 8 --out <file>` | Rust shell through the adapter |
| `node cli.ts --diff samples/change.diff --sarif review.sarif` | Writes JSON, HTML and SARIF |
| `--repo /path --base REF --head REF` | Read-only Git diff mode |
| `--candidates recorded-findings.json` | Validates another reviewer's findings |

## Budgets in the code
type: defaults
col: 1
from: phases/19-capstone-projects/01-terminal-native-coding-agent/code/main.py, phases/19-capstone-projects/09-code-migration-agent/code/main.py, phases/19-capstone-projects/29-end-to-end-coding-task-demo/code/main.py

| Setting | Default | Note |
|---|---|---|
| `max_turns` | 50 | Capstone 01 `Budget` |
| `max_tokens` | 200_000 | Capstone 01 context ceiling |
| `max_dollars` | 5.00 | Capstone 01, per task |
| `TRUNCATE_BYTES` | 4096 | Tool output cap in 01 |
| `BUDGET_TURNS` | 20 | Migration, with `BUDGET_USD` 8.0 |
| `step_budget` | 12 | L29 `AgentRun` |

## Gate chain and sandbox (29)
type: annotated-code
col: 1
lang: python
from: phases/19-capstone-projects/29-end-to-end-coding-task-demo/code/main.py

```python
chain = GateChain(gates=(
    WhitelistGate(allowed=frozenset({"read_file", "write_file", "run_tests"})),  # allow-set
    RegexGate.from_strings(items=(r"\brm\s+-rf\b", r"\bsudo\b", r"^/etc/")),  # refused patterns
    BudgetGate(max_tokens=budget),  # observation budget
))
outcome = self.chain.evaluate(call, ctx)  # stops at the first deny
sandbox = Sandbox(project_root=repo, timeout_seconds=10.0)  # denylist plus path jail
```

## Troubleshooting
type: troubleshooting
col: 3
from: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md, phases/19-capstone-projects/01-terminal-native-coding-agent/docs/en.md, phases/19-capstone-projects/01-terminal-native-coding-agent/code/main.py, phases/19-capstone-projects/09-code-migration-agent/docs/en.md, phases/19-capstone-projects/16-github-issue-to-pr-agent/docs/en.md, phases/19-capstone-projects/16-github-issue-to-pr-agent/code/main.py, projects/tiny-coding-agent/solution/main.py, projects/rust-agent-shell/solution/main.rs

| Symptom | Cause | Fix |
|---|---|---|
| Loop crashes on 8MB of ripgrep matches | Untruncated tool output | Cap each call at 4k tokens |
| `rm -rf` reaches the sandbox | No `PreToolUse` guard | `destructive_guard` sets `blocked` |
| High Verified score, weak real results | Easy tail, 161 of 500 tasks | Score a Pro-like subset of your backlog |
| `budget_exhausted` | 30 min, $8 or 20 turns used | File the repo with the current diff |
| `coverage_regression` | Coverage dropped more than 2% | File under the class, no PR |
| `policy_denied` | `can("force_push")` returns False | Branch protection, app not in bypass list |
| `patch must match exactly once` | Old text missing or not unique | Use one unique exact old string |
| `path escapes root` | Path leaves the canonical root | Pass a relative path inside the root |

## Q&A
type: qa
span: 2
col: 3
from: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md, phases/15-autonomous-systems/09-coding-agent-landscape/code/main.py, phases/19-capstone-projects/16-github-issue-to-pr-agent/code/main.py

- **Which coding agent is best?** Wrong question. Measure reliability on your own task distribution.
- **Why does the toy CodeAct take fewer turns?** One snippet rewrites every failing file at once.
- **Why no `assert` for a safety gate?** `python -O` strips asserts.
