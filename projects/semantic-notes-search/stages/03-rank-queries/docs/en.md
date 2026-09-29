# Rank queries with a stable tie rule

**Stage 3 of 4.** Python. Plan about 2 hours.

Cosine similarity measures vector direction, so a long note does not win merely by repeating all its words. Ignore query terms that never appeared in the corpus, then normalize in the same weighted space.

Sort by descending score and then document id. This tie rule makes regression tests and demo recordings reproducible. Return only positive matches; an empty list is more honest than unrelated zero-score hits.

```figure
pj-semantic-notes-search-3
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/the-vector-space-model-for-scoring-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 2](../../02-weight-the-index/docs/en.md) first.

The CLI returns paths, previews and matching tokens for your own markdown folder. Query and note vectors use the same alias map and IDF table; unknown terms contribute no weight.

```text
query=release replicas
alias release=deploy
matching note: release.md; matched terms: deploy
```

The supplied note contains singular `replica`, so plural `replicas` does not match. This lexical tokenizer does not stem words. The editable figure starts with a shorter note containing the literal phrase `deploy replicas`, so its two-term match is a different input.

## Build and inspect

Compute the query vector using index IDF, then dot products against note vectors. Break equal scores by document id.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py semantic-notes-search --stage 3 --path learning-artifacts/semantic-notes-search
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What does an empty result mean if the note uses a synonym absent from the alias map?
