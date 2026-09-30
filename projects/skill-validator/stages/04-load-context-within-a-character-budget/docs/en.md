# Load context within a character budget

**Stage 4 of 4.** Rust. Plan about 2 hours.

Discovery returns name and description. Activation appends the body only when the requested budget can hold the complete text. Refuse partial instructions rather than truncating in the middle of a constraint. The budget is characters, not a model-token estimate.

```figure
pj-skill-validator-4
```

## Implementation boundary

```rust
pub fn disclose(skill: &Skill, activate: bool, budget: usize) -> Result<String, Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 3](../../03-contain-resource-paths/docs/en.md) first.

Discovery loads metadata only; activation appends instructions. The CLI can then append one explicit reference if the complete context fits. Count characters, not bytes or model tokens, and never truncate half an instruction.

```text
metadata length=80; body=120; separators=2
activation needs 202 characters
budget 200 -> Limit
```

## Build and inspect

Assemble the complete context before comparing its character count with the budget. Include separators and requested resource text.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-validator --stage 4 --path learning-artifacts/skill-validator
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
rustc --edition=2021 learning-artifacts/skill-validator/cli.rs -o learning-artifacts/skill-validator/validator
learning-artifacts/skill-validator/validator projects/skill-validator/examples/orchard-release 2000 --activate references/restore.md
```

The parser accepts plain single-line values and JSON-compatible quoted strings. It intentionally rejects multiline YAML, aliases, tags and flow collections. Discovery and activated context use character budgets, not model tokens. Existing canonical paths must remain within the supplied skill directory.

## Investigate next

How would you expose a tokenizer-based budget without confusing it with this character limit?
