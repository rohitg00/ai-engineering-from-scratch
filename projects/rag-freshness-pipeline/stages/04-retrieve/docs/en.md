# Exclude expired evidence at query time

**Stage 4 of 4.** Python. Plan about 2 hours.

Freshness is a query-time contract as well as an ingestion concern. A background job can fail, so every candidate must satisfy the age limit before ranking. Inject the clock instead of calling the system clock inside tests, and reject future timestamps rather than treating them as extra fresh.

```figure
pj-rag-freshness-pipeline-4
```

## Implementation boundary

```python
def retrieve(documents,query,now,max_age=3600,k=3):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://docs.python.org/3/library/os.html#os.replace).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 3](../../03-snapshot/docs/en.md) first.

After the edit, a query must return the 15-minute policy and never the retired 60-minute text. Freshness is enforced when answering, even if no ingestion job has run since the last snapshot.

```text
updated=200; now=210; max_age=60 -> age 10, eligible
updated=200; now=500; max_age=60 -> age 300, excluded
```

## Build and inspect

Read one committed snapshot for the query. Return its version and the source hash with each hit so callers can detect stale citations.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rag-freshness-pipeline --stage 4 --path learning-artifacts/rag-freshness-pipeline
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/rag-freshness-pipeline/cli.py ingest orchard-index.json projects/rag-freshness-pipeline/examples/before.json
python3 learning-artifacts/rag-freshness-pipeline/cli.py ingest orchard-index.json projects/rag-freshness-pipeline/examples/after.json
python3 learning-artifacts/rag-freshness-pipeline/cli.py query orchard-index.json tokens --now 210 --max-age 60
```

The importer expects the complete corpus, not a partial change feed. POSIX flock coordinates local writers; it is not a distributed database lock. Retrieval is lexical and source timestamps are caller supplied.

## Investigate next

Should a future-dated document receive a negative age and become the best result?
