# Evidence: cheatsheets/eval-driven-agents.md

Abbreviations: L30 = phases/14-agent-engineering/30-eval-driven-agent-development, L38 = phases/14-agent-engineering/38-verification-gates, L39 = phases/14-agent-engineering/39-reviewer-agent, PRT = projects/prompt-regression-tester, RJ = projects/report-judge. d = docs/en.md, c = code/main.py.

## Builder to sign-off (architecture, 7 nodes, 6 edges)
- Builder Agent writes the diff: L39/d:19, 27
- Artifacts diff, scope, rules, feedback: L38/d:31-34
- Verification gate, deterministic, no LLM judges: L38/d:31, 55-57
- verification_report.json, passed true or false: L38/d:35-36
- Refuse done, surface to human (no edge): L38/d:38
- Reviewer Agent on yes edge: L38/d:37, read-only access: L39/d:3, rubric: L39/d:29
- Human sign-off reads review_report.json: L39/d:30-31

## Three evaluation layers (comparison, 4 rows)
- Examples: SWE-bench Verified, GAIA, BFCL V4: L30/d:25. LLM-as-judge, execution, trajectory: L30/d:28-30. Session replays, guardrail alerts: L30/d:33-34
- Use for: cross-model comparison: L30/d:25. Product shape: L30/d:27. Production: L30/d:32
- Measures: broad capability and right patches for your product: L30/d:19. Per-step cost / latency: L30/d:35
- Watch for: contamination, 32.67% leakage: L30/d:25. Judges hallucinate too: L30/d:85. Tie every production failure to a new case: L30/d:116

## Evaluator-optimizer loop (flow, 5 steps)
1. case.proposer(feedback): L30/c:37
2. case.judge(candidate) returns ok, reason: L30/c:38, 19
3. reason becomes feedback: L30/c:41, refine until pass: L30/d:43
4. fails after max_rounds: L30/c:42-43
5. ci_gate blocks when regression > regression_threshold: L30/c:46-54

## Run the lessons and projects (command-table, 8 rows)
- python3 code/main.py: L30/d:105, L38/d:83, L39/d:76. Lessons 38 and 39 write JSON reports: L38/c:238-243, L39/c:128-135
- VERIFY_DEMO_MODE=1 and --strict: L38/c:33, 40, 202
- --floor: L38/c:203
- project_test.py --init learning-artifacts/<project>: PRT/README.md:14, RJ/README.md:14
- --stage <n> --path: PRT/README.md:15, RJ/README.md:15
- --all --solution --strict: PRT/README.md:40, RJ/README.md:40
- cli.py cases baseline candidate --out --markdown: PRT/README.md:30. --allow-configuration-change: PRT/solution/cli.py:66
- cli.py claims --out --html: RJ/README.md:30. --research-payload: RJ/solution/cli.py:96

## Gate one task (annotated-code, 11 lines)
- Artifacts T-001 fields, accept list, feedback, scope_report, rule_report, coverage_report, head_commit: L38/c:206-216
- acceptance command zero exit means done: L38/d:131
- verify(art, strict=..., coverage_floor=...): L38/c:143-147, 237. Default floor 0.80: L38/c:26
- passed is False on any block finding: L38/c:158-161, L38/d:53
- record_override(task_id, finding_code, reason, user_id, head_commit): L38/c:174-176
- verify_signature(entry) with HMAC: L38/c:194-197, 171

## Reviewer rubric (concepts, 8)
- Problem fit: L39/d:40
- Scope discipline: L39/d:41
- Assumptions: L39/d:42
- Verification quality: L39/d:43
- Handoff readiness: L39/d:44
- Scores 0 to 2, total out of 10: L39/d:36, 46
- pass at 7 or more, else soft_fail: L39/c:97-100
- hard_fail below 5 or any dimension 0: L39/c:94-96, L39/d:123

