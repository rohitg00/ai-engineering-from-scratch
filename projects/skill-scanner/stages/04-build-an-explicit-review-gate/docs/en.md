# Build an explicit review gate

**Stage 4 of 4.** Rust. Plan about 2 hours.

A threshold crossing requests review; below threshold means only that these rules did not cross the configured threshold. Limit finding count, validate all source slices, and emit a text report with line numbers and literal quotes. The gate never executes skill instructions.

```figure
pj-skill-scanner-4
```

## Implementation boundary

```rust
pub fn review(text:&str,findings:&[Finding],threshold:u32,max_findings:usize)->Result<String,Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 3](../../03-score-distinct-evidence-without-inflation/docs/en.md) first.

Traverse the caller bundle and emit file paths, line numbers, byte offsets and quoted source in versioned JSON. The threshold requests a review; falling below it is not a declaration that a skill is safe.

```text
benign bundle -> below-threshold
reviewable bundle -> review-required
findings retain path + exact source slice
```

## Build and inspect

Reject symlinks and bound file count and bytes before scanning. Keep review state separate from installer integrity checks.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-scanner --stage 4 --path learning-artifacts/skill-scanner
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
rustc --edition=2021 learning-artifacts/skill-scanner/cli.rs -o learning-artifacts/skill-scanner/scanner
learning-artifacts/skill-scanner/scanner projects/skill-scanner/examples/reviewable 3
```

The scanner emits versioned JSON with file paths, exact UTF-8 byte spans and advisory rules. Explicit patterns can miss obfuscation and flag benign documentation. below-threshold does not mean safe; scan status never replaces installation integrity or human review.

## Investigate next

Which newly introduced finding would you discuss before approving an upgrade?
