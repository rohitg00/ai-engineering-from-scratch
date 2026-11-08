---
id: multi-agent-case-studies
title: Multi-Agent Case Studies and Eval Farms
code: MF
subtitle: Three 2026 reference systems, the software team capstone, and a fenced, resumable eval farm in Go.
hue: 210
sources: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota, phases/19-capstone-projects/10-multi-agent-software-team, projects/distributed-eval-farm
source_hash: 75cf32b6d4c0f5e0
---

## Three reference cases
type: comparison
from: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/docs/en.md, phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/code/main.py

| Factor | Anthropic Research | MetaGPT / ChatDev | OpenClaw / Moltbook |
|---|---|---|---|
| Topology | Supervisor-worker | SOP role decomposition | Population-scale substrate |
| Key result | +90.2% over single-agent Opus 4 | MacNet: >1000 agents via DAGs | ~2.3M agent accounts in days |
| Cost signal | 15x tokens per query | Per-role budget | Per-interaction pricing |
| Pattern to copy | Fresh-context subagents | Structured artifact handoffs | Prompt-injection threat model |
| Verification | Explicit verifier role | QA Engineer | In-network validators |
| Framework | Claude Agent SDK or LangGraph | CrewAI or MetaGPT | Custom substrate + MCP + A2A |
| Pick for | Research and knowledge tasks | Engineering tool chains | Network-effect social products |

## Common patterns
type: concepts
from: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/docs/en.md

- **Orchestrator + workers**: every case has a supervisor or network effect.
- **Handoff contracts**: artifacts between roles follow a schema.
- **Verification**: a first-class role in every case.
- **Scaling**: topology + substrate, not just more agents.
- **Effort scaling**: simple is 1 agent with 3-10 tool calls. Complex is 10+ subagents.
- **Rainbow deploy**: keep old runtime versions alive for in-flight agents.
- **Prompt injection**: treat agent profiles and cross-agent messages as untrusted input.

## Map a design to a case
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/code/main.py

```python
def map_to_case(d: Design) -> str:
    if d.task_type == "population" or d.user_facing_network:
        return "openclaw_moltbook"
    if d.task_type == "engineering" or d.roles_distinct:
        return "metagpt_chatdev"
    return "anthropic_research"        # research and the default
print_case(case_key)                   # patterns, framework, citation
print_landscape()                      # FRAMEWORK_LANDSCAPE rows
```

## Software team build steps
type: flow
from: phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md

1. **Task board**: file-backed JSONL of typed messages. Agents subscribe to tags.
2. **Architect**: emits one `plan_request` with a DAG of subtasks and interfaces.
3. **Coders**: each claims one subtask in a fresh `git worktree add` branch.
4. **Merge coordinator**: three-way merges the N branches into a staging branch.
5. **Reviewer**: cannot approve diffs it authored. Routes `review_feedback` to the coder.
6. **Tester**: runs the suite in a clean sandbox. Failures loop back to the owner.
7. **Accounting**: one span per role-boundary message with payload size and model.
8. **Post-mortem**: a handoff-failure histogram for each failed issue.

## Eval farm architecture
type: architecture
from: projects/distributed-eval-farm/README.md, projects/distributed-eval-farm/API.md, projects/distributed-eval-farm/stages/02-fence-each-shard-lease/docs/en.md

```arch
node | cases | 1,1 | cases.json | id, prompt, expected, response | client
node | part | 2,1 | Partition | FNV-1a into shards |
node | store | 3,1 | farm.json | under ledger.lock | store
node | run | 4,1 | run | Parallel pool, bounded waves | process
node | claim | 4,2 | ClaimShard | lock, load, acquire, persist | process
node | work | 3,2 | WorkShard | exact match outside the lock | process
node | done | 2,2 | CompleteShard | reload, Submit while locked | process
node | rep | 1,2 | Report | coverage and receipts | client
edge | cases | part |
edge | part | store | InitFarm
edge | store | run |
edge | run | claim | worker process
edge | claim | work | cases
edge | work | done | result
edge | done | rep |
```

## Eval farm commands
type: command-table
from: projects/distributed-eval-farm/README.md, projects/distributed-eval-farm/API.md, projects/distributed-eval-farm/stages/02-fence-each-shard-lease/docs/en.md

| Command | What it does |
|---|---|
| `go build -o /tmp/eval-farm .` | Build the reference binary in `solution` |
| `init --store DIR --input FILE --shards N` | Bind dataset hash and shard count |
| `run ... --shards N --workers W` | Launch bounded process waves |
| `worker --store DIR --worker-id NAME` | Claim, evaluate and submit one shard |
| `status --store DIR` | Validate and report the snapshot |
| `demo --input FILE` | Print crash and recovery snapshots |
| `--crash-after-claim` | Exit 86 after the durable claim |
| `--all --solution --strict` | Grade the reference with `project_test.py` |

