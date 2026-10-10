# Catalog Record Linker

Help a librarian or organizer reconcile inconsistent item records from two CSV exports. Generate candidate pairs using normalized fields and token similarity, collect explicit match decisions, and export a source-preserving crosswalk and reviewed merged catalog.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py catalog-record-linker --init learning-artifacts/catalog-record-linker
python3 scripts/project_test.py catalog-record-linker --stage 1 --path learning-artifacts/catalog-record-linker --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py catalog-record-linker --all --path learning-artifacts/catalog-record-linker --strict
cd learning-artifacts/catalog-record-linker
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py catalog-record-linker --all --solution --strict
cd projects/catalog-record-linker/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Input has left_csv, right_csv and optional threshold. Outputs are crosswalk.csv, merged-catalog.json, review.html. Download decisions.json, add {left,right,match,values} entries in pairs, then pass --decisions decisions.json. A fingerprint rejects reviews for different source inputs.

## Worked example and limits

left:map-1 and right:r-7 may describe the same atlas, but neither source record is discarded.

No similarity automatically merges records. ready reports resolved accepted merges; it does not claim every candidate was inspected.

## Stages

1. [Import two catalogs with stable source identifiers](stages/01-import/docs/en.md)
2. [Generate candidate pairs and explain similarity](stages/02-candidates/docs/en.md)
3. [Review matches and resolve conflicting fields](stages/03-decisions/docs/en.md)
4. [Export the crosswalk and merged catalog](stages/04-export/docs/en.md)

## Primary references

- [Technical reference](https://docs.python.org/3/library/)
