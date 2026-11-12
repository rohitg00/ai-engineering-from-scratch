# Agent Executor on Substrate

> Agent Executor runs each task as one files-only actor on Substrate v1.0.0, never suspends it, and opens no egress, so you set the rule on the actor.

The project site names two systems that are built on Agent Substrate. One is kagent, which [kagent 1.0 on Substrate](#s-kagent-on-substrate) covers from our own run. The other is Agent Executor, and your team asks if it is the better base for coding agents. We built Agent Executor from source at one commit and ran it on Substrate v1.0.0, in two runs.

When you finish this section, you can map each Agent Executor object to the Substrate object behind it. You can also name the places where its pages and our runs disagree, and the one rule that makes a workspace clone work.

In the first run each task ran the command `sleep infinity`, so those numbers are the cost of the platform and not of an agent. In the second run we cloned a repository and called a model from a task. We also ran the example agent image and deleted a worker under a task. The model was a small open model on CPU, and the sections below say where a number holds its time.

## What we ran

Agent Executor, short name AX, is an open-source orchestrator from Google for agent tasks. Its license is Apache-2.0. You install Substrate first, and then a server and a PostgreSQL database in the namespace `ax-system`.

Three versions exist, and only one fits Substrate v1.0.0.

| Version | Substrate that its module file requires | In this manual |
|---|---|---|
| release v0.3.1, 2026-09-25 | a Substrate commit from 2026-09-11, with Redis and a controller | installed on v1.0.0, and no task started |
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

The last fact had an effect in our first run. We created a WorkerPool of two workers for Agent Executor. No task used it. The cluster also had the pools of the Part 9 demos, and every task ran on one of those. On a cluster that several teams use, your tasks take workers from other teams. [Placement](#s-placement) shows how a selector prevents that, and Agent Executor sets none.

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
| first `ax resume task`, clone with no egress rule | 1 | 12.350, which is five tries of the runner |

```figure
id: fig-7-5b
kind: chart
title: the cost of each Agent Executor command, and of a resume that prepares a workspace
claim: A resume of a prepared task took about 0.24 s, and a resume whose clone failed took more than 10 s because the runner tried five times.
caption: On the left, each dot is one run of 10 cycles on one task, and the black line is the median. On the right, each bar is the time of ax resume task for one state of the workspace. The grey line under it gives the number of runs. The command of every task was sleep infinity. A real agent image adds its own start time to each resume. From capture/lab/summary/agent-executor-x86.json and capture/lab/summary/agent-executor-followups-x86.json.
```

The resume returned in 0.24 s because `sleep` starts at once. Your number is the start time of your image. The Python agent of [A stateful agent actor](#s-a-stateful-agent-actor) took 4.5 to 5.1 s for the same kind of start.

## Where the pages and the run disagree

### A workspace clones only with a rule that you set

A task with no gateway has no external network access. The manifest page says so, and our run confirmed it. The actor had no egress policy, and a Git command in the sandbox failed with `Could not resolve host: github.com`. [EgressPolicy and default deny](#s-egresspolicy-and-default-deny) explains that result.

A `Gateway` is the documented way to open egress. We applied one, and Agent Executor stored it. A task that named it was rejected.

```listing
title: a task that names a gateway
source: capture/lab/R-agent-executor/60-gateway-model/05-apply-task-with-gateway.log
lang: text
---
Error: applying document 1: rpc error: code = Unimplemented desc = spec.gateway is not supported yet
```

The manifest page says that this binding is not available yet, so the rejection is expected. The effect is larger than the page suggests. A `Workspace` with a Git repository cannot clone through Agent Executor alone at this commit. No Agent Executor object can open the route to the Git host.

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

**We measured** this on one task with one repository, in one run. The inline file of the workspace was written. The repository directory held an empty `.git` folder. The runner tried the clone 5 times, and the first resume took 12.350 s. The second resume tried again and took 10.367 s. Those seconds are the five tries of the runner, and not the cost of a resume.

The error was in the actor log and in the file `/ax/git-error.log` in the sandbox. Read that file before you trust the condition `WorkspaceReady`.

You can open the route yourself, with `kubectl ate` and not with `ax`. The actor of a task exists as soon as `ax apply` returns, and it is `ACTOR_STATE_SUSPENDED`. So you can create its egress policy before the first resume. The kind of rule decides the result.

An `https` rule for the Git host did not work. That rule lets the egress gateway intercept TLS, as [TLS interception](#s-tls-interception) explains. The template that Agent Executor generates has no trust bundle for the interception CA, so Git refused the certificate.

```listing
title: the clone behind an https rule
source: capture/lab/S-ax-model/30-ax-clone/10-ssh-clone-state.log
lang: text
note: The directory entries above the error are cut, and one line of Git output inside it.
---
…
error: git fetch: exit status 128
…
fatal: unable to access 'https://github.com/pallets/itsdangerous.git/': server verification failed: certificate signer not trusted. (CAfile: /etc/ssl/certs/ca-certificates.crt CRLfile: none)
```

A `tlsPassthrough` rule worked, and it needs a port. An update with host names only was refused.

```listing
title: a tlsPassthrough rule with no port
source: capture/lab/S-ax-model/30-ax-clone/41-update-egress.log
lang: text
note: The CLI warning above the error is cut.
---
…
Error: failed to update egress policy for actor "s-clone" in atespace "default": rpc error: code = InvalidArgument desc = egress_policy.rules[0].tls_passthrough.ports: Required value
```

```listing
title: the rule that let the workspace clone
source: capture/lab/S-ax-model/30-ax-clone/62-egress-now.log
lang: yaml
note: The CLI warning and the metadata above the rules are cut.
---
…
rules:
- tlsPassthrough:
    hostnames:
    - github.com
    ports:
      numbers:
      - 443
```

**We measured** this on the same second x86 server guest (16 vCPU, 31 GB), on one task with one small public repository. With the `https` rule, `ax resume task` took a median of 11.62 s over 14 resumes, from 10.69 to 17.21 s, and every clone failed. With the `tlsPassthrough` rule, the resume that cloned took 9.57 s, in one run. The next 5 resumes took a median of 0.265 s, and each one found the same commit in the checkout.

A pass-through rule gives up what an intercepted rule gives you. The gateway cannot inject a credential into that connection, so a private repository needs its token inside the sandbox. [Credential injection](#s-credential-injection) explains the difference.

### The route on port 80 does not exist

The networking page reaches a task with plain HTTP on port 80 of the router Service. Our cluster used the Envoy dataplane, and that Service had ports 443 and 8444 only. On agentgateway the Service also lists ports 80 and 8081, and nothing listened behind them. [The router and ingress](#s-the-router-and-ingress) has the ports of each dataplane.

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
| a `Model` refers to a Kubernetes Secret with the key | a `Model` that named a Secret that did not exist was accepted. No field of a task names a `Model` |

After a delete, the actor and the template of the task were gone. The atespace `default` that Agent Executor created stayed.

## A model call from a task

A `Model` object is stored, and nothing uses it at this commit. We read the code. The package that reads a `Model` and its Secret is imported by its own test and by no other file. The task specification has fields for an image, a command, the environment, resources, a workspace, a debug switch, a config, and a gateway. It has no field that names a `Model`.

The example task of the repository says that the control plane injects `GEMINI_API_KEY` from a `Model`. We applied a `Model` with that key name and a task beside it. Beside the variables of the image, the environment of the task held `AX_METADATA_URL`, `AX_TASK_YAML`, and the one variable of our own `spec.env`. It held no `GEMINI_API_KEY`.

A task can still call a model. The route is an egress rule on the actor, as for the clone. Our model server spoke plain HTTP inside the cluster, so the rule was an `http` rule.

```listing
title: the egress rule for the model server
source: capture/lab/S-ax-model/60-ax-model/07-egress.yaml
lang: yaml
---
rules:
- http:
    hostnames: ["ollama.ax-system.svc.cluster.local"]
    ports:
      numbers: [11434]
```

The model was `qwen2.5:3b`, an open model of 1.9 GB, on the Ollama server 0.40.16 with 12 CPUs and no GPU. It produced 7.1 tokens per second at the median over 5 requests. That is a small model on slow hardware. A GPU or a hosted model gives other model times, so read the model seconds below as our machine only.

**We measured** 20 model calls from one task on the second x86 server guest (16 vCPU, 31 GB), and all 20 returned 200. Ten calls went to the running task. Ten more were whole turns: `ax resume task`, one call, `ax suspend task`. A turn took 4.34 s at the median, from 4.03 to 5.90 s. The resume was 0.25 s of that and the suspend 0.15 s. The model call was 2.94 s for a reply of at most 80 tokens.

So the platform cost of a turn was about 0.4 s here, as in the first run. Every other second was the model and the `ax ssh` round trip.

## The example agent image

The repository has one agent example, Claude Code in a task image. Its documented setup needs a vendor key. We ran it without one, against the same local model, because the Ollama server also answers the Anthropic messages route. The task set the base URL of the agent to that server through `spec.env`, and an `http` rule on the actor opened the route.

**We measured** one run, on the second x86 server guest (16 vCPU, 31 GB). The image build took 50 s, and the image is 253 MB with Claude Code 2.1.322. The first `ax resume task` took 5.94 s. The agent command then ran for 31.7 s and sent two model requests, of 28.78 s and 1.32 s. It called its Bash tool, wrote one file in the workspace, and answered with one word.

```listing
title: the workspace after the agent command ended
source: capture/lab/S-ax-model/70-agent-image/21-workspace.log
lang: text
note: The directory entries above the file and the processes of the check itself are cut.
---
…
-rw-r--r-- 1 root root  15 Nov 12 16:41 agent-output.txt
agent-was-here
  PID ELAPSED COMMAND
    1      38 /usr/local/bin/ax-task-runner
…
```

Read the process list. The agent command is gone, and the runner is still process 1. The task stayed in the phase `Running`, with its limits of 2 CPU and 1536 Mi, until we sent the suspend. A task that has finished its work does not end and does not suspend.

This run proves the path and nothing about the quality of an agent. It was one prompt that asks for one shell command, with a short system prompt, three tools, and a model of 1.9 GB. We did not run the example with its own prompt and repository.

## A worker that goes away under a task

We deleted the worker pod that held a running task, in two runs. Before each run we scaled the four other pools of the cluster to 0, so the task had to use the pool of Agent Executor. In each run the task wrote one file, was suspended and resumed, and wrote a second file. Then the worker pod was deleted.

```figure
id: fig-7-5c
kind: flow
title: a worker pod deleted under a running task, with a young snapshot and with an uploaded one
claim: The resume after a worker loss took 0.3 s in both runs, and it kept the saved file only when the snapshot had reached the object store.
caption: Read each row left to right. The first box is the state of the durable snapshot of the last suspend when the worker pod was deleted. The last box is what the task found in its workspace after ax resume task. From capture/lab/summary/agent-executor-followups-x86.json.
```

| | Run 1 | Run 2 |
|---|---|---|
| Last `ax suspend task` before the loss | 8.7 s | 307 s |
| Durable snapshot at the loss | `PENDING` | `COMPLETED`, 301 s after the suspend |
| Actor after the loss | `CRASHED`, seen after 1.2 s | `CRASHED`, seen after 0.9 s |
| With no command | `CRASHED` for the 41 s that we watched | `CRASHED` for the 300 s that we watched |
| `ax resume task` | 0.30 s, `RUNNING` on another worker | 0.33 s, `RUNNING` on another worker |
| File written before the last suspend | lost | kept |
| File written after the last suspend | lost | lost |

**We measured** each run once, on the second x86 server guest (16 vCPU, 31 GB), with one kind node and a pool of two workers. Each task ran `sleep infinity`.

```listing
title: the task after its worker pod was deleted
source: capture/lab/S-ax-model/40-ax-worker-loss/23-describe-after-loss.log
lang: text
note: The name, the atespace, the actor, and the command are cut.
---
…
Phase:        Failed
…
Conditions:
  TYPE            STATUS  REASON         MESSAGE
  WorkspaceReady  True    SetupComplete  Workspace setup completed at 10.244.0.40
  Ready           False   Failed         worker pod went away while hosting the actor
```

Two results matter. The first is good. `ax resume task` was enough, in both runs. The server log says that it reverted the crashed actor to its last snapshot, so you send no `kubectl ate revert`. [CRASHED and RevertActor](#s-crashed-and-revertactor) shows the same failure on plain Substrate, where you send the revert.

The second result is a loss. In run 1, the file that `ax suspend task` had saved was gone. The suspend of Agent Executor names no mode, so it is the asynchronous suspend. The snapshot stays on the worker for about 5 minutes before the upload. The worker was lost inside that window. [Snapshot fidelity, and where a snapshot lives](#s-snapshot-fidelity-and-where-a-snapshot-lives) measures that window on plain Substrate.

**Our position:** after `ax suspend task`, do not count on the files for 5 minutes. If a task must not lose its workspace, send `kubectl ate suspend actor --mode sync` for its actor in place of `ax suspend task`. We did not test that command on a task.

## The release v0.3.1 on Substrate v1.0.0

We installed the release v0.3.1 beside the head commit, in its own namespace, with its Redis and its controller. It is 61 commits behind the commit that we ran. No task started. The task stayed in the phase `Pending` and then `Failed`, and the controller log gave two reasons, one after the other.

The first was a timeout to `ate-api-server`. A NetworkPolicy of Substrate v1.0.0 admits only namespaces with the label `ate.dev/api-access: "true"`, and the manifests of v0.3.1 do not set it. We added the label. The second reason then appeared.

```listing
title: the controller of release v0.3.1 after the namespace label
source: capture/lab/S-ax-model/50-ax-v031/92-controller-after-label.log
lang: text
note: The time, the event fields, and the start of the error are cut.
---
… rpc error: code = Unimplemented desc = unknown service ateapi.Control"
```

The release calls the gRPC service `ateapi.Control`. Substrate v1.0.0 serves `substrate.ateapi.v1.Control`. No setting bridges that. So the release list is not a guide to what runs on v1.0.0. Check the module file of the commit that you install.

## What we did not run

- **A model that can do real agent work.** Our model was small and on CPU. We ran no hosted model and no model on a GPU.
- **The example with its own prompt and repository.** We ran one short prompt.
- **MCP servers and skills of a workspace.** We applied neither.
- **A worker loss during a request, and a node loss under a task.** The cluster had one node.
- **A large or private repository.** The time of a first resume with a large clone is not measured.
- **The release v0.3.1 on the Substrate version that it was built for.**

## Our position

Agent Executor is early, and its pages say so. Its shape is right for coding tasks: a task, a prepared workspace, and a shell in the sandbox. Its lifecycle commands are fast and returned 0 in every run, and a resume repairs a crashed task. Three gaps decide the answer today. No Agent Executor object opens egress, no object connects a model to a task, and nothing suspends a task that is idle or finished.

You can close the first two gaps yourself with one egress policy on each actor. That works, and it is a second tool and a second place of truth beside `ax`.

| | kagent 1.0 | Agent Executor at `a72b8ca4` |
|---|---|---|
| One actor is | one Session | one Task |
| Who sends the suspend | kagent, after each turn | you, with `ax suspend task` |
| Suspend mode | synchronous | asynchronous |
| Snapshot fidelity | files-only | files-only |
| Substrate that it uses | its own distribution, installed with it | the Substrate that you installed |
| Egress through its own objects | three rules for each actor | closed, and the gateway binding is rejected |
| A model for the agent | a ModelConfig, with the key injected by the gateway | a `Model` that no task can name |
| Its own database | PostgreSQL | PostgreSQL |
| In this manual | run with a mock model and with a small model on CPU | run with no model, then with the same small model |

If you need chat sessions on Substrate today, use kagent 1.0. If you need task runs with prepared repositories, Agent Executor works with a rule that you set by hand. It is better to wait for the gateway binding. Then repeat the tests of this section on the commit that you install.

```takeaways
- Install the Agent Executor commit whose module file requires your Substrate version.
- Add the server identity to the Substrate access policy and to the router allowlist before the first task.
- Send the suspend yourself, also after a task has finished its work.
- Set a `tlsPassthrough` rule with port 443 on the actor before the first resume of a task that clones.
- Read `/ax/git-error.log` in the sandbox, because `WorkspaceReady` was true after a failed clone.
- Wait 5 minutes after `ax suspend task` before you count on the saved files.
- Keep Agent Executor on a cluster of its own until its templates name a pool.
```

Sources: capture/lab/R-agent-executor/00-source/refs-and-pins.txt; capture/lab/R-agent-executor/10-install/steps.tsv, 20-make-images.FAILED-apk-fetch.log, 51-apply-before-grant.log, 61-substrate-after-grant.txt, 62-ax-pool.yaml; capture/lab/R-agent-executor/20-inventory/02-crds.txt, 06-idle-resources.txt, 07-postgres-tables.txt; capture/lab/R-agent-executor/30-concept-map/05-actor-template.yaml, 07-egress-policy.yaml, 10-actors.txt; capture/lab/R-agent-executor/40-lifecycle/11-state-changes.tsv, 20-survive-before.txt, 25-survive-after.txt, 30-cycles.tsv; capture/lab/R-agent-executor/50-idle/10-idle-watch.tsv; capture/lab/R-agent-executor/60-gateway-model/05-apply-task-with-gateway.log; capture/lab/R-agent-executor/70-workspace/steps.tsv, 08-describe-after-resume.log, 10-ssh-egress.log, 20-runner-log-lines.log, 21-ssh-clone-state.log; capture/lab/R-agent-executor/80-networking/01-router-service.txt, 02-in-cluster-curl-http.log, 03-port-forward-80.log, 04-tunnel-list.log; capture/lab/R-agent-executor/90-nodebug/05-ssh.log; capture/lab/R-agent-executor/98-model/05-get-describe.log; capture/lab/R-agent-executor/99-delete/steps.tsv, 02-templates-before.txt, 10-templates-after.txt, 12-atespaces-after.txt; capture/lab/summary/agent-executor-x86.json; capture/lab/summary/agent-executor-followups-x86.json; capture/lab/summary/kagent-model-x86.json (the model benchmark); capture/lab/S-ax-model/10-model/10-bench.tsv, 06-list.txt, 02-image.txt; capture/lab/S-ax-model/30-ax-clone/steps.tsv, 04-actor-after-apply.log, 10-ssh-clone-state.log, 12-actor-logs.log, 21-template-trust-grep.txt, 41-update-egress.log, 62-egress-now.log, 66-ssh-clone-state.log, 32-cycles-https-rule-no-trust.tsv, 49-cycles-https-rule-no-trust-2.tsv, 69-cycles-after-clone.tsv; capture/lab/S-ax-model/40-ax-worker-loss/steps.tsv, 05-pool-replicas-saved.txt, 16-actor-before.yaml, 19-poll-changes.tsv, 21-events.tsv, 23-describe-after-loss.log, 28-ssh-after-resume.log, 40-ax-server.log; capture/lab/S-ax-model/41-ax-worker-loss-durable/steps.tsv, 12c-durable-changes.tsv, 19-poll-changes.tsv, 21-events.tsv, 28-files-after-resume.log, 40-ax-server.log; capture/lab/S-ax-model/50-ax-v031/01-tag.txt, 02-gomod-v031.txt, 44-pods.txt, 85-controller-final.log, 86-ate-api-netpol.yaml, 92-controller-after-label.log, 93-describe.log, 12-proto-compare.txt; capture/lab/S-ax-model/60-ax-model/04-model-and-task.yaml, 07-egress.yaml, 10-env-in-task.log, 12-model-calls-running.tsv, 13-turns-resume-call-suspend.tsv; capture/lab/S-ax-model/70-agent-image/steps.tsv, 03-image.txt, 04-claude-version.txt, 07-anthropic-format-check.txt, 11-task.yaml, 19-actor.log, 20-describe.log, 21-workspace.log, 22-ollama.log; the Agent Executor repository github.com/google/ax at commit a72b8ca46cb54a6f9bd53c8bb349d3a2089e7735, read 2026-11-12: README.md, docs/installation.md, docs/manifests.md, docs/networking.md, docs/roadmap.md, go.mod, internal/server/server.go, internal/model/client.go and client_test.go, internal/substrate/client.go (SuspendActor), pkg/apis/v1alpha1/task.proto (TaskSpec), examples/claude-code/task.yaml, and its release list; capture/lab/summary/demos-x86.json.
