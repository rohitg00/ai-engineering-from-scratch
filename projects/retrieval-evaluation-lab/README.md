# Retrieval Evaluation Lab

A retrieval regression detective revealing which evidence moved and why the aggregate changed.

A ranking is an ordered list of unique document ids. The Orchard restore query has graded evidence: a recovery procedure is more useful than a passing mention in release notes.

## Start with a learner workspace

[Retrieval augmented generation](../../phases/11-llm-engineering/06-rag/docs/en.md), [Model evaluation](../../phases/02-ml-fundamentals/09-model-evaluation/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py retrieval-evaluation-lab --init learning-artifacts/retrieval-evaluation-lab
python3 scripts/project_test.py retrieval-evaluation-lab --stage 1 --path learning-artifacts/retrieval-evaluation-lab
```

## Build route

1. [Validate rankings and graded judgments](stages/01-validate-rankings/docs/en.md)
2. [Compute precision and recall at k](stages/02-precision-and-recall/docs/en.md)
3. [Reward useful evidence near the top](stages/03-rank-sensitive-metrics/docs/en.md)
4. [Compare systems query by query](stages/04-compare-systems/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/retrieval-evaluation-lab/cli.py projects/retrieval-evaluation-lab/examples/baseline.json projects/retrieval-evaluation-lab/examples/candidate.json projects/retrieval-evaluation-lab/examples/judgments.json --out retrieval-diff.json
```

To inspect the complete reference first, replace `learning-artifacts/retrieval-evaluation-lab` with `projects/retrieval-evaluation-lab/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

Metrics apply to supplied labels. Unjudged documents receive zero gain and remain counted as unjudged. Use --fail-on-regression to return exit 1 for any query with lower NDCG.

```bash
python3 scripts/project_test.py retrieval-evaluation-lab --all --solution --strict
python3 scripts/project_test.py retrieval-evaluation-lab --all --path learning-artifacts/retrieval-evaluation-lab --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Mechanism and API reference](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html)
