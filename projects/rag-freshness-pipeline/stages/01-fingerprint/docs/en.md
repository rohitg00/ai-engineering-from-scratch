# Normalize documents and fingerprint content

**Stage 1 of 4.** Python. Plan about 2 hours.

Identity and content are different keys. Preserve the caller id while hashing normalized Unicode content, so equivalent encodings do not trigger unnecessary indexing. Timestamps remain metadata: changing a timestamp must not pretend that the document content changed.

```figure
pj-rag-freshness-pipeline-1
```

## Implementation boundary

```python
def normalize(doc):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/os.html#os.replace).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

The Orchard policy keeps the same document id when its timeout changes. Normalize Unicode and line endings before hashing the body, and retain updated time separately. A later observation of unchanged content is a refresh, not a rewrite.

```text
id=orchard-auth
text: tokens expire after 60 minutes
updated: 100 -> 200
content hash: unchanged
```

## Build and inspect

Hash normalized UTF-8 bytes. Do not hash the timestamp into content identity.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rag-freshness-pipeline --init learning-artifacts/rag-freshness-pipeline
python3 scripts/project_test.py rag-freshness-pipeline --stage 1 --path learning-artifacts/rag-freshness-pipeline
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why should two differently encoded versions of café produce the same fingerprint?
