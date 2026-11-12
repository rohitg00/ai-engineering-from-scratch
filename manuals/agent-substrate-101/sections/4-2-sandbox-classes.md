# Sandbox classes: gVisor and microVM

> A pool runs one sandbox class, and an actor stays on the class of its first snapshot for the rest of its life.

A security reviewer asks one question about your agent platform: is each agent in a container or in a virtual machine? With Substrate the honest answer is neither one, and the choice is yours. An actor runs in a gVisor sandbox or in a small virtual machine. The choice is a field of the WorkerPool, and it is hard to change later.

When you finish this section, you can choose a class for a pool and check that a node can run it. You can also name the behaviours that differ between the two classes.

Most measurements in this manual come from the `gvisor` class. On the x86 server guest we also ran one test actor on both classes, at 0, 200, and 500 MiB of memory. This section reports that comparison, and it names what stays untested.

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

On that guest the install needed no further step for `microvm`. The kind script had passed `/dev/kvm` to the node, and the installer had created the SandboxConfig.

So on a Mac under Docker Desktop you have the `gvisor` class only. On a cloud VM, the instance type must allow nested virtualization. Check the node type before you plan for `microvm`.

The installer prepares both classes by default. It creates one SandboxConfig for each class and loads the guest kernel and the other microVM files into the object store. Pass `--sandbox-classes=gvisor` to skip the microVM part {{docs}}.

## How the limits apply

The ActorTemplate declares one CPU limit and one memory limit for the actor. The two classes turn them into different things {{docs}}.

**CPU.** A gVisor actor with a limit of 500 or 1000 millicores sees 2 CPUs, and the node kernel slows it to its quota. A microVM actor with 500 millicores starts with 1 virtual CPU and gets half a CPU of node time. A program that sizes its thread pool from the CPU count behaves differently on each class.

**Memory.** On `gvisor` the limit is the memory that the sandbox can use. On `microvm` the limit is the RAM of the guest, and the virtual machine monitor needs more memory on top. The worker counts that overhead against its capacity, so the same pool holds fewer microVM actors than the limits alone suggest. In our run the overhead was 7.6 MiB for an actor with a limit of 456 MiB.

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

A microVM snapshot records different attributes. This is the same part of the record for the counter actor on a microVM pool.

```listing
title: the sandbox runtime in a microVM snapshot record
source: capture/lab/L-gaps/microvm/26-actor-suspended.yaml
lang: yaml
note: Lines from one entry of status.snapshots. The lines before fidelity and after the attributes are cut.
---
    fidelity: SNAPSHOT_FIDELITY_MEMORY
    generation: 5
    locality: kind-control-plane
    owner: SNAPSHOT_OWNER_ACTOR
    sandboxRuntime:
      sandboxClass: microvm
      version:
        attributes:
        - key: architecture
          value: amd64
        - key: cpu_model
          value: "23:49"
        - key: cpu_vendor
          value: AuthenticAMD
        - key: sandbox_bundle_hash
          value: sha256:1d40aaaf66896731f227d4cfe129ab724721b592ff89c73df603e8e2372a67b8
```

A gVisor snapshot names the CPU features as a bit string. A microVM snapshot names the CPU vendor and one CPU model. Three consequences follow from those records:

- **You cannot move an actor to the other class.** A template that selects pools of both classes still gives each actor one class, the class of its golden snapshot.
- **A memory snapshot is tied to more than the class.** It records the CPU architecture, the CPU features or the CPU model, and the exact sandbox build. A worker restores memory only when its runtime is compatible.
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

## The two classes, measured

We ran the test actor of [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor) on a microVM pool. The machine, the node, and the actor image were the ones behind the gVisor numbers. The actor holds a fixed amount of random memory.

```figure
id: fig-4-2b
kind: chart
title: resume time against memory held, for both sandbox classes
claim: At 0 MiB a microVM resume took 0.33 seconds against 0.22 for gVisor, and at 500 MiB it took 0.80 against 1.07.
caption: Each dot is one resume from the snapshot on the node, and each line joins the medians of one class. Violet is the microvm class, and the dashed grey line is the gvisor class. Measured on the x86 server guest. From capture/lab/summary/microvm-x86.json and capture/lab/summary/resume-x86.json.
```

