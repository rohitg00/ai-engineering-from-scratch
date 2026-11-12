# When a dependency is down

> A request to a running actor needs Postgres and `ate-api-server` and never needs the Kubernetes API server, and each loss has its own error text.

Every agent starts to fail at the same minute. The worker pods are healthy, and the actors were running a moment ago. You have three suspects: the database, the Substrate API server, and the Kubernetes API server. The response body tells you which one, if you know the three patterns.

When you finish this section, you can name the dependency that is down from the status code, the delay, and the body. You can also say how long recovery takes, and what a node restart does to actors.

## Why a running actor needs the database

The router does not remember where an actor runs. For each request it calls `ResumeActor` on `ate-api-server`, and `ate-api-server` reads the actor row from Postgres. For a running actor the answer is the worker address, and the call costs one read. [Section 1.2](#s-one-request-from-client-to-actor) follows that path. The Kubernetes API server is not on it. Kubernetes started the pods, and after that the request path does not ask it anything.

We tested the claim by removing each dependency in turn, with three request streams running.

- **running:** one request each second to a RUNNING actor, `e-run`, from a pod with a client certificate.
- **suspended:** one new SUSPENDED actor every 5 s, so each request needs a full resume.
- **proxy:** one request each second to `e-run` through `kubectl ate proxy`, from outside the cluster.

**We measured** on a second x86 server guest (16 vCPU, 23 GB) with the Envoy dataplane. Before the outages, the running stream had a median of 27 ms (n=30). A fresh resume had a median of 411 ms (n=6). The client timeout was 9 s. [Figure 8.2](#fig-8-2) shows every second of the three outages.

```figure
id: fig-8-2
kind: timeline
title: three outages, second by second
claim: Requests failed without Postgres and without ate-api-server, and every request from inside the cluster succeeded without the Kubernetes API server.
caption: Read each panel left to right. Zero is the second the dependency went away, and the grey band is the outage. A bar is green while requests succeeded and rose while they failed. The number at the end of each row counts the failed requests. From capture/lab/summary/dependency-loss-x86.json.
```

## Postgres down: a hang, then 500

We scaled the Postgres StatefulSet to zero for 61 s. The running stream failed from the next second. Each request waited until the client gave up at 9 s. Requests that were still open when Postgres came back returned a 500.

```listing
title: what each stream returned during the three outages
source: capture/lab/E-dependency-loss/12-probe-incluster.tsv
lang: text
note: One line for each kind of failure. The columns are the start time, the stream, the actor, the status code, the seconds, and the body. Code 000 is the client timeout.
---
1794481295	running	e-run	000	9.002294
…
1794481358	running	e-run	500	2.311091	error resuming actor lab-e/e-run
…
1794481304	suspended	e-s-009	503	5.013150	actor lab-e/e-s-009 unavailable
…
1794481454	running	e-run	503	4.539254	actor lab-e/e-run unavailable
```

**We measured** 66 failures in 158 requests on the running stream, in one outage. The first failure came 1 s after the scale-down. The last came at 66 s, which is 3 s after Postgres reported ready. Resumes took longer to recover. New suspended actors failed until 90 s, which is 27 s after Postgres was ready. Their failures were a 503 after 5 s with `actor lab-e/e-s-009 unavailable`, or a 500 with `error resuming actor`.

The 27 s matter. A dashboard that watches a running actor reports recovery half a minute before a new session can start.

Two more signs point at the database. Both `ate-api-server` pods stayed in `Running` and dropped to 1 of 2 ready containers. The CLI then printed `Error: failed to connect to ate-api-server: no ready api pods in ate-system`. That text names the API server, and the cause was Postgres. Check the database first when you see it.

## ate-api-server down: 503 in 3 to 5 seconds

We scaled the `ate-api-server` Deployment to zero for 60 s. Every stream returned the same body, `actor lab-e/e-run unavailable`, with status 503.

**We measured** 60 failures in 166 requests on the running stream, in one outage. A failed request took a median of 3.01 s and at most 5.02 s. The 5 s is the parking budget of the router, which [section 4.4](#s-request-parking) explains. The router holds the request and tries again until that budget ends.

The first failure came 6 s after the scale-down, and the last came 5 s after the scale-up. Recovery needs no action. The router finds the new pods by itself.

Compare the two patterns. Without Postgres the client waits past its timeout. Without `ate-api-server` the client gets a 503 within 5 s. A 503 with the word `unavailable` and nothing after it means the router could not get an answer from the API server.

[Figure 8.2c](#fig-8-2c) plots the delay of every request in the running stream.

```figure
id: fig-8-2c
kind: chart
title: the delay of each request during the three outages
claim: Without Postgres a failed request took the full 9 s of the client timeout, and without ate-api-server it took 5 s at most.
caption: Each rose dot is one failed request to the running actor, at the second it was sent. The height is the time until the answer. The green line is the requests that returned 200. From capture/lab/summary/dependency-loss-x86.json.
```

## Kubernetes API server down: nothing, except the proxy

We moved the kube-apiserver manifest out of the node for 86 s. `kubectl` printed `Unable to connect to the server: EOF`.

**We measured** 86 of 86 requests served on the running stream during the outage, and 17 of 17 fresh resumes. From 10 s before the outage to the end of the run, 223 of 223 requests from inside the cluster returned 200. A resume needs a worker, a snapshot, Postgres, and `ate-api-server`. It does not need Kubernetes.

The proxy stream is the exception. `kubectl ate proxy` reaches the router through a port-forward, and a port-forward goes through the Kubernetes API server. It served 0 of 81 requests during the outage, and it kept failing for 21 s after the API server was healthy. It failed 105 requests in all. Every `kubectl ate` command failed the same way.

**Our position:** never judge the health of your actors through `kubectl ate proxy`. Probe from a pod inside the cluster with a client certificate, as [section 5.1](#s-client-authentication) describes. A probe through the proxy reports a Kubernetes outage that your users did not see.

## One actor stayed in RESUMING

One request started a resume in the second that Postgres went away. That actor, `e-s-007`, never left the state it was in.

```listing
title: the actor that did not recover
source: capture/lab/E-dependency-loss/21-nonsteady-actors-after.txt
lang: text
note: The whole file. It lists every actor that was not RUNNING or SUSPENDED after the last outage.
---
ATESPACE   NAME      TEMPLATE          STATE                   WORKER POD                     WORKER IPS    VERSION   AGE
lab-e      e-s-007   lab-e/e-counter   ACTOR_STATE_RESUMING    lab-e/e-pool-77cc8bf9f-p888v   10.244.0.37   2         9m54s
```

Five minutes later it was still the only actor of 131 in `ACTOR_STATE_RESUMING`. It held a worker for all that time. We deleted it. We did not try `RevertActor` or a second resume on it, so we cannot tell you which one repairs it. After any database outage, list the actors and look for this state.

## A node restart: the API returns in 8 s, the actors do not

A node restart removes every dependency at once, and the sandboxes and the worker registrations with them. We restarted the only node of the first test cluster with `docker restart kind-control-plane`. One actor, `r1`, was suspended with a snapshot that had not reached the bucket. [Figure 8.2b](#fig-8-2b) shows the order of events.

```figure
id: fig-8-2b
kind: timeline
title: one node restart, and what the actor r1 returned
claim: The Kubernetes API returned after 8 s and all pods after 147 s, and the actor needed a revert and 78 more seconds.
caption: Read left to right. The top track is the node, and the bottom track is each request to the actor r1 with its status code. From capture/lab/D-durability/40-node-reboot.tsv and capture/lab/D-durability/46-after-reboot-followup.txt.
```

```listing
title: the requests after the node came back
source: capture/lab/D-durability/40-node-reboot.tsv
lang: text
note: Six of the lines after the restart. The state samples between them are cut.
---
2026-11-12T11:41:39.118Z	kube-api-back	8 s
2026-11-12T11:43:58.809Z	pods-ready	147 s, not-running=0
2026-11-12T11:44:00.610Z	call-after-reboot	500	0.408692	error resuming actor lab-c/r1
…
2026-11-12T11:44:05.915Z	call-again	503	0.070858	actor lab-c/r1 unavailable: AssignWorker prerequisite not met for Actor: lab-c/r1 (got: ACTOR_STATE_CRASHED, want ACTOR_STATE_SUSPENDED)
…
2026-11-12T11:44:11.607Z	call-after-revert	503	5.060362	actor lab-c/r1 unavailable: no worker has room for the actor
```

**We measured** this once, on an x86 server guest (24 vCPU, 47 GB, nested KVM). Three things happened that a pod restart does not prepare you for.

1. The first request came less than 2 s after all pods ran, and it crashed a suspended actor. The request returned 500, and `r1` moved to `ACTOR_STATE_CRASHED`. The crash record below does not name a lost snapshot. It says that the worker had not registered yet.
2. `RevertActor` brought it back to its last durable snapshot. The two calls after that snapshot were lost, as [section 3.5](#s-crashed-and-revertactor) explains.
3. The request after the revert waited 5.06 s and returned `no worker has room for the actor`. All pods had been running for 13 s. The same request returned 200 about 78 s later.

```listing
title: why the first request crashed the actor
source: capture/lab/D-durability/44-r1-after-reboot.yaml
lang: yaml
note: The crash field of the actor r1 after the first request.
---
  crash:
    crashTime: "2026-11-12T11:44:00.591165797Z"
    message: 'resume failed: atelet Restore: worker restore failed with a retryable
      error 3 times in a row, giving up: while calling worker RestoreWorkload: rpc
      error: code = Unavailable desc = worker has not registered yet: not accepting
      workloads'
```

A running pod is not a registered worker. The worker process must register with `ate-api-server` again before it accepts an actor. A request that arrives too early after a node restart can crash a suspended actor. A revert then returns it to the last durable snapshot.

A second restart, with one resume attempt every 2 to 3 s, gave the cause of the third result.

**We measured** it on the same x86 server guest (24 vCPU, 47 GB, nested KVM), one run. `ate-api-server` first answered 160 s after the restart command, and it listed all 11 workers as active. From 163 to 171 s it marked each of those workers `WORKER_STATE_UNAVAILABLE`. The first resume worked at 174 s, and all 11 workers were active again at 191 s.

The control plane returns with the worker list from before the restart. Then it marks each of those workers unavailable, until the worker registers again. In that window the pool has no active worker, so a resume fails for lack of room or with the text `is unavailable`. The window was 10 to 30 s.

Our retry in the first run came 78 s later, so the window looked longer than it was. Plan for the delay, and do not read this 503 as a full pool. [Section 4.3](#s-placement) has the full timeline.

An actor that was RUNNING during the restart, `my-counter-1`, was `ACTOR_STATE_CRASHED` afterwards. It returned the `AssignWorker prerequisite` 503 until a revert.

## A node that stops and does not return

A restart ends. A node that stops and stays down is a different failure, and Substrate v1.0.0 did not repair it in our runs. On a cluster with two worker nodes, we stopped one of them four times. The other node had free workers each time.

| The actor when the node stopped | Result |
|---|---|
| Suspended with `--mode sync`, snapshot in the bucket | `RESUMING` on the stopped node from the first request. 504 and 503 for 5 min 44 s, then `CRASHED`. It did not move to the other node. |
| The same, with a `revert` before any request | The revert returned `SUSPENDED`. The next request bound the actor to the stopped node again. |
| Suspended in the default mode, snapshot pending | `RESUMING` for more than 10 min. Two reverts were refused. The next request moved it to `CRASHED`. |
| Running | `RUNNING` for the 10 min of our probe, with 503 `upstream connect error` on each request. A revert left it in `REVERTING`. |

**We measured** these cases on the second x86 server guest (16 vCPU, 23 GB), with gVisor and one actor for each row. The workers of the stopped node were listed as active for 43 to 51 s after the stop command. Kubernetes evicted their pods 5 minutes after that. [Section 4.3](#s-placement) has the timeline and the open question about `revert`. [Section 3.5](#s-crashed-and-revertactor) has the error texts.

## What we did not test

All three outages ran on the Envoy dataplane with one node. We did not repeat them on agentgateway. We did not test egress from an actor during an outage, or a connection that stays open across one.

```takeaways
- Read a client timeout followed by `error resuming actor` as a database outage.
- Read a 503 that ends with `unavailable` as an `ate-api-server` outage.
- Probe actor health from a pod inside the cluster, never through `kubectl ate proxy`.
- Wait 30 s after Postgres is ready before you trust that new sessions can start.
- List actors after a database outage and look for `ACTOR_STATE_RESUMING`.
- After a node restart, hold client requests until `kubectl ate get worker` shows the workers as active.
- Run `kubectl ate revert actor` on each actor that the restart crashed.
- Treat a stopped node as an outage for its actors, because none moved to another node.
```

Sources: capture/lab/E-dependency-loss/10-timeline.tsv, capture/lab/E-dependency-loss/12-probe-incluster.tsv, capture/lab/E-dependency-loss/12-probe-proxy.tsv, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/E-dependency-loss/14-T1-pods-during.txt, capture/lab/E-dependency-loss/14-T1-cli-during.txt, capture/lab/E-dependency-loss/16-T3-kubectl-during.txt, capture/lab/E-dependency-loss/21-nonsteady-actors-after.txt, capture/lab/E-dependency-loss/22-actors-5min-later.txt, capture/lab/summary/dependency-loss-x86.json, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/summary/failures-x86.json, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/L-gaps/restart/11-workers-each-poll.txt, capture/lab/L-gaps/restart/23-ateapi.log, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/96-controller-events.log; cmd/atenet/internal/router/ingress/parking.go (the 5 s parking budget) and cmd/ateapi/internal/controlapi/workflow_resume.go at v1.0.0.
