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

The error bodies that this manual records are from the Envoy dataplane, unless a row says otherwise. On agentgateway the status codes are the same and the bodies are not, as the part after the table explains.

| Symptom | Code and delay | Cause that we proved | Fix | Section |
|---|---|---|---|---|
| `actor lab-c/b0-5 unavailable: no worker has room for the actor` | 503 after 5.06 s | Each worker of the pool had its CPU reserved by running actors. The router held the request for its 5 s budget. | Suspend actors that do no work, or add workers. Retry: a worker that became free 2 s into the wait served the request. | [4.4](#s-request-parking), [4.5](#s-sizing-a-pool) |
| The same text, soon after a node restart | 503 after 5.06 s | The control plane had marked each worker from before the restart unavailable, and the workers had not registered again. The window was 10 to 30 s in our second run. | Retry for one minute before you add workers. | [4.3](#s-placement), [8.2](#s-when-a-dependency-is-down) |
| `actor xa/x2 unavailable: no worker has room for the actor`, for an actor of a new template that has no golden tag | 503 after 5.06 s | The `workerSelector` of the template matched no WorkerPool. Substrate accepted the template, and the text is the text of a full pool. | Compare the selector with the labels of the pool. Create a new template with the right labels, because a template cannot change. | [3.6](#s-atespaces) |
| 504 with an empty body, then `actor lab-n/u1 unavailable` after 5 to 8 s, with the actor in `ACTOR_STATE_RESUMING` | 504 after 10 s, then 503 | The node of a suspended actor had stopped. The actor stayed bound to that node, in `ACTOR_STATE_RESUMING` for 5 min 33 s from its first request. It was crashed 5 min 44 s after the stop command. It did not move to another node. | Send no `revert` during the outage: it was refused 19 of 19 times, or it left the actor in `ACTOR_STATE_REVERTING`. Create a new actor from a tag that you made before the stop, which took 1.2 s. Or bring the node back, then revert. | [8.2](#s-when-a-dependency-is-down), [4.3](#s-placement) |
| 504 with an empty body on the first request to a suspended actor, with the actor in `ACTOR_STATE_RESUMING` and its node up | 504 after 10.05 s | The resume took more than 10 s, because the snapshot was large and the bucket was far or slow. Envoy stopped its wait for the router, and the resume went on. | Send the request again after a pause, and send no `revert`. In 32 of 32 cycles a later request returned 200 with the state. | [4.4](#s-request-parking), [8.1](#s-postgres-and-the-object-store) |
| 504 with an empty body on every request to one running actor after a Postgres outage, while other actors answer | 504 after 10.01 s | Not found. The router logged `ResumeActor` for the actor and no result. We saw it in 1 of 2 outages of a database on another machine. | `kubectl rollout restart` of the `atenet-router` Deployment. The next request returned 200 in 0.33 s with the state. A resume command and a suspend did not help. | [8.2](#s-when-a-dependency-is-down) |
| `AssignWorker prerequisite not met for Actor: lab-c/r1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)` | 503 in 0.07 s | The actor is crashed. Substrate resumes only a suspended actor. | `kubectl ate revert actor`, then send the request again. | [3.5](#s-crashed-and-revertactor) |
| `error resuming actor lab-c/x1` | 500 in 0.08 s | The snapshot was on one node only, and the node copy was gone. The request moved the actor to crashed. | `kubectl ate revert actor`. The calls since the last durable snapshot are lost. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives), [3.5](#s-crashed-and-revertactor) |
| `error resuming actor lab-c/r1`, soon after a node restart | 500 in 0.41 s | The request arrived before the workers had registered again. It moved a suspended actor to crashed. | `kubectl ate revert actor`. Hold requests until the workers are active. | [8.2](#s-when-a-dependency-is-down) |
| `error resuming actor lab-e/e-run`, after a client timeout | 500 after 0.3 to 8.3 s | Postgres was away. `ate-api-server` could not read the actor. | Restore the database. Requests recover in seconds, resumes in half a minute. | [8.2](#s-when-a-dependency-is-down) |
| `error resuming actor sc-lab/t-128`, in a burst, after `ate-api-server` went to four replicas | 500 after 0.66 to 1.35 s | The bundled Postgres ran out of its 100 connections. The API server log has `FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute (SQLSTATE 53300)` or `FATAL: sorry, too many clients already`. Some actors were crashed. | Scale `ate-api-server` back to two replicas, and revert the crashed actors. We did not test a higher connection limit. | [4.5](#s-sizing-a-pool) |
| `actor lab-e/e-run unavailable`, with nothing after it | 503 after 3 to 5 s | The router got no answer from `ate-api-server`. We saw this text with `ate-api-server` away, and also with Postgres away, for a running and for a suspended actor. | Check both: that the `ate-api-server` pods are ready, and that Postgres is up. The text does not separate the two. | [8.2](#s-when-a-dependency-is-down) |
| `upstream connect error or disconnect/reset before headers. reset reason: connection termination` | 503 in about 0.06 s | The process in the sandbox exited. The actor still reads `ACTOR_STATE_RUNNING`. | Suspend with `--mode sync`, which fails and marks the actor crashed. Then revert. | [3.5](#s-crashed-and-revertactor) |
| The same text, on a request that was open, with the actor `ACTOR_STATE_SUSPENDED` afterwards | 503 after 2.2 s, at the moment of the suspend | Something suspended the actor during the request. A suspend does not wait for open requests, and the suspend call reports success. | Send the request again, and it resumes the actor. Suspend only an actor that is idle. | [3.3](#s-suspendactor-and-resumeactor) |
| The same text, with the worker of the actor `WORKER_STATE_UNAVAILABLE` | 503 after 0.50 to 5.07 s | The node of a running actor had stopped. The delay separates this row from a process that exited. The actor read `ACTOR_STATE_RUNNING` for the 10 min of our probe. | Send no `revert` and no `delete`. A `revert` failed with `while calling atelet Terminate` and left the actor in `ACTOR_STATE_REVERTING`. Create a new actor from an earlier tag, or bring the node back and then revert. | [8.2](#s-when-a-dependency-is-down), [3.5](#s-crashed-and-revertactor) |
| `AssignWorker prerequisite not met for Actor: lab-n/q2 (got: ACTOR_STATE_REVERTING, want ACTOR_STATE_SUSPENDED)` | 503 in 0.06 s | A revert started while the node of the actor was down, and it did not finish. | Bring the node back, wait for its `atelet`, then send the revert again. That worked in 0.2 s in one run. More reverts during the outage all failed, 3 to 28 of them in five runs. | [3.5](#s-crashed-and-revertactor), [8.2](#s-when-a-dependency-is-down) |
| The same text with `got: ACTOR_STATE_DELETING` | 503 in 0.07 s | A `delete` ran while the node of the actor was down, and it did not finish. A new actor with the same name gets `AlreadyExists`. | Bring the node back. Until then the name is blocked. | [8.2](#s-when-a-dependency-is-down) |
| `ingress failed` on agentgateway, with status 500, 504, or 503 | 0.04 to 5.0 s | Postgres or `ate-api-server` was away. On agentgateway the body is the same for both, and for an unknown actor. | Check that the `ate-api-server` pods are ready and that Postgres is up. A running actor answered again 21 s after Postgres was ready. | [8.2](#s-when-a-dependency-is-down) |
| `actor ate-demo-counter/does-not-exist not found` on Envoy, `ingress failed` on agentgateway | 404 in 0.02 s | No actor has that name in that atespace. | Check the `ate-target-actor` header. | [6.1](#s-the-router-and-ingress) |

### On agentgateway, read the status code and the header

On the agentgateway dataplane, the body does not name the cause. Every ingress failure of Substrate returns the body `ingress failed`, with one exception {{agentgateway}}. A full pool returns `no worker has room for the actor`, without the `actor ... unavailable:` text in front of it.

| What you have on agentgateway | Where to read it | What it tells you |
|---|---|---|
| The status code | the response | The codes are those of the table above: 404, 503, 504, 500, 401, and 403. |
| The response header `ate-error-reason` | the response | A reason code, when the gateway has one. The code at v1.7.0 sets `LOT_FULL` for a full parking lot and `API_UNAVAILABLE` when `ate-api-server` did not answer. |
| The log line `substrate ResumeActor failed` | the log of `atenet-router` | The gRPC code and the full message of `ate-api-server`, such as `Actor ate-demo-counter/does-not-exist not found`. |
| The actor state | `kubectl ate get actors` | It separates a crashed actor from a full pool, as on Envoy. |

The header rule is from the code. Our recordings on agentgateway kept the status code and the body, and they did not keep the response headers. The log line is from our run: the gateway logged the full message for the 404 that returned `ingress failed`. So on agentgateway, match on the status code and the header, and never on the body.

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

**We measured** this on the x86 server guest (24 vCPU, 47 GB, nested KVM), with three actors. The first read RUNNING in 6 of 6 samples over 14 s, and every request returned this 503. Two more read RUNNING for 20 minutes 36 s, in 81 and 80 samples, and 20 of 20 requests returned this 503. In each case a suspend then failed with `workflow failed at step CallAteletSuspend: actor lab-c/j1 crashed`, or the same text for the other actor, and only then did the state change. Each dead actor kept one CPU of its worker until that suspend.

A process that the kernel killed for memory was different. That actor read `ACTOR_STATE_CRASHED` at the second sample, 4 s after the kill.

**Our position:** do not wait for Substrate to report a dead process. Have your harness check two things when it sees this 503 body: the actor reads `ACTOR_STATE_RUNNING`, and its worker is active. Then the harness runs the suspend and the revert itself. With the worker `WORKER_STATE_UNAVAILABLE` the node is down, and a revert makes the case worse.

## The install fails

| Symptom | Cause that we proved | Fix | Section |
|---|---|---|---|
| `unknown flag: --platform`, then `Error: while building the envoy-dataplane image: exit status 125` | The install from source builds the Envoy image with `docker buildx`. The stock Docker package of Ubuntu 24.04 has no buildx plugin. | Install from the release images. To build from source, install `docker-buildx` first. | [2.1](#s-install-with-ate-setup) |
| `Error: unknown flag "-A"` from `kubectl ate get workers -A` | Workers are not scoped to an atespace. The command lists the workers of all namespaces by default. Its filters are `-n`, `-l`, `-a` for the workers that host actors of one atespace, and `--sandbox-class`. | Run `kubectl ate get workers` with no flag. | [2.2](#s-kubectl-ate) |

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

## The actor cannot reach a host

| Symptom | Dataplane | Cause that we proved | Fix | Section |
|---|---|---|---|---|
| `status: NXDOMAIN` for every name | both | No rule of the egress policy names that host. The DNS relay answers only for allowed names. | Add a rule with the full host name. | [6.3](#s-the-dns-relay) |
| HTTP 403, `egress denied` | Envoy | The request went to an address that no rule allows. | Add the host to the policy, and call it by name. | [6.2](#s-egresspolicy-and-default-deny) |
| HTTP 403, `actor egress policy denied` | agentgateway | The same cause. The two dataplanes use different texts. | The same fix. | [6.2](#s-egresspolicy-and-default-deny) |
| A connection reset, with no HTTP response | Envoy | The actor has no egress policy at all. | Create a policy for the actor. | [6.2](#s-egresspolicy-and-default-deny) |
| `egress_policy.rules[2].tls_passthrough.ports: Required value` | CLI | A pass-through rule has no default port. | Add `ports` to the rule. | [6.2](#s-egresspolicy-and-default-deny) |
| `lacks the metadata.uid and metadata.version preconditions` | CLI | An update must name the version that it replaces. | Copy both fields from `get egress-policy -o yaml`. | [6.2](#s-egresspolicy-and-default-deny) |
| HTTP 503, `upstream connection failed`, for a host under an `https` rule | agentgateway | The host has a certificate from a private CA. The gateway logged `invalid peer certificate: UnknownIssuer`. | Mount a root file that holds your CA over the root file of the proxy container. Apply it again after each installer run. | [6.4](#s-tls-interception) |
| HTTP 503, `upstream connect error or disconnect/reset before headers. reset reason: remote connection failure` | Envoy | The same cause. The Envoy log had `CERTIFICATE_VERIFY_FAILED`. | The same fix. | [6.4](#s-tls-interception) |
| HTTP 403 on a connection that worked a moment ago | both | A rule was removed. The next request on a reused connection is refused, about 1 s later on agentgateway and 5 to 9 s later on Envoy. | Put the rule back, or accept the refusal. | [6.6](#s-the-dataplane-choice) |
| The upstream still gets the old secret after you changed the Kubernetes Secret | agentgateway | The gateway keeps a fetched credential for 300 s. The new value arrived after 100.6 to 280.5 s in three changes. | Wait 5 minutes, and keep the old value valid at the upstream for that time. | [6.5](#s-credential-injection) |
| A model call takes 0.6 s more than the same call from a pod | both | The client opened a new HTTPS connection under an `https` rule. The handshake with the interception endpoint took about 0.6 s. | Reuse the connection. The same request took 10 to 12 ms on an open one. | [6.4](#s-tls-interception), [7.2](#s-agentgateway) |

A blocked host looks like a DNS failure, and that sends people to the wrong team. In the kagent run a short Service name, `mock-llm.kagent:8080`, returned 403 while the full name of the same Service returned 200. The policy matches the name that the actor asks for, so use the name exactly as the rule has it.

## A client cannot connect, or a command is refused

| Symptom | Cause that we proved | Fix | Section |
|---|---|---|---|
| `tlsv13 alert certificate required` | The client sent no certificate to the agentgateway router. | Give the client a certificate from the cluster signer. | [5.1](#s-client-authentication) |
| `certificate unknown` on Envoy, a reset on agentgateway | The client identity is not in the ingress allowlist. | Add the SPIFFE ID with `--ingress-allowed-spiffe-ids`. | [5.1](#s-client-authentication) |
| `Error: failed to connect to ate-api-server: no ready api pods in ate-system` | No API pod was ready. In one run Postgres was away. In another the node had restarted, and the CLI printed this text from 18 to 157 s after the restart. | Check Postgres before the API server. After a node restart, wait for the API pods. | [8.2](#s-when-a-dependency-is-down) |
| `Unauthenticated desc = invalid bearer token` | The file of `--token-file` held a text that is no token, or a Kubernetes token without the audience `api.ate-system.svc`. | Create the token with `--audience api.ate-system.svc`. | [5.1](#s-client-authentication) |
| `PermissionDenied desc = permission denied: principal "user:system%3Aserviceaccount%3Aate-users%3Aalice" lacks "can_list_actors" on "atespace:lab-v"` | The token is valid, and no access policy gives that principal a role that allows the call. | Add the principal to the access policy of the atespace. A scope of `global:root` needs a global role. | [5.2](#s-access-policies) |
| `FailedPrecondition desc = actor must be ACTOR_STATE_SUSPENDED to change its actor template (got: ACTOR_STATE_RUNNING)` | `kubectl ate update actor --template` ran against a running actor. | Suspend the actor, then update it. | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| `InvalidArgument desc = actor_template.golden_egress_policy: Forbidden` | The template uses a preview feature, and the server flag or the client flag for it is missing. The error does not name the feature. | Set `--preview` with the feature name on the server and pass `--preview` to `kubectl ate`. | [8.5](#s-limits-at-v1-0-0) |
| `FailedPrecondition desc = Tag not found`, from `create actor --template` | The golden tag of the template was deleted with `kubectl ate delete tag`. `get actor-templates` still lists the tag id, with an empty `ERROR` column. | Create a new template. Never delete a tag with the scope `TAG_SCOPE_PUBLISHED` that a template lists. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| `failed to create tag: ... must be ACTOR_STATE_SUSPENDED to be tagged (got: ACTOR_STATE_RESUMING)` | The actor is bound to a node that stopped. A tag cannot be made after the fact. | Make tags while the actor is suspended and its node is up. | [8.2](#s-when-a-dependency-is-down) |
| `failed to revert actor: ... while calling atelet Terminate` | The node of the actor is down. The revert needs `atelet` on that node, and the actor is now `ACTOR_STATE_REVERTING`. | Send no more reverts. Bring the node back, then revert once. | [3.5](#s-crashed-and-revertactor), [8.2](#s-when-a-dependency-is-down) |
| `failed to suspend actor: ... MarkSuspending prerequisite not met ... (got: ACTOR_STATE_RESUMING, want ACTOR_STATE_RUNNING)`, or `failed to resume actor: ... worker ... assigned to actor ... is unavailable` | The actor is bound to a worker on a node that stopped. | No command helps during the outage. Use a tag, or wait for the node. | [8.2](#s-when-a-dependency-is-down) |
| `SSL: no alternative certificate subject name matches target hostname 'atenet-router.ate-system.svc.cluster.local'` | The client called the router by its long name. The router certificate is valid for the short name. | Call `atenet-router.ate-system.svc`. | [6.1](#s-the-router-and-ingress) |
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

**We measured** the kagent CLI on an x86 server guest (16 vCPU, 31 GB), in the kagent run. With one standing port-forward no call failed. A Session create took 0.17 s at the median (n=32), where it had taken 0.39 s (n=20) with a port-forward for each call.

## When no row matches

Collect four things before you ask for help or open an issue. Take the status code, the seconds, and the body of the failed request. Take the actor as `kubectl ate get actor -o yaml` prints it, which includes the state and each snapshot. Take the lifecycle log from `kubectl ate logs actor --source lifecycle`. Take the worker list from `kubectl ate get worker`, which shows the room in each pool.

```takeaways
- Record the seconds and the body of each failed request, because the status code repeats across causes.
- Run `kubectl ate revert actor` when the body names `ACTOR_STATE_CRASHED`.
- Treat the `upstream connect error` body as a dead process, and suspend then revert the actor.
- Check the worker state first: on a stopped node, send no suspend and no revert.
- Retry a `no worker has room` response before you add workers.
- Read NXDOMAIN inside an actor as a missing egress rule before you suspect DNS.
- Pass `--context` to `kubectl ate` on a machine with more than one cluster.
```

Sources: capture/lab/summary/node-loss-x86.json, capture/lab/summary/bursts-one-node-x86.json, capture/lab/Z-bursts/10-run/40-errors/10-ate-api-server-59dcf8d6bf-srn4n.log, capture/lab/Z-bursts/10-run/37-router-errors.log, capture/lab/summary/network-x86.json, capture/lab/summary/rotation-x86.json, capture/lab/summary/dependency-loss-agw-x86.json, capture/lab/P-node-loss/40-balt-suspend-resume-delete.tsv, capture/lab/P-node-loss/74-second-revert.tsv, capture/lab/P-node-loss/80-tag-rescue.tsv, capture/lab/P-node-loss/96-golden-tag-deleted.txt, capture/lab/Q-network/g-dependency-loss-agw/12-probe-incluster.tsv, capture/lab/Q-network/i-model-gateway/20-results-agentgateway.txt, capture/lab/Q-network/i-model-gateway/20-results-envoy.txt, capture/lab/Q-network/m-router-ports/agentgateway/10-port-probes.tsv, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/I-capacity/13-parking-trace.tsv, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/J-container-death/10-trace.tsv, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/E-dependency-loss/14-T1-cli-during.txt, capture/lab/E-dependency-loss/16-T3-kubectl-during.txt, capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log, capture/lab/A-quickstart/02-steps.tsv, capture/lab/A-quickstart/60-state.log, capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/envoy/19-first-run-update-refused.txt, capture/lab/F-egress/envoy/19b-second-run-passthrough-ports-required.txt, capture/lab/G-dataplane/envoy/ingress-auth/, capture/lab/G-dataplane/agentgateway/ingress-auth/, capture/lab/K-kagent/latency/D-par-5.err, capture/lab/K-kagent/latency/timings.tsv, capture/lab/K-kagent/probes/egress-errors-sample.txt, capture/lab/summary/failures-x86.json, capture/lab/summary/parking-x86.json, capture/lab/V-validation/06-template-move/10-move.tsv, capture/lab/V-validation/07-cross-namespace-pool/10-cross.tsv, capture/lab/V-validation/08-access-control/10-access.tsv, capture/lab/V-validation/10-preview-feature/10-preview.tsv, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/V-validation/12-suspend-during-request/10-inflight.tsv, capture/lab/N-demos/failure-drill/drill-run.log; cmd/kubectl-ate/internal/cmd/worker.go, cmd/kubectl-ate/internal/cmd/actor.go, cmd/atenet/internal/router/ingress/errors.go and cmd/ateapi/internal/controlapi/workflow_revert.go at v1.0.0; agentgateway v1.7.0 crates/agentgateway/src/proxy/mod.rs and crates/agentgateway/src/http/substrate/ingress.rs (the `ingress failed` body and the `ate-error-reason` header); capture/lab/G-dataplane/agentgateway/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/52-router-log-agentgateway.log., capture/lab/summary/remote-store-x86.json, capture/lab/summary/remote-postgres-x86.json, capture/lab/X-remote-store-pg/50-pg-tests/37-follow-up.txt, capture/lab/X-remote-store-pg/50-pg-tests/42-x-run-router-restart.txt
