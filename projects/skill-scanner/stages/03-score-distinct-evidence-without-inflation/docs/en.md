# Score distinct evidence without inflation

**Stage 3 of 4.** Rust. Plan about 2 hours.

Count each rule once per source line even if a collector repeats a finding. Sum severity with checked arithmetic. Reject out-of-range severities and impossible offsets so malformed scanner data cannot masquerade as a low score.

```figure
pj-skill-scanner-3
```

## Implementation boundary

```rust
pub fn risk_score(findings:&[Finding])->Result<u32,Error>
```

Primary reference: [Official reference](https://agentskills.io/specification).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 2](../../02-detect-named-advisory-patterns/docs/en.md) first.

A finding earns its severity once per rule and source line. Duplicating the same detection must not increase risk, while two distinct capabilities on one line remain separate evidence.

```text
line 7 secret-access severity 2, repeated twice -> 2
line 7 network-command severity 2 -> total 4
```

## Build and inspect

Deduplicate by rule and line after validating ranges and severity. Use checked addition for the total.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py skill-scanner --stage 3 --path learning-artifacts/skill-scanner
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why would deduplicating only by line hide a second capability?
