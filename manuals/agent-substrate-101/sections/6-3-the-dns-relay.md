# The DNS relay

> The DNS relay answers only for names in the policy of the actor, so a denied host fails as NXDOMAIN before the actor opens a connection.

An agent reports `Could not resolve host: example.com`. You check CoreDNS, and it is healthy and has no record of the query. You resolve the name from a debug pod and it works. The actor never asked CoreDNS. It asked a resolver that Substrate runs for it, and that resolver read the policy first.

When you finish this section, you can explain each DNS failure inside an actor. You can also say how long a policy change takes to reach name lookups.

## One resolver, and it reads the policy

The file `/etc/resolv.conf` in an actor names one server, `169.254.17.1`. That address is the worker end of the link of the actor.

**DNS relay:** a resolver inside `atunnel` in the worker pod, with one instance for each actor. It forwards a query to the cluster resolver only when the name matches a hostname in a rule of that actor {{code}}. The rule kind does not matter. For every other name it answers `NXDOMAIN`.

The relay marks a denial so that clients do not cache it, and it does not log the name that it denied {{code}} {{docs}}. That is why your search of the cluster logs found nothing.

The same query from one actor, before and after its policy named the host:

```listing
title: one name, without and with a rule for it
source: capture/lab/F-egress/envoy/20-results.txt
lang: text
note: Two runs of the same dig command. The first actor has no policy. The second has an http rule for the name. Warning lines are cut.
---
$ dig +time=2 +tries=1 +noall +comments +answer whoami.egress-target.svc.cluster.local | grep -E 'status|IN'
…
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 58397
…
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 26542
…
whoami.egress-target.svc.cluster.local.	30 IN A	10.96.79.253
```

Default deny covers cluster names too. An actor with no rule for the Kubernetes API cannot resolve `kubernetes.default.svc.cluster.local`. An actor is not a pod, and it gets no cluster DNS for free.

## Another resolver does not help

A tool that distrusts the local resolver sometimes queries a public one. From an actor, that query gets no answer at all.

```listing
title: a query to a public resolver from an actor
source: capture/lab/F-egress/envoy/20-results.txt
lang: text
note: The command and its output. The actor had no policy.
---
$ dig @8.8.8.8 +time=2 +tries=1 example.com | grep -E 'status|timed out|refused|unreachable' ; echo rc=$?
;; communications error to 8.8.8.8#53: timed out
```

Only DNS to the worker end of the link reaches the relay {{code}}. A query to any other server is not DNS traffic for Substrate, and Substrate forwards no UDP out of the sandbox. The result was the same on both dataplanes, because this check happens in the worker and not in the gateway.

Expect the same from DNS over HTTPS. It is an HTTPS request to a host, and the policy decides it like any other host.

## Short names against full names

Kubernetes users write short Service names every day, and inside a pod they work. Inside an actor a short name fails in a way that looks like a policy bug. We saw it in the kagent run.

The policy of the kagent actor allowed `mock-llm.kagent.svc.cluster.local` on port 8080. The search list of the actor was `kagent.svc.cluster.local svc.cluster.local cluster.local`. We asked for the model list four ways.

| Request from the actor | Result |
|---|---|
| `mock-llm.kagent.svc.cluster.local:8080` | `200`, the model list |
| `mock-llm.kagent:8080` | `403 Forbidden` |
| `example.com` | `bad address`, the resolver answered `NXDOMAIN` |
| `kubernetes.default.svc.cluster.local` | `bad address` |

The short name got a `403`, not a DNS error. The resolver in the actor added a search suffix, the relay saw the full name, and the lookup succeeded. Then the HTTP request carried `Host: mock-llm.kagent:8080`. The gateway compares the `Host` header with the policy, and the policy holds the full name only.

```listing
title: four requests from a kagent actor
source: capture/lab/K-kagent/session1/turn5-egress.out
lang: text
note: Output of the tool call in one turn. Lines for the other probes are cut.
---
A http-outside:
wget: bad address 'example.com'
…
E allowed-host:
{"object": "list", "data": [{"id": "mock-1", "object": "model", "owned_by": "lab"}]}
…
G kube-api:
wget: bad address 'kubernetes.default.svc.cluster.local'
H short-name:
wget: server returned error: HTTP/1.1 403 Forbidden
```

