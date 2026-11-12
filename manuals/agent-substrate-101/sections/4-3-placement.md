# Placement: which worker gets the actor

> `ate-api-server` picks a worker at every resume: it filters the workers, takes two at random, and binds the actor to the less loaded one.

Your actor ran on one worker pod this morning and on another one after lunch. Or a request fails with `no worker has room for the actor` while `kubectl ate get workers` shows a worker with free CPU. Both cases have the same cause. Substrate places an actor again each time it resumes, and the rules are not the rules of the Kubernetes scheduler.

When you finish this section, you can list the filters that a worker must pass and predict where an actor resumes. You can also explain a `no worker has room` error on a pool that is not full.

All of our runs had one node. The rules for more than one node below come from the code at v1.0.0, and a measured run on several nodes is not finished. The section marks each statement that needs that run.

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

On a cluster with several nodes this rule has a cost. An actor can find its node full while another node has free workers. The code handles that case in the same resume call {{code}}:

- **The node is full and reachable.** `ate-api-server` asks `atelet` on that node to upload the snapshot and delete the local copy. Then it tries the other nodes. The resume pays for an upload and a download.
- **The node is down and the snapshot is in the object store.** The actor forgets the node and resumes elsewhere.
- **The node is down and the snapshot is only on that node.** The resume fails as unavailable, and the router parks the request. The calls since the last durable snapshot are on a disk that nobody can read.

We have not measured that path. Our clusters had one node, so the local node was always the only node. Three numbers wait for the run on several nodes. They are how often a resume leaves its node, what the move costs in seconds, and what a client sees while the node is down.

## After a node restart

A restart of the node removes every worker at one time. We did that once on the single node of the x86 server guest.

**We measured** the recovery on the x86 server guest (24 vCPU, 47 GB, nested KVM), one run. The Kubernetes API answered again after 8 seconds, and all pods were running after 147 seconds. A request for a suspended actor then returned 503 with `no worker has room for the actor`. The same request returned 200 about 80 seconds later.

All seven workers of that cluster were `WORKER_STATE_ACTIVE` with nothing booked when we listed them after the recovery. We do not know why placement refused the actor during those 80 seconds. A worker pod that is Running is not yet a candidate: it must register again through `atelet` first, as [WorkerPool](#s-workerpool) describes. That is our reading of the code and not a measured cause. A run that records the state of each worker during a restart is not finished.

Until then, plan for this: after a node returns, expect capacity errors for some minutes after the pods look healthy. An actor that was running on that node is `ACTOR_STATE_CRASHED`, and [CRASHED and RevertActor](#s-crashed-and-revertactor) covers it.

## Steer placement with labels

You have two tools, and both are labels {{docs}}:

- **Pool labels and selectors.** Put a label on the WorkerPool object, and select it in the template with `workerSelector.matchLabels`. An actor can add its own selector, and both must match.
- **Node rules for the pool.** `spec.template.nodeSelector`, `tolerations` and `nodeAffinity` of the pool decide which nodes the worker pods use. They act on Kubernetes, before any actor exists.

There is no way to pin one actor to one worker, and no priority between actors. A template can select pools with different CPU types, and that is unwise. A memory snapshot from one type cannot always restore on the other.

```takeaways
- Read no worker has room as no candidate, then check class, node, labels, and room.
- Expect an actor on a different worker after each resume.
- Keep free workers on every node, because a suspended actor prefers its last node.
- Use a synchronous suspend before you drain a node, so the snapshot can move.
- After a node restart, wait some minutes before you trust capacity errors.
```

Sources: capture/lab/I-capacity/03-actors-when-full.txt, capture/lab/I-capacity/14-workers-full.txt, capture/lab/I-capacity/15-actors-after.txt, capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml, capture/lab/A-quickstart/60-state.log, capture/lab/D-durability/10-watch-part2.tsv, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/summary/timers-x86.json, capture/lab/summary/failures-x86.json; cmd/ateapi/internal/scheduling/scheduling.go, cmd/ateapi/internal/controlapi/workflow_resume.go, cmd/ateapi/internal/controlapi/workflow_resume_detach.go, cmd/ateapi/internal/store/atepg/worker_assignment.go, cmd/atelet/main.go at v1.0.0; docs/reference/api-guide.md, docs/reference/sandbox-classes.md at v1.0.0.
