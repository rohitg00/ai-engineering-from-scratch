# Parse an explicit frontmatter subset

**Stage 1 of 4.** Rust. Plan about 2 hours.

Split only a leading --- block. Accept plain or JSON-compatible double-quoted single-line key/value pairs; preserve colons inside values, reject duplicate keys, and never interpret YAML tags or aliases. This parser is intentionally a subset of YAML rather than a general-purpose implementation.

```figure
pj-skill-validator-1
```

## Implementation boundary

```rust
pub fn parse(text: &str) -> Result<std::collections::BTreeMap<String,String>, Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

The installer emits quoted metadata. Accept plain single-line scalars and JSON-compatible double-quoted scalars, including escaped quotes and Unicode. Reject tags, aliases and multiline YAML rather than silently reinterpreting them.

```text
description: "Check \"replicas\" first"
parsed description: Check "replicas" first
description: | -> unsupported syntax
```

## Build and inspect

Split a header line at its first colon. Decode quoted values before metadata validation; duplicate keys are conflicts.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-validator --init learning-artifacts/skill-validator
python3 scripts/project_test.py skill-validator --stage 1 --path learning-artifacts/skill-validator
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why does a standards-compatible subset need an explicit unsupported-syntax error?
