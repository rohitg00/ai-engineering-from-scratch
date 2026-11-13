# An idle suspender

> A small proxy that records the last request for each actor and calls SuspendActor after 30 quiet seconds ran three actors in room for two.

You installed Substrate because most of your agents wait most of the time. Then you watch the pool, and every actor that ever got a request is still running. Nothing suspended them, because nothing in Substrate v1.0.0 does that. The missing piece is yours to write, and it is small.

When you finish this section, you can run a program that suspends idle actors. You can also say what signal it uses, what it costs each client, and where the design stops.

## Which signal says that an actor is idle

**Idle suspender:** a program outside Substrate that decides when an actor has had no work for long enough, and calls `SuspendActor` for it.

The hard part is the signal. We looked for one on the server side and did not find one that fits.

| Candidate signal | Where it is | Why it does not fit |
|---|---|---|
| request metrics of the router | `atenet.router.route.duration` | Actor names are not allowed as metric labels, so it cannot say which actor is quiet {{docs}} |
| the usage event of each actor | `ate.actor.usage_sampled` | It reports CPU time and memory once a minute, and it measures work, not requests {{docs}} |
| the actor record | `kubectl ate get actor` | It has a state and an update time, and no time of the last request |

So the suspender has to see the requests itself. It sits in the path of the traffic, and the time of the last request is a value in its own memory.

```figure
id: fig-9-1
kind: flow
title: the idle suspender in the request path
claim: The suspender forwards each request, keeps the time of the last one for each actor, and calls SuspendActor when an actor is quiet.
caption: Read left to right for a request, and top to bottom for the suspend. The table in the middle is the only state of the suspender. From capture/demos/idle-suspender/suspender.py.
```

## The program

The demo is one Python file of 125 lines with no dependencies. It starts one `kubectl ate proxy actor` for each actor that you name. It listens on one port and forwards `/<actor>/<path>` to the proxy of that actor.

```bash
python3 suspender.py --atespace demo-idle --idle 30 --listen 8080 busy bursty rare
curl http://127.0.0.1:8080/busy/
```

One loop makes the decision once a second. An actor is due when it is running, has no open request, and finished its last request at least `--idle` seconds ago.

```python
due = [name for name, actor in actors.items()
       if actor["running"] and actor["open"] == 0 and now - actor["last"] >= args.idle]
for name in due:
    done, seconds = cli("suspend", "actor", name)
```

A request that arrives during a suspend waits until the suspend ends. The suspender never resumes an actor. The next request goes to the router as before, and the router resumes the actor. The full file is in [the idle suspender folder](manuals/agent-substrate-101/capture/demos/idle-suspender).

## Ten minutes with three actors and room for two

The pool in the recording has one worker with two CPUs, and each actor asks for one CPU. So two actors can run at one time. We created three, and sent each a different pattern of traffic.

- `busy` gets one request each 5 seconds.
- `bursty` gets five requests in 5 seconds, and then nothing for 145 seconds.
- `rare` gets one request after 60 seconds and one after 400 seconds.

```listing
title: the first two minutes of the suspender log
source: capture/lab/N-demos/idle-suspender/suspender.tsv
lang: text
note: The start, the first suspend, the first request to the third actor, and its suspend. Lines of warm requests between them are cut.
---
2026-11-12T12:50:05	watch	busy	port=18080	running=False
2026-11-12T12:50:05	watch	bursty	port=18081	running=False
2026-11-12T12:50:06	watch	rare	port=18082	running=False
2026-11-12T12:50:09	listen	http://127.0.0.1:8080/<actor>/<path>	idle=30s
2026-11-12T12:50:13	request	bursty	200	0.443	resumed
2026-11-12T12:50:13	request	busy	200	0.487	resumed
2026-11-12T12:50:14	request	bursty	200	0.063	warm
…
2026-11-12T12:50:44	request	busy	200	0.069	warm
2026-11-12T12:50:49	suspend	bursty	idle=31s	0.386	ok
2026-11-12T12:50:49	request	busy	200	0.063	warm
…
2026-11-12T12:51:09	request	busy	200	0.065	warm
2026-11-12T12:51:13	request	rare	200	0.242	resumed
2026-11-12T12:51:15	request	busy	200	0.062	warm
…
2026-11-12T12:51:40	request	busy	200	0.058	warm
2026-11-12T12:51:44	suspend	rare	idle=31s	0.349	ok
2026-11-12T12:51:45	request	busy	200	0.065	warm
```

