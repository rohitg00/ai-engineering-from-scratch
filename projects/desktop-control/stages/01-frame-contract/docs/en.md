# Validate frames and coordinate spaces

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A screenshot has physical pixel dimensions while native desktop clicks may use logical coordinates. Validate positive bounded dimensions and a finite display scale, then reject points outside the frame before converting by floor division. The frame generation identifies which observation justified an action.

## Work through one concrete case

A screenshot is640x400 physical pixels at scale 2. Pixel(200,100) maps to logical(100,50). Pixel(640,100) is already outside the image and must not become a plausible logical coordinate through division.

```figure
pj-desktop-control-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `Frame.validate, Frame.logical_point` in your workspace `main.rs`. Keep earlier stages working. Read the function signatures and tests first, then implement one boundary at a time. The fixture is a deterministic test backend, and its results do not establish native operating-system behavior.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Validate bounds in physical space first; then floor each coordinate divided by scale. Check finiteness before converting floats to unsigned integers.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py desktop-control --init learning-artifacts/desktop-control`. Then grade cumulatively:

```bash
python3 scripts/project_test.py desktop-control --stage 1 --path learning-artifacts/desktop-control --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/desktop-control
rustc --edition 2021 cli.rs -o desktop-cli
./desktop-cli samples/actions.tsv desktop-frames
```

## Investigate the failure boundary

Try NaN, negative coordinates and scale 0. Each error must occur before Backend.click is called.




## References

[Rust process commands](https://doc.rust-lang.org/std/process/struct.Command.html)
[AppleScript language guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)
[PNG specification](https://www.w3.org/TR/png-3/)
