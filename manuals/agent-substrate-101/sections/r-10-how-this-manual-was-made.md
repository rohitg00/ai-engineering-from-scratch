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

## The four test beds

| Name in the manual | Machine | What ran on it |
|---|---|---|
| an x86 server guest (24 vCPU, 47 GB, nested KVM) | a KVM guest on a shared x86 server, Ubuntu 24.04, Docker 29.1.3, Go 1.27.3 | Agent Substrate built from source, the Envoy dataplane, gVisor: experiments A, B, C, D, I, J, and V. Also the microVM class and the second node restart of experiment L |
| a second x86 server guest (16 vCPU, 23 GB) | a guest on the same server | Agent Substrate from the release images, Envoy and then agentgateway v1.7.0: experiments E, F, and G. Also a second cluster with three kind nodes for experiment L. Later, at the same time, experiment P on the cluster with three nodes and experiment Q on the cluster with one node |
| a second x86 server guest (16 vCPU, 31 GB) | a guest on the same server | Two clusters, one after the other. kagent v1.0.0 with its own distribution of Substrate, and a mock model: experiment K. Then a separate install of Agent Substrate from the release images, with the Envoy dataplane, for the four demos of Part 9: experiment N. Then Agent Executor at one commit on that second cluster: experiment R |
| an Apple silicon laptop under Docker Desktop | 10 CPUs and 8 GB given to Docker | Agent Substrate from the release images, gVisor only: experiment M |

The four are different machines. Two of them have 16 vCPU, so every measured paragraph gives the memory size too. A number from one machine is never a controlled comparison with a number from another.

