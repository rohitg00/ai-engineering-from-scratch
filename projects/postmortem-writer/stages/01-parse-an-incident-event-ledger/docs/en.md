# Parse an incident event ledger

> e1 tab 12 tab alert tab latency high -> Event at t=12

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Time:** ~2 hours

## Ingest evidence with a stable locator

Start with the small tab-separated ledger: event ID, elapsed second, kind and message. Every later claim depends on those identities. The provided JSONL importer converts explicit records to that contract and remembers the original physical line, including blank lines.

## Work through one case

An alert at second 12 is valid even when it is the first event supplied. A second event with the same ID is a conflict. In JSONL, a missing second is rejected instead of silently becoming zero. The importer retains line 2 when a blank first line precedes the event.

```figure
pj-postmortem-writer-1
```

## Your task

```go
func Parse(text string)([]Event,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py postmortem-writer --stage 1 --path /tmp/postmortem-writer-work
```

The stage checks Valid, Negative, Duplicate, Missing, Empty. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Parse the integer before appending. Require all four fields and nonnegative time. Keep a set of IDs and reject the complete batch on duplicates. The JSONL profile rejects unknown fields and embedded record separators so conversion cannot add a fake ledger row.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Try a malformed record after three valid records. What should the caller receive? Explain why preserving physical line numbers is more useful than numbering only the records that survived parsing.

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--events FILE --review FILE --out DIRECTORY` produces index.html, packet.json and packet.txt. Run the supplied files with `--events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet`. With no arguments, the CLI prints a small original fixture. Evidence checks establish source provenance; causal judgment and reviewer identity remain human responsibilities.

## Sources

[Google SRE postmortem practice](https://sre.google/workbook/postmortem-culture/).
