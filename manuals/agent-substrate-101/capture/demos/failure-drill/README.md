# Failure drill

One script that puts a test cluster through six failures and prints, for each, the symptom a client sees, the actor state, the command that fixes it, and the time to recover.

Use it on a kind cluster that you can break. It deletes a worker pod, removes a snapshot from the node disk, and stops Postgres for about 30 seconds.

## Files

- `drill_actor.py`: a counter over HTTP, with `/exit` and `/oom` to make it fail.
- `Dockerfile`, `pool.yaml`, `template.yaml`: the image, a pool of two workers with one CPU each, and the template.
- `drill.sh`: `setup` builds and deploys, `run` does the drill.

## Run

```bash
export REGISTRY=localhost:5001
export KIND_NODE=kind-control-plane
./drill.sh setup
./drill.sh run | tee my-drill.log
```

Compare `my-drill.log` with our recorded run in `capture/lab/N-demos/failure-drill/drill-run.log`.

Three changes came after the recording. `setup` now stops at the first step that fails. A wait that times out now prints `no CRASHED state in` or `did not answer in`, where it printed the elapsed time as a success. An interrupt during case 6 now scales Postgres back to one replica. A run with no failure prints the same lines as the recording.

## The six cases

1. A worker pod is deleted under a running actor.
2. The node-local snapshot is removed before the upload.
3. The actor process exits inside the sandbox.
4. The actor uses more memory than its limit.
5. More actors run than the pool has room for.
6. Postgres is away for 30 seconds.

## Needs

`kubectl`, `kubectl-ate`, `docker`, `jq`, `curl`, and Agent Substrate v1.0.0 installed as in the quickstart.
