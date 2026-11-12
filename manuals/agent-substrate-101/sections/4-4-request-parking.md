# Request parking

> When no worker has room, the router holds a request for up to 5 seconds and retries the resume before it answers 503.

Twenty users open a session in the same second, and your pool has room for sixteen actors. Four requests have no worker. You need to know if those four users see an error at once, a delay, or an error after a delay. The answer is all three, and the router decides which.

When you finish this section, you can predict what a client sees when a pool is full. You can also tell the two capacity 503 texts apart and choose a client timeout.

## What the router does when a pool is full

Every request to an actor passes through `atenet-router`, and the router calls `ResumeActor` for it. If the actor is suspended, `ate-api-server` must find a worker with room. When no worker has room, the call fails with the gRPC code `ResourceExhausted` and the text `no worker has room for the actor`.

**Parked request:** a request that the router holds open while it retries the resume of the actor.

The router does not return that failure at once. It parks the request and tries again. Five rules decide what happens next {{code}}:

- **Retry.** The first retry comes after 100 ms. Each later delay is 1.1 times longer, with a small random part.
- **Budget.** The router stops retrying after 5 seconds, the value of `--parked-request-budget`. Then the client gets the 503.
- **One budget for each actor.** Requests for the same actor share one resume call and one budget clock. A request that joins late can fail after less than 5 seconds.
- **Limit.** At most 1,024 requests can be parked at one time, the value of `--parked-request-max`. A request takes a place only when its first resume attempt has failed and it starts to wait. When no place is free, the router sheds the request after that one attempt, with a 503. The body is `actor "<atespace/name>" unavailable: router at capacity`.
- **No cancel.** A resume that has started when the budget ends is not cancelled. The router waits for its result, so a request can be served after more than 5 seconds.

Set `--parked-request-max=0` to turn parking off. Then a full pool returns the 503 at once.

The install sets none of these flags, so the defaults apply. The arguments of our router show it.

```listing
title: the router arguments in our install
source: capture/lab/I-capacity/17-router-args.txt
lang: text
note: The arguments between the mode and the drain delay are cut. No flag that starts with --parked-request is present.
---
atenet-router router --mode=ingress --namespace=ate-system … --drain-delay=13s --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --preview=
```

## What the router parks, and what it does not

Parking is for conditions that can end without help. The router returns every other error at once {{docs}}.

| Result of the resume | What the router does | What the client sees |
|---|---|---|
| the actor is running | routes the request | the answer of the actor |
| no worker has room | parks and retries | the answer, or 503 after the budget |
| `ate-api-server` is unavailable | parks and retries | the answer, or 503 after the budget |
| another resume of the same actor is active | retries | the answer |
| the actor is `ACTOR_STATE_CRASHED` | returns the error | 503 at once |
| the actor does not exist | returns the error | 404 at once |

