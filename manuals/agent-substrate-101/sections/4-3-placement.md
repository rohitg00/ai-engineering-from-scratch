# Placement: which worker gets the actor

> `ate-api-server` picks a worker at every resume: it filters the workers, takes two at random, and binds the actor to the less loaded one.

Your actor ran on one worker pod this morning and on another one after lunch. Or a request fails with `no worker has room for the actor` while `kubectl ate get workers` shows a worker with free CPU. Both cases have the same cause. Substrate places an actor again each time it resumes, and the rules are not the rules of the Kubernetes scheduler.

When you finish this section, you can list the filters that a worker must pass and predict where an actor resumes. You can also explain a `no worker has room` error on a pool that is not full.

Most of our runs had one node. For this section we also built a cluster with one control plane node and two worker nodes, and we stopped one worker node four times. One result is against what the code suggested, and the section says where.

## Two schedulers, two jobs

Kubernetes places worker pods on nodes, once, when the pool starts. It never sees an actor.

Substrate places actors on workers. The scheduler is a function inside `ate-api-server`. It runs in the `ResumeActor` call, and it reads the workers from memory and from Postgres, not from the Kubernetes API {{code}}. That is why placement continued in our test with the Kubernetes API server down, as [when a dependency is down](#s-when-a-dependency-is-down) shows.

A new actor has no worker. `CreateActor` writes a row with the state `ACTOR_STATE_SUSPENDED`, and placement waits for the first request. A suspend releases the worker again.

**Placement:** the choice of one worker for one actor, made at each resume.

## The filters

```figure
id: fig-4-3
kind: flow
title: how ate-api-server chooses a worker for one resume
claim: A worker must pass six checks before it is a candidate, and the scheduler then takes the less loaded of two random candidates.
caption: Read from the top left. Each bar is one check that a worker must pass. Rose is the result with no candidate. Teal is the write to Postgres that binds the actor. From cmd/ateapi/internal/scheduling/scheduling.go at v1.0.0.
```

A worker is a candidate when all of these are true {{code}}:

1. It is registered, and its state is `WORKER_STATE_ACTIVE`.
2. Its sandbox class is the class of the snapshot that the actor resumes from.
3. It is on the node that holds the local snapshot of the actor, if a local snapshot exists.
4. Its runtime can restore the memory snapshot, if the snapshot has memory.
5. The labels of its pool match the `workerSelector` of the template and of the actor.
6. It has room: one free actor place, and free CPU and memory for the booking of the actor.

With no candidate, the call fails with `no worker has room for the actor`. The text is the same whichever filter removed the last worker. So the error does not always mean that the pool is full. It can mean that the only workers with room are of the wrong class or without the right label.

With one candidate, that worker gets the actor. With more, the scheduler takes two at random and keeps the less loaded one. The load of a worker is its fullest dimension: actor places, CPU, or memory.

The bind is one Postgres transaction. It locks the row of the worker, checks the room again, and writes the assignment. Two resumes that compete for the last place cannot both win. The loser tries again with another worker.

## What our runs showed

We created four actors on a pool of two workers and sent each one a request, one after the other.

```listing
title: four actors on two workers
source: capture/lab/I-capacity/03-actors-when-full.txt
lang: text
note: The header and the first five rows. The suspended actors below them are cut.
---
ATESPACE   NAME    TEMPLATE           STATE                   WORKER POD                       WORKER IPS    VERSION   AGE
lab-c      b0-1    lab-c/ballast-0    ACTOR_STATE_RUNNING     lab-c/ballast-65cf95d875-bzgjd   10.244.0.26   43        69s
lab-c      b0-2    lab-c/ballast-0    ACTOR_STATE_RUNNING     lab-c/ballast-65cf95d875-f65dl   10.244.0.27   3         68s
lab-c      b0-3    lab-c/ballast-0    ACTOR_STATE_RUNNING     lab-c/ballast-65cf95d875-bzgjd   10.244.0.26   3         66s
lab-c      b0-4    lab-c/ballast-0    ACTOR_STATE_RUNNING     lab-c/ballast-65cf95d875-f65dl   10.244.0.27   3         65s
lab-c      b0-5    lab-c/ballast-0    ACTOR_STATE_SUSPENDED   <none>                                         1         63s
```

The actors alternate between the two pods. With two candidates, the scheduler always compares both, and the emptier one wins. The fifth actor found no candidate and stayed suspended.

The parking run shows the other half of the rule. Actor `p3` waited for a worker. When we suspended `p1`, `p3` resumed on the pod that `p1` had used {{run}}. An actor has no home worker. It goes wherever a place is free at that moment.

### Across two nodes

The scheduler compares workers, not nodes. On the cluster with two worker nodes, the pool had four workers, two on each node. We created 20 actors, sent each one a request, and left all of them running.

```listing
title: where 20 actors went on two nodes and four workers
source: capture/lab/L-gaps/multinode/52-placement-counts.txt
lang: text
---
node multi-worker 10
node multi-worker2 10
worker lab-n/ballast-5d6cf97747-xlw7d 6
worker lab-n/ballast-5d6cf97747-dpjlc 5
worker lab-n/ballast-5d6cf97747-5cmpq 5
worker lab-n/ballast-5d6cf97747-67bkm 4
```

**We measured** this spread on the second x86 server guest (16 vCPU, 23 GB), with one run of 20 actors on gVisor. Ten actors went to each node, and the four workers got 6, 5, 5, and 4. One create and one resume through the CLI took 0.95 to 1.19 seconds, with a median of 1.00 seconds.

## The node of the last suspend

Filter 3 is the one that surprises people. After an asynchronous suspend, the snapshot is on the disk of one node, and the actor remembers that node.

```listing
title: an actor that remembers its node
source: capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml
lang: yaml
note: Two lines of the status. The rest of the object is cut.
---
  assignedNode: kind-control-plane
  lastAssignedGeneration: 2
```

While `assignedNode` is set, only workers on that node are candidates. The reason is speed: a resume from the local disk skips the download from the object store. In our runs the node kept the actor for 30 minutes after the suspend, the default of the `atelet` flag `--snapshot-detach-delay`. After that the field was empty and any node could take the actor. [Snapshot fidelity, and where a snapshot lives](#s-snapshot-fidelity-and-where-a-snapshot-lives) has the measured timeline.

On the cluster with two worker nodes, the rule held in every resume.

**We measured** one actor on the second x86 server guest (16 vCPU, 23 GB), with five asynchronous suspends and one request after each. All 5 resumes went to the node of the suspend. The worker pod changed between the two workers of that node. Then we ran `kubectl cordon` on the node. The next 2 resumes still went to that node, in 0.41 and 0.29 seconds.

```listing
title: two resumes on a cordoned node
source: capture/lab/L-gaps/multinode/60-sticky-cordon.tsv
lang: text
note: Six lines of the trace, from the cordon to the second resume.
---
2026-11-12T12:02:26.555Z	cordon	multi-worker2
2026-11-12T12:02:26.986Z	resume-call-while-cordoned	200	0.408920	count=8 mb=50 sum=6613 process_age_s=8.2
2026-11-12T12:02:27.433Z	resumed-on	multi-worker2 pod lab-n/ballast-5d6cf97747-xlw7d
2026-11-12T12:02:28.977Z	suspended-sync	ACTOR_STATE_SUSPENDED	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen8:multi-worker2
2026-11-12T12:02:29.292Z	resume-call-while-cordoned	200	0.293103	count=9 mb=50 sum=6613 process_age_s=9.0
2026-11-12T12:02:29.727Z	resumed-on	multi-worker2 pod lab-n/ballast-5d6cf97747-xlw7d
```

A cordon is a Kubernetes mark for new pods, and the Substrate scheduler does not read it. So a cordon does not keep a suspended actor away from its node. The fourth line shows one more fact. After a synchronous suspend the snapshot is complete, and the actor still names the node.

The rule has a cost when the node is full while another node has free workers. The code handles that case in the same resume call {{code}}. `ate-api-server` asks `atelet` on that node to upload the snapshot and delete the local copy, and then it tries the other nodes. We did not measure that path.

## When the node stops

Our reading of the code said that an actor with a durable snapshot forgets a node that is down and resumes on another node. Our runs did not show that. We stopped one worker node four times, with the actor in a different condition each time. The other node had two active workers with room in every run.

```figure
id: fig-4-3b
kind: timeline
title: a suspended actor after its node stops
claim: A suspended actor with a complete snapshot stayed in RESUMING for 5 min 33 s from its first request, on a stopped node, then became CRASHED.
caption: Read left to right from the stop command. The tracks are the node, its two workers as the API lists them, the state of the actor u1, and one bar for each request. Amber is the step state and rose is failure. From capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/96-controller-events.log and capture/lab/L-gaps/multinode/98-worker-state-rpcs.log.
```

First, what Substrate knows about the node.

**We measured** the detection on the second x86 server guest (16 vCPU, 23 GB), in 4 of 4 stops. The workers of the stopped node were listed `WORKER_STATE_ACTIVE` for 43 to 51 seconds after the stop command. Then they were marked `WORKER_STATE_UNAVAILABLE`, at the time that Kubernetes reported the node `NotReady`. Kubernetes evicted the worker pods 5 minutes later, and the Deployment created two new pods on the other node.

```listing
title: how ate-controller learns that a worker is gone
source: capture/lab/L-gaps/multinode/96-controller-events.log
lang: json
note: One log line, 43 seconds after the first stop command.
---
{"time":"2026-11-12T12:03:19.231654833Z","level":"INFO","msg":"Syncer: marking worker unavailable (pod not Ready)","worker":"090b9723-a53d-4e0c-a139-741942971a78","pod":"lab-n/ballast-5d6cf97747-67bkm"}
```

The reason in that line is a pod that is not Ready. Substrate learned of the dead node from Kubernetes, and in our runs nothing in Substrate reported it sooner. For those 43 to 51 seconds, the scheduler can give a new resume to a worker on a node that is gone.

Second, what happened to the actor in each of the four runs.

| The actor when the node stopped | What the caller saw | The actor state |
|---|---|---|
| Suspended with `--mode sync`, snapshot `COMPLETED`, then a request every few seconds | 504 after the client timeout of 10 s, then 503 `actor lab-n/u1 unavailable` after 5 to 8 s. From 5 min 44 s after the stop command, 503 at once with `AssignWorker prerequisite not met` | `RESUMING` on the stopped node from the first request, then `CRASHED` |
| The same, with a `revert` 31 s after the stop command and before any request | The `revert` returned `SUSPENDED` with no node. The first request then bound the actor to a worker of the stopped node. It got 504 at the client timeout of 10 s, and each of the next 19 requests got 503 | `RESUMING` on the stopped node for the 2.5 min that we probed |
| Suspended in the default mode, snapshot `PENDING`, requests for 2 min and then none | 504, then 503. A `revert` after the first request failed: `another operation is in progress for this actor` | Still `RESUMING` 10 min 42 s after the stop command, with no request in the last 8 min 43 s. A second `revert` failed: `not in a revertable state`. The actor was `CRASHED` at the next request, 0.6 s after that second attempt. The trace cannot say which of the two caused the change |
| `RUNNING` on the node | 503 for each of 150 requests: `upstream connect error or disconnect/reset before headers`. A `revert` failed: `while calling atelet Terminate` | `RUNNING` for the 10 min that we probed, then `REVERTING` after the failed revert |

```listing
title: the first run, from the suspend to the crash
source: capture/lab/L-gaps/multinode/70-stop-after-upload.tsv
lang: text
note: Seven lines of the trace. The 40 requests between the second request and the last request in the state RESUMING are cut.
---
2026-11-12T12:02:36.103Z	suspended-sync	ACTOR_STATE_SUSPENDED	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:multi-worker2
2026-11-12T12:02:36.563Z	node-stop	docker stop multi-worker2
2026-11-12T12:02:46.908Z	node-stopped	multi-worker2
2026-11-12T12:02:57.202Z	probe	504	10.055616		|	ACTOR_STATE_RESUMING	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:multi-worker2
2026-11-12T12:03:07.214Z	probe	503	7.777073	actor lab-n/u1 unavailable	|	ACTOR_STATE_RESUMING	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:multi-worker2
…
2026-11-12T12:08:14.892Z	probe	503	5.051588	actor lab-n/u1 unavailable	|	ACTOR_STATE_RESUMING	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:multi-worker2
2026-11-12T12:08:20.312Z	probe	503	3.190662	actor lab-n/u1 unavailable: AssignWorker prerequisite not met for Actor: lab-n/u1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)	|	ACTOR_STATE_CRASHED	multi-worker2	SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:multi-worker2
```

**A suspended actor did not move to the other node.** This is the result that is against our reading of the code. In the first run the snapshot was complete in the object store, and the other node had two free workers. The actor still stayed bound to the stopped node. It was in `ACTOR_STATE_RESUMING` for 5 min 33 s from its first request, and it was `ACTOR_STATE_CRASHED` 5 min 44 s after the stop command. Substrate v1.0.0 did not move an actor off a dead node by itself in any of our runs.

A `revert` did not free the actor either, in 4 of 4 attempts in three runs. In the second run it came too early. The workers of the stopped node were still listed as active, and the next request chose one of them. In the third run the resume that was in progress blocked both attempts. In the fourth run the revert needed `atelet` on the stopped node, and the actor stayed in `ACTOR_STATE_REVERTING`.

One question is open. Does a `revert` that you send after the workers are marked unavailable let the actor resume on the other node from its durable snapshot? We have not verified that. Until someone does, treat a stopped node as an outage for every actor that is bound to it.

A `RUNNING` actor on a dead node is the worst case to see. Its state did not change in 10 minutes, so a list of actors shows nothing wrong. [CRASHED and RevertActor](#s-crashed-and-revertactor) has the error texts for each case.

When the node returned, it was `Ready` within seconds. It had none of the four pool pods in three of the four returns, because the new pods ran on the other node. Kubernetes does not move them back, and no new actor went to the returned node for more than 3 minutes. After we deleted two pool pods by hand, the first actor went to the returned node 23 to 35 seconds after the node start.

We did not test a pool with spare workers on a third node, or a node loss with the microVM class. We also did not test a node that is alive and unreachable.

## After a node restart

A restart of the node removes every worker at one time. We did that twice on the single node of the x86 server guest. The first run sent one request after the pods were back. The second run tried one resume every 2 to 3 seconds and listed the workers each time.

**We measured** the first recovery on the x86 server guest (24 vCPU, 47 GB, nested KVM), one run. The Kubernetes API answered again after 8 seconds, and all pods were running after 147 seconds. A request for a suspended actor then returned 503 with `no worker has room for the actor`. The same request returned 200 about 80 seconds later.

The second run shows why.

| Seconds from the restart command | What we saw |
|---|---|
| 0 to 10 | The restart command runs. |
| 10 to 157 | `kubectl ate` fails with `no ready api pods in ate-system`. Kubernetes reports the node `Ready` from 18 s. |
| 160 | `ate-api-server` answers for the first time. It lists all 11 workers as `WORKER_STATE_ACTIVE`. A resume fails with `while calling atelet Restore`. |
| 163 to 171 | Each worker from before the restart is marked `WORKER_STATE_UNAVAILABLE`. A resume fails, because the worker assigned to the actor `is unavailable`. |
| 174 | The first resume that works. |
| 178 to 191 | The workers return to `WORKER_STATE_ACTIVE` one by one. At 191 s, 11 of 11 are active. |

**We measured** this timeline on the x86 server guest (24 vCPU, 47 GB, nested KVM), with one restart and one suspended actor. Each poll made one resume attempt.

The mechanism has three steps. When the control plane returns, it first serves the worker list that it had before the restart. Then it marks each of those workers unavailable. Each worker becomes active again when it registers through `atelet`, as [WorkerPool](#s-workerpool) describes. Between the second and the third step, no worker of the pool is a candidate.

A resume in that window fails for lack of room or for an unavailable worker. The window was 10 to 30 seconds in this run. In the first run our one retry came 80 seconds later, so the window looked longer than it was.

The long part of the recovery is the control plane, not the workers. `ate-api-server` needed 160 of the 191 seconds.

Plan for this after a node restart: no call works until `ate-api-server` answers, and resumes can fail for about 30 seconds more. Do not use a check that all pods are Running as the signal. Kubernetes showed the old pod status at first: 0 pods not running at 10 seconds, and 21 at 18 seconds.

An actor that was running on a node that restarts is `ACTOR_STATE_CRASHED`, and [CRASHED and RevertActor](#s-crashed-and-revertactor) covers it. A node that stays down is different, as the table above shows. We did not repeat the restart on a cluster where the control plane and the workers are on different nodes.

## Steer placement with labels

You have two tools, and both are labels {{docs}}:

- **Pool labels and selectors.** Put a label on the WorkerPool object, and select it in the template with `workerSelector.matchLabels`. An actor can add its own selector, and both must match.
- **Node rules for the pool.** `spec.template.nodeSelector`, `tolerations` and `nodeAffinity` of the pool decide which nodes the worker pods use. They act on Kubernetes, before any actor exists.

There is no way to pin one actor to one worker, and no priority between actors. A template can select pools with different CPU types, and that is unwise. A memory snapshot from one type cannot always restore on the other.

```takeaways
- Read no worker has room as no candidate, then check class, node, labels, and room.
- Expect an actor on a different worker after each resume.
- Keep free workers on every node, because a suspended actor resumes only on its last node.
- Do not expect a cordon or a synchronous suspend to move a suspended actor.
- Treat a stopped node as an outage for each actor that is bound to it.
- After a node restart, wait until ate-api-server answers, then retry resumes for 30 seconds.
```

Sources: capture/lab/I-capacity/03-actors-when-full.txt, capture/lab/I-capacity/14-workers-full.txt, capture/lab/I-capacity/15-actors-after.txt, capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml, capture/lab/A-quickstart/60-state.log, capture/lab/D-durability/10-watch-part2.tsv, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/summary/timers-x86.json, capture/lab/summary/failures-x86.json, capture/lab/L-gaps/multinode/50-placement.tsv, capture/lab/L-gaps/multinode/52-placement-counts.txt, capture/lab/L-gaps/multinode/60-sticky-cordon.tsv, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/71-workers.txt, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/85-node-return.tsv, capture/lab/L-gaps/multinode/96-controller-events.log, capture/lab/L-gaps/multinode/97-k8s-node-events.txt, capture/lab/L-gaps/multinode/98-worker-state-rpcs.log, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/L-gaps/restart/11-workers-each-poll.txt, capture/lab/L-gaps/restart/23-ateapi.log; cmd/ateapi/internal/scheduling/scheduling.go, cmd/ateapi/internal/controlapi/workflow_resume.go, cmd/ateapi/internal/controlapi/workflow_resume_detach.go, cmd/ateapi/internal/store/atepg/worker_assignment.go, cmd/atelet/main.go at v1.0.0; docs/reference/api-guide.md, docs/reference/sandbox-classes.md at v1.0.0.
