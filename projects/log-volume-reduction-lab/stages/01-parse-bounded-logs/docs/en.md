# Parse and bound log records

> Turn each line into a validated, located record.

**Type:** Build
**Languages:** Rust, Python
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Rust parses a UTF-8 file with one LEVEL, tab and message per line. Levels are DEBUG, INFO, WARN or ERROR. Preserve the one-based source line. The bounded contract accepts at most one MiB, 10,000 records and 4096 bytes per line.

## Worked example

`WARN	retry request 42 after 50ms` becomes line 1, level WARN, original message, and template `retry request # after #ms`. Only ASCII digit runs are replaced; non-ASCII text remains intact.

```figure
pj-log-volume-reduction-lab-1
```

## Implement the contract

`parse_logs(&str) -> Result<Vec<Record>,String>`; `Record{line:usize,level:String,message:String,template:String}`. `template(&str)->String` replaces maximal ASCII digit runs with #. Reject blank messages, invalid severity and control characters.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py log-volume-reduction-lab --init /tmp/log-volume-reduction-lab-work
python3 scripts/project_test.py log-volume-reduction-lab --stage 1 --path /tmp/log-volume-reduction-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Try a Unicode digit. Explain why a wider numeric normalization might merge identifiers unexpectedly.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
