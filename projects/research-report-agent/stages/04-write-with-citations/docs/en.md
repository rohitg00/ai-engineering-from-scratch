# Write only from evidence

> The writer is not allowed to know anything. It may only arrange what search found.

**Type:** Build
**Languages:** Python
**Stage:** 4 of 7 (core)
**Time:** ~2 hours

## What you build

- `report_agent/citations.py`: read citation markers, split report sentences, and validate that every sentence cites a snippet that exists.
- `report_agent/writer.py`: gather snippets for every facet, write sections from them, and render markdown.

A finished sentence looks like this:

```text
Each microVM runs its own guest kernel [S4].
```

## Why it matters

The most common failure in generated reports is a fluent sentence with no source, or a source attached to a sentence it does not support. The fix is structural, not a better prompt: define a citation format, then reject any output that breaks it. Strong report systems enforce grounding in code, for example by making the writer work only from extracted, numbered evidence. Weak ones ask the model nicely and hope.

This stage builds an extractive writer: every sentence is a snippet, copied, with its id. It is boring on purpose. It gives you a report that is correct by construction, and a validator you will keep when you swap in a model that writes real prose.

## The citation contract

| Rule | Example that fails |
|---|---|
| Every sentence ends with one or more markers, then a period | `Containers share a kernel.` |
| Every marker names a known snippet | `Containers share a kernel [S99].` |
| Headings are not sentences | `## Overview` is skipped |

`validate_citations(markdown, snippet_ids)` returns a list of `CitationError(sentence, reason)` with reasons `uncited` or `dangling:S99`. An empty list means valid.

One subtle split: `user-space kernel` starts lowercase, so "... workloads [S1]. user-space kernel is ..." must still split after `[S1].`. Treat a closing marker plus period as a boundary no matter what comes next.

## Gathering snippets per facet

```python
top_docs = [doc_id for doc_id, _ in index.search(plan.question, k=k_docs)]
for facet in plan.facets:
    candidates = extract_snippets(plan.question + " " + facet.query(), index,
                                  per_doc=per_doc, doc_ids=top_docs)
    # skip spans already used, stop below relative_floor * best score,
    # keep per_facet, renumber S1, S2, ... across the whole report
```

Searching the whole question once keeps every section on topic. The facet only changes which sentences win inside those documents. Renumbering across facets means `S3` means one thing in the whole report.

```figure
pj-rra-cited-writer
```

## Follow the mechanism

The snippet registry is a primary-key table. The writer uses ids as foreign keys, and the validator checks referential integrity. Deduplicate by `(doc_id, start, end)` before assigning ids across facets, because separately numbered duplicates look like independent evidence when they are not.

## Your task

```python
# citations.py
def cites_of(sentence) -> list[str]: ...
def strip_cites(sentence) -> str: ...
def report_sentences(markdown) -> list[str]: ...
def validate_citations(markdown, snippet_ids) -> list[CitationError]: ...

# writer.py
class CitedSentence:
    def render(self) -> str: ...
def gather_snippets(plan, index, k_docs=4, per_doc=4, per_facet=3, relative_floor=0.4) -> dict: ...
def write_report(plan, snippets_by_facet, max_sentences=3) -> Report: ...
def to_markdown(report) -> str: ...
```

## Run the tests

```bash
python3 scripts/project_test.py research-report-agent --stage 4 --path my-report-agent
```

One test checks that the writer invents nothing: every sentence must equal its snippet text with whitespace collapsed.

## What you should see

Stage 4 passes 12 Python tests, and all preceding stages still pass. A clean extractive report yields no citation errors. A sentence without a marker yields `uncited`; `[S99]` yields `dangling:S99`. Every report sentence equals its source snippet after whitespace normalization.

## Check yourself

1. Why does the validator live in its own module instead of inside the writer?
2. What does an extractive writer lose compared with a model that paraphrases?
3. How would you let a model rewrite sentences while keeping the contract?

## Going further

- Add a model-backed writer that receives only the numbered snippets and must return sentences in the citation format. Run the validator on its output and retry once on failure.
- Merge two snippets that say the same thing into one sentence with two markers, `[S2][S5]`.

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 3](../../03-plan-the-research/docs/en.md) first.

A sentence in the report must carry snippet ids that exist in the evidence ledger. The writer selects evidence for each facet; it does not invent a new 15-minute policy when only the 60-minute source exists.

```text
before corpus -> "tokens expire after 60 minutes" [S1]
after corpus -> "tokens expire after 15 minutes" [S1]
```

## Build and inspect

Track citation ids with source spans, not just their display number. Deduplicate repeated sentences across sections without losing evidence.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py research-report-agent --stage 4 --path learning-artifacts/research-report-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why can the same display id S1 refer to different evidence in two separate runs?
