# Actor JWTs

> An actor does not store its own identity token: the egress gateway mints an actor JWT and puts it in a header that an egress rule names.

Your actor calls a service that you run, and the service must know which actor is calling. The usual answer is a secret inside the workload. An actor is a bad place for a secret, because its memory goes into every snapshot and any editor can copy it. Substrate gives the actor an identity that the actor does not store. The actor can still read the token when a service returns it.

When you finish this section, you can write the egress rule that attaches an actor JWT and list the claims in the token. You can also say what a service must check before it trusts one.

Our runs show two such rules at work. One is the rule that kagent writes for each session. The other is our own rule, which sent a token to a service that returns its request headers, so we could decode the token. The limits at the end come from the documentation at v1.0.0, and we say which of them we saw.

## The gateway asks, the actor does not

**Actor JWT:** a signed token, minted by `ate-api-server`, that names one actor and one or more audiences.

No API lets an actor request its own token. The token appears only on outbound requests, and only where an egress rule asks for it {{code}}.

```figure
id: fig-5-3
kind: sequence
title: how an actor JWT reaches the service that an actor calls
claim: The egress gateway mints the token and replaces a header with it, so the service receives an identity that the actor did not send.
caption: Read from the top down. Green is the actor, indigo is the egress gateway, blue is the control plane, plum is the kagent controller. The names and the numbers are from the policy of one kagent session. From capture/lab/K-kagent/session1/egress-policy-actor.yaml.
```

The steps are these:

1. The actor sends a plain request to a host that its egress policy allows.
2. The egress gateway finds the rule for that host and sees the effect `actorJwt`.
3. The gateway calls `MintActorJwt` on `ate-api-server`, with the audiences and the lifetime from the rule.
4. The gateway writes the token into the header that the rule names, and sends the request on.