| Memory held | Phase | `microvm` | `gvisor` |
|---|---|---|---|
| 0 MiB | first call of a new actor | 0.45 s | 0.23 s |
| 0 MiB | resume from the node | 0.33 s | 0.22 s |
| 0 MiB | suspend, asynchronous | 0.39 s | 0.34 s |
| 0 MiB | suspend, synchronous | 0.72 s | 0.40 s |
| 200 MiB | first call of a new actor | 0.79 s | 0.62 s |
| 200 MiB | resume from the node | 0.49 s | 0.47 s |
| 200 MiB | suspend, asynchronous | 0.80 s | 0.79 s |
| 200 MiB | suspend, synchronous | 1.89 s | 2.02 s |
| 500 MiB | first call of a new actor | 1.39 s | 5.76 s |
| 500 MiB | resume from the node | 0.80 s | 1.07 s |
| 500 MiB | suspend, asynchronous | 1.17 s | 1.17 s |
| 500 MiB | suspend, synchronous | 3.35 s | 3.59 s |

**We measured** both columns on the x86 server guest (24 vCPU, 47 GB, nested KVM), with one kind node and the Envoy dataplane. Each cell is a median. Each size had 5 first calls, 10 resumes, 10 asynchronous suspends, and 5 synchronous suspends. The first call and the resume are timed at the client, through `kubectl ate proxy`. All 90 requests of the microVM run returned 200. A request to a running actor took 0.065 seconds on `microvm` and 0.064 seconds on `gvisor`.

The table has four results:

- **A small actor pays a fixed cost on `microvm`.** At 0 MiB the resume was 0.10 seconds slower and the first call was 0.22 seconds slower. The restore starts a guest with its own kernel before the actor runs.
- **Memory costs less on `microvm`.** From 0 to 500 MiB, a resume grew by about 1 ms for each MiB on `microvm` and by about 2 ms on `gvisor`. The medians were 0.02 seconds apart at 200 MiB. Above that size `microvm` was the faster class.
- **A large new actor starts much faster on `microvm`.** At 500 MiB the five first calls took 1.26 to 2.96 seconds on `microvm` and 1.86 to 6.76 seconds on `gvisor`.
- **An asynchronous suspend costs the same.** The medians differ by 0.06 seconds or less at every size. A synchronous suspend of a small actor is slower on `microvm`, because its snapshot is larger.

### What one actor costs on the node

| Item | `microvm` | `gvisor` |
|---|---|---|
| Processes on the node for one actor | one `cloud-hypervisor` and two `virtiofsd` | one `runsc-sandbox` and one `runsc-gofer` |
| Resident memory with 200 MiB held | 280 MiB | 237 MiB and 11 MiB |
| Snapshot on the node, 0 MiB held | 58.6 MiB | 1.3 MiB |
| Snapshot on the node, 200 MiB held | 264.0 MiB | 201.9 MiB |
| Snapshot on the node, 500 MiB held | 569.7 MiB | 502.2 MiB |
| Files of a memory snapshot | `memory-ranges`, `state.json`, `config.json`, one tar archive for each container | `pages.img`, `checkpoint.img`, `pages_meta.img`, a `rootfs` directory |
| Memory booked on the worker | 463.6 MiB for a limit of 456 MiB | 250 MiB for a limit of 250 MiB |

**We measured** these values on the same x86 server guest, with one sample for each cell. Resident memory is the value that `ps` printed on the node. The snapshot size is the disk use of the snapshot directory of one actor. The gVisor booking is from the pool of the second x86 server guest.

