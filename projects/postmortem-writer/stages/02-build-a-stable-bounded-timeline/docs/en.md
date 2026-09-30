# Build a stable bounded timeline

> event b at 5, event a at 1 -> a then b

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Time:** ~2 hours

## Separate ingestion order from timeline order

Logs can arrive out of order. A timeline orders the observed events without claiming that time order proves causality. Copy the input so another consumer can still inspect arrival order. Use event ID as the tie-breaker when two events share a second.

## Work through one case

Suppose b arrives at second 35, a at second 0 and c at second 35. Sorting yields a, b, c. With a horizon of 30, the operation fails instead of dropping b and c. A dropped event could be the observation that contradicts the draft explanation.

```figure
pj-postmortem-writer-2
```

## Your task

```go
func Timeline(events []Event,horizon int)([]Event,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py postmortem-writer --stage 2 --path /tmp/postmortem-writer-work
```

The stage checks Ordered, Tied, NoMutation, Bound, Empty. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Validate the horizon and every event time first. Copy the slice, then sort with second as the primary key and ID as the secondary key. Check both the output order and the unchanged input in your tests.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

What happens to the same three records with a horizon of exactly 35? Add a tied timestamp in a different arrival position and prove that the final packet is identical.

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--events FILE --review FILE --out DIRECTORY` produces index.html, packet.json and packet.txt. Run the supplied files with `--events ../examples/events.jsonl --review ../examples/review.json --out /tmp/incident-packet`. With no arguments, the CLI prints a small original fixture. Evidence checks establish source provenance; causal judgment and reviewer identity remain human responsibilities.

## Sources

[Google SRE postmortem practice](https://sre.google/workbook/postmortem-culture/).
