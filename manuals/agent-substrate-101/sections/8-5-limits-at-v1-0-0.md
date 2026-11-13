# Limits at v1.0.0

> At v1.0.0 Substrate runs, suspends, and resumes actors on request, and it leaves the suspend decision, pool size, failover, and key rotation to you.

You plan a rollout and write down what the platform will do for you. It will stop idle sessions. It will add capacity under load. It will survive the loss of one pod. For Agent Substrate v1.0.0, each of those three lines is wrong, and the release does not say so in one place.

When you finish this section, you can list what Substrate does not do at v1.0.0. You can also say which of our claims rest on a run, and which parts we did not test.

## What Substrate leaves to you

[Figure 8.5](#fig-8-5) sets each job that a platform team expects against the party that does it at v1.0.0.

```figure
id: fig-8-5
kind: comparison
title: who does each job at v1.0.0
claim: Substrate performs the lifecycle operations that you request, and your harness or your platform team must decide when to request them.
caption: Read each row left to right. The left column is what Substrate does, and the right column is what you or your harness must add. From the code at v1.0.0 and the runs in capture/lab/B-lifecycle/10-trace.tsv and capture/lab/J-container-death/10-trace.tsv.
```

### No idle suspend

Nothing in Substrate suspends an actor because it has no requests. **The code** has no idle timer in `ate-api-server`, in `atelet`, or in either worker. The worker API has a method for a worker to ask for a suspend, `RequestActorSuspend`. `atelet` forwards that call, and a client library for it exists in the repository. No worker at v1.0.0 uses the library, so nothing sends the call.

**We measured** this on an x86 server guest (24 vCPU, 47 GB, nested KVM). One actor received no request for 900 s, and it read RUNNING in 60 of 60 samples. A running actor reserves its full CPU and memory limit on a worker for all that time.

The harness must call `SuspendActor`. kagent does it after every turn, in 98 of 98 turns in our run, as [section 7.1](#s-kagent-on-substrate) shows. If you write your own harness, the suspend call is the first thing to build.

### No autoscaler, and no overcommit

A WorkerPool has a fixed `replicas` number. Nothing in the install changes it. The WorkerPool kind has a scale subresource, so an outside autoscaler can change the number, and we did not test one. CPU and memory use are poor signals for it. An actor reserves its limit while it runs, whether or not it works.

Substrate also books each running actor at its full declared limit. A proposal to book less than the limit exists in the public issues, and the maintainers moved it to after the release.

**We measured** the effect in the kagent run, on a second x86 server guest (16 vCPU, 31 GB). One run started 24 turns at the same time. The single worker reported 16,000 millicores, and each actor reserved 1,000. The worker stopped at 16 running actors, and the other eight turns waited.

When a pool is full, a request waits up to 5 s and then gets a 503. [Section 4.5](#s-sizing-a-pool) gives the arithmetic for a pool.

### No GPU

An ActorTemplate at v1.0.0 can declare two resources: `cpuMillicores` and `memoryBytes`. The API has no field for a GPU or for any other device, so we ran no GPU test.

### Single-replica components

**The code** sets these replica counts in the install manifests.

| Component | Replicas | What stops when the one pod is away |
|---|---|---|
| `ate-api-server` | 2 | nothing, while one replica remains |
| `ate-idp-server` | 2 | nothing, while one replica remains |
| `atenet-router` | 1 | every request to every actor |
| `atenet-egress` | 1 | every new outbound connection from an actor |
| `ate-controller` | 1 | changes to worker pools |
| `podcertificate-controller` | 1 | new and renewed certificates |
| bundled Postgres | 1 | every request, as [section 8.2](#s-when-a-dependency-is-down) measures |

The right column is our reading of the request path, except for the Postgres row, which we ran. The router keeps its parked requests in memory, and a graceful shutdown does not drop them. After the stop signal the router keeps the parked requests until each one gets its full budget and a normal answer {{docs}}. The flag `--drain-timeout` sets that limit, and its default is longer than the parking budget {{code}}. Only a crash, a forced kill, or a drain past `--drain-timeout` drops a parked request.

We restarted the router once, as the fix in [section 8.2](#s-when-a-dependency-is-down). We did not measure what a restart does to parked requests, and we did not restart the egress gateway.

### Crash detection has a gap

Substrate marks an actor crashed when its sandbox dies or when the kernel kills it for memory. It does not notice a process that exits inside a sandbox that still runs. [Section 8.3](#s-symptom-cause-fix) shows that actor. A design for this detection is open in the public issues.

**We measured** two such actors on the x86 server guest (24 vCPU, 47 GB, nested KVM). Both read RUNNING for 20 minutes 36 s after the exit, in 81 and 80 samples. All 20 requests to one of them returned 503. Each kept 1,000 millicores of its worker for all that time. The first suspend call failed and marked the actor crashed. We did not watch longer than 20 minutes, and we did not restart the worker.

It also does not mark a running actor whose node stops. On a cluster with two worker nodes, that actor read RUNNING for the 10 minutes of our probe. Each of 150 requests got a 503.

### An actor does not leave a dead node by itself

A suspended actor is bound to the node of its last suspend, and Substrate v1.0.0 did not release it when that node stopped.

**We measured** this on the second x86 server guest (16 vCPU, 23 GB), with two worker nodes and one actor for each of four cases. An actor had a complete snapshot in the object store. It stayed in RESUMING on the stopped node for 5 min 33 s from its first request. It was crashed 5 min 44 s after the stop command. The other node had two free workers. A `revert` during the outage failed or had no lasting effect in 4 of 4 attempts on three actors.

The workers of a stopped node were listed as active for 43 to 51 s after the stop command. A new resume can go to a dead node in that time. Kubernetes moved the worker pods to the other node after 5 minutes and did not move them back. [Section 4.3](#s-placement) has the timeline.

**We measured** 13 more node-stop cases on a second x86 server guest (16 vCPU, 23 GB), once each, with the default timers. In none of them did an actor leave the stopped node by itself. One `revert` freed an actor in one situation only: suspended with `--mode sync`, no request since the stop, and the workers already marked unavailable. That revert took 7.1 s. In every other situation a `revert` left the actor in REVERTING until the node was back. A new actor from a tag that existed before the stop served its first request after 1.2 s, in 3 of 3 rescues.

So recovery from a node loss is yours to build. Substrate does not move actors, and it does not move pool pods back to a node that returns. [Section 8.2](#s-when-a-dependency-is-down) has the runbook.

### Access is coarse at the router

The ingress allowlist holds client identities, and each listed client can reach every actor in every atespace. Access policies for each atespace govern the API calls, as [section 5.2](#s-access-policies) explains. They do not govern requests through the router at v1.0.0.

### Manual key rotation

The key that signs actor JWTs lives in a pool that an operator edits. The CLI has `kubectl ate admin add-jwt-key`, `activate-jwt-key`, and `remove-jwt-key`, and the documentation gives the waits between them. No component rotates the key on a schedule. [Section 5.3](#s-actor-jwts) covers the tokens. Our install had one key, and our decoded token named it. We did not run a rotation.

### A suspend does not wait for requests

`SuspendActor` stops the sandbox at once. A request that is open at that moment gets a 503, and the suspend call still reports success. We saw this in both suspend modes, as [section 3.3](#s-suspendactor-and-resumeactor) shows. The caller of the suspend must know that the actor is idle.

### Preview features are off

Three features exist behind a server flag and a client flag. All three are off by default.

| Preview name | What it adds |
|---|---|
| `ExternalVolumes` | CSI volumes that an actor mounts and that no snapshot includes |
| `GoldenEgressPolicy` | an egress policy for the actor that builds the golden snapshot |
| `PerTemplateSnapshotLocation` | a snapshot location in each template, in place of one for the cluster |

To use one, start every component with `--preview` and its name, and pass `--preview` to `kubectl ate`. A request without the client flag behaves as if the feature were off. We tried all four combinations with a template that has a `goldenEgressPolicy` field.

| Server `--preview` | `kubectl ate --preview` | Result of `create actor-template` |
|---|---|---|
| empty | no | `InvalidArgument desc = actor_template.golden_egress_policy: Forbidden` |
| empty | yes | the same error |
| `GoldenEgressPolicy` | no | the same error |
| `GoldenEgressPolicy` | yes | accepted, and the golden tag was ready within 30 s |

```listing
title: the error when one of the two switches is missing
source: capture/lab/V-validation/10-preview-feature/10-preview.tsv
lang: text
note: One line of the trace, with the server flag on and the client flag missing.
---
2026-11-12T13:06:36.842Z	on	no-flag	Error: failed to create actor template: rpc error: code = InvalidArgument desc = actor_template.golden_egress_policy: Forbidden 
```

We ran each combination once on the x86 server guest. The error does not name the preview feature or the flag, so you must know that the field is a preview field. Once the template existed, `kubectl ate get` read it without the client flag.

Our test had two limits. We set the flag on `ate-api-server` only, with an edit of its Deployment, and the documented way sets it on every component through `ate-setup`. We also did not test that the egress rule of the golden actor works. Every other experiment ran with `--preview=` empty, so this manual describes none of the three features in use.

### Smaller limits that will reach you

- An open response or pass-through connection outlives its egress rule. Removing a rule stops requests, also on a reused connection, within 9 s. Only a suspend cuts the rest, as [section 6.6](#s-the-dataplane-choice) shows.
- A changed Secret takes up to 5 minutes to reach requests on agentgateway. We measured 100.6 to 280.5 s there, and 1.0 to 1.6 s on Envoy. [Section 6.5](#s-credential-injection) has the run.
- The egress gateway trusts public roots only. A host with a certificate from a private CA returned 503 until we replaced the root file in the proxy container. The installer removes that patch. [Section 6.4](#s-tls-interception) has it.
- On agentgateway, the stats port 15020 of the router answers `/metrics` with no credentials, and the egress gateway logs at `debug` after every installer run. [Section 6.1](#s-the-router-and-ingress) and [section 6.6](#s-the-dataplane-choice) have both.
- `kubectl ate delete tag` accepts the golden tag of a template. The template then lists a tag that is gone, and `create actor` fails with `Tag not found`. [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) has that mistake.
- An actor sees 2 CPUs at every CPU limit, and the limit is a hard cap. [Section 4.1](#s-workerpool) has the measurement.
- Names are identities. The documentation tells you never to reuse the name of a deleted atespace. A request that was allowed for the old one can apply to the new one.
- Postgres is the only store. The maintainers declined a storage plugin before the release.
- A durable directory has no size limit in the API, so one actor can fill the node disk. This comes from an open issue. We did not test it.
- The gVisor class accepts a limit for each container and enforces only the limit of the actor.

**Our position:** none of these limits makes v1.0.0 unusable. Together they mean that Substrate is one layer of a platform. Budget engineering time for four things. They are a harness that suspends, an autoscaler that reads free worker slots, a database with failover, and a probe for dead processes. [Section 7.4](#s-when-to-choose-substrate) weighs that cost against the alternatives.

## What we did not test

Most measured numbers in this manual came from clusters with one kind node. One cluster had one control plane node and two worker nodes. Every cluster had one of two dataplanes. The object store was in the cluster, except in two experiments. In one it ran outside the cluster on the same guest, and in the other on a second guest of the same server. This is the full list of what we did not run.

| Area | Not tested |
|---|---|
| Clouds | GKE, and every other managed Kubernetes service |
| Storage | Google Cloud Storage, Amazon S3, a real link with 100 ms of delay to a bucket, more than one cycle of 1,000 MiB with 100 ms on the path between two guests, a managed Postgres, a Postgres outage with dropped packets, the cause of one running actor that stayed at 504 after a Postgres outage, a connection pooler, a restore of either store |
| Scale | more than 10,750 actor rows in one cluster, more than 450 actors with a snapshot of their own, more than 300 resumes at one time, more than 300 workers on one node, a burst on more than one node, a burst to actors whose snapshot is only in the bucket, what inside the gVisor restores sets about 37 resumes each second, more replicas of `ate-api-server` with a higher connection limit of Postgres, a third run of 200 and of 300 at one time, more than 24 parallel turns, more than two worker nodes, more than 20 actors across nodes, and the site claims of millions of agents and of 10x density |
| Sandbox | the microVM class on arm64, with agentgateway, with a resume from the object store, above 500 MiB, and across CPU models. Also images with an init system, non-root images, large root filesystems |
| Agents | a hosted model, a model on a GPU, or a model large enough for real agent work behind kagent, any real model behind a model gateway, a kagent turn that runs away while a bound is set, the `maxCompletionTokens` field of a ModelConfig, a streamed model reply through a model gateway, client authentication at a model gateway, the codex and claude harnesses, MCP servers through the egress gateway |
| Lifecycle | an upgrade from v0.6.0 that keeps actors, an upgrade between two supported releases, a rollback across a schema change, an upgrade on more than one node or with the microVM class, a third run of an upgrade step, a drain with a PodDisruptionBudget on the pool, a drain of the node that runs `ate-system`, a revert in the first 20 s after a drain, the restore of a deleted golden tag, a resume at the two lower fidelities for an application with a long start on this guest |
| Network | a suspend as a cut-off for a `tlsPassthrough` connection, the step that takes 0.6 s in an intercepted handshake, the log level of `atenet-router`, a restart of `atenet-egress` as a way to refresh a credential, the content of every metric label on the agentgateway stats port, port 9902 of the Envoy container |
| Limits | memory limits under load, and CPU limits with several busy actors on one worker |
| Identity | the signature check of an actor JWT with the published key, a key rotation, federation with a second issuer or a cloud provider, a second token issuer for clients |
| Snapshots | why the object store copy of the Python actor was half of its node copy, and equal for random bytes |
| Failure | a dead process that stays `RUNNING` for more than 20 minutes or across a worker restart, the three outages on more than one node, egress during an outage, parked requests during a router restart, an egress restart, the cause of a burst request with no answer in 90 s, the cause of an actor left in `ACTOR_STATE_RESUMING` after a database outage, a node that is alive and unreachable, a node that loses power or its network, a node loss on the microVM class or on agentgateway, a node that is full by CPU or by a count of actors, a second run of the Kubernetes API outage with resumes and free workers, a pool with spare workers on a third node, other node timers of Kubernetes |
| Agent Executor | a hosted or large model in a task, the example agent with a model that can do its work, a node loss under a task, a large or private clone, an MCP server that the image starts as a command, an MCP registry with listed servers, an MCP server outside the cluster, the release v0.3.1 on the Substrate commit that it names |
| Apple silicon | actors above 200 MiB, a resume from the object store |
| Preview | `ExternalVolumes` and `PerTemplateSnapshotLocation` on upstream Substrate, the flag on every component, and the behaviour of a golden egress policy |

Where a section states a fact from these areas, it comes from the code or the documentation at the tag, and the text says so.

```takeaways
- Build the suspend call into your harness first, because Substrate never suspends an idle actor.
- Scale a WorkerPool on free worker slots, never on CPU use.
- Run more than one router replica before you depend on the cluster, and test it.
- Watch for the `upstream connect error` 503 to find a dead process or a dead node.
- Plan for a stopped node as an outage, because no actor left a dead node by itself.
- Write your own node-loss runbook from section 8.2, and keep tags for the actors that must move.
- Leave preview features off unless you accept that this manual tested only how to turn one on.
- Suspend only idle actors, because a suspend cuts an open request.
- Read claims about GKE and cloud buckets as documentation, and our upgrades as two runs from a release candidate.
```

Sources: capture/lab/summary/upgrade-x86.json, capture/lab/summary/scale-x86.json, capture/lab/summary/bursts-one-node-x86.json, capture/lab/summary/restore-limit-x86.json, capture/lab/summary/object-store-x86.json, capture/lab/summary/node-drain-x86.json, api/ateapi/v1/ateapi.proto (Resources, RequestActorSuspend, AccessPolicy), internal/preview/preview.go, api/infra/k8s/ate/v1/workerpool_types.go (replicas and the scale subresource), manifests/ate-install/ate-api-server.yaml, ate-idp-server.yaml, atenet-router.yaml, atenet-egress.yaml, ate-controller.yaml, pod-certificate-controller.yaml and postgres/postgres.yaml (replica counts), cmd/kubectl-ate/internal/cmd/admin.go, cmd/ate-setup/commands.md (the ingress allowlist) at v1.0.0; docs/guides/actor-jwt-key-rotation.md, docs/dev/preview-gates.md, docs/reference/api-guide.md and docs/reference/sandbox-classes.md at v1.0.0; issues #3775 and #2972 (dead process detection), #3441 (overcommit), #3589 (ingress authorization), #3203 (storage plugins), #3602 (durable directory size), #3347 (name reuse), #3285 (open connections); capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/96-controller-events.log, capture/lab/L-gaps/multinode/85-node-return.tsv, capture/lab/summary/node-loss-x86.json, capture/lab/P-node-loss/10-a-quiet-revert.tsv, capture/lab/P-node-loss/80-tag-rescue.tsv, capture/lab/P-node-loss/96-golden-tag-deleted.txt, capture/lab/summary/rotation-x86.json, capture/lab/summary/network-x86.json, capture/lab/summary/cpu-limit-x86.json, capture/lab/summary/microvm-x86.json, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/J-container-death/10-trace.tsv, capture/lab/K-kagent/parallel/, capture/lab/K-kagent/logs/actor-state-changes.tsv, capture/lab/C-resume-vs-size/31-atelet-args-patched.txt, capture/lab/I-capacity/17-router-args.txt, capture/lab/summary/failures-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/V-validation/10-preview-feature/10-preview.tsv, capture/lab/V-validation/10-preview-feature/tmpl-gep.yaml, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/V-validation/11-process-exit-long-watch/11-workers-end.txt, capture/lab/V-validation/12-suspend-during-request/10-inflight.tsv, capture/lab/V-validation/09-actor-jwt/16-jwks-key-ids.json, capture/lab/V-validation/03-parallel-resume/24-summary.tsv., capture/lab/summary/remote-store-x86.json, capture/lab/summary/remote-postgres-x86.json
