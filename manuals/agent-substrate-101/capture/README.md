# Capture kit for Agent Substrate 101

This folder holds the recordings that the manual was written from, and the script that turns them into the numbers in its figures.

Agent Substrate needs a Kubernetes cluster, so the recordings cannot run in CI. We made them on our own machines on 2026-11-12 and stored the output in `lab/`. The script `run.py` needs no network and no keys. It reads `lab/` and rebuilds `lab/summary/`.

```bash
python3 capture/run.py
python3 capture/run.py --check
```

The check rebuilds the summaries in a temporary folder and compares them with the committed files. It prints one `skipped:` line for the recordings, because it does not start a cluster.

## Test beds

| Name in the manual | Machine | Software |
|---|---|---|
| the x86 server guest (24 vCPU, 47 GB, nested KVM) | a KVM guest on an x86 server, 24 vCPU, 47 GB, nested KVM, Ubuntu 24.04 | Docker 29.1.3, Go 1.27.3, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 built from source, Envoy dataplane, gVisor, and the microVM class for `L-gaps/microvm`. For `U-pg-upgrade-scale`, new kind clusters from the release images |
| a second x86 server guest (16 vCPU, 23 GB) | 16 vCPU, 23 GB, same host | Agent Substrate v1.0.0 from the release images, Envoy and then agentgateway v1.7.0. For `L-gaps/multinode` and `P-node-loss`, a second kind cluster with one control plane node and two worker nodes. `P-node-loss` and `Q-network` ran at the same time, each on its own cluster. `T-drain-store` ran later on the cluster with two worker nodes |
| a second x86 server guest (16 vCPU, 31 GB) | 16 vCPU, 31 GB, same host | Two clusters, one after the other. For `K-kagent`: kagent v1.0.0 with its own Substrate distribution, a mock model server in the cluster. For `N-demos`: Agent Substrate v1.0.0 from the release images, Envoy dataplane, gVisor. For `R-agent-executor`: Agent Executor from source on the cluster of `N-demos`. For `S-ax-model`: a small open model on CPU in a container on the guest, used from both clusters |
| the Mac | an Apple silicon laptop under Docker Desktop, 10 CPU and 8 GB for Docker | Agent Substrate v1.0.0 from the release images, gVisor only |

The guests and the Mac are different machines. Do not compare a number from one with a number from another. Two guests have 16 vCPU, so the manual names each one with its memory: 23 GB for `E`, `F`, `G`, `L-gaps/multinode`, `P-node-loss`, `Q-network`, and `T-drain-store`, and 31 GB for `K-kagent`, `N-demos`, `R-agent-executor`, and `S-ax-model`.

| Folder | Machine |
|---|---|
| `A-quickstart`, `B-lifecycle`, `C-resume-vs-size`, `D-durability`, `I-capacity`, `J-container-death`, `V-validation`, `L-gaps/microvm`, `L-gaps/restart`, `U-pg-upgrade-scale`, `Y-reruns-rollback-scale` | the x86 server guest (24 vCPU, 47 GB, nested KVM) |
| `E-dependency-loss`, `F-egress`, `G-dataplane`, `L-gaps/multinode`, `P-node-loss`, `Q-network`, `T-drain-store`, `X-remote-store-pg` | a second x86 server guest (16 vCPU, 23 GB) |
| `K-kagent`, `N-demos`, `R-agent-executor`, `S-ax-model`, `W-ax-kagent-2` | a second x86 server guest (16 vCPU, 31 GB) |
| `M-mac-arm64` | the Mac |

Each guest kept its disk in memory and reached the network through user-mode NAT. All clusters had one kind node, except the cluster of `L-gaps/multinode`, `P-node-loss`, and `T-drain-store`. The object store was rustfs in the same cluster. In part of `T-drain-store` it was rustfs in a container on the same guest, outside the cluster. In `X-remote-store-pg` the bucket and Postgres were containers on the guest with 31 GB, reached through the user-mode network.

## What each folder proves

### A-quickstart: the source quickstart as documented

| File | What it shows |
|---|---|
| `02-steps.tsv` | step, exit code, seconds for each quickstart step |
| `20-deploy-ate-system.FAILED-no-buildx.log` | the failure `unknown flag: --platform` without the buildx plugin |
| `22-deploy-ate-system-retry.log` | the same step after `docker-buildx` was installed |
| `60-state.log` | nodes, pods, CRDs, and the new actor after the install |

### B-lifecycle: no idle suspend, then suspend, resume, crash, revert

| File | What it shows |
|---|---|
| `10-trace.tsv` | first calls, then 900 s with no request and the state every 15 s |
| `20-trace-ops.tsv` | async suspend, sync suspend, resume, worker pod deleted, CRASHED, revert |
| `22-actor-after-async-suspend.yaml`, `23-actor-after-sync-suspend.yaml` | the actor object with a PENDING and a COMPLETED snapshot |
| `25-actor-crashed.yaml`, `26-actor-after-revert.yaml` | the actor object when crashed and after the revert |
| `27-lifecycle.log` | the lifecycle log of the actor |

### C-resume-vs-size: resume time against the memory an actor holds

| File | What it shows |
|---|---|
| `main.go`, `Dockerfile`, `pool.yaml`, `tmpl-*.yaml` | the ballast actor, its WorkerPool, and its five templates |
| `10-local.tsv` | create, first call, warm call, async suspend, resume from the node, sync suspend, per size |
| `32-object-store.tsv` | resume from the object store, five cycles per size, with shortened atelet timers |
| `31-atelet-args-patched.txt` | the atelet arguments of that run |
| `snapdir-b*-1.txt` | the size of the node-local snapshot per size |
| `20-storage-footprint.txt`, `23-storage-after-delete.txt` | disk use with 25 suspended actors, and after they were deleted |
| `lifecycle-*.log` | restore and checkpoint times as the worker reports them |

### D-durability: when a snapshot is safe

| File | What it shows |
|---|---|
| `10-watch-part1.tsv`, `10-watch-part2.tsv` | five actors after an async suspend with default timers, state every 10 s for 42 minutes, then one resume each. The actor `d1000` never got a worker, so four actors have a snapshot of their own |
| `30-local-loss.tsv` | the node-local snapshot removed before upload, and an atelet restart before upload |
| `40-node-reboot.tsv`, `46-after-reboot-followup.txt` | the kind node restarted before upload |
| `32-x1-after-loss.yaml`, `44-r1-after-reboot.yaml` | the actor objects after each loss |

