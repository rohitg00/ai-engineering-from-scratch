# Publish a deterministic incident packet

> validated claim + ordered evidence -> one complete packet

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Time:** ~2 hours

## Publish a packet that exposes unfinished review

The text packet, HTML desk and JSON receipt describe the same validated input. The HTML includes source links, physical line locators, reported impact, claim decisions and owned follow-up actions. Pending claims and unassigned work remain visible rather than disappearing from the final report.

## Work through one case

Run `go run . --events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet`. Open index.html and follow e2 back to its exact log line. To approve a claim, copy SourceSHA256 from packet.json into sourceSHA256 in the review file, set state to approved and provide a reviewer label, then rebuild.

```figure
pj-postmortem-writer-4
```

## Your task

```go
func Report(events []Event,claims []Claim,maxClaims int)(string,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py postmortem-writer --stage 4 --path /tmp/postmortem-writer-work
```

The stage checks Packet, Limit, InvalidAtomic, Escaped, Deterministic. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Call Verify for every claim before producing output, then order the timeline. Reject claim counts above the cap. HTML uses Go templates so a message containing a script tag remains text. Approval identity is a supplied label, not an authenticated signature.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Change a log byte after approval and confirm the build fails with a source conflict. The integration tests also reject fabricated quotations and missing timestamps. Connect a log exporter to JSONL as an extension; preserve the evidence contract rather than adding invented causal explanations.

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--events FILE --review FILE --out DIRECTORY` produces index.html, packet.json and packet.txt. Run the supplied files with `--events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet`. With no arguments, the CLI prints a small original fixture. Evidence checks establish source provenance; causal judgment and reviewer identity remain human responsibilities.

## Sources

[Google SRE postmortem practice](https://sre.google/workbook/postmortem-culture/).
