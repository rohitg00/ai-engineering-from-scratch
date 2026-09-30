# Render and manipulate a fixture scene

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Define capture, click and type_text behind one Backend trait. The fixture draws a real PPM image from its state: a text field, a submit region and a green completed scene. Clicking the field changes focus, typing requires focus, and clicking submit completes only after text exists. The fixture makes transition bugs reproducible without controlling the user desktop.

## Work through one concrete case

The fixture starts unfocused. Clicking(50,70) focuses the input, typing Mira stores text, and clicking(230,160) completes the scene. Captures before and after contain different real RGB bytes.

```figure
pj-desktop-control-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `Backend, FixtureBackend` in your workspace `main.rs`. Keep earlier stages working. Read the function signatures and tests first, then implement one boundary at a time. The fixture is a deterministic test backend, and its results do not establish native operating-system behavior.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

PPM P6 begins with ASCII header P6, width/height and 255, followed by width*height*3 bytes. Walk row-major pixels and derive each color from backend state.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py desktop-control --init learning-artifacts/desktop-control`. Then grade cumulatively:

```bash
python3 scripts/project_test.py desktop-control --stage 2 --path learning-artifacts/desktop-control --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/desktop-control
rustc --edition 2021 cli.rs -o desktop-cli
./desktop-cli samples/actions.tsv desktop-frames
```

## Investigate the failure boundary

Submit before typing and inspect complete=false. A realistic fixture must model failure transitions, not just paint green after any click.




## References

[Rust process commands](https://doc.rust-lang.org/std/process/struct.Command.html)
[AppleScript language guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)
[PNG specification](https://www.w3.org/TR/png-3/)
