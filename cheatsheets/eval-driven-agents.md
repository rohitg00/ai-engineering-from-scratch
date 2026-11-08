---
id: eval-driven-agents
title: Eval-Driven Agent Development
code: ED
subtitle: Run eval cases, gate merges, review with a rubric, and gate prompt and report changes. Python stdlib.
hue: 140
sources: phases/14-agent-engineering/30-eval-driven-agent-development, phases/14-agent-engineering/38-verification-gates, phases/14-agent-engineering/39-reviewer-agent, projects/prompt-regression-tester, projects/report-judge
source_hash: 59650a4ecbe2d8fb
---

## Builder to sign-off
type: architecture
from: phases/14-agent-engineering/38-verification-gates/docs/en.md, phases/14-agent-engineering/39-reviewer-agent/docs/en.md

```arch
node | builder | 1,1 | Builder Agent | writes the diff | model
node | arts | 2,1 | Artifacts | diff, scope, rules, feedback | store
node | gate | 3,1 | Verification gate | deterministic, no LLM | process
node | report | 4,1 | verification_report.json | passed true or false | store
node | refuse | 4,2 | Refuse done | surface to human | client
node | rev | 3,2 | Reviewer Agent | read only, rubric | model
node | human | 2,2 | Human sign-off | reads review_report.json | client
edge | builder | arts |
edge | arts | gate |
edge | gate | report |
edge | report | refuse | no
edge | report | rev | yes
edge | rev | human |
```

## Three evaluation layers
type: comparison
from: phases/14-agent-engineering/30-eval-driven-agent-development/docs/en.md

| Factor | Static benchmarks | Custom offline | Online |
|---|---|---|---|
| Examples | SWE-bench Verified, GAIA, BFCL V4 | LLM-as-judge, execution, trajectory | Session replays, guardrail alerts |
| Use for | Cross-model comparison | Your product shape | Production behavior |
| Measures | Broad capability | Right patches for your product | Per-step cost and latency |
| Watch for | Contamination, 32.67% leakage | Judges hallucinate too | Tie each failure to a new case |

## Evaluator-optimizer loop
type: flow
from: phases/14-agent-engineering/30-eval-driven-agent-development/code/main.py, phases/14-agent-engineering/30-eval-driven-agent-development/docs/en.md

1. **Proposer**: `case.proposer(feedback)` gives a candidate.
2. **Judge**: `case.judge(candidate)` returns ok and a reason.
3. **Refine**: the reason becomes the next feedback.
4. **Stop**: after `max_rounds` the case fails.
5. **CI gate**: `ci_gate` blocks a regression above the threshold.

## Run the lessons and projects
type: command-table
span: 2
from: phases/14-agent-engineering/30-eval-driven-agent-development/docs/en.md, phases/14-agent-engineering/38-verification-gates/code/main.py, projects/prompt-regression-tester/README.md, projects/prompt-regression-tester/solution/cli.py, projects/report-judge/README.md, projects/report-judge/solution/cli.py

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs the lesson demo. Lessons 38 and 39 write JSON reports |
| `VERIFY_DEMO_MODE=1 python3 code/main.py --strict` | Gate demo with the demo secret. Every warn becomes a block |
| `python3 code/main.py --floor <value>` | Gate demo with a different coverage floor |
| `python3 scripts/project_test.py <project> --init learning-artifacts/<project>` | Makes a learner workspace |
| `python3 scripts/project_test.py <project> --stage <n> --path learning-artifacts/<project>` | Tests one stage of your workspace |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Checks the reference solution |
| `python3 <dir>/cli.py <cases> <baseline> <candidate> --out <json> --markdown <md>` | Prompt diff. Add `--allow-configuration-change` for a model change |
| `python3 <dir>/cli.py <claims> --out <json> --html <html>` | Report audit. Add `--research-payload` for a report payload |

## Gate one task
type: annotated-code
lang: python
from: phases/14-agent-engineering/38-verification-gates/code/main.py

```python
art = Artifacts(task_id="T-001",
    acceptance_commands=accept,              # zero exit means done
    feedback=[{"command": accept[0], "exit_code": 0}],
    scope_report={"forbidden_writes": [], "off_scope_writes": []},
    rule_report=[{"slug": "done/tests-pass", "passed": True}],
    coverage_report={"current": 0.84, "previous": 0.85},
    head_commit="a1b2c3d")
report = verify(art, strict=False, coverage_floor=0.80)
report.passed                                # False on any block finding
record_override(task_id, finding_code, reason, user_id, head_commit)
verify_signature(entry)                      # HMAC check of the override
```

## Reviewer rubric
type: concepts
from: phases/14-agent-engineering/39-reviewer-agent/docs/en.md, phases/14-agent-engineering/39-reviewer-agent/code/main.py

- **Problem fit**: solved the task as stated?
- **Scope discipline**: edits inside the contract?
- **Assumptions**: written down?
- **Verification quality**: acceptance proves the goal?
- **Handoff readiness**: next session can pick up?
- **Scores**: 0 to 2 each, total out of 10.
- **Verdict**: `pass` at 7 or more, else `soft_fail`.
- **`hard_fail`**: total below 5 or any 0.

## Defaults and numbers
type: defaults
from: phases/14-agent-engineering/30-eval-driven-agent-development/code/main.py, phases/14-agent-engineering/38-verification-gates/code/main.py, projects/prompt-regression-tester/solution/main.py, projects/report-judge/solution/support.py, projects/report-judge/solution/compare.py, projects/report-judge/solution/metrics.py

