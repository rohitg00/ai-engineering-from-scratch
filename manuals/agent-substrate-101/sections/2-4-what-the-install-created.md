# What the install created

> The system install created 15 running pods in three namespaces and three custom resources, and it put every atespace, template, actor, and worker in Postgres, where `kubectl` cannot see them.

The install ended with no error, and `kubectl get pods -A` now prints a page of names you did not choose. One of them will be in an error message next week. You want to know what each pod does, which ones have a second replica, and where your actors are stored.

When you finish this section, you can name the job of each pod that the install created. You can also say which objects live in etcd and which live in Postgres, and which pods run as a single replica.

## The pods

This is the namespace `ate-system` after our install from source. The install from the release images created the same pods.

```listing
title: the pods of ate-system
source: capture/lab/A-quickstart/60-state.log
lang: text
note: Twelve lines of kubectl get pods -A -o wide. The IP and node columns of each line are cut.
---
NAMESPACE                          NAME                                         READY   STATUS      RESTARTS   AGE …
ate-system                         ate-api-server-696d95dd66-9q7f8              2/2     Running     0          117s …
ate-system                         ate-api-server-696d95dd66-t85dd              2/2     Running     0          117s …
ate-system                         ate-controller-7479ff54f-jrrtc               1/1     Running     0          114s …
ate-system                         ate-idp-server-7c46c85d94-66sf2              1/1     Running     0          116s …
ate-system                         ate-idp-server-7c46c85d94-cfbt4              1/1     Running     0          116s …
ate-system                         atelet-sqzvr                                 2/2     Running     0          113s …
ate-system                         atenet-egress-78f759fcb8-74d4m               3/3     Running     0          76s …
ate-system                         atenet-router-86454b57f5-7vtp5               2/2     Running     0          112s …
ate-system                         k8s-credential-provider-8df9859f8-jcfll      1/1     Running     0          89s …
ate-system                         postgres-0                                   2/2     Running     0          7m13s …
ate-system                         rustfs-54c86945fb-w9pnn                      1/1     Running     0          109s …
ate-system                         rustfs-bucket-init-bvq6z                     0/1     Completed   0          109s …
```

