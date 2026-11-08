# Export compact context and coverage

> Measure which diagnostic templates survive compression.

**Type:** Build
**Languages:** Rust, Python
**Stage:** 4 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Rust compact output emits one JSON object per retained template, with counts from the full source stream. Python validates the exported groups against the source and calculates rare-template coverage. The context can be read by any JSONL consumer.

## Worked example

Uniform output retains one template and represents 199 source records; rareCoverage is 0. Rarity output retains two templates representing all 200 records; rareCoverage is 1. This measures templates, not token savings or causal understanding.

```figure
pj-log-volume-reduction-lab-4
```

## Implement the contract

Rust `compact(&[Record],&[Record])->String`; JSONL fields `schemaVersion,level,template,count,firstLine,lastLine,example`. Python `coverage(source:str,compact:str,rare_max:int=2)->dict` rejects unknown groups, duplicates, count mismatches and invalid locators.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py log-volume-reduction-lab --init /tmp/log-volume-reduction-lab-work
python3 scripts/project_test.py log-volume-reduction-lab --stage 4 --path /tmp/log-volume-reduction-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Change rare_max and compare recall. Add a byte-size metric separately; a long example can make fewer rows larger than expected.

[Rust collections](https://doc.rust-lang.org/std/collections/) and [Python JSON](https://docs.python.org/3/library/json.html).
