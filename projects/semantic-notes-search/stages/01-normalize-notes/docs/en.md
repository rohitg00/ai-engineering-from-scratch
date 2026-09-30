# Normalize notes without losing identity

**Stage 1 of 4.** Python. Plan about 2 hours.

A search index is a contract between the note you wrote and the query you will type later. Tokenize Unicode words with case folding, but keep each original document id. Repeated terms carry frequency information; a set would destroy it.

Use a small explicit synonym map to map deploy and release to the same canonical term. This demonstrates controlled semantic expansion. It is not an embedding model and cannot infer arbitrary paraphrases.

```figure
pj-semantic-notes-search-1
```

Primary reference: [Primary technical reference](https://nlp.stanford.edu/IR-book/html/htmledition/the-vector-space-model-for-scoring-1.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

Orchard operators type café with different Unicode encodings. Apply case folding and NFC normalization to both text and alias keys so equivalent spellings share tokens. An alias is one explicit lexical substitution.

```text
"CAFE\u0301" -> ["café"]
alias release -> deploy
"release café" -> ["deploy","café"]
```

## Build and inspect

Normalize before the Unicode word regex; otherwise a combining mark can disappear. Do not recursively expand aliases into cycles.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py semantic-notes-search --init learning-artifacts/semantic-notes-search
python3 scripts/project_test.py semantic-notes-search --stage 1 --path learning-artifacts/semantic-notes-search
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

When would mapping release to deploy harm retrieval rather than help it?
