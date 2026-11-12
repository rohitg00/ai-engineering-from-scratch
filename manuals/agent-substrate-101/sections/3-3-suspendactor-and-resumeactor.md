# SuspendActor and ResumeActor

> Substrate suspends an actor only when a caller asks, and on our test server a resume cost about 2 ms for each MiB held.

You created an actor in the afternoon, sent it five requests, and went home. The quickstart told you that Substrate checkpoints an idle actor. The next morning the actor is still `ACTOR_STATE_RUNNING`, and it still holds a full CPU of its worker. Nothing is broken. Substrate v1.0.0 has no idle timer.

When you finish this section, you can decide who calls `SuspendActor` in your system and choose between its two modes. You can also predict the resume time of an actor from the memory that it holds.

## Substrate does not suspend an idle actor

We sent five requests to `my-counter-1` and then sent nothing for 900 seconds. A script read the state every 15 seconds.

```listing
title: 900 seconds with no request
source: capture/lab/B-lifecycle/10-trace.tsv
lang: text
note: The start and the end of the watch. The 58 state lines between them are cut, and all of them say ACTOR_STATE_RUNNING.
---
2026-11-12T10:14:22.822Z	idle-watch-start	no requests for 900 s
2026-11-12T10:14:37.832Z	state	ACTOR_STATE_RUNNING	-
…
2026-11-12T10:29:35.957Z	state	ACTOR_STATE_RUNNING	-
2026-11-12T10:29:36.168Z	idle-watch-end
2026-11-12T10:29:36.265Z	call-after-idle	200	0.080377	preserved memory count: 6 | preserved file counter: 6 | preserved rootfs counter: 6
```

All 60 samples were `ACTOR_STATE_RUNNING`, and the sixth call continued the count in 0.08 seconds. The code agrees: no component of v1.0.0 suspends an actor because it is idle {{code}}. The API reference says the same, and the quickstart page does not {{docs}}.

