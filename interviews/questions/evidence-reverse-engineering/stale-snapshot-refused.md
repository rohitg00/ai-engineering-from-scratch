---
id: stale-snapshot-refused
title: profile_mismatch after an upgrade and a rename
card: evidence-reverse-engineering
kind: debug
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [debugging, system-design]
tags: [reverse-engineering, cache, snapshot, analysis-profile, invalidation]
minutes: 8
lessons: [phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns]
manuals: [reverse-engineering-101#s-snapshots-and-the-answer-cache]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/evidence-id-excludes-the-path]
updated: 2026-11-03
---

After a tool upgrade, a call to `open_binary` with the saved snapshot answers `profile_mismatch`, although the target's SHA-256 and the provider are unchanged. The same morning a colleague renamed one function, and later `close_binary` with a snapshot path failed with "Analysis snapshots are unavailable because analysis metadata may have changed". Explain both refusals, and say what a snapshot is and is not.

## Short answer

The cache key is the string `query_` plus a SHA-256 over the target identity, the binding, the operation and the parameters, and the binding includes the analysis profile digest over 25 parameter version strings; the upgrade moved two of those values, so the digest changed and no stored entry can match, which the import reports as `profile_mismatch`. A rename is a mutating call, and the session empties the cache and sets a flag before the call is dispatched, even when the reply fails, because a failed reply cannot prove that the write never reached the provider, so the export is refused and the way out is to export the evidence bundle, close without a snapshot, and reopen. A snapshot is a file of exact past answers plus their evidence bundle, not a saved provider database.

## Full answer

### Three things called a snapshot

The target snapshot is the private copy the launcher imports read-only and deletes on close; nothing of the analysis survives it, and every new session imports the target again. The in-memory analysis snapshot cache holds up to 10,000 entries for one target identity. The snapshot file is what `close_binary` writes and `open_binary` reads: the target identity, the provider binding, the cache entries and the session's evidence bundle. Only an exact query that qualifies can reuse a result, and a new or live query still starts the provider.

### What qualifies and what a hit looks like

A call qualifies when its operation is not stateful, names its document or address where one is implied, declares no artifact mutation, and carries a cache policy of `snapshot`. A hit returns without touching the provider and adds one limitation: "Loaded from a local REA analysis snapshot; this call did not re-run the provider." The replayed record is rebound to the open target's path and keeps its `evidence_id`, because the path is outside the hash. The lesson's measurements make the point: a first query took 8.6 s with a fresh import, a different query against the same snapshot took 8.5 s because it was a miss, and a repeat took 2.1 s and returned the identical record with the identical id.

### Load is a full check

Entries must be in canonical id order, every query id is recomputed and must match, no id appears twice, and every entry must have an evidence record in the bundle with the same profile and result. A bundle record for another target fails the whole file. The write is atomic and owner-only.

### Why the order of invalidation matters

The current release invalidates and then calls the provider; an earlier release invalidated only after a successful call. The documentation states the rule: a metadata write clears the cache of the active session even when its reply fails, since the provider can already have applied the write.

## Follow-ups

- **Level 2:** You cached `analyze_function` for one function and then asked about another. Why a miss? Expected: the parameters are part of the key, so only the exact same question replays.
- **Level 3:** Why not invalidate after the mutating call succeeds? Expected: a failed reply cannot prove rollback, so a cache kept after a failure could replay an answer about a database that changed.
- **Level 3:** How does a reader tell a replayed record from a fresh one? Expected: the added limitation sentence that says the provider did not re-run.
- **Level 4:** What is the right action after the upgrade refusal? Expected: run the analysis again under the new profile and keep the old bundle as evidence about an old contract; never edit the digest to force a match.

## Wrong answers

- "A snapshot is a saved project; reopen it." It holds answers to past questions, and the project is deleted on close.
- "Patch the profile digest so the old entries match." The digest names the contract the answers were produced under; a forced match replays answers from a changed contract.
- "A rename is metadata, so cached answers stay valid." A rename is a mutating call; the cache is emptied before dispatch and the export is refused.

## Taught in

The [snapshot section](../../../manuals/reverse-engineering-101/sections/5-3-snapshots-and-the-answer-cache.md) gives the key, the qualifying rules and the invalidation order, and the [evidence lesson](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/) builds the same cache and refuses a bumped profile version.
