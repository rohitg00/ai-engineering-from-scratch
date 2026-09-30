# Parse a deliberately small action language

**Stage 1 of 4.** Rust. Plan about 2 hours.

Define an action enum for help, pwd, list, read, literal search and quit. Unknown commands are rejected, including shell-like instructions. Search separates its pattern and path with a tab so spaces remain valid inside either argument. Parsing never invokes a subprocess and has a 4096-byte input limit. This is a model-agnostic tool loop, not a natural-language model or an operating-system shell.

```figure
pj-rust-agent-shell-1
```

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md).

The Rust process accepts a deliberately small tool language. Its Python adapter accepts JSONL with caller ids and tool arguments, then translates only known commands. No argument becomes an operating-system shell command.

```text
{"id":"evidence","tool":"search","arguments":{"pattern":"Restore","path":"release.md"}}
wire: search Restore<TAB>release.md
```

## Build and inspect

Reject control characters in adapter arguments so a path cannot inject a second command. Distinguish parse rejection from execution failure.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rust-agent-shell --init learning-artifacts/rust-agent-shell
python3 scripts/project_test.py rust-agent-shell --stage 1 --path learning-artifacts/rust-agent-shell
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why must a literal newline in a caller path be rejected before stdin serialization?