The third row matters during a rollout of `ate-api-server`. A short restart of the control plane becomes a delay for the client and not an error. [When a dependency is down](#s-when-a-dependency-is-down) shows the limit of that protection.

The fifth row is why a 503 after 5 seconds and a 503 after 60 ms are different problems. A slow 503 with the text `no worker has room` means the pool is too small. A slow 503 with only the word `unavailable` means the router got no answer from `ate-api-server`. A fast 503 with the text `AssignWorker prerequisite not met` means the actor is crashed, and [CRASHED and RevertActor](#s-crashed-and-revertactor) has the fix.

## One request, three outcomes

The parking demo of Substrate creates a pool of two workers with room for one actor each, and four actors named `p1` to `p4`. We sent one request each to `p1` and `p2`, so both workers were busy. Then we sent a request to `p3` two times.

```figure
id: fig-4-4
kind: timeline
title: requests to a full pool against the 5 second parking budget
claim: A parked request is served when a worker becomes free inside the 5 second budget, and it gets a 503 when none does.
caption: Each bar runs from the start of a request to its answer, and each dot is one request. Green is a 200 and rose is a 503. The violet mark is the moment when the suspend of p1 freed a worker. The dashed bar is the load run, with its average and its slowest served request. From capture/lab/summary/parking-x86.json and capture/lab/I-capacity/01-unplanned-full-pool-503.tsv.
```

```listing
title: p3 fails, then p3 is served after a wait
source: capture/lab/I-capacity/13-parking-trace.tsv
lang: text
note: The header and the first two rows are cut. The columns are time, event, HTTP code, seconds, and body. The last row has the start time of its request, so it sorts before the suspend.
---
2026-11-12T11:32:40.522Z	p3-no-free-worker	503	5.059628	actor ate-demo-parking/p3 unavailable: no worker has room for the actor
2026-11-12T11:32:45.600Z	p3-request-start	parked while pool is full
2026-11-12T11:32:47.970Z	suspend-p1-done	freed a worker 2 s after p3 request started
2026-11-12T11:32:45.603Z	p3-served-after-park	200	2.647469	preserved memory count: 1 | preserved file counter: -1 | preserved rootfs counter: 1
```

The first request to `p3` found no worker for the whole budget. The second one started the same way. Two seconds into its wait we suspended `p1`, and that freed a worker. The next retry of the router found the worker, `p3` resumed there, and the client got its answer.

**We measured** the wait on a full pool on the x86 server guest (24 vCPU, 47 GB, nested KVM, Envoy dataplane). Nine requests that found no worker each returned 503 after 5.05 to 5.06 seconds. The request that we freed a worker for returned 200 after 2.65 seconds. The suspend of `p1` finished 2.37 seconds into that wait. The router then needed about 0.3 seconds to retry, resume the actor, and route the request. That last number comes from one run.

The body of the slow 503 is always the same text, with the atespace and the name of the actor in it:

```listing
title: the 503 of a full pool
source: capture/lab/I-capacity/01-unplanned-full-pool-503.tsv
lang: text
note: One cell of the first failed row.
---
actor lab-c/b0-5 unavailable: no worker has room for the actor
```

## Thirty seconds with four actors on two workers

The demo has a load script. It sends requests to all four actors for 30 seconds and suspends each actor after its answer. Two workers serve four actors, so half of the requests must wait for a suspend.

```listing
title: the result of the load script
source: capture/lab/I-capacity/16-load-30s.log
lang: text
note: The lines before the results are cut.
---
==> results
    total requests : 92
    200 OK         : 90
    503 unavailable: 2
    other          : 0
    200 latency    : avg 0.847s, slowest 4.269406s  <- parked requests sit here
```

**We measured** this load run on the same x86 server guest, one run of 30 seconds, 92 requests. The router served 90 requests and returned 503 for 2. The served requests took 0.85 seconds on average, and the slowest took 4.27 seconds. A request to a free worker in the same pool took about 0.35 seconds.

Read those numbers together. Parking turned a pool that was two times too small into a service that answered 98% of requests. It did that with latency. The average request took more than two times longer than a request to a free worker. The slowest took twelve times longer. Two requests still failed, in a demo that was built to show parking at its best.

## A burst of resumes

The demo sends its requests one after another. A real burst arrives in one instant, so we tested that. The pool had two workers with room for 16 one-CPU actors. We suspended n actors of 50 MiB each and sent one request to each of them at the same instant, five rounds for each n.

```figure
id: fig-4-4b
kind: chart
title: resume time against the number of resumes at the same instant
claim: Sixteen resumes at the same instant took 0.37 seconds each at the median, against 0.23 seconds for one resume alone.
caption: Each dot is one request to a suspended actor, and the line joins the medians of each level. The horizontal axis doubles at each step. The grey numbers are the requests that returned 200. The dashed line marks 0.5 seconds. Measured on the x86 server guest. From capture/lab/summary/validation-parallel-x86.json.
```

| Resumes at the same instant | Requests | Returned 200 | Median | Slowest |
|---|---|---|---|---|
| 1 | 5 | 5 | 0.23 s | 0.24 s |
| 2 | 10 | 10 | 0.23 s | 0.24 s |
| 4 | 20 | 20 | 0.26 s | 0.31 s |
| 8 | 40 | 40 | 0.29 s | 0.33 s |
| 16 | 80 | 80 | 0.37 s | 0.45 s |

**We measured** these 155 requests on the x86 server guest (24 vCPU, 47 GB, nested KVM), with gVisor and the Envoy dataplane. Each request went through its own `kubectl ate proxy`, and the time is at the client. All 155 returned 200. Sixteen resumes at once cost 64 percent more for each request than one resume alone. `ate-api-server` logged no error line during the bursts.

So the control plane did not queue at 16 resumes at once. A burst that fits in the pool costs tenths of a second, and no request waits for the budget.

A burst that does not fit is split by the pool, with no request in between. We sent 32 requests at the same instant to 32 suspended actors, when the pool had 14 free places.

**We measured** that burst once, on the same guest. Fourteen requests returned 200, at a median of 0.37 seconds. The other 18 returned 503 after 5.11 to 5.15 seconds, with the text `no worker has room for the actor`. In a second burst of 32 we suspended 16 actors 1.5 seconds into the wait. Then 21 of 32 requests returned 200, the slowest after 2.69 seconds, and 11 returned 503.

The pool had 14 free places and not 16 for a reason that [section 3.5](#s-crashed-and-revertactor) explains. Two actors whose process had exited were still `ACTOR_STATE_RUNNING`, and each one held a CPU.

## Our position

Parking hides a short shortage. It does not add capacity. A pool that parks requests all day is too small, and your users pay for that with seconds on every request.

Three things follow for your client and your alerts:

- **Client timeout.** Allow at least 10 seconds for a request to an actor that can be suspended. The budget is 5 seconds, a resume that started late still completes, and the Envoy dataplane ends the wait 5 seconds after the budget {{docs}}.
- **Retry.** Retry a 503 with the text `no worker has room` after a pause. Do not retry it in a tight loop, because each retry takes a place among the parked requests.
- **Alert.** The router counts parked requests in the metric `atenet.router.parking.active` and requests over the limit in `atenet.router.parking.rejected` {{docs}}. Alert when the first one stays above zero.

All of this section is the Envoy dataplane, where the router process of Substrate handles each request. We did not see a 503 from a full pool on the agentgateway dataplane. The kagent run uses agentgateway, and it did fill its one worker: 16 actors ran, and 8 of 24 parallel turns waited and then completed. [Sizing a pool](#s-sizing-a-pool) has that run.

We did not test more than 1,024 parked requests. Our bursts stopped at 32 requests, and each request had its own `kubectl ate proxy`. We did not send a burst through the ingress of the router.

The project site states `500+/s` suspend and resume activations. We did not test at that rate. Our largest burst that was served in full was 16 resumes at one time.

```takeaways
- Read a 503 after 5 seconds with the text no worker has room as a pool that is too small.
- Read a 503 in under 0.1 seconds as a crashed actor, and revert it.
- Set the client timeout to 10 seconds or more for actors that can be suspended.
- Alert on atenet.router.parking.active, and add workers when it stays above zero.
- Retry a capacity 503 with a pause, never in a tight loop.
```

Sources: capture/lab/I-capacity/13-parking-trace.tsv, capture/lab/I-capacity/16-load-30s.log, capture/lab/I-capacity/17-router-args.txt, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/I-capacity/12-pool-spec.yaml, capture/lab/I-capacity/14-workers-full.txt, capture/lab/I-capacity/15-actors-after.txt, capture/lab/summary/parking-x86.json, capture/lab/summary/validation-parallel-x86.json, capture/lab/V-validation/03-parallel-resume/20-parallel.tsv, capture/lab/V-validation/03-parallel-resume/24-summary.tsv, capture/lab/V-validation/03-parallel-resume/10-parallel-first-run-n16-n32.tsv, capture/lab/V-validation/03-parallel-resume/11-workers-before-32.txt, capture/lab/V-validation/03-parallel-resume/12-ateapi-error-lines-during-bursts.txt, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/summary/kagent-turns-x86.json; cmd/atenet/internal/router/ingress/parking.go, cmd/atenet/internal/router/ingress/resumer.go, cmd/atenet/internal/router/cmd.go at v1.0.0; docs/concepts/request-parking.md and site/layouts/_shortcodes/home.html at v1.0.0.
