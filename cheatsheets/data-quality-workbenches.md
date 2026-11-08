---
id: data-quality-workbenches
title: Data Quality and Dataset Gates
code: DQ
subtitle: Load and split data with a seed, repair CSV cells, gate rows on a contract, audit leaks and rehearse migrations.
hue: 30
sources: phases/00-setup-and-tooling/09-data-management, projects/csv-repair-workbench, projects/csv-sql-question-workbench, projects/dataset-contract-gate, projects/dataset-split-auditor, projects/database-migration-rehearsal
source_hash: 6c2b1ac3adce3387
---

## What each gate builds
type: comparison
span: 2
from: projects/csv-repair-workbench/README.md, projects/csv-repair-workbench/API.md, projects/dataset-contract-gate/README.md, projects/dataset-contract-gate/API.md, projects/dataset-split-auditor/README.md, projects/database-migration-rehearsal/README.md, projects/database-migration-rehearsal/API.md

| Factor | CSV repair | Contract gate | Split auditor | Migration rehearsal |
|---|---|---|---|---|
| Builds | Cleaned table and recipe | Accepted and quarantine rows | Leak report per record | Rehearsal receipt |
| Input | csv text, aliases, date_columns | JSONL plus contract.json | {train,test} or {records} | Database, migration, rollback, invariants |
| Output | cleaned.csv, recipe.json | accepted.jsonl, quarantine.jsonl | split-audit.json | rehearsal.json, schema-diff.json |
| Pass signal | No pending cells | `passed` is true | `usable` is true | `release_ready` is true |
| Gate exit | Nonzero on failure | exit 1 rule, exit 2 input | exit 2 when unusable | Nonzero on failure |
| Limit | Slash and ISO dates only | No semantic truth | Exact copies, not paraphrases | SQLite policy, not OS isolation |

## Run and grade
type: command-table
span: 2
from: projects/csv-repair-workbench/README.md, projects/csv-sql-question-workbench/README.md, projects/dataset-contract-gate/README.md, projects/dataset-split-auditor/README.md, projects/database-migration-rehearsal/README.md, phases/00-setup-and-tooling/09-data-management/docs/en.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --init <workspace>` | Makes a workspace. The first run fails |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Checks the reference solution |
| `python3 cli.py samples/input.json --output demo-output` | Runs CSV repair or migration rehearsal |
| `python3 cli.py sample.csv --question "sum units by region" --output output/report.html` | Answers a CSV question with a receipt |
| `python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output` | Splits rows into accepted and quarantine |
| `python3 cli.py samples/input.json --output split-audit.json --html split-audit.html` | Audits a train and test split |
| `python3 cli.py --train train.jsonl --test test.jsonl --check --output split-audit.json` | Audits JSONL partitions in CI |
| `python code/data_utils.py` | Loads, converts, splits and fingerprints a dataset |

## Read-only CSV question
type: architecture
from: projects/csv-sql-question-workbench/solution/main.py, projects/csv-sql-question-workbench/solution/cli.py, projects/csv-sql-question-workbench/README.md

```arch
node | csv | 1,1 | sample.csv | UTF-8, under 2 MB | store
node | load | 2,1 | load_csv | REAL or TEXT per column | process
node | plan | 3,1 | plan_question | small question grammar | process
node | model | 3,2 | --model | proposes SQL from schema | model
node | run | 4,1 | run_query | authorizer, query_only, budget | process
node | out | 4,2 | report.html | plus .json receipt | client
edge | csv | load |
edge | load | plan | question
edge | load | model | schema
edge | plan | run | SQL
edge | model | run | SQL
edge | run | out | sha256 and SQL
```

## Migration rehearsal
type: flow
from: projects/database-migration-rehearsal/API.md, projects/database-migration-rehearsal/solution/main.py, projects/database-migration-rehearsal/README.md

1. **snapshot**: open the source read-only and back it up into memory.
2. **snapshot**: record schema, row counts, row-content SHA-256 and sequences.
3. **rehearse**: apply the migration to the in-memory copy only.
4. **rehearse**: deny ATTACH, DETACH, PRAGMA, virtual tables and file functions.
5. **test_rollback**: run migration and rollback on one disposable backup.
6. **reversible**: no errors and the restored snapshot equals before.
7. **receipt**: check each invariant. `release_ready` needs all of them and rollback.

## Split with a seed
type: annotated-code
lang: python
from: phases/00-setup-and-tooling/09-data-management/docs/en.md

```python
dataset = load_dataset("stanfordnlp/imdb", split="train")
split = dataset.train_test_split(test_size=0.2, seed=42)
train_val = split["train"].train_test_split(test_size=0.125, seed=42)
train_ds = train_val["train"]                # 70 percent of all rows
val_ds = train_val["test"]                   # 10 percent
test_ds = split["test"]                      # 20 percent
dataset.to_parquet("imdb_train.parquet")     # best storage format
load_dataset("wikimedia/wikipedia", "20231101.en", split="train", streaming=True)
```

## Project functions
type: task-table
from: projects/csv-repair-workbench/API.md, projects/dataset-contract-gate/API.md, projects/dataset-split-auditor/API.md, projects/database-migration-rehearsal/API.md, projects/csv-sql-question-workbench/solution/main.py

| Task | Code |
|---|---|
| Profile CSV columns | `profile(text)` |
| Preview cell changes | `preview(table, recipe)` |
| Apply reviewed repairs | `repair(table, recipe, decisions=None)` |
| Check one record | `row_issues(row, contract)` |
| Find duplicate groups | `duplicate_rows(rows, contract)` |
| Audit two partitions | `audit(train, test)` |
| Split by group hash | `split_groups(records, test_fraction=0.2, seed='course')` |
| Run a bounded read | `run_query(data, sql, max_rows=100, max_steps=100000)` |

## Version large files
type: command-table
from: phases/00-setup-and-tooling/09-data-management/docs/en.md

| Command | What it does |
|---|---|
| `git lfs track "*.safetensors"` | Stores the file outside git with a pointer |
| `dvc add data/training_set.parquet` | Makes a small `.dvc` pointer file |
| `dvc remote add -d myremote s3://my-bucket/dvc-store` | Sets the DVC remote |
| `dvc push` | Uploads tracked data to the remote |
| `snapshot_download("sentence-transformers/all-MiniLM-L6-v2")` | Caches a full model repo |

