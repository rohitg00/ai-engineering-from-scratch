# Confine file tools to a bounded root

**Stage 2 of 4.** Rust. Plan about 2 hours.

Canonicalize the workspace root and requested targets, reject absolute and parent-traversing paths, and verify that symlinks remain inside the root. Limit text reads to 16 KiB, directory results to 100 entries and searches to 50 matching lines. These are application-level constraints for a trusted local workspace; hostile concurrent symlink replacement requires stronger OS primitives or isolation.

```figure
pj-rust-agent-shell-2
```

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 1](../../01-grammar/docs/en.md) first.

Resolve release.md under the workspace root before reading it. A lexical path can look harmless while a symlink targets a file outside the workspace. The result is application-level containment, not a process sandbox.

```text
workspace=/work/orchard
release.md -> /work/orchard/release.md -> allowed
link.md -> /outside/credentials -> rejected
```

## Build and inspect

Canonicalize the root and target, then compare path components. Bound the bytes read as well as the initial metadata length.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rust-agent-shell --stage 2 --path learning-artifacts/rust-agent-shell
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Which race remains if another process replaces a path after canonicalization?
