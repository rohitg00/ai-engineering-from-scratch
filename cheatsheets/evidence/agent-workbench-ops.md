# Evidence: cheatsheets/agent-workbench-ops.md

Abbreviations: L34 = phases/14-agent-engineering/34-repo-memory-and-state, L35 = phases/14-agent-engineering/35-initialization-scripts, L40 = phases/14-agent-engineering/40-multi-session-handoff, L41 = phases/14-agent-engineering/41-workbench-for-real-repos, L43 = phases/14-agent-engineering/43-frame-the-task-before-code. d = docs/en.md, c = code/main.py.

## One workbench session (flow, 8 steps)
1. Frame goal, facts, paths, acceptance, unknowns before editing: L43/d:12-14, 27-36, 103-110
2. Run init script, fail loud and halt: L41/d:57, L35/d:32, 49
3. Read scope contract and state: L41/d:58-59
4. Edit allowed files only: L41/d:60
5. Acceptance via feedback runner: L41/d:61
6. Verification gate, then reviewer: L41/d:62-63
7. clean_state.json empty list is the precondition: L40/d:65, 75
8. Generate handoff.md and handoff.json: L41/d:64, L40/d:31, 55

## Commands (command-table, 8 rows)
- python3 code/main.py, files next to the script: L34/d:83, L40/d:88, 93, L41/d:82, 87, L43/d:90, 95
- Lesson 34 writes workdir/agent_state.json and workdir/task_board.json: L34/d:86
- --no-cache ignores prereqs.lock: L35/c:190
- --write-lkg pins HEAD as last-known-good: L35/c:191
- git diff --name-only baseline HEAD: L35/c:126
- Lesson 40 writes handoff.md and handoff.json: L40/d:88, 96
- python3 -m unittest discover code/tests -v: L43/d:96
- python3 -m unittest tests.test_accounts: L43/c:70

## Schema-first state (annotated-code, 9 lines)
- required keys: L34/c:27
- active_task_id type and pattern: L34/c:30
- status enum todo, in_progress, done, blocked: L34/c:50
- StateManager(state_path, STATE_SCHEMA): L34/c:138
- load reads then validates: L34/c:118-121
- commit validates then atomic_write: L34/c:123-125
- tempfile.mkstemp in target dir: L34/c:101
- os.fsync: L34/c:106
- os.replace atomic rename: L34/c:107, L34/d:92

## Init probes (concepts, 8)
- probe_runtime vs REQUIRED_PYTHON: L35/c:66-70
- probe_dependencies with importlib.util.find_spec: L35/c:74-78
- probe_test_command with shutil.which: L35/c:82-85
- probe_env missing env vars: L35/c:89-93
- probe_state_freshness warn when absent or old: L35/c:97-104
- probe_lkg_diff fail above budget: L35/c:108, 134-135
- probe returns (name, status, detail): L35/d:68, 115
- init_report.json, exit 1 on fail: L35/c:216, 222-224

## Defaults and numbers (defaults, 8)
- REQUIRED_PYTHON (3, 10): L35/c:32
- STATE_FRESHNESS_SECONDS 24 * 60 * 60, warn when older: L35/c:36, 101-103
- LOCK_TTL_SECONDS 24 * 60 * 60, skip probes when fresh: L35/c:37, 206-208
- PROBE_BUDGET_SECONDS 3.0, slow pass becomes warn: L35/c:38, 58-60
- LKG_FILE_DIFF_BUDGET 50: L35/c:39, 134
- schema_version enum [1]: L34/c:29
- TAIL_K 5: L40/c:16, 43
- review total below 7 adds warn risk: L40/c:68-69

## Seven handoff fields (concepts, 8)
- summary, one paragraph of what was done: L40/d:39, L40/c:32
- changed_files, the diff at a glance: L40/d:40, L40/c:33
- commands_run, what was actually executed: L40/d:41, L40/c:34
- failed_attempts, what was tried and why it failed: L40/d:42, L40/c:35
- open_risks, what can bite next session with severity: L40/d:43, L40/c:36
- next_action is the load-bearing field: L40/d:44, 47
- verdict_pointer outputs/verification/<task_id>.json and review: L40/d:45, L40/c:87-90
- feedback_tail, last K plus nonzero exits: L40/c:39, 42-53, L40/d:59

## Prompt-only versus workbench (comparison, 6 rows)
- tests_actually_run False / True: L41/c:57, 70
- acceptance_met False / True: L41/c:58, 71
- files_outside_scope 2 / 0: L41/c:48, 54, 59, 67, 72
- handoff_quality missing / full packet: L41/c:60, 73
- reviewer_total 3 / 9: L41/c:61, 74
- steps: read, edit, claim done vs 8 steps: L41/d:50-64

## Task frame (annotated-code, 11 lines)
- TaskFrame example goal, allowed_paths, forbidden_paths, acceptance: L43/c:65-70
- RepositoryFact with a receipt for line 44 of tests/test_accounts.py: L43/c:73, L43/d:38
- unknowns case-insensitive: L43/c:75
- validate returns issues, empty means READY: L43/c:27-43, 48
- render Status READY or BLOCKED: L43/c:46-49

## Classify each unknown (concepts, 4)
- Discoverable, the repository or running system can answer it: L43/d:69
- Decidable, the task contract gives the agent authority: L43/d:70
- Human, changes product behavior, cost, risk or public compatibility: L43/d:71
- Deferred, outside this slice, goes in non-goals: L43/d:72
- continue through discoverable and delegated, pause at human: L43/d:74

## Troubleshooting (troubleshooting, 8)
- next session redoes work, repo memory fix: L34/d:19-21
- write_text() with silenced exceptions, mkstemp, fsync, os.replace: L34/d:92
- T-bogus rejected by pattern: L34/c:30, 82, 170-175. T-001 id: L34/c:151
- init failed; refuse to launch agent: L35/c:222-224, L35/d:49
- lkg_diff above 50 files, human ratifies baseline: L35/d:83, L35/c:134-135, --write-lkg: L35/c:191
- slow probe becomes warn, 3 second smell: L35/c:58-60, L35/d:87
- no next_action recorded; needs human: L40/c:74
- Status BLOCKED with Blocking issues: L43/c:48, 59-61

## Questions (qa, 6)
- three months from now in a CI rerun: L34/d:45
- second init run is a no-op except timestamp: L35/d:53
- handoff without next_action is a status report: L40/d:47
- JSON wins when they diverge: L40/d:55
- stop reconnaissance when each decision is supported, delegated, or unknown: L43/d:61
- wrap up at 50-75% context, not 95%: L40/d:108

## Tips (tips, 6)
- large artifacts out of agent_state.json, keep the path: L34/d:96
- pending_calls.jsonl before execution: L34/d:94
- state.events.jsonl and snapshot to state.json: L34/d:98
- one active handoff per branch and topic: L40/d:106
- facts need receipts, file path and line: L43/d:38
- no network, no LLM in init: L35/d:87
