# Extraction Review Report: Support Policy Changes

## Extraction Contract

Each record includes policy ID, effective date or `null`, region, action type,
threshold or `null`, evidence span, source version, and review state. Unknown is
representable and additional fields are rejected.

## Batch Manifest

Job `policy-w32-review` contains 40 inputs joined by stable `custom_id`, source
version, schema `policy-change-2`, and expected output. The fixture returns
shuffled results with two dependency failures and preserves 38 successful
records. The dated planning assumption is a 50% Message Batches cost reduction,
an up-to-24-hour service window, and no guaranteed latency SLA; deployment must
recheck the current API documentation.

## Validation Layers

Syntax parsed 40 of 40. Schema accepted 40. Semantic validation rejected one
deadline before its source effective date. Provenance validation rejected one
invented threshold absent from its evidence span.

## Reviewer Findings

An independent reviewer returned stable findings `REV-017` and `REV-018` with
field, source span, reason, and disposition. It did not silently rewrite output.

## Adjudication

The qualified policy owner set the unsupported threshold to `null`, confirmed
the deadline exception, and recorded reason codes. Repeated ambiguity escalates
instead of entering another retry.

## Metrics

Field precision: 0.98. Evidence-support rate: 1.00 after adjudication. High-risk
false positives: 0. Reviewer disagreement: 2 of 40. Cost per accepted record:
0.014 units.
