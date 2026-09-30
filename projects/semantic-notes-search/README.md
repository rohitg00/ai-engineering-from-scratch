# Semantic Notes Search

Local notes search explaining each match and showing when aliases help or harm.

Orchard operators type café with different Unicode encodings. Apply case folding and NFC normalization to both text and alias keys so equivalent spellings share tokens. An alias is one explicit lexical substitution.

## Start with a learner workspace

[Data management](../../phases/00-setup-and-tooling/09-data-management/docs/en.md), [Retrieval augmented generation](../../phases/11-llm-engineering/06-rag/docs/en.md). Language foundation: [Python data structures](https://docs.python.org/3/tutorial/datastructures.html).

Use Python 3.10+ and its standard library. POSIX is required where the project uses file locks or process-group supervision.

```bash
python3 scripts/project_test.py semantic-notes-search --init learning-artifacts/semantic-notes-search
python3 scripts/project_test.py semantic-notes-search --stage 1 --path learning-artifacts/semantic-notes-search
```

## Build route

1. [Normalize notes without losing identity](stages/01-normalize-notes/docs/en.md)
2. [Weight terms by document rarity](stages/02-weight-the-index/docs/en.md)
3. [Rank queries with a stable tie rule](stages/03-rank-queries/docs/en.md)
4. [Measure retrieval before adding embeddings](stages/04-measure-recall/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/semantic-notes-search/cli.py projects/semantic-notes-search/examples/notes "release replicas" --aliases projects/semantic-notes-search/examples/aliases.json --out matches.json
```

To inspect the complete reference first, replace `learning-artifacts/semantic-notes-search` with `projects/semantic-notes-search/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

This is an explainable lexical TF-IDF baseline with explicit aliases, not a learned embedding model. The title preserves the project route; every match exposes its lexical terms. The folder reader accepts bounded UTF-8 markdown and rejects symlink files.

```bash
python3 scripts/project_test.py semantic-notes-search --all --solution --strict
python3 scripts/project_test.py semantic-notes-search --all --path learning-artifacts/semantic-notes-search --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Mechanism and API reference](https://nlp.stanford.edu/IR-book/html/htmledition/the-vector-space-model-for-scoring-1.html)
