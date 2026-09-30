# Record bounded audit evidence

**Stage 4 of 4.** Rust. Plan about 2 hours.

Format a stable tab-separated audit row after the policy decision. Reject duplicate call IDs and cap retained entries. Arguments are omitted to avoid logging secret contents; IDs, role, tool and decision remain sufficient to count authorization outcomes.

```figure
pj-tool-call-firewall-4
```

## Implementation boundary

```rust
pub fn audit(log:&mut Vec<String>,c:&Call,d:&Decision,max_entries:usize)->Result<(),Error>
```

Primary reference: [Official reference](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Tool schema design](../../../../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md). Complete [stage 3](../../03-consume-a-request-bound-approval-once/docs/en.md) first.

The compact audit records outcomes without copying file contents. The executable returns request id, relative argument, decision, output and whether approval was consumed and replay denied. Record request identity with the application result when integrating it.

```text
request r1 -> one policy row
file write succeeds -> approval_consumed=true
second dispatch -> replay_denied=true
```

## Build and inspect

Reject duplicate audit ids and full logs before appending. This bounded in-memory audit is not a durable tamper-evident log.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tool-call-firewall --stage 4 --path learning-artifacts/tool-call-firewall
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
rustc --edition=2021 learning-artifacts/tool-call-firewall/cli.rs -o learning-artifacts/tool-call-firewall/firewall
learning-artifacts/tool-call-firewall/firewall projects/tool-call-firewall/examples/workspace reader r1 read notes.md
```

The native CLI requires a trusted role from the invoking application. Reads and writes pass through dispatch, which validates canonical containment and binds writes to exact content. Approvals are single-use in memory within one invocation. The code is a file-tool enforcement example, not a persistent cross-process authority or OS sandbox.

## Investigate next

Which nonsecret fields would you hash to connect a durable approval receipt with an execution result?
