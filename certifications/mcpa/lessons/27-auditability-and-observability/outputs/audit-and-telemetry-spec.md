# Audit and Telemetry Field Brief

A one-page reference for the MCPA "Security and Governance" domain's auditability objective: design auditability and observability so protocol activity can be traced, attributed, and reviewed. Aligned to MCP 2026-07-28.

## traceparent field layout

`traceparent` is four hyphen-separated segments, always lowercase hex, fixed lengths, carried in `_meta` as the one exception to the reverse-DNS prefix rule (SEP-414):

| Segment | Length | Meaning |
|---------|--------|---------|
| version | 2 hex chars | Format version, `00` in current use |
| trace id | 32 hex chars | Names the whole operation; constant across every hop |
| parent id | 16 hex chars | Names one span; a fresh value is minted at every hop |
| flags | 2 hex chars | Bit flags, such as whether the trace is sampled |

A trace id or parent id of all zeros is invalid and must be rejected. `tracestate` (vendor state) and `baggage` (user-defined context) are separate `_meta` keys that travel alongside `traceparent`; this lesson's servers forward both unchanged at every hop.

## Deriving a child span

Keep the trace id, mint a new parent id, before making any call to another service:

```python
def child_traceparent(value):
    parsed = parse_traceparent(value)
    return make_traceparent(parsed["trace_id"], new_span_id(), sampled=parsed["flags"] != "00")
```

## The five audit entry fields

| Field | Source | Never use |
|-------|--------|-----------|
| who | The authenticated principal a validated credential resolves to | `clientInfo.name` (self-reported, display only) |
| what | Method, tool name, arguments with flagged fields redacted | The raw, unredacted argument value |
| when | A timestamp taken when the entry is written | A client-supplied time claim |
| result channel | complete, isError, or protocol_error, whichever the call actually ended on | Collapsing all outcomes into one generic status |
| correlation | Request id (this hop) plus trace id (the whole operation) | Request id alone across a service boundary |

## Redaction rule

A tool is registered with a set of flagged argument field names. Before an entry is created, every flagged field's value is replaced with a fixed marker. This happens before the entry is written and before it is hashed, so the raw value never exists in the durable record, its backups, or the hash computation. The tool's handler still receives the real value; only the audit trail's copy is redacted. Each server applies its own redaction policy to its own log, independently.

## Hash chain verification, as a procedure

1. Start with a genesis value as the expected previous hash.
2. For each entry in order: confirm its stored `prev_hash` equals the expected previous hash; recompute its digest from its own stored fields and confirm that matches its stored `hash`; then set the expected previous hash to this entry's `hash` and continue.
3. A clean chain finishes with every entry checked. A tampered chain stops at the first entry whose stored hash no longer matches its content, or, if the attacker also patched that one entry's own hash, at the very next entry instead, because that entry's `prev_hash` still points at the original value.

This is tamper evidence, not tamper prevention: nothing stops a write to the underlying storage, but an edit cannot be made invisible without rewriting every entry after it, in order.

## Why clientInfo can never be the who

`clientInfo` and `serverInfo` are self-reported by whoever sends them and are never verified by the protocol. The specification says implementations should not rely on them for security decisions. An audit record that used `clientInfo.name` as its who field would let any caller pick its own name in the log it is being held accountable against, which defeats the record's purpose before it is even written.

## Correlating across a hop

Two servers on the same operation keep two separate hash chains. There is no shared log and no requirement that one server's request id match another's for the same operation; each hop mints its own. The only value guaranteed to be identical on both sides of a hop is the trace id, so that is what a reviewer, or a tracing backend, joins on to reconstruct the full path of one operation across every service it touched.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 3, 11, and 13.
