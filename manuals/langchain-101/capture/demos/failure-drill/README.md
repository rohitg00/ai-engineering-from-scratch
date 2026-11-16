# Failure drill

One script that causes seven failures from Parts 2 to 7 with a real model, and prints for each one the symptom, the state, the fix, the result after the fix, and the time.

Qwen3 4B (`qwen3:4b-instruct-2507-q4_K_M`) on a local Ollama plays the model, with temperature 0 and seed 42. A relay on `127.0.0.1` in front of Ollama drops every connection for the retry case. Two cases start child processes: the crash case kills one with SIGKILL, and the tracing case points `LANGSMITH_ENDPOINT` at a port where nothing listens. No request leaves the machine.

## The seven cases

1. Retry layers stack: `ChatOpenAI` on the `/v1` path of Ollama and `ModelRetryMiddleware`, through a relay that drops every connection.
2. A crash between a side effect and its checkpoint, on `SqliteSaver`, then a resume in a new process.
3. An approval skipped in batched mode by a middleware that jumps to `tools`.
4. Runs with tools and `ToolStrategy` that end with no structured response.
5. A tracing endpoint that is down.
6. Two tools with the same name.
7. A model that calls a tool forever, and the recursion limit.

## Files

- `drill.py`: the seven cases. `crash-child` and `trace-child` are the child processes it starts.
- `real.py`: the model factories for `ChatOllama` and `ChatOpenAI` on Ollama, the relay, and a free port helper.
- `run.sh`: three runs.

## Run

```bash
./run.sh
```

`run.sh` uses `capture/.venv` and needs Ollama on `127.0.0.1:11434` with the model pulled. The recorded runs are `capture/lab/failure-drill-x86/drill-run1.log` to `drill-run3.log`, with one JSON row per case in each `drill-run<n>.jsonl`. They ran on the x86 server guest, on CPU.
