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

**We measured** one actor for each kind of death on the x86 server guest. After the exit, the state was `ACTOR_STATE_RUNNING` in 6 of 6 samples over 14 seconds, and all 6 requests got the 503 from Envoy. A memory kill is different: Substrate recorded the crash 2.3 seconds after the request that started the allocation. One request in that gap got the Envoy text.

Fourteen seconds do not prove much, so we repeated the exit and watched for 20 minutes. One actor got no request. A second actor got one request each 60 seconds.

```listing
title: 20 minutes after the exit, and then one suspend
source: capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv
lang: text
note: Six lines for the actor e1, which got no request. The 80 later state lines of e1 are cut, and all of them say ACTOR_STATE_RUNNING. The snapshot column and the end of the error are cut.
---
2026-11-12T12:45:20.264Z	e1	exit-request	200	0.068987	exiting with code 3
2026-11-12T12:45:36.467Z	e1	state	ACTOR_STATE_RUNNING	kind-control-plane	…
…
2026-11-12T13:05:57.588Z	e1	call-after-watch	503	0.070948	upstream connect error or disconnect/reset before headers. reset reason: connection termination
2026-11-12T13:05:57.886Z	e1	suspend-attempt	Error: failed to suspend actor: rpc error: code = Internal desc = internal server error: workflow failed at step CallAteletSuspend: actor lab-v/e1 crashed…
2026-11-12T13:05:58.168Z	e1	state	ACTOR_STATE_CRASHED	kind-control-plane	…
2026-11-12T13:05:58.604Z	e1	after-revert	ACTOR_STATE_SUSPENDED	-	…
```

**We measured** two actors on the x86 server guest (24 vCPU, 47 GB, nested KVM), for 20 minutes 36 seconds after the exit. Both were `ACTOR_STATE_RUNNING` in every sample, 81 and 80 samples at 15 second intervals. All 20 requests to the second actor returned the 503 from Envoy. The first suspend after the watch failed and marked the actor crashed. A revert returned it to `ACTOR_STATE_SUSPENDED`, and the next call returned 200 with the count of the last durable snapshot.

