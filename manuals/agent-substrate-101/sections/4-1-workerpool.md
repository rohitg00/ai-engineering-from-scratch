# WorkerPool

> A WorkerPool is a set of worker pods that you size, and each pod reports a capacity taken from its own CPU and memory limits.

You create an actor, send it a request, and look for its pod. There is no pod with the name of the actor. The actor runs inside a worker pod that existed before the actor did, and that hosts other actors too. The WorkerPool is the object that made that pod.

When you finish this section, you can write a WorkerPool, read the output of `kubectl ate get workers`, and say where each capacity number comes from.

## Three CRDs, and no Actor among them

**WorkerPool:** a namespaced Kubernetes object that asks for a number of worker pods of one sandbox class.

Substrate adds three CRDs to your cluster, all in the group `ate.dev` at version `v1`. A WorkerPool is the only one you write often. A SandboxConfig names the sandbox binaries for a class, and the install creates a default for each class. A CSIDriverConfig belongs to a preview feature for external volumes.

```listing
title: the CRDs after the install
source: capture/lab/A-quickstart/60-state.log
lang: text
note: Three lines from the state dump that we took after the quickstart.
---
csidriverconfigs.ate.dev   Cluster      v1(storage)   2026-11-12T10:05:33Z
sandboxconfigs.ate.dev     Cluster      v1(storage)   2026-11-12T10:05:33Z
workerpools.ate.dev        Namespaced   v1(storage)   2026-11-12T10:05:33Z
```

Actors, ActorTemplates and atespaces are absent from that list. They are rows in Postgres that `ate-api-server` serves, so `kubectl get` cannot show them {{run}}. Use `kubectl` for the pool and `kubectl ate` for all that runs on the pool.

## The pool we used

This is the pool behind most measurements in this manual. It asks for two gVisor workers, each with 2 CPUs and 3 GiB.

```listing
title: a WorkerPool with two workers
source: capture/lab/C-resume-vs-size/pool.yaml
lang: yaml
note: The Namespace object above the pool is cut.
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: ballast
  namespace: lab-c
  labels:
    workload: ballast
spec:
  replicas: 2
  workerImage: localhost:5001/ateworker-gvisor@sha256:ad6957f41bccaa8bb5f3eb5b34b7812babb862f1a3187a11578c21a7d799491c
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits:
        cpu: "2"
        memory: 3Gi
      requests:
        cpu: 500m
        memory: 3Gi
```

Four fields carry the meaning {{code}}:

