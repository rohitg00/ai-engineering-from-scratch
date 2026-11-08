# Compare sampling policies on rare events

> Spend a fixed record budget on common or rare templates.

**Type:** Build
**Languages:** Rust, Python
**Stage:** 3 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Uniform sampling chooses indices floor(i*N/budget). Rarity sampling sorts by template frequency and then source line, selects one representative of each template first, and fills any remaining budget from that sorted order. No random seed or model is needed.

## Worked example

With 200 records and budget 8, uniform chooses indices 0,25,50,75,100,125,150,175 and misses disk-full at index 137. Rarity selects that one-off template first. Both return at most eight records.

```figure
pj-log-volume-reduction-lab-3
```

## Implement the contract

`sample(records:&[Record],budget:usize,policy:&str)->Result<Vec<Record>,String>`. Policy is exactly uniform or rarity. Zero budget and empty input return an empty vector; a budget beyond the input returns every record once.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py log-volume-reduction-lab --init /tmp/log-volume-reduction-lab-work
python3 scripts/project_test.py log-volume-reduction-lab --stage 3 --path /tmp/log-volume-reduction-lab-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Move the rare event onto a uniform index. The demonstration advantage should disappear for this fixture, which illustrates why one example cannot establish universal superiority.

[Go standard library](https://pkg.go.dev/std) and [Node standard library](https://nodejs.org/api/). All fixtures and implementations are original.
