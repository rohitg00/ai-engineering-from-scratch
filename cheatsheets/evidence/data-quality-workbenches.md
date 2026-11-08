# Evidence: cheatsheets/data-quality-workbenches.md

Abbreviations: L09 = phases/00-setup-and-tooling/09-data-management (d = docs/en.md, u = code/data_utils.py). CR = projects/csv-repair-workbench, CQ = projects/csv-sql-question-workbench, CG = projects/dataset-contract-gate, SA = projects/dataset-split-auditor, MR = projects/database-migration-rehearsal. s = solution.

## What each gate builds (comparison, 6 rows)
- Builds: CR/README.md:3, CG/README.md:3, SA/README.md:3, MR/README.md:3
- Input: CR/README.md:31, CG/README.md:21, SA/README.md:44, MR/README.md:31
- Output: CR/README.md:31, CG/README.md:38, SA/README.md:21, MR/README.md:31
- Pass signal: CR/README.md:37 (pending cells), CG/API.md:41, SA/s/main.py:68 via SA/README.md:38, MR/README.md:31
- Gate exit: CR/API.md:3, CG/API.md:41, SA/README.md:44, MR/API.md:3
- Limit: CR/README.md:37, CG/README.md:42, SA/README.md:46, MR/API.md:19

## Run and grade (command-table, 8)
- --init, first run fails: CG/README.md:12, 16
- --all --solution --strict: CR/README.md:25, CG/README.md:27
- cli.py samples/input.json --output demo-output: CR/README.md:27, MR/README.md:27
- cli.py sample.csv --question "sum units by region": CQ/README.md:13
- cli.py samples/input.jsonl --contract samples/contract.json: CG/README.md:29
- cli.py samples/input.json --output split-audit.json --html split-audit.html: SA/README.md:33
- --train train.jsonl --test test.jsonl --check: SA/README.md:62
- python code/data_utils.py: L09/d:230-233

## Read-only CSV question (architecture, 6 nodes)
- sample.csv, UTF-8 under 2 MB: CQ/s/main.py:13-14
- load_csv types REAL or TEXT: CQ/s/main.py:12, 50
- plan_question grammar: CQ/s/main.py:55-77, CQ/README.md:45
- --model proposes SQL from schema and question: CQ/s/cli.py:17, 49, CQ/README.md:45
- run_query authorizer, query_only, progress budget: CQ/s/main.py:80, 102, 107-124
- report.html plus .json receipt with sourceSha256 and sql: CQ/s/cli.py:60-62, CQ/s/main.py:130-131

## Migration rehearsal (flow, 7)
1. read-only connection and backup into memory: MR/API.md:11, MR/s/main.py:45-58
2. schema, row counts, SHA-256 hashes, sequences: MR/API.md:11
3. migration on in-memory backup only: MR/API.md:19
4. ATTACH, DETACH, PRAGMA, virtual tables, file functions denied: MR/s/main.py:73-86, MR/API.md:19
5. migration and rollback on one disposable backup: MR/API.md:27
6. reversible needs no errors and before == restored: MR/s/main.py:150-152
7. invariants and release_ready: MR/API.md:35, MR/s/main.py:216

## Split with a seed (annotated-code, 8 lines)
- load_dataset imdb train: L09/d:108
- train_test_split(test_size=0.2, seed=42): L09/d:110
- train_test_split(test_size=0.125, seed=42): L09/d:111
- train_ds, val_ds, test_ds: L09/d:113-115
- to_parquet, Parquet best storage format: L09/d:83, 95
- streaming=True: L09/d:64

## Project functions (task-table, 8)
- profile(text): CR/API.md:8
- preview(table, recipe): CR/API.md:24
- repair(table, recipe, decisions=None): CR/API.md:32
- row_issues(row, contract): CG/API.md:18
- duplicate_rows(rows, contract): CG/API.md:28
- audit(train, test): SA/API.md:12
- split_groups(records, test_fraction=0.2, seed='course'): SA/API.md:13
- run_query(data, sql, max_rows=100, max_steps=100000): CQ/s/main.py:80

## Version large files (command-table, 5)
- git lfs track "*.safetensors": L09/d:162, 166
- dvc add data/training_set.parquet, .dvc files: L09/d:173, 178
- dvc remote add -d myremote s3://my-bucket/dvc-store: L09/d:206
- dvc push: L09/d:207
- snapshot_download("sentence-transformers/all-MiniLM-L6-v2"): L09/d:135

## Defaults and limits (defaults, 8)
- --limit 100, max_rows 1..1000: CQ/s/cli.py:51, CQ/s/main.py:83
- max_steps 100000: CQ/s/main.py:80
- load_csv max_rows 10000, 2 MB, 50 columns: CQ/s/main.py:12-14, 22-23
- --seed course: SA/s/cli.py:38
- 100000 rows: CG/s/main.py:125-126
- two-second deadline: MR/README.md:37
- make_splits seed 42, 0.8 and 0.1: L09/u:80
- local storage under ~10 GB: L09/d:190

## Errors and fixes (troubleshooting, 8)
- ragged row: CR/s/main.py:18-19
- ambiguous date when a <= 12 and b <= 12 and a != b: CR/s/main.py:75-81, ISO replacement CR/s/main.py:127
- stale review on fingerprint mismatch: CR/s/main.py:109-111, 119-120
- Query rejected: CQ/s/main.py:107-114, 134-135
- Aggregate column must contain finite numeric values: CQ/s/main.py:72-73
- --check exits 1, removing rows is a separate decision: CG/README.md:32, 36
- usable false from leaks, --split: SA/README.md:38, 44
- release_ready false without exact rollback, no rollback SQL invented: MR/API.md:27, 35

## Rules in code (concepts, 8)
- trim, alias, date order: CR/API.md:19
- change fields row, column, before, after: CR/API.md:27
- Boolean true fails integer and number: CG/API.md:23
- every colliding member, first included: CG/API.md:31
- pass only with no quarantine and no dataset issues: CG/API.md:41
- NFKC, casefold, split join, sha256: SA/s/main.py:9-10
- seed + group hash over 2**256, below fraction is test: SA/s/main.py:49-56
- Parquet, Arrow, CSV and JSON: L09/d:95

## Questions (qa, 5)
- exact normalized copies, not paraphrases: SA/README.md:46
- source never opened writable: MR/API.md:11
- SQLite authorization still controls execution: CQ/README.md:45
- partitions are evidence, not permission to discard: CG/API.md:43
- same seed same split: L09/d:120

## Tips (tips, 5)
- --recipe recipe.json: CR/README.md:31
- csv.DictReader: CR/README.md:31
- wait for the command to finish: CG/API.md:43
- keep input beside output: SA/README.md:40
- .gitignore enough, DVC for exact experiments: L09/d:186
