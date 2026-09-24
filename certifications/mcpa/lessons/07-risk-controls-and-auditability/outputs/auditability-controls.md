# Auditability and Risk Controls Field Brief

A one-page reference for the MCPA "Security and Governance" domain's auditability objective: design auditability and observability so protocol activity can be traced and reviewed.

## The audit log fields

Each entry in the log is append-only: written once, in order, never edited or removed.

- **index**: the entry's position in the log, starting at 0.
- **tool**: the name of the tool that was called.
- **arguments**: the call's arguments, with any flagged field replaced by a redaction marker before the entry is written.
- **result**: a string summary of what the tool returned.
- **prev_hash**: the hash of the entry immediately before this one, or a genesis value for the first entry.
- **hash**: the hash of this entry's own prev_hash, tool, arguments, and result, taken together.

## The hash-chain rule

Each entry's hash is computed over its own content plus the previous entry's hash. Verifying the log means walking it from the first entry to the last, recomputing each hash from what is stored, and checking two things at every step: the recomputed hash matches the entry's recorded hash, and the entry's prev_hash matches the previous entry's recorded hash.

If a past entry is edited, its recomputed hash no longer matches what was recorded, and that mismatch is caught the moment verification reaches it. Recomputing that one entry's own hash to hide the edit does not repair the pointer the next entry holds back to the original value, so the break still surfaces one entry later. This is tamper-evidence, not tamper-prevention: nothing stops someone with write access to the storage from editing a file, but the edit cannot be made undetectable without also rewriting every entry after it, in order, with knowledge of the chain's construction.

## Redaction rule

A tool is registered with a set of flagged argument field names. Before an entry is created, every flagged field's value is replaced with a fixed redaction marker. This happens before the entry is written and before it is hashed, so the raw value never exists in the durable record, its backups, or the hash computation. The tool's handler still receives the real, unredacted argument to do its job; only the audit trail's copy is redacted.

## Risk controls

Three controls bound what can happen before any call reaches the log:

1. **Allowlist**: only a registered tool may run. An unrecognized tool name is denied immediately, as a protocol error, and never reaches the log because it never ran.
2. **Required-argument validation**: a call missing a required field is refused before the tool executes.
3. **Rate limit**: a per-tool cap on how many times a tool may run bounds the damage a compromised, looping, or over-eager caller can do, independent of whether any single call looks legitimate.

Controls and the log answer different questions. A control decides whether a call is allowed to happen at all. The log proves what did happen, for every call that was allowed to run.

## Exam facts for this domain

- Security and Governance is 24 percent of the MCPA exam, the largest single domain.
- One of its named objectives is to design auditability and observability so protocol activity can be traced and reviewed, distinct from locating trust boundaries, applying permissions and consent, and choosing risk and safety controls.
- The exam is aligned to MCP specification 2026-07-28.
- Source: MCPA certification page and launch announcement; see `certifications/mcpa/research/source-verification-ledger.md`.
