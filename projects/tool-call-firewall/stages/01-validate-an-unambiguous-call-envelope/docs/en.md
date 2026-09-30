# Validate an unambiguous call envelope

**Stage 1 of 4.** Rust. Plan about 2 hours.

Parse a bounded four-field envelope using a pipe delimiter for this local exercise. Reject missing identity, control characters and overlong input. This grammar is intentionally narrower than JSON and must not be quietly reused as a general wire protocol.

```figure
pj-tool-call-firewall-1
```

## Implementation boundary

```rust
pub fn call(line:&str,max_bytes:usize)->Result<Call,Error>
```

Primary reference: [Official reference](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md).

The caller application supplies identity; the model supplies only a proposed operation. The compact Rust envelope carries a stable request id, role, tool and relative argument without ambiguous delimiters or controls.

```text
r1|reader|read|notes.md -> typed request
r1|reader|read|notes.md|extra -> reject
```

## Build and inspect

Validate the entire bounded envelope before policy evaluation. In the CLI, trusted-role is an operator argument, not a field accepted from model text.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tool-call-firewall --init learning-artifacts/tool-call-firewall
python3 scripts/project_test.py tool-call-firewall --stage 1 --path learning-artifacts/tool-call-firewall
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What would break if a model could replace reader with editor?
