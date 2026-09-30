# Reward useful evidence near the top

**Stage 3 of 4.** Python. Plan about 2 hours.

Reciprocal rank uses only the first relevant result. Normalized discounted cumulative gain uses every graded hit, with gain 2^grade-1 and discount log2(rank+1). Swapping a strong result downward should lower NDCG even when recall is unchanged.

The ideal ranking comes from all judgments sorted by grade, truncated to k. A zero ideal gain yields NDCG zero rather than division by zero.

```figure
pj-retrieval-evaluation-lab-3
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 2](../../02-precision-and-recall/docs/en.md) first.

Place stronger evidence earlier. With gains 3 and 1, ranking the weaker source first reduces discounted gain even though the retrieved document set is unchanged.

```text
ranking [release,restore]: DCG=1 + 7/log2(3)=5.4165
ideal [restore,release]: DCG=7 + 1/log2(3)=7.6309
NDCG=0.7098
```

## Build and inspect

Use gain 2^relevance-1 and discount log2(rank+1). Normalize against the best labeled ordering at the same cutoff.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py retrieval-evaluation-lab --stage 3 --path learning-artifacts/retrieval-evaluation-lab
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should NDCG return if every labeled gain is zero?
