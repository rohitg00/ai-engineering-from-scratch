# Errors

> Every error text that our runs recorded, in alphabetical order, with where it appears, what it means, and the section that explains it.

Search this page for a fragment of the text in your log. Names such as `lab-c/r1` are the atespace and the actor of our run, and your text has your own. [Section 8.3](#s-symptom-cause-fix) gives the fix for each one, grouped by symptom. All strings are from Agent Substrate v1.0.0, except the last table, which is from kagent v1.0.0.

## From a request to an actor

| Text | Code | Meaning | Section |
|---|---|---|---|
| `actor ate-demo-counter/does-not-exist not found` | 404, Envoy router | No actor has that name in that atespace. | [6.1](#s-the-router-and-ingress) |
| `actor lab-c/b0-5 unavailable: no worker has room for the actor` | 503 after 5.06 s | No worker of a matching pool had free CPU and memory inside the parking budget. | [4.4](#s-request-parking) |
| `actor lab-c/r1 unavailable: AssignWorker prerequisite not met for Actor: lab-c/r1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)` | 503 in 0.07 s | The actor is crashed, and only a suspended actor can resume. | [3.5](#s-crashed-and-revertactor) |
| `actor lab-e/e-run unavailable` | 503 after 3 to 5 s | The router got no answer from `ate-api-server`. | [8.2](#s-when-a-dependency-is-down) |
| `actor lab-n/q2 unavailable: AssignWorker prerequisite not met for Actor: lab-n/q2 (got: ACTOR_STATE_REVERTING, want ACTOR_STATE_SUSPENDED)` | 503 in 0.06 s | A revert started while the node of the actor was down, and it did not finish. | [3.5](#s-crashed-and-revertactor) |
| `actor lab-n/u1 unavailable` | 503 after 5 to 8 s, after one 504 | The actor is in `ACTOR_STATE_RESUMING` on a node that stopped. | [4.3](#s-placement) |
| `actor xa/x2 unavailable: no worker has room for the actor` | 503 after 5.06 s | The `workerSelector` of the template matched no WorkerPool. The text is the same as for a full pool, and the template has no golden tag. | [3.6](#s-atespaces) |
| `error resuming actor lab-c/x1` | 500 in 0.08 s | The resume failed because the node-local snapshot was gone. The actor is now crashed. | [3.5](#s-crashed-and-revertactor) |
| `error resuming actor lab-c/r1` | 500 in 0.41 s | The request arrived soon after a node restart, before the workers had registered. The actor is now crashed. | [8.2](#s-when-a-dependency-is-down) |
| `error resuming actor lab-e/e-run` | 500 after a wait of up to 9 s | `ate-api-server` could not read Postgres. | [8.2](#s-when-a-dependency-is-down) |
| `ingress failed` | 404, agentgateway router | The actor does not exist, or the actor reference is not valid. | [6.6](#s-the-dataplane-choice) |
| `invalid actor reference` | 404, Envoy router | The `ate-target-actor` header is not `atespace/name`. | [6.1](#s-the-router-and-ingress) |
| `upstream connect error or disconnect/reset before headers. reset reason: connection termination` | 503 in 0.06 s | The process in the sandbox exited, or the node of the actor stopped. The actor still reads RUNNING in both cases, for 20 minutes in our longest watch of an exit. | [8.3](#s-symptom-cause-fix), [4.3](#s-placement) |
| The same text, on a request that was open | 503 after 2.2 s | A suspend stopped the actor during the request. The actor reads SUSPENDED, and the next request resumes it. | [3.3](#s-suspendactor-and-resumeactor) |
| code 000, no body | client timeout | The request hung. In our runs the cause was Postgres, or the Kubernetes API server for requests through `kubectl ate proxy`. | [8.2](#s-when-a-dependency-is-down) |

## From a TLS handshake with the router

| Text | Dataplane | Meaning | Section |
|---|---|---|---|
| `tlsv13 alert certificate required` | agentgateway | The client sent no certificate. | [5.1](#s-client-authentication) |
| `certificate unknown` | Envoy | The client certificate has an identity that the allowlist does not hold. | [5.1](#s-client-authentication) |
| `Connection reset by peer` | agentgateway | The same cause as the row above. | [6.6](#s-the-dataplane-choice) |

## From inside an actor, on the way out

| Text | Dataplane | Meaning | Section |
|---|---|---|---|
| `actor egress policy denied` | agentgateway, HTTP 403 | No rule of the egress policy allows the destination. | [6.2](#s-egresspolicy-and-default-deny) |
| `egress denied` | Envoy, HTTP 403 | No rule of the egress policy allows the destination. | [6.2](#s-egresspolicy-and-default-deny) |
| `status: NXDOMAIN` | both | The DNS relay answers only for names that a rule allows. | [6.3](#s-the-dns-relay) |
| `curl: (6) Could not resolve host: drip.egress-target.svc.cluster.local` | both | The same cause, as `curl` reports it. | [6.3](#s-the-dns-relay) |

## From kubectl ate and the installer

| Text | Meaning | Section |
|---|---|---|
| `actor "f-deny" in atespace "lab-f" has no egress policy` | `get egress-policy` on an actor that has none. The actor is at default deny. | [6.2](#s-egresspolicy-and-default-deny) |
| `egress_policy.rules[2].tls_passthrough.ports: Required value` | A pass-through rule needs `ports`. | [6.4](#s-tls-interception) |
| `Error: failed to connect to ate-api-server: no ready api pods in ate-system` | No `ate-api-server` pod is ready. In our run the cause was Postgres. | [8.2](#s-when-a-dependency-is-down) |
| `Error: failed to create actor template: rpc error: code = InvalidArgument desc = actor_template.golden_egress_policy: Forbidden` | The template has a preview field, and the server flag or the client flag `--preview` is missing. | [8.5](#s-limits-at-v1-0-0) |
| `Error: failed to list actors: rpc error: code = PermissionDenied desc = permission denied: principal "user:system%3Aserviceaccount%3Aate-users%3Aalice" lacks "can_list_actors" on "atespace:lab-v"` | The token is valid, and no access policy allows the call. The same sentence names `can_create_actor`, `can_list_workers`, `can_list_atespaces`, or `can_create_access_policy` for other calls. | [5.2](#s-access-policies) |
| `Error: failed to list actors: rpc error: code = Unauthenticated desc = invalid bearer token` | The token file holds no valid token for the audience `api.ate-system.svc`. | [5.1](#s-client-authentication) |
| `Error: failed to resume actor: rpc error: code = Unavailable desc = while calling atelet Restore` | A resume in the first seconds after the control plane returned from a node restart. The worker had not registered again. | [4.3](#s-placement) |
| `Error: failed to resume actor: rpc error: code = Unavailable desc = worker b17a6492-9643-42f1-bfdb-8bb88ee46772 assigned to actor lab-c/w1 is unavailable` | A resume a few seconds later. The worker from before the restart was marked unavailable. | [4.3](#s-placement) |
| `Error: failed to revert actor: rpc error: code = Aborted desc = another operation is in progress for this actor` | A revert while a resume was in progress on a node that had stopped. | [3.5](#s-crashed-and-revertactor) |
| `Error: failed to revert actor: rpc error: code = FailedPrecondition desc = Actor lab-n/p3 is not in a revertable state (got: ACTOR_STATE_RESUMING, want one of [ACTOR_STATE_RUNNING ACTOR_STATE_CRASHED]` | A revert of an actor that stayed in `ACTOR_STATE_RESUMING` on a stopped node. Our trace cut the end of the text. | [3.5](#s-crashed-and-revertactor) |
| `Error: failed to revert actor: rpc error: code = Unavailable desc = while calling atelet Terminate` | A revert of a running actor whose node had stopped. The actor stayed in `ACTOR_STATE_REVERTING`. | [3.5](#s-crashed-and-revertactor) |
| `Error: failed to suspend actor: rpc error: code = Internal desc = internal server error: workflow failed at step CallAteletSuspend: actor lab-c/j1 crashed` | A suspend found a dead sandbox. The actor is now crashed. | [8.3](#s-symptom-cause-fix) |
| `Error: failed to update actor: rpc error: code = FailedPrecondition desc = actor must be ACTOR_STATE_SUSPENDED to change its actor template (got: ACTOR_STATE_RUNNING)` | `update actor --template` on a running actor. Suspend it first. | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| `Error: manifest for actor "f-main" in atespace "lab-f" lacks the metadata.uid and metadata.version preconditions that "get egress-policy -o yaml" prints` | An update must name the version that it replaces. | [6.2](#s-egresspolicy-and-default-deny) |
| `Error: unknown flag "-A"` | `get workers` has no all-atespaces flag. It lists every namespace by default. | [2.2](#s-kubectl-ate) |
| `Error: while building the envoy-dataplane image: exit status 125` | The source install needs `docker buildx`. | [2.1](#s-install-with-ate-setup) |
| `global has no access policy` | `get access-policy --global` on a new install. Only the bootstrap owners have a global role. | [5.2](#s-access-policies) |
| `Unable to connect to the server: EOF` | `kubectl` could not reach the Kubernetes API server. Actors still served requests. | [8.2](#s-when-a-dependency-is-down) |
| `unknown flag: --platform` | Docker has no buildx plugin. This line comes before the build error above. | [2.1](#s-install-with-ate-setup) |
| `Warning: no --token-file given; acting as the shared identity system:serviceaccount:ate-system:ate-client rather than as yourself. Pass --token-file to act as yourself.` | No `--token-file` was given, so the CLI uses the shared identity. | [5.1](#s-client-authentication) |

One more text has no log in our records. On the Apple silicon laptop, `kubectl ate` printed `services "api" not found` when the kubeconfig context pointed at a cluster with no Substrate.

## From the API, as status codes

| Code | When | Section |
|---|---|---|
| `FAILED_PRECONDITION` | a lifecycle call from a state that it does not accept, such as a resume of a crashed actor, or a delete of an atespace that is not empty | [the states reference](#s-ref-states) |
| `ABORTED` | a write that named an old `version`, or two workflows on one object | [the API reference](#s-ref-api-methods) |
| `InvalidArgument` | a manifest that fails validation, such as a rule without ports | [6.2](#s-egresspolicy-and-default-deny) |
| `Internal` | a workflow step failed. The text names the step. | [8.3](#s-symptom-cause-fix) |

## From the kagent CLI

| Text | Meaning | Section |
|---|---|---|
| `bind: address already in use` | Two CLI calls opened a port-forward on port 8083 at the same time. | [7.1](#s-kagent-on-substrate) |
| `kubectl port-forward exited before the server became ready` | The first line of the same failure. | [7.1](#s-kagent-on-substrate) |

Sources: capture/lab/V-validation/06-template-move/10-move.tsv, capture/lab/V-validation/07-cross-namespace-pool/10-cross.tsv, capture/lab/V-validation/08-access-control/10-access.tsv, capture/lab/V-validation/10-preview-feature/10-preview.tsv, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/V-validation/12-suspend-during-request/10-inflight.tsv, capture/lab/N-demos/failure-drill/drill-run.log, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/93-after-node-return.tsv, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/J-container-death/10-trace.tsv, capture/lab/E-dependency-loss/12-probe-incluster.tsv, capture/lab/E-dependency-loss/12-probe-proxy.tsv, capture/lab/E-dependency-loss/14-T1-cli-during.txt, capture/lab/E-dependency-loss/16-T3-kubectl-during.txt, capture/lab/G-dataplane/envoy/ingress-auth/, capture/lab/G-dataplane/agentgateway/ingress-auth/, capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/envoy/19-first-run-update-refused.txt, capture/lab/F-egress/envoy/19b-second-run-passthrough-ports-required.txt, capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log, capture/lab/A-quickstart/60-state.log, capture/lab/A-quickstart/50-create-actor.log, capture/lab/K-kagent/latency/D-par-5.err; api/ateapi/v1/ateapi.proto (the status codes in the method comments) at v1.0.0.
