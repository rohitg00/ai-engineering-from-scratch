# How this manual was made

> This page records the version, the machines, the lab method, and the capture kit behind every fact in the manual, and what we did not test.

## The version

The manual pins Agent Substrate v1.0.0, released on 2026-11-05 at commit `b34fbee742906494b5eb4f1f36987176bf8770a4`. The integration sections pin kagent v1.0.0 and agentgateway v1.7.0. Every cluster ran Kubernetes 1.37.0 on kind v0.33.0. We recorded the runs and verified the facts on 2026-11-12.

Agent Substrate changed its installer, its API names, and its states in the weeks before 1.0.0. A statement in this manual is about v1.0.0 only. [Section 8.4](#s-upgrade-and-stale-advice) lists what differs in older text.

## Four kinds of evidence

Each fact carries one of four labels, and [the sources page](#s-ref-sources) ranks them.

**We measured:** the number comes from one of our recorded runs. The paragraph names the machine and the number of samples. You can rerun the script and compare.

**The code:** the default or the mechanism comes from the source at the release tag. We read it and did not run it, unless the same paragraph says that we did.

**The documentation:** the statement comes from the project documentation at the tag. We use it for paths that we did not run, such as an install on GKE, and the text says so.

**An issue:** a user or a maintainer reported the behaviour in the public tracker. We name the issue and do not present it as our result.

Our runs rank first. Where a run and the documentation disagree, the manual reports the run and names the disagreement. The clearest case is the idle actor. The quickstart says that Substrate suspends it, and our actor read RUNNING in 60 of 60 samples over 900 s.

## The four test beds

| Name in the manual | Machine | What ran on it |
|---|---|---|
| an x86 server guest (24 vCPU, 47 GB, nested KVM) | a KVM guest on a shared x86 server, Ubuntu 24.04, Docker 29.1.3, Go 1.27.3 | Agent Substrate built from source, the Envoy dataplane, gVisor: experiments A, B, C, D, I, J, and V. Also the microVM class and the second node restart of experiment L. Last, new kind clusters from the release images for experiment U |
| a second x86 server guest (16 vCPU, 23 GB) | a guest on the same server | Agent Substrate from the release images, Envoy and then agentgateway v1.7.0: experiments E, F, and G. Also a second cluster with three kind nodes for experiment L. Later, at the same time, experiment P on the cluster with three nodes and experiment Q on the cluster with one node. Last, experiment T on the cluster with three nodes |
| a second x86 server guest (16 vCPU, 31 GB) | a guest on the same server | Two clusters, one after the other. kagent v1.0.0 with its own distribution of Substrate, and a mock model: experiment K. Then a separate install of Agent Substrate from the release images, with the Envoy dataplane, for the four demos of Part 9: experiment N. Then Agent Executor at one commit on that second cluster: experiment R. Last, a small open model on CPU in a container on the guest, for kagent and for Agent Executor on the two clusters: experiment S. After a restart of the guest, the same two clusters and the same model: experiment W |
| an Apple silicon laptop under Docker Desktop | 10 CPUs and 8 GB given to Docker | Agent Substrate from the release images, gVisor only: experiment M |

The four are different machines. Two of them have 16 vCPU, so every measured paragraph gives the memory size too. A number from one machine is never a controlled comparison with a number from another.

Three sections show numbers from two machines side by side. [Section 2.1](#s-install-with-ate-setup) has the two installs. [Section 8.2](#s-when-a-dependency-is-down) and [section 9.4](#s-a-failure-drill) have the two Postgres recoveries. Each one names both machines and says that the difference is indicative only.

## The lab method

- **One guest for each track.** Each line of work had its own virtual machine, so that a destructive test in one could not change a number in another. Nothing was installed on the server itself.
- **Disks in memory.** Each guest kept its disk in the memory of the server. Disk writes were faster than on a cloud volume, so our suspend and upload times are lower limits for a real disk.
- **One node, with one exception.** Every cluster but one had one kind node. The exception had one control plane node and two worker nodes. It gave the placement and node loss results of [section 4.3](#s-placement) and the runbook of [section 8.2](#s-when-a-dependency-is-down).
- **Two experiments shared a guest.** Experiments P and Q ran at the same time on one guest, each on its own cluster. CPU was shared, so read a difference of a few milliseconds in those runs as noise.
- **An object store on the same machine.** Snapshots went to rustfs on the same node and the same disk. In experiment T the bucket ran outside the cluster, on the same guest, with an emulated delay. In experiment X it ran on a second guest of the same server. No bucket was in a cloud, and the path between the guests is not a real network link.
- **Two install paths.** We installed once from source, as the quickstart documents, and once from the release images, on two different guests. The two paths gave us the buildx failure and the install times of [section 2.1](#s-install-with-ate-setup).
- **A mock model, and then a small real one.** In experiment K a small server in the cluster answered each model call with a fixed reply. Those turn times in [section 7.1](#s-kagent-on-substrate) hold almost no model time. In experiment S the model was `qwen2.5`, an open model of 1 to 2 GB. It ran on 12 CPUs with no GPU, at 7 to 14 tokens per second. Both graphics cards of the server were in use by another team. A model on a GPU or a hosted model gives other model times.
- **Client-side times.** Unless a section says otherwise, a time is what the client saw, through `kubectl ate proxy` or from a pod in the cluster. A warm call through the proxy took 0.058 to 0.068 s on the first guest, and that cost is inside every proxy number.
- **Small samples.** Most points have 5 or 10 samples, and some events were recorded once. Each paragraph gives its count. Treat a result from one run as an observation.

## The experiments

| Letter | Question | Main result |
|---|---|---|
| A | Does the source quickstart work as written? | Only after `docker-buildx` was installed. 266 s for the system step. |
| B | Does Substrate suspend an idle actor? What do suspend, resume, crash, and revert return? | It does not. Each operation is in [section 3.3](#s-suspendactor-and-resumeactor) and [section 3.5](#s-crashed-and-revertactor). |
| C | How does resume time grow with the memory that an actor holds? | About 2 ms for each MiB of random bytes from the node, and about twice that from the bucket. |
| D | When is a snapshot safe? | When its durable copy shows `COMPLETED`, about 5 minutes after the suspend by default. The timer alone is not proof. Before that, losing the node copy crashes the actor on the next request. |
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
| S | What changes with a real model, and do five open statements about Agent Executor hold in a run? | With a small model on CPU, the model was about nine tenths of a kagent turn, and one turn of 50 did not end. The third table below has one row for each Agent Executor item. |
| T | What do a drain, a full node, and a bucket outside the cluster do to an actor? | A drain crashes a running actor and does not disturb a suspended one. The fourth table below has one row for each item. |
| U | Do an outside Postgres, an upgrade, and a larger count of actors work as the project says? | The install needed one fix, the upgrade crashed the running actor, and one node finished about 37 resumes each second. The fourth table below has the rows. |
| V | Do twelve statements that the first draft marked as not tested hold in a run? | The first table below has one row for each. |
| W | Can a kagent turn be bounded, and do four more open statements about Agent Executor hold in a run? | Two settings of the ModelConfig bound a turn. The fifth table below has one row for each item. |
| X | What do a bucket and a Postgres on another machine cost, and what happens when each is away? | A resume that passes 10 s returns 504 first, and a later request succeeds. One running actor stayed at 504 after a database outage until the router restarted. The fourth table below has the rows. |

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

Experiment S ran after P and Q, on the guest with 31 GB. It took the five things that [section 7.5](#s-agent-executor) listed as not run, and it replaced the mock model of experiment K with a real one.

| Item of S | Question | Result | Section |
|---|---|---|---|
| kagent | What does a turn cost with a real model? | 11 to 17 s at the median with a small model on CPU, of which resume and suspend were about 0.7 s. One turn of 50 did not end, and nothing bounded it before the client timeout at 300 s. | [7.1](#s-kagent-on-substrate) |
| model | Can a task call a model through a `Model` object? | No. No field of a task names a `Model`. With an `http` rule set on the actor, 20 of 20 calls returned 200. | [7.5](#s-agent-executor) |
| agent | Does the example agent image run? | Yes, in one run with one short prompt, without a vendor key. The task stayed `Running` after the agent ended. | [7.5](#s-agent-executor) |
| clone | Can a workspace clone? | Not through Agent Executor alone. With a `tlsPassthrough` rule on port 443 set on the actor, the clone worked in a resume of 9.57 s. An `https` rule failed on the certificate. | [7.5](#s-agent-executor) |
| loss | What happens when a worker goes away under a task? | The actor is `CRASHED` in about 1 s. `ax resume task` repaired it in 0.3 s. A file that a suspend had saved 8.7 s before the loss was gone. | [7.5](#s-agent-executor) |
| release | Does the release v0.3.1 run on Substrate v1.0.0? | No. It calls a gRPC service name that v1.0.0 does not serve. | [7.5](#s-agent-executor) |

Experiments T and U ran after S, at the same time on two guests. T ran on the cluster with two worker nodes on the second guest (16 vCPU, 23 GB). U ran on the first guest, on new kind clusters from the release images. They took six things that this page listed as not tested. Each case, each outage, and each upgrade step ran once.

| Item | Question | Result | Section |
|---|---|---|---|
| T, drain | What does `kubectl drain` do to an actor? | It crashed 2 of 2 running actors, and one `revert` repaired each. 3 of 3 suspended actors resumed on the other node with no command. | [8.2](#s-when-a-dependency-is-down) |
| T, full node | Does the runbook work when the other node has no free worker? | The revert and the tag rescue were accepted, and requests got 503 after 5 s until a worker was free. | [8.2](#s-when-a-dependency-is-down), [4.3](#s-placement) |
| T, bucket | What does a bucket outside the cluster cost, and what happens when it is away? | With no added delay, little. With 20 ms of round trip, a resume of 1,000 MiB took 10.2 s. With the bucket away, a synchronous suspend crashed a running actor. The bucket ran on the same guest, with an emulated delay. | [8.1](#s-postgres-and-the-object-store), [8.2](#s-when-a-dependency-is-down) |
| U, Postgres | Does an install work with a Postgres outside the cluster? | Yes, on the third try. The documented database script fails unless it runs in one transaction. An outage looked the same as with the bundled database. | [8.1](#s-postgres-and-the-object-store) |
| U, upgrade | What does a client see during an upgrade? | From v1.0.0-rc.3 to v1.0.0: 24 s of failed suspends and resumes in the `atelet` step, and a crashed running actor in the worker step. No older release has images. | [8.4](#s-upgrade-and-stale-advice) |
| U, scale | Do the scale statements of the project site hold on one node? | A single resume stayed at 0.36 s up to 10,750 actor rows. One node finished 36 to 39 resumes each second. The ramp stopped at the disk of the guest. | [4.5](#s-sizing-a-pool), [1.1](#s-what-substrate-does-and-what-it-leaves-to-you) |
| X, bucket | What does a bucket on another machine cost, with TLS, a rate limit, and delay? | With no shaping, 200 MiB resumed in 2.64 s and 1,000 MiB in 12.15 s. In 26 of 51 cycles the first answer was a 504 after 10 s, and a later request returned 200. At 20 Mbit/s, 200 MiB took 88 s. TLS needed a patch. | [8.1](#s-postgres-and-the-object-store), [4.4](#s-request-parking) |
| X, bucket outage | Does the bucket outage look the same with data in memory? | Yes. A synchronous suspend crashed the running actor and lost 2 calls, in 2 of 2 cases. A default suspend lost nothing. | [8.2](#s-when-a-dependency-is-down) |
| X, Postgres | Does an install work with Postgres on another machine, and what does an outage do? | Yes. 20 ms of round trip added about 0.5 s to a suspend and to a resume. After 1 of 2 outages, one running actor returned 504 until the router restarted. | [8.1](#s-postgres-and-the-object-store), [8.2](#s-when-a-dependency-is-down) |

The first attempt at two cases of T sent its requests to the wrong port, and we ran both again. One pass of the bucket outage has rows with a client error, and the summary leaves those rows out. The capture kit names each file that we did not use.

Experiment X ran after a restart of the guest with 23 GB, at the same time as W. The bucket and the database ran in containers on the guest with 31 GB. The two guests reach each other through the user-mode network of the hypervisor, at about 100 MiB each second. The first attempt at the bucket cycles sent a `revert` after a 504, and we ran the cycles again without it.

Experiment W ran last, on the guest with 31 GB, after a restart of that guest. It took four things that this page and [section 7.5](#s-agent-executor) listed as not run. The models were the same two small models on CPU.

| Item of W | Question | Result | Section |
|---|---|---|---|
| bound | Does a setting of kagent bound a turn? | Yes, two on the ModelConfig. With `maxTokens: 128` the turn completed with a cut answer, in 3 of 3 turns. With `timeout: 20` the turn failed after about 21 s and the actor was suspended, in 3 of 3. A client timeout alone left the actor `RUNNING` and the model busy for 10 minutes. | [7.1](#s-kagent-on-substrate) |
| open command | What happens to an open `ax ssh` command when the worker goes away? | It ended with an error within 0.2 s, in 2 of 2 runs, and nothing sent it again. `ax resume task` repaired the task. | [7.5](#s-agent-executor) |
| skills, MCP | What reaches the agent from the skills and MCP fields of a workspace? | An empty skills directory. Two of four MCP servers, as a flag of the agent command. The agent reached an HTTP MCP server in 3 of 3 tasks, with an egress rule that we set on the actor. | [7.5](#s-agent-executor) |
| example | Does the documented example run with its own prompt and repository? | Yes, after two fixes: a smaller memory limit, and a delete, because a task cannot be changed. The 3b model then wrote a report that was false. | [7.5](#s-agent-executor) |
| second runs | Do two results of S with one run repeat? | The clone did, in 5.47 s. The agent image did not write its file in the second run, so 1 of 2 runs did. | [7.5](#s-agent-executor) |

In W, the first two tries at the worker loss stopped before the delete, because the task was not on the pool of the test. We ran both again. The first try at the example stopped at a failed resume that we did not explain. The capture kit names each file that we left out.

## The capture kit

[The capture kit](manuals/agent-substrate-101/capture) holds the recordings and one script. Agent Substrate needs a Kubernetes cluster, so the recordings cannot run in the repository CI. We made them on our machines and stored the output in [the lab folder](manuals/agent-substrate-101/capture/lab).

```bash
cd manuals/agent-substrate-101
python3 capture/run.py
python3 capture/run.py --check
```

The first command reads the recordings and writes [the summary files](manuals/agent-substrate-101/capture/lab/summary), which are the only input of the chart figures. The second command builds the summaries again in a temporary folder and compares them with the stored ones. It needs no network and no keys. It prints one `skipped` line for the recordings, because it does not start a cluster.

A large log is stored as an excerpt, in which each line is a complete line of the original. A list in the lab folder names each file that was left out or cut, with the reason. The credential values in the egress and network recordings are test values that we made up.

## Record it again on your cluster

1. Create a kind cluster with the cluster script from the Agent Substrate checkout at v1.0.0.
2. Install with `ate-setup`, as [section 2.1](#s-install-with-ate-setup) shows.
3. Run the script of one experiment from [the scripts folder](manuals/agent-substrate-101/capture/lab/_scripts). Each script writes to a folder with the name of its experiment.
4. Copy the output over the same folder in the lab folder, then run `python3 capture/run.py` from `manuals/agent-substrate-101/`.

Your seconds will differ from ours. The states, the error texts, and the order of events must not. If one of them differs on v1.0.0, we want to know, because it means that a claim of this manual depends on our machines.

## What we measured, and what we read

| Subject | Measured in a run | Read in the code or the documentation only |
|---|---|---|
| Install | source build, release images, the switch to agentgateway, the kagent install, Apple silicon | GKE, the settings for large clusters |
| Lifecycle | create, resume, both suspend modes, a suspend during a request, revert, delete, crash by pod loss, node restart, the loss of one worker node of two in 17 cases, a revert and a second revert during and after that loss, a rescue from a tag, a node loss with the other node full, a drain of one worker node in five cases, memory kill, process exit with a watch of 20 minutes, an actor created before its golden snapshot, a move to another template | a drain with a PodDisruptionBudget, the wakeup probe timeout, a change of the scope of a tag |
| Snapshots | times and sizes for all three fidelities on gVisor and for memory fidelity on the microVM class, memory of zero, half random, and random bytes, a Python runtime, the two timers | restore across runtime versions |
| Capacity | a full pool, request parking, 1 to 16 resumes at the same instant, a burst of 32, bursts of 10 to 150 resumes on one node with 200 workers, a single resume with 1,750 to 10,750 actor rows, a pool in another namespace, placement of 20 actors on two worker nodes, 8 and 24 parallel kagent turns | autoscaling, reservation below the limit |
| Network | default deny, the DNS relay, interception, pass-through, injection, a removed rule with an open and with a reused connection, a suspend as a cut-off, a changed Secret, a private upstream CA, a model gateway behind an `https` rule, the log level of the agentgateway egress gateway, every port of the router | external egress processors, an MCP gateway |
| Identity | the ingress certificate check on both dataplanes, the shared identity warning, a token file, access policies with three roles, the header and the claims of an actor JWT | the signature check of an actor JWT, key rotation, federation of actor JWTs |
| Preview features | the two switches for `GoldenEgressPolicy` on `ate-api-server` | the other two features, the flag on every component |
| Dependencies | the loss of Postgres, of `ate-api-server`, and of the Kubernetes API server, on Envoy and on agentgateway. Also a Postgres outside the cluster and its loss, and a bucket outside the cluster with 20 and 100 ms of added round trip and its loss, all on the same guest. Also a bucket and a Postgres on a second guest of the same server, with TLS, a rate limit, added delay, and the loss of each | a cloud bucket, a managed Postgres, a real link with 100 ms of delay |
| Upgrade | one upgrade from v1.0.0-rc.3 to v1.0.0 on one node, and a second roll of the worker pool | an upgrade from an older release, a rollback, the supported paths |

[Section 8.5](#s-limits-at-v1-0-0) holds the full list of what we did not test.

Sources: capture/lab/summary/node-drain-x86.json, capture/lab/summary/full-node-x86.json, capture/lab/summary/object-store-x86.json, capture/lab/summary/external-postgres-x86.json, capture/lab/summary/upgrade-x86.json, capture/lab/summary/scale-x86.json, manual.json (pin, sources); capture/lab/summary/node-loss-x86.json, capture/lab/summary/network-x86.json, capture/lab/summary/rotation-x86.json, capture/lab/summary/cpu-limit-x86.json, capture/lab/summary/dependency-loss-agw-x86.json, capture/lab/Q-network/n-cpu-limit/10-burn.tsv, capture/lab/P-node-loss/96-golden-tag-deleted.txt, capture/lab/summary/microvm-x86.json, capture/lab/L-gaps/microvm/49-summary.tsv, capture/lab/L-gaps/multinode/52-placement-counts.txt, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/summary/kagent-model-x86.json, capture/lab/summary/agent-executor-followups-x86.json, capture/README.md, capture/run.py, capture/lab/REDACTIONS.txt, capture/lab/summary/install-steps.json, capture/lab/summary/resume-x86.json, capture/lab/summary/resume-mac.json, capture/lab/summary/failures-x86.json, capture/lab/summary/dependency-loss-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/A-quickstart/02-steps.tsv, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/G-dataplane/00-install/steps.tsv, capture/lab/M-mac-arm64/02-steps.tsv, capture/lab/K-kagent/install/steps.tsv, capture/lab/summary/validation-memory-x86.json, capture/lab/summary/validation-parallel-x86.json, capture/lab/summary/validation-fidelity-x86.json, capture/lab/V-validation/00-setup/pool.yaml, capture/lab/V-validation/03-parallel-resume/24-summary.tsv, capture/lab/V-validation/05-golden-race/10-race.tsv, capture/lab/V-validation/06-template-move/10-move.tsv, capture/lab/V-validation/07-cross-namespace-pool/10-cross.tsv, capture/lab/V-validation/08-access-control/10-access.tsv, capture/lab/V-validation/09-actor-jwt/24-jwt-decoded.txt, capture/lab/V-validation/10-preview-feature/10-preview.tsv, capture/lab/V-validation/11-process-exit-long-watch/10-watch.tsv, capture/lab/V-validation/12-suspend-during-request/10-inflight.tsv; docs/get-started/quickstart.md at v1.0.0., capture/lab/summary/remote-store-x86.json, capture/lab/summary/remote-postgres-x86.json
