# Reading the MCP Specification

> The specification is normative text, not a tutorial: a MUST decides an implementation, a SHOULD leaves room for judgment, and a feature's Deprecated state tells you exactly how long you can still rely on it.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 00
**Time:** ~45 minutes

## Learning Objectives

- Navigate the specification's structure: which parts every implementation MUST support and which are added as needed
- Read RFC 2119 and RFC 8174 keyword strength correctly, including the rule that lowercase words carry no normative weight
- Explain the relationship between schema.ts and schema.json, and why the TypeScript file is the source of truth
- Tell a Draft, Current, or Final revision apart from a feature's own Active, Deprecated, or Removed state
- Trace a changelog entry back to the SEP that produced it, and compute a Deprecated feature's earliest removal from its window

## The Problem

Every fact in this curriculum traces back to one document: the specification at modelcontextprotocol.io, built from a TypeScript schema. A team that learns MCP from a blog post, from a training run whose data predates the current revision, or from memory of an earlier release drifts away from what the specification actually requires, and the exam is written against the specification, not against what used to be true. An implementation that remembered the 2025-06-18 revision correctly and never reread the current text would still get 2026-07-28 wrong, because a MUST from an older revision can be replaced by a different rule, and a feature that used to sit at the center of the protocol can move to Deprecated with a migration path attached while continuing to work exactly as before.

Reading the specification is a skill in its own right: knowing where the normative text lives, what its keywords actually commit an implementation to, how a document's own maturity differs from an individual feature's state, and how to trace a claim back to the proposal that produced it instead of trusting a summary.

## The Concept

The specification is organized into a small number of parts: architecture, the base protocol, versioning and compatibility, message patterns, authorization, server features, client features, and utilities, with optional extensions layered on top. The overview page states plainly which of these are mandatory: all implementations MUST support the base protocol, versioning, and the message patterns. Everything else, including authorization, server features, client features, and utilities, MAY be implemented based on what the application actually needs. That single sentence is worth remembering on its own, because it marks the floor: a server with no resources and no prompts, offering only tools over stdio with no authorization at all, is still a conformant MCP server, as long as it gets the base protocol, versioning, and message patterns right.

Every message shape in this curriculum, and every message shape the exam can ask about, ultimately comes from one file: schema.ts, the TypeScript schema in the specification repository. The prose pages are a readable explanation of that schema, not an independent source of truth; where prose and schema seem to disagree, schema.ts wins. schema.json is generated automatically from schema.ts for tooling that cannot parse TypeScript, and it carries no authority of its own. When a question turns on the exact shape of a result or an error, the schema is where the answer actually lives.

The specification's normative language follows BCP 14, the combination of RFC 2119 and RFC 8174: the words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL carry their defined strength only when they appear in all capitals, exactly as shown here. A sentence that says a client must not batch requests, written in lowercase, is ordinary prose with no normative force at all; the identical words as MUST NOT are a hard prohibition. Reading strength correctly means noticing case, not just vocabulary. MUST and MUST NOT set a floor an implementation cannot go under. SHOULD and SHOULD NOT describe a strong default that a specific, understood reason can override. MAY and OPTIONAL describe a real choice with no default either way.

