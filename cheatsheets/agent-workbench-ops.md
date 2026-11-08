---
id: agent-workbench-ops
title: Repo Memory, Init Scripts and Handoffs
code: RM
subtitle: Frame the task, keep state in schema-checked files, probe before start, and end each session with a handoff packet.
hue: 30
sources: phases/14-agent-engineering/34-repo-memory-and-state, phases/14-agent-engineering/35-initialization-scripts, phases/14-agent-engineering/40-multi-session-handoff, phases/14-agent-engineering/41-workbench-for-real-repos, phases/14-agent-engineering/43-frame-the-task-before-code
source_hash: 02eda89dcde22cea
---

## One workbench session
type: flow
from: phases/14-agent-engineering/41-workbench-for-real-repos/docs/en.md, phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md, phases/14-agent-engineering/35-initialization-scripts/docs/en.md, phases/14-agent-engineering/40-multi-session-handoff/docs/en.md

1. **Frame**: write goal, facts, paths, acceptance and unknowns before any edit.
2. **Init script**: probe the workbench. On a fail, halt and surface to the human.
3. **Read**: load the scope contract and `agent_state.json`.
4. **Edit**: change allowed files only.
5. **Prove**: run the acceptance command through the feedback runner.
6. **Judge**: run the verification gate, then the reviewer.
7. **Clean up**: `clean_state.json` must hold an empty list.
8. **Hand off**: generate `handoff.md` and `handoff.json`.

## Commands
type: command-table
span: 2
from: phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md, phases/14-agent-engineering/35-initialization-scripts/code/main.py, phases/14-agent-engineering/40-multi-session-handoff/docs/en.md, phases/14-agent-engineering/41-workbench-for-real-repos/docs/en.md, phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md, phases/14-agent-engineering/43-frame-the-task-before-code/code/main.py

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs the lesson demo. Each one writes its files next to the script |
| `python3 code/main.py` in lesson 34 | Writes `workdir/agent_state.json` and `workdir/task_board.json` |
| `python3 code/main.py --no-cache` | Lesson 35: ignore `prereqs.lock` and run every probe |
| `python3 code/main.py --write-lkg` | Lesson 35: pin current HEAD as last-known-good |
| `git diff --name-only <baseline> HEAD` | The command behind the `lkg_diff` probe |
| `python3 code/main.py` in lesson 40 | Writes `handoff.md` and `handoff.json` |
| `python3 -m unittest discover code/tests -v` | Lesson 43: tests the task frame validator |
| `python3 -m unittest tests.test_accounts` | Acceptance command of the example frame |

## Schema-first state
type: annotated-code
lang: python
from: phases/14-agent-engineering/34-repo-memory-and-state/code/main.py

```python
"required": ["schema_version", "active_task_id", "touched_files", "next_action"]
"active_task_id": {"type": ["string", "null"], "pattern": r"^(T-\d{3,}|)$"}
"status": {"enum": ["todo", "in_progress", "done", "blocked"]}
mgr = StateManager(state_path, STATE_SCHEMA)
state = mgr.load()                          # read, then validate
mgr.commit(state)                           # validate, then atomic_write
fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
os.fsync(fh.fileno())                       # flush to disk first
os.replace(tmp_name, path)                  # atomic rename
```

## Init probes
type: concepts
from: phases/14-agent-engineering/35-initialization-scripts/code/main.py, phases/14-agent-engineering/35-initialization-scripts/docs/en.md

- **`probe_runtime`**: fails below `REQUIRED_PYTHON`.
- **`probe_dependencies`**: `importlib.util.find_spec` for each dep.
- **`probe_test_command`**: `shutil.which` on the test command.
- **`probe_env`**: fails on a missing env var.
- **`probe_state_freshness`**: warn when the state is old or absent.
- **`probe_lkg_diff`**: fail above the file diff budget.
- **Probe**: returns `(name, status, detail)`.
- **Report**: `init_report.json`. Exit 1 on any fail.

## Defaults and numbers
type: defaults
from: phases/14-agent-engineering/35-initialization-scripts/code/main.py, phases/14-agent-engineering/34-repo-memory-and-state/code/main.py, phases/14-agent-engineering/40-multi-session-handoff/code/main.py

| Setting | Default | Note |
|---|---|---|
| `REQUIRED_PYTHON` | (3, 10) | Runtime probe floor |
| `STATE_FRESHNESS_SECONDS` | 24 * 60 * 60 | Older state gives a warn |
| `LOCK_TTL_SECONDS` | 24 * 60 * 60 | Fresh lock skips the probes |
| `PROBE_BUDGET_SECONDS` | 3.0 | Slower pass becomes warn |
| `LKG_FILE_DIFF_BUDGET` | 50 | More changed files is a fail |
| `schema_version` | 1 | Only allowed enum value |
| `TAIL_K` | 5 | Feedback records kept in the handoff |
| Review total risk | 7 | Below it the handoff adds a warn |

