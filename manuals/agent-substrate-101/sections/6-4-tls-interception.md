# TLS interception and the trust bundle

> An `https` rule makes the gateway end the TLS session with a certificate that it mints, so the actor must trust the projected bundle, and `tlsPassthrough` leaves TLS intact.

Your agent calls an API over HTTPS, and the policy allows the host. The call fails with a certificate error that you cannot reproduce from your laptop. The host is fine. The actor talked to `atenet-egress`, which answered with a certificate from a private CA, and the client in the actor does not trust that CA.

When you finish this section, you can choose between an `https` rule and a `tlsPassthrough` rule for a host. You can also give an actor the trust bundle, and say where the CA private key lives on each dataplane.

## Two rule kinds, two certificates

Both rule kinds allow TLS to a host. They differ in who holds the session.

With an `https` rule, the gateway ends the TLS session of the actor. It presents a certificate that it created for the requested name, reads each request, and applies the policy to each one. Then it opens its own TLS session to the real host and verifies that host against public roots {{code}}.

With a `tlsPassthrough` rule, the gateway reads only the server name in the handshake. If a rule lists that name and port, the gateway forwards the bytes and never decrypts them {{code}}.

We allowed `example.com` with `https` and `example.org` with `tlsPassthrough`, and we printed the certificate that the actor received from each.

```listing
title: the certificate for an https rule, Envoy dataplane
source: capture/lab/F-egress/envoy/20-results.txt
lang: text
note: Output of openssl in the actor for example.com. The issuer is the interception CA of the cluster.
---
issuer=CN=U7ICLCR3N66DBMBSAQNS5JHTHI
subject=
notBefore=Nov 12 10:48:04 2026 GMT
notAfter=Nov 12 11:08:04 2026 GMT
X509v3 Subject Alternative Name: critical
DNS:example.com
```

```listing
title: the certificate for a tlsPassthrough rule
source: capture/lab/F-egress/envoy/20-results.txt
lang: text
note: Output of openssl in the actor for example.org. This is the public certificate of the site.
---
issuer=C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
subject=CN=example.org
notBefore=Sep 26 22:05:05 2026 GMT
notAfter=Dec 25 22:13:27 2026 GMT
```

```figure
id: fig-6-4
kind: comparison
title: who holds the TLS session
claim: With an https rule the actor holds a session with atenet-egress, and with a tlsPassthrough rule it holds a session with the real host.
caption: Read each column from the actor down to the host. The issuer names are the ones that openssl printed in the actor. From capture/lab/F-egress/envoy/20-results.txt and capture/lab/F-egress/agentgateway/40-supplement.txt.
```

| Question | `https` rule | `tlsPassthrough` rule |
|---|---|---|
| Certificate that the actor sees | minted by the gateway | the real certificate of the host |
| Trust that the actor needs | the projected bundle | its normal root store |
| When the policy is checked | for each request | once, at the handshake |
| Credential injection | yes | no |
| Gateway can read the request | yes, headers and body | no |
| A client that pins the server certificate | fails | works |

Our rule: use `https` for every host that needs a credential, and for every host where you want a decision for each request. Use `tlsPassthrough` for a client that pins certificates or brings its own client certificate. Know what you give up with it. The gateway decides once, and the connection then carries whatever the actor sends.

## Give the actor the trust bundle

Without the bundle, a client in the actor rejects the minted certificate. With the bundle, the same request works.

```listing
title: one https host with the default store and with the bundle, Envoy dataplane
source: capture/lab/F-egress/envoy/40-supplement.txt
lang: console
note: Two curl commands in the actor and their results. The help text that curl prints after the error is cut.
---
$ curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result}\n' https://example.com/
exit=60
code=000 verify=20
…
stderr: curl: (60) SSL certificate problem: unable to get local issuer certificate
…
$ curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result} http=%{http_version}\n' --cacert /run/ate/egress-trust-bundle/trust-bundle.pem https://example.com/
exit=0
code=200 verify=0 http=2
```

**Trust bundle:** a file that Substrate projects into the actor, with the interception CA of the cluster and a set of public roots. You ask for it in the ActorTemplate with a `systemInfo` volume.

```listing
title: the volume that projects the bundle
source: capture/lab/F-egress/envoy/shell-template.yaml
lang: yaml
note: The volumes block of the ActorTemplate that our test actors used. The container mounts system-info at /run/ate.
---
volumes:
- name: system-info
  systemInfo:
    dataSources:
    - trustBundle:
        names:
        - egress-mitm.ate.dev
        - system-roots.ate.dev
        path: egress-trust-bundle/trust-bundle.pem
```

The first name is the interception CA. The second is the set of public roots, so one file serves intercepted hosts and pass-through hosts. Our bundle held 149 certificates in 222,672 bytes.

Most clients do not read that path on their own. Setting `SSL_CERT_FILE` to the path was enough for curl in our run. Other runtimes read other variables, such as `REQUESTS_CA_BUNDLE` for Python requests and `NODE_EXTRA_CA_CERTS` for Node.js {{docs}}. Set them in the `env` of the template, not in the agent prompt.

