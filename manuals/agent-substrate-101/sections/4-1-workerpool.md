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

**We measured** one command on a second x86 server guest (16 vCPU, 31 GB), with n=1. It used 2.0 seconds of CPU time and finished in 2.38 seconds under a value of 500 millicores. A quota of half a CPU predicts about 4 seconds. We did not find the cause, and the result is under test. Do not conclude from this one run that the value never slows an actor. [A tool sandbox](#s-a-tool-sandbox) shows that run.

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

Our position: always set `limits` on a pool, and set the memory request equal to the memory limit. Then the capacity that the worker reports is capacity that Kubernetes has reserved. [Sizing a pool](#s-sizing-a-pool) turns that rule into numbers.

One more fact matters before you give a pool to a team. A worker pod runs as root with `SYS_ADMIN` and `NET_ADMIN`, and its seccomp profile is unconfined {{run}}. The sandbox inside the pod isolates the actor. The pod does not isolate the worker from the node, so run pools on nodes that you trust.

```takeaways
- Use kubectl for WorkerPools and kubectl ate for workers, actors, and templates.
- Put the selector label under metadata.labels of the pool, where templates match it.
- Set CPU and memory limits on every pool, with the memory request equal to the limit.
- Read each pair in kubectl ate get workers as booked, then capacity.
- Expect a pool rollout to wait up to 30 minutes for running actors.
```

Sources: capture/lab/summary/demos-x86.json, capture/lab/N-demos/tool-sandbox/tasks.tsv, capture/lab/A-quickstart/60-state.log, capture/lab/C-resume-vs-size/pool.yaml, capture/lab/C-resume-vs-size/tmpl-0.yaml, capture/lab/I-capacity/02-workers-when-full.txt, capture/lab/I-capacity/03-actors-when-full.txt, capture/lab/I-capacity/14-workers-full.txt, capture/lab/K-kagent/inventory/workers-end.txt, capture/lab/K-kagent/inventory/workerpools.yaml, capture/lab/K-kagent/inventory/worker-pod-spec.json; api/infra/k8s/ate/v1/workerpool_types.go, cmd/atecontroller/internal/controllers/workerpool_apply.go, cmd/atecontroller/internal/workersync/syncer.go, cmd/ateworker-gvisor/main.go, cmd/ateworker-gvisor/memory.go, api/ateapi/v1/ateapi.proto (Worker, WorkerStatus, WorkerState), cmd/kubectl-ate/internal/cmd/worker.go at v1.0.0; docs/reference/api-guide.md at v1.0.0; issue https://github.com/agent-substrate/substrate/issues/3479.
