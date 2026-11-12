# When to choose Substrate

> Choose Substrate when many CPU-only agents are idle most of the time and must keep state, and when you can operate Postgres and call suspend yourself.

You run 400 agent sessions a day, one pod for each. Most of those pods wait for a person to type. Your node bill grows with the number of sessions, and somebody asks if Agent Substrate would cut it. The true answer depends on five facts about your agents and your team.

When you finish this section, you can decide between Substrate, a pod per agent, a sandbox per session, and a hosted sandbox. You can also state what Substrate costs you, with the number behind each cost.

One limit of this section comes first. We ran Substrate and kagent. We did not run the other choices, so their behaviour here comes from their own documentation, and we give no times for them.

## What Substrate gives you

**Many stateful actors on few worker pods.** A suspended actor uses no CPU and no memory on a worker. It uses only the bytes of its snapshot. In our kagent run, one worker pod served every Session of the cluster, and it ran 16 actors at one time.

**Snapshot and resume.** An actor keeps its memory or its files across idle time, and the first request after the idle time resumes it. The client needs no special code for that request. It waits a little longer.

**An egress policy and a credential for each actor.** Each actor has its own list of allowed hosts. The gateway puts the API key into the request, so the key is never inside the sandbox. A pod per agent gives you a NetworkPolicy and a mounted Secret, and neither has those two properties.

**No Kubernetes API in the request path.** With kube-apiserver down for 86 s, every request to a running actor was served.

## What Substrate costs you

