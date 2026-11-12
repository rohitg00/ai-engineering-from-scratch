# Snapshot fidelity, and where a snapshot lives

> A snapshot keeps what its fidelity names, it is as large as the memory that holds data, and for five minutes it exists on one node only.

Your agent wrote a file to `/tmp`, started a background process, and ended its turn. On the next turn the file is gone and the process does not exist. Nothing failed. The template asked for a snapshot of files only, and `/tmp` is not one of those files. A second surprise waits on the node: the snapshot that you took a minute ago is not in the object store yet.

When you finish this section, you can choose a fidelity for a template and estimate the disk that suspended actors need. You can also say where a snapshot is at each minute after a suspend.

## Three fidelities

**Snapshot fidelity:** the set of state layers that a snapshot holds. A template names the highest level that it wants in `snapshotConfig.preferredFidelity`, and each level includes the levels below it {{code}}.

| Fidelity | The snapshot holds | A resume |
|---|---|---|
| `SNAPSHOT_FIDELITY_VOLUMES` | The `durableDir` volumes | Boots the containers from the image, with the volumes back |
| `SNAPSHOT_FIDELITY_ROOTFS` | The volumes, and the writes to the root filesystem since boot | Boots the containers from the image, with those writes back |
| `SNAPSHOT_FIDELITY_MEMORY` | The volumes, the root filesystem writes, and the process memory | Continues the same processes |

kagent uses the first level. Its template mounts one `durableDir` volume at `/data` and sets `SNAPSHOT_FIDELITY_VOLUMES`. In the first turn of a session, we told the agent to write to three places and to start a process.

```listing
title: what turn 1 wrote
source: capture/lab/K-kagent/session1/turn1.txt
lang: text
note: The first line of the file. The end of the command, which only prints values, is cut.
---
RUN: mkdir -p /data/workspace && echo hello-from-turn1 > /data/workspace/note.txt; echo scratch-turn1 > /tmp/scratch.txt; echo rootfs-turn1 > /root-marker.txt 2>/dev/null; (nohup sleep 100000 >/dev/null 2>&1 &) ;…
```

kagent suspended the actor after that turn. The second turn read the same places.

```listing
title: what turn 2 found
source: capture/lab/K-kagent/session1/turn2.out
lang: text
note: The first four lines of the file.
---
note=hello-from-turn1
scratch=cat: can't open '/tmp/scratch.txt': No such file or directory
bg=
uptime=0.74
```

The note under `/data` is there. The file in `/tmp` is gone, the `sleep` process is gone, and the sandbox is 0.74 seconds old. The write to `/` failed in turn 1, because the harness does not run as root.

The other end is `SNAPSHOT_FIDELITY_MEMORY`, which our counter and our memory test used. To compare all three levels, we ran one actor under each level. The actor holds 50 MiB of random bytes and starts a child process. It keeps one count in memory, one in a file on the root filesystem, and one in a file on a `durableDir` volume.

| Fidelity | Memory count | Root filesystem count | Volume count | Processes after a resume | Snapshot on the node | Resume, median of 10 |
|---|---|---|---|---|---|---|
| `SNAPSHOT_FIDELITY_VOLUMES` | back to 1 | back to 1 | continued to 25 | new, 0.2 to 0.4 s old | 44 KiB | 0.52 s |
| `SNAPSHOT_FIDELITY_ROOTFS` | back to 1 | continued to 25 | continued to 25 | new, 0.2 to 0.3 s old | 72 KiB | 0.50 s |
| `SNAPSHOT_FIDELITY_MEMORY` | continued to 25 | continued to 25 | continued to 25 | the same, with the same child | 56.9 MiB | 0.25 s |

**We measured** these three actors on the x86 server guest (24 vCPU, 47 GB, nested KVM), with gVisor and one actor for each level. Each actor got 25 requests with 13 suspends between them, and all 75 requests returned 200. The resume column is one request to the suspended actor, timed at the client, with the snapshot on the node. An asynchronous suspend took a median of 0.32 seconds at the two lower levels and 0.54 seconds at the memory level, with 10 suspends each.