Do not copy the bundle into the container image. The CA can rotate, and the projected file follows the rotation. A copy in an image does not {{docs}}.

## The leaf certificate differs between the dataplanes

Both dataplanes sign with the same CA. The certificates that they mint do not look alike.

| Field of the minted certificate | Envoy dataplane | agentgateway dataplane |
|---|---|---|
| Subject | empty | `CN=example.com` |
| Subject alternative name | `DNS:example.com`, marked critical | `DNS:example.com` |
| Valid from | 5 minutes before the request | 1 January 1975 |
| Valid until | 20 minutes after the start | 1 January 4096 |
| Chain that the gateway sends | the leaf only | the leaf and the CA |
| curl error without the bundle | `unable to get local issuer certificate` | `self-signed certificate in certificate chain` |

On Envoy a separate process mints each leaf with the flag `--leaf-cert-ttl=15m`, and it dates the start 5 minutes into the past. On agentgateway the leaf is valid for 2,121 years.

For the client, both work. For you, the difference changes two things. First, the error text for a missing bundle differs, so search for both strings when you debug. Second, do not write a test that asserts a field of the leaf. A switch of dataplane changes every row of that table.

We prefer the short lifetime of the Envoy leaf. A leaf that stays valid for centuries makes the CA the only control. If the CA key is exposed, a rotation of the CA is the single way to stop a forged certificate.

## Where the CA private key lives

The interception CA is the Secret `egress-mitm-ca-pool` in the namespace `ate-system`. Whoever holds its private key can present a trusted certificate for any host to every actor that trusts the bundle. So the place where that key is mounted matters more than any field of the leaf.

On the Envoy dataplane, the pod `atenet-egress` has three containers. The key is mounted into one of them, `sdsmint`, which serves a Unix socket and no network port. Envoy asks it for certificates over a Unix socket. The process that parses traffic from actors never holds the key.

```listing
title: the container that holds the key, Envoy dataplane
source: capture/lab/G-dataplane/envoy/03-containers-atenet-egress.tsv
lang: text
note: The command of the sdsmint container. The image and the other columns are cut.
---
sdsmint --uds-path=/var/run/sdsmint/sdsmint.sock --ca-pool-path=/run/ca-state/mitm-pool.json --leaf-cert-ttl=15m --log-level=info …
```

On the agentgateway dataplane, the pod has one container, and that container mounts the key.

```listing
title: the key in the agentgateway configuration
source: capture/lab/G-dataplane/agentgateway/10-atenet-egress-agentgateway-substrate-config.yaml
lang: yaml
note: Four lines from the listener that intercepts TLS. The volume egress-mitm comes from the Secret egress-mitm-ca-pool.
---
tls:
  mode: dynamicCa
  cert: /run/egress-mitm/tls.crt
  key: /run/egress-mitm/tls.key
```

The same process accepts connections from every actor, parses their requests, and holds the signing key. In our install that container also had no `securityContext`. The `envoy` container drops all capabilities and runs as a user other than root.

We do not know of an attack that reads the key through agentgateway. Our point is about the size of the loss if one appears. On Envoy a memory disclosure bug in the proxy exposes traffic. On agentgateway the same class of bug exposes the CA. On either dataplane, limit who can read Secrets in `ate-system`, because the Secret is the same.

## Which upstream certificates the gateway trusts

Interception has a second TLS connection, from the gateway to the real host. The actor trusts the gateway through the bundle. The gateway must trust the host by itself. On both dataplanes it reads the roots from one file in its own container, `/etc/ssl/certs/ca-certificates.crt`. The agentgateway configuration names that file as `backendTLS.root`, and the Envoy configuration names it as `trusted_ca`. Substrate v1.0.0 has no flag and no documented setting for one more upstream CA.

So a host with a certificate from a private CA fails under an `https` rule. We ran a gateway in the cluster with such a certificate, and an actor called it through an `https` rule.

**We measured** this once on each dataplane, on a second x86 server guest (16 vCPU, 23 GB), with 30 requests each. With the default install, 0 of 30 requests succeeded on either one. On agentgateway the actor got 503 with the body `upstream connection failed`, and the gateway logged `invalid peer certificate: UnknownIssuer`. On Envoy the actor got 503 with `upstream connect error or disconnect/reset before headers. reset reason: remote connection failure`. The Envoy log had `CERTIFICATE_VERIFY_FAILED`.

The fix that worked is a mount over the root file. We put the public roots and our CA in one ConfigMap, 122 certificates in all, and mounted it in the proxy container of `atenet-egress`.

