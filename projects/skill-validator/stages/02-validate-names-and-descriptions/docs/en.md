# Validate names and descriptions

**Stage 2 of 4.** Rust. Plan about 2 hours.

The loader accepts only lowercase names of 1 to 64 bytes with single interior hyphens, no leading digit restriction, and a nonblank description up to 1024 characters. Validate the skill directory name against metadata so discovery cannot silently rename a package.

```figure
pj-skill-validator-2
```

## Implementation boundary

```rust
pub fn validate(fields: &std::collections::BTreeMap<String,String>, directory: &str) -> Result<Skill, Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 1](../../01-parse-an-explicit-frontmatter-subset/docs/en.md) first.

Metadata identifies a package. Orchard-release with an uppercase letter fails the portable lowercase grammar; orchard-release in a differently named directory fails identity validation.

```text
directory=orchard-release
name=orchard-release -> valid
name=orchard--release -> invalid name
```

## Build and inspect

Count name bytes and description Unicode scalar values according to the contract. Preserve the human description after parsing.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-validator --stage 2 --path learning-artifacts/skill-validator
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why should changing a directory name require changing metadata too?
