# Validate rankings and graded judgments

**Stage 1 of 4.** Python. Plan about 2 hours.

Evaluation assumes a document appears once in a ranking. If the same relevant document is repeated, naive precision and gain can count it many times. Validate ranking ids and relevance grades before measuring anything.

Grades use integers from zero to three. Missing documents are treated as unjudged and receive zero gain, but the final report also counts them so incomplete labeling remains visible.

```figure
pj-retrieval-evaluation-lab-1
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md).

A ranking is an ordered list of unique document ids. The Orchard restore query has graded evidence: a recovery procedure is more useful than a passing mention in release notes.

```text
judgments: restore=3, release=1, cafe=0
ranking: [release, restore, restore] -> duplicate error
```

## Build and inspect

Validate rankings and judgments before scoring. Keep unjudged documents visible instead of assuming they were reviewed and found irrelevant.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py retrieval-evaluation-lab --init learning-artifacts/retrieval-evaluation-lab
python3 scripts/project_test.py retrieval-evaluation-lab --stage 1 --path learning-artifacts/retrieval-evaluation-lab
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What does a missing judgment mean when your corpus has just gained a new note?
