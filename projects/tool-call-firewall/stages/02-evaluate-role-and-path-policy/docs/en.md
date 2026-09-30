# Evaluate role and path policy

**Stage 2 of 4.** Rust. Plan about 2 hours.

Only reader and editor roles exist. Reads use relative paths; writes require the editor role and approval. Reject parent components, absolute paths, hidden top-level paths and unknown tools. This checks lexical policy; the actual file adapter must enforce symlink-safe containment.

```figure
pj-tool-call-firewall-2
```

## Implementation boundary

```rust
pub fn decide(c:&Call)->Decision
```

Primary reference: [Official reference](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md). Complete [stage 1](../../01-validate-an-unambiguous-call-envelope/docs/en.md) first.

Policy denies unknown roles, unsupported tools and unsafe path components. A reader may read a contained note; an editor write needs approval. A lexical allow is still followed by actual filesystem containment in dispatch.

```text
reader + read notes.md -> Allow
reader + write notes.md -> Deny
editor + write notes.md -> ApprovalRequired
```

## Build and inspect

Make Deny the default branch. Check canonical paths before real file access; do not mistake a policy verdict for OS isolation.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tool-call-firewall --stage 2 --path learning-artifacts/tool-call-firewall
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why can a symlink escape even when its relative name contains no parent component?
