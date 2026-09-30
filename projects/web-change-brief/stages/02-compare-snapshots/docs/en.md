# Compare exact text and preserve duplicates

> Build stable snapshots and count added and removed text occurrences.

**Type:** Build  
**Language:** Go  
**Stage:** 2 of 4  
**Time:** About 2 hours

## What you are building

A set loses repeated text. Use counts per normalized block so one repeated notice disappearing is still a change. The comparison ignores block order deliberately: moving an unchanged notice between sections is not a text edit in this project. Sort output rows for stable reports.

```figure
pj-web-change-brief-2
```

## Work through an example

Before contains A, A, B; after contains A, B, C. The report removes one occurrence of A, adds one C and counts two unchanged blocks. Reordering A and B alone changes neither the report nor the content hash.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `CanonicalURL(raw string) (string, error)`
- `NewSnapshot(rawURL, input string, ignores []string) (Snapshot, error)`
- `Compare(before, after Snapshot) (Brief, error)`

Canonicalize HTTP(S) URLs by rejecting credentials, lowercasing the host, dropping fragments and supplying / for an empty path. Preserve query strings. Compare only snapshots with exactly the same canonical URL. Hash the JSON serialization of sorted blocks with SHA-256. Added and removed entries contain text and count; unchanged counts preserved occurrences.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Build two maps of block counts, then use the minimum for unchanged occurrences and positive differences for additions/removals. JSON serialization avoids ambiguity between a single block containing separators and several blocks.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py web-change-brief --init my-web-change-brief
python3 scripts/project_test.py web-change-brief --stage 2 --path my-web-change-brief
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Why does a content hash not establish who published the page or when? Which changes are intentionally invisible when order is ignored?

## Connect it to the finished artifact

A standalone change report, changes.json and a reusable baseline.json snapshot. The extractor is a deliberately limited readable-block scanner, not an HTML5 DOM or browser. It does not execute JavaScript, evaluate CSS visibility or fetch linked resources. Block order is ignored; repeated text counts are retained. Filtering phrases can hide useful changes, so use the same explicit filter policy for both snapshots.

After completing the project, try your own inputs:

```bash
cd my-web-change-brief
go run . --before fixtures/before.html --after fixtures/after.html --url https://example.invalid/makerspace --out ./web-change-output
```

Add a separate order-change report using a sequence algorithm. Keep text additions distinct so a moved paragraph does not become a misleading deletion plus addition.

## Primary reference

[Official API documentation](https://pkg.go.dev/net/http). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