## Defaults and numbers (defaults, 8)
- max_rounds 3: L30/c:20
- regression_threshold 0.05: L30/c:47, 52
- COVERAGE_FLOOR_DEFAULT 0.80: L38/c:26, 128-130
- COVERAGE_REGRESSION_DELTA 0.01: L38/c:27, 132-136
- release_gate min_pass 1.0, range [0,1]: PRT/solution/main.py:84, 90
- release_gate max_regressions 0, integer: PRT/solution/main.py:84, 91-92
- judge_claim threshold 0.8: RJ/solution/support.py:38, 49
- compare samples 2000, seed=7: RJ/solution/compare.py:11

## Prompt Regression Tester (task-table, 8)
- validate_cases(cases), unique id: PRT/solution/main.py:5-14
- check kinds contains, excludes, json: PRT/solution/main.py:23
- score_response(response, checks): PRT/solution/main.py:34
- compare(cases, baseline, candidate): PRT/solution/main.py:61
- states stable_pass, regressed, improved: PRT/solution/main.py:68-74, PRT/stages/03-pair-revisions/docs/en.md:5
- release_gate(report) ship or block: PRT/solution/main.py:84, 99
- case_sha256 against case_digest(cases): PRT/solution/cli.py:8, 15
- load_run(raw, cases): PRT/solution/cli.py:14

## Report Judge (task-table, 8)
- parse_claims(text), one claim per sentence: RJ/solution/claims.py:11, 16
- support(claim, source): RJ/solution/support.py:11
- judge_claim(claim, evidence): RJ/solution/support.py:38
- reasons negation, number, uncited: RJ/solution/support.py:19, 23, 42
- score_report(text, evidence) precision, recall, coverage: RJ/solution/metrics.py:7, 31-33
- weights precision 0.5, recall 0.25: RJ/solution/metrics.py:23
- states no_evidence, needs_review: RJ/solution/metrics.py:36-38
- compare(baseline, candidate) paired bootstrap: RJ/solution/compare.py:11-21

## Troubleshooting (troubleshooting, 8)
- No baseline, store baselines: L30/d:84
- LLM judge without grounding, ground on external tools: L30/d:85
- Over-fitting to evals, rotate cases: L30/d:86
- Flaky evals, pin seeds, snapshot state: L30/d:87
- refused to start, VERIFY_OVERRIDE_SECRET unset, VERIFY_DEMO_MODE=1: L38/c:32-33, 47-49
- recording does not match cases: PRT/solution/cli.py:15-16, new recordings when tested tasks change: PRT/README.md:50
- model/settings changed; explicitly allow this experiment: PRT/solution/cli.py:40-42, flag: PRT/solution/cli.py:66
- order_requires_review rejects paraphrases, human review: RJ/stages/02-support/docs/en.md:24, 30, 35

## Questions (qa, 5)
- gate is deterministic, same verdict every time: L38/d:57
- override only by a human with override_reason and overridden_by: L38/d:65
- role separation: different prompt, inputs, no write access: L39/d:50
- pair cases, an average can hide a regression: PRT/stages/03-pair-revisions/docs/en.md:5
- recall and coverage need labels, else unavailable: RJ/stages/03-metrics/docs/en.md:24

## Tips (tips, 6)
- evals next to code, CI on every PR: L30/d:49-50
- every guardrail and learned rule maps to a case: L30/d:52-53
- one report at outputs/verification/<task_id>.json: L38/d:61
- --strict opt-in by branch, not global default: L38/d:100
- 10-20 task calibration set on every prompt change: L39/d:91
- below 80% agreement revise the rubric: L39/d:91

## Gate finding codes (concepts, 5)
- acceptance.missing block: L38/c:87
- acceptance.failed block: L38/c:93-94
- feedback.null_exit block: L38/c:91
- scope.forbidden block, scope.off_scope warn: L38/c:102, 105
- coverage.below_floor block: L38/c:129. coverage.missing warn: L38/c:123