### E-dependency-loss: which requests fail when a dependency is down

| File | What it shows |
|---|---|
| `10-timeline.tsv` | when Postgres, ate-api-server, and kube-apiserver were taken away and restored |
| `12-probe-incluster.tsv`, `12-probe-proxy.tsv` | one request per second, with code, seconds, and body |
| `20-analysis.txt` | the counts and the recovery times |
| `21-nonsteady-actors-after.txt`, `22-actors-5min-later.txt` | the actor that stayed in RESUMING |

The stream totals of `20-analysis.txt` are larger than those of `summary/dependency-loss-x86.json` (186 and 37 against 141 and 28 for kube-apiserver) because the analysis counts from 10 s before each outage to the end of the run, and the summary stops 40 s after the dependency was ready.

### F-egress: the egress policy on both dataplanes

| File | What it shows |
|---|---|
| `envoy/20-results.txt`, `agentgateway/20-results.txt` | default deny, an allowed host, TLS interception, pass-through, credential injection |
| `envoy/40-supplement.txt`, `agentgateway/40-supplement.txt` | a rule removed while a connection is open |
| `agentgateway/50-custom-header.txt` | what the debug log prints for a custom header |
| `*/policy-*-live.yaml` | every EgressPolicy that the tests used |
| `envoy/19-first-run-update-refused.txt`, `envoy/19b-second-run-passthrough-ports-required.txt` | the two CLI mistakes we made first |

The credential values in this folder are test values that we made up: `sk-mock-not-a-real-key` and `lab-granted-marker-...`.

### G-dataplane: Envoy against agentgateway

| File | What it shows |
|---|---|
| `00-install/steps.tsv` | the install from the release images, step by step |
| `01-switch-in-place/` | the switch to agentgateway on a running cluster |
| `envoy/`, `agentgateway/` | the same inventory for each dataplane: pods, containers, Services, volumes, ingress probes, idle memory |
| `02-agentgateway-without-ingress-allowlist/` | the router configuration with and without an ingress allowlist |

### I-capacity: a full pool and request parking

| File | What it shows |
|---|---|
| `01-unplanned-full-pool-503.tsv` | the fifth actor on a pool with room for four |
| `13-parking-trace.tsv` | a parked request that fails, and one that is served when a worker becomes free |
| `16-load-30s.log` | the load script of the parking demo, 30 s, four actors on two workers |
| `17-router-args.txt` | the router arguments, with the parking budget |

### J-container-death: a process that dies inside a sandbox

| File | What it shows |
|---|---|
| `10-trace.tsv` | an actor whose process exits, and one that runs out of memory |
| `11-j1-after-exit.yaml`, `14-j2-after-oom.yaml` | the actor objects after each death |

### K-kagent: kagent 1.0 on its Substrate distribution

| File | What it shows |
|---|---|
| `install/steps.tsv`, `install/40-kagent-install.log` | the documented install |
| `inventory/` | images, Helm releases, CRDs, the worker pod, the dataplane |
| `agent/` | the Harness, AgentTemplate, Agent, and the mock model server |
| `session1/` | one session: the actor, the egress policy that kagent wrote, two turns, what a snapshot kept |
| `latency/timings.tsv`, `latency/server-times.tsv` | turn times for spaced turns, turns with no pause, and first turns |
| `logs/actor-state-changes.tsv` | every state change of every actor, from the ate-api log |
| `parallel/` | 8 and 24 turns at the same time on one worker |
| `probes/` | ingress probes, egress denials, object store use |

### L-gaps: the microVM class, two worker nodes, and worker recovery

| File | What it shows |
|---|---|
| `microvm/40-microvm-local.tsv`, `microvm/49-summary.tsv` | create, first call, warm call, both suspend modes, and resume from the node, for a microVM actor that holds 0, 200, and 500 MiB |
| `microvm/20-counter-trace.tsv`, `microvm/24-lifecycle-counter.log` | the counter demo on a microVM pool |
| `microvm/30-pool.yaml`, `microvm/32-tmpl-*.yaml` | the microVM WorkerPool and its three templates |
| `microvm/26-actor-suspended.yaml`, `microvm/43-actor-v*-1-suspended.json` | actor objects with the runtime attributes of a microVM snapshot |
| `microvm/41-node-processes-v*-1.txt`, `microvm/23-node-processes-counter.txt`, `microvm/50-gvisor-rss.txt` | the processes on the node for one actor of each class, with resident memory |
| `microvm/44-snapdir-v*-1.txt` | the size and the files of a node-local microVM snapshot |
| `microvm/42-workers-v*-1.txt` | the memory that a worker books for one microVM actor |
| `multinode/01-kind-multi.yaml`, `multinode/02-steps.tsv`, `multinode/11-nodes.txt` | the cluster with two worker nodes and its install times |
| `multinode/50-placement.tsv`, `multinode/52-placement-counts.txt` | where 20 actors went |
| `multinode/60-sticky-cordon.tsv` | resumes on the node of the last suspend, also while the node is cordoned |
| `multinode/70-stop-after-upload.tsv`, `multinode/71-workers.txt` | a node stopped under an actor with a COMPLETED snapshot, with a request every few seconds |
| `multinode/75-stop-after-upload-revert.tsv` | the same with a revert before the first request |
| `multinode/80-stop-before-upload.tsv` | a node stopped under an actor with a PENDING snapshot, and two reverts that were refused |
| `multinode/90-stop-while-running.tsv` | a node stopped under a RUNNING actor, 150 requests, and one revert |
| `multinode/85-node-return.tsv`, `multinode/93-after-node-return.tsv` | the node after it started again |
| `multinode/96-controller-events.log`, `multinode/98-worker-state-rpcs.log`, `multinode/97-k8s-node-events.txt` | when the workers were marked unavailable and when Kubernetes evicted their pods |
| `_scripts/` | the six scripts that made these recordings |
| `restart/10-poll.tsv`, `restart/11-workers-each-poll.txt` | one node restart with a resume attempt and a worker list every 2 to 3 s |
| `restart/23-ateapi.log`, `restart/25-events.txt` | the `ate-api-server` log and the Kubernetes events of that restart |

### M-mac-arm64: Apple silicon

| File | What it shows |
|---|---|
| `02-steps.tsv`, `20-deploy-ate-system.log` | the install from the release images |
| `80-local.tsv` | create, first call, async suspend, resume, for 0, 50, and 200 MiB |
| `82-actor-m*.yaml`, `83-lifecycle-m*.log` | the actor objects and their lifecycle logs |

