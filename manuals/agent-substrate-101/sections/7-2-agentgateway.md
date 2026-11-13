# agentgateway with Substrate

> agentgateway can be the dataplane of Substrate, the dataplane inside the kagent distribution, or a gateway behind an egress rule, and only the third selects models and tools.

A colleague tells you that all agent traffic goes through agentgateway, so you can limit which models an agent calls. The first half is true in some clusters. The second half depends on where agentgateway is in the path. It can be in three places, and each place decides different things.

When you finish this section, you can name the place that agentgateway has in a cluster. You can also say what the egress policy of Substrate can express, and when you need a second gateway behind it.

```figure
id: fig-7-2
kind: flow
title: three places for agentgateway
claim: In places A and B agentgateway enforces the Substrate policy, and only in place C does it read model and tool traffic.
caption: Each row is one request path, read left to right. Indigo boxes are the Substrate dataplane. The bold line under a row says what agentgateway decides in that place. The dashed box is a gateway that you deploy yourself. From capture/lab/G-dataplane, capture/lab/K-kagent, capture/lab/summary/network-x86.json, and the agentgateway source at v1.7.0.
```

| Place | Who installs it | What it decides | What we ran |
|---|---|---|---|
| A. The dataplane of Substrate | you, with one `ate-setup` flag | ingress identity, the egress policy, credential injection | the full comparison with Envoy |
| B. The dataplane in the kagent distribution | the kagent installer | the same as A | 98 kagent turns through it |
| C. A model or MCP gateway behind egress | you, as your own workload | models, tools, budgets | a model gateway with two mock models, over TLS, on both dataplanes |

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

The log level is one variable on the egress Deployment, and the installer sets it to `debug`.

```bash
kubectl -n ate-system set env deploy/atenet-egress RUST_LOG=info
```

**We measured** 100 requests from one actor at each level, on a second x86 server guest (16 vCPU, 23 GB), in one run. Each request had a custom header and an `Authorization` header with test values. At `debug` the gateway wrote 4,380 lines and 1,590,006 bytes, and 200 lines held the value of the custom header. At `info` it wrote 100 lines and 46,300 bytes, and no line held a header value. At `warn` it wrote nothing. All 300 requests returned 200.

The change does not last. After the next `ate-setup deploy ate-system` run, the Deployment had `RUST_LOG=debug` again. Set it after each installer run, or in the tool that applies your manifests.

## Place B: the dataplane inside the kagent distribution

