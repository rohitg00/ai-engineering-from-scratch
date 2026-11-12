# Idle suspender

Agent Substrate v1.0.0 does not suspend an actor that has no traffic. This program does. It is one Python file with no dependencies.

## How it works

- It starts one `kubectl ate proxy actor` for each actor you name.
- It listens on one local port and forwards `/<actor>/<path>` to that actor.
- It records the time of the last finished request for each actor.
- Once a second it suspends each running actor that has no open request and no request for `--idle` seconds.
- A request that arrives during a suspend waits until the suspend ends.
- The next request for a suspended actor goes to the router, and the router resumes the actor.

## Run

```bash
python3 suspender.py --atespace demo-idle --idle 30 --listen 8080 busy bursty rare
curl http://127.0.0.1:8080/busy/
```

Add `--dry-run` to log each decision without a suspend.

It prints one tab-separated line for each event: `watch`, `request` (with `resumed` or `warm`), and `suspend`.

## Our recorded run

`run.sh setup` makes a pool with room for two actors and creates three. `run.sh record` sends ten minutes of traffic with the suspender, then two minutes without it. The files are in `capture/lab/N-demos/idle-suspender/`.

Two changes came after the recording. A request now waits for a suspend in progress, and no request met a suspend in the recording. The run without the suspender now ends after two minutes. In the recording its dry-run log continues for about 400 seconds.

## Limits

- It sees only the traffic that passes through it. A request that reaches the router another way does not reset the timer.
- It is one process with its state in memory. Run one copy.
- It measures requests, not work. An actor that computes with no open request looks idle.
- It uses the CLI and its shared identity. A production version calls the API with its own identity.
- `kubectl ate proxy` needs the Kubernetes API server.

## Needs

`python3`, `kubectl`, `kubectl-ate`. The recording also needs `docker`, `jq`, `curl`, and the image from `../failure-drill`.
