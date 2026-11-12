# Actor and its seven states

> An actor is always in one of seven states, and that state decides what a request, a resume, and a suspend do.

A request to your actor returns 503. `kubectl get pods` shows every pod as Running, and the worker pod log does not name your actor. Kubernetes cannot tell you more, because an actor is not a pod. Its state is a row in Postgres, and `kubectl ate get actors` reads that row.

When you finish this section, you can read the state of an actor and name the call that moves it. You can also predict what a request does in each state.

## The Actor object

**Actor:** one instance of an ActorTemplate, with a name that is unique in its atespace. An actor is the unit that Substrate suspends and resumes. It can run on a different worker after each resume.

This is the counter actor of the quickstart while it runs.

```listing
title: the actor my-counter-1 in ACTOR_STATE_RUNNING
source: capture/lab/B-lifecycle/26-actor-after-revert.yaml
lang: yaml
note: The snapshot list and the runtime attributes are cut.
---
actorTemplate:
  atespace: ate-demo-counter
  name: counter
metadata:
  atespace: ate-demo-counter
  createTime: "2026-11-12T10:13:40.987568669Z"
  name: my-counter-1
  uid: 6f80f612-7547-4f5b-b3ab-831595621806
  updateTime: "2026-11-12T10:30:18.103768100Z"
  version: "16"
status:
  assignedNode: kind-control-plane
  lastAssignedGeneration: 3
  snapshots:
  …
  state: ACTOR_STATE_RUNNING
  workerAssignment:
    nodeName: kind-control-plane
    …
    workerPod: counter-7cc7dcd596-fps97
    …
    workerPodUid: c572e96d-dd9b-4500-b0e3-880a98d9f61d
    workerPool: counter
```

| Field | What it tells you |
|---|---|
| `metadata.version` | A counter that rises on every change of the actor. This actor reached 16 in 17 minutes. |
| `status.state` | One of the seven states. |
| `status.workerAssignment` | The worker pod that hosts the sandbox. It is set only while a worker holds the actor. |
| `status.assignedNode` | The node that holds the newest snapshot on its disk. It can stay set after a suspend. |
| `status.snapshots` | The snapshots that the actor can resume from, at most 16 {{code}}. |
| `status.crash` | A time and a message. It exists only in `ACTOR_STATE_CRASHED`. |

`workerAssignment` and `assignedNode` answer different questions. The first says where the actor runs now. The second says where its last snapshot is, and [section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) shows how long that lasts.

## The seven states

The enum `ActorState` has seven values at v1.0.0 {{code}}. The architecture page of the project draws five of them, so trust the enum.

| State | What the actor has | What a request does |
|---|---|---|
| `ACTOR_STATE_SUSPENDED` | No sandbox, and zero or more snapshots | The router resumes the actor, then the actor answers |
| `ACTOR_STATE_RESUMING` | A worker, and a restore that is not complete | It waits for the same resume {{code}} |
| `ACTOR_STATE_RUNNING` | A sandbox on a worker | The actor answers |
| `ACTOR_STATE_SUSPENDING` | A worker, and a checkpoint that is not complete | We did not test this case |
| `ACTOR_STATE_CRASHED` | No sandbox, and a `crash` record | 503 at once, with the state in the text |
| `ACTOR_STATE_REVERTING` | A revert that is not complete | We did not test this case |
| `ACTOR_STATE_DELETING` | A delete that is not complete | We did not test this case |