- `spec.replicas` is the number of worker pods. The pool has a `scale` subresource, so `kubectl scale` and an autoscaler can change it.
- `spec.workerImage` is the worker binary for the class. Use `ateworker-gvisor` for `gvisor` and `ateworker-microvm` for `microvm`.
- `spec.sandboxClasses` takes exactly one entry at v1.0.0, and you cannot change its `name` later. [Sandbox classes](#s-sandbox-classes) compares the two.
- `spec.template.resources.limits` is the capacity of each worker. It is the most important field in the object.

The label `workload: ballast` sits on the pool object, under `metadata.labels`. An ActorTemplate selects pools with `workerSelector.matchLabels`, and the match reads the labels of the pool object. Labels under `spec.template.labels` go to the Deployment and its pods, and they do not affect which actors the pool accepts {{code}}.

A selector is the only link between a template and a pool. The namespace of the pool and Kubernetes RBAC do not limit which templates can select it {{code}}. An actor can add its own `workerSelector`, which narrows the selector of the template and takes effect at the next resume. Put a label on each pool that only the intended templates use.

## From the pool to a registered worker

```figure
id: fig-4-1
kind: flow
title: from a WorkerPool to two registered workers
claim: A WorkerPool becomes a Deployment of worker pods, and each pod becomes a Worker record that reports the limits of the pod as capacity.
caption: Read left to right. Grey is Kubernetes, blue is the Substrate control plane, violet is the worker side. The numbers under each worker are one row of kubectl ate get workers. From capture/lab/C-resume-vs-size/pool.yaml and capture/lab/I-capacity/02-workers-when-full.txt.
```

Four steps separate your YAML from a worker that can take an actor {{code}}:

1. `ate-controller` reads the WorkerPool and writes a Deployment with the same replica count. Each pod has the label `ate.dev/worker-pool`.
2. `ate-controller` watches those pods and creates one Worker record for each in `ate-api-server`. The name of the record is the UID of the pod.
3. `atelet` on the node registers the worker and reports which sandbox runtimes it can run.
4. When the pod is Ready, the Worker moves to `WORKER_STATE_ACTIVE`. Only an active worker receives actors.

**Worker:** the record in `ate-api-server` for one worker pod, with its state, its capacity, and the resources that actors have booked on it.

A Worker has three states. `WORKER_STATE_UNAVAILABLE` means registered and not Ready. `WORKER_STATE_ACTIVE` means ready for actors. `WORKER_STATE_DRAINING` means the pod is terminating, and a worker never leaves that state.

A terminating worker pod is slow on purpose. The controller sets its termination grace period to 3,600 seconds, and the worker gives its actors up to 30 minutes to stop {{code}}. A rollout of a pool with running actors can take that long.

## What `kubectl ate get workers` shows

We ran the command when four actors with 1 CPU each were running on the pool.

```listing
title: both workers full
source: capture/lab/I-capacity/02-workers-when-full.txt
lang: text
---
NAME                                   POOL      STATE                 ACTORS   CPU(MILLICORES)   MEMORY         POD                              AGE
b17a6492-9643-42f1-bfdb-8bb88ee46772   ballast   WORKER_STATE_ACTIVE   2/1000   2000/2000         512Mi/3008Mi   lab-c/ballast-65cf95d875-bzgjd   114s
ee4ba8b4-dbfa-4555-a621-7cf7662c1091   ballast   WORKER_STATE_ACTIVE   2/1000   2000/2000         512Mi/3008Mi   lab-c/ballast-65cf95d875-f65dl   114s
```

Each of the three middle columns is a pair: booked, then capacity.

| Column | Capacity comes from | In our pool |
|---|---|---|
| `ACTORS` | the worker flag `--max-actors`, default 1000 | 2 of 1000 |
| `CPU(MILLICORES)` | the CPU limit of the worker container | 2000 of 2000 |
| `MEMORY` | the memory limit, less what the worker keeps for itself | 512Mi of 3008Mi |

The worker kept 64 MiB of its 3 GiB limit, so it reported 3008Mi. The demo pools with a 1 GiB limit reported 960Mi, the same 64 MiB less {{run}}.

The booked side is the sum of the limits that each running actor declares in its ActorTemplate. Each actor here declared 1000 millicores and 256 MiB. Two actors booked the whole CPU capacity and a sixth of the memory. The worker is full, and CPU is the reason.

`cpuMillicores` has two jobs. The worker books it for placement, and the worker also writes it into the sandbox as a CPU quota for each 100 ms period {{code}}. The documentation says that the node kernel slows the actor to that quota {{docs}}.

The quota is a hard cap. We tested it with a program that runs a fixed number of loop steps, about 5 seconds of work on one free core. It ran on 1 thread and on 4 threads, under four templates. We read the CPU time of the actor from its cgroup on the node, before and after each run.

**We measured** three runs for each row on a second x86 server guest (16 vCPU, 23 GB). The pool had one worker pod with a Kubernetes limit of 6 CPU.

| `cpuMillicores` | Threads | Wall time, s | Host cores used |
|---|---|---|---|
| 250 | 1 | 27.1 to 27.6 | 0.25 |
| 250 | 4 | 26.5 to 27.9 | 0.25 |
| 500 | 1 | 12.7 to 13.1 | 0.50 to 0.51 |
| 500 | 4 | 12.4 to 12.8 | 0.50 |
| 1000 | 1 | 4.9 to 5.4 | 1.01 |
| 1000 | 4 | 5.3 to 5.5 | 1.00 to 1.01 |
| 2000 | 1 | 4.1 to 4.5 | 1.12 |
| 2000 | 4 | 1.38 to 1.42 | 1.96 to 2.01 |

```figure
id: fig-4-1b
kind: chart
title: host cores an actor used at four CPU limits
claim: An actor used 0.25, 0.50, and 1.0 host cores at limits of 250, 500, and 1000 millicores, and it needed four threads to use 2.0 cores at 2000.
caption: Read the cores on the vertical axis against the limit of the template. The solid line is 1 thread and the dashed line is 4 threads, with one dot for each run. The thin dashed line is the limit itself. From capture/lab/summary/cpu-limit-x86.json.
```

The actor never used more host cores than its limit. Up to 1000 millicores, four threads did not get more CPU than one thread. The same work took 5.4 times longer at 250 millicores than at 1000. In one row the limit was not the bound: one thread at 2000 millicores used 1.12 cores, because one thread fills one core. Four threads used the whole limit there.

The cap is a cgroup for each actor, inside the cgroup of the worker pod. The worker pod had `cpu.max=600000 100000`, which is its Kubernetes limit of 6 CPU. Inside it we found one cgroup for each actor, named with the uid of the actor and the suffix `_sandbox`. Its `cpu.max` was the template limit, and the gVisor processes of the actor ran in it.

```listing
title: the CPU quota of four actors, as the node reports it
source: capture/lab/Q-network/n-cpu-limit/42-cgroup-after.txt
lang: text
note: The complete file, read after the runs. The columns are the limit in millicores, the quota and the period in microseconds, and the counters of the cgroup.
---
250 25000/100000 usage_usec 41467478 nr_periods 1672 nr_throttled 1649 throttled_usec 428931388 
500 50000/100000 usage_usec 38723256 nr_periods 793 nr_throttled 765 throttled_usec 157096786 
1000 100000/100000 usage_usec 31895780 nr_periods 345 nr_throttled 312 throttled_usec 30529410 
2000 200000/100000 usage_usec 23220151 nr_periods 204 nr_throttled 38 throttled_usec 854079 
```

Two facts about the inside of the sandbox follow, and both can mislead you.

- **The actor does not see its limit.** The program counted 2 CPUs at all four limits, and it could not read the cgroup files. A runtime that sizes a thread pool from the CPU count gets 2 at 250 millicores.
- **CPU time read inside a throttled sandbox is wrong.** At 250 millicores with 1 thread, the program reported 22 to 24 seconds of CPU time. The same run used 6.9 seconds on the host. Do not use `getrusage` or `/proc` inside an actor to measure CPU use. Read the cgroup on the node.

The second fact explains an earlier reading of ours. A demo command reported 2.0 seconds of CPU time in 2.38 seconds under 500 millicores, which looked like no cap. That CPU time came from inside the sandbox, so it does not count. [A tool sandbox](#s-a-tool-sandbox) has that run and the correction.

We tested one actor at a time. Memory limits, and CPU limits with several busy actors on one worker, come in the next edition. One row is not explained. Four threads at 2000 millicores used 2.8 seconds of host CPU, and 1 thread used 4.6 to 5.1 seconds for the same work.

A suspended actor books nothing. The command counts running actors only.

Two habits from `kubectl` do not carry over. The command has no `-A` flag, and it lists the workers of every namespace by default. It has four filters: `-n` for one Kubernetes namespace, `-l` for pool labels, `-a` for the workers that host actors of one atespace, and `--sandbox-class`.

## A pool without limits reports the whole node

kagent v1.0.0 installs a pool named `kagent-default` with no `resources` at all. We listed its worker on a guest with 16 vCPUs and 31 GiB.

```listing
title: the worker of a pool without limits
source: capture/lab/K-kagent/inventory/workers-end.txt
lang: text
---
NAME                                   POOL             STATE                 ACTORS   CPU(MILLICORES)   MEMORY         POD                                      AGE
6dfb9d1d-cce7-4e42-af53-799a4132fa5d   kagent-default   WORKER_STATE_ACTIVE   0/1000   0/16000           0/32797744Ki   kagent/kagent-default-679c58c6cb-pljdk   19m
```

The worker claims all 16 CPUs and all the memory of the node. The Substrate documentation says that a worker without limits reports zero and has no bound. Our run disagrees: the worker read the size of the node and reported that. A user reported the same on a larger cluster {{issue #3479}}.

The result is a capacity that nothing backs. The pod has no limit, so Kubernetes reserves nothing for it. A second pool on the same node would claim the same 16 CPUs again. The control plane, the dataplane and Postgres run on that node too. [kagent 1.0 on Substrate](#s-kagent-on-substrate) shows what that worker did under load.

Our position: always set `limits` on a pool, and set the memory request equal to the memory limit. Then the memory that the worker reports is memory that Kubernetes has reserved. Kubernetes reserves CPU only up to the CPU request. The example above requests 500 millicores and reports 2 CPUs. Set the CPU request equal to the limit when actors must get the CPU that they book. [Sizing a pool](#s-sizing-a-pool) turns that rule into numbers.

One more fact matters before you give a pool to a team. A worker pod runs as root with `SYS_ADMIN` and `NET_ADMIN`, and its seccomp profile is unconfined {{run}}. The sandbox inside the pod isolates the actor. The pod does not isolate the worker from the node, so run pools on nodes that you trust.

```takeaways
- Use kubectl for WorkerPools and kubectl ate for workers, actors, and templates.
- Put the selector label under metadata.labels of the pool, where templates match it.
- Set CPU and memory limits on every pool, with the memory request equal to the limit.
- Read each pair in kubectl ate get workers as booked, then capacity.
- Treat cpuMillicores as a hard cap for each actor, and set thread counts in the template yourself.
- Measure the CPU use of an actor from its cgroup on the node, never inside the sandbox.
- Expect a pool rollout to wait up to 30 minutes for running actors.
```

Sources: capture/lab/summary/demos-x86.json, capture/lab/N-demos/tool-sandbox/tasks.tsv, capture/lab/summary/cpu-limit-x86.json, capture/lab/Q-network/n-cpu-limit/40-work.tsv, capture/lab/Q-network/n-cpu-limit/42-cgroup-after.txt, capture/lab/Q-network/n-cpu-limit/22-cgroup-250.txt, capture/lab/Q-network/n-cpu-limit/41-info-250.json, capture/lab/Q-network/n-cpu-limit/03-worker-pod-resources.json, capture/lab/Q-network/n-cpu-limit/10-burn.tsv, capture/lab/A-quickstart/60-state.log, capture/lab/C-resume-vs-size/pool.yaml, capture/lab/C-resume-vs-size/tmpl-0.yaml, capture/lab/I-capacity/02-workers-when-full.txt, capture/lab/I-capacity/03-actors-when-full.txt, capture/lab/I-capacity/14-workers-full.txt, capture/lab/K-kagent/inventory/workers-end.txt, capture/lab/K-kagent/inventory/workerpools.yaml, capture/lab/K-kagent/inventory/worker-pod-spec.json; api/infra/k8s/ate/v1/workerpool_types.go, cmd/atecontroller/internal/controllers/workerpool_apply.go, cmd/atecontroller/internal/workersync/syncer.go, cmd/ateworker-gvisor/main.go, cmd/ateworker-gvisor/memory.go, api/ateapi/v1/ateapi.proto (Worker, WorkerStatus, WorkerState), cmd/kubectl-ate/internal/cmd/worker.go at v1.0.0; docs/reference/api-guide.md at v1.0.0; issue https://github.com/agent-substrate/substrate/issues/3479.
