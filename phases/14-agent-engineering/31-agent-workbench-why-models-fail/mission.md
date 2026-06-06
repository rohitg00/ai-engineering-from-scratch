# Mission - Agent Workbench: Why Capable Models Still Fail

## Goal
Run the same small repo task twice, once prompt-only and once with the seven workbench surfaces wired in, and emit a failure-mode report that maps each missed surface to the symptom it caused.

## Inputs
- A stub agent and a tiny FastAPI-style handler to validate
- The seven-surface list (instructions, state, scope, feedback, verification, review, handoff)

## Deliverables
- `code/main.py` that runs both pipelines back to back
- `failure_modes.json` summarizing the prompt-only run
- One-line verdict for the workbench run

## Acceptance
- `python3 code/main.py` exits zero
- Output shows a side-by-side log of the two runs
- `failure_modes.json` lists every missed surface with the matching symptom

## Out of scope
- Calling a real model. The stub is rule-based on purpose.
- Building any one surface in depth. That is what the next eleven lessons are for.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-workbench-audit.md` - extracted skill