**Postgres and `ate-api-server` are in every request path.** When either one is down, requests to actors fail, also to actors that are running. [When a dependency is down](#s-when-a-dependency-is-down) has the timeline.

**We measured** this on an x86 server guest with 16 vCPU and 23 GB, with one request each second. With Postgres down for 61 s, requests to a running actor failed from the first second. With `ate-api-server` down for 60 s, they failed from second 6.

**You own suspend and scaling.** Substrate never suspended an idle actor in our run. It stayed `ACTOR_STATE_RUNNING` in every sample of a 900 s wait. Something that you run must call `SuspendActor`, and something must add workers when the pool is full. On a full pool, a request waited 5.06 s and then got a 503.

**Resume time grows with memory.** The published figure of less than 500 ms comes with no actor size. On our test machine it held to about 200 MiB.

**We measured** resume against the memory that an actor holds, on an x86 server guest with 24 vCPU and 47 GB. From the node copy, the median of 10 resumes was 0.22 s at 0 MiB and 0.47 s at 200 MiB. At 1000 MiB it was 2.16 s. From the object store, the median of 5 resumes was 0.96 s at 200 MiB and 4.68 s at 1000 MiB.

**A snapshot is not safe at once.** After the default suspend, the snapshot is on one node for 5 minutes before the upload. Lose that node copy, and the actor is `ACTOR_STATE_CRASHED` until you revert it. The calls since the last uploaded snapshot are gone.

**You own the recovery from a node loss.** Substrate does not move an actor off a node that stops, and it does not move pool pods back to a node that returns. Your runbook must do it, and a wrong command during the outage makes it worse.

**We measured** 13 node-stop cases on a second x86 server guest (16 vCPU, 23 GB), once each, on a cluster with two worker nodes. No actor left the stopped node by itself. A new actor from a tag that existed before the stop served its first request after 1.2 s, in 3 of 3 rescues. One `revert` freed a quiet actor in 7.1 s, and a `revert` in any other situation left the actor in `ACTOR_STATE_REVERTING`. After an outage of more than 6 minutes, the returned node had no pool pod in 7 of 7 returns. [When a dependency is down](#s-when-a-dependency-is-down) has the runbook.

A pod per agent does not have this cost in the same form. With a Deployment or a StatefulSet, Kubernetes starts a new pod on another node, and the state in memory is lost with the old one. With Substrate the state can survive, if you made a tag or a synchronous suspend, and if your operator follows the runbook.

**No GPU.** At v1.0.0 an actor cannot use a GPU.

**Privileged workers.** The worker pod of our kagent install ran as root, with the `SYS_ADMIN` and `NET_ADMIN` capabilities. A namespace with a strict pod security policy rejects such a pod.

## The decision

```figure
id: fig-7-4
kind: decision
title: five questions that decide if Substrate fits
claim: Substrate fits only when all five answers are yes, and each no names a simpler choice that fits better.
caption: Read top to bottom. The line under each question is the fact or the run behind it. A no leaves the column to the right, to a simpler choice. Five yes answers end at Agent Substrate. From capture/lab/summary/resume-x86.json, capture/lab/summary/dependency-loss-x86.json, capture/lab/summary/failures-x86.json, capture/lab/summary/kagent-turns-x86.json, and the documentation of each alternative.
```

1. **Does the agent run on CPU only?** If it needs a GPU, Substrate cannot run it.
2. **Is the agent idle most of the time?** A busy actor holds its worker capacity all day, and you save nothing.
3. **Must state outlive the idle time?** If each session starts clean, you do not need a snapshot.
4. **Can you operate Postgres?** The question includes an object store, a control plane, and a privileged DaemonSet.
5. **Does something call `SuspendActor`?** Without a caller, every actor runs until the pool is full.

## The simpler choices

| Behaviour | Substrate | A pod for each agent | A sandbox for each session | A hosted sandbox |
|---|---|---|---|---|
| An idle agent costs | the bytes of a snapshot | the CPU and memory of its pod | nothing after the pod is deleted | the price of the service |
| State across idle time | memory or files | everything, while the pod lives | files on a volume | set by the service |
| First request after idle | a resume | no delay | a pod start | set by the service |
| In the request path | Postgres and `ate-api-server` | nothing extra | nothing extra | the service |
| Who suspends | you, or a harness | nobody | you, or a controller | the service |
| Credentials | put in at the egress gateway | mounted in the pod | mounted in the pod | set by the service |
| GPU | no | yes | yes | set by the service |

**A plain pod for each agent** fits an agent that works most of the time or needs a GPU. It also fits an agent that needs a full pod specification with sidecars. A small fleet is the third case. Our kind install ran about two dozen pods before the first actor. A few dozen agents do not repay that.

**A sandbox for each session, with no snapshot,** fits short sessions that keep state in files or outside the sandbox. The open-source project `kubernetes-sigs/agent-sandbox` does this. It creates one pod for each sandbox through Kubernetes resources and keeps a pool of warm pods. A pause in that project deletes the pod and keeps the disk, so process memory is lost. It runs GPU pods and full pod specifications, and Substrate does neither.

**A hosted sandbox** fits a team that wants an API and no cluster. You give up control of the control plane, and you get no Postgres to operate. Google announced such a service, Agent Compute Engine, on 2026-10-22. It was not open for use on 2026-11-12.

Two more open-source projects sit next to Substrate and do not replace it. NVIDIA OpenShell checks what one agent is allowed to touch, with kernel controls and a policy check on egress. Its README describes no memory snapshot. kagent is a harness on top of Substrate, and [kagent 1.0 on Substrate](#s-kagent-on-substrate) shows what it adds. The project site names a second system that is built on Substrate, Agent Executor from Google. It runs one task as one actor and does not send the suspend for you. We ran one commit of it on Substrate v1.0.0 with no model, and [Agent Executor on Substrate](#s-agent-executor) has the run.

## Our recommendation for each situation

| Your situation | Choose | Why |
|---|---|---|
| Hundreds of chat or coding agents, CPU only, idle most of the day | Substrate with a harness such as kagent | One worker served every Session in our run. A turn paid about 0.5 s of resume and suspend. |
| The same agents, and no harness yet | Substrate, after you write the suspend caller | An idle actor is never suspended for you. |
| Agents that hold 1 GiB of memory and must answer in less than 1 s after idle | pods, or files-only snapshots | A resume at 1000 MiB took 2.16 s from the node and 4.68 s from the object store. |
| Agents that need a GPU | a pod for each agent | Substrate has no GPU at v1.0.0. |
| Fewer than a few dozen agents | a pod for each agent | The control plane is larger than the fleet. |
| Short code-execution sessions with no state to keep | a sandbox for each session | You need no snapshot, so you need no object store. |
| No team for Postgres and a control plane | a hosted sandbox | Both are in every request path. |
| A rule for each model or each tool | Substrate and a second gateway | The egress policy stops at hosts, ports, and one header. See [agentgateway with Substrate](#s-agentgateway). |
| State that must not lose the last 5 minutes | Substrate with the synchronous suspend | The default suspend uploads later. The synchronous suspend makes the snapshot durable, and no more. See [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor). |

The last row is about data, and not about availability. A synchronous suspend puts the snapshot in the object store before the call returns. It does not make the actor available after a node loss or a cordon. It also protects only what the actor held at that suspend. Work after the next resume is exposed until the next synchronous suspend, so suspend as often as your loss limit asks.

**We measured** this on a second x86 server guest (16 vCPU, 23 GB), on a cluster with two worker nodes, one run for each case. An actor that we suspended with `--mode sync` stayed bound to its node. It resumed on that node while the node was cordoned. When the node stopped, its requests failed, and it became `ACTOR_STATE_CRASHED` 5 min 44 s after the stop command. The other node had free workers the whole time.

We did not test a drain. [Placement](#s-placement) has these cases, and [When a dependency is down](#s-when-a-dependency-is-down) has what the operator must do in each one.

Our view after these runs: Substrate at v1.0.0 does what it says for small, idle, CPU-only actors. With kagent, you need no suspend code of your own. It is a second control plane with its own database. Adopt it when the idle capacity that you free is worth more than the work of operating that control plane.

```takeaways
- Count your idle agents and their memory before you compare costs.
- Choose a pod for each agent when the agent needs a GPU or is busy all day.
- Name the caller of SuspendActor before you install Substrate.
- Measure resume time at the memory size of your real agent.
- Plan who operates Postgres, because every request depends on it.
- Use the synchronous suspend to make a snapshot durable, and plan an operator action for a node loss.
- Count a node-loss runbook and tags for important actors as part of the price of Substrate.
```

Sources: capture/lab/summary/node-loss-x86.json, capture/lab/P-node-loss/10-a-quiet-revert.tsv, capture/lab/P-node-loss/80-tag-rescue.tsv, capture/lab/summary/resume-x86.json, capture/lab/summary/dependency-loss-x86.json, capture/lab/summary/failures-x86.json, capture/lab/summary/parking-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/summary/timers-x86.json, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/D-durability/30-local-loss.tsv, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/A-quickstart/60-state.log, capture/lab/K-kagent/inventory/worker-pod-spec.json, capture/lab/K-kagent/parallel/workers-during.txt, capture/lab/L-gaps/multinode/60-sticky-cordon.tsv, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv; Agent Substrate v1.0.0 documentation (architecture, API guide); Google Cloud documentation "Plan an architecture for AI agent workloads on GKE", read 2026-11-12; kubernetes-sigs/agent-sandbox v1.0.10 README and roadmap; NVIDIA OpenShell v0.1.8 README; Google Cloud blog posts on Agent Compute Engine, 2026-10-22 and 2026-10-23.
