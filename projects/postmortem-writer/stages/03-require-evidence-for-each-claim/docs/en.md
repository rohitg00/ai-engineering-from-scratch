# Require evidence for each claim

> claim cites e99 but ledger contains e1 -> invalid

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Time:** ~2 hours

## Distinguish a citation from a conclusion

A valid citation points to a distinct known event. That proves the source exists. It does not prove that the event logically establishes a causal claim. The composed review desk also checks exact quotations, keeps claims pending and requires an explicit reviewer and matching source hash for approved records.

## Work through one case

The claim "An alert followed deployment" cites e1 and e2. Both IDs exist, so provenance passes. The stronger claim "Deployment caused the outage" can cite the same two IDs and still require investigation. A quote saying "database failed" is rejected when the source only says "latency high".

```figure
pj-postmortem-writer-3
```

## Your task

```go
func Verify(claim Claim,events []Event)error
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py postmortem-writer --stage 3 --path /tmp/postmortem-writer-work
```

The stage checks Supported, Dangling, NoEvidence, Duplicate, Blank. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Build a set of known event IDs and a separate set for evidence IDs within the claim. Reject blank claim text, missing evidence, duplicate citations and dangling references. Never fill in a missing source with a plausible substitute.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Invent two different claims that cite the same events. Explain which checks your code can perform and which judgment remains with a reviewer. Why must an approved decision become stale when the underlying log changes?

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--events FILE --review FILE --out DIRECTORY` produces index.html, packet.json and packet.txt. Run the supplied files with `--events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet`. With no arguments, the CLI prints a small original fixture. Evidence checks establish source provenance; causal judgment and reviewer identity remain human responsibilities.

## Sources

[Google SRE postmortem practice](https://sre.google/workbook/postmortem-culture/).
