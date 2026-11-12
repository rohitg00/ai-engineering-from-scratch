# How this manual was made

> This page records the version, the machines, the lab method, and the capture kit behind every fact in the manual, and what we did not test.

## The version

The manual pins Agent Substrate v1.0.0, released on 2026-11-05 at commit `b34fbee742906494b5eb4f1f36987176bf8770a4`. The integration sections pin kagent v1.0.0 and agentgateway v1.7.0. Every cluster ran Kubernetes 1.37.0 on kind v0.33.0. We recorded the runs and verified the facts on 2026-11-12.

Agent Substrate changed its installer, its API names, and its states in the weeks before 1.0.0. A statement in this manual is about v1.0.0 only. [Section 8.4](#s-upgrade-and-stale-advice) lists what differs in older text.

## Four kinds of evidence

Each fact carries one of four labels, and [the sources page](#s-ref-sources) ranks them.

**We measured:** the number comes from one of our recorded runs. The paragraph names the machine and the number of samples. You can rerun the script and compare.

**The code:** the default or the mechanism comes from the source at the release tag. We read it and did not run it, unless the same paragraph says that we did.

**The documentation:** the statement comes from the project documentation at the tag. We use it for paths that we did not run, such as an upgrade, and the text says so.

**An issue:** a user or a maintainer reported the behaviour in the public tracker. We name the issue and do not present it as our result.

Our runs rank first. Where a run and the documentation disagree, the manual reports the run and names the disagreement. The clearest case is the idle actor. The quickstart says that Substrate suspends it, and our actor read RUNNING in 60 of 60 samples over 900 s.

## The two test beds

| Name in the manual | Machine | What ran on it |
|---|---|---|
| an x86 server guest (24 vCPU, 47 GB, nested KVM) | a KVM guest on a shared x86 server, Ubuntu 24.04, Docker 29.1.3, Go 1.27.3 | Agent Substrate built from source, the Envoy dataplane, gVisor: experiments A, B, C, D, I, and J |
| a second x86 server guest (16 vCPU, 23 GB) | a guest on the same server | Agent Substrate from the release images, Envoy and then agentgateway v1.7.0: experiments E, F, and G |
| an x86 server guest for kagent (16 vCPU, 31 GB) | a guest on the same server | kagent v1.0.0 with its own distribution of Substrate, and a mock model: experiment K |
| an Apple silicon laptop under Docker Desktop | 10 CPUs and 8 GB given to Docker | Agent Substrate from the release images, gVisor only: experiment M |

The server and the laptop are different machines. The laptop was two to three times faster on the same test. No section compares a number from one with a number from the other.

## The lab method

- **One guest for each track.** Each line of work had its own virtual machine, so that a destructive test in one could not change a number in another. Nothing was installed on the server itself.
- **Disks in memory.** Each guest kept its disk in the memory of the server. Disk writes were faster than on a cloud volume, so our suspend and upload times are lower limits for a real disk.
- **One node.** Every cluster had one kind node. Placement across nodes and the loss of one node among several are outside our results, except where [section 4.3](#s-placement) reports a run.
- **An object store in the cluster.** Snapshots went to rustfs on the same node and the same disk. A bucket across a network adds time to every upload and every resume from the bucket.
- **Two install paths.** We installed once from source, as the quickstart documents, and once from the release images. The two paths gave us the buildx failure and the install times of [section 2.1](#s-install-with-ate-setup).
- **A mock model for kagent.** A small server in the cluster answered each model call with a fixed reply. Turn times in [section 7.1](#s-kagent-on-substrate) therefore hold almost no model time. A real model adds its own seconds to each turn.
- **Client-side times.** Unless a section says otherwise, a time is what the client saw, through `kubectl ate proxy` or from a pod in the cluster. A warm call through the proxy took 0.058 to 0.068 s on the first guest, and that cost is inside every proxy number.
- **Small samples.** Most points have 5 or 10 samples, and some events were recorded once. Each paragraph gives its count. Treat a result from one run as an observation.

## The experiments

| Letter | Question | Main result |
|---|---|---|
| A | Does the source quickstart work as written? | Only after `docker-buildx` was installed. 266 s for the system step. |
| B | Does Substrate suspend an idle actor? What do suspend, resume, crash, and revert return? | It does not. Each operation is in [section 3.3](#s-suspendactor-and-resumeactor) and [section 3.5](#s-crashed-and-revertactor). |
| C | How does resume time grow with the memory that an actor holds? | About 2 ms for each MiB from the node, and about twice that from the bucket. |
| D | When is a snapshot safe? | After 5 minutes by default. Before that, losing the node copy crashes the actor on the next request. |
| E | Which requests fail when a dependency is away? | All of them without Postgres or `ate-api-server`. None without the Kubernetes API server. |
| F | What does an egress policy do on each dataplane? | Default deny, interception, pass-through, and injection work on both, with different error texts. |
| G | How do the two dataplanes differ? | agentgateway uses fewer containers and less memory, and it keeps the interception key in the dataplane container. |
| I | What does a client see when a pool is full? | A 503 after about 5 s, or a served request if a worker becomes free in that time. |
| J | Does Substrate notice a process that dies in a sandbox? | A memory kill in about 4 s. A clean exit never, until something calls suspend. |
| K | How does kagent 1.0 use Substrate? | One actor for each session, resumed and suspended on every turn, 98 of 98. |
| M | Does v1.0.0 work on Apple silicon? | Yes for gVisor actors up to 200 MiB. No KVM, so no microVM class. |

The letters H and L are not in the table. H was a single check that a plain `scratch` image works as an actor. Where later runs on the microVM class and on more nodes exist, the sections of Part 4 report them.

## The capture kit

[The capture kit](manuals/agent-substrate-101/capture) holds the recordings and one script. Agent Substrate needs a Kubernetes cluster, so the recordings cannot run in the repository CI. We made them on our machines and stored the output in [the lab folder](manuals/agent-substrate-101/capture/lab).

```bash
python3 capture/run.py
python3 capture/run.py --check
```

The first command reads the recordings and writes [the summary files](manuals/agent-substrate-101/capture/lab/summary), which are the only input of the chart figures. The second command builds the summaries again in a temporary folder and compares them with the stored ones. It needs no network and no keys. It prints one `skipped` line for the recordings, because it does not start a cluster.

A large log is stored as an excerpt, in which each line is a complete line of the original. A list in the lab folder names each file that was left out or cut, with the reason. The credential values in the egress recordings are test values that we made up.

## Record it again on your cluster

1. Create a kind cluster with the cluster script from the Agent Substrate checkout at v1.0.0.
2. Install with `ate-setup`, as [section 2.1](#s-install-with-ate-setup) shows.
3. Run the script of one experiment from [the scripts folder](manuals/agent-substrate-101/capture/lab/_scripts). Each script writes to a folder with the name of its experiment.
4. Copy the output over the same folder in the lab folder, then run `python3 capture/run.py`.

Your seconds will differ from ours. The states, the error texts, and the order of events must not. If one of them differs on v1.0.0, we want to know, because it means that a claim of this manual depends on our machines.

## What we measured, and what we read

| Subject | Measured in a run | Read in the code or the documentation only |
|---|---|---|
| Install | source build, release images, the switch to agentgateway, the kagent install, Apple silicon | GKE, the settings for large clusters |
| Lifecycle | create, resume, both suspend modes, revert, delete, crash by pod loss, node restart, memory kill, process exit | tags, a worker drain, the wakeup probe timeout |
| Snapshots | times and sizes for memory fidelity, the two timers, the files that a volumes snapshot keeps | root filesystem fidelity, restore across runtime versions |
| Capacity | a full pool, request parking, 8 and 24 parallel kagent turns | autoscaling, reservation below the limit |
| Network | default deny, the DNS relay, interception, pass-through, injection, a removed rule with an open connection | external egress processors, federation of actor JWTs |
| Identity | the ingress certificate check on both dataplanes, the shared identity warning | access policies, token files, key rotation |
| Dependencies | the loss of Postgres, of `ate-api-server`, and of the Kubernetes API server, on Envoy | the same on agentgateway, an external Postgres, a remote bucket |
| Upgrade | nothing | the order and the supported paths |

[Section 8.5](#s-limits-at-v1-0-0) holds the full list of what we did not test.

Sources: manual.json (pin, sources); capture/README.md, capture/run.py, capture/lab/REDACTIONS.txt, capture/lab/summary/install-steps.json, capture/lab/summary/resume-x86.json, capture/lab/summary/resume-mac.json, capture/lab/summary/failures-x86.json, capture/lab/summary/dependency-loss-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/A-quickstart/02-steps.tsv, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/G-dataplane/00-install/steps.tsv, capture/lab/M-mac-arm64/02-steps.tsv, capture/lab/K-kagent/install/steps.tsv; docs/get-started/quickstart.md at v1.0.0.
