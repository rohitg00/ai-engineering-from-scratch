# Mission - Agent Instructions as Executable Constraints

## Goal
Turn prose instructions into machine-checkable rules across five categories and emit a rule report a reviewer can score.

## Inputs
- `docs/agent-rules.md` with one rule per heading, each carrying slug, category, description, and a `check` field
- A demo agent run that intentionally violates two rules

## Deliverables
- Parser that loads `agent-rules.md` into a dataclass
- `rule_checker.py` style functions, one per `check` referenced
- `rule_report.json` with pass/fail per rule and an aggregate severity

## Acceptance
- `python3 code/main.py` exits zero
- Output prints the parsed rule set, the run trace, and pass/fail per rule
- `rule_report.json` catches the two intentional violations

## Out of scope
- Wiring the checker into CI. The lesson exits at a written report.
- Framework guardrails (OpenAI SDK, LangGraph interrupts). The rule set is the human-readable contract those implement.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-rule-set-builder.md` - extracted skill
