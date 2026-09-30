# Group commits with stable ordering

> feat! appears under Breaking changes, not Features

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Time:** ~2 hours

## Make release groups reproducible

Grouping is an ordered decision. Breaking behavior takes precedence over feature or fix. Sorting inside each group makes the output independent of the order in which records reached your program. The source commit remains available in a separate JSON receipt.

## Work through one case

Input hashes bbbbbbb for a fix and aaaaaaa for a fix become aaaaaaa then bbbbbbb. Add ccccccc with `feat!: new wire format`; it belongs only to Breaking changes. Sorting the original input slice would surprise another caller, so classify values into new group slices.

```figure
pj-changelog-writer-from-git-3
```

## Your task

```go
func Group(commits []Commit)(map[string][]Commit,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py changelog-writer-from-git --stage 3 --path /tmp/changelog-writer-from-git-work
```

The stage checks Features, BreakingFirst, Stable, Unknown, Empty. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Create the group map, classify one record at a time, then sort each resulting slice by hash. Do not emit sections by ranging over the map because map iteration does not establish a stable presentation order.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Shuffle the same commit list repeatedly and compare the rendered bytes. A revert must remain visible alongside its target; explain why silently subtracting both commits could hide a later follow-up change.

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--repo PATH --from REV --to REV` reads an immutable Git range. Alternatively, `--input FILE` accepts `git log --format=%H%x00%s%x00%b%x00 FROM..TO` output. Add `--output release.md --receipt release.json` for reusable artifacts. No argument means an original two-commit fixture. The supported repository profile uses SHA-1 commit IDs; SHA-256 repositories require a hash-format extension.

## Sources

[Git pretty formats](https://git-scm.com/docs/pretty-formats).
