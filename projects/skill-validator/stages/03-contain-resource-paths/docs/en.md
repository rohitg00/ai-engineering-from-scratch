# Contain resource paths

**Stage 3 of 4.** Rust. Plan about 2 hours.

Resolve resource names relative to a skill root. Reject absolute paths, parent components and Windows separators before joining, then canonicalize existing paths so a symlink cannot escape. Canonicalization checks the current filesystem; a production adversarial loader needs descriptor-relative opens to close later replacement races.

```figure
pj-skill-validator-3
```

## Implementation boundary

```rust
pub fn reference_path(root: &std::path::Path, resource: &str) -> Result<std::path::PathBuf, Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 2](../../02-validate-names-and-descriptions/docs/en.md) first.

Resource lookup is relative to the skill folder. Resolve references/restore.md and verify its canonical path stays within that folder; reject parent traversal before reading anything.

```text
resource references/restore.md -> contained file
resource ../private.md -> invalid component
symlink outside root -> escapes root
```

## Build and inspect

Validate path components before joining, then canonicalize. This educational loader does not close adversarial path-replacement races.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-validator --stage 3 --path learning-artifacts/skill-validator
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why is starts_with on raw path text insufficient for containment?
