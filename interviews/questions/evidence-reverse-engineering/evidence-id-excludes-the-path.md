---
id: evidence-id-excludes-the-path
title: Same id on two machines, refused after one deleted line
card: evidence-reverse-engineering
kind: concept
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [screen, debugging]
tags: [reverse-engineering, evidence, content-hash, canonical-json, integrity]
minutes: 8
lessons: [phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns]
manuals: [reverse-engineering-101#s-the-evidence-record, reverse-engineering-101#s-ref-errors]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/observed-derived-inferred]
updated: 2026-11-03
---

Two machines analyze the same object in different folders and get the same `ev_` id. A colleague copies one record, deletes one limitation sentence to shorten it, and the file no longer imports. Later an untouched bundle written by an older release fails the same way. Explain all three outcomes from the id rule.

## Short answer

The id is a content hash: `ev_` plus a SHA-256 over the RFC 8785 canonical JSON of a projection of the record, where the projection keeps the subject's `digest`, `format` and `architecture`, drops `name` and `local_path`, and hashes everything else, `raw_result` and every limitation included. So a moved file keeps its id, a dropped limitation changes the content and the validator refuses it with "Evidence semantic identifier does not match its record", and the older bundle fails because the id rule itself moved: the older release left a `null` `relationship_coverage` out of the hash and the current one hashes it, so the first record with `null` coverage fails `evidence_integrity_mismatch`. Saved evidence is not migrated; regenerate it with the release you run.

## Full answer

### The recipe

Canonical JSON sorts object keys, removes whitespace and fixes number and string forms. For records whose numbers are integers, a standard-library `json.dumps` with sorted keys and compact separators produces the same bytes, which is why a few lines of Python or Node recompute every captured id. Floats are refused before hashing, because the canonical form and the language runtime can print them differently. The analysis profile digest is a separate SHA-256 over `{provider, parameters}`, and a profile whose provider differs from the record's provider is rejected.

### What is inside and what is outside

A path in `subject` is outside the hash. A path anywhere else is inside it: two captured files failed to match because the capture kit masked a directory inside `normalized_result` and `locations`, so a record that carries a path there gets a different id on every machine. Keep paths out of results and locations in your own records. A limitation is content on purpose: dropping one makes the record look stronger than the facts allow, and a later reader cannot repair that, so the id breaks.

### Rebinding without rehashing

A record can be shown under a new path with a rebind that refuses when the digest, format or architecture differ. Snapshot replay does the same when it writes the open target's path into a stored record: the `evidence_id` does not change, because the path was never in it.

### The error envelope

Every error has the same five fields: `code`, `category`, `message`, `retryable`, `remediation.action`, and optional `details`. The refused bundle names the failing record by index and says which field failed. `invalid_request` is retryable with corrected arguments; `evidence_integrity_mismatch` is not.

## Follow-ups

- **Level 2:** Why leave the path out of the hash at all? Expected: the same observation of the same bytes should carry one id on any machine and in any folder; identity belongs to the content, not to where the file sits.
- **Level 3:** A producer writes an absolute path into `locations`. What happens when a colleague imports the bundle? Expected: the unchanged bundle still imports, because the stored path hashes to the stored id; but the same observation made on the colleague's machine carries their path and gets a different id, and any edit that masks the path breaks the id. Locations hold addresses and relative artifact paths, not host paths.
- **Level 3:** Why does a limitation count as content and not as a comment? Expected: without it the record claims more than the provider did, and nobody downstream can tell.
- **Level 4:** How do you handle the older bundle? Expected: regenerate it with the current release, since the rule changed and ids are not migrated; never patch an id by hand.

## Wrong answers

- "Ids are random identifiers assigned at write time." They are content hashes, which is why two machines agree.
- "Trim limitations to save context tokens." Each one is hashed. A trimmed record with the old `evidence_id` is refused, and the reader loses what the fact does not cover.
- "Fix the id field so the bundle imports." The validator recomputes the hash from content, and a patched id is still a mismatch.

## Taught in

The [evidence record section](../../../manuals/reverse-engineering-101/sections/5-1-the-evidence-record.md) gives the projection and a script that recomputes ids, the [errors reference](../../../manuals/reverse-engineering-101/sections/r-3-errors.md) shows the refused bundle, and the [evidence lesson](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/) recomputes every recorded hash in Python.
