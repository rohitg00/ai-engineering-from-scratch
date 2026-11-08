---
id: llm-evaluation
title: Evaluating LLMs
code: EL
subtitle: Specify tasks, score them, judge with a rubric, calibrate, rank with intervals and test long context.
hue: 80
sources: phases/10-llms-from-scratch/10-evaluation, phases/11-llm-engineering/10-evaluation, phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation, phases/19-capstone-projects/27-eval-harness-fixture-tasks, phases/19-capstone-projects/41-eval-pipeline, phases/19-capstone-projects/49-lm-eval-harness, phases/19-capstone-projects/70-task-spec-format, phases/19-capstone-projects/71-classical-metrics, phases/19-capstone-projects/72-code-exec-metric, phases/19-capstone-projects/73-perplexity-calibration, phases/19-capstone-projects/74-leaderboard-aggregation, phases/19-capstone-projects/75-end-to-end-eval-runner
source_hash: f41ffc5fe2795abd
---

## End-to-end eval runner
type: architecture
from: phases/19-capstone-projects/75-end-to-end-eval-runner/docs/en.md, phases/19-capstone-projects/75-end-to-end-eval-runner/code/main.py, phases/19-capstone-projects/72-code-exec-metric/code/main.py

```arch
node | tasks | 1,1 | tasks.jsonl | validate_file
node | adapter | 2,1 | ModelAdapter | generate(prompt, task)
node | post | 3,1 | post_process | one rule per task
node | metric | 4,1 | score | metric_name dispatch
node | calib | 1,2 | CalibrationReport | ece, brier
node | board | 2,2 | aggregate | JSON + markdown
node | runs | 3,2 | EvalRun | one per model, task
node | exec | 4,2 | run_candidate | subprocess, 3 s
edge | tasks | adapter | render
edge | adapter | post | text
edge | post | metric |
edge | post | exec | code_exec
edge | metric | runs | score
edge | exec | runs | score
edge | adapter | calib | confidence
edge | runs | board |
edge | calib | board | report
```

## Score one task
type: flow
from: phases/19-capstone-projects/75-end-to-end-eval-runner/docs/en.md, phases/19-capstone-projects/75-end-to-end-eval-runner/code/main.py, phases/19-capstone-projects/70-task-spec-format/docs/en.md

1. **Render**: few-shot examples, then the prompt, with a blank line between.
2. **Adapter**: `generate(prompt, task)` returns text and confidence. The runner times it.
3. **post_process**: applies the single rule of the task.
4. **Dispatch**: `score` for text metrics, `run_candidate` for `code_exec`.
5. **EvalRun**: one record with the score and the metric name.
6. **Calibration buffer**: appends the (confidence, correct) pair.
7. **Correct**: score of 1 for exact_match, accuracy, code_exec. At least 0.5 for graded metrics.

## Pick and run a metric
type: task-table
span: 2
from: phases/19-capstone-projects/70-task-spec-format/code/main.py, phases/19-capstone-projects/71-classical-metrics/code/main.py, phases/11-llm-engineering/10-evaluation/code/eval_framework.py, phases/10-llms-from-scratch/10-evaluation/docs/en.md, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/docs/en.md

| Task | Code |
|---|---|
| Score arithmetic | `"exact_match"` with `"strip_whitespace"` |
| Score multiple choice | `"exact_match"` with `"extract_letter"` |
| Score generated code | `"code_exec"` with `"extract_code_block"` |
| Score a summary | `"rouge_l"` or `"bleu_4"` |
| Interval on a pass rate | `wilson_confidence_interval(successes, total, z=1.96)` |
| Rank by pairwise wins | `ELOTracker(k=32, initial_rating=1500)` |
| Plant a needle | `build_haystack(filler_text, needle, depth_ratio, total_tokens)` |
| Run a public benchmark | `lm_eval --model hf --model_args pretrained=<model> --tasks mmlu` |

## Harness API
type: annotated-code
lang: python
from: phases/19-capstone-projects/70-task-spec-format/code/main.py, phases/19-capstone-projects/70-task-spec-format/docs/en.md, phases/19-capstone-projects/71-classical-metrics/code/main.py, phases/19-capstone-projects/72-code-exec-metric/code/main.py, phases/19-capstone-projects/73-perplexity-calibration/code/main.py, phases/19-capstone-projects/74-leaderboard-aggregation/code/main.py

```python
tasks, errors = validate_file("tasks.jsonl")     # do not run if errors
s = score("f1", prediction, targets)             # best F1 over the targets
s = score_code_exec(prediction, assertions)      # passed / total, 3 s limit
p = pass_at_k(n=10, c=3, k=5)                    # unbiased estimator
report = CalibrationReport.from_predictions(confidences, correct)
report.ece, report.brier, report.populated_bins  # bins=10 by default
ppl = perplexity(neg_log_probs, token_counts)    # exp(total nll / tokens)
rows = aggregate(runs, b=500, alpha=0.05)        # mean, bootstrap CI, win rate
print(render_markdown(rows))                     # table for a PR comment
```

## Post-process rules
type: command-table
from: phases/19-capstone-projects/70-task-spec-format/docs/en.md, phases/19-capstone-projects/70-task-spec-format/code/main.py

| Command | What it does |
|---|---|
| `none` | Returns the string unchanged |
| `strip_whitespace` | Strips leading and trailing whitespace |
| `lower` | Lowercases the string |
| `extract_letter` | First character in `[A-E]`. For MCQ |
| `extract_code_block` | Body of the first fenced block. For code |
| `extract_first_line` | First non-empty line. For summary classes |

