# Plan inserts updates deletions and refreshes

**Stage 2 of 4.** Python. Plan about 2 hours.

Compute the whole plan before changing the index. A missing id is a deletion, a changed hash is an update, and unchanged content with new metadata is a refresh. Treat duplicate ids as an error because silently keeping one would make ingestion depend on input order.

```figure
pj-rag-freshness-pipeline-2
```

## Implementation boundary

```python
def diff(previous,incoming):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/os.html#os.replace).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 1](../../01-fingerprint/docs/en.md) first.

Ingestion receives a complete corpus snapshot. The after fixture replaces a retired backup note and edits the token lifetime. Missing ids must be deleted so obsolete evidence cannot remain searchable.

```text
before ids: orchard-auth, retired-backup
after ids: orchard-auth, restore-runbook
update: orchard-auth; delete: retired-backup; insert: restore-runbook
```

## Build and inspect

Build the incoming id map before deciding any operation. A duplicate incoming id is an error, not last-write-wins.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rag-freshness-pipeline --stage 2 --path learning-artifacts/rag-freshness-pipeline
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How would the contract change if the importer received only a partial change feed?
