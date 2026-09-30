# Rank chunks with an inspectable keyword score

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Term frequency saturates through a logarithm, and document frequency reduces the weight of common words. Return the whole chunk contract with its score, not just the text, because the next stage needs source offsets. This lexical baseline will miss synonyms; measure it before adding an embedding service.

## Work through one concrete case

A query cache should rank the cache policy above the request deadline document. Repeating cache raises term frequency logarithmically; a term seen in many chunks contributes less than a rare term.

```figure
pj-doc-qa-with-citations-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `retrieval.py`: `retrieve`. This artifact is stage 2 of Document QA With Citations and LangChain. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Tokenize and case-fold both sides consistently. Only positive scores enter the result; an unknown query must return an empty candidate list so stage 3 can abstain.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py doc-qa-with-citations --init learning-artifacts/doc-qa-with-citations`. Then grade cumulatively:

```bash
python3 scripts/project_test.py doc-qa-with-citations --stage 2 --path learning-artifacts/doc-qa-with-citations --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/doc-qa-with-citations
python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html
```

## Investigate the failure boundary

Add a document containing many repetitions of an irrelevant word. Confirm that its length alone does not make it relevant.




## References

[Reference 1](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter)
