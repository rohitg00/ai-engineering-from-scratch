# Stream bounded JSON events through real stdin

**Stage 4 of 4.** Rust. Plan about 2 hours.

Read input incrementally with BufRead and cap each line before allocating an unbounded string. Process the last unterminated line at EOF and accept CRLF. Escape control characters in JSON output and flush after each event so a parent agent sees results immediately. The demo compiles the actual binary and feeds the same loop a deterministic script. Interactive mode reads the user terminal until quit, EOF or the action budget.

```figure
pj-rust-agent-shell-4
```

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 3](../../03-session/docs/en.md) first.

A client reads one JSON event at a time and matches it to the request id added by the adapter. Flushing every line allows a UI to display observations without waiting for the process to exit.

```text
request evidence -> {request_id:evidence, seq:2, kind:ok}
output: 2:Restore evidence: rehearsal completed at 09:20 UTC.
```

## Build and inspect

Use BufRead chunks to bound allocation before constructing a command string. JSON-escape tool output rather than concatenating raw file text.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rust-agent-shell --stage 4 --path learning-artifacts/rust-agent-shell
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/rust-agent-shell/client.py projects/rust-agent-shell/examples/workspace projects/rust-agent-shell/examples/requests.jsonl --limit 8 --out observations.jsonl
```

JSONL requests use caller ids and explicit tool argument objects. The adapter translates them to the bounded Rust stdin grammar. --limit controls actions; native file reads remain capped at 16 KiB. Application path checks do not provide OS isolation or close adversarial replacement races.

The supplied Python adapter writes one receipt per input id, retaining all native responses. Requests without a response after quit, budget exhaustion, or process termination receive terminal `kind: "not-executed"` receipts with the stopping reason. A process error or timeout saves the partial receipt stream and exits nonzero. For unexpected termination, an unanswered request has no execution evidence; inspect the reason before retrying. Empty input produces no events.

## Investigate next

What happens if a file contains quotes, tabs or a newline?
