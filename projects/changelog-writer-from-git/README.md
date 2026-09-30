# Changelog Writer From Git

Read a real Git revision range, preserve migration footers and revert references, then export reproducible Markdown with a source receipt.

Level 2. Four stages, about eight hours. Implementation: Go, standard library only.

## Before you start

Use Go 1.22 or later and Python 3.12 or later for the grader. Be comfortable with functions, structs, slices, maps and returned errors. Complete the [environment setup](../../phases/00-setup-and-tooling/01-dev-environment/docs/en.md) and [data management lesson](../../phases/00-setup-and-tooling/09-data-management/docs/en.md) first if these are unfamiliar.

## Stages

1. [Read an immutable Git export](stages/01-read-an-immutable-git-export/docs/en.md)
2. [Classify conventional subjects](stages/02-classify-conventional-subjects/docs/en.md)
3. [Group commits with stable ordering](stages/03-group-commits-with-stable-ordering/docs/en.md)
4. [Render bounded release notes](stages/04-render-bounded-release-notes/docs/en.md)

## Build it

```bash
python3 scripts/project_test.py changelog-writer-from-git --init /tmp/changelog-writer-from-git-work
python3 scripts/project_test.py changelog-writer-from-git --stage 1 --path /tmp/changelog-writer-from-git-work
python3 scripts/project_test.py changelog-writer-from-git --all --solution --strict
```

## Run the artifact

```bash
cd projects/changelog-writer-from-git/solution
go run .
```

`--repo PATH --from REV --to REV` reads an immutable Git range. Alternatively, `--input FILE` accepts `git log --format=%H%x00%s%x00%b%x00 FROM..TO` output. Add `--output release.md --receipt release.json` for reusable artifacts. No argument means an original two-commit fixture. The supported repository profile uses SHA-1 commit IDs; SHA-256 repositories require a hash-format extension.

The CLI and integration adapter are supplied in the learner starter. Implement the four stage functions; the adapter composes those same functions and cannot bypass unfinished work. Read integration.go after the core stages to see file boundaries, receipts and rendering.

The demo exercises the real reference implementation with offline fixtures and terminates. Each stage has at least five distinct tests, including boundaries and rejected inputs. Expected behavior lives in the stage tests; the implementation never reads the held-out test files. The grader preserves your code during initialization and reports incomplete runs honestly when a runtime is missing.

## Completion evidence

```bash
python3 scripts/project_test.py changelog-writer-from-git --all --path /tmp/changelog-writer-from-git-work --strict --report /tmp/changelog-writer-from-git-result.json
```

Only a complete learner report can establish local completion. Reference runs do not grant a certificate. Reports are unsigned local evidence, and the project does not certify production readiness.

## Sources

[Official reference](https://git-scm.com/docs/pretty-formats). All implementations and exercises are original. Fixture numbers are examples, not external benchmark claims or live service guarantees.
