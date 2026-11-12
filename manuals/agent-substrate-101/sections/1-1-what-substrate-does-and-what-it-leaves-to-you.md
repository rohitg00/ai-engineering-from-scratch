# What Substrate does, and what it leaves to you

> Substrate runs many stateful actors on few worker pods and resumes one when a request arrives, and it leaves the suspend call, the pool size, and GPU work to you.

You run one pod for each agent session. Most sessions wait for a person or for a model, and each waiting pod still holds its CPU and its memory. If you delete the pod, the session loses its memory. If you keep the pod, you pay for a process that does nothing.

When you finish this section, you can say what Agent Substrate does about that problem and name the jobs it leaves to you. You can also find the section that proves each of our eight positions.

## The mechanism: actors, workers, and snapshots

Substrate separates the session from the pod that runs it.

**Actor:** one stateful workload with a name, such as `my-counter-1`. An actor has memory, files, and a root filesystem. It is a row in Postgres, and it is not a Kubernetes object.

**Worker:** one pod that can run actors inside a sandbox. A WorkerPool is the Kubernetes object that creates worker pods, and the pool has a fixed number of them.

**Snapshot:** the saved state of one actor. Substrate writes it when the actor is suspended and reads it when the actor is resumed.

**Atespace:** the named group that an actor, its template, and its policies belong to. An actor is always addressed by its atespace and its name.