A specification revision, the whole dated document, is in one of three states. Draft revisions are in progress and not ready for consumption. Current is the one revision in active use; 2026-07-28 is Current today, and it may still receive backwards-compatible changes. The identifier itself is a date in YYYY-MM-DD form that marks the last day backwards incompatible changes were made, which is why a Current revision can absorb compatible fixes without being renamed. Final revisions are past and complete; they will not change again. Because the protocol is stateless, a client that wants to know which revision a server actually speaks does not have to guess from documentation: it can call server/discover, the specification's entry point, and read the answer back on the wire.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {"tools": {"listChanged": false}},
    "ttlMs": 300000,
    "cacheScope": "public"
  }
}
```

A feature inside a Current revision, one message, one capability, one transport, carries its own state, separate from the revision's Draft, Current, or Final label. Active means implement it as written, with no planned removal. Deprecated means the feature is still fully specified and functional, but a migration path is documented and the feature is scheduled to go away; new implementations should not adopt it. Removed means it has been deleted from the draft specification and will not appear in the next Current revision. Roots, Sampling, Logging, and Dynamic Client Registration are all Deprecated in 2026-07-28, not removed: they still work exactly as specified, and a server or client that supports them today keeps working tomorrow. The deprecated features registry is the single page that lists every feature currently in the Deprecated or Removed state, so a reader never has to reconstruct that picture from scattered changelog entries.

The deprecation policy sets a floor, not a fixed schedule. A feature must remain Deprecated for at least twelve months before it is even eligible for removal, and that window is measured from the release of the revision that first marks it Deprecated, not from whenever the proposal that deprecated it happened to reach Final. The date the window elapses is the feature's earliest removal, the first Current revision released on or after that point; whether the feature is actually removed in that revision, in a later one, or stays Deprecated far longer, is a Core Maintainer decision made during release preparation. Because Roots, Sampling, Logging, and Dynamic Client Registration were all marked Deprecated in the revision released on 2026-07-28, their shared earliest removal is the first revision released on or after 2027-07-28, computed from that release date rather than from any single proposal's own timeline.

Every substantial change to the specification, a new feature, a breaking change, a governance change, goes through a Specification Enhancement Proposal: a markdown file in the seps directory that states the motivation, the exact specification text, the rationale, backward compatibility, and security implications. A SEP moves through draft and in-review status and is either accepted or rejected, and it only reaches final once a reference implementation and, for standards-track changes with observable behavior, a conformance scenario both exist. An Extensions Track SEP follows the identical process but describes an optional extension rather than a core protocol addition. Every changelog entry in the specification names the SEP that produced it; reading that SEP is how a careful implementer, or a careful exam candidate, confirms a claim instead of trusting a one-line summary. The feature lifecycle and deprecation policy itself, the rule this lesson leans on for Active, Deprecated, and Removed, is SEP-2596, a Process SEP that reached Final status by documenting exactly the mechanism described above.

JSON-RPC batching is the cautionary example the lifecycle policy was written to prevent: it was added in the revision released on 2025-03-26 and removed one release later, on 2025-06-18, with no deprecation period at all. Under 2026-07-28, that kind of change is not supposed to happen again without at least a twelve-month Deprecated state and a documented migration path first.

```figure
mcpa-01-spec-map
```

## Interactive Lab

The figure maps the specification around a single root: three boxes marked MUST support the base protocol, versioning, and message patterns, and four boxes marked MAY support authorization, server features, client features, and utilities. Below it, three chips trace a feature's own lifecycle, Active to Deprecated to Removed, a state that travels with the feature, not with the revision. A box can be MUST while everything under it, including exactly which tools or resources a given server chooses to expose, remains entirely up to the implementation.

## Practice Lab

Open `code/main.py`. It has no network calls and models the specification as data rather than talking to a real server: a deprecated features registry, a small changelog indexed by SEP number, and a keyword classifier.

```bash
python3 code/main.py
```

Read the printed output against the concept section above. `classify_requirement` reads a sentence and returns its strength, and shows that the identical words written in lowercase return `unspecified` rather than `forbidden`. `feature_state` answers whether roots, sampling, or JSON-RPC batching count as active, deprecated, or removed as of a given revision, and `earliest_removal` computes the 2027-07-28 date directly from the deprecation window instead of having it hardcoded anywhere. `changelog_lookup` takes a SEP number and returns the entry that cites it. At the end, the demo sends a `server/discover` request and prints the exchange, along with something that goes wrong on purpose: a request missing its required `_meta` block, which a conformant server must reject rather than guess about. Add a new entry to `DEPRECATED_REGISTRY` with its own window, or change which feature `include-context-this-server-all-servers` follows, and rerun to see `earliest_removal` and `feature_state` pick up the change without any other code moving.

## Shipped Artifact

`outputs/spec-reading-guide.md` is a one-page reference you can keep open while reading the actual specification: the MUST-support list, the keyword strength table, the difference between a revision's state and a feature's state, and the deprecation timing rules with their exact anchor points. Use it as a checklist before you tell a teammate, or answer an exam question, about whether something is still current.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: MUST and MUST NOT classify as required and forbidden, the identical lowercase words classify as unspecified, SHOULD and MAY classify as recommended and optional, SHOULD NOT and NOT RECOMMENDED both classify as not recommended, a feature is active before its own deprecation revision and deprecated on or after it, a feature that only has a removal date and no Deprecated state at all is never reported as current, earliest removal is computed from the twelve-month window rather than hardcoded, a feature that follows another feature's schedule shares its earliest removal, an unrecognized feature name is handled without raising, a changelog entry can be found by its SEP number while an unknown SEP returns nothing, and a queried revision correctly reports Current, Final, or unknown. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/01-reading-the-specification
```

## Capstone Connection

The capstone assembles one full 2026-07-28 exchange end to end, and it assumes you can tell, without looking anything up, whether a message shape, an error code, or a feature it uses is still current. Every later lesson in this track cites a specific page or SEP the way this one taught you to read them: by keyword strength, by feature state, and by the SEP that actually produced the rule. When the capstone, or an exam question, rests on whether something is a MUST or a SHOULD, or whether a feature is Deprecated rather than Removed, you are reading the same registry and the same keywords this lesson modeled as data.

## Key Terms

| Term | Meaning |
|------|---------|
| Base protocol | The JSON-RPC message shapes every implementation MUST support |
| BCP 14 | The RFC 2119 and RFC 8174 rule that MUST, SHOULD, and MAY carry normative weight only in all capitals |
| schema.ts | The TypeScript file that is the source of truth for every MCP message and structure |
| Current revision | The one specification revision in active use; 2026-07-28 today |
| Draft, Current, Final | The three states a specification revision moves through |
| Active | A feature's state when it is implemented per its normative requirements with no planned removal |
| Deprecated | A feature's state when it is still specified and functional but scheduled for removal with a migration path |
| Removed | A feature's state once it has been deleted from the draft specification |
| Earliest removal | The first Current revision released on or after a Deprecated feature's minimum window elapses |
| SEP | A Specification Enhancement Proposal, the markdown document that proposes and records a specification change |

## Further Reading

- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP specification 2026-07-28, Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP specification 2026-07-28, Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP specification 2026-07-28, Deprecated Features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
- [Feature Lifecycle and Deprecation Policy](https://modelcontextprotocol.io/community/feature-lifecycle)
- [SEP Guidelines](https://modelcontextprotocol.io/community/sep-guidelines)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 1 and 15
- `phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations`, which builds a conformance harness on top of these version-era rules
