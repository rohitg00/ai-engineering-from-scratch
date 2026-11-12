# EgressPolicy and default deny

> An actor with no EgressPolicy reaches nothing, and a policy opens named hosts and ports only, through three rule kinds and no CIDR rule.

Your agent runs a tool that downloads a package, and the tool reports that the host does not resolve. You open a shell in the actor and `curl` fails for every name you try. The network is not broken. The actor has no policy, so Substrate denies all of it.

When you finish this section, you can write an EgressPolicy for one actor and apply it with `kubectl ate`. You can also tell from the error which layer refused a connection.

## The path of an outgoing connection

An actor does not sit on the pod network. Its sandbox has one link of four addresses, and the far end of that link belongs to the worker.

```listing
title: the network that an actor sees
source: capture/lab/F-egress/envoy/20-results.txt
lang: text
note: Output of resolv.conf, the addresses, and the routes inside the actor f-deny. The loopback and IPv6 lines are cut.
---
nameserver 169.254.17.1
search ate-demo-egress.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
…
inet 169.254.17.2/30 scope global dynamic eth0
…
default via 169.254.17.1 dev eth0 scope link
```

Three parts of Substrate handle what leaves that link {{code}}:

1. Firewall rules in the worker redirect every TCP connection to `atunnel`, a process in the worker pod. Other protocols are rejected, except DNS to `169.254.17.1`.
2. `atunnel` opens a mutual TLS `CONNECT` to the Service `atenet-egress`. It presents the certificate of the actor, and the target is the original IP and port.
3. `atenet-egress` verifies the certificate and asks `ate-api-server` that the actor is running or resuming. Then it reads the policy of that actor and decides.

```figure
id: fig-6-2
kind: flow
title: where an outgoing connection is decided
claim: A connection from an actor passes two checks, the DNS relay for the name and atenet-egress for the request, and each one reads the same policy.
caption: Read from left to right. The upper path is a name lookup and the lower path is the connection itself. The upstream host sees the IP of atenet-egress, never the actor. From capture/lab/F-egress/envoy/20-results.txt and the atunnel and router sources at v1.0.0.
```

The upstream host never sees the actor. In our run the test server reported the caller as `10.244.0.22`, the pod IP of `atenet-egress`. Actor networking is IPv4 only at this version {{docs}}.

## The policy is an API record, one per actor

**EgressPolicy:** the list of allow rules for one actor. It is a record in the Substrate API with the fixed name `default`, stored under the actor. It is not a Kubernetes object, so `kubectl get` does not show it.

