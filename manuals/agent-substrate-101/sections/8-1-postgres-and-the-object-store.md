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

We ran one install against a Postgres outside the cluster. The bullets after the run come from the code and the documentation at the tag.

**We measured** this once on the x86 server guest (24 vCPU, 47 GB, nested KVM), on a new kind cluster from the release images. Postgres 18 ran in a container on the guest, outside the kind network, with TLS and password logins. The install took three tries. The first was our mistake with an installer variable. The second failed in the database step, and `ate-setup deploy ate-system` then failed after 198 s. The third deploy took 29 s.

```listing
title: the database script, run without a transaction
source: capture/lab/U-pg-upgrade-scale/10-extpg-install/20-pg-setup-attempt2-no-transaction.log
lang: text
note: Five lines of the output of psql. The script built a role name from a setting that was already gone.
---
ERROR:  zero-length delimited identifier at or near """"
LINE 1: CREATE ROLE "" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE N...
                    ^
QUERY:  CREATE ROLE "" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
CONTEXT:  PL/pgSQL function inline_code_block line 28 at EXECUTE
```

The database guide tells you to run `setup.sql` with an administrator connection {{docs}}. The script stores its inputs with `set_config` in a form that lasts for one transaction {{code}}. Run from a pipe, each statement is its own transaction, so the role name was empty when the script used it. With `psql --single-transaction` the same file ran with no error. The installer wraps the script in `BEGIN` and `COMMIT` for the bundled database {{code}}. The guide does not say that you must do the same.

While the roles were missing, `ate-api-server` logged `password authentication failed` every 2 s. Read that line as a database that was never set up, and not only as a wrong password.

Four things differed from the bundled install:

- Two environment variables carry the connection strings: `ATE_API_POSTGRES_READ_WRITE_CONNECTION_STRING` and `ATE_API_POSTGRES_OWNER_CONNECTION_STRING`. The flag `--ateapi-postgres-server-ca-file` gives the CA of the server.
- `sslmode=verify-full` worked with an IP address in the server certificate. All 14 connections of `ate-api-server` used TLS 1.3.
- The install deployed no `postgres` StatefulSet. It still deployed the `postgres` NetworkPolicy, which then selects no pod.
- The install record on disk held no connection string, and the installer asks for both strings again on a retry.

**We measured** the lifecycle on that cluster. `create actor` took 0.24 s and the first request 0.48 s, once each. A synchronous suspend took a median of 0.86 s (0.59 to 1.16), and the resume after it 0.31 s (0.25 to 0.74), in 10 cycles. Another install ran on the guest in those minutes, so read these times as upper values. The count continued across every suspend.

