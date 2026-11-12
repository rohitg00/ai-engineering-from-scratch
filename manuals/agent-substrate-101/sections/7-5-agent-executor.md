# Agent Executor on Substrate

> Agent Executor runs each task as one files-only actor on Substrate v1.0.0, never suspends it for you, and cannot yet open egress for it.

The project site names two systems that are built on Agent Substrate. One is kagent, which [kagent 1.0 on Substrate](#s-kagent-on-substrate) covers from our own run. The other is Agent Executor, and your team asks if it is the better base for coding agents. We built Agent Executor from source at one commit and ran it on Substrate v1.0.0. No task used a model. Each task ran the command `sleep infinity`, so every number here is the cost of the platform and not of an agent.

When you finish this section, you can map each Agent Executor object to the Substrate object behind it. You can also name the four places where its pages and our run disagree.

## What we ran

Agent Executor, short name AX, is an open-source orchestrator from Google for agent tasks. Its license is Apache-2.0. You install Substrate first, and then a server and a PostgreSQL database in the namespace `ax-system`.

Three versions exist, and only one fits Substrate v1.0.0.

| Version | Substrate that its module file requires | In this manual |
|---|---|---|
| release v0.3.1, 2026-09-25 | a Substrate commit from 2026-09-11, with Redis and a controller | read, not run |
| the baseline commit of the installation page | v0.6.0 | read, not run |
| commit `a72b8ca4`, 2026-11-11 | v1.0.0 | built and run |

The installation page at that commit still names the v0.6.0 baseline. Check the module file of the commit that you install, and not the page.

**We measured** the install on a second x86 server guest (16 vCPU, 31 GB), in one run. The cluster had Substrate v1.0.0 from the release images, the Envoy dataplane, and gVisor. The command line tool built in 17 s. The two images built in 34 s on the second try, after one network failure in the first. PostgreSQL was ready after 23.9 s and the server after 7.0 s. At idle the server used 6.3 MB and its PostgreSQL used 30.3 MB.

The first task then failed. The server identity had no grant in the Substrate access policy.

```listing
title: the first task before the Substrate grant
source: capture/lab/R-agent-executor/10-install/51-apply-before-grant.log
lang: text
note: The object fields between the error and the phase are cut.
---
Error: applying document 1: rpc error: code = Internal desc = provisioning task on substrate: ensuring atespace: creating atespace "default": rpc error: code = PermissionDenied desc = permission denied: principal "user:system%3Aserviceaccount%3Aax-system%3Aax-server" lacks "can_create_atespace" on "global:root"
…
Phase:        Failed
```

The installation page tells you to add that grant, and it is right. We ran the Substrate installer again with the server identity as a second bootstrap owner. The same run added that identity to the ingress allowlist of the router. That step took 29.7 s. [Access policies](#s-access-policies) shows what a bootstrap owner is allowed to do. It is a wide grant.

## How a task becomes an actor

The pages call the four kinds resources in `ax.io/v1alpha1`. They are not Kubernetes resources. The cluster had no CRD for them. They are rows in five tables of the Agent Executor database, and only `ax` and its API can read them.

```figure
id: fig-7-5
kind: flow
title: what each Agent Executor object became on Agent Substrate
claim: One task became one actor and one template with a files-only snapshot, and no object opened egress or chose a pool.
caption: Read each row left to right. The left column is what you write, and the right column is what existed on Substrate after it. A rose arrow marks a row where nothing was done for you. From our run of commit a72b8ca4 on Substrate v1.0.0, in capture/lab/R-agent-executor.
```

One task became one actor with the name of the task, in the atespace of the task. Each task also got its own ActorTemplate. Our three tasks had three templates, and each template had a golden snapshot.

```listing
title: the template that Agent Executor created for one task
source: capture/lab/R-agent-executor/30-concept-map/05-actor-template.yaml
lang: yaml
note: The task manifest in the environment, the metadata, and the status are cut.
---
containers:
- command:
  - /usr/local/bin/ax-task-runner
…
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
    timeoutSeconds: 30
…
resources:
  limits:
    cpuMillicores: "1000"
    memoryBytes: "536870912"
snapshotConfig:
  goldenSnapshotConfig:
    mode: GOLDEN_SNAPSHOT_MODE_ENABLED
  preferredFidelity: SNAPSHOT_FIDELITY_VOLUMES
…
volumes:
- durableDir: {}
  name: workspace
```

Read four facts from it.

- **A runner is process 1.** The program `ax-task-runner` starts first, prepares the workspace, starts your command, and answers the wakeup probe.
- **The snapshot is files-only.** One durable directory is kept, at `/workspace`.
- **The defaults are small.** A task with no limits got 1 CPU and 512 MiB.
- **The template names no pool.** It has no worker selector.

The last fact had an effect in our run. We created a WorkerPool of two workers for Agent Executor. No task used it. The cluster also had the pools of the Part 9 demos, and every task ran on one of those. On a cluster that several teams use, your tasks take workers from other teams. [Placement](#s-placement) shows how a selector prevents that, and Agent Executor sets none.

## Who sends the suspend

You do. A new task starts in the phase `Suspended`. The command `ax resume task` starts it, and `ax suspend task` checkpoints it.

**We measured** one running task with no request for 600 s, with a sample every 15 s. All 40 samples showed `ACTOR_STATE_RUNNING`. Agent Executor did not suspend the task, and Substrate did not. So our first position holds here too. The roadmap of the project lists an automatic suspend as future work.

A suspend keeps only the files in `/workspace`. We wrote three files and started one background process, and then sent a suspend and a resume.

```listing
title: the sandbox after one suspend and one resume
source: capture/lab/R-agent-executor/40-lifecycle/25-survive-after.txt
lang: text
note: The directory entries and the processes of the check itself are cut.
---
ls: cannot access '/tmp/scratch.txt': No such file or directory
ls: cannot access '/root-marker.txt': No such file or directory
…
note-from-run-1
  PID ELAPSED COMMAND
    1       0 /usr/local/bin/ax-task-runner
    9       0 sleep infinity
…
```

The file in `/workspace` came back. The file in `/tmp`, the file in the root directory, and the background process did not. The runner and the command had an age of 0 s. Each resume is a new start of your command.

Agent Executor also uses the asynchronous suspend. The snapshot of the last suspend stayed `PENDING` for about 5 minutes. [Snapshot fidelity, and where a snapshot lives](#s-snapshot-fidelity-and-where-a-snapshot-lives) shows what a node loss costs in that window.

**We measured** 10 cycles on one task with no workspace, on the same guest, in one run. All 40 commands returned 0.

| Command | Runs | Seconds at the client |
|---|---|---|
| `ax suspend task` | 10 | median 0.178, from 0.163 to 0.220 |
| `ax resume task` | 10 | median 0.244, from 0.223 to 0.334 |
| one command through `ax ssh` | 10 | median 0.738, from 0.728 to 0.753 |
| `ax describe task` | 10 | median 0.035 |
| `ax delete task` | 2 | 0.197 and 0.206 |
| first `ax resume task`, no workspace | 2 | 4.5 after the install, then 2.289 |
| first `ax resume task`, clone blocked | 1 | 12.350 |

```figure
id: fig-7-5b
kind: chart
title: the cost of each Agent Executor command, and of the first resume
claim: A resume of a task that is already prepared took about 0.24 s, and a resume that waited for a blocked Git clone took more than 10 s.
caption: On the left, each dot is one run of 10 cycles on one task, and the black line is the median. On the right, each bar is one run of the first resume. The command of every task was sleep infinity. A real agent image adds its own start time to each resume. From capture/lab/summary/agent-executor-x86.json.
```

The resume returned in 0.24 s because `sleep` starts at once. Your number is the start time of your image. The Python agent of [A stateful agent actor](#s-a-stateful-agent-actor) took 4.5 to 5.1 s for the same kind of start.

## Where the pages and the run disagree

### A workspace cannot clone

A task with no gateway has no external network access. The manifest page says so, and our run confirmed it. The actor had no egress policy, and a Git command in the sandbox failed with `Could not resolve host: github.com`. [EgressPolicy and default deny](#s-egresspolicy-and-default-deny) explains that result.

A `Gateway` is the documented way to open egress. We applied one, and Agent Executor stored it. A task that named it was rejected.

```listing
title: a task that names a gateway
source: capture/lab/R-agent-executor/60-gateway-model/05-apply-task-with-gateway.log
lang: text
---
Error: applying document 1: rpc error: code = Unimplemented desc = spec.gateway is not supported yet
```

The manifest page says that this binding is not available yet, so the rejection is expected. The effect is larger than the page suggests. A `Workspace` with a Git repository cannot clone at this commit, because no Agent Executor object can open the route to the Git host. We did not test an egress policy that you set on the actor with `kubectl ate`.

Agent Executor also did not report the failed clone.

```listing
title: the task after five failed attempts to clone
source: capture/lab/R-agent-executor/70-workspace/08-describe-after-resume.log
lang: text
note: The first lines of the description are cut.
---
…
Workspace:    ax-ws  path=/workspace
Command:      [sleep infinity]

Conditions:
  TYPE            STATUS  REASON         MESSAGE
  WorkspaceReady  True    SetupComplete  Workspace setup completed at 10.244.0.40
  Ready           True    TaskRunning    Task is running and its workspace is ready
```

**We measured** this on one task with one repository, in one run. The inline file of the workspace was written. The repository directory held an empty `.git` folder. The runner tried the clone 5 times, and the first resume took 12.350 s. The second resume tried again and took 10.367 s.

The error was in the actor log and in the file `/ax/git-error.log` in the sandbox. Read that file before you trust the condition `WorkspaceReady`.

### The route on port 80 does not exist

The networking page reaches a task with plain HTTP on port 80 of the router Service. On our cluster that Service had ports 443 and 8444 only, as [The router and ingress](#s-the-router-and-ingress) shows for both dataplanes.

```listing
title: the port-forward command of the networking page
source: capture/lab/R-agent-executor/80-networking/03-port-forward-80.log
lang: text
note: The line of the curl command that followed is cut.
---
error: Service atenet-router does not have a service port 80
…
```

A request from a pod in the cluster to port 80 timed out after 8 s. The command `ax ssh` worked, because it does not use that route. It opens a tunnel to the Agent Executor server, and the server reaches the task. A task needs `debug: true` for that. Without it, `ax ssh` returned `does not expose guest services`.

### Three smaller differences

| The pages say | Our run showed |
|---|---|
| without a WorkerPool, the first resume fails with `ResourceExhausted` | the task ran on a pool of another namespace, and our pool stayed empty |
| a task that binds a missing workspace is rejected | confirmed, with `FailedPrecondition`. A delete of a workspace that a task still used was accepted |
| a `Model` refers to a Kubernetes Secret with the key | a `Model` that named a Secret that did not exist was accepted. No task used a model |

After a delete, the actor and the template of the task were gone. The atespace `default` that Agent Executor created stayed.

## What we did not run

- **A model and an agent.** No task called a model, and no agent image ran.
- **A worker loss.** Our tasks ran on pools that belong to other experiments, so we did not delete a worker pod. [CRASHED and RevertActor](#s-crashed-and-revertactor) shows what Substrate does. How `ax resume task` handles a crashed actor is not known to us.
- **A real clone.** The time of a first resume with a large repository is not measured.
- **MCP servers and skills of a workspace.** We applied neither.
- **The release v0.3.1.** It requires an older Substrate and was not installed.

## Our position

Agent Executor is early, and its pages say so. Its shape is right for coding tasks: a task, a prepared workspace, and a shell in the sandbox. Its lifecycle commands are fast and returned 0 in every run. Two gaps decide the answer today. A task cannot reach a Git host or a model through an Agent Executor object, and nothing suspends an idle task.

| | kagent 1.0 | Agent Executor at `a72b8ca4` |
|---|---|---|
| One actor is | one Session | one Task |
| Who sends the suspend | kagent, after each turn | you, with `ax suspend task` |
| Snapshot fidelity | files-only | files-only |
| Substrate that it uses | its own distribution, installed with it | the Substrate that you installed |
| Egress through its own objects | not tested by us | closed, and the gateway binding is rejected |
| Its own database | PostgreSQL | PostgreSQL |
| In this manual | run with a mock model | run with no model |

If you need chat sessions on Substrate today, use kagent 1.0. If you need task runs with prepared repositories, wait for the gateway binding. Then repeat the tests of this section on the commit that you install.

```takeaways
- Install the Agent Executor commit whose module file requires your Substrate version.
- Add the server identity to the Substrate access policy and to the router allowlist before the first task.
- Send the suspend yourself, or write the idle suspender of section 9.1.
- Read `/ax/git-error.log` in the sandbox, because `WorkspaceReady` was true after a failed clone.
- Reach a task with `ax ssh` and `debug: true`, and not through port 80 of the router.
- Keep Agent Executor on a cluster of its own until its templates name a pool.
```

Sources: capture/lab/R-agent-executor/00-source/refs-and-pins.txt; capture/lab/R-agent-executor/10-install/steps.tsv, 20-make-images.FAILED-apk-fetch.log, 51-apply-before-grant.log, 61-substrate-after-grant.txt, 62-ax-pool.yaml; capture/lab/R-agent-executor/20-inventory/02-crds.txt, 06-idle-resources.txt, 07-postgres-tables.txt; capture/lab/R-agent-executor/30-concept-map/05-actor-template.yaml, 07-egress-policy.yaml, 10-actors.txt; capture/lab/R-agent-executor/40-lifecycle/11-state-changes.tsv, 20-survive-before.txt, 25-survive-after.txt, 30-cycles.tsv; capture/lab/R-agent-executor/50-idle/10-idle-watch.tsv; capture/lab/R-agent-executor/60-gateway-model/05-apply-task-with-gateway.log; capture/lab/R-agent-executor/70-workspace/steps.tsv, 08-describe-after-resume.log, 10-ssh-egress.log, 20-runner-log-lines.log, 21-ssh-clone-state.log; capture/lab/R-agent-executor/80-networking/01-router-service.txt, 02-in-cluster-curl-http.log, 03-port-forward-80.log, 04-tunnel-list.log; capture/lab/R-agent-executor/90-nodebug/05-ssh.log; capture/lab/R-agent-executor/95-failure/04-SKIPPED.txt; capture/lab/R-agent-executor/98-model/05-get-describe.log; capture/lab/R-agent-executor/99-delete/steps.tsv, 02-templates-before.txt, 10-templates-after.txt, 12-atespaces-after.txt; capture/lab/summary/agent-executor-x86.json; the Agent Executor repository github.com/google/ax at commit a72b8ca46cb54a6f9bd53c8bb349d3a2089e7735, read 2026-11-12: README.md, docs/installation.md, docs/manifests.md, docs/networking.md, docs/roadmap.md, go.mod, internal/server/server.go, and its release list; capture/lab/summary/demos-x86.json.
