# Tool sandbox

One actor that runs shell commands it does not trust. Egress is denied except for one package mirror, the actor has a CPU and a memory limit, and a revert returns it to a clean snapshot after each task.

## Files

- `sandbox.py`: `POST /` with `{"cmd": "..."}` runs the command in `/work` and returns the exit code and output.
- `client.py`: sends one command and prints the status, the time, and the reply.
- `cluster.yaml`: the namespace, an in-cluster package mirror, and a pool of one worker.
- `template.yaml`: 500 millicores and 256 MiB for each sandbox.
- `egress-policy.yaml`: one `http` rule for the mirror. All other hosts are denied.
- `run.sh`: `setup` deploys, `record` runs six tasks with a revert after each.

## Run

```bash
export REGISTRY=localhost:5001
./run.sh setup
OUT=./out ./run.sh record
cat out/tasks.tsv
```

## The six tasks

1. Download a file from the allowed mirror.
2. Send data to an outside host by name.
3. Send data to an outside host by IP address.
4. Reach the Kubernetes API by its Service name.
5. Do 2 seconds of CPU work on the 500 millicore limit.
6. Allocate more memory than the 256 MiB limit.

After each task, `run.sh` reverts the actor and checks that `/work` is empty again. Our recorded run is in `capture/lab/N-demos/tool-sandbox/`. Two changes came after it. `setup` now stops at the first step that fails. The sandbox now keeps only the last 2,000 characters of output while a command runs, where it held all output in memory. The recorded tasks printed less, so their results are the same.

## Limits

This demo has no authentication on the actor. Any caller that can reach it can run commands. The egress policy and the limits bound what a command can do, not who can send one.

## Needs

`python3`, `kubectl`, `kubectl-ate`, `docker`, `jq`, and Agent Substrate v1.0.0.