## Eval farm contracts
type: task-table
from: projects/distributed-eval-farm/solution/stage1.go, projects/distributed-eval-farm/solution/stage2.go, projects/distributed-eval-farm/solution/stage3.go, projects/distributed-eval-farm/solution/stage4.go, projects/distributed-eval-farm/solution/types.go

| Task | Code |
|---|---|
| Stage 1, stable shard per ID | `Partition(ids []string, shards int)` |
| Hash an ID | `h := fnv.New32a()` |
| Stage 2, fence a lease | `Acquire(l, worker, now, ttl)` |
| Stage 3, accept one result | `Submit(l, worker, version, now, result)` |
| Stage 4, bounded pool | `Parallel(ctx, ids, workers, run)` |
| Lease fields | `Shard, Worker, Version, Until, Result, Done` |
| Errors | `ErrInvalid`, `ErrConflict`, `ErrLimit` |

## Lease and receipt rules
type: annotated-code
lang: go
from: projects/distributed-eval-farm/solution/stage2.go, projects/distributed-eval-farm/solution/stage3.go

```go
// Acquire: a done or live lease is a conflict
if l.Done || (l.Worker != "" && now < l.Until) {
l.Until = now + ttl
l.Version++
// Submit: check owner and version first
if l.Worker != worker || l.Version != version {
// a done lease accepts only the same result again
if l.Result == result {
// a first completion must come before expiry
if now >= l.Until {
```

## Defaults and limits
type: defaults
from: projects/distributed-eval-farm/solution/main.go, projects/distributed-eval-farm/API.md, projects/distributed-eval-farm/README.md, projects/distributed-eval-farm/stages/03-accept-idempotent-completion-receipts/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `--shards` | 4 | Fixed partition count, range 1..1024 |
| `--workers` | 2 | Concurrent processes, range 1..64 |
| `--lease-ms` | 30000 | Claim duration |
| `--now-ms` | -1 | Uses the wall clock |
| `--delay-ms` | 0 | Range 0..60000 |
| `--store` | farm-data | Same-host directory |
| Snapshot size | 4 MiB | Whole-run snapshot |
| Result size | 1 MiB | Largest accepted result |

## Failure modes
type: troubleshooting
from: projects/distributed-eval-farm/README.md, projects/distributed-eval-farm/API.md, projects/distributed-eval-farm/stages/04-run-a-bounded-local-worker-pool/docs/en.md, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md, phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Worker exits 86 | Intentional crash after claim | Run again at the expiry boundary |
| Run exits 1 with complete:false | Remaining leases still owned | Invoke run again after expiry |
| Old worker gets a fencing error | Replacement committed first | Expected. Snapshot stays unchanged |
| Run exits 1 on a changed dataset | Dataset hash differs | Use a different store |
| Subtasks cannot be implemented | Plan too vague | Plan template with explicit interfaces |
| Reviewer approves a bug | Reviewer false-approve | Injected-bug probe, tune the prompt |
| Viral prompt spreads to agents | Prompt injection at scale | Treat cross-agent messages as untrusted |
| Research agents hallucinate | No explicit verifier role | Add a verifier, about 20-30% of tokens |

## Numbers to remember
type: concepts
from: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/docs/en.md, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md, projects/distributed-eval-farm/README.md

- **Token usage**: explains 80% of BrowseComp variance.
- **MAST**: failure rates of 41-86.7% on real multi-agent systems.
- **OpenClaw**: 247k GitHub stars in ~4 months.
- **Capstone eval**: 50 SWE-bench Pro issues against one Sonnet 4.7 baseline.
- **Rubric**: 25 pass@1, 20 speedup, 20 review quality, 20 tokens, 15 coordination.
- **Farm sample**: four records score 3/4. Two waves launch four processes.

## Questions
type: qa
from: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/docs/en.md, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md, projects/distributed-eval-farm/README.md, projects/distributed-eval-farm/stages/03-accept-idempotent-completion-receipts/docs/en.md

- **Why does multi-agent research win?** Each subagent gets a fresh context window.
- **Which benchmark?** SWE-bench Pro. Verified is contaminated.
- **What does the capstone measure?** Whether multi-agent wins per dollar, not only whether it works.
- **Can a late correct worker overwrite?** No. old/v1 fails when new/v2 completed the shard.
- **Does recovery at 109 steal the lease?** No. It reports a pending run and exits 1.
