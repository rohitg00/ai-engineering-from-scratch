# Download Folder Sort Desk

Help someone organize local downloads by combining file metadata, content hashes and an explainable category score. Generate collision-free destination proposals and duplicate groups, then export an HTML review desk and a JSON move plan that another file manager can consume.

The implementation uses Python 3.10+ and standard libraries. Samples are original teaching data. Read [API.md](API.md) for exact input, output and error contracts.

## Build your version

```bash
python3 scripts/project_test.py download-folder-sort-desk --init learning-artifacts/download-folder-sort-desk
python3 scripts/project_test.py download-folder-sort-desk --stage 1 --path learning-artifacts/download-folder-sort-desk --strict
```

A fresh starter fails clearly until you implement the first contract. Later stages retain your source file. The supplied CLI and presentation helpers are scaffolding; all domain decisions call your implementation.

```bash
python3 scripts/project_test.py download-folder-sort-desk --all --path learning-artifacts/download-folder-sort-desk --strict
cd learning-artifacts/download-folder-sort-desk
python3 cli.py samples/input.json --output my-output
```

## Run the reference and your own input

```bash
python3 scripts/project_test.py download-folder-sort-desk --all --solution --strict
cd projects/download-folder-sort-desk/solution
python3 cli.py samples/input.json --output demo-output
python3 cli.py /absolute/path/to/your-input.json --output your-output
```

Input JSON contains folder relative to the JSON file and optional occupied destination strings. Outputs: moves.json, duplicates.json, review.html. Download and edit decisions.json with the retained fingerprint and an approved array of source paths, then rerun with --decisions decisions.json. A file manager imports review_plan(folder, json.load(open("moves.json")), decisions) and executes only its approved moves after checking destination availability.

## Worked example and limits

handout.txt and duplicate.txt contain the same bytes. Their filenames differ while their SHA-256 values agree.

No files move in this project. File managers must reserve destinations and recheck identity immediately before a move; this planning gate is not a transaction or OS sandbox.

## Stages

1. [Inventory files and compute content identities](stages/01-inventory/docs/en.md)
2. [Score categories from visible file features](stages/02-score/docs/en.md)
3. [Plan destinations and surface naming conflicts](stages/03-destinations/docs/en.md)
4. [Export a reviewed filing plan for a file manager](stages/04-review/docs/en.md)

## Primary references

- [Technical reference](https://docs.python.org/3/library/)
