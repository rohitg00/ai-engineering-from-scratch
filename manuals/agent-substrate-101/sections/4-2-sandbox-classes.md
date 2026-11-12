# Sandbox classes: gVisor and microVM

> A pool runs one sandbox class, and an actor stays on the class of its first snapshot for the rest of its life.

A security reviewer asks one question about your agent platform: is each agent in a container or in a virtual machine? With Substrate the honest answer is neither one, and the choice is yours. An actor runs in a gVisor sandbox or in a small virtual machine. The choice is a field of the WorkerPool, and it is hard to change later.

When you finish this section, you can choose a class for a pool and check that a node can run it. You can also name the behaviours that differ between the two classes.

Every measurement in this manual comes from the `gvisor` class. We have not yet finished a measured comparison of the two classes. This section describes `microvm` from the code and the documentation at v1.0.0, and it says so where a number is missing.

## Two classes, one field

**Sandbox class:** the kind of isolation that the workers of a pool give to each actor. The value is `gvisor` or `microvm`.

You set the class in `spec.sandboxClasses[0].name` of the [WorkerPool](#s-workerpool). The set is closed. The API accepts only those two names, and a plain Linux container is not an option {{code}}.

```figure
id: fig-4-2
kind: comparison
title: what sits between an actor and the node in each sandbox class
claim: A gVisor actor shares the node kernel through a user-space kernel, and a microVM actor runs on its own guest kernel under KVM.
caption: Read each column from the node at the bottom to the actor at the top. Violet is the worker side and green is the actor. The two lines under each column are differences that you meet in practice. From docs/reference/sandbox-classes.md at v1.0.0.
```

| Area | `gvisor` | `microvm` |
|---|---|---|
| Isolation | `runsc`, a kernel in user space | a KVM guest: Kata Containers on Cloud Hypervisor |
| Node needs | any Linux node | a node with `/dev/kvm` |
| CPUs that the actor sees | at least 2, whatever the limit | the limit, rounded up, at least 1 |
| Smallest memory limit | none | 128 MiB |
| Limits for each container | accepted and ignored | enforced in the guest |
| Files in a snapshot | `runsc` checkpoint bundles | tar archives |

## What the node must provide

A gVisor worker runs on any Linux node. That is why it runs on a laptop.

A microVM worker needs the device `/dev/kvm`. `atelet` offers the device to Kubernetes as the resource `ate.dev/kvm`, only on nodes that have it. The controller adds a request for that resource to every microVM worker pod {{code}}. So a microVM pool on a cluster without KVM does not fail loudly. Its pods stay Pending.

The script that creates the kind cluster tells you which case you are in. On the Apple silicon laptop under Docker Desktop it printed this:

```listing
title: the KVM probe on the laptop
source: capture/lab/M-mac-arm64/10-kind-cluster.log
lang: text
---
Probing for /dev/kvm in the Docker environment...
/dev/kvm not available: micro-VM support disabled (gVisor still works).
```

On the x86 server guest, which has nested KVM, the same script printed the other answer:

```listing
title: the KVM probe on the x86 server guest
source: capture/lab/A-quickstart/10-kind-cluster.log
lang: text
---
Probing for /dev/kvm in the Docker environment...
/dev/kvm found: micro-VM (kata + cloud-hypervisor) support will be enabled.
```

So on a Mac under Docker Desktop you have the `gvisor` class only. On a cloud VM, the instance type must allow nested virtualization. Check the node type before you plan for `microvm`.

The installer prepares both classes by default. It creates one SandboxConfig for each class and loads the guest kernel and the other microVM files into the object store. Pass `--sandbox-classes=gvisor` to skip the microVM part {{docs}}.

## How the limits apply

The ActorTemplate declares one CPU limit and one memory limit for the actor. The two classes turn them into different things {{docs}}.

**CPU.** A gVisor actor with a limit of 500 or 1000 millicores sees 2 CPUs, and the node kernel slows it to its quota. A microVM actor with 500 millicores starts with 1 virtual CPU and gets half a CPU of node time. A program that sizes its thread pool from the CPU count behaves differently on each class.

**Memory.** On `gvisor` the limit is the memory that the sandbox can use. On `microvm` the limit is the RAM of the guest, and the virtual machine monitor needs more memory on top. The worker counts that overhead against its capacity, so the same pool holds fewer microVM actors than the limits alone suggest.

**Containers.** An actor can have more than one container. On `gvisor` one Sentry process runs all of them, and a limit on one container has no effect. On `microvm` each container has its own cgroup in the guest. A container that passes its memory limit is killed alone, and the other containers of the actor continue.

That last behaviour has a cost that others reported. In issue 3615, a container in a microVM actor was killed for memory, and the actor stayed `ACTOR_STATE_RUNNING` with no log line {{issue #3615}}. [Actor and its seven states](#s-actor-states) shows the same silence for a process that exits on `gvisor`, which we did measure.

## A snapshot pins the class

The class is not only a property of the pool. The first snapshot of an actor records it, and every later restore of that actor needs a worker of the same class {{docs}}. This is the snapshot record of our counter actor after a synchronous suspend.

```listing
title: the sandbox runtime in a snapshot record
source: capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml
lang: yaml
note: Lines from one entry of status.snapshots. The lines before fidelity and after the attributes are cut.
---
    fidelity: SNAPSHOT_FIDELITY_MEMORY
    generation: 3
    locality: kind-control-plane
    owner: SNAPSHOT_OWNER_ACTOR
    sandboxRuntime:
      sandboxClass: gvisor
      version:
        attributes:
        - key: architecture
          value: amd64
        - key: cpu_features
          value: 8c0000002e500800008003f70000000f00400004219c01ab178bfbfffff83203
        - key: sandbox_bundle_hash
          value: sha256:88e9809119d7fa2204897a60f8bb155add102018b4b4947e7876c9bc447312fa
```

Three consequences follow from that record:

- **You cannot move an actor to the other class.** A template that selects pools of both classes still gives each actor one class, the class of its golden snapshot.
- **A memory snapshot is tied to more than the class.** It records the CPU architecture, the CPU features, and the exact sandbox build. A worker restores memory only when its runtime is compatible.
- **The result of a mismatch is a cold start.** When no compatible worker has room, Substrate takes a snapshot from the object store and restores only its files. It uses another worker of the same class. The processes start again, and the actor loses what it held in memory.

The third point is the one to plan for. A pool that mixes node types with different CPUs, or a rollout of a new sandbox build, can turn a resume into a cold start. [Placement](#s-placement) shows where that decision is made.

## What others reported about parity

The two classes do not behave the same at v1.0.0, and the project tracks the gaps in issue 3226 {{issue #3226}}. These reports come from the issue tracker. We ran none of them.

| Report | Class | What was seen |
|---|---|---|
| Issue 3615 {{issue #3615}} | `microvm` | a container killed for memory leaves the actor RUNNING, with no log |
| Issue 3720 {{issue #3720}} | `microvm` | file writes count against the memory limit, and an actor that wrote 2 GB was killed |
| Issue 3801 {{issue #3801}} | `microvm` | restore runs under the CPU limit of the actor, so a small limit slows the resume |
| Issue 3153 {{issue #3153}} | `microvm` | every small file operation crosses from the guest to the node, which slows work with many files |
| Issue 3408 {{issue #3408}} | `gvisor` | at about 6,000 actors on one node, sandboxes died while their actors stayed RUNNING |

## What we have not measured

Three numbers decide the cost of `microvm`, and we do not have them yet:

- the resume time of a microVM actor against the memory that it holds, next to the gVisor curve in [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor)
- the memory that one microVM actor books on a worker above its limit
- the size of a microVM snapshot on the node and in the object store

Until those exist, treat every resume time, capacity count, and disk size in this manual as a gVisor number.

## Our position

Start with `gvisor`. It runs on every node, it is the class behind every number here, and it is the class that kagent installs. Choose `microvm` when a reviewer requires hardware virtualization between tenants, or when you need a limit for each container. Then test your own workload on it. The reports above say that the two classes differ in the cases that hurt: memory pressure and many small files.

Neither class makes the worker pod a boundary. Both worker types run as root with `SYS_ADMIN` and `NET_ADMIN`, and the threat model of Substrate rates the two classes as equal {{docs}}.

```takeaways
- Check for /dev/kvm on the node type before you plan a microvm pool.
- Start with gvisor, and move to microvm only for a stated requirement.
- Keep one CPU type and one sandbox build in a pool to protect memory restores.
- Do not plan to move an actor between classes, because its snapshot pins the class.
- Test memory pressure and file-heavy work on microvm before you depend on it.
```

Sources: capture/lab/M-mac-arm64/10-kind-cluster.log, capture/lab/A-quickstart/10-kind-cluster.log, capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml, capture/lab/K-kagent/inventory/workerpools.yaml, capture/lab/K-kagent/inventory/worker-pod-spec.json; docs/reference/sandbox-classes.md, docs/reference/api-guide.md, docs/dev/microvm-local.md, docs/security/threat-model.md, cmd/ate-setup/commands.md at v1.0.0; cmd/atecontroller/internal/controllers/workerpool_apply.go, api/infra/k8s/ate/v1/sandboxconfig_types.go, cmd/ateapi/internal/scheduling/scheduling.go at v1.0.0; issues https://github.com/agent-substrate/substrate/issues/3226, https://github.com/agent-substrate/substrate/issues/3615, https://github.com/agent-substrate/substrate/issues/3720, https://github.com/agent-substrate/substrate/issues/3801, https://github.com/agent-substrate/substrate/issues/3153, https://github.com/agent-substrate/substrate/issues/3408.
