# Group repeated templates with source locators

> Count repetition without discarding its source range.

**Type:** Build
**Languages:** Rust, Python
**Stage:** 2 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Group by the pair (level, template). A group contains total count, first and last source line, and the first encountered original message. Sorted group keys make serialization stable. Digit normalization is a heuristic, not semantic equivalence.

## Worked example

The 200-line burst contains 199 WARN retries and one ERROR disk-full message at line 138. Its retry group spans lines 1 through 200. The disk group has firstLine=lastLine=138.

```figure
pj-log-volume-reduction-lab-2
```

## Implement the contract

`group(&[Record])->Vec<Group>`; `Group{level,template,count,first,last,example}`. Return groups in lexical level/template order. Source ranges include gaps; they are not a claim that every intervening line belongs to the group.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py log-volume-reduction-lab --init /tmp/log-volume-reduction-lab-work
python3 scripts/project_test.py log-volume-reduction-lab --stage 2 --path /tmp/log-volume-reduction-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Create two different messages that collapse to the same digit template and discuss the diagnostic evidence this loses.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
