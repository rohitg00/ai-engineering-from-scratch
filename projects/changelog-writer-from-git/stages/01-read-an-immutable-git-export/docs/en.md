# Read an immutable Git export

> git log --format=%h%x09%s -> hash and subject

**Type:** Build
**Languages:** Go
**Stage:** 1 of 4
**Time:** ~2 hours

## Read records without losing the evidence

A Git commit has a hash, a subject and a body. The first exercise deliberately starts with hash-tab-subject records so you can learn the parsing boundary before the provided Git adapter handles NUL-delimited bodies. Never split a full commit body on newlines and pretend each line is a new commit.

## Work through one case

The two records `abc1234\tfeat: cache` and `abc1234\tfix: cache` conflict even though their subjects differ. Build a set of accepted hashes. Check the second hash before appending its record; return a conflict with no partial result.

```figure
pj-changelog-writer-from-git-1
```

## Your task

```go
func ParseLog(text string)([]Commit,error)
```

Implement these public signatures in your workspace. Keep invalid input separate from a budget limit or state conflict. Preserve the original evidence or input record whenever an operation fails. Tests load your workspace directly, so implementing a different function in the checked-in solution does not advance your stage.

## Run the tests

```bash
python3 scripts/project_test.py changelog-writer-from-git --stage 1 --path /tmp/changelog-writer-from-git-work
```

The stage checks Valid, Duplicate, BadHash, NoSubject, Empty. Use the failing case to locate the invariant you violated. Passing the normal example alone does not establish the boundary behavior.

## Implementation hints

Use SplitN with a limit of two so the first separator defines the boundary. Validate every hash character, then reject an empty subject. The integration adapter retains body text separately and caps exports at 4 MiB.

Start with one valid record, then add the rejection case before optimizing. Keep source data unchanged on failure so the caller can diagnose what happened. Use the smallest function that expresses the boundary; an extra framework would hide the mechanism you are learning.

## Check your understanding

Why can a commit body contain a newline while a subject export cannot? Construct a truncated NUL export and explain why the adapter refuses it.

Write your prediction before running the test. If the result surprises you, trace the input through validation, state construction and output. A passing reference implementation is a comparison tool; your own workspace must pass the cumulative grader to establish completion.

## Use it with your own data

`--repo PATH --from REV --to REV` reads an immutable Git range. Alternatively, `--input FILE` accepts `git log --format=%H%x00%s%x00%b%x00 FROM..TO` output. Add `--output release.md --receipt release.json` for reusable artifacts. No argument means an original two-commit fixture. The supported repository profile uses SHA-1 commit IDs; SHA-256 repositories require a hash-format extension.

## Sources

[Git pretty formats](https://git-scm.com/docs/pretty-formats).
