# Agent Substrate 101: fact brief

This is the brief the sections were written from. It states what we concluded, which run proved it, and what we did not test. The recordings are in `capture/lab/`, and `capture/README.md` describes each folder.

## Pins

| Subject | Version | Date |
|---|---|---|
| Agent Substrate | v1.0.0, commit `b34fbee742906494b5eb4f1f36987176bf8770a4` | released 2026-11-05 |
| kagent | v1.0.0, with its own distribution of Substrate at v1.0.0 | released 2026-11-09 |
| agentgateway | v1.7.0 | |
| Kubernetes | 1.37.0, as `kindest/node:v1.37.0` on kind v0.33.0 | |

Facts were verified on 2026-11-12.

## Test beds

- Three KVM guests on one x86 server, each with its own kind clusters. The first has 24 vCPU and 47 GB, for upstream Substrate built from source. The second has 16 vCPU and 23 GB, for the install from the release images. The third has 16 vCPU and 31 GB, for kagent.
- One Apple silicon laptop under Docker Desktop, with 10 CPU and 8 GB for Docker.
- The sandbox class was gVisor in every run except the microVM runs of experiment L. The object store was rustfs inside the cluster. The model behind kagent was a mock server.

## Positions and the runs that prove them

1. **Substrate does not suspend an idle actor.** We left a running actor with no request for 900 s and sampled its state every 15 s. Every sample was `ACTOR_STATE_RUNNING`. The caller must call `SuspendActor`. kagent does that after every turn: 98 of 98 turns ended in a suspend. Runs: B-lifecycle, K-kagent.
2. **Suspend is asynchronous by default, and the snapshot is not durable at once.** After an async suspend the snapshot stayed `PENDING` on the node for 5 minutes, and the node copy stayed for 30 minutes. When the node copy was removed in that window, or the node restarted, the next request returned 500 and the actor became `CRASHED`. After `RevertActor` the actor resumed from the last durable snapshot and the later calls were gone. Run: D-durability.
3. **Postgres and `ate-api-server` are on every request path. The Kubernetes API server is on none.** With Postgres or `ate-api-server` scaled to zero, requests to a running actor failed within seconds. With kube-apiserver down for 86 s, every request to a running actor and every fresh resume was served. Run: E-dependency-loss.
4. **Resume time grows with the memory the actor holds.** On the x86 guest a resume from the node took 0.22 s at 0 MiB, 0.47 s at 200 MiB, 1.07 s at 500 MiB, and 2.16 s at 1000 MiB. A resume from the object store took about twice as long. Runs: C-resume-vs-size, M-mac-arm64.
5. **agentgateway is a dataplane option of Substrate, and it authenticates ingress clients.** It used 2 containers and about 38 MB at idle, against 5 containers and about 91 MB for Envoy. It mounts the interception CA private key in the dataplane container, and its egress gateway logs request headers at debug level. Run: G-dataplane.
6. **An egress policy allows hosts and ports, intercepts TLS, and replaces a credential header.** It does not select models or tools. A removed rule stopped new requests in seconds, and an open connection kept working 20 s later. Runs: F-egress, K-kagent.
7. **A dead process is not always a crashed actor.** When the process in the sandbox exited, the actor stayed `RUNNING` and every request returned 503 until a suspend was tried. A memory kill was detected in about 4 s. Run: J-container-death.
8. **Install from the release images.** The system install took 162 s from the release images and 266 s from source. The source path needs the Docker buildx plugin and compiles a Rust module, and the quickstart names neither. Runs: A-quickstart, G-dataplane, M-mac-arm64.

## Numbers a section can use

| Fact | Value | Where |
|---|---|---|
| First request to a new actor, small actor | 0.36 s | B-lifecycle |
| Warm request through `kubectl ate proxy` | 0.06 to 0.09 s | B-lifecycle |
| Async suspend, small actor | 0.40 s | B-lifecycle |
| Sync suspend, 1000 MiB | 6.4 s median | C-resume-vs-size |
| Worker pod deleted to `CRASHED` | 0.6 s | B-lifecycle |
| Full pool, time to the 503 | 5.06 s | I-capacity |
| Parking load run | 90 of 92 requests served | I-capacity |
| 25 suspended actors, node snapshots | 8.8 GB | C-resume-vs-size |
| 25 suspended actors, object store | 10.8 GB | C-resume-vs-size |
| kagent turn, resume part | 0.38 s median, n=98 | K-kagent |
| kagent turn, suspend part | 0.14 s median, n=99 | K-kagent |
| Mac, resume of a small actor | 0.09 s | M-mac-arm64 |

Each value is one machine and one day. `capture/lab/summary/` holds the full statistics.

## Corrections that the runs made to our first reading

- We first read the code as saying that the agentgateway dataplane accepts ingress clients without a certificate. An installed cluster refused them. The installer always adds a static mTLS component.
- We first expected the kagent install to create three default Harness objects. At v1.0.0 it created none.
- We expected suspend and resume to fail on arm64. On Apple silicon they worked for our test actor in 66 of 66 requests.

## What we did not test

- Substrate on GKE. That section is written from the documentation and the code.
- kagent with a real model, and its codex, claude, and bring-your-own harnesses.
- A remote object store. Ours was in the same cluster, so real upload and download times will be longer.
- Actors with more than 1000 MiB of memory, and images with an init system or a large root filesystem.
- Why workers reported no room for about one minute after a node restart.
- The first run on the Mac went to the wrong cluster, because Docker Desktop had changed the kubectl context. We kept no file from that run.
