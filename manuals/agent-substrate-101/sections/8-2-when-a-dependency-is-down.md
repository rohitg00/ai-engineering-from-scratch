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

That delay is the result of one run on one machine. A later drill ran on another machine, a second x86 server guest (16 vCPU, 31 GB), with Postgres away for about 30 s. There a suspended actor answered 0.4 s after Postgres was ready. The two runs differ in the machine and in the length of the outage, so we draw no difference between them. Plan for the longer delay. [A failure drill](#s-a-failure-drill) shows the short case.

**We measured** the cause of the long delay in a third run, on the x86 server guest (24 vCPU, 47 GB, nested KVM), one outage. That cluster used a Postgres outside the cluster, and the database was away for 60.6 s. The running actor answered again 0.7 s after Postgres was ready. Resumes of suspended actors kept failing, and the last failed one was sent 28.7 s after ready. One failed resume in the `ate-api-server` log carries the text `worker cache not ready`. The log line `worker cache synced` came 29.5 s after ready.

So the API server serves a running actor at once, and it cannot place an actor until its list of workers is full again. The delay was about the same with the bundled database and with the outside one, 27 s and 29 s. [Section 8.1](#s-postgres-and-the-object-store) has the install of that database.

**We measured** two more outages of about 63 s on a second x86 server guest (16 vCPU, 23 GB). The database ran on another guest of the same server. In the second outage a running actor failed 69 of 219 requests and answered again 5.2 s after Postgres was ready. Resumes failed in 18 of 44 requests, and the last failed one was sent 23.2 s after ready.

The log of that outage shows why the delay is about half a minute. The worker cache of `ate-api-server` tried to read the worker list again after 1, 2, 4, 8, and 16 s. Its next try came 30 s later and succeeded, 26.9 s after Postgres was ready. So the delay is a retry timer that grew during the outage. It is not work that the API server must do.

Two more signs point at the database. Both `ate-api-server` pods stayed in `Running` and dropped to 1 of 2 ready containers. The CLI then printed `Error: failed to connect to ate-api-server: no ready api pods in ate-system`. That text names the API server, and the cause was Postgres. Check the database first when you see it.

### One running actor stayed at 504 until the router restarted

The first of those two outages ended in another way. **We measured** it once. After Postgres was back, one running actor served no request in the 121 s that we watched. In that run it failed 185 of 232 requests, each at the client timeout of 9 s. With a longer timeout, the next 8 requests each returned 504 after 10.01 s. Two other running actors answered in 0.04 s, and the API reported the actor as `ACTOR_STATE_RUNNING`.

The router logged `ResumeActor` for that actor and no result. A `kubectl ate resume actor` returned in 0.17 s and changed nothing. A synchronous suspend worked in 0.67 s, and the next two requests still returned 504. We restarted the `atenet-router` Deployment 357 s after Postgres was ready, and the restart took 7 s. The next request returned 200 in 0.33 s with count 49, so the actor had kept its state.

We did not find the cause. It happened in 1 of these 2 outages. It did not happen in the outage of the database on the same machine, or in the outage of the bundled one.

**Our position:** after a database outage, send one request to each running actor that matters. If one returns 504 after 10 s while the others answer, restart `atenet-router`. Do not revert that actor, because its state is intact.

## ate-api-server down: 503 in 3 to 5 seconds

We scaled the `ate-api-server` Deployment to zero for 60 s. Every stream returned the same body, `actor lab-e/e-run unavailable`, with status 503.

**We measured** 60 failures in 166 requests on the running stream, in one outage. A failed request took a median of 3.01 s and at most 5.02 s. The 5 s is the parking budget of the router, which [section 4.4](#s-request-parking) explains. The router holds the request and tries again until that budget ends.

The first failure came 6 s after the scale-down, and the last came 5 s after the scale-up. Recovery needs no action. The router finds the new pods by itself.

Compare the two patterns for the running actor of this run. Without Postgres the client waited past its timeout. Without `ate-api-server` the client got a 503 within 5 s.

Do not read more into the body than it says. A 503 with the word `unavailable` and nothing after it means that the router got no answer from `ate-api-server`. It does not say why. The same body appeared in the Postgres outage: ten resumes of suspended actors got it in this run. In the drill of [section 9.4](#s-a-failure-drill), a running actor and a suspended actor both got it while Postgres was away. So when you see this body, check both: that the `ate-api-server` pods are ready, and that Postgres is up.

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

**We measured** 86 of 86 requests served on the running stream during the 86 s outage, and 17 of 17 resumes of suspended actors. That is 103 of 103 requests from inside the cluster. A wider window has 223 of 223. It runs from 10 s before the outage to the end of the run, 95 s after the manifest was back. A resume needs a worker, a snapshot, Postgres, and `ate-api-server`. It does not need Kubernetes.

The proxy stream is the exception. `kubectl ate proxy` reaches the router through a port-forward, and a port-forward goes through the Kubernetes API server. It served 0 of 81 requests during the outage, and it kept failing for 21 s after the API server was healthy. It failed 105 requests in all. Every `kubectl ate` command failed the same way.

**Our position:** never judge the health of your actors through `kubectl ate proxy`. Probe from a pod inside the cluster with a client certificate, as [section 5.1](#s-client-authentication) describes. A probe through the proxy reports a Kubernetes outage that your users did not see.

## The same three outages on agentgateway

We repeated the three outages on the agentgateway dataplane, with the same three streams. The claim holds on both dataplanes. Postgres and `ate-api-server` are on every request path, and the Kubernetes API server is on none. Two things differ: the body of a failure, and the time until a running actor answers again.

**We measured** one run for each outage on a second x86 server guest (16 vCPU, 23 GB), with one kind node and agentgateway v1.7.0. Before the outages, the median was 21 ms for the running stream (n=29) and 470 ms for a fresh resume (n=6). Postgres was away for 61 s. The running stream failed from 6 s, in 81 of 160 requests. A failed request took a median of 3.0 s and at most 5.0 s. The last failure came 21 s after Postgres was ready, against 3 s on Envoy.

**We measured** the other streams in the same run on that guest, n=1 for each outage. New resumes failed from 1 s without Postgres, in 19 of 32 requests, until 26 s after it was ready. Without `ate-api-server` for 61 s, the running stream failed from 17 s, in 70 of 166 requests. Its last failure came 15 s after the API pods were ready. The Kubernetes API server was away for 87 s. In the whole window of that outage, 188 of 188 requests to the running actor and 38 of 38 new resumes were served.

```listing
title: every failure on agentgateway has the same body
source: capture/lab/Q-network/g-dependency-loss-agw/12-probe-incluster.tsv
lang: text
note: One line for each status code of the Postgres outage. The columns are the start time, the stream, the actor, the status code, the seconds, and the body.
---
1794488149	running	e-run	500	0.043341	ingress failed
…
1794488157	running	e-run	504	3.010174	ingress failed
…
1794488178	running	e-run	503	2.009588	ingress failed
…
1794488174	suspended	e-s-013	503	5.018422	ingress failed
```

On Envoy the body named the actor and gave a hint: `actor lab-e/e-run unavailable`, or `error resuming actor`. On agentgateway every failure body was `ingress failed`, with status 500, 504, or 503. A client cannot tell the cause from the body. Read the status code and the delay, and check Postgres and the `ate-api-server` pods each time.

[Figure 8.2e](#fig-8-2e) puts the running stream of both dataplanes on one time axis.

```figure
id: fig-8-2e
kind: timeline
title: the running actor in three outages, on each dataplane
claim: A running actor answered again 3 s after Postgres was ready on Envoy and 21 s after it on agentgateway, in one run each.
caption: Read each pair of rows left to right. Zero is the second the dependency went away, the grey band is the outage, and the dashed line is the second it was ready. A bar is green while requests succeeded and rose while they failed. From capture/lab/summary/dependency-loss-x86.json and capture/lab/summary/dependency-loss-agw-x86.json.
```

Plan for the longer recovery, and do not read it as a law of the dataplane. Each dataplane had one run. On the agentgateway run, a second cluster ran node tests on the same guest at the same time. We also did not find why the first failure after the `ate-api-server` scale-down came at 17 s here and at 6 s on Envoy.

The proxy stream failed here in the same way as on Envoy. Through `kubectl ate proxy`, 103 of 173 requests failed during the Kubernetes API outage and for 19 s after it.

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

A restart ends. A node that stops and stays down is a different failure, and Substrate v1.0.0 does not repair it. On a cluster with two worker nodes, we stopped one of them in 13 cases. No actor left the stopped node by itself in any of them. This subsection is the runbook, and [section 4.3](#s-placement) explains the placement rule behind it.

**We measured** each case once, on a second x86 server guest (16 vCPU, 23 GB), with the Envoy dataplane, gVisor, and the default timers. The pool had two worker pods on each worker node, and the other node had free workers in every case. The test actor held a counter and 50 MB in memory, so the count in a reply shows which snapshot it came from. The workers of the stopped node showed `WORKER_STATE_UNAVAILABLE` 45 to 52 s after the stop command, in five cases. Kubernetes evicted the pool pods after 342 to 350 s, in two cases. An actor that was `ACTOR_STATE_RESUMING` on the node became `ACTOR_STATE_CRASHED` at 342 to 350 s, in four cases.

| The actor when the node stopped | What the client sees | The sequence that worked | Time to recover | What is lost |
|---|---|---|---|---|
| Suspended with `--mode sync`, and no request during the outage | Nothing, because no request is sent | Wait until `kubectl ate get worker` shows the workers of the node as `UNAVAILABLE`. Then `revert actor`, then send the request | Revert 7.1 s. First request 200 in 0.56 s, on the other node | Nothing. The count continued from the snapshot |
| The same, with a `revert` before the workers show `UNAVAILABLE` | The `revert` waits 20.2 s and fails on `atelet Terminate`. The actor is `REVERTING`, and a request gets 503 at once | None during the outage: 4 of 4 reverts failed. After the node and its `atelet` were back, one `revert` (0.2 s) and then the request | The outage, plus 17 s. The request returned 200 in 0.47 s | Nothing from the snapshot |
| Suspended, and a request arrives during the outage | A client timeout at 10 s, then 503 `actor ... unavailable` after about 5 s each. The actor is `RESUMING` on the stopped node, then `CRASHED` at about 345 s | Fast: `create actor <new> --template <t> --tag <tag>` with a tag from before the stop, then send requests to the new name. Slow: send no revert, wait for the node, then `revert` and request | With a tag: first request 200 in 0.58 s, 1.2 s after the create command. Without: the outage, then revert 0.3 s and request 200 in 0.90 s | With a tag: all work after the tagged snapshot, and the actor has a new name. Without: nothing |
| The same, and a `revert` during the outage | The `revert` is refused while `RESUMING`, 19 of 19 times: `not in a revertable state`. At `CRASHED` one revert fails on `atelet Terminate`, and the actor is `REVERTING`. 0 of 144 requests were served | None during the outage. In two runs, 13 and 15 more reverts failed | Not recovered in the 579 and 602 s that we watched | The actor is not usable until the node returns |
| Suspended in the default mode, with its newest snapshot still `PENDING` on the node | A `revert` after `UNAVAILABLE` fails in 0.8 s on `atelet Terminate`. The actor is `REVERTING`, and a request gets 503 | Send no command during the outage. After the node returns, send the request with no revert | The workers were active 25 s after the node start. The request returned 200 in 0.36 s | Nothing: the count was 6 after 5. With a `revert` first, the two calls after the last durable snapshot are lost |
| `RUNNING` | 503 `upstream connect error or disconnect/reset before headers`. The state stays `RUNNING` | Fast: a new actor from a tag that you made earlier. It works while the original is still `RUNNING`. Slow: wait for the node. The actor was `CRASHED` 18 s after the node start. Then `revert` and request | With a tag: 200 in 0.48 and 0.51 s, 1.2 s after each create command. Without: the outage, then revert 0.3 s and request 200 in 0.48 s | All work after the snapshot or the tag that you use |
| `RUNNING`, and a `revert` during the outage | The revert fails on `atelet Terminate`, and the actor is `REVERTING`. 27 more reverts failed | None during the outage | Not recovered in the 718 s of the outage | The actor is not usable until the node returns |
| Any actor on the node, and you send `suspend`, `resume`, or `delete` | `suspend`: `MarkSuspending prerequisite not met`. `resume`: `worker ... assigned to actor ... is unavailable`. `delete`: fails on `atelet Terminate`, and the actor is `DELETING` | None | Not during the outage. A new actor with the same name gets `AlreadyExists` | The name, until the node returns |

The pattern behind the table is one call. Every command that changes an actor on the stopped node calls `atelet` on that node: `revert`, `suspend`, `resume`, and `delete`. While the node is down, that call fails. A failed `revert` or `delete` also leaves the actor in `ACTOR_STATE_REVERTING` or `ACTOR_STATE_DELETING`, and that state stays until the node is back. Three rules follow.

**Wait for `UNAVAILABLE` before a `revert` on a quiet actor.** A quiet actor is suspended with `--mode sync` and has had no request since the stop. One `revert`, sent 45 s after the stop command, freed such an actor, and its next request ran on the other node. In another run we sent the revert 10 s after the stop command. It failed after 20.2 s, and the actor was in `ACTOR_STATE_REVERTING` until the node came back.

**Never `revert` or `delete` an actor that receives requests during the outage.** The first request binds the actor to a worker of the stopped node, and from then on no command helps. The same rule covers an actor that was suspended in the default mode. Its newest state is on the node and comes back with the node, so a `revert` only throws that state away.

**Make a tag before you need it.** `kubectl ate create tag <name> --actor <a>` works on a suspended actor and returned `Ready` in less than 1 s. It also worked while the newest snapshot of the actor was still `PENDING`. `create actor --tag` was the one rescue that worked in every case, 3 of 3. The new actor served its first request 1.2 s after the create command, on the other node. The price is a new actor name, so your client must be able to change the name that it calls.

```listing
title: a rescue from a tag, while the original actor cannot resume
source: capture/lab/P-node-loss/80-tag-rescue.tsv
lang: text
note: Three lines of the trace, 60 s after the stop command. The columns are the time, the seconds from the stop command, the event, and its detail.
---
2026-11-12T14:16:17.202Z	t=60.4	tag-attempt-on-stuck-actor	state=ACTOR_STATE_RESUMING | Error: failed to create tag: rpc error: code = FailedPrecondition desc = Actor lab-n/t1 must be ACTOR_STATE_SUSPENDED to be tagged (got: ACTOR_STATE_RESUMING) 
…
2026-11-12T14:16:19.269Z	t=62.5	rescue-first-request	1.2 s after create | 200	0.581895	count=4 mb=50 sum=6613 process_age_s=4.9	|	ACTOR_STATE_RUNNING	multi-worker	SNAPSHOT_OWNER_TAG:SNAPSHOT_STORAGE_STATE_COMPLETED:gen1:-
2026-11-12T14:16:19.765Z	t=63.0	rescue-second-request	200	0.064394	count=5 mb=50 sum=6613 process_age_s=5.2	|	ACTOR_STATE_RUNNING	multi-worker	SNAPSHOT_OWNER_TAG:SNAPSHOT_STORAGE_STATE_COMPLETED:gen1:- pod lab-n/ballast-5d6cf97747-zzzdn
```

The first line is the reason for the third rule. A tag cannot be made after the fact. On the original actor, `create tag` failed with `another operation is in progress for this actor`, and then with the text in the listing. [Figure 8.2d](#fig-8-2d) puts the runbook on one page.

```figure
id: fig-8-2d
kind: decision
title: a node stopped, what to do with one actor
claim: A tag made before the stop gave a working actor in 1.2 s, and every other path waits for the workers or for the node.
caption: Read each row left to right: the actor when the node stopped, what to do, and what we measured. In the two rose rows, a command during the outage does not help. The dashed row is the state that such a command leaves. From capture/lab/summary/node-loss-x86.json.
```

### When the node comes back

**We measured** the return of the node in the same cases, on the same guest (16 vCPU, 23 GB), one return for each case. Kubernetes reported the node `Ready` 2.6 to 4.7 s after the start. After an outage shorter than the eviction time, 51 to 263 s, the node still had its two pool pods. Its workers were active again after 24 to 31 s, in four returns. The first new actor went to the node 23 to 45 s after the start, in five returns.

**We measured** seven returns after an outage longer than the eviction time, 372 to 718 s, on the same guest. The node came back with no pool pod. The replacement pods ran on the other node and stayed there. No new actor went to the returned node in the 216 to 223 s that we watched. We deleted pods ourselves, so that each node had two again.

So Substrate does not rebalance a pool. After a long outage the returned node stays empty until someone moves pods. An actor that a command left in `ACTOR_STATE_REVERTING` needs one more `revert` after the return, and [section 3.5](#s-crashed-and-revertactor) has that result and its caveat.

## A node that you drain

A drain is the planned form of a node stop, and it ends differently. `kubectl drain` evicts the worker pods and leaves the DaemonSet pods, so `atelet` stays on the node. The control plane can still reach the snapshot files there. [Figure 8.2f](#fig-8-2f) shows the five cases that we ran.

```figure
id: fig-8-2f
kind: timeline
title: five drains of one worker node, request by request
claim: A drain crashed each running actor and did not disturb any suspended one.
caption: Read each row left to right. Zero is the drain command. A green mark is a request that returned 200, and a rose mark is a request that failed. The dashed line is the revert that we sent. From capture/lab/summary/node-drain-x86.json.
```

**We measured** each case once, on the second x86 server guest (16 vCPU, 23 GB), with Envoy and gVisor. The cluster had two worker nodes. The command was `kubectl drain` with `--ignore-daemonsets --delete-emptydir-data --force`. It returned in 1.2 to 2.2 s, in five of five cases.

The pool had no PodDisruptionBudget. In the two cases with no request during the drain, the new pods ran on the other node 2.5 s after the command.

| The actor when the drain started | What the client saw | Did it move by itself | What worked | What was lost |
|---|---|---|---|---|
| `RUNNING`, one request about each second | 503 from 0.4 s. 46 of 62 requests failed, most with `AssignWorker prerequisite not met` | No. It was `ACTOR_STATE_CRASHED` | One `revert`, 0.2 s. The next request returned 200 0.8 s later, on the other node | The 6 calls after the last durable snapshot |
| Suspended with `--mode sync`, no request during the drain | Nothing | Yes, at its first request | Send the request. It returned 200 in 0.58 s | Nothing |
| Suspended with `--mode sync`, one request about each second from 2 s after the drain | 30 of 30 requests returned 200. The first took 0.49 s | Yes | No command | Nothing |
| Suspended in the default mode, newest snapshot still `PENDING` on the node | Nothing | Yes, at its first request | Send the request. It returned 200 in 1.19 s | Nothing. The count was 6 after 5 |
| `RUNNING`, with one request of 120 s open | The open request got 503 `connection termination` 0.4 s after the drain command. Then 16 of 16 requests got 503 | No. It was `ACTOR_STATE_CRASHED` | One `revert`, 0.2 s. The next request returned 200 0.7 s later | The open request, and the 2 calls after the last durable snapshot |

The script sent the revert 64.8 s after the drain in the first case and 24.8 s after it in the last. We did not test an earlier revert.

Two results stand out. A drain does not suspend a running actor. It ends the worker pod, and the actor was `ACTOR_STATE_CRASHED` within 7 s, in two of two cases. The worker pods had a termination grace period of 3,600 s, and the drain still returned in about 2 s.

A drain does not hurt a suspended actor, in three of three cases. This is the opposite of a node stop. After a stop, the first request binds the actor to a worker of the dead node. After a drain, the node has no worker, and its `atelet` still answers. So the resume moves the snapshot off the node and places the actor on the other node. In the quiet case the drained node held 52 MiB of snapshots before the request and 1 MiB after it.

**Our position:** before a drain, suspend each running actor with `--mode sync`, and then drain. A suspended actor moves with its state at the next request. A running actor crashes, and a `revert` returns it to the last durable snapshot. [Section 8.4](#s-upgrade-and-stale-advice) gives the same order for a worker upgrade.

After `kubectl uncordon` the node stayed empty, in five of five returns. Its pool pods ran on the other node, and Kubernetes did not move them back. We created 15 new actors after each return, in 86 s. None of the 75 went to the returned node. We moved pods by hand again.

## A stopped node, and no free worker on the other node

The runbook for a stopped node rests on a free worker on the other node. We filled the other node and ran it again. Each worker of that pool holds 1,984 Mi, and one actor with a 1,900 Mi limit fills it.

**We measured** two node-stop runs with the other node full, on the same guest (16 vCPU, 23 GB), each once. The `revert` after `UNAVAILABLE` was accepted in 2.8 and 3.1 s, and the actor was `ACTOR_STATE_SUSPENDED`. Each request then waited 5.05 to 5.07 s and got 503 with `no worker has room for the actor`, in 8 of 8 requests. `kubectl ate resume actor` failed with `ResourceExhausted`. `create actor --tag` was accepted, and a request to the new actor got the same 503.

Capacity ended the wait in both runs. In the first run we suspended one actor on the full node, which took 0.6 s. The request then returned 200 in 0.80 s, 1.6 s after that command. In the second run we scaled the pool from 4 workers to 6. The request returned 200 in 1.55 s, 1.7 s after the scale command.

The new actors from the tag answered in 0.64 and 0.63 s. Nothing was lost in either run.

So a full node does not break the runbook. The revert and the rescue from a tag still succeed, and both then wait for a worker. Read `no worker has room for the actor` after a node loss as a capacity problem, and free a worker or add one. [Section 4.3](#s-placement) has the same case with both nodes up.

## The object store away

A resume from the node copy does not need the bucket. A synchronous suspend needs it, and so does a resume of an actor whose only copy is in the bucket. We took the bucket away in two ways. In the first, each connection was refused. In the second, packets were dropped, so each call waited.

**We measured** each case once, on the same guest (16 vCPU, 23 GB), with actors that hold no data in memory. The bucket for these runs was outside the cluster, as [section 8.1](#s-postgres-and-the-object-store) describes.

| Operation while the bucket was away | Connection refused | Packets dropped |
|---|---|---|
| A request to a running actor | 200 in 0.06 s | not recorded |
| A request to a suspended actor whose only copy is in the bucket | 500 `error resuming actor` after 4.11 s. The actor is `ACTOR_STATE_CRASHED` | 504 after 10.05 s. The actor stays `ACTOR_STATE_RESUMING` |
| The same actor after the bucket was back | 503 on 22 of 22 requests. After one `revert`, 0.2 s, the request returned 200 in 0.33 s with its state | 200 in 0.63 s with no command, with its state. The bucket had been away for 137 s |
| `suspend --mode sync` of a running actor | The call fails after 4.28 s at the step `CallAteletSuspend`. The actor is `ACTOR_STATE_CRASHED` | The call fails after 126.3 s. The actor is `ACTOR_STATE_CRASHED` |
| That actor afterwards | 503 until a `revert`. Then 200 from the last durable snapshot, and the 2 calls after it were lost | The same, and the 2 calls after the last durable snapshot were lost |
| `suspend` in the default mode | 0.31 s. The snapshot stays `PENDING` on the node, and the next request returned 200 in 0.22 s | not recorded |
| `create actor` from a template, then a request | 200 in 0.27 s | 200 in 0.24 s |

The row to remember is the synchronous suspend. With the bucket away, the call that you send to protect an actor crashes it. The actor was healthy and `RUNNING` before the call, and it needed a `revert` after it. The default suspend was safe in the same minute, because it does not wait for the upload.

The first two rows show a second difference. A refused connection crashed the suspended actor, and it stayed crashed after the bucket was back. A dropped connection left it in `ACTOR_STATE_RESUMING`, and it answered by itself when the bucket returned.

**We measured** the same cases again with actors that hold 200 MiB, once each, with the bucket on another guest. The bucket was stopped for 57 s. In a second pass its packets were dropped for 176 s.

| Operation | Bucket stopped | Packets dropped |
|---|---|---|
| A request to a running actor | 200, 2 of 2 | 200, 2 of 2 |
| A request to a suspended actor whose only copy is in the bucket | 500 `error resuming actor` after 3.87 s, then 503 | 504 after 10.05 s, twice |
| The same actor after the bucket was back | 503 with no command. After one `revert`, 0.2 s, 200 in 2.52 s with its count | 503 with no command. After one `revert`, 0.3 s, 200 in 2.74 s with its count |
| `suspend --mode sync` of a running actor | The call fails after 1.62 s at the step `CallAteletSuspend`. The actor is `ACTOR_STATE_CRASHED` | The call fails after 103.05 s. The actor is `ACTOR_STATE_CRASHED` |
| That actor after a `revert` | 200 in 2.50 s. Its count was 5 before the suspend and 4 after, so 2 calls were lost | 200 in 2.60 s, and 2 calls were lost |
| `suspend` in the default mode | 0.83 s. The snapshot stays `PENDING` on the node, and the next request returned 200 in 0.39 s | 0.70 s, and the next request returned 200 in 0.49 s |
| That actor after the bucket was back | 200 in 0.40 s from the node copy, with its count | 200 in 2.41 s from the bucket, with its count |
| `create actor` from a template, then a request | 200 in 0.60 s | 200 in 0.47 s |

Two results hold with data in memory. The synchronous suspend again crashed a healthy actor, and the 2 calls after its last durable snapshot were lost, in 2 of 2 cases. The default suspend lost nothing, in 2 of 2 cases.

One result changed. With packets dropped, the actor whose only copy was in the bucket ended crashed, and it needed a `revert`. In the first run, the same case with no data in memory recovered with no command. So do not count on that recovery.

**Our position:** check that the bucket answers before a batch of synchronous suspends, such as the batch before a drain or a worker upgrade. If it does not answer, leave the actors running, or suspend in the default mode and accept the node copy.

## What we did not test

Each outage, each node-stop case, each drain case, and each bucket case ran once. The dependency outages ran on one kind node, on each dataplane. We did not test egress from an actor during an outage, or a connection that stays open across one.

The node-stop cases have four gaps. A stop here was `docker stop`, which ends the kubelet and `atelet` cleanly, so a power loss or a network loss can differ. We did not change the node timers of Kubernetes, use more than two worker nodes, or repeat the cases on agentgateway. We filled the other node by memory, and not by CPU or by a count of actors.

The drain cases have three gaps. The pool had no PodDisruptionBudget. We did not drain the node that runs `ate-system`. We sent no `revert` in the first 20 s after a drain.

The bucket cases with data in memory ran once each, with 200 MiB. We did not record when a pending snapshot is uploaded after a stopped bucket returns. We did not find why one running actor stayed at 504 after a database outage. We did not test a database outage with dropped packets.

```takeaways
- Read a client timeout followed by `error resuming actor` as a database outage.
- Read a 503 that ends with `unavailable` as `ate-api-server` unreachable, and check Postgres too.
- Probe actor health from a pod inside the cluster, never through `kubectl ate proxy`.
- Wait 30 s after Postgres is ready before you trust that new sessions can start.
- List actors after a database outage and look for `ACTOR_STATE_RESUMING`.
- After a node restart, hold client requests until a test resume works, because the first worker list is stale.
- Run `kubectl ate revert actor` on each actor that the restart crashed.
- On agentgateway, read the status code and the delay, because every failure body is `ingress failed`.
- Make a tag of each suspended actor that you cannot lose, before a node stops.
- When a node stops, wait for `WORKER_STATE_UNAVAILABLE` before you revert a quiet actor.
- Send no `revert` or `delete` to an actor that got a request during the outage.
- After a long node outage, move pool pods back to the returned node by hand.
- Suspend running actors with `--mode sync` before a drain, because a drain crashes a running actor.
- After a node loss, read `no worker has room for the actor` as missing capacity, and free or add a worker.
- Check that the bucket answers before a synchronous suspend, because a failed one crashes the actor.
- After a database outage, send one request to each running actor, and restart `atenet-router` if one returns 504.
```

Sources: capture/lab/summary/node-drain-x86.json, capture/lab/summary/full-node-x86.json, capture/lab/summary/object-store-x86.json, capture/lab/summary/external-postgres-x86.json, capture/lab/T-drain-store/20-b-suspended-sync-quiet.tsv, capture/lab/T-drain-store/04-pdb-and-grace.txt, capture/lab/T-drain-store/95-store-unreachable.tsv, capture/lab/T-drain-store/97-store-unreachable-recovery.tsv, capture/lab/U-pg-upgrade-scale/20-extpg-tests/34-api-server-log.excerpt.txt, capture/lab/N-demos/failure-drill/drill-run.log, capture/lab/summary/demos-x86.json, capture/lab/E-dependency-loss/10-timeline.tsv, capture/lab/E-dependency-loss/12-probe-incluster.tsv, capture/lab/E-dependency-loss/12-probe-proxy.tsv, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/E-dependency-loss/14-T1-pods-during.txt, capture/lab/E-dependency-loss/14-T1-cli-during.txt, capture/lab/E-dependency-loss/16-T3-kubectl-during.txt, capture/lab/E-dependency-loss/21-nonsteady-actors-after.txt, capture/lab/E-dependency-loss/22-actors-5min-later.txt, capture/lab/summary/dependency-loss-x86.json, capture/lab/D-durability/40-node-reboot.tsv, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/D-durability/44-r1-after-reboot.yaml, capture/lab/summary/failures-x86.json, capture/lab/L-gaps/restart/10-poll.tsv, capture/lab/L-gaps/restart/11-workers-each-poll.txt, capture/lab/L-gaps/restart/23-ateapi.log, capture/lab/L-gaps/multinode/70-stop-after-upload.tsv, capture/lab/L-gaps/multinode/75-stop-after-upload-revert.tsv, capture/lab/L-gaps/multinode/80-stop-before-upload.tsv, capture/lab/L-gaps/multinode/90-stop-while-running.tsv, capture/lab/L-gaps/multinode/96-controller-events.log, capture/lab/Q-network/g-dependency-loss-agw/12-probe-incluster.tsv, capture/lab/Q-network/g-dependency-loss-agw/12-probe-proxy.tsv, capture/lab/Q-network/g-dependency-loss-agw/20-analysis.txt, capture/lab/summary/dependency-loss-agw-x86.json, capture/lab/summary/node-loss-x86.json, capture/lab/P-node-loss/10-a-quiet-revert.tsv, capture/lab/P-node-loss/74-second-revert.tsv, capture/lab/P-node-loss/80-tag-rescue.tsv, capture/lab/P-node-loss/20-b60-requests-revert-loop.tsv, capture/lab/P-node-loss/30-bevict-requests-revert-after-eviction.tsv, capture/lab/P-node-loss/40-balt-suspend-resume-delete.tsv, capture/lab/P-node-loss/50-c-pending-snapshot.tsv, capture/lab/P-node-loss/55-c-pending-snapshot-with-requests.tsv, capture/lab/P-node-loss/88-pending-snapshot-node-returns.tsv, capture/lab/P-node-loss/60-d-running.tsv, capture/lab/P-node-loss/85-tag-rescue-running-and-pending.tsv, capture/lab/P-node-loss/return-tag.tsv, capture/lab/P-node-loss/return-tag2.tsv, capture/lab/P-node-loss/return-b60.tsv, capture/lab/P-node-loss/return-balt.tsv; cmd/atenet/internal/router/ingress/parking.go (the 5 s parking budget) and cmd/ateapi/internal/controlapi/workflow_resume.go at v1.0.0., capture/lab/summary/remote-store-x86.json, capture/lab/summary/remote-postgres-x86.json, capture/lab/X-remote-store-pg/30-outage-stopped.tsv, capture/lab/X-remote-store-pg/30-outage-dropped.tsv, capture/lab/X-remote-store-pg/50-pg-tests/30-timeline.tsv, capture/lab/X-remote-store-pg/50-pg-tests/30-timeline-run2.tsv, capture/lab/X-remote-store-pg/50-pg-tests/33-probe.tsv, capture/lab/X-remote-store-pg/50-pg-tests/33-probe-run2.tsv, capture/lab/X-remote-store-pg/50-pg-tests/37-follow-up.txt, capture/lab/X-remote-store-pg/50-pg-tests/41-x-run-recovery.txt, capture/lab/X-remote-store-pg/50-pg-tests/42-x-run-router-restart.txt, capture/lab/X-remote-store-pg/50-pg-tests/47-worker-cache-lines.txt
