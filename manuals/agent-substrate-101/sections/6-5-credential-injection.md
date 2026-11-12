# Credential injection

> The gateway replaces a placeholder header with a secret that the actor never holds, and an upstream that returns its request headers gives that secret back to the actor.

An agent needs an API key to call a model or a code host. The agent also runs code that a model wrote. Substrate can copy the memory and the files of its sandbox to an object store at each suspend. You do not want the key in that sandbox, in its environment, or in its snapshots.

When you finish this section, you can write a rule that injects a credential, and grant an atespace access to a Kubernetes Secret. You can also name the cases where the swap fails and the one case where the secret reaches the actor.

## The swap in one request

Credential injection is an effect on an `http` or `https` rule. The rule names a header and a secret. The actor sends that header with any value, and the gateway overwrites the value before the request leaves the cluster.

**Placeholder header:** the header that the actor sends with a value that is not a secret, such as `Authorization: placeholder-from-actor`. Its presence asks for the swap. Its value is thrown away.

This is the rule file from our test. It has three headers, so that one request can exercise each outcome.

```listing
title: one rule with three credential headers
source: capture/lab/F-egress/envoy/P4.yaml
lang: yaml
note: The complete rule file. Only the first header names a Secret that exists in a granted namespace.
---
rules:
- http:
    hostnames: ["whoami.egress-target.svc.cluster.local"]
    effects:
      replaceHeaders:
      - header: Authorization
        prefix: "Bearer "
        credentialUri: ate-secret://k8s.io/default/cred-ns/api-token/token
      - header: X-Other-Token
        credentialUri: ate-secret://k8s.io/default/cred-ns-not-granted/api-token/token
      - header: X-Missing-Token
        credentialUri: ate-secret://k8s.io/default/cred-ns/does-not-exist/token
```

