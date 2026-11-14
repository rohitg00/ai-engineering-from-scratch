# SQL agent over a local SQLite database

A `create_agent` agent that answers questions about the order book of a small bakery. It reads through a read-only connection, and it changes data only through a tool that a person approves first.

## The database

`sql_agent.py` builds the database on every run, in a temporary folder. It has four tables: `customers`, `products`, `orders`, and `order_items`. The shop names and the products are our own, and the orders come from `random.Random(2026)`, so every run gets the same rows. The script prints the first 16 hex digits of a SHA-256 digest of the SQL dump, so two runs can be compared. Nothing is downloaded.

## The design

- The tools get the path of the database from `context`, typed by `context_schema=Shop`, through `ToolRuntime`. The model never sees the path.
- `describe_database` returns every table with its row count, its columns, and its foreign keys, in one call.
- `run_select` checks the SQL with `guard`, then runs it on a connection opened with `mode=ro`, `PRAGMA query_only = ON`, and an authorizer that allows only reads. It returns at most 25 rows as JSON, and says when it cut the result.
- `guard` accepts one `SELECT` or `WITH` statement. It refuses comments, a second statement, and a write keyword outside a string literal. `REPLACE` counts as a write unless it is the `replace()` function. It adds `LIMIT 26` when the query has no `LIMIT n`, `LIMIT n, m`, or `LIMIT n OFFSET m` at its end.
- `request_change` runs under `HumanInTheLoopMiddleware` in `per_call` mode. A scripted reviewer approves an `INSERT` into `products` and refuses every other change.
- Before the agent runs, the script sends fixed cases through `guard` and through the read-only connection, and prints each result.

## Files

- `sql_agent.py`: the database, the tools, the guard cases, the reviewer, and the five questions.
- `run.sh`: runs the agent once with each model, in a new temporary folder each time.

## Run

```bash
./run.sh
```

`run.sh` uses `capture/.venv` (see `capture/README.md`) and Ollama on `127.0.0.1:11434` with `qwen3:4b-instruct-2507-q4_K_M` and `qwen3:8b`. Set `MODELS` to run other models.

The recorded run is in `capture/lab/sql-agent/`: `run-4b.log` and `run-8b.log`, with the guard cases and one JSON row per question in the `.jsonl` files.
