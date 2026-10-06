# Extensions

> An extension is a URI that a card declares, a client activates per request with `A2A-Extensions`, and both sides carry as metadata keyed by that URI.

The three cards in `01-agent-cards.http` declare no extension, so the planner sends plain requests. A reviewer that returned a citation with each finding would need data the core protocol lacks, and an extension adds it under a URI. When you finish this section, you can read an extension declaration, activate one on a request, and handle a missing required one.

## AgentExtension in the card

**Extension:** an addition to the protocol, identified by a URI and defined by its own specification {{docs extensions}}. An agent declares each one as an `AgentExtension` in `capabilities.extensions` {{proto AgentCapabilities}}, with four optional fields {{proto AgentExtension}}.

- `uri`, "The unique URI identifying the extension" {{proto AgentExtension}}.
- `description`, how this agent uses it.
- `required`, true when "the client must understand and comply with the extension's requirements" {{proto AgentExtension}}.
- `params`, "Extension-specific configuration parameters" {{proto AgentExtension}}, as a JSON object.

Section 4.6.1 puts the array on the `AgentCard` itself {{spec §4.6.1}}, and the migration guide reads `agentCard.extensions` {{docs whats-new-v1}}. The proto puts it under `capabilities`, so read `capabilities.extensions`.

```listing
title: two optional extensions on the §4.6.1 sample card
source: research/sources/specification.md
lang: json
note: The sample card, cut to its capabilities. The same sample sends protocolVersion 0.3 and has a trailing comma ([conflict D24](#s-ref-sources)).
---
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": [
      {
        "uri": "https://standards.org/extensions/citations/v1",
        "description": "Provides citation formatting and source verification",
        "required": false
      },
      {
        "uri": "https://example.com/extensions/geolocation/v1",
        "description": "Location-based search capabilities",
        "required": false
      }
    ]
  },
```

## Activating an extension on a request

