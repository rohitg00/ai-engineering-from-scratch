# Document QA With Citations and LangChain

A citation receipt that separates exact source support from relevance to the question.

Python 3.10+; pathlib, strings, offsets, dictionaries and callback functions. Optional LangChain dependencies are pinned separately. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py doc-qa-with-citations --init learning-artifacts/doc-qa-with-citations
python3 scripts/project_test.py doc-qa-with-citations --stage 1 --path learning-artifacts/doc-qa-with-citations --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py doc-qa-with-citations --all --path learning-artifacts/doc-qa-with-citations --strict
cd learning-artifacts/doc-qa-with-citations
python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py doc-qa-with-citations --all --solution --strict
cd projects/doc-qa-with-citations/solution
python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html
```

## Observe the change

A cache question selects the cache sentence and returns its exact source span, line and SHA-256. A query for zebras abstains; a verbatim banana quote for a cache question becomes needs_review.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Import query(directory, question, model). A model callback returns JSON {source:chunk_id,quote:exact_text}. --response accepts a recorded response and applies the same gate.

The default answerer is local and extractive. Lexical overlap cannot establish semantic entailment. A valid citation can still be irrelevant or outdated; the content hash lets a reader detect source changes.

## Stages

1. [Load local documents with stable provenance](stages/01-documents/docs/en.md)
2. [Rank chunks with an inspectable keyword score](stages/02-retrieval/docs/en.md)
3. [Accept only answers grounded in retrieved spans](stages/03-answer/docs/en.md)
4. [Use a framework splitter without losing offsets](stages/04-adapter/docs/en.md)

## Optional framework integration

The baseline stages use only the standard library. The framework adapter is implemented and has a separate smoke test that uses the real installed SDK with a local fake model. It never contacts a cloud service.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r projects/doc-qa-with-citations/requirements-framework.txt
.venv/bin/python scripts/project_test.py doc-qa-with-citations --solution --optional --strict
.venv/bin/python projects/doc-qa-with-citations/solution/framework_demo.py
```

The integration was verified against `langchain-text-splitters==1.1.2`. The cloud-provider path, where present, remains opt-in and requires your own environment credentials; no cloud deployment is performed.

The default grader covers the offline core and input integration. `--optional` adds 5 tests that use the real SDK and a deterministic local model. A missing SDK is reported as SKIP with an install hint; `--optional --strict` fails when the dependency is missing. Passing only the default tests does not claim framework verification.

## Primary references