**We measured** one outage of that database, 60.6 s long. A running actor failed 62 of 211 requests: 54 client timeouts at 9 s and 8 answers of 500. It answered again 0.7 s after the database was ready. New resumes failed in 19 of 43 requests, and the last failed one was sent 28.7 s after ready. The bundled database gave the same pattern, 66 of 158 requests and 27 s, as [section 8.2](#s-when-a-dependency-is-down) shows. So an outside Postgres removes the single pod, and it does not shorten an outage by itself.

### The same install with Postgres on another machine

**We measured** a second install with the database on another machine, once. The cluster was a new kind cluster on the second x86 server guest (16 vCPU, 23 GB). Postgres 18 ran in a container on another guest of the same server, over TLS 1.3 with `sslmode=verify-full`. `setup.sql` ran over that network with `psql --single-transaction` and returned 0. The deploy took 173 s, while bucket cycles ran on the same guest. The same three settings were enough, and the install again deployed no `postgres` StatefulSet.

The two guests reach each other through the user-mode network of the hypervisor. One query took a median of 0.56 ms on that path. We then added 20 ms toward the database with `tc netem`, and one query took 26.5 ms.

| Delay added toward Postgres | One query, median, n=20 | Synchronous suspend, median (range), n=10 | Resume, median (range), n=10 | Request to a running actor, median, n=10 |
|---|---|---|---|---|
| none | 0.56 ms | 0.64 s (0.61 to 0.70) | 0.32 s (0.30 to 0.36) | 0.03 s |
| 20 ms | 26.5 ms | 1.13 s (1.01 to 1.81) | 0.82 s (0.71 to 1.20) | 0.08 s |

So 20 ms of round trip to the database added about 0.5 s to a suspend and to a resume. A request to a running actor paid 0.05 s. A suspend and a resume each make several database calls in a row, and each call pays the round trip. [Section 8.2](#s-when-a-dependency-is-down) has two outages of this database.

The rest of this part comes from the code and the documentation at the tag.

- `ate-api-server` takes two connection strings: `--postgres-owner-connection-string` and `--postgres-read-write-connection-string`. The owner role runs migrations, and the read-write role serves requests. The default role names are `substrate_owner` and `substrate_readwrite`.
- The repository includes an overlay for Cloud SQL through its proxy. Any other PostgreSQL service is yours to connect.
- The Cloud SQL scaling guide of the project says that a connection pooler in transaction mode does not work. Its reason is a session that listens for worker changes {{docs}}. The code at the tag does not match that reason. The worker watch reads the `worker_outbox` table every 50 ms, and the advisory locks last for one transaction {{code}}. A run with a pooler is planned for the next edition. Until then, use session mode, or test transaction mode yourself.
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

Two more facts come from the code and the documentation at the tag. An actor owns one durable snapshot at a time, and the next successful suspend releases the one before it. `ate-api-server` deletes the objects before it drops the row. A failure between the two steps leaves the row in `ACTOR_STATE_DELETING` with its objects gone, and a repeated delete finishes the work. It does not leave objects with no row.

[Figure 8.1](#fig-8-1) puts the three places together.

```figure
id: fig-8-1
kind: structure
title: the three places that hold an actor
claim: Postgres holds the record of each actor, the bucket holds its durable snapshot, and the node disk holds a second copy for 30 minutes.
caption: The cylinder is Postgres, the bucket is the object store, and the tray on the node is the node disk. The labels of each store give its names and the size we measured with 25 suspended actors. From capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, and the schema migration at v1.0.0.
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

**Our position:** size the node disk for the memory of every actor that can suspend on that node inside 30 minutes, plus the snapshot cache. Size the bucket for the memory of every suspended actor, plus one golden snapshot for each template. For memory fidelity, count the memory that holds data and add about 1 percent: our node held 8,801 MiB for 8,750 MiB. Keep free space above both numbers. A files-only snapshot is far smaller. For an actor with one small file in its volume, it was 44 KiB on the node and 48 KiB in the bucket.

## A bucket outside the cluster, and what distance costs

Every other run in this manual used a bucket in the cluster. For this part we moved the bucket out and added network delay. [Figure 8.1b](#fig-8-1b) shows every cycle.

```figure
id: fig-8-1b
kind: chart
title: a bucket outside the cluster, with 20 and 100 ms of added round trip
claim: With 20 ms of added round trip, a resume of 1,000 MiB from the bucket took 10.2 s and not 4.8 s.
caption: Read each panel left to right, from the bucket in the cluster to the bucket outside it with more delay. Each dot is one cycle, and a line joins the medians of one size. The steps on the horizontal axis are not to scale. From capture/lab/summary/object-store-x86.json.
```

**We measured** this on the second x86 server guest (16 vCPU, 23 GB), with five cycles for each cell unless the table says less. One cycle is a suspend with `--mode sync`, a wait until the node copy is gone, and one request. `atelet` ran with an upload delay of 3 s and a detach delay of 10 s, for these runs only. The outside bucket was rustfs in a container on the same guest, outside the kind network. We added the delay with `tc netem`, and a connection from a node then took 20.3 and 100.4 ms. All 49 requests returned 200.

| Bucket | Added round trip | Data in memory | Synchronous suspend, median (range) | Resume from the bucket, median (range) |
|---|---|---|---|---|
| In the cluster | none | 0 MiB | 0.52 s (0.44 to 0.55) | 0.25 s (0.22 to 0.28) |
| In the cluster | none | 200 MiB | 2.07 s (1.83 to 2.21) | 1.04 s (0.91 to 1.09) |
| In the cluster | none | 1,000 MiB | 6.44 s (5.32 to 7.11) | 4.50 s (4.49 to 4.84) |
| Outside | none | 0 MiB | 0.47 s (0.45 to 0.55) | 0.25 s (0.22 to 0.34) |
| Outside | none | 200 MiB | 2.14 s (1.84 to 2.31) | 1.08 s (1.03 to 1.10) |
| Outside | none | 1,000 MiB | 7.09 s (5.80 to 7.23) | 4.79 s (4.54 to 4.95) |
| Outside | 20 ms | 0 MiB | 0.66 s (0.61 to 0.76) | 0.37 s (0.35 to 0.45) |
| Outside | 20 ms | 200 MiB | 2.70 s (2.44 to 2.81) | 2.50 s (2.49 to 2.71) |
| Outside | 20 ms | 1,000 MiB, 4 cycles | 8.39 s (7.17 to 8.90) | 10.24 s (9.62 to 10.87) |
| Outside | 100 ms | 0 MiB | 1.53 s (1.41 to 1.59) | 0.94 s (0.86 to 1.06) |

Three results come out of the table. Moving the bucket out of the cluster, with no delay, changed little. A round trip of 20 ms more than doubled the resume at 200 and at 1,000 MiB, and the suspend grew less. At 100 ms even an actor with no data paid: its resume went from 0.25 s to 0.94 s.

Read the limits before you use these numbers. The bucket ran on the same guest, so the delay was emulated, and the bucket shared one disk and one CPU with the node. Bandwidth was not limited. Two cells at 100 ms were missing in that run, and the next part has them. The fifth cycle of 1,000 MiB at 20 ms is still missing. The next part also moves the bucket to another machine.

**Our position:** measure the round trip from your nodes to your bucket before you promise a resume time. Keep the bucket in the region of the cluster. An actor that must wake fast needs its node copy. Set the detach delay to the longest idle time of that actor, as [section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) describes.

## A bucket on another machine

We then put the bucket on another machine. [Figure 8.1c](#fig-8-1c) shows every cycle.

```figure
id: fig-8-1c
kind: chart
title: a bucket on another guest, with TLS, a rate limit, and added delay
claim: With the bucket on another guest, a request to an actor of 1,000 MiB got a 504 after 10 s and its first 200 after 12 s.
caption: Read each panel left to right, from the plain path to the paths with a limit. Each dot is one cycle, a short line is the median of a group, and the number above a group is the MiB of data. The vertical scale grows by ten at each step. From capture/lab/summary/remote-store-x86.json.
```

**We measured** this on the second x86 server guest (16 vCPU, 23 GB), with five cycles for each cell unless the table says less. The bucket was rustfs in a container on another guest of the same server.

The method was the one above, with one change. When a request returned 504, the client sent it again each second until the first 200, and it sent no `revert`. So the last column is an upper value, about 1 s coarse. All 51 cycles ended with 200 and the right count.

The path decides every number here. The two guests reach each other through the user-mode network of the hypervisor. A connection from a node took 0.7 to 1.8 ms in five tries. A copy of 300 MiB took 3.9 s up and 4.5 s down, which includes about 1 s to start the client. That is about 100 MiB each second.

| Path to the bucket | Data in memory | Synchronous suspend, median (range) | First answer | Request to the first 200, median (range) |
|---|---|---|---|---|
| Plain HTTP | 0 MiB | 0.49 s (0.47 to 0.56) | 200 | 0.28 s (0.26 to 0.30) |
| Plain HTTP | 200 MiB | 3.07 s (3.00 to 3.15) | 200 | 2.64 s (2.63 to 2.68) |
| Plain HTTP | 1,000 MiB | 13.10 s (11.73 to 14.06) | 504 after 10.05 s, 5 of 5 | 12.15 s (11.44 to 12.45) |
| TLS | 0 MiB | 0.48 s (0.46 to 0.52) | 200 | 0.26 s (0.25 to 0.32) |
| TLS | 200 MiB | 4.96 s (4.64 to 5.01) | 200 | 2.54 s (2.48 to 2.61) |
| TLS | 1,000 MiB | 20.78 s (20.12 to 22.35) | 504, 5 of 5 | 12.45 s (12.24 to 12.72) |
| Plain HTTP, limited to 100 Mbit/s | 200 MiB | 18.63 s (18.42 to 18.90) | 504, 5 of 5 | 18.06 s (17.90 to 18.20) |
| Plain HTTP, limited to 20 Mbit/s | 200 MiB | 88.50 s (88.32 to 88.55) | 504, 5 of 5 | 87.80 s (87.79 to 87.86) |
| Plain HTTP, 100 ms added | 0 MiB | 1.54 s (1.35 to 1.79) | 200 | 1.98 s (1.46 to 2.15) |
| Plain HTTP, 100 ms added | 200 MiB | 107.4 s (106.8 to 107.6) | 504, 5 of 5 | 55.1 s (54.7 to 55.2) |
| Plain HTTP, 100 ms added | 1,000 MiB, 1 cycle | 424.2 s | 504 | 213.4 s |

Four results come out of the table.

- **Another machine costs more than another container.** With no shaping, 200 MiB resumed in 2.64 s, against 1.08 s with the bucket on the same guest. 1,000 MiB took 12.15 s against 4.79 s.
- **A resume that passes 10 s returns 504 first.** In 26 of these 51 cycles the first answer was a 504 after 10.05 s. The resume went on, and a later request returned 200 with the state. [Section 4.4](#s-request-parking) explains the limit.
- **Bandwidth sets the time once the snapshot is large.** At 20 Mbit/s, 200 MiB took 88 s in each direction. That is close to the size divided by the rate.
- **A synchronous suspend has no fixed limit while data moves.** One suspend ran 424 s and succeeded.

Do not read the rows with 100 ms as the rows of a real link. On this path, the same copy of 300 MiB took 55 s in each direction with the delay, which is about 5.5 MiB each second. The user-mode network passes each connection through a process on the host, and delay cut its rate by a factor of about 18. We did not measure a real link with 100 ms, so we cannot give its numbers.

**We measured** the two cells that the earlier run missed, with the method of that run and five cycles each. The bucket was in a container on the same guest, with 100 ms added. At 200 MiB the synchronous suspend took a median of 7.17 s (5.26 to 8.43). The request took 8.74 s (6.98 to 12.83) to its first 200. At 1,000 MiB the suspend took 14.17 s (12.89 to 14.66), and the request took 16.16 s (16.05 to 16.47). Six of these ten requests got a 504 first.

So the same 200 MiB with the same delay took 8.74 s on one path and 55.1 s on the other.

### TLS to the bucket

Substrate v1.0.0 has no install setting for the CA of a bucket. **The code** builds the client of the object store plugin from the default configuration of the AWS SDK {{code}}. That SDK reads the variable `AWS_CA_BUNDLE`. So we gave the plugin a CA with a patch.

```listing
title: the patch that gives the object store plugin a CA
source: capture/lab/X-remote-store-pg/_scripts/x1-store.sh
lang: bash
note: Four lines of the script of the run. One line is left out, and the patch line is cut in its middle. The patch adds a volume, a mount, and one variable to the plugin container.
---
  kc -n ate-system create configmap x-store-ca --from-file=ca.crt=$HOME/x/tls/ca.crt --dry-run=client -o yaml | kc apply -f - >> 11-patches.log 2>&1
  for w in ds/atelet deploy/ate-api-server; do
    i=$(idx $w objectstore-plugin initContainers)
…
    kc -n ate-system patch $w --type=json -p "[{\"op\":\"add\",\"path\":\"/spec/template/spec/volumes/-\",\"value\":{\"name\":\"x-store-ca\",\"configMap\":{\"name\":\"x-store-ca\"}}},…{\"op\":\"add\",\"path\":\"/spec/template/spec/initContainers/$i/env/-\",\"value\":{\"name\":\"AWS_CA_BUNDLE\",\"value\":\"/x-store-ca/ca.crt\"}}]" >> 11-patches.log 2>&1
```

In the script, `kc` is `kubectl` with the kubeconfig of the cluster. The plugin runs in `atelet` and in `ate-api-server`, so the patch goes to both.

**We measured** the result on the same guest. A client with the CA completed a handshake with TLS 1.3, and `curl` without the CA stopped with exit code 60. In the table, TLS cost time in the suspend only. A suspend of 200 MiB took 4.96 s against 3.07 s, and one of 1,000 MiB took 20.78 s against 13.10 s. The resume times stayed inside the range of the plain path.

**Our position:** treat this patch as your own change, and check it after each `ate-setup deploy` and each upgrade. The installer does not know the variable, so a new deploy can write the container without it.

## Coming next

Our object store was rustfs in every run. It ran in the cluster, in a container on the same guest, and on another guest of the same server. Our outside Postgres ran on the same guest and on another guest. The next edition adds Google Cloud Storage, Amazon S3, and a real link with 100 ms of delay. It also adds a managed database, a Postgres restore, and a bucket restore. [Coming in the next edition](#s-next-edition) has the full list.

Until those runs, we give no tested backup procedure. Two backups at the same clock time are not one consistent backup. A suspend or a delete between them leaves rows and objects out of step.

```takeaways
- List actors with `kubectl ate get actor`, because Kubernetes holds no actor object.
- Back up Postgres and the bucket together, and restore them together.
- Replace the bundled single-replica Postgres before people depend on the cluster.
- Read the atespace and the actor uid from `snapshotUri` when you look for a snapshot in the bucket.
- Size node disk for the memory of all actors that suspend there in 30 minutes.
- Run `setup.sql` in one transaction when you prepare an outside Postgres.
- Measure the round trip from your nodes to the bucket before you promise a resume time.
- Send a request again after a 504 on a resume from a far bucket, and send no revert.
- Give the object store plugin a CA with `AWS_CA_BUNDLE`, because the install has no setting for it.
```

Sources: capture/lab/summary/external-postgres-x86.json, capture/lab/summary/object-store-x86.json, capture/lab/U-pg-upgrade-scale/10-extpg-install/steps.tsv, capture/lab/U-pg-upgrade-scale/10-extpg-install/20-pg-setup-attempt2-no-transaction.log, capture/lab/U-pg-upgrade-scale/10-extpg-install/20-pg-setup.log, capture/lab/U-pg-upgrade-scale/10-extpg-install/29-deploy-diff.txt, capture/lab/U-pg-upgrade-scale/10-extpg-install/31-api-server-log-db-not-provisioned.txt, capture/lab/U-pg-upgrade-scale/10-extpg-install/30-deploy-attempt2-db-not-provisioned.log, capture/lab/U-pg-upgrade-scale/10-extpg-install/41-ate-system-objects.txt, capture/lab/U-pg-upgrade-scale/10-extpg-install/43-pg-connections-and-tables.txt, capture/lab/T-drain-store/90-store-cycles.tsv, capture/lab/T-drain-store/83-netem-rtt.txt, capture/lab/T-drain-store/82-atelet-args-patched.txt, capture/lab/summary/validation-memory-x86.json, capture/lab/summary/validation-fidelity-x86.json, capture/lab/A-quickstart/60-state.log, capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml, capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, capture/lab/summary/footprint-x86.json, capture/lab/K-kagent/inventory/workloads.txt (the PostgreSQL Deployment); go/core/pkg/install/bundled_postgres.yaml at kagent v1.0.0 (the trust setting); cmd/ateapi/main.go (the Postgres flags), docs/dev/cloud-sql-scaling-guide.md and issue #3702 (the load report); cmd/ateapi/internal/store/atepg/migrations/000001_initial.sql (the tables), cmd/ateapi/internal/store/atepg/lease.go (the lease), manifests/ate-install/postgres/postgres.yaml (replicas, image, volume claim), manifests/ate-install/ate-api-server.yaml (replicas) and manifests/ate-install/kind/ at v1.0.0; docs/guides/postgres.md, docs/guides/node-storage.md and docs/reference/api-guide.md (snapshot layout, delete order) at v1.0.0; issue #3101 (disk pressure from node-local snapshots)., capture/lab/summary/remote-store-x86.json, capture/lab/summary/remote-postgres-x86.json, capture/lab/X-remote-store-pg/22-store-cycles.tsv, capture/lab/X-remote-store-pg/13-path.txt, capture/lab/X-remote-store-pg/19-tls-store-check.txt, capture/lab/X-remote-store-pg/_scripts/x1-store.sh, capture/lab/X-remote-store-pg/40-pg-install/steps.tsv, capture/lab/X-remote-store-pg/40-pg-install/30-pg-setup.log, capture/lab/X-remote-store-pg/40-pg-install/10-pg-reach.txt, capture/lab/X-remote-store-pg/40-pg-install/51-ate-system-objects.txt, capture/lab/X-remote-store-pg/50-pg-tests/05-pg-round-trip.txt, capture/lab/X-remote-store-pg/50-pg-tests/11-cycles-delay0.tsv, capture/lab/X-remote-store-pg/50-pg-tests/11-cycles-delay20.tsv, capture/lab/X-remote-store-pg/50-pg-tests/12-running-requests-delay0.tsv, capture/lab/X-remote-store-pg/50-pg-tests/12-running-requests-delay20.tsv
