# Score the public fixtures

> If you cannot put a number on it, you cannot tell whether your next change helped.

**Type:** Build
**Languages:** Python
**Stage:** 7 of 7 (stretch)
**Time:** ~2 hours

## What you build

`report_agent/evaluate.py`:

- `citation_precision(report)`: share of published sentences that pass the lexical citation-support check.
- `source_recall(report, expected_docs)`: share of the expected documents supplied with each question that you cited.
- `fact_coverage(report, key_facts)`: share of key facts that appear in some sentence.
- `evaluate(questions_path, corpus_dir)` returns a `Scorecard`, and `format_scorecard` prints it with one final number out of 100.

```text
id      precision   recall   facts  state
----------------------------------------------
h1           1.00     1.00    1.00  completed
h2           1.00     1.00    1.00  completed
h3           1.00     1.00    1.00  completed
h4           1.00     1.00    0.50  completed
h5           1.00     1.00    0.50  completed
h6           1.00     0.50    0.00  completed
----------------------------------------------
mean         1.00     0.92    0.67
score 87.5 / 100
```

## Why it matters

Precision alone is easy to max out: publish one safe sentence and every citation is correct. Recall and coverage alone are easy too: copy every sentence in the corpus. A useful report needs all three, which is why the score weights them 0.4, 0.3 and 0.3.

The metrics ask different questions. Precision tests published support, recall tests source selection, and fact coverage tests useful content. Report each component alongside the weighted score so one improvement cannot hide a regression elsewhere.

## Public fixtures make the baseline reproducible

`heldout/questions.json` contains six checked-in public evaluation questions, each with expected documents and key facts. The folder name is historical: these questions are visible to learners and the reference implementation was developed with them available. The secrets-proxy demo is exactly question h4, so the score is not a blind or unseen evaluation.

Inspect both this file and `fixtures/questions.json` while learning the metrics. Keep the public evaluation inputs fixed when comparing changes, record all three metrics, and treat improvements as regression evidence on these examples. Repeatedly tuning against them does not establish generalization.

The reference baseline scores 87.5 / 100 on these six public fixtures. Every published sentence passes the lexical precision check, but several questions miss expected facts. This score does not establish performance on arbitrary corpora or model-written prose.

```figure
pj-rra-scorecard
```

## Follow the mechanism

A macro average gives each question equal weight. A micro average would instead favor questions with more sentences. This project uses the former so a long easy report cannot drown out a short difficult question. Keep the evaluation questions fixed while comparing changes.

## Your task

```python
class Scorecard:
    def mean(self, metric) -> float: ...
    def score(self) -> float: ...
def citation_precision(report, threshold=0.8) -> float: ...
def source_recall(report, expected_docs) -> float: ...
def fact_coverage(report, key_facts) -> float: ...
def evaluate(questions_path, corpus_dir, model=None) -> Scorecard: ...
def format_scorecard(card) -> str: ...
```

## Run the tests

```bash
python3 scripts/project_test.py research-report-agent --stage 7 --path my-report-agent
python3 projects/research-report-agent/solution/run_report.py \
  --eval projects/research-report-agent/heldout/questions.json --code my-report-agent
```

The tests require precision of at least 0.9, source recall of at least 0.6, fact coverage of at least 0.4, and a score of at least 70.

## What you should see

Stage 7 passes 8 Python tests, and all preceding stages still pass. The reference baseline on the checked-in public fixtures prints the scorecard shown above: precision 1.00, source recall 0.92, fact coverage 0.67, and score 87.5 / 100. These are measured fixture results, not guarantees for other inputs.

## Check yourself

1. Why is the precision threshold here (0.8) stricter than the critic threshold (0.6)?
2. Your score went up 5 points after a change. What would you check before believing it?
3. Which metric would a report that only says "Containers are containers [S1]." max out?

## Going further

- Improve the public fixture score without lowering precision, and document which examples improved and which regressed.
- Add a model judge that scores readability, and report it separately from the grounded metrics.
- To measure generalization, have someone else prepare separate private questions and labels for a new corpus. Freeze your implementation and thresholds before evaluating them, then disclose when you review or tune against those results.

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 6](../../06-publish-the-report/docs/en.md) first.

The checked-in questions are public regression fixtures. Keep their score separate from an independently prepared corpus evaluation. The new Orchard scenario tests a policy update without changing the public isolation questions.

```text
same question + before corpus -> 60-minute claim
same question + after corpus -> 15-minute claim
comparison question mismatch -> reject
```

## Build and inspect

Freeze your evaluation questions before tuning retrieval. Save component metrics and question-level failures with the aggregate.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py research-report-agent --stage 7 --path learning-artifacts/research-report-agent
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 projects/research-report-agent/solution/run_report.py "How long do Orchard guest tokens last?" --code learning-artifacts/research-report-agent --corpus projects/research-report-agent/examples/orchard/before --out orchard-before
python3 projects/research-report-agent/solution/run_report.py "How long do Orchard guest tokens last?" --code learning-artifacts/research-report-agent --corpus projects/research-report-agent/examples/orchard/after --compare orchard-before/report.json --out orchard-after
```

The default uses deterministic planning and extractive writing. --model replay needs --cassette. --model live uses RRA_LLM_BASE_URL, RRA_LLM_MODEL and optional RRA_LLM_API_KEY for planning only. Live service behavior requires a separate run with caller credentials. Public fixture scores do not measure unseen generalization.

## Investigate next

What would justify a claim that the agent generalizes beyond the published fixtures?
