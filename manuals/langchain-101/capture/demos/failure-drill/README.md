# Failure drill

One script that causes seven failures from Parts 2 to 7, offline, and prints for each one the symptom, the state, the fix, the result after the fix, and the time.

It needs no model and no network. A scripted fake chat model plays the model, and a stub on `127.0.0.1` plays the provider. Two cases start child processes: the crash case kills one with SIGKILL, and the tracing case points `LANGSMITH_ENDPOINT` at a port where nothing listens. No request leaves the machine.

## The seven cases

1. Retry layers stack: `ChatOpenAI` and `ModelRetryMiddleware` against a stub that always returns 500.
2. A crash between a side effect and its checkpoint, on `SqliteSaver`, then a resume in a new process.
3. An approval skipped in batched mode by a middleware that jumps to `tools`.
4. A run with tools and `ToolStrategy` that ends with no structured response.
5. A tracing endpoint that is down.
6. Two tools with the same name.
7. A model that calls a tool forever, and the recursion limit.

## Files

- `drill.py`: the seven cases. `crash-child` and `trace-child` are the child processes it starts.
- `fake.py`: the scripted fake chat model of the capture kit, cut to the chat model.
- `run.sh`: one run.

## Run

```bash
./run.sh
```

`run.sh` uses `capture/.venv`. The recorded run is `capture/lab/failure-drill/drill.log`, with one JSON row per case in `drill.jsonl`.