[Figure 2.4](#fig-2-4) groups all the pods by namespace and gives each one the colour of its role.

```figure
id: fig-2-4
kind: layers
title: what the install created on kind-control-plane
claim: The install put the control plane, the dataplane, the node agent, Postgres, and the object store in one namespace on one node.
caption: Each box is one workload from our install. Blue is the control plane, indigo the dataplane, violet workers and sandboxes, teal durable state, and grey is outside Substrate. From capture/lab/A-quickstart/60-state.log.
```

Each workload has one job:

| Workload | Pods | Job |
|---|---|---|
| `ate-api-server` | 2 | The API and the scheduler. It serves `kubectl ate` and the router, and it keeps all its state in Postgres {{code}} |
| `ate-controller` | 1 | Turns each WorkerPool into a Deployment of worker pods, and registers each worker pod with `ate-api-server` {{code}} |
| `ate-idp-server` | 2 | Publishes the keys that verify the JWT of an actor. [Section 5.3](#s-actor-jwts) uses it |
| `atelet` | 1 on each node | The node agent. It pulls images, restores and checkpoints sandboxes, keeps snapshots on the node, and uploads them {{code}} |
| `atenet-router` | 1 | Ingress. It checks the client certificate, asks `ate-api-server` where the actor is, and forwards the request |
| `atenet-egress` | 1 | Egress. Every outbound connection of every actor goes through it |
| `k8s-credential-provider` | 1 | Reads Kubernetes Secrets for credential injection |
| `postgres-0` | 1 | The database of Substrate |
| `rustfs` | 1 | The object store for snapshots on kind. A cloud install uses a bucket |
| `rustfs-bucket-init` | a finished Job | Created the bucket `ate-snapshots` once |

One more pod runs in its own namespace. `podcertificate-controller` signs the certificates that the pods use to prove who they are. It needs the three Kubernetes preview features that the cluster script turned on {{code}}.

## What has one replica

Count the pods in the listing. `ate-api-server` and `ate-idp-server` have two. Everything else has one.

```figure
id: fig-2-4b
kind: layers
title: the pods of ate-system, one object for each pod
claim: In ate-system only ate-api-server and ate-idp-server run two pods, and every other workload, the router and Postgres among them, runs one.
caption: Each object is one pod of our install, on the tile of its namespace and the slab of its node. A tower is a server, and a low unit with ports is a gateway. The cylinder is Postgres, the bucket is the object store, and the dashed outline is the finished Job. A mark names the project that a program comes from. From capture/lab/A-quickstart/60-state.log.
```

That matters for three of them. Every request to every actor passes `atenet-router`, and `ate-api-server` reads Postgres for each one. [Section 1.2](#s-one-request-from-client-to-actor) shows the path. So one router pod and one Postgres pod are in front of all your actors. The bundled Postgres has no second replica and no failover {{code}}.

For a kind cluster on your machine, that is fine. For anything that people depend on, read [section 8.1](#s-postgres-and-the-object-store) before you go further. It covers an external database and what a Postgres outage does to requests.

## Three custom resources

The install added three custom resources to Kubernetes:

```listing
title: the custom resources of Agent Substrate
source: capture/lab/A-quickstart/60-state.log
lang: text
---
NAME                       SCOPE        VERSIONS      CREATED AT
csidriverconfigs.ate.dev   Cluster      v1(storage)   2026-11-12T10:05:33Z
sandboxconfigs.ate.dev     Cluster      v1(storage)   2026-11-12T10:05:33Z
workerpools.ate.dev        Namespaced   v1(storage)   2026-11-12T10:05:33Z
```

**WorkerPool:** a namespaced object that asks for a number of worker pods of one sandbox class. It is the only Substrate object that you manage with plain `kubectl` day to day. [Section 4.1](#s-workerpool) covers it.

`SandboxConfig` describes a sandbox class for the whole cluster. The install created two of them: `gvisor-default` and `microvm` {{docs}}. `CSIDriverConfig` belongs to a preview feature for volumes. A run with it is planned for the next edition.

Everything else is a row in Postgres: atespaces, templates, actors, tags, workers, egress policies, and access policies. So `kubectl get` does not list them, a backup of etcd does not hold them, and no Kubernetes RBAC rule names them. To back up your actors, back up Postgres and the object store. A snapshot from a default suspend reaches the object store about 5 minutes later, so an earlier backup does not hold it. [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) has the timers. [Section 3.6](#s-atespaces) and [section 5.2](#s-access-policies) cover names and access.

## The demo namespace

`deploy demo counter` created the namespace `ate-demo-counter` with one WorkerPool named `counter`. `ate-controller` turned it into three worker pods. Each pod runs the image `ateworker-gvisor`, which holds the gVisor sandbox.

The demo also created two things that `kubectl` cannot show: the atespace `ate-demo-counter` and the template `counter`. Read them with the plugin:

```bash
kubectl get workerpools -A
kubectl ate get atespaces
kubectl ate get actor-templates -a ate-demo-counter
```

The atespace and the Kubernetes namespace have the same name here. They are two objects. An atespace is a Substrate name, and nothing ties it to a namespace.

A worker pod is not an ordinary pod. It runs as root with the `SYS_ADMIN` and `NET_ADMIN` capabilities, because it starts sandboxes {{docs}}. Put WorkerPools on nodes that you trust for that. [Section 4.2](#s-sandbox-classes) covers the sandbox classes.

## The telemetry namespace

The kind profile also installs `otel-system` with three pods: an OpenTelemetry collector, Prometheus, and Jaeger {{docs}}. They are not part of Substrate. They receive its metrics and traces.

They are useful on day one. Add `--trace` to any `kubectl ate` command, forward the Jaeger port, and open the trace:

```bash
kubectl port-forward -n otel-system svc/jaeger 16686:16686 &
kubectl ate get actor my-counter-1 -a ate-demo-counter --trace
```

## What it costs on one machine

**We measured** the size of the release-image install once on an x86 server guest with 16 vCPU and 23 GB. Docker held 2.1 GB of images and 4.8 GB of volumes. The guest used 13 GB of disk in all, with the operating system and the Go caches.

**We measured** the memory once on an Apple silicon laptop under Docker Desktop. The kind node held 2.7 GiB right after the install, with no actor.

The install also left two things outside the cluster. The first is a second container, the local registry:

```listing
title: the containers on the host
source: capture/lab/A-quickstart/60-state.log
lang: text
---
kind-control-plane kindest/node:v1.37.0
kind-registry registry:3
```

The second is a file. `ate-setup` records the settings of each install in the cache directory of your user, one file for each kubeconfig context. That is `~/.cache/ate-setup/installs/` on Linux and `~/Library/Caches/ate-setup/installs/` on macOS, and the flag `--record-dir` names another place {{code}}. Keep that file. It tells you later which flags the running cluster was installed with.

```takeaways
- Use kubectl for WorkerPools and kubectl ate for everything else.
- Back up Postgres and the object store, because a Kubernetes backup does not hold your actors.
- Treat atenet-router and postgres-0 as single points of failure in the default install.
- Run worker pods only on nodes that you trust with root and SYS_ADMIN.
- Keep the settings file that ate-setup wrote for your cluster.
```

Sources: capture/lab/summary/install-steps.json, capture/lab/A-quickstart/60-state.log, capture/lab/A-quickstart/22-deploy-ate-system-retry.log, capture/lab/A-quickstart/30-deploy-counter.log, capture/lab/G-dataplane/00-install/60-state.log, capture/lab/G-dataplane/00-install/20-deploy-ate-system-prebuilt.log, capture/lab/G-dataplane/envoy/15-all-images.tsv, capture/lab/M-mac-arm64/60-state.log, capture/lab/B-lifecycle/13-workers.txt; manifests/ate-install, cmd/atecontroller, cmd/atelet, cmd/ateapi, docs/concepts/architecture.md, docs/reference/api-guide.md, docs/reference/kubectl-ate.md, and hack/create-kind-cluster.sh at v1.0.0.
