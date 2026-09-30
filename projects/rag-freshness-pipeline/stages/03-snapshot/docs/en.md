# Persist an index with atomic replacement

**Stage 3 of 4.** Python. Plan about 2 hours.

Write the complete next snapshot beside the destination, flush it, then replace the destination atomically. A version precondition rejects stale writers. The persistent sibling lock uses POSIX flock to serialize local writer processes around the version check and replacement. Atomic replacement protects readers from partial files, not from every distributed race.

```figure
pj-rag-freshness-pipeline-3
```

## Implementation boundary

```python
def read_snapshot(path):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/os.html#os.replace).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 2](../../02-changes/docs/en.md) first.

Two ingestion processes can read version 1 simultaneously. A persistent sibling lock serializes their version checks and replacement writes. Exactly one may commit with expected_version=1; the next writer must reread.

```text
writer A expects 1 -> commits version 2
writer B expects 1 -> stale index version
index.json.lock remains as the stable lock inode
```

## Build and inspect

On POSIX, hold flock across read, compare, fsync and rename. Never unlink the lock after release: waiting processes could then lock different files.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rag-freshness-pipeline --stage 3 --path learning-artifacts/rag-freshness-pipeline
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What happens if a process exits after writing the temporary file but before rename?
