# One request, from the client to the actor and back

> A request to a suspended actor passes the proxy, `atenet-router`, `ate-api-server`, and Postgres before a worker restores the actor, and a request to a running actor still asks all four.

You sent `curl -X POST http://localhost:8000/` and a count came back. Six programs handled that request, and one of them wrote to a database before the actor ran. When a request fails later, the error text names one of those programs, so you need to know the order.

When you finish this section, you can name each hop of one request and say which hops a running actor skips. You can also say which parts of the cluster must be up for a request to pass.

## The recording

We created `my-counter-1` in the atespace `ate-demo-counter` and started `kubectl ate proxy`. Then we sent five requests, one after the other. This is the start of the recording. The columns are the time, the event, the HTTP status, the seconds at the client, and the body.

```listing
title: five requests to a new actor
source: capture/lab/B-lifecycle/10-trace.tsv
lang: text
note: The first eight lines of the trace. The actor state was read before the first request and after the fifth.
---
ts	event	detail
2026-11-12T10:14:21.286Z	state	ACTOR_STATE_SUSPENDED	-
2026-11-12T10:14:21.837Z	call-1	200	0.358379	preserved memory count: 1 | preserved file counter: 1 | preserved rootfs counter: 1
2026-11-12T10:14:21.944Z	call-2	200	0.090770	preserved memory count: 2 | preserved file counter: 2 | preserved rootfs counter: 2
2026-11-12T10:14:22.030Z	call-3	200	0.066903	preserved memory count: 3 | preserved file counter: 3 | preserved rootfs counter: 3
2026-11-12T10:14:22.109Z	call-4	200	0.061842	preserved memory count: 4 | preserved file counter: 4 | preserved rootfs counter: 4
2026-11-12T10:14:22.196Z	call-5	200	0.068053	preserved memory count: 5 | preserved file counter: 5 | preserved rootfs counter: 5
2026-11-12T10:14:22.203Z	state	ACTOR_STATE_RUNNING	-
```

**We measured** these requests on an x86 server guest with 24 vCPU and 47 GB, through `kubectl ate proxy`, in one run. The first request took 0.358 s. The next four took 0.091 s, 0.067 s, 0.062 s, and 0.068 s.

The actor was `ACTOR_STATE_SUSPENDED` before the first request and `ACTOR_STATE_RUNNING` after the fifth. No command resumed it. The first request did.

## Hop by hop

