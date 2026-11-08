# Evidence: cheatsheets/llm-evaluation.md

Abbreviations: P10 = phases/10-llms-from-scratch/10-evaluation, P11 = phases/11-llm-engineering/10-evaluation, P05E = phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks, P05L = phases/05-nlp-foundations-to-advanced/28-long-context-evaluation, L27 = phases/19-capstone-projects/27-eval-harness-fixture-tasks, L41 = phases/19-capstone-projects/41-eval-pipeline, L49 = phases/19-capstone-projects/49-lm-eval-harness, L70 = phases/19-capstone-projects/70-task-spec-format, L71 = phases/19-capstone-projects/71-classical-metrics, L72 = phases/19-capstone-projects/72-code-exec-metric, L73 = phases/19-capstone-projects/73-perplexity-calibration, L74 = phases/19-capstone-projects/74-leaderboard-aggregation, L75 = phases/19-capstone-projects/75-end-to-end-eval-runner, d = docs/en.md, c = code/main.py.

## Architecture: End-to-end eval runner (8 nodes, 9 edges)
- tasks.jsonl, validate: L75/d:26, L70/c:192
- ModelAdapter generate(prompt, task): L75/d:50-53, L75/c:56-59
- post_process: L75/d:29, L70/c:241
- score, metric_name dispatch: L75/d:30-31, L71/c:146
- run_candidate subprocess, 3 s: L75/d:32, L72/c:30, 151
- EvalRun per (model, task): L75/d:33, L74/d:36
- CalibrationReport ece, brier: L75/d:35-36, L73/c:189-199
- aggregate, JSON + markdown: L75/d:37-39, L74/c:169, 241, 254
- adapter confidence edge: L75/d:35, L75/c:49-53

## Flow: Score one task (7 steps)
1. render few-shot then prompt, blank line: L75/d:75, L70/d:90-99
2. adapter call, timed, text and confidence: L75/d:76, 58-59
3. post_process per task rule: L75/d:77, L70/d:63
4. dispatch, score or run_candidate: L75/d:78, 30-32
5. EvalRun record: L75/d:79
6. (confidence, correct) to calibration buffer: L75/d:80, L75/c:171-172
7. correct = score >= 1.0 for exact_match, accuracy, code_exec, >= 0.5 graded: L75/d:82, L75/c:99-102

## Pick and run a metric (task-table, 8)
- arithmetic exact_match, strip_whitespace: L70/c:25-35, L70/d:42
- mcq exact_match, extract_letter: L70/c:36, L70/d:53, 108
- code_exec, extract_code_block: L70/c:37, L70/d:109
- summary rouge_l or bleu_4: L70/c:39
- wilson_confidence_interval(successes, total, z=1.96): P11/code/eval_framework.py:183
- ELOTracker(k=32, initial_rating=1500): P10/d:215-216
- build_haystack(filler_text, needle, depth_ratio, total_tokens): P05L/d:60
- lm_eval --model hf --model_args pretrained=... --tasks mmlu: P10/d:426

## Harness API (annotated-code, 9 lines)
- validate_file returns validated, errors. Runner refuses with errors: L70/c:192-194, L70/d:86
- score(metric_name, prediction, targets), best F1 over targets: L71/c:146, L71/d:65, 123
- score_code_exec(prediction, assertions, timeout_s=DEFAULT_TIMEOUT_S), passed / total: L72/c:246, L72/d:41
- pass_at_k(n, c, k), unbiased estimator: L72/c:253, L72/d:80
- CalibrationReport.from_predictions(confidences, correct, bins=10), ece, brier, populated_bins: L73/c:189-199
- perplexity(neg_log_probs, token_counts), exp(total nll / tokens): L73/c:53, L73/d:29-32
- aggregate(runs, b=500, alpha=0.05): L74/c:169-173. Mean, CI, win rate: L74/d:54
- render_markdown(rows), paste into a PR: L74/c:241, L75/d:104

## Post-process rules (command-table, 6)
- none returns the string unchanged: L70/d:105, L70/c:26
- strip_whitespace: L70/d:106, L70/c:27
- lower: L70/d:107, L70/c:28
- extract_letter [A-E], for MCQ: L70/d:108, L70/c:29
- extract_code_block, for code: L70/d:109, L70/c:30
- extract_first_line, for summary classes: L70/d:110, L70/c:31

## Key formulas (concepts, 8)
- Perplexity: P10/d:71
- Token F1: L71/d:51, 59-61
- BLEU-4 geometric mean of p_1..p_4 with BP: L71/d:71, 85
- Brevity penalty: L71/d:82
- ROUGE-L recall and precision from LCS, F1: L71/d:93
- pass@k formula: L72/d:83
- ECE weighted gaps: L73/d:39-47
- Brier mean((p_i - y_i)^2), penalizes spread: L73/d:56-58

## Sample size and confidence (command-table, 5)
- 50 cases, 19 points, cannot detect a 5% regression: P11/d:162
- 100 cases, 12 points, barely: P11/d:163
- 200 cases, 9 points, yes: P11/d:164
- 500 cases, 5 points, confidently: P11/d:165
- 1000 cases, 3 points, precisely: P11/d:166

## Defaults in the code (defaults, 8)
- DEFAULT_TIMEOUT_S 3.0, MAX_TIMEOUT_S 30.0: L72/c:30-31
- OUTPUT_CAP_BYTES 256 * 1024, "output overflow": L72/c:32, L72/d:76
- FEW_SHOT_MAX 8: L70/c:42, L70/d:61
- ECE bins 10, 15 comparison convention: L73/c:189, L73/d:50
- bootstrap b 500, helpers 1000: L74/c:102, 171, L74/d:102
- alpha 0.05: L74/c:172, L74/d:102
- max_workers 8: L75/c:141, L75/d:67
- ELO k 32, initial 1500: P10/d:216

## Troubleshooting (troubleshooting, 8)
- perplexity below 1, log p vs -log p: L73/d:35
- padding in denominator: L41/d:47
- bad JSON NaN dropped: P05E/d:37
- self-evaluation inflates 10-20%: P05E/d:173
- positional bias, randomize and run both: P05E/d:174
- mean 0.85 hides 5% catastrophic, bottom quantile: P05E/d:175
- NIAH-only, add RULER or multi-hop: P05L/d:133
- score in [0, 100] dominates mean: L74/d:58

## Abbreviations (glossary, 8)
- EM 1.0 or 0.0 per task: L71/d:47, P05E/d:14
- ECE: L73/d:39
- MMLU 15,908 questions, 57 subjects: P10/d:503
- HumanEval 164 problems: P10/d:504
- SWE-bench 2,294 issues, 12 repos: P10/d:505
- NIAH: P05L/d:26, 189
- MRCR 8, 24, 100 needles: P05L/d:32
- RAGAS four metrics: P05E/d:20

## Questions (qa, 5)
- 200 cases for decisions, 500+ for close systems: P11/d:168
- pass@k hides once-in-twenty: L27/d:90-92
- paired bootstrap interval excludes zero: L74/d:100
- Spearman rho 0.7: P05E/d:51
- reasoning-effective 25-50% of advertised: P05L/d:47

## Tips (tips, 6)
- anchored rubric cuts variance 30-40%: P11/d:104
- freeze judge model and version: P05E/d:38
- pin task files by hash: L49/d:166
- diff predictions, --include-per-example: L49/d:132, 167, L49/c:478
- keep eval data separate from prompt and training: P11/d:199
- depths 0, 0.25, 0.5, 0.75, 1.0: P05L/d:134
