# The Extensions Framework

> An extension is a capability neither side has to support: named with a mandatory vendor prefix, declared fresh in the metadata of every request, and safe to ignore, so the core protocol never has to grow to fit one vendor's idea.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 29
**Time:** ~45 minutes

## Learning Objectives

- Identify a well formed extension identifier by its mandatory vendor prefix, and name a real official one and a real third party one
- Explain where a client declares extension support and where a server declares its own, and why both live in per-request `_meta` rather than a one time handshake
- Compute the active extension set for a request from what the client asks for and what the server actually supports
- Apply graceful degradation: fall back to core behavior for an optional extension, and reject a request that needs a mandatory one the two sides never mutually activated
- Trace an extension's lifecycle from an Extensions Track SEP through an experimental repository to an official identifier, and state what forces a new identifier

## The Problem

MCP's core specification has to stay something every implementation can fully support, the same guarantee that lets any client discover and drive any server it has never seen before. Real deployments want things the core was never going to standardize for everyone: a tool that renders an interactive chart instead of a wall of text, a way to hand off a slow job and poll it later, machine to machine authentication that never involves a browser, a way to publish reusable playbooks instead of one off tools. If the core absorbed every one of these, the specification would never stop growing, and a server built two years ago would quietly stop being a complete implementation of MCP the day the spec added a feature it never asked for and never needed.

Inventing these capabilities without a shared convention is worse than not having them. Two vendors solving the same problem, say letting a server render a UI, would pick different `_meta` field names, a client would have no reliable way to ask a server whether it understands a given field, and a security reviewer would have no single place to look up what that field is even supposed to mean. The concrete failure looks like this: a server team wants a tool to return a richer response when the caller can use it, but nothing in the base spec tells them how to advertise that richness so an older client does not choke on fields it has never seen, and a client team wants to know, before it shapes a request around a feature it read about somewhere, whether this particular server, on this particular call, actually implements it.

## The Concept

An MCP extension is an optional addition to the specification: a capability beyond the core protocol that either side may or may not implement, named so that unrelated vendors never collide. Its identifier has the shape `{vendor-prefix}/{extension-name}`, and the prefix is not optional: the format follows the same rule as `_meta` keys, except here a prefix is required. Official extensions, the ones MCP itself maintains, use the `io.modelcontextprotocol` prefix, for example `io.modelcontextprotocol/oauth-client-credentials`. Anyone else building an extension is expected to use a reversed domain name they actually control, the same convention Java packages use, so a company that owns example.com would publish `com.example/my-extension`. A bare word with no slash in it is not a valid extension identifier at all; nothing can negotiate it, because there is no prefix to tell two vendors apart.

Both sides advertise extension support the way they advertise everything else in this revision: as data attached to the message, never as a one time setup step. A client declares the extensions it wants for a given call inside that request's own metadata, under `_meta["io.modelcontextprotocol/clientCapabilities"].extensions`, a map from identifier to a settings object:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {"location": "New York"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {"mimeTypes": ["text/html;profile=mcp-app"]}
        }
      }
    }
  }
}
```

A server declares which extensions it implements inside its `server/discover` result, under `capabilities.extensions`, the same shape:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "extensions": {"io.modelcontextprotocol/ui": {}}
    },
    "ttlMs": 3600000,
    "cacheScope": "public"
  }
}
```

An empty settings object, `{}`, is a complete and valid declaration: it means the extension is supported with nothing to configure. A populated one carries whatever fine grained configuration that specific extension defines, such as the `mimeTypes` list above. Because this rides on `_meta` and is resent on every call, nothing declared on one request carries over to the next; that is the same statelessness that governs the protocol version and every other per-request capability, not a special case invented for extensions.

An extension is active for a given call only when both sides name it: the client asked for it on this request, and the server's own capabilities say it implements it. Computing that set is an intersection of two maps by identifier, and a malformed identifier, one missing its mandatory prefix, never belongs in the result even if it somehow turns up on both sides; validating the shape of an identifier is part of computing the active set, not a separate step you can skip.

