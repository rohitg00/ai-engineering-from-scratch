# Symptom, cause, fix

> Each Substrate failure that we recorded has a fixed text, and the text, the status code, and the delay together name one cause and one fix.

An agent fails and your client logs a 503. Substrate returns a 503 for a full pool, a crashed actor, a dead process, and an API server that is away. The four cases need four different actions. The status code does not separate them. The body and the delay do.

When you finish this section, you can take an error string from your log, find its row here, and apply the fix. Every string in the tables came from one of our runs, and each row names the section that explains the mechanism. [The error reference](#s-ref-errors) lists the same strings in alphabetical order.

## Start from the status code and the delay

[Figure 8.3](#fig-8-3) sorts the failures of one request to an actor. Measure how long the failed request took before you read the body. A failure in under 0.1 s came from a decision. A failure at 5 s came from a wait that ran out.

```figure
id: fig-8-3
kind: decision
title: from a failed request to its cause
claim: The delay and the body of a failed request separate six causes that share the status codes 500 and 503.
caption: Read top to bottom. Each row is one failure as the client saw it, then the cause that we proved, then the command that fixes it. From capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/J-container-death/10-trace.tsv, and capture/lab/E-dependency-loss/20-analysis.txt.
```

## A request to an actor fails

| Symptom | Code and delay | Cause that we proved | Fix | Section |
|---|---|---|---|---|
| `actor lab-c/b0-5 unavailable: no worker has room for the actor` | 503 after 5.06 s | Each worker of the pool had its CPU reserved by running actors. The router held the request for its 5 s budget. | Suspend actors that do no work, or add workers. Retry: a worker that became free 2 s into the wait served the request. | [4.4](#s-request-parking), [4.5](#s-sizing-a-pool) |
| The same text, soon after a node restart | 503 after 5.06 s | The control plane had marked each worker from before the restart unavailable, and the workers had not registered again. The window was 10 to 30 s in our second run. | Retry for one minute before you add workers. | [4.3](#s-placement), [8.2](#s-when-a-dependency-is-down) |
| 504 at the client timeout, then `actor lab-n/u1 unavailable` after 5 to 8 s, with the actor in `ACTOR_STATE_RESUMING` | 504 after 10 s, then 503 | The node of a suspended actor had stopped. The actor stayed bound to that node for 5 min 44 s and was then crashed. It did not move to another node. | Bring the node back. A `revert` did not free the actor in our runs. | [4.3](#s-placement), [3.5](#s-crashed-and-revertactor) |
| `AssignWorker prerequisite not met for Actor: lab-c/r1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)` | 503 in 0.07 s | The actor is crashed. Substrate resumes only a suspended actor. | `kubectl ate revert actor`, then send the request again. | [3.5](#s-crashed-and-revertactor) |
| `error resuming actor lab-c/x1` | 500 in 0.08 s | The snapshot was on one node only, and the node copy was gone. The request moved the actor to crashed. | `kubectl ate revert actor`. The calls since the last durable snapshot are lost. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives), [3.5](#s-crashed-and-revertactor) |
| `error resuming actor lab-c/r1`, soon after a node restart | 500 in 0.41 s | The request arrived before the workers had registered again. It moved a suspended actor to crashed. | `kubectl ate revert actor`. Hold requests until the workers are active. | [8.2](#s-when-a-dependency-is-down) |
| `error resuming actor lab-e/e-run`, after a client timeout | 500 after 0.3 to 8.3 s | Postgres was away. `ate-api-server` could not read the actor. | Restore the database. Requests recover in seconds, resumes in half a minute. | [8.2](#s-when-a-dependency-is-down) |
| `actor lab-e/e-run unavailable`, with nothing after it | 503 after 3 to 5 s | The router got no answer from `ate-api-server`. | Check the `ate-api-server` pods, then Postgres. | [8.2](#s-when-a-dependency-is-down) |
| `upstream connect error or disconnect/reset before headers. reset reason: connection termination` | 503 in 0.06 s | The process in the sandbox exited. The actor still reads `ACTOR_STATE_RUNNING`. | Suspend with `--mode sync`, which fails and marks the actor crashed. Then revert. | [3.5](#s-crashed-and-revertactor) |
| The same text, with the worker of the actor `WORKER_STATE_UNAVAILABLE` | 503 after 0.5 to 5 s | The node of a running actor had stopped. The actor read `ACTOR_STATE_RUNNING` for the 10 min of our probe. | Bring the node back. A `revert` failed with `while calling atelet Terminate` and left the actor in `ACTOR_STATE_REVERTING`. | [4.3](#s-placement), [3.5](#s-crashed-and-revertactor) |
| `AssignWorker prerequisite not met for Actor: lab-n/q2 (got: ACTOR_STATE_REVERTING, want ACTOR_STATE_SUSPENDED)` | 503 in 0.06 s | A revert started while the node of the actor was down, and it did not finish. | Bring the node back. We did not verify another fix. | [3.5](#s-crashed-and-revertactor) |
| `actor ate-demo-counter/does-not-exist not found` on Envoy, `ingress failed` on agentgateway | 404 in 0.02 s | No actor has that name in that atespace. | Check the `ate-target-actor` header. | [6.1](#s-the-router-and-ingress) |

Three rows share the text `error resuming actor`. Separate them with the actor state. After a lost node copy or an early request after a restart, the actor is `ACTOR_STATE_CRASHED`. After a database outage a running actor is still `ACTOR_STATE_RUNNING`, and the next request succeeds.

The process exit is the case that hides longest. The state stays RUNNING, so a list of actors shows no problem.

```listing
title: an actor whose process exited
source: capture/lab/J-container-death/10-trace.tsv
lang: text
note: Three consecutive lines. The actor j1 received a request that made its process exit with code 3.
---
2026-11-12T11:30:45.229Z	j1	exit-request	200	0.065314	exiting with code 3
2026-11-12T11:30:47.441Z	j1	state	ACTOR_STATE_RUNNING	kind-control-plane	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:kind-control-plane
2026-11-12T11:30:47.518Z	j1	call	503	0.058459	upstream connect error or disconnect/reset before headers. reset reason: connection termination
```

**We measured** this on an x86 server guest (24 vCPU, 47 GB, nested KVM), once. The actor read RUNNING in 6 of 6 samples over 14 s, and every request returned this 503. The synchronous suspend then failed with `workflow failed at step CallAteletSuspend: actor lab-c/j1 crashed`, and only then did the state change. A process that the kernel killed for memory was different. That actor read `ACTOR_STATE_CRASHED` at the second sample, 4 s after the kill.

**Our position:** do not wait for Substrate to report a dead process. Have your harness treat this exact 503 body as a crash, and run the suspend and the revert itself.

## The install fails

| Symptom | Cause that we proved | Fix | Section |
|---|---|---|---|
| `unknown flag: --platform`, then `Error: while building the envoy-dataplane image: exit status 125` | The install from source builds the Envoy image with `docker buildx`. The stock Docker package of Ubuntu 24.04 has no buildx plugin. | Install from the release images. To build from source, install `docker-buildx` first. | [2.1](#s-install-with-ate-setup) |
| `Error: unknown flag "-A"` from `kubectl ate get workers -A` | Workers have no atespace. The command lists the workers of all namespaces by default, and it takes `-n` and `-l` as filters. | Run `kubectl ate get workers` with no flag. | [2.2](#s-kubectl-ate) |

```listing
title: the source install without buildx
source: capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log
lang: text
note: Two lines from the end of the log. The Docker usage text between them is cut.
---
unknown flag: --platform
…
Error: while building the envoy-dataplane image: exit status 125
```

The step failed after 163 s, so the error arrives late. The documented list of tools is Go, kubectl, and Docker, and it does not name buildx.

One more install failure has no log in our records. After a restart of Docker Desktop, `kubectl` on the Apple silicon laptop pointed at another cluster, and `kubectl ate` printed `services "api" not found`. Pass `--context` to every command, or use a kubeconfig that holds one cluster.

## The actor cannot reach a host

| Symptom | Dataplane | Cause that we proved | Fix | Section |
|---|---|---|---|---|
| `status: NXDOMAIN` for every name | both | No rule of the egress policy names that host. The DNS relay answers only for allowed names. | Add a rule with the full host name. | [6.3](#s-the-dns-relay) |
| HTTP 403, `egress denied` | Envoy | The request went to an address that no rule allows. | Add the host to the policy, and call it by name. | [6.2](#s-egresspolicy-and-default-deny) |
| HTTP 403, `actor egress policy denied` | agentgateway | The same cause. The two dataplanes use different texts. | The same fix. | [6.2](#s-egresspolicy-and-default-deny) |
| A connection reset, with no HTTP response | Envoy | The actor has no egress policy at all. | Create a policy for the actor. | [6.2](#s-egresspolicy-and-default-deny) |
| `egress_policy.rules[2].tls_passthrough.ports: Required value` | CLI | A pass-through rule has no default port. | Add `ports` to the rule. | [6.4](#s-tls-interception) |
| `lacks the metadata.uid and metadata.version preconditions` | CLI | An update must name the version that it replaces. | Copy both fields from `get egress-policy -o yaml`. | [6.2](#s-egresspolicy-and-default-deny) |

A blocked host looks like a DNS failure, and that sends people to the wrong team. In the kagent run a short Service name, `mock-llm.kagent:8080`, returned 403 while the full name of the same Service returned 200. The policy matches the name that the actor asks for, so use the name exactly as the rule has it.

## A client cannot connect

| Symptom | Cause that we proved | Fix | Section |
|---|---|---|---|
| `tlsv13 alert certificate required` | The client sent no certificate to the agentgateway router. | Give the client a certificate from the cluster signer. | [5.1](#s-client-authentication) |
| `certificate unknown` on Envoy, a reset on agentgateway | The client identity is not in the ingress allowlist. | Add the SPIFFE ID with `--ingress-allowed-spiffe-ids`. | [5.1](#s-client-authentication) |
| `Error: failed to connect to ate-api-server: no ready api pods in ate-system` | Postgres was away, so no API pod was ready. | Check Postgres before the API server. | [8.2](#s-when-a-dependency-is-down) |
| `Unable to connect to the server: EOF` | The Kubernetes API server was away. Actors still served requests. | Wait, and probe actors from inside the cluster. | [8.2](#s-when-a-dependency-is-down) |
| `bind: address already in use` from the kagent CLI | Each CLI call opens its own port-forward on port 8083. Calls that start together collide. | Keep one port-forward open, and point the CLI at it. | [7.1](#s-kagent-on-substrate) |

```listing
title: the kagent CLI when several calls start together
source: capture/lab/K-kagent/latency/D-par-5.err
lang: text
note: The first line of the error is cut to its end. The same error occurred in five of eight calls that started together.
---
… Error listen tcp4 127.0.0.1:8083: bind: address already in use unable to create listener: Error listen tcp6 [::1]:8083: bind: address already in use]
error: unable to listen on any of the requested ports: [{8083 8083}]): exit status 1
```

**We measured** the kagent CLI on an x86 server guest (16 vCPU, 31 GB), with one run of eight calls. With one standing port-forward no call failed, and each call took 0.15 s where it had taken 0.39 s.

## When no row matches

Collect four things before you ask for help or open an issue. Take the status code, the seconds, and the body of the failed request. Take the actor as `kubectl ate get actor -o yaml` prints it, which includes the state and each snapshot. Take the lifecycle log from `kubectl ate logs actor --source lifecycle`. Take the worker list from `kubectl ate get worker`, which shows the room in each pool.

```takeaways
- Record the seconds and the body of each failed request, because the status code repeats across causes.
- Run `kubectl ate revert actor` when the body names `ACTOR_STATE_CRASHED`.
- Treat the `upstream connect error` body as a dead process, and suspend then revert the actor.
- Retry a `no worker has room` response before you add workers.
- Read NXDOMAIN inside an actor as a missing egress rule before you suspect DNS.
- Pass `--context` to `kubectl ate` on a machine with more than one cluster.
```

Sources: capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/I-capacity/13-parking-trace.tsv, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/J-container-death/10-trace.tsv, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/E-dependency-loss/14-T1-cli-during.txt, capture/lab/E-dependency-loss/16-T3-kubectl-during.txt, capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log, capture/lab/A-quickstart/02-steps.tsv, capture/lab/A-quickstart/60-state.log, capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/envoy/19-first-run-update-refused.txt, capture/lab/F-egress/envoy/19b-second-run-passthrough-ports-required.txt, capture/lab/G-dataplane/envoy/ingress-auth/, capture/lab/G-dataplane/agentgateway/ingress-auth/, capture/lab/K-kagent/latency/D-par-5.err, capture/lab/K-kagent/latency/timings.tsv, capture/lab/K-kagent/probes/egress-errors-sample.txt, capture/lab/summary/failures-x86.json, capture/lab/summary/parking-x86.json; cmd/kubectl-ate/internal/cmd/worker.go and cmd/kubectl-ate/internal/cmd/actor.go at v1.0.0.