### N-demos: the four demos of Part 9

All four ran on a second x86 server guest (16 vCPU, 31 GB), on their own cluster, installed from the release images with the Envoy dataplane. The demo programs are in `capture/demos/`.

| Folder | What it shows |
|---|---|
| `install/steps.tsv` | the install of that cluster, step by step |
| `idle-suspender/suspender.tsv`, `idle-suspender/requests-*.tsv`, `idle-suspender/capacity-requests-*.tsv` | every decision of the suspender, and each request with and without it |
| `stateful-agent/session-*.tsv`, `stateful-agent/history-*.json`, `stateful-agent/egress-policy-*-live.yaml` | one session for each of two fidelities, the history after each suspend, and the egress policy with the credential swap |
| `tool-sandbox/tasks.tsv`, `tool-sandbox/egress-policy-live.yaml`, `tool-sandbox/lifecycle.log` | six commands in one actor, with a revert after each |
| `failure-drill/drill-run.log` | six failures with the symptom, the fix, and the recovery of each |

### R-agent-executor: Agent Executor at one commit on Substrate v1.0.0

All steps ran on a second x86 server guest (16 vCPU, 31 GB), on the cluster of `N-demos`, after the demos. Agent Executor was built from source at commit `a72b8ca46cb5`. No task used a model, and every task ran `sleep infinity`. The worker-loss test did not run here, because the tasks sat on pools of other experiments. `S-ax-model` ran it later.

| Folder | What it shows |
|---|---|
| `00-source/refs-and-pins.txt` | the commit, the tags, and the Substrate version that each module file requires |
| `10-install/steps.tsv`, `10-install/51-apply-before-grant.log`, `10-install/62-ax-pool.yaml` | each install step with its exit code and seconds, the failure before the Substrate grant, and the WorkerPool that we created |
| `20-inventory/` | the CRDs of the cluster, the five tables of the Agent Executor database, the images, and the memory at idle |
| `30-concept-map/` | one task as `ax` shows it, and the actor, the template, the tag, and the missing egress policy behind it |
| `40-lifecycle/20-survive-before.txt`, `40-lifecycle/25-survive-after.txt`, `40-lifecycle/30-cycles.tsv`, `40-lifecycle/11-state-changes.tsv` | what one suspend and resume kept, 10 timed cycles, and each state change of the actor |
| `50-idle/10-idle-watch.tsv` | 600 s with no request and the actor state every 15 s |
| `60-gateway-model/`, `98-model/` | a Gateway that was stored, a task with `spec.gateway` that was rejected, and a Model with a Secret that did not exist |
| `70-workspace/` | a workspace with one inline file and one Git repository, the blocked clone, and the condition that reported it as ready |
| `80-networking/` | the ports of the router Service, plain HTTP on port 80, and the tunnel that `ax ssh` uses |
| `90-nodebug/`, `99-delete/` | `ax ssh` without `debug: true`, each delete with its seconds, and what stayed on Substrate |
| `95-failure/04-SKIPPED.txt` | why no worker pod was deleted |

### S-ax-model: a small real model, kagent with it, and five open items of Agent Executor

All steps ran on a second x86 server guest (16 vCPU, 31 GB), after `R-agent-executor`. The model server was Ollama 0.40.16 in a container on the guest, with 12 CPUs, one request at a time, and no GPU. The models were `qwen2.5:3b` (1.9 GB) and `qwen2.5:1.5b` (986 MB). They are small models on CPU, so the model seconds in these files are not the model seconds of a GPU or of a hosted model.

| Folder | What it shows |
|---|---|
| `10-model/10-bench.tsv`, `10-model/06-list.txt` | tokens per second over 5 requests and 10 tool calls for each model, and the size of each model |
| `20-kagent/01-real-model.yaml` | the ModelConfig, AgentTemplate, and Agent objects that point kagent at the model server |
| `20-kagent/loop/per-turn.tsv`, `timings.tsv`, `summary.txt` | 50 kagent turns: for each turn the time at the client, the seconds of its model requests, and the resume and suspend seconds from the log of `ate-api-server`. `per-turn.tsv` is made by `_scripts/s12-kagent-analyze.py` from `timings.tsv`, the model server log, and `ate-api.log` |
| `20-kagent/loop/stuck-turn-*`, `C-1p5b-first-3.err` | the turn that did not end: the actor state, the token count of the model server, the client error, and the restart note |
| `30-ax-clone/` | a workspace clone with no rule, with an `https` rule, with a `tlsPassthrough` rule without a port, and with the rule that worked |
| `40-ax-worker-loss/`, `41-ax-worker-loss-durable/` | a worker pod deleted under a task, 8.7 s and 307 s after the last suspend, with the files that the task found after `ax resume task` |
| `50-ax-v031/` | the release v0.3.1 installed on Substrate v1.0.0, and the two errors of its controller |
| `60-ax-model/` | a `Model` object beside a task, the environment of the task, and 20 model calls through an `http` rule on the actor |
| `70-agent-image/` | the Claude Code example image against the local model server: the build, the task, the actor log, and the workspace after the run |

In `per-turn.tsv`, a resume or suspend of 0 means that the saved log window held no record for that turn. The row `C-1p5b-first-4` holds the model seconds of the request that it waited behind, so its model seconds are larger than its wall seconds. `run.py` leaves both cases out of the statistics.

### W-ax-kagent-2: a bound on a kagent turn, and four more open items of Agent Executor

All steps ran on a second x86 server guest (16 vCPU, 31 GB), after a restart of the guest, on the two clusters of `S-ax-model` and with the same model server. kagent used `qwen2.5:1.5b`, and Agent Executor used `qwen2.5:3b`. Two containers of another experiment ran on the same guest, so read the seconds as indicative. What a model wrote or decided in these files is a result about that small model.

