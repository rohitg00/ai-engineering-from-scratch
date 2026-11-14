# A deep agent with a subagent and files

A `create_deep_agent` agent on a local model. It plans with a todo list, writes a file in its virtual filesystem, sends the file to an `editor` subagent for review, and reports the final text. A callback records the tokens of every model call, for the main agent and for the subagent.

This code is our own. The Deep Agents course repository has no license, so nothing here is copied from it.

## What it uses

- `deepagents` 0.7.38, with `ChatOllama` and `qwen3:8b`, temperature 0, seed 42, reasoning off, `num_ctx=16384`.
- One subagent, `editor`, given as a `SubAgent` dict with its own system prompt and the same model.
- `TodoListMiddleware`, which `create_deep_agent` leaves out at 0.7.
- The default backend, so files live in the `files` channel of the state, and `InMemorySaver`.
- A callback that reads `usage_metadata` and the `lc_agent_name` metadata of each model call.

## Files

- `deep_agent.py`: the agent, the task, and the token callback.
- `run.sh`: one run.

## Run

```bash
./run.sh
```

`run.sh` uses `capture/.venv` and Ollama on `127.0.0.1:11434` with `qwen3:8b`. The recorded run is in `capture/lab/deep-agent/`: `run.log`, and `run.jsonl` with one row for the run and one row for each model call.
