# Extract candidates without losing their evidence

**Type:** Build
**Language:** Python
**Stage:** 2 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Document Extraction Review Desk: extract structured fields from a text document, inspect exact source spans, and approve ambiguous values before export.

Your public contract is `extract_candidates(text, schema)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Read a candidate as a proposal, not a fact. A repeated Seats label yields two candidates rather than silently choosing the last occurrence. Each proposal contains the exact quote and a half-open character interval: text[start:end] must equal quote.

Offsets refer to Python Unicode character positions in the original text. Do not normalize the entire document and then use those offsets against the original. Trimming a candidate changes its start and end, so calculate the offset after accounting for leading whitespace.

| Source | Candidate state |
|---|---|
| Seats: 18 | First seats proposal |
| Seats: 24 | Second seats proposal |
| Delivery: 2026-10-14 | One dated proposal |

## Predict before running

Place a non-ASCII name before Seats and manually count the candidate span. Verify slicing, not byte-count arithmetic.

```figure
pj-document-extraction-desk-2
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py document-extraction-desk --init my-document-extraction-desk
python3 scripts/project_test.py document-extraction-desk --stage 2 --path my-document-extraction-desk --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Use match.start for the captured value.
2. Preserve every recognized occurrence.
3. Compare the slice to the quote before any approval.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 2. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-document-extraction-desk
python3 cli.py sample.txt --schema schema.json --output output/review.html
```

The final artifact is a local HTML review desk that downloads source-bound approval decisions and an approved JSON value map. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Feed a fabricated quote from an external extractor and require a visible rejection.

Scope: The core consumes UTF-8 text and explicitly labelled fields; it does not claim OCR or PDF parsing. External OCR or model adapters may supply proposals through --proposals, but every quote and offset is checked. Correct provenance alone does not establish correct field meaning.

Primary reference: [Python regular expression match offsets](https://docs.python.org/3/library/re.html#match-objects). The implementation and exercise data are original teaching examples.