| Folder | What it shows |
|---|---|
| `10-kagent-bound/00-explain-*.txt`, `01-bounded.yaml` | the three ModelConfig fields as the cluster describes them, and the two ModelConfig objects with one bound each |
| `10-kagent-bound/events.log` | one line for the start and the end of each turn: 7 turns with a prompt that the model ended by itself, 10 tool turns with each bound, and 10 first turns with no bound |
| `11-long-prompt/results.tsv` | three prompts sent to the model server directly, to find one that keeps the model writing |
| `12-kagent-bound-long/events.log`, `timings.tsv`, `ollama-gin.log`, `*.after.log` | the count prompt with `maxTokens: 128`, with `timeout: 20`, and with no bound: the result of each turn, the request seconds at the model server, and the actor state and the CPU of the model server after the turn |
| `20-ax-flight/w-fl1/`, `w-fl2/` | a worker pod deleted while two `ax ssh` commands were open, 12 s and 329 s after the last suspend: each line that the open command printed, both client errors, the actor state changes, and the workspace after `ax resume task` |
| `30-ax-mcp-skills/` | a Workspace with a skills path, registries, and four MCP server entries: what `ax` accepted, the command line that the agent received, the warnings of the runner, the skills directory, and the log of the MCP server |
| `31-ax-mcp-call/w-mcp2/`, `w-mcp3/` | two tasks whose prompt names the MCP tool, with the tool call in the log of the MCP server |
| `40-ax-example/` | the Claude Code example of the repository with its own prompt and repository: the three changed values, the failed resume at 4Gi, the refused second apply, the run at 1536Mi, the report, and the state of the checkout |
| `40-ax-example-attempt1/` | the resume that failed once after the delete and the new create, with the worker list |
| `50-ax-clone-2/`, `51-ax-agent-image-2/` | second runs of the clone on resume and of the short agent prompt |

In `20-ax-flight/`, the exit code in `20-inflight-sleep.end` is 0 beside an error text. We do not trust it, so `run.py` does not read it. In `40-ax-example/26b-egress-hosts.log`, one line is wrapped inside a host name.

### T-drain-store: a drain, a full node, and a bucket outside the cluster

All runs used a second x86 server guest (16 vCPU, 23 GB), on the cluster with two worker nodes, with the Envoy dataplane and gVisor. Each case ran once. The test actor holds a counter and 50 MB in memory. The column `t` is seconds from the drain command, the stop command, or the moment the bucket went away.

| File | What it shows |
|---|---|
| `00-run.log`, `09-start.txt`, `04-pdb-and-grace.txt`, `05-atelet-args.txt` | the order of the runs, the state at the start, the disruption budgets, the grace period of the pool pods, and the atelet arguments |
| `10-a-running.tsv`, `40-d-mid-request.tsv` | a drain under a running actor, with one request each second, and with one request of 120 s open |
| `20-b-suspended-sync-quiet.tsv`, `25-b2-suspended-sync-requests-during-drain.tsv` | a drain under an actor that was suspended with `--mode sync`, with no request and with requests |
| `30-c-suspended-async-pending.tsv` | a drain under an actor whose newest snapshot was PENDING on the node |
| `drain-*.log`, `return-*.tsv`, `workers-*.txt` | the output of each drain, the node after each uncordon with the placement of 15 new actors, and the worker list |
| `52-f1b-survivor-full-then-free-a-worker.tsv`, `62-f2b-survivor-full-then-scale-pool.tsv` | a node stop with the other node full, ended by a freed worker and by a larger pool |
| `70-f3-survivor-full-no-revert-request-only.tsv`, `78-control-plane-events.log` | both nodes up and all four workers full, with the log lines of the step `DetachFromFullNode` |
| `80-store-run.log`, `81-patches.log`, `82-atelet-args-patched.txt`, `86-store-container.log` | the bucket outside the cluster and the shortened atelet timers |
| `83-netem-rtt.txt` | the connect time from a node to the bucket at each added delay |
| `90-store-cycles.tsv` | every cycle of a synchronous suspend and a resume from the bucket |
| `95-store-unreachable.tsv`, `96-store-unreachable-logs.log`, `97-store-unreachable-recovery.tsv` | the bucket away with refused connections and with dropped packets, and the recovery |
| `98-atelet-args-restored.txt`, `99-state-left.txt` | the cluster after the runs |
| `_scripts/` | the scripts that made these recordings |

Three parts of these files are not valid, and `summary/object-store-x86.json` does not use them. In `95-store-unreachable.tsv`, the request rows after 16:50:45 UTC with code `000` come from a client error. The row `blackhole-request-new-actor` in that file has code 200 and is used. In `97-store-unreachable-recovery.tsv`, the rows from `refused-prepared` to the end are not valid, because the bucket was away for less than 1 s. The first attempts `50-f1` and `60-f2` sent requests to port 0 and are not in this folder.

The bucket outside the cluster ran on the same guest. The delay of `tc netem` was set in one direction, so the value is the added round trip.

### X-remote-store-pg: a bucket and a Postgres on another machine

All runs used a second x86 server guest (16 vCPU, 23 GB), with the Envoy dataplane and gVisor. The bucket cycles and the bucket outages ran on the cluster with two worker nodes. The database runs used a new kind cluster with one node. The bucket and Postgres ran in containers on the guest with 31 GB. The two guests reach each other through the user-mode network of the hypervisor, and `13-path.txt` holds the connect times and the copy times of that path.

| File | What it shows |
|---|---|
| `00-health.txt`, `01-health-after-wait.txt`, `00-run.log` | the cluster after a restart of the guest, and the order of the runs |
| `10-store-run.log`, `11-patches.log`, `12-atelet-args-*.txt`, `_scripts/x1-store.sh` | the endpoint and timer changes, and the patch that gives the object store plugin a CA |
| `13-path.txt` | five connects from a node and one copy of 300 MiB, for each path and limit |
| `19-tls-store-check.txt` | the bucket over TLS, with and without the CA |
| `22-store-cycles.tsv` | every cycle: the synchronous suspend, the first answer, the number of requests, and the seconds to the first 200 |
| `30-outage-stopped.tsv`, `30-outage-dropped.tsv`, `31-outage-*-logs.log` | the bucket away with actors that hold 200 MiB, stopped and with dropped packets |
| `40-pg-install/` | the install against Postgres on the other guest |
| `50-pg-tests/05-pg-round-trip.txt`, `10-lifecycle-delay*.txt`, `11-cycles-delay*.tsv`, `12-running-requests-delay*.tsv` | the query round trip and the lifecycle, with no delay and with 20 ms |
| `50-pg-tests/30-timeline*.tsv`, `33-probe*.tsv`, `34-api-server-log*.excerpt.txt`, `47-worker-cache-lines.txt` | two outages of the database, one request each second, and the retries of the worker cache |
| `50-pg-tests/37-follow-up.txt`, `38-x-run-diagnosis.txt`, `39-x-run-diagnosis-2.txt`, `41-x-run-recovery.txt`, `42-x-run-router-restart.txt` | the running actor that stayed at 504 after the first outage, and the router restart that ended it |
| `99-state-left.txt` | the clusters after the runs |

