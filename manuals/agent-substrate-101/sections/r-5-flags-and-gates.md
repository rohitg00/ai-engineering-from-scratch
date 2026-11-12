# Flags and preview features

> The flags that change what an actor does are few: two snapshot timers on `atelet`, the parking budget on the router, and the dataplane and image choice in the installer.

Each table gives the literal flag and the default that the code sets at v1.0.0. Where a recorded argument list shows it, the table also gives the value of our install. A component has more flags than these. The tables hold the ones that this manual uses or that change behaviour you can observe.

## The installer, ate-setup

`ate-setup` reads each setting from a flag, then a configuration file, then an environment variable, then the default.

| Flag | Default | What it does | Section |
|---|---|---|---|
| `--image-repo`, `--image-tag` | none | Installs published images. Without them the installer builds every image from the checkout. Each flag requires the other. | [2.1](#s-install-with-ate-setup) |
| `--kind` | `false` (environment variable `ATE_INSTALL_KIND`) | Uses the kind overlays: the bundled Postgres, rustfs, and the local registry. | [2.1](#s-install-with-ate-setup) |
| `--namespace` | `ate-system` | The namespace of the control plane. | [2.4](#s-what-the-install-created) |
| `--credential-provider` | none, required | A JSON object. `{"name":"k8s.io"}` installs the provider that reads Kubernetes Secrets. `{"enabled":false}` turns injection off. | [6.5](#s-credential-injection) |
| `--ingress-allowed-spiffe-ids` | none | The client identities that the router accepts. With no value, no client reaches an actor. | [5.1](#s-client-authentication) |
| `--atenet-dataplane` | `envoy` | `envoy` or `agentgateway`. A second run with the other value switches a live cluster. | [6.6](#s-the-dataplane-choice) |
| `--sandbox-classes` | `gvisor,microvm` | The sandbox classes to prepare. The default is the same on kind. | [4.2](#s-sandbox-classes) |
| `--preview` | empty | The preview features to turn on in every component. | this page |
| `--cluster-size` | `size0` | `size10` assumes a PostgreSQL node that you provide. It makes the bundled Postgres request 80 CPUs and 140 GiB of memory, and it changes the database settings to match. It does not create or reserve the node. Do not use it on kind or on a small cluster. | [8.1](#s-postgres-and-the-object-store) |
| `--rollout-timeout` | `60s` | How long the installer waits for each workload. | [2.1](#s-install-with-ate-setup) |
| `--cordon-system-infra-components` | off | Keeps the system components off the worker nodes. With `size10`, this flag is what puts Postgres alone on its node. | [8.4](#s-upgrade-and-stale-advice) |
| `--ateapi-log-level` | none: keeps the installed level, else `info` | The log level of `ate-api-server`. | - |
| `--snapshot-location` | none. The kind profile sets `gs://ate-snapshots/`. | The `--snapshot-location` of `ate-api-server`. Required unless `PerTemplateSnapshotLocation` is on. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| `--actor-jwt-issuer` | `https://idp.<namespace>.svc` | The issuer in each actor JWT. | [5.3](#s-actor-jwts) |
| `--actor-jwt-algorithm` | `ES256` | The signing algorithm of a new actor JWT key: `ES256` or `RS256`. | [5.3](#s-actor-jwts) |
| `--ateapi-authz-bootstrap-owners` | `system:serviceaccount:<namespace>:ate-client` | The `--authz-bootstrap-owners` of `ate-api-server`. | [5.2](#s-access-policies) |
| `--e2e-tuning` | `false` | Sets the `atelet` timers to an upload delay of 2 s and a detach delay of 30 s. It is for test runs. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| `--setup-csi` | `none` | Also installs a CSI driver: `nfs`, `hostpath`, or `both`. | - |
| `--record-dir` | the cache directory of your user | Where the installer writes the record of each install. | [2.4](#s-what-the-install-created) |

The help text of `--credential-provider` says that a provider requires Envoy. In our run the installer accepted `{"name":"k8s.io"}` with agentgateway, and injection worked.

## atelet: when a snapshot becomes durable

| Flag | Default | What it does |
|---|---|---|
| `--snapshot-upload-delay` | `5m` | After an asynchronous suspend, how long the snapshot waits on the node before the upload starts. |
| `--snapshot-detach-delay` | `30m` | How long a suspended actor stays assigned to its node, with the node copy kept. Must not be shorter than the upload delay. |
| `--snapshot-upload-timeout` | `2m` | The limit for one upload attempt, before a size allowance. Each failure in a row doubles the limit of the next attempt, up to 8 times the first. |
| `--snapshot-upload-est-throughput-mib` | `100` | The size allowance. Each attempt gets the time that the snapshot needs at this rate, in MiB per second, on top of the timeout. |
| `--snapshot-upload-workers` | `2` | Uploads that run at the same time on one node. |
| `--snapshot-detach-workers` | `2` | Detaches that run at the same time on one node. |
| `--snapshot-report-workers` | `1` | Snapshot state reports to `ate-api-server` that run at the same time. |
| `--snapshot-report-give-up-after` | `10m` | How long `atelet` retries a failed state report. |
| `--snapshot-cache-min-age` | `10m` | A cached snapshot file younger than this is never removed. |
| `--snapshot-cache-fetch-timeout` | `10m` | The limit for the download of one cached snapshot file. A restore that waits for a download that hangs waits this long. |
| `--actor-stats-poll-interval` | `1m` | How often `atelet` samples the resource use of actors. |
| `--drain-delay` | `0` | How long `atelet` accepts new calls after `SIGTERM`. |
| `--drain-timeout` | `5m` | How long `atelet` waits for its work to end when it stops. |
| `--log-level` | `info` | Our source install ran with `debug`. |

```listing
title: the atelet arguments of our install, default timers
source: capture/lab/D-durability/00-atelet-args.txt
lang: text
note: The whole file. No timer flag is present, so the defaults of 5 minutes and 30 minutes apply.
---
atelet --localhost-registry-replacement=kind-registry:5000 --grpc-server-cred-bundle=/run/podidentity.podcert.ate.dev/credential-bundle.pem --client-ca-certs=/run/podidentity.podcert.ate.dev/trust-bundle.pem --log-level=debug --preview=
```

For one experiment we shortened both timers so that a resume from the bucket took seconds to set up. [Section 3.3](#s-suspendactor-and-resumeactor) uses that run.

```listing
title: the atelet arguments with short timers
source: capture/lab/C-resume-vs-size/31-atelet-args-patched.txt
lang: text
note: The end of the one line in the file. The first four flags are the same as above.
---
… --log-level=debug --preview= --snapshot-upload-delay=3s --snapshot-detach-delay=10s
```

Short timers move snapshots to the bucket sooner, and every later resume then reads from the bucket, which is slower. Do not copy the 3 s value into a cluster that serves users.

## The router: parking and ports

| Flag | Default | What it does |
|---|---|---|
| `--parked-request-budget` | `5s` | How long the router holds a request that has no worker yet. |
| `--parked-request-max` | `1024` | How many requests the router holds at once. `0` turns parking off. |
| `--parked-request-retry-interval` | `100ms` | The first wait between two tries for a parked request. |
| `--parked-request-retry-factor` | `1.1` | The growth of that wait. |
| `--parked-request-retry-jitter` | `0.1` | A random part of each wait, as a fraction between 0 and 1. |
| `--extproc-max-requests` | `0` | The request limit of the Envoy connection to the router process. `0` means two times `--parked-request-max`, and at least 1024. |
| `--drain-delay` | `13s` | How long the router serves after `SIGTERM` before it starts to drain. |
| `--drain-timeout` | `0` | The limit for the drain. `0` means the parking budget plus 10 s plus a margin of 5 s, which is 20 s with defaults. An explicit value must not be less than the parking budget. Parked requests finish inside it. |
| `--route-timeout` | `5m` | The limit for one whole request. |
| `--ingress-allowed-spiffe-ids` | none | The allowlist that the installer flag sets. |
| `--port-https` | `8443` | The listener for requests with the `ate-target-actor` header. |
| `--port-connect-tls` | `8444` | The listener for `CONNECT` tunnels, which `kubectl ate proxy` uses. |
| `--upstream-connect` | `true` | The router reaches the worker with `CONNECT`. |
| `--egress-policy-cache-ttl` | `10s` | How long the egress gateway keeps a policy that it read. |

```listing
title: the router arguments of our install
source: capture/lab/I-capacity/17-router-args.txt
lang: text
note: Parts of the first line. No parking flag is present, so the budget is the default of 5 seconds.
---
atenet-router router --mode=ingress --namespace=ate-system … --port-https=8443 … --port-connect-tls=8444 … --drain-delay=13s --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --preview=
```

The 5.05 to 5.16 s in every `no worker has room` response of our runs is this budget plus the request time. [Section 4.4](#s-request-parking) explains the mechanism.

## ate-api-server and ate-controller

| Component | Flag | Default | What it does |
|---|---|---|---|
| `ate-api-server` | `--snapshot-location` | none. Required unless `PerTemplateSnapshotLocation` is on. | The address prefix for durable snapshots, such as `gs://ate-snapshots/`. Without it and without that feature, the server does not start. |
| `ate-api-server` | `--postgres-schema` | `substrate` | The schema that holds every table. |
| `ate-api-server` | `--postgres-pool-max-conns` | `0` | The size of the read-write connection pool, which the authorizer shares. `0` keeps the default of the connection string or of the driver. The owner, watch, and readiness pools do not follow it. |
| `ate-api-server` | `--template-resync-interval` | `20s` | How often the reconciler checks templates and their golden snapshots. |
| `ate-api-server` | `--authz-bootstrap-owners` | none. Required, at least one. `ate-setup` sets `ate-client`. | Identities that are global owners for as long as the flag lists them, whatever the stored global access policy says. |
| `ate-api-server` | `--actor-jwt-issuer` | none. Required. `ate-setup` sets `https://idp.ate-system.svc`. | The issuer in each actor JWT. It must be an `https` address with no query and no fragment. |
| `ate-api-server` | `--drain-delay`, `--drain-timeout` | `13s`, `15s` | The wait before and during the stop of a replica. |
| `ate-controller` | `--dns-egress-policy` | empty | The install manifest sets `enforce-in-atunnel`, so that the DNS relay enforces the egress policy. |
| `ate-controller` | `--worker-sync-concurrency` | `2` | Worker pods that the controller registers as Worker records at the same time. |

Two limits are fixed in the code and have no flag. A worker gives its actors 30 minutes after `SIGTERM`. `ate-api-server` ends any call after 10 minutes.

## Preview features

A preview feature is off unless two switches agree.

1. The server switch. Every component takes `--preview` with a list of names, or `ALL`. The installer flag passes one value to all of them.
2. The client switch. A request must carry the header `Ate-Preview-Allowed: true`. `kubectl ate --preview` sends it.

| Name | Field that it allows | Default |
|---|---|---|
| `ExternalVolumes` | `volumes[].external` in a template, with a CSIDriverConfig | off |
| `GoldenEgressPolicy` | `goldenEgressPolicy` in a template | off |
| `PerTemplateSnapshotLocation` | `snapshotConfig.storageLocation` in a template | off |

The documentation says that an object that was created while a feature was on stays usable after the feature is turned off {{docs}}. That is true for validation only: the server does not check an unchanged value again. The code has two runtime effects that the documentation does not state {{code}}.

| Feature turned off | What happens to an object that already uses it |
|---|---|
| `ExternalVolumes` | A resume of an actor that has external volumes fails. The error is `external volumes are not supported unless the ExternalVolumes preview gate is enabled`. |
| `PerTemplateSnapshotLocation` | The server ignores `snapshotConfig.storageLocation` of the template. New snapshots go to `--snapshot-location`. |
| `GoldenEgressPolicy` | We found no runtime check. |

We did not run these two cases. Turn a feature off only after you have removed the objects that use it.

We tried the four combinations of the two switches once, on the x86 server guest. The request was `kubectl ate create actor-template` with a file that has a `goldenEgressPolicy` field.

| `--preview` on `ate-api-server` | `--preview` on `kubectl ate` | Result |
|---|---|---|
| empty | not passed | `Error: failed to create actor template: rpc error: code = InvalidArgument desc = actor_template.golden_egress_policy: Forbidden` |
| empty | passed | the same error |
| `GoldenEgressPolicy` | not passed | the same error |
| `GoldenEgressPolicy` | passed | accepted, with a golden tag within 30 s |

The error names the field and not the feature. A read of the new template with `kubectl ate get` needed no client flag. In this test only `ate-api-server` had the server switch, and we restored its arguments afterwards. Every other argument list that we recorded has `--preview=` with no value, so all three features were off in all other runs.

## Kubernetes features that the cluster must have

Substrate issues its certificates with Kubernetes pod certificates. The cluster script for kind turns on three Kubernetes features and one API group for them.

| Name | Kind |
|---|---|
| `ClusterTrustBundle` | Kubernetes feature |
| `ClusterTrustBundleProjection` | Kubernetes feature |
| `PodCertificateRequest` | Kubernetes feature |
| `certificates.k8s.io/v1beta1` | API group and version |

A cluster without them cannot start the Substrate components. We ran Kubernetes 1.37.0 in every test.

Sources: cmd/ate-setup/commands.md and docs/guides/operator-install.md (installer settings), cmd/atelet/main.go, cmd/atelet/snapshotcache.go and cmd/atelet/internal/snapshottracker/background.go (atelet flags and timer defaults), cmd/atenet/internal/router/cmd.go, cmd/atenet/internal/router/ingress/parking.go, cmd/atenet/internal/router/xds.go and cmd/atenet/internal/router/egress/policycache.go (router flags and defaults), cmd/atenet/internal/router/config.go (the drain timeout), cmd/ateapi/main.go, cmd/ateapi/internal/controlapi/workflow_resume.go and snapshot_helpers.go (the runtime checks of preview features), cmd/ate-setup/internal/config/setting.go and load.go, cmd/ate-setup/internal/cmd/deploy.go, cmd/ate-setup/internal/steps/postgres.go and microvm.go, manifests/ate-install/components/e2e/kustomization.yaml, cmd/atelet/internal/snapshottracker/report.go, cmd/atecontroller/, internal/preview/preview.go, docs/dev/preview-gates.md and hack/create-kind-cluster.sh at v1.0.0; capture/lab/D-durability/00-atelet-args.txt, capture/lab/C-resume-vs-size/31-atelet-args-patched.txt, capture/lab/I-capacity/17-router-args.txt, capture/lab/G-dataplane/00-install/steps.tsv, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/V-validation/10-preview-feature/10-preview.tsv, capture/lab/V-validation/10-preview-feature/tmpl-gep.yaml, capture/lab/V-validation/10-preview-feature/11-patch-on.log.
