# agentgateway with Substrate

> agentgateway can be the dataplane of Substrate, the dataplane inside the kagent distribution, or a gateway behind an egress rule, and only the third selects models and tools.

A colleague tells you that all agent traffic goes through agentgateway, so you can limit which models an agent calls. The first half is true in some clusters. The second half depends on where agentgateway is in the path. It can be in three places, and each place decides different things.

When you finish this section, you can name the place that agentgateway has in a cluster. You can also say what the egress policy of Substrate can express, and when you need a second gateway behind it.

```figure
id: fig-7-2
kind: flow
title: three places for agentgateway
claim: In places A and B agentgateway enforces the Substrate policy, and only in place C does it read model and tool traffic.
caption: Each row is one request path, read left to right. Indigo boxes are the Substrate dataplane. The bold line under a row says what agentgateway decides in that place. The dashed box is a gateway that you deploy yourself. From capture/lab/G-dataplane, capture/lab/K-kagent, and the agentgateway source at v1.7.0.
```

| Place | Who installs it | What it decides | What we ran |
|---|---|---|---|
| A. The dataplane of Substrate | you, with one `ate-setup` flag | ingress identity, the egress policy, credential injection | the full comparison with Envoy |
| B. The dataplane in the kagent distribution | the kagent installer | the same as A | 98 kagent turns through it |
| C. A model or MCP gateway behind egress | you, as your own workload | models, tools, budgets | not run |

## Place A: the dataplane of Substrate

Substrate has two proxies in every request path: `atenet-router` for ingress and `atenet-egress` for egress. The proxy binary in both is Envoy by default. Pass `--atenet-dataplane=agentgateway` to `ate-setup`, and both run agentgateway {{code}}.

We switched a running cluster from Envoy to agentgateway with that flag. The command took 32 s and ended with exit code 0. We did not need a new cluster.

**We measured** both dataplanes on an x86 server guest with 16 vCPU and 23 GB, one sample each at idle. The router and the egress gateway used about 38 MB in 2 containers with agentgateway. They used about 91 MB in 5 containers with Envoy.

Our short verdict has four parts.

- **Lighter.** Two containers do the work of five, with less than half the idle memory.
- **Ingress clients are authenticated.** A client with no certificate got the TLS alert `certificate required`. A client with an allowed identity got 200.
- **The interception CA private key is in the dataplane container.** With Envoy, only a sidecar holds that key.
- **The egress gateway logs at debug level.** It prints the headers of every request. An injected credential never appeared in the log. A custom header that the actor set itself did appear, in clear text.