These parts are not valid, and the summaries do not use them. `20-store-cycles.tsv` is a first attempt in which a 504 led to a revert; `22-store-cycles.tsv` replaces it. In `13-path.txt`, the download times under the two rate limits are not shaped, and one block of probes under 20 Mbit/s shows code `000`. In `30-outage-*.tsv`, the row `async-state-after-wait` is one sample and not a wait. In `50-pg-tests/33-probe.tsv`, the one row with code 404 came from a list of actors that ran out. In `50-pg-tests/05-pg-round-trip.txt`, the line that starts with `qdisc` under the first heading shows the rule for another address.

The rows with 100 ms of added delay on the path between the guests are valid for that path only. The access key of the bucket shows as `<store-key>`, and the connection strings show `<user>` and `<password>`.

### Y-reruns-rollback-scale: second runs of the outages and the upgrade, a rollback, and v0.6.0

All runs used the x86 server guest (24 vCPU, 47 GB, nested KVM), on new kind clusters with one node. The outages and the upgrade used the release images, the Envoy dataplane, gVisor, and the bundled Postgres. The v0.6.0 runs used a build from source at that tag. Each outage, upgrade, and rollback ran once.

| File | What it shows |
|---|---|
| `10-outages/00-install/`, `01-setup/` | the install, the pool of 60 workers, the template, and the probe loop with its client limits |
| `10-outages/1*-pg-run*/`, `20-api-run1/`, `30-k8s-run1/` | three outages of Postgres, one of `ate-api-server`, and one of the Kubernetes API server, in that order on one cluster |
| `10-outages/*/00-timeline.tsv`, `10-probe.tsv` | the moments of each outage, and every request of the three streams |
| `10-outages/*/11-running-after.txt`, `12-stuck.txt` | three requests to each of six running actors after each run, and the list of actors that did not answer |
| `10-outages/*/14-ateapi-worker-cache.log`, `17-states-after.txt` | the retries of the worker cache, and the count of actors in each state after each run |
| `20-upgrade/00-install-rc3/`, `10-before/` | the install of v1.0.0-rc.3 and the actors made before the upgrade |
| `20-upgrade/20-upgrade/`, `20-upgrade/40-rollback/` | the upgrade and the rollback, each with its timeline, its three streams, the watch of the pool roll, and one request to each actor after it |
| `40-v060/00-install/`, `10-before/` | the install of v0.6.0 by its README, and the four actors made on it |
| `40-v060/20-direct-upgrade/` | the v1.0.0 installer on the v0.6.0 cluster, and what the old system and the new CLI did after it |
| `40-v060/30-reinstall/` | the delete, the three deploys, the stuck CRD, the image cache error, and the empty system at the end |
| `40-v060/40-ax031/` | the release v0.3.1 of Agent Executor on a fresh v0.6.0 |
| `30-scale/` | the setup of a burst run that produced no data |

These parts are not valid, and the summaries do not use them. In `10-outages/30-k8s-run1/10-probe.tsv` the stream `suspended` failed because running actors from the earlier runs filled the pool. `10-outages/*/19-summary.txt` counts the whole window of a run. `10-outages/*/18-states-after-cleanup.txt` repeats `17-states-after.txt`, because the cleanup step did not run. In `30-scale/` the Kubernetes API server of the cluster stopped answering, and no burst has a row.

### U-pg-upgrade-scale: a Postgres outside the cluster, one upgrade, and bursts on one node

All runs used the x86 server guest (24 vCPU, 47 GB, nested KVM), on new kind clusters with one node, from the release images, with the Envoy dataplane and gVisor. The cluster of the earlier experiments was idle on the same guest. Each install, outage, and upgrade step ran once.

| File | What it shows |
|---|---|
| `10-extpg-install/steps.tsv`, `10-extpg-install/30-deploy-*.log` | three tries of the install against a Postgres outside the cluster |
| `10-extpg-install/20-pg-setup-attempt2-no-transaction.log`, `10-extpg-install/20-pg-setup.log` | the database script without and with one transaction |
| `10-extpg-install/29-deploy-diff.txt`, `41-ate-system-objects.txt`, `43-pg-connections-and-tables.txt`, `45-install-record.yaml` | the settings that differ, the objects of the install, the TLS connections, and the install record |
| `20-extpg-tests/10-lifecycle.txt`, `20-extpg-tests/11-cycles.tsv` | create, request, both suspend modes, and ten cycles of suspend and resume |
| `20-extpg-tests/30-timeline.tsv`, `33-probe.tsv`, `34-api-server-log.excerpt.txt` | the database stopped for 60.6 s, one request each second, and the log lines of the worker cache |
| `30-upgrade-v0.6.0/` | an install of v0.6.0 from the release images, which fails with a 404, and the release tags that the registry holds |
| `30-upgrade-v1.0.0-rc.3/00-install-v1.0.0-rc.3/`, `10-before/` | the install of the release candidate and one actor of each kind before the upgrade |
| `30-upgrade-v1.0.0-rc.3/20-upgrade/00-timeline-steps.tsv` | each upgrade step with its begin, end, and seconds |
| `30-upgrade-v1.0.0-rc.3/20-upgrade/02-cycle-stream.tsv`, `03-api-stream.tsv`, `05-running-stream.tsv` | the three streams during the upgrade |
| `30-upgrade-v1.0.0-rc.3/30-after/10-actors-after.txt` | one request to each actor after the upgrade |
| `30-upgrade-v1.0.0-rc.3/40-worker-roll-on-v1.0.0/` | a second roll of the pool, with one actor that exits on SIGTERM and one that handles it |
| `40-scale/00-setup/` | one node with a pod limit of 250 and a pool of 200 workers |
| `40-scale/10-run/20-concurrency.tsv`, `40-scale/10-run/bursts/c*-r*.tsv` | bursts of 1 to 150 resumes, three for each size, and every request of each burst |
| `40-scale/10-run/10-waves.tsv`, `40-scale/10-run/30-rows.tsv`, `31-resume-with-rows.tsv` | three waves of 150 new actors, and resumes with 1,750 to 10,750 actor rows |
| `40-scale/05-first-attempt-client-error/` | a first attempt whose bursts failed on a client setting. It left 300 actors that never ran |

The connection strings in these files show `<user>` and `<password>`. The passwords and the CA key of the lab database were never copied. `10-run/33-pg-tables-at-stop.txt` holds only an SQL error of ours.

### P-node-loss: a worker node that stops and stays down

