# RAG Freshness Pipeline

A stale-answer incident lab proving an edited or deleted policy can no longer be cited.

The Orchard policy keeps the same document id when its timeout changes. Normalize Unicode and line endings before hashing the body, and retain updated time separately. A later observation of unchanged content is a refresh, not a rewrite.

## Start with a learner workspace

[Data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md), [Retrieval augmented generation](../../phases/11-llm-engineering/06-rag/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py rag-freshness-pipeline --init learning-artifacts/rag-freshness-pipeline
python3 scripts/project_test.py rag-freshness-pipeline --stage 1 --path learning-artifacts/rag-freshness-pipeline
```

## Build route

1. [Normalize documents and fingerprint content](stages/01-fingerprint/docs/en.md)
2. [Plan inserts updates deletions and refreshes](stages/02-changes/docs/en.md)
3. [Persist an index with atomic replacement](stages/03-snapshot/docs/en.md)
4. [Exclude expired evidence at query time](stages/04-retrieve/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/rag-freshness-pipeline/cli.py ingest orchard-index.json projects/rag-freshness-pipeline/examples/before.json
python3 learning-artifacts/rag-freshness-pipeline/cli.py ingest orchard-index.json projects/rag-freshness-pipeline/examples/after.json
python3 learning-artifacts/rag-freshness-pipeline/cli.py query orchard-index.json tokens --now 210 --max-age 60
```

To inspect the complete reference first, replace `learning-artifacts/rag-freshness-pipeline` with `projects/rag-freshness-pipeline/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The importer expects the complete corpus, not a partial change feed. POSIX flock coordinates local writers; it is not a distributed database lock. Retrieval is lexical and source timestamps are caller supplied.

```bash
python3 scripts/project_test.py rag-freshness-pipeline --all --solution --strict
python3 scripts/project_test.py rag-freshness-pipeline --all --path learning-artifacts/rag-freshness-pipeline --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.
