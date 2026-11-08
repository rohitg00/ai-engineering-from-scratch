---
id: delegation-feedback
title: Delegation, Isolation and Feedback Ratchets
code: DI
subtitle: Plan from evidence, split work by exclusive ownership, and promote each correction to the earliest owning layer.
hue: 280
sources: phases/14-agent-engineering/44-plan-from-evidence, phases/14-agent-engineering/45-delegate-with-isolation, phases/14-agent-engineering/46-turn-feedback-into-system, phases/14-agent-engineering/54-build-the-feedback-ratchet, projects/workflow-hooks
source_hash: f0b703417fb900be
---

## Plan, delegate, integrate
type: architecture
from: phases/14-agent-engineering/44-plan-from-evidence/docs/en.md, phases/14-agent-engineering/45-delegate-with-isolation/docs/en.md

```arch
node | plan | 1,1 | Approved plan | waves from dependencies | store
node | api | 2,1 | API work unit | owns its paths | process
node | docs | 2,2 | Docs work unit | owns its paths | process
node | h1 | 3,1 | Proof and handoff | API unit | store
node | h2 | 3,2 | Proof and handoff | docs unit | store
node | rev | 4,1 | Integration review | read only | model
node | gate | 4,2 | Full verification gate | cross-unit | process
edge | plan | api |
edge | plan | docs |
edge | api | h1 |
edge | docs | h2 |
edge | h1 | rev |
edge | h2 | rev |
edge | rev | gate |
```

## The ratchet loop
type: flow
from: phases/14-agent-engineering/54-build-the-feedback-ratchet/docs/en.md

1. **Observe**: record a concrete signal.
2. **Connect**: link it to an outcome, constraint or assumption.
3. **Locate**: find the earliest system layer that owns the cause.
4. **Change**: create a bounded change with one owner.
5. **Verify**: prove that recurrence becomes less likely.
6. **Review**: decide to keep, revise or retire the control.

## Five commitments per work item
type: concepts
from: phases/14-agent-engineering/44-plan-from-evidence/docs/en.md, phases/14-agent-engineering/44-plan-from-evidence/code/main.py

- **Identifier**: stable reference for dependencies and handoff.
- **Change**: the smallest behavior or contract change.
- **Evidence**: repository facts that justify the change.
- **Dependencies**: work that must be true first.
- **Proof**: the exact check that closes the item.
- **Wave**: items whose dependencies are all complete. They run together.
- **Contract first**: implementation and docs wait for the contract.

## Delegate or keep serial
type: comparison
from: phases/14-agent-engineering/45-delegate-with-isolation/docs/en.md

| Factor | Delegate | Keep serial |
|---|---|---|
| Files | Disjoint files and contracts | Same files |
| Decisions | Different unknowns | Same unresolved decision |
| Environment | Separate worktrees or sandboxes | Same mutable environment |
| Lab example | API and docs units, disjoint paths | Docs unit owns app/, plan blocks |

## Three isolation layers
type: concepts
from: phases/14-agent-engineering/45-delegate-with-isolation/docs/en.md

- **Filesystem**: separate worktrees or sandboxes stop accidental shared edits.
- **Ownership**: contracts stop two workers from editing the same path.
- **State**: separate logs and outputs keep each worker's evidence.
- **Limit**: two clean worktrees can still produce conflicting designs.
- **Integrator**: reads proof output, merges in dependency order, runs the full gate.

## Route a signal to its layer
type: concepts
from: phases/14-agent-engineering/46-turn-feedback-into-system/docs/en.md, phases/14-agent-engineering/54-build-the-feedback-ratchet/docs/en.md, phases/14-agent-engineering/54-build-the-feedback-ratchet/code/main.py

- **Wrong result, regression, false positive**: evaluation or test.
- **Missing context, duplicate work, stale fact**: context source.
- **Off-scope or unsafe action**: scope or permission policy.
- **Timeout, retry storm**: runtime control.
- **Repeated setup or command mistake**: automation or tool.
- **Output-format mistake**: canonical example plus validator.
- **Product disagreement**: human decision record or shaped backlog.
- **Priority**: severity times frequency. Severity is one to five.

## Lesson functions
type: task-table
from: phases/14-agent-engineering/44-plan-from-evidence/code/main.py, phases/14-agent-engineering/45-delegate-with-isolation/code/main.py, phases/14-agent-engineering/46-turn-feedback-into-system/code/main.py, phases/14-agent-engineering/54-build-the-feedback-ratchet/code/main.py

| Task | Code |
|---|---|
| Check plan receipts | `validate(items)` |
| Compute plan waves | `execution_waves(items)` |
| Plan status ready or blocked | `plan_document(items)` |
| Detect parent path overlap | `paths_overlap(left, right)` |
| Delegation status | `delegation_plan(units)` |
| Correction to control | `promote(correction)` |
| Dedupe by fingerprint | `ratchet(corrections)` |
| Signals to sorted actions | `backlog(signals)` |