All cases ran on a second x86 server guest (16 vCPU, 23 GB), on the cluster with two worker nodes, with the Envoy dataplane and the default atelet timers. Each case ran once. The pool `ballast` had two worker pods on each worker node. The column `t` is seconds from the `docker stop` command of the node `multi-worker2`. The test actor holds a counter and 50 MB, so `count` in a reply shows which snapshot the actor came from.

| File | What it shows |
|---|---|
| `00-run.log`, `01-atelet-args.txt`, `02-start.txt` | the order of the runs, the atelet arguments, and the nodes, pods, and workers at each start |
| `10-a-quiet-revert.tsv`, `11-a-actor.yaml` | a sync-suspended actor with no request, and one revert after the workers were unavailable |
| `74-second-revert.tsv`, `75-second-revert-actor.yaml` | five reverts of one actor: four while the node was down, one after its atelet was back |
| `20-b60-requests-revert-loop.tsv`, `30-bevict-requests-revert-after-eviction.tsv` | a suspended actor that gets requests, with reverts from 60 s and with reverts after the eviction |
| `40-balt-suspend-resume-delete.tsv` | `suspend`, `resume`, and `delete` on an actor that is bound to the stopped node |
| `50-c-pending-snapshot.tsv`, `55-c-pending-snapshot-with-requests.tsv` | an async-suspended actor with a PENDING snapshot, with a quiet revert and with requests |
| `88-pending-snapshot-node-returns.tsv`, `89-v-actor.yaml`, `89-w-actor.yaml` | two async-suspended actors after the node returned: one request with no revert, and one revert first |
| `60-d-running.tsv`, `61-d-actor.yaml` | a running actor, with reverts, a suspend, and a delete during the outage |
| `80-tag-rescue.tsv`, `81-tags.txt`, `82-rescued-actor.yaml` | a tag made before the stop, tag attempts on the stuck actor, and a new actor from the tag |
| `85-tag-rescue-running-and-pending.tsv`, `86-tags.txt` | a rescue of a running actor from two tags, one of them made while the snapshot was PENDING |
| `70-e-no-spare-then-scale.tsv`, `72-e2-survivor-full-then-scale.tsv` | two tries to fill the other node. Both left room, so the revert worked |
| `72-e2.FAILED-no-golden-tag.tsv`, `74-second-revert.FAILED-no-golden-tag.tsv`, `96-golden-tag-deleted.txt`, `97-tmpl-nb-*.yaml` | two cases that failed because our clean-up had deleted the golden tags, the proof, and the new templates |
| `return-*.tsv` | the node after each start: when it was Ready, its pool pods, its active workers, and where a new actor went |
| `workers-*.txt` | the worker list at marked moments of each case |
| `91-k8s-node-events.txt`, `92-control-plane-events.log`, `90-final.txt`, `95-final.txt` | the node events of Kubernetes, the control plane log lines, and the state at the end |
| `_scripts/` | the scripts that made these recordings |

In `return-a.tsv`, the counters `pool-pods-running-on-node` and `workers-active-on-node` read 0 after the first sample, while a new actor went to the node. Use the placement column of that file, and not the counters. In `return-pend.tsv` and `return-rev.tsv` the trace started after the node, so the outage is in the case file.

### Q-network: eight network and limit checks on both dataplanes

All checks ran on a second x86 server guest (16 vCPU, 23 GB), on the cluster with one kind node. The cluster started on agentgateway v1.7.0. It was switched to Envoy and back in place, twice. The node-stop cases of `P-node-loss` ran on the same guest at the same time, so read a difference of a few milliseconds as noise.

| Folder | What it shows |
|---|---|
| `00-dataplane-switch-to-envoy/`, `00-dataplane-switch-to-agentgateway/` | the second switch in each direction: the installer log, the seconds, the pods, and what was left of our manual changes to `atenet-egress` |
| `g-dependency-loss-agw/` | the three outages of `E-dependency-loss` on agentgateway, with the same file names |
| `h-keepalive/<dataplane>/results.txt` | 20 requests on one connection, with the rule removed after about 13 s, for HTTP/1.1 and for HTTP/2 |
| `i-model-gateway/gw-tls.yaml`, `gw-plain.yaml`, `workloads.yaml`, `mock.py`, `Pgw.yaml` | a model gateway with two mock backends, and the egress policy of the actor |
| `i-model-gateway/20-results-*.txt`, `23-mock-*-received-*.log`, `24-marker-counts-*.txt` | each request and what each backend received. The files with `private-ca-trusted` in the name were made after the trust patch |
| `i-model-gateway/31-latency-*.tsv`, `51-connection-cost-*.tsv` | the latency of each path with a new connection for each request, and with one reused connection |
| `i-model-gateway/40-egress-agentgateway-config.yaml`, `41-egress-503-line.log`, `44-envoy-egress-503.excerpt.log` | where the gateway reads its upstream roots, and the log line of the 503 on each dataplane |
| `i-model-gateway/43-trust-patch.json`, `43-trust-patch.log`, `45-trust-patch-envoy.log` | the patch that adds a private CA to the egress gateway |
| `j-log-level/10-volume.tsv`, `log-*-marker-lines.txt`, `set-*.log` | lines and bytes of the agentgateway egress log for 100 requests at `debug`, `info`, and `warn` |
| `k-suspend-cutoff/<dataplane>/10-events.tsv`, `12-drip-server-after-suspend.log` | a suspend while the actor held an open response, and when the upstream saw the connection gone |
| `l-credential-rotation/<dataplane>/20-rotations.tsv`, `10-probe.tsv` | three changes of a Kubernetes Secret, and the value that the upstream saw in each request |
| `m-router-ports/<dataplane>/` | the router Service, the container ports, the rendered listeners, and a probe of each port from two pods |
| `n-cpu-limit/40-work.tsv`, `42-cgroup-after.txt`, `22-cgroup-*.txt`, `41-info-*.json` | a fixed amount of work under four CPU limits, the cgroup of each actor on the node, and what the program saw inside |
| `n-cpu-limit/10-burn.tsv` | the first test, which is not valid. It stopped each run on CPU time that was read inside the sandbox |
| `_scripts/` | the scripts that made these recordings |

In `m-router-ports/envoy/10-port-probes.tsv` and `11-port-probes-supplement.txt`, the text after the `|` on a row with status `000` is left over from an earlier request. Read only the status, the exit code, and the error on those rows.

