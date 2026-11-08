---
id: debate-and-roles
title: Debate, Roles and Review Panels
code: DR
subtitle: Run N agents for R rounds, split work into planner, executor, critic and verifier, and gate reviews with a quorum.
hue: 285
sources: phases/16-multi-agent-and-swarms/07-society-of-mind-debate, phases/16-multi-agent-and-swarms/08-role-specialization, phases/14-agent-engineering/25-multi-agent-debate, phases/19-capstone-projects/10-multi-agent-software-team, projects/multi-agent-code-review-panel
source_hash: 5dd0d12b5d9d7748
---

## Debate protocol
type: flow
from: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/docs/en.md

1. **Each of N agents**: produces an initial answer to the question.
2. **Round r = 2..R**: each agent reads the other agents' round r-1 answers.
3. **Each agent**: critiques the peers and gives an updated answer.
4. **Every round**: re-inject the question to stop topic drift.
5. **After R rounds**: majority-vote the final answers.
6. **Cost**: N agents × R rounds = N·R LLM calls with growing context.

## Debate topologies
type: comparison
from: phases/14-agent-engineering/25-multi-agent-debate/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/code/main.py

| Factor | Full mesh | Sparse star |
|---|---|---|
| Who reads whom | Every debater reads every peer | Spokes read only the hub |
| Runner | `full_mesh_round` | `sparse_star_round` |
| Ops per round | `ops += len(peers)` per debater | Spokes read only the hub |
| N=5, R=3 | 60 critique ops | 12 critique ops |
| Proposals at N=5, R=3 | 15 | 15 |
| Main risk | Convergence collapse | Hub failure |
| Fix for the risk | Required disagreement rounds | Rotate or use multiple hubs |

## Four canonical roles
type: concepts
from: phases/16-multi-agent-and-swarms/08-role-specialization/docs/en.md

- **Planner**: reads the goal. Output is a structured plan or spec.
- **Executor**: reads one plan step at a time. Output is the artifact.
- **Critic**: reads the artifact against the plan. Output is accept/reject with reasons.
- **Verifier**: runs a deterministic check. Output is pass/fail with evidence.
- **Critic vs verifier**: a critic is subjective and LLM-based. A verifier is code. They are not the same role.
- **Communicative dehallucination**: the executor asks the relevant role by name when a detail is missing.
- **SOP pattern**: `Code = SOP(Team)`. Each role has a strict input/output schema.

## Role pipeline in code
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/08-role-specialization/code/main.py

```python
spec = planner(user_wish)            # Spec with signature and 3 tests
art = executor(spec)                 # Artifact holds a code string
crep = critic(spec, art)             # checks def, return, task name
vrep = verifier(spec, art)           # runs the tests
exec(art.code, ns, ns)               # verifier sandbox namespace
fn = ns.get(spec.task_name)          # no callable gives a failure
got = fn(*args)                      # compare with expected
if crep.approved and vrep.passed:    # ship only when both pass
```

## Software team architecture
type: architecture
from: phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md

```arch
node | issue | 1,1 | GitHub issue URL | | client
node | arch | 2,1 | Architect | plan with subtasks + interfaces | model
node | board | 3,1 | Task board | file / Redis | queue
node | coders | 4,1 | Coders A to D | worktree + Daytona each | process
node | merge | 4,2 | Merge coordinator | three-way merge | process
node | rev | 3,2 | Reviewer | approve or request changes | model
node | test | 2,2 | Tester | clean sandbox | process
node | pr | 1,2 | Open PR | | client
edge | issue | arch |
edge | arch | board | plan_request
edge | board | coders | subtask
edge | coders | merge | diff_ready
edge | merge | rev | review_needed
edge | rev | test | approved
edge | test | pr | test_passed
```

## Task board messages
type: command-table
from: phases/19-capstone-projects/10-multi-agent-software-team/code/main.py, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md

| Command | What it does |
|---|---|
| `plan_request` | Architect posts the plan with a DAG of subtasks |
| `subtask` | Architect sends one subtask and its files to a coder |
| `diff_ready` | Coder posts the patch to `merge_coord` |
| `review_needed` | Merge coordinator sends the merged diffs to the reviewer |
| `review_feedback` | Reviewer routes change requests back to the coder |
| `approved` | Reviewer passes the diff to the tester |
| `test_passed` | Tester tells `pr_opener` to open the PR |
| `test_failed` | Tester sends stacktraces back to the coder |

## Review panel API
type: task-table
from: projects/multi-agent-code-review-panel/API.md, projects/multi-agent-code-review-panel/solution/main.ts, projects/multi-agent-code-review-panel/solution/cli.ts, projects/multi-agent-code-review-panel/README.md

