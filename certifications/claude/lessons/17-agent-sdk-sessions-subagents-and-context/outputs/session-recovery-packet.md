# Session Recovery Packet: Client Migration

## Goal and Scope

Migrate the HTTP client without public behavior changes. Scope is
`src/client.py` and `tests/test_client.py`; deployment and external writes are
blocked.

## Durable State

Manifest `migration-v2` records the current branch, dependency version, task
status, file hash `4cc0-demo`, 12 passing tests, one blocked timeout case, and
artifact IDs. Conversation history is not authoritative.

## Revalidation

Revalidate branch, dependency behavior, file hash, focused tests, and current
approval before the next edit. A changed dependency invalidates the old plan.

## Side Effect Reconciliation

Tool call `write-018` has an unknown outcome. Compare the persisted hash before
retry. Reuse idempotency key `migration-client-v2-write-018`; never issue a new
write identity until reconciliation is complete.

## Context Budget

Twenty percent holds goal and constraints, 20 percent current manifest state,
45 percent decision-relevant evidence, and 15 percent output contract. Raw logs
remain behind artifact references.

## Independent Review

An isolated reviewer receives the diff, requirements, tests, and rubric. It
returns complete, partial, or blocked with evidence and no implementation
transcript.
