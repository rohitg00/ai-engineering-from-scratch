# Evidence: cheatsheets/multi-agent-case-studies.md

Abbreviations: C = phases/16-multi-agent-and-swarms/25-case-studies-2026-sota, T = phases/19-capstone-projects/10-multi-agent-software-team, F = projects/distributed-eval-farm. d = docs/en.md, c = code/main.py, S = F/solution.

## Three reference cases (comparison, 7 rows)
- Topology supervisor-worker, SOP roles, population substrate: C/c:25, 32, 39, C/d:3
- +90.2%, MacNet >1000 via DAGs, ~2.3M accounts: C/d:22, 44, 61
- 15x tokens, per-role budget, per-interaction pricing: C/d:102
- Fresh-context subagents, structured artifact handoffs, prompt-injection threat model: C/c:26, 33, 41
- Verifier, QA Engineer, in-network validators: C/d:100
- Frameworks: C/c:28, 35, 42
- Pick for: C/d:107-109

## Common patterns (concepts, 7)
- Orchestrator + workers: C/d:98
- Handoff contracts follow a schema: C/d:49, 99
- Verification first-class: C/d:100
- Topology + substrate: C/d:101
- 1 agent 3-10 tool calls, 10+ subagents: C/d:29
- Rainbow deploy: C/d:31, 159
- Untrusted agent profiles and messages: C/d:75

## Map a design to a case (annotated-code, 9 lines)
- map_to_case population or user_facing_network: C/c:58-60
- engineering or roles_distinct: C/c:61-62
- research and default return anthropic_research: C/c:63-67
- print_case(case_key): C/c:70-77, 107-108
- print_landscape() over FRAMEWORK_LANDSCAPE: C/c:47, 80-86, 110

## Software team build steps (flow, 8 steps)
1. Task board JSONL typed messages, subscribe to tags: T/d:73
2. Architect plan_request with DAG, explicit interfaces: T/d:75
3. Coders git worktree add per subtask: T/d:77
4. Three-way merge into staging branch: T/d:79
5. Reviewer cannot approve own diffs, review_feedback: T/d:81
6. Tester clean sandbox, failures loop back: T/d:83
7. Span per role-boundary message with payload size and model: T/d:85
8. Handoff-failure histogram: T/d:89

## Eval farm architecture (architecture, 8 nodes, 7 edges)
- cases.json with id, prompt, expected, response: F/README.md:40, F/API.md:7
- Partition FNV-1a: F/API.md:27, F/stages/01-partition-stable-case-identities/docs/en.md:17
- farm.json under ledger.lock: F/API.md:25, F/stages/02-fence-each-shard-lease/docs/en.md:19
- run with Parallel pool, bounded waves: F/API.md:17, 27
- ClaimShard lock, load, acquire, persist: F/API.md:27
- WorkShard exact match outside the lock: F/API.md:27
- CompleteShard reload and Submit while locked: F/API.md:27
- Report coverage and receipts: F/API.md:17, 29
- InitFarm edge: F/API.md:27

## Eval farm commands (command-table, 8)
- go build -o /tmp/eval-farm . in solution: F/README.md:32-33
- init: F/API.md:15
- run: F/API.md:17
- worker: F/API.md:16
- status: F/API.md:18
- demo: F/API.md:19
- --crash-after-claim exit 86: F/API.md:23
- --all --solution --strict: F/README.md:68

## Eval farm contracts (task-table, 7)
- Partition(ids []string, shards int): S/stage1.go:5
- h := fnv.New32a(): S/stage1.go:19
- Acquire(l, worker, now, ttl): S/stage2.go:5
- Submit(l, worker, version, now, result): S/stage3.go:3
- Parallel(ctx, ids, workers, run): S/stage4.go:9
- Lease fields: S/types.go:9-16
- ErrInvalid, ErrConflict, ErrLimit: S/types.go:5-7

## Lease and receipt rules (annotated-code, 10 lines)
- Done or live lease conflict: S/stage2.go:9-10
- l.Until = now + ttl, l.Version++: S/stage2.go:13-14
- owner and version first: S/stage3.go:7
- same result on a done lease: S/stage3.go:10-13
- expiry on first completion: S/stage3.go:16

## Defaults and limits (defaults, 8)
- --shards 4, 1..1024: S/main.go:26, F/API.md:21
- --workers 2, 1..64: S/main.go:27, F/API.md:21
- --lease-ms 30000: S/main.go:30, F/API.md:23
- --now-ms -1 wall clock: S/main.go:29, F/API.md:23
- --delay-ms 0, 0..60000: S/main.go:31, F/API.md:23
- --store farm-data: S/main.go:24
- 4 MiB whole-run snapshot: F/README.md:73
- 1 MiB result: F/stages/03-accept-idempotent-completion-receipts/docs/en.md:19

## Failure modes (troubleshooting, 8)
- Exit 86, recovery at expiry: F/README.md:56, F/API.md:31
- Exit 1 complete:false, run again after expiry: F/API.md:31, F/README.md:75
- Fencing error, snapshot unchanged: F/stages/04-run-a-bounded-local-worker-pool/docs/en.md:23
- Changed dataset exits 1, different store: F/API.md:31, F/stages/01-partition-stable-case-identities/docs/en.md:21
- Plan too vague, explicit interfaces: T/d:75, 89
- Reviewer false-approve, injected-bug probe: T/d:89, 124
- Prompt injection propagates: C/d:69, 75
- Hallucinate without verifier, 20-30% of tokens: C/d:32, 137

## Numbers to remember (concepts, 6)
- 80% BrowseComp variance: C/d:23
- MAST 41-86.7%: C/d:118
- 247k stars in ~4 months: C/d:77
- 50 SWE-bench Pro issues vs one Sonnet 4.7: T/d:87
- Rubric weights: T/d:115-119
- Sample 3/4, two waves four processes: F/README.md:40, 42

## Questions (qa, 5)
- Fresh context window: C/d:23, 107
- SWE-bench Pro, Verified contaminated: C/d:136
- Wins per dollar: T/d:23
- old/v1 fails after new/v2: F/stages/03-accept-idempotent-completion-receipts/docs/en.md:17
- Recovery at 109 pending, exit 1: F/README.md:56
