# A failure drill

> One script causes six failures on a test cluster and prints the symptom, the state, the fix, and the recovery time for each.

Your first crashed actor will arrive at a bad time. A user reports a 503, and you read error texts that you have never seen before. You can see every one of those texts today, on a cluster that nobody depends on, in about one minute.

When you finish this section, you can run the six failures of this manual on your own cluster. You can also compare your recovery times with ours and know which fix belongs to which symptom.

## What the drill does

**Failure drill:** a script that causes each known failure on purpose, on a cluster you can lose, and records what a client sees.

The drill uses one small actor. It counts requests, and it has two extra paths. A request to `/exit` ends the process. A request to `/oom` allocates memory until the sandbox stops it. The pool has two workers with room for one actor each, so the pool is easy to fill.

```figure
id: fig-9-4
kind: timeline
title: six failures, from the symptom to the first good answer
claim: Each of the six failures gave a good answer in under one second after its fix, and only one of them needed two commands.
caption: Read each row left to right. The rose mark is the first failed request, the label names the fix, and the green mark is the first good answer after it. From capture/lab/summary/demos-x86.json.
```

For each case the script prints the same five facts. The symptom is the status code, the time, and the body of the first failed request. The state is what `kubectl ate get actor` reports. The fix is the command that we ran. The recovery line is the first request that returned 200 after the fix.

```bash
export REGISTRY=localhost:5001
export KIND_NODE=kind-control-plane
./drill.sh setup
./drill.sh run | tee my-drill.log
```

The script is 170 lines of shell, and the actor is 40 lines of Python. Both are in [the failure drill folder](manuals/agent-substrate-101/capture/demos/failure-drill). The core of each case is short. This is the first one.

```bash
actor d1 8701
call 8701 / > /dev/null
pod=$(K get actor d1 -a "$SPACE" | awk 'NR == 2 { print $5 }' | cut -d/ -f2)
kubectl -n "$SPACE" delete pod "$pod" --grace-period=0 --force
report detect "CRASHED after $(wait_state d1 ACTOR_STATE_CRASHED)"
report symptom "$(call 8701 /)"
K revert actor d1 -a "$SPACE"
report recover "$(call 8701 /)"
```

## The recorded run

**We measured** one full run on a second x86 server guest (16 vCPU, 31 GB). Substrate came from the release images, with the Envoy dataplane. The run took 70 seconds for the six cases.

Three cases end in `ACTOR_STATE_CRASHED` without help, and one command repairs each of them.

```listing
title: a deleted worker pod, a lost snapshot, and an actor over its memory limit
source: capture/lab/N-demos/failure-drill/drill-run.log
lang: text
note: Cases 1, 2 and 4. Long lines are cut at the mark.
---
== 1 worker pod deleted under a running actor
  detect    CRASHED after 0.2 s
  symptom   503 in 0.073744 s: actor demo-drill/d1 unavailable: AssignWorker prerequisite not met for Actor: demo-dril …
  state     ACTOR_STATE_CRASHED
  fix       kubectl ate revert actor d1 -a demo-drill (0.2 s)
  recover   200 in 0.327434 s: count=1 process_age_s=27.9
== 2 node-local snapshot removed before the upload
  symptom   500 in 0.078639 s: error resuming actor demo-drill/d2
  state     ACTOR_STATE_CRASHED
  fix       kubectl ate revert actor d2 -a demo-drill (0.2 s)
  recover   200 in 0.413543 s: count=4 process_age_s=32.3 (durable snapshot held count=3)
…
== 4 the actor uses more memory than its limit
  detect    CRASHED after 2.9 s
  symptom   503 in 0.062056 s: actor demo-drill/d4 unavailable: AssignWorker prerequisite not met for Actor: demo-dril …
  state     ACTOR_STATE_CRASHED
  fix       kubectl ate revert actor d4 -a demo-drill (0.2 s)
  recover   200 in 0.364615 s: count=1 process_age_s=47.3 (new actor from the golden snapshot)
```

