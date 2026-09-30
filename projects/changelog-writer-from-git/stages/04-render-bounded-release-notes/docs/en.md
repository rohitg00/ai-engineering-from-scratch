# Render bounded release notes

> commit `[x](bad)` -> escaped literal label in release notes

**Type:** Build
**Languages:** Go
**Stage:** 4 of 4
**Time:** ~2 hours

## Build a release artifact from an actual repository

The CLI accepts your repository path and two revisions. It resolves both names to immutable commit IDs, reads the exclusive-from to inclusive-to range and produces Markdown plus an optional JSON receipt. It never changes the checkout or publishes a release.

## Work through one case

Run `go run . --repo /path/to/repo --from v1.0 --to HEAD --label v1.1 --output release.md --receipt release.json`. Inspect the receipt hash and the migration section. A footer identifies what an author said must change; it does not prove that those instructions are complete.

```figure
pj-changelog-writer-from-git-4
```

## Your task

```go
func Release(label string,commits []Commit,max int)(string,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py changelog-writer-from-git --stage 4 --path /tmp/changelog-writer-from-git-work
```

The stage checks Output, BadLabel, Limit, Escape, SectionOrder. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Validate the label and commit budget before rendering. Escape the description as literal Markdown, use a fixed section order and include every source hash. The provided adapter uses argument arrays, a ten-second deadline and a bounded output buffer; no shell interprets commit text.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Generate a release from a tiny temporary repository, then compare git status before and after. Change one source commit in a new branch and show that the export fingerprint changes. Review explicit revert references before publishing manually.

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--repo PATH --from REV --to REV` reads an immutable Git range. Alternatively, `--input FILE` accepts `git log --format=%H%x00%s%x00%b%x00 FROM..TO` output. Add `--output release.md --receipt release.json` for reusable artifacts. No argument means an original two-commit fixture. The supported repository profile uses SHA-1 commit IDs; SHA-256 repositories require a hash-format extension.

## Sources

[Git pretty formats](https://git-scm.com/docs/pretty-formats).
