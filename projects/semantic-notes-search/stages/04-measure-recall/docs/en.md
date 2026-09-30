# Measure retrieval before adding embeddings

**Stage 4 of 4.** Python. Plan about 2 hours.

A retrieval demo needs a score tied to a task. For each labeled query, measure whether the expected document appears in the first k results. Average these independent hits for recall at k.

This tiny labeled fixture is public and deterministic. A perfect score here cannot establish quality on new notes. Keep a separate set of your own paraphrases before deciding whether synonym expansion is sufficient.

```figure
pj-semantic-notes-search-4
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/the-vector-space-model-for-scoring-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 3](../../03-rank-queries/docs/en.md) first.

Measure whether the intended note appears near the top before adding a different retrieval backend. The supplied notes span deployment, restore and guest Wi-Fi so an alias can help one topic while harming another.

```text
labels: restore -> backup.md; café -> café.md
hits=2,total=2,k=1 -> recall=1
add a misleading alias -> inspect changed hit ids
```

## Build and inspect

Keep labeled queries outside the tuning examples. Call the actual search function inside evaluation instead of reconstructing a separate scorer.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py semantic-notes-search --stage 4 --path learning-artifacts/semantic-notes-search
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/semantic-notes-search/cli.py projects/semantic-notes-search/examples/notes "release replicas" --aliases projects/semantic-notes-search/examples/aliases.json --out matches.json
```

This is an explainable lexical TF-IDF baseline with explicit aliases, not a learned embedding model. The title preserves the project route; every match exposes its lexical terms. The folder reader accepts bounded UTF-8 markdown and rejects symlink files.

## Investigate next

How many new labels would you collect before claiming improved retrieval for beginners?
