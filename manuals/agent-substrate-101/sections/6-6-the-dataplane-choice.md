# The dataplane choice: Envoy or agentgateway

> agentgateway does the work of the Envoy dataplane in 38 MB and two containers, but it holds the interception CA key in the process that actors talk to.

The installer has a flag, `--atenet-dataplane`, with two values and no advice. If you install kagent, the choice is already made for you: it runs agentgateway. Either way you now operate one of two proxies. They do not behave the same when a request is refused or a rule is removed.

When you finish this section, you can choose a dataplane for a cluster and give the reason. You can also say what happens to an open connection after you remove its rule.

## One flag changes both gateways

**Dataplane:** the proxy software inside the pods `atenet-router` and `atenet-egress`. The flag `--atenet-dataplane` takes `envoy`, the default, or `agentgateway`. One value applies to both pods.

The Substrate API does not change with the flag. Actors, policies, and `kubectl ate` work the same. What changes is the code that enforces a policy.

On the Envoy dataplane, two pieces of Substrate code decide. A Substrate process beside Envoy authenticates the actor, decides each HTTP request, and supplies the rules. A Substrate module that Envoy loads into its own process decides TLS connections by server name. On the agentgateway dataplane, policy code inside agentgateway v1.7.0 makes it {{code}}. Two implementations of one policy explain every difference in this section.

You can switch a running cluster. Run `deploy ate-system` again with the same flags and the new value.

**We measured** the switch from Envoy to agentgateway once, on a second x86 server guest (16 vCPU, 23 GB). The command took 32 s and exited with 0. Two running actors stayed in `ACTOR_STATE_RUNNING` on their workers through the switch. We did not send requests during those 32 seconds, so we cannot say how many would fail.

## The full comparison

We captured the same inventory and ran the same probes on each dataplane, on one cluster.

| | Envoy dataplane | agentgateway dataplane |
|---|---|---|
| Containers in `atenet-router` | `atenet-router`, `envoy` | `agentgateway` |
| Containers in `atenet-egress` | `envoy`, `ext-proc`, `sdsmint` | `agentgateway` |
| Router listeners | 8443, 8444 | 8443, 8444 |
| Router Service ports | 443, 8444 | 443, 8444, 80, 8081, 15020 |
| Caller with no client certificate | connection cut | TLS alert `certificate required` |
| Caller with an identity not on the list | TLS alert `certificate unknown` | connection reset |
| Caller with the allowed identity | `200` on 443 and through 8444 | `200` on 443 and through 8444 |
| Unknown actor, or no routing header | `404`, with the reason in the body | `404`, `ingress failed` |
| HTTP from an actor with no policy | connection reset | `403`, `actor egress policy denied` |
| HTTP to a host outside the policy | `403`, `egress denied` | `403`, `actor egress policy denied` |
| Minted certificate | 20 minutes, empty subject | year 1975 to 4096, chain has the CA |
| Interception CA private key | in `sdsmint` only | in the `agentgateway` container |
| Container `securityContext` | drops all capabilities | not set |
| Egress log level | default | `RUST_LOG=debug` |
| Egress log lines after the same test script | 1,369 | 6,477 |
| Idle memory, router and egress | about 91 MB in 5 containers | about 38 MB in 2 containers |
| New request after a rule is removed | refused after 3 to 6 s | refused within 1 to 2 s |

```figure
id: fig-6-6
kind: chart
title: idle memory of each dataplane, container by container
claim: The Envoy dataplane spreads its work over five containers and 91 MB, and agentgateway uses two containers and 38 MB with the CA key inside one.
caption: Each bar is one dataplane, each box is one container, and each bracket is one pod. The width of a box is the idle memory of that container in MB, from one sample soon after start. The heavy outline marks the container that holds the CA key. From capture/lab/G-dataplane/envoy/13-crictl-stats-atenet.txt and capture/lab/G-dataplane/agentgateway/13-crictl-stats-atenet.txt.
```

**We measured** idle memory with one sample for each container, soon after start, on a second x86 server guest (16 vCPU, 23 GB). The five Envoy dataplane containers held 25.6, 21.6, 22.8, 12.0, and 8.9 MB. The two agentgateway containers held 19.9 and 17.8 MB. We did not measure memory, latency, or throughput under load on either dataplane.

Three rows need a comment.

The log row is a volume and a content matter. At debug level, agentgateway prints the headers of each request. In our run it masked `authorization` and it never printed an injected secret. It did print, in clear, a custom header value that the actor sent. Store those logs with the same care as request headers.

The `securityContext` row is as the installer wrote it. We did not try to add one to the agentgateway containers.

The last row favours agentgateway, and the next subsection puts it in context.

## An open connection outlives its rule

