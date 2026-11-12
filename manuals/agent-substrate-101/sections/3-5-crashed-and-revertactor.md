# CRASHED and RevertActor

> A crashed actor stays crashed until you call RevertActor, which returns it to its last completed snapshot and drops every call after it.

A node of your cluster restarts in the night. In the morning, some sessions answer 503 with a text about `AssignWorker`. One answers 503 with a text about an upstream connection. `kubectl get pods` shows every pod as Running. Substrate will not repair any of these sessions by itself, and a new request will not either.

When you finish this section, you can tell from an error text which state an actor is in. You can also bring the actor back with `RevertActor` and say which calls it lost.

## Every way we reached CRASHED

**ACTOR_STATE_CRASHED:** the state of an actor whose sandbox, worker, or restore was lost. The actor has no worker. Its `status.crash` field holds a time and a message.

| What we did | First response to the caller | `status.crash.message` |
|---|---|---|
| Deleted the worker pod of a running actor | 503, `AssignWorker prerequisite not met` | `worker pod went away while hosting the actor` |
| Removed the snapshot on the node before the upload, then sent a request | 500, `error resuming actor lab-c/x1` | `resume failed: atelet Restore: snapshot` … `has no usable local copy and no uploaded copy` |
| Restarted the node before the upload, then sent a request | 500, `error resuming actor lab-c/r1` | `resume failed: atelet Restore: worker restore failed with a retryable error 3 times in a row, giving up` |
| Let the actor allocate memory past its limit | 503, `upstream connect error`, then 503, `AssignWorker prerequisite not met` | `killed for exceeding its memory limit` |
| Restarted the node under a running actor | 503, `AssignWorker prerequisite not met` | not recorded by us |

The first row is the plain case. The actor object says what happened.

```listing
title: the status of my-counter-1 after we deleted its worker pod
source: capture/lab/B-lifecycle/25-actor-crashed.yaml
lang: yaml
note: The snapshot list between the two parts is cut.
---
status:
  assignedNode: kind-control-plane
  crash:
    crashTime: "2026-11-12T10:30:11.170436971Z"
    message: worker pod went away while hosting the actor
  lastAssignedGeneration: 3
  …
  state: ACTOR_STATE_CRASHED
```

The second and third rows are the cost of an asynchronous suspend. In both, the newest snapshot was `SNAPSHOT_STORAGE_STATE_PENDING`, so one node held the only copy. In both, the actor still looked healthy: its state was `ACTOR_STATE_SUSPENDED`. The request that tried to resume it found the loss and crashed it.

```listing
title: a pending snapshot is lost, and the next request crashes the actor
source: capture/lab/D-durability/30-local-loss.tsv
lang: text
note: Six lines for the actor x1. The snapshot column is cut from the two state lines.
---
2026-11-12T11:30:18.606Z	x1	removed-node-local-snapshot	uid 085b45fb-edb9-4523-ad30-3da55b3f34f0
2026-11-12T11:30:18.708Z	x1	call-after-loss	500	0.082402	error resuming actor lab-c/x1
2026-11-12T11:30:18.911Z	x1	state	ACTOR_STATE_CRASHED	kind-control-plane	…
2026-11-12T11:30:23.997Z	x1	call-again	503	0.063957	actor lab-c/x1 unavailable: AssignWorker prerequisite not met for Actor: lab-c/x1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)
…
2026-11-12T11:30:25.241Z	x1	call-after-revert	200	0.416152	count=4 mb=50 fill=random sum=6296 process_age_s=0.8
2026-11-12T11:30:25.434Z	x1	state	ACTOR_STATE_RUNNING	kind-control-plane	…
```

Substrate did not use the older, completed snapshot by itself. The actor had one in the object store, and the request still failed.

The node restart has a detail that the table hides.

**We measured** one node restart on the x86 server guest. The Kubernetes API answered after 8 seconds, and all pods ran after 147 seconds. We sent the request less than two seconds later. The crash message does not name a lost snapshot. It says that the restore failed three times because the worker had not registered yet. So a request that arrives too early after a node restart can crash a suspended actor, and we did not test a later request.

One event did not crash anything. We deleted the atelet pod while a snapshot was pending, and the next request returned 200 with the count intact. The snapshot is on the disk of the node, not in atelet.

## What the caller sees

Two texts tell you that an actor is crashed.

- `error resuming actor <atespace>/<name>`, with status 500. Only the request that finds the loss gets this text.
- `actor <atespace>/<name> unavailable: AssignWorker prerequisite not met for Actor: <atespace>/<name> (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)`, with status 503. Every later request gets this text, and it arrives at once.

`kubectl ate resume actor` is refused with the same text and the gRPC code `FailedPrecondition`.

```listing
title: resume is refused for a crashed actor
source: capture/lab/B-lifecycle/20-trace-ops.tsv
lang: text
note: One line. Our trace kept the first 200 characters of the output, so the end of the state name is missing.
---
2026-11-12T10:30:17.301Z	resume-while-crashed	0.207s	Error: failed to resume actor: rpc error: code = FailedPrecondition desc = AssignWorker prerequisite not met for Actor: ate-demo-counter/my-counter-1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPEN
```

