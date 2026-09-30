# Weight terms by document rarity

**Stage 2 of 4.** Python. Plan about 2 hours.

A word that appears in every note provides little discrimination. Compute smoothed IDF as log((1+N)/(1+df))+1, multiply by term frequency, then normalize each vector to unit length.

Store vectors and IDF together. A query must use the exact vocabulary and weights from the index; fitting query-specific IDF changes the coordinate system and invalidates cosine comparisons.

```figure
pj-semantic-notes-search-2
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/the-vector-space-model-for-scoring-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 1](../../01-normalize-notes/docs/en.md) first.

Rare operational terms separate notes better than common project names. Count document frequency once per note, multiply frequency by smoothed rarity, then normalize each sparse vector.

```text
N=3; df(orchard)=3 -> idf=1
df(restore)=1 -> idf=log(4/2)+1=1.6931
```

## Build and inspect

Build a set of words per document for document frequency. Repeating orchard ten times in one note does not make it occur in ten documents.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py semantic-notes-search --stage 2 --path learning-artifacts/semantic-notes-search
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why normalize vector length before comparing a short note with a long runbook?