You remove a host from a policy because you want the actor to stop talking to it. The gateway applies the new policy to new work only. This is a known behaviour of v1.0.0 {{issue #3285}}, and both dataplanes have it.

Two mechanisms are behind it. The gateway keeps the policy of an actor in a cache, 10 seconds by default on Envoy, so a change takes effect late {{code}}. And a decision is not revisited: an `http` or `https` decision holds for the request, and a `tlsPassthrough` decision holds for the connection {{docs}}.

**We measured** each case once for each dataplane, on the second x86 server guest (16 vCPU, 23 GB), with a poll about every 2 seconds. Zero is the moment the update returned.

| After the rule is removed | Envoy dataplane | agentgateway dataplane |
|---|---|---|
| New DNS lookup of the host | `NXDOMAIN` at the first sample, under 2 s | `NXDOMAIN` within 3 s |
| New HTTP request to the known IP | `200` at 1 s and 3 s, `403` from 6 s | `403` at the first sample, under 2 s |
| New pass-through connection | refused at the first sample, under 2 s | refused at the first sample, under 2 s |
| HTTP response that had already started | ran to its end, 39 s after removal | ran to its end, 18 s after removal |
| Second request on an open pass-through connection, 20 s later | `200` | `200` |

```figure
id: fig-6-6b
kind: timeline
title: after a rule is removed
claim: Both dataplanes refused new requests within 6 seconds of the removal, and neither closed a connection that was already open.
caption: Read each track from left to right, with the removal at zero. Each dot is one sample, green for served and rose for refused. A bar is a connection that was open before the removal and still carried data. The 39 s and 18 s ends are the ends of our test responses, not a limit of the gateway. From capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/envoy/40-supplement.txt, and capture/lab/F-egress/agentgateway/40-supplement.txt.
```

```listing
title: an open pass-through connection across the removal, Envoy dataplane
source: capture/lab/F-egress/envoy/40-supplement.txt
lang: text
note: The rule for example.org was removed at 10:57:53. Both responses came on one TLS connection.
---
HTTP/1.1 200 OK
Date: Thu, 12 Nov 2026 10:57:50 GMT
HTTP/1.1 200 OK
Date: Thu, 12 Nov 2026 10:58:13 GMT
end=10:58:17
```

The 39 s and the 18 s mark the ends of our test responses. In no run did the gateway end an open connection, so we have no upper limit to give you. An actor that keeps one pass-through connection open keeps its access.

We did not test one case: a new request on a reused keep-alive connection of an `http` rule, sent after the removal.

Removing a rule is therefore not a way to cut off an actor now. To do that, remove the rule and then suspend the actor. We did not test that sequence. A suspended actor has no running process that can use a connection.

## Our verdict

Choose Envoy, the default, for a cluster where actors run code that you do not trust and policies have `https` rules. The reason is the CA key. Envoy keeps it away from the process that parses actor traffic, and [section 6.4](#s-tls-interception) explains what that key can do. Envoy also gives better error bodies at the router. It is the only dataplane that accepts the experimental hook for an extra egress filter {{code}}.

Choose agentgateway in three cases. You run kagent, which installs it. You run small clusters where 53 MB for each cluster matters. Or you already operate agentgateway and want one proxy to know. [Section 7.2](#s-agentgateway) covers that last case.

If you choose agentgateway, do three things. Limit who can read Secrets in `ate-system` and who can open a shell in `atenet-egress`. Send the egress logs to a store with access rules. And plan to lower `RUST_LOG`, a change that we did not test.

Do not choose on speed. One allowed request took 0.037 s on Envoy and 0.035 s on agentgateway in our probes, and one request each proves nothing about load.

```takeaways
- Choose Envoy when actors run untrusted code and policies intercept TLS.
- Choose agentgateway with kagent, or where 53 MB less memory for each cluster matters.
- Treat agentgateway egress logs as sensitive, because they hold request headers.
- Search for both sets of error text when a tool reports a refused request.
- Do not rely on a removed rule to stop an open connection.
- Suspend the actor when it must stop talking to a host now.
```

Sources: capture/lab/G-dataplane/envoy/01-pods.txt, capture/lab/G-dataplane/envoy/03-containers-atenet-router.tsv, capture/lab/G-dataplane/envoy/03-containers-atenet-egress.tsv, capture/lab/G-dataplane/envoy/05-sec-res-atenet-router.json, capture/lab/G-dataplane/envoy/05-sec-res-atenet-egress.json, capture/lab/G-dataplane/envoy/06-services.txt, capture/lab/G-dataplane/envoy/13-crictl-stats-atenet.txt, capture/lab/G-dataplane/envoy/ingress-auth/10-results.txt, capture/lab/G-dataplane/envoy/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/agentgateway/01-pods.txt, capture/lab/G-dataplane/agentgateway/03-containers-atenet-router.tsv, capture/lab/G-dataplane/agentgateway/03-containers-atenet-egress.tsv, capture/lab/G-dataplane/agentgateway/05-sec-res-atenet-router.json, capture/lab/G-dataplane/agentgateway/05-sec-res-atenet-egress.json, capture/lab/G-dataplane/agentgateway/06-services.txt, capture/lab/G-dataplane/agentgateway/13-crictl-stats-atenet.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/01-switch-in-place/11-timing.txt, capture/lab/G-dataplane/01-switch-in-place/10-deploy-agentgateway-in-place.log, capture/lab/F-egress/agentgateway/00-actors-after-switch.txt, capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/envoy/40-supplement.txt, capture/lab/F-egress/envoy/32-marker-in-logs.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/agentgateway/40-supplement.txt, capture/lab/F-egress/agentgateway/32-marker-in-logs.txt, capture/lab/F-egress/agentgateway/50-custom-header.txt, cmd/atenet/internal/router/cmd.go, cmd/atenet/internal/router/egress/policycache.go, cmd/ate-setup/internal/config/load.go, manifests/ate-install/components/agentgateway/kustomization.yaml, docs/guides/network-egress.md at v1.0.0, issue #3285.