What happens next depends on whether the extension was optional or mandatory for that particular call. If it is optional, an enhancement layered on top of behavior that already works, the side that supports it falls back to core behavior when the other side does not: a tool that can render an interactive dashboard still returns meaningful text content for a client that never declared the UI extension. If the extension is mandatory for that call, an operation with no meaningful core only behavior, such as handing back a durable job handle a client cannot poll without it, the request is rejected instead of half answered. The rejection reuses the same capability gate lesson 07 introduced for any missing client capability: `MissingRequiredClientCapabilityError`, `-32021`, its `data.requiredCapabilities` naming exactly which extension the call needed, shaped as `{"extensions": {"<identifier>": {}}}`. Nothing about this error is extension specific machinery; it is the ordinary per-request capability gate, applied to an extension identifier instead of a core one. Extensions are opt-in on both sides too: an SDK is never required to implement any extension to claim full protocol conformance, and where it does implement one it ships disabled until the developer turns it on explicitly.

An extension does not enter the specification the way a core feature does. It starts as a distinct SEP type, an Extensions Track SEP, in the main MCP repository, and unlike a Standards Track SEP it must already have a working reference implementation in an official SDK before the Core Maintainers will review it at all. Once approved, its specification lives in an extension repository inside the modelcontextprotocol GitHub organization, named with an `ext-` prefix, such as `ext-auth` for the authorization extensions or `ext-apps` for MCP Apps; Core Maintainers keep ultimate authority over anything published there, but day to day changes are delegated to that repository's own maintainers and need no further core review. A Working Group or Interest Group can also incubate an idea before it is ready for a SEP at all, inside a repository named with an `experimental-ext-` prefix instead, clearly marked as non official so nobody mistakes prototyping for a commitment; Core Maintainers can still archive or remove one of these at their own discretion.

Extensions version independently of the core protocol and of each other, and a new extension release needs no core review at all. The one hard rule governs a breaking change: removing or renaming a field, changing a field's type, changing what existing behavior means, or adding a new required field. None of those may ship under the old identifier. The extension gets a new one instead, typically suffixed, `io.modelcontextprotocol/my-extension-v2`, so an implementation still declaring the old identifier keeps getting the old, unmodified behavior rather than silently breaking. A new optional field, or a version marker inside the settings object, is not a breaking change and needs no new identifier.

Four families of official extension exist today. Tasks (`io.modelcontextprotocol/tasks`, SEP-2663) is the durable job handle from lesson 21: a server answers a request with a task instead of blocking, and the client polls it. MCP Apps (`io.modelcontextprotocol/ui`, SEP-1865) lets a tool point at a sandboxed, renderable interface instead of only text, covered next. Skills over MCP (`io.modelcontextprotocol/skills`, SEP-2640) lets a server publish reusable workflow instructions a client can discover and read through the resources primitive it already has. Reading a skill's `SKILL.md` through `resources/read` only retrieves text: the extension treats skill content as untrusted input, leaves whether a skill is loaded into model context at all to explicit user policy, tells hosts to let users inspect a skill before loading it, and ignores permission-widening frontmatter such as `allowed-tools` on MCP-served skills unless the user approved that grant. The authorization extensions, published from the `ext-auth` repository, add OAuth's client credentials flow and an enterprise managed authorization framework on top of the core authorization model. Because support for every one of these is opt-in and independent per client, the extensions site keeps a running matrix of which client implements which one; check it before a design leans on a specific extension being there. A gateway sitting between a real client and a backend server is itself a client to that backend, and has to decide independently what to declare rather than forwarding whatever the original caller declared; advertising an extension the gateway cannot actually mediate correctly is worse than not advertising it at all.

Before this revision, an extension was declared once, inside the `initialize` request's `capabilities.extensions` and echoed once in the `initialize` response, and that single declaration was assumed to hold for the rest of the connection; SEP-2133's own historical text, preserved as a record of what shipped at the time, still shows that shape. 2026-07-28 has no connection lifetime handshake and nowhere to hold a declaration across calls, so that assumption does not carry forward. The declaration now travels in `_meta` on every request, and a server must not assume a client's extension support on this call matches what it declared, or what any other client ever declared, on an earlier one.

```figure
mcpa-30-extension-negotiation
```

## Interactive Lab

