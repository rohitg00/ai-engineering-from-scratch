# Stateful agent actor

An agent-shaped actor in one Python file. It keeps a conversation in process memory and in SQLite on a durable directory, and it calls a model through an egress rule that injects the API key.

The model is a mock (`mock_llm.py`) that runs in the cluster. It answers from the messages it receives and says if the gateway sent the real key.

## Files

- `agent.py`: `POST /chat`, `POST /note`, `GET /history`.
- `mock_llm.py`: the mock model, OpenAI chat format.
- `cluster.yaml`: two namespaces, the Secret, the mock model, and a pool of one worker.
- `template.yaml`: one template, made twice: memory fidelity and volumes fidelity.
- `egress-policy.yaml`: one `http` rule for the model host, with the header replacement.
- `provider-policy.yaml`: lets atespace `demo-agent` read Secrets in `demo-agent-secrets`.
- `run.sh`: `setup` deploys, `record` runs one session for each fidelity.

## Run

```bash
export REGISTRY=localhost:5001
./run.sh setup
OUT=./out ./run.sh record
```

`setup` replaces the namespace policy of the bundled credential provider. Use a test cluster.

## What to look at

- `out/session-memory.tsv` and `out/session-volumes.tsv`: each turn, its time, and what the agent holds.
- `note` and `scratch_file`: state that lives only in memory and in `/tmp`.
- `process_age_s`: it keeps growing under memory fidelity and starts again under volumes fidelity.
- `rehydrated_from_db`: the turns the agent loaded from SQLite when its process started.

Our recorded run is in `capture/lab/N-demos/stateful-agent/`. The agent now handles one chat turn at a time. The recording sent one turn at a time, so it is the same.

## Needs

`kubectl`, `kubectl-ate`, `docker`, `curl`, and Agent Substrate v1.0.0 with the bundled `k8s.io` credential provider.
