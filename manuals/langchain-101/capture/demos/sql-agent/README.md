# SQL agent over a local SQLite database

A `create_agent` agent that answers questions about the Chinook music store database. It reads through a read-only connection, and it changes data only through a tool that a person approves first.

## Where it comes from

The idea, the database, the questions, and the read-only SQL check come from the SQL agent lab of `langchain-ai/lca-langchainV1-essentials` (folder `python_local`, commit `ab3492d`). That repository is MIT licensed, and its notice is in `LICENSE-langchain-academy`. We changed these parts:

- Plain `sqlite3` replaces `SQLDatabase` from `langchain_community`, which is being sunset.
- The read tool opens the file with `mode=ro` and `PRAGMA query_only = ON`, so a write fails in SQLite as well as in our check.
- The agent finds the schema with `list_tables` and `describe_table`. No sample rows reach the model.
- A fourth tool, `propose_write`, runs under `HumanInTheLoopMiddleware` in `per_call` mode. A scripted reviewer approves an `INSERT` into `Genre` and rejects every other write.
- The write runs on a copy of the database in a temporary folder. The source file never changes.
- `run_query` says when it cut the result at 20 rows.

## Files

- `sql_agent.py`: the agent, the tools, the reviewer, and the five questions.
- `run.sh`: checks the database file, then runs the agent once with each model.
- `LICENSE-langchain-academy`: the MIT notice of the lab this demo adapts.

## Run

```bash
./run.sh
```

`run.sh` uses `capture/.venv` (see `capture/README.md`) and Ollama on `127.0.0.1:11434` with `qwen3:4b-instruct-2507-q4_K_M` and `qwen3:8b`. It downloads `Chinook.db` from the URL that the lab uses when the file is missing, and checks its SHA-256, `84f5d914…`. Set `CHINOOK_DB` to use a copy you have. Set `MODELS` to run other models.

The recorded run is in `capture/lab/sql-agent/`: `run-4b.log` and `run-8b.log`, with one JSON row per question in the `.jsonl` files.
