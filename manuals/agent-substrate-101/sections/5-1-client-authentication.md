# Client authentication

> Substrate checks a credential at two places, the API and the router, and the default install gives every `kubectl ate` user one shared owner identity.

A colleague gets access to your test cluster and runs `kubectl ate get actors`. The command prints a warning, then lists every actor of every team. The colleague can also suspend, revert and delete them. Nothing is broken. The install works this way until you change it.

When you finish this section, you can name the credential that each kind of client needs. You can also say what the default install lets every user do.

This section mixes two kinds of evidence. A sentence marked as seen in our runs comes from a recorded probe, and so does every listing. The other statements come from the code and the documentation at v1.0.0.

## Two places check a client

| Place | Who calls it | Credential | What decides access |
|---|---|---|---|
| `ate-api-server`, the API | `kubectl ate`, a harness, your controller | a client certificate, or a bearer JWT | access policies, in [section 5.2](#s-access-policies) |
| `atenet-router`, the path to an actor | whatever sends requests to actors | a client certificate | one list of allowed identities for the whole install |

The two places share no rule. A principal can own an atespace in the API and still be unable to call an actor. The router serves it only if its certificate is on the list of the router.

## The API: a certificate or a token

**Principal:** the identity that `ate-api-server` derives from a credential, and the name that access policies grant roles to.

`ate-api-server` accepts two credentials, in this order {{docs}}:

1. **A client certificate** from the pod identity signer of the cluster. The principal is the SPIFFE ID in the certificate, such as `spiffe://cluster.local/ns/kagent/sa/kagent-controller`.
2. **A bearer JWT** from an issuer that the server trusts. The principal is the `sub` claim. For a Kubernetes ServiceAccount token that is `system:serviceaccount:<namespace>:<name>`.

A call with neither gets the gRPC error `Unauthenticated`. The install trusts one issuer, the Kubernetes API server of the cluster, for tokens with the audience `api.ate-system.svc`. The list of issuers is a ConfigMap that the server reads only at startup.

## What the default install does

Every `kubectl ate` command in our runs began with the same line.

```listing
title: the first line of every kubectl ate command
source: capture/lab/A-quickstart/50-create-actor.log
lang: text
---
Warning: no --token-file given; acting as the shared identity system:serviceaccount:ate-system:ate-client rather than as yourself. Pass --token-file to act as yourself.
```

Without `--token-file`, the CLI asks Kubernetes for a token of the ServiceAccount `ate-client` and sends that. Every person who uses the CLI this way is the same principal. The installer told us what that principal can do.

```listing
title: the warning that ate-setup prints
source: capture/lab/A-quickstart/22-deploy-ate-system-retry.log
lang: text
---
Warning: system:serviceaccount:ate-system:ate-client is a bootstrap owner, so anyone who can mint a token for it is a global owner of this install. It is the default so the demos, benchmarks and e2e tests work; for a shared or production install, set --ateapi-authz-bootstrap-owners (ATE_API_AUTHZ_BOOTSTRAP_OWNERS) to your operators' own principals. See docs/authorization.md.
```

So the true access rule of a default install is a Kubernetes rule. Whoever can create a token for `ate-client`, or create a pod in `ate-system`, owns every actor.

To act as yourself, create a ServiceAccount for each person and pass its token {{docs}}. We ran these commands for a ServiceAccount named `alice`, against the atespace `lab-v`.

```bash
kubectl create namespace ate-users
kubectl -n ate-users create serviceaccount alice
kubectl create token alice -n ate-users --audience api.ate-system.svc --duration 1h > alice.token
kubectl ate --token-file alice.token get actors -a lab-v
```

The principal is then `system:serviceaccount:ate-users:alice`. It can do nothing until an access policy grants it a role. The server accepted the token and refused the call.

```listing
title: a valid token with no role
source: capture/lab/V-validation/08-access-control/10-access.tsv
lang: text
note: One line of the trace. The time and the step name at the start of the line are cut.
---
…Error: failed to list actors: rpc error: code = PermissionDenied desc = permission denied: principal "user:system%3Aserviceaccount%3Aate-users%3Aalice" lacks "can_list_actors" on "atespace:lab-v" 
```

`PermissionDenied` means that the server knows who you are. A credential that it cannot verify gets a different error, and the error does not say why.

| What `--token-file` held | Result of `get actors` |
|---|---|
| a token for `alice` with the audience `api.ate-system.svc`, and no role | `PermissionDenied`, with the principal and the missing permission |
| a token for `alice` with the default audience of Kubernetes | `Unauthenticated desc = invalid bearer token` |
| a text that is not a token | `Unauthenticated desc = invalid bearer token` |

We ran each row once on the x86 server guest. The second row is the mistake to expect: `kubectl create token` without `--audience` gives a token that Substrate rejects. [Access policies](#s-access-policies) continues with the same ServiceAccount.

Three facts from the documentation limit how far you can trust this setup:

- **A token outlives its ServiceAccount.** The server checks the signature and the expiry, and it does not ask Kubernetes if the account still exists. To stop a person at once, remove the person from the access policies.
- **The CLI needs port-forward rights.** Without `--endpoint`, `kubectl ate` opens a port-forward into `ate-system`. In practice that right covers every pod and port in the namespace, so it also reaches the admin ports of the dataplane.
- **Issuers are not part of the principal.** If you trust two issuers, either one can issue a token with the `sub` of a principal from the other.

A network rule stands before all of this. In our kagent run, a pod in the namespace `default` could not open a connection to the API at all. The same probe from the namespace `kagent` reached the server {{run}}. The install admits only namespaces with the label `ate.dev/api-access=true` {{docs}}.

## The router: a certificate on one list

A request to an actor does not go to the API. It goes to `atenet-router`, and the router demands a client certificate whose SPIFFE ID is on its list. The list is the router flag `--ingress-allowed-spiffe-ids`. In our installs it held one identity, `spiffe://cluster.local/ns/ate-system/sa/atenet-client`.

We sent the same request from three clients, on the Envoy dataplane and then on the agentgateway dataplane. The target was the actor `my-counter-1` in the atespace `ate-demo-counter`. The figure sets the two checks side by side, with the results of the Envoy dataplane.

```figure
id: fig-5-1
kind: flow
title: the two places that check a client
claim: The API and the router check a client separately: the shared ate-client token owns every actor, and the router serves any identity on its one list.
caption: Read each band from left to right. Olive is the client, blue is the API, and indigo is the router. Green is what the client reaches, and rose is a refused connection. The refusals are those of the Envoy dataplane. From capture/lab/A-quickstart/22-deploy-ate-system-retry.log, capture/lab/G-dataplane/envoy/ingress-auth/10-results.txt, and capture/lab/G-dataplane/envoy/ingress-auth/51-rightid-results.txt.
```

```listing
title: Envoy, a certificate with the wrong identity
source: capture/lab/G-dataplane/envoy/ingress-auth/10-results.txt
lang: text
note: Two lines from the probe on port 443. The certificate named spiffe://cluster.local/ns/probe/sa/default.
---
* TLSv1.3 (IN), TLS alert, certificate unknown (558):
curl: (56) OpenSSL SSL_read: OpenSSL/3.3.2: error:0A000416:SSL routines::ssl/tls alert certificate unknown, errno 0
```

```listing
title: agentgateway, no certificate
source: capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt
lang: text
note: One line from the probe on port 443.
---
curl: (56) OpenSSL SSL_read: OpenSSL/3.3.2: error:0A00045C:SSL routines::tlsv13 alert certificate required, errno 0
```

```listing
title: the allowed identity on agentgateway
source: capture/lab/G-dataplane/agentgateway/ingress-auth/51-rightid-results.txt
lang: text
note: The first line is the certificate that the client presented.
---
cert right-id: subject=CN = HBCORTIJRCAXAVJEJY3YTOYS3X X509v3 Subject Alternative Name:      URI:spiffe://cluster.local/ns/ate-system/sa/atenet-client
### 23-rightid-https-443
preserved memory count: 7 | preserved file counter: 7 | preserved rootfs counter: 7
 code=200 t=0.035022
```

Three results from these probes matter to you {{run}}:

- **Both dataplanes authenticate.** The router Service of the agentgateway dataplane lists the plain ports 80 and 8081. Nothing listened on them, and both TLS ports demanded a certificate.
- **The allowed ServiceAccount does not exist.** After the install, `ate-system` had no ServiceAccount named `atenet-client`. We created it before the third probe. `kubectl ate proxy` gets a certificate for that identity by another path, which [the router and ingress](#s-the-router-and-ingress) describes.
- **The list has no atespaces.** The one allowed identity reached an actor in an atespace that it has no role in. A user reported the same as issue 3589 {{issue #3589}}.

The last result decides your design. The router answers one question: is this client on the list. It does not ask which actor the client is allowed to call. Put your own service between your users and the router, give only that service an allowed identity, and check each user there.

We did not test a second token issuer, a token of a deleted ServiceAccount, or a list with more than one identity.

```takeaways
- Treat a default install as open to everyone who can create a token for ate-client.
- Give each person a ServiceAccount and pass its token with --token-file.
- Create the token with --audience api.ate-system.svc, or the server rejects it.
- Remove a person from access policies to stop them, because tokens stay valid.
- Give a router identity only to your own service, and check users there.
- Label a namespace with ate.dev/api-access=true before its pods call the API.
```

Sources: capture/lab/A-quickstart/50-create-actor.log, capture/lab/A-quickstart/22-deploy-ate-system-retry.log, capture/lab/G-dataplane/envoy/ingress-auth/10-results.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/10-results.txt, capture/lab/G-dataplane/envoy/ingress-auth/00-serviceaccounts.txt, capture/lab/G-dataplane/envoy/ingress-auth/50-create-sa.log, capture/lab/G-dataplane/envoy/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/agentgateway/ingress-auth/51-rightid-results.txt, capture/lab/G-dataplane/02-agentgateway-without-ingress-allowlist/14-probe-no-allowlist.txt, capture/lab/I-capacity/17-router-args.txt, capture/lab/K-kagent/parallel/ingress-probe.txt, capture/lab/V-validation/08-access-control/10-access.tsv, capture/lab/V-validation/_scripts/v4-items-5-12.sh; docs/guides/authentication.md, docs/guides/authorization.md at v1.0.0; internal/ateclient/builder.go, cmd/kubectl-ate/internal/cmd/root.go, manifests/ate-install/ate-system-networkpolicies.yaml, manifests/ate-install/atenet-router.yaml at v1.0.0; issue https://github.com/agent-substrate/substrate/issues/3589.
