# States

> An actor has seven states, a snapshot has two storage states, and a worker has three, and each one changes what a request returns.

The names and numbers below come from the proto file at v1.0.0. Store and compare the names. The numbers changed before 1.0.0, as [section 8.4](#s-upgrade-and-stale-advice) explains.

The "what a request returned" column comes from our runs, through `kubectl ate proxy`. Most rows are from the x86 server guest (24 vCPU, 47 GB, nested KVM). The rows for a stopped node and for the database outage are from a second x86 server guest (16 vCPU, 23 GB). Those are `ACTOR_STATE_RESUMING` and `ACTOR_STATE_REVERTING` in the first table, and the stopped-node rows of the second.

## Actor states

| Number | State | Meaning | What a request returned in our runs |
|---|---|---|---|
| 1 | `ACTOR_STATE_RESUMING` | A worker is bound, and the sandbox is being restored. | 504 at the client timeout, then 503 `actor lab-n/u1 unavailable`, for an actor on a stopped node. One other actor stayed in this state after a database outage. |
| 2 | `ACTOR_STATE_RUNNING` | The actor holds a worker and serves requests. | 200 in 0.06 to 0.09 s |
| 3 | `ACTOR_STATE_SUSPENDING` | The worker writes a checkpoint. | A request that was open when the suspend started got a 503. A new request in this state was not tested. |
| 4 | `ACTOR_STATE_SUSPENDED` | The actor holds no worker. It has a snapshot, or it never ran. | 200 in 0.36 s, after a resume |
| 5 | `ACTOR_STATE_CRASHED` | The sandbox or its worker was lost, or a resume failed. | 503 in 0.06 s, `AssignWorker prerequisite not met` |
| 6 | `ACTOR_STATE_DELETING` | The workload is being stopped, and the record is removed next. | 503 in 0.06 to 0.08 s, `AssignWorker prerequisite not met` |
| 7 | `ACTOR_STATE_REVERTING` | The actor returns to its durable snapshot. | 503 in 0.06 s, `AssignWorker prerequisite not met`, after a revert that could not reach the node |

Number 0 is `ACTOR_STATE_UNSPECIFIED`, which no stored actor has. No state means idle, paused, or created. A new actor is suspended.

```figure
id: fig-r-3
kind: state
title: the seven actor states, every transition, and what a request returns
claim: A crashed actor returns to service only through RevertActor, and every path into RUNNING goes through ResumeActor.
caption: Read from SUSPENDED at the left. The number in each box is the enum value. Each arrow has the call or the event that causes it. Rose arrows are failures. Grey dotted arrows come from the code only. From the ActorState enum and the lifecycle workflows at v1.0.0, capture/lab/B-lifecycle/20-trace-ops.tsv, and capture/lab/J-container-death/10-trace.tsv.
```

## Transitions

| From | To | Trigger | Seen in our runs |
|---|---|---|---|
| none | SUSPENDED | `CreateActor` | yes, in under 1 s |
| SUSPENDED | RESUMING, then RUNNING | `ResumeActor`, which the router calls for each request | yes |
| RESUMING | CRASHED | The resume failed. In our runs the node-local snapshot was missing, or the worker had not registered after a node restart. The documentation adds a wakeup probe that times out. | yes, with a 500 `error resuming actor` |
| RUNNING | SUSPENDING, then SUSPENDED | `SuspendActor` | yes |
| SUSPENDED | SUSPENDED | `SuspendActor` on a suspended actor returns it unchanged. | from the code |
| SUSPENDING | CRASHED | The suspend could not record its snapshot. | from the code |
| RUNNING | CRASHED | The worker pod was deleted. | yes, within 0.6 s |
| RUNNING | CRASHED | The kernel killed the actor for memory. | yes, between 2 s and 4 s |
| RUNNING | CRASHED | The node restarted. | yes |
| RUNNING | RUNNING | The process exited and the sandbox stayed. No transition occurs. | yes, for at least 20 min |
| RUNNING | RUNNING | The node of the actor stopped. No transition occurs. | yes, for at least 10 min |
| RESUMING | CRASHED | The node of the actor stopped before or during the resume. | yes, 5 min 44 s after the stop command, after 5 min 33 s in RESUMING with requests |
| RUNNING or CRASHED | REVERTING, then SUSPENDED | `RevertActor` | yes, from CRASHED in 0.22 s |
| SUSPENDED with a node-local snapshot | REVERTING, then SUSPENDED | `RevertActor`, which discards the copy on the node. The snapshot itself is lost only if its upload is not yet complete. | yes, after the node of the actor was back: the next reply had count 4, and the two later calls were lost. With the node down, the actor stayed in REVERTING |
| REVERTING | REVERTING, then SUSPENDED | A second `RevertActor`, which continues a revert that stopped part-way | yes, in 0.2 s, after the node and its `atelet` were back. With the node down, 4 of 4 reverts failed and the state stayed REVERTING |
| REVERTING | CRASHED | The node of the actor returned, and we sent no command. | yes, in one run, 15 s after the node start. In four runs the actor was still REVERTING after 216 to 223 s |
| RUNNING | RUNNING | `ResumeActor` on a running actor returns it unchanged, with `resumed=false`. The router relies on this for every request. | yes, on every request to a running actor |
| any | DELETING, then removed | `DeleteActor` | yes |

Four rules follow from the table.

- `ResumeActor` accepts a suspended actor, an actor that is already resuming, and a running actor, which it returns unchanged. On a crashed actor it returns `FAILED_PRECONDITION`.
- `RevertActor` accepts an actor that is already reverting, so a second revert is the way out of a revert that stopped.
- A crashed actor never leaves that state by itself. Something must call `RevertActor` or `DeleteActor`.
- A revert returns the actor to its last completed durable snapshot. Calls that came after that snapshot are lost.

## Snapshot storage states

| State | Meaning | How long, in our runs |
|---|---|---|
| `SNAPSHOT_STORAGE_STATE_PENDING` | The snapshot is on one node and is not in the bucket. | 5 min 1 s to 5 min 11 s after an asynchronous suspend, with default timers, for four actors |
| `SNAPSHOT_STORAGE_STATE_COMPLETED` | The snapshot is in the bucket. | reached before a synchronous suspend returns |

The `locality` field of a snapshot names the node that still has a local copy. It was set for 30 minutes after the suspend in our run, and absent after that. The `owner` field is `SNAPSHOT_OWNER_ACTOR` for a snapshot of the actor itself and `SNAPSHOT_OWNER_TAG` for a golden or tagged snapshot.

## Snapshot fidelity

| Value | What a resume brings back |
|---|---|
| `SNAPSHOT_FIDELITY_VOLUMES` | the durable directories. The processes start again. |
| `SNAPSHOT_FIDELITY_ROOTFS` | the durable directories and the changes to the root filesystem. The processes start again. |
| `SNAPSHOT_FIDELITY_MEMORY` | all of that and the memory of the processes, which continue. |

## Worker states

| State | Meaning |
|---|---|
| `WORKER_STATE_UNAVAILABLE` | Registered, and the scheduler places no actor on it. A new worker starts here. |
| `WORKER_STATE_ACTIVE` | The scheduler places actors on it while it has room. |
| `WORKER_STATE_DRAINING` | Terminating. No new actor is placed, and bound actors stay until they are suspended. One-way. |

`kubectl ate get worker` prints the state with the actors, the CPU, and the memory that are reserved against the capacity.

## Durability modes of a suspend

| Value | CLI | When the call returns |
|---|---|---|
| `DURABILITY_MODE_ASYNCHRONOUS` | `--mode async`, the default | when the snapshot is on the node |
| `DURABILITY_MODE_SYNCHRONOUS` | `--mode sync` | when the snapshot is in the bucket |

Sources: capture/lab/P-node-loss/74-second-revert.tsv, capture/lab/P-node-loss/88-pending-snapshot-node-returns.tsv, capture/lab/P-node-loss/return-b60.tsv, capture/lab/summary/node-loss-x86.json, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, api/ateapi/v1/ateapi.proto (enums ActorState, SnapshotStorageState, SnapshotOwner, SnapshotFidelity, WorkerState, DurabilityMode, and the comments on RevertActor and SuspendActor), cmd/ateapi/internal/controlapi/workflow_resume.go, workflow_suspend.go and workflow_revert.go, and docs/reference/api-guide.md at v1.0.0; capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/93-after-node-return.tsv, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/D-durability/10-watch-part2.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/J-container-death/10-trace.tsv, capture/lab/E-dependency-loss/21-nonsteady-actors-after.txt, capture/lab/summary/failures-x86.json.
