# Sizing a pool

> The limits that you declare decide how many actors run at one time, and disk decides how many suspended actors you can keep.

Someone asks how many agents your cluster can hold. The question has two answers, and they differ by orders of magnitude. One answer is the number of actors that run at the same moment. The other is the number of actors that exist and wait in a suspended state.

When you finish this section, you can compute both numbers for a pool and choose the limits of a worker. You can also name the resource that runs out first.

## Running actors: the arithmetic of declared limits

A worker reports a capacity, and each running actor books a part of it. [WorkerPool](#s-workerpool) showed where the capacity comes from. The booking is the limit that the ActorTemplate declares, plus a memory overhead that the sandbox runtime reports {{code}}. The scheduler never looks at what an actor uses.

The number of actors that one worker runs is the smallest of three values:

- the CPU limit of the worker, divided by the CPU limit of the actor
- the memory limit of the worker less 64 MiB, divided by the memory booking of the actor
- 1,000, the default of `--max-actors`

```figure
id: fig-4-5
kind: comparison
title: running actors per worker follow the CPU that the worker reports
claim: Two workers with a 2 CPU limit ran four one-CPU actors, and one worker with no limits ran sixteen on a node with 16 vCPUs.
caption: Each green square is a running actor that declares 1 CPU. The rose square is an actor that found no room. The amber squares are turns that waited. The two columns are two different test machines. From capture/lab/I-capacity/02-workers-when-full.txt and capture/lab/K-kagent/parallel/workers-during.txt.
```

**We measured** the left column on the x86 server guest (24 vCPU, 47 GB, nested KVM). The pool had two workers with a limit of 2 CPUs and 3 GiB. Each actor declared 1 CPU and 256 MiB. Four actors ran, two on each worker. Eight requests that needed a fifth running actor all returned 503. CPU was the limit: each worker had booked 512Mi of 3008Mi.

**We measured** the right column on a second x86 server guest (16 vCPU, 31 GB), in the kagent run. The kagent pool sets no limits, and each actor declares 1 CPU and 1 GiB. We started 24 turns at the same time, one run. The worker reached 16 running actors and 16000 of 16000 millicores, and the other 8 turns waited. All 24 turns completed, in 4.3 to 7.8 seconds. With 8 turns at the same time, all 8 completed in 2.5 to 3.6 seconds.

[The parallel turns chart in section 7.1](#fig-7-1c) shows the time of each turn in both runs.

The second result looks like free capacity, and it is the opposite. That worker promised every CPU of the node to actors, and the control plane runs on the same node. Set limits, as [WorkerPool](#s-workerpool) explains.

The CPU value of a template is a booking for placement, and the worker also writes it into the sandbox as a CPU quota {{code}}. That quota is a hard cap.

**We measured** a fixed amount of work under four limits on a second x86 server guest (16 vCPU, 23 GB). Each of eight rows had three runs. The actor used 0.25, 0.50, 1.01, and 1.96 to 2.01 host cores at 250, 500, 1000, and 2000 millicores. Four threads got no more CPU than one thread. The work took 27.1 to 27.6 seconds at 250 millicores and 4.9 to 5.4 seconds at 1000.

[WorkerPool](#s-workerpool) has the table and the chart.

So a low value packs more actors on a worker, and each of them is that much slower when it is busy. Size the value from the CPU that one turn needs, not from the average. The actor still sees 2 CPUs at every limit, so set thread counts in the template yourself. We did not test several busy actors on one worker at the same time.

A burst of resumes inside the capacity of the pool is cheap.

**We measured** 16 resumes at the same instant on the x86 server guest (24 vCPU, 47 GB, nested KVM), 80 requests in five rounds. The median was 0.37 seconds, against 0.23 seconds for one resume alone, and all 80 returned 200. [Request parking](#s-request-parking) has the chart.

A dead actor counts as a running one. An actor whose process has exited stays `ACTOR_STATE_RUNNING`, and it keeps its booking. Two such actors each held 1,000 millicores of a worker for the 20 minutes of our watch. A burst of 32 resumes then found 14 free places in a pool of 16. [CRASHED and RevertActor](#s-crashed-and-revertactor) shows how to find and free them.

Two reports by other people help you choose the CPU limit of an actor. We did not repeat either.

A contributor measured real CPU use on workers that were fully booked, in issue 3441 {{issue #3441}}. Seven actors with 1 CPU each used between 0.55 and 0.8 cores together, at the median. A generous limit therefore costs you most of a worker, because Substrate at v1.0.0 has no overcommit.

A user measured resume time against the CPU limit of the actor on a release candidate of v1.0.0, in issue 3431 {{issue #3431}}. The median was 0.46 seconds at 50 millicores, 0.23 seconds at 100, and about 0.15 seconds from 250 up. A limit below 250 millicores saves capacity and costs resume time.

## Suspended actors: disk, in three places

A suspended actor books nothing on a worker. You can keep far more suspended actors than running ones. Each of them costs disk.

[The footprint chart in section 3.4](#fig-3-4c) shows these sizes as bars.

**We measured** disk use on the x86 server guest (24 vCPU, 47 GB, nested KVM) with 25 suspended actors, one sample. The actors held 8,750 MiB of memory in total. The node held 8,801 MiB of snapshots and the object store held 10,824 MiB. After we deleted the actors, the node held 1 MiB of snapshots and the object store held 2,064 MiB. A cache of 1,765 MiB stayed on the node in both samples.

Three rules come out of those numbers:

- **A memory snapshot is as large as the memory that holds data.** An actor with 200 MiB of random bytes made a snapshot of 201.9 MiB. Random bytes are the worst case. The same actor with 200 MiB of zero bytes made a snapshot of 4.0 MiB, and with half of each, 103.8 MiB. On the microVM class the snapshot also holds the guest, and it was 59 to 70 MiB larger, as [sandbox classes](#s-sandbox-classes) shows.
- **You pay two times for 30 minutes.** With the default timers, the node keeps its copy for 30 minutes after the suspend. The object store has a second copy after 5 minutes. [Snapshot fidelity, and where a snapshot lives](#s-snapshot-fidelity-and-where-a-snapshot-lives) has the timeline.
- **Golden snapshots stay.** The 2,064 MiB that remained belong to the five templates. Deleting actors does not free that space.

The disk that one node needs for snapshots is therefore the number of suspends in 30 minutes, times the snapshot size. A node that suspends 200 actors of 200 MiB each half hour needs 40 GiB for snapshots alone. The snapshot directory is a path on the node, and Kubernetes charges it to no pod.

On a pool that spans nodes, size each node by itself. A suspended actor resumes only on the node of its last suspend, for 30 minutes with the default timers. In our runs on two worker nodes, no actor moved off a node that stopped. When the node returned, Kubernetes left the new worker pods on the other node. [Placement](#s-placement) has those runs.

## No autoscaler

Substrate v1.0.0 has no code that changes `spec.replicas` {{code}}. The WorkerPool has a `scale` subresource, so a HorizontalPodAutoscaler or your own controller can change the count. The controller publishes `ate.workerpool.desired_workers` and `ate.workerpool.ready_workers` for that purpose {{docs}}. We did not test an autoscaler.

Plan as if you have none. [Request parking](#s-request-parking) holds a request for 5 seconds. We did not measure how long a new worker pod takes to start and register. Do not plan for it to fit in that time. Size the pool for the peak of running actors, with room to spare.

## What others reported at scale

Our largest cluster had two worker nodes. Our largest actor count was 131 actors on one node, of which 75 ran at the end. The project site states `10×` the density of container runtimes. The documentation gives a benchmark method and no result, and we did not test density. These reports come from the issue tracker of Substrate. Their authors ran them, and we did not.

| Report | Conditions | Result |
|---|---|---|
| Issue 3479, pools without limits {{issue #3479}} | 320 workers, eight on each 8 vCPU node, no limits on the pool | every worker registered the whole node, so placement never refused an actor |
| Issue 3408, density on one node {{issue #3408}} | one node with 192 vCPUs and 503 GiB, gVisor, a development build | at 6,200 actors, 1,187 sandboxes died and all actors stayed RUNNING. With a newer gVisor build, 5,600 actors ran with no deaths, and at 6,000 the node ran out of memory |
| Issue 3702, Postgres under load {{issue #3702}} | 9,000 actors in create and delete cycles, 900 workers, v1.0.0-rc.1 | Postgres used 53 to 60 of 64 cores. The first command came 4 to 18 seconds after create. With 2,700 workers the wait went away |
| Issue 3101, disk after asynchronous suspends {{issue #3101}} | a 50 GB node disk, 10 suspends of 512 MB each | the kubelet evicted both worker pods and then `atelet`, and the node stayed under disk pressure for more than 34 minutes |

Read the table as four separate limits: missing limits, node memory, Postgres row locks, and node disk. Each one appeared before CPU ran out. The Postgres report adds one design hint. Many small workers behaved better than few large ones at that scale: about 3 actors on each worker, not 10.

## A procedure

1. Measure the peak memory of one actor, and set the template limit a little above it.
2. Set the CPU limit of the actor to 250 millicores or more.
3. Choose the actors for each worker. Set the worker limits to that count times the actor limits, plus 64 MiB.
4. Set `replicas` to the peak of running actors divided by that count, plus spare workers.
5. Size the node disk for 30 minutes of snapshots, and watch it.

```takeaways
- Compute running actors per worker from declared limits, never from real use.
- Count an actor with a dead process as running, until a suspend marks it crashed.
- Keep actor CPU limits at 250 millicores or more to protect resume time.
- Size node disk as suspends in 30 minutes times the snapshot size.
- Size the pool for the peak, because Substrate has no autoscaler.
- Watch node memory, node disk, and Postgres before you add CPU.
```

Sources: capture/lab/summary/microvm-x86.json, capture/lab/summary/validation-parallel-x86.json, capture/lab/summary/validation-memory-x86.json, capture/lab/summary/demos-x86.json, capture/lab/summary/cpu-limit-x86.json, capture/lab/Q-network/n-cpu-limit/40-work.tsv, capture/lab/V-validation/03-parallel-resume/11-workers-before-32.txt, capture/lab/V-validation/11-process-exit-long-watch/11-workers-end.txt, capture/lab/N-demos/tool-sandbox/tasks.tsv, capture/lab/L-gaps/multinode/52-placement-counts.txt, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/85-node-return.tsv, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/I-capacity/02-workers-when-full.txt, capture/lab/I-capacity/03-actors-when-full.txt, capture/lab/C-resume-vs-size/pool.yaml, capture/lab/C-resume-vs-size/tmpl-0.yaml, capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, capture/lab/summary/footprint-x86.json, capture/lab/summary/parking-x86.json, capture/lab/K-kagent/parallel/workers-during.txt, capture/lab/K-kagent/parallel/states-during.txt, capture/lab/K-kagent/parallel/timings.tsv, capture/lab/K-kagent/inventory/workers-end.txt, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/E-dependency-loss/00-setup.log, capture/lab/E-dependency-loss/22-actors-5min-later.txt; cmd/ateapi/internal/scheduling/scheduling.go, cmd/ateworker-gvisor/memory.go, cmd/ateworker-gvisor/main.go, api/infra/k8s/ate/v1/workerpool_types.go, cmd/atelet/main.go at v1.0.0; docs/reference/api-guide.md, docs/guides/observability.md, docs/guides/node-storage.md, docs/guides/benchmarking.md, site/layouts/_shortcodes/home.html at v1.0.0; issues https://github.com/agent-substrate/substrate/issues/3479, https://github.com/agent-substrate/substrate/issues/3408, https://github.com/agent-substrate/substrate/issues/3702, https://github.com/agent-substrate/substrate/issues/3101, https://github.com/agent-substrate/substrate/issues/3441, https://github.com/agent-substrate/substrate/issues/3431.