| Setting | Default | Note |
|---|---|---|
| `max_rounds` | 3 | Evaluator-optimizer rounds per case |
| `regression_threshold` | 0.05 | `ci_gate` blocks above it |
| `COVERAGE_FLOOR_DEFAULT` | 0.80 | Below it is a block |
| `COVERAGE_REGRESSION_DELTA` | 0.01 | Larger drop than the last merge blocks |
| `release_gate` `min_pass` | 1.0 | Pass fraction in [0,1] |
| `release_gate` `max_regressions` | 0 | Integer regression budget |
| `judge_claim` `threshold` | 0.8 | Overlap score to count as supported |
| `compare` `samples` | 2000 | Bootstrap resamples, `seed=7` |

## Prompt Regression Tester
type: task-table
from: projects/prompt-regression-tester/solution/main.py, projects/prompt-regression-tester/solution/cli.py, projects/prompt-regression-tester/stages/03-pair-revisions/docs/en.md

| Task | Code |
|---|---|
| Unique ids, known check kinds | `validate_cases(cases)` |
| Check kinds | `contains`, `excludes`, `json` |
| Score one recorded response | `score_response(response, checks)` |
| Pair revisions by case id | `compare(cases, baseline, candidate)` |
| Pair states | `stable_pass`, `regressed`, `improved` |
| Ship or block | `release_gate(report)` |
| Bind recording to cases | `case_sha256 == case_digest(cases)` |
| Load a provenance-bound run | `load_run(raw, cases)` |

## Report Judge
type: task-table
from: projects/report-judge/solution/claims.py, projects/report-judge/solution/support.py, projects/report-judge/solution/metrics.py, projects/report-judge/solution/compare.py

| Task | Code |
|---|---|
| One claim per sentence | `parse_claims(text)` |
| Lexical support of one claim | `support(claim, source)` |
| Judge cites against evidence | `judge_claim(claim, evidence)` |
| Reasons for a zero score | `negation`, `number`, `uncited` |
| Precision, recall, coverage | `score_report(text, evidence)` |
| Score weights | `precision` 0.5, `recall` 0.25 |
| States | `no_evidence`, `needs_review` |
| Paired bootstrap | `compare(baseline, candidate)` |

## Troubleshooting
type: troubleshooting
span: 2
from: phases/14-agent-engineering/30-eval-driven-agent-development/docs/en.md, phases/14-agent-engineering/38-verification-gates/code/main.py, phases/14-agent-engineering/38-verification-gates/docs/en.md, projects/prompt-regression-tester/solution/cli.py, projects/prompt-regression-tester/stages/02-score-recordings/docs/en.md, projects/report-judge/stages/02-support/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Eval scores are unreadable | No baseline | Store a last-known-good baseline |
| Judge passes wrong output | LLM judge without grounding | Ground the judge on external tools |
| Evals pass, production fails | Over-fitting to evals | Rotate cases |
| False alarms in CI | Flaky, non-deterministic cases | Pin seeds, snapshot state |
| `refused to start: VERIFY_OVERRIDE_SECRET is unset` | No override secret | Set the env var, or `VERIFY_DEMO_MODE=1` for the demo |
| `recording does not match cases` | Case list changed after recording | Make new recordings |
| `model/settings changed; explicitly allow this experiment` | Baseline and candidate configs differ | Pass `--allow-configuration-change` |
| `order_requires_review` on a true claim | Lexical rule rejects a paraphrase | A human reviews the claim |

## Questions
type: qa
from: phases/14-agent-engineering/38-verification-gates/docs/en.md, phases/14-agent-engineering/39-reviewer-agent/docs/en.md, projects/prompt-regression-tester/stages/03-pair-revisions/docs/en.md, projects/prompt-regression-tester/stages/04-gate-releases/docs/en.md, projects/report-judge/stages/03-metrics/docs/en.md

- **Why no LLM in the gate?** The gate gives the same verdict for the same artifacts every time.
- **Who overrides a block?** Only a human, with `override_reason` and `overridden_by`.
- **Why a separate reviewer?** Role separation: different prompt, different inputs, no write access.
- **Why pair cases by id?** An average can hide a serious regression.
- **Why is recall null?** Recall and coverage need labels. Without labels they are unavailable.

## Tips
type: tips
from: phases/14-agent-engineering/30-eval-driven-agent-development/docs/en.md, phases/14-agent-engineering/38-verification-gates/docs/en.md, phases/14-agent-engineering/39-reviewer-agent/docs/en.md

- Keep evals next to code. Run them in CI on every PR.
- Map every guardrail and every learned rule to an eval case.
- Write one report per task to `outputs/verification/<task_id>.json`.
- Use `--strict` on release branches only. It is not the global default.
- Run the reviewer on a 10-20 task calibration set after each prompt change.
- Below 80% agreement, revise the rubric before the reviewer ships.

## Gate finding codes
type: concepts
from: phases/14-agent-engineering/38-verification-gates/code/main.py

- **`acceptance.missing`**: block. A command never ran.
- **`acceptance.failed`**: block. Nonzero exit.
- **`feedback.null_exit`**: block. No exit code.
- **`scope.forbidden`**: block. **`scope.off_scope`**: warn.
- **`coverage.below_floor`**: block. **`coverage.missing`**: warn.
