# Community Learning Path Finder

Help a learner choose a feasible sequence from an explicit catalog of workshops and resources. Combine prerequisite graphs, stated goals and a time budget, explain why each resource was selected, and export an editable HTML learning map with a machine-readable path for another course platform.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py community-learning-path-finder --init learning-artifacts/community-learning-path-finder
python3 scripts/project_test.py community-learning-path-finder --stage 1 --path learning-artifacts/community-learning-path-finder --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py community-learning-path-finder --all --path learning-artifacts/community-learning-path-finder --strict
cd learning-artifacts/community-learning-path-finder
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py community-learning-path-finder --all --solution --strict
cd projects/community-learning-path-finder/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Input JSON contains resources, goals, budget and optional completed IDs. Outputs learning-map.html, path.json, unmet-prerequisites.json. Edit the HTML progress JSON and download decisions.json, then rerun with --decisions decisions.json. A course platform imports path.json path entries in array order, retaining id, prerequisites, minutes and completed fields.

## Worked example and limits

Neighborhood mapping starts with coordinate basics, then field collection, then publishing. Advanced analysis also asks for an external statistics prerequisite.

HTML edits represent self-reported progress. The importer validates dependency consistency and fingerprints, not learner identity or assessment success.

## Stages

1. [Model resources, goals and prerequisite relationships](stages/01-catalog/docs/en.md)
2. [Find feasible paths and expose missing prerequisites](stages/02-closure/docs/en.md)
3. [Rank alternatives under an explicit time budget](stages/03-rank/docs/en.md)
4. [Export an editable learning map and integration contract](stages/04-progress/docs/en.md)

## Primary references

- [Technical reference](https://docs.python.org/3/library/)
