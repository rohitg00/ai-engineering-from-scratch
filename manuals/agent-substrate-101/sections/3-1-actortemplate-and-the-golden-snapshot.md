# ActorTemplate and the golden snapshot

> Substrate snapshots each ActorTemplate once, and every new actor starts suspended from that snapshot, so its first call pays a restore.

Your agent image takes several seconds to import its libraries and load its tools. With a Deployment, every new pod pays those seconds again. Substrate moves that cost to the template. It starts the image once, takes a snapshot, and creates every new actor from that snapshot. The cost does not disappear: the first request to a new actor restores the snapshot, and the restore grows with the memory in it.

When you finish this section, you can write an ActorTemplate, check that its golden snapshot exists, and predict the first-call time of a new actor.

## The template we used

**ActorTemplate:** the description of an actor: its containers, its resource limits, its volumes, the worker pools that it can run on, and its snapshot settings. A template belongs to one atespace, and `ate-api-server` stores it in Postgres. It is not a Kubernetes object, so `kubectl get` does not list it.

This is one of the five templates of our resume tests. The actor is a small Go server that holds 200 MiB of random bytes and counts its requests.

```listing
title: an ActorTemplate that holds 200 MiB
source: capture/lab/C-resume-vs-size/tmpl-200.yaml
lang: yaml
note: The complete file. We created it with kubectl ate create actor-template -f.
---
metadata:
  atespace: lab-c
  name: ballast-200
workerSelector:
  matchLabels:
    workload: ballast
containers:
- name: ballast
  image: localhost:5001/ballast@sha256:93dba82ad560e7fc4ccb2a33a63d64713b519a7895ba3fd98130ce789eab7fd3
  command:
  - /ballast
  - --mb=200
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
resources:
  limits:
    cpuMillicores: 1000
    memoryBytes: 478150656
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
```

Five fields decide how the actor behaves.

