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
| the x86 server guest | a KVM guest on an x86 server, 24 vCPU, 47 GB, nested KVM, Ubuntu 24.04 | Docker 29.1.3, Go 1.27.3, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 built from source, Envoy dataplane, gVisor, and the microVM class for `L-gaps/microvm` |
| the second x86 guest | 16 vCPU, 23 GB, same host | Agent Substrate v1.0.0 from the release images, Envoy and then agentgateway v1.7.0. For `L-gaps/multinode`, a second kind cluster with one control plane node and two worker nodes |
| the kagent guest | 16 vCPU, 31 GB, same host | kagent v1.0.0 with its own Substrate distribution, a mock model server in the cluster |
| the Mac | an Apple silicon laptop under Docker Desktop, 10 CPU and 8 GB for Docker | Agent Substrate v1.0.0 from the release images, gVisor only |

The guests and the Mac are different machines. Do not compare a number from one with a number from another.

Each guest kept its disk in memory and reached the network through user-mode NAT. All clusters had one kind node, except the cluster of `L-gaps/multinode`. The object store was rustfs in the same cluster.

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
| `10-watch-part1.tsv`, `10-watch-part2.tsv` | five actors after an async suspend with default timers, state every 10 s for 38 minutes, then one resume each |
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

`lab/summary/*.json` is the only input of the chart figures. Each file has `machine` and `sources`. A statistic is an object `{median, min, max, n}` in seconds.

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
| `kagent-turns-x86.json` | `client_seconds.<series>`, `server_turn_seconds.<series>`, `resume_seconds.turns_only`, `resume_seconds.all`, `suspend_seconds` |
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
