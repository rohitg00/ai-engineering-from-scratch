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
2. `atelet`, one node at a time. Running actors keep running. In our run, suspends and resumes on the node failed for 24 s.
3. The workers. You change `spec.workerImage` of each WorkerPool, and the pool replaces 10 percent of its workers in each batch.
4. `ate-api-server` and `ate-idp-server`, then the CRDs and `ate-controller`, then the router and the egress gateway, then the SandboxConfig, then the rest of the system bundle.

Step 3 is the one that costs you work. Each actor on an old worker receives `SIGTERM`. The upgrade page gives it 30 minutes after that {{docs}}, and our run shows that the time exists only if its process survives the signal. Substrate does not suspend it in that time.

If nothing calls `SuspendActor`, the actor becomes `ACTOR_STATE_CRASHED` and loses its work since the last snapshot. This is the idle suspend rule again: your harness must act on the signal. A spot instance gives between 15 seconds and two minutes, never 30 minutes.

Step 4 has one action that cannot be undone. The first new `ate-api-server` pod migrates the database schema, and a rollback leaves the new schema in place. Take a database backup before step 4. You can roll back to the release you came from and no further.

**Our position:** before any worker upgrade, stop new requests and wait for the open ones. Then suspend every actor with `--mode sync` yourself. Keep requests stopped until the workers are replaced, because a request resumes an actor. A synchronous suspend puts the snapshot in the bucket before it returns. Then step 3 finds no running actors, and the 30 minutes do not matter.

## One upgrade that we ran: v1.0.0-rc.3 to v1.0.0

