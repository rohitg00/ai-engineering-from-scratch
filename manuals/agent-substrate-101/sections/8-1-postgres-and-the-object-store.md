# Postgres and the object store

> Every actor, template, and worker is a row in Postgres, every durable snapshot is an object in a bucket, and you must protect both to keep one actor.

You run `kubectl get crd` on a new install and look for the actors. You find three kinds, and none of them is an actor. The actor you created a minute ago answers requests, so it exists somewhere. It exists in a database that the install started for you, and its memory is a set of files in a bucket.

When you finish this section, you can say which store holds each part of an actor. You can read a snapshot address, and you can estimate the disk that suspended actors use on a node and in the bucket.

## Actors are rows in Postgres

The install creates three CustomResourceDefinitions. They describe worker capacity, and nothing else.

```listing
title: the three kinds that Kubernetes knows
source: capture/lab/A-quickstart/60-state.log
lang: text
note: Four consecutive lines from the state dump after the install.
---
NAME                       SCOPE        VERSIONS      CREATED AT
csidriverconfigs.ate.dev   Cluster      v1(storage)   2026-11-12T10:05:33Z
sandboxconfigs.ate.dev     Cluster      v1(storage)   2026-11-12T10:05:33Z
workerpools.ate.dev        Namespaced   v1(storage)   2026-11-12T10:05:33Z
```

Everything else is a row. **The code** creates one schema, named `substrate` by default, with these tables.

| Table | What a row is | Who writes it |
|---|---|---|
| `atespaces` | one atespace | `ate-api-server`, on `CreateAtespace` |
| `actors` | one actor, with its state and its snapshot list | every lifecycle call |
| `actor_egress_policies` | the egress policy of one actor | the egress policy calls |
| `actor_templates` | one ActorTemplate | `CreateActorTemplate` |
| `tags` | one named copy of a snapshot | `CreateTag`, and the golden snapshot of each template |
| `workers` | one worker pod that registered | `ate-controller` and `atelet` |
| `worker_assignments` | which actor holds which worker | resume, suspend, and crash reports |
| `worker_outbox` | a change feed of worker rows | the same transaction as each worker change |
| `worker_outbox_trim` | the mark up to which old rows of the feed were removed | the maintenance of the feed |
| `leases` | one lock on one actor, tag, template, or worker | each workflow, renewed while it runs |
| `global_access_policy`, `atespace_access_policies` | role bindings | the access policy calls |

The same schema holds five tables of the OpenFGA authorizer that runs inside `ate-api-server`. Grants and actors are in one database, so one backup holds both.

**Lease:** a row in `leases` that gives one workflow the right to change one resource. The workflow renews it, and the lease expires 30 seconds after its last renewal. A workflow that loses its lease stops.

This design has three results that you will meet.