kagent installs its own distribution of Substrate, as [kagent 1.0 on Substrate](#s-kagent-on-substrate) shows. In that distribution agentgateway was the only dataplane that we saw. Our cluster ran agentgateway v1.7.0 in `atenet-router` and in `atenet-egress` {{run}}. The values that the kagent installer passes to the Substrate charts name no dataplane {{kagent}}. The charts themselves are not in the kagent repository, so we could not check them for an Envoy option.

One cost of this dataplane is specific to credentials. The gateway, agentgateway v1.7.0, keeps each fetched credential for 300 seconds. So a rotated Secret can take up to 5 minutes to reach requests {{agentgateway}}. With Envoy and the bundled provider, the next request gets the new value.

**We measured** this in place A, on a second x86 server guest (16 vCPU, 23 GB), with three changes of one Secret on each dataplane. On agentgateway the upstream saw the new value after 280.5, 200.9, and 100.6 s. On Envoy it took 1.0, 1.0, and 1.6 s. No request failed on either one. The code is the same in place B, so plan for the same 5 minutes there. [Credential injection](#s-credential-injection) has the run.

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

### What we ran

We ran the first two steps of this design, with a model gateway and no real model. The gateway was agentgateway v1.7.0 as a normal Deployment in its own namespace. Two mock backends with an OpenAI-compatible API stood for two providers, and each one logged what it received. The gateway served TLS with a certificate from a private CA that we made with `openssl`.

```listing
title: the configuration of the model gateway
source: capture/lab/Q-network/i-model-gateway/gw-tls.yaml
lang: yaml
note: The complete file. The two key variables hold test values that we made up.
---
config: {}
llm:
  port: 8443
  tls:
    cert: /tls/tls.crt
    key: /tls/tls.key
  models:
  - name: fast
    provider: openAI
    params:
      model: small-1
      hostOverride: mock-a.model-gw.svc.cluster.local:80
      apiKey: $KEY_A
  - name: smart
    provider: openAI
    params:
      model: big-1
      hostOverride: mock-b.model-gw.svc.cluster.local:80
      apiKey: $KEY_B
```

The actor had one `https` rule for the gateway host. The rule replaced the header `X-Lab` with the value of a Kubernetes Secret. The actor sent a placeholder in that header and in `Authorization`, and it asked for the model `fast`.

```listing
title: one request from the actor through egress to the model gateway
source: capture/lab/Q-network/i-model-gateway/20-results-agentgateway-private-ca-trusted.txt
lang: console
note: One request on the agentgateway dataplane, and the answer for a model name that the gateway does not know. The requests between them are cut. All values are test values that we made up.
---
$ curl -sS -m 15 --cacert /run/ate/egress-trust-bundle/trust-bundle.pem -w '\ncode=%{http_code} t=%{time_total} verify=%{ssl_verify_result}\n' -H 'content-type: application/json' -H 'Authorization: Bearer placeholder-from-actor' -H 'X-Lab: placeholder-from-actor' -d '{"model":"fast","messages":[{"role":"user","content":"hi"}]}' https://modelgw.model-gw.svc.cluster.local/v1/chat/completions
exit=0
{"model":"small-1","usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2},"choices":[{"message":{"content":"served_by=backend-a model=small-1 authorization=Bearer provider-key-for-backend-a x_lab=lab-gw-client-credential-1794488723","role":"assistant"},"index":0,"finish_reason":"stop"}],"id":"chatcmpl-lab","object":"chat.completion","created":1794488852}
code=200 t=0.744791 verify=0
…
{"error":{"message":"Model not found","type":"invalid_request_error","code":"model_not_found"}}
code=404
```

**We measured** this path on a second x86 server guest (16 vCPU, 23 GB), once on each dataplane. The backend `mock-a` received the model `small-1`, the provider key of the gateway, and the Secret value in `X-Lab`. With `"model":"smart"`, the backend `mock-b` received `big-1` and the second provider key. The placeholder of the actor reached no backend, in 0 log lines. A request for `"model":"other"` returned 404 with `model_not_found` from the model gateway.

So the model gateway selects the model, and the egress policy does not. Two keys are in the path, and the actor sends neither. Our mock backend printed both in its reply, so the actor read them there. A real backend must not return a credential.

The egress gateway injects the header that identifies the caller. The model gateway replaces `Authorization` with its own provider key. A credential for the model gateway itself must therefore travel in another header. Client authentication on the model gateway, with an Actor JWT, is planned for the next edition.

**The private CA failed at first.** With the default install, the request through the `https` rule returned 503 on both dataplanes. The egress gateway verifies the upstream certificate against the system roots of its own container, and it did not know our CA. [TLS interception](#s-tls-interception) has the two error texts and the patch that fixed it. The patch is lost when the installer runs again.

**We measured** the latency on the same guest (16 vCPU, 23 GB), as medians of n=30 or n=10. The request had 60 bytes, and the reply had about 250 bytes.

| Path | A new connection for each request | One reused connection |
|---|---|---|
| A plain pod to a mock backend, no egress | 4.2 to 4.4 ms | not measured |
| A plain pod through the TLS model gateway | 14.7 to 14.9 ms | not measured |
| The actor through egress to a mock backend, `http` rule | 22.8 to 27.5 ms | 9.2 ms on agentgateway, 4.4 ms on Envoy |
| The actor through egress, `https` rule, to the TLS model gateway | 618 and 690 ms on agentgateway, 614 ms on Envoy | 10.0 ms on agentgateway, 11.9 ms on Envoy |

The last row is the one to design for. Each new connection under an `https` rule cost about 0.6 s on both dataplanes. Almost all of it was the TLS handshake with the interception endpoint: 606 of 618 ms on agentgateway, and 600 of 614 ms on Envoy. On a reused connection the same request took 10 to 12 ms. An agent that opens a new HTTPS connection for each model call pays 0.6 s each time. Keep one client with a connection pool for the life of the actor.

A second cluster ran node tests on the same guest at the same time, so read a difference of a few milliseconds as noise. We have not found yet where the 0.6 s goes inside the handshake. That search, a real model host, a streamed reply, and an MCP gateway are planned for the next edition.

Three limits of the egress gateway apply to this design, and one section proves each:

- The gateway replaces a header only when the request already has that header. A request with no `authorization` header passed unchanged. [Credential injection](#s-credential-injection) has that run.
- A WebSocket upgrade returned 403, so the gateway behind egress must use plain HTTP requests or streamed HTTP responses. [EgressPolicy and default deny](#s-egresspolicy-and-default-deny) has that run.
- A removed rule does not close a response that is streaming or a pass-through connection. A reused HTTP connection is refused at its next request. [The dataplane choice](#s-the-dataplane-choice) has those runs.

```takeaways
- Find the place of agentgateway in your cluster before you promise a policy.
- Use the egress policy for hosts, ports, TLS mode, and one credential header.
- Deploy a second gateway behind one egress rule to select models and tools.
- Set `RUST_LOG=info` on `atenet-egress` before production, and again after each installer run.
- Reuse one HTTPS connection for model calls, because each new intercepted connection cost 0.6 s.
- Add your private CA to the root file of the egress container before you call a private gateway.
- Read section 6.6 before you change the dataplane of a running cluster.
```

Sources: capture/lab/G-dataplane/01-switch-in-place/11-timing.txt, capture/lab/G-dataplane/agentgateway/13-crictl-stats-atenet.txt, capture/lab/G-dataplane/envoy/13-crictl-stats-atenet.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt, capture/lab/G-dataplane/agentgateway/04-volumes-atenet-egress.json, capture/lab/G-dataplane/agentgateway/10-atenet-egress-agentgateway-substrate-config.yaml, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/agentgateway/50-custom-header.txt, capture/lab/F-egress/envoy/20-results.txt, capture/lab/K-kagent/inventory/images.tsv, capture/lab/K-kagent/inventory/deploy-atenet-egress.yaml, capture/lab/K-kagent/parallel/ingress-probe.txt, capture/lab/K-kagent/session1/egress-policy-actor.yaml, capture/lab/K-kagent/session1/mock.log, capture/lab/Q-network/i-model-gateway/gw-tls.yaml, capture/lab/Q-network/i-model-gateway/Pgw.yaml, capture/lab/Q-network/i-model-gateway/20-results-agentgateway-private-ca-trusted.txt, capture/lab/Q-network/i-model-gateway/20-results-envoy-private-ca-trusted.txt, capture/lab/Q-network/i-model-gateway/23-mock-a-received-agentgateway-private-ca-trusted.log, capture/lab/Q-network/i-model-gateway/24-marker-counts-agentgateway-private-ca-trusted.txt, capture/lab/Q-network/i-model-gateway/31-latency-agentgateway-private-ca-trusted.tsv, capture/lab/Q-network/i-model-gateway/31-latency-envoy-private-ca-trusted.tsv, capture/lab/Q-network/i-model-gateway/51-connection-cost-agentgateway.tsv, capture/lab/Q-network/i-model-gateway/51-connection-cost-envoy-private-ca-trusted.tsv, capture/lab/Q-network/j-log-level/10-volume.tsv, capture/lab/Q-network/00-dataplane-switch-to-agentgateway/17-after-rerun-rust-log-and-roots.json, capture/lab/Q-network/l-credential-rotation/agentgateway/20-rotations.tsv, capture/lab/Q-network/l-credential-rotation/envoy/20-rotations.tsv, capture/lab/summary/network-x86.json, capture/lab/summary/rotation-x86.json; Agent Substrate v1.0.0 source: cmd/atenet/internal/router/config.go, cmd/ate-setup/commands.md, manifests/ate-install/agentgateway; agentgateway v1.7.0 source: README.md, crates/agentgateway/src/http/substrate (README.md, egress.rs); kagent v1.0.0 Substrate distribution charts.