## Key formulas
type: concepts
from: phases/10-llms-from-scratch/10-evaluation/docs/en.md, phases/19-capstone-projects/71-classical-metrics/docs/en.md, phases/19-capstone-projects/72-code-exec-metric/docs/en.md, phases/19-capstone-projects/73-perplexity-calibration/docs/en.md

- **Perplexity**: $\mathrm{PPL} = \exp\left(-\frac{1}{N} \sum_i \log P(\text{token}_i \mid \text{context})\right)$
- **Token F1**: $\frac{2 P R}{P + R}$. P and R are token overlap over prediction and target.
- **BLEU-4**: brevity penalty times the geometric mean of $p_1$ to $p_4$.
- **Brevity penalty**: 1 if $c \ge r$, else $\exp(1 - r / c)$.
- **ROUGE-L**: LCS over reference length and over candidate length, then F1.
- **pass@k**: $1 - \binom{n - c}{k} / \binom{n}{k}$ for $c$ passes in $n$ samples.
- **ECE**: confidence minus accuracy per bin, weighted by bin size, summed.
- **Brier**: $\mathrm{mean}((p_i - y_i)^2)$. Penalizes spread that ECE misses.

## Sample size and confidence
type: command-table
from: phases/11-llm-engineering/10-evaluation/docs/en.md

| Test cases at 90% | 95% CI width |
|---|---|
| 50 | 19 points. Cannot detect a 5% regression |
| 100 | 12 points. Barely |
| 200 | 9 points. Yes |
| 500 | 5 points. Confidently |
| 1000 | 3 points. Precisely |

## Defaults in the code
type: defaults
from: phases/19-capstone-projects/72-code-exec-metric/code/main.py, phases/19-capstone-projects/70-task-spec-format/code/main.py, phases/19-capstone-projects/73-perplexity-calibration/code/main.py, phases/19-capstone-projects/73-perplexity-calibration/docs/en.md, phases/19-capstone-projects/74-leaderboard-aggregation/code/main.py, phases/19-capstone-projects/75-end-to-end-eval-runner/code/main.py, phases/10-llms-from-scratch/10-evaluation/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `DEFAULT_TIMEOUT_S` | 3.0 | Per task. `MAX_TIMEOUT_S` is 30.0 |
| `OUTPUT_CAP_BYTES` | 256 * 1024 | Then the result is "output overflow" |
| `FEW_SHOT_MAX` | 8 | Few-shot examples per task |
| ECE `bins` | 10 | 15 is the comparison convention |
| Bootstrap `b` | 500 | Low-level helpers use 1000 |
| `alpha` | 0.05 | 95% percentile interval |
| `max_workers` | 8 | Thread pool in `run_eval` |
| ELO `k` | 32 | Start rating 1500 |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/73-perplexity-calibration/docs/en.md, phases/19-capstone-projects/41-eval-pipeline/docs/en.md, phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/docs/en.md, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/docs/en.md, phases/19-capstone-projects/74-leaderboard-aggregation/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Perplexity below 1 | Adapter returns log p, not -log p | Negate. The function rejects it |
| Perplexity too good | Padding counted in the denominator | Count only non-pad tokens |
| Judge scores go missing | Bad JSON gives NaN, mean drops it | Catch it as an explicit failure |
| Judge rates its own model high | Self-evaluation adds 10-20% | Judge with a different model family |
| Pairwise judge picks the first | Position bias | Randomize order and run both |
| Mean 0.85, users complain | Mean hides 5% catastrophic failures | Inspect the bottom quantile |
| Passes NIAH, fails real docs | NIAH tests retrieval only | Add RULER or a multi-hop test |
| One task dominates the mean | Score in [0, 100] | Return fractions in [0, 1] |

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/docs/en.md, phases/19-capstone-projects/73-perplexity-calibration/docs/en.md, phases/10-llms-from-scratch/10-evaluation/docs/en.md, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/docs/en.md

- **EM**: Exact Match. 1 or 0 per task after normalization.
- **ECE**: Expected Calibration Error. Gap between confidence and accuracy.
- **MMLU**: Massive Multitask Language Understanding. 15,908 questions, 57 subjects.
- **HumanEval**: 164 Python function-completion problems.
- **SWE-bench**: 2,294 GitHub issues from 12 Python repos.
- **NIAH**: Needle in a Haystack. Plant a fact in filler, ask for it.
- **MRCR**: Multi-Round Coreference Resolution. 8, 24 or 100 needles.
- **RAGAS**: Retrieval-Augmented Generation ASsessment. Four RAG metrics.

## Questions
type: qa
from: phases/11-llm-engineering/10-evaluation/docs/en.md, phases/19-capstone-projects/27-eval-harness-fixture-tasks/docs/en.md, phases/19-capstone-projects/74-leaderboard-aggregation/docs/en.md, phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/docs/en.md, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/docs/en.md

- **How many test cases?** At least 200 for a deploy decision. 500 or more for close systems.
- **Why report pass@1 too?** pass@k hides a model that is right once in twenty tries.
- **When is a difference real?** When the bootstrap interval of the paired difference excludes zero.
- **When can I trust a judge?** Spearman rho against human labels of 0.7 or more.
- **How long is the real context?** Reasoning-effective is often 25-50% of the advertised window.

## Tips
type: tips
from: phases/11-llm-engineering/10-evaluation/docs/en.md, phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/docs/en.md, phases/19-capstone-projects/49-lm-eval-harness/docs/en.md, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/docs/en.md

- Anchor each rubric score to observable behavior. Judge variance drops 30-40%.
- Freeze the judge model and its version.
- Pin task files by hash in the leaderboard.
- Diff predictions, not only scores. Use `--include-per-example`.
- Keep eval cases apart from prompt and training examples.
- Test needle depths 0, 0.25, 0.5, 0.75 and 1.0.