## Defaults and limits
type: defaults
from: projects/csv-sql-question-workbench/solution/main.py, projects/csv-sql-question-workbench/solution/cli.py, projects/dataset-split-auditor/solution/cli.py, projects/dataset-contract-gate/solution/main.py, projects/database-migration-rehearsal/README.md, phases/00-setup-and-tooling/09-data-management/docs/en.md, phases/00-setup-and-tooling/09-data-management/code/data_utils.py

| Setting | Default | Note |
|---|---|---|
| `--limit` | 100 | Result rows, at most 1000 |
| `max_steps` | 100000 | SQLite instruction budget |
| `load_csv` rows | 10000 | Under 2 MB, at most 50 columns |
| `--seed` | course | Group hash seed for `--split` |
| Contract rows | 100000 | API input cap |
| SQL deadline | two-second | Bounds statements, not backups |
| `make_splits` seed | 42 | Train 0.8, validation 0.1 |
| Local storage | 10 GB | Use cloud storage above it |

## Errors and fixes
type: troubleshooting
from: projects/csv-repair-workbench/solution/main.py, projects/csv-sql-question-workbench/solution/main.py, projects/dataset-contract-gate/README.md, projects/dataset-split-auditor/README.md, projects/database-migration-rehearsal/API.md

| Symptom | Cause | Fix |
|---|---|---|
| "ragged row" | A row has the wrong cell count | Fix the source row |
| Pending "ambiguous date" | Both parts are 12 or less and differ | Give an ISO date in decisions |
| "stale review" | Table or recipe changed after review | Review the new preview again |
| "Query rejected: " | SQL left the read boundary | Write one SELECT over `data` |
| "Aggregate column must contain finite numeric values" | Column is TEXT | Aggregate a REAL column |
| Contract `--check` exits 1 | Rows are in quarantine | Read review.html. Decide on rows apart |
| Split `usable` is false | Content or group leak | Split by group with `--split` |
| `release_ready` is false | Rollback is not exact | Write rollback SQL that restores rows |

## Rules in code
type: concepts
from: projects/csv-repair-workbench/API.md, projects/dataset-contract-gate/API.md, projects/dataset-split-auditor/solution/main.py, phases/00-setup-and-tooling/09-data-management/docs/en.md

- **Recipe order**: trim, then alias, then date for each column.
- **Changes**: each change names row, column, before and after.
- **No coercion**: Boolean true fails integer and number fields.
- **Duplicates**: every colliding row is reported, the first one too.
- **Gate**: a dataset passes with no quarantined rows and no dataset issues.
- **Fingerprint**: NFKC, casefold and collapsed spaces, then SHA-256.
- **Group split**: SHA-256 of seed and group over `2**256`, below the fraction is test.
- **Formats**: Parquet for storage, Arrow in memory, CSV and JSON to exchange.

## Questions
type: qa
from: projects/dataset-split-auditor/README.md, projects/database-migration-rehearsal/API.md, projects/dataset-contract-gate/API.md, projects/csv-sql-question-workbench/README.md, phases/00-setup-and-tooling/09-data-management/docs/en.md

- **Does normalization catch paraphrases?** No. It finds exact normalized copies only.
- **Does rehearsal change the source database?** No. The source is never opened writable.
- **Does the model run its SQL freely?** No. SQLite authorization still controls execution.
- **Can I drop quarantined rows at once?** No. Partitions are evidence, not permission to discard.
- **Why set a seed?** The same seed produces the same split every time.

## Tips
type: tips
from: projects/csv-repair-workbench/README.md, projects/dataset-contract-gate/API.md, projects/dataset-split-auditor/README.md, phases/00-setup-and-tooling/09-data-management/docs/en.md

- Replay a recipe on another table with `--recipe recipe.json`.
- Read cleaned.csv with `csv.DictReader` as the downstream consumer.
- Wait for the gate command to finish before you load its outputs.
- Keep the input beside the output so others can reproduce it.
- Keep model weights out of git with `.gitignore`. Use DVC to reproduce runs.