Read the three recovery lines with care, because each actor returns at a different point. The actor of case 1 had no snapshot of its own, so it restarts from the golden snapshot with a count of 1. The actor of case 2 had a durable snapshot at a count of 3, and it answers 4. Calls 4 and 5 from before the failure are gone. [CRASHED and RevertActor](#s-crashed-and-revertactor) explains that rule.

The third case is the one to practise. The process inside the sandbox ends, and Substrate does not see it.

```listing
title: a process that exits leaves the actor in the running state
source: capture/lab/N-demos/failure-drill/drill-run.log
lang: text
note: Case 3. Long lines are cut at the mark.
---
== 3 the actor process exits inside the sandbox
  symptom   503 in 0.055202 s: upstream connect error or disconnect/reset before headers. reset reason: connection ter …
  state     ACTOR_STATE_RUNNING (5 s after the exit)
  detect    suspend fails, state ACTOR_STATE_CRASHED
  fix       kubectl ate suspend actor d3, then kubectl ate revert actor d3 (0.7 s)
  recover   200 in 0.408503 s: count=2 process_age_s=41.6 (durable snapshot held count=1)
```

Five seconds after the exit, the state is still `ACTOR_STATE_RUNNING`, and each request returns a 503 from the proxy. The drill calls `SuspendActor` to make Substrate look. That call fails, the state changes to crashed, and the revert then works. The two commands took 0.7 seconds together.

The last two cases are not crashes. No actor needs a revert.

```listing
title: a full pool and 30 seconds without Postgres
source: capture/lab/N-demos/failure-drill/drill-run.log
lang: text
note: Cases 5 and 6. Long lines are cut at the mark.
---
== 5 more running actors than the pool has room for
  symptom   503 in 5.050146 s: actor demo-drill/d5c unavailable: no worker has room for the actor
  state     d5a ACTOR_STATE_RUNNING, d5b ACTOR_STATE_RUNNING, d5c ACTOR_STATE_SUSPENDED
  fix       kubectl ate suspend actor d5a -a demo-drill (0.4 s)
  recover   200 in 0.321061 s: count=1 process_age_s=58.1
== 6 Postgres is away for 30 s
  symptom   running actor: 503 in 5.055445 s: actor demo-drill/d6 unavailable
  symptom   suspended actor: 503 in 5.053930 s: actor demo-drill/d6s unavailable
  state     kubectl ate get actor fails: Error: failed to connect to ate-api-server: no ready api pods in ate-system
  fix       kubectl -n ate-system scale statefulset postgres --replicas=1 (ready after 2.1 s)
  recover   running actor answers after 0.9 s
  recover   suspended actor answers after 0.4 s
  state     d6 ACTOR_STATE_RUNNING, d6s ACTOR_STATE_RUNNING
total 70 s
```

A full pool gives a 503 after the 5 second parking budget, and a suspend of another actor frees the room. Without Postgres, a running actor and a suspended actor both return 503 after 5 seconds. The CLI fails too, because `ate-api-server` reports that it has no ready pod.

## What our run adds to the earlier sections

The drill ran on a different guest and a different install from the runs in Part 3 and Part 8. The results agree on every symptom text and every state.

One number differs. In the dependency test of [When a dependency is down](#s-when-a-dependency-is-down), new resumes failed for 27 seconds after a Postgres outage of 61 seconds. In the drill, Postgres was away for about 30 seconds, and a suspended actor answered 0.4 seconds after Postgres was ready. We did not find which condition makes the longer delay. Plan for the longer one.

## Limits of the drill

- It needs a kind cluster, because case 2 removes a directory inside the node container.
- It does not restart a node, and it does not stop `ate-api-server` or the Kubernetes API server. Part 8 has those runs.
- It uses one small actor. An actor with more memory needs more time for each resume.
- It stops Postgres with a scale to zero. A network fault or a slow disk can look different to a client.

## What to change for production

Do not run the drill on a cluster with users. Run it on a staging cluster after each Substrate upgrade, and keep the log. A changed symptom text or a new state in that log means that your alerts and your runbook need an update.

Add your own actor to the drill. Replace the image in the template with yours, and check what your application does after a revert to an older snapshot.

```takeaways
- Run the drill on a test cluster before your first incident, and keep the log.
- Match the error text to the fix: revert a crashed actor, and suspend another actor when the pool is full.
- Call suspend on an actor that returns a 503 while its state is running, then revert it.
- Run the drill again after each upgrade, and compare the symptom texts.
```

Sources: capture/lab/N-demos/failure-drill/drill-run.log, capture/lab/summary/demos-x86.json, capture/demos/failure-drill/drill.sh, capture/demos/failure-drill/drill_actor.py, capture/lab/N-demos/install/steps.tsv