The figure sets the client's declared extensions and the server's declared extensions side by side. One identifier, `com.example/priority-routing`, appears in both boxes and converges into the active box in the middle: this call gets the enhanced behavior. `io.modelcontextprotocol/ui` appears only on the client's side and `io.modelcontextprotocol/tasks` only on the server's; neither converges, because negotiation needs both sides to name the same identifier. Below, the three outcomes line up with the concept section: an optional extension both sides declare activates and enriches the response, an optional extension only one side declares falls back to core behavior, and a mandatory extension that never mutually activates gets rejected with `-32021` naming exactly what was missing.

## Practice Lab

Open `code/main.py`. `negotiate_extensions` is the whole mechanism in one function: it walks the client's declared extensions, keeps only the ones that are well formed and that the server also lists in its own `extensions` map, and hands back that intersection paired with the client's settings object. Two tools sit on top of it. `summarize_incidents` treats `com.example/priority-routing` as optional: called with nothing declared it returns a plain "3 open incidents"; called with the extension declared as an empty settings object it still activates, defaulting to a "standard" tier, which is exactly what `{}` meaning supported with no settings looks like in practice; called with `{"tier": "gold"}` the same tool sorts for that tier instead. `export_dataset` treats `com.example/bulk-export` as mandatory: called without it declared, the server never even looks at the arguments, it answers immediately with `-32021` and `data.requiredCapabilities` naming the extension; called with it declared, the same call completes normally.

```bash
python3 code/main.py
```

Run it and follow the eight exchanges in order. The seventh one declares a made up identifier, `no-slash-here`, alongside a valid one; watch it get silently dropped from negotiation while the valid one still activates, which is exactly what `is_well_formed_extension_id` is there to guarantee even when nothing else about the request looks wrong. Try adding a third tool that requires two extensions at once, and see which missing one `_call` reports first.

## Shipped Artifact

`outputs/extension-negotiation-guide.md` collects the identifier format, where each side's declaration lives on the wire, a three row decision table for optional and active, optional and falling back, and mandatory and rejected, the lifecycle checklist from a SEP to an `ext-` repository, and the official extension roster with each one's real identifier, all citing the brief.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that a real official identifier and a real third party identifier both validate while a bare word without a prefix does not, that negotiation is the intersection of what the client asks for and what the server actually supports, that an optional extension falls back to a plain result when it never activates, that an empty settings object still counts as supported while a populated one configures the behavior, that a mandatory extension left undeclared is rejected with `-32021` naming it in `data.requiredCapabilities` while declaring it lets the same call complete, that a malformed identifier present on both sides still never activates, and that `server/discover` advertises the server's extensions with real cache hints. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/30-the-extensions-framework
```

## Capstone Connection

The capstone's tool ecosystem has to justify every design choice against the base spec, and an extension is one of the choices it has to justify correctly: whether a behavior belongs in a tool's core response or behind an extension a caller might not have, and what the fallback looks like when it does not. Reach for this lesson's active set computation and its `-32021` rejection whenever the capstone's server offers something beyond the three core primitives, and reach for the lifecycle rules whenever it has to explain why a behavior it wants is not simply added to the core spec directly.

## Key Terms

| Term | Meaning |
|------|---------|
| Extension | An optional addition to MCP beyond the core protocol, identified by `{vendor-prefix}/{extension-name}` |
| Vendor prefix | The mandatory namespace on an extension identifier; `io.modelcontextprotocol` for official extensions, a reversed domain for everyone else |
| Settings object | The per-extension configuration value in a capabilities declaration; `{}` means supported with nothing to configure |
| Active extension set | The identifiers a given request actually negotiated: present in both the client's declared capabilities and the server's |
| Graceful degradation | Falling back to core behavior when an optional extension is not mutually active, instead of failing the request |
| `MissingRequiredClientCapabilityError` | `-32021`, returned when a call needs an extension, or any capability, this request's `clientCapabilities` did not declare |
| Extension repository | A repository in the modelcontextprotocol GitHub organization with an `ext-` prefix, holding one or more official extensions |
| Experimental extension | An incubating extension in an `experimental-ext-` repository, tied to a Working or Interest Group, not yet an official SEP |

## Further Reading

- [MCP Extensions Overview](https://modelcontextprotocol.io/extensions/overview)
- [SEP-2133: Extensions](https://modelcontextprotocol.io/seps/2133-extensions)
- [Extension Negotiation, MCP versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#extension-negotiation)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 14
- `phases/13-tools-and-protocols/17-mcp-gateways-and-registries`, which works through per-request capability negotiation from a gateway's point of view
