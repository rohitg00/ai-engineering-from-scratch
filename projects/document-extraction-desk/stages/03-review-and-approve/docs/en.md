# Bind approval to one document version

**Type:** Build
**Language:** Python
**Stage:** 3 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** The previous stage and [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Document Extraction Review Desk: extract structured fields from a text document, inspect exact source spans, and approve ambiguous values before export.

Your public contract is `typed_value(quote, kind); review_document(text, schema, candidates, decisions=None)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

Type validation checks whether a quote can become the requested value: an ISO date must be a real calendar date and a number must be finite. Evidence validation checks that the quote exists at the declared position. A human still decides whether that value belongs to the intended field. These are three separate judgments.

For `number`, accept Python `float` text syntax, including signs, decimal fractions, exponents and underscores between digits: `-2.5`, `.5`, `1e3` and `1_000` are valid. Commas and unit suffixes such as `1,000` or `3.5 kg` are invalid. Reject nonfinite results, including `inf`, `NaN` and overflow such as `1e309`. The `integer` type remains stricter: an optional sign followed by digits.

Approval contains the source fingerprint and the selected start/end pair for each field. If the document changes, the old decision cannot silently approve a different value at the same location. Missing, invalid, ambiguous, proposed and approved states keep the workflow inspectable.

| Situation | State | Export consequence |
|---|---|---|
| One valid quote, no decision | proposed | Not approved |
| Two Seats quotes | ambiguous | Reviewer chooses |
| Chosen span and matching fingerprint | approved | Value can be exported |

## Predict before running

Approve 18 seats, insert a new line at the top, and predict why the old approval must be rejected.

```figure
pj-document-extraction-desk-3
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py document-extraction-desk --init my-document-extraction-desk
python3 scripts/project_test.py document-extraction-desk --stage 3 --path my-document-extraction-desk --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Check the fingerprint before reading choices.
2. A choice must identify one valid existing candidate.
3. Compute readiness from all required fields, not the count of decisions.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 3. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-document-extraction-desk
python3 cli.py sample.txt --schema schema.json --output output/review.html
```

The final artifact is a local HTML review desk that downloads source-bound approval decisions and an approved JSON value map. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Add a separate reviewer identity and decision timestamp without treating either as cryptographic authentication.

Scope: The core consumes UTF-8 text and explicitly labelled fields; it does not claim OCR or PDF parsing. External OCR or model adapters may supply proposals through --proposals, but every quote and offset is checked. Correct provenance alone does not establish correct field meaning.

Primary reference: [Python regular expression match offsets](https://docs.python.org/3/library/re.html#match-objects). The implementation and exercise data are original teaching examples.
