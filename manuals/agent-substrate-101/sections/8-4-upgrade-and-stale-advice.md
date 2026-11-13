# Upgrade, and advice that no longer works

> No release before 1.0.0 upgrades in place, and most instructions written for those releases fail at v1.0.0 in a way that this section names.

You search for an error and find a tutorial from three months ago. Its first command runs a script that your checkout does not have. Its second command passes a flag that the CLI rejects. The tutorial was correct for v0.1.0. Agent Substrate changed its installer, its API package, its states, and its request path before 1.0.0, and it kept no compatibility with the old forms.

When you finish this section, you can translate an old instruction into the v1.0.0 form. You can also say which upgrades the project supports, and in which order the components move.

## Old instructions, and what they do now

The table lists each old instruction that we found in the v0.1.0 tree or in posts from that time. The middle column is what happens at v1.0.0. **The code** at the two tags is the source for each row, except where the text says that we ran it.

| Old instruction | What happens at v1.0.0 | What to do |
|---|---|---|
| `hack/install-ate-kind.sh --deploy-ate-system` | The script is not in the repository. | Run `ate-setup deploy ate-system`, as [section 2.1](#s-install-with-ate-setup) shows. |
| `go run ./tools/setup-gcp bootstrap` | The tool is not in the repository. It moved to a separate repository for GKE. | Follow [section 7.3](#s-substrate-on-gke). |
| `kubectl ate create actor --template-ref counter` | The flag does not exist. | Use `--template counter`. |
| `kubectl port-forward svc/atenet-router 8000:80`, then a `Host` header | Nothing listens on port 80. The router reads the `ate-target-actor` header and requires a client certificate. | Use `kubectl ate proxy actor`, as [section 2.3](#s-your-first-actor-and-the-proxy) shows. |
| `kubectl ate pause actor`, `PauseActor`, `ACTOR_STATE_PAUSED` | The command, the method, and the state do not exist. | Use `kubectl ate suspend actor`. |
| A stored state number such as 7 for crashed | The numbers changed. Crashed is 5, deleting is 6, and reverting is 7. | Store the state name, never the number. |
| `apiVersion: ate.dev/v1alpha1` in a WorkerPool | The CRD serves `v1` only, with no conversion. The apply fails. | Write `ate.dev/v1`. |
| A Go import of `pkg/proto/ateapipb` | The module is `go.ate.dev/substrate`, and the package is `api/ateapi/v1`. | Generate the client again from the v1.0.0 proto file. |
| A gRPC call to `/ateapi.Control/GetActor` | The service is `substrate.ateapi.v1.Control`. The old method name reaches nothing. | Use a client built from the v1.0.0 proto file. |
| Template fields `snapshotsConfig.onPause` and `sandboxConfig` | The fields do not exist. A template has `snapshotConfig.preferredFidelity`, and the sandbox class comes from the WorkerPool. | Write the template as [section 3.1](#s-actortemplate-and-the-golden-snapshot) shows. |
| A template with no resource limits | The API requires `cpuMillicores` and `memoryBytes` under `resources.limits`. | Set both. |
| A node label `ate.dev/substrate-version` | Nothing reads the label. | Remove the step. |
| The installer flag `--cordon-control-plane` | The flag is `--cordon-system-infra-components`, and the node label changed with it. | Use the new flag and the label `ate.dev/workloadType=ate-system-infra`. |

Two rows deserve more than a cell.

**The request path changed for security.** At v0.1.0 any pod that reached the router Service could call any actor with a `Host` header. At v1.0.0 the router asks for a client certificate and checks its identity against an allowlist. We probed the old ports on both dataplanes. On agentgateway, ports 80 and 8081 refused the connection. On Envoy they are not in the Service, and the connection timed out.

The two dataplanes differ in what they list. With Envoy, the router Service has ports 443 and 8444 only. The agentgateway overlay adds ports 80 and 8081 to the Service and to the NetworkPolicy {{code}}. Nothing listened behind them in our install. The gateway configuration that `ate-setup` installed declared ports 8443 and 8444 only, and the agentgateway process listened on those two {{run}}. So on agentgateway the Service lists two ports that refuse every connection.

Its fifth port is different: the stats port 15020 answered `/metrics` to a pod in another namespace, with no credentials. [The router and ingress](#s-the-router-and-ingress) has the port table and that note.

A tutorial that ends with a plain `curl` to the router cannot work. Do not look for a setting that brings the old path back.

**The API renumbered its states.** A state name in a response is safe. A number in a database column, a metric label, or an alert rule from before 1.0.0 now means a different state. An old rule that pages on state 7 pages on a revert.

## Advice that is stale in a quieter way

Some statements do not fail with an error. They are wrong, and the system runs.

| Statement | Where you read it | What we found |
|---|---|---|
| Substrate suspends an actor that has no requests. | the quickstart at the tag, and many posts | Nothing suspends it. The caller must call `SuspendActor`. |
| A suspend returns when the snapshot is safe. | tutorials for v0.1.0, where it was true | The default is asynchronous. The snapshot is on one node first. |
| The agentgateway dataplane accepts any client. | a reading of the manifests | The installer always adds the client certificate check. |
| A credential provider requires the Envoy dataplane. | the help text of the installer flag | The installer accepted the provider with agentgateway, and injection worked. |
| Upgrade with `NEW_RELEASE=v0.4.2`. | the example in the upgrade page at the tag | No v0.4.2 exists, and the same page excludes every 0.x upgrade. |

**We measured** the first two rows on an x86 server guest (24 vCPU, 47 GB, nested KVM). An actor with no requests for 900 s read RUNNING in 60 of 60 samples. After a default suspend, the snapshots of four actors stayed in the pending state. The upload finished 5 min 1 s to 5 min 11 s after the suspend. [Section 3.3](#s-suspendactor-and-resumeactor) and [section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) give both runs in full.

**Our position:** date every Substrate instruction before you follow it. If the text was written before 2026-11-05, check each command against the v1.0.0 help output first. The project made its largest breaks in the three weeks before the release. A post from October can be as wrong as one from July.

## Which upgrades the project supports

The upgrade page at the tag gives five cases. The version skew policy that it rests on starts at 1.0.0.

| From and to | Supported | What to do |
|---|---|---|
| A later patch of the same minor, such as 1.0.0 to 1.0.2 | yes, and you can skip patches | Follow the four steps below. |
| The next minor, such as 1.0 to 1.1 | yes | Follow the four steps below. |
| Two minors at once, such as 1.0 to 1.2 | no | Upgrade to 1.1 first. |
| A new major | no | Install again. |
| Any 0.x release to 1.0.0 | no | Install again, with a new database. |

The last row has a hard cause. The project merged all its schema migrations into one file on 2026-10-23, and `ate-api-server` refuses a schema that has no version. A database from before that date cannot be upgraded. Your actors and their snapshots from a 0.x cluster do not move to 1.0.0.

## The order, and what running actors see

Components move in a fixed order. A component is allowed to be one release newer than the ones after it, and never newer than the ones before it. [Figure 8.4](#fig-8-4) shows the four steps.

```figure
id: fig-8-4
kind: flow
title: the four steps of a supported upgrade
claim: Only the worker step ends running actors, and an actor has 30 minutes there only if its process survives SIGTERM.
caption: Read top to bottom. Each row is one step. The left box holds the components that move, and the right box says what a running actor sees. From the upgrade page and the version skew policy at v1.0.0.
```

1. `podcertificate-controller`, which signs the certificates that components show each other. Running actors see nothing.
2. `atelet`, one node at a time. Running actors keep running. In our two runs, suspends and resumes on the node failed for 24 s and for 34 s.
3. The workers. You change `spec.workerImage` of each WorkerPool, and the pool replaces 10 percent of its workers in each batch.
4. `ate-api-server` and `ate-idp-server`, then the CRDs and `ate-controller`, then the router and the egress gateway, then the SandboxConfig, then the rest of the system bundle.

Step 3 is the one that costs you work. Each actor on an old worker receives `SIGTERM`. The upgrade page gives it 30 minutes after that {{docs}}, and our run shows that the time exists only if its process survives the signal. Substrate does not suspend it in that time.

If nothing calls `SuspendActor`, the actor becomes `ACTOR_STATE_CRASHED` and loses its work since the last snapshot. This is the idle suspend rule again: your harness must act on the signal. A spot instance gives between 15 seconds and two minutes, never 30 minutes.

Step 4 has one action that cannot be undone. The first new `ate-api-server` pod migrates the database schema, and a rollback leaves the new schema in place. Take a database backup before step 4. You can roll back to the release you came from and no further.

**Our position:** before any worker upgrade, stop new requests and wait for the open ones. Then suspend every actor with `--mode sync` yourself. Keep requests stopped until the workers are replaced, because a request resumes an actor. A synchronous suspend puts the snapshot in the bucket before it returns. Then step 3 finds no running actors, and the 30 minutes do not matter.

## Two upgrades that we ran: v1.0.0-rc.3 to v1.0.0

No supported older release exists yet, because the policy starts at 1.0.0. The registry holds images for three release candidates and for v1.0.0, and for nothing older. An install of v0.6.0 from the release images failed with a 404 for its first image. So we installed v1.0.0-rc.3 and moved it to v1.0.0 by the steps above, twice, each time on a new cluster. The policy does not cover this path, and the two releases have the same schema version. [Figure 8.4b](#fig-8-4b) sets the steps of both runs against the request streams.

```figure
id: fig-8-4b
kind: timeline
title: two upgrades from v1.0.0-rc.3 to v1.0.0, against the request streams
claim: In both runs suspends and resumes failed in the atelet step, and a running actor that exits on SIGTERM crashed when the worker image changed.
caption: Read each panel left to right. The top row of a panel shows when each step ran. The rows below show each request of a stream, green for 200 and rose for a failure. The second run had a second running actor, which handles SIGTERM. From capture/lab/summary/upgrade-x86.json and capture/lab/summary/upgrade-rerun-x86.json.
```

**We measured** the first upgrade on the x86 server guest (24 vCPU, 47 GB, nested KVM). It had one kind node and a pool of 8 workers. Three streams ran during it. One suspended and resumed one actor about every 3.5 s. One listed the actors every 2 s. One sent a request each second to a `RUNNING` actor.

**We measured** a second upgrade on the same guest, once, on a new cluster with the bundled Postgres and a pool of 10 workers. The streams were the same, and the request stream went to two `RUNNING` actors. The process of one exits on `SIGTERM`, and the process of the other handles it.

| Step | Seconds, first run | Seconds, second run | What a client saw |
|---|---|---|---|
| 1, `podcertificate-controller` | 33.9 | 19.3 | nothing |
| 2, `atelet` | 30.9 | 40.7 | 7 suspend and resume cycles in a row failed over 24 s in the first run, and 10 over 34 s in the second. The suspend failed with `while getting atelet conn` or with `Unavailable` from `atelet`, and the request got 503 |
| 3, the worker image of the pool | 0.4 for the patch | 0.3 for the patch | the `RUNNING` actor that exits on `SIGTERM` crashed. In the first run it answered 503 from 1.2 s after the patch. In the second it answered 503 from 18 s, and it was `ACTOR_STATE_CRASHED` at the sample 22 s after the patch |
| 4a, `ate-api-server` and `ate-idp-server` | 28.4 | 45.3 | nothing |
| 4b, the CRDs and `ate-controller` | 12.3 | 19.4 | nothing |
| 4c, the router and the egress gateway | 21.8 | 40.7 | nothing |
| 4d, the SandboxConfig | 18.7 | 3.6 | nothing |
| 4e, the system bundle | 29.5 | 36.1 | nothing |

In the first run, step 1 to the end of step 4e took 343 s. That includes 160 s of watching the pool in step 3. The cycle stream had 103 good cycles of 110, and all 7 failures were in step 2. The list stream got an answer 211 of 211 times.

In the second run that time was 346 s, with 135 s of the worker step in it. The list stream got an answer 199 of 199 times. In both runs the schema version did not change, and every Substrate pod ran v1.0.0 at the end.

We made one actor of each kind before each upgrade and called each one after it.

| The actor before the upgrade | First run | Second run |
|---|---|---|
| Suspended with `--mode sync` at count 3 | 200, count 4 | 200, count 4 |
| Suspended in the default mode at count 3 | 200, count 4 | 200, count 4 |
| Suspended at count 5, with a tag | 200, count 6 | 200, count 6 |
| Created and never run | 200, count 1 | 200, count 1 |
| A new actor from the golden snapshot that the release candidate made | 200, count 1 | 200, count 1 |
| A new actor from the tag | 200, count 6 | 200, count 6 |
| `RUNNING` during step 3, with a process that exits on `SIGTERM` | `ACTOR_STATE_CRASHED`. 368 of 469 requests got 503. A `revert` took 0.22 s, and the count went back to 1 | `ACTOR_STATE_CRASHED`. 118 of 441 requests got 503. A `revert` took 0.22 s, and the count started again from the golden snapshot |
| `RUNNING` during step 3, with a process that handles `SIGTERM` | not in this run | 441 of 441 requests served. A suspend of 0.62 s moved it to a new worker, and it kept its count |
| In the suspend and resume loop during step 3 | every cycle of step 3 served | `ACTOR_STATE_CRASHED` 15 s after the patch, when its suspend failed with `Unavailable` from `atelet`. It stayed crashed for 395 s, until our `revert`. One call was lost |

So snapshots, tags, and the golden snapshot from the release candidate worked on v1.0.0 in both runs. The losses were in step 3. An actor that exits on `SIGTERM` crashed each time. An actor whose suspend was in progress when its worker went away crashed once, in the second run. Nothing repaired it until we sent a `revert`.

### The 30 minutes depend on the actor

The upgrade page gives each running actor `SIGTERM` and then 30 minutes {{docs}}. Our running actor did not get 30 minutes. Its process exits on `SIGTERM`, so the actor crashed in seconds.

**We measured** this in a second roll of the same pool, now on v1.0.0, once. Two actors ran. The process of the first exits on `SIGTERM`, and that actor was `ACTOR_STATE_CRASHED` at the first sample, 5 s after the patch. The process of the second handles `SIGTERM` and keeps running. That actor stayed `RUNNING` and answered 36 of 36 requests in 175 s, while its worker pod was `Terminating`.

We then suspended it with `--mode sync` in 0.64 s. It resumed on a new worker, and its count continued.

The second upgrade and the rollback below each had the same two actors, once. In both, the actor without a handler crashed, and the actor with a handler served every request and kept its count after a suspend. So the result holds in all our rolls of a pool. An actor without a handler crashed in 4 of 4, and an actor with a handler survived in 3 of 3.

So the window exists only for an actor whose main process survives `SIGTERM`. A program exits on that signal unless it has a handler.

Our runs also move the suspend earlier than the upgrade page puts it. Suspends and resumes failed for 24 s and for 34 s while `atelet` restarted on our one node. So stop requests and suspend every actor before step 2, and resume traffic after step 3. The actor that crashed in the loop shows the cost of a suspend that is still in progress when the worker goes away.

## A rollback that we ran: v1.0.0 to v1.0.0-rc.3

The upgrade page gives one sentence for a rollback. It is the same list in reverse, from the old release, and an actor that crashes goes back to its last snapshot with `kubectl ate revert actor` {{docs}}.

**We measured** one rollback, right after the second upgrade, on the same cluster. We ran it from the checkout of v1.0.0-rc.3 with the configuration that we saved before the upgrade, in the reverse order. Before it started, we reverted the actor that had crashed in the loop. The same three streams ran.

| Step | Seconds | What a client saw |
|---|---|---|
| 4d, the SandboxConfig | 3.5 | nothing |
| 4c, the router and the egress gateway | 23.3 | nothing |
| 4b, the CRDs and `ate-controller` | 5.0 | nothing |
| 4a, `ate-api-server` and `ate-idp-server` | 25.0 | nothing |
| 3, the worker image of the pool, back to v1.0.0-rc.3 | 0.4 for the patch | the actor that exits on `SIGTERM` answered 503 from 6.4 s after the patch, and 130 of 306 requests failed. A `revert` took 0.21 s, and its count started again from the golden snapshot. The actor with a handler served 306 of 306 |
| 2, `atelet` | 12.7 | one suspend and resume cycle failed |
| 1, `podcertificate-controller` | 3.7 | nothing |

We did not run step 4e in reverse. After the rollback every actor returned 200, and each suspended actor kept its count. Every Substrate image was v1.0.0-rc.3, and the schema version had not changed. The list stream got an answer 138 of 138 times.

The rollback cost the same as the upgrade, and in the same step. This pair of releases has no schema change, so our run cannot show what a rollback does to a new schema. The upgrade page says that the new schema stays, and you need the backup from before step 4 for that case.

## From v0.6.0: no upgrade, and a reinstall that needs two fixes

The registry has no images for v0.6.0, so we built it from its tag, on a new cluster on the same guest, once. Its README quickstart failed twice. The first deploy stopped at once.

```listing
title: the install command of the v0.6.0 README
source: capture/lab/Y-reruns-rollback-scale/40-v060/00-install/20-deploy-ate-system.log
lang: text
note: The last useful line of the output.
---
Error: at least one of ATE_INGRESS_ALLOWED_SPIFFE_IDS, config.ingressAllowedSPIFFEIDs or --ingress-allowed-spiffe-ids must be set, got none
```

With an ingress identity added, the deploy took 278 s. The README command for the demo, `deploy demo-counter`, printed the help and returned 0, and `deploy demo counter` worked. The README then sends a request through port 80 of the router, and the port-forward failed with `Service atenet-router does not have a service port 80`. So no request reached the four actors that we made on v0.6.0 by the path of the README.

We then ran the v1.0.0 installer on that cluster, as a direct upgrade. It stopped in 3 s.

```listing
title: a direct upgrade from v0.6.0 to v1.0.0
source: capture/lab/Y-reruns-rollback-scale/40-v060/20-direct-upgrade/10-deploy.log
lang: text
note: The error line is cut after the first sentence.
---
[step]: deploy_crds
[step]: images: pre-built from ghcr.io/agent-substrate/substrate, tag v1.0.0
…
Error: while applying customresourcedefinition/csidriverconfigs.ate.dev: CustomResourceDefinition.apiextensions.k8s.io "csidriverconfigs.ate.dev" is invalid: status.storedVersions[0]: Invalid value: "v1alpha1": missing from spec.versions …
```

The v0.6.0 system kept running. The v1.0.0 CLI could not talk to it: `unknown service substrate.ateapi.v1.Control`. Requests through `kubectl ate proxy` of v1.0.0 still reached three of the four actors, on the old system. The upgrade page of v0.6.0 says to install again, so we did that on the same cluster.

| Step | Result |
|---|---|
| `ate-setup delete all` of v1.0.0 | done in 346 s. It removed every Substrate namespace and volume |
| deploy v1.0.0 | failed in 1 s, on the stored version of the `sandboxconfigs.ate.dev` CRD. That CRD stayed in deletion, because the SandboxConfig `gvisor-default` kept the finalizer `sandboxconfig.ate.dev/workerpool-protection` and its controller was gone |
| remove the finalizer, deploy again | failed after 157 s. `atelet` stopped with `image cache at "/var/lib/ate/image-cache" has layout version "2" and this atelet supports "3"` |
| delete that folder on the node, deploy again | done in 30 s |

The new system had no actor and no atespace. Nothing that we made on v0.6.0 survived.

**Our position:** do not move a 0.x cluster to 1.0. Install 1.0 on a new cluster, create your templates again, and move traffic. If you must reuse the cluster, plan for the finalizer and the image cache, and for an empty system at the end.

## What we did not test

We ran two upgrades and one rollback, each once, on one node, and both upgrades started from a release candidate. We did not test an upgrade between two supported releases, a rollback that crosses a schema change, more than one node, or the microVM class. We did not test an upgrade with a Postgres outside the cluster. From v0.6.0 we found no path that keeps an actor.

A new kagent release, v1.0.1, appeared on the day of our kagent run. All our kagent results are from v1.0.0.

```takeaways
- Check the date of a Substrate tutorial, and distrust anything written before 2026-11-05.
- Install 1.0 on a new cluster to move from any 0.x release, because no actor survives.
- Store actor state names, never the numbers.
- Stop requests and suspend every actor with `--mode sync` before the `atelet` step of an upgrade.
- Handle `SIGTERM` in the actor process, or every roll of the workers crashes the actor.
- Take a database backup before the API server step of an upgrade.
- Upgrade one minor release at a time, in the documented component order.
```

Sources: capture/lab/summary/upgrade-x86.json, capture/lab/summary/upgrade-rerun-x86.json, capture/lab/summary/v060-x86.json, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/20-upgrade/00-timeline-steps.tsv, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/20-upgrade/02-cycle-stream.tsv, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/30-after/10-actors-after.txt, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/40-worker-roll-on-v1.0.0/10-watch.tsv, capture/lab/U-pg-upgrade-scale/30-upgrade-v0.6.0/00-install-v0.6.0/51-ghcr-release-tags.txt, capture/lab/U-pg-upgrade-scale/30-upgrade-v0.6.0/00-install-v0.6.0/20-deploy-ate-system.log, capture/lab/Q-network/m-router-ports/agentgateway/10-port-probes.tsv, capture/lab/Q-network/m-router-ports/envoy/10-port-probes.tsv, capture/lab/Q-network/m-router-ports/agentgateway/11-port-probes-supplement.txt, README.md, the ActorState enum and the CLI at v0.1.0 and at v1.0.0 (the old and new commands); cmd/kubectl-ate/internal/cmd/actor.go, api/ateapi/v1/ateapi.proto, manifests/ate-install/generated/ate.dev_workerpools.yaml, cmd/ate-setup/commands.md and go.mod at v1.0.0; docs/guides/upgrade.md, docs/reference/version-skew-policy.md, docs/dev/postgresql-schema-evolution.md and docs/get-started/quickstart.md at v1.0.0; capture/lab/B-lifecycle/10-trace.tsv, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/G-dataplane/envoy/ingress-auth/, capture/lab/G-dataplane/agentgateway/ingress-auth/, capture/lab/G-dataplane/02-agentgateway-without-ingress-allowlist/, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/summary/failures-x86.json, capture/lab/summary/timers-x86.json, capture/lab/G-dataplane/agentgateway/06-services.txt, capture/lab/G-dataplane/agentgateway/11-listening.txt, capture/lab/G-dataplane/agentgateway/10-atenet-router-agentgateway-config.yaml, capture/lab/G-dataplane/envoy/06-services.txt; manifests/ate-install/atenet-router.yaml and manifests/ate-install/components/agentgateway/kustomization.yaml at v1.0.0.