Three sections show numbers from two machines side by side. [Section 2.1](#s-install-with-ate-setup) has the two installs. [Section 8.2](#s-when-a-dependency-is-down) and [section 9.4](#s-a-failure-drill) have the two Postgres recoveries. Each one names both machines and says that the difference is indicative only.

## The lab method

- **One guest for each track.** Each line of work had its own virtual machine, so that a destructive test in one could not change a number in another. Nothing was installed on the server itself.
- **Disks in memory.** Each guest kept its disk in the memory of the server. Disk writes were faster than on a cloud volume, so our suspend and upload times are lower limits for a real disk.
- **One node, with one exception.** Every cluster but one had one kind node. The exception had one control plane node and two worker nodes. It gave the placement and node loss results of [section 4.3](#s-placement) and the runbook of [section 8.2](#s-when-a-dependency-is-down).
- **Two experiments shared a guest.** Experiments P and Q ran at the same time on one guest, each on its own cluster. CPU was shared, so read a difference of a few milliseconds in those runs as noise.
- **An object store in the cluster.** Snapshots went to rustfs on the same node and the same disk. A bucket across a network adds time to every upload and every resume from the bucket.
- **Two install paths.** We installed once from source, as the quickstart documents, and once from the release images, on two different guests. The two paths gave us the buildx failure and the install times of [section 2.1](#s-install-with-ate-setup).
- **A mock model for kagent.** A small server in the cluster answered each model call with a fixed reply. Turn times in [section 7.1](#s-kagent-on-substrate) therefore hold almost no model time. A real model adds its own seconds to each turn.
- **Client-side times.** Unless a section says otherwise, a time is what the client saw, through `kubectl ate proxy` or from a pod in the cluster. A warm call through the proxy took 0.058 to 0.068 s on the first guest, and that cost is inside every proxy number.
- **Small samples.** Most points have 5 or 10 samples, and some events were recorded once. Each paragraph gives its count. Treat a result from one run as an observation.

## The experiments

| Letter | Question | Main result |
|---|---|---|
| A | Does the source quickstart work as written? | Only after `docker-buildx` was installed. 266 s for the system step. |
| B | Does Substrate suspend an idle actor? What do suspend, resume, crash, and revert return? | It does not. Each operation is in [section 3.3](#s-suspendactor-and-resumeactor) and [section 3.5](#s-crashed-and-revertactor). |
| C | How does resume time grow with the memory that an actor holds? | About 2 ms for each MiB of random bytes from the node, and about twice that from the bucket. |
| D | When is a snapshot safe? | After 5 minutes by default. Before that, losing the node copy crashes the actor on the next request. |
| E | Which requests fail when a dependency is away? | All of them without Postgres or `ate-api-server`. None without the Kubernetes API server. |
| F | What does an egress policy do on each dataplane? | Default deny, interception, pass-through, and injection work on both, with different error texts. |
| G | How do the two dataplanes differ? | agentgateway uses fewer containers and less memory, and it keeps the interception key in the dataplane container. |
| I | What does a client see when a pool is full? | A 503 after about 5 s, or a served request if a worker becomes free in that time. |
| J | Does Substrate notice a process that dies in a sandbox? | A memory kill in about 4 s. A clean exit never, until something calls suspend. |
| K | How does kagent 1.0 use Substrate? | One actor for each session, resumed and suspended on every turn, 98 of 98. |
| L | How does the microVM class compare with gVisor? What happens on two worker nodes when one stops? How do workers recover after a node restart? | A microVM resume cost about 1 ms for each MiB, against about 2 ms. No actor left a stopped node by itself. After a restart, resumes failed for 10 to 30 s after the control plane returned. |
| M | Does v1.0.0 work on Apple silicon? | Yes for gVisor actors up to 200 MiB. No KVM, so no microVM class. |
| N | Do the patterns of Part 9 work on a new install from the release images? | Four demos ran: an idle suspender, a stateful agent, a tool sandbox, and a failure drill. Sections 9.1 to 9.4 report them. |
| P | What can an operator do when a worker node stops and stays down? | No actor left the node by itself, in 13 cases. A `revert` helped in one situation, and it left the actor in REVERTING in the others. A tag from before the stop gave a working actor in 1.2 s. The runbook is in [section 8.2](#s-when-a-dependency-is-down). |
| Q | Do eight open statements about the network and the CPU limit hold in a run? | The second table below has one row for each. |
| R | Does Agent Executor work on Substrate v1.0.0 as its pages say? | One commit installed and ran tasks with no model. A task stayed RUNNING for 600 s with no request. A task cannot bind a gateway yet, so a workspace clone failed. [Section 7.5](#s-agent-executor) reports it. |
| V | Do twelve statements that the first draft marked as not tested hold in a run? | The first table below has one row for each. |

The letters H and O are not in the table. H was a single check that a plain `scratch` image works as an actor, and we did not use the letter O. Experiment L closed three gaps of the earlier runs, and the sections of Part 4 report it.

Experiment V ran last, on the first guest, with a pool of two workers that hold 16 one-CPU actors. It took twelve sentences of the draft that said we did not test something, and it tested each one.

| Item of V | Question | Result | Section |
|---|---|---|---|
| 1 | Does a snapshot shrink when the memory holds no data? | Yes. 500 MiB of zero bytes gave a 4.6 MiB snapshot and a 0.23 s resume. Size and resume time follow the memory that holds data. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives), [3.3](#s-suspendactor-and-resumeactor) |
| 2 | Does the resume rule hold for an ordinary runtime? | A Python server with a peak of 245 MiB resumed in 0.41 s. Its golden snapshot took 39.3 s to build. | [3.3](#s-suspendactor-and-resumeactor), [3.1](#s-actortemplate-and-the-golden-snapshot) |
| 3 | What do resumes at the same instant cost? | 0.37 s each at 16 at once, against 0.23 s alone, 155 of 155 served. A burst of 32 on 14 free places: 14 served, 18 refused after 5.1 s. | [4.4](#s-request-parking), [4.5](#s-sizing-a-pool) |
| 4 | What does each of the three fidelities keep? | The root filesystem level keeps files and starts new processes. Both lower levels resume as a cold start. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| 5 | What happens to an actor created before the golden snapshot exists? | It has no snapshot, its first call is a cold start, and it never adopts the golden snapshot. | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| 6 | Can an actor move to another template? | Only when suspended. The volumes continue, and the memory and the root filesystem start new. | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| 7 | Can a template use a pool in another namespace? | Yes. A selector that matches no pool is accepted and looks like a full pool. | [3.6](#s-atespaces) |
| 8 | Do access policies and token files work as documented? | Yes. Each role was refused where the documentation says, and a change took effect within 2 s. | [5.1](#s-client-authentication), [5.2](#s-access-policies) |
| 9 | What is in an actor JWT? | The documented claims, signed with ES256. The gateway used one token for several requests and across a suspend. | [5.3](#s-actor-jwts) |
| 10 | What does a preview feature need? | The server flag and the client flag. With either one missing, the error names the field only. | [8.5](#s-limits-at-v1-0-0), [R.5](#s-ref-flags-and-gates) |
| 11 | Does Substrate ever find a process that exited? | Not in 20 minutes. The dead actor kept its CPU booking until a suspend marked it crashed. | [3.5](#s-crashed-and-revertactor) |
| 12 | Does a suspend wait for an open request? | No. The request got a 503 after 2.2 s, and the suspend reported success. | [3.3](#s-suspendactor-and-resumeactor) |

The first run of item 3 used wrong port numbers for 1 to 8 resumes, and we discarded it. The table of [section 4.4](#s-request-parking) is the second run. The bursts of 32 are from the first run. The first try of item 9 failed because the actor asked for the host name before the policy existed, and [section 5.3](#s-actor-jwts) reports it.

Experiments P and Q ran after V, on the second guest (16 vCPU, 23 GB). Each node-stop case of P ran once. Q took eight statements that the draft had from the code only, or that it marked as not tested. It ran each one on both dataplanes where the dataplane matters.

| Item of Q | Question | Result | Section |
|---|---|---|---|
| g | Do the three dependency outages give the same result on agentgateway? | Yes. Every failure body is `ingress failed`, and a running actor answered again 21 s after Postgres was ready, against 3 s on Envoy. | [8.2](#s-when-a-dependency-is-down) |
| h | Does a reused connection keep a removed rule alive? | No. The next request got 403, about 1 s later on agentgateway and 5 to 9 s later on Envoy. | [6.6](#s-the-dataplane-choice) |
| i | Does a model gateway work behind an egress rule, over TLS? | Yes, and the gateway selects the model. A private CA failed until we replaced the root file of the egress container. A new intercepted connection cost about 0.6 s. | [7.2](#s-agentgateway), [6.4](#s-tls-interception) |
| j | Does a lower log level remove header values from the agentgateway egress log? | Yes. `RUST_LOG=info` gave 100 lines for 100 requests and no header value. The installer sets `debug` again. | [6.6](#s-the-dataplane-choice) |
| k | Does a suspend cut an open connection? | Yes, in 1.3 to 2.2 s, and the connection does not come back after a resume. | [6.6](#s-the-dataplane-choice) |
| l | How soon does a changed Secret reach the upstream? | After 1.0 to 1.6 s on Envoy, and after 100.6 to 280.5 s on agentgateway. No request failed. | [6.5](#s-credential-injection) |
| m | Which ports does the router have on each dataplane? | 443 and 8444 need a client certificate on both. agentgateway also has a stats port that needs no credentials, and two Service ports with no listener. | [6.1](#s-the-router-and-ingress) |
| n | Is the CPU limit of an actor a cap? | Yes, a hard cap from a cgroup for each actor. The actor sees 2 CPUs at every limit, and CPU time read inside it is wrong under the cap. | [4.1](#s-workerpool) |

The first test of item n stopped each run when the CPU time inside the sandbox reached 10 s. That CPU time is not valid under a cap. We kept the file as the record of the mistake, and we ran the test again with a fixed amount of work. The clean-up of experiment P deleted the golden tags of two templates, and [section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) reports what that broke.

## The capture kit

[The capture kit](manuals/agent-substrate-101/capture) holds the recordings and one script. Agent Substrate needs a Kubernetes cluster, so the recordings cannot run in the repository CI. We made them on our machines and stored the output in [the lab folder](manuals/agent-substrate-101/capture/lab).

```bash
python3 capture/run.py
python3 capture/run.py --check
```

The first command reads the recordings and writes [the summary files](manuals/agent-substrate-101/capture/lab/summary), which are the only input of the chart figures. The second command builds the summaries again in a temporary folder and compares them with the stored ones. It needs no network and no keys. It prints one `skipped` line for the recordings, because it does not start a cluster.

A large log is stored as an excerpt, in which each line is a complete line of the original. A list in the lab folder names each file that was left out or cut, with the reason. The credential values in the egress and network recordings are test values that we made up.

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
| Lifecycle | create, resume, both suspend modes, a suspend during a request, revert, delete, crash by pod loss, node restart, the loss of one worker node of two in 17 cases, a revert and a second revert during and after that loss, a rescue from a tag, memory kill, process exit with a watch of 20 minutes, an actor created before its golden snapshot, a move to another template | a worker drain, the wakeup probe timeout, a change of the scope of a tag |
| Snapshots | times and sizes for all three fidelities on gVisor and for memory fidelity on the microVM class, memory of zero, half random, and random bytes, a Python runtime, the two timers | restore across runtime versions |
| Capacity | a full pool, request parking, 1 to 16 resumes at the same instant, a burst of 32, a pool in another namespace, placement of 20 actors on two worker nodes, 8 and 24 parallel kagent turns | autoscaling, reservation below the limit |
| Network | default deny, the DNS relay, interception, pass-through, injection, a removed rule with an open and with a reused connection, a suspend as a cut-off, a changed Secret, a private upstream CA, a model gateway behind an `https` rule, the log level of the agentgateway egress gateway, every port of the router | external egress processors, an MCP gateway |
| Identity | the ingress certificate check on both dataplanes, the shared identity warning, a token file, access policies with three roles, the header and the claims of an actor JWT | the signature check of an actor JWT, key rotation, federation of actor JWTs |
| Preview features | the two switches for `GoldenEgressPolicy` on `ate-api-server` | the other two features, the flag on every component |
| Dependencies | the loss of Postgres, of `ate-api-server`, and of the Kubernetes API server, on Envoy and on agentgateway | an external Postgres, a remote bucket |
| Upgrade | nothing | the order and the supported paths |

[Section 8.5](#s-limits-at-v1-0-0) holds the full list of what we did not test.

Sources: manual.json (pin, sources); capture/lab/summary/node-loss-x86.json, capture/lab/summary/network-x86.json, capture/lab/summary/rotation-x86.json, capture/lab/summary/cpu-limit-x86.json, capture/lab/summary/dependency-loss-agw-x86.json, capture/lab/Q-network/n-cpu-limit/10-burn.tsv, capture/lab/P-node-loss/96-golden-tag-deleted.txt, capture/lab/summary/microvm-x86.json, capture/lab/L-gaps/microvm/49-summary.tsv, capture/lab/L-gaps/multinode/52-placement-counts.txt, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/restart/10-poll.tsv, capture/README.md, capture/run.py, capture/lab/REDACTIONS.txt, capture/lab/summary/install-steps.json, capture/lab/summary/resume-x86.json, capture/lab/summary/resume-mac.json, capture/lab/summary/failures-x86.json, capture/lab/summary/dependency-loss-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/A-quickstart/02-steps.tsv, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/G-dataplane/00-install/steps.tsv, capture/lab/M-mac-arm64/02-steps.tsv, capture/lab/K-kagent/install/steps.tsv, capture/lab/summary/validation-memory-x86.json, capture/lab/summary/validation-parallel-x86.json, capture/lab/summary/validation-fidelity-x86.json, capture/lab/V-validation/00-setup/pool.yaml, capture/lab/V-validation/03-parallel-resume/24-summary.tsv, capture/lab/V-validation/05-golden-race/10-race.tsv, capture/lab/V-validation/06-template-move/10-move.tsv, capture/lab/V-validation/07-cross-namespace-pool/10-cross.tsv, capture/lab/V-validation/08-access-control/10-access.tsv, capture/lab/V-validation/09-actor-jwt/24-jwt-decoded.txt, capture/lab/V-validation/10-preview-feature/10-preview.tsv, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/V-validation/12-suspend-during-request/10-inflight.tsv; docs/get-started/quickstart.md at v1.0.0.