Only the egress gateway is allowed to call `MintActorJwt`. A global owner is refused, as [access policies per atespace](#s-access-policies) explains.

## The rule that kagent writes

kagent needs this mechanism for its own traffic. Each session is an actor, and the harness in the actor reports to the kagent controller. This is the first rule of the egress policy that kagent wrote for one session in our run {{run}}.

```listing
title: an egress rule with an actor JWT
source: capture/lab/K-kagent/session1/egress-policy-actor.yaml
lang: yaml
note: The first of three rules. The metadata and the other two rules are cut.
---
rules:
- http:
    effects:
      replaceHeaders:
      - actorJwt:
          audiences:
          - kagent-runtime
          expirationSeconds: "300"
        header: authorization
        prefix: 'Bearer '
    hostnames:
    - kagent-controller.kagent.svc.cluster.local
    ports:
      numbers:
      - 8083
```

Read it from the bottom up. The rule matches plain HTTP to one host on port 8083. For a matching request, the gateway replaces the `authorization` header with `Bearer ` and a fresh token. The token is for the audience `kagent-runtime`, and it lives 300 seconds, the shortest lifetime that the API accepts.

The log of the egress gateway shows the result. The harness called the controller, the request carried an `authorization` header, and the controller answered 200.

```listing
title: one request that carried the token
source: capture/lab/K-kagent/session1/atenet-egress.excerpt.log
lang: text
note: One line, cut near its end. The agentgateway dataplane prints the value of the authorization header as Sensitive in its debug lines.
---
2026-11-12T10:19:50.777573Z	info	request request.id=64 gateway=default/default listener=listener1 route=default/route0 endpoint=kagent-controller.kagent.svc.cluster.local:8083 src.addr=10.244.0.23:59184 http.method=POST http.host=kagent-controller.kagent.svc.cluster.local http.path=/kagent.runtime.v1.TaskStoreService/SettleTask http.version=HTTP/2.0 http.status=200 grpc.status=0 protocol=http ate.actor.name=session-01a1cf43-d760-747a-b907-5e0640126e4e ate.actor.uid=d64e21f4-05eb-49a3-a81e-69ca2d893b06 ate.atespace=kagent …
```

This rule is on the `http` kind, so the token crossed the cluster network without TLS between the gateway and the controller. Use the `https` kind for any service outside your cluster. [Credential injection](#s-credential-injection) covers the other effect of `replaceHeaders`, which reads a secret.

## What the token says

We wrote a rule like the one of kagent for an actor named `jw2` in the atespace `lab-v`. The audience was `lab-echo`, the lifetime was 600 seconds, and the host was a service in the cluster that returns its request headers. The actor called that service, and we decoded the token that came back. The listing shows the header and the claims, and it leaves out the signature.

```listing
title: the header and the claims of one actor JWT
source: capture/lab/V-validation/09-actor-jwt/24-jwt-decoded.txt
lang: text
note: The request headers at the start of the file and the two lines after the claims are cut.
---
…
header: {
 "typ": "JWT",
 "alg": "ES256",
 "kid": "E38XLIprTZzZkY7RinXF7sPyw-HxHT-ysnVHFvvTCAU"
}
claims: {
 "iss": "https://idp.ate-system.svc",
 "sub": "actor/lab-v/jw2",
 "aud": [
  "lab-echo"
 ],
 "exp": 1794488570,
 "nbf": 1794487670,
 "iat": 1794487970,
 "jti": "VLZDMDBJ2UA3ME2Z5M62BADKQK",
 "actor.ate.dev": {
  "atespace": "lab-v",
  "actorName": "jw2",
  "actorUID": "93e670a4-3215-41e5-be33-4dffaca75d42"
 }
}
…
```

| Claim | Value | In our token |
|---|---|---|
| `iss` | the issuer URL of the install | `https://idp.ate-system.svc` |
| `sub` | `actor/<atespace>/<name>` | `actor/lab-v/jw2` |
| `aud` | the audiences from the rule, always an array | `["lab-echo"]` |
| `exp` | the issue time plus `expirationSeconds`, which must be 300 to 3600 {{code}} | `iat` plus 600 seconds |
| `nbf` | five minutes before `iat` | `iat` less 300 seconds |
| `iat` | the issue time | present |
| `jti` | a random id | present |
| `actor.ate.dev` | an object with `atespace`, `actorName` and `actorUID` | all three fields |

The header named the algorithm `ES256`. Its `kid` was equal to the one key in the key set that the issuer published. The code also allows `RS256` {{code}}.

We saw four more things in that run, once each, on the x86 server guest:

- **The gateway uses a token again.** Two requests in a row carried the same token, with the same `jti`. A request after a suspend and a resume of the actor carried it too. So `jti` is not a request id, and a suspend does not end a token.
- **The actor must send the header.** The effect replaces a header and does not add one. A request that the actor sent without an `authorization` header reached the service with none. Our other requests sent `Bearer placeholder`, and the gateway replaced it.
- **The actor can get the token.** The service returned its request headers, so the actor read its own token in the response. Send a token only to a service that does not return it.
- **One claim was absent.** The discovery document lists a claim named `worker-for-actor.ate.dev`. Our token did not have it.

Two details change how you use the token:

- **`sub` is a name.** An actor that you delete and create again with the same name gets the same `sub`. Bind to `actorUID` if the difference matters.
- **Substrate adds no audience.** The rule decides `aud`, and the person who writes the rule also decides which host receives the token.

Create the policy before the actor asks for the name. In our first try, the actor asked for the host before any policy existed. We created the policy, and 4.5 seconds later the name still did not resolve. In the second try the policy came first, and the name resolved at once. [The DNS relay](#s-the-dns-relay) describes one more slow update like this one.

## What the service must check

A service that receives the token is a relying party in OpenID Connect terms. `ate-idp-server` publishes the discovery document at `/.well-known/openid-configuration` under the issuer, and the keys at `/openid/v1/jwks`. Our kagent install set the issuer to `https://idp.ate-system.svc` {{run}}.

The service must do five checks {{docs}}:

1. `iss` equals the issuer that you configured.
2. The signature verifies with the key from the key set that has the `kid` of the token.
3. `aud` contains the audience that the service expects.
4. `exp` and `nbf` fit the current time.
5. `sub` starts with `actor/`.

Do not skip the last check. The same keys sign a second kind of token, with a `sub` that starts with `worker-for-actor/`. Substrate components use that kind to move snapshots. A service that accepts it treats a worker as the actor.

The default issuer is a Service name, so only a verifier inside the cluster can reach it. For a verifier outside, you must publish the two paths on a host that you own and set the issuer to that host. The installer does not create the Ingress, the DNS record, or the certificate.

## Limits

The documentation lists these limits {{docs}}. We saw the second one in our run, and we tested none of the others:

- **No revocation.** A token is valid until `exp`, also after you delete the actor. Keep the lifetime at 300 seconds unless a service needs more.
- **It is a bearer token.** A service that returns its request headers in the response gives the token to the actor. Our header service did that, and we saw the same effect with an injected credential in our egress tests.
- **A new actor with an old name.** After you create an actor again, the gateway can send a token with the `actorUID` of the old one. The window is up to two thirds of the token lifetime (issue 2208) {{issue #2208}}.
- **No exchange for cloud credentials.** Cloud token services want the JWT in the request body, and the gateway replaces only headers (issue 1661) {{issue #1661}}.
- **Key rotation is manual.** Keys do not expire. You add, activate and remove keys with `kubectl ate admin`.

Three checks come in the next edition. One checks the signature with the published key, as a service must. One rotates a key. One sets up federation with a second issuer or a cloud provider.

## Our position

Use the actor JWT for calls from an actor to services that you control. It removes a secret from the actor, and the 300 second lifetime bounds the damage of a leak. Do not treat the audience as the whole access decision. Every atespace editor can write a rule that sends a token with any audience to any host. So give each service its own audience, and make each service refuse every other one. Each service must also decide which actors in `sub` it serves.

```takeaways
- Attach an actor JWT with an actorJwt effect under replaceHeaders in an egress rule.
- Keep expirationSeconds at 300 unless a service needs a longer token.
- Check iss, signature, aud, exp, nbf, and that sub starts with actor/.
- Bind to actorUID in actor.ate.dev when a name can be used again.
- Use one audience for each service, and refuse tokens for other audiences.
```

Sources: capture/lab/K-kagent/session1/egress-policy-actor.yaml, capture/lab/K-kagent/session1/atenet-egress.excerpt.log, capture/lab/K-kagent/inventory/kagent-configmaps.yaml, capture/lab/F-egress/envoy/20-results.txt, capture/lab/V-validation/09-actor-jwt/24-jwt-decoded.txt, capture/lab/V-validation/09-actor-jwt/20-jwt-second-try.tsv, capture/lab/V-validation/09-actor-jwt/10-jwt.tsv, capture/lab/V-validation/09-actor-jwt/12-policy-live.yaml, capture/lab/V-validation/09-actor-jwt/15-openid-configuration.json, capture/lab/V-validation/09-actor-jwt/16-jwks-key-ids.json; cmd/ateapi/internal/controlapi/actor.go (MintActorJwt), internal/actoridjwt/actoridjwt.go, api/ateapi/v1/ateapi.proto (ActorJwtSource, MintActorJwtRequest), cmd/atenet/internal/router/egress/actorjwt/actorjwt.go, cmd/ate-idp-server/internal/server/server.go at v1.0.0; docs/guides/actor-jwts.md, docs/guides/actor-jwt-federation.md, docs/guides/actor-jwt-key-rotation.md, docs/guides/authorization.md at v1.0.0; issues https://github.com/agent-substrate/substrate/issues/2208 and https://github.com/agent-substrate/substrate/issues/1661.
