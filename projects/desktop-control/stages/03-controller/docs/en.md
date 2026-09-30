# Reject stale observations and exhausted budgets

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Place a Controller around the backend. Reserve action budget before each backend call, require a captured frame before clicks, and invalidate that frame after a mutation. A stale generation must fail before clicking. Keep a trace of successful actions and count attempted backend calls even when the backend returns an error.

## Work through one concrete case

Capture generation 0, click once, then try another click with generation 0. The controller invalidates its saved frame after the first mutation, so the second click requires a new capture.

```figure
pj-desktop-control-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `Controller.capture, Controller.click, Controller.type_text` in your workspace `main.rs`. Keep earlier stages working. Read the function signatures and tests first, then implement one boundary at a time. The fixture is a deterministic test backend, and its results do not establish native operating-system behavior.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Reserve the call budget before invoking a fallible backend method. A backend failure still consumed an attempted call. Clear the cached frame before mutation so an error cannot leave unsafe reuse available.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py desktop-control --init learning-artifacts/desktop-control`. Then grade cumulatively:

```bash
python3 scripts/project_test.py desktop-control --stage 3 --path learning-artifacts/desktop-control --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/desktop-control
rustc --edition 2021 cli.rs -o desktop-cli
./desktop-cli samples/actions.tsv desktop-frames
```

## Investigate the failure boundary

Run the supplied TSV with 33 captures. The 32-call budget must stop execution and report the physical action-file line.




## References

[Rust process commands](https://doc.rust-lang.org/std/process/struct.Command.html)
[AppleScript language guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)
[PNG specification](https://www.w3.org/TR/png-3/)