## Workflow hooks CLI
type: command-table
span: 2
from: projects/workflow-hooks/README.md, projects/workflow-hooks/solution/cli.ts, projects/workflow-hooks/stages/03-policy/docs/en.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py workflow-hooks --init learning-artifacts/workflow-hooks` | Makes the learner workspace |
| `python3 scripts/project_test.py workflow-hooks --stage <n> --path learning-artifacts/workflow-hooks` | Tests one stage |
| `python3 scripts/project_test.py workflow-hooks --all --solution --strict` | Checks the reference solution |
| `node <dir>/cli.ts capture <store> <corrections.jsonl>` | Ingests corrections and saves the store |
| `node <dir>/cli.ts inspect <store>` | Lists rules with `approval_digest` |
| `node <dir>/cli.ts approve <store> <digest>` | Approves the rule with the exact current digest |
| `node <dir>/cli.ts emit <store> <scope>` | Prints `additional_context` for approved rules in scope |
| `node <dir>/cli.ts retire <store> <digest>` | Removes the rule from emits. Evidence stays |

## Rule lifecycle in code
type: annotated-code
lang: typescript
from: projects/workflow-hooks/solution/main.ts, projects/workflow-hooks/solution/cli.ts

```typescript
const c = ingest(raw);                       // scope lowercased, rule case kept
const rules = consolidate(corrections);      // group by scope and rule text
rule.sessions.length                         // unique sessions, not events
transition(rule, "approve");                 // needs minimumSessions = 2
transition(rule, "retire");                  // retired cannot be approved
hook(rules, "orchard");                      // approved, scope or global
ruleDigest(rule);                            // sha256 of scope, text, evidence
await save("rules.json", rules);             // temp file, then fs.rename
await load("rules.json");                    // ENOENT gives an empty list
```

## Defaults and limits
type: defaults
from: projects/workflow-hooks/solution/main.ts, phases/14-agent-engineering/46-turn-feedback-into-system/code/main.py, phases/14-agent-engineering/54-build-the-feedback-ratchet/code/main.py

| Setting | Default | Note |
|---|---|---|
| `minimumSessions` | 2 | Independent sessions to approve |
| `c.rule.length` | 500 | Larger rule is "too large" |
| `c.source.length` | 2000 | Larger source is "too large" |
| Store `version` | 1 | Other versions give "invalid store" |
| Temp file `mode` | 0o600 | Owner-only permissions |
| `recurrence` floor | 1 | Below it the correction is skipped |
| Control fingerprint | 12 | Hex characters of sha256 |
| Signal `severity` | range(1, 6) | Frequency must be positive |

## Errors and fixes
type: troubleshooting
span: 2
from: phases/14-agent-engineering/44-plan-from-evidence/code/main.py, phases/14-agent-engineering/45-delegate-with-isolation/code/main.py, phases/14-agent-engineering/45-delegate-with-isolation/docs/en.md, projects/workflow-hooks/solution/main.ts, projects/workflow-hooks/solution/cli.ts

| Symptom | Cause | Fix |
|---|---|---|
| `has no repository evidence` | A work item has no receipt | Add a file path and line |
| `has no proof command` | Empty proof | Name the exact check that closes it |
| `dependency cycle among` | Items wait on each other | Find the hidden product disagreement |
| `overlap at` in `conflicts` | Docs unit owns `app/`, a parent path | Give each unit exclusive paths |
| `insufficient independent sessions` | One session, many events | Wait for a second session |
| `exact current rule digest required` | Digest is old after new evidence | Run inspect, approve the new digest |
| `credential-like content` | Rule or source holds a key shape | Redact before ingestion |
| `conflicting correction id` | Same id, different content | Never reuse an id for new content |

## Questions
type: qa
from: phases/14-agent-engineering/44-plan-from-evidence/docs/en.md, phases/14-agent-engineering/45-delegate-with-isolation/docs/en.md, phases/14-agent-engineering/46-turn-feedback-into-system/docs/en.md, projects/workflow-hooks/stages/02-consolidate/docs/en.md

- **When is evidence real?** When it can change the plan.
- **Integrator rewrites most of a result?** The decomposition was wrong.
- **Why count sessions, not events?** Repeated hook delivery is not independent evidence.
- **Promote every correction?** No. Only when recurrence or consequence justifies it.
- **Who owns public behavior changes?** The human. Agents own bounded work.

## Tips
type: tips
from: phases/14-agent-engineering/46-turn-feedback-into-system/docs/en.md, phases/14-agent-engineering/54-build-the-feedback-ratchet/docs/en.md, projects/workflow-hooks/README.md

- Fix the cause, not the symptom. "The agent edited README" is a symptom.
- A focused test is stronger than a paragraph that asks the agent to remember.
- Give each control one owner, a verification and a retirement condition.
- Retire a control only with evidence. Do not delete it because it feels old.
- Keep the exact case of API_KEY in a rule.