Each entry has a `header`, an optional `prefix`, and one source: a `credentialUri`, or an `actorJwt` that [section 5.3](#s-actor-jwts) covers. A rule takes up to 16 entries {{code}}.

The upstream in our test prints each request that it receives. The actor sent the placeholder, and this is what arrived.

```listing
title: the request that the upstream received
source: capture/lab/F-egress/envoy/20-results.txt
lang: console
note: The command in the actor and the matching lines of the response. The upstream is a server that returns the request it received.
---
$ curl -sS -m 8 -i -H 'Authorization: placeholder-from-actor' http://whoami.egress-target.svc.cluster.local/ | grep -i -E 'HTTP/|authorization|x-forwarded|RemoteAddr|egress'
…
HTTP/1.1 200 OK
RemoteAddr: 10.244.0.22:36554
GET / HTTP/1.1
Host: whoami.egress-target.svc.cluster.local
Authorization: Bearer lab-granted-marker-1794480266
```

```figure
id: fig-6-5
kind: sequence
title: one request with a placeholder header
claim: The secret travels from the Kubernetes Secret to atenet-egress and on to the upstream, and it enters the actor only if the upstream sends it back.
caption: Read from top to bottom. Steps 2 and 3 happen for each request that carries the header. Step 6 is the leak that our test upstream produced. From capture/lab/F-egress/envoy/20-results.txt and capture/lab/F-egress/envoy/P4.yaml.
```

The environment of the actor held no secret. We listed it, and we searched `/run`, `/etc`, and `/tmp` for the value. Nothing matched. A secret that never enters the sandbox cannot be in a snapshot of it.

Our test used an `http` rule to a Service in the cluster. With `http`, the credential leaves the gateway in cleartext {{code}}. For a real API, put the effect on an `https` rule.

## The `ate-secret://` reference and the bundled provider

**Credential provider:** a gRPC service that turns a reference into a secret value. The gateway picks the provider from the host part of the reference and sends it the reference and the identity of the actor {{code}}. The provider decides if that actor gets that secret.

Substrate v1.0.0 installs one provider when you pass `--credential-provider='{"name":"k8s.io"}'`. It runs as the Deployment `k8s-credential-provider` in `ate-system`, and it reads Kubernetes Secrets. Its references have this form:

```text
ate-secret://k8s.io/default/<namespace>/<secret>/<key>
```

The provider reads the Secret for each call that it gets and keeps no copy {{code}}. How soon a rotated Secret takes effect depends on the dataplane, because the gateway decides how often it calls the provider.

| Dataplane | What the gateway does | A rotated Secret takes effect |
|---|---|---|
| Envoy | It calls the provider for each request that carries the header, and it keeps no copy {{code}}. | on the next request, or the one after it: 1.0 to 1.6 s in our run |
| agentgateway v1.7.0 | It keeps each fetched credential for 300 seconds, for one actor and one reference. `ate-setup` sets no other value {{agentgateway}}. | after the time that is left of those 300 seconds: 100.6 to 280.5 s in our run |

The agentgateway row covers every kagent install, because that distribution runs agentgateway. We read both rows in the code first, and then we measured them.

**We measured** three changes of one Secret on each dataplane, on a second x86 server guest (16 vCPU, 23 GB). One running actor had one `http` rule with the effect. It sent one request about each second to an echo service in the cluster. We recorded when that service first saw each new value.

**We measured** these lags in that run on the same guest (16 vCPU, 23 GB), with n=3 changes for each dataplane. On agentgateway the lag was 280.5, 200.9, and 100.6 s. In those times 233, 168, and 84 requests still carried the old value. On Envoy the lag was 1.0, 1.0, and 1.6 s, and one request in all carried an old value. No request failed on either dataplane, in 759 and 275 requests.

```listing
title: three changes of the Secret on agentgateway
source: capture/lab/Q-network/l-credential-rotation/agentgateway/20-rotations.tsv
lang: text
note: The complete table of the file. The first three columns are the change, the wait before it, and the time of the change. The fourth is the time the upstream first saw the new value. The last two are the lag in seconds and the requests that still carried the old value.
---
rotation	wait_before_s	secret_changed_epoch	first_seen_epoch	lag_s	old_values_after_change
1	5	1794493351.752	1794493632.272	280.5	233
2	100	1794493732.380	1794493933.328	200.9	168
3	200	1794494133.509	1794494234.122	100.6	84
```

```figure
id: fig-6-5b
kind: chart
title: seconds until the upstream saw a changed credential
claim: A changed Secret reached the upstream in 1.0 to 1.6 s on Envoy and in 100.6 to 280.5 s on agentgateway.
caption: Read each line left to right over the three changes. The time axis is logarithmic. The solid line is agentgateway, the dashed line is Envoy, and the rose line marks 300 s. From capture/lab/summary/rotation-x86.json.
```

The three lags on agentgateway are not random. The upstream first saw a new value at three moments that were 301 s apart. So the gateway fetched the credential again each time its copy was 300 s old. The lag after a change is the time left until that moment. It can be any value from 0 to about 300 s. On Envoy our probe sent one request each second, so we cannot state a lag below 1 s.

During a change the upstream saw the old value or the new one. It never saw an empty header, and it never saw the placeholder of the actor. That is why no request failed. It also means that a secret which you revoke stays in use on agentgateway for up to 5 minutes. Revoke the old value at the upstream when you must stop its use at once. When you rotate without an incident, keep the old value valid at the upstream for 5 minutes after the change.

We tested one Secret and one actor. We did not test whether a restart of `atenet-egress` forces a new fetch.

On Envoy, the cost is one call to the provider and one read of the Kubernetes API for each request that carries the header. On agentgateway, most requests make no call to the provider.

The provider starts with no access. A ConfigMap, `k8s-credential-provider-namespace-policy`, maps each atespace to the namespaces whose Secrets its actors can use. The install creates it empty.

```listing
title: the grant for one atespace
source: capture/lab/F-egress/envoy/provider-policy.yaml
lang: yaml
note: The content of the key namespace-policy.yaml in the ConfigMap.
---
policies:
- atespace: lab-f
  allowedNamespaces:
  - cred-ns
```

The provider reads this file once, when it starts {{docs}}. We restarted the Deployment after our edit, and the grant worked. The grant is wide: every actor in the atespace can name every Secret in the namespace. Keep one namespace that holds only the Secrets that agents are allowed to use.

The help text of the installer says that a provider requires the Envoy dataplane. In our run the installer accepted `k8s.io` with agentgateway, and injection gave the same result on both.

## When the swap does not happen

| The actor sends | The reference points to | Envoy dataplane | agentgateway dataplane |
|---|---|---|---|
| `Authorization` with a placeholder | a Secret in a granted namespace | `200`, upstream gets the secret | `200`, upstream gets the secret |
| `X-Other-Token` with a placeholder | a Secret in a namespace with no grant | `403`, `egress denied` | `403`, `actor egress policy denied` |
| `X-Missing-Token` with a placeholder | a Secret that does not exist | `403`, `egress denied` | `403`, `actor egress policy denied` |
| no credential header | any | `200`, request passes unchanged | `200`, request passes unchanged |

The two `403` cases return the same body on purpose. A caller cannot use the answer to learn which Secrets exist {{code}}. You cannot either, so check the grant and the Secret name by hand.

The last row needs care. The effect runs only when the header is present. Without the header, the gateway fetches nothing and forwards the request as it is. The host is still allowed, so the request arrives without a credential.

```listing
title: the same request without the header
source: capture/lab/F-egress/envoy/20-results.txt
lang: console
note: The command and the matching lines. No Authorization line came back, because none was sent upstream.
---
$ curl -sS -m 8 -i http://whoami.egress-target.svc.cluster.local/ | grep -i -E 'HTTP/|authorization'
…
HTTP/1.1 200 OK
GET / HTTP/1.1
```

In practice the symptom is a `401` from the API, not an error from the gateway. A tool that builds its own request, such as a plain `wget` in a shell, sends no placeholder and gets no credential. We saw this in the kagent run: a `wget` from the actor reached the model host with three headers and no `authorization`.

## The upstream that returns headers

Look again at the second listing of this section. The actor ran that `curl`, and the response body contained `Authorization: Bearer lab-granted-marker-1794480266`. Our test upstream returns each request to its sender, so the actor read the secret that it was never given.

The gateway cannot prevent this. It controls the request, not what the upstream does with it. The consequence is a rule for you: a credential is only as private as the hosts in its rule.

- Name the exact host that owns the credential. Never attach a credential to a rule with `*` in its hostnames.
- Do not attach a credential to a host that the actor can make return its headers, such as a debug endpoint or a request inspector.
- Give the agent a credential with the smallest scope that the API offers. Treat it as known to the agent.

The logs were clean in our run. The injected value appeared in no log line of the gateway or the provider, on either dataplane. The agentgateway egress pod runs with `RUST_LOG=debug` and prints the headers of each request. It printed `authorization` as `Sensitive`. For an injected `X-Api-Key`, it printed the placeholder that the actor sent and never the secret. A value that the actor itself sends in a custom header is logged in clear there.

## What kagent does with it

kagent uses this feature for model keys, so you get it without writing a rule. For each session, kagent writes a policy with one rule for the model host of the ModelConfig.

```listing
title: the model rule that kagent wrote
source: capture/lab/K-kagent/session1/egress-policy-actor.yaml
lang: yaml
note: The second of three rules in the policy of one session actor.
---
- http:
    effects:
      replaceHeaders:
      - credentialUri: ate-secret://k8s.io/default/kagent/kagent-openai/OPENAI_API_KEY
        header: authorization
        prefix: 'Bearer '
    hostnames:
    - mock-llm.kagent.svc.cluster.local
    ports:
      numbers:
      - 8080
```

kagent also sets `OPENAI_API_KEY=kagent-credential-injected` in the environment of the actor. The model client reads that variable and sends it as the `authorization` header, which is the placeholder. Our mock model server received `Bearer sk-mock-not-a-real-key`, a test value that we made up, on 10 of 10 calls.

We ran kagent against a mock model over HTTP in the cluster. We did not test a real model host over HTTPS. [Section 7.1](#s-kagent-on-substrate) has the rest of that policy.

```takeaways
- Put the credential effect on an `https` rule for any host outside the cluster.
- Grant each atespace one namespace, and keep only agent Secrets in it.
- Restart `k8s-credential-provider` after you edit the namespace grant.
- Keep a rotated secret valid for 5 more minutes at the upstream when the dataplane is agentgateway.
- Revoke a leaked secret at the upstream too, because agentgateway can send it for 5 more minutes.
- Make each client send the placeholder header, and read a `401` as a missing placeholder.
- Name exact hosts in a rule that carries a credential, never `*`.
- Assume that the agent can learn any credential whose upstream returns request headers.
```

Sources: capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/envoy/P4.yaml, capture/lab/F-egress/envoy/policy-f-main-P4-live.yaml, capture/lab/F-egress/envoy/provider-policy.yaml, capture/lab/F-egress/envoy/04-provider-policy-apply.log, capture/lab/F-egress/envoy/32-marker-in-logs.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/agentgateway/32-marker-in-logs.txt, capture/lab/F-egress/agentgateway/50-custom-header.txt, capture/lab/G-dataplane/agentgateway/03-containers-atenet-egress.tsv, capture/lab/K-kagent/session1/egress-policy-actor.yaml, capture/lab/K-kagent/session1/mock.log, capture/lab/K-kagent/session1/turn2.out, capture/lab/K-kagent/session1/actor-template.yaml, capture/lab/Q-network/l-credential-rotation/agentgateway/20-rotations.tsv, capture/lab/Q-network/l-credential-rotation/envoy/20-rotations.tsv, capture/lab/Q-network/l-credential-rotation/agentgateway/10-probe.tsv, capture/lab/Q-network/l-credential-rotation/envoy/10-probe.tsv, capture/lab/Q-network/l-credential-rotation/agentgateway/01-policy-live.yaml, capture/lab/summary/rotation-x86.json, api/ateapi/v1/ateapi.proto (HttpRuleEffects, CredentialHeader), cmd/atenet/internal/router/egress/credentials.go, cmd/credential-provider/kubernetes-secrets/kubeprovider.go, cmd/ate-setup/internal/steps/overlay.go, docs/guides/egress-credential-injection.md at v1.0.0; agentgateway v1.7.0 crates/agentgateway/src/http/substrate/egress.rs (the credential cache of 300 seconds).
