# The router and ingress

> Every request to an actor passes through `atenet-router`, which demands a client certificate with an allowed SPIFFE ID and calls `ResumeActor` before it forwards one byte.

Your actor answers through `kubectl ate proxy`. Then a service in another namespace calls the router directly, and the call fails in the TLS handshake with no HTTP status to read. Nothing is wrong with the actor. The router refused the caller before it looked at the request.

When you finish this section, you can address an actor through the router and name the identity that the router accepts. You can also read the three ways that it refuses a caller on each dataplane.

## One Service for every actor

An actor has no Service and no hostname. Every actor in the cluster is reached through one Service, `atenet-router.ate-system.svc`, and the caller names the target in a header.

**Routing header:** the HTTP header `ate-target-actor`, with the value `<atespace>/<actor>`, such as `ate-demo-counter/my-counter-1`. The `Host` header stays free for your application {{docs}}.

The Service has two ports that matter. Port 443 carries plain HTTPS requests to port 80 of the actor. Port 8444 accepts an HTTP `CONNECT` over TLS, for an actor that listens on another port. The routing header goes on the outer `CONNECT`, and the port goes in its authority {{docs}}. Our probe sent `CONNECT actor:80` and got the same answer as on port 443.

| | Envoy dataplane | agentgateway dataplane |
|---|---|---|
| Containers in the router pod | `atenet-router` and `envoy` | one `agentgateway` |
| Listeners for callers | 8443 and 8444 | 8443 and 8444 |
| Service ports | 443 and 8444 | 443, 8444, 80, 8081, and 15020 |
| Plain HTTP on 80 or 8081 | no such Service port | connection refused |

The agentgateway Service lists ports 80 and 8081, and the NetworkPolicy admits them. No process listens on them. A plain HTTP request to either port failed in 3 ms with a refused connection. Do not read the Service as proof of an open port.

```listing
title: the router Service on the agentgateway dataplane
source: capture/lab/G-dataplane/agentgateway/06-services.txt
lang: text
note: One line. The columns for the external IP, the age, and the selector are cut.
---
atenet-router             ClusterIP   10.96.5.247     <none>        443/TCP,8444/TCP,15020/TCP,80/TCP,8081/TCP …
```

## One request, step by step

The router keeps no table of running actors. For each request it asks `ate-api-server` where the actor is, with the same `ResumeActor` call that wakes a suspended actor. The answer carries the state, the worker IP, and the worker identity. Then the router opens a mutual TLS tunnel to that worker and forwards the request.

```figure
id: fig-6-1
kind: sequence
title: one request through the router
claim: The router calls ResumeActor for every request, also when the actor already runs, and only then opens a tunnel to the worker.
caption: Read from top to bottom. Step 2 happens for each request, which puts ate-api-server and Postgres on the path of each one. From capture/lab/G-dataplane/envoy/ingress-auth/51-rightid-results.txt and capture/lab/E-dependency-loss/15-T2-router-during.log.
```

The router log shows the call for an actor that was already `ACTOR_STATE_RUNNING`. Our prober sent one request per second, and each one produced this pair.

```listing
title: the router asks for a running actor
source: capture/lab/E-dependency-loss/15-T2-router-during.log
lang: text
note: Two lines for one request. The trace fields at the end of each line are cut.
---
{"time":"2026-11-12T11:04:04.204261373Z","level":"INFO","msg":"ResumeActor","actor":{"type":"*ateapi.Actor","atespace":"lab-e","name":"e-run"},…
{"time":"2026-11-12T11:04:04.208776711Z","level":"INFO","msg":"ResumeActor result","actor":{"type":"*ateapi.Actor","atespace":"lab-e","name":"e-run"},"state":"ACTOR_STATE_RUNNING","workerIP":"10.244.0.36","workerSPIFFEID":"spiffe://cluster.local/ns/lab-e/sa/ateworker",…
```

