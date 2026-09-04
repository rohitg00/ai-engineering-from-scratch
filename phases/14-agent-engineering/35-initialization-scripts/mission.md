# Mission - Initialization Scripts for Agents

## Goal
Build `init_agent.py` that probes runtime, dependencies, test command, env vars, and state freshness, then writes `init_report.json` and halts the session loud when a block-severity probe fails.

## Inputs
- A repo with a `requirements.txt` (or equivalent), a test command, and the workbench state file from lesson 34
- The probe table from the lesson (runtime, deps, paths, env, state freshness, last-known-good commit)

## Deliverables
- `init_agent.py` with one function per probe returning `(name, status, detail)`
- `init_report.json` carrying the full probe set and a timestamp
- Non-zero exit on any block-severity probe failure

## Acceptance
- `python3 code/main.py` exits zero on the happy path
- Running it twice in a row is a no-op except for the timestamp
- A simulated missing env var probe surfaces in the report and flips the exit code

## Out of scope
- Auto-installing missing dependencies. The script halts and surfaces; the human fixes.
- Calling an LLM from a probe. Probes stay deterministic plumbing.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-init-script.md` - extracted skill