- `image` must name a digest, and a tag alone is refused {{code}}. Ours is a `scratch` image from a plain `docker build`, with no change for Substrate.
- `resources.limits` needs both values {{code}}. The scheduler books them against the capacity of a worker, which [section 4.1](#s-workerpool) explains.
- `workerSelector` matches the labels of a WorkerPool object. [Section 3.6](#s-atespaces) shows why the namespace of the pool does not count.
- `wakeupProbe` is a readiness check that runs on every resume. The actor becomes `ACTOR_STATE_RUNNING` only after the probe passes {{docs}}.
- `preferredFidelity` says how much state a snapshot keeps. [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) compares the three levels.

A template is immutable, and the API has no call that updates one {{code}}. For new code you create a new template, and then you move each suspended actor with `kubectl ate update actor --template` {{docs}}.

We ran that move with two templates that differ in the image. On a running actor the update is refused.

```listing
title: a template change on a running actor
source: capture/lab/V-validation/06-template-move/10-move.tsv
lang: text
note: One line of the trace. The time and the event name at the start of the line are cut.
---
…Error: failed to update actor: rpc error: code = FailedPrecondition desc = actor must be ACTOR_STATE_SUSPENDED to change its actor template (got: ACTOR_STATE_RUNNING) 
```

On the suspended actor the update was accepted, and the next call ran the new image. The count in memory started again at 1, and so did the count on the root filesystem. The count on the `durableDir` volume continued at 4. So a move keeps the volumes and drops the old memory snapshot. Suspend first, and expect a cold start of the new image on the next call.

## The golden snapshot is built once

**Golden snapshot:** the snapshot of one temporary actor that Substrate starts from a new template. Substrate stores it under a tag, the golden tag, and every new actor of that template starts from that tag.

`ate-api-server` builds the golden snapshot in four steps {{docs}}.

1. It creates a temporary golden actor in the atespace of the template, and it resumes that actor.
2. It waits until the actor is ready. If a container has no `wakeupProbe`, it waits 20 seconds more {{code}}.
3. It suspends the actor at the `preferredFidelity` of the template, and it copies the snapshot to a published tag.
4. It deletes the golden actor, and it writes the tag into the status of the template.

The log of `ate-api-server` on our kagent cluster shows all four steps for one template.

```listing
title: the golden actor of one template, from create to delete
source: capture/lab/K-kagent/logs/actor-state-changes.tsv
lang: text
note: The first seven lines of the file. The columns are the time, the uid of the actor, the operation, and the new state.
---
2026-11-12T10:16:44.165402326Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	create	suspended
2026-11-12T10:16:44.178659651Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	resume	resuming
2026-11-12T10:16:54.017864285Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	resume	running
2026-11-12T10:16:54.03004179Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	suspend	suspending
2026-11-12T10:16:54.180722259Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	suspend	suspended
2026-11-12T10:16:54.238242923Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	delete	deleting
2026-11-12T10:16:54.328177186Z	dd7b8625-0d96-4d7d-89da-4ec9cc3b914a	delete	deleted
```

The timestamps show a resume of 9.84 seconds, because the golden actor is the one actor that boots the image from zero. The suspend took 0.15 seconds. That template had a files-only fidelity, so the snapshot held no memory.

The build pays the full start of your application, once.

**We measured** one template for a Python server on the x86 server guest (24 vCPU, 47 GB, nested KVM), with n=1. The server builds a dict of one million values at start. The golden tag was ready 39.3 seconds after `create actor-template`. The process was 32.9 seconds old at its first request, so most of that time was the application start under gVisor. A new actor of that template then answered its first call in a median of 0.63 seconds, with five new actors. [Section 3.3](#s-suspendactor-and-resumeactor) shows the server.

The golden tag does not exist at the moment the template does. In our resume tests we listed the five templates 21 seconds after we created them.

```listing
title: five templates, 21 seconds after create
source: capture/lab/C-resume-vs-size/02-templates.txt
lang: text
note: The complete file. The 1,000 MiB template has no golden tag yet.
---
ATESPACE   NAME           GOLDEN TAG                             ERROR   AGE
lab-c      ballast-0      e32029d7-3d9b-4212-8953-e88d7cede5b4           21s
lab-c      ballast-1000                                                  20s
lab-c      ballast-200    b9f97b82-b187-419d-8789-6c8c7b8a6c8c           20s
lab-c      ballast-50     0382e2fc-99db-461a-8845-a90d93484443           21s
lab-c      ballast-500    2fa7aaf9-1fe8-4076-9350-af27ba338a6b           20s
```

All five had a tag when we looked again at 118 seconds. Wait for the `GOLDEN TAG` column before you create actors. An actor that you create earlier records no snapshot. It boots from the image on its first call, and it keeps that cold start until its own first suspend {{docs}}.

We ran that race. We created an actor directly after its template, and `create actor` succeeded.

```listing
title: an actor created before the golden snapshot exists
source: capture/lab/V-validation/05-golden-race/10-race.tsv
lang: text
note: Four lines of the trace. The actor rc1 is early, and the actor rc2 was created after the golden tag. The lines between them are cut.
---
2026-11-12T12:49:47.365Z	rc1-state	ACTOR_STATE_SUSPENDED	-	
2026-11-12T12:49:48.542Z	rc1-first-call	200	0.983729	tag=v3 count=1 mb=200 fill=random sum=26936 rootfs=-1 data=-1 pid=1 process_age_s=0.8 child[none]
…
2026-11-12T12:50:00.900Z	golden-ready	waited 11.137 s more
2026-11-12T12:50:01.888Z	rc2-state-new	ACTOR_STATE_SUSPENDED	-	SNAPSHOT_OWNER_TAG:SNAPSHOT_FIDELITY_MEMORY:SNAPSHOT_STORAGE_STATE_COMPLETED:gen1
```

**We measured** this once on the x86 server guest (24 vCPU, 47 GB, nested KVM), with a 200 MiB actor. The early actor was `ACTOR_STATE_SUSPENDED` with an empty snapshot list. Its first call was a cold start and took 0.98 seconds. The golden tag was ready 11 seconds later, and the first call of an actor created after that took 0.93 seconds. Five more early actors of another template still had no snapshot 25 seconds later.

So an early actor never adopts the golden snapshot. It gets its own snapshot at its first suspend. Our actor starts in under a second, so the two first calls cost the same. With an application that needs 30 seconds to start, the early actor pays 30 seconds on its first call.

You can turn the golden snapshot off with `goldenSnapshotConfig.mode: GOLDEN_SNAPSHOT_MODE_DISABLED` {{code}}. Every new actor then boots from the image.

## A new actor starts suspended

`kubectl ate create actor` writes one row in Postgres and touches no worker, so its time does not depend on the template. The new actor is suspended, and it already has a snapshot.

```listing
title: the actor my-counter-1 directly after create
source: capture/lab/B-lifecycle/00-actor-before.json
lang: json
note: The sandboxRuntime block and the end of the file are cut.
---
{
  "actorTemplate": {
    "atespace": "ate-demo-counter",
    "name": "counter"
  },
  "metadata": {
    "atespace": "ate-demo-counter",
    "createTime": "2026-11-12T10:13:40.987568669Z",
    "name": "my-counter-1",
    "uid": "6f80f612-7547-4f5b-b3ab-831595621806",
    "updateTime": "2026-11-12T10:13:40.987568669Z",
    "version": "1"
  },
  "status": {
    "lastAssignedGeneration": 1,
    "snapshots": [
      {
        "actorTemplateUid": "71a3a39c-5f37-4d6e-937f-9c314fea7668",
        "durableSnapshot": {
          "object": {
            "snapshotUri": "gs://ate-snapshots/atespaces/ate-demo-counter/tags/ad19ee28-1519-432a-bcc5-40cf99cce3ca"
          },
          "state": "SNAPSHOT_STORAGE_STATE_COMPLETED"
        },
        "fidelity": "SNAPSHOT_FIDELITY_MEMORY",
        "generation": 1,
        "owner": "SNAPSHOT_OWNER_TAG",
        …
    "state": "ACTOR_STATE_SUSPENDED"
  }
}
```

Read three fields. `state` is `ACTOR_STATE_SUSPENDED`, so no sandbox exists yet. `owner` is `SNAPSHOT_OWNER_TAG`, so the actor borrows the snapshot of the golden tag and owns none. The URI has a `tags` segment, and it does not hold the uid of the actor. The actor writes its own snapshot at its first suspend.

```figure
id: fig-3-1
kind: flow
title: from ActorTemplate to the first call
claim: Substrate builds one golden snapshot for each template, and every new actor starts suspended from it.
caption: Read the top row once for each template and the bottom row once for each actor. The numbers match the key. Names and seconds are from our resume tests on the x86 server guest. From capture/lab/C-resume-vs-size/10-local.tsv and capture/lab/C-resume-vs-size/02-templates.txt.
```

## The first call pays for the restore

The first request to a new actor restores the golden snapshot. For a small actor you do not notice it. For a large one, it is the slowest request that the actor ever serves.

| Memory in the template | First call of a new actor, median | Fastest and slowest of 5 | Later resume of the same actor, median |
|---|---|---|---|
| 0 MiB | 0.23 s | 0.22 to 0.24 s | 0.22 s |
| 50 MiB | 0.25 s | 0.24 to 0.40 s | 0.24 s |
| 200 MiB | 0.62 s | 0.56 to 0.86 s | 0.47 s |
| 500 MiB | 5.76 s | 1.86 to 6.76 s | 1.07 s |
| 1,000 MiB | 6.60 s | 3.46 to 12.75 s | 2.16 s |

**We measured** these times on the x86 server guest (24 vCPU, 47 GB, nested KVM), with gVisor and five new actors for each size. Each time is one request through `kubectl ate proxy`, timed at the client. A request to an actor that already runs took 0.06 seconds on the same path. The later resume is the median of 10 resumes from the snapshot on the node. `kubectl ate create actor` returned in 0.20 to 0.26 seconds for all 25 actors.

```figure
id: fig-3-1b
kind: chart
title: the first call of a new actor against its memory
claim: At 1,000 MiB the first call of a new actor took 3.5 to 12.7 seconds, and a later resume took 2.2 seconds.
caption: Each teal dot is the first call of one new actor, five for each size, and the teal line joins the medians. The violet line is the median of ten later resumes of one actor from the node. Measured on the x86 server guest. From capture/lab/summary/resume-x86.json.
```

Up to 200 MiB the first call costs about the same as a later resume. At 500 MiB and above it costs three to five times more, and the spread is wide. We did not find the cause of that spread. We can say where the node kept data. Its `snapshot-cache` directory held 1,765 MiB, and the five snapshot sizes of our templates add up to 1,760 MiB.

Our position: the golden snapshot is a good place for slow start code and a bad place for large memory. If your template holds more than about 200 MiB, send one request to each new actor before a user does. Then suspend it. Every later resume follows the lower line.

```takeaways
- Pin the image of a template by digest, and set both resource limits.
- Give every container a wakeupProbe, so the golden snapshot needs no extra 20 seconds.
- Wait for the GOLDEN TAG column before you create the first actor.
- Create a new template for new code, suspend each actor, and then move it.
- Send one request to a large new actor before a user does.
```

Sources: capture/lab/summary/resume-x86.json, capture/lab/C-resume-vs-size/tmpl-200.yaml, capture/lab/C-resume-vs-size/02-templates.txt, capture/lab/C-resume-vs-size/09-templates-at-start.txt, capture/lab/C-resume-vs-size/10-local.tsv, capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/00-image.txt, capture/lab/B-lifecycle/00-actor-before.json, capture/lab/K-kagent/logs/actor-state-changes.tsv, capture/lab/summary/kagent-turns-x86.json, capture/lab/summary/footprint-x86.json, capture/lab/summary/validation-memory-x86.json, capture/lab/V-validation/02-python-runtime/10-python.tsv, capture/lab/V-validation/05-golden-race/10-race.tsv, capture/lab/V-validation/06-template-move/10-move.tsv. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (ActorTemplate, GoldenSnapshotMode, Snapshot, SnapshotOwner), cmd/ateapi/internal/controlapi/template_reconciler.go (goldenSnapshotWarmup), docs/reference/api-guide.md (The Golden Snapshot, Container Wakeup Probe, UpdateActor).