```figure
id: fig-6-3
kind: decision
title: four names from one kagent actor
claim: A short Service name passes the DNS relay through the search list, and the gateway then refuses it because the Host header is not in the policy.
caption: Read each row from the name to the outcome. The first check is the DNS relay and the second is atenet-egress. From capture/lab/K-kagent/session1/turn5-egress.out and capture/lab/K-kagent/session1/egress-policy-actor.yaml.
```

The fix is on your side. Write full names in the policy, and give the agent full names in its configuration, its prompts, and its tool definitions. We did not test a rule for the short name. Full names worked in every run, so use them.

## How fast a policy change reaches DNS

The relay keeps the policy of its actor in a cache for 5 seconds {{code}}. A change to the policy therefore reaches name lookups a few seconds after the API accepts it. We polled a name every 2 seconds and changed the policy during the poll.

```listing
title: a poll while a rule for example.com is added, Envoy dataplane
source: capture/lab/F-egress/envoy/40-supplement.txt
lang: text
note: The update returned at 10:56:39.119. The first five of 40 samples.
---
10:56:33 com=status: NXDOMAIN org=status: NXDOMAIN
10:56:35 com=status: NXDOMAIN org=status: NXDOMAIN
10:56:37 com=status: NXDOMAIN org=status: NXDOMAIN
10:56:39 com=status: NOERROR org=status: NOERROR
10:56:41 com=status: NOERROR org=status: NOERROR
```

**We measured** six policy changes on a second x86 server guest (16 vCPU, 23 GB): one added rule and two removed rules on each dataplane. In five of the six, the first sample with the new answer came within 2 s of the update. In the sixth it came within 3 s. Our poll interval was about 2 s, so we cannot give a finer number.

One run did not fit. On the Envoy dataplane we added a rule for `example.com`, a name that the actor had never queried, and waited 12 seconds. Requests that finished 14 s and 16 s after the update still failed with `Could not resolve host`. A request at 18 s worked. We saw this delay once and we did not reproduce it, so we cannot name its cause.

```figure
id: fig-6-3b
kind: timeline
title: DNS answers after a policy change
claim: In our polled runs a new rule reached DNS within 2 seconds, and in one unpolled run on Envoy the name stayed unresolved for 16 seconds.
caption: Read each track from left to right. Zero is the moment the update command returned. Rose marks failed lookups and violet marks answers. From capture/lab/F-egress/envoy/40-supplement.txt, capture/lab/F-egress/agentgateway/40-supplement.txt, and capture/lab/F-egress/envoy/20-results.txt.
```

Plan for the slow case, because many tools report a DNS failure once and stop. Write the policy before the actor makes its first request. When you add a host to a running actor, wait and retry for 20 seconds before you report a failure.

One behaviour we did not test, and you should know it from the code. When the relay cannot refresh the policy, it keeps the last policy that it read and answers from it {{code}}. The gateway does the opposite and refuses requests when it cannot read the policy. A removed host can therefore keep its DNS answer during a control plane outage, and the connection still fails at the gateway.

```takeaways
- Read `NXDOMAIN` or `bad address` inside an actor as a name that no rule lists.
- Add a rule for each cluster Service that the actor needs, with its full name.
- Give agents full Service names, and never the short form.
- Do not point a tool at a public resolver, because the query times out.
- Write the policy before the first request of the actor.
- Retry for 20 seconds after you add a host to a running actor.
```

Sources: capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/envoy/40-supplement.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/agentgateway/40-supplement.txt, capture/lab/K-kagent/session1/turn5-egress.out, capture/lab/K-kagent/session1/egress-policy-actor.yaml, capture/lab/K-kagent/probes/egress-deny-lines.txt, internal/atunnel/dns/readme.md, internal/atunnel/egresspolicy.go, internal/ateworker/actornet/sandbox.go, docs/guides/egress-traffic.md and docs/guides/network-egress.md at v1.0.0.
