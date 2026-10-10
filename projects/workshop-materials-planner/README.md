# Workshop Materials Planner

Help a workshop host reconcile per-participant materials, reusable equipment and an inventory snapshot. Use explicit unit conversions and declared sharing rules to compute shortages, keep unconvertible quantities visible, and export a packing list with a participant-count comparison.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py workshop-materials-planner --init learning-artifacts/workshop-materials-planner
python3 scripts/project_test.py workshop-materials-planner --stage 1 --path learning-artifacts/workshop-materials-planner --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py workshop-materials-planner --all --path learning-artifacts/workshop-materials-planner --strict
cd learning-artifacts/workshop-materials-planner
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py workshop-materials-planner --all --solution --strict
cd projects/workshop-materials-planner/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Input JSON contains participants, materials, inventory, conversions and optional compare counts. Outputs packing-list.csv, shortages.json, planner.html. The slider supports 0 through 100 participants; the CLI supports arbitrary nonnegative integers. Download decisions.json to save the chosen count, rerun with --decisions decisions.json, then import packing-list.csv into a spreadsheet with csv.DictReader.

## Worked example and limits

Eight participants need paper per person and scissors per group of three. A bottle of glue has no known milliliter quantity unless you supply that conversion.

Sharing assumes one concurrent session and unlimited reuse within each group. It does not schedule sequential workshops, procurement lead times or material substitutions.

## Stages

1. [Model participants, materials and inventory units](stages/01-model/docs/en.md)
2. [Scale consumables and shared equipment separately](stages/02-scale/docs/en.md)
3. [Compute shortages and review uncertain conversions](stages/03-shortages/docs/en.md)
4. [Export packing lists and participant-count scenarios](stages/04-scenarios/docs/en.md)

## Primary references

- [Technical reference](https://docs.python.org/3/library/)