Three of these states are stable. `ACTOR_STATE_SUSPENDED` and `ACTOR_STATE_CRASHED` last until a call arrives. `ACTOR_STATE_RUNNING` lasts until a caller suspends the actor, and [section 3.3](#s-suspendactor-and-resumeactor) proves that Substrate does not do it. The other four states are steps of one operation.

Old tutorials name a state `ACTOR_STATE_PAUSED` and a command `kubectl ate pause actor`. Both are gone at v1.0.0 {{code}}.

```figure
id: fig-3-2
kind: state
title: the seven actor states
claim: An actor leaves ACTOR_STATE_CRASHED only through RevertActor or DeleteActor, and no request can resume it.
caption: Read the top row left to right for a resume, and follow the right edge down for a suspend. Amber and rose arrows are transitions from our traces. The dotted grey arrow comes from the code only. From capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/J-container-death/10-trace.tsv, and capture/lab/K-kagent/logs/actor-state-changes.tsv.
```

## The transitions we saw

We drove `my-counter-1` through a suspend, a resume, a crash, and a revert in 13 seconds. A script read the state after each step.

```listing
title: one actor from suspended to crashed and back
source: capture/lab/B-lifecycle/20-trace-ops.tsv
lang: text
note: Five lines of the trace. The columns are the time, the event, the state, the assigned node, the version, and the snapshots.
---
2026-11-12T10:30:09.378Z	state	ACTOR_STATE_SUSPENDED	kind-control-plane	9	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen3
2026-11-12T10:30:10.310Z	state	ACTOR_STATE_RUNNING	kind-control-plane	11	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen3
…
2026-11-12T10:30:11.590Z	state-after-crash	ACTOR_STATE_CRASHED	kind-control-plane	12	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen3
…
2026-11-12T10:30:17.724Z	state	ACTOR_STATE_SUSPENDED	-	14	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen3
…
2026-11-12T10:30:18.333Z	state	ACTOR_STATE_RUNNING	kind-control-plane	16	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen3
```

Look at the version column. A resume moved it from 9 to 11, and the revert moved it from 12 to 14. Each operation writes the actor two times: one write for the step state, and one for the stable state. Our script read the state after each command returned, so it never saw the state between.

The log of `ate-api-server` does show those states. The listing in [section 3.1](#s-actortemplate-and-the-golden-snapshot) has `resuming` before `running`, `suspending` before `suspended`, and `deleting` before `deleted`.

**We measured** the step states on the kagent guest (16 vCPU, 31 GB), where a harness resumes and suspends an actor for every turn. Over 98 turns, the actor spent a median of 0.38 seconds in `ACTOR_STATE_RESUMING`. Over 99 suspends, it spent a median of 0.14 seconds in `ACTOR_STATE_SUSPENDING`. Those actors keep files only, so the times are low.

A step state can also last. In our dependency test, one actor was still in `ACTOR_STATE_RESUMING` five minutes after Postgres came back. [Section 8.2](#s-when-a-dependency-is-down) has that case.

## Who moves an actor

| Call | Accepted from | Result | Who calls it |
|---|---|---|---|
| `CreateActor` | no actor | `SUSPENDED` | You, or your harness |
| `ResumeActor` | `SUSPENDED` | `RESUMING`, then `RUNNING` | The router for every request, or `kubectl ate resume actor` |
| `SuspendActor` | `RUNNING` | `SUSPENDING`, then `SUSPENDED` | You, or your harness |
| `RevertActor` | `CRASHED`, `RUNNING`, and `SUSPENDED` with a snapshot on the node | `REVERTING`, then `SUSPENDED` | You, or your harness |
| `DeleteActor` | every state | `DELETING`, then no actor | You, or your harness |

Substrate itself makes one move: it marks an actor `ACTOR_STATE_CRASHED` when the sandbox, the worker, or a restore is lost. [Section 3.5](#s-crashed-and-revertactor) lists every way that we reached that state.

A call in the wrong state does not wait. `ResumeActor` on a crashed actor returns `FailedPrecondition` at once, and a request gets the same text as a 503. `SuspendActor` on a suspended actor returns the actor with no change {{docs}}.

The router calls `ResumeActor` for every request, also when the actor runs. That is why a plain HTTP request is enough to start a suspended actor. [Section 1.2](#s-one-request-from-client-to-actor) follows one such request.

Our position: read the state before you debug the network. `kubectl ate get actors -a <atespace>` costs one call. It separates a crashed actor from a full pool and from a dead process, and each of those needs a different fix.

```takeaways
- Read the state with kubectl ate get actors before you read pod logs.
- Use the enum in the proto as the list of states, not the diagram in the docs.
- Watch metadata.version to see if an actor changed between two reads.
- Send a request to start a suspended actor, because the router calls ResumeActor.
- Expect only your own calls to move an actor out of RUNNING or CRASHED.
```

Sources: capture/lab/summary/kagent-turns-x86.json, capture/lab/B-lifecycle/26-actor-after-revert.yaml, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/00-actor-before.json, capture/lab/B-lifecycle/25-actor-crashed.yaml, capture/lab/D-durability/30-local-loss.tsv, capture/lab/J-container-death/10-trace.tsv, capture/lab/K-kagent/logs/actor-state-changes.tsv, capture/lab/E-dependency-loss/21-nonsteady-actors-after.txt, capture/lab/summary/failures-x86.json. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (ActorState, ActorStatus, Actor), cmd/ateapi/internal/controlapi/workflow_resume.go, workflow_suspend.go, workflow_revert.go, docs/reference/api-guide.md (ResumeActor, SuspendActor, RevertActor, DeleteActor), docs/concepts/architecture.md (the state diagram).