[Figure 1.2](#fig-1-2) draws the first request. The numbers in this list match the rows of the figure.

```figure
id: fig-1-2
kind: sequence
title: the first request to my-counter-1
claim: The first request to a suspended actor makes the router call ResumeActor, and ate-api-server restores the actor before the request reaches it.
caption: Read the rows from top to bottom. Row 2 is the only one that passes kube-apiserver. Rows 5 and 6 have amber numbers because a request to a running actor skips them. The note under row 6 is the restore time of a later resume of the same actor. From capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/12-actor-running.json, and capture/lab/B-lifecycle/27-lifecycle.log.
```

1. `curl` sends the request to `127.0.0.1:8000`, where `kubectl ate proxy` listens.
2. The proxy opens a port-forward through the Kubernetes API server to `atenet-router`. Inside that port-forward it opens an mTLS CONNECT tunnel to router port 8444, with a client certificate {{code}}.
3. The router reads the target actor and calls `ResumeActor` on `ate-api-server`. It does so for every request, because it keeps no record of where an actor runs {{code}}.
4. `ate-api-server` reads the actor row from Postgres. The state is `ACTOR_STATE_SUSPENDED`.
5. `ate-api-server` takes a lease on the actor, chooses a worker with room, and writes the assignment to Postgres in one transaction {{code}}.
6. `ate-api-server` tells `atelet` on that node to restore the snapshot. The worker starts the sandbox from it, and the actor state becomes `ACTOR_STATE_RUNNING`.
7. `ate-api-server` returns the actor to the router, with the IP address of the worker pod and the identity of the worker.
8. The router opens a tunnel to port 8443 of the worker pod and checks that identity. The worker forwards the request to port 80 of the actor {{code}}.
9. The reply goes back the same way.

A new actor has never run, so the snapshot in step 6 is not its own. It is the golden snapshot of its template, and [section 3.1](#s-actortemplate-and-the-golden-snapshot) explains it. After step 7 the actor object carries the assignment:

```listing
title: the actor after the first request
source: capture/lab/B-lifecycle/12-actor-running.json
lang: json
note: Cut from the actor object. The metadata, the snapshot list, and the sandbox version attributes are cut.
---
    "state": "ACTOR_STATE_RUNNING",
    "workerAssignment": {
      "nodeName": "kind-control-plane",
…
      "workerEpoch": "1",
      "workerNamespace": "ate-demo-counter",
      "workerPod": "counter-7cc7dcd596-ffxwt",
      "workerPodIps": [
        "10.244.0.23"
      ],
…
      "workerPool": "counter",
      "workerSpiffeId": "spiffe://cluster.local/ns/ate-demo-counter/sa/ateworker"
```

## Where the 0.36 s goes

The first request paid for the restore. The four after it did not. The difference is about 0.29 s on this guest, for an actor that holds almost no memory.

The worker writes one log line when a restore starts and one when it ends. We did not save that log for the first request. We saved it for a later resume of the same actor:

```listing
title: one restore in the lifecycle log
source: capture/lab/B-lifecycle/27-lifecycle.log
lang: text
note: The span and trace fields of each line are cut.
---
{"time":"2026-11-12T10:30:17.846333794Z","message":"Actor restoring",…
{"time":"2026-11-12T10:30:18.098955499Z","message":"Actor restored",…
```

**We measured** that resume on the same guest, once. The two log lines are 0.253 s apart, and the request that caused the restore took 0.382 s at the client. So about two thirds of a first request is the restore itself.

That share grows with the actor. A restore reads the memory that the actor held, and [section 3.3](#s-suspendactor-and-resumeactor) shows 2.16 s for an actor with 1000 MiB.

## A request to a running actor

A request to a running actor still does steps 1 to 4. `ate-api-server` reads the row, finds `ACTOR_STATE_RUNNING`, and returns at once {{code}}. Steps 5 and 6 do not happen. So each request costs one call to `ate-api-server` and one read from Postgres, also when nothing is resumed.

Most of the 0.06 s in our recording is the proxy, not Substrate.

**We measured** both paths on the second x86 guest, with 16 vCPU and 23 GB, in the 30 s before a test. A pod that sent its requests to the router answered in 0.027 s at the median, with 30 requests. The same actor through `kubectl ate proxy` answered in 0.067 s at the median, with 28 requests.

Use the number from the pod when you plan latency. The proxy is a tool for your own machine, and [section 2.3](#s-your-first-actor-and-the-proxy) shows why it must not carry real traffic.

## What must be up

Three things follow from the path.

- **Postgres and `ate-api-server` are on every request path.** A running actor that needs no resume still fails when either one is down. On our second guest, requests to a running actor failed within seconds of each outage. [Section 8.2](#s-when-a-dependency-is-down) has the timeline.
- **The Kubernetes API server is on no request path.** Only row 2 of the figure passes it, and that row belongs to the proxy. In the same test, 223 of 223 requests from a pod were served while kube-apiserver was down for 86 s.
- **The object store is on the path only when a snapshot is not on the node.** [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) says when that is.

The install runs one `atenet-router` pod and one Postgres pod. Every request to every actor passes both. [Section 8.1](#s-postgres-and-the-object-store) says what to do about Postgres.

## The actor stays up

After the fifth request we sent nothing for 900 s. [Figure 1.2b](#fig-1-2b) shows all six requests of the recording, and every state sample between the last two.

```figure
id: fig-1-2b
kind: chart
title: six requests to my-counter-1, and its state for 900 idle seconds
claim: Only the first request paid for a resume, and the request after 900 idle seconds was as fast as the others because the actor never stopped.
caption: Each bar is the time of one request at the client. The amber bar includes the resume from the golden snapshot, and the dashed line is the median of requests 2 to 5. Each dot in the lower part is one state sample from the 900 seconds with no request. From capture/lab/B-lifecycle/10-trace.tsv.
```

The sixth request took 0.080 s and returned count 6. A resume would have cost about 0.36 s. The actor was never suspended, and it held its worker for the whole 15 minutes. [Section 1.1](#s-what-substrate-does-and-what-it-leaves-to-you) names this as the first job that Substrate leaves to you.

```takeaways
- Read an error from the router as a reply from ate-api-server, because the router asks it for every request.
- Plan latency from a pod that calls the router, not from kubectl ate proxy.
- Keep Postgres and ate-api-server healthy before anything else, because every request needs both.
- Expect the first request to a suspended actor to cost one restore.
- Suspend an actor yourself when its work is done.
```

Sources: capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/12-actor-running.json, capture/lab/B-lifecycle/27-lifecycle.log, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/B-lifecycle/01-proxy.log, capture/lab/summary/dependency-loss-x86.json, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/E-dependency-loss/12-probe-proxy.tsv, capture/lab/E-dependency-loss/12-probe-incluster.tsv, capture/lab/summary/resume-x86.json; cmd/atenet/internal/router/ingress, cmd/ateapi workflow_resume.go, internal/ateclient/router.go, cmd/kubectl-ate/internal/cmd/proxy.go, and docs/concepts/architecture.md at v1.0.0.