A suspended actor uses no worker. It is a snapshot and a row. When a request arrives for it, Substrate chooses a worker with room, restores the snapshot there, and sends the request on. When something suspends the actor again, Substrate writes a new snapshot and frees the worker. [Figure 1.1](#fig-1-1) shows the three worker pods of our demo pool with one actor that runs.

```figure
id: fig-1-1
kind: flow
title: what Substrate does and what it leaves to you
claim: Substrate resumes an actor onto a worker when a request arrives, and the call that suspends it again must come from you.
caption: The top row is the WorkerPool of the counter demo, and the dashed pods run no actor. The amber arrow is the resume, which Substrate does. The thick teal arrow is the suspend, which you call. The two lists at the bottom divide the work, with the seconds from our run. From capture/lab/A-quickstart/60-state.log, capture/lab/B-lifecycle/13-workers.txt, capture/lab/B-lifecycle/10-trace.tsv, and capture/lab/B-lifecycle/20-trace-ops.tsv.
```

So a pool of three workers can hold hundreds of sessions, as long as few of them run at one time. That is the whole offer. The cost is the time to resume, and [section 3.3](#s-suspendactor-and-resumeactor) measures it against the memory that holds data in an actor.

## What Substrate standardizes

Substrate gives you five things with fixed names.

- **One API.** `ate-api-server` serves the `Control` gRPC service for atespaces, templates, actors, snapshots, workers, and policies. The `kubectl ate` plugin is its client {{code}}. A second service, `WorkerService`, is for `atelet` only.
- **One lifecycle.** An actor has seven states, and five operations move it between them: create, resume, suspend, revert, and delete. [Section 3.2](#s-actor-states) draws them.
- **One way to reach an actor.** A client sends a request to `atenet-router` with the header `ate-target-actor` and a client certificate. The router finds the worker {{docs}}.
- **Two sandbox classes.** An actor runs under gVisor or in a microVM, and the WorkerPool decides which one {{docs}}. We ran both on one machine, and [section 4.2](#s-sandbox-classes) compares them.
- **One egress rule.** An actor reaches no host until an egress policy names that host. [Section 6.2](#s-egresspolicy-and-default-deny) shows the denial.

The project states that it keeps this API compatible from v1.0.0 {{docs}}. That promise covers the API. It does not cover the jobs below.

## What it leaves to you

### The suspend call

Substrate does not suspend an idle actor. It has no idle timer. An actor that got one request stays in `ACTOR_STATE_RUNNING` and holds its worker until a caller sends `SuspendActor`.

**We measured** this on an x86 server guest with 24 vCPU and 47 GB, in one run. We sent five requests to `my-counter-1` and then sent nothing for 900 s. We read the state every 15 s, and all 60 samples were `ACTOR_STATE_RUNNING`.

The quickstart page of the project says that an idle actor is suspended for you. The API guide of the same project says that it is not {{docs}}. Our run agrees with the API guide. If you plan capacity from the quickstart sentence, your pool fills with idle actors.

The program that drives the actor has this job. kagent takes it: in our kagent run, 98 of 98 turns ended with a suspend. [Section 7.1](#s-kagent-on-substrate) shows that run. If you write your own harness, the suspend call is part of your harness.

### The pool size

Substrate has no autoscaler {{code}}. A WorkerPool has a `spec.replicas` field and a scale subresource, so a Kubernetes autoscaler can change it. Nothing in Substrate does. When every worker is full, a request for one more actor waits and then fails.

**We measured** that failure on the same guest, in eight requests to four actors of one run. Each request waited 5.06 s at the median (n=8) and then returned 503 with the text `no worker has room for the actor`. [Section 4.4](#s-request-parking) explains the wait, and [section 4.5](#s-sizing-a-pool) sizes a pool.

### GPU work

Substrate v1.0.0 does not give an actor a GPU. The API guide marks devices as not supported for now {{docs}}. We did not test GPUs. Keep model inference on a serving system, and let the actor call it through an egress policy.

### Recovery

Substrate marks an actor as crashed, and then it waits for you. A crashed actor returns 503 on every request until a caller sends `RevertActor`. In one case it is not marked at all: a process that exits leaves the actor in `ACTOR_STATE_RUNNING`. [Section 3.5](#s-crashed-and-revertactor) shows both cases.

**We measured** the exit case on the x86 server guest (24 vCPU, 47 GB, nested KVM), with two actors. Both read `ACTOR_STATE_RUNNING` for 20 minutes after the exit, until we called a suspend. One of them got 20 requests in that time, and all 20 returned 503. Each dead actor kept its CPU on the worker for all that time.

Substrate also does not move an actor off a node that stops.

**We measured** this on a second x86 server guest (16 vCPU, 23 GB), on a cluster with two worker nodes, one run for each case. A suspended actor had its snapshot in the object store. It stayed in `ACTOR_STATE_RESUMING` on the stopped node for 5 min 33 s from its first request. It was crashed 5 min 44 s after the stop command. A running actor read `ACTOR_STATE_RUNNING` for the 10 minutes of our probe. The other node had free workers the whole time, and [section 4.3](#s-placement) has the four cases.

**We measured** 13 more cases on the same guest (16 vCPU, 23 GB), once each, to find what an operator can do. No actor left the stopped node by itself. One `revert` freed an actor in 7.1 s, and only for an actor that was suspended with `--mode sync` and had got no request. In the other cases a `revert` during the outage left the actor in `ACTOR_STATE_REVERTING` until the node was back. A new actor from a tag that we had made before the stop served a request 1.2 s after the create command. So you own the recovery from a node loss, and [section 8.2](#s-when-a-dependency-is-down) has the runbook.

Substrate also has no opinion about the agent. It does not choose a model, run a tool, or keep a conversation. Those belong to the harness.

## Our eight positions

Each position comes from a run on our own clusters. The table is the map of this manual.

**We measured** every number in this table on two x86 server guests, one run each unless the section says more. The section in the last column names the machine and the count. The guests are different machines, so do not set a number from one row against a number from another row.

| Position | The number behind it | Section |
|---|---|---|
| Substrate does not suspend an idle actor | 60 of 60 samples `RUNNING` in 900 s | [3.3](#s-suspendactor-and-resumeactor), [7.1](#s-kagent-on-substrate) |
| A suspend is asynchronous, and its snapshot is not durable at once | `PENDING` on one node for 5 minutes | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives), [3.5](#s-crashed-and-revertactor) |
| Postgres and `ate-api-server` are on every request path, and the Kubernetes API server is on none | 103 of 103 requests from a pod served while kube-apiserver was down for 86 s on Envoy, and 106 of 106 in 87 s on agentgateway | [1.2](#s-one-request-from-client-to-actor), [8.2](#s-when-a-dependency-is-down) |
| Resume time grows with the memory that holds data in an actor | 0.22 s at 0 MiB, 2.16 s at 1000 MiB of random bytes, 0.23 s at 500 MiB of zero bytes | [3.3](#s-suspendactor-and-resumeactor) |
| agentgateway is a dataplane option of Substrate, and it does authenticate ingress clients | 38 MB against 91 MB at idle | [6.6](#s-the-dataplane-choice), [7.2](#s-agentgateway) |
| An egress policy allows hosts and ports, and a removed rule does not close an open connection | a second request passed on an open pass-through connection, 20 s after the rule was removed. A suspend closed an open connection in 1.3 to 2.2 s | [6.2](#s-egresspolicy-and-default-deny) for the policy, [6.6](#s-the-dataplane-choice) for the open connection |
| A crashed actor is not always marked crashed | `RUNNING` for 20 minutes after the process exited, in 81 of 81 samples | [3.5](#s-crashed-and-revertactor) |
| Install from the release images | 162 s on the second guest (16 vCPU, 23 GB). The source build took 266 s on the first guest (24 vCPU, 47 GB), after a failed step. Two machines, so the seconds are indicative only. | [2.1](#s-install-with-ate-setup) |

Read the positions as a list of things to check on your own cluster. Your seconds will differ. The states, the error texts, and the order of events must not.

## What the project site says, and what we measured

The project site, ate.dev, reached version 1.0 with the release. We read it on 2026-11-12. Its documentation pages are built from the same files as the release tag, and we found no difference in content {{docs}}. Its first page makes short statements, some with numbers and none with conditions. The table sets each statement beside our result.

**We measured** every result in this table on x86 server guests, one run each unless the section says more. The section in the last column names the machine and the count.

| The site says | Our result | Section |
|---|---|---|
| Idle agents suspend | Not seen. An idle actor stayed `RUNNING` for 900 s. The architecture page says that the caller requests the suspend. | [3.3](#s-suspendactor-and-resumeactor), [9.1](#s-an-idle-suspender) |
| An actor resumes in under `500ms` | True up to about 200 MiB of data, on gVisor, from the node. 2.16 s at 1,000 MiB. 0.96 s at 200 MiB from the object store. | [3.3](#s-suspendactor-and-resumeactor), [4.2](#s-sandbox-classes) |
| An actor resumes on any ready worker | Not seen. 5 of 5 resumes stayed on the node that held the snapshot. No actor left a stopped node by itself, in 17 cases. One `revert` at the right moment freed a quiet actor in 7.1 s. | [4.3](#s-placement), [8.2](#s-when-a-dependency-is-down) |
| The Kubernetes API is off the request path | Confirmed on both dataplanes. 103 of 103 requests from a pod were served while kube-apiserver was down for 86 s on Envoy, and 106 of 106 in 87 s on agentgateway. | [8.2](#s-when-a-dependency-is-down) |
| Kubernetes handles recovery | True for nodes and pods. An actor on a stopped node needed an operator: a tag, a revert at the right moment, or the node back. After an eviction, the returned node stayed empty until we moved pods by hand. | [8.2](#s-when-a-dependency-is-down), [3.5](#s-crashed-and-revertactor) |
| Memory and files survive a suspend | Confirmed with the memory fidelity. With the other two fidelities, the process starts again. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| No inbound access without authentication | Confirmed for the two actor ports on both dataplanes. The stats port of the agentgateway router answered `/metrics` with no credentials. | [6.1](#s-the-router-and-ingress) |
| No outbound access without a policy | Confirmed. A name gets `NXDOMAIN`, and an IP gets a reset or a 403. | [6.2](#s-egresspolicy-and-default-deny) |
| The actor does not hold the secret | Confirmed for the placeholder swap. An upstream that returns its request headers gives the secret to the actor. | [6.5](#s-credential-injection) |
| `500+/s` suspend and resume activations | Not tested at that rate. With 16 resumes at one time, 80 of 80 were served. | [4.4](#s-request-parking) |
| `10×` the density of container runtimes | Not tested. The documentation gives a benchmark method and no result. | [4.5](#s-sizing-a-pool) |
| Worker state is scrubbed between runs | Not tested. The security page lists this guarantee as in progress. | no section |
| JWTs federate with every cloud provider | We decoded one token. We did not test federation. | [5.3](#s-actor-jwts) |

Three statements match our runs as written. Four hold under a condition that the site does not state. Two did not match what we saw, and four we did not test. The two that did not match are the ones to plan for. You must send the suspend, and you must act when a node stops.

## When this is the wrong tool

Substrate fits sessions that keep state and are idle most of the time. It does not fit an agent that runs all day, because that actor never frees its worker. It does not fit a workload that needs a GPU in the sandbox. [Section 7.4](#s-when-to-choose-substrate) compares the choices, and [section 8.5](#s-limits-at-v1-0-0) lists the limits at v1.0.0.

```takeaways
- Count how many of your sessions run at one time before you size anything.
- Put the SuspendActor call in your harness, or use a harness that sends it.
- Plan the WorkerPool size yourself, because Substrate does not change it.
- Keep GPU inference outside the actor at v1.0.0.
- Check each of the eight positions on your own cluster before you depend on it.
```

Sources: capture/lab/summary/node-loss-x86.json, capture/lab/summary/dependency-loss-agw-x86.json, capture/lab/summary/network-x86.json, capture/lab/P-node-loss/10-a-quiet-revert.tsv, capture/lab/P-node-loss/80-tag-rescue.tsv, capture/lab/Q-network/m-router-ports/agentgateway/11-port-probes-supplement.txt, capture/lab/summary/failures-x86.json, capture/lab/summary/validation-memory-x86.json, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/13-workers.txt, capture/lab/A-quickstart/60-state.log, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/summary/parking-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/summary/resume-x86.json, capture/lab/summary/install-steps.json, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/J-container-death/10-trace.tsv, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/summary/microvm-x86.json; api/ateapi/v1/ateapi.proto, docs/reference/api-guide.md, docs/get-started/quickstart.md, docs/reference/sandbox-classes.md, docs/concepts/architecture.md, docs/get-started/overview.md, docs/security/security.md, docs/guides/benchmarking.md, site/layouts/_shortcodes/home.html, and README.md at v1.0.0; the project site ate.dev, read 2026-11-12.