Read the fifth field of each request line. The word `resumed` marks a request that found the actor suspended. At 12:50:49 the suspender suspended `bursty` after 31 quiet seconds. That freed one of the two places. At 12:51:13 the first request for `rare` arrived, and the router resumed it into the free place in 0.24 seconds.

```figure
id: fig-9-1b
kind: timeline
title: three actors share two places for ten minutes
claim: All 140 requests returned 200, and the worker held one actor for 38 of 58 samples in place of the three that had traffic.
caption: Each row is one actor. A green band is the time the actor ran, a dot is one request, and an amber mark is a suspend by the suspender. The top row is the CPU that the worker had booked. From capture/lab/summary/demos-x86.json.
```

**We measured** this run on a second x86 server guest (16 vCPU, 31 GB), with the suspender on the same guest as the cluster. In 10 minutes the three actors got 140 requests, and all 140 returned 200.

| Result | Value |
|---|---|
| requests that found the actor suspended | 7 of 140 |
| time of those requests, after the first two | 0.24 to 0.26 s |
| time of a request to a running actor, median | 0.06 s |
| suspends by the suspender | 7, each 0.33 to 0.39 s at the CLI. Six came in the 10 minutes, and the seventh came 10 min 34 s after the start |
| CPU booked on the worker, mean of 58 samples | 1,345 of 2,000 millicores |

The first two resumed requests took 0.44 and 0.49 seconds, because two actors started in the same second. A client that meets a suspended actor pays about 0.2 seconds more than a warm request for this small actor. [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor) shows how that cost grows with memory.

## The same traffic without the suspender

We ran the first two minutes again with the suspender in `--dry-run` mode. It forwards requests and logs each decision, and it suspends nothing.

```listing
title: the request for the third actor without the suspender
source: capture/lab/N-demos/idle-suspender/requests-without-suspender.tsv
lang: text
note: The header and the one line for the actor named rare.
---
ts	actor	http	seconds	body
…
2026-11-12T13:05:30.579Z	rare	503	5.054876	actor demo-idle/rare unavailable: no worker has room for the actor
```

After 60 seconds both places were still taken by `busy` and `bursty`, and `bursty` had been quiet for 55 seconds. The request for `rare` waited the 5 second parking budget and returned 503. [Request parking](#s-request-parking) explains that wait.

## Limits of the design

- **It sees only its own traffic.** A request that reaches the router another way does not reset the timer. Send all traffic through the suspender, or the suspender stops an actor that is in use.
- **Idle means no request, not no work.** An actor that computes after it answers looks idle. The usage events can cover that case, at a delay of one minute.
- **One process holds the state.** A restart forgets the last request times. The demo then reads the state of each actor and starts its timers again.
- **A request can arrive during a suspend.** The demo holds a new request until its suspend call ends, and then forwards it. Your own suspender needs the same rule for each actor. A request that reaches the router another way still gets a 503.
- **The demo uses the CLI.** Each suspend starts one process and uses the shared identity of the CLI.

## What to change for production

Run the suspender inside the cluster, beside the router. Give it a client certificate with an identity on the ingress allow list, and let it call `ate-api-server` with its own identity. Then it no longer needs the Kubernetes API server for each request.

Choose the idle time from the resume cost of your actor. With a resume of 0.25 seconds, 30 seconds of idle time is safe. With a resume of 5 seconds, a short idle time makes many users wait, and a long one keeps workers full.

Suspend in the default asynchronous mode, as the demo does. Then read [Snapshot fidelity, and where a snapshot lives](#s-snapshot-fidelity-and-where-a-snapshot-lives) for what a node loss costs in the first 5 minutes.

```takeaways
- Put one component in the request path that records the last request for each actor.
- Suspend an actor only when it has no open request and has been quiet for your idle time.
- Send all actor traffic through that component, or it suspends actors that are in use.
- Choose the idle time from the measured resume time of your own actor.
```

Sources: capture/lab/N-demos/idle-suspender/suspender.tsv, capture/lab/N-demos/idle-suspender/requests-with-suspender.tsv, capture/lab/N-demos/idle-suspender/requests-without-suspender.tsv, capture/lab/N-demos/idle-suspender/capacity-requests-with-suspender.tsv, capture/lab/summary/demos-x86.json, capture/demos/idle-suspender/suspender.py, capture/demos/idle-suspender/run.sh, docs/metrics/registry/metrics.yaml at v1.0.0, docs/guides/observability.md at v1.0.0