The client lists the URIs it wants in the `A2A-Extensions` service parameter, a "Comma-separated list of extension URIs that the client wants to use for the request" {{spec §3.2.6}}. [A2A-Version and A2A-Extensions](#s-version-and-extension-headers) says how that parameter travels in each binding.

`Message.extensions` lists "The URIs of extensions that are present or contributed to this Message" {{proto Message}}, and the payload sits in `metadata` under the same URI as key. The specification shows that keying by example only {{spec §4.6.2}}. `Artifact.extensions` works the same way {{proto Artifact}}.

```listing
title: the §4.6.1 request: the header names the extension, and metadata carries its data
source: research/sources/specification.md
lang: http
note: The HTTP sample under the card in §4.6.1. It omits the REQUIRED messageId ([conflict D23](#s-ref-sources)).
---
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token
A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "Find restaurants near me"}],
    "extensions": ["https://example.com/extensions/geolocation/v1"],
    "metadata": {
      "https://example.com/extensions/geolocation/v1": {
        "latitude": 37.7749,
        "longitude": -122.4194
      }
    }
  }
}
```

The guide adds a third step: the response "SHOULD include the A2A-Extensions header, listing all extensions that were successfully activated for that request" {{docs extensions}}. The specification has no such rule, and the SDKs differ. The a2a-js server echoes the header on all three bindings {{sdk-js src/server/express/json_rpc_handler.ts at v1.3.0}}. The a2a-go and a2a-java servers echo it only as gRPC response metadata {{sdk-go a2agrpc/v1/handler.go at v2.6.0}} {{sdk-java reference/grpc/src/main/java/org/a2aproject/sdk/server/grpc/quarkus/A2AExtensionsInterceptor.java at v1.4.0.Final}}. The a2a-python, a2a-dotnet, and a2a-rs servers never write it {{sdk src/a2a/extensions/common.py}} {{sdk-dotnet src/A2A/Models/AgentExtension.cs at v1.0.0-preview2}} {{sdk-rust a2a/src/lib.rs at a2a-server-lf-v0.5.1}}. [Figure](#fig-extension-activation) shows the exchange.

```figure
id: fig-extension-activation
kind: sequence
title: activating an extension, and the error when a required one is missing
claim: The card lists the extension, the request names it in `A2A-Extensions` and keys its data by the URI, and a missing required extension answers -32008.
caption: Read top to bottom. Steps 1 to 4 follow the §4.6.1 sample card and request, and the activation steps of the extensions guide. Steps 5 and 6 show the §3.3.4 rule for a card that marks an extension required, which the sample does not. The kit declares no extension, so no capture is shown. URIs are shortened to their last two path segments.
```

## Required extensions and versions

When a card marks an extension `required: true` and the client does not declare it, "the agent MUST return ExtensionSupportRequiredError" {{spec §3.3.4}}: `-32008`, HTTP 400, or gRPC `FAILED_PRECONDITION` {{spec §5.4}}, as [errors](#s-errors) tables. Only a2a-java has the check built in {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/extensions/A2AExtensions.java at v1.4.0.Final}}. The reference SDK only exposes the requested URIs as `requested_extensions` {{sdk src/a2a/server/routes/common.py}} and never raises the error {{sdk src/a2a/utils/errors.py}}.

"Extensions SHOULD include version information in their URI identifier" {{spec §4.6.3}}, and "A new URI MUST be created for breaking changes to an extension" {{spec §4.6.3}}. An agent ignores an unknown version of an optional extension, errors on a required one, and "MUST NOT fall back to a previous version of the extension automatically" {{spec §4.6.3}}.

## Kinds, governance, and what exists

The extensions guide names four kinds {{docs extensions}}. Data-only extensions add structured data to the card. Profile extensions narrow the values that core messages carry. Method extensions add RPC methods. State machine extensions add states, which [task and task state](#s-task-and-task-state) rejects ([conflict D29](#s-ref-sources)).

Two tiers govern extensions in the `a2aproject` organization {{docs extension-and-binding-governance}}: official ones in `ext-{name}` repositories under the URI prefix `https://a2a-protocol.org/extensions/`, and experimental ones in `experimental-ext-{name}`. For SDKs, "Extensions MUST be disabled by default and require explicit opt-in" {{docs extension-and-binding-governance}}, and "Extension support is not required for protocol conformance" {{docs extension-and-binding-governance}}.

On 2026-10-06 the organization had no `ext-` repository, so no official extension exists. One experimental extension exists: [experimental-ext-oid4vp-auth](https://github.com/a2aproject/experimental-ext-oid4vp-auth/tree/e86356d4a330ede795eb5b458fd2a838ffea0064), for in-task authorization with OpenID for Verifiable Presentations. Its agent moves the task to `TASK_STATE_AUTH_REQUIRED` and puts an authorization request in `metadata` under the extension URI, for a wallet to answer. It builds on [in-task authorization](#s-security-schemes-and-in-task-authorization), and its README allows breaking changes. The four example extensions that the guide lists are samples in a2a-samples, outside the tiers: [timestamp](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/timestamp), [traceability](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/traceability), [secure-passport](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/secure-passport), and [agp](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/agp).

```takeaways
- Read `capabilities.extensions` before you call an agent, and support every extension it marks required.
- Send `A2A-Extensions` with the URIs you want, and key each payload in `metadata` by its URI.
- Treat `-32008` as a card problem, and read the card again before you retry.
- Create a new URI for a breaking change.
```

Sources: spec §3.2.6, §3.3.2, §3.3.4, §4.6, §4.6.1, §4.6.2, §4.6.3, §5.4 (research/sources/specification.md); proto AgentCapabilities, AgentExtension, Message, Artifact (research/sources/a2a.proto); docs extensions, whats-new-v1, extension-and-binding-governance (research/sources/docs.md); sdk src/a2a/extensions/common.py, src/a2a/server/routes/common.py, src/a2a/utils/errors.py at a2a-python 1.2.2; sdk-js src/server/express/json_rpc_handler.ts at v1.3.0; sdk-go a2agrpc/v1/handler.go at v2.6.0; sdk-java reference/grpc/src/main/java/org/a2aproject/sdk/server/grpc/quarkus/A2AExtensionsInterceptor.java, server-common/src/main/java/org/a2aproject/sdk/server/extensions/A2AExtensions.java at v1.4.0.Final; sdk-dotnet src/A2A/Models/AgentExtension.cs at v1.0.0-preview2; sdk-rust a2a/src/lib.rs at a2a-server-lf-v0.5.1; a2aproject/experimental-ext-oid4vp-auth at e86356d; a2aproject/a2a-samples at 6603ba3; capture/out/01-agent-cards.http
