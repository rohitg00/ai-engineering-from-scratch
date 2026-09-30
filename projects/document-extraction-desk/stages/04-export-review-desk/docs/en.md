# Show evidence and export reviewed values

**Type:** Build
**Language:** Python
**Stage:** 4 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Document Extraction Review Desk: extract structured fields from a text document, inspect exact source spans, and approve ambiguous values before export.

Your public contract is `render_review(report)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Build the interface around the unresolved choice. Selecting a candidate highlights its exact source span, while the source remains visible beside the fields. Downloading decisions creates a local JSON file; it does not submit values anywhere. Run the CLI again with --approve to revalidate and export approved values.

Retain the approved candidate as a `selected` start/end pair in each field. Render that candidate with its radio input checked when reopening an approved report. Downloading again without edits must preserve the decision.

Use safe DOM text operations and escaped HTML. The document may contain markup that must remain ordinary text. Keep the source fingerprint in the decision file so the CLI can reject stale choices even if the review page was left open.

| Artifact | Consumer |
|---|---|
| review.html | Human reads source and chooses |
| approvals.json | CLI validates selected spans |
| review.json approvedValues | Another application imports reviewed fields |

## Predict before running

Select a Seats candidate in the browser and verify the highlighted text exactly matches it. Download and inspect the decision JSON before applying it.

```figure
pj-document-extraction-desk-4
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py document-extraction-desk --init my-document-extraction-desk
python3 scripts/project_test.py document-extraction-desk --stage 4 --path my-document-extraction-desk --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Bind controls to offsets rather than copied labels.
2. Escape both document content and serialized script data.
3. Leave missing fields visible instead of hiding them.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 4. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-document-extraction-desk
python3 cli.py sample.txt --schema schema.json --output output/review.html
```

The final artifact is a local HTML review desk that downloads source-bound approval decisions and an approved JSON value map. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Write a small consumer that refuses reports with status needs_review.

Scope: The core consumes UTF-8 text and explicitly labelled fields; it does not claim OCR or PDF parsing. External OCR or model adapters may supply proposals through --proposals, but every quote and offset is checked. Correct provenance alone does not establish correct field meaning.

Primary reference: [Python regular expression match offsets](https://docs.python.org/3/library/re.html#match-objects). The implementation and exercise data are original teaching examples.
