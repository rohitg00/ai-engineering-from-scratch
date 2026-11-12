# Snapshot fidelity, and where a snapshot lives

> A snapshot keeps what its fidelity names, it is as large as the memory held, and for five minutes it exists on one node only.

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

The other end is `SNAPSHOT_FIDELITY_MEMORY`, which our counter and our memory test used. The counter keeps one count in memory, one in a volume, and one on the root filesystem. All three continued across every suspend. We did not run the middle level.

```figure
id: fig-3-4b
kind: comparison
title: what each fidelity keeps
claim: Only SNAPSHOT_FIDELITY_MEMORY keeps the processes, and the two lower levels start new processes on every resume.
caption: Read each column top to bottom. Teal layers are in the snapshot, and grey layers are lost at the suspend. The last row says what we saw in our runs. From capture/lab/K-kagent/session1/turn2.out and capture/lab/B-lifecycle/20-trace-ops.tsv.
```

`preferredFidelity` is an upper limit, and a memory snapshot can restore as less. A memory snapshot records the CPU architecture, the CPU features, and the sandbox build of the worker that took it. It restores only on a worker that matches. If no such worker has room, Substrate restores the files on another worker and boots the processes new {{docs}}. We did not see that downgrade in any run. Write your actor so that it survives a boot from its files, also at the memory level.

## A snapshot is as large as the memory held

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

The object store did not make them smaller. Substrate compresses each object before the upload {{code}}, and random bytes do not compress.

| Where | With 25 suspended actors | After we deleted them |
|---|---|---|
| Snapshots on the node | 8,801 MiB | 1 MiB |
| Snapshot cache on the node | 1,765 MiB | 1,765 MiB |
| Object store | 10,824 MiB | 2,064 MiB |

**We measured** this footprint on the x86 server guest with five actors for each of the five sizes, which hold 8,750 MiB together. Each actor was 3 to 8 minutes old. The 2,064 MiB that stayed in the object store belong to golden snapshots. A template keeps its golden snapshot until you delete the template.

```figure
id: fig-3-4c
kind: chart
title: disk use of 25 suspended actors, and after their delete
claim: 25 suspended actors that held 8,750 MiB of memory used 8,801 MiB on the node and 10,824 MiB in the object store.
caption: Each pair of bars is one place. The full bar is the size with the 25 suspended actors, and the outlined bar is the size after we deleted them. The dashed line marks the memory that the actors hold together. Measured on the x86 server guest. From capture/lab/summary/footprint-x86.json.
```

An actor owns one snapshot in the object store. Its next successful suspend replaces that snapshot, and a delete of the actor removes it {{docs}}. So plan the object store for the memory of all suspended actors, plus one golden snapshot for each template. Plan the node disk for the actors that were suspended in the last 30 minutes.

## Two timers decide where the snapshot is

**Node-local snapshot:** the copy that the worker writes to the disk of its node at a suspend. atelet owns it.

**Durable snapshot:** the copy in the object store. Its state is `SNAPSHOT_STORAGE_STATE_PENDING` until the upload is complete, and then `SNAPSHOT_STORAGE_STATE_COMPLETED`.

After an asynchronous suspend, atelet runs two timers for each snapshot {{code}}.

- `--snapshot-upload-delay`, 5 minutes by default: the wait before the upload to the object store.
- `--snapshot-detach-delay`, 30 minutes by default: the time until atelet removes the copy on the node and clears the node assignment of the actor.

We suspended four actors and read their state every 10 seconds for 42 minutes.

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

**We measured** four actors of 0, 50, 200, and 500 MiB on the x86 server guest, with the default timers. The upload was complete 301 to 311 seconds after the suspend. The node copy was gone 1,801 to 1,803 seconds after the suspend. At that moment the snapshots on the node shrank from 758 MiB to 1 MiB. Each time can be up to 10 seconds late, because that was our sample interval.

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

Our position: do not accept the first period for state that matters. A synchronous suspend closes it for one actor. A shorter `--snapshot-upload-delay` on atelet closes it for the cluster. We ran atelet with 3 seconds and 10 seconds for one test, and all 40 requests of that test succeeded. A short detach delay saves node disk and makes every resume a download.

```takeaways
- Choose SNAPSHOT_FIDELITY_MEMORY only when the processes must continue.
- Keep files that must survive in a durableDir volume at the two lower levels.
- Write the actor so that it can boot from its files, also at the memory level.
- Plan node disk and object store space from the memory that your actors hold.
- Treat a PENDING snapshot as one copy on one node.
- Lower --snapshot-upload-delay, or suspend with --mode sync, for state that you cannot lose.
```

Sources: capture/lab/summary/timers-x86.json, capture/lab/summary/footprint-x86.json, capture/lab/D-durability/10-watch-part1.tsv, capture/lab/D-durability/10-watch-part2.tsv, capture/lab/D-durability/00-atelet-args.txt, capture/lab/C-resume-vs-size/20-storage-footprint.txt, capture/lab/C-resume-vs-size/23-storage-after-delete.txt, capture/lab/C-resume-vs-size/snapdir-b200-1.txt, capture/lab/C-resume-vs-size/31-atelet-args-patched.txt, capture/lab/C-resume-vs-size/32-object-store.tsv, capture/lab/K-kagent/session1/turn1.txt, capture/lab/K-kagent/session1/turn2.out, capture/lab/K-kagent/session1/actor-template.yaml, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (SnapshotFidelity, Snapshot, SnapshotStorageState), cmd/atelet/internal/snapshottracker/background.go (the two delays), internal/objectstoreplugin/node.go (compressed objects), docs/reference/api-guide.md (Snapshot Storage Layout, Snapshot lifetime, Eviction).
