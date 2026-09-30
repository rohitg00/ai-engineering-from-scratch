# Accept only answers grounded in retrieved spans

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Ask the model to select an exact quote and a source id, then validate both. A quoted substring gives a checkable span; it does not guarantee the source is true. Empty retrieval returns an explicit abstention without calling the model. A later paraphrasing writer would need a different support gate.

## Work through one concrete case

The source says "Cache expires in sixty seconds. Bananas are yellow." Both sentences are quotable. For a cache question, the banana sentence passes the exact-substring check but the composed CLI marks it needs_review because no meaningful query term overlaps.

```figure
pj-doc-qa-with-citations-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `answer.py`: `answer`. This artifact is stage 3 of Document QA With Citations and LangChain. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

First validate source id and exact quote, then recover offsets from the cited chunk. Keep relevance as a separate, explicitly limited policy instead of pretending the citation proves the answer.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py doc-qa-with-citations --init learning-artifacts/doc-qa-with-citations`. Then grade cumulatively:

```bash
python3 scripts/project_test.py doc-qa-with-citations --stage 3 --path learning-artifacts/doc-qa-with-citations --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/doc-qa-with-citations
python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html
```

## Investigate the failure boundary

Return an exact quote from a different chunk id. The answer gate must reject it even if the same text exists elsewhere in the corpus.




## References

[Reference 1](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter)