No supported older release exists yet, because the policy starts at 1.0.0. The registry holds images for three release candidates and for v1.0.0, and for nothing older. An install of v0.6.0 from the release images failed with a 404 for its first image. So we installed v1.0.0-rc.3 and moved it to v1.0.0 by the steps above. The policy does not cover this path, and the two releases have the same schema version. [Figure 8.4b](#fig-8-4b) sets the steps against two request streams.

```figure
id: fig-8-4b
kind: timeline
title: one upgrade from v1.0.0-rc.3 to v1.0.0, against two request streams
claim: Suspends and resumes failed for 24 s in the atelet step, and the running actor crashed when the worker image changed.
caption: Read left to right. The top row shows when each step ran. The two rows below show each request of two streams, green for 200 and rose for a failure. From capture/lab/summary/upgrade-x86.json.
```

**We measured** one upgrade, on the x86 server guest (24 vCPU, 47 GB, nested KVM), on one kind node with a pool of 8 workers. Three streams ran during it. One suspended and resumed one actor about every 3.5 s. One listed the actors every 2 s. One sent a request each second to a `RUNNING` actor.

| Step | Seconds | What a client saw |
|---|---|---|
| 1, `podcertificate-controller` | 33.9 | nothing |
| 2, `atelet` | 30.9 | 7 suspend and resume cycles in a row failed, over 24 s. The suspend failed with `Unavailable` from `atelet`, and the request got 503 |
| 3, the worker image of the pool | 0.4 for the patch | the `RUNNING` actor answered 503 from 1.2 s after the patch. It was `ACTOR_STATE_CRASHED` at our first look, 5 s after the patch |
| 4a, `ate-api-server` and `ate-idp-server` | 28.4 | nothing |
| 4b, the CRDs and `ate-controller` | 12.3 | nothing |
| 4c, the router and the egress gateway | 21.8 | nothing |
| 4d, the SandboxConfig | 18.7 | nothing |
| 4e, the system bundle | 29.5 | nothing |

The time from the start of step 1 to the end of step 4e was 343 s. We watched the pool for 160 s of that time, in step 3. The cycle stream had 103 good cycles of 110, and all 7 failures were in step 2. The list stream got an answer 211 of 211 times. The schema version did not change, and every Substrate pod ran v1.0.0 at the end.

We made one actor of each kind before the upgrade and called each one after it.

| The actor before the upgrade | After the upgrade |
|---|---|
| Suspended with `--mode sync` at count 3 | 200, count 4 |
| Suspended in the default mode at count 3 | 200, count 4 |
| Suspended at count 5, with a tag | 200, count 6 |
| Created and never run | 200, count 1 |
| A new actor from the golden snapshot that the release candidate made | 200, count 1 |
| A new actor from the tag | 200, count 6 |
| `RUNNING` during step 3 | `ACTOR_STATE_CRASHED`. 368 of 469 requests got 503. A `revert` took 0.22 s, and the count went back to 1 |

So snapshots, tags, and the golden snapshot from the release candidate all worked on v1.0.0. The one loss was the running actor.

### The 30 minutes depend on the actor

The upgrade page gives each running actor `SIGTERM` and then 30 minutes {{docs}}. Our running actor did not get 30 minutes. Its process exits on `SIGTERM`, so the actor crashed in seconds.

**We measured** this in a second roll of the same pool, now on v1.0.0, once. Two actors ran. The process of the first exits on `SIGTERM`, and that actor was `ACTOR_STATE_CRASHED` at the first sample, 5 s after the patch. The process of the second handles `SIGTERM` and keeps running. That actor stayed `RUNNING` and answered 36 of 36 requests in 175 s, while its worker pod was `Terminating`.

We then suspended it with `--mode sync` in 0.64 s. It resumed on a new worker, and its count continued.

So the window exists only for an actor whose main process survives `SIGTERM`. A program exits on that signal unless it has a handler.

Our run also moves the suspend earlier than the upgrade page puts it. Suspends and resumes failed for 24 s while `atelet` restarted on our one node. So stop requests and suspend every actor before step 2, and resume traffic after step 3.

## What we did not test

We ran one upgrade, once, on one node, and it started from a release candidate. We did not test an upgrade from v0.6.0. The upgrade page says to install again for any release before 1.0, and the registry has no images for it. We did not test a rollback, an upgrade between two supported releases, more than one node, or the microVM class. We did not test an upgrade with a Postgres outside the cluster.

A new kagent release, v1.0.1, appeared on the day of our kagent run. All our kagent results are from v1.0.0.

```takeaways
- Check the date of a Substrate tutorial, and distrust anything written before 2026-11-05.
- Install again to move from any 0.x release, with a new database.
- Store actor state names, never the numbers.
- Stop requests and suspend every actor with `--mode sync` before the `atelet` step of an upgrade.
- Handle `SIGTERM` in the actor process, or a worker upgrade crashes the actor in seconds.
- Take a database backup before the API server step of an upgrade.
- Upgrade one minor release at a time, in the documented component order.
```

Sources: capture/lab/summary/upgrade-x86.json, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/20-upgrade/00-timeline-steps.tsv, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/20-upgrade/02-cycle-stream.tsv, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/30-after/10-actors-after.txt, capture/lab/U-pg-upgrade-scale/30-upgrade-v1.0.0-rc.3/40-worker-roll-on-v1.0.0/10-watch.tsv, capture/lab/U-pg-upgrade-scale/30-upgrade-v0.6.0/00-install-v0.6.0/51-ghcr-release-tags.txt, capture/lab/U-pg-upgrade-scale/30-upgrade-v0.6.0/00-install-v0.6.0/20-deploy-ate-system.log, capture/lab/Q-network/m-router-ports/agentgateway/10-port-probes.tsv, capture/lab/Q-network/m-router-ports/envoy/10-port-probes.tsv, capture/lab/Q-network/m-router-ports/agentgateway/11-port-probes-supplement.txt, README.md, the ActorState enum and the CLI at v0.1.0 and at v1.0.0 (the old and new commands); cmd/kubectl-ate/internal/cmd/actor.go, api/ateapi/v1/ateapi.proto, manifests/ate-install/generated/ate.dev_workerpools.yaml, cmd/ate-setup/commands.md and go.mod at v1.0.0; docs/guides/upgrade.md, docs/reference/version-skew-policy.md, docs/dev/postgresql-schema-evolution.md and docs/get-started/quickstart.md at v1.0.0; capture/lab/B-lifecycle/10-trace.tsv, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/G-dataplane/envoy/ingress-auth/, capture/lab/G-dataplane/agentgateway/ingress-auth/, capture/lab/G-dataplane/02-agentgateway-without-ingress-allowlist/, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/summary/failures-x86.json, capture/lab/summary/timers-x86.json, capture/lab/G-dataplane/agentgateway/06-services.txt, capture/lab/G-dataplane/agentgateway/11-listening.txt, capture/lab/G-dataplane/agentgateway/10-atenet-router-agentgateway-config.yaml, capture/lab/G-dataplane/envoy/06-services.txt; manifests/ate-install/atenet-router.yaml and manifests/ate-install/components/agentgateway/kustomization.yaml at v1.0.0.
