# Consume a request-bound approval once

**Stage 3 of 4.** Rust. Plan about 2 hours.

An approval stores the complete typed request: ID, role, tool and argument. It is consumed only for an approval-required decision. A mismatched, used or denied request fails without mutating the approval. Changing arguments while retaining the same displayed ID is a conflict. The application creates this record only after the user approves that exact request.

```figure
pj-tool-call-firewall-3
```

## Implementation boundary

```rust
pub fn authorize(c:&Call,approval:Option<&mut Approval>)->Result<(),Error>
```

Primary reference: [Official reference](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md). Complete [stage 2](../../02-evaluate-role-and-path-policy/docs/en.md) first.

The real file dispatcher binds approval to the typed request and write content. It consumes the receipt before executing the write. A changed payload or replay fails and cannot write again.

```text
approved content="approved after restore"
changed content -> Conflict, file unchanged
exact content -> write, used=true
replay -> Conflict
```

## Build and inspect

Validate payload size and actual containment before consuming approval. Keep the single-use receipt in the same trusted application boundary as dispatch.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tool-call-firewall --stage 3 --path learning-artifacts/tool-call-firewall
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What persistent receipt store would you need before allowing approval reuse across process restarts?
