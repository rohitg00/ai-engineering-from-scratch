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

So a pool of three workers can hold hundreds of sessions, as long as few of them run at one time. That is the whole offer. The cost is the time to resume, and [section 3.3](#s-suspendactor-and-resumeactor) measures it against the memory an actor holds.

## What Substrate standardizes

Substrate gives you five things with fixed names.

- **One API.** `ate-api-server` serves one gRPC service for atespaces, templates, actors, snapshots, workers, and policies. The `kubectl ate` plugin is its client {{code}}.
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

**We measured** that failure on the same guest, four times in one day. The request waited 5.06 s and then returned 503 with the text `no worker has room for the actor`. [Section 4.4](#s-request-parking) explains the wait, and [section 4.5](#s-sizing-a-pool) sizes a pool.

### GPU work

Substrate v1.0.0 does not give an actor a GPU. The API guide marks devices as not supported for now {{docs}}. We did not test GPUs. Keep model inference on a serving system, and let the actor call it through an egress policy.

### Recovery

Substrate marks an actor as crashed, and then it waits for you. A crashed actor returns 503 on every request until a caller sends `RevertActor`. In one case it is not marked at all: a process that exits leaves the actor in `ACTOR_STATE_RUNNING`. [Section 3.5](#s-crashed-and-revertactor) shows both cases.

Substrate also does not move an actor off a node that stops.

**We measured** this on a second x86 server guest (16 vCPU, 23 GB), on a cluster with two worker nodes, one run for each case. A suspended actor with its snapshot in the object store stayed in `ACTOR_STATE_RESUMING` on the stopped node for 5 min 33 s. Then it was crashed. A running actor read `ACTOR_STATE_RUNNING` for the 10 minutes of our probe. The other node had free workers the whole time. [Section 4.3](#s-placement) has the four cases.

Substrate also has no opinion about the agent. It does not choose a model, run a tool, or keep a conversation. Those belong to the harness.

## Our eight positions

Each position comes from a run on our own clusters. The table is the map of this manual.

**We measured** every number in this table on x86 server guests, one run each unless the section says more. The section in the last column names the machine and the count.

| Position | The number behind it | Section |
|---|---|---|
| Substrate does not suspend an idle actor | 60 of 60 samples `RUNNING` in 900 s | [3.3](#s-suspendactor-and-resumeactor), [7.1](#s-kagent-on-substrate) |
| A suspend is asynchronous, and its snapshot is not durable at once | `PENDING` on one node for 5 minutes | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives), [3.5](#s-crashed-and-revertactor) |
| Postgres and `ate-api-server` are on every request path, and the Kubernetes API server is on none | 223 of 223 requests served with kube-apiserver down for 86 s | [1.2](#s-one-request-from-client-to-actor), [8.2](#s-when-a-dependency-is-down) |
| Resume time grows with the memory an actor holds | 0.22 s at 0 MiB, 2.16 s at 1000 MiB | [3.3](#s-suspendactor-and-resumeactor) |
| agentgateway is a dataplane option of Substrate, and it does authenticate ingress clients | 38 MB against 91 MB at idle | [6.6](#s-the-dataplane-choice), [7.2](#s-agentgateway) |
| An egress policy allows hosts and ports, and a removed rule does not close an open connection | a second request passed 20 s after the rule was removed | [6.2](#s-egresspolicy-and-default-deny) |
| A crashed actor is not always marked crashed | 6 of 6 samples `RUNNING` after the process exited | [3.5](#s-crashed-and-revertactor) |
| Install from the release images | 162 s against 266 s | [2.1](#s-install-with-ate-setup) |

Read the positions as a list of things to check on your own cluster. Your seconds will differ. The states, the error texts, and the order of events must not.

## When this is the wrong tool

Substrate fits sessions that keep state and are idle most of the time. It does not fit an agent that runs all day, because that actor never frees its worker. It does not fit a workload that needs a GPU in the sandbox. [Section 7.4](#s-when-to-choose-substrate) compares the choices, and [section 8.5](#s-limits-at-v1-0-0) lists the limits at v1.0.0.

```takeaways
- Count how many of your sessions run at one time before you size anything.
- Put the SuspendActor call in your harness, or use a harness that sends it.
- Plan the WorkerPool size yourself, because Substrate does not change it.
- Keep GPU inference outside the actor at v1.0.0.
- Check each of the eight positions on your own cluster before you depend on it.
```

Sources: capture/lab/summary/failures-x86.json, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/13-workers.txt, capture/lab/A-quickstart/60-state.log, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/summary/parking-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/summary/resume-x86.json, capture/lab/summary/install-steps.json, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/J-container-death/10-trace.tsv, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/summary/microvm-x86.json; api/ateapi/v1/ateapi.proto, docs/reference/api-guide.md, docs/get-started/quickstart.md, docs/reference/sandbox-classes.md, and README.md at v1.0.0.