No retry helps. Do not put this 503 in the same retry loop as a 503 from a full pool.

## Running in the state, dead in the sandbox

One failure does not reach `ACTOR_STATE_CRASHED` at all. We told an actor to call `os.Exit(3)`.

```listing
title: the process exits and the actor stays RUNNING
source: capture/lab/J-container-death/10-trace.tsv
lang: text
note: Five lines for the actor j1. Five more pairs of the second and third line follow in the file. The snapshot column and the end of the error are cut.
---
2026-11-12T11:30:45.229Z	j1	exit-request	200	0.065314	exiting with code 3
2026-11-12T11:30:47.441Z	j1	state	ACTOR_STATE_RUNNING	kind-control-plane	…
2026-11-12T11:30:47.518Z	j1	call	503	0.058459	upstream connect error or disconnect/reset before headers. reset reason: connection termination
…
2026-11-12T11:31:00.122Z	j1	suspend-attempt	Error: failed to suspend actor: rpc error: code = Internal desc = internal server error: workflow failed at step CallAteletSuspend: actor lab-c/j1 crashed…
2026-11-12T11:31:00.333Z	j1	state	ACTOR_STATE_CRASHED	kind-control-plane	…
```

**We measured** one actor for each kind of death on the x86 server guest. After the exit, the state was `ACTOR_STATE_RUNNING` in 6 of 6 samples over 14 seconds, and all 6 requests got the 503 from Envoy. We stopped the watch there, so we do not know if Substrate ever finds this case. A memory kill is different: Substrate recorded the crash 2.3 seconds after the request that started the allocation. One request in that gap got the Envoy text.

Our `suspend actor --mode sync` found the exit. The checkpoint failed, and the failed suspend marked the actor crashed.

Your harness must cover the exit case. If requests return `upstream connect error` and the state is `ACTOR_STATE_RUNNING`, call `SuspendActor` and expect it to fail. A harness that suspends after every turn does this without extra code.

## RevertActor

**RevertActor:** the call that discards the current execution of an actor and returns it to `ACTOR_STATE_SUSPENDED` at its last completed durable snapshot. It accepts a crashed actor, a running actor, and a suspended actor whose newest snapshot is on a node {{docs}}.

A revert stops any sandbox, removes the snapshot files on the node, and deletes an upload that was not complete {{docs}}. The actor comes back with no assigned node, and the next request resumes it from the object store.

| Run | Last completed snapshot | Calls made after it | First reply after the revert |
|---|---|---|---|
| Worker pod deleted | count 8 | 9, 10, 11 | count 9 |
| Snapshot on the node removed | count 3 | 4, 5 | count 4 |
| Node restarted | count 3 | 4, 5 | count 4 |

The calls in the third column are gone. The actor answers as if they never happened.

**We measured** one revert of the counter actor on the x86 server guest: `kubectl ate revert actor` returned in 0.22 seconds. The first request after a revert took 0.38 to 0.42 seconds in three runs. After the node restart, that first request waited 5 seconds and got `no worker has room for the actor`, although all pods ran. A request 78 seconds later returned 200. We did not find the cause.

A revert rewinds the actor only. A tool call that the actor made after the snapshot stays made, and an external volume keeps its contents {{docs}}. We did not test external volumes.

```figure
id: fig-3-5
kind: decision
title: my actor returns 503 or 500
claim: The text of the error tells you the state of the actor, and the state tells you the one call that helps.
caption: Read each row left to right. Rose boxes are failures of the actor, and the grey row is a full pool with a healthy actor. Seconds are from our runs on the x86 server guest. From capture/lab/D-durability/30-local-loss.tsv, capture/lab/J-container-death/10-trace.tsv, and capture/lab/D-durability/10-watch-part1.tsv.
```

Our position: decide in your harness what a crash means, because Substrate will not. After our node restart, `my-counter-1` stayed crashed until we reverted it by hand. A revert is safe to automate for an actor whose last calls can be sent again. For any other actor, suspend with `--mode sync` at each point that you cannot lose.

```takeaways
- Read the error text first: AssignWorker means crashed, and upstream connect error means a dead process.
- Call kubectl ate revert actor for a crashed actor, because resume is refused.
- Call SuspendActor on a running actor that returns 503, so that Substrate marks it crashed.
- Count the calls since the last COMPLETED snapshot as lost after a revert.
- Wait until workers are registered before you send requests after a node restart.
- Keep the crashed 503 out of the retry loop that you use for a full pool.
```

Sources: capture/lab/summary/failures-x86.json, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/25-actor-crashed.yaml, capture/lab/B-lifecycle/26-actor-after-revert.yaml, capture/lab/D-durability/30-local-loss.tsv, capture/lab/D-durability/32-x1-after-loss.yaml, capture/lab/D-durability/34-x2-atelet-restart.log, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/J-container-death/10-trace.tsv, capture/lab/J-container-death/14-j2-after-oom.yaml. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (ActorStatus.crash, RevertActorRequest, ReportActorCrashed), cmd/ateapi/internal/controlapi/workflow_revert.go, docs/reference/api-guide.md (ResumeActor, RevertActor, Eviction).
