# Define the fields before extracting values

**Type:** Build
**Language:** Python
**Stage:** 1 of 4
**Time:** ~2 hours, after the linked prerequisites
**Prerequisites:** [development environment](../../../../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md), [data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

## What you build

This stage contributes to Document Extraction Review Desk: extract structured fields from a text document, inspect exact source spans, and approve ambiguous values before export.

Your public contract is `validate_schema(schema)`. The supplied CLI and sample files live in your workspace; implement the domain functions in `main.py`. Keep their signatures so another application can call the same boundary.

## Work through the mechanism

The schema is the agreement between the document reader and the consuming application. Each field has a stable machine name, accepted line labels, a type and a required flag. A label may belong to only one field; otherwise a source line would have two incompatible destinations before any model is involved.

Keep schema validation separate from extraction. A missing required value is a document issue, while an invalid field type is an authoring issue. That distinction produces a useful error rather than an empty answer that looks successful.

| Field | Labels | Type | Required |
|---|---|---|---|
| requester | Requester, Requested by | text | yes |
| seats | Seats, Attendees | integer | yes |
| delivery | Delivery, Delivery date | date | yes |

## Predict before running

Add the label Seats to two fields and predict where the program should stop. No source reading is needed to find this conflict.

```figure
pj-document-extraction-desk-1
```

Change the figure input and check the computed values. Relate one changed result to a line in your implementation; the figure is an explanatory model, not a replacement for the real program.

## Build and verify

From the repository root, initialize once. This copies public types, function stubs, a real command wrapper and original sample input. A fresh first-stage run should fail because the domain functions are not implemented.

```bash
python3 scripts/project_test.py document-extraction-desk --init my-document-extraction-desk
python3 scripts/project_test.py document-extraction-desk --stage 1 --path my-document-extraction-desk --strict
```

Implement the contract with the standard library. Trace the worked example by hand first. Keep caller inputs unchanged and reject malformed data with an actionable error. Tests import your workspace, never the reference solution.

## Hint ladder

1. Validate field shapes before iterating labels.
2. Track field names and normalized label identities separately.
3. Preserve display labels while comparing their case-folded form.

## What you should see

At this stage the grader reports real passing tests for stages 1 through 1. After completing all four stages, run the shipped tool on the supplied sample, then substitute your own input:

```bash
cd my-document-extraction-desk
python3 cli.py sample.txt --schema schema.json --output output/review.html
```

The final artifact is a local HTML review desk that downloads source-bound approval decisions and an approved JSON value map. Open the HTML and inspect the companion JSON instead of trusting an exit code alone. Change one input and explain exactly which result must change.

## Extend it

Add an optional contact field and show why its absence must not block required-field completion.

Scope: The core consumes UTF-8 text and explicitly labelled fields; it does not claim OCR or PDF parsing. External OCR or model adapters may supply proposals through --proposals, but every quote and offset is checked. Correct provenance alone does not establish correct field meaning.

Primary reference: [Python regular expression match offsets](https://docs.python.org/3/library/re.html#match-objects). The implementation and exercise data are original teaching examples.
