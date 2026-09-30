# Select the least costly sufficient profile

**Stage 3 of 4.** Rust. Plan about 2 hours.

Filter insufficient profiles before comparing cost. Respect the configured cost ceiling, break ties by name, and return an explicit no-suitable-profile error. Never downgrade a required isolation control merely because the budget is too small.

```figure
pj-sandbox-ladder-3
```

## Implementation boundary

```rust
pub fn select(n:&Needs,candidates:&[Profile],budget:u32)->Result<Profile,Error>
```

Primary reference: [Official reference](https://docs.docker.com/engine/security/).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Docker for AI](../../../../../phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md). Complete [stage 2](../../02-define-modeled-control-profiles/docs/en.md) first.

The cheapest sufficient profile may exceed the allowed budget. When kernel separation is required, budget 4 cannot silently downgrade to a container costing 3.

```text
kernel separation required; candidates costs 1,2,3,5
budget 4 -> no sufficient profile
budget 5 -> microvm-fixture
```

## Build and inspect

Filter by capabilities first, then cost, then stable name ordering. Return a limit error if the remaining set is empty.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py sandbox-ladder --stage 3 --path learning-artifacts/sandbox-ladder
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should change when two sufficient profiles have the same modeled cost?