An idle running actor is not free. It keeps the CPU and the memory that its template booked on the worker. While `my-counter-1` ran, its worker showed 1,000 of 1,000 millicores in use. [Section 4.5](#s-sizing-a-pool) turns that into a pool size.

So the job belongs to the caller, and in practice to the agent harness. In our run, kagent suspended the actor after 98 of 98 turns. [Section 7.1](#s-kagent-on-substrate) shows that pattern and its cost.

## SuspendActor: asynchronous or synchronous

**SuspendActor:** the call that checkpoints a running actor, stops its sandbox, and frees its place on the worker. It has two durability modes.

- The asynchronous mode is the default. The call returns when the snapshot is on the disk of the node. atelet uploads it to the object store later.
- The synchronous mode returns only when the snapshot is in the object store. Use `kubectl ate suspend actor --mode sync`.

The actor object shows the difference.

```listing
title: the snapshots of one actor after each kind of suspend
source: capture/lab/B-lifecycle/20-trace-ops.tsv
lang: text
note: Two lines of the trace. The first follows an asynchronous suspend, and the second follows a suspend with --mode sync.
---
2026-11-12T10:30:08.028Z	state	ACTOR_STATE_SUSPENDED	kind-control-plane	5	SNAPSHOT_OWNER_TAG:SNAPSHOT_STORAGE_STATE_COMPLETED:gen1,SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_PENDING:gen2
…
2026-11-12T10:30:09.378Z	state	ACTOR_STATE_SUSPENDED	kind-control-plane	9	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen3
```

After the asynchronous suspend, generation 2 is `SNAPSHOT_STORAGE_STATE_PENDING`. The object store does not have it yet, so the older generation stays as the durable copy. After the synchronous suspend, generation 3 is `SNAPSHOT_STORAGE_STATE_COMPLETED`, and Substrate has released the older ones. [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) follows such a snapshot for 42 minutes.

| Memory held | Asynchronous suspend, median | Synchronous suspend, median |
|---|---|---|
| 0 MiB | 0.34 s | 0.40 s |
| 50 MiB | 0.50 s | 1.03 s |
| 200 MiB | 0.79 s | 2.02 s |
| 500 MiB | 1.17 s | 3.59 s |
| 1,000 MiB | 1.95 s | 6.41 s |

**We measured** the time until `kubectl ate suspend actor` returned, on the x86 server guest (24 vCPU, 47 GB, nested KVM) with gVisor. The asynchronous column has 10 suspends for each size, and the synchronous column has 5. The actor held random bytes, which do not compress. The extra time is close to the upload itself. In a separate run, atelet logged 2.0 to 2.1 seconds for each of four uploads of a 500 MiB snapshot.

```figure
id: fig-3-3b
kind: chart
title: asynchronous against synchronous suspend
claim: At 1,000 MiB a synchronous suspend took 6.4 seconds, and the default asynchronous suspend took 2.0 seconds.
caption: Each dot is one suspend, and each line joins the medians of one mode. Violet returns with the snapshot on the node, and teal returns after the upload. Measured on the x86 server guest. From capture/lab/summary/suspend-x86.json.
```

## ResumeActor: who calls it and where it runs

**ResumeActor:** the call that places a suspended actor on a worker and restores its newest snapshot. The router makes this call for every request, so a plain request is enough to start an actor. `kubectl ate resume actor` makes the same call with no request.

A resume looks at the node first. After a suspend, the actor stays assigned to its node for as long as that node holds the snapshot. `ResumeActor` then tries the workers on that node {{docs}}. If the snapshot is only in the object store, atelet downloads it first, on the node of the worker that the scheduler chose.

## Resume time against the memory held

We built an actor that holds a fixed amount of random memory and reads one byte in each MiB on every request. We suspended it, waited, and timed the next request.

```figure
id: fig-3-3
kind: chart
title: resume time against memory held, from the node and from the object store
claim: A resume from the node took 2.2 seconds at 1,000 MiB, and a resume from the object store took 4.7 seconds.
caption: Each dot is one resume, and each line joins the medians of one path. Violet restores the snapshot on the node, and teal downloads it from the object store first. The dashed line marks 0.5 seconds. The first resume from the node at 1,000 MiB took 5.09 seconds, and the other nine took at most 2.45 seconds. Measured on the x86 server guest. From capture/lab/summary/resume-x86.json.
```

| Memory held | From the node, median | Range of 10 | From the object store, median | Range of 5 |
|---|---|---|---|---|
| 0 MiB | 0.22 s | 0.22 to 0.23 s | 0.24 s | 0.24 to 0.25 s |
| 50 MiB | 0.24 s | 0.23 to 0.26 s | 0.41 s | 0.37 to 0.47 s |
| 200 MiB | 0.47 s | 0.35 to 0.54 s | 0.96 s | 0.90 to 1.01 s |
| 500 MiB | 1.07 s | 1.00 to 1.34 s | 2.26 s | 1.93 to 2.41 s |
| 1,000 MiB | 2.16 s | 1.94 to 5.09 s | 4.68 s | 4.23 to 4.97 s |

**We measured** one request to a suspended actor on the x86 server guest (24 vCPU, 47 GB, nested KVM), with gVisor and one kind node. The time is at the client, through `kubectl ate proxy`. A request to a running actor took 0.06 seconds on that path. For the object store column, atelet ran with an upload delay of 3 seconds and a detach delay of 10 seconds. All 40 requests of that run returned 200.

The atelet log says where the second column loses its time.

```listing
title: one resume of a 500 MiB actor from the object store, as atelet timed it
source: capture/lab/C-resume-vs-size/33-atelet-upload-detach.log
lang: text
note: One log line. Eight fields are kept and the others are cut.
---
{"time":"2026-11-12T11:37:01.905071369Z","level":"INFO","msg":"Restore timing breakdown",…"ate.actor.name":"o500",…"ate.snapshot.fidelity":"memory",…"ate.actor.restore.duration.download":1.171619862,…"ate.actor.restore.duration.worker_restore":0.326837467,"ate.actor.restore.duration.total":1.5049079490000001,…
```

The download took 1.17 seconds of the 1.50 seconds that atelet counted. The worker needed 0.33 seconds for the restore itself.

Our rule of thumb for this machine has two numbers. A resume costs a fixed 0.2 seconds, plus about 2 ms for each MiB from the node. From the object store, it costs about twice as much for each MiB. The rule has four conditions, and you must check each one against your case.

- The memory was random, so no layer could compress it. Real heaps compress, and we did not measure how much that helps.
- The object store ran in the same cluster and on the same disk. We did not test a remote bucket, which adds its own transfer time.
- The sandbox was gVisor. On the microVM class the same test cost a fixed 0.3 seconds plus about 1 ms for each MiB, up to 500 MiB. [Section 4.2](#s-sandbox-classes) has the comparison.
- The machine was a nested guest on a server CPU from 2019.

The project states that a resume takes less than 500 ms, and it gives no actor size and no machine. On our guest, that holds up to about 200 MiB from the node and up to about 50 MiB from the object store.

## The same test on Apple silicon

**We measured** the node path on an Apple silicon laptop under Docker Desktop, with 10 CPU and 8 GB for Docker. Each size had 10 resumes. The median resume was 0.09 seconds at 0 MiB, 0.09 seconds at 50 MiB, and 0.16 seconds at 200 MiB. The median asynchronous suspend was 0.10, 0.15, and 0.24 seconds. All 66 requests returned 200, and every count continued. We did not test more than 200 MiB or the object store path on the laptop.

The laptop and the server guest are different machines. Read each table by itself, and do not take a ratio across them.

## Our position

Call `SuspendActor` yourself, from the component that knows when a turn ends. Use the asynchronous mode for the normal case, because the caller waits a third as long at 1,000 MiB. Use the synchronous mode before you drain a node, and for any state that you cannot lose. Budget the resume from the memory that your actor holds, not from a headline number.

```takeaways
- Call SuspendActor from your harness, because Substrate does not suspend an idle actor.
- Use the default asynchronous mode when the caller must not wait for an upload.
- Use --mode sync before node maintenance and for state that you cannot lose.
- Budget 0.2 s plus 2 ms for each MiB for a resume from the node.
- Double the cost for each MiB when the snapshot comes from the object store.
- Measure your own actor, because real memory compresses and ours did not.
```

Sources: capture/lab/summary/resume-x86.json, capture/lab/summary/suspend-x86.json, capture/lab/summary/resume-mac.json, capture/lab/summary/failures-x86.json, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/13-workers.txt, capture/lab/C-resume-vs-size/10-local.tsv, capture/lab/C-resume-vs-size/32-object-store.tsv, capture/lab/C-resume-vs-size/31-atelet-args-patched.txt, capture/lab/C-resume-vs-size/33-atelet-upload-detach.log, capture/lab/C-resume-vs-size/main.go, capture/lab/M-mac-arm64/80-local.tsv, capture/lab/summary/kagent-turns-x86.json. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (SuspendActorRequest, DurabilityMode, ResumeActorRequest), cmd/ateapi/internal/controlapi/workflow_suspend.go, workflow_resume.go, internal/ateworker/suspend (not imported by any binary), docs/reference/api-guide.md (Eviction, ResumeActor, SuspendActor), docs/get-started/quickstart.md, README.md (the resume claim).