- `kubectl get`, `kubectl describe`, and a Kubernetes watch cannot see an actor. Use `kubectl ate get actor`, as [section 2.2](#s-kubectl-ate) shows.
- A backup of etcd does not contain one actor. A backup of the cluster that skips Postgres restores worker pools and no workloads.
- Each row has a `uid` and a `version`. A write that names an old version fails. That is why an egress policy update needs both values from a fresh `get`, as [section 6.2](#s-egresspolicy-and-default-deny) shows.

## The bundled Postgres has one replica

On kind, `ate-setup` installs Postgres for you. **The code** deploys it as a StatefulSet with `replicas: 1`, the image `postgres:18-alpine`, and a 500 GiB volume claim that the kind overlay makes smaller. Our install shows it as one pod, `postgres-0`, with two containers.

`ate-api-server` connects with two logins. The owner login runs schema migrations. The read-write login serves requests. Both use client certificates, so the bundled database holds no password.

The kagent distribution differs here. Our kagent cluster had no Postgres in `ate-system`. It ran one PostgreSQL 18.4 Deployment, `kagent-postgresql`, in the `kagent` namespace. The kagent install manifest sets `POSTGRES_HOST_AUTH_METHOD=trust` on it, which accepts a login with no password from a client that reaches it. [Section 7.1](#s-kagent-on-substrate) covers that install.

The manifests give the bundled database no replica and no failover. `ate-api-server` runs two replicas, and both depend on that one pod. [Section 8.2](#s-when-a-dependency-is-down) shows what a client sees for the 61 seconds that we took it away.

**Our position:** treat the bundled Postgres as a test fixture. For any cluster that people depend on, point `ate-api-server` at a database that has a standby and a backup.

## Use an external Postgres

We did not test an external database. This part comes from the code and the documentation at the tag.

- `ate-api-server` takes two connection strings: `--postgres-owner-connection-string` and `--postgres-read-write-connection-string`. The owner role runs migrations, and the read-write role serves requests. The default role names are `substrate_owner` and `substrate_readwrite`.
- The repository includes an overlay for Cloud SQL through its proxy. Any other PostgreSQL service is yours to connect.
- The Cloud SQL scaling guide of the project says that a connection pooler in transaction mode does not work. Its reason is a session that listens for worker changes {{docs}}. The code at the tag does not match that reason. The worker watch reads the `worker_outbox` table every 50 ms, and the advisory locks last for one transaction {{code}}. We did not test a pooler, so use session mode until you have tested transaction mode yourself.
- The first replica of a new release migrates the schema, and no migration is rolled back. Take a backup before an upgrade, as [section 8.4](#s-upgrade-and-stale-advice) describes.
- The largest public load report names Postgres as the limit. With 9,000 sandboxes in use, the database ran at 53 to 60 of 64 cores while the API servers were idle. That number is from an issue against a release candidate, and it is not our result.

## A snapshot address has the atespace and the actor uid in it

A durable snapshot is a directory of objects under one prefix. The actor row stores the address.

```listing
title: where the snapshot of my-counter-1 lives
source: capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml
lang: yaml
note: The snapshot entry after a synchronous suspend. The sandbox runtime attributes are cut.
---
  snapshots:
  - actorTemplateUid: 71a3a39c-5f37-4d6e-937f-9c314fea7668
    durableSnapshot:
      object:
        snapshotUri: gs://ate-snapshots/atespaces/ate-demo-counter/actors/6f80f612-7547-4f5b-b3ab-831595621806/snapshots/13e256c4-7067-424f-a106-2cfe9ea38578
      state: SNAPSHOT_STORAGE_STATE_COMPLETED
    fidelity: SNAPSHOT_FIDELITY_MEMORY
    generation: 3
    locality: kind-control-plane
    owner: SNAPSHOT_OWNER_ACTOR
…
  state: ACTOR_STATE_SUSPENDED
```

Read the address from left to right: the snapshot location, `atespaces`, the atespace, `actors`, the actor uid, `snapshots`, and the snapshot uuid. A tag has its own prefix, with `tags` and the tag uid in place of the actor part. The path uses the uid, so a new actor with an old name never reads the snapshot of the deleted one.

On kind the bucket is rustfs, an S3-compatible server that runs as one pod in `ate-system`. The address still starts with `gs://`. The scheme names the location that the installer set, and the object store plugin decides which service receives the bytes. Do not read the scheme as proof that data went to Google Cloud.

Two more facts come from the code and the documentation at the tag. An actor owns one durable snapshot at a time, and the next successful suspend releases the one before it. `ate-api-server` deletes the objects before it drops the row, so a failure between the two steps can leave objects with no owner. It cannot leave a row that points at nothing.

[Figure 8.1](#fig-8-1) puts the three places together.

```figure
id: fig-8-1
kind: structure
title: the three places that hold an actor
claim: Postgres holds the record of each actor, the bucket holds its durable snapshot, and the node disk holds a second copy for 30 minutes.
caption: Read left to right. Each panel is one store, with the names it uses and the size we measured with 25 suspended actors. From capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, and the schema migration at v1.0.0.
```

## What 25 suspended actors cost in disk

A snapshot with memory fidelity is as large as the memory that holds data in the actor. Our ballast actor holds random bytes, so every MiB holds data and it shows the worst case. The same actor with 500 MiB of zero bytes had a snapshot of 4.6 MiB on the node, as [section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) shows.

**We measured** the disk use on an x86 server guest (24 vCPU, 47 GB, nested KVM), with one run and 25 suspended actors. Five actors each held 0, 50, 200, 500, and 1,000 MiB, which is 8,750 MiB in total.

| Place | With 25 suspended actors | After the 25 actors were deleted |
|---|---|---|
| Node, `/var/lib/ate/snapshots` | 8,801 MiB | 1 MiB |
| Node, `/var/lib/ate/snapshot-cache` | 1,765 MiB | 1,765 MiB |
| Bucket, `ate-snapshots` | 10,824 MiB | 2,064 MiB |

[The footprint chart in section 3.4](#fig-3-4c) shows the same numbers as bars.

The node held one copy of each snapshot, 8,801 MiB for 8,750 MiB of actor memory. The bucket held the same data plus 2,064 MiB of golden snapshots, which stay as long as their templates exist. The snapshot cache did not shrink when the actors went away. `atelet` trims it on its own schedule.

The node copy is the part that people forget. After an asynchronous suspend, `atelet` keeps the files on the node for 30 minutes, as [section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) shows. Those files sit in a host directory that Kubernetes charges to no pod. A public issue reports a node that crossed its disk pressure threshold this way, after which the kubelet evicted the worker pods.

**Our position:** size the node disk for the memory of every actor that can suspend on that node inside 30 minutes, plus the snapshot cache. Size the bucket for the memory of every suspended actor, plus one golden snapshot for each template. Both numbers are upper limits for memory fidelity, because only the memory that holds data counts. A files-only snapshot is far smaller. For an actor with one small file in its volume, it was 44 KiB on the node and 48 KiB in the bucket.

## What we did not test

Our object store was rustfs in the same cluster and on the same disk as the node. We did not test Google Cloud Storage, Amazon S3, or any bucket across a network. We did not test an external Postgres, a Postgres restore, or a bucket restore.

```takeaways
- List actors with `kubectl ate get actor`, because Kubernetes holds no actor object.
- Back up Postgres and the bucket together, and restore them together.
- Replace the bundled single-replica Postgres before people depend on the cluster.
- Read the atespace and the actor uid from `snapshotUri` when you look for a snapshot in the bucket.
- Size node disk for the memory of all actors that suspend there in 30 minutes.
```

Sources: capture/lab/summary/validation-memory-x86.json, capture/lab/summary/validation-fidelity-x86.json, capture/lab/A-quickstart/60-state.log, capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml, capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, capture/lab/summary/footprint-x86.json, capture/lab/K-kagent/inventory/workloads.txt (the PostgreSQL Deployment); go/core/pkg/install/bundled_postgres.yaml at kagent v1.0.0 (the trust setting); cmd/ateapi/main.go (the Postgres flags), docs/dev/cloud-sql-scaling-guide.md and issue #3702 (the load report); cmd/ateapi/internal/store/atepg/migrations/000001_initial.sql (the tables), cmd/ateapi/internal/store/atepg/lease.go (the lease), manifests/ate-install/postgres/postgres.yaml (replicas, image, volume claim), manifests/ate-install/ate-api-server.yaml (replicas) and manifests/ate-install/kind/ at v1.0.0; docs/guides/postgres.md, docs/guides/node-storage.md and docs/reference/api-guide.md (snapshot layout, delete order) at v1.0.0; issue #3101 (disk pressure from node-local snapshots).