The credential values in this folder are test values that we made up: `placeholder-from-actor`, `provider-key-for-backend-a`, `provider-key-for-backend-b`, `lab-gw-client-credential-...`, `lab-header-marker-123`, `lab-auth-marker-456`, and `rot-value-...`.

### V-validation: twelve checks of statements that the first draft could not prove

All twelve ran on the x86 server guest, on the cluster of experiments A to D, with a pool `vpool` of two workers that hold 16 one-CPU actors.

| Folder | What it shows |
|---|---|
| `00-setup/` | the ballast v3 actor (`ballast3-main.go`) and the pool |
| `01-compressible/10-compressible.tsv` | snapshot size, resume, and both suspend modes for 200 and 500 MiB of zero bytes, half zero and half random bytes, and random bytes |
| `02-python-runtime/10-python.tsv`, `img/app.py`, `tmpl-pyagent.yaml` | a Python server with a dict of one million values: the golden snapshot build, first calls, resumes, suspends, and snapshot sizes |
| `03-parallel-resume/20-parallel.tsv`, `24-summary.tsv` | 1, 2, 4, 8, and 16 resumes at the same instant, five rounds each |
| `03-parallel-resume/10-parallel-first-run-n16-n32.tsv`, `11-workers-before-32.txt` | an earlier run with 14 free places: 16 at once, 32 at once, and 32 at once with 16 actors suspended during the wait |
| `04-fidelity/10-fidelity.tsv`, `tmpl-fid-*.yaml` | one actor for each fidelity, with a count in memory, on the root filesystem, and on a volume, and a child process |
| `05-golden-race/10-race.tsv` | an actor created before the golden snapshot of its template exists |
| `06-template-move/10-move.tsv` | `update actor --template` on a running and on a suspended actor |
| `07-cross-namespace-pool/` | a template in an atespace with no namespace on a pool of another namespace, and a selector that matches no pool |
| `08-access-control/10-access.tsv`, `policy-viewer.yaml`, `15-policy-lab-v-editor.yaml` | one ServiceAccount with no role, as viewer, and as editor, a text that is no token, and a token with the wrong audience |
| `09-actor-jwt/24-jwt-decoded.txt`, `20-jwt-second-try.tsv`, `12-policy-live.yaml` | the header and the claims of one actor JWT, without its signature, and the use of one token for several requests |
| `09-actor-jwt/10-jwt.tsv`, `14-jwt-decoded.txt` | the first try, where the host name did not resolve |
| `10-preview-feature/10-preview.tsv`, `tmpl-gep.yaml` | the four combinations of the server flag and the client flag for `GoldenEgressPolicy` |
| `10-preview-feature/13-ateapi-lines.log` | the `ate-api-server` log of that test, with the reconcile errors of the template whose selector matches no pool |
| `11-process-exit-long-watch/10-watch.tsv`, `11-workers-end.txt` | two actors whose process exited, state every 15 s for 20 minutes, then a suspend and a revert |
| `12-suspend-during-request/10-inflight.tsv` | a suspend 2 s into a request of 10 s, in both modes |
| `_scripts/` | the scripts that made these recordings |

The JWT files hold decoded claims only. No file in this folder holds a signed token.

### _scripts

The shell scripts that made the recordings. Each one ran inside a guest, or on the Mac for `m2-install.sh` and `m3-actors.sh`.

## Summary files

`lab/summary/*.json` is the input of the chart figures, with two exceptions. Figure 1.2b reads `B-lifecycle/10-trace.tsv`, and figure 6.6 reads the container statistics in `G-dataplane/`. `run.py` does not rebuild or check the numbers of those two figures. Each file has `machine` and `sources`. A statistic is an object `{median, min, max, n}` in seconds.