You create the policy after the actor exists. A new actor does not copy the policy of its template {{docs}}. A harness that creates actors must therefore write a policy for each one, which is what kagent does ([section 7.1](#s-kagent-on-substrate)).

A policy holds up to 256 rules, and the order of the rules has no meaning {{code}}. Each rule is one of three kinds.

| Rule kind | What the gateway reads | Default port | Credential effects |
|---|---|---|---|
| `http` | the `Host` header of each cleartext request | 80 | yes |
| `https` | each request, after the gateway decrypts the TLS session | 443 | yes |
| `tlsPassthrough` | the server name in the TLS handshake, once for each connection | none, you must list ports | no |

A rule has three fields: `hostnames`, `ports`, and `effects`. A hostname is a lowercase DNS name, or a name with `*` as its whole first label, or `*` alone {{code}}. An IP address is not valid, and no rule kind takes a CIDR range. A rule also has no field for a path, a method, a model, or a tool. The policy decides which hosts an actor can reach. It does not decide what the actor asks them for.

This is the policy of our test actor `f-main`, as the API returned it. We wrote the three rules. The API added the default ports and the metadata.

```listing
title: an EgressPolicy with one rule of each kind
source: capture/lab/F-egress/envoy/policy-f-main-P2-live.yaml
lang: yaml
note: The complete output of get egress-policy with -o yaml.
---
metadata:
  atespace: lab-f
  createTime: "2026-11-12T10:45:59.339191794Z"
  name: default
  uid: 06d478d7-7a70-4ca0-91f8-4524c40ea9bc
  updateTime: "2026-11-12T10:52:47.315685233Z"
  version: "6"
rules:
- http:
    hostnames:
    - whoami.egress-target.svc.cluster.local
    ports:
      numbers:
      - 80
- https:
    hostnames:
    - example.com
    ports:
      numbers:
      - 443
- tlsPassthrough:
    hostnames:
    - example.org
    ports:
      numbers:
      - 443
```

## Create and update a policy

The first policy of an actor needs only the rules.

```bash
kubectl ate create egress-policy f-main -a lab-f -f policy.yaml
kubectl ate get egress-policy f-main -a lab-f -o yaml
```

An update is stricter, and we got it wrong twice. The first time, we sent a file with only `rules`.

```listing
title: an update without the preconditions
source: capture/lab/F-egress/envoy/19-first-run-update-refused.txt
lang: text
note: The answer of update egress-policy to a file that has rules and no metadata.
---
Error: manifest for actor "f-main" in atespace "lab-f" lacks the metadata.uid and metadata.version preconditions that "get egress-policy -o yaml" prints
```

`update egress-policy` replaces the whole policy, and it needs to know which version you edited. Read the policy with `-o yaml`, keep `metadata.uid` and `metadata.version`, change the rules, and send the file back. If the stored policy changed between your read and your update, the CLI refuses the update {{code}}. Read the policy again and repeat the change. We did not run that case.

The second time, the file had a `tlsPassthrough` rule with no ports.

```listing
title: a tlsPassthrough rule without ports
source: capture/lab/F-egress/envoy/19b-second-run-passthrough-ports-required.txt
lang: text
note: The answer of update egress-policy. The rule index counts from zero.
---
Error: failed to update egress policy for actor "f-main" in atespace "lab-f": rpc error: code = InvalidArgument desc = egress_policy.rules[2].tls_passthrough.ports: Required value
```

An `http` rule without ports means port 80, and an `https` rule means port 443. A `tlsPassthrough` rule has no default. Write `ports: {numbers: [443]}` each time.

## What a denied request looks like

The two dataplanes enforce the same policy and answer in different words. Learn both sets, because an agent sees these strings in its tool output.

| The actor does this | Envoy dataplane | agentgateway dataplane |
|---|---|---|
| Resolves any name, with no policy | `NXDOMAIN` | `NXDOMAIN` |
| Resolves a name that is not in its policy | `NXDOMAIN` | `NXDOMAIN` |
| Queries another resolver, such as `8.8.8.8` | timeout | timeout |
| Sends HTTP to an IP, with no policy | connection reset | `403`, `actor egress policy denied` |
| Sends HTTP to an IP that is not in its policy | `403`, `egress denied` | `403`, `actor egress policy denied` |
| Opens TLS to an IP, with no policy | handshake cut | handshake cut |
| Opens TLS with a server name that no rule lists | handshake cut | handshake cut |
| Sends a WebSocket upgrade to an allowed host | `403` | `403`, `WebSocket egress is not supported` |

A name outside the policy never reaches the gateway, because the DNS relay answers first. [Section 6.3](#s-the-dns-relay) covers that relay. The gateway answers only when the actor already has an IP address.

```listing
title: HTTP to an IP with no policy, agentgateway dataplane
source: capture/lab/F-egress/agentgateway/20-results.txt
lang: text
note: The response to a request for an IP address from the actor f-deny. The date header is cut.
---
HTTP/1.1 403 Forbidden
content-type: text/plain
content-length: 26
…
actor egress policy denied
```

On Envoy, the same request from the same actor ended with `curl: (56) Recv failure: Connection reset by peer`. The Envoy text `egress denied` appears only when the actor has a policy and the request does not match it.

## The Host header does not open another host

A policy that names hosts invites one attack: connect to an IP of your choice and claim an allowed name in the `Host` header. We tried it. The policy allowed only `whoami.egress-target.svc.cluster.local`. The actor connected to the IP of a second service, `drip`, and sent the allowed name.

```listing
title: a request to another IP with the allowed Host header
source: capture/lab/F-egress/envoy/20-results.txt
lang: text
note: The command and the lines that show which server answered. The headers between them are cut.
---
$ curl -sS -m 8 -i -H 'Host: whoami.egress-target.svc.cluster.local' 'http://10.96.185.134/drip?n=1' | head -14
…
HTTP/1.1 200 OK
…
Hostname: whoami-5bdb4584f6-4gqz6
```

The answer came from `whoami`, not from `drip`. The gateway took the name from the header, found it in the policy, and connected to that name itself. It ignored the IP that the actor had chosen. Both dataplanes did the same. An actor therefore reaches only the hosts that the policy names, whatever address it dials.

The reverse also holds. A policy names hosts, so it cannot pin an IP. If the name resolves to a new address tomorrow, the gateway follows it.

```takeaways
- Write an EgressPolicy for each actor, because a new actor starts with none.
- Use `https` when you need credential injection, and `tlsPassthrough` when the client must see the real certificate.
- Keep `metadata.uid` and `metadata.version` in each file that you send to `update egress-policy`.
- List `ports` in each `tlsPassthrough` rule.
- Read `NXDOMAIN` inside an actor as a name that the policy does not list.
- Do not expect a policy to restrict paths, methods, models, or tools.
```

Sources: capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/envoy/policy-f-main-P2-live.yaml, capture/lab/F-egress/envoy/P2.yaml, capture/lab/F-egress/envoy/19-first-run-update-refused.txt, capture/lab/F-egress/envoy/19b-second-run-passthrough-ports-required.txt, capture/lab/F-egress/envoy/applied-P2.yaml, capture/lab/K-kagent/session1/egress-policy-actor.yaml, api/ateapi/v1/ateapi.proto (EgressPolicy, EgressRule, HttpRule, HttpsRule, TlsPassthroughRule, Ports), internal/ateworker/actornet/sandbox.go, cmd/atenet/internal/router/egress/egress.go, docs/guides/network-egress.md, docs/guides/egress-traffic.md and docs/reference/kubectl-ate.md at v1.0.0.
