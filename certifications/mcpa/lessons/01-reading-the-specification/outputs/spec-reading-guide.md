# Spec Reading Guide

A one-page reference for reading the MCP 2026-07-28 specification like the exam does.

## Where to start

- Specification index: what every implementation MUST support (base protocol, versioning, message patterns) versus what it MAY add (authorization, server features, client features, utilities).
- schema.ts is the source of truth for every message and structure; schema.json is generated from it for tooling and carries no authority of its own.
- The current revision is 2026-07-28. Revisions are Draft, Current, or Final; only one revision is Current at a time.

## Reading a MUST, SHOULD, or MAY

| Keyword (all capitals only) | Strength |
|---|---|
| MUST, SHALL, REQUIRED | required |
| MUST NOT, SHALL NOT | forbidden |
| SHOULD, RECOMMENDED | recommended |
| SHOULD NOT, NOT RECOMMENDED | not recommended |
| MAY, OPTIONAL | optional |

Lowercase "must", "should", or "may" in ordinary prose carries no normative weight under BCP 14 (RFC 2119, RFC 8174). Only the all capitals form counts, exactly as the specification writes it.

## Feature states versus revision states

A revision, the whole dated document, is Draft, Current, or Final. A feature, one message, one capability, one transport, is Active, Deprecated, or Removed, tracked in the deprecated features registry, separate from the revision's own state. A feature can be Deprecated inside a Current revision without the revision itself changing state.

## Deprecation timing

- The minimum deprecation window is twelve months, measured from the release of the revision that first marks the feature Deprecated, not from when the SEP that deprecated it reached Final.
- Earliest removal is the first revision released as Current on or after that window elapses. Actual removal still needs a Core Maintainer decision at release time; a feature can stay Deprecated far longer than the minimum.
- A Deprecated feature can be restored to Active by a superseding SEP.

## Reading a SEP and its changelog entry

- SEPs live as markdown files in the seps directory and move through draft, in review, accepted, and final (with rejected, withdrawn, dormant, and superseded as the other outcomes).
- Four SEP types: Standards Track, Informational, Process, and Extensions Track.
- A changelog entry names the SEP that produced it. Open the SEP file itself for the exact specification text, the rationale, and whether it actually reached Final before trusting a one-line summary.

## Remember for the exam

- Deprecated is not removed. Roots, Sampling, Logging, and Dynamic Client Registration are Deprecated in 2026-07-28, not gone; they still work exactly as specified.
- JSON-RPC batching was added in the revision released on 2025-03-26 and removed one release later, on 2025-06-18, with no deprecation window at all. That gap is the reason the feature lifecycle policy exists.
- schema.ts, not schema.json, is authoritative when the two disagree.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 1 and 15.
