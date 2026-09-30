# Build an opt-in native boundary

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Construct macOS screencapture and AppleScript argument arrays without a shell. Pass typed text as an argument, never as executable script content. Read PNG dimensions from native screenshot headers and preserve the actual image payload. The default demo remains the fixture. Native capture requires an explicit --native-capture flag, OS permissions and a caller-supplied DESKTOP_SCALE when the display is scaled. Native click and typing are library methods, not automatic demo actions.

## Work through one concrete case

The text payload `Mira "quoted"` belongs in an osascript argv element. It must never be pasted into the AppleScript program string. This preserves argument boundaries independently of quoting.

```figure
pj-desktop-control-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `click_argv, text_argv, png_dimensions, MacBackend` in your workspace `main.rs`. Keep earlier stages working. Read the function signatures and tests first, then implement one boundary at a time. The fixture is a deterministic test backend, and its results do not establish native operating-system behavior.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Keep native capture, click and typing behind Backend. The TSV CLI exercises the fixture; the optional native adapter needs separate permissions and a disposable target application.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py desktop-control --init learning-artifacts/desktop-control`. Then grade cumulatively:

```bash
python3 scripts/project_test.py desktop-control --stage 4 --path learning-artifacts/desktop-control --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/desktop-control
rustc --edition 2021 cli.rs -o desktop-cli
./desktop-cli samples/actions.tsv desktop-frames
```

## Investigate the failure boundary

Inspect frame-1.ppm, frame-4.ppm and frame-6.ppm from cli.rs. Explain what the changing pixels prove and why they cannot establish native macOS behavior.

The CLI uses the fixture backend. Native capture is a separate opt-in main.rs command; macOS click/type methods require OS permission and remain unverified here. Generation invalidation detects this controller's mutations, not arbitrary external desktop changes.


## References

[Rust process commands](https://doc.rust-lang.org/std/process/struct.Command.html)
[AppleScript language guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)
[PNG specification](https://www.w3.org/TR/png-3/)