So Substrate did not find a process exit by itself in 20 minutes, with requests or without. Each dead actor also kept one CPU of its worker for all that time, which [section 4.5](#s-sizing-a-pool) counts. We did not watch longer, and we did not restart the worker.

In both runs a suspend found the exit. The checkpoint failed, and the failed suspend marked the actor crashed.

Your harness must cover the exit case. If requests return `upstream connect error` and the state is `ACTOR_STATE_RUNNING`, call `SuspendActor` and expect it to fail. A harness that suspends after every turn does this without extra code.

## An actor on a node that stops

A node that stops and stays down gives three more cases, and none of them starts as `ACTOR_STATE_CRASHED`. We ran them on a cluster with two worker nodes and stopped one of the two. [Placement](#s-placement) has the timeline and the scheduler side.

| The actor when the node stopped | State that you see | Text of the request or the call |
|---|---|---|
| Suspended, and then a request arrives | `ACTOR_STATE_RESUMING` for minutes, then `ACTOR_STATE_CRASHED` | 504 at the client timeout, then 503 `actor lab-n/u1 unavailable` after 5 to 8 s |
| Running | `ACTOR_STATE_RUNNING` | 503 `upstream connect error or disconnect/reset before headers. reset reason: connection termination` |
| Either one, when you call `revert` | `ACTOR_STATE_RESUMING` or `ACTOR_STATE_REVERTING` | `another operation is in progress for this actor`, or `is not in a revertable state (got: ACTOR_STATE_RESUMING`, or `while calling atelet Terminate` |

**We measured** these cases on the second x86 server guest (16 vCPU, 23 GB), with gVisor and one actor for each case. A suspended actor with a complete snapshot stayed in `ACTOR_STATE_RESUMING` for 5 min 33 s from its first request. It was crashed 5 min 44 s after the stop command. A suspended actor with a pending snapshot was still in `ACTOR_STATE_RESUMING` 10 min 42 s after the stop command. It had received no request in the last 8 min 43 s. A running actor stayed `ACTOR_STATE_RUNNING` for the 10 minutes and the 150 requests of our probe.

```listing
title: a revert is refused twice while the node is down
source: capture/lab/L-gaps/multinode/80-stop-before-upload.tsv
lang: text
note: Five lines for the actor p3. The requests and the 10 minutes between the two reverts are cut. Our trace kept the first 200 characters of each CLI error.
---
2026-11-12T12:22:55.258Z	node-stop	docker stop multi-worker2
2026-11-12T12:23:15.930Z	first-request	504	10.054853		|	ACTOR_STATE_RESUMING	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:-,SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_PENDING:gen3:multi-worker2
2026-11-12T12:23:16.115Z	revert-attempt-1	Error: failed to revert actor: rpc error: code = Aborted desc = another operation is in progress for this actor 
…
2026-11-12T12:33:37.802Z	revert-attempt-2	Error: failed to revert actor: rpc error: code = FailedPrecondition desc = Actor lab-n/p3 is not in a revertable state (got: ACTOR_STATE_RESUMING, want one of [ACTOR_STATE_RUNNING ACTOR_STATE_CRASHED], or ACTOR_STATE_SUS
2026-11-12T12:33:38.407Z	probe-after-revert	503	0.193436	actor lab-n/p3 unavailable: AssignWorker prerequisite not met for Actor: lab-n/p3 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)	|	ACTOR_STATE_CRASHED	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:-,SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_PENDING:gen3:multi-worker2
```

Three rules follow from these runs.

- **`ACTOR_STATE_RESUMING` that lasts is a symptom.** A resume of a small actor takes less than a second, and this state lasted for minutes. In the first run the crash came one second after Kubernetes evicted the worker pods, 5 minutes after the node was `NotReady`. Without a request, nothing moved the actor out of the state.
- **A running actor on a stopped node is not marked crashed.** The caller gets the text of a process that exited. To tell the two cases apart, run `kubectl ate get workers`. On a stopped node the worker is `WORKER_STATE_UNAVAILABLE`, or it is not in the list.
- **A revert did not help while the node was down.** It failed or had no lasting effect in 4 of 4 attempts on three actors. The revert of the running actor left it in `ACTOR_STATE_REVERTING`. Each request then got 503 with `(got: ACTOR_STATE_REVERTING, want ACTOR_STATE_SUSPENDED)`.

A second revert is the way out of `ACTOR_STATE_REVERTING`, and only after the node is back. `RevertActor` accepts an actor that is already in that state, and it continues from the step where the earlier attempt stopped {{code}}. A later set of node-stop cases tested it.

**We measured** one actor that was suspended with `--mode sync`, on a second x86 server guest (16 vCPU, 23 GB), in one run with five reverts. The first revert started 10 s after the stop command, failed after 20.2 s, and left the actor in `ACTOR_STATE_REVERTING`. Three more failed in 0.2 s each, at 50 s, at 71 s, and at 371 s. Then we started the node. Its `atelet` ran 15 s later, and the actor was `ACTOR_STATE_CRASHED` by then. The fifth revert returned in 0.2 s, and the next request returned 200 in 0.47 s on the other node.

```listing
title: four reverts fail while the node is down, and the fifth works
source: capture/lab/P-node-loss/74-second-revert.tsv
lang: text
note: Six lines for the actor i9. The columns are the time, the seconds from the stop command, the event, and its detail. Each error is cut after the name of the call that failed, and the actor row of the fifth revert is cut.
---
2026-11-12T14:51:05.501Z	t=30.6	revert-1-right-after-stop	20.2 s | Error: failed to revert actor: rpc error: code = Unavailable desc = while calling atelet Terminate: …
2026-11-12T14:51:24.853Z	t=50.0	revert-2-after-workers-unavailable	0.2 s | Error: failed to revert actor: rpc error: code = Unavailable desc = while calling atelet Terminate: …
…
2026-11-12T14:56:45.527Z	t=370.7	revert-4-after-eviction	0.2 s | Error: failed to revert actor: rpc error: code = Unavailable desc = while calling atelet Terminate: …
…
2026-11-12T14:57:00.955Z	t=386.1	atelet-on-node-running	atelet-gsmxg:Running atelet-tfq5g:Running 
2026-11-12T14:57:01.180Z	t=386.3	state-before-revert-5	ACTOR_STATE_CRASHED	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:multi-worker2
2026-11-12T14:57:01.440Z	t=386.6	revert-5-after-node-return	0.2 s | ATESPACE   NAME   TEMPLATE      STATE                   WORKER POD   WORKER IPS   VERSION   AGE lab-n      i9     lab-n/nb-50   ACTOR_STATE_SUSPENDED   <none> …
```

So a repeated revert does not finish the job while the node is down. In the other cases, 3 to 28 more reverts of an actor in `ACTOR_STATE_REVERTING` all failed. Each failed revert is one more call to an `atelet` that is not there.

The result after the return has a caveat. In four earlier cases the actor still showed `ACTOR_STATE_REVERTING` 216 to 223 s after the node start, and we sent no command in that time. In those cases the pool pods had been evicted, and the node came back with no pool pod. Our clean-up then removed those actors, and we did not record each result. So the state cleared by itself after the return in one run, and it did not in four. After a node returns, look at the state, and send the revert again if it is still `ACTOR_STATE_REVERTING`.

The path that the first runs left open is also measured. A revert that waits until the workers show `WORKER_STATE_UNAVAILABLE` frees one kind of actor: suspended with `--mode sync`, and with no request since the stop. It took 7.1 s, and the next request ran on the other node. [Section 8.2](#s-when-a-dependency-is-down) has the runbook for every case.

**Do not revert an actor that you suspended in the default mode.** Its newest snapshot is still `PENDING` on the stopped node, and it comes back with the node. In one run the node returned after 81 s. A request with no revert then returned 200 in 0.36 s, with count 6 after 5. A second actor in the same state got a revert first. Its next reply had count 4, so the two calls after its last durable snapshot were lost.

## RevertActor

**RevertActor:** the call that discards the current execution of an actor and returns it to `ACTOR_STATE_SUSPENDED` at its last completed durable snapshot. It accepts a crashed actor, a running actor, and a suspended actor whose newest snapshot is on a node {{docs}}. It also accepts an actor in `ACTOR_STATE_REVERTING`, so that you can send a revert again {{code}}. In our run that second revert worked only after the node of the actor was back.

A revert stops any sandbox, removes the snapshot files on the node, and deletes an upload that was not complete {{docs}}. The actor comes back with no assigned node, and the next request resumes it from the object store.

| Run | Last completed snapshot | Calls made after it | First reply after the revert |
|---|---|---|---|
| Worker pod deleted | count 8 | 9, 10, 11 | count 9 |
| Snapshot on the node removed | count 3 | 4, 5 | count 4 |
| Node restarted | count 3 | 4, 5 | count 4 |

The calls in the third column are gone. The actor answers as if they never happened.

**We measured** one revert of the counter actor on the x86 server guest: `kubectl ate revert actor` returned in 0.22 seconds. The first request after a revert took 0.38 to 0.42 seconds in three runs. After the node restart, that first request waited 5 seconds and got `no worker has room for the actor`, although all pods ran. A request 78 seconds later returned 200. [Placement](#s-placement) explains that 503: for some seconds after the control plane returns, no worker of the pool is active.

A revert rewinds the actor only. A tool call that the actor made after the snapshot stays made, and an external volume keeps its contents {{docs}}. We did not test external volumes.

```figure
id: fig-3-5
kind: decision
title: my actor returns 503 or 500
claim: The text of the error tells you the state of the actor, and the state tells you the one call that helps.
caption: Read each row left to right. Rose boxes are errors and failed states, and the last row is a full pool with a healthy actor. Seconds are from our runs on the x86 server guest. From capture/lab/D-durability/30-local-loss.tsv, capture/lab/J-container-death/10-trace.tsv, and capture/lab/D-durability/10-watch-part1.tsv.
```

Our position: decide in your harness what a crash means, because Substrate will not. After our node restart, `my-counter-1` stayed crashed until we reverted it by hand. A revert is safe to automate for an actor whose last calls can be sent again without a second effect. A tool call that already ran stays done, so the tool must ignore a repeat. For any other actor, suspend with `--mode sync` at each point that you cannot lose.

```takeaways
- Read the error text first: AssignWorker names the state after got, upstream connect error means a dead process or node.
- Call kubectl ate revert actor for a crashed actor, because resume is refused.
- Call SuspendActor on a running actor that returns 503, so that Substrate marks it crashed.
- Count the calls since the last COMPLETED snapshot as lost after a revert.
- Wait until workers are registered before you send requests after a node restart.
- Keep the crashed 503 out of the retry loop that you use for a full pool.
- Treat an actor that stays in RESUMING as an actor on a dead node, and check its worker.
- Revert an actor on a stopped node only after a sync suspend with no later request, and with workers unavailable.
- After the node returns, send the revert again if the actor is still in REVERTING.
- Never revert an actor that you suspended in the default mode while its node is down.
```

Sources: capture/lab/summary/failures-x86.json, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/25-actor-crashed.yaml, capture/lab/B-lifecycle/26-actor-after-revert.yaml, capture/lab/D-durability/30-local-loss.tsv, capture/lab/D-durability/32-x1-after-loss.yaml, capture/lab/D-durability/34-x2-atelet-restart.log, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/J-container-death/10-trace.tsv, capture/lab/J-container-death/14-j2-after-oom.yaml, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/V-validation/11-process-exit-long-watch/11-workers-end.txt, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/98-worker-state-rpcs.log, capture/lab/P-node-loss/74-second-revert.tsv, capture/lab/P-node-loss/10-a-quiet-revert.tsv, capture/lab/P-node-loss/88-pending-snapshot-node-returns.tsv, capture/lab/P-node-loss/return-b60.tsv, capture/lab/P-node-loss/return-bevict.tsv, capture/lab/P-node-loss/return-cquiet.tsv, capture/lab/P-node-loss/return-creq.tsv, capture/lab/summary/node-loss-x86.json. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (ActorStatus.crash, RevertActorRequest, ReportActorCrashed), cmd/ateapi/internal/controlapi/workflow_revert.go, docs/reference/api-guide.md (ResumeActor, RevertActor, Eviction).
