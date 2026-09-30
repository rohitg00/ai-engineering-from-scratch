# Classify conventional subjects

> feat(api)!: remove v1 -> type feat, scope api, breaking true

**Type:** Build
**Languages:** Go
**Stage:** 2 of 4
**Time:** ~2 hours

## Classify a subject without discarding migration risk

Conventional subjects are a useful language with a small grammar: type, optional scope, optional exclamation mark, colon-space, description. Real repositories also have merge commits and ordinary prose. Preserve those records as Other so the release editor can inspect them.

## Work through one case

`fix(api)!: rename timeout` gives kind fix, scope api, breaking true and description rename timeout. A separate `BREAKING CHANGE: Rename config.` footer also sets breaking true before this function runs. Your classifier must preserve that existing signal instead of overwriting it with the absence of an exclamation mark.

```figure
pj-changelog-writer-from-git-2
```

## Your task

```go
func Classify(c Commit)(Commit,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py changelog-writer-from-git --stage 2 --path /tmp/changelog-writer-from-git-work
```

The stage checks Feature, Scope, Breaking, Other, Blank. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Match the subject grammar once. Keep an unrecognized nonblank subject intact. Combine the incoming breaking flag with the marker using logical OR. An empty subject is invalid, not an Other entry.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Classify the same subject with the incoming breaking flag false and true. Which fields change, and why would replacing the flag lose migration evidence?

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--repo PATH --from REV --to REV` reads an immutable Git range. Alternatively, `--input FILE` accepts `git log --format=%H%x00%s%x00%b%x00 FROM..TO` output. Add `--output release.md --receipt release.json` for reusable artifacts. No argument means an original two-commit fixture. The supported repository profile uses SHA-1 commit IDs; SHA-256 repositories require a hash-format extension.

## Sources

[Git pretty formats](https://git-scm.com/docs/pretty-formats).