This design has a cost on the warm path. A running actor is only as available as `ate-api-server` and Postgres. We scaled `ate-api-server` to zero for 60 seconds. The running actor returned `503` with the body `actor lab-e/e-run unavailable` for 60 requests in a row. [Section 8.2](#s-when-a-dependency-is-down) has the full timeline.

**We measured** the allowed path on a second x86 server guest (16 vCPU, 23 GB, Envoy dataplane), one request each. A request on port 443 to a running actor took 0.037 s. The same request through `CONNECT` on port 8444 took 0.032 s. On the agentgateway dataplane the two requests took 0.035 s and 0.029 s.

When no worker has room, the router holds the request and tries again. [Section 4.4](#s-request-parking) covers that wait.

## Who the router lets in

The router serves TLS only. It requires a client certificate from the pod identity signer of the cluster. Then it compares the SPIFFE ID in that certificate with a fixed list.

**Ingress allowlist:** the list of SPIFFE IDs that the router accepts, set at install with `--ingress-allowed-spiffe-ids`. The flag has no default. An identity on the list can reach every actor in every atespace {{docs}}.

That last sentence is the one to remember. The router authenticates the caller. It does not check that this caller is allowed to reach this actor. Put a service of your own in front of it when callers must see only their own actors. [Section 5.1](#s-client-authentication) covers the client side.

We sent the same request from three pods. The first had no client certificate. The second had a valid certificate for `spiffe://cluster.local/ns/probe/sa/default`, which is not on the list. The third had the allowed identity.

| Caller | Envoy dataplane | agentgateway dataplane |
|---|---|---|
| No client certificate | connection cut, `Broken pipe` in curl | TLS alert `certificate required` |
| Valid certificate, identity not on the list | TLS alert `certificate unknown` | connection reset |
| Allowed identity | `200` on 443 and through 8444 | `200` on 443 and through 8444 |
| Allowed identity, actor does not exist | `404`, `actor ate-demo-counter/does-not-exist not found` | `404`, `ingress failed` |
| Allowed identity, no routing header | `404`, `invalid actor reference` | `404`, `ingress failed` |

```figure
id: fig-6-1b
kind: decision
title: three callers at the router
claim: Both dataplanes refuse a caller with no certificate or the wrong SPIFFE ID in the TLS layer, so the caller gets no HTTP status.
caption: Read each row from the caller to the outcome. The rose boxes are refusals and the green box is the one request that reached the actor. From capture/lab/G-dataplane/envoy/ingress-auth/10-results.txt and capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt.
```

```listing
title: no client certificate, agentgateway dataplane
source: capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt
lang: text
note: Three lines of curl output. The TLS setup lines before them are cut.
---
* TLSv1.3 (IN), TLS alert, unknown (628):
curl: (56) OpenSSL SSL_read: OpenSSL/3.3.2: error:0A00045C:SSL routines::tlsv13 alert certificate required, errno 0
exit=56
```

No refusal carries an HTTP status, so a client library reports a transport error. When you debug a caller, look for the TLS alert first. The agentgateway error body is also less useful after authentication: it says `ingress failed` for an unknown actor and for a missing header.

One claim in older material is wrong for an installed cluster. The agentgateway router does authenticate callers. The installer adds the client certificate check and the allowlist to every agentgateway install that it makes. We also installed with an empty allowlist. The rule in the router configuration became `source.spiffeId in []`, and the router refused both callers that we tried.

## The identity in the quickstart does not exist

The quickstart passes one identity to the installer: `spiffe://cluster.local/ns/ate-system/sa/atenet-client`. After the install, the namespace `ate-system` has no ServiceAccount with that name.

```listing
title: ServiceAccounts in ate-system after the install
source: capture/lab/G-dataplane/envoy/ingress-auth/00-serviceaccounts.txt
lang: text
note: The whole list, about three minutes after the install finished.
---
NAME                      AGE
ate-api-server            3m33s
ate-client                3m31s
ate-controller            3m31s
ate-idp-server            3m32s
atelet                    3m30s
atenet-egress             3m20s
atenet-router             3m28s
default                   4m18s
k8s-credential-provider   3m21s
```

`kubectl ate proxy` still works, because it does not run as a pod. It asks the cluster for a certificate with that identity, and it names a pod and a ServiceAccount that do not exist {{docs}}. A pod of yours cannot do that. To call the router from a pod with the quickstart identity, we first ran `kubectl create serviceaccount atenet-client -n ate-system`. Then we mounted a pod certificate from the pod identity signer.

Do not copy that into production. The quickstart identity is one name that every user of `kubectl ate proxy` shares. Give each calling service its own ServiceAccount, and list each SPIFFE ID in `--ingress-allowed-spiffe-ids`. Treat the right to request certificates in `ate-system` as the right to become any component there {{docs}}.

```takeaways
- Send `ate-target-actor: <atespace>/<actor>` to `atenet-router.ate-system.svc` on port 443.
- Use `CONNECT` on port 8444 only for an actor port other than 80.
- Read a handshake failure at the router as a missing or unlisted client identity.
- Give each calling service its own ServiceAccount and add its SPIFFE ID to the allowlist.
- Put your own authorization service before the router when callers must not reach all actors.
- Keep `ate-api-server` and Postgres as available as the actors, because each request needs both.
```

Sources: capture/lab/G-dataplane/envoy/ingress-auth/10-results.txt, capture/lab/G-dataplane/envoy/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/envoy/ingress-auth/00-serviceaccounts.txt, capture/lab/G-dataplane/envoy/ingress-auth/50-create-sa.log, capture/lab/G-dataplane/envoy/06-services.txt, capture/lab/G-dataplane/envoy/03-containers-atenet-router.tsv, capture/lab/G-dataplane/envoy/11-listening.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/agentgateway/06-services.txt, capture/lab/G-dataplane/agentgateway/11-listening.txt, capture/lab/G-dataplane/agentgateway/10-atenet-router-agentgateway-config.yaml, capture/lab/G-dataplane/02-agentgateway-without-ingress-allowlist/14-probe-no-allowlist.txt, capture/lab/G-dataplane/02-agentgateway-without-ingress-allowlist/30-config-diff.txt, capture/lab/E-dependency-loss/15-T2-router-during.log, capture/lab/E-dependency-loss/20-analysis.txt, cmd/atenet/internal/router/README.md, cmd/atenet/internal/router/ingress/ingress.go, docs/guides/api-guide.md and docs/guides/quickstart.md at v1.0.0.
