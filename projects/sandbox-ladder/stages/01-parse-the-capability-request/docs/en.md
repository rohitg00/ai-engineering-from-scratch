# Parse the capability request

**Stage 1 of 4.** Rust. Plan about 2 hours.

Represent the threat model as four explicit booleans: untrusted code, secret-bearing host, denied network and required kernel separation. Reject unknown keys and ambiguous boolean values. A policy evaluator is only as useful as the request it actually understood.

```figure
pj-sandbox-ladder-1
```

## Implementation boundary

```rust
pub fn needs(text:&str)->Result<Needs,Error>
```

Primary reference: [Official reference](https://docs.docker.com/engine/security/).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Docker for AI](../../../../../phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md).

Write the threat requirement as booleans before selecting a runtime. Here network=true means network denial is required, and host_kernel=true means a separate kernel is required. Neither name grants access.

```text
untrusted=true,secrets=true,network=true,host_kernel=false
required: filesystem boundary + denied network
```

## Build and inspect

Reject duplicate keys and values other than exact true/false. Do not guess what network=yes means.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py sandbox-ladder --init learning-artifacts/sandbox-ladder
python3 scripts/project_test.py sandbox-ladder --stage 1 --path learning-artifacts/sandbox-ladder
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Which additional requirement would make a shared-kernel container insufficient?