| Task | Code |
|---|---|
| Reject fake locations | `validateFinding(raw, files)` |
| Group by file, line, rule | `aggregate(reviews, files, quorum = 2)` |
| Run reviewers with limits | `runPanel(reviewers, budget, timeoutMs = 1000)` |
| Score against labels | `evaluate(predicted, expected)` |
| Group key | `JSON.stringify([f.file, f.line, f.rule])` |
| Run the demo | `node cli.ts --input samples/review.json` |
| Import a PR report | `--pr-report /path/review.json` |

## Quorum and budget code
type: annotated-code
lang: typescript
from: projects/multi-agent-code-review-panel/solution/main.ts

```typescript
if (ids.has(review.reviewer)) throw new Error("duplicate reviewer");
if (seen.has(key)) continue;       // one vote per reviewer per group
status: g.supporters.length >= quorum ? "consensus" : "needs-review",
disagreement: new Set(g.severities).size > 1,
if (spent + r.cost > budget) {     // trace status "budget-skipped"
controller.abort();                // deadline hit, status "timeout"
precision: p.size ? hits / p.size : 0,  // zero predictions give 0
```

## Defaults and numbers
type: defaults
from: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md, phases/16-multi-agent-and-swarms/08-role-specialization/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/docs/en.md, projects/multi-agent-code-review-panel/solution/cli.ts, phases/19-capstone-projects/10-multi-agent-software-team/code/ts/src/coordinator.ts

| Setting | Default | Note |
|---|---|---|
| Debate rounds cap | 3 | 3 rounds capture most of the gain |
| Debate agents cap | 5 | Beyond 5, context bloat and cost dominate |
| Original Du et al. setup | N=3, R=2 | Chosen due to cost |
| Critic revision rounds | 2 | Then escalate to human |
| CLI `quorum` | 2 | Supporters needed for consensus |
| CLI `budget` | 3 | Units of reviewer cost |
| CLI `timeout` | 1000 | Milliseconds per reviewer |
| `maxTurns` | 12 | Coordinator turn limit |

## Failure modes
type: troubleshooting
from: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/docs/en.md, phases/16-multi-agent-and-swarms/08-role-specialization/docs/en.md, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| All agents echo the loudest one | Sycophancy cascade | One agent must argue the counter-position |
| Answers leave the question | Topic drift over many rounds | Re-inject the question every round |
| Cost over 10× one CoT call | Compute blowup, N·R calls | Cap rounds at 3 and agents at 5 |
| All agree on the same wrong answer | Same prompt and model for all | Use diverse prompts and models |
| One bad agent corrupts all | Bad hub in a star topology | Rotate or use multiple hubs |
| Plausible code ships with a bug | All-LLM pipeline, no verifier | Add a code-based pass/fail check |
| Reviewer approves a known bug | False approval | Probe with an injected bug, tune below 5% |

## Numbers to remember
type: concepts
from: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md, phases/16-multi-agent-and-swarms/08-role-specialization/docs/en.md, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md

- **5 agents, 5 rounds**: 25 calls at growing context.
- **NLSOM**: societies of 129 members.
- **MAST**: 1642 failures traced. 21.3% were verification gaps.
- **Validation loop**: accuracy from 10% to 70%. A 7× gain from one role.
- **Token amplification**: a 40-turn single-agent run becomes 160 turns across four roles.
- **Rubric**: 25 pass@1, 20 speedup, 20 review quality, 20 token efficiency, 15 coordination.

## Questions
type: qa
from: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md, phases/14-agent-engineering/25-multi-agent-debate/docs/en.md, projects/multi-agent-code-review-panel/README.md, projects/multi-agent-code-review-panel/stages/02-agreement/docs/en.md

- **Why debate over self-consistency?** Samples from one model share errors. Debate decorrelates them.
- **Agents or rounds?** Each alone plateaus. Both together give the big jumps.
- **When does debate hurt?** Latency-sensitive UX, cost-sensitive scale and simple lookups.
- **Is consensus truth?** No. Consensus measures support, not truth.
- **Five reports from one reviewer?** Support counts distinct reviewer ids, not reports.

## Ship checklist
type: tips
from: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md, phases/16-multi-agent-and-swarms/08-role-specialization/docs/en.md, phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md

- Use at least two different base models in the debate pool.
- Log every round. Hidden rounds cannot be debugged or audited.
- Keep at least one deterministic verifier. Never all-LLM.
- Run the critic first and the verifier second.
- Freeze the plan once coders start. A replan is a separate event.
- The reviewer cannot approve its own changes.
