# Retain byte-accurate source spans

**Stage 1 of 4.** Rust. Plan about 2 hours.

Split UTF-8 source into numbered lines and retain exclusive byte offsets into the original buffer. Strip only the line terminator. A finding must quote the exact slice rather than reconstructing evidence after normalization.

```figure
pj-skill-scanner-1
```

## Implementation boundary

```rust
pub fn spans(text:&str,max_bytes:usize)->Result<Vec<Span>,Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

Source evidence uses byte offsets. A line containing café occupies more UTF-8 bytes than visible letters, so character indices cannot safely slice a Rust string. Preserve start and end offsets while splitting lines.

```text
text="café\n.env"
first line bytes [0,5)
second line bytes [6,10)
```

## Build and inspect

Advance the cursor by the original line bytes, including the newline. Strip CRLF only from the displayed quote.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-scanner --init learning-artifacts/skill-scanner
python3 scripts/project_test.py skill-scanner --stage 1 --path learning-artifacts/skill-scanner
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How would a wrong offset turn an otherwise correct finding into invalid evidence?