```listing
title: the patch that adds a private CA to the egress gateway
source: capture/lab/Q-network/i-model-gateway/43-trust-patch.json
lang: json
note: The complete JSON patch for the Deployment atenet-egress. Container 0 is the proxy container on both dataplanes.
---
[
  {"op": "add", "path": "/spec/template/spec/volumes/-", "value": {"name": "extra-roots", "configMap": {"name": "egress-extra-roots"}}},
  {"op": "add", "path": "/spec/template/spec/containers/0/volumeMounts/-", "value": {"name": "extra-roots", "mountPath": "/etc/ssl/certs/ca-certificates.crt", "subPath": "ca-certificates.crt"}}
]
```

With the patch, the same requests returned 200 on both dataplanes, 30 of 30. The patch is outside the installer, and it does not last. After a later `ate-setup deploy ate-system` run, the proxy container had no such mount. Apply the patch again after each installer run, and test one request to the private host each time.

The actor never sees the private CA. It sees a leaf for the host name that the interception CA minted, and it verifies that leaf with the projected bundle.

## What a new intercepted connection costs

**We measured** the same private host on the same guest (16 vCPU, 23 GB), with a request of 60 bytes. With a new connection for each request, the median was 618 ms on agentgateway and 614 ms on Envoy, with n=10 each. The TLS handshake with the interception endpoint took 606 and 600 ms of that. On one reused connection, the median was 10.0 and 11.9 ms, with n=30 each. An `http` rule to a host in the cluster cost 23 to 28 ms for a new connection.

So interception is cheap for each request and costly for each connection, about 0.6 s on both dataplanes. A client that opens one HTTPS connection for each call pays it each time. Keep connections open, or use a client with a pool. We did not find which step inside the handshake takes the time. [agentgateway with Substrate](#s-agentgateway) has the full table.

```takeaways
- Use an `https` rule for a host that needs a credential or a check for each request.
- Use a `tlsPassthrough` rule for a client that pins certificates, and accept one check for each connection.
- Add the `systemInfo` trust bundle volume to each ActorTemplate that has an `https` rule.
- Set `SSL_CERT_FILE` and the variable of your runtime to the bundle path in the template.
- Never copy the bundle into an image.
- Count the location of the CA key when you choose a dataplane.
- Mount your private CA into the root file of `atenet-egress`, and again after each installer run.
- Reuse HTTPS connections under an `https` rule, because each new one cost about 0.6 s.
```

Sources: capture/lab/F-egress/envoy/20-results.txt, capture/lab/F-egress/envoy/40-supplement.txt, capture/lab/F-egress/agentgateway/20-results.txt, capture/lab/F-egress/agentgateway/40-supplement.txt, capture/lab/F-egress/envoy/shell-template.yaml, capture/lab/F-egress/envoy/05-template.yaml, capture/lab/G-dataplane/envoy/03-containers-atenet-egress.tsv, capture/lab/G-dataplane/envoy/04-volumes-atenet-egress.json, capture/lab/G-dataplane/envoy/05-sec-res-atenet-egress.json, capture/lab/G-dataplane/agentgateway/03-containers-atenet-egress.tsv, capture/lab/G-dataplane/agentgateway/04-volumes-atenet-egress.json, capture/lab/G-dataplane/agentgateway/05-sec-res-atenet-egress.json, capture/lab/G-dataplane/agentgateway/10-atenet-egress-agentgateway-substrate-config.yaml, capture/lab/G-dataplane/envoy/10-atenet-egress.yaml, capture/lab/Q-network/i-model-gateway/40-egress-agentgateway-config.yaml, capture/lab/Q-network/i-model-gateway/41-egress-503-line.log, capture/lab/Q-network/i-model-gateway/44-envoy-egress-503.excerpt.log, capture/lab/Q-network/i-model-gateway/20-results-agentgateway.txt, capture/lab/Q-network/i-model-gateway/20-results-envoy.txt, capture/lab/Q-network/i-model-gateway/31-latency-agentgateway.tsv, capture/lab/Q-network/i-model-gateway/31-latency-envoy.tsv, capture/lab/Q-network/i-model-gateway/43-trust-patch.json, capture/lab/Q-network/i-model-gateway/43-trust-patch.log, capture/lab/Q-network/i-model-gateway/45-trust-patch-envoy.log, capture/lab/Q-network/i-model-gateway/31-latency-agentgateway-private-ca-trusted.tsv, capture/lab/Q-network/i-model-gateway/31-latency-envoy-private-ca-trusted.tsv, capture/lab/Q-network/i-model-gateway/51-connection-cost-agentgateway.tsv, capture/lab/Q-network/i-model-gateway/51-connection-cost-envoy-private-ca-trusted.tsv, capture/lab/Q-network/00-dataplane-switch-to-agentgateway/17-after-rerun-rust-log-and-roots.json, capture/lab/Q-network/00-dataplane-switch-to-envoy/15-egress-mounts-after-switch.json, capture/lab/summary/network-x86.json, manifests/ate-install/atenet-egress.yaml, manifests/ate-install/components/agentgateway-egress/kustomization.yaml, api/ateapi/v1/ateapi.proto, docs/guides/egress-trust-bundle.md and docs/guides/network-egress.md at v1.0.0.
