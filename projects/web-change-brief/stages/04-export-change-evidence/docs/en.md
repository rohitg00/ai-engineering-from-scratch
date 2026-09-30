# Export a brief a person can inspect

> Show exact added and removed statements beside the source and hashes.

**Type:** Build  
**Language:** Go  
**Stage:** 4 of 4  
**Time:** About 2 hours

## What you are building

The report should answer what changed without requiring someone to read raw HTML. List the exact added and removed normalized statements, their occurrence counts and the number of unchanged blocks. Include the source URL and both hashes so another tool can relate the brief to saved snapshots.

```figure
pj-web-change-brief-4
```

## Work through an example

The makerspace fixture changes the repair start from 14:00 to 15:00, reduces volunteer availability from three places to one, and adds a step-free entrance note. Changing the navigation count and footer timestamp does not appear. The report preserves the before and after statements instead of inventing a summary of their intent.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `ExportBrief(brief Brief, directory string) error`
- `CLI flags: --before, --after, --url, --out, --fetch, --baseline, --accept, --ignore`

Write changes.json and index.html. Use html/template so untrusted page text is escaped and URL contexts are handled safely. Empty change lists display an explicit no-change message. The CLI also writes the new snapshot to the output directory; live mode overwrites an existing baseline only when --accept is supplied. Errors return a nonzero exit code.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Build a Brief with a script-looking text block and verify the HTML contains escaped text. Decode the JSON report and inspect occurrence counts. Run the actual CLI on different saved files, then open its output rather than judging the page from the template source alone.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py web-change-brief --init my-web-change-brief
python3 scripts/project_test.py web-change-brief --stage 4 --path my-web-change-brief
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

What can the person confirm directly from this report, and what would require the original HTML or rendered page? Why should a generated narrative never replace exact change evidence?

## Connect it to the finished artifact

A standalone change report, changes.json and a reusable baseline.json snapshot. The extractor is a deliberately limited readable-block scanner, not an HTML5 DOM or browser. It does not execute JavaScript, evaluate CSS visibility or fetch linked resources. Block order is ignored; repeated text counts are retained. Filtering phrases can hide useful changes, so use the same explicit filter policy for both snapshots.

After completing the project, try your own inputs:

```bash
cd my-web-change-brief
go run . --before fixtures/before.html --after fixtures/after.html --url https://example.invalid/makerspace --out ./web-change-output
```

Add a review note field or Markdown export for a team handoff. Keep automatic outbound notifications as a separately configured integration with its own tests.

## Primary reference

[Official API documentation](https://pkg.go.dev/net/http). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
