# Load local documents with stable provenance

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Keep source identity, content hash and exact offsets before retrieving anything. Character windows are an intentionally simple baseline: overlap preserves context near boundaries but does not create new evidence. The loader refuses symlinks that escape its root, so a document scan cannot silently read another directory.

## Work through one concrete case

For text abcdef, size 4 and overlap 1 produce [0,4)="abcd" then [3,6)="def". The offset is in Unicode characters, not UTF-8 bytes, and the file's SHA-256 identifies the exact source version.

```figure
pj-doc-qa-with-citations-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `documents.py`: `load_documents`, `chunk_document`. This artifact is stage 1 of Document QA With Citations and LangChain. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Stop immediately when a chunk reaches the source end. Otherwise a short trailing chunk can generate another redundant window. Resolve each path and reject symlinks escaping the root.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py doc-qa-with-citations --init learning-artifacts/doc-qa-with-citations`. Then grade cumulatively:

```bash
python3 scripts/project_test.py doc-qa-with-citations --stage 1 --path learning-artifacts/doc-qa-with-citations --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/doc-qa-with-citations
python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html
```

## Investigate the failure boundary

Place a multibyte character before a quoted span. Verify that Python string slicing, returned offsets and the renderer all use the same unit.




## References

[Reference 1](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter)
