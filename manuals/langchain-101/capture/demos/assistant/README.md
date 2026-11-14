# An assistant with memory and approvals that survives a restart

A `create_agent` assistant that keeps a conversation in `SqliteSaver`, keeps facts about its user in `SqliteStore`, asks a person before it sends an email, and summarizes its thread when the thread grows. Every step runs in a new Python process, so each resume is a restart.

## What it uses

- `SqliteSaver` for the threads, and `SqliteStore` for long-term memory under `("users", "reader-1", "memories")`.
- `HumanInTheLoopMiddleware` with `interrupt_mode="per_call"` on `send_email`, which allows `approve` and `reject`.
- `SummarizationMiddleware` with `trigger=("messages", 10)` and `keep=("messages", 4)`.
- `context_schema`, so the user id comes from your code and never from the model.
- An idempotency key on `send_email`: the `tool_call_id` from `ToolRuntime`, the primary key of the `sent` table in `outbox.sqlite`. The tool logs every attempt in `attempts`.

## The run

`run.sh` runs seven steps on one work folder:

1. Tell the assistant two facts. It saves them with `remember`.
2. Ask it to email the manager. It calls `recall`, then `send_email`, and the run stops at the approval.
3. Approve in a new process. The email is sent, and the process kills itself with SIGKILL before the step is saved.
4. Resume in a new process with `invoke(None)`.
5. Approve again in a new process.
6. Ask a third question on the same thread.
7. Ask about the user's preferences on a new thread.

The script then prints the rows of the outbox, the checkpoint counts, and the store.

## Files

- `assistant.py`: the assistant. Its arguments are a step name, a thread id, and `say`, `approve`, or `resume`.
- `run.sh`: the seven steps. `DURABILITY=sync ./run.sh` runs them with `durability="sync"`.

## Run

```bash
./run.sh
DURABILITY=sync ./run.sh
```

`run.sh` uses `capture/.venv` and Ollama on `127.0.0.1:11434` with `qwen3:4b-instruct-2507-q4_K_M`, and `sqlite3` for the last listing. The recorded runs are `capture/lab/assistant/run.log` and `run-sync.log`, with one JSON row per step that finished in the `.jsonl` files. The step that is killed writes no row.
