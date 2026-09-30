# Compute precision and recall at k

**Stage 2 of 4.** Python. Plan about 2 hours.

Precision answers how much of the displayed list was useful. Recall answers how much of all known relevant evidence was retrieved. These denominators are different.

Use k as the precision denominator, even when a system returns fewer than k results. This penalizes underfilled result lists consistently. Define empty-relevance recall as zero and report the judgment count.

```figure
pj-retrieval-evaluation-lab-2
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 1](../../01-validate-rankings/docs/en.md) first.

At k=2, retrieving one relevant note and one irrelevant note gives precision 1/2. If the labels contain two relevant notes, recall is also 1/2. The denominator comes from a different place in each metric.

```text
ranking[:2]=[restore,cafe]
relevant labels={restore,release}
precision=1/2; recall=1/2
```

## Build and inspect

Count positive relevance labels as relevant, not merely keys in the judgment map. Keep the supplied cutoff even when fewer results are returned.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py retrieval-evaluation-lab --stage 2 --path learning-artifacts/retrieval-evaluation-lab
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why can increasing k improve recall while lowering precision?
