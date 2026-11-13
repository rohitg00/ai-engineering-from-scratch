# Your first actor and kubectl ate proxy

> `kubectl ate proxy` is a tool for your own machine: it tunnels through the Kubernetes API server, so it fails when that server is down while actor traffic continues.

The install is done, and you want to see an actor answer. The quickstart gives you two commands and a `curl`. They work. Then you put the same proxy command in a test script. The control plane of the cluster restarts, and every request times out while the actors are fine.

When you finish this section, you can create an actor, reach it through `kubectl ate proxy`, and suspend it. You can also say why the proxy must not carry real traffic, and what a real client needs in its place.

## Create the actor

The counter demo created an atespace named `ate-demo-counter` and a template named `counter` in it. Create an actor from that template:

```bash
kubectl ate create actor my-counter-1 -a ate-demo-counter --template counter
```

The command prints the new actor. In our run the state was `ACTOR_STATE_SUSPENDED`, the worker pod was `<none>`, and the version was 1. [Section 2.2](#s-kubectl-ate) shows that output.

A new actor uses no worker. Nothing was started. The create call wrote one row to Postgres and pointed the actor at the golden snapshot of its template. In one of our tests we created 131 actors on a pool of three workers before any of them ran.

## Start the proxy

Start the proxy in a terminal of its own. It stays in the foreground:

```bash
kubectl ate proxy actor my-counter-1 -a ate-demo-counter
```

```listing
title: the proxy after it starts
source: capture/lab/B-lifecycle/01-proxy.log
lang: text
---
Proxying 127.0.0.1:8000 -> ate-demo-counter/my-counter-1:80
```

With no port argument, the proxy forwards local port 8000 to port 80 of the actor. To choose the ports, add pairs in the form `local:remote`, such as `8080:80` {{docs}}. The proxy listens on `127.0.0.1` only, unless you pass `--address` {{code}}.

**Proxy:** `kubectl ate proxy actor` is a local listener that forwards TCP to one actor through `atenet-router`. It does three things for you. It opens a port-forward to the router. It gets a client certificate for the identity `atenet-client`. It names the target actor to the router.

The install must allow that identity. This is why the install command in [section 2.1](#s-install-with-ate-setup) passes `--ingress-allowed-spiffe-ids` with the `atenet-client` name. Without that flag, the router lets no client through, and the proxy cannot reach any actor {{docs}}.

## Send requests

In a second terminal, send a request:

```bash
curl -X POST http://localhost:8000/
```

Send it a few times. This is our recording of the first three requests:

```listing
title: the first three requests
source: capture/lab/B-lifecycle/10-trace.tsv
lang: text
note: Three lines of the trace. The columns are the time, the event, the status, the seconds, and the body.
---
2026-11-12T10:14:21.837Z	call-1	200	0.358379	preserved memory count: 1 | preserved file counter: 1 | preserved rootfs counter: 1
2026-11-12T10:14:21.944Z	call-2	200	0.090770	preserved memory count: 2 | preserved file counter: 2 | preserved rootfs counter: 2
2026-11-12T10:14:22.030Z	call-3	200	0.066903	preserved memory count: 3 | preserved file counter: 3 | preserved rootfs counter: 3
```

The counter demo keeps three counts: one in memory, one in a file, and one in the root filesystem. All three rise together here. They matter later, when a snapshot keeps less than the memory. [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) uses them.

The first request resumed the actor. Now it holds a worker:

```listing
title: the worker that runs my-counter-1
source: capture/lab/B-lifecycle/13-workers.txt
lang: text
note: The warning line is cut.
---
NAME                                   POOL      STATE                 ACTORS   CPU(MILLICORES)   MEMORY        POD                                         AGE
ec15263e-4c0f-45eb-adc1-53f5f60c2331   counter   WORKER_STATE_ACTIVE   1/1000   1000/1000         512Mi/960Mi   ate-demo-counter/counter-7cc7dcd596-ffxwt   74s
```

Read the `CPU(MILLICORES)` column. This one actor takes 1000 of the 1000 millicores of its worker. The actor limit of 1000 in the `ACTORS` column is not the limit that binds. The CPU is. So the demo pool of three workers runs three counter actors at one time, and a fourth must wait. [Section 4.5](#s-sizing-a-pool) sizes a pool from these columns.

## Suspend it yourself

Stop sending requests and watch the actor. It stays in `ACTOR_STATE_RUNNING`. Substrate does not suspend it.

**We measured** this on an x86 server guest with 24 vCPU and 47 GB, in one run. For 900 s we sent no request and read the state every 15 s. All 60 samples were `ACTOR_STATE_RUNNING`. The next request took 0.080 s and returned count 6.

To free the worker, suspend the actor:

```bash
kubectl ate suspend actor my-counter-1 -a ate-demo-counter
```

**We measured** the suspend on the same guest, once. The command returned in 0.40 s, and the state was `ACTOR_STATE_SUSPENDED`. The next request through the proxy took 0.36 s and returned the next count, so the memory came back.

This default suspend is asynchronous. The new snapshot is on the node and is not yet in the object store. [Section 3.3](#s-suspendactor-and-resumeactor) explains the two modes, and [section 3.5](#s-crashed-and-revertactor) shows what you lose when the node copy disappears.

## The proxy depends on the Kubernetes API server

The proxy reaches the router through a Kubernetes port-forward. Every byte passes kube-apiserver. A client inside the cluster does not need that hop. [Figure 2.3](#fig-2-3) puts the two paths side by side.

```figure
id: fig-2-3
kind: comparison
title: two paths to one actor while kube-apiserver is down
claim: With kube-apiserver down for 86 s the proxy served no request, and a pod that called the router served every one.
caption: Column A is kubectl ate proxy on the machine of the operator. Column B is a pod in the cluster with a client certificate. Both sent one request each second to the same running actor. From capture/lab/summary/dependency-loss-x86.json.
```

**We measured** both paths on an x86 server guest with 16 vCPU and 23 GB, in one run with one request each second. We took kube-apiserver away for 86 s. Through the proxy, 0 of 81 requests in that time were served, and each one ran into the 9 s limit of the client. From the pod, 86 of 86 were served. The proxy kept failing for 21 s after kube-apiserver was ready again.

```listing
title: the kube-apiserver outage in our analysis
source: capture/lab/E-dependency-loss/20-analysis.txt
lang: text
note: The block for the third outage. The counts start 10 s before the outage and end 90 s after it.
---
== T3 kube-apiserver: down at +0 s, restore action at +86 s, dependency ready at +91 s
  proxy/running (VM, kubectl ate proxy)
     codes from -10 s: 200x9 000x105 200x59
     first failure at +0 s, last failure at +112 s (= +26 s from restore action, +21 s from dependency ready); failed 105 of 173
     failure latency p50 9.00 s max 9.00 s
     105x code=000 body=''
  incluster/running (pod, mTLS to router)
     codes from -10 s: 200x186
     no failures
```

So do not judge the health of Substrate with the proxy, and do not put the proxy between a product and its actors. The proxy tells you about your path to the cluster. A pod that calls the router tells you about Substrate.

## What a real client needs

A real client is a pod. It needs three things, and the pod we used for the test shows all of them.

```listing
title: the pod that called the router
source: capture/lab/E-dependency-loss/prober.yaml
lang: yaml
note: The container and the volume mounts are cut.
---
kind: Pod
…
metadata: {name: e-prober, namespace: ate-system, labels: {app: e-prober}}
…
  serviceAccountName: atenet-client
…
      - podCertificate: {credentialBundlePath: credential-bundle.pem, keyType: ECDSAP256, signerName: podidentity.podcert.ate.dev/identity}
…
      - clusterTrustBundle: {labelSelector: {matchLabels: {podcert.ate.dev/canarying: live}}, path: trust-bundle.pem, signerName: servicedns.podcert.ate.dev/identity}
```

1. **An allowed identity.** The pod runs as the ServiceAccount `atenet-client` in `ate-system`. That is the identity in `--ingress-allowed-spiffe-ids`. The install does not create this ServiceAccount, so we created it.
2. **A client certificate.** The `podCertificate` volume asks Kubernetes for a certificate with that identity. The `clusterTrustBundle` volume holds the CA that verifies the router.
3. **The target header.** Each request names its actor in the header `ate-target-actor`, as the atespace, a slash, and the actor name.

The request of that pod was this command:

```bash
curl --cacert /run/ca/trust-bundle.pem \
  --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem \
  -X POST -H 'ate-target-actor: lab-e/e-run' \
  https://atenet-router.ate-system.svc:443/
```

Any listed client can reach any actor through the router {{docs}}. The allowlist says who can enter. It does not say which actor each client can call. [Section 5.1](#s-client-authentication) and [section 6.1](#s-the-router-and-ingress) cover the identity and the router.

```takeaways
- Create actors freely, because a new actor uses no worker.
- Read the CPU column of kubectl ate get workers to see how many actors a worker can run.
- Suspend an actor yourself when its work is done.
- Use kubectl ate proxy on your own machine only.
- Test the health of Substrate from a pod that calls atenet-router with a client certificate.
```

Sources: capture/lab/summary/failures-x86.json, capture/lab/summary/dependency-loss-x86.json, capture/lab/A-quickstart/50-create-actor.log, capture/lab/B-lifecycle/01-proxy.log, capture/lab/B-lifecycle/10-trace.tsv, capture/lab/B-lifecycle/13-workers.txt, capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/E-dependency-loss/20-analysis.txt, capture/lab/E-dependency-loss/10-timeline.tsv, capture/lab/E-dependency-loss/12-probe-proxy.tsv, capture/lab/E-dependency-loss/12-probe-incluster.tsv, capture/lab/E-dependency-loss/prober.yaml, capture/lab/E-dependency-loss/loop.sh, capture/lab/E-dependency-loss/00-setup.log, capture/lab/_scripts/b1-lifecycle-idle.sh; docs/reference/kubectl-ate.md, docs/reference/api-guide.md, cmd/ate-setup/commands.md, and cmd/kubectl-ate/internal/cmd/proxy.go at v1.0.0.
