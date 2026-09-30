# Compare systems query by query

**Stage 4 of 4.** Python. Plan about 2 hours.

Macro averaging gives each query equal weight, preventing a query with hundreds of judgments from dominating the benchmark. Retain per-query metrics alongside the mean so regressions remain visible.

Require all judged queries to appear in every system, including an explicit empty ranking when retrieval fails. Silently dropping hard queries would improve the average without improving retrieval.

```figure
pj-retrieval-evaluation-lab-4
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 3](../../03-rank-sensitive-metrics/docs/en.md) first.

The supplied three-query fixture improves release and café retrieval while making restore retrieval worse. Sort query-level deltas so the lost recovery evidence appears before the aggregate.

```text
release: improved
cafe: improved
restore: regressed
--fail-on-regression -> exit 1
```

## Build and inspect

Align systems on the judgment query ids. Save before/after ranked ids with each delta; a number alone does not identify the moved source.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py retrieval-evaluation-lab --stage 4 --path learning-artifacts/retrieval-evaluation-lab
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/retrieval-evaluation-lab/cli.py projects/retrieval-evaluation-lab/examples/baseline.json projects/retrieval-evaluation-lab/examples/candidate.json projects/retrieval-evaluation-lab/examples/judgments.json --out retrieval-diff.json
```

Metrics apply to supplied labels. Unjudged documents receive zero gain and remain counted as unjudged. Use --fail-on-regression to return exit 1 for any query with lower NDCG.

## Investigate next

Which query deserves review first if average NDCG rises?