| File | Fields |
|---|---|
| `resume-x86.json` | `node_local`, `object_store`, `object_store_default_timers`, `new_actor_first_call`, `warm_call`, `create_actor`, `detach_wait`. Each has `points`: `[{x, seconds, runs, failed}]`, where `x` is MiB held and `runs` lists every run in seconds |
| `resume-mac.json` | `node_local`, `new_actor_first_call`, `suspend_async`, `warm_call`, same `points` shape |
| `suspend-x86.json` | `async`, `sync`, same `points` shape |
| `footprint-x86.json` | `local_snapshot_per_actor`: `[{x, kib, mib}]`. `with_25_suspended_actors` and `after_delete`: `node_snapshots_mib`, `node_snapshot_cache_mib`, `object_store_mib` |
| `timers-x86.json` | `actors`: `[{actor, mib, suspended_at, uploaded_at, detached_at, seconds_to_upload, seconds_to_detach}]`. `node_local_snapshots`: `[{t, mib}]` |
| `failures-x86.json` | `idle_watch`: `{seconds, samples_after_last_request, states}`, which counts only the samples between the start and the end of the watch. `lifecycle_ops`, `local_snapshot_loss`, `node_restart`, `death_inside_sandbox`: `[{t, case, event, fields}]` |
| `parking-x86.json` | `load_run`: `{requests, ok, shed_503, ok_average_seconds, ok_slowest_seconds, actors, workers, seconds}`. `parking_trace`. `full_pool_503`: `{seconds, body}` |
| `dependency-loss-x86.json` | `outages.postgres`, `outages.ate-api-server`, `outages.kube-apiserver`. Each has `outage_seconds`, `dependency_ready_t`, `summary.<stream>`, and `per_second.<stream>`: `[{t, code, seconds, ok}]`. The streams are `running`, `suspended`, and `proxy` |
| `dependency-loss-agw-x86.json` | the same fields as `dependency-loss-x86.json`, for the run on agentgateway |
| `node-loss-x86.json` | `detection`: `workers_unavailable_t`, `pods_evicted_t`, `actor_crashed_t_while_down`, each `{median, min, max, n, runs}`. `cases`: one entry for each case, with `probes` (`requests`, `ok`, `codes`, `actor_states`), `commands` (`total`, `ok`, `errors`, `runs`), and `served`. `tag_rescue`, `second_revert`, `node_return` (`before_eviction`, `after_eviction`, `runs`), and `golden_tag_deleted` |
| `node-drain-x86.json` | `cases`: one entry for each of five drains, with `drain_returned_seconds`, `requests_after_drain`, `failed_after_drain`, `actor_crashed_seen_t`, `revert`, `first_ok_seconds`, `calls_lost`, `probes`: `[{t, code, seconds}]`, and `return`. `after_uncordon` |
| `full-node-x86.json` | `node_stopped_other_node_full`: two runs with `revert`, `blocked_requests`, `resume_command_error`, `unblock`, `served_after_unblock`. `both_nodes_up_all_workers_full` |
| `object-store-x86.json` | `cycles`: `[{store, added_round_trip_ms, mib, suspend_sync_seconds, resume_from_store_seconds}]`, each with `{median, min, max, n, runs}`. `delay_check`. `store_unreachable.refused` and `store_unreachable.packets_dropped`. `not_recorded` |
| `external-postgres-x86.json` | `install`, `lifecycle`, `cycles`, and `outage` with `summary.<stream>` and `per_second.<stream>`: `[{t, code, seconds}]` |
| `remote-store-x86.json` | `path`: one entry for each path and limit, with `connect_ms` and `copy_300_mib_seconds`. `cycles`: `[{store, added_round_trip_ms, rate_mbit, mib, suspend_sync_seconds, first_answer_codes, first_answer_seconds, requests_until_200, seconds_to_first_200}]`. `bucket_unreachable.stopped` and `bucket_unreachable.packets_dropped` |
| `remote-postgres-x86.json` | `install`, `round_trip`, `lifecycle.<delay>`, `outages.run_1` and `outages.run_2` with `summary.<stream>`, `stuck_actor_run_1`, `worker_cache_run_2` |
| `upgrade-x86.json` | `steps`: `[{step, begin_t, end_t, seconds, exit}]`. `suspend_resume_stream`, `list_actors_stream`, `running_actor`, `actors_after_upgrade`, `worker_roll_on_v1_0_0`, `release_tags_in_registry` |
| `scale-x86.json` | `bursts`: one entry for each burst size, with `runs`: `[{requests, ok, wall_seconds, per_second, median_seconds, max_seconds, request_seconds}]`. `single_resume_seconds`, `waves`, `rows`, `idle_worker_memory_mb` |
| `rotation-x86.json` | `dataplanes.agentgateway` and `dataplanes.envoy`. Each has `changes`: `[{change, seconds, requests_with_old_value}]`, `seconds`, `probe_requests`, `values_seen`, and `seconds_between_first_seen` |
| `cpu-limit-x86.json` | `points`: `[{x, threads, wall_seconds, host_cpu_seconds, host_cores_used, cpu_seconds_reported_inside, throttled_periods, runs}]`, where `x` is the limit in millicores. `seen_inside_the_actor`, `cgroup_cpu_max_of_actor`, `worker_pod_limits`, and `superseded_first_test` |
| `network-x86.json` | `keepalive_after_rule_removal`, `suspend_cutoff`, `egress_log_level`, `model_gateway`, `router_ports`, each with one entry for each dataplane, and `dataplane_switch`. Latencies of `model_gateway` are in milliseconds |
| `kagent-turns-x86.json` | `client_seconds.<series>`, `server_turn_seconds.<series>`, `resume_seconds.turns_only`, `resume_seconds.all`, `suspend_seconds` |
| `kagent-model-x86.json` | `models.<name>`: `size`, `tokens_per_second`, `tool_call`. `series.<name>`: `n`, `completed`, `clean`, and `wall_seconds`, `model_seconds`, `model_share`, `resume_seconds`, `suspend_seconds` as `{median, min, max, n}`. `runs.<name>`: one entry for each turn. `turn_that_did_not_end` |
| `agent-executor-followups-x86.json` | `clone`, `worker_loss.snapshot_pending`, `worker_loss.snapshot_durable`, `model_call`, `agent_image`, `release_v0_3_1` |
| `kagent-bound-x86.json` | `modelconfig_fields`, `settings`, `prompts`, `direct_requests_to_the_model`. `series.<name>`: `bound`, `prompt`, `n`, `completed`, `exit_codes`, `wall_seconds` as `{median, min, max, n}`, and `runs` with one entry for each turn. `timeout_failure`, `unbounded_turn` |
| `agent-executor-second-x86.json` | `worker_loss_in_flight.snapshot_pending` and `snapshot_durable`, `skills`, `mcp`, `example`, `clone_second_run`, `agent_image_second_run` |
| `install-steps.json` | `source_build`, `release_images`, `release_images_mac`, `kagent`. Each has `machine` and `steps`: `[{step, exit, seconds}]` |
| `microvm-x86.json` | `node_local`, `new_actor_first_call`, `suspend_async`, `suspend_sync`, `warm_call`, `create_actor`, with the `points` shape of `resume-x86.json`. `local_snapshot_per_actor`: `[{x, kib, mib}]`. `resident_memory`: `microvm` and `gvisor_same_node`, each a list of `{process, kib, mib}` |
| `validation-memory-x86.json` | `actors`: one entry for each of six templates, with `fill` (`zero`, `mixed`, `rand`), `x` in MiB, `node_snapshot` and `object_store_copy` as `{kib, mib}`, and `resume_node`, `resume_after_sync`, `suspend_async`, `suspend_sync`, `new_actor_first_call`, `warm_call`, each `{seconds, runs, failed}`. `python`: the same fields for the Python actor, with `template_to_golden_ready`, `peak_rss_mib`, `image_bytes`, and the process age at its first and last request |
| `validation-parallel-x86.json` | `points`: `[{x, requests, ok, refused_503, seconds, p90, runs}]`, where `x` is the number of resumes at the same instant. `first_run.levels`: the same for the earlier run, with `refused_seconds`, `refused_runs`, and `refused_body`. `workers_before` and `first_run.workers_before`: booked and total millicores of the pool |
| `validation-fidelity-x86.json` | `levels`: one entry for each fidelity, with `after_last_resume` (`memory_count`, `rootfs_count`, `volume_count`, `process_age_s`), `process_age_after_resume_s`, `node_snapshot`, `object_store_copy`, and the timed fields of `validation-memory-x86.json` |

## What was removed

`lab/REDACTIONS.txt` lists every file that was left out, cut to an excerpt, or changed, with the reason. A file over 200 KB is kept as `<name>.excerpt.log`. Each line of an excerpt is a complete line of the original.

## Record it again on your cluster

1. Create a kind cluster with `hack/create-kind-cluster.sh` from the Agent Substrate checkout at v1.0.0.
2. Install with `ate-setup` as section 2.1 of the manual shows.
3. Run the script for the experiment from `lab/_scripts/`. The scripts write to `~/evidence/<folder>/`.
4. Copy the output over the same folder in `lab/`, then run `python3 capture/run.py`.

Your seconds will differ from ours. The states, the error texts, and the order of events must not.