Choose agentgateway when memory on each node matters to you. Before production, lower the log level, and decide if you accept the key in the proxy container. [The dataplane choice](#s-the-dataplane-choice) has the full comparison, row by row.

## Place B: the dataplane inside the kagent distribution

kagent installs its own distribution of Substrate, as [kagent 1.0 on Substrate](#s-kagent-on-substrate) shows. In that distribution agentgateway was the only dataplane that we saw. Our cluster ran agentgateway v1.7.0 in `atenet-router` and in `atenet-egress` {{run}}. The values that the kagent installer passes to the Substrate charts name no dataplane {{kagent}}. The charts themselves are not in the kagent repository, so we could not check them for an Envoy option.

One cost of this dataplane is specific to credentials. The gateway, agentgateway v1.7.0, keeps each fetched credential for 300 seconds. So a rotated Secret can take up to 5 minutes to reach requests {{agentgateway}}. With Envoy and the bundled provider, the next request gets the new value.

This is from the code, and it applies to place A and to place B. A measured check is in progress, and we have no number yet. [Credential injection](#s-credential-injection) has the detail.

We saw the same two costs as in place A. The egress gateway ran with `RUST_LOG=debug`, and 3,376 of its 4,199 log lines in 3 minutes were debug lines. The CA private key was mounted in its container.

We also saw the same ingress authentication. A plain pod with no certificate could not reach an actor.

```listing
title: the router of the kagent distribution refuses a pod with no certificate
source: capture/lab/K-kagent/parallel/ingress-probe.txt
lang: text
note: The probe ran from a pod in the default namespace. Three more lines of this namespace are cut.
---
from namespace default:
http://atenet-router.ate-system.svc:80/ code=000 curl_exit=7 Failed to connect to atenet-router.ate-system.svc port 80 after 3 ms: Could not connect to server
http://atenet-router.ate-system.svc:8081/ code=000 curl_exit=7 Failed to connect to atenet-router.ate-system.svc port 8081 after 2 ms: Could not connect to server
https://atenet-router.ate-system.svc:443/ code=000 curl_exit=56 OpenSSL SSL_read: OpenSSL/3.3.2: error:0A00045C:SSL routines::tlsv13 alert certificate required, errno 0
https://atenet-router.ate-system.svc:8444/ code=000 curl_exit=56 OpenSSL SSL_read: OpenSSL/3.3.2: error:0A00045C:SSL routines::tlsv13 alert certificate required, errno 0
…
```

Ports 80 and 8081 refused the connection. Ports 443 and 8444 asked for a client certificate. The Session actor stayed `ACTOR_STATE_SUSPENDED` through the probe.

kagent itself has no agentgateway configuration. kagent writes an egress policy for each actor into the Substrate API, and the dataplane enforces that policy. So place B gives kagent the same policy that place A gives you, and no more.

## Place C: a gateway that actors call

You will read that a policy can say which models, tools, or other agents an actor can call. At v1.0.0, the egress policy of Substrate has no field for any of them. This table is the whole policy.

| The egress policy can | The egress policy cannot |
|---|---|
| allow a host name, exact or with one wildcard label | allow or deny a model name |
| allow a port on that host | allow or deny one tool of an MCP server |
| choose `http`, `https` with interception, or `tlsPassthrough` | set a token budget or a rate limit |
| replace one request header with a Secret value or an Actor JWT | inspect a prompt or an answer |

The configuration of the egress gateway shows the same limit. Each route has one policy, `substrateEgress`, and one kind of backend, `dynamic`. A dynamic backend is the host that the actor asked for. The file has no model backend and no MCP route.

```listing
title: the request policy of the agentgateway egress gateway
source: capture/lab/G-dataplane/agentgateway/10-atenet-egress-agentgateway-substrate-config.yaml
lang: yaml
note: The listeners above this route and the credential provider settings below it are cut.
---
…
        - backends:
          - dynamic: {}
            policies:
              backendTLS:
                root: /etc/ssl/certs/ca-certificates.crt
          policies:
            substrateEgress: &egressPolicy
…
```

agentgateway as a product can do the rest. Its model gateway mode routes requests to model providers and applies budgets, load balancing, and failover. Its MCP gateway mode federates tools from MCP servers {{agentgateway}}. Neither mode is configured in the Substrate dataplane, in place A or in place B.

To use those modes, deploy a second agentgateway as your own workload and put it behind the egress gateway:

1. Run agentgateway as a model gateway or an MCP gateway in the cluster.
2. Write one egress rule that allows only the host and the port of that gateway.
3. Add a `replaceHeaders` effect with an [Actor JWT](#s-actor-jwts) to that rule, so the gateway knows which actor calls.
4. Make the gateway verify that token against the issuer of Substrate, and write the model and tool rules there.

The actor can then reach no model host directly, and the second gateway decides what each actor is allowed to call.

We did not run this design. We ran its two Substrate parts. In the kagent run, one egress rule replaced the `authorization` header on 10 of 10 calls to a mock model. In the egress tests, the credential swap worked on both dataplanes. We did not run a model gateway behind egress, and we did not use a real model.

Three limits of the egress gateway apply to this design, and one section proves each:

- The gateway replaces a header only when the request already has that header. A request with no `authorization` header passed unchanged. [Credential injection](#s-credential-injection) has that run.
- A WebSocket upgrade returned 403, so the gateway behind egress must use plain HTTP requests or streamed HTTP responses. [EgressPolicy and default deny](#s-egresspolicy-and-default-deny) has that run.
- A removed rule does not close an open connection. [The dataplane choice](#s-the-dataplane-choice) has that run.

```takeaways
- Find the place of agentgateway in your cluster before you promise a policy.
- Use the egress policy for hosts, ports, TLS mode, and one credential header.
- Deploy a second gateway behind one egress rule to select models and tools.
- Lower the log level of the agentgateway egress gateway before production.
- Read section 6.6 before you change the dataplane of a running cluster.
```

Sources: capture/lab/G-dataplane/01-switch-in-place/11-timing.txt, capture/lab/G-dataplane/agentgateway/13-crictl-stats-atenet.txt, capture/lab/G-dataplane/envoy/13-crictl-stats-atenet.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt, capture/lab/G-dataplane/agentgateway/04-volumes-atenet-egress.json, capture/lab/G-dataplane/agentgateway/10-atenet-egress-agentgateway-substrate-config.yaml, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/agentgateway/50-custom-header.txt, capture/lab/F-egress/envoy/20-results.txt, capture/lab/K-kagent/inventory/images.tsv, capture/lab/K-kagent/inventory/deploy-atenet-egress.yaml, capture/lab/K-kagent/parallel/ingress-probe.txt, capture/lab/K-kagent/session1/egress-policy-actor.yaml, capture/lab/K-kagent/session1/mock.log; Agent Substrate v1.0.0 source: cmd/atenet/internal/router/config.go, cmd/ate-setup/commands.md, manifests/ate-install/agentgateway; agentgateway v1.7.0 source: README.md, crates/agentgateway/src/http/substrate (README.md, egress.rs); kagent v1.0.0 Substrate distribution charts.
