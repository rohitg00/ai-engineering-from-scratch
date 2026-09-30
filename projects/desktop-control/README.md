# Desktop Control Backend

An auditable coordinate-and-frame action runner with reproducible before/after pixel artifacts.

Rust 2021 toolchain; structs, traits, generics, Result, mutable borrowing and byte vectors. Python 3 runs the grader and demo wrapper. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py desktop-control --init learning-artifacts/desktop-control
python3 scripts/project_test.py desktop-control --stage 1 --path learning-artifacts/desktop-control --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py desktop-control --all --path learning-artifacts/desktop-control --strict
cd learning-artifacts/desktop-control
rustc --edition 2021 cli.rs -o desktop-cli
./desktop-cli samples/actions.tsv desktop-frames
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py desktop-control --all --solution --strict
cd projects/desktop-control/solution
rustc --edition 2021 cli.rs -o desktop-cli
./desktop-cli samples/actions.tsv desktop-frames
```

## Observe the change

Six TSV actions produce three real PPM captures and trace.txt. The final line reports complete=true calls=6. Changing the first click generation from 0 to 9 fails at line 2 before clicking.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

The Backend trait is the reusable boundary. TSV uses capture, click<TAB>x<TAB>y<TAB>generation and type<TAB>text; the runner refuses unknown actions and caps 32 calls.

The CLI uses the fixture backend. Native capture is a separate opt-in main.rs command; macOS click/type methods require OS permission and remain unverified here. Generation invalidation detects this controller's mutations, not arbitrary external desktop changes.

## Stages

1. [Validate frames and coordinate spaces](stages/01-frame-contract/docs/en.md)
2. [Render and manipulate a fixture scene](stages/02-backend-trait/docs/en.md)
3. [Reject stale observations and exhausted budgets](stages/03-controller/docs/en.md)
4. [Build an opt-in native boundary](stages/04-native-adapter/docs/en.md)


## Primary references

[Rust process commands](https://doc.rust-lang.org/std/process/struct.Command.html)
[AppleScript language guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)
[PNG specification](https://www.w3.org/TR/png-3/)