A resume at the two lower levels is a cold start of the container. The snapshot is a few KiB, so the cost is the start time of your application. Our Go actor starts in 0.3 seconds, and its resume took 0.5 seconds, twice the resume at the memory level. The kagent run was on a second x86 server guest (16 vCPU, 31 GB). There the harness image resumed in a median of 0.38 seconds under `SNAPSHOT_FIDELITY_VOLUMES`.

A Python agent is slower to start. We ran one on the same guest, on the cluster of the Part 9 demos, with three turns at each level. A turn after a suspend took 4.5 to 5.1 seconds under `SNAPSHOT_FIDELITY_VOLUMES`. It took 0.30 to 0.32 seconds under `SNAPSHOT_FIDELITY_MEMORY`. [A stateful agent actor](#s-a-stateful-agent-actor) shows that run.

```figure
id: fig-3-4b
kind: comparison
title: what each fidelity keeps
claim: Only SNAPSHOT_FIDELITY_MEMORY keeps the processes, and the two lower levels start new processes on every resume.
caption: Read each column top to bottom. Teal layers are in the snapshot, and grey layers are lost at the suspend. The last rows give the median resume and the three counts of one actor for each level, measured on the x86 server guest. From capture/lab/summary/validation-fidelity-x86.json.
```

`preferredFidelity` is an upper limit, and a memory snapshot can restore as less. A memory snapshot records the CPU architecture, the CPU features, and the sandbox build of the worker that took it. It restores only on a worker that matches. If no such worker has room, Substrate restores the files on another worker and boots the processes new {{docs}}. We did not see that downgrade in any run. Write your actor so that it survives a boot from its files, also at the memory level.

## A snapshot is as large as the memory that holds data

Start with the worst case, an actor whose memory is random bytes.

| Memory the actor holds | Snapshot on the node |
|---|---|
| 0 MiB | 1.3 MiB |
| 50 MiB | 51.7 MiB |
| 200 MiB | 201.9 MiB |
| 500 MiB | 502.2 MiB |
| 1,000 MiB | 1,002.7 MiB |

One file holds almost all of it.

```listing
title: the largest file in the snapshot of a 200 MiB actor
source: capture/lab/C-resume-vs-size/snapdir-b200-1.txt
lang: text
note: The last line of the file. The first number is the size in bytes, and the name of the checkpoint folder is cut.
---
211574784 /var/lib/ate/snapshots/a77c2723-c524-46d0-9a7e-caa97f36ab9c/local-checkpoint/…/pages.img
```

**We measured** these sizes with `du` on the kind node of the x86 server guest, one actor for each size. The memory was random bytes. The snapshot folder of an actor is named by the uid of the actor.

Random bytes are the largest snapshot that an actor of that size can have. We ran the same actor again with zero bytes, and with half zero and half random bytes.

```figure
id: fig-3-4d
kind: chart
title: snapshot size on the node for three kinds of memory
claim: An actor that held 500 MiB of zero bytes had a 4.6 MiB snapshot, and the same actor with random bytes had 504.1 MiB.
caption: Each dot is the snapshot of one actor on the node, and each line joins the two sizes of one kind of memory. The dashed line marks a snapshot as large as the memory held. The violet text is the median of ten resumes from the node. Measured on the x86 server guest. From capture/lab/summary/validation-memory-x86.json.
```

| Memory the actor holds | Snapshot on the node | Copy in the object store | Resume from the node, median | Asynchronous suspend, median |
|---|---|---|---|---|
| 200 MiB of zero bytes | 4.0 MiB | 1.1 MiB | 0.24 s | 0.35 s |
| 500 MiB of zero bytes | 4.6 MiB | 1.1 MiB | 0.23 s | 0.35 s |
| 200 MiB, half zero and half random | 103.8 MiB | 101.1 MiB | 0.28 s | 0.66 s |
| 500 MiB, half zero and half random | 254.4 MiB | 251.2 MiB | 0.57 s | 0.79 s |
| 200 MiB of random bytes | 203.8 MiB | 201.2 MiB | 0.42 s | 0.80 s |
| 500 MiB of random bytes | 504.1 MiB | 501.3 MiB | 1.07 s | 1.07 s |

**We measured** six actors on the x86 server guest (24 vCPU, 47 GB, nested KVM), one for each row. Each actor had 10 resumes and 10 asynchronous suspends. All 60 resumes returned 200, and every count continued. Each size is one `du` reading, on the node and in the data folder of the object store.

So the size follows the memory that holds data, and the resume time follows the same bytes. An actor with 500 MiB of zero pages resumed in 0.23 seconds, as fast as an actor that holds nothing. Do not count on that for a real heap. A Python process with a dict of one million random values reported a peak of 245 MiB. Its snapshot on the node was 215.2 MiB. [Section 3.3](#s-suspendactor-and-resumeactor) has its resume time.

The object store did not make the random snapshots smaller. Substrate compresses each object before the upload {{code}}, and random bytes do not compress. The copy of the Python actor was 110.1 MiB in the object store, about half of its node copy. We did not find out which step made it smaller.

| Where | With 25 suspended actors | After we deleted them |
|---|---|---|
| Snapshots on the node | 8,801 MiB | 1 MiB |
| Snapshot cache on the node | 1,765 MiB | 1,765 MiB |
| Object store | 10,824 MiB | 2,064 MiB |

**We measured** this footprint on the x86 server guest (24 vCPU, 47 GB, nested KVM). The node had five actors for each of the five sizes, which hold 8,750 MiB together. Each actor was 3 to 8 minutes old. The 2,064 MiB that stayed in the object store belong to golden snapshots. A template keeps its golden snapshot until you delete the template.

```figure
id: fig-3-4c
kind: chart
title: disk use of 25 suspended actors, and after their delete
claim: 25 suspended actors that held 8,750 MiB of memory used 8,801 MiB on the node and 10,824 MiB in the object store.
caption: Each pair of bars is one place. The full bar is the size with the 25 suspended actors, and the outlined bar is the size after we deleted them. The dashed line marks the memory that the actors hold together. Measured on the x86 server guest. From capture/lab/summary/footprint-x86.json.
```

An actor owns one snapshot in the object store, or two after an asynchronous suspend. A synchronous suspend deletes the earlier snapshot. An asynchronous suspend keeps it, because the new snapshot is not yet durable. The first suspend after the new snapshot is durable deletes the old one, and a delete of the actor removes both {{docs}}.

So plan the object store for up to two times the memory that holds data in all suspended actors. Add one golden snapshot for each template. Plan the node disk for the actors that were suspended in the last 30 minutes.

## Two timers decide where the snapshot is

**Node-local snapshot:** the copy that the worker writes to the disk of its node at a suspend. atelet owns it.

**Durable snapshot:** the copy in the object store. Its state is `SNAPSHOT_STORAGE_STATE_PENDING` until the upload is complete, and then `SNAPSHOT_STORAGE_STATE_COMPLETED`.

After an asynchronous suspend, atelet runs two timers for each snapshot {{code}}.

- `--snapshot-upload-delay`, 5 minutes by default: the wait before the upload to the object store.
- `--snapshot-detach-delay`, 30 minutes by default: the time until atelet removes the copy on the node and clears the node assignment of the actor.

We suspended five actors and read their state every 10 seconds for 42 minutes. The fifth actor, at 1,000 MiB, never got a worker, because the pool had no room. It made no snapshot of its own, so the numbers below are for four actors.

```listing
title: the upload, five minutes after the suspend
source: capture/lab/D-durability/10-watch-part1.tsv
lang: text
note: Three lines for the actor d0. The first snapshot in each line, the golden one, is cut.
---
2026-11-12T10:31:10.270Z	d0	suspended-async	ACTOR_STATE_SUSPENDED	kind-control-plane	…SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_PENDING:gen2:kind-control-plane
…
2026-11-12T10:36:01.379Z	d0	state	ACTOR_STATE_SUSPENDED	kind-control-plane	…SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_PENDING:gen2:kind-control-plane
2026-11-12T10:36:12.367Z	d0	state	ACTOR_STATE_SUSPENDED	kind-control-plane	…SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:kind-control-plane
```

```listing
title: the detach, thirty minutes after the suspend
source: capture/lab/D-durability/10-watch-part2.tsv
lang: text
note: Two lines for the actor d0. The node name becomes a dash in the fifth column and at the end of the snapshot.
---
2026-11-12T11:01:02.649Z	d0	state	ACTOR_STATE_SUSPENDED	kind-control-plane	…SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:kind-control-plane
2026-11-12T11:01:13.670Z	d0	state	ACTOR_STATE_SUSPENDED	-	…SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED:gen2:-
```

**We measured** four actors on the x86 server guest (24 vCPU, 47 GB, nested KVM), with the default timers. They held 0, 50, 200, and 500 MiB. The upload was complete 301 to 311 seconds after the suspend. The node copy was gone 1,801 to 1,803 seconds after the suspend. At that moment the snapshots on the node shrank from 758 MiB to 1 MiB. Each time can be up to 10 seconds late, because that was our sample interval.

```figure
id: fig-3-4
kind: timeline
title: where a snapshot lives after an asynchronous suspend
claim: For the first five minutes after an asynchronous suspend, the only copy of the new snapshot is on one node.
caption: Each row is one actor, with its memory in MiB. Rose is the time with one copy, violet is the time with two, and teal is the time with the object store copy only. The amber dot is the resume that ended our watch, with its time at the client. The dots under the rows are the size of the snapshots on the node disk. From capture/lab/summary/timers-x86.json and capture/lab/summary/resume-x86.json.
```

The three periods mean three different things for you.

1. In the first 5 minutes, the node holds the only copy. If that copy is lost, the actor is `ACTOR_STATE_CRASHED`, and the work since the last durable snapshot is gone. [Section 3.5](#s-crashed-and-revertactor) shows that loss.
2. From 5 to 30 minutes, both copies exist. A resume uses the node and takes the lower line of [section 3.3](#s-suspendactor-and-resumeactor).
3. After 30 minutes, only the object store has the snapshot. A resume downloads it first and takes about twice as long for each MiB.

The documentation promises neither the start nor the end of the upload {{docs}}. Treat 5 minutes as the shortest exposure, not as a limit.

Our position: do not accept the first period for state that matters. A synchronous suspend closes it for one actor. A shorter `--snapshot-upload-delay` on atelet closes it for the cluster. We ran atelet with 3 seconds and 10 seconds for one test, and all 55 requests of that test succeeded. A short detach delay saves node disk and makes every resume a download.

```takeaways
- Choose SNAPSHOT_FIDELITY_MEMORY only when the processes must continue.
- Keep files that must survive in a durableDir volume at the two lower levels.
- Write the actor so that it can boot from its files, also at the memory level.
- Plan node disk and object store space from the memory that holds data in your actors.
- Expect a full application start at every resume under the two lower levels.
- Treat a PENDING snapshot as one copy on one node.
- Lower --snapshot-upload-delay, or suspend with --mode sync, for state that you cannot lose.
```

Sources: capture/lab/summary/timers-x86.json, capture/lab/summary/footprint-x86.json, capture/lab/summary/validation-memory-x86.json, capture/lab/summary/validation-fidelity-x86.json, capture/lab/summary/demos-x86.json, capture/lab/summary/kagent-turns-x86.json, capture/lab/V-validation/01-compressible/10-compressible.tsv, capture/lab/V-validation/02-python-runtime/10-python.tsv, capture/lab/V-validation/04-fidelity/10-fidelity.tsv, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/D-durability/10-watch-part2.tsv, capture/lab/D-durability/00-atelet-args.txt, capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, capture/lab/C-resume-vs-size/snapdir-b200-1.txt, capture/lab/C-resume-vs-size/31-atelet-args-patched.txt, capture/lab/C-resume-vs-size/32-object-store.tsv, capture/lab/K-kagent/session1/turn1.txt, capture/lab/K-kagent/session1/turn2.out, capture/lab/K-kagent/session1/actor-template.yaml, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (SnapshotFidelity, Snapshot, SnapshotStorageState), cmd/atelet/internal/snapshottracker/background.go (the two delays), internal/objectstoreplugin/node.go (compressed objects), docs/reference/api-guide.md (Snapshot Storage Layout, Snapshot lifetime, Eviction).