## Seven handoff fields
type: concepts
from: phases/14-agent-engineering/40-multi-session-handoff/docs/en.md, phases/14-agent-engineering/40-multi-session-handoff/code/main.py

- **`summary`**: one paragraph of what was done.
- **`changed_files`**: the diff at a glance.
- **`commands_run`**: what was actually executed.
- **`failed_attempts`**: what was tried and why it failed.
- **`open_risks`**: what can bite next session, with severity.
- **`next_action`**: the first concrete step. The load-bearing field.
- **`verdict_pointer`**: `outputs/verification/<task_id>.json` and the review.
- **`feedback_tail`**: last `TAIL_K` records plus every nonzero exit.

## Prompt-only versus workbench
type: comparison
from: phases/14-agent-engineering/41-workbench-for-real-repos/code/main.py, phases/14-agent-engineering/41-workbench-for-real-repos/docs/en.md

| Outcome | Prompt-only | Workbench-guided |
|---|---|---|
| `tests_actually_run` | False | True |
| `acceptance_met` | False | True |
| `files_outside_scope` | 2 | 0 |
| `handoff_quality` | missing | full packet |
| `reviewer_total` | 3 | 9 |
| Steps | Read, edit, claim done | 8 steps, init to handoff |

## Task frame
type: annotated-code
lang: python
from: phases/14-agent-engineering/43-frame-the-task-before-code/code/main.py, phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md

```python
frame = TaskFrame(
    goal="Prevent duplicate email addresses during signup",
    allowed_paths=["app/accounts.py", "tests/test_accounts.py"],
    forbidden_paths=["migrations/**", "deploy/**"],
    acceptance=["python3 -m unittest tests.test_accounts"],
    facts=[RepositoryFact("Duplicate errors use status 409",
                          "tests/test_accounts.py:44")],  # receipt
    unknowns=["Whether email comparison is case-insensitive"])
issues = validate(frame)          # empty list means READY
render(frame)                     # Markdown, Status: READY or BLOCKED
```

## Classify each unknown
type: concepts
from: phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md

- **Discoverable**: the repository or running system can answer it. Continue.
- **Decidable**: the task contract gives the agent authority. Continue.
- **Human**: changes product behavior, cost, risk or public compatibility. Pause.
- **Deferred**: outside this slice. Put it in non-goals.

## Troubleshooting
type: troubleshooting
span: 2
from: phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md, phases/14-agent-engineering/34-repo-memory-and-state/code/main.py, phases/14-agent-engineering/35-initialization-scripts/docs/en.md, phases/14-agent-engineering/35-initialization-scripts/code/main.py, phases/14-agent-engineering/40-multi-session-handoff/code/main.py, phases/14-agent-engineering/43-frame-the-task-before-code/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| Next session redoes finished work | State lived in chat, not the repo | Keep state in schema-checked JSON in the repo |
| Session resumes on corrupt state | `write_text()` with silenced exceptions | Use `atomic_write`: `mkstemp`, `fsync`, `os.replace` |
| `does not match` on `T-bogus` | Task id breaks the pattern | Use ids like T-001 |
| `init failed; refuse to launch agent` | A probe has status fail | Fix the probe. Do not start the agent |
| `lkg_diff` fail, files changed above budget | More than 50 files since the last-known-good | A human ratifies the baseline with `--write-lkg` |
| Probe pass turns to warn with `slow:` | Probe above the 3 second budget | Move it out of init or cache its result |
| `no next_action recorded; needs human` | State has no `next_action` | Set `next_action` before the handoff |
| Frame `Status: BLOCKED` | `validate` found issues | Fix each line under Blocking issues |

## Questions
type: qa
from: phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md, phases/14-agent-engineering/35-initialization-scripts/docs/en.md, phases/14-agent-engineering/40-multi-session-handoff/docs/en.md, phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md

- **What goes in repo memory?** Data useful three months from now in a CI rerun.
- **Two init runs in a row?** The second is a no-op except a fresh timestamp.
- **Handoff without `next_action`?** It is a status report, not a handoff.
- **`handoff.md` and `handoff.json` differ?** The JSON wins.
- **When to stop reading the repo?** When each decision has evidence, is delegated, or is an unknown.
- **When to wrap up?** At 50-75% of the context budget, not at 95%.

## Tips
type: tips
from: phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md, phases/14-agent-engineering/40-multi-session-handoff/docs/en.md, phases/14-agent-engineering/43-frame-the-task-before-code/docs/en.md, phases/14-agent-engineering/35-initialization-scripts/docs/en.md

- Keep large artifacts out of `agent_state.json`. Store only the path.
- Log each tool call ID to `pending_calls.jsonl` before execution.
- Append each mutation to `state.events.jsonl`. Snapshot to `state.json`.
- Keep one active handoff per branch and topic.
- Give each fact a receipt: a file path and line.
- Init has no network and no LLM calls.