A microVM snapshot holds the whole guest, with its kernel and its agent. It was 59 to 70 MiB larger than the memory that the actor held. Add that amount for each actor when you size the node disk and the bucket in [sizing a pool](#s-sizing-a-pool). The file `memory-ranges` is sparse. Its listed size is the RAM of the guest, and its disk use is what the guest touched.

### The clock inside the actor

The test actor reports the age of its process in every reply. The two classes count that age differently.

**We measured** three suspend and resume cycles of the 0 MiB actor on each class, on the same guest. One cycle took 1.6 to 1.8 seconds. On `microvm` the age grew by 1.8 or 1.9 seconds in each cycle: 28.4, 30.3, and 32.1 seconds. On `gvisor` it grew by 0.2 or 0.3 seconds in each cycle: 0.5, 0.8, and 1.0 seconds.

So a microVM actor sees the time that passed while it was suspended. A gVisor actor sees only the time that it ran. A timeout, a cache lifetime, or a token check inside the actor gives a different result on each class. We read the elapsed-time clock of the process only, and we did not compare the calendar time.

### What stays untested

All of these numbers come from one x86 machine with one CPU model. We did not run `microvm` in these cases:

- on arm64
- with the agentgateway dataplane
- with a resume from the object store
- with more than 500 MiB held
- on a pool whose nodes have different CPU models
- with the loss of a node

The reports from the issue tracker in the table above also stay reports. We ran none of them.

## Our position

Choose by the memory that your actors hold. With small actors, start with `gvisor`. It runs on every node, it resumed a small actor 0.10 seconds faster, and its snapshot is as large as the memory and no larger. It is also the class that kagent installs.

Choose `microvm` in three cases. A reviewer requires hardware virtualization between tenants. You need a limit for each container. Or your actors hold more than about 200 MiB. In the third case `microvm` resumed as fast or faster on our machine, and a new 500 MiB actor started four times faster. You pay with a node type that has KVM and with 59 to 70 MiB of extra snapshot for each actor.

Then test your own workload. The reports above say that the two classes differ in the cases that hurt: memory pressure and many small files.

Neither class makes the worker pod a boundary. Both worker types run as root with `SYS_ADMIN` and `NET_ADMIN`, and the threat model of Substrate rates the two classes as equal {{docs}}.

```takeaways
- Check for /dev/kvm on the node type before you plan a microvm pool.
- Start with gvisor for actors that hold less than about 200 MiB.
- Measure microvm for larger actors, where it resumed faster on our machine.
- Add 59 to 70 MiB for each microvm snapshot when you size disk and bucket.
- Keep one CPU type and one sandbox build in a pool to protect memory restores.
- Do not plan to move an actor between classes, because its snapshot pins the class.
- Test memory pressure and file-heavy work on microvm before you depend on it.
```

Sources: capture/lab/M-mac-arm64/10-kind-cluster.log, capture/lab/A-quickstart/10-kind-cluster.log, capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml, capture/lab/L-gaps/microvm/26-actor-suspended.yaml, capture/lab/L-gaps/microvm/40-microvm-local.tsv, capture/lab/L-gaps/microvm/49-summary.tsv, capture/lab/L-gaps/microvm/41-node-processes-v200-1.txt, capture/lab/L-gaps/microvm/50-gvisor-rss.txt, capture/lab/L-gaps/microvm/42-workers-v200-1.txt, capture/lab/L-gaps/multinode/71-workers.txt, capture/lab/L-gaps/multinode/32-tmpl-50.yaml, capture/lab/L-gaps/microvm/44-snapdir-v0-1.txt, capture/lab/L-gaps/microvm/44-snapdir-v200-1.txt, capture/lab/L-gaps/microvm/44-snapdir-v500-1.txt, capture/lab/L-gaps/microvm/23-node-processes-counter.txt, capture/lab/C-resume-vs-size/10-local.tsv, capture/lab/C-resume-vs-size/snapdir-b200-1.txt, capture/lab/summary/microvm-x86.json, capture/lab/summary/resume-x86.json, capture/lab/summary/suspend-x86.json, capture/lab/summary/footprint-x86.json, capture/lab/K-kagent/inventory/workerpools.yaml, capture/lab/K-kagent/inventory/worker-pod-spec.json; docs/reference/sandbox-classes.md, docs/reference/api-guide.md, docs/dev/microvm-local.md, docs/security/threat-model.md, cmd/ate-setup/commands.md at v1.0.0; cmd/atecontroller/internal/controllers/workerpool_apply.go, api/infra/k8s/ate/v1/sandboxconfig_types.go, cmd/ateapi/internal/scheduling/scheduling.go at v1.0.0; issues https://github.com/agent-substrate/substrate/issues/3226, https://github.com/agent-substrate/substrate/issues/3615, https://github.com/agent-substrate/substrate/issues/3720, https://github.com/agent-substrate/substrate/issues/3801, https://github.com/agent-substrate/substrate/issues/3153, https://github.com/agent-substrate/substrate/issues/3408.
