# Extended cards and signatures

> `GetExtendedAgentCard` returns a fuller card to an authenticated caller, and `signatures` lets any caller check that a card is the one its publisher signed.

The planner holds a bearer token and reads the public card of `deployer`. That card carries a signature, and its `extendedAgentCard` flag says that an authenticated caller sees more.

When you finish this section, you can fetch an extended card, and sign and verify a card as the spec prescribes.

## GetExtendedAgentCard

**Extended card:** the fuller card an agent returns to an authenticated caller through `GetExtendedAgentCard`, with "additional details or skills not present in the public card" {{spec §3.1.11}}.

The call needs credentials: "The client MUST authenticate the request using one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields." {{spec §3.1.11}} That rule still names `security`, which 1.0 replaced with `securityRequirements` {{proto AgentCard}} ([conflict D6](#s-ref-sources)). [PR #2046](https://github.com/a2aproject/A2A/pull/2046) fixed the §8.5 sample on main, and the §3.1.11 prose still says `security`.

Appendix A.2.2 calls the 0.3 flag `supportsExtendedAgentCard`, and the migration guide says `supportsAuthenticatedExtendedCard` {{spec §A.2.2}} {{docs whats-new-v1}} ([conflict D40](#s-ref-sources)). It gives the new flag field 5, and the proto uses 4 {{spec §1.4}} {{proto AgentCapabilities}} ([conflict D7](#s-ref-sources)).

[Figure](#fig-extended-card) shows `deployer` refusing the call without a token, then returning the public card plus a second skill, without `signatures`.

```figure
id: fig-extended-card
kind: sequence
title: earning the extended card
claim: The same `GetExtendedAgentCard` call fails with HTTP 401 before any A2A method runs, then returns a card with a second skill once a token is attached.
caption: Time runs down. Steps 1 and 2 come from capture/out/01-agent-cards.http. Steps 3 and 4 are exchange 1 of capture/out/18-extended-card.http, and steps 6 and 7 are exchange 2. The token comes from the platform team, outside A2A.
```

```listing
title: GetExtendedAgentCard with a token, and the skill it adds
source: capture/out/18-extended-card.http
lang: http
note: Exchange 2, cut to the token and the second skill. The rest of the card equals the public card, without its signatures.
---
### 2 · GetExtendedAgentCard: with a token
…
Authorization: Bearer dpl_test_7c1e4b
…
HTTP/1.1 200 OK
…
      {
        "id": "rollback",
        "name": "Roll back a deploy",
        "description": "Return staging to the previous build. Shown only to authenticated callers.",
        "tags": [
          "deploy",
          "rollback"
        ]
      }
```

A client SHOULD replace its cached public card with the extended one "for the duration of their authenticated session or until the card's version changes" {{spec §3.1.11}}. Such cards "SHOULD NOT include sensitive information that could be exploited if leaked" {{spec §13.3}}. A declared flag with no card behind it answers `ExtendedAgentCardNotConfiguredError`, `-32007` {{spec §3.3.4}} {{spec §5.4}}.

The official SDKs leave the credential check to the host, and the table says who receives the card when the host adds nothing.

| SDK | Who receives the extended card without a host check |
|---|---|
| Python 1.2.2 | Any caller. The `extended_card_modifier` hook receives the call context and can vary the card {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}. |
| Go v2.6.0 | Any caller. A `CallInterceptor` or the card producer can reject the call {{sdk-go a2asrv/handler.go at v2.6.0}}. |
| Java v1.4.0.Final | Any caller in the core handlers, by design. The Quarkus reference servers mark the route `@Authenticated` {{sdk-java SECURITY.md at v1.4.0.Final}} {{sdk-java reference/jsonrpc/src/main/java/org/a2aproject/sdk/server/apps/quarkus/A2AServerRoutes.java at v1.4.0.Final}}. |
| JS v1.3.0 | An authenticated user when the card is a static object, and anyone else gets the public card with no error. A provider function decides itself {{sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0}}. |
| .NET v1.0.0-preview2 | Nobody by default, because the method throws `ExtendedAgentCardNotConfiguredError`. An application overrides it and adds its own check {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}}. |
| Rust a2a-server-lf-v0.5.1 | Any caller. A resolver sees the request headers and can vary the card {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}}. |

## Signing a card

**Card signature:** an optional entry in `signatures` that holds a JSON Web Signature, as RFC 7515 defines it, over the card {{spec §8.4}}.

Each entry holds a base64url `protected` header and `signature` {{proto AgentCardSignature}}, and a verifier rebuilds the signed bytes from the received card under three rules {{spec §8.4.1}}:

1. **Field presence.** "Fields marked with `REQUIRED` MUST always be present, even if the field value matches the default." {{spec §8.4.1}} A field with the `optional` keyword stays whenever it was set, and any other field at its default value is dropped.
2. **RFC 8785.** The JSON Canonicalization Scheme sorts object keys, fixes one form for each value, and removes whitespace {{spec §8.4.1}}.
3. **No signatures.** "The `signatures` field itself MUST be excluded from the content being signed to avoid circular dependencies." {{spec §8.4.1}}

The protected header holds `alg`, `typ`, and `kid` {{spec §8.4.2}}, and the line for `typ` says SHOULD under a MUST heading ([conflict D20](#s-ref-sources)). An optional `jku` points to a JSON Web Key Set with the public key {{spec §8.4.2}}.

To sign, join the base64url header and canonical payload with a period, and sign that input with the key that `kid` names {{spec §8.4.2}}.

```listing
title: the deployer card, canonicalized, signed, and checked
source: capture/out/17-signed-card.txt
lang: text
note: The payload and the signing input are cut inside their lines. Step 2 prints the header with spaces, and the encoded bytes have none.
---
# 1. canonical payload (RFC 8785): the card without signatures, keys sorted, no spaces
{"capabilities":{"extendedAgentCard":true,"streaming":true},…"version":"1.4.1"}

# 2. protected header, decoded
{"alg": "HS256", "typ": "JOSE", "kid": "deployer-key-1"}

# 3. JWS signing input: BASE64URL(header) '.' BASE64URL(payload)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJkZXBsb3llci1rZXktMSJ9.eyJjYXBhYmlsaXRpZXMiOnsi…

# 4. the signature entry published in the card
{
  "protected": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJkZXBsb3llci1rZXktMSJ9",
  "signature": "yPk834ji_dOVmxElhzV3yTYBT9NVp8Bx1j5K0LQmOww"
}

# 5. verify the published card: True
# 6. verify after changing the description to name production: False
```

The kit signs with `HS256`, as [the kit README](manuals/a2a-101/capture/README.md) lists. Real cards use `ES256` or `RS256` {{spec §8.4.2}}, because an HMAC verifier holds the signing key.

## Verifying a card

Verification has six MUST steps {{spec §8.4.3}}. They take a signature, fetch the public key by `kid` and `jku` or from a trusted store, and check it against the rebuilt payload.

Apply rule 1 when you rebuild, although the signing and verifying steps both say "Remove properties with default values" {{spec §8.4.2}} {{spec §8.4.3}} ([conflict D21](#s-ref-sources), open as [issue #2249](https://github.com/a2aproject/A2A/issues/2249)).

The kit's check passes on the published card and fails on a copy whose description names production (`capture/run.py`), because the canonical bytes change. [Figure](#fig-card-signature) shows both checks.

```figure
id: fig-card-signature
kind: flow
title: signing and verifying the deployer card
claim: The signature covers the RFC 8785 bytes of the card without `signatures`, so an edit to the description changes those bytes and verification fails.
caption: Read the top half left to right and down, then the bottom half left to right. Steps 5 and 6 are the last two lines of capture/out/17-signed-card.txt. Values are shortened to 8 characters.
```

"Clients SHOULD verify at least one signature before trusting an Agent Card" {{spec §8.4.3}}, and never with an expired or revoked key. Give your verifier an explicit list of allowed algorithms, as the reference SDK does, to prevent algorithm confusion attacks {{sdk src/a2a/utils/signing.py}}. [Security requirements](#s-security-requirements) covers card spoofing.

```takeaways
- Send a declared credential with `GetExtendedAgentCard`, and put an authentication check in front of it on your server.
- Sign the RFC 8785 bytes of the card without `signatures`, with `ES256` or `RS256` and a published public key.
- Verify at least one signature, with an explicit list of allowed algorithms, before you trust a card.
```

Sources: spec §1.4, §3.1.11, §3.3.4, §5.4, §8.4, §8.4.1, §8.4.2, §8.4.3, §13.3, §A.2.2 (research/sources/specification.md); proto AgentCard, AgentCapabilities, AgentCardSignature (research/sources/a2a.proto); docs/whats-new-v1.md at v1.0.1; sdk src/a2a/server/request_handlers/default_request_handler_v2.py, src/a2a/utils/signing.py; sdk-go a2asrv/handler.go at v2.6.0; sdk-java SECURITY.md, reference/jsonrpc/src/main/java/org/a2aproject/sdk/server/apps/quarkus/A2AServerRoutes.java at v1.4.0.Final; sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0; sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2; sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1; capture/README.md, capture/run.py; capture/out/01-agent-cards.http, 17-signed-card.txt, 18-extended-card.http
