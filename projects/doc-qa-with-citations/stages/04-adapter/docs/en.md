# Use a framework splitter without losing offsets

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

The adapter keeps the from-scratch retrieval and answer validator. The optional LangChain path contributes recursive splitting and a fake model interface, then converts every chunk back to exact source offsets. If a splitter rewrites text, reject it instead of inventing provenance. Repeated overlapping substrings must advance the search cursor by one position, not by the full chunk length.

## Work through one concrete case

A framework splitter returns two overlapping copies of "aba" from "ababa". Their positions are 0 and 2; advancing the search cursor by the full chunk length would miss the second valid occurrence.

```figure
pj-doc-qa-with-citations-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `adapter.py`: `adapt_splits`, `framework_qa`. This artifact is stage 4 of Document QA With Citations and LangChain. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Move the cursor one character past the last match and verify every returned part against the original text. Keep the from-scratch retrieval and citation validator around the optional SDK path.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py doc-qa-with-citations --init learning-artifacts/doc-qa-with-citations`. Then grade cumulatively:

```bash
python3 scripts/project_test.py doc-qa-with-citations --stage 4 --path learning-artifacts/doc-qa-with-citations --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/doc-qa-with-citations
python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html
```

## Investigate the failure boundary

Run the folder CLI with your own two text files. Then install the pinned optional dependencies and compare chunk offsets, not merely the number of chunks.

The default answerer is local and extractive. Lexical overlap cannot establish semantic entailment. A valid citation can still be irrelevant or outdated; the content hash lets a reader detect source changes.

## Verify the actual framework

The five default stage tests check the adapter contract without importing the SDK. Install the pinned optional dependency, then include the five real-SDK tests explicitly:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r projects/doc-qa-with-citations/requirements-framework.txt
.venv/bin/python scripts/project_test.py doc-qa-with-citations --solution --optional --strict
.venv/bin/python projects/doc-qa-with-citations/solution/framework_demo.py
```

Use `--path my-doc-qa-with-citations` instead of `--solution` to grade your implementation. Missing dependencies produce a skip in optional mode and a failure in strict optional mode. The verified SDK version is `langchain-text-splitters==1.1.2`; all model replies are local fixtures.

## References

[Reference 1](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter)
