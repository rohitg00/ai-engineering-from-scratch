# Evidence: cheatsheets/delegation-feedback.md

Abbreviations: L44 = phases/14-agent-engineering/44-plan-from-evidence, L45 = phases/14-agent-engineering/45-delegate-with-isolation, L46 = phases/14-agent-engineering/46-turn-feedback-into-system, L54 = phases/14-agent-engineering/54-build-the-feedback-ratchet, WH = projects/workflow-hooks. d = docs/en.md, c = code/main.py.

## Plan, delegate, integrate (architecture, 7 nodes, 7 edges)
- Approved plan: L45/d:53. Waves from dependencies: L44/d:89, L45/d:14
- API work unit, owns its paths: L45/d:53. Exclusive paths: L45/d:36
- Docs work unit, owns its paths: L45/d:54. Exclusive paths: L45/d:36
- Proof and handoff for the API unit: L45/d:55
- Proof and handoff for the docs unit: L45/d:56
- Read-only integration review: L45/d:57
- Full verification gate: L45/d:59. Cross-unit gate: L45/d:69

## The ratchet loop (flow, 6 steps)
1. observe a concrete signal: L54/d:24
2. connect to outcome, constraint, or assumption: L54/d:25
3. earliest system layer that owns the cause: L54/d:26
4. bounded change, one owner: L54/d:27, 58
5. verify recurrence less likely: L54/d:28
6. review whether the control remains, keep, revise, or retire: L54/d:29, 155

## Five commitments per work item (concepts, 7)
- Identifier: L44/d:31
- Change: L44/d:32
- Evidence: L44/d:33
- Dependencies: L44/d:34
- Proof: L44/d:35
- Wave, ready items whose deps are complete: L44/c:56-60, L44/d:49
- Contract first, implementation and docs wait: L44/d:39, 49, 98

## Delegate or keep serial (comparison, 4 rows)
- Files: disjoint files and contracts vs same files: L45/d:22, 26
- Decisions: different unknowns vs same unresolved decision: L45/d:21, 26
- Environment: separate worktrees or sandboxes: L45/d:45. Same mutable environment: L45/d:26
- Lab example: api and docs units with disjoint paths: L45/c:74-75. Docs unit owns app/ and the plan blocks: L45/d:92

## Three isolation layers (concepts, 5)
- Filesystem: L45/d:45
- Ownership: L45/d:46
- State: L45/d:47
- two clean worktrees can produce conflicting designs: L45/d:49
- Integrator reads proof output, dependency order, full gate: L45/d:67-69

## Route a signal to its layer (concepts, 8)
- wrong result, regression, false positive to evaluation or test: L46/d:29, L54/d:35
- missing context, duplicate work, stale fact to context source: L54/d:36
- off-scope or unsafe action to scope or permission policy: L46/d:30, L54/d:37
- timeout, retry storm to runtime control: L54/d:38
- repeated setup or command mistake to automation or tool: L46/d:31
- output-format mistake to canonical example plus validator: L46/d:32
- product disagreement to human decision record, shaped backlog: L46/d:34, L54/d:39
- priority = severity * frequency, severity one to five: L54/c:48-51

## Lesson functions (task-table, 8)
- validate(items): L44/c:22
- execution_waves(items): L44/c:46
- plan_document(items) ready or blocked: L44/c:67-70
- paths_overlap(left, right) parent check: L45/c:22-25
- delegation_plan(units): L45/c:57
- promote(correction): L46/c:62
- ratchet(corrections) keyed by fingerprint: L46/c:85-92
- backlog(signals) sorted by priority: L54/c:77-79

## Workflow hooks CLI (command-table, 8)
- project_test.py --init: WH/README.md:14
- --stage --path: WH/README.md:15
- --all --solution --strict: WH/README.md:41
- cli.ts capture store corrections.jsonl: WH/README.md:30, WH/solution/cli.ts:24-48
- cli.ts inspect, approval_digest: WH/README.md:31, WH/solution/cli.ts:61-64
- approve with exact current digest: WH/solution/cli.ts:49-53, WH/stages/03-policy/docs/en.md:17
- emit additional_context: WH/solution/cli.ts:54-60
- retire removes from emits, evidence kept: WH/solution/cli.ts:49-53, WH/stages/03-policy/docs/en.md:17

## Rule lifecycle in code (annotated-code, 9 lines)
- ingest: scope normalized, rule whitespace collapsed: WH/solution/main.ts:31-46
- consolidate groups by scope and rule: WH/solution/main.ts:47-59
- sessions unique: WH/solution/main.ts:80, WH/stages/02-consolidate/docs/en.md:5
- transition approve, minimumSessions = 2: WH/solution/main.ts:84-94
- retired rule cannot be approved: WH/solution/main.ts:90-91
- hook selects approved, scope or global: WH/solution/main.ts:96-108
- ruleDigest sha256 of scope, text, evidence: WH/solution/cli.ts:6-15
- save temp file then fs.rename: WH/solution/main.ts:115-123
- load ENOENT returns []: WH/solution/main.ts:144

## Defaults and limits (defaults, 8)
- minimumSessions 2: WH/solution/main.ts:87
- c.rule.length 500, "too large": WH/solution/main.ts:37-38
- c.source.length 2000, "too large": WH/solution/main.ts:37-38
- store version 1, "invalid store": WH/solution/main.ts:119, 131-132
- mode 0o600: WH/solution/main.ts:121
- recurrence < 1 skipped: L46/c:88-89
- fingerprint hexdigest()[:12]: L46/c:72
- severity range(1, 6), frequency positive: L54/c:48

## Errors and fixes (troubleshooting, 8)
- has no repository evidence: L44/c:31
- has no proof command: L44/c:33
- dependency cycle among: L44/c:59. Hidden product disagreement: L44/d:113
- overlap at, conflicts: L45/c:28-35. docs unit owns app/: L45/d:92
- insufficient independent sessions: WH/solution/main.ts:92-93
- exact current rule digest required: WH/solution/cli.ts:51, new source changes digest: WH/stages/03-policy/docs/en.md:17
- credential-like content: WH/solution/main.ts:39-40, redact before ingestion: WH/stages/01-corrections/docs/en.md:5
- conflicting correction id: WH/solution/main.ts:53-55, WH/stages/02-consolidate/docs/en.md:27

## Questions (qa, 5)
- evidence must be able to change the plan: L44/d:53, 60
- integrator rewriting means wrong decomposition: L45/d:73
- repeated hook delivery is not independent evidence: WH/stages/02-consolidate/docs/en.md:5, 17
- promote only when recurrence or consequence justifies: L46/d:67
- human owns public behavior, agents own bounded work: L45/d:77

## Tips (tips, 5)
- cause vs symptom, "The agent edited README": L46/d:71
- focused test stronger than a paragraph: L46/d:36
- owner, verification, retirement condition: L54/d:58-63
- retirement needs evidence, not age: L54/d:76
- keep the exact case of API_KEY: WH/README.md:5
